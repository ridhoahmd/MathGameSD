const socket = io();
let currentData = null;
let score = 0;
let level = 'mudah';
const playerName = localStorage.getItem("playerName") || "Guest";

// Setup Level Buttons
document.querySelectorAll('.btn-level').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        level = btn.dataset.level;
        requestSoal(); // Reset soal saat ganti level
    });
});

// 1. Minta Soal ke Server
function requestSoal() {
    document.getElementById('story-display').innerText = "⏳ Sedang melayani pelanggan...";
    document.getElementById('input-change').value = "";
    document.getElementById('result-modal').style.display = "none";
    
    socket.emit('mintaSoalAI', { kategori: 'kasir', tingkat: level });
}

// 2. Terima Soal
socket.on('soalDariAI', (data) => {
    if (data.kategori === 'kasir') {
        currentData = data.data; // { cerita, kembalian, dll }
        
        // Efek ketik sederhana
        const screen = document.getElementById('story-display');
        screen.innerText = currentData.cerita;
        
        // Auto focus ke input
        document.getElementById('input-change').focus();
    }
});

// 3. Cek Jawaban
function checkAnswer() {
    if(!currentData) return;

    const userAns = parseInt(document.getElementById('input-change').value);
    const correctAns = parseInt(currentData.kembalian);
    const modal = document.getElementById('result-modal');
    const title = document.getElementById('res-title');
    const desc = document.getElementById('res-desc');

    modal.style.display = "flex";

    if (userAns === correctAns) {
        // BENAR
        score += 50; // Gaji lebih besar karena soal cerita
        title.innerText = "✅ TRANSAKSI SUKSES!";
        title.style.color = "#38ef7d";
        desc.innerText = `Kembalian tepat Rp ${correctAns}. Pelanggan senang!`;
        
        // Update Skor di Layar
        document.getElementById('score-display').innerText = "Gaji (Skor): " + score;
    } else {
        // SALAH
        title.innerText = "❌ SALAH HITUNG!";
        title.style.color = "#ff4757";
        desc.innerText = `Harusnya kembalian Rp ${correctAns}. Toko rugi!`;
    }
}

// 4. Lanjut Main
function nextCustomer() {
    requestSoal();
}

// 5. Selesai (Simpan Skor)
function endGame() {
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'kasir' // Kita pakai slot game baru
        // Note: Di server.js, pastikan ada logic untuk 'skor_kasir' atau satukan ke 'skor_math'
        // SEMENTARA: Kita masukkan ke skor_math saja agar tidak perlu ubah struktur DB banyak-banyak
    });
    alert("Toko Tutup! Gaji kamu telah disimpan.");
    window.location.href = "/";
}

// Tambahan Logika Simpan Khusus Kasir di Client (Opsional)
// Agar lebih rapi, di server.js sebaiknya tambahkan:
// if (data.game === 'kasir') fieldSkor = 'skor_math'; 
// (Jadi poin kasir dianggap poin matematika juga)

// Mulai game pertama kali
requestSoal();