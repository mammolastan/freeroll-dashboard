const path = require("path");
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Exclude the dynamic manifest routes from SW precaching
  exclude: [/manifest\.json/],
  buildExcludes: [
    /middleware-build-manifest\.js$/,
    /middleware-react-loadable-manifest\.js$/,
    /next-font-manifest\.js$/,
    /\.map$/,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid picking a parent folder when ~/package-lock.json exists (monorepo-ish layout)
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone", // Optimizes the output for production
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
      {
        // Cache user-uploaded content for 1 year
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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

module.exports = withPWA(nextConfig);
