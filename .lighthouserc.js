module.exports = {
  ci: {
    // Collection settings
    collect: {
      // Static site mode - test the built site
      staticDistDir: './.next',
      // Number of runs per URL
      numberOfRuns: 3,
      // URLs to test (relative to staticDistDir)
      url: ['/', '/quiz-mode', '/review', '/my-questions'],
      settings: {
        // Use desktop preset for consistency
        preset: 'desktop',
        // Throttle settings for consistent results
        throttling: {
          cpuSlowdownMultiplier: 4,
        },
      },
    },

    // Upload settings (optional - for storing results)
    upload: {
      target: 'temporary-public-storage',
    },

    // Assertion settings - all warnings, no failures
    assert: {
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],

        // Interactive metrics
        interactive: ['warn', { maxNumericValue: 5000 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],

        // Resource metrics
        'uses-webp-images': 'warn',
        'uses-optimized-images': 'warn',
        'uses-text-compression': 'warn',
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',

        // JavaScript performance
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
        'bootup-time': ['warn', { maxNumericValue: 4500 }],
        'unused-javascript': ['warn', { maxLength: 2 }],

        // Best practices
        'errors-in-console': 'warn',
        'no-document-write': 'warn',
        'uses-http2': 'warn',

        // Accessibility basics (informational)
        'color-contrast': 'warn',
        'image-alt': 'warn',
        'heading-order': 'warn',
        'meta-viewport': 'warn',

        // SEO basics (informational)
        'document-title': 'warn',
        'meta-description': 'warn',

        // Categories scores (0-100)
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },
  },
};
