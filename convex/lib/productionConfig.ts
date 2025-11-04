/**
 * Production Configuration Query
 *
 * Single source of truth for AI generation configuration.
 * Reads from Convex environment variables at runtime.
 *
 * ARCHITECTURE: This ensures Lab and production generation use
 * identical configs, preventing divergence and test/prod mismatches.
 */

import { query } from '../_generated/server';

/**
 * Get current production AI configuration
 *
 * Returns the actual runtime configuration used by production question generation.
 * Genesis Lab uses this to create its "PRODUCTION" config dynamically.
 */
export const getProductionConfig = query({
  handler: async () => {
    return {
      provider: (process.env.AI_PROVIDER || 'openai') as 'openai' | 'google',
      model: process.env.AI_MODEL || 'gpt-5-mini',
      reasoningEffort:
        (process.env.AI_REASONING_EFFORT as 'minimal' | 'low' | 'medium' | 'high') || 'high',
      verbosity: (process.env.AI_VERBOSITY as 'low' | 'medium' | 'high') || 'medium',
    };
  },
});
