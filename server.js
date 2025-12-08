require('dotenv').config();

// --- 1. INISIALISASI FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, update, get, set } = require("firebase/database");

// Konfigurasi Firebase (Pastikan API Key benar di .env atau hardcoded di sini)
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// --- 2. SETUP SERVER & AI ---
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Konfigurasi Gemini AI
const apiKey = process.env.API_KEY; 
let genAI = null;
let model = null;

if (!apiKey) {
    console.warn("⚠️ PERINGATAN: API_KEY tidak ditemukan. Fitur AI akan menggunakan mode offline (Fallback).");
} else {
   try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest", // Pastikan model ini tersedia untuk akun Anda
            generationConfig: {
                temperature: 0.85, 
                topP: 0.95,
                topK: 40,
            }
        });
        console.log("✅ AI System: Siap (Gemini Flash Latest)"); 
    } catch (error) {
        console.error("❌ Gagal inisialisasi AI:", error.message);
    }
}

app.use(express.static('public'));

// --- 3. FUNGSI HELPER (BANTUAN) ---

// Pengacak Tema & Objek
function getRandomTheme() {
    const themes = ["Luar Angkasa", "Hutan Rimba", "Bawah Laut", "Dunia Dinosaurus", "Kota Futuristik", "Kerajaan Fantasi", "Dunia Permen", "Super Hero", "Gurun Pasir", "Kutub Utara"];
    return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomObject() {
    const objects = ["Apel", "Robot", "Kucing", "Mobil", "Bintang", "Buku", "Pedang", "Pizza", "Bola", "Topi"];
    return objects[Math.floor(Math.random() * objects.length)];
}

// Sanitasi Key Database (Mengubah simbol aneh jadi underscore)
function sanitizeKey(key) {
    if (!key) return "Guest";
    return key.replace(/[.#$[\]]/g, '_');
}

// EKSTRAKTOR JSON PINTAR (Perbaikan Utama)
// Mencari kurung {} atau [] di dalam teks AI, meskipun ada teks sampah lainnya.
function extractJSON(text) {
    try {
        const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) return JSON.parse(match[0]);
    } catch (e) {
        return null;
    }
    return null;
}


// --- 4. LOGIKA SOCKET.IO (GAME ENGINE) ---
io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    // --- A. ROOM & SKOR REALTIME ---
    socket.on('joinRoom', (data) => { socket.join(data.room); });
    socket.on('laporSkor', (data) => { socket.to(data.room).emit('updateSkorLawan', data.skor); });

    // --- B. MATH DUEL (MULTIPLAYER) ---
    // Variabel lokal untuk menyimpan room duel sementara
    let mathRooms = {}; 
    
    socket.on('joinMathDuel', async (data) => {
        const { room, nama, tingkat } = data;
        socket.join(room);
        
        // Simpan player ke memory
        if (!mathRooms[room]) mathRooms[room] = [];
        mathRooms[room].push({ id: socket.id, nama: nama });

        // Jika sudah 2 orang, mulai game
        if (mathRooms[room].length === 2) {
            console.log(`🚀 Duel Mulai di Room ${room}`);
            try {
                // Gunakan AI untuk buat soal duel
                const tema = getRandomTheme();
                const prompt = `Buat 10 soal matematika SD tingkat ${tingkat} dengan tema cerita: ${tema}. 
                JSON Array Murni: [{"q":"Soal cerita singkat","a":2}]. JANGAN ADA KOMENTAR.`;
                
                let paketSoal = null;
                if (model) {
                    const result = await model.generateContent(prompt);
                    paketSoal = extractJSON(result.response.text());
                }

                // Jika AI gagal parsing, gunakan fallback
                if (!paketSoal) {
                     paketSoal = [{q:"5+5",a:10}, {q:"2x3",a:6}, {q:"10-4",a:6}, {q:"8+2",a:10}, {q:"20:2",a:10}];
                }
                
                io.to(room).emit('startDuel', { soal: paketSoal });
                delete mathRooms[room]; // Hapus room dari memory agar hemat
            } catch (e) {
                console.error("AI Duel Error:", e);
                const fallback = [{q:"5+5",a:10}, {q:"2x3",a:6}, {q:"10-4",a:6}, {q:"8+2",a:10}, {q:"20:2",a:10}];
                io.to(room).emit('startDuel', { soal: fallback });
            }
        } else {
            socket.emit('waitingForOpponent', "Menunggu lawan...");
        }
    });
    
    socket.on('updateScoreDuel', (data) => { socket.to(data.room).emit('opponentScoreUpdate', data.score); });

    // --- C. CHAT GLOBAL ---
    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Jakarta' 
        });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

    // --- D. SIMPAN SKOR KE DATABASE (PERSISTENSI) ---
    socket.on('simpanSkor', async (data) => {
        let skorMasuk = parseInt(data.skor);
        if (isNaN(skorMasuk) || skorMasuk < 0) return;
        if (skorMasuk > 2000) skorMasuk = 2000; // Cap maksimal skor agar tidak curang berlebih

        console.log(`💾 Simpan Valid: ${data.nama} +${skorMasuk} (${data.game})`);

        try {
            const safeName = sanitizeKey(data.nama); 
            const userRef = ref(database, 'leaderboard/' + safeName);
            
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            // Tentukan field berdasarkan game
            let fieldSkor = '';
            switch(data.game) {
                case 'math': fieldSkor = 'skor_math'; break;
                case 'kasir': fieldSkor = 'skor_kasir'; break;
                case 'labirin': fieldSkor = 'skor_labirin'; break;
                case 'zuma': fieldSkor = 'skor_zuma'; break;
                case 'memory': fieldSkor = 'skor_memory'; break;
                case 'piano': fieldSkor = 'skor_piano'; break;
                case 'nabi': fieldSkor = 'skor_nabi'; break;
                case 'ayat': fieldSkor = 'skor_ayat'; break;
            }

            if (!fieldSkor) return;

            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + skorMasuk;

            // Update database
            const updateData = { nama: data.nama, [fieldSkor]: totalBaru };
            if (fieldSkor === 'skor_math') updateData.waktu_math = new Date().toString();
            
            await update(userRef, updateData);
        } catch (error) { console.error("❌ DB Error:", error); }
    });

    // --- E. SISTEM AI GENERATOR (DENGAN CACHE) ---
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat } = requestData;
        const level = tingkat || 'sedang';
        
        // Kunci Gudang (Cache Key)
        const cacheKey = `cache_soal_v5/${kategori}_${level}`;

        try {
            // 1. CEK GUDANG (DATABASE) DULU
            const snapshot = await get(ref(database, cacheKey));
            
            if (snapshot.exists()) {
                console.log(`⚡ CACHE HIT: Mengambil ${kategori} (${level}) dari Database.`);
                let cachedData = snapshot.val();
                
                // Jika array, acak urutannya agar terasa fresh
                if (Array.isArray(cachedData)) {
                    cachedData.sort(() => Math.random() - 0.5);
                }

                socket.emit('soalDariAI', { kategori: kategori, data: cachedData });
                return; // STOP DI SINI, tidak perlu panggil AI
            }

            // 2. JIKA GUDANG KOSONG, PANGGIL AI
            console.log(`🤖 CACHE MISS: Gudang Kosong. Memanggil AI untuk ${kategori}...`);
            
            if (!model) throw new Error("Model AI belum siap.");

            let prompt = "";
            const temaAcak = getRandomTheme();
            const objekAcak = getRandomObject();

            // --- PILIH PROMPT BERDASARKAN KATEGORI ---
            if (kategori === 'math') {
                let range = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                prompt = `Bertindak sebagai guru matematika. Buat 1 soal matematika SD. Tingkat: ${level}. Range: ${range}. Tema: ${temaAcak}. Output JSON: {"soal": "...", "jawaban": 0}. NO COMMENTS.`;
            
            } else if (kategori === 'memory') {
                let num = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                const kategoriMemory = ["Ibukota Negara", "Nama Hewan Inggris", "Rumus Bangun Datar", "Antonim Kata", "Sinonim Kata", "Nama Planet"];
                const katPilihan = kategoriMemory[Math.floor(Math.random() * kategoriMemory.length)];
                prompt = `Buat ${num} pasang kartu memori SD. Kategori: ${katPilihan}. Output JSON Array: [{"a":"...","b":"..."}]. NO COMMENTS.`;
            
            } else if (kategori === 'zuma') {
                let spd = level === 'mudah' ? 'lambat' : (level === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level game Zuma unik tema visual: ${temaAcak}. Speed: ${spd}. Output JSON: {"deskripsi":"Misi di ${temaAcak}...", "palet_warna":["#ff0000","#00ff00","#0000ff","#ffff00"], "speed":"${spd}"}. NO COMMENTS.`;
            
            } else if (kategori === 'kasir') {
                let rng = level === 'mudah' ? 'ratusan' : (level === 'sedang' ? 'ribuan' : 'puluhan ribu');
                prompt = `Buat 10 transaksi unik kasir SD. Toko: ${objekAcak}. Level: ${level} (${rng}). Output JSON Array Murni: [{"cerita":"Adik beli permen Rp 500...", "total_belanja":500, "uang_bayar":1000, "kembalian":500}]. NO COMMENTS.`;
            
            } else if (kategori === 'labirin') {
                let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                let numQ = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 8);
                prompt = `Buat konfigurasi labirin Grid: ${size}x${size}. Buat ${numQ} soal sains SD. Output JSON: {"maze_size": ${size}, "soal_list": [{"tanya":"...","jawab":"..."}]}. NO COMMENTS.`;
            
            } else if (kategori === 'piano') {
                let len = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                prompt = `Buat urutan nada piano acak ${len} digit (1-9). Output JSON: { "sequence": [1, 3, 5] }. NO COMMENTS.`;
            
            } else if (kategori === 'nabi') {
                let depth = level === 'mudah' ? 'dasar' : (level === 'sedang' ? 'peristiwa' : 'detail');
                prompt = `Guru Agama Islam. Buat 5 soal pilihan ganda Kisah Nabi. Fokus: ${depth}. Output JSON Array: [{"tanya": "...", "opsi": ["A", "B", "C", "D"], "jawab": "A"}]. NO COMMENTS.`;

            } else if (kategori === 'ayat') {
                let surahScope = level === 'mudah' ? 'An-Nas s.d Al-Fil' : 'Juz 30';
                prompt = `Guru Tahfidz. Buat 5 soal Sambung Ayat surat pendek (${surahScope}). Output JSON Array: [{"tanya": "Lanjut: ...", "opsi": ["A", "B", "C", "D"], "jawab": "A"}]. NO COMMENTS.`;
            }

            if (!prompt) return;

            // Eksekusi AI
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            // Parsing JSON dengan fungsi aman yang baru
            const soalData = extractJSON(text);

            if (!soalData) throw new Error("Gagal parsing JSON dari AI");

            // Simpan ke Cache
            await set(ref(database, cacheKey), soalData);

            // Kirim ke Client
            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ System Error:", error.message);
            
            // --- DATA CADANGAN (FALLBACK) ---
            // Digunakan jika AI Error DAN Cache Kosong
            let fallback;
            
            if (kategori === 'nabi') fallback = [{tanya: "Nabi terakhir?", opsi: ["Isa", "Musa", "Muhammad", "Ibrahim"], jawab: "Muhammad"}];
            if (kategori === 'ayat') fallback = [{tanya: "Qul huwallahu...", opsi: ["Ahad", "Somad", "Kufuwan", "Yalid"], jawab: "Ahad"}];
            if (kategori === 'math') fallback = {soal: "10 + 10 = ?", jawaban: 20};
            if (kategori === 'zuma') fallback = {deskripsi: "Offline Mode", palet_warna: ["#f00","#0f0"], speed: "sedang"};
            if (kategori === 'memory') fallback = [{a:"A", b:"B"}, {a:"C", b:"D"}];
            if (kategori === 'kasir') fallback = [{cerita: "Offline Mode", total_belanja: 500, uang_bayar: 1000, kembalian: 500}];
            if (kategori === 'labirin') fallback = {maze_size: 10, soal_list: [{tanya:"1+1", jawab:"2"}]};
            if (kategori === 'piano') fallback = {sequence: [1,2,3,4]};
            
            if (fallback) socket.emit('soalDariAI', { kategori: kategori, data: fallback });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

// --- 5. START SERVER ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));