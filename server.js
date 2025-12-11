require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
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
console.log("✅ AI System: Menggunakan GLM-4-Flash (Zhipu AI)");

async function tanyaGLM(promptText) {
    const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    const apiKey = process.env.ZHIPU_API_KEY; 

    if (!apiKey) throw new Error("ZHIPU_API_KEY belum dipasang di .env");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "glm-4-flash",
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

// Fungsi Pengacakan Sempurna (Fisher-Yates)
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
                
                if (kategori === 'math') {
                    let r = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                    let op = level === 'mudah' ? 'tambah/kurang' : 'campuran (jika pembagian, hasil wajib bilangan bulat)';
                    prompt = `Buat 30 soal matematika SD unik. Level: ${level}. Range: ${r}. Operasi: ${op}. Tema: ${tema}. Output JSON Array: [{"soal":"10+10","jawaban":20}]. NO COMMENTS.`;
                
                } else if (kategori === 'nabi') {
                    prompt = `
                    Bertindak sebagai Guru Sejarah Kebudayaan Islam (SKI).
                    Buat 10 soal pilihan ganda tentang Kisah 25 Nabi & Rasul. Level: ${level}.
                    ATURAN: Sumber Al-Quran/Hadits Shahih. Output JSON Array.
                    CONTOH: [{"tanya":"...","opsi":["A","B","C","D"],"jawab":"A"}]
                    `;
                
                } else if (kategori === 'ayat') {
                    let scope = level === 'mudah' ? 'Surat pendek Juz 30' : 'Seluruh Juz 30';
                    prompt = `
                    Bertindak sebagai ahli Tahfidz. Buat 10 soal "Sambung Ayat" dari ${scope}.
                    ATURAN: Arab Utsmani. Jawaban benar & salah harus dari Juz 30. Output JSON Array.
                    CONTOH: [{"tanya":"...","opsi":["A","B","C","D"],"jawab":"A"}]
                    `;

                } else if (kategori === 'kasir') {
                    let rangeUang = level === 'mudah' ? '500 - 5000 (kelipatan 500)' : 
                                   (level === 'sedang' ? '10000 - 50000' : '50000 - 200000');
                    let kompleksitas = level === 'sulit' ? 'dengan nilai pecahan tidak bulat' : 'nilai bulat sederhana';
                    prompt = `Buat 15 transaksi kasir unik. Level: ${level}. Range Harga: ${rangeUang}. Kompleksitas: ${kompleksitas}. Tema: ${getRandomObject()}. Output JSON Array: [{"cerita":"Budi membeli...","total_belanja":5000,"uang_bayar":10000,"kembalian":5000}]. NO COMMENTS.`;

                } else if (kategori === 'memory' || kategori === 'labirin' || kategori === 'zuma' || kategori === 'piano') {
                    if(kategori === 'memory') {
                        let pairs = level === 'mudah' ? 6 : (level === 'sedang' ? 10 : 15);
                        prompt = `Buat ${pairs} pasang kata/konsep game memori. Tema: ${tema}. Output JSON Array: [{"a":"Kata","b":"Gambar"}]. NO COMMENTS.`;
                    }
                    if(kategori === 'labirin') {
                        let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                        let topic = level === 'mudah' ? 'Pengetahuan Umum SD' : 'Sains SD';
                        let count = level === 'mudah' ? 3 : 5;
                        prompt = `Buat konfigurasi Labirin ${size}x${size}. ${count} soal rintangan tentang ${topic}. Jawaban SATU KATA. Output JSON Object: {"maze_size":${size}, "soal_list":[{"tanya":"Ibukota?","jawab":"Jakarta"}]}. NO COMMENTS.`;
                    }
                    if(kategori === 'zuma') {
                        let speed = level; 
                        prompt = `Buat level Zuma tema ${tema}. Level: ${level}. Output JSON Object: {"deskripsi":"Misi ${tema}","palet_warna":["#f00","#0f0","#00f"], "speed":"${speed}"}. NO COMMENTS.`;
                    }
                    if(kategori === 'piano') {
                        let length = level === 'mudah' ? 5 : (level === 'sedang' ? 8 : 12);
                        prompt = `Buat urutan nada piano acak ${length} digit (1-7). Output JSON Object: {"sequence":[1,3,5...]}. NO COMMENTS.`;
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
                    let allQuestions = fisherYatesShuffle([...dataGudang]);
                    let selectedQuestions = allQuestions.slice(0, 5);
                    soalData = selectedQuestions.map(item => {
                        let newItem = { ...item };
                        if (newItem.opsi && Array.isArray(newItem.opsi)) {
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

        } catch (error) { // ✅ INI BAGIAN YANG TADI HILANG!
            console.error(`❌ Error ${kategori}:`, error.message);
            
            // --- FALLBACK (OFFLINE MODE) ---
            let fallbackData = null;
            if (kategori === 'math') fallbackData = { soal: "10 + 10 = ?", jawaban: 20 };
            else if (kategori === 'nabi') fallbackData = [{ tanya: "Nabi terakhir?", opsi: ["Isa", "Muhammad"], jawab: "Muhammad" }];
            else if (kategori === 'ayat') fallbackData = [{ tanya: "Al-Fatihah 1?", opsi: ["Bismillah", "Alhamdulillah"], jawab: "Bismillah" }];
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
    // BAGIAN B: SIMPAN SKOR (ANTI RACE CONDITION)
    // ==========================================
    socket.on('simpanSkor', async (data) => {
        let skorMasuk = parseInt(data.skor);
        if (isNaN(skorMasuk) || skorMasuk < 0) return;
        if (skorMasuk > 5000) skorMasuk = 5000; 

        const safeName = sanitizeKey(data.nama);
        const now = new Date();
        const koinDapat = Math.floor(skorMasuk / 10);
        const userRef = ref(database, 'leaderboard/' + safeName);

        try {
            await runTransaction(userRef, (userData) => {
                if (userData === null) {
                    return {
                        nama: data.nama,
                        [`skor_${data.game}`]: skorMasuk,
                        videa_coin: koinDapat,
                        last_played: now.toISOString(),
                        role: 'siswa'
                    };
                } else {
                    const skorLama = userData[`skor_${data.game}`] || 0;
                    userData[`skor_${data.game}`] = skorLama + skorMasuk;
                    const koinLama = userData.videa_coin || 0;
                    userData.videa_coin = koinLama + koinDapat;
                    userData.last_played = now.toISOString();
                    userData.nama = data.nama;
                    return userData;
                }
            });

            // Simpan Riwayat
            const historyEntry = { game: data.game, skor: skorMasuk, koin: koinDapat, waktu: now.toISOString() };
            const historyPath = `score_history/${safeName}/${now.getTime()}`;
            await set(ref(database, historyPath), historyEntry);

            console.log(`✅ Transaction Sukses: ${data.nama} | ${data.game}: +${skorMasuk}`);
        } catch (e) {
            console.error("❌ Transaction Gagal:", e.message);
        }
    });

    // ==========================================
    // BAGIAN C: GLOBAL CHAT (WIB)
    // ==========================================
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
            nama: safeName,
            pesan: msgData.pesan.substring(0, 200),
            waktu: timeString
        });
    });

    socket.on('disconnect', () => { });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));