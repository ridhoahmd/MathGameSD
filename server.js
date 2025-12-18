require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);

// --- MULAI TAMBAHAN KEAMANAN (RATE LIMITER) ---
const rateLimit = require("express-rate-limit");

// ==========================================
// [BARU] KONFIGURASI AI (MANUAL SWITCH)
// ==========================================
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GANTI MANUAL DI SINI: 'gpt-5-nano' ATAU 'glm'
const CURRENT_AI_MODEL = "glm";

// Konfigurasi Limiter (Dilonggarkan untuk Development)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Durasi jendela waktu: 15 menit
  max: 100, // SAYA UBAH JADI 100 (Biar kamu puas testing tanpa kena blokir)
  message: {
    error: "Terlalu banyak permintaan AI. Santai dulu, coba lagi nanti.",
  },
  standardHeaders: true, // Mengirim info limit di header respons
  legacyHeaders: false, // Nonaktifkan header lama
});

// Terapkan limiter HANYA ke jalur AI
// (Pastikan endpoint ini sesuai dengan yang kamu pakai di fungsi AI nanti)
app.use("/api/ask-ai", aiLimiter);
app.use("/api/generate-quiz", aiLimiter);
// --- SELESAI TAMBAHAN KEAMANAN ---

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

  // 10. PILAH HUKUM (TAJWID SORTER - FIXED LEVELS)
  tajwid: (level) => {
    let pair;

    // Logika Tingkat Kesulitan
    if (level === "mudah") {
      // Paling Dasar: Huruf Syamsiah vs Qamariyah
      pair = { a: "Al-Qamariyah (Jelas)", b: "Al-Syamsiyah (Lebur)" };
    } else if (level === "sedang") {
      // Hukum Nun Mati: Jelas vs Samar
      pair = { a: "Izhar (Jelas)", b: "Ikhfa (Samar)" };
    } else {
      // Level SULIT: Hukum Mim Mati / Qalqalah
      // Kita acak agar lebih variatif untuk expert
      const hardPairs = [
        { a: "Qalqalah Sugra (Tengah)", b: "Qalqalah Kubra (Akhir)" },
        {
          a: "Idgham Bighunnah (Dengung)",
          b: "Idgham Bilaghunnah (Tanpa Dengung)",
        },
      ];
      pair = hardPairs[Math.floor(Math.random() * hardPairs.length)];
    }

    return `Bertindak sebagai Guru Tajwid SD. Saya butuh contoh kata pendek untuk hukum: "${pair.a}" dan "${pair.b}".
    
    Tugas:
    Berikan total 15 kata Arab pendek (maksimal 2 kata) yang mengandung hukum tersebut.
    
    FORMAT RESPONSE WAJIB (JSON OBJECT):
    {
      "kategori_kiri": "${pair.a}",
      "kategori_kanan": "${pair.b}",
      "data": [
        {"teks": "الْحَمْدُ", "hukum": "kiri"}, 
        {"teks": "الرَّحْمَنِ", "hukum": "kanan"}
      ]
    }
    
    ATURAN KRUSIAL:
    1. Teks Arab HARUS berharakat lengkap.
    2. Pastikan contohnya JELAS (tidak ambigu).
    3. HANYA JSON MENTAH.`;
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

// [BARU] FUNGSI UTAMA PENGENDALI AI
async function askAI(promptText) {
  console.log(`🧠 Mode AI Aktif: ${CURRENT_AI_MODEL.toUpperCase()}`);

  if (CURRENT_AI_MODEL === "gpt-5-nano") {
    // --- JALUR 1: OPENAI (GPT-5-NANO) ---
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5-nano", // Pastikan model ini tersedia di akunmu
        messages: [
          // System prompt agar output bersih (hemat token & processing)
          {
            role: "system",
            content:
              "Kamu adalah server game edukasi. Output HANYA JSON mentah tanpa markdown.",
          },
          { role: "user", content: promptText },
        ],
        temperature: 0.7,
      });
      return completion.choices[0].message.content;
    } catch (e) {
      console.error("❌ Error OpenAI:", e.message);
      throw new Error("Gagal mengambil data dari OpenAI");
    }
  } else {
    // --- JALUR 2: GLM (ZHIPU) ---
    // Langsung panggil fungsi lama kamu
    return await tanyaGLM(promptText);
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

  // --- A. PERMINTAAN SOAL (VERSI DEBUG & FIX) ---
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

          if (kategori === "labirin") {
            const mazeSize =
              level === "mudah" ? 10 : level === "sedang" ? 15 : 20;
            dataManual = { maze_size: mazeSize, soal_list: dataManual };
          }
          socket.emit("soalDariAI", { kategori, data: dataManual });
          return;
        }
      }

      // 2. Cek Cache Database (GANTI KE V7 BIAR FRESH)
      const cacheKey = `cache_soal_v7/${kategori}_${level}`;
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

        if (PROMPT_STRATEGIES[kategori]) {
          prompt = PROMPT_STRATEGIES[kategori](level, tema);
        }

        if (prompt) {
          const rawText = await askAI(prompt);
          let parsedData = extractJSON(rawText);

          // 🔥 FIX OTOMATIS: Jika data terbungkus object {data: [...]}, ambil isinya 🔥
          if (
            parsedData &&
            !Array.isArray(parsedData) &&
            typeof parsedData === "object"
          ) {
            const keys = Object.keys(parsedData);
            // Cek jika cuma ada 1 kunci (misal "soal" atau "data") yang isinya array
            if (keys.length === 1 && Array.isArray(parsedData[keys[0]])) {
              console.log(
                `📦 UNWRAP: Membuka bungkus JSON dari key '${keys[0]}'`
              );
              parsedData = parsedData[keys[0]];
            }
          }

          finalData = parsedData;

          if (finalData) {
            await set(ref(database, cacheKey), finalData);
          }
        }
      }

      // 4. Kirim Data ke Klien
      if (finalData) {
        // A. Logika Math & Kasir (Ambil 1 soal acak)
        if (["math", "kasir"].includes(kategori) && Array.isArray(finalData)) {
          finalData = finalData[Math.floor(Math.random() * finalData.length)];
        }
        // B. Logika Nabi, Ayat, Memory (Acak Soal & Opsi)
        else if (
          ["nabi", "ayat", "memory"].includes(kategori) &&
          Array.isArray(finalData)
        ) {
          let shuffledQuestions = fisherYatesShuffle([...finalData]).slice(
            0,
            10
          );
          finalData = shuffledQuestions.map((soal) => {
            let newSoal = { ...soal };
            if (newSoal.opsi && Array.isArray(newSoal.opsi)) {
              newSoal.opsi = fisherYatesShuffle(newSoal.opsi);
            }
            return newSoal;
          });
        }

        socket.emit("soalDariAI", { kategori, data: finalData });
      } else {
        throw new Error("Data hasil AI null/rusak/kosong");
      }
    } catch (e) {
      console.error(`❌ Error (${kategori}):`, e.message);
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

  // --- [BAGIAN BARU] C. LOGIKA LEADERBOARD ---
  socket.on("mintaLeaderboard", async () => {
    try {
      // 1. Ambil referensi ke root 'leaderboard'
      // Sesuai kode simpanSkor Anda, data ada di: "leaderboard/" + safeName
      const leaderboardRef = ref(database, "leaderboard");
      const snapshot = await get(leaderboardRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const leaderboard = [];

        // 2. Loop semua user untuk menghitung Total Skor
        Object.keys(data).forEach((key) => {
          const val = data[key];

          // 3. RUMUS PENJUMLAHAN TOTAL (Termasuk Tajwid)
          // Pastikan semua game dijumlahkan di sini
          const totalSkor =
            (val.skor_math || 0) +
            (val.skor_nabi || 0) +
            (val.skor_ayat || 0) +
            (val.skor_kasir || 0) +
            (val.skor_memory || 0) +
            (val.skor_labirin || 0) +
            (val.skor_zuma || 0) +
            (val.skor_piano || 0) +
            (val.skor_tajwid || 0); // 🔥 TAJWID DITAMBAHKAN DI SINI

          leaderboard.push({
            nama: val.nama || "User",
            skor: totalSkor,
            koin: val.videa_coin || 0,
            role: val.role || "siswa",
            // Opsional: Kirim rincian jika ingin ditampilkan di frontend
            rincian: {
              tajwid: val.skor_tajwid || 0,
            },
          });
        });

        // 4. Urutkan dari Skor Tertinggi ke Terendah
        leaderboard.sort((a, b) => b.skor - a.skor);

        // 5. Kirim Top 10 ke Client
        socket.emit("updateLeaderboard", leaderboard.slice(0, 10));
      } else {
        // Jika database kosong
        socket.emit("updateLeaderboard", []);
      }
    } catch (err) {
      console.error("❌ Error ambil leaderboard:", err.message);
      socket.emit("updateLeaderboard", []);
    }
  });

  // --- D. GLOBAL CHAT ---
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

  // --- E. FITUR AI TUTOR (UNIVERSAL - SUDAH DIPERBAIKI) ---
  socket.on("mintaPenjelasan", async (data) => {
    // 1. NORMALISASI VARIABLE (Penyelamat Game Lama & Baru)
    // Server akan mencari 'jawabanBenar', kalau tidak ada, cari 'jawabBenar', dst.
    const cleanSoal = data.soal || "";
    const cleanJawabBenar = data.jawabanBenar || data.jawabBenar;
    const cleanJawabUser = data.jawabanUser || data.jawabUser;
    const gameType = data.game || data.kategori || "Umum"; // Nabi/Ayat pakai 'kategori', Tajwid/Labirin pakai 'game'

    // 2. VALIDASI KUAT
    // Jika data penting tidak ada, stop agar tidak error
    if (!cleanSoal || !cleanJawabBenar) {
      console.error("❌ Data Tutor Tidak Lengkap:", data);
      return;
    }

    try {
      console.log(`👨‍🏫 Tutor dipanggil di game: ${gameType}`);

      let prompt = "";

      // 3. STRATEGI PROMPT SPESIFIK
      if (gameType === "tajwid") {
        prompt = `Seorang anak SD salah menebak hukum tajwid.
          Soal: "${cleanSoal}". Jawaban Anak: "${cleanJawabUser}". Jawaban Benar: "${cleanJawabBenar}". 
          Jelaskan max 2 kalimat kenapa salah dan apa ciri hukum yang benar. Gunakan bahasa ceria.`;
      } else if (gameType === "labirin") {
        prompt = `Siswa salah jawab kuis pengetahuan umum: "${cleanSoal}".
          Jawabannya: "${cleanJawabUser}". Yang benar: "${cleanJawabBenar}".
          Berikan "jembatan keledai" (cara hafal) atau fakta unik super singkat (max 15 kata) agar dia ingat.`;
      } else {
        // STRATEGI LAMA (Nabi & Ayat)
        if (
          typeof PROMPT_STRATEGIES !== "undefined" &&
          PROMPT_STRATEGIES.tutor
        ) {
          prompt = PROMPT_STRATEGIES.tutor(
            cleanSoal,
            cleanJawabUser,
            cleanJawabBenar,
            gameType
          );
        } else {
          prompt = `Siswa salah jawab soal "${cleanSoal}". Benarnya "${cleanJawabBenar}". Beri semangat singkat.`;
        }
      }

      // 4. REQUEST AI
      const penjelasanAI = await askAI(prompt);

      // 5. KIRIM DATA HYBRID (Agar semua Client mengerti)
      socket.emit("penjelasanTutor", {
        teks: penjelasanAI, // Dibaca oleh Nabi.js & Ayat.js
        penjelasan: penjelasanAI, // Dibaca oleh Tajwid.js & Labirin.js
      });
    } catch (e) {
      console.error("❌ Tutor Error:", e.message);
      const pesanError = `Jawaban yang benar adalah: ${cleanJawabBenar}. Tetap semangat ya!`;

      socket.emit("penjelasanTutor", {
        teks: pesanError,
        penjelasan: pesanError,
      });
    }
  });

  // 🔥 [BARU] F. LOGIKA MULTIPLAYER / ROOM (ZUMA & MATH) 🔥
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
