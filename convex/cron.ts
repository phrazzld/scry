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

export default crons;
