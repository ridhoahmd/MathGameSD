require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const xss = require("xss");

//prisma
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

prisma
  .$connect()
  .then(() => console.log("✅ DATABASE POSTGRE: TERHUBUNG!"))
  .catch((e) => console.error("❌ DATABASE ERROR:", e.message));

// helmet frbse google login
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(express.json());

// konfig hrga
const ITEM_PRICES = {
  neon: 500,
  gold: 1500,
  royal: 3000,
  fire: 5000,
  default: 0,
};

//cche ctrl
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// 1.konfigurasi keamanan dan utiliti
//a.limiter api http
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Terlalu banyak request API HTTP." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/ask-ai", apiLimiter);

//b. Limiter Manual untuk SOCKET.IO
const socketRateLimits = new Map();

function isSocketRateLimited(socketId) {
  const now = Date.now();
  const lastRequest = socketRateLimits.get(socketId) || 0;
  const LIMIT_DURATION = 5000;

  if (now - lastRequest < LIMIT_DURATION) {
    return true;
  }

  socketRateLimits.set(socketId, now);
  return false;
}

// c. Utilitas Pembersih Data
function sanitizeKey(key) {
  return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

// 2. config ai (GLm-4)
const CURRENT_AI_MODEL = "glm";

async function askAI(promptText) {
  console.log(`🧠 AI Request (Model: ${CURRENT_AI_MODEL})`);

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ API Key AI Kosong/Salah");
    return "Error: API Key Missing";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4-flash",
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah server game edukasi. Output HANYA JSON mentah.",
            },
            { role: "user", content: promptText },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Server  Socket.io + Prisma (PostgreSQL)
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 4.stregi prompt ai
let PROMPT_STRATEGIES = {};
try {
  PROMPT_STRATEGIES = require("./prompts/gamePrompts");
} catch (e) {
  console.log("ℹ️ Menggunakan Fallback Strategy (gamePrompts tidak ditemukan)");
}

function getFallbackData(kategori) {
  const fallbacks = {
    math: [{ soal: "10 + 10 = ?", jawaban: 20 }],
    nabi: [
      { tanya: "Nabi terakhir?", opsi: ["Isa", "Muhammad"], jawab: "Muhammad" },
    ],
    ayat: [
      {
        tanya: "Al-Fatihah 1?",
        opsi: ["Bismillah", "Alhamdulillah"],
        jawab: "Bismillah",
      },
    ],
    kasir: [
      {
        cerita: "Offline Mode",
        total_belanja: 500,
        uang_bayar: 1000,
        kembalian: 500,
      },
    ],
    memory: [
      { a: "A", b: "B" },
      { a: "C", b: "D" },
    ],
    labirin: { maze_size: 10, soal_list: [{ tanya: "1+1", jawab: "2" }] },
    zuma: { deskripsi: "Mode Offline", palet_warna: ["#f00"], speed: "sedang" },
    piano: { sequence: [1, 2, 3, 4, 5] },
    tajwid: {
      kategori_kiri: "Izhar",
      kategori_kanan: "Ikhfa",
      data: [{ teks: "nun", hukum: "kiri" }],
    },
  };
  return fallbacks[kategori] || [];
}

// 5.socket.io
io.on("connection", (socket) => {
  console.log(`✅ User CONNECTED: ${socket.id}`);

  // [BARU] TAHAP 2: Listener Mulai Game (Untuk Catat Waktu)
  socket.on("mulaiGame", (kategori) => {
    socket.activeGameSession = {
      game: kategori,
      startTime: Date.now(),
    };
    console.log(
      `⏱️ Timer Start: ${
        socket.activeUser ? socket.activeUser.username : "Guest"
      } main ${kategori}`,
    );
  });

  //A.permintaan soal
  socket.on("mintaSoalAI", async (reqData) => {
    const { kategori, tingkat } = reqData || {};
    const levelRequest = tingkat || "sedang";

    console.log(`📩 REQUEST: ${kategori} (${levelRequest})`);

    let finalData = [];

    try {
      // 1. SETUP LEVEL DWI-BAHASA
      let levelAlt = levelRequest;
      if (levelRequest.toLowerCase() === "mudah") levelAlt = "Easy";
      else if (levelRequest.toLowerCase() === "sedang") levelAlt = "Medium";
      else if (levelRequest.toLowerCase() === "sulit") levelAlt = "Hard";

      // 2. QUERY DATABASE (Ambil Banyak Baris Sekaligus)
      // Kita set limit 200 agar bisa menampung variasi soal yang banyak
      let questions = await prisma.gameQuestion.findMany({
        where: {
          AND: [
            { category: { equals: kategori, mode: "insensitive" } },
            {
              OR: [
                { level: { equals: levelRequest, mode: "insensitive" } },
                { level: { equals: levelAlt, mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 200,
      });

      // [FIX ZUMA] Logika Darurat jika level spesifik kosong
      if ((!questions || questions.length === 0) && kategori === "zuma") {
        console.log(
          "⚠️ Level Zuma spesifik nihil, mengambil level acak dari DB...",
        );
        questions = await prisma.gameQuestion.findMany({
          where: { category: { equals: "zuma", mode: "insensitive" } },
          take: 50,
        });
      }

      // 3. PROSES DATA
      if (questions && questions.length > 0) {
        let rawContent = questions.map((q) => q.content);

        // --- KELOMPOK 1: CONFIG GAME (Zuma, Labirin, Piano) ---
        // Ambil 1 Baris Config secara acak
        if (["zuma", "labirin", "piano"].includes(kategori)) {
          const randomIndex = Math.floor(Math.random() * rawContent.length);
          finalData = rawContent[randomIndex];
          console.log(
            `✅ ${kategori}: Mengirim Config Level (dari ${rawContent.length} opsi)`,
          );
        }

        // --- KELOMPOK 2: GAME TAJWID (SMART GROUPING) ---
        // Gabungkan soal tapi JAGA KONSISTENSI TOPIK (Izhar vs Ikhfa, dll)
        else if (kategori === "tajwid") {
          // A. Pilih satu baris acak sebagai "Acuan Topik"
          const refRow =
            rawContent[Math.floor(Math.random() * rawContent.length)];

          // B. Cari baris lain yang TOPIKNYA SAMA dengan acuan
          // (Agar label Kiri/Kanan di layar sesuai dengan semua soal)
          const matchingRows = rawContent.filter(
            (row) =>
              row.kategori_kiri === refRow.kategori_kiri &&
              row.kategori_kanan === refRow.kategori_kanan,
          );

          // C. Gabungkan semua soal dari baris yang cocok
          let poolSoal = [];
          matchingRows.forEach((row) => {
            if (row.data && Array.isArray(row.data)) {
              poolSoal.push(...row.data);
            }
          });

          console.log(
            `📊 Tajwid: Topik terpilih "${refRow.kategori_kiri}", terkumpul ${poolSoal.length} soal.`,
          );

          // D. Ambil 10 Soal Acak
          poolSoal = poolSoal.sort(() => Math.random() - 0.5).slice(0, 10);

          // E. Rakit Ulang Format untuk Client
          finalData = {
            kategori_kiri: refRow.kategori_kiri,
            kategori_kanan: refRow.kategori_kanan,
            data: poolSoal,
          };
        }

        // --- KELOMPOK 3: KUIS BIASA (Math, Nabi, Ayat, dll) ---
        else {
          let poolSoal = [];
          rawContent.forEach((item) => {
            if (item.data && Array.isArray(item.data))
              poolSoal.push(...item.data);
            else if (Array.isArray(item)) poolSoal.push(...item);
            else poolSoal.push(item);
          });

          // Acak & Limit
          finalData = poolSoal.sort(() => Math.random() - 0.5);
          if (kategori === "kasir") finalData = finalData.slice(0, 10);
          else finalData = finalData.slice(0, 20);

          // Acak Opsi Jawaban (A,B,C,D)
          if (finalData.length > 0 && finalData[0].opsi) {
            finalData = finalData.map((soal) => {
              let newSoal = JSON.parse(JSON.stringify(soal)); // Deep copy
              if (Array.isArray(newSoal.opsi))
                newSoal.opsi.sort(() => Math.random() - 0.5);
              return newSoal;
            });
          }
          console.log(`✅ ${kategori}: Mengirim ${finalData.length} Soal`);
        }
      } else {
        console.warn(`⚠️ DB NIHIL TOTAL: ${kategori}`);
      }
    } catch (err) {
      console.error("❌ DB ERROR:", err.message);
    }

    // 4. FALLBACK (JIKA MASIH KOSONG JUGA)
    if (
      !finalData ||
      (Array.isArray(finalData) && finalData.length === 0) ||
      (kategori === "tajwid" && !finalData.data)
    ) {
      console.log(`⚠️ Menggunakan FALLBACK DATA untuk ${kategori}`);
      finalData = getFallbackData(kategori);
      // Fix struktur Tajwid Fallback
      if (kategori === "tajwid" && !finalData.data)
        finalData = getFallbackData("tajwid");
    }

    socket.emit("soalDariAI", { kategori, data: finalData });
  });

  // B. simpan skor
  // --- KODE FINAL FIX v2: SIMPAN SKOR ---
  socket.on("simpanSkor", async (data) => {
    // 1. Validasi Input
    if (!data || !data.nama || !data.game) return;
    let skor = parseInt(data.skor);
    if (isNaN(skor)) skor = 0;

    // 2. Anti-Cheat Sederhana
    if (
      !socket.activeGameSession ||
      socket.activeGameSession.game !== data.game
    ) {
      // console.warn(`⚠️ Warning: Skor tanpa sesi valid`);
    }

    const safeName = data.nama;
    const gameSlug = data.game;
    const koin = Math.floor(skor / 10);

    try {
      // 3. Pastikan Game Ada
      let gameDb = await prisma.game.findUnique({ where: { slug: gameSlug } });
      if (!gameDb) {
        gameDb = await prisma.game.create({
          data: { slug: gameSlug, title: gameSlug.toUpperCase() },
        });
      }

      // 4. Update User & AMBIL DATANYA
      const updatedUser = await prisma.user.upsert({
        where: { username: safeName },
        update: {
          coins: { increment: koin },
          totalScore: { increment: skor },
        },
        create: {
          username: safeName,
          role: "siswa",
          coins: koin,
          totalScore: skor,
        },
      });

      // 5. Catat Riwayat (FULL CONNECT)
      await prisma.score.create({
        data: {
          score: skor,
          // FIX: Gunakan 'connect' untuk Game (WAJIB dipasangkan dengan connect User)
          game: {
            connect: { id: gameDb.id },
          },
          // FIX: Gunakan 'connect' untuk User
          user: {
            connect: { id: updatedUser.id },
          },
        },
      });

      console.log(`💾 SAVE SUKSES: ${safeName} (+${skor} pts)`);
      io.emit("refreshDataGuru");
    } catch (err) {
      console.error("❌ DB Error:", err.message);
    }
  });

  //C. leaderbord
  socket.on("mintaLeaderboard", async () => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { totalScore: "desc" },
        take: 50,
        include: {
          scores: { include: { game: true } },
        },
      });

      const leaderboard = users.map((user) => {
        const skorMap = {};
        user.scores.forEach((record) => {
          const slug = record.game.slug;
          if (!skorMap[slug] || record.score > skorMap[slug]) {
            skorMap[slug] = record.score;
          }
        });

        return {
          nama: user.username,
          role: user.role,
          skor: user.totalScore || 0,
          koin: user.coins || 0,
          math: skorMap["math"] || 0,
          zuma: skorMap["zuma"] || 0,
          memory: skorMap["memory"] || 0,
          piano: skorMap["piano"] || 0,
          kasir: skorMap["kasir"] || 0,
          labirin: skorMap["labirin"] || 0,
          nabi: skorMap["nabi"] || 0,
          ayat: skorMap["ayat"] || 0,
        };
      });

      socket.emit("updateLeaderboard", leaderboard);
    } catch (err) {
      console.error("❌ Gagal ambil leaderboard SQL:", err.message);
      socket.emit("updateLeaderboard", []);
    }
  });

  // D. DATA PROFIL (DIPERBAIKI)
  socket.on("mintaDataProfil", async (data) => {
    let username = "";
    let fotoGoogle = "";

    // Normalisasi input
    if (typeof data === "string") {
      username = data.trim(); // Hapus spasi tidak sengaja
    } else if (typeof data === "object") {
      username = data.nama.trim();
      fotoGoogle = data.foto;
    }

    // Validasi sederhana
    if (!username) return;

    // [BARU] Simpan identitas di memori socket server
    // Ini membuat server "ingat" siapa koneksi ini sebenarnya
    socket.activeUser = {
      username: username,
      role: "siswa", // Default dulu, nanti diupdate dari DB
    };

    console.log(`👤 Request Profil: ${username}`);

    try {
      // 1. Update Foto jika ada (Login Google)
      if (fotoGoogle) {
        await prisma.user.upsert({
          where: { username: username },
          update: { photoURL: fotoGoogle },
          create: {
            username: username,
            role: "siswa",
            coins: 0,
            totalScore: 0,
            photoURL: fotoGoogle,
          },
        });
      }

      // 2. Cari User di Database
      let user = await prisma.user.findUnique({
        where: { username: username },
      });

      // Jika user baru (Guest), buatkan di DB
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: username,
            coins: 0,
            totalScore: 0,
            role: "siswa",
          },
        });
      }

      // [BARU] Update Memory Server dengan Role Asli dari Database
      socket.activeUser.role = user.role;
      console.log(
        `🔒 Session Terdaftar: ${socket.activeUser.username} sebagai ${socket.activeUser.role}`,
      );

      // 3. Kirim Data ke Client (Frontend)
      const finalFoto =
        user.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;

      socket.emit("updateProfil", {
        nama: user.username,
        koin: user.coins,
        skor: user.totalScore || 0,
        role: user.role,
        foto: finalFoto,
        frame: user.equippedFrame || "default",
        theme: user.activeTheme || "default",
      });
    } catch (err) {
      console.error("❌ Gagal ambil profil SQL:", err.message);
    }
  });

  // D.cht global
  socket.on("chatMessage", (msg) => {
    if (!msg.pesan || !msg.pesan.trim()) return;

    // 4: Sanitasi Anti-Hacker (XSS)
    const rawPesan = msg.pesan.substring(0, 100);
    const cleanPesan = xss(rawPesan).replace(
      /(anjing|babi|bodoh|kasar)/gi,
      "***",
    );

    io.emit("chatMessage", {
      nama: sanitizeKey(msg.nama).substring(0, 15),
      pesan: cleanPesan,
      waktu: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });

  // E. ai tutor
  socket.on("mintaPenjelasan", async (data) => {
    const cleanSoal = data.soal || "";
    const cleanJawabBenar = data.jawabanBenar || data.jawabBenar;
    const cleanJawabUser = data.jawabanUser || data.jawabUser;
    const gameType = data.game || data.kategori || "Umum";

    if (!cleanSoal || !cleanJawabBenar) return;

    try {
      console.log(`👨‍🏫 Tutor dipanggil: ${gameType}`);
      let prompt;
      if (PROMPT_STRATEGIES.tutor) {
        prompt = PROMPT_STRATEGIES.tutor(
          cleanSoal,
          cleanJawabUser,
          cleanJawabBenar,
          gameType,
        );
      } else {
        prompt = `Jelaskan kenapa jawaban ${cleanJawabBenar} benar untuk soal ${cleanSoal}.`;
      }

      const penjelasanAI = await askAI(prompt);
      socket.emit("penjelasanTutor", {
        teks: penjelasanAI,
        penjelasan: penjelasanAI,
      });
    } catch (e) {
      console.error("❌ Tutor Error:", e.message);
      const fallback = `Jawaban yang benar: ${cleanJawabBenar}. Tetap semangat!`;
      socket.emit("penjelasanTutor", { teks: fallback, penjelasan: fallback });
    }
  });

  // F. logik room&duel
  socket.on("joinRoom", (data) => {
    if (!data.room) return;
    socket.join(data.room);
    socket.to(data.room).emit("playerJoined", data.username);
  });

  socket.on("laporSkor", (data) => {
    if (data.room) socket.to(data.room).emit("updateSkorLawan", data.skor);
  });

  socket.on("joinMathDuel", async (data) => {
    const room = data.room;
    const roomInstance = io.sockets.adapter.rooms.get(room);
    const playerCount = roomInstance ? roomInstance.size : 0;

    if (playerCount >= 2) {
      socket.emit("waitingForOpponent", "Room Penuh (Max 2).");
      return;
    }

    socket.join(room);

    if (playerCount === 0) {
      socket.emit("waitingForOpponent", "Menunggu pemain kedua...");
    } else {
      let soalDuel = getFallbackData("math");
      io.in(room).emit("startDuel", { soal: soalDuel });
    }
  });

  socket.on("updateScoreDuel", (data) => {
    socket.to(data.room).emit("opponentScoreUpdate", data.score);
  });

  // updt role usr (AMAN)
  socket.on("updateUserRole", async (data) => {
    const { targetUser, newRole } = data;

    // Cek 1: Apakah socket ini sudah login?
    if (!socket.activeUser) {
      socket.emit("errorUpdate", "Akses Ditolak: Sesi tidak valid.");
      return;
    }

    // Cek 2: Apakah User yang me-request adalah Admin/Guru?
    const myRole = socket.activeUser.role;

    if (myRole !== "admin" && myRole !== "guru") {
      console.warn(
        `⚠️ Percobaan Hacking Role oleh ${socket.activeUser.username}`,
      );
      socket.emit("errorUpdate", "Anda tidak punya izin! (Hanya Admin/Guru)");
      return;
    }

    try {
      // Eksekusi Update
      await prisma.user.update({
        where: { username: targetUser },
        data: { role: newRole },
      });

      console.log(
        `👮 Role Update: ${targetUser} sekarang adalah ${newRole} (oleh ${socket.activeUser.username})`,
      );

      io.emit("refreshDataGuru"); // Refresh tabel semua guru
    } catch (err) {
      console.error("❌ Gagal update role:", err.message);
      socket.emit("errorUpdate", "Gagal mengupdate database.");
    }
  });

  // rst systemee
  socket.on("adminResetSystem", async (data) => {
    const passwordInput = typeof data === "object" ? data.password : "";

    // Verifikasi Password Admin (Dari .env)
    if (passwordInput !== process.env.GURU_PASSWORD) {
      console.warn(`⚠️ Percobaan Reset Ilegal dari ${socket.id}`);
      return;
    }

    // Jika password benar, baru eksekusi
    try {
      await prisma.score.deleteMany({});
      await prisma.user.updateMany({
        data: { coins: 0, totalScore: 0, inventory: ["default"] },
      });
      console.log("⚠️ SYSTEM RESET BY AUTHENTICATED ADMIN");
      io.emit("forceRefresh");
    } catch (e) {
      console.error("Gagal Reset:", e);
    }
  });

  // --- G. SISTEM TOKO (VERSI AMAN) ---
  socket.on("beliItem", async (data) => {
    const { username, itemId } = data;

    // 1. Cek Harga Server
    const hargaAsli = ITEM_PRICES[itemId];
    if (hargaAsli === undefined) {
      return socket.emit("transaksiGagal", "Item tidak valid/dijual.");
    }

    console.log(
      `🛒 ${username} mau beli ${itemId} seharga ${hargaAsli} (Server Price)`,
    );

    try {
      const user = await prisma.user.findUnique({
        where: { username: username },
      });
      if (!user) return;

      // 2. Cek Saldo & Inventory
      if (user.coins < hargaAsli) {
        socket.emit("transaksiGagal", "Maaf, Koin tidak cukup! 🪙");
        return;
      }

      let myInventory = user.inventory;
      if (typeof myInventory === "string")
        myInventory = JSON.parse(myInventory);
      if (!Array.isArray(myInventory)) myInventory = [];

      if (myInventory.includes(itemId)) {
        socket.emit("transaksiGagal", "Kamu sudah punya barang ini! ✅");
        return;
      }

      // 3. Proses Transaksi Aman
      myInventory.push(itemId);

      const updatedUser = await prisma.user.update({
        where: { username: username },
        data: {
          coins: { decrement: hargaAsli },
          inventory: myInventory,
        },
      });

      console.log(
        `✅ Transaksi Sukses: ${username} sisa koin ${updatedUser.coins}`,
      );

      socket.emit("transaksiSukses", {
        itemId: itemId,
        sisaKoin: updatedUser.coins,
        inventory: myInventory,
      });

      socket.emit("updateProfil", {
        nama: updatedUser.username,
        koin: updatedUser.coins,
        skor: updatedUser.totalScore,
        role: updatedUser.role,
        foto: updatedUser.photoURL || null,
      });
    } catch (err) {
      console.error("❌ Error Transaksi:", err.message);
      socket.emit("transaksiGagal", "Terjadi kesalahan server.");
    }
  });

  socket.on("pakaiItem", async (data) => {
    const { username, tipe, itemId } = data;
    console.log(`👕 ${username} ganti ${tipe} ke ${itemId}`);
    try {
      if (tipe === "theme") {
        await prisma.user.update({
          where: { username: username },
          data: { activeTheme: itemId },
        });
      } else if (tipe === "frame") {
        await prisma.user.update({
          where: { username: username },
          data: { equippedFrame: itemId },
        });
      }
      socket.emit("itemTerpasang", { tipe, itemId });
    } catch (err) {
      console.error("❌ Gagal ganti item:", err.message);
    }
  });

  socket.on("mintaInventory", async (username) => {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        inventory: true,
        activeTheme: true,
        equippedFrame: true,
        coins: true,
      },
    });

    if (user) {
      socket.emit("dataInventory", {
        owned: user.inventory || [],
        activeTheme: user.activeTheme,
        activeFrame: user.equippedFrame,
        koin: user.coins,
      });
    }
  });

  socket.on("disconnect", () => {
    if (socketRateLimits.has(socket.id)) {
      socketRateLimits.delete(socket.id);
    }
    console.log(`❌ User DISCONNECTED: ${socket.id}`);
  });
});

// endpo log guru
app.post("/api/login-guru", (req, res) => {
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
    return res.json({ success: true, role: "guru" });
  } else {
    return res.status(401).json({ success: false, message: "Kode Salah" });
  }
});

// 6. srvr start
app.use(express.static(path.join(__dirname, "public")));

app.get(/.*/, (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/socket.io/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`🚀 Server Videa Class (Hybrid) Siap di Port ${PORT}`),
);
