let flashTimerInterval = null; // Fix memory leak zombie timer

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// Ambil elemen HTML
const board = document.getElementById("board");
const movesEl = document.getElementById("moves");
const finalScoreEl = document.getElementById("final-score");
const winScreen = document.getElementById("win-screen");

// Variable Game
let cards = [];
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchesFound = 0;
let moves = 0;
let totalPairs = 0;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedDifficulty = "mudah";
let isFlashing = false; // Flag buat flash

// 1. Tombol Ganti Level
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".btn-diff");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

// 1. Mulai Game (Manggil dari HTML)
function initGame() {
  // CRITICAL: Reset flags to prevent race conditions
  isFlashing = false;
  lockBoard = false;
  hasFlippedCard = false;

  if (flashTimerInterval) clearInterval(flashTimerInterval);

  // Reset variabel
  if (window.socket) {
    console.log("⏱️ Start Memory");
    window.socket.emit("mulaiGame", "memory");
  }

  // A. Ilangin Menu
  document.getElementById("start-screen").style.display = "none";
  // B. Munculin Game
  document.getElementById("game-screen").style.display = "block";

  // Loading muter-muter biar keren
  board.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; color: white;">
      <div style="margin: 20px 0;">
        <div style="display: inline-block; border: 3px solid #00f2ff; border-top: 3px solid transparent; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
      </div>
      <p>🧠 Mengambil data & Preload Assets...</p>
    </div>
  `;

  // Masukin animasi loading klo belom ada
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

  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "memory",
      tingkat: selectedDifficulty,
    });
  }
}

// 3. PENGATURAN KONEKSI SOCKET
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Memastikan tidak ada duplikasi listener
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
      if (response.kategori === "memory") {
        let rawData = response.data;

        // Ubah data jadi array
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

        // Batasin jumlah kartu sesuai level
        let maxPairs = 6;
        if (selectedDifficulty === "sedang") maxPairs = 8;
        if (selectedDifficulty === "sulit") maxPairs = 12;

        if (cleanPairs.length > maxPairs) {
          cleanPairs.sort(() => 0.5 - Math.random());
          cleanPairs = cleanPairs.slice(0, maxPairs);
        }

        // Cek error takut datanya zonk
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

        // MEMORY LEAK FIX: Pastikan flash lama sudah berhenti sebelum setup board baru
        isFlashing = false;
        if (flashTimerInterval) {
          clearInterval(flashTimerInterval);
          flashTimerInterval = null;
        }

        setupBoard(gameCards);
      }
    });
    console.log("✅ Memory game socket listener registered");
  } else {
    setTimeout(wireSocketEvents, 100);
  }
}

// Responfif kalo layar diubah
window.addEventListener("resize", () => {
  if (!board || board.children.length === 0) return;

  // Itung ulang grid
  if (selectedDifficulty === "mudah") {
    board.style.gridTemplateColumns = "repeat(3, 1fr)";
    board.style.maxWidth = "260px";
  } else if (selectedDifficulty === "sedang") {
    board.style.gridTemplateColumns = "repeat(4, 1fr)";
    board.style.maxWidth = "340px";
  } else if (selectedDifficulty === "sulit") {
    board.style.gridTemplateColumns = "repeat(6, 1fr)";
    board.style.maxWidth = "480px";
  }
});

// 4. BIKIN PAPAN GAME (Atur Grid)
function setupBoard(cardsArray) {
  board.innerHTML = "";

  // Atur lebar & kolom lewat JS
  if (selectedDifficulty === "mudah") {
    // 12 kartu (3x4)
    board.style.gridTemplateColumns = "repeat(3, 1fr)";
    board.style.maxWidth = "260px"; // Kecil aja
  } else if (selectedDifficulty === "sedang") {
    // 16 kartu (4x4)
    board.style.gridTemplateColumns = "repeat(4, 1fr)";
    board.style.maxWidth = "340px";
  } else if (selectedDifficulty === "sulit") {
    // 24 kartu (6x4)
    board.style.gridTemplateColumns = "repeat(6, 1fr)";
    board.style.maxWidth = "480px"; // Lebar banget
  }

  // Kocok kartunya
  cardsArray.sort(() => 0.5 - Math.random());

  cardsArray.forEach((item) => {
    const card = document.createElement("div");
    card.classList.add("card", "card-closed"); // Default tertutup
    card.dataset.value = item.value;

    const front = document.createElement("div");
    front.classList.add("front");
    // Kecilin font kalo kepanjangan
    if (item.content.length > 8) front.style.fontSize = "0.75rem";
    else front.style.fontSize = "1rem";

    front.innerText = item.content;

    card.appendChild(front);
    card.addEventListener("click", flipCard);
    board.appendChild(card);
  });

  // --- FLASH START LOGIC ---
  if (cardsArray.length > 0) {
    startFlashSequence();
  }
}

function flipCard() {
  if (lockBoard || isFlashing) return; // Gabisa klik pas lagi flash
  if (this === firstCard) return;

  // Buka kartu
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
  // ISU-5-B FIX: Warna unik per pasangan berdasarkan value kartu
  // Menggunakan HSL hue rotation agar setiap pasangan punya warna berbeda
  const hue = (parseInt(firstCard.dataset.value || "0") * 47) % 360;
  const matchColor = `hsl(${hue}, 65%, 55%)`;
  [firstCard, secondCard].forEach((card) => {
    const front = card.querySelector(".front") || card.querySelector(".card-front");
    if (front) {
      front.style.background = matchColor;
      front.style.color = "white";
      front.style.textShadow = "0 1px 3px rgba(0,0,0,0.3)";
    }
    card.classList.add("matched");
  });

  resetBoard();
  matchesFound++;
  if (typeof AudioManager !== "undefined") AudioManager.playCorrect();

  if (matchesFound === totalPairs) {
    setTimeout(gameWon, 500);
  }
}

function unflipCards() {
  lockBoard = true;

  // FUN FACTOR: Screen shake on wrong match
  document.body.classList.add("shake-active");
  setTimeout(() => document.body.classList.remove("shake-active"), 400);

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

// 5. MENANG!
function gameWon() {
  // Matiin flash biar ga bocor
  isFlashing = false;

  // IMPROVED: Reward efficiency instead of penalizing extra moves
  const baseScore = 100;
  const optimalMoves = totalPairs; // Perfect score = jumlah pairs
  const extraMoves = Math.max(0, moves - optimalMoves);

  // Bonus untuk efficient play (tapi tidak minus)
  let bonus = Math.max(0, (optimalMoves - extraMoves) * 5);
  let finalScore = baseScore + bonus;

  if (finalScoreEl) finalScoreEl.innerText = finalScore;

  // ISU-5-A FIX: Rating bintang berdasarkan efisiensi
  let stars, perfMsg, starColor;
  if (extraMoves === 0) {
    stars = "⭐⭐⭐"; perfMsg = "SEMPURNA!"; starColor = "#ffd700";
  } else if (extraMoves <= optimalMoves * 0.5) {
    stars = "⭐⭐"; perfMsg = "Bagus! Bisa lebih baik."; starColor = "#c0c0c0";
  } else {
    stars = "⭐"; perfMsg = "Teruskan berlatih!"; starColor = "#cd7f32";
  }

  // Inject bintang ke win-title
  const winTitle = document.querySelector(".win-title");
  if (winTitle) {
    winTitle.innerHTML =
      `MISSION COMPLETE!<br>` +
      `<span style="font-size:2rem;color:${starColor};display:block;margin:8px 0">${stars}</span>` +
      `<small style="font-size:0.85rem;color:#aaa;font-weight:normal">${perfMsg}</small>`;
  }

  // Umpetin Game, Munculin Modal
  document.getElementById("game-screen").style.display = "none";

  if (winScreen) {
    winScreen.style.display = "flex"; // Flex biar tengah
  }

  // Reset Menu biar pas balik udah siap
  document.getElementById("start-screen").style.display = "flex";

  if (typeof AudioManager !== "undefined") AudioManager.playWin();

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: finalScore,
      game: "memory",
    });
  }
}

// 6. FLASHING (Ngasih liat kartu bentar)
function startFlashSequence() {
  isFlashing = true; // Kunci board
  const allCards = document.querySelectorAll(".card");

  // A. Buka Semua Kartu
  allCards.forEach((card) => card.classList.remove("card-closed"));

  // B. Hitung mundur
  const titleEl = document.querySelector("h1");
  const originalTitle = titleEl.innerText;

  // Waktu flash beda2
  let timeLeft = 3;
  if (selectedDifficulty === "sedang") timeLeft = 4;
  if (selectedDifficulty === "sulit") timeLeft = 6;

  titleEl.innerText = `HAFALKAN! ${timeLeft}s`;
  titleEl.style.color = "#ffeb3b";

  flashTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      titleEl.innerText = `HAFALKAN! ${timeLeft}s`;
    } else {
      clearInterval(flashTimerInterval);

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

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // 1. Stop zombie timers
  isFlashing = false;
  if (flashTimerInterval) {
    clearInterval(flashTimerInterval);
    flashTimerInterval = null;
  }

  // 2. Reset semua state board
  cards = [];
  hasFlippedCard = false;
  lockBoard = false;
  firstCard = undefined;
  secondCard = undefined;
  matchesFound = 0;
  moves = 0;
  totalPairs = 0;

  // 3. Reset UI
  if (movesEl) movesEl.innerText = "0";
  if (finalScoreEl) finalScoreEl.innerText = "0";

  // Reset judul h1 jika sempat diubah oleh startFlashSequence
  const titleEl = document.querySelector("h1");
  if (titleEl) {
    titleEl.innerText = "MEMORY LAB";
    titleEl.style.color = "";
  }

  // 4. Bersihkan board DOM
  if (board) board.innerHTML = "";

  // 5. Sembunyikan win-screen & game-screen
  if (winScreen) winScreen.style.display = "none";
  const gameScreen = document.getElementById("game-screen");
  if (gameScreen) gameScreen.style.display = "none";

  // 6. Tampilkan start-screen
  const startScreen = document.getElementById("start-screen");
  if (startScreen) startScreen.style.display = "flex";

  console.log("🔄 Memory game restarted (no reload)");
};

// Pastikan HTML siap baru kita jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
