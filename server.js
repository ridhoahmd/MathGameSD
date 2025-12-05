require('dotenv').config();

// --- INISIALISASI FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, update, get } = require("firebase/database");

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

// --- GEMINI AI CONFIG ---
const apiKey = process.env.API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey);

// 🔥 UPDATE 1: KONFIGURASI KREATIFITAS (TEMPERATURE TINGGI)
// Temperature 0.85 membuat AI jauh lebih variatif dan tidak kaku
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
        temperature: 0.85, // 0 = Kaku, 1 = Sangat Kreatif (Acak)
        topP: 0.95,
        topK: 40,
    }
});

app.use(express.static('public'));

// --- HELPER: PENGACAK TEMA ---
function getRandomTheme() {
    const themes = ["Luar Angkasa", "Hutan Rimba", "Bawah Laut", "Dunia Dinosaurus", "Kota Futuristik", "Kerajaan Fantasi", "Dunia Permen", "Super Hero"];
    return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomObject() {
    const objects = ["Apel", "Robot", "Kucing", "Mobil", "Bintang", "Buku", "Pedang", "Pizza", "Bola"];
    return objects[Math.floor(Math.random() * objects.length)];
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
                // Tambahkan elemen acak agar soal duel tidak itu-itu saja
                const tema = getRandomTheme();
                const prompt = `Buat 10 soal matematika SD tingkat ${tingkat} dengan tema cerita: ${tema}. 
                Variasikan jenis soal (jangan cuma tambah-tambahan).
                JSON Array: [{"q":"Soal cerita singkat","a":2}]. No markdown.`;
                
                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json|```/g, '').trim();
                
                // Pembersihan JSON Sederhana untuk Duel
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']') + 1;
                const cleanJson = text.substring(start, end);
                
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

    // --- CHAT ---
    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

    // --- SIMPAN SKOR ---
    socket.on('simpanSkor', async (data) => {
        console.log(`💾 Simpan: ${data.nama} +${data.skor} (${data.game})`);
        try {
            const userRef = ref(database, 'leaderboard/' + data.nama);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            let fieldSkor = '';
            if (data.game === 'math' || data.game === 'kasir' || data.game === 'labirin') fieldSkor = 'skor_math';
            else if (data.game === 'zuma') fieldSkor = 'skor_zuma';
            else if (data.game === 'memory') fieldSkor = 'skor_memory';
            else if (data.game === 'piano') fieldSkor = 'skor_piano';

            if (!fieldSkor) return;

            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + parseInt(data.skor);

            const updateData = { nama: data.nama, [fieldSkor]: totalBaru };
            if (fieldSkor === 'skor_math') updateData.waktu_math = new Date().toString();
            
            await update(userRef, updateData);
            console.log(`✅ Total Baru: ${totalBaru}`);
        } catch (error) { console.error("❌ DB Error:", error); }
    });

    // --- MINTA SOAL AI (UPDATE: VARIATIF) ---
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat } = requestData;
        const level = tingkat || 'sedang';

        try {
            console.log(`🤖 AI Request: ${kategori} (${level})`);
            let prompt = "";
            
            // 🔥 UPDATE 2: BUMBU RANDOM DI SETIAP KATEGORI 🔥
            const temaAcak = getRandomTheme();
            const objekAcak = getRandomObject();

            if (kategori === 'math') {
                let range = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                // Instruksi khusus: JANGAN BUAT POLA BERULANG
                prompt = `Bertindak sebagai guru matematika kreatif. Buat 1 soal matematika SD.
                Tingkat: ${level}. Range Angka: ${range}.
                Tema Soal: ${temaAcak}.
                PENTING: Buat soal cerita unik, JANGAN gunakan pola "A punya X apel". Gunakan variasi seperti sisa uang, jarak tempuh, atau pembagian barang.
                Output JSON: {"soal": "...", "jawaban": 0}.`;
            
            } else if (kategori === 'memory') {
                let num = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                // Instruksi khusus: Minta kategori spesifik secara acak
                const kategoriMemory = ["Ibukota Negara", "Nama Hewan Inggris", "Rumus Bangun Datar", "Antonim Kata", "Sinonim Kata", "Nama Planet"];
                const katPilihan = kategoriMemory[Math.floor(Math.random() * kategoriMemory.length)];
                
                prompt = `Buat ${num} pasang kartu memori untuk anak SD.
                Kategori Pasangan: ${katPilihan}.
                Contoh jika Antonim: {"a":"Panas", "b":"Dingin"}.
                Output JSON Array: [{"a":"...","b":"..."}].`;
            
            } else if (kategori === 'zuma') {
                let spd = level === 'mudah' ? 'lambat' : (level === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level game Zuma unik dengan tema visual: ${temaAcak}.
                Speed: ${spd}.
                Output JSON: {"deskripsi":"Misi di ${temaAcak}...", "palet_warna":["#hex","#hex","#hex","#hex"], "speed":"${spd}"}.`;
            
            } else if (kategori === 'kasir') {
                let rng = level === 'mudah' ? 'ratusan' : (level === 'sedang' ? 'ribuan' : 'puluhan ribu');
                prompt = `Buat skenario belanja unik di "Toko ${objekAcak}".
                Barang yang dibeli aneh/lucu. Range harga: ${rng}.
                Output JSON: {"cerita":"...", "total_belanja":0, "uang_bayar":0, "kembalian":0}.`;
            
            } else if (kategori === 'labirin') {
                let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                let numQ = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 8);
                const topikSains = ["Tata Surya", "Bagian Tumbuhan", "Wujud Benda", "Rantai Makanan", "Gaya & Gerak"];
                const topikPilihan = topikSains[Math.floor(Math.random() * topikSains.length)];

                prompt = `Buat konfigurasi labirin. Grid: ${size}x${size}.
                Buat ${numQ} soal sains SD singkat tentang topik: ${topikPilihan}.
                Jawaban 1 kata saja.
                Output JSON: {"maze_size": ${size}, "soal_list": [{"tanya":"...","jawab":"..."}]}.`;
            
            } else if (kategori === 'piano') {
                let len = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                // Minta pola yang tidak berurutan
                prompt = `Buat urutan nada piano acak sepanjang ${len} digit (angka 1-9).
                PENTING: Jangan buat urutan yang mudah ditebak seperti 12345. Buat pola lompat seperti 13524.
                Output JSON: { "sequence": [1, 3, 5] }.`;
            }

            if (!prompt) return;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log(`📝 AI Response (${kategori}):`, text.substring(0, 50) + "..."); 

            // --- CLEANING JSON ---
            const jsonStartIndex = text.indexOf('{');
            const jsonEndIndex = text.lastIndexOf('}') + 1;
            const arrayStartIndex = text.indexOf('[');
            const arrayEndIndex = text.lastIndexOf(']') + 1;

            let cleanJson;
            if (kategori === 'memory' && arrayStartIndex !== -1) {
                cleanJson = text.substring(arrayStartIndex, arrayEndIndex);
            } else if (jsonStartIndex !== -1) {
                cleanJson = text.substring(jsonStartIndex, jsonEndIndex);
            } else {
                throw new Error("JSON tidak ditemukan");
            }

            const soalData = JSON.parse(cleanJson);
            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ AI Error:", error.message);
            // Fallback (Soal Cadangan)
            let fallback;
            if (kategori === 'math') fallback = { soal: "10 + 10 = ?", jawaban: 20 };
            if (kategori === 'kasir') fallback = { cerita: "Beli 500 bayar 1000", total_belanja: 500, uang_bayar: 1000, kembalian: 500 };
            if (kategori === 'labirin') fallback = { maze_size: 10, soal_list: [{tanya:"1+1?", jawab:"2"}] };
            if (kategori === 'piano') fallback = { sequence: [1,2,3,4] };
            if (kategori === 'zuma') fallback = { deskripsi: "Offline", palet_warna: ["#f00","#0f0","#00f","#ff0"], speed: "sedang" };
            if (kategori === 'memory') fallback = [{a:"A", b:"B"}, {a:"C", b:"D"}]; // Fix fallback memory
            
            if (fallback) socket.emit('soalDariAI', { kategori: kategori, data: fallback });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));