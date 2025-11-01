import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      include: ['convex/spacedRepetition.test.ts'],
      coverage: {
        thresholds: {
          lines: 80,
          functions: 80,
        },
      },
    },
  },
  {
    test: {
      include: ['lib/auth-cookies.test.ts'],
      coverage: {
        thresholds: {
          lines: 80,
        },
      },
    },
  },
]);
