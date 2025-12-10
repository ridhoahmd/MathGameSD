require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// --- 1. SETUP FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get, update } = require("firebase/database");

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC7S2KwvMjVLdsaTebD002nZ_CEjSeBmHo",
    authDomain: "mathgamesd.firebaseapp.com",
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// --- 2. SETUP GEMINI AI ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
// Model Lite (Stabil & Ringan)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

console.log("✅ AI System: Siap (Gemini 2.5 Flash Lite)");

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
                console.log(`🤖 AI: Stok habis, memanggil Gemini...`);
                if (!model) throw new Error("Model AI error.");

                let prompt = "";
                const tema = getRandomTheme();
                
                // --- LOGIKA PROMPT YANG BERVARIASI ---
                if (kategori === 'math') {
                    let r = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                    let op = level === 'mudah' ? 'tambah/kurang' : 'campuran';
                    prompt = `Buat 30 soal matematika SD unik. Level: ${level}. Range: ${r}. Operasi: ${op}. Tema: ${tema}. Output JSON Array: [{"soal":"1+1","jawaban":2}]. NO COMMENTS.`;
                
                } else if (kategori === 'nabi') {
                    prompt = `Buat 20 soal pilihan ganda Nabi acak. Level: ${level}. Output JSON Array: [{"tanya":"...","opsi":["A","B"],"jawab":"A"}]. NO COMMENTS.`;
                
                } else if (kategori === 'ayat') {
                    // Prompt Sambung Ayat (Juz 30)
                    let scope = level === 'mudah' ? 'Surat An-Nas s.d. Ad-Dhuha' : 'Juz 30 (Juz Amma Full)';
                    
                    prompt = `Bertindak sebagai penguji Tahfidz Quran. Buat 20 soal sambung ayat dari ${scope}. 
                    Format Soal: Tampilkan satu potongan ayat. 
                    Format Jawaban: Potongan ayat kelanjutannya.
                    Output HANYA JSON Array: 
                    [{"tanya":"(Potongan ayat awal)...", "opsi":["(Kelanjutan Salah 1)", "(Kelanjutan Salah 2)", "(Kelanjutan Benar)", "(Kelanjutan Salah 3)"], "jawab":"(Kelanjutan Benar)"}]. 
                    Pastikan opsi jawaban pengecoh mirip. NO COMMENTS.`;
                
                } else if (kategori === 'kasir') {
                    prompt = `Buat 15 transaksi kasir unik. Tema: ${getRandomObject()}. Output JSON Array: [{"cerita":"...","total_belanja":500,"uang_bayar":1000,"kembalian":500}]. NO COMMENTS.`;
                
                } else if (kategori === 'memory' || kategori === 'labirin' || kategori === 'zuma' || kategori === 'piano') {
                    if(kategori === 'memory') prompt = `Buat 10 pasang kartu memori tema ${tema}. Output HANYA JSON Array: [{"a":"Kata","b":"Gambar"}]. NO COMMENTS.`;
                    if(kategori === 'labirin') prompt = `Buat konfigurasi Labirin size 15x15. Tambahkan 5 soal sains SD. Output HANYA JSON Object: {"maze_size":15, "soal_list":[{"tanya":"1+1","jawab":"2"}]}. NO COMMENTS.`;
                    if(kategori === 'zuma') prompt = `Buat level Zuma tema ${tema}. Output HANYA JSON Object: {"deskripsi":"Misi di ${tema}...","palet_warna":["#ff0000","#00ff00","#0000ff"], "speed":"sedang"}. NO COMMENTS.`;
                    if(kategori === 'piano') prompt = `Buat nada piano acak 8 digit (angka 1-7). Output HANYA JSON Object: {"sequence":[1,3,5,2,4,6,7,1]}. NO COMMENTS.`;
                }

                if (prompt) {
                    const result = await model.generateContent(prompt);
                    const text = result.response.text();
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
                    // 1. Ambil 5 soal acak dari stok
                    let acakArray = [...dataGudang].sort(() => 0.5 - Math.random());
                    let selectedQuestions = acakArray.slice(0, 5);

                    // 2. 🔥 PERBAIKAN: ACAK POSISI OPSI JAWABAN (SHUFFLE) 🔥
                    // Supaya jawaban benar tidak selalu di urutan pertama
                    soalData = selectedQuestions.map(item => {
                        // Jika punya properti 'opsi' (array), kita acak urutannya
                        if (item.opsi && Array.isArray(item.opsi)) {
                            item.opsi = item.opsi.sort(() => Math.random() - 0.5);
                        }
                        return item;
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
                { tanya: "Qul huwallahu ahad...", opsi: ["Allahus somad", "Maliki yaumiddin", "Iqra bismi", "Waddin"], jawab: "Allahus somad" }
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
    // BAGIAN B: SIMPAN SKOR
    // ==========================================
    socket.on('simpanSkor', async (data) => {
        let skorMasuk = parseInt(data.skor);
        if (isNaN(skorMasuk) || skorMasuk < 0) return;
        if (skorMasuk > 2000) skorMasuk = 2000;

        const safeName = sanitizeKey(data.nama);
        const now = new Date();

        try {
            const userRef = ref(database, 'leaderboard/' + safeName);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};

            let fieldSkor = `skor_${data.game}`;
            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + skorMasuk;

            const koinDapat = Math.floor(skorMasuk / 10);
            const koinLama = userData.videa_coin || 0;
            const totalKoinBaru = koinLama + koinDapat;

            await update(userRef, {
                nama: data.nama,
                [fieldSkor]: totalBaru,
                videa_coin: totalKoinBaru,
                last_played: now.toISOString()
            });

            const historyEntry = {
                game: data.game,
                level: data.level || 'N/A',
                skor: skorMasuk,
                koin: koinDapat,
                waktu: now.toISOString()
            };
            
            const historyPath = `score_history/${safeName}/${now.getTime()}`;
            await set(ref(database, historyPath), historyEntry);

            console.log(`✅ Saved: ${data.nama} | ${data.game}: +${skorMasuk} | Coin: +${koinDapat}`);

        } catch (e) {
            console.error("❌ DB Error:", e.message);
        }
    });

    socket.on('disconnect', () => { });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));