const rateLimit = require("express-rate-limit");

// API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Terlalu banyak request API HTTP." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Socket Rate Limiter
const socketRateLimits = new Map();

function isSocketRateLimited(socketId) {
    const now = Date.now();
    const lastRequest = socketRateLimits.get(socketId) || 0;
    const LIMIT_DURATION = 5000; // 5 seconds constraint

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
