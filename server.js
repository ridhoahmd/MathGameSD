require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const path = require("path");
const rateLimit = require("express-rate-limit"); // Limiter untuk HTTP

// ==========================================
// 1. KONFIGURASI KEAMANAN & UTILITAS
// ==========================================

// A. Limiter untuk API HTTP (Browser URL)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Terlalu banyak request API HTTP." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/ask-ai", apiLimiter);

// B. Limiter Manual untuk SOCKET.IO (PENTING: Mencegah Spam Tombol Game)
const socketRateLimits = new Map();

function isSocketRateLimited(socketId) {
  const now = Date.now();
  const lastRequest = socketRateLimits.get(socketId) || 0;
  const LIMIT_DURATION = 5000; // Batas 1 request per 5 detik

  if (now - lastRequest < LIMIT_DURATION) {
    return true; // Kena limit (Spam detected)
  }

  socketRateLimits.set(socketId, now);
  return false; // Aman
}

// C. Utilitas Pembersih Data
function sanitizeKey(key) {
  return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

function extractJSON(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      let cleanText = jsonMatch[0]
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\n/g, " ");
      return JSON.parse(cleanText);
    }
    return null;
  } catch (e) {
    return null;
  }
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
// 2. KONFIGURASI AI (GLM-4 FOKUS)
// ==========================================
// const OpenAI = require("openai");
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// ^ SAYA MATIKAN SEMENTARA AGAR TIDAK CRASH JIKA API KEY OPENAI KOSONG

const CURRENT_AI_MODEL = "glm"; // Fokus ke GLM

