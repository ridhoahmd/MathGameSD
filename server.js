const jwt = require("jsonwebtoken");
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

// Modules
const initSocket = require("./src/sockets/socketManager");
const { apiLimiter } = require("./src/utils/rateLimit");
const { askAI } = require("./src/services/aiService");

// Init App
const app = express();
const server = http.createServer(app);

// 1. MIDDLEWARES
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

// Cache Control
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// 2. SOCKET.IO MANANGER
initSocket(server);

// 3. API ROUTES
app.use("/api/ask-ai", apiLimiter);

// Secret Key Validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    "❌ FATAL: JWT_SECRET belum diset di .env! Server menolak start.",
  );
  process.exit(1);
}

// Route: Login Guru (Protected with Rate Limit)
app.post("/api/login-guru", apiLimiter, (req, res) => {
  const { kode } = req.body;
  const passwordBenar = process.env.GURU_PASSWORD;

  if (!passwordBenar) {
    console.error("❌ FATAL: GURU_PASSWORD belum diset di .env!");
    return res.status(500).json({
      success: false,
      message: "Server Misconfiguration: Password not set.",
    });
  }

  const inputKode = kode ? String(kode).trim() : "";
  if (inputKode === passwordBenar) {
    // Generate Token
    const token = jwt.sign({ role: "guru", username: "admin" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ success: true, role: "guru", token });
  } else {
    return res.status(401).json({ success: false, message: "Kode Salah" });
  }
});

// Route: Manual AI Request (if needed via HTTP)
app.post("/api/ask-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt missing" });

    const answer = await askAI(prompt);
    res.json({ answer });
  } catch (e) {
    console.error("API AI Error:", e.message);
    res.status(500).json({ error: "AI Service Error" });
  }
});

// 4. STATIC FILES
app.use(express.static(path.join(__dirname, "public")));

app.get(/.*/, (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/socket.io/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 5. START SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server Videa Class (Modular) Siap di Port ${PORT}`);
});
