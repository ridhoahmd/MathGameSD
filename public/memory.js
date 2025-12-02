// public/memory.js - VERSI ONLINE (AI POWERED)

// 1. Inisialisasi Socket
const socket = io();

const board = document.getElementById('board');
const movesEl = document.getElementById('moves');
const finalScoreEl = document.getElementById('final-score');
const winScreen = document.getElementById('win-screen');

let cards = [];
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchesFound = 0;
let moves = 0;
let totalPairs = 0; // Akan diisi otomatis dari data AI

// Ambil nama pemain
let playerName = localStorage.getItem("playerName") || "Guest";

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

// --- MULAI GAME (MINTA KARTU KE AI) ---
function initGame() {
    console.log("🔧 Meminta kartu ke AI...");
    
    // Tampilkan pesan loading di papan
    board.innerHTML = '<p style="color:white; grid-column:span 4; text-align:center;">🧠 AI sedang menyusun kartu...</p>';
    
    // Reset status
    moves = 0;
    matchesFound = 0;
    movesEl.innerText = moves;
    winScreen.style.display = 'none';

    // Request ke Server
    socket.emit('mintaSoalAI', { 
        kategori: 'memory', 
        tingkat: selectedDifficulty 
    });
}

// --- MENERIMA DATA KARTU DARI SERVER ---
socket.on('soalDariAI', (data) => {
    if (data.kategori === 'memory') {
        // Data dari server berbentuk array pasangan: [{a: "...", b: "..."}, ...]
        const rawPairs = data.data; 
        
        let gameCards = [];
        totalPairs = rawPairs.length;

        // Ubah format data agar cocok dengan logika game
        rawPairs.forEach((pair, index) => {
            // Kartu A (Misal: "Indonesia")
            gameCards.push({ content: pair.a, value: index });
            // Kartu B (Misal: "Jakarta")
            gameCards.push({ content: pair.b, value: index });
        });

        // Setup Papan
        setupBoard(gameCards);
    }
});

function setupBoard(cardsArray) {
    board.innerHTML = '';
    
    // Acak posisi kartu
    cardsArray.sort(() => 0.5 - Math.random());

    // Render kartu ke HTML
    cardsArray.forEach((item) => {
        const card = document.createElement('div');
        card.classList.add('card', 'hidden');
        card.dataset.value = item.value; // ID pasangan (0, 1, 2...)
        
        const front = document.createElement('div');
        front.classList.add('front');
        // Sesuaikan ukuran font jika teks panjang
        if(item.content.length > 10) front.style.fontSize = "0.8rem";
        front.innerText = item.content; 
        
        card.appendChild(front);
        card.addEventListener('click', flipCard);
        board.appendChild(card);
    });
}

// --- LOGIKA PERMAINAN (SAMA SEPERTI SEBELUMNYA) ---
function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;

    this.classList.remove('hidden');

    if (!hasFlippedCard) {
        hasFlippedCard = true;
        firstCard = this;
        return;
    }

    secondCard = this;
    moves++;
    movesEl.innerText = moves;

    checkForMatch();
}

function checkForMatch() {
    // Cek apakah value (ID pasangan) sama
    let isMatch = firstCard.dataset.value === secondCard.dataset.value;
    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    resetBoard();
    matchesFound++;
    
    // Cek Kemenangan
    if (matchesFound === totalPairs) {
        setTimeout(gameWon, 500);
    }
}

function unflipCards() {
    lockBoard = true;
    setTimeout(() => {
        firstCard.classList.add('hidden');
        secondCard.classList.add('hidden');
        resetBoard();
    }, 1000);
}

function resetBoard() {
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
}

// --- GAME SELESAI (SIMPAN KE DATABASE) ---
function gameWon() {
    // Hitung Skor (Maks 100, berkurang jika banyak langkah)
    const baseScore = 100;
    // Penalti langkah: (Langkah - Jumlah Pasangan) * 2
    // Jadi kalau main sempurna (langkah == jumlah pasangan), skor 100.
    let penalty = Math.max(0, (moves - totalPairs) * 2);
    let finalScore = Math.max(10, baseScore - penalty);

    finalScoreEl.innerText = finalScore;
    winScreen.style.display = 'flex';

    console.log(`📡 Mengirim skor Memory: ${finalScore}`);

    // KIRIM KE SERVER
    socket.emit('simpanSkor', {
        nama: playerName,
        skor: finalScore,
        game: 'memory'
    });
}