async function askAI(promptText) {
  console.log(`🧠 AI Request (Model: ${CURRENT_AI_MODEL})`);

  // Logika GLM-4 (ZhipuAI)
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY Missing");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // Timeout 60 detik

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

// ==========================================
// 3. KONFIGURASI FIREBASE & SOCKET
// ==========================================
const { initializeApp } = require("firebase/app");
const {
  getDatabase,
  ref,
  set,
  get,
  runTransaction,
} = require("firebase/database");

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

const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ==========================================
// 4. STRATEGI PROMPT (LOGIKA SOAL)
// ==========================================
const PROMPT_STRATEGIES = {
  // 1. Tarung Matematika
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

  // 2. Jejak nabi
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

  // 3. Sambung ayat
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

  // 4. Kasir cilik
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

  // 5. Lab memori
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

  // 6. Labirin Ilmu
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

  // 7. Tembak angka (zuma)
  zuma: (level, tema) => {
    let speed =
      level === "mudah" ? "lambat" : level === "sedang" ? "sedang" : "cepat";
    return `Konfigurasi Level Zuma. Tema ${tema}. Speed ${speed}.
    Output JSON Object MURNI (Tanpa Markdown): {"deskripsi":"Misi Galaksi...","palet_warna":["#F00","#0F0","#00F"],"speed":"${speed}"}`;
  },

  // 8. Matematika piano
  piano: (level) => {
    const len = level === "mudah" ? 3 : level === "sedang" ? 6 : 9;
    return `Urutan nada piano acak ${len} digit (angka 1-7).
    Output JSON Object MURNI (Tanpa Markdown): {"sequence":[1,3,5,2,4]}`;
  },

  // 9. AI TUTOR (Logika Prompt Spesifik Anda)
  tutor: (soal, jawabUser, jawabBenar, kategori) => {
    // A. Prompt Khusus Tajwid
    if (kategori === "tajwid") {
      return `Seorang anak SD salah menebak hukum tajwid.
          Soal: "${soal}". Jawaban Anak: "${jawabUser}". Jawaban Benar: "${jawabBenar}". 
          Jelaskan max 2 kalimat kenapa salah dan apa ciri hukum yang benar. Gunakan bahasa ceria.
          PENTING: Gunakan tag HTML <b>...<b> (bukan markdown) untuk menebalkan nama hukum tajwid atau ciri utamanya agar mudah dibaca.
          Contoh: "Itu adalah <b>Idgham Bighunnah</b> karena ada Nun Sukun bertemu Ya."
          `;
    }

    // B. Prompt Khusus Labirin
    else if (kategori === "labirin") {
      return `Siswa salah jawab kuis pengetahuan umum: "${soal}".
          Jawabannya: "${jawabUser}". Yang benar: "${jawabBenar}".
          Berikan "jembatan keledai" (cara hafal) atau fakta unik super singkat (max 15 kata) agar dia ingat.
          PENTING: Gunakan tag HTML <b>...</b> pada kata kunci utama agar mata siswa langsung tertuju kesana.
          `;
    }

    // C. Prompt Umum (Nabi, Ayat, dll) - Force Bold Tag
    else {
      return `Kamu adalah Guru Muslim yang bijak dan seru. 
          Siswa sedang bermain game edukasi Islam (${kategori}) tapi salah menjawab.
          
          Data:
          - Soal: "${soal}"
          - Jawaban Siswa (Salah): "${jawabUser}"
          - Jawaban Benar: "${jawabBenar}"
          
          Instruksi:
          1. Berikan semangat singkat ("Jangan sedih...", "Ayo coba lagi...").
          2. Jelaskan kenapa jawaban benar itu tepat (Maksimal 2 kalimat).
          3. 🔥  WAJIB: Gunakan tag HTML <b>...</b> untuk menebalkan kata kunci jawaban benar.
          
          Contoh Output:
          "Jangan menyerah! Jawaban yang tepat adalah <b>Nabi Yunus</b>, karena beliau yang ditelan ikan paus."`;
    }
  },

  // 10. Pilah hukum
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

// ==========================================
// 5. LOGIKA UTAMA SERVER (SOCKET.IO)
// ==========================================

io.on("connection", (socket) => {
  console.log(`✅ User CONNECTED: ${socket.id}`);

  // --- A. PERMINTAAN SOAL (METODE HYBRID: GUDANG + AI) ---
  socket.on("mintaSoalAI", async (reqData) => {
    // 1. KEAMANAN: Cek Rate Limit (Anti Spam)
    if (isSocketRateLimited(socket.id)) {
      console.warn(`⚠️ SPAM BLOCKED: ${socket.id}`);
      socket.emit("soalDariAI", {
        kategori: reqData?.kategori,
        data: getFallbackData(reqData?.kategori),
        error: "Terlalu cepat! Tunggu 5 detik.",
      });
      return;
    }

    const { kategori, tingkat, kodeAkses } = reqData || {};
    const level = tingkat || "sedang";
    if (!kategori) return;

    try {
      // 2. CEK MODE UJIAN MANUAL (Prioritas Tertinggi - Soal dari Guru)
      if (kodeAkses) {
        const manualPath = `content_manual/${kategori}/${kodeAkses.toUpperCase()}/${level}`;
        const manualSnapshot = await get(ref(database, manualPath));
        if (manualSnapshot.exists()) {
          console.log(`🔑 Akses Ujian: ${kodeAkses}`);
          let dataManual = Object.values(manualSnapshot.val());
          // Khusus Labirin perlu format objek
          if (kategori === "labirin")
            dataManual = { maze_size: 15, soal_list: dataManual };
          socket.emit("soalDariAI", { kategori, data: dataManual });
          return;
        }
      }

      // ============================================================
      // 3. CEK GUDANG SOAL (DATABASE) - INI LOGIKA BARUNYA!
      // ============================================================
      let finalData = null;
      const gudangKey = `gudang_soal/${kategori}/${level}`;
      const gudangSnapshot = await get(ref(database, gudangKey));

      if (gudangSnapshot.exists()) {
        console.log(
          `🏭 GUDANG HIT: Mengambil ${kategori} (${level}) dari Database`
        );
        const allSoal = gudangSnapshot.val(); // Ambil semua data di level ini

        if (Array.isArray(allSoal)) {
          // KELOMPOK 1: Game Math & Kasir (Ambil 1 soal tunggal acak)
          // KELOMPOK 2: Game Config (Zuma, Piano, Labirin, Tajwid) (Ambil 1 config utuh)
          if (
            ["math", "kasir", "zuma", "piano", "labirin", "tajwid"].includes(
              kategori
            )
          ) {
            finalData = allSoal[Math.floor(Math.random() * allSoal.length)];
          }
          // KELOMPOK 3: Game Quiz (Nabi, Ayat, Memory) (Ambil 10 soal acak)
          else {
            let shuffled = fisherYatesShuffle([...allSoal]);
            finalData = shuffled.slice(0, 10);

            // Khusus Nabi/Ayat: Acak juga urutan opsi jawaban (A,B,C,D)
            if (finalData[0].opsi) {
              finalData = finalData.map((s) => ({
                ...s,
                opsi: fisherYatesShuffle(s.opsi),
              }));
            }
          }
        }
      }

      // ============================================================
      // 4. JIKA GUDANG KOSONG -> BARU MINTA AI (FALLBACK / KODE LAMA)
      // ============================================================
      if (!finalData) {
        // Cek Cache Lama (v7) dulu biar hemat
        const cacheKey = `cache_soal_v7/${kategori}_${level}`;
        const cacheSnapshot = await get(ref(database, cacheKey));

        if (cacheSnapshot.exists()) {
          console.log(`⚡ CACHE HIT (Lama): ${kategori}`);
          finalData = cacheSnapshot.val();
        } else {
          // Benar-benar kosong, panggil AI bekerja
          console.log(`🤖 AI WORKING: Membuat soal baru untuk ${kategori}...`);

          const tema = ["Antariksa", "Hutan", "Laut", "Robot"].sort(
            () => 0.5 - Math.random()
          )[0];
          let prompt = `Buat soal ${kategori} untuk SD level ${level}. JSON Valid.`;

          // Menggunakan strategi prompt Anda yang canggih
          if (PROMPT_STRATEGIES[kategori])
            prompt = PROMPT_STRATEGIES[kategori](level, tema);

          const rawText = await askAI(prompt);
          let parsedData = extractJSON(rawText);

          // Bersihkan data jika terbungkus {data: ...}
          if (parsedData && !Array.isArray(parsedData) && parsedData.data)
            parsedData = parsedData.data;

          finalData = parsedData;

          // Simpan hasil kerja AI ke Cache Lama (Bukan ke Gudang, agar Gudang tetap bersih/manual)
          if (finalData) await set(ref(database, cacheKey), finalData);
        }
      }

      // 5. KIRIM DATA KE PEMAIN
      if (finalData) {
        // Safety check terakhir: Jika data dari AI berupa array panjang, potong sesuai kebutuhan game
        if (Array.isArray(finalData) && !gudangSnapshot.exists()) {
          if (["math", "kasir"].includes(kategori)) {
            finalData = finalData[Math.floor(Math.random() * finalData.length)];
          } else if (
            !["zuma", "piano", "labirin", "tajwid"].includes(kategori)
          ) {
            finalData = fisherYatesShuffle([...finalData]).slice(0, 10);
          }
        }

        socket.emit("soalDariAI", { kategori, data: finalData });
      } else {
        throw new Error("Gagal mendapatkan data (Gudang & AI kosong)");
      }
    } catch (e) {
      console.error(`❌ Error (${kategori}):`, e.message);
      // Fallback Darurat agar game tidak stuck loading
      socket.emit("soalDariAI", {
        kategori,
        data: getFallbackData(kategori),
        isFallback: true,
      });
    }
  });

  // --- B. SIMPAN SKOR (ANTI-CHEAT) ---
  socket.on("simpanSkor", async (data) => {
    if (!data || !data.nama || !data.game) return;

    let skor = parseInt(data.skor);

    // [SECURITY] Validasi Skor Wajar
    if (isNaN(skor) || skor < 0) return;
    if (skor > 10000) {
      console.warn(`🚨 CHEAT DETECTED: ${data.nama} skor ${skor}`);
      return; // Jangan simpan
    }

    const safeName = sanitizeKey(data.nama.substring(0, 30));
    const now = new Date();
    const koin = Math.floor(skor / 10);
    const userRef = ref(database, "leaderboard/" + safeName);

    try {
      await runTransaction(userRef, (userData) => {
        if (!userData) {
          return {
            nama: safeName,
            [`skor_${data.game}`]: skor,
            videa_coin: koin,
            last_played: now.toISOString(),
            role: "siswa",
          };
        }
        userData[`skor_${data.game}`] =
          (userData[`skor_${data.game}`] || 0) + skor;
        userData.videa_coin = (userData.videa_coin || 0) + koin;
        userData.last_played = now.toISOString();
        return userData;
      });
    } catch (e) {
      console.error("DB Error:", e.message);
    }
  });

  // --- C. LEADERBOARD ---
  socket.on("mintaLeaderboard", async () => {
    try {
      const snapshot = await get(ref(database, "leaderboard"));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const leaderboard = Object.keys(data).map((key) => {
          const val = data[key];
          const total =
            (val.skor_math || 0) +
            (val.skor_nabi || 0) +
            (val.skor_ayat || 0) +
            (val.skor_kasir || 0) +
            (val.skor_memory || 0) +
            (val.skor_labirin || 0) +
            (val.skor_zuma || 0) +
            (val.skor_piano || 0) +
            (val.skor_tajwid || 0);
          return {
            nama: val.nama,
            skor: total,
            koin: val.videa_coin || 0,
            role: val.role || "siswa",
          };
        });
        leaderboard.sort((a, b) => b.skor - a.skor);
        socket.emit("updateLeaderboard", leaderboard.slice(0, 10));
      } else {
        socket.emit("updateLeaderboard", []);
      }
    } catch (err) {
      socket.emit("updateLeaderboard", []);
    }
  });

  // --- D. CHAT GLOBAL ---
  socket.on("chatMessage", (msg) => {
    if (!msg.pesan || !msg.pesan.trim()) return;
    const cleanPesan = msg.pesan
      .substring(0, 100)
      .replace(/(anjing|babi|bodoh|kasar)/gi, "***");
    io.emit("chatMessage", {
      nama: sanitizeKey(msg.nama).substring(0, 15),
      pesan: cleanPesan,
      waktu: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });

  // --- E. AI TUTOR (VERSI FINAL - BERSIH & PINTAR) ---
  socket.on("mintaPenjelasan", async (data) => {
    // 1. Normalisasi Data
    const cleanSoal = data.soal || "";
    const cleanJawabBenar = data.jawabanBenar || data.jawabBenar;
    const cleanJawabUser = data.jawabanUser || data.jawabUser;
    const gameType = data.game || data.kategori || "Umum";

    // 2. Validasi
    if (!cleanSoal || !cleanJawabBenar) return;

    try {
      console.log(`👨‍🏫 Tutor dipanggil: ${gameType}`);

      // 3. Panggil Strategi Pintar (Dari kode di atas)
      // Ini akan otomatis memilih prompt Tajwid/Labirin/Umum sesuai keinginan Anda
      let prompt;
      if (PROMPT_STRATEGIES.tutor) {
        prompt = PROMPT_STRATEGIES.tutor(
          cleanSoal,
          cleanJawabUser,
          cleanJawabBenar,
          gameType
        );
      } else {
        // Fallback darurat
        prompt = `Jelaskan kenapa jawaban ${cleanJawabBenar} benar untuk soal ${cleanSoal}.`;
      }

      // 4. Request AI
      const penjelasanAI = await askAI(prompt);

      // 5. Kirim Balikan
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

  // --- F. LOGIKA ROOM & DUEL (FIXED BUG) ---
  socket.on("joinRoom", (data) => {
    if (!data.room) return;
    socket.join(data.room);
    socket.to(data.room).emit("playerJoined", data.username);
  });

  socket.on("laporSkor", (data) => {
    // Untuk Zuma
    if (data.room) socket.to(data.room).emit("updateSkorLawan", data.skor);
  });

  // [BUG FIX] Math Duel: Cek penuh DULU baru join
  socket.on("joinMathDuel", async (data) => {
    const room = data.room;
    const roomInstance = io.sockets.adapter.rooms.get(room);
    const playerCount = roomInstance ? roomInstance.size : 0;

    if (playerCount >= 2) {
      socket.emit("waitingForOpponent", "Room Penuh (Max 2).");
      return;
    }

    socket.join(room); // Aman untuk join sekarang

    if (playerCount === 0) {
      socket.emit("waitingForOpponent", "Menunggu pemain kedua...");
    } else {
      // Pemain kedua masuk -> START GAME
      let soalDuel = getFallbackData("math");
      // (Opsional: Tambahkan logika ambil cache soal disini jika perlu)
      io.in(room).emit("startDuel", { soal: soalDuel });
    }
  });

  socket.on("updateScoreDuel", (data) => {
    socket.to(data.room).emit("opponentScoreUpdate", data.score);
  });
});

// ==========================================
// 6. SERVER START
// ==========================================
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`🚀 Server Videa Class Siap di Port ${PORT}`)
);
