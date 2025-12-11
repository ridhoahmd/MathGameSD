require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// --- 1. SETUP FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get, update, runTransaction } = require("firebase/database");

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "mathgamesd.firebaseapp.com",
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// --- 2. SETUP AI ENGINE (GLM-4 / ZHIPU AI) ---
// Bagian Gemini dihapus, diganti dengan fungsi fetch ke Zhipu AI
console.log("✅ AI System: Menggunakan GLM-4-Flash (Zhipu AI)");

async function tanyaGLM(promptText) {
    const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    // Pastikan Anda sudah menambahkan ZHIPU_API_KEY di file .env
    const apiKey = process.env.ZHIPU_API_KEY; 

    if (!apiKey) throw new Error("ZHIPU_API_KEY belum dipasang di .env");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "glm-4-flash", // Model Gratis & Cepat
            messages: [
                { role: "user", content: promptText }
            ],
            temperature: 0.7 
        })
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(`GLM Error: ${data.error.message}`);
    }

    return data.choices[0].message.content;
}

// --- 3. SERVE STATIC FILES ---
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- 4. HELPER FUNCTIONS ---
function extractJSON(text) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            let cleanText = jsonMatch[0];
            // Bersihkan markdown code block jika ada
            cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "");
            cleanText = cleanText.replace(/\/\/.*$/gm, ""); 
            cleanText = cleanText.replace(/\/\*[\s\S]*?\*\//g, "");
            cleanText = cleanText.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(cleanText);
        }
        return null;
    } catch (e) {
        console.error("JSON Parse Error:", e.message);
        return null;
    }
}

