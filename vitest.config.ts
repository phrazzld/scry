import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test settings
    globals: true,

    // Use happy-dom for React component/hook testing
    environment: 'happy-dom',

    // Setup file for React Testing Library
    setupFiles: ['./vitest.setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'], // Add lcov for Codecov

      // Coverage thresholds
      // CURRENT STATE: 18.98% (as of 2025-11-02)
      // TARGET: 60%+ (Google research: 60% acceptable, 75% commendable)
      //
      // Improvement plan tracked in BACKLOG.md "Test Coverage Improvement Initiative":
      // - Phase 1 (Q1 2025): 18.9% → 30% (test critical lib/ files)
      // - Phase 2 (Q2 2025): 30% → 45% (test hooks with side effects)
      // - Phase 3 (Q3 2025): 45% → 60% (test error paths + edge cases)
      //
      // DO NOT lower these thresholds. Only increase as coverage improves.
      thresholds: {
        lines: 18.9, // Current: 18.98%, Target: 60%
        functions: 18.9, // Current: ~19%, Target: 60%
        branches: 15.9, // Current: ~16%, Target: 55%
        statements: 18.9, // Current: 18.98%, Target: 60%
      },
      include: ['lib/**', 'convex/**', 'hooks/**'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        'lib/generated/**',
        'scripts/**',
      ],
    },

    // Test organization
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'tests/e2e/**', // Keep Playwright E2E tests separate
      'lib/generated/**',
    ],

    // Performance configuration
    testTimeout: 10000,
    hookTimeout: 10000,

    // Enable parallel test execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Show test timing to identify slow tests
    reporters: ['verbose'],
  },

  // Path resolution for Next.js aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
