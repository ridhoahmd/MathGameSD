require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- PERBAIKAN 1: NAMA VARIABEL DISAMAKAN DENGAN RAILWAY ---
const apiKey = process.env.API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey);

// --- PERMINTAAN ANDA: MODEL TETAP GEMINI 2.0 FLASH ---
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    socket.on('joinRoom', (data) => { socket.join(data.room); });
    
    socket.on('laporSkor', (data) => {
        socket.to(data.room).emit('updateSkorLawan', data.skor);
    });

    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

    // --- PERBAIKAN 2: LOGIKA MULTI-GAME DIKEMBALIKAN ---
    // (Agar Memory Lab dan Tebak Kata tidak stuck)
    socket.on('mintaSoalAI', async (kategori) => {
        try {
            console.log(`🤖 Meminta soal kategori: ${kategori} dengan Gemini 2.0`);
            let prompt = "";

            if (kategori === 'math') {
                prompt = `Buatkan 1 soal matematika cerita pendek (maksimal 15 kata) untuk anak SD. Operasi hitungan dasar. Jawabannya harus angka bulat. Output WAJIB format JSON murni: { "soal": "teks soal", "jawaban": angka }. Jangan ada markdown.`;
            
            } else if (kategori === 'tebak') {
                prompt = `Berikan 1 kata benda umum (maks 8 huruf) untuk anak SD dan petunjuknya. Output JSON murni: { "kata": "KATA_ASLI", "petunjuk": "kalimat petunjuk" }`;
            
            } else if (kategori === 'memory') {
                prompt = `Buatkan 6 pasang kata/konsep pengetahuan umum untuk anak SD (Misal: Hewan & Suara, atau Negara & Ibukota). Output WAJIB JSON Array murni: [ {"a": "Item1", "b": "Pasangannya1"}, ... ] (Total 6 pasang).`;
            
            } else if (kategori === 'peta') {
                prompt = `Berikan 1 pertanyaan tentang Geografi Indonesia. Output JSON murni: { "soal": "pertanyaan", "jawaban": "jawaban_singkat" }`;
            }

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            // Bersihkan format jika AI memberi markdown ```json
            text = text.replace(/```json|```/g, '').trim();
            
            const soalData = JSON.parse(text);

            // Kirim balik ke Game
            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ Error AI:", error);
            // Fallback jika error / kuota habis
            if (kategori === 'math') socket.emit('soalDariAI', { kategori: 'math', data: { soal: "Berapa 10 + 10?", jawaban: 20 } });
            if (kategori === 'memory') socket.emit('soalDariAI', { kategori: 'memory', data: [{a:"A", b:"B"}, {a:"C", b:"D"}, {a:"E", b:"F"}, {a:"G", b:"H"}, {a:"I", b:"J"}, {a:"K", b:"L"}] });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server AI Siap di Port ${PORT}`));