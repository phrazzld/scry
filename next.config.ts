import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static asset optimization
  experimental: {
    // Optimize static imports and assets for better tree-shaking
    optimizePackageImports: [
      '@radix-ui/react-dialog', 
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-progress',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      'lucide-react'
    ],
    // Enable Web Vitals attribution for detailed performance debugging
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB'],
  },
  
  // Webpack optimizations for bundle splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split vendor chunks for better caching
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Separate chunk for UI components
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 20,
          },
          // Separate chunk for React and core libraries
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react-vendor',
            chunks: 'all',
            priority: 30,
          },
          // AI and form libraries
          ai: {
            test: /[\\/]node_modules[\\/](ai|@openrouter|zod|react-hook-form)[\\/]/,
            name: 'ai-vendor',
            chunks: 'all',
            priority: 15,
          },
          // Default vendor chunk for everything else
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all',
            priority: 10,
          },
        },
      }
    }
    
    return config
  },
  
  // Configure headers for static quiz assets
  async headers() {
    return [
      {
        // Apply caching headers to quiz assets
        source: '/quiz-assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          // Add CORS headers for CDN usage
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, HEAD, OPTIONS',
          },
        ],
      },
      {
        // Optimize the asset index specifically
        source: '/quiz-assets/index.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=3600', // Shorter cache for index
          },
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },

  // Configure rewrites for potential CDN integration
  async rewrites() {
    return [
      // Allow for future CDN integration
      {
        source: '/cdn/quiz-assets/:path*',
        destination: '/quiz-assets/:path*',
      },
    ];
  },
};

export default nextConfig;