function sanitizeKey(key) {
    if (!key) return "unknown";
    return key.replace(/[.#$/\[\]]/g, "_");
}

function getRandomTheme() {
    const themes = ["Luar Angkasa", "Hutan Ajaib", "Bawah Laut", "Dunia Robot", "Kerajaan Permen", "Dinosaurus", "Super Hero", "Pabrik Coklat"];
    return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomObject() {
    const objects = ["Toko Mainan", "Warung Buah", "Kantin Sekolah", "Supermarket", "Toko Buku"];
    return objects[Math.floor(Math.random() * objects.length)];
}

// --- Fungsi Pengacakan Sempurna (Fisher-Yates) ---
function fisherYatesShuffle(array) {
    if (!Array.isArray(array)) return array;
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// --- 5. SOCKET.IO CONNECTION ---
io.on('connection', (socket) => {
    console.log(`✅ User CONNECTED: ${socket.id}`);

    // ==========================================
    // BAGIAN A: MINTA SOAL
    // ==========================================
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat, kodeAkses } = requestData;
        const level = tingkat || 'sedang';

        const cacheKey = `cache_soal_v5/${kategori}_${level}`;
        const manualPath = kodeAkses ? `content_manual/${kategori}/${kodeAkses.toUpperCase()}/${level}` : null;

        let soalData = null;

        try {
            // --- CEK 1: KODE AKSES ---
            if (kodeAkses && manualPath) {
                const manualSnapshot = await get(ref(database, manualPath));
                if (manualSnapshot.exists()) {
                    console.log(`✅ Soal Ujian Khusus: ${kodeAkses}`);
                    const dataManual = manualSnapshot.val();
                    
                    if (kategori === 'labirin') {
                        soalData = { maze_size: (level==='mudah'?10:15), soal_list: Object.values(dataManual) };
                    } else if (kategori === 'nabi' || kategori === 'ayat') {
                        soalData = Object.values(dataManual);
                    } else {
                        const keys = Object.keys(dataManual);
                        soalData = dataManual[keys[Math.floor(Math.random() * keys.length)]];
                    }
                    socket.emit('soalDariAI', { kategori, data: soalData });
                    return;
                }
            }

            // --- CEK 2: MODE UMUM (CACHE + AI) ---
            const cacheSnapshot = await get(ref(database, cacheKey));
            let dataGudang = null;

            if (cacheSnapshot.exists()) {
                dataGudang = cacheSnapshot.val();
                console.log(`⚡ CACHE: Mengambil dari gudang soal...`);
            } else {
                console.log(`🤖 AI: Stok habis, memanggil GLM-4...`);
                
                let prompt = "";
                const tema = getRandomTheme();
                
                // --- LOGIKA PROMPT YANG BERVARIASI ---
                if (kategori === 'math') {
                    let r = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                    let op = level === 'mudah' ? 'tambah/kurang' : 'campuran';
                    prompt = `Buat 30 soal matematika SD unik. Level: ${level}. Range: ${r}. Operasi: ${op}. Tema: ${tema}. Output JSON Array: [{"soal":"1+1","jawaban":2}]. NO COMMENTS.`;
                
                } else if (kategori === 'nabi') {
                    // --- PROMPT DIPERBAIKI ---
                    prompt = `
                    Bertindak sebagai Guru Sejarah Kebudayaan Islam (SKI) yang ahli.
                    Buat 10 soal pilihan ganda tentang Kisah 25 Nabi & Rasul dalam Islam.
                    Level: ${level}.

                    ATURAN KETAT:
                    1. Semua konten soal dan jawaban HARUS 100% bersumber dari Al-Quran dan Hadits yang shahih. Jangan menggunakan cerita rakyat (Israiliyat) atau sumber non-Islam.
                    2. Fokus pada pelajaran dan moral yang dapat diambil dari kisah tersebut.
                    3. Output HANYA dalam format JSON Array.

                    CONTOH:
                    [
                      {
                        "tanya": "Siapakah nabi yang dikenal sebagai 'Khalilullah' (Sahabat Allah)?",
                        "opsi": ["Nabi Musa A.S.", "Nabi Ibrahim A.S.", "Nabi Isa A.S.", "Nabi Nuh A.S."],
                        "jawab": "Nabi Ibrahim A.S."
                      }
                    ]

                    Buat 10 soal baru berdasarkan aturan di atas.
                    `;
                
                } else if (kategori === 'ayat') {
                    let scope = level === 'mudah' ? 'Surat pendek di Juz 30 (misal: An-Nas, Al-Ikhlas, Al-Falaq)' : 'Seluruh Juz 30';
                    
                    // --- PROMPT DIPERBAIKI ---
                    prompt = `
                    Bertindak sebagai ahli dan penguji Tahfidz Al-Quran yang sangat teliti.
                    Tugas Anda adalah membuat 10 soal pilihan ganda "Sambung Ayat" dari ${scope}.

                    ATURAN KETAT YANG HARUS DIIKUTI:
                    1. Gunakan **teks Arab Utsmani standar** untuk setiap potongan ayat. BUKAN transliterasi.
                    2. Setiap soal terdiri dari satu potongan ayat sebagai pertanyaan.
                    3. Opsi jawaban harus terdiri dari 1 ayat kelanjutan yang BENAR dan 3 ayat PENGGANGGU (SALAH).
                    4. Ayat PENGGANGGU (SALAH) juga harus diambil dari **ayat-ayat lain dalam Al-Quran (Juz 30)**, bukan teks acak atau dari agama lain. Ini penting untuk menjaga konteks Islami.
                    5. Pastikan setiap ayat yang digunakan (baik benar maupun salah) adalah ayat yang valid dan akurat.
                    6. Output HANYA dalam format JSON Array. Tidak ada komentar atau teks tambahan.

                    CONTOH YANG DIHARAPKAN:
                    [
                      {
                        "tanya": "قُلْ هُوَ اللَّهُ أَحَدٌ",
                        "opsi": [
                          "اللَّهُ الصَّمَدُ",
                          "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
                          "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
                          "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"
                        ],
                        "jawab": "اللَّهُ الصَّمَدُ"
                      }
                    ]

                    Sekarang, buat 10 soal baru berdasarkan aturan di atas.
                    `;
                

} else if (kategori === 'kasir') {
    // 🔥 LOGIKA LEVEL KASIR (Uang Kecil vs Besar)
    let rangeUang = level === 'mudah' ? '500 - 5000 (kelipatan 500)' : 
                   (level === 'sedang' ? '10000 - 50000' : '50000 - 200000');
    let kompleksitas = level === 'sulit' ? 'dengan nilai pecahan tidak bulat' : 'nilai bulat sederhana';
    
    prompt = `Buat 15 transaksi kasir unik. Level: ${level}. Range Harga: ${rangeUang}. Kompleksitas: ${kompleksitas}. Tema: ${getRandomObject()}. Output JSON Array: [{"cerita":"Budi membeli...","total_belanja":5000,"uang_bayar":10000,"kembalian":5000}]. NO COMMENTS.`;

} else if (kategori === 'memory' || kategori === 'labirin' || kategori === 'zuma' || kategori === 'piano') {
    
    if(kategori === 'memory') {
        // 🔥 LOGIKA LEVEL MEMORY (Jumlah Kartu)
        let pairs = level === 'mudah' ? 6 : (level === 'sedang' ? 10 : 15);
        prompt = `Buat ${pairs} pasang kata/konsep yang saling berhubungan untuk game memori. Tema: ${tema}. Level: ${level}. Output HANYA JSON Array: [{"a":"Dokter","b":"Rumah Sakit"}]. NO COMMENTS.`;
    }
    
    if(kategori === 'labirin') {
        // 🔥 LOGIKA LEVEL LABIRIN (Ukuran & Soal)
        let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
        let difficultyMath = level === 'mudah' ? 'penjumlahan dasar' : 'perkalian';
        prompt = `Buat konfigurasi Labirin size ${size}x${size}. Tambahkan 5 soal matematika ${difficultyMath}. Output HANYA JSON Object: {"maze_size":${size}, "soal_list":[{"tanya":"10+10","jawab":"20"}]}. NO COMMENTS.`;
    }
    
    if(kategori === 'zuma') {
        // 🔥 LOGIKA LEVEL ZUMA (Kecepatan)
        let speed = level; // mudah/sedang/sulit akan dibaca client
        prompt = `Buat level Zuma tema ${tema}. Level: ${level}. Output HANYA JSON Object: {"deskripsi":"Misi ${tema} (${level})","palet_warna":["#ff0000","#00ff00","#0000ff"], "speed":"${speed}"}. NO COMMENTS.`;
    }
    
    if(kategori === 'piano') {
        // 🔥 LOGIKA LEVEL PIANO (Panjang Nada)
        let length = level === 'mudah' ? 5 : (level === 'sedang' ? 8 : 12);
        prompt = `Buat urutan nada piano acak sepanjang ${length} digit (angka 1-7). Output HANYA JSON Object: {"sequence":[1,3,5,2,4...]}. NO COMMENTS.`;
    }
}

                if (prompt) {
                    const text = await tanyaGLM(prompt);
                    dataGudang = extractJSON(text);
                    
                    if (dataGudang) await set(ref(database, cacheKey), dataGudang);
                }
            }

            // --- PILIH ACAK DARI GUDANG ---
            if (dataGudang) {
                if (kategori === 'math' && Array.isArray(dataGudang)) {
                    const acak = Math.floor(Math.random() * dataGudang.length);
                    soalData = dataGudang[acak]; 
                } 
else if ((kategori === 'nabi' || kategori === 'ayat') && Array.isArray(dataGudang)) {
    // 1. Acak urutan soal induk menggunakan Fisher-Yates
    let allQuestions = fisherYatesShuffle([...dataGudang]);
    
    // 2. Ambil 5 soal saja
    let selectedQuestions = allQuestions.slice(0, 5);

    // 3. Acak posisi opsi jawaban (A/B/C/D)
    soalData = selectedQuestions.map(item => {
        let newItem = { ...item }; // Copy objek agar aman
        if (newItem.opsi && Array.isArray(newItem.opsi)) {
            // Acak opsi jawaban menggunakan Fisher-Yates
            newItem.opsi = fisherYatesShuffle([...newItem.opsi]);
        }
        return newItem;
    });
}
                else if (kategori === 'kasir' && Array.isArray(dataGudang)) {
                    const acak = Math.floor(Math.random() * dataGudang.length);
                    soalData = dataGudang[acak];
                }
                else {
                    soalData = dataGudang;
                }
            }

            if (soalData) {
                socket.emit('soalDariAI', { kategori, data: soalData });
            } else {
                throw new Error("Gagal memproses data.");
            }

        } catch (error) {
            console.error(`❌ Error ${kategori}:`, error.message);
            
            // --- FALLBACK (OFFLINE MODE) ---
            let fallbackData = null;
            if (kategori === 'math') fallbackData = { soal: "10 + 10 = ?", jawaban: 20 };
            else if (kategori === 'nabi') fallbackData = [{ tanya: "Nabi terakhir?", opsi: ["Isa", "Muhammad"], jawab: "Muhammad" }];
            else if (kategori === 'ayat') fallbackData = [
                { tanya: "قُلْ هُوَ اللَّهُ أَحَدٌ", opsi: ["اللَّهُ الصَّمَدُ", "مَالِكِ يَوْمِ الدِّينِ", "اِهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", "رَبِّ الْعَالَمِينَ"], jawab: "اللَّهُ الصَّمَدُ" }
            ];
            else if (kategori === 'zuma') fallbackData = { deskripsi: "Mode Offline", palet_warna: ["#f00"], speed: "sedang" };
            else if (kategori === 'memory') fallbackData = [{ a: "A", b: "B" }, { a: "C", b: "D" }];
            else if (kategori === 'kasir') fallbackData = [{ cerita: "Offline Mode", total_belanja: 500, uang_bayar: 1000, kembalian: 500 }];
            else if (kategori === 'labirin') fallbackData = { maze_size: 10, soal_list: [{ tanya: "1+1", jawab: "2" }] };
            else if (kategori === 'piano') fallbackData = { sequence: [1, 2, 3, 4] };

            if (fallbackData) {
                console.log(`⚠️ Mengirim Data Darurat (Offline Mode) untuk ${kategori}`);
                socket.emit('soalDariAI', { kategori: kategori, data: fallbackData });
            } else {
                socket.emit('soalDariAI', { kategori: kategori, data: null, error: "Server Gangguan" });
            }
        }
    });

// ==========================================
    // BAGIAN B: SIMPAN SKOR (DENGAN TRANSACTION - ANTI RACE CONDITION)
    // ==========================================
    socket.on('simpanSkor', async (data) => {
        let skorMasuk = parseInt(data.skor);
        if (isNaN(skorMasuk) || skorMasuk < 0) return;
        
        // Rate Limiter Sederhana (Opsional: max 2000 per game session)
        if (skorMasuk > 5000) skorMasuk = 5000; 

        const safeName = sanitizeKey(data.nama);
        const now = new Date();
        const koinDapat = Math.floor(skorMasuk / 10);

        const userRef = ref(database, 'leaderboard/' + safeName);

        try {
            // 🔥 PERUBAHAN UTAMA: Menggunakan runTransaction 🔥
            await runTransaction(userRef, (userData) => {
                if (userData === null) {
                    // Jika user belum ada, buat baru
                    return {
                        nama: data.nama,
                        [`skor_${data.game}`]: skorMasuk,
                        videa_coin: koinDapat,
                        last_played: now.toISOString(),
                        role: 'siswa' // Default role
                    };
                } else {
                    // Jika user ada, update secara atomik
                    const skorLama = userData[`skor_${data.game}`] || 0;
                    userData[`skor_${data.game}`] = skorLama + skorMasuk;

                    const koinLama = userData.videa_coin || 0;
                    userData.videa_coin = koinLama + koinDapat;

                    userData.last_played = now.toISOString();
                    userData.nama = data.nama; // Update nama display jika berubah
                    
                    return userData; // Kembalikan data baru ke database
                }
            });

            // Simpan Riwayat (Log History tidak butuh transaction karena path-nya unik berdasarkan timestamp)
            const historyEntry = {
                game: data.game,
                skor: skorMasuk,
                koin: koinDapat,
                waktu: now.toISOString()
            };
            
            // Gunakan push() agar ID unik otomatis (lebih aman daripada now.getTime() jika request super cepat)
            // Tapi now.getTime() juga cukup oke untuk skala kecil. Kita pakai path yg Anda buat sebelumnya.
            const historyPath = `score_history/${safeName}/${now.getTime()}`;
            await set(ref(database, historyPath), historyEntry);

            console.log(`✅ Transaction Sukses: ${data.nama} | ${data.game}: +${skorMasuk}`);

        } catch (e) {
            console.error("❌ Transaction Gagal:", e.message);
        }
    });

    //GLOBAL CHAT
    socket.on('chatMessage', (msgData) => {
        if (!msgData.pesan || msgData.pesan.trim() === "") return;
        
        const now = new Date();
        
        const timeString = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
        });

        let safeName = msgData.nama.substring(0, 20);

        io.emit('chatMessage', {
            nama: msgData.nama,
            pesan: msgData.pesan,
            waktu: timeString
        });
    });

    socket.on('disconnect', () => { });
});


const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));