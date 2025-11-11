import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, MutationCtx, QueryCtx } from './_generated/server';

const QUESTION_DELETE_BATCH_SIZE = 200;

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
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
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
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
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
    const timestamp = Date.now();
    const newUserId = await ctx.db.insert('users', {
      clerkId,
      email,
      name,
      image: imageUrl,
      emailVerified: emailVerified ? Date.now() : undefined,
      createdAt: timestamp,
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
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .first();

    if (!user) {
      // User not found, nothing to do
      return;
    }

    const now = Date.now();

    const questionQuery = ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('asc');

    let page = await questionQuery.paginate({ numItems: QUESTION_DELETE_BATCH_SIZE, cursor: null });
    await softDeleteQuestions(ctx, page.page, now);

    while (!page.isDone) {
      page = await questionQuery.paginate({
        numItems: QUESTION_DELETE_BATCH_SIZE,
        cursor: page.continueCursor,
      });
      await softDeleteQuestions(ctx, page.page, now);
    }

    // Note: We keep the user record for audit purposes
    // If you want to fully delete, uncomment:
    // await ctx.db.delete(user._id);
  },
});

async function softDeleteQuestions(
  ctx: MutationCtx,
  questions: Array<Doc<'questions'>>,
  timestamp: number
) {
  for (const question of questions) {
    await ctx.db.patch(question._id, { deletedAt: timestamp });
  }
}

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
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
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
    throw new Error('Authentication required');
  }

  return user;
}

/**
 * Public mutation to ensure a Convex user exists for the currently authenticated Clerk identity.
 *
 * This provides a development-friendly fallback when Clerk webhooks are not configured.
 * It is safe to call repeatedly and will update basic profile fields when they change.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error('Authentication required');
    }

    const clerkId = identity.subject;

    if (!clerkId) {
      throw new Error('Invalid Clerk identity');
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .first();

    const name =
      identity.name ||
      [identity.givenName, identity.familyName].filter(Boolean).join(' ') ||
      undefined;
    const imageUrl = identity.pictureUrl;
    const emailVerified = identity.emailVerified ? Date.now() : undefined;
    const email = identity.email;

    if (existingUser) {
      const updates: Partial<Doc<'users'>> = {};

      if (email && email !== existingUser.email) {
        updates.email = email;
      }

      if (name && name !== existingUser.name) {
        updates.name = name;
      }

      if (imageUrl && imageUrl !== existingUser.image) {
        updates.image = imageUrl;
      }

      if (emailVerified && emailVerified !== existingUser.emailVerified) {
        updates.emailVerified = emailVerified;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingUser._id, updates);
      }

      return existingUser._id;
    }

    if (!email) {
      throw new Error('Clerk identity is missing an email address');
    }

    const timestamp = Date.now();
    const newUserId = await ctx.db.insert('users', {
      clerkId,
      email,
      name,
      image: imageUrl,
      emailVerified,
      createdAt: timestamp,
    });

    return newUserId;
  },
});
