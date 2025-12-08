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
    ui.startScreen.classList.remove('active');
    ui.gameScreen.classList.add('active');
    ui.score.innerText = "0";
    score = 0;
    
    // Minta stok soal baru
    mintaSoalKeServer();
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
    
    const q = questions[currentIndex];
    const userAnswer = parseInt(ui.inputAnswer.value);
    const correctAnswer = q.kembalian; // Pastikan server kirim field ini, atau hitung manual: q.uang_bayar - q.total_belanja
    
    // Fallback hitung manual jika AI lupa kirim key 'kembalian'
    const realCorrect = (q.uang_bayar - q.total_belanja);

    if (!isTimeOut && userAnswer === realCorrect) {
        // BENAR
        ui.feedback.innerText = "LUNAS! TRANSAKSI BERHASIL.";
        ui.feedback.classList.add('correct');
        ui.screenText.innerText = "SUKSES";
        try { AudioManager.playCorrect(); } catch(e){}
        
        let point = 100 + Math.floor(timeLeft * 5);
        score += point;
        ui.score.innerText = score;
        
        // Lanjut Soal Berikutnya (Array)
        setTimeout(() => {
            currentIndex++;
            tampilkanSoal();
        }, 1500);
        
    } else {
        // SALAH
        ui.feedback.innerText = `SALAH! Harusnya: ${formatRupiah(realCorrect)}`;
        ui.feedback.classList.add('wrong');
        ui.screenText.innerText = "GAGAL";
        try { AudioManager.playWrong(); } catch(e){}
        
        // Game Over
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