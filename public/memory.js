// public/memory.js - VERSI STANDALONE (TANPA SERVER)
// Versi ini membuat kartu sendiri, tidak meminta ke server.

// Elemen-elemen DOM yang akan kita gunakan
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
let totalPairs = 6; // Akan diubah berdasarkan tingkat kesulitan

// --- LOGIKA KESULITAN ---
let selectedDifficulty = 'mudah'; // Nilai default

// Event listener untuk tombol kesulitan
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

// Fungsi untuk membuat pasangan kartu secara lokal
function generateCardPairs() {
    let pairs = [];
    // Data contoh, bisa diperbanyak
    const allPairs = [
        { a: "🍎", b: "Apple" }, { a: "🍌", b: "Pisang" }, { a: "🍇", b: "Anggur" },
        { a: "🍓", b: "Stroberi" }, { a: "🍑", b: "Ceri" }, { a: "🍒", b: "Nanas" },
        { a: "🍋", b: "Lemon" }, { a: "🍉", b: "Semangka" }
    ];
    
    let numPairs = 4;
    if (selectedDifficulty === 'mudah') numPairs = 4;
    else if (selectedDifficulty === 'sedang') numPairs = 6;
    else if (selectedDifficulty === 'sulit') numPairs = 8;

    // Acak dan ambil pasangan yang dibutuhkan
    for (let i = 0; i < numPairs; i++) {
        pairs.push(allPairs[i]);
    }

    let gameCards = [];
    pairs.forEach((pair, index) => {
        gameCards.push({ content: pair.a, value: index });
        gameCards.push({ content: pair.b, value: index });
    });
    
    totalPairs = numPairs;
    return gameCards;
}

function initGame() {
    console.log("🔧 Memulai game dengan data lokal...");
    
    // Tampilkan pesan loading
    board.innerHTML = '<p style="color:white; grid-column:span 4; text-align:center;">🤖 Menyiapkan kartu...</p>';
    
    // Simulasi delay loading
    setTimeout(() => {
        const gameCards = generateCardPairs();
        setupBoard(gameCards);
    }, 500); // Delay singkat 0.5 detik
}

function setupBoard(cardsArray) {
    board.innerHTML = '';
    cardsArray.sort(() => 0.5 - Math.random());

    cardsArray.forEach((item) => {
        const card = document.createElement('div');
        card.classList.add('card', 'hidden');
        card.dataset.value = item.value; 
        
        const front = document.createElement('div');
        front.classList.add('front');
        front.innerText = item.content; // Tampilkan teks (Soal/Jawaban)
        
        card.appendChild(front);
        card.addEventListener('click', flipCard);
        board.appendChild(card);
    });
}

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
    let isMatch = firstCard.dataset.value === secondCard.dataset.value;
    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    resetBoard();
    matchesFound++;
    if (matchesFound === totalPairs) setTimeout(gameWon, 500);
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

function gameWon() {
    const score = Math.max(100 - (moves * 2), 10);
    finalScoreEl.innerText = score;
    winScreen.style.display = 'flex';

    // Di versi standalone, kita tidak menyimpan skor ke server
    console.log(`Game selesai! Skor: ${score}`);
}