// public/memory.js

// --- 1. CONFIG FIREBASE (PASTE CONFIG ANDA DISINI) ---
const firebaseConfig = {
    apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    // 👇 GANTI DENGAN LINK DATABASE ANDA YANG ASLI
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

try { firebase.initializeApp(firebaseConfig); } catch(e) {}
const database = firebase.database();

// --- 2. DATA SOAL ---
// Format: { soal: "Tampilan", nilai: "Kunci Jawaban" }
const cardsArray = [
    { content: "5 + 5", value: 10 },
    { content: "10", value: 10 },
    
    { content: "3 x 3", value: 9 },
    { content: "9", value: 9 },
    
    { content: "12 - 4", value: 8 },
    { content: "8", value: 8 },
    
    { content: "20 : 4", value: 5 },
    { content: "5", value: 5 },
    
    { content: "7 + 4", value: 11 },
    { content: "11", value: 11 },
    
    { content: "6 x 2", value: 12 },
    { content: "12", value: 12 }
];

// Variabel Game
let cards = [];
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchesFound = 0;
let moves = 0;
const totalPairs = cardsArray.length / 2;

// --- 3. MULAI GAME ---
function initGame() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    // Acak Kartu
    cards = cardsArray.sort(() => 0.5 - Math.random());

    // Buat HTML Kartu
    cards.forEach((item) => {
        const card = document.createElement('div');
        card.classList.add('card', 'hidden');
        card.dataset.value = item.value; // Simpan kunci jawaban di data rahasia
        card.innerText = item.content;   // Tampilkan soal/angka
        
        card.addEventListener('click', flipCard);
        board.appendChild(card);
    });
}

// --- 4. LOGIKA BALIK KARTU ---
function flipCard() {
    if (lockBoard) return; // Jangan boleh klik kalau sedang cek
    if (this === firstCard) return; // Jangan boleh klik kartu yang sama 2x

    this.classList.remove('hidden'); // Buka kartu

    if (!hasFlippedCard) {
        // Ini kartu pertama
        hasFlippedCard = true;
        firstCard = this;
        return;
    }

    // Ini kartu kedua
    secondCard = this;
    moves++;
    document.getElementById('moves').innerText = moves;
    
    checkForMatch();
}

// --- 5. CEK KECOCOKAN ---
function checkForMatch() {
    // Bandingkan 'data-value' (Kunci jawaban)
    let isMatch = firstCard.dataset.value === secondCard.dataset.value;

    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    // Jika cocok
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    
    // Matikan klik
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);

    resetBoard();
    matchesFound++;

    // Cek Menang
    if (matchesFound === totalPairs) {
        setTimeout(gameWon, 500);
    }
}

function unflipCards() {
    lockBoard = true; // Kunci papan sebentar

    setTimeout(() => {
        firstCard.classList.add('hidden');
        secondCard.classList.add('hidden');
        resetBoard();
    }, 1000); // Tunggu 1 detik baru tutup
}

function resetBoard() {
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
}

// --- 6. MENANG & SIMPAN SKOR ---
function gameWon() {
    const score = Math.max(100 - (moves * 2), 10); // Hitung skor berdasarkan langkah
    document.getElementById('final-score').innerText = score;
    document.getElementById('win-screen').style.display = 'block';

    // Simpan ke Firebase
    const savedName = localStorage.getItem("playerName");
    if (savedName && database) {
        database.ref('leaderboard/' + savedName).update({
            nama: savedName,
            skor_memory: score, // Skor game ke-3
            waktu_memory: new Date().toString()
        });
    }
}

// Jalankan saat loading
initGame();