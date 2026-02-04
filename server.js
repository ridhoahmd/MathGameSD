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
initSocket(server);

// Limit request API biar ga spam
app.use("/api/ask-ai", apiLimiter);

// Cek JWT Secret ada apa ngga
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ Ga bisa jalan bos, JWT_SECRET belom di set di .env!");
  process.exit(1);
}

// Login buat guru
app.post("/api/login-guru", apiLimiter, (req, res) => {
  const { kode } = req.body;
  const passwordBenar = process.env.GURU_PASSWORD;

  if (!passwordBenar) {
    console.error("❌ Waduh, GURU_PASSWORD lupa di set di .env");
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
    console.error("Error AI:", e.message);
    res.status(500).json({ error: "Lagi pusing AInya" });
  }
});

// Serve file statis (frontend)
app.use(express.static(path.join(__dirname, "public")));

// Handle route lain, balikin ke index (SPA like behavior)
app.get(/.*/, (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/socket.io/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Gas server!
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server jalan di Port ${PORT}`);
});
