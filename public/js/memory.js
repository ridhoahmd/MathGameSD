const socket = window.socket;

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
let isFlashing = false; // Flag untuk mencegah klik saat flash

// 1. Listener Tombol Kesulitan
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

// 2. FUNGSI MULAI GAME (LOGIKA SWITCH ID)
function initGame() {
  if (window.socket) {
    console.log("⏱️ Start Memory");
    window.socket.emit("mulaiGame", "memory");
  }

  // A. Sembunyikan Menu
  document.getElementById("start-screen").style.display = "none";
  // B. Tampilkan Game
  document.getElementById("game-screen").style.display = "block";

  // Pesan Loading
  // 🔧 FIX: Better loading state with spinner
  board.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; color: white;">
      <div style="margin: 20px 0;">
        <div style="display: inline-block; border: 3px solid #00f2ff; border-top: 3px solid transparent; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
      </div>
      <p>🧠 Mengambil data & Preload Assets...</p>
    </div>
  `;

  // Add spinner animation if not exists
  if (!document.getElementById("memory-spinner-style")) {
    const style = document.createElement("style");
    style.id = "memory-spinner-style";
    style.textContent =
      "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }

  moves = 0;
  matchesFound = 0;
  if (movesEl) movesEl.innerText = moves;
  if (winScreen) winScreen.style.display = "none";

  socket.emit("mintaSoalAI", {
    kategori: "memory",
    tingkat: selectedDifficulty,
  });
}

// 3. Menerima Data
socket.on("soalDariAI", (response) => {
  if (response.kategori === "memory") {
    let rawData = response.data;

    // Parser Cerdas
    if (!Array.isArray(rawData)) {
      if (rawData && rawData.data) rawData = rawData.data;
      else if (rawData && typeof rawData === "object")
        rawData = Object.values(rawData);
    }

    let cleanPairs = rawData
      .map((item) => {
        if (typeof item === "string") {
          try {
            return JSON.parse(item);
          } catch (e) {
            return null;
          }
        }
        if (item.content) {
          if (typeof item.content === "string") {
            try {
              return JSON.parse(item.content);
            } catch (e) {
              return null;
            }
          }
          return item.content;
        }
        return item;
      })
      .filter((item) => item && item.a && item.b);

    // Limit Soal sesuai Difficulty
    let maxPairs = 6;
    if (selectedDifficulty === "sedang") maxPairs = 8;
    if (selectedDifficulty === "sulit") maxPairs = 12;

    if (cleanPairs.length > maxPairs) {
      cleanPairs.sort(() => 0.5 - Math.random());
      cleanPairs = cleanPairs.slice(0, maxPairs);
    }

    // 🔧 FIX: Better error handling
    if (cleanPairs.length === 0) {
      board.innerHTML =
        '<p style="color:red;">❌ Gagal memuat soal. Silakan refresh halaman.</p>';
      console.error("Memory game: No valid pairs received from server");
      setTimeout(() => {
        document.getElementById("start-screen").style.display = "block";
        document.getElementById("game-screen").style.display = "none";
      }, 2000);
      return;
    }

    let gameCards = [];
    totalPairs = cleanPairs.length;
    cleanPairs.forEach((pair, index) => {
      gameCards.push({ content: pair.a, value: index });
      gameCards.push({ content: pair.b, value: index });
    });

    setupBoard(gameCards);
  }
});

let streak = 0;
const MAX_STREAK = 5;

// 🔧 FIX: Removed manual resize listener because CSS Grid handles it now!

// 4. SETUP BOARD (Responsive Grid)
function setupBoard(cardsArray) {
  board.innerHTML = "";

  // Set Grid Columns Class based on Difficulty
  // We use standard CSS Grid `repeat(N, 1fr)`
  // CSS handles the width (100% of container)
  if (selectedDifficulty === "mudah") {
    board.style.gridTemplateColumns = "repeat(3, 1fr)";
  } else if (selectedDifficulty === "sedang") {
    board.style.gridTemplateColumns = "repeat(4, 1fr)";
  } else if (selectedDifficulty === "sulit") {
    board.style.gridTemplateColumns = "repeat(5, 1fr)"; // 5 cols for 20-25 cards fit better
    // Or 6 if we really have 24 cards
    if (cardsArray.length >= 24)
      board.style.gridTemplateColumns = "repeat(6, 1fr)";
  }

  // Acak Kartu
  cardsArray.sort(() => 0.5 - Math.random());

  cardsArray.forEach((item) => {
    const card = document.createElement("div");
    card.classList.add("card", "card-closed");
    card.dataset.value = item.value;

    const front = document.createElement("div");
    front.classList.add("front");
    // Front text auto-size handled by CSS clamp()

    front.innerText = item.content;

    card.appendChild(front);
    card.addEventListener("click", flipCard);
    board.appendChild(card);
  });

  // Reset Streak UI
  updateStreak(false, true);

  if (cardsArray.length > 0) {
    startFlashSequence();
  }
}

function flipCard() {
  if (lockBoard || isFlashing) return;
  if (this === firstCard) return;

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

  if (isMatch) {
    disableCards();
    updateStreak(true);
    // Spawn Particles at center of second card (or both)
    const rect = secondCard.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnParticles(centerX, centerY);
  } else {
    unflipCards();
    updateStreak(false);
  }
}

// --- NEW FEATURE: STREAK SYSTEM ---
function updateStreak(isSuccess, reset = false) {
  if (reset) streak = 0;
  else if (isSuccess) streak = Math.min(streak + 1, MAX_STREAK);
  else streak = 0;

  const bar = document.getElementById("streak-bar");
  const text = document.getElementById("streak-text");

  if (bar) {
    const pct = (streak / MAX_STREAK) * 100;
    bar.style.width = `${pct}%`;

    if (streak >= MAX_STREAK) {
      bar.classList.add("full"); // Hyper Mode Visual
    } else {
      bar.classList.remove("full");
    }
  }

  if (text) text.innerText = `Streak: ${streak}x`;
}

// --- NEW FEATURE: PARTICLES ---
function spawnParticles(x, y) {
  const colors = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
  ];

  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    document.body.appendChild(p);

    // Random Color
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Set fixed position relative to viewport (since game is centered)
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;

    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 100 + 50; // Distance
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.style.setProperty("--tx", `${tx}px`);
    p.style.setProperty("--ty", `${ty}px`);

    // Self cleanup
    setTimeout(() => p.remove(), 600);
  }
}

function disableCards() {
  firstCard.classList.add("matched");
  secondCard.classList.add("matched");
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

// 5. GAME SELESAI
function gameWon() {
  // 🔧 FIX: Clear any active flash timer to prevent memory leak
  isFlashing = false;

  const baseScore = 100;
  let penalty = Math.max(0, (moves - totalPairs) * 2);
  let finalScore = Math.max(10, baseScore - penalty);

  if (finalScoreEl) finalScoreEl.innerText = finalScore;

  // Sembunyikan Game, Munculkan Modal
  document.getElementById("game-screen").style.display = "none";

  if (winScreen) {
    winScreen.style.display = "flex"; // Flex agar center
  }

  // Reset Menu agar saat user kembali, menu sudah siap
  document.getElementById("start-screen").style.display = "flex";

  if (typeof AudioManager !== "undefined") AudioManager.playWin();

  socket.emit("simpanSkor", {
    nama: playerName,
    skor: finalScore,
    game: "memory",
  });
}

// 6. FUNGSI FLASH START (Addictive Feature)
function startFlashSequence() {
  isFlashing = true; // Kunci board
  const allCards = document.querySelectorAll(".card");

  // A. Buka Semua Kartu
  allCards.forEach((card) => card.classList.remove("card-closed"));

  // B. Tampilkan Countdown di Header
  const titleEl = document.querySelector("h1");
  const originalTitle = titleEl.innerText;

  // 🔧 FIX: Adjust flash time based on difficulty
  let timeLeft = 3;
  if (selectedDifficulty === "sedang") timeLeft = 4;
  if (selectedDifficulty === "sulit") timeLeft = 6;

  titleEl.innerText = `HAFALKAN! ${timeLeft}s`;
  titleEl.style.color = "#ffeb3b";

  const timer = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      titleEl.innerText = `HAFALKAN! ${timeLeft}s`;
    } else {
      clearInterval(timer);

      // C. Tutup Semua Kartu & Mulai Game
      allCards.forEach((card) => card.classList.add("card-closed"));

      titleEl.innerText = "MULAI!";
      titleEl.style.color = "#00f2ff";

      setTimeout(() => {
        titleEl.innerText = originalTitle;
        isFlashing = false; // Buka kunci
      }, 1000);
    }
  }, 1000);
}
