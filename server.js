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

// --- GEMINI AI ---
const apiKey = process.env.API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(express.static('public'));

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
                const prompt = `Buat 10 soal matematika SD tingkat ${tingkat}. JSON Array: [{"q":"1+1","a":2}]. No markdown.`;
                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json|```/g, '').trim();
                const paketSoal = JSON.parse(text);
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

    // --- MINTA SOAL AI (BAGIAN UTAMA YANG DIPERBAIKI) ---
    socket.on('mintaSoalAI', async (requestData) => {
        const { kategori, tingkat } = requestData;
        const level = tingkat || 'sedang';

        try {
            console.log(`🤖 AI Request: ${kategori} (${level})`);
            let prompt = "";

            // 1. Tentukan Prompt berdasarkan Game
            if (kategori === 'math') {
                let op = level === 'mudah' ? 'tambah/kurang' : (level === 'sedang' ? 'kali/bagi' : 'campuran');
                let ang = level === 'mudah' ? '1-10' : (level === 'sedang' ? '1-50' : '1-100');
                prompt = `Buat 1 soal matematika cerita SD pendek. Operasi: ${op}. Angka: ${ang}. Output JSON: {"soal": "...", "jawaban": 0}.`;
            
            } else if (kategori === 'memory') {
                let num = level === 'mudah' ? 4 : (level === 'sedang' ? 6 : 8);
                prompt = `Buat ${num} pasang kata pengetahuan umum SD. Output JSON Array: [{"a":"...","b":"..."}].`;
            
            } else if (kategori === 'zuma') {
                let spd = level === 'mudah' ? 'lambat' : (level === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level zuma speed '${spd}'. Output JSON: {"deskripsi":"...","palet_warna":["#hex","#hex","#hex","#hex"],"speed":"${spd}"}.`;
            
            } else if (kategori === 'kasir') {
                let rng = level === 'mudah' ? 'ratusan' : (level === 'sedang' ? 'ribuan' : 'puluhan ribu');
                prompt = `Buat soal belanja SD. Range: ${rng}. Bayar pakai uang rupiah wajar. Output JSON: {"cerita":"...","total_belanja":0,"uang_bayar":0,"kembalian":0}.`;
            
            } else if (kategori === 'labirin') {
                let size = level === 'mudah' ? 10 : (level === 'sedang' ? 15 : 20);
                let numQ = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 8);
                prompt = `Buat ${numQ} soal sains SD singkat (jawaban 1 kata). Output JSON: {"maze_size": ${size}, "soal_list": [{"tanya":"...","jawab":"..."}]}.`;
            
            } else if (kategori === 'piano') {
                let len = level === 'mudah' ? 3 : (level === 'sedang' ? 5 : 7);
                prompt = `Buat urutan ${len} angka acak (1-9). Output JSON: { "sequence": [1, 3, 5] }.`;
            }

            if (!prompt) return;

            // 2. Panggil AI
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log("📝 Raw AI:", text); // Debugging

            // 3. ✅ TEKNIK PEMBERSIHAN JSON LEBIH KUAT (IMPLEMENTASI KODE BARU DI SINI) ✅
            const jsonStartIndex = text.indexOf('{');
            const jsonEndIndex = text.lastIndexOf('}') + 1;
            
            // Khusus untuk Memory (karena dia Array [...], bukan Object {...})
            const arrayStartIndex = text.indexOf('[');
            const arrayEndIndex = text.lastIndexOf(']') + 1;

            let cleanJson;
            // Cek apakah outputnya Array (Memory) atau Object (Game lain)
            if (kategori === 'memory' && arrayStartIndex !== -1) {
                cleanJson = text.substring(arrayStartIndex, arrayEndIndex);
            } else if (jsonStartIndex !== -1) {
                cleanJson = text.substring(jsonStartIndex, jsonEndIndex);
            } else {
                throw new Error("JSON tidak ditemukan");
            }

            // 4. Parse JSON
            const soalData = JSON.parse(cleanJson);
            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ AI Error:", error.message);
            
            // FALLBACK (SOAL CADANGAN)
            let fallback;
            if (kategori === 'math') fallback = { soal: "1+1=?", jawaban: 2 };
            if (kategori === 'kasir') fallback = { cerita: "Beli 500 bayar 1000", total_belanja: 500, uang_bayar: 1000, kembalian: 500 };
            if (kategori === 'labirin') fallback = { maze_size: 10, soal_list: [{tanya:"1+1?", jawab:"2"}] };
            if (kategori === 'piano') fallback = { sequence: [1,2,3] };
            if (kategori === 'zuma') fallback = { deskripsi: "Offline", palet_warna: ["#f00","#0f0","#00f","#ff0"], speed: "sedang" };
            
            if (fallback) socket.emit('soalDariAI', { kategori: kategori, data: fallback });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));