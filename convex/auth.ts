import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helper to generate a secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const sendMagicLink = mutation({
  args: { 
    email: v.string(),
    deploymentUrl: v.optional(v.string()),
    environment: v.optional(v.string())
  },
  handler: async (ctx, { email, deploymentUrl, environment }) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Check for existing unused magic links for this email
    const existingLink = await ctx.db
      .query("magicLinks")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("used"), false))
      .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
      .first();

    if (existingLink) {
      // Return early if a valid link already exists
      return { success: true, message: "Magic link already sent" };
    }

    // Generate new token
    const token = generateToken();
    const expiresAt = Date.now() + 3600000; // 1 hour from now

    // Store magic link in database with environment
    await ctx.db.insert("magicLinks", {
      email,
      token,
      expiresAt,
      used: false,
      environment: environment || 'development',
    });

    // Generate magic link URL
    // Use deployment URL if provided (from preview environments), otherwise use configured URL
    const baseUrl = deploymentUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}`;

    // Schedule the email action to run asynchronously
    console.log('[MUTATION] About to schedule email action for:', email);
    try {
      const scheduledId = await ctx.scheduler.runAfter(0, internal.emailActions.sendMagicLinkEmail, {
        email,
        magicLinkUrl,
      });
      console.log('[MUTATION] Successfully scheduled email action with ID:', scheduledId);
    } catch (error) {
      console.error('[MUTATION] Failed to schedule email action:', error);
      throw error;
    }

    // Return immediately - don't wait for email to send
    const isDevMode = !process.env.RESEND_API_KEY;
    if (isDevMode) {
      // In development, return the magic link URL for easy testing
      return { 
        success: true, 
        message: "Magic link sent",
        devUrl: magicLinkUrl
      };
    }

    return { success: true, message: "Magic link sent" };
  },
});

export const verifyMagicLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    // Find the magic link
    const magicLink = await ctx.db
      .query("magicLinks")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!magicLink) {
      throw new Error("Invalid magic link");
    }

    // Check if expired
    if (magicLink.expiresAt < Date.now()) {
      throw new Error("Magic link has expired");
    }

    // Check if already used
    if (magicLink.used) {
      throw new Error("Magic link has already been used");
    }

    // Mark as used
    await ctx.db.patch(magicLink._id, { used: true });

    // Find or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", magicLink.email))
      .first();

    if (!user) {
      // Create new user
      const userId = await ctx.db.insert("users", {
        email: magicLink.email,
        emailVerified: Date.now(),
      });
      user = await ctx.db.get(userId);
    } else if (!user.emailVerified) {
      // Update existing user to mark email as verified
      await ctx.db.patch(user._id, { emailVerified: Date.now() });
    }

    if (!user) {
      throw new Error("Failed to create or retrieve user");
    }

    // Create session with environment from magic link
    const sessionToken = generateToken();
    const sessionExpiresAt = Date.now() + 30 * 24 * 3600000; // 30 days

    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      expiresAt: sessionExpiresAt,
      environment: magicLink.environment || 'development',
    });

    return { 
      success: true, 
      sessionToken, 
      userId: user._id,
      email: user.email 
    };
  },
});

export const getCurrentUser = query({
  args: { 
    sessionToken: v.optional(v.string()),
    environment: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, environment }) => {
    if (!sessionToken) {
      return null;
    }

    // Find session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    // Validate session environment matches current environment
    const currentEnv = environment || 'development';
    const sessionEnv = session.environment || 'development';
    
    // Environment validation rules:
    // 1. Production sessions only work in production
    // 2. Preview sessions work in any preview environment
    // 3. Development sessions only work in development
    // 4. Legacy sessions (no environment) only work in development
    
    if (currentEnv === 'production' && sessionEnv !== 'production') {
      console.warn(`Session environment mismatch: session=${sessionEnv}, current=${currentEnv}`);
      return null;
    }
    
    if (currentEnv.startsWith('preview') && !sessionEnv.startsWith('preview')) {
      console.warn(`Session environment mismatch: session=${sessionEnv}, current=${currentEnv}`);
      return null;
    }
    
    if (currentEnv === 'development' && sessionEnv !== 'development') {
      console.warn(`Session environment mismatch: session=${sessionEnv}, current=${currentEnv}`);
      return null;
    }

    // Get user
    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

export const validateSession = query({
  args: {
    sessionToken: v.string(),
    environment: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .filter((q) => q.eq(q.field("environment"), args.environment))
      .first();
      
    if (!session) {
      return null;
    }
    
    return {
      userId: session.userId,
      expiresAt: session.expiresAt,
      isValid: session.expiresAt > Date.now()
    };
  },
});

export const signOut = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Find and delete session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});

export const updateProfile = mutation({
  args: { 
    sessionToken: v.string(),
    name: v.string(),
    email: v.string(),
    image: v.optional(v.union(v.string(), v.null()))
  },
  handler: async (ctx, { sessionToken, name, email, image }) => {
    // Find session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Invalid or expired session");
    }

    // Get user
    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if email is being changed to one that already exists
    if (email !== user.email) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      
      if (existingUser && existingUser._id !== user._id) {
        throw new Error("Email already in use");
      }
    }

    // Update user
    await ctx.db.patch(user._id, {
      name,
      email,
      image: image || undefined,
    });

    return { 
      success: true,
      user: {
        id: user._id,
        email,
        name,
        image: image || undefined,
      }
    };
  },
});

export const deleteAccount = mutation({
  args: { 
    sessionToken: v.string(),
    confirmationEmail: v.string()
  },
  handler: async (ctx, { sessionToken, confirmationEmail }) => {
    // Find session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Invalid or expired session");
    }

    // Get user
    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify email confirmation
    if (confirmationEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("Email confirmation does not match");
    }

    // Delete all user's sessions
    const userSessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    for (const userSession of userSessions) {
      await ctx.db.delete(userSession._id);
    }

    // Delete all user's quiz results
    const quizResults = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    for (const result of quizResults) {
      await ctx.db.delete(result._id);
    }

    // Delete the user
    await ctx.db.delete(user._id);

    return { success: true };
  },
});