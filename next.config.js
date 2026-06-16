const path = require("path");
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false, // We register manually in ServiceWorkerRegister.tsx
  skipWaiting: true,
  // Disable precaching - SW activates instantly, assets cached on-demand via runtimeCaching
  buildExcludes: [/.*/], // Exclude everything from precache
  // Runtime caching still works - assets get cached as they're fetched
  runtimeCaching: [
    {
      // Cache JS/CSS with stale-while-revalidate
      urlPattern: /\/_next\/static\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      // Cache images
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      // Cache fonts
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "fonts",
        expiration: { maxEntries: 16, maxAgeSeconds: 31536000 },
      },
    },
    {
      // Network-first for API calls
      urlPattern: /\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
      },
    },
    {
      // Network-first for pages
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid picking a parent folder when ~/package-lock.json exists (monorepo-ish layout)
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone", // Optimizes the output for production
  trailingSlash: true, // Ensures all URLs have trailing slashes (helps with PWA scope matching)
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
        // Service worker should not be cached
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
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
