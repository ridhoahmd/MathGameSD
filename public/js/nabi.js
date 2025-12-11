const socket = io();

// Element DOM
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const ui = {
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    qCurrent: document.getElementById('q-current'),
    qTotal: document.getElementById('q-total'),
    score: document.getElementById('score'),
    timer: document.getElementById('timer'),
    progressFill: document.getElementById('progress'),
    finalScore: document.getElementById('final-score'),
    resultMsg: document.getElementById('result-msg')
};

// Game State
let currentLevel = 'mudah';
let questions = [];
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// 1. SETUP KESULITAN
document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
        // Reset tampilan tombol lain
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        
        // Aktifkan tombol yang dipilih
        btn.classList.add('active');
        
        // Update logic data
        currentLevel = btn.dataset.level;
        
        // --- PERBAIKAN DI SINI (UPDATE UI) ---
        // Mengambil teks dari tombol (Mudah/Sedang/Sulit) dan menempelkannya ke pojok kanan
        document.getElementById('difficulty-display').innerText = btn.innerText;
    });
});

// 2. MULAI GAME
function startGame() {
    const btnStart = document.querySelector('.btn-start');
    
    // 1. Ubah tampilan tombol jadi Loading
    btnStart.innerText = "⏳ Meminta Hikmah...";
    btnStart.disabled = true; // Matikan tombol biar gak diklik dobel
    
    // 2. Pancing Audio agar browser mengizinkan suara nanti
    if (typeof AudioManager !== 'undefined') {
        AudioManager.init();
    }

    // 3. Kirim permintaan ke Server
    socket.emit('mintaSoalAI', { kategori: 'nabi', tingkat: currentLevel });

    // 🔥 4. SAFETY NET (Jaring Pengaman) 🔥
    // Jika dalam 10 detik (10000 ms) server tidak menjawab...
    setTimeout(() => {
        // Cek apakah kita masih di layar start (belum masuk game)?
        if (screens.start.classList.contains('active')) {
            // Reset tombol agar bisa diklik lagi
            btnStart.innerText = "⚠️ Gagal Koneksi. Coba Lagi?";
            btnStart.disabled = false;
            btnStart.style.background = "#e74c3c"; // Ubah warna jadi merah (opsional)
        }
    }, 10000);
}

// 3. TERIMA SOAL DARI SERVER
socket.on('soalDariAI', (response) => {
    if (response.kategori === 'nabi') {
        questions = response.data;
        
        // Reset State
        currentIndex = 0;
        score = 0;
        ui.score.innerText = "0";
        ui.qTotal.innerText = questions.length;
        
        // Pindah Layar
        screens.start.classList.remove('active');
        screens.game.classList.add('active');
        
        loadQuestion();
    }
});

// 4. TAMPILKAN PERTANYAAN
function loadQuestion() {
    if (currentIndex >= questions.length) {
        endGame();
        return;
    }

    const q = questions[currentIndex];
    ui.questionText.innerText = q.tanya;
    ui.qCurrent.innerText = currentIndex + 1;
    
    // Update Progress Bar
    const pct = ((currentIndex) / questions.length) * 100;
    ui.progressFill.style.width = `${pct}%`;

    // Render Pilihan Jawaban
    ui.optionsContainer.innerHTML = '';
    
    // Acak urutan jawaban (opsional, tapi bagus)
    // q.opsi.sort(() => Math.random() - 0.5); 

    q.opsi.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(opt, q.jawab, btn);
        ui.optionsContainer.appendChild(btn);
    });

    // Reset & Mulai Timer per soal (misal 20 detik)
    startTimer(20);
}

// 5. LOGIKA TIMER
function startTimer(seconds) {
    clearInterval(timerInterval);
    timeLeft = seconds;
    ui.timer.innerText = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        ui.timer.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeOut();
        }
    }, 1000);
}

function handleTimeOut() {
    try { AudioManager.playWrong(); } catch(e){}
    // Tunjukkan jawaban benar (otomatis lanjut)
    const buttons = document.querySelectorAll('.btn-option');
    buttons.forEach(btn => btn.disabled = true);
    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 1000);
}

// 6. CEK JAWABAN (DIPERBAIKI TOTAL - SMART MATCHING)
function checkAnswer(selectedRaw, correctRaw, btnElement) {
    clearInterval(timerInterval); // Stop waktu
    
    // 1. Normalisasi Teks:
    // - trim(): Hapus spasi depan/belakang
    // - toLowerCase(): Ubah jadi huruf kecil semua agar tidak masalah Kapital
    // - replace: Hapus spasi ganda jadi satu spasi
    const cleanStr = (str) => str.trim().toLowerCase().replace(/\s+/g, ' ');

    const selected = cleanStr(selectedRaw);
    const correct = cleanStr(correctRaw);

    const allButtons = document.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true); // Kunci tombol

    // 2. LOGIKA PENCOCOKAN BARU (Sangat Aman untuk Teks Panjang)
    // Cek apakah Sama Persis ATAU saling mengandung kata kunci
    const isCorrect = (selected === correct) || 
                      selected.includes(correct) || 
                      correct.includes(selected);

    if (isCorrect) {
        // --- JIKA JAWABAN BENAR ---
        btnElement.classList.add('correct');
        try { AudioManager.playCorrect(); } catch(e){}
        
        // Hitung Skor
        score += 20; // Poin dasar
        score += Math.floor(timeLeft / 2); // Bonus waktu
        ui.score.innerText = score;
    } else {
        // --- JIKA JAWABAN SALAH ---
        btnElement.classList.add('wrong');
        try { AudioManager.playWrong(); } catch(e){}
        
        // Cari jawaban yang benar untuk diberitahu ke siswa
        allButtons.forEach(b => {
            const btnText = cleanStr(b.innerText);
            // Gunakan logika pencocokan yang sama untuk mencari tombol benar
            if (btnText === correct || btnText.includes(correct) || correct.includes(btnText)) {
                b.classList.add('correct');
            }
        });
    }

    // Lanjut soal berikutnya
    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 2500);
}


// 7. GAME SELESAI
function endGame() {
    screens.game.classList.remove('active');
    screens.result.classList.add('active');
    
    ui.finalScore.innerText = score;
    
    // Pesan berdasarkan skor
    if(score >= 80) ui.resultMsg.innerText = "Masya Allah! Pengetahuanmu luar biasa!";
    else if(score >= 50) ui.resultMsg.innerText = "Alhamdulillah, teruslah belajar sejarah Nabi.";
    else ui.resultMsg.innerText = "Semangat! Ayo baca lagi kisah-kisah Nabi.";

    try { AudioManager.playWin(); } catch(e){}

    // Simpan ke Server (Database)
    // Kita simpan ke field 'skor_math' sementara atau minta server buat field baru 'skor_nabi'
    // Agar aman, kita pakai logika server yang ada (skor_math) atau tambah logika di server nanti.
    // Untuk V2.0 yang rapi, server harusnya punya 'skor_nabi'. 
    // Tapi supaya tidak error, kita kirim identifier game 'nabi'.
    
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'nabi' // Pastikan server.js nanti menangani ini (sudah kita siapkan belum?)
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