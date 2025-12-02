require('dotenv').config();

// Di paling atas server.js, setelah require('dotenv').config();
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, update } = require("firebase/database");

// Konfigurasi Firebase (Sekarang aman di server)
const firebaseConfig = {
    apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

// Inisialisasi Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

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

    // Di dalam io.on('connection', (socket) => { ... });
    socket.on('simpanSkor', (data) => {
        console.log(`💾 Menerima skor dari ${data.nama} untuk game ${data.game}: ${data.skor}`);

        const leaderboardRef = ref(database, 'leaderboard/' + data.nama);

        // Tentukan field yang akan diperbarui berdasarkan game
        const updateData = {
            nama: data.nama
        };
        if (data.game === 'memory') {
            updateData.skor_memory = data.skor;
            updateData.waktu_memory = new Date().toString();
        } 
        // Anda bisa menambahkan kondisi else if untuk game lain di sini
        // else if (data.game === 'math') { ... }

        update(leaderboardRef, updateData)
            .then(() => {
                console.log(`✅ Skor ${data.nama} berhasil disimpan.`);
            })
            .catch((error) => {
                console.error("❌ Gagal menyimpan skor:", error);
            });
    });

    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

   // --- VERSI YANG LEBIH TANGGUH DAN DENGAN LOGGING ---
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
            
            // --- Tambahkan logging untuk debugging ---
            console.log(`Respons mentah dari AI untuk kategori ${kategori}:`, text);
            
            // Bersihkan format jika AI memberi markdown ```json
            text = text.replace(/```json|```/g, '').trim();
            
            let soalData;
            try {
                soalData = JSON.parse(text);
            } catch (parseError) {
                console.error(`❌ Gagal mem-parse JSON untuk kategori ${kategori}. Error: ${parseError.message}`);
                console.error("Teks yang gagal di-parse:", text);
                // Kirim fallback jika parsing gagal
                soalData = null; // Set ke null untuk menandakan error
            }

            // Kirim balik ke Game
            if (soalData) {
                socket.emit('soalDariAI', { kategori: kategori, data: soalData });
            } else {
                // Kirim fallback jika soalData null
                console.log(`Mengirim soal cadangan untuk kategori ${kategori}`);
                let fallbackData;
                if (kategori === 'math') fallbackData = { soal: "Berapa 10 + 10?", jawaban: 20 };
                if (kategori === 'memory') fallbackData = [{a:"Soal 1", b:"Jawaban 1"}, {a:"Soal 2", b:"Jawaban 2"}, {a:"Soal 3", b:"Jawaban 3"}, {a:"Soal 4", b:"Jawaban 4"}, {a:"Soal 5", b:"Jawaban 5"}, {a:"Soal 6", b:"Jawaban 6"}];
                // ... tambahkan fallback untuk kategori lain
                
                socket.emit('soalDariAI', { kategori: kategori, data: fallbackData });
            }

        } catch (error) {
            console.error("❌ Error AI Umum:", error);
            // Fallback jika error umum (misal koneksi gagal)
            socket.emit('soalDariAI', { kategori: kategori, data: null }); // Kirim null untuk menandakan error total
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });

// ⬇️ INI ADALAH TANDA KURUNG YANG TADI HILANG. INI MENUTUP SELURUH BLOK 'io.on('connection')'.
}); 

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server AI Siap di Port ${PORT}`));