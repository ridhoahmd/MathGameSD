const socket = io();
let cards = [];
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchesFound = 0;
let moves = 0;
const totalPairs = 6;

function initGame() {
    const board = document.getElementById('board');
    board.innerHTML = '<p style="color:white; grid-column:span 4; text-align:center;">🤖 AI sedang menyusun kartu...</p>';
    
    // FIX 1: Kirim kategori 'memory'
    socket.emit('mintaSoalAI', 'memory');
}

// FIX 2: Terima data format baru
socket.on('soalDariAI', (res) => {
    // Pastikan ini data untuk memory
    if (res.kategori !== 'memory') return;
    
    const rawData = res.data; 
    let gameCards = [];

    // Proses data
    rawData.forEach((pair, index) => {
        gameCards.push({ content: pair.a, value: index });
        gameCards.push({ content: pair.b, value: index });
    });

    setupBoard(gameCards);
});

function setupBoard(cardsArray) {
    const board = document.getElementById('board');
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
    document.getElementById('moves').innerText = moves;
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
    document.getElementById('final-score').innerText = score;
    document.getElementById('win-screen').style.display = 'flex';

    const savedName = localStorage.getItem("playerName");
    if (savedName) {
        // KIRIM DATA SKOR KE SERVER, bukan langsung ke Firebase
        socket.emit('simpanSkor', {
            nama: savedName,
            skor: score,
            game: 'memory' // Penting untuk membedakan game
        });
    }
}

initGame();