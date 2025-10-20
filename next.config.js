/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  output: "standalone", // Optimizes the output for production
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
  async headers() {
    return [
      {
        // Cache HTML pages for 1 day, but revalidate
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
      {
        // Allow longer caching for static assets (they have hashed filenames)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes should not be cached
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        nodeEnv: "production",
        minimize: true,
        mergeDuplicateChunks: true,
        removeEmptyChunks: true,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
