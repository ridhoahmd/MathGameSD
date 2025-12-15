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

console.log("✅ Server: System Online (GLM-4 + Firebase)");

// ==========================================
// 2. STRATEGI PROMPT AI (MODULAR & ANTI-ERROR)
// ==========================================
const PROMPT_STRATEGIES = {
  // 1. MATH BATTLE
  math: (level, tema) => {
    let range, op, constraint;
    if (level === "mudah") {
      range = "1-20";
      op = "penjumlahan dan pengurangan";
      constraint = "hasil bilangan bulat positif 1-50";
    } else if (level === "sedang") {
      range = "10-100";
      op = "perkalian dan pembagian";
      constraint = "hasil bilangan bulat positif (tanpa koma)";
    } else {
      range = "50-500";
      op = "campuran (+, -, *, /)";
      constraint =
        "hasil bilangan bulat positif, utamakan perkalian/pembagian dulu";
    }
    return `Bertindak sebagai Guru Matematika SD. Buat 30 soal hitungan (bukan cerita).
    Level: ${level}. Range: ${range}. Operasi: ${op}. Tema: ${tema}.
    Constraint: ${constraint}. Jangan ada soal duplikat.
    Output JSON Array MURNI (Tanpa Markdown \`\`\`json): [{"soal":"10+10","jawaban":20}]`;
  },

  // 2. JEJAK NABI
  nabi: (level) => {
    let topik;
    if (level === "mudah") topik = "Nabi Ulul Azmi & Mukjizat";
    else if (level === "sedang") topik = "Kisah Kaum & Kitab Suci 25 Nabi";
    else topik = "Detail Sejarah, Keluarga Nabi & Ayat Terkait";

    return `Guru SKI. Buat 10 soal PG tentang: ${topik}. Level: ${level}. Sumber Sahih.
    Output JSON Array MURNI (Tanpa Markdown): 
    [{"tanya":"Siapa nabi pembelah laut?","opsi":["Musa","Isa","Nuh","Ibrahim"],"jawab":"Musa"}]
    ATURAN:
    1. Jawaban harus sama persis dengan salah satu string di opsi.
    2. JANGAN gunakan tanda kutip ganda (") di dalam isi teks soal kecuali di-escape (\\").`;
  },

  // 3. SAMBUNG AYAT (OPTIMIZED: 5 SOAL SAJA AGAR CEPAT)
  ayat: (level) => {
    let scope;
    if (level === "mudah") scope = "Surat Pendek (Ad-Dhuha s/d An-Nas)";
    else if (level === "sedang") scope = "Juz 30 Full (An-Naba s/d An-Nas)";
    else scope = "Ayat Tengah Juz 30 (Acak)";

    return `Bertindak sebagai ahli Tahfidz. Buat 6 soal sambung ayat. Lingkup: ${scope}.
    Output JSON Array MURNI: [{"tanya":"TEKS_ARAB","opsi":["A","B","C","D"],"jawab":"JAWABAN_BENAR"}].
    
    ATURAN FORMAT (PENTING):
    1. Pastikan Teks Arab LENGKAP dengan Harakat.
    2. JANGAN gunakan tanda kutip ganda (") di dalam isi teks Arab. Gunakan tanda kurung khas Arab ﴿...﴾ jika perlu.
    3. Jawaban harus sama persis dengan salah satu string di opsi.
    4. Pastikan encoding UTF-8 benar.`;
  },

  // 4. KASIR CILIK
  kasir: (level) => {
    let range, note;
    if (level === "mudah") {
      range = "500-5000";
      note = "Kelipatan 500";
    } else if (level === "sedang") {
      range = "10000-50000";
      note = "Ribuan acak";
    } else {
      range = "50000-200000";
      note = "Angka keriting (misal 53.750)";
    }

    return `Simulasi Kasir. 15 transaksi. Level ${level}. Range ${range}. Note: ${note}.
    Uang bayar >= Total. 
    Output JSON Array MURNI (Tanpa Markdown): 
    [{"cerita":"Beli A dan B...","total_belanja":5000,"uang_bayar":10000,"kembalian":5000}]`;
  },

  // 5. MEMORY LAB
  memory: (level, tema) => {
    const pairs = level === "mudah" ? 6 : level === "sedang" ? 10 : 15;
    return `Buat ${pairs} pasang kata-kunci untuk game memori. Tema: ${tema}.
    Output JSON Array MURNI (Tanpa Markdown): [{"a":"Kata","b":"Pasangannya"}]`;
  },

  // 6. LABIRIN ILMU
  labirin: (level) => {
    let size = level === "mudah" ? 10 : level === "sedang" ? 15 : 20;
    let count = level === "mudah" ? 3 : level === "sedang" ? 5 : 7;
    let topic =
      level === "mudah"
        ? "Hewan/Buah"
        : level === "sedang"
        ? "Tubuh/Tumbuhan"
        : "Geografi Asia";

    return `Game Master Labirin. Level ${level}. Grid ${size}x${size}. ${count} soal tentang ${topic}.
    Jawaban MAKSIMAL 1 KATA. 
    Output JSON Object MURNI (Tanpa Markdown):
    { "maze_size": ${size}, "soal_list": [{"tanya":"Ibukota RI?","jawab":"Jakarta"}] }`;
  },

  // 7. ZUMA SPACE
  zuma: (level, tema) => {
    let speed =
      level === "mudah" ? "lambat" : level === "sedang" ? "sedang" : "cepat";
    return `Konfigurasi Level Zuma. Tema ${tema}. Speed ${speed}.
    Output JSON Object MURNI (Tanpa Markdown): {"deskripsi":"Misi...","palet_warna":["#F00","#0F0","#00F"],"speed":"${speed}"}`;
  },

  // 8. PIANO SPEED
  piano: (level) => {
    const len = level === "mudah" ? 3 : level === "sedang" ? 6 : 9;
    return `Urutan nada piano acak ${len} digit (angka 1-7).
    Output JSON Object MURNI (Tanpa Markdown): {"sequence":[1,3,5,2,4]}`;
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
        // Randomize jika perlu (agar soal tidak selalu sama urutannya dari cache)
        if (["math", "kasir"].includes(kategori) && Array.isArray(finalData)) {
          // Pilih 1 soal acak dari array
          finalData = finalData[Math.floor(Math.random() * finalData.length)];
        } else if (
          ["nabi", "ayat", "memory"].includes(kategori) &&
          Array.isArray(finalData)
        ) {
          // Shuffle urutan
          finalData = fisherYatesShuffle([...finalData]).slice(0, 10);
        }

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
    const badWords = ["anjing", "babi", "bodoh", "kasar"]; // Tambahkan sesuai kebutuhan
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
      }),
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`🚀 Server Videa Class Siap di Port ${PORT}`)
);
