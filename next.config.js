/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  output: "standalone", // Optimizes the output for production
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
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
