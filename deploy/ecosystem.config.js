module.exports = {
  apps: [
    {
      name: "psyx-api",
      script: "./api/index.mjs",
      cwd: "/srv/psyx",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        // Override with your .env values or set them here:
        // PORT: 3001,
        // DATABASE_URL: "postgresql://...",
        // SESSION_SECRET: "...",
      },
      env_file: "/srv/psyx/.env",
      error_file: "/var/log/psyx/error.log",
      out_file: "/var/log/psyx/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
