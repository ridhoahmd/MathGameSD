const rateLimit = require("express-rate-limit");

// Batasin Request API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Sabar dong, request API kebanyakan." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Batasin Request Socket
const socketRateLimits = new Map();

function isSocketRateLimited(socketId) {
  const now = Date.now();
  const lastRequest = socketRateLimits.get(socketId) || 0;
  const LIMIT_DURATION = 5000; // Jeda 5 detik

  if (now - lastRequest < LIMIT_DURATION) {
    return true;
  }

  socketRateLimits.set(socketId, now);
  return false;
}

function cleanUpSocketRateLimit(socketId) {
  if (socketRateLimits.has(socketId)) {
    socketRateLimits.delete(socketId);
  }
}

module.exports = { apiLimiter, isSocketRateLimited, cleanUpSocketRateLimit };
