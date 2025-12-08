require('dotenv').config();

// --- INISIALISASI FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, update, get, set } = require("firebase/database");

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

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- GEMINI AI CONFIG (AMAN) ---
const apiKey = process.env.API_KEY; 
let genAI = null;
let model = null;

if (!apiKey) {
    console.warn("⚠️ PERINGATAN: API_KEY tidak ditemukan di .env atau variable server.");
    console.warn("ℹ️ Server tetap berjalan, tetapi fitur AI akan menggunakan Soal Cadangan (Fallback).");
} else {
   try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ 
            // GANTI JADI INI (Sesuai daftar Anda & Kuota Besar)
            model: "gemini-flash-latest", 
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

// --- HELPER: PENGACAK TEMA ---
function getRandomTheme() {
    const themes = ["Luar Angkasa", "Hutan Rimba", "Bawah Laut", "Dunia Dinosaurus", "Kota Futuristik", "Kerajaan Fantasi", "Dunia Permen", "Super Hero", "Gurun Pasir", "Kutub Utara"];
    return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomObject() {
    const objects = ["Apel", "Robot", "Kucing", "Mobil", "Bintang", "Buku", "Pedang", "Pizza", "Bola", "Topi"];
    return objects[Math.floor(Math.random() * objects.length)];
}

// --- KODE BARU: Sisipkan ini sebelum io.on('connection') ---
function sanitizeKey(key) {
    if (!key) return "Guest";
    // Mengubah simbol . # $ [ ] menjadi garis bawah (_) agar Firebase tidak error
    return key.replace(/[.#$[\]]/g, '_');
}


io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    // --- GAME ROOMS ---
    socket.on('joinRoom', (data) => { socket.join(data.room); });
    socket.on('laporSkor', (data) => { socket.to(data.room).emit('updateSkorLawan', data.skor); });

    // --- MATH DUEL ---
    let mathRooms = {}; 
    socket.on('joinMathDuel', async (data) => {
        const { room, nama, tingkat } = data;
        socket.join(room);
        
        if (!mathRooms[room]) mathRooms[room] = [];
        mathRooms[room].push({ id: socket.id, nama: nama });

        if (mathRooms[room].length === 2) {
            console.log(`🚀 Duel Mulai di Room ${room}`);
            try {
                const tema = getRandomTheme();
                const prompt = `Buat 10 soal matematika SD tingkat ${tingkat} dengan tema cerita: ${tema}. 
                JSON Array Murni: [{"q":"Soal cerita singkat","a":2}]. JANGAN ADA KOMENTAR // atau markdown.`;
                
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                
                // Cleaner Sederhana untuk Duel
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']') + 1;
                const cleanJson = text.substring(start, end).replace(/\/\/.*$/gm, ''); // Hapus komentar
                
                const paketSoal = JSON.parse(cleanJson);
                io.to(room).emit('startDuel', { soal: paketSoal });
                delete mathRooms[room];
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

    // --- CHAT KE WIB ---
    socket.on('chatMessage', (data) => {
        const now = new Date();
        
        // format waktu Asia/Jakarta (WIB)
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Jakarta' 
        });

        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });


    // ---  BLOK simpanSkor  ---
    socket.on('simpanSkor', async (data) => {
        let skorMasuk = parseInt(data.skor);
        
        // Validasi agar skor tidak aneh-aneh
        if (isNaN(skorMasuk) || skorMasuk < 0) return;
        if (skorMasuk > 1000) skorMasuk = 1000; 

        console.log(`💾 Simpan Valid: ${data.nama} +${skorMasuk} (${data.game})`);

        try {
            // bersihkan nama user dulu
            const safeName = sanitizeKey(data.nama); 
            
            // gunakan nama yang aman (contoh: Mr_Aan) sebagai kunci database
            const userRef = ref(database, 'leaderboard/' + safeName);
            
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            let fieldSkor = '';
            if (data.game === 'math' || data.game === 'kasir' || data.game === 'labirin') fieldSkor = 'skor_math';
            else if (data.game === 'zuma') fieldSkor = 'skor_zuma';
            else if (data.game === 'memory') fieldSkor = 'skor_memory';
            else if (data.game === 'piano') fieldSkor = 'skor_piano';
            else if (data.game === 'nabi') fieldSkor = 'skor_nabi';
            else if (data.game === 'ayat') fieldSkor = 'skor_ayat';


            if (!fieldSkor) return;

            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + skorMasuk;

            // simpan nama ASLI di dalam data, tapi kuncinya pakai nama AMAN
            const updateData = { nama: data.nama, [fieldSkor]: totalBaru };
            if (fieldSkor === 'skor_math') updateData.waktu_math = new Date().toString();
            
            await update(userRef, updateData);
            console.log(`✅ Total Baru untuk ${safeName}: ${totalBaru}`);
        } catch (error) { console.error("❌ DB Error:", error); }
    });

// --- MINTA SOAL AI (DENGAN SISTEM SMART WAREHOUSE) ---
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat } = requestData;
        const level = tingkat || 'sedang';

        // 1. KUNCI GUDANG (CACHE KEY)
        // Kita simpan stok berdasarkan kategori dan level.
        // Contoh: "cache_soal/nabi_mudah" atau "cache_soal/zuma_sulit"
        // Kita tambah '_v2' agar server membuat gudang baru yang bersih
        const cacheKey = `cache_soal_v2/${kategori}_${level}`;

        try {
            // 2. CEK GUDANG DULU (GRATIS)
            // console.log(`🔍 Mengecek Gudang: ${cacheKey}...`); // Debugging
            const snapshot = await get(ref(database, cacheKey));
            
            if (snapshot.exists()) {
                console.log(`⚡ CACHE HIT: Mengambil ${kategori} (${level}) dari Database.`);
                let cachedData = snapshot.val();
                
                // Trik: Jika datanya Array (seperti Nabi/Ayat/Memory), kita acak urutannya
                // supaya user merasa soalnya "beda" padahal stok lama.
                if (Array.isArray(cachedData)) {
                    cachedData.sort(() => Math.random() - 0.5);
                }

                socket.emit('soalDariAI', { kategori: kategori, data: cachedData });
                return; // BERHENTI. Tidak perlu panggil AI.
            }

            // 3. JIKA GUDANG KOSONG, PANGGIL AI (PAKAI KUOTA)
            console.log(`🤖 CACHE MISS: Gudang Kosong. Memanggil AI untuk ${kategori}...`);
            
            if (!model) throw new Error("Model AI belum siap.");

            let prompt = "";
            const temaAcak = getRandomTheme();
            const objekAcak = getRandomObject();

            // --- PROMPT ENGINEERING ---
            
            if (kategori === 'math') {
                let range = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                // Math tetap minta 1 soal (format object) agar tidak merusak frontend math.js
                prompt = `Bertindak sebagai guru matematika. Buat 1 soal matematika SD.
                Tingkat: ${level}. Range: ${range}. Tema: ${temaAcak}.
                Output JSON: {"soal": "...", "jawaban": 0}. NO COMMENTS.`;
            
            } else if (kategori === 'memory') {
                let num = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                const kategoriMemory = ["Ibukota Negara", "Nama Hewan Inggris", "Rumus Bangun Datar", "Antonim Kata", "Sinonim Kata", "Nama Planet"];
                const katPilihan = kategoriMemory[Math.floor(Math.random() * kategoriMemory.length)];
                prompt = `Buat ${num} pasang kartu memori SD. Kategori: ${katPilihan}. Output JSON Array: [{"a":"...","b":"..."}]. NO COMMENTS.`;
            
            } else if (kategori === 'zuma') {
                let spd = level === 'mudah' ? 'lambat' : (level === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level game Zuma unik tema visual: ${temaAcak}. Speed: ${spd}.
                Output JSON: {"deskripsi":"Misi di ${temaAcak}...", "palet_warna":["#ff0000","#00ff00","#0000ff","#ffff00"], "speed":"${spd}"}. NO COMMENTS.`;
            
            } else if (kategori === 'kasir') {
                let rng = level === 'mudah' ? 'ratusan' : (level === 'sedang' ? 'ribuan' : 'puluhan ribu');
                prompt = `Buat skenario belanja unik di "Toko ${objekAcak}". Range: ${rng}.
                Output JSON: {"cerita":"...", "total_belanja":0, "uang_bayar":0, "kembalian":0}. NO COMMENTS.`;
            
            } else if (kategori === 'labirin') {
                let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                let numQ = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 8);
                prompt = `Buat konfigurasi labirin Grid: ${size}x${size}. Buat ${numQ} soal sains SD.
                Output JSON: {"maze_size": ${size}, "soal_list": [{"tanya":"...","jawab":"..."}]}. NO COMMENTS.`;
            
            } else if (kategori === 'piano') {
                let len = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                prompt = `Buat urutan nada piano acak ${len} digit (1-9). Output JSON: { "sequence": [1, 3, 5] }. NO COMMENTS.`;
            
            } else if (kategori === 'nabi') {
                let depth = level === 'mudah' ? 'dasar' : (level === 'sedang' ? 'peristiwa' : 'detail');
                prompt = `Guru Agama Islam. Buat 5 soal pilihan ganda Kisah Nabi. Fokus: ${depth}.
                Output JSON Array: [{"tanya": "...", "opsi": ["A", "B", "C", "D"], "jawab": "A"}]. NO COMMENTS.`;

            } else if (kategori === 'ayat') {
                let surahScope = level === 'mudah' ? 'An-Nas s.d Al-Fil' : 'Juz 30';
                prompt = `Guru Tahfidz. Buat 5 soal Sambung Ayat surat pendek (${surahScope}).
                Output JSON Array: [{"tanya": "Lanjut: ...", "opsi": ["A", "B", "C", "D"], "jawab": "A"}]. NO COMMENTS.`;
            }

            if (!prompt) return;

            // Panggil AI
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            // --- PARSING JSON ---
            const jsonStartIndex = text.indexOf('{');
            const arrayStartIndex = text.indexOf('[');
            let cleanJson;
            
            // Kategori yang outputnya Array
            const isArrayCategory = (kategori === 'memory' || kategori === 'nabi' || kategori === 'ayat');

            if (isArrayCategory && arrayStartIndex !== -1) {
                const arrayEndIndex = text.lastIndexOf(']') + 1;
                cleanJson = text.substring(arrayStartIndex, arrayEndIndex);
            } else if (jsonStartIndex !== -1) {
                const jsonEndIndex = text.lastIndexOf('}') + 1;
                cleanJson = text.substring(jsonStartIndex, jsonEndIndex);
            } else {
                throw new Error("JSON tidak ditemukan di respon AI");
            }
            
            cleanJson = cleanJson.replace(/\/\/.*$/gm, ''); // Hapus komentar
            const soalData = JSON.parse(cleanJson);

            // 4. SIMPAN KE DATABASE (RESTOCK GUDANG)
            // Ini langkah kuncinya: Simpan hasil AI ke Firebase
            console.log(`💾 Menyimpan stok soal baru ke: ${cacheKey}`);
            await set(ref(database, cacheKey), soalData);

            // Kirim ke Client
            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ System Error:", error.message);
            
            // --- FALLBACK MANUAL (PLAN B) ---
            // Digunakan jika AI Error DAN Database Kosong
            let fallback;
            
            if (kategori === 'nabi') fallback = [
                {tanya: "Nabi Nuh terkenal dengan mukjizat?", opsi: ["Kapal Besar", "Membelah Laut", "Tongkat Ular", "Api Dingin"], jawab: "Kapal Besar"},
                {tanya: "Nabi terakhir adalah?", opsi: ["Isa AS", "Musa AS", "Muhammad SAW", "Ibrahim AS"], jawab: "Muhammad SAW"}
            ];
            if (kategori === 'ayat') fallback = [
                {tanya: "Qul huwallahu...", opsi: ["Ahad", "Somad", "Kufuwan", "Yalid"], jawab: "Ahad"},
                {tanya: "Inna a'tainakal...", opsi: ["Kausar", "Abtar", "Wanhar", "Saniaka"], jawab: "Kausar"}
            ];
            if (kategori === 'math') fallback = {soal: "10 + 10 = ?", jawaban: 20};
            if (kategori === 'zuma') fallback = {deskripsi: "Offline", palet_warna: ["#f00","#0f0"], speed: "sedang"};
            if (kategori === 'memory') fallback = [{a:"A", b:"B"}, {a:"C", b:"D"}];
            if (kategori === 'kasir') fallback = {cerita: "Offline Mode", total_belanja: 500, uang_bayar: 1000, kembalian: 500};
            if (kategori === 'labirin') fallback = {maze_size: 10, soal_list: [{tanya:"1+1", jawab:"2"}]};
            if (kategori === 'piano') fallback = {sequence: [1,2,3,4]};
            
            if (fallback) socket.emit('soalDariAI', { kategori: kategori, data: fallback });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));