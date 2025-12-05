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

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
        temperature: 0.85, 
        topP: 0.95,
        topK: 40,
    }
});

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

    // --- MINTA SOAL AI ---
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat } = requestData;
        const level = tingkat || 'sedang';

        try {
            console.log(`🤖 AI Request: ${kategori} (${level})`);
            let prompt = "";
            const temaAcak = getRandomTheme();
            const objekAcak = getRandomObject();

            if (kategori === 'math') {
                let range = level === 'mudah' ? '1-20' : (level === 'sedang' ? '10-100' : '50-500');
                prompt = `Bertindak sebagai guru matematika. Buat 1 soal matematika SD.
                Tingkat: ${level}. Range: ${range}. Tema: ${temaAcak}.
                JANGAN GUNAKAN pola "A punya X apel". Gunakan variasi kreatif.
                Output JSON: {"soal": "...", "jawaban": 0}. JANGAN ADA KOMENTAR.`;
            
            } else if (kategori === 'memory') {
                let num = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                const kategoriMemory = ["Ibukota Negara", "Nama Hewan Inggris", "Rumus Bangun Datar", "Antonim Kata", "Sinonim Kata", "Nama Planet"];
                const katPilihan = kategoriMemory[Math.floor(Math.random() * kategoriMemory.length)];
                prompt = `Buat ${num} pasang kartu memori SD. Kategori: ${katPilihan}. Output JSON Array: [{"a":"...","b":"..."}]. NO COMMENTS.`;
            
            } else if (kategori === 'zuma') {
                let spd = level === 'mudah' ? 'lambat' : (level === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level game Zuma unik tema visual: ${temaAcak}.
                Speed: ${spd}.
                Output JSON: {"deskripsi":"Misi di ${temaAcak}...", "palet_warna":["#hex","#hex","#hex","#hex"], "speed":"${spd}"}.
                PENTING: JANGAN tulis komentar // di samping kode warna. JSON Murni Saja.`;
            
            } else if (kategori === 'kasir') {
                let rng = level === 'mudah' ? 'ratusan' : (level === 'sedang' ? 'ribuan' : 'puluhan ribu');
                prompt = `Buat skenario belanja unik di "Toko ${objekAcak}".
                Barang aneh/lucu. Range: ${rng}.
                Output JSON: {"cerita":"...", "total_belanja":0, "uang_bayar":0, "kembalian":0}. NO COMMENTS.`;
            
            } else if (kategori === 'labirin') {
                let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                let numQ = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 8);
                prompt = `Buat konfigurasi labirin. Grid: ${size}x${size}.
                Buat ${numQ} soal sains SD singkat (jawaban 1 kata).
                Output JSON: {"maze_size": ${size}, "soal_list": [{"tanya":"...","jawab":"..."}]}. NO COMMENTS.`;
            
            } else if (kategori === 'piano') {
                let len = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                prompt = `Buat urutan nada piano acak ${len} digit (1-9).
                Output JSON: { "sequence": [1, 3, 5] }. NO COMMENTS.`;
            }

            if (!prompt) return;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // --- CLEANING JSON TINGKAT LANJUT (ANTI-KOMENTAR) ---
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

            // 🔥 HAPUS KOMENTAR JS (// ...) DARI JSON 🔥
            cleanJson = cleanJson.replace(/\/\/.*$/gm, ''); 

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
            if (kategori === 'zuma') fallback = { deskripsi: "Offline Mode", palet_warna: ["#f00","#0f0","#00f","#ff0"], speed: "sedang" };
            if (kategori === 'memory') fallback = [{a:"A", b:"B"}, {a:"C", b:"D"}];
            
            if (fallback) socket.emit('soalDariAI', { kategori: kategori, data: fallback });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));