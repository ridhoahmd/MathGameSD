// public/memory.js - VERSI FINAL (CLEAN & ANTI-CRASH)

const socket = io();

// Element DOM
const board = document.getElementById("board");
const movesEl = document.getElementById("moves");
const finalScoreEl = document.getElementById("final-score");
const winScreen = document.getElementById("win-screen");

// Game State
let cards = [];
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchesFound = 0;
let moves = 0;
let totalPairs = 0;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedDifficulty = "mudah";

// 1. Event Listener Tombol Kesulitan
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

// 2. Fungsi Mulai Game
function initGame() {
  console.log("🔧 Meminta kartu ke AI...");

  // Pesan Loading Rapi
  board.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; color: white;">🧠 Sedang mengacak kartu...</div>';

  // Reset Status
  moves = 0;
  matchesFound = 0;
  if (movesEl) movesEl.innerText = moves;
  if (winScreen) winScreen.style.display = "none";

  // Request Server
  socket.emit("mintaSoalAI", {
    kategori: "memory",
    tingkat: selectedDifficulty,
  });
}

// 3. Menerima Data (Anti-Crash Logic)
socket.on("soalDariAI", (response) => {
  console.log("🔥 MEMORY DATA:", response);

  if (response.kategori === "memory") {
    let rawPairs = response.data;

    // --- A. DATA CLEANING (PEMBERSIH) ---
    // Jaga-jaga jika AI mengirim format yang aneh
    if (!Array.isArray(rawPairs)) {
      if (rawPairs && rawPairs.data && Array.isArray(rawPairs.data)) {
        rawPairs = rawPairs.data;
      } else if (typeof rawPairs === "object") {
        rawPairs = [rawPairs];
      }
    }

    // Hapus data kosong
    rawPairs = rawPairs.filter((item) => item && item.a && item.b);

    if (rawPairs.length === 0) {
      board.innerHTML =
        '<p style="color:red; text-align:center;">Data kosong. Coba lagi.</p>';
      return;
    }

    // --- B. MENYUSUN KARTU ---
    let gameCards = [];
    totalPairs = rawPairs.length;

    rawPairs.forEach((pair, index) => {
      gameCards.push({ content: pair.a, value: index });
      gameCards.push({ content: pair.b, value: index });
    });

    setupBoard(gameCards);
  }
});

function setupBoard(cardsArray) {
  board.innerHTML = "";

  // Acak Kartu
  cardsArray.sort(() => 0.5 - Math.random());

  // Render ke HTML
  cardsArray.forEach((item) => {
    const card = document.createElement("div");

    // 🔥 PENTING: Gunakan 'card-closed' (sesuai CSS baru), BUKAN 'hidden'
    card.classList.add("card", "card-closed");

    card.dataset.value = item.value;

    const front = document.createElement("div");
    front.classList.add("front");
    if (item.content.length > 8) front.style.fontSize = "0.8rem"; // Kecilkan font jika panjang
    front.innerText = item.content;

    card.appendChild(front);
    card.addEventListener("click", flipCard);
    board.appendChild(card);
  });
}

// 4. Logika Klik Kartu
function flipCard() {
  if (lockBoard) return;
  if (this === firstCard) return;

  // Buka Kartu: Hapus class tertutup
  this.classList.remove("card-closed");

  if (typeof AudioManager !== "undefined") AudioManager.playClick();

  if (!hasFlippedCard) {
    hasFlippedCard = true;
    firstCard = this;
    return;
  }

  secondCard = this;
  moves++;
  if (movesEl) movesEl.innerText = moves;

  checkForMatch();
}

function checkForMatch() {
  let isMatch = firstCard.dataset.value === secondCard.dataset.value;
  isMatch ? disableCards() : unflipCards();
}

function disableCards() {
  // Kunci kartu (tetap terbuka)
  firstCard.classList.add("matched"); // Bisa Anda style di CSS jika mau
  secondCard.classList.add("matched");

  // Hapus event listener agar tidak bisa diklik lagi
  firstCard.removeEventListener("click", flipCard);
  secondCard.removeEventListener("click", flipCard);

  resetBoard();
  matchesFound++;
  if (typeof AudioManager !== "undefined") AudioManager.playCorrect();

  if (matchesFound === totalPairs) {
    setTimeout(gameWon, 500);
  }
}

function unflipCards() {
  lockBoard = true;
  setTimeout(() => {
    // Tutup Kembali: Tambah class tertutup
    firstCard.classList.add("card-closed");
    secondCard.classList.add("card-closed");

    if (typeof AudioManager !== "undefined") AudioManager.playWrong();
    resetBoard();
  }, 1000);
}

function resetBoard() {
  [hasFlippedCard, lockBoard] = [false, false];
  [firstCard, secondCard] = [null, null];
}

// 5. Game Selesai
function gameWon() {
  const baseScore = 100;
  let penalty = Math.max(0, (moves - totalPairs) * 2);
  let finalScore = Math.max(10, baseScore - penalty);

  if (finalScoreEl) finalScoreEl.innerText = finalScore;
  if (winScreen) winScreen.style.display = "flex";

  if (typeof AudioManager !== "undefined") AudioManager.playWin();

  socket.emit("simpanSkor", {
    nama: playerName,
    skor: finalScore,
    game: "memory",
  });
}
