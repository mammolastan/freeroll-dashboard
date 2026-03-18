module.exports = {
  apps: [
    {
      name: "freeroll-dashboard",
      script: "dist/server.mjs",
      cwd: "/var/www/freeroll-dashboard",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "localhost",
      },
    },
  ],
};
