// 1. CONFIG FIREBASE (Pakai Config Asli Anda)
const firebaseConfig = {
    apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    // 👇 URL Database ASLI Anda
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};
try { firebase.initializeApp(firebaseConfig); } catch(e) {}
const database = firebase.database();

// 2. VARIABEL GAME
let score = 0;
let timeLeft = 60;
let currentAnswer = 0;
let gameActive = true;
let timerInterval;

// 3. SISTEM SUARA (Web Audio API) - Tidak butuh download mp3!
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Nada (Frekuensi Hz) untuk angka 1, 2, 3... 0
const notes = {
    1: 261.63, // C4
    2: 293.66, // D4
    3: 329.63, // E4
    4: 349.23, // F4
    5: 392.00, // G4
    6: 440.00, // A4
    7: 493.88, // B4
    8: 523.25, // C5
    9: 587.33, // D5
    0: 220.00  // A3 (Rendah)
};

function playTone(num) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; // Jenis suara (bisa 'square', 'sawtooth', 'triangle')
    oscillator.frequency.setValueAtTime(notes[num], audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1);
}

// 4. LOGIKA GAME
function startGame() {
    generateQuestion();
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) gameOver();
    }, 1000);
}

function generateQuestion() {
    // Buat soal yang jawabannya cuma 1 digit (0-9)
    const num1 = Math.floor(Math.random() * 5);
    const num2 = Math.floor(Math.random() * 4);
    
    // 50% Kemungkinan Penjumlahan, 50% Pengurangan
    if (Math.random() > 0.5) {
        currentAnswer = num1 + num2;
        document.getElementById('question').innerText = `${num1} + ${num2} = ?`;
    } else {
        // Pastikan tidak minus
        const big = Math.max(num1, num2);
        const small = Math.min(num1, num2);
        currentAnswer = big - small;
        document.getElementById('question').innerText = `${big} - ${small} = ?`;
    }
}

function playNote(num) {
    if (!gameActive) return;
    
    playTone(num); // Bunyikan suara
    
    // Efek Visual Tekan
    const keys = document.querySelectorAll('.key');
    keys.forEach(k => {
        if(parseInt(k.dataset.val) === num) {
            k.classList.add('active');
            setTimeout(() => k.classList.remove('active'), 100);
        }
    });

    // Cek Jawaban
    if (num === currentAnswer) {
        score += 10;
        document.getElementById('score').innerText = score;
        generateQuestion();
    } else {
        // Salah - Layar berkedip merah
        document.body.style.backgroundColor = "#550000";
        setTimeout(() => document.body.style.backgroundColor = "#1e1e2e", 200);
    }
}

function gameOver() {
    gameActive = false;
    clearInterval(timerInterval);
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-modal').style.display = "flex";

    // Simpan ke Firebase
    const savedName = localStorage.getItem("playerName");
    if (savedName && database) {
        database.ref('leaderboard/' + savedName).update({
            nama: savedName,
            skor_piano: score, // Simpan sebagai skor_piano
            waktu_piano: new Date().toString()
        });
    }
}

// Jalankan Game
startGame();