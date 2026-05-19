module.exports = {
  apps: [{
    name: "math-game-sd",
    script: "./server.js",

    // CRIT-04 FIX: Gunakan single instance, BUKAN cluster mode.
    // Alasan: Aplikasi menggunakan in-memory state yang tidak bisa dishare antar worker:
    //   - socketRateLimits (Map) di rateLimit.js
    //   - socket.activeGameSession per-socket
    //   - global.CONTENT_SOURCE_PRIORITY
    // Solusi cluster yang benar butuh Redis adapter (Socket.IO) + Redis store (rate limit).
    // Untuk saat ini, single instance lebih aman dan stabil.
    instances: 1,
    exec_mode: "fork",

    watch: false,
    max_memory_restart: "500M",

    // PM2 Logging config
    error_file: "logs/pm2-error.log",
    out_file: "logs/pm2-out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",

    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    env_development: {
      NODE_ENV: "development",
      PORT: 3000,
      watch: true
    }
  }]
};
