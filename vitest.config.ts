import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        // Auth module requires higher coverage
        'lib/auth.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        }
      },
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        'lib/generated/**',
        'scripts/**'
      ]
    },

    // Test organization
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'tests/e2e/**', // Keep Playwright E2E tests separate
      'lib/generated/**'
    ],

    // Performance configuration
    testTimeout: 10000,
    hookTimeout: 10000
  },

  // Path resolution for Next.js aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})