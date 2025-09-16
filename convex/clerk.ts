import { internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to sync a user from Clerk to our database.
 * This should only be called from Clerk webhooks or other internal functions.
 */
export const syncUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clerkId, email, name, imageUrl, emailVerified } = args;

    // Check if user already exists by clerkId
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email,
        name: name || existingUser.name,
        image: imageUrl || existingUser.image,
        emailVerified: emailVerified ? Date.now() : existingUser.emailVerified,
      });

      return existingUser._id;
    }

    // Check if user exists by email (migration case)
    const existingUserByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUserByEmail) {
      // Update existing user with Clerk ID
      await ctx.db.patch(existingUserByEmail._id, {
        clerkId,
        name: name || existingUserByEmail.name,
        image: imageUrl || existingUserByEmail.image,
        emailVerified: emailVerified ? Date.now() : existingUserByEmail.emailVerified,
      });

      return existingUserByEmail._id;
    }

    // Create new user
    const newUserId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      image: imageUrl,
      emailVerified: emailVerified ? Date.now() : undefined,
    });

    return newUserId;
  },
});

/**
 * Internal mutation to handle user deletion from Clerk.
 * Soft deletes the user and their data.
 */
export const deleteUser = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) {
      // User not found, nothing to do
      return;
    }

    // Soft delete user's questions
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    await Promise.all(
      questions.map((question) =>
        ctx.db.patch(question._id, { deletedAt: now })
      )
    );

    // Note: We keep the user record for audit purposes
    // If you want to fully delete, uncomment:
    // await ctx.db.delete(user._id);
  },
});

/**
 * Helper to get user from Clerk identity in Convex context.
 * This should be used in queries and mutations to get the authenticated user.
 */
export async function getUserFromClerk(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  // Get the Clerk user ID from the identity
  const clerkId = identity.subject;

  if (!clerkId) {
    return null;
  }

  // Find user by Clerk ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  return user;
}

/**
 * Helper to require authenticated user from Clerk.
 * Throws an error if not authenticated.
 */
export async function requireUserFromClerk(ctx: QueryCtx | MutationCtx) {
  const user = await getUserFromClerk(ctx);

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}