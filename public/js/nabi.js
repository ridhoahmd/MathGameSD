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
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = btn.dataset.level;
    });
});

// 2. MULAI GAME
function startGame() {
    const btnStart = document.querySelector('.btn-start');
    btnStart.innerText = "⏳ Meminta Hikmah...";
    btnStart.disabled = true;

    // Minta soal ke Server (AI)
    socket.emit('mintaSoalAI', { kategori: 'nabi', tingkat: currentLevel });
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

// Catatan: Di server.js Tahap 1 tadi, kita belum menambahkan 'skor_nabi' di bagian socket.on('simpanSkor').
// Nanti di Langkah 4 (Integrasi), kita perlu update sedikit bagian simpanSkor di server.js agar skor ini tersimpan.