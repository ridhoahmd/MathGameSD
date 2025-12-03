// public/piano.js - VERSI ONLINE (SOCKET EMIT)

// 1. KONEKSI KE SERVER (PENTING!)
const socket = io(); 

// Kita tidak butuh config firebase di sini lagi, karena server yang urus database.

// 2. VARIABEL GAME
let score = 0;
let timeLeft = 60;
let currentAnswer = 0;
let gameActive = true;
let timerInterval;
const playerName = localStorage.getItem("playerName") || "Guest";

// 3. SISTEM SUARA (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const notes = {
    1: 261.63, 2: 293.66, 3: 329.63, 4: 349.23, 5: 392.00, 
    6: 440.00, 7: 493.88, 8: 523.25, 9: 587.33, 0: 220.00
};

function playTone(num) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine'; 
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
    const num1 = Math.floor(Math.random() * 5);
    const num2 = Math.floor(Math.random() * 4);
    
    if (Math.random() > 0.5) {
        currentAnswer = num1 + num2;
        document.getElementById('question').innerText = `${num1} + ${num2} = ?`;
    } else {
        const big = Math.max(num1, num2);
        const small = Math.min(num1, num2);
        currentAnswer = big - small;
        document.getElementById('question').innerText = `${big} - ${small} = ?`;
    }
}

function playNote(num) {
    if (!gameActive) return;
    
    playTone(num); 
    
    const keys = document.querySelectorAll('.key');
    keys.forEach(k => {
        if(parseInt(k.dataset.val) === num) {
            k.classList.add('active');
            setTimeout(() => k.classList.remove('active'), 100);
        }
    });

    if (num === currentAnswer) {
        score += 10;
        document.getElementById('score').innerText = score;
        generateQuestion();
    } else {
        document.body.style.backgroundColor = "#550000";
        setTimeout(() => document.body.style.backgroundColor = "#1e1e2e", 200);
    }
}

function gameOver() {
    gameActive = false;
    clearInterval(timerInterval);
    
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-modal').style.display = "flex";

    console.log(`🎹 Mengirim skor Piano ke Server: ${score}`);

    // --- PERUBAHAN UTAMA DI SINI ---
    // Dulu: database.ref(...).update(...)
    // Sekarang: Lapor ke server biar dijumlahkan
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'piano'
    });
}

// Jalankan Game
startGame();