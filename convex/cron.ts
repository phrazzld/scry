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

export default crons;
