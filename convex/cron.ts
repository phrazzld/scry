import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Schedule rate limit cleanup to run every hour
// This helps prevent the rateLimits table from growing unbounded
crons.hourly(
  'cleanupExpiredRateLimits',
  {
    minuteUTC: 0, // Run at the top of every hour
  },
  internal.rateLimit.cleanupExpiredRateLimits
);

// Schedule job cleanup to run daily at 3 AM UTC
// Removes old completed jobs (7 days) and failed jobs (30 days)
crons.daily(
  'cleanupOldJobs',
  {
    hourUTC: 3,
    minuteUTC: 0,
  },
  internal.generationJobs.cleanup
);

// Schedule userStats reconciliation to run daily at 3 AM UTC
// Detects and auto-corrects drift in cached statistics
// Samples 100 random users, fixes drift >5 cards
crons.daily(
  'reconcileUserStats',
  {
    hourUTC: 3,
    minuteUTC: 15, // 15 minutes after job cleanup
  },
  internal.userStats.reconcileUserStats
);

// Schedule embedding sync to run daily at 3:30 AM UTC
// Backfills embeddings for questions that don't have them
// Processes up to 100 questions/day in batches of 10
crons.daily(
  'syncQuestionEmbeddings',
  {
    hourUTC: 3,
    minuteUTC: 30, // 30 minutes after job cleanup, 15 minutes after stats reconciliation
  },
  internal.embeddings.syncMissingEmbeddings
);

export default crons;
