require('dotenv').config();

// --- INISIALISASI FIREBASE ---
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, update, get, child } = require("firebase/database");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84", // Gunakan ENV jika ada
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

    // --- CHAT ---
    socket.on('chatMessage', (data) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        io.emit('chatMessage', { nama: data.nama, pesan: data.pesan, waktu: timeString });
    });

    // --- SIMPAN SKOR (AKUMULASI) ---
    socket.on('simpanSkor', async (data) => {
        console.log(`💾 Request simpan dari ${data.nama}: +${data.skor} poin di game ${data.game}`);
        try {
            const userRef = ref(database, 'leaderboard/' + data.nama);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            
            let fieldSkor = '';
            if (data.game === 'math' || data.game === 'kasir') fieldSkor = 'skor_math';
            else if (data.game === 'zuma') fieldSkor = 'skor_zuma';
            else if (data.game === 'memory') fieldSkor = 'skor_memory';
            else if (data.game === 'piano') fieldSkor = 'skor_piano';

            if (!fieldSkor) return; // Cegah error jika game tidak dikenal

            const skorLama = userData[fieldSkor] || 0;
            const totalBaru = skorLama + parseInt(data.skor);

            const updateData = {
                nama: data.nama,
                [fieldSkor]: totalBaru
            };
            
            if (data.game === 'math' || data.game === 'kasir') updateData.waktu_math = new Date().toString();
            if (data.game === 'zuma') updateData.waktu_zuma = new Date().toString();
            if (data.game === 'memory') updateData.waktu_memory = new Date().toString();

            await update(userRef, updateData);
            console.log(`✅ Sukses! Total Baru: ${totalBaru}`);

        } catch (error) {
            console.error("❌ Gagal menyimpan skor:", error);
        }
    });

    // --- MINTA SOAL AI (MATH, MEMORY, ZUMA, KASIR) ---
    socket.on('mintaSoalAI', async (requestData) => {
        const kategori = requestData.kategori;
        const tingkat = requestData.tingkat || 'sedang';

        try {
            console.log(`🤖 AI Request: ${kategori} (${tingkat})`);
            let prompt = "";

            if (kategori === 'math') {
                let rangeOperasi = '', rangeAngka = '';
                if (tingkat === 'mudah') { rangeOperasi = 'penjumlahan/pengurangan'; rangeAngka = '1-10'; }
                else if (tingkat === 'sedang') { rangeOperasi = 'penjumlahan/pengurangan/perkalian'; rangeAngka = '1-50'; }
                else if (tingkat === 'sulit') { rangeOperasi = 'semua operasi campuran'; rangeAngka = '1-100'; }
                prompt = `Buatkan 1 soal matematika cerita pendek (maks 15 kata) untuk anak SD. Operasi: ${rangeOperasi}. Angka: ${rangeAngka}. Jawaban bulat. Output JSON: { "soal": "...", "jawaban": 0 }.`;
            
            } else if (kategori === 'memory') {
                let num = (tingkat === 'mudah') ? 4 : (tingkat === 'sedang' ? 6 : 8);
                prompt = `Buatkan ${num} pasang kata pengetahuan umum SD (Ibukota, Hewan, dll). Output JSON Array: [ {"a": "...", "b": "..."} ].`;
            
            } else if (kategori === 'zuma') {
                let speed = (tingkat === 'mudah') ? 'lambat' : (tingkat === 'sedang' ? 'sedang' : 'cepat');
                prompt = `Buat level game Zuma speed '${speed}'. Output JSON: { "deskripsi": "...", "palet_warna": ["#hex", "#hex", "#hex", "#hex"], "speed": "${speed}" }.`;
            
            } else if (kategori === 'kasir') {
                // 1. Tentukan Tingkat Kesulitan
                let rangeHarga = 'ratusan (100-900)';
                let itemMax = 2;
                if (tingkat === 'sedang') { rangeHarga = 'ribuan (1000-10000)'; itemMax = 3; }
                if (tingkat === 'sulit') { rangeHarga = 'puluhan ribu (10000-100000)'; itemMax = 4; }

                // 2. BUMBU RAHASIA: Acak Tema Toko & Situasi (Supaya Tidak Monoton)
                const temaList = [
                    "Warung Jajan SD (Permen, Coklat)", 
                    "Toko Mainan (Robot, Boneka)", 
                    "Toko Buah Segar (Apel, Jeruk)", 
                    "Kantin Sekolah (Bakso, Es Teh)",
                    "Toko Alat Tulis (Pensil, Buku Gambar)",
                    "Pasar Ikan (Lele, Mas)",
                    "Minimarket (Roti, Susu Kotak)"
                ];
                const namaUnik = ["Si Unyil", "Upin", "Jarjit", "Doraemon", "Spongebob", "Kak Ros", "Pak Oleh"];
                
                const randomTema = temaList[Math.floor(Math.random() * temaList.length)];
                const randomNama = namaUnik[Math.floor(Math.random() * namaUnik.length)];

                // 3. Prompt yang Lebih Detail & Kaya
                prompt = `Bertindaklah sebagai pembuat soal matematika yang seru.
                Buat 1 soal cerita pendek tentang transaksi di: ${randomTema}.
                Pelanggan bernama: ${randomNama}.
                Barang yang dibeli: ${itemMax} jenis barang aneh/unik.
                Range harga per barang: ${rangeHarga} Rupiah.
                Uang pembayaran: Harus pecahan uang kertas Indonesia (2000, 5000, 10000, 20000, 50000, 100000).
                
                PENTING: Pastikan Uang Bayar > Total Harga.
                Output WAJIB JSON murni: 
                { 
                  "cerita": "Narasi cerita yang menarik...", 
                  "total_belanja": 0,
                  "uang_bayar": 0,
                  "kembalian": 0 
                }`;
            }
            
            // 🛡️ PENGAMAN: Jika prompt kosong, jangan panggil AI
            if (!prompt) {
                console.log("⚠️ Kategori tidak dikenal, skip AI.");
                return; 
            }

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().replace(/```json|```/g, '').trim(); // Bersihkan markdown
            
            // Validasi JSON
            let soalData;
            try {
                soalData = JSON.parse(text);
            } catch (jsonError) {
                console.error("⚠️ AI Output bukan JSON valid, pakai fallback.");
                throw new Error("Invalid JSON"); // Lempar ke catch bawah untuk fallback
            }

            socket.emit('soalDariAI', { kategori: kategori, data: soalData });

        } catch (error) {
            console.error("❌ Error AI/Fallback:", error.message);
            
            // FALLBACK (SOAL CADANGAN JIKA ERROR/OFFLINE)
            let fallbackData;
            if (kategori === 'math') fallbackData = { soal: "10 + 10 = ?", jawaban: 20 };
            else if (kategori === 'memory') fallbackData = [{a:"A", b:"B"}, {a:"C", b:"D"}, {a:"E", b:"F"}, {a:"G", b:"H"}];
            else if (kategori === 'zuma') fallbackData = { deskripsi: "Mode Offline", palet_warna: ["#f00", "#0f0", "#00f", "#ff0"], speed: "sedang" };
            else if (kategori === 'kasir') fallbackData = { cerita: "Beli permen Rp 500, bayar Rp 1000.", total_belanja: 500, uang_bayar: 1000, kembalian: 500 };
            
            socket.emit('soalDariAI', { kategori: kategori, data: fallbackData });
        }
    });

    socket.on('disconnect', () => { console.log('❌ User Left'); });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server Siap di Port ${PORT}`));