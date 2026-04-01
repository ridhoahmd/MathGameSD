const jwt = require("jsonwebtoken");
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

// Import module butuh apa aja
const initSocket = require("./src/sockets/socketManager");
const { apiLimiter } = require("./src/utils/rateLimit");
const { askAI } = require("./src/services/aiService");
const logger = require("./src/utils/logger");
const morgan = require("morgan");

// Bikin aplikasi express & server
const app = express();
const server = http.createServer(app);

// Middleware dasar
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json());

// Hubungkan Morgan dengan Winston
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Biar ga nyimpen cache aneh-aneh
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Jalanin socket.io
const io = initSocket(server);

// Limit request API biar ga spam
app.use("/api/ask-ai", apiLimiter);

// Cek JWT Secret ada apa ngga
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error("❌ Ga bisa jalan bos, JWT_SECRET belom di set di .env!");
  process.exit(1);
}

// Login buat guru
app.post("/api/login-guru", apiLimiter, (req, res) => {
  const { kode } = req.body;
  const passwordBenar = process.env.GURU_PASSWORD;

  if (!passwordBenar) {
    logger.error("❌ Waduh, GURU_PASSWORD lupa di set di .env");
    return res.status(500).json({
      success: false,
      message: "Server config error: Password belum diset.",
    });
  }

  const inputKode = kode ? String(kode).trim() : "";
  if (inputKode === passwordBenar) {
    // Bikin token sejam aja
    const token = jwt.sign({ role: "guru", username: "admin" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ success: true, role: "guru", token });
  } else {
    return res.status(401).json({ success: false, message: "Password salah!" });
  }
});

// API buat nanya AI
app.post("/api/ask-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Mau nanya apa?" });

    const answer = await askAI(prompt);
    res.json({ answer });
  } catch (e) {
    logger.error(`Error AI: ${e.message}`);
    res.status(500).json({ error: "Lagi pusing AInya" });
  }
});

// Endpoint untuk simulasi error testing uat
app.get("/api/simulate-error", (req, res, next) => {
  next(new Error("Simulasi Error Fatal Server Database/Memori!"));
});

// Serve file statis (frontend) dengan Caching Pintar untuk Media
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, path) => {
    // Jika ekstensi file adalah media/gambar/audio/font, simpan di cache browser murid selama 30 hari
    if (path.match(/\.(png|jpe?g|gif|svg|webp|ico|mp3|wav|ogg|mp4|webm|woff|woff2|ttf|eot)$/i)) {
      res.set("Cache-Control", "public, max-age=2592000"); // 30 hari
      // Hapus no-cache bawaan sebelumnya diatas
      res.removeHeader("Pragma");
      res.removeHeader("Expires");
    } else {
      // Untuk script JS, CSS, dan HTML, paksa minta versi terbaru selalu
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
  }
}));

// Handle route lain, balikin ke index (SPA like behavior)
app.get(/.*/, (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/socket.io/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Global Error Handler Middleware buat nangkap 500 ke Winston
app.use((err, req, res, next) => {
  logger.error(`[Express Error] ${req.method} ${req.url} - ${err.message}\n${err.stack}`);
  res.status(500).json({ error: "Internal Server Error" });
});

// Gas server!
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`🚀 Server jalan di Port ${PORT}`);
  });
}

module.exports = { app, server, io };
