require('dotenv').config();

// --- INISIALISASI FIREBASE (AMAN DI SERVER) ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, update, get, child } = require("firebase/database");

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
// --- AKHIR INISIALISASI FIREBASE ---


const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- INISIALISASI GEMINI AI ---
const apiKey = process.env.API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey);
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

    // --- LISTENER UNTUK MENYIMPAN SKOR (VERSI AKUMULASI) ---
    socket.on('simpanSkor', async (data) => {
        console.log(`💾 Request simpan dari ${data.nama}: +${data.skor} poin di game ${data.game}`);
        
        try {
            const userRef = ref(database, 'leaderboard/' + data.nama);
            
            // 1. Ambil data lama dulu dari database
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            // 2. Tentukan nama kolom skor berdasarkan game
            let fieldSkor = '';
            if (data.game === 'math') fieldSkor = 'skor_math';
            else if (data.game === 'zuma') fieldSkor = 'skor_zuma';
            else if (data.game === 'memory') fieldSkor = 'skor_memory';
            else if (data.game === 'piano') fieldSkor = 'skor_piano';

            // 3. Hitung Total Baru (Skor Lama + Skor Baru)
            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + parseInt(data.skor);

            // 4. Update data waktu
            const updateData = {
                nama: data.nama, // Pastikan nama tetap ada
                [fieldSkor]: totalBaru
            };
            
            // Update waktu main terakhir
            if (data.game === 'math') updateData.waktu_math = new Date().toString();
            if (data.game === 'zuma') updateData.waktu_zuma = new Date().toString();
            if (data.game === 'memory') updateData.waktu_memory = new Date().toString();

            // 5. Simpan ke Firebase
            await update(userRef, updateData);
            
            console.log(`✅ Sukses! ${data.nama} (Lama: ${skorLama} + Baru: ${data.skor} = Total: ${totalBaru})`);

        } catch (error) {
            console.error("❌ Gagal menyimpan skor:", error);
        }
    });

    // --- LOGIKA UTAMA: MENERIMA REQUEST DARI KLIEN ---
    socket.on('mintaSoalAI', async (requestData) => {
        const kategori = requestData.kategori;
        const tingkat = requestData.tingkat || 'sedang'; // Default ke 'sedang'

        try {
            console.log(`🤖 Meminta soal kategori: ${kategori}, tingkat: ${tingkat}`);
            let prompt = "";

            if (kategori === 'math') {
                let rangeOperasi = '', rangeAngka = '';
                if (tingkat === 'mudah') { rangeOperasi = 'penjumlahan/pengurangan'; rangeAngka = '1-10'; }
                else if (tingkat === 'sedang') { rangeOperasi = 'penjumlahan/pengurangan/perkalian'; rangeAngka = '1-50'; }
                else if (tingkat === 'sulit') { rangeOperasi = 'semua operasi (tambah, kurang, kali, bagi)'; rangeAngka = '1-100'; }
                prompt = `Buatkan 1 soal matematika cerita pendek (maks 15 kata) untuk anak SD. Operasi: ${rangeOperasi}. Angka dalam rentang ${rangeAngka}. Jawaban harus angka bulat. Output JSON: { "soal": "...", "jawaban": 0 }.`;
            
            } else if (kategori === 'memory') {
                let jumlahPasang = 4;
                if (tingkat === 'mudah') jumlahPasang = 4;
                else if (tingkat === 'sedang') jumlahPasang = 6;
                else if (tingkat === 'sulit') jumlahPasang = 8;
                prompt = `Buatkan ${jumlahPasang} pasang kata/konsep pengetahuan umum untuk anak SD. Output JSON Array: [ {"a": "Item1", "b": "Pasangannya1"}, ... ] (Total ${jumlahPasang} pasang).`;
            
            } else if (kategori === 'zuma') {
                let speed = 'sedang';
                if (tingkat === 'mudah') speed = 'lambat';
                else if (tingkat === 'sedang') speed = 'sedang';
                else if (tingkat === 'sulit') speed = 'cepat';
                prompt = `Buatkan data level game Zuma dengan kecepatan '${speed}'. Buat deskripsi singkat (maks 15 kata). Berikan 4 kode warna hex. Output JSON: { "deskripsi": "...", "palet_warna": ["#...", "#...", "#...", "#..."], "speed": "${speed}" }.`;
            }
            // ... tambahkan kategori lainnya di sini

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            text = text.replace(/```json|```/g, '').trim();
            const soalData = JSON.parse(text);

            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ Error AI:", error);
            
            // Kirim soal cadangan jika AI error
            let fallbackData;
            if (kategori === 'math') fallbackData = { soal: "Berapa 10 + 10?", jawaban: 20 };
            if (kategori === 'memory') fallbackData = [{a:"Soal 1", b:"Jawaban 1"}, {a:"Soal 2", b:"Jawaban 2"}, {a:"Soal 3", b:"Jawaban 3"}, {a:"Soal 4", b:"Jawaban 4"}];
            if (kategori === 'zuma') fallbackData = { deskripsi: "Level cadangan!", palet_warna: ["#f00", "#0f0", "#00f", "#ff0"], speed: "sedang" };
            
            socket.emit('soalDariAI', { kategori: kategori, data: fallbackData });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });

}); // <-- Kurung kurawal penutup untuk io.on('connection')

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server AI Penuh Siap di Port ${PORT}`));