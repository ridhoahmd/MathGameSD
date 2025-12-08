const socket = io();

// DOM Elements
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

let currentLevel = 'mudah';
let questions = [];
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// Setup Buttons
document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = btn.dataset.level;

        document.getElementById('difficulty-display').innerText = btn.innerText;
    });
});

function startGame() {
    const btnStart = document.querySelector('.btn-start');
    btnStart.innerText = "⏳ Membuka Mushaf...";
    btnStart.disabled = true;

    // REQUEST KE SERVER (Kategori: ayat)
    socket.emit('mintaSoalAI', { kategori: 'ayat', tingkat: currentLevel });
}

socket.on('soalDariAI', (response) => {
    if (response.kategori === 'ayat') {
        questions = response.data;
        currentIndex = 0;
        score = 0;
        ui.score.innerText = "0";
        ui.qTotal.innerText = questions.length;
        
        screens.start.classList.remove('active');
        screens.game.classList.add('active');
        
        loadQuestion();
    }
});

function loadQuestion() {
    if (currentIndex >= questions.length) {
        endGame();
        return;
    }

    const q = questions[currentIndex];
    ui.questionText.innerText = q.tanya; 
    ui.qCurrent.innerText = currentIndex + 1;
    
    const pct = ((currentIndex) / questions.length) * 100;
    ui.progressFill.style.width = `${pct}%`;

    ui.optionsContainer.innerHTML = '';
    
    // Fungsi pembersih teks
    const clean = (str) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : "";

    // Tambahkan parameter 'index' di sini
    q.opsi.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.innerText = opt;
        
        // --- LOGIKA PENANDA RAHASIA (UPDATE FINAL) ---
        let isAnswer = false;

        // Cek 1: Apakah Kunci Jawaban di database cuma satu huruf (A/B/C/D)?
        // AI kadang malas dan cuma kirim "B" sebagai jawaban
        const key = clean(q.jawab);
        const optionsIndex = ["a", "b", "c", "d"];
        
        if (optionsIndex.includes(key)) {
            // Jika jawaban "A" -> Index 0 benar
            // Jika jawaban "B" -> Index 1 benar, dst.
            if (index === optionsIndex.indexOf(key)) isAnswer = true;
        } 
        // Cek 2: Jika bukan huruf, lakukan pencocokan teks (Smart Matching)
        else {
             isAnswer = clean(opt) === key || 
                        clean(opt).includes(key) || 
                        key.includes(clean(opt));
        }
                         
        if (isAnswer) {
            btn.dataset.correct = "true"; 
        }

        btn.onclick = () => checkAnswer(btn); 
        ui.optionsContainer.appendChild(btn);
    });

    startTimer(20);
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
            handleTimeOut();
        }
    }, 1000);
}

function handleTimeOut() {
    try { AudioManager.playWrong(); } catch(e){}
    const buttons = document.querySelectorAll('.btn-option');
    buttons.forEach(btn => btn.disabled = true);
    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 1000);
}

function checkAnswer(btnElement) {
    clearInterval(timerInterval);
    
    const allButtons = document.querySelectorAll('.btn-option');
    allButtons.forEach(b => b.disabled = true);

    // Cek apakah tombol yang diklik punya stempel 'correct'?
    const isCorrect = btnElement.dataset.correct === "true";

    if (isCorrect) {
        // --- JIKA JAWABAN BENAR ---
        btnElement.classList.add('correct');
        try { AudioManager.playCorrect(); } catch(e){}
        score += 20;
        score += Math.floor(timeLeft / 2);
        ui.score.innerText = score;
    } else {
        // --- JIKA JAWABAN SALAH ---
        btnElement.classList.add('wrong');
        try { AudioManager.playWrong(); } catch(e){}
        
        // --- SOLUSI PASTI MUNCUL ---
        // Cari tombol lain yang punya stempel 'correct'
        const correctBtn = document.querySelector('button[data-correct="true"]');
        if (correctBtn) {
            correctBtn.classList.add('correct'); // Warnai Hijau
        }
    }

    setTimeout(() => {
        currentIndex++;
        loadQuestion();
    }, 2500);
}

function endGame() {
    screens.game.classList.remove('active');
    screens.result.classList.add('active');
    ui.finalScore.innerText = score;
    
    if(score >= 80) ui.resultMsg.innerText = "Muntaz! Hafalanmu sangat kuat.";
    else if(score >= 50) ui.resultMsg.innerText = "Jayyid. Teruslah murojaah.";
    else ui.resultMsg.innerText = "Semangat! Ulangi lagi hafalannya.";

    try { AudioManager.playWin(); } catch(e){}

    // SIMPAN SKOR (Game: 'ayat')
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'ayat' 
    });
}