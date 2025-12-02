require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Konfigurasi AI (YANG SUDAH DIPERBAIKI)
const apiKey = process.env.API_KEY; // Mengambil dari file .env
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(express.static('public'));

// ... sisanya tidak berubah
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

    // --- FITUR AI MULTI-GAME (LENGKAP) ---
    socket.on('mintaSoalAI', async (kategori) => {
        try {
            console.log(`🤖 Meminta soal kategori: ${kategori}`);
            let prompt = "";

            if (kategori === 'math') {
                prompt = `Buatkan 1 soal matematika cerita pendek SD. Output JSON: { "soal": "teks soal", "jawaban": angka_bulat }`;
            } else if (kategori === 'tebak') {
                prompt = `Berikan 1 kata benda umum (maks 8 huruf) untuk anak SD dan petunjuknya. Output JSON: { "kata": "KATA_ASLI", "petunjuk": "kalimat petunjuk" }`;
            } else if (kategori === 'peta') {
                prompt = `Berikan 1 pertanyaan tentang Geografi Indonesia. Output JSON: { "soal": "pertanyaan", "jawaban": "jawaban_singkat" }`;
            
            // 👇 INI YANG KEMARIN HILANG 👇
            } else if (kategori === 'memory') {
                prompt = `Buatkan 6 pasang kata/konsep pengetahuan umum untuk anak SD (Misal: Hewan & Suara, Negara & Ibukota). 
                Output WAJIB JSON Array: [ {"a": "Item1", "b": "Pasangannya1"}, ... ] (Total 6 pasang). Jangan ada markdown.`;
            }
            // 👆 ----------------------- 👆

            const result = await model.generateContent(prompt + " Output JSON only, no markdown.");
            const response = await result.response;
            let text = response.text().replace(/```json|```/g, '').trim();
            const dataAI = JSON.parse(text);

            // Kirim balik
            socket.emit('soalDariAI', { kategori: kategori, data: dataAI });

        } catch (error) {
            console.error("❌ Error AI:", error);
            // Fallback (Cadangan jika error)
            if (kategori === 'math') socket.emit('soalDariAI', { kategori: 'math', data: { soal: "10 + 10?", jawaban: 20 } });
            
            // Fallback Memory
            if (kategori === 'memory') {
                socket.emit('soalDariAI', { kategori: 'memory', data: [
                    {a: "1+1", b: "2"}, {a: "Merah", b: "Red"}, {a: "Kucing", b: "Meong"},
                    {a: "Pagi", b: "Morning"}, {a: "Gula", b: "Manis"}, {a: "Api", b: "Panas"}
                ]});
            }
        }
    });