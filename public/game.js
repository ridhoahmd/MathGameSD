// public/game.js - VERSI ONLINE (TERHUBUNG KE SERVER & AI)

// 1. Inisialisasi Socket.io
const socket = io(); 

const questionEl = document.getElementById('question-display');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over-screen');

let score = 0;
let gameActive = false;
let currentProblem = null;

// Ambil nama pemain dari LocalStorage (yang disimpan saat Login Google)
let playerName = localStorage.getItem("playerName") || "Guest";

// --- LOGIKA KESULITAN ---
let selectedDifficulty = 'mudah'; // Nilai default

document.addEventListener('DOMContentLoaded', () => {
    // Isi nama di input readonly jika ada
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.value = playerName;

    // Logika tombol kesulitan
    const buttons = document.querySelectorAll('.btn-difficulty');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedDifficulty = button.dataset.level;
        });
    });
});

// --- FUNGSI MULAI GAME ---
function startGame() {
    // Tampilkan layar game
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('block');
    
    score = 0;
    scoreEl.innerText = score;
    gameActive = true;
    
    // Minta soal pertama ke Server/AI
    requestMintaSoal();
}

// --- MEMINTA SOAL KE SERVER (AI) ---
function requestMintaSoal() {
    if (!gameActive) return;

    questionEl.innerText = "🤖 Sedang memuat soal...";
    
    // Emit event ke server.js
    // Server akan memproses via Gemini AI berdasarkan tingkat kesulitan
    socket.emit('mintaSoalAI', { 
        kategori: 'math', 
        tingkat: selectedDifficulty 
    });
}

// --- MENERIMA SOAL DARI SERVER ---
socket.on('soalDariAI', (data) => {
    // Pastikan data yang diterima adalah untuk kategori math
    if (data.kategori === 'math') {
        // Data format: { soal: "...", jawaban: angka }
        currentProblem = { 
            text: data.data.soal, 
            jawaban: parseInt(data.data.jawaban) 
        };
        
        // Tampilkan soal di layar
        questionEl.innerText = currentProblem.text;
        
        // Kosongkan input & fokus
        const answerInput = document.getElementById('answer-input');
        answerInput.value = '';
        answerInput.focus();
    }
});

// --- CEK JAWABAN ---
function checkAnswer() {
    if (!gameActive || !currentProblem) return;
    
    const answerInput = document.getElementById('answer-input');
    const userAnswer = parseInt(answerInput.value, 10);

    if (userAnswer === currentProblem.jawaban) {
        // Jika Benar
        score += 10;
        scoreEl.innerText = score;
        
        // Efek visual sederhana
        questionEl.innerText = "✅ BENAR!";
        questionEl.style.color = "#38ef7d";
        
        // Delay sebentar sebelum minta soal baru
        setTimeout(() => {
            questionEl.style.color = "#fff";
            requestMintaSoal(); 
        }, 1000);

    } else {
        // Jika Salah
        questionEl.innerText = "❌ SALAH! Coba lagi.";
        questionEl.style.color = "#ff4757";
        setTimeout(() => {
            questionEl.style.color = "#fff";
            questionEl.innerText = currentProblem.text; // Kembalikan teks soal
        }, 1000);
    }
    
    answerInput.value = '';
    answerInput.focus();
}

// Event listener enter key
document.getElementById('answer-input').addEventListener('keyup', function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        checkAnswer();
    }
});

// --- GAME SELESAI & SIMPAN SKOR ---
function downloadSertifikat() {
    // Kita gunakan fungsi ini sebagai tombol "Selesai" (End Game)
    gameActive = false;
    finalScoreEl.innerText = score;
    gameOverScreen.style.display = 'block'; // Tampilkan layar game over (di Math Battle mungkin perlu penyesuaian CSS jika belum ada ID ini, tapi logic utamanya adalah simpan skor)

    console.log(`📡 Mengirim skor ke server: ${score}`);

    // --- BAGIAN KUNCI: KIRIM KE DATABASE ---
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: score,
        game: 'math'
    });
    
    alert(`Game Selesai! Skor ${score} telah disimpan ke Leaderboard.`);
    // Opsional: Redirect ke menu setelah klik OK
    // window.location.href = '/'; 
}