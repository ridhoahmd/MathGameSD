module.exports = {
  apps: [{
    name: "math-game-sd",
    script: "./server.js",
    instances: 1,
    exec_mode: "cluster",
    watch: false,
    max_memory_restart: "500M",
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
