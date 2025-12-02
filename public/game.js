// public/game.js - VERSI STANDALONE UNTUK MATH BATTLE
// Versi ini membuat soal sendiri, tidak meminta ke server.

const questionEl = document.getElementById('question-display');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over-screen');

let score = 0;
let gameActive = false;
let currentProblem = null;

// --- LOGIKA KESULITAN ---
let selectedDifficulty = 'mudah'; // Nilai default

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.btn-difficulty');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedDifficulty = button.dataset.level;
        });
    });
});

function startGame() {
    // Tampilkan layar game
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('block');
    
    gameActive = true;
    requestMintaSoal();
}

function requestMintaSoal() {
    // Buat soal secara lokal
    let a, b;
    if (selectedDifficulty === 'mudah') { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; }
    else if (selectedDifficulty === 'sedang') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1; }
    else if (selectedDifficulty === 'sulit') { a = Math.floor(Math.random() * 100) + 1; b = Math.floor(Math.random() * 100) + 1; }

    currentProblem = { text: `Berapa ${a} + ${b}?`, jawaban: a + b };
    questionEl.innerText = currentProblem.text;
}

function checkAnswer() {
    if (!gameActive || !currentProblem) return;
    
    const answerInput = document.getElementById('answer-input');
    const userAnswer = parseInt(answerInput.value, 10);

    if (userAnswer === currentProblem.jawaban) {
        score += 10;
        scoreEl.innerText = score;
        questionEl.innerText = "BENAR! 🎉";
        setTimeout(requestMintaSoal, 1500); // Minta soal berikutnya
    } else {
        questionEl.innerText = "SALAH! Coba lagi.";
    }
    answerInput.value = '';
    answerInput.focus();
}

// Event listener untuk input field agar bisa menjawab dengan "Enter"
document.getElementById('answer-input').addEventListener('keyup', function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        checkAnswer();
    }
});

function endGame() {
    gameActive = false;
    finalScoreEl.innerText = score;
    gameOverScreen.style.display = 'block';
    console.log(`Game selesai! Skor Akhir: ${score}`);
}