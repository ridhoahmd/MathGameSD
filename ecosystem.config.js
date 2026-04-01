module.exports = {
  apps: [{
    name: "math-game-sd",
    script: "./server.js",
    instances: 1,
    exec_mode: "cluster",
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
