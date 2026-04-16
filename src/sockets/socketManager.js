const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const {
  isSocketRateLimited,
  cleanUpSocketRateLimit,
} = require("../utils/rateLimit");

// Handlers (Pengurus masing-masing fitur)
const userHandler = require("./userHandler");
const gameHandler = require("./gameHandler");
const chatHandler = require("./chatHandler");
const shopHandler = require("./shopHandler");
const adminHandler = require("./adminHandler");

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

  // Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    // Simpan default state
    socket.decoded = null;
    socket.isAuth = false;

    if (token) {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          // Token invalid/expired: jangan putus koneksi, cukup downgrade ke tamu
          // Ini mencegah halaman guru crash hanya karena token expired
          console.warn(`⚠️ Token tidak valid dari ${socket.id}: ${err.message} — diteruskan sebagai tamu.`);
          next(); // Lanjutkan sebagai tamu (isAuth tetap false)
        } else {
          socket.decoded = decoded;
          socket.isAuth = true;
          console.log(
            `🔑 User Ter-autentikasi: ${decoded.username} (${decoded.role})`,
          );
          next();
        }
      });
    } else {
      next(); // Tamu tanpa token
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User CONNECTED: ${socket.id} | Auth: ${socket.isAuth}`);

    // Middleware Global / Rate Limit bisa ditaruh sini
    // Sekarang kita langsung bind handler aja

    // Sambungin Handlers
    userHandler(socket, io);
    gameHandler(socket, io);
    chatHandler(socket, io);
    shopHandler(socket, io);
    adminHandler(socket, io);

    socket.on("disconnect", () => {
      cleanUpSocketRateLimit(socket.id);
      console.log(`❌ User DISCONNECTED: ${socket.id}`);
    });
  });

  return io;
};
