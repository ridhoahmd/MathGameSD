require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Konfigurasi AI
// KUNCI BARU
const genAI = new GoogleGenerativeAI("AIzaSyDyNYxWRhieDnRKuZvEvY3Pjg36UiHhbRQ");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    // --- FITUR STANDAR ---
    socket.on('joinRoom', (data) => { socket.join(data.room); });
    
    socket.on('laporSkor', (data) => {
        socket.to(data.room).emit('updateSkorLawan', data.skor);
    });

    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

    // --- FITUR AI (GEMINI) ---
    socket.on('mintaSoalAI', async () => {
        try {
            console.log("🤖 Sedang meminta soal ke Gemini...");
            
            // Instruksi ke AI
            const prompt = `Buatkan 1 soal matematika cerita pendek (maksimal 15 kata) untuk anak SD. 
            Operasi hitungan dasar (tambah/kurang/kali).
            Jawabannya harus angka bulat.
            Output WAJIB format JSON murni: { "soal": "teks soal", "jawaban": angka }
            Jangan ada markdown.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            // Bersihkan teks agar jadi JSON murni
            text = text.replace(/```json|```/g, '').trim();
            const soalData = JSON.parse(text);

            // Kirim ke Game
            socket.emit('soalDariAI', soalData);

        } catch (error) {
            console.error("❌ Error AI:", error);
            // Soal Cadangan jika AI error
            socket.emit('soalDariAI', { soal: "Berapa 10 + 10?", jawaban: 20 });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server AI Siap di Port ${PORT}`));