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

// 🔧 FIX: Trust Railway/Nginx reverse proxy
// Tanpa ini, express-rate-limit error di production karena X-Forwarded-For header
app.set('trust proxy', 1);
app.use(
  helmet({
    // FIX: Disable HSTS & upgrade-insecure-requests saat belum pakai HTTPS
    // Aktifkan kembali setelah SSL/Certbot terpasang
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://cdnjs.cloudflare.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'", 
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "https://api.dicebear.com"
        ],
        connectSrc: [
          "'self'", 
          "ws:", 
          "wss:", 
          "https://*.firebaseio.com",
          "https://*.googleapis.com",
          "https://apis.google.com",       // FIX: firebase-auth membutuhkan ini (beda dari *.googleapis.com)
          "https://*.gstatic.com",         // FIX: Firebase source maps & assets
          "https://*.firebaseapp.com"       // FIX: Firebase Auth popup/redirect flow
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://apis.google.com"
        ],
        upgradeInsecureRequests: null, // Jangan paksa HTTPS saat belum ada SSL
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json());
// CRIT-06: sendBeacon() mengirim Content-Type: text/plain — butuh text parser
app.use(express.text({ type: "text/plain" }));


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
    // Bikin token 8 jam (cukup untuk satu hari mengajar)
    const token = jwt.sign({ role: "guru", username: "admin" }, JWT_SECRET, {
      expiresIn: "8h",
    });
    // Set HTTP-Only Cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 28800000 // 8 jam
    });
    return res.json({ success: true, role: "guru", token: token });
  } else {
    return res.status(401).json({ success: false, message: "Password salah!" });
  }
});

// Logout buat guru
app.post("/api/logout-guru", (req, res) => {
  res.clearCookie("authToken");
  return res.json({ success: true });
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

// ─── Health Check Endpoint ──────────────────────────────────────
// Digunakan oleh: PM2, Railway, Nginx upstream check, monitoring tools.
// Return 200 = server sehat, 503 = ada masalah (DB down, dll).
app.get("/api/health", async (req, res) => {
  const startTime = Date.now();
  const health = {
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()), // detik
    version:   process.env.npm_package_version || "1.0.0",
    node:      process.version,
    env:       process.env.NODE_ENV || "development",
    database:  "ok",
    memory: {
      used:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  };

  // Cek koneksi database dengan query ringan
  try {
    const prisma = require("./src/config/prisma");
    await prisma.$queryRaw`SELECT 1`;
    health.database = "ok";
  } catch (dbErr) {
    health.status   = "degraded";
    health.database = "error";
    logger.error(`[Health] DB check failed: ${dbErr.message}`);
  }

  health.responseTimeMs = Date.now() - startTime;

  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
});

// Endpoint untuk simulasi error testing uat
app.get("/api/simulate-error", (req, res, next) => {
  next(new Error("Simulasi Error Fatal Server Database/Memori!"));
});

// CRIT-06 FIX: Endpoint /api/quick-save untuk navigator.sendBeacon()
// Dipanggil saat user menutup tab (beforeunload event) sebagai emergency save.
// sendBeacon() mengirim data sebagai text/plain, bukan JSON — harus di-parse manual.
app.post("/api/quick-save", async (req, res) => {
  try {
    let body = req.body;

    // sendBeacon mengirim sebagai text/plain, bukan JSON
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { nama, game, skor, soalDijawab } = body || {};

    // Validasi minimal
    if (!nama || !game || skor === undefined) {
      return res.status(400).end();
    }

    // Sanitasi dasar
    const safeName = String(nama).substring(0, 50).replace(/[^a-zA-Z0-9 _\-]/g, "");
    const safeGame = String(game).substring(0, 20).replace(/[^a-z0-9\-]/g, "");
    const safeScore = Math.min(Math.max(parseInt(skor) || 0, 0), 9999);

    const prisma = require("./src/config/prisma");

    // Cari user
    const user = await prisma.user.findUnique({ where: { username: safeName } });
    if (!user) return res.status(404).end();

    // Cari atau buat game record
    const gameRecord = await prisma.game.upsert({
      where: { slug: safeGame },
      update: {},
      create: { slug: safeGame, title: safeGame.toUpperCase() }
    });

    // Simpan skor emergency (hanya jika > 0)
    if (safeScore > 0) {
      await prisma.score.create({
        data: { userId: user.id, gameId: gameRecord.id, score: safeScore }
      });

      // Update total score user
      await prisma.user.update({
        where: { id: user.id },
        data: { totalScore: { increment: safeScore } }
      });

      logger.info(`📡 Quick-save: ${safeName} | ${safeGame} | skor:${safeScore} | soal:${soalDijawab || 0}`);
    }

    // sendBeacon tidak butuh response body
    res.status(204).end();
  } catch (e) {
    logger.error(`Quick-save error: ${e.message}`);
    res.status(500).end();
  }
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
