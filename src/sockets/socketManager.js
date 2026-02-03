const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const {
  isSocketRateLimited,
  cleanUpSocketRateLimit,
} = require("../utils/rateLimit");

// Handlers
const userHandler = require("./userHandler");
const gameHandler = require("./gameHandler");
const chatHandler = require("./chatHandler");
const shopHandler = require("./shopHandler");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables!");
}

module.exports = (httpServer) => {
  const io = socketIo(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Middleware Auth
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    // Simpan default state
    socket.decoded = null;
    socket.isAuth = false;

    if (token) {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          console.warn(`⚠️ Invalid Token from ${socket.id}: ${err.message}`);
          return next(
            new Error("Authentication Error: Invalid or Expired Token"),
          );
        } else {
          socket.decoded = decoded;
          socket.isAuth = true;
          console.log(
            `🔑 Authenticated User: ${decoded.username} (${decoded.role})`,
          );
          next();
        }
      });
    } else {
      next(); // Guest
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User CONNECTED: ${socket.id} | Auth: ${socket.isAuth}`);

    // Global Middleware / Rate Limit Check for specific heavy events could be applied here
    // For now we just bind the handlers

    // Bind Handlers
    userHandler(socket, io);
    gameHandler(socket, io);
    chatHandler(socket, io);
    shopHandler(socket, io);

    socket.on("disconnect", () => {
      cleanUpSocketRateLimit(socket.id);
      console.log(`❌ User DISCONNECTED: ${socket.id}`);
    });
  });

  return io;
};
