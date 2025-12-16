require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*", // Tips: Ganti '*' dengan domain production nanti untuk keamanan ekstra
    methods: ["GET", "POST"],
  },
});
const path = require("path");
const { initializeApp } = require("firebase/app");
const {
  getDatabase,
  ref,
  set,
  get,
  runTransaction,
} = require("firebase/database");

// ==========================================
// 1. KONFIGURASI DATABASE
// ==========================================
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "mathgamesd.firebaseapp.com",
  databaseURL:
    "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mathgamesd",
  storageBucket: "mathgamesd.firebasestorage.app",
  messagingSenderId: "595640141584",
  appId: "1:595640141584:web:d02523bc844e52550f4795",
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

console.log("✅ Server: System Online (GLM-4 + Firebase + Multiplayer Ready)");

// ==========================================
// 2. STRATEGI PROMPT AI (MODULAR & ANTI-ERROR)
// ==========================================
const PROMPT_STRATEGIES = {
  // 1. MATH BATTLE (Optimized: Constraint Tipe Data & Pembagian)
  math: (level, tema) => {
    let range, op, constraint;
    if (level === "mudah") {
      range = "1-20";
      op = "penjumlahan dan pengurangan";
      constraint = "hasil bilangan bulat positif 1-50";
    } else if (level === "sedang") {
      range = "10-100";
      op = "perkalian dan pembagian";
      constraint =
        "hasil bilangan bulat positif. UNTUK PEMBAGIAN: Pastikan habis dibagi (sisa 0).";
    } else {
      range = "50-500";
      op = "campuran (+, -, *, /)";
      constraint =
        "hasil bilangan bulat positif. UNTUK PEMBAGIAN: Pastikan habis dibagi (sisa 0).";
    }
    return `Bertindak sebagai Guru Matematika SD. Buat 30 soal hitungan (bukan cerita).
    Level: ${level}. Range: ${range}. Operasi: ${op}. Tema: ${tema}.
    Constraint: ${constraint}. Jangan ada soal duplikat.
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"soal":"10 + 10","jawaban":20}]
    
    ATURAN JSON:
    1. Field 'jawaban' HARUS tipe NUMBER (jangan pakai kutip).
    2. Keluarkan HANYA JSON mentah. Jangan pakai markdown \`\`\`.`;
  },

  // 2. JEJAK NABI (Optimized: Content Integrity & Format Safety)
  nabi: (level) => {
    let topik;
    if (level === "mudah") {
      topik = "Nabi Ulul Azmi, Mukjizat Terkenal, & Nama Nabi (25 Nabi)";
    } else if (level === "sedang") {
      topik = "Kisah Kaum (Ad, Tsamud, dll), Kitab Suci, & Peristiwa Penting";
    } else {
      topik =
        "Detail Silsilah Keluarga, Tempat Diutus, & Gelar Khusus (misal: Khalilullah)";
    }

    return `Bertindak sebagai Guru Sejarah Kebudayaan Islam (SKI). Buat 10 soal Pilihan Ganda tentang: ${topik}.
    Level: ${level}. Gunakan Bahasa Indonesia yang baku dan sumber yang sahih (Al-Qur'an/Hadits).
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [
      {
        "tanya": "Siapa nabi yang membelah lautan?",
        "opsi": ["Nabi Musa", "Nabi Isa", "Nabi Nuh", "Nabi Ibrahim"],
        "jawab": "Nabi Musa"
      }
    ]
    
    ATURAN KRUSIAL:
    1. Field 'jawab' HARUS SAMA PERSIS (copy-paste string) dengan salah satu string di dalam array 'opsi'. 
    2. JANGAN isi 'jawab' dengan huruf A/B/C/D. Isi dengan teks jawaban penuh.
    3. Pastikan tidak ada jawaban ganda/duplikat di dalam opsi.
    4. HANYA JSON mentah.`;
  },

  // 3. SAMBUNG AYAT ( Transliterasi Indonesia )
  ayat: (level) => {
    let scope, outputInstruction;
    // Tetap gunakan 3 soal untuk level mudah agar cepat & tidak timeout
    let count = level === "mudah" ? 3 : 5;

    if (level === "mudah") {
      scope = "Surat Pendek (Ad-Dhuha s/d An-Nas)";

      // 🔥 PERBAIKAN UTAMA DI SINI 🔥
      outputInstruction = `
      FORMAT RESPONSE WAJIB (JSON ARRAY):
      [{
        "tanya": "(Potongan Ayat Arab)",
        "latin": "(Tuliskan CARA BACA / TRANSLITERASI dalam ejaan Indonesia. Contoh: 'Qul a'udzu birabbin nas'. JANGAN BERIKAN ARTINYA!)",
        "opsi": ["(Lanjutan A)", "(Lanjutan B)", "(Lanjutan C)", "(Lanjutan D)"],
        "jawab": "(Lanjutan Benar)"
      }]`;
    } else {
      scope =
        level === "sedang"
          ? "Juz 30 Full (An-Naba s/d An-Nas)"
          : "Ayat Tengah Juz 30 (Acak)";
      outputInstruction = `
      FORMAT RESPONSE WAJIB (JSON ARRAY):
      [{
        "tanya": "(Potongan Ayat Arab)",
        "opsi": ["(Lanjutan A)", "(Lanjutan B)", "(Lanjutan C)", "(Lanjutan D)"],
        "jawab": "(Lanjutan Benar)"
      }]`;
    }

    return `Bertindak sebagai ahli Tahfidz. Buat ${count} soal sambung ayat. Lingkup: ${scope}.
    
    ${outputInstruction}
    
    ATURAN KRUSIAL:
    1. Teks Arab HARUS berharakat lengkap.
    2. JANGAN gunakan tanda kutip ganda (") di dalam teks Arab/Latin.
    3. Field 'latin' HARUS berupa cara baca (bunyi), BUKAN terjemahan bahasa Inggris/Indonesia.
    4. Field 'jawab' HARUS SAMA PERSIS (karakter per karakter) dengan salah satu string di 'opsi'.
    5. HANYA JSON mentah.`;
  },

  // 4. KASIR CILIK (Optimized: Logika Uang Masuk Akal)
  kasir: (level) => {
    let range, note;
    if (level === "mudah") {
      range = "500-5000";
      note = "Kelipatan 500 (Uang Pas/Lebih dikit)";
    } else if (level === "sedang") {
      range = "10000-50000";
      note = "Ribuan acak. Uang bayar pecahan lazim (10rb, 20rb, 50rb).";
    } else {
      range = "50000-200000";
      note = "Angka keriting. Uang bayar pecahan lazim (50rb, 100rb).";
    }

    return `Simulasi Kasir. 15 transaksi. Level ${level}. Range Harga ${range}.
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"cerita":"Ibu membeli gula...","total_belanja":5000,"uang_bayar":10000,"kembalian":5000}]
    
    ATURAN:
    1. Pastikan 'uang_bayar' >= 'total_belanja'.
    2. Hitungan 'kembalian' HARUS MATEMATIS BENAR.
    3. Semua angka dalam format NUMBER (tanpa kutip).
    4. HANYA JSON mentah.`;
  },

  // 5. MEMORY LAB (Optimized: Kejelasan Pasangan)
  memory: (level, tema) => {
    const pairs = level === "mudah" ? 6 : level === "sedang" ? 8 : 10; // Sedikit dikurangi agar tidak terlalu penuh di HP

    const context =
      tema === "bahasa"
        ? "Kata (A) dan Antonim/Sinonimnya (B)"
        : tema === "geografi"
        ? "Negara (A) dan Ibukotanya (B)"
        : "Objek (A) dan Pasangannya (B)";

    return `Buat ${pairs} pasang kartu unik untuk game memori. Tema: ${tema}. Konteks: ${context}.
    Kata-kata harus singkat (maksimal 2 kata).
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"a":"Hitam","b":"Putih"}, {"a":"Panas","b":"Dingin"}]
    
    ATURAN: HANYA JSON mentah.`;
  },

  // 6. LABIRIN ILMU (Optimized: Single Word Answer)
  labirin: (level) => {
    let size = level === "mudah" ? 10 : level === "sedang" ? 15 : 20;
    let count = level === "mudah" ? 3 : level === "sedang" ? 5 : 7;
    let topic =
      level === "mudah"
        ? "Hewan/Buah"
        : level === "sedang"
        ? "Pengetahuan Umum SD"
        : "Geografi/Sains";

    return `Game Master Labirin. Grid ${size}x${size}. ${count} soal singkat tentang ${topic}.
    
    FORMAT RESPONSE WAJIB (JSON OBJECT):
    { "maze_size": ${size}, "soal_list": [{"tanya":"Ibukota Indonesia?","jawab":"Jakarta"}] }
    
    ATURAN:
    1. Jawaban 'jawab' HARUS 1 KATA SAJA (karena user mengetik manual).
    2. Jawaban tidak boleh case-sensitive (gunakan huruf umum).
    3. HANYA JSON mentah.`;
  },

  // 7. ZUMA SPACE (No Change - Sudah OK)
  zuma: (level, tema) => {
    let speed =
      level === "mudah" ? "lambat" : level === "sedang" ? "sedang" : "cepat";
    return `Konfigurasi Level Zuma. Tema ${tema}. Speed ${speed}.
    Output JSON Object MURNI (Tanpa Markdown): {"deskripsi":"Misi Galaksi...","palet_warna":["#F00","#0F0","#00F"],"speed":"${speed}"}`;
  },

  // 8. PIANO SPEED (No Change - Sudah OK)
  piano: (level) => {
    const len = level === "mudah" ? 3 : level === "sedang" ? 6 : 9;
    return `Urutan nada piano acak ${len} digit (angka 1-7).
    Output JSON Object MURNI (Tanpa Markdown): {"sequence":[1,3,5,2,4]}`;
  },

  // 9. AI TUTOR (Optimized: Persona Guru)
  tutor: (soal, jawabUser, jawabBenar, kategori) => {
    return `Kamu adalah Guru yang ramah, lucu, dan suportif untuk anak SD.
    Siswa baru saja SALAH menjawab soal ${kategori}.
    
    Data:
    - Soal: "${soal}"
    - Jawaban Siswa: "${jawabUser}"
    - Jawaban Benar: "${jawabBenar}"
    
    Tugas:
    1. Koreksi kesalahan siswa dengan lembut.
    2. Berikan 1 fakta menarik atau "jembatan keledai" (cara hafal) agar siswa ingat jawaban yang benar.
    3. Maksimal 2-3 kalimat pendek.
    4. Output LANGSUNG teks (Plain Text), jangan JSON.`;
  },
};

