const socket = io();

const ui = {
    screenText: document.getElementById('screen-text'),
    storyText: document.getElementById('story-text'),
    displayTotal: document.getElementById('display-total'),
    displayPay: document.getElementById('display-pay'),
    inputAnswer: document.getElementById('input-answer'),
    feedback: document.getElementById('feedback-msg'),
    score: document.getElementById('score'),
    timer: document.getElementById('timer'),
    finalScore: document.getElementById('final-score'),
    startScreen: document.getElementById('start-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultScreen: document.getElementById('result-screen')
};

let currentLevel = 'mudah';
let questions = []; // Sekarang Array, bukan single object
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// Setup Tombol Level
document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = btn.dataset.level;
    });
});

function startGame() {
    const btn = document.querySelector('.btn-start'); // Pastikan class di HTML benar
    
    // 1. Tampilan Loading
    btn.innerText = "⏳ Menyiapkan Toko...";
    btn.disabled = true;
    
    // 2. Pancing Audio
    if (typeof AudioManager !== 'undefined') AudioManager.init();

    // 3. Reset Skor Internal
    score = 0;
    ui.score.innerText = "0";

    // 4. Request Server
    // Panggil fungsi request yang sudah ada, tapi kita modifikasi sedikit flow-nya
    socket.emit('mintaSoalAI', { kategori: 'kasir', tingkat: currentLevel });

    // 5. Safety Net
    setTimeout(() => {
        if (ui.startScreen.classList.contains('active')) {
            btn.innerText = "⚠️ Gagal Buka Toko. Ulangi?";
            btn.disabled = false;
        }
    }, 10000);
}

function mintaSoalKeServer() {
    ui.screenText.innerText = "RESTOCKING...";
    ui.storyText.innerText = "Mengambil data transaksi...";
    socket.emit('mintaSoalAI', { kategori: 'kasir', tingkat: currentLevel });
}

socket.on('soalDariAI', (response) => {
    if (response.kategori === 'kasir') {
        // Jika server mengirim array, pakai langsung. Jika object, bungkus jadi array.
        const data = response.data;
        if (Array.isArray(data)) {
            questions = data;
        } else {
            questions = [data];
        }
        
        currentIndex = 0;
        // 🔥 PINDAHKAN LOGIKA GANTI LAYAR KE SINI 🔥
        ui.startScreen.classList.remove('active');
        ui.gameScreen.classList.add('active');
        
        // Kembalikan tombol start ke kondisi semula (untuk main lagi nanti)
        const btn = document.querySelector('.btn-start');
        if(btn) { btn.innerText = "BUKA KASIR"; btn.disabled = false; }

        tampilkanSoal();
    }
});

function formatRupiah(angka) {
    return "Rp " + angka.toLocaleString('id-ID');
}

function tampilkanSoal() {
    // Cek apakah soal habis?
    if (currentIndex >= questions.length) {
        // Jika habis, minta lagi ke server (Endless Mode)
        mintaSoalKeServer(); 
        return;
    }

    const q = questions[currentIndex];
    
    ui.storyText.innerText = q.cerita;
    ui.displayTotal.innerText = formatRupiah(q.total_belanja);
    ui.displayPay.innerText = formatRupiah(q.uang_bayar);
    ui.screenText.innerText = "INPUT KEMBALIAN";
    
    ui.inputAnswer.value = "";
    ui.inputAnswer.focus();
    ui.feedback.innerText = "";
    ui.feedback.className = "feedback";
    
    startTimer(30); // 30 Detik per transaksi
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    ui.timer.innerText = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        ui.timer.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            checkAnswer(true); // Waktu Habis
        }
    }, 1000);
}

function handleEnter(e) {
    if (e.key === 'Enter') checkAnswer();
}

function checkAnswer(isTimeOut = false) {
    clearInterval(timerInterval);
    
    // 1. Ambil nilai mentah dari input box
    let rawValue = ui.inputAnswer.value;
    let userAnswer = Math.abs(Math.floor(parseFloat(rawValue))) || 0;
    
    const q = questions[currentIndex];

    const correctAnswer = (q.kembalian !== undefined) ? q.kembalian : (q.uang_bayar - q.total_belanja);
    
    // --- LOGIKA PENILAIAN ---
    if (!isTimeOut && userAnswer === correctAnswer) {
        // JIKA BENAR
        ui.feedback.innerText = "LUNAS! TRANSAKSI BERHASIL.";
        ui.feedback.classList.remove('wrong'); // Hapus class merah
        ui.feedback.classList.add('correct');  // Tambah class hijau
        ui.screenText.innerText = "SUKSES";
        
        try { AudioManager.playCorrect(); } catch(e){}
        
        // Poin: 100 dasar + Bonus kecepatan
        let point = 100 + Math.floor(timeLeft * 5);
        score += point;
        ui.score.innerText = score;
        
        // Lanjut Soal Berikutnya setelah jeda 1.5 detik
        setTimeout(() => {
            currentIndex++;
            tampilkanSoal();
        }, 1500);
        
    } else {
        // JIKA SALAH / WAKTU HABIS
        // Tampilkan jawaban yang seharusnya
        ui.feedback.innerText = `SALAH! Harusnya: ${formatRupiah(correctAnswer)}`;
        ui.feedback.classList.remove('correct');
        ui.feedback.classList.add('wrong');
        ui.screenText.innerText = "GAGAL";
        
        try { AudioManager.playWrong(); } catch(e){}
        
        // Game Over setelah 2.5 detik
        setTimeout(endGame, 2500);
    }
}

function endGame() {
    ui.gameScreen.classList.remove('active');
    ui.resultScreen.classList.add('active');
    ui.finalScore.innerText = formatRupiah(score);
    try { AudioManager.playWin(); } catch(e){}

    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'kasir' 
    });
}

// --- FITUR AUTO-RECONNECT (PASTE DI PALING BAWAH) ---

// 1. Fungsi Membuat Tampilan Layar Gelap (Overlay)
function createOfflineUI() {
    if (document.getElementById('connection-overlay')) return; 

    const overlay = document.createElement('div');
    overlay.id = 'connection-overlay';
    overlay.innerHTML = `
        <div class="wifi-icon">📡</div>
        <div class="conn-text">KONEKSI TERPUTUS</div>
        <div class="conn-sub">Sedang mencoba menghubungkan kembali...</div>
    `;
    document.body.appendChild(overlay);
}

createOfflineUI();

// 2. Logika Saat Koneksi Putus & Nyambung Lagi
let isReconnecting = false;

socket.on('disconnect', (reason) => {
    console.log("⚠️ Koneksi putus:", reason);
    isReconnecting = true;
    
    const overlay = document.getElementById('connection-overlay');
    if(overlay) overlay.style.display = 'flex';

    if (typeof gameActive !== 'undefined') gameActive = false; 
});

socket.on('connect', () => {
    if (isReconnecting) {
        console.log("✅ Terhubung kembali!");
        isReconnecting = false;

        const overlay = document.getElementById('connection-overlay');
        if(overlay) overlay.style.display = 'none';

        // Resume Game Math
        if (typeof gameActive !== 'undefined') {
            gameActive = true;
            // Math Battle tidak butuh requestAnimationFrame, cukup set gameActive true
        }
        
        // Khusus PvP: Mungkin perlu kirim ulang status 'ready' (opsional)
    }
});