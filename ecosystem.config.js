module.exports = {
  apps: [
    {
      name: "freeroll-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/freeroll-dashboard",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000, // adjust if needed
      },
    },
  ],
};