// ==========================================
// 3. HELPER FUNCTIONS (UTILITIES)
// ==========================================

// Data Darurat jika AI Offline
function getFallbackData(kategori) {
  const fallbacks = {
    math: { soal: "10 + 10 = ?", jawaban: 20 },
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
  };
  return fallbacks[kategori] || { error: "Data tidak tersedia" };
}

// Pembersih JSON (Regex Kuat)
function extractJSON(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      let cleanText = jsonMatch[0]
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/\/\/.*$/gm, "") // Hapus komentar JS
        .replace(/\n/g, " "); // Hapus newline
      return JSON.parse(cleanText);
    }
    return null;
  } catch (e) {
    console.error("JSON Parse Error:", e.message);
    return null;
  }
}

// Fetch AI dengan Timeout & AbortController
async function tanyaGLM(promptText) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY Missing");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // Max 60 detik

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
          messages: [{ role: "user", content: promptText }],
          temperature: 0.7,
        }),
        signal: controller.signal,
      }
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

function sanitizeKey(key) {
  return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

function fisherYatesShuffle(array) {
  if (!Array.isArray(array)) return array;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ==========================================
// 4. MIDDLEWARE & STATIC
// ==========================================
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 5. SOCKET.IO LOGIC UTAMA
// ==========================================
io.on("connection", (socket) => {
  console.log(`✅ User CONNECTED: ${socket.id}`);

  // --- A. PERMINTAAN SOAL ---
  socket.on("mintaSoalAI", async (reqData) => {
    const { kategori, tingkat, kodeAkses } = reqData || {};
    const level = tingkat || "sedang";

    if (!kategori) return;

    try {
      // 1. Cek Mode Manual (Ujian Khusus)
      if (kodeAkses) {
        const manualPath = `content_manual/${kategori}/${kodeAkses.toUpperCase()}/${level}`;
        const manualSnapshot = await get(ref(database, manualPath));
        if (manualSnapshot.exists()) {
          console.log(`🔑 Akses Ujian: ${kodeAkses}`);
          let dataManual = Object.values(manualSnapshot.val());

          // Format ulang khusus Labirin agar sesuai struktur game
          if (kategori === "labirin") {
            const mazeSize =
              level === "mudah" ? 10 : level === "sedang" ? 15 : 20;
            dataManual = { maze_size: mazeSize, soal_list: dataManual };
          }

          socket.emit("soalDariAI", { kategori, data: dataManual });
          return; // Selesai, jangan lanjut ke AI
        }
      }

      // 2. Cek Cache Database
      const cacheKey = `cache_soal_v6/${kategori}_${level}`;
      const cacheSnapshot = await get(ref(database, cacheKey));
      let finalData = null;

      if (cacheSnapshot.exists()) {
        console.log(`⚡ Cache Hit: ${kategori} (${level})`);
        finalData = cacheSnapshot.val();
      } else {
        // 3. Generate AI Baru
        console.log(`🤖 AI Generating: ${kategori} (${level})...`);

        let prompt = null;
        const tema = ["Antariksa", "Hutan", "Laut", "Robot", "Dino"].sort(
          () => 0.5 - Math.random()
        )[0];

        // Ambil prompt dari strategi yang sudah didefinisikan di atas
        if (PROMPT_STRATEGIES[kategori]) {
          prompt = PROMPT_STRATEGIES[kategori](level, tema);
        }

        if (prompt) {
          const rawText = await tanyaGLM(prompt);
          finalData = extractJSON(rawText);
          if (finalData) {
            // Simpan ke cache untuk user berikutnya
            await set(ref(database, cacheKey), finalData);
          }
        }
      }

      // 4. Kirim Data ke Klien
      if (finalData) {
        // A. Logika untuk Math & Kasir (Ambil 1 soal acak saja)
        if (["math", "kasir"].includes(kategori) && Array.isArray(finalData)) {
          finalData = finalData[Math.floor(Math.random() * finalData.length)];
        }

        // B. Logika untuk Nabi, Ayat, Memory (Ambil banyak soal & ACAK OPSI)
        else if (
          ["nabi", "ayat", "memory"].includes(kategori) &&
          Array.isArray(finalData)
        ) {
          // 1. Acak dulu urutan nomor soalnya (misal: soal no 5 jadi no 1)
          let shuffledQuestions = fisherYatesShuffle([...finalData]).slice(
            0,
            10
          );

          // 2.  ACAK POSISI OPSI JAWABAN (A, B, C, D)
          finalData = shuffledQuestions.map((soal) => {
            // Kita buat salinan objek soal biar aman
            let newSoal = { ...soal };

            // Cek apakah soal ini punya 'opsi' dan apakah itu sebuah Array?
            if (newSoal.opsi && Array.isArray(newSoal.opsi)) {
              // Kalau iya, acak posisi opsinya!
              newSoal.opsi = fisherYatesShuffle(newSoal.opsi);
            }
            return newSoal;
          });
        }

        // Kirim data yang sudah diacak ke frontend
        socket.emit("soalDariAI", { kategori, data: finalData });
      } else {
        throw new Error("Data hasil AI null/rusak");
      }
    } catch (e) {
      console.error(`❌ Error (${kategori}):`, e.message);
      // Kirim Fallback Data agar game tidak macet
      socket.emit("soalDariAI", {
        kategori,
        data: getFallbackData(kategori),
        isFallback: true,
      });
    }
  });

  // --- B. PENYIMPANAN SKOR (DENGAN VALIDASI) ---
  socket.on("simpanSkor", async (data) => {
    // 1. Validasi Input
    if (!data || !data.nama || !data.game) return;

    let skor = parseInt(data.skor);

    // Cek Cheat Dasar
    if (isNaN(skor) || skor < 0) return;
    if (skor > 10000) {
      console.warn(`🚨 CHEAT DETECTED: User ${data.nama} skor ${skor}`);
      skor = 0; // Batalkan skor
    }

    const safeName = sanitizeKey(data.nama.substring(0, 30));
    const now = new Date();
    const koin = Math.floor(skor / 10);
    const userRef = ref(database, "leaderboard/" + safeName);

    try {
      await runTransaction(userRef, (userData) => {
        if (!userData) {
          return {
            nama: safeName, // Gunakan nama yang sudah disanitasi
            [`skor_${data.game}`]: skor,
            videa_coin: koin,
            last_played: now.toISOString(),
            role: "siswa",
          };
        }
        // Akumulasi Skor
        userData[`skor_${data.game}`] =
          (userData[`skor_${data.game}`] || 0) + skor;
        // Akumulasi Koin
        userData.videa_coin = (userData.videa_coin || 0) + koin;
        userData.last_played = now.toISOString();
        return userData;
      });

      console.log(`💾 Skor Tersimpan: ${safeName} | ${data.game} (+${skor})`);
    } catch (e) {
      console.error("DB Error:", e.message);
    }
  });

  // --- C. GLOBAL CHAT ---
  socket.on("chatMessage", (msg) => {
    if (!msg.pesan || !msg.pesan.trim()) return;

    // Filter Kata Kasar Sederhana
    const badWords = ["anjing", "babi", "bodoh", "kasar"]; // tambahin sesuai kebutuhan bocil
    let cleanPesan = msg.pesan.substring(0, 100);
    badWords.forEach((word) => {
      const regex = new RegExp(word, "gi");
      cleanPesan = cleanPesan.replace(regex, "***");
    });

    io.emit("chatMessage", {
      nama: sanitizeKey(msg.nama).substring(0, 15),
      pesan: cleanPesan,
      waktu: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }),
    });
  });

  // --- D. FITUR AI TUTOR (Penjelasan Jawaban Salah) ---
  socket.on("mintaPenjelasan", async (data) => {
    // Validasi data sederhana
    if (!data.soal || !data.jawabBenar) return;

    try {
      console.log(`👨‍🏫 Tutor dipanggil oleh ${data.nama || "User"}...`);

      // 1. Ambil Prompt Tutor dari Strategi
      // Kita gunakan kategori 'Umum' jika tidak spesifik
      const prompt = PROMPT_STRATEGIES.tutor(
        data.soal,
        data.jawabUser,
        data.jawabBenar,
        data.kategori || "Pelajaran Umum"
      );

      // 2. Minta jawaban ke AI
      const penjelasan = await tanyaGLM(prompt);

      // 3. Kirim balik ke siswa
      socket.emit("penjelasanTutor", { teks: penjelasan });
    } catch (e) {
      console.error("❌ Tutor Error:", e.message);
      // Fallback jika AI sibuk/gagal
      socket.emit("penjelasanTutor", {
        teks: `Jawaban yang tepat adalah ${data.jawabBenar}. Jangan menyerah, coba lagi ya!`,
      });
    }
  });

  // 🔥 [BARU] E. LOGIKA MULTIPLAYER / ROOM (ZUMA & MATH) 🔥
  // -----------------------------------------------------------------

  // 1. Join Room (Umum & Zuma)
  socket.on("joinRoom", (data) => {
    if (!data.room) return;
    socket.join(data.room);
    console.log(`👥 ${data.username} masuk room: ${data.room}`);

    // Beritahu orang lain di room
    socket.to(data.room).emit("playerJoined", data.username);
  });

  // 2. Lapor Skor Real-time (Untuk update UI lawan di Zuma)
  socket.on("laporSkor", (data) => {
    // Data = { skor: 100, room: "kodeRoom" }
    if (data.room) {
      socket.to(data.room).emit("updateSkorLawan", data.skor);
    }
  });

  // 3. Join Math Duel (Khusus Math Battle)
  socket.on("joinMathDuel", async (data) => {
    // Data = { room, nama, tingkat }
    const room = data.room;
    socket.join(room);

    // Hitung jumlah pemain di room
    const players = await io.in(room).allSockets(); // Set of socket IDs
    const playerCount = players.size;

    if (playerCount === 1) {
      socket.emit("waitingForOpponent", "Menunggu pemain kedua...");
    } else if (playerCount === 2) {
      // Jika sudah 2 orang, mulai game!
      // Minta soal ke AI dulu (sekali saja utk berdua)
      const level = data.tingkat || "mudah";
      // Pakai cache key yang sama agar cepat
      const cacheKey = `cache_soal_v6/math_${level}`;

      // (Kita pakai logika cache simple disini, ambil existing logic)
      // Agar cepat, kita trigger event mintaSoalAI manual atau ambil cache
      let soalDuel = getFallbackData("math"); // Default kalau AI gagal

      try {
        // Coba ambil dari cache DB
        const cacheSnapshot = await get(ref(database, cacheKey));
        if (cacheSnapshot.exists()) {
          const rawData = cacheSnapshot.val();
          if (Array.isArray(rawData)) {
            // Ambil 10 soal acak untuk duel
            soalDuel = fisherYatesShuffle([...rawData])
              .slice(0, 10)
              .map((s) => ({ q: s.soal, a: s.jawaban }));
          }
        }
      } catch (e) {
        console.log("Duel Cache Error, use fallback");
      }

      // Kirim sinyal MULAI ke semua di room
      io.in(room).emit("startDuel", { soal: soalDuel });
    } else {
      socket.emit("waitingForOpponent", "Room Penuh (Max 2).");
    }
  });

  // 4. Update Skor Duel (Math Battle)
  socket.on("updateScoreDuel", (data) => {
    // Data = { room, score }
    socket.to(data.room).emit("opponentScoreUpdate", data.score);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`🚀 Server Videa Class Siap di Port ${PORT}`)
);
