// ==========================================
// MATH BATTLE - ULTIMATE (DB FIX + PVP + UI)
// ==========================================
const questionEl = document.getElementById("question-display");
const scoreEl = document.getElementById("score");
const opponentScoreEl = document.getElementById("opponent-score"); // PvP Element
const statusEl = document.getElementById("status-display"); // PvP Status
const inputEl = document.getElementById("answer-input");
const progressBar = document.getElementById("progress-bar");
const currentQEl = document.getElementById("q-current");
const totalQEl = document.getElementById("q-total");
const finalScoreEl = document.getElementById("final-score");
const gameOverScreen = document.getElementById("game-over-screen");

let score = 0;
let gameActive = false;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedDifficulty = "mudah";
let currentQuestionIdx = 0;
let questionList = [];
let currentProblem = null;

// Variabel PvP
let isPvP = false;
let myRoom = "";

// 1. SETUP AWAL
document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  if (usernameInput) usernameInput.value = playerName;

  // Listener Tombol Difficulty
  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });

  // Listener Tombol ENTER (Agar cepat)
  if (inputEl) {
    inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && gameActive) {
        checkAnswer();
      }
    });
  }
});

// 2. FUNGSI START GAME (SINGLE PLAYER)
function startGame() {
  const nameInput = document.getElementById("username");
  if (nameInput && nameInput.value.trim() !== "") {
    playerName = nameInput.value;
    localStorage.setItem("playerName", playerName);
  }

  isPvP = false; // Pastikan mode single

  // UI Loading
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Memanggil Guru Matematika...";
    btnStart.disabled = true;
  }

  // Request ke Server
  if (window.socket) {
    console.log(`📡 Request Math: ${selectedDifficulty}`);
    window.socket.emit("mintaDataProfil", playerName);
    window.socket.emit("mulaiGame", "math");
    window.socket.emit("mintaSoalAI", {
      kategori: "math",
      tingkat: selectedDifficulty,
    });
  } else {
    alert("Koneksi Server Terputus!");
    location.reload();
  }
}

// 3. FUNGSI PVP (MULTIPLAYER) - DIKEMBALIKAN
function masukModePvP(roomCode) {
  const nameInput = document.getElementById("username");
  if (!nameInput.value) {
    alert("Isi nama dulu!");
    return;
  }

  playerName = nameInput.value;
  localStorage.setItem("playerName", playerName);

  isPvP = true;
  myRoom = roomCode;
  score = 0;

  // UI Pindah ke Game
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  if (statusEl) statusEl.innerText = "⏳ Menunggu Lawan...";

  // Join Room
  if (window.socket) {
    socket.emit("joinMathDuel", {
      room: myRoom,
      nama: playerName,
      tingkat: selectedDifficulty,
    });
  }
}

// 4. HANDLER SOCKET (DATA SERVER)
if (window.socket) {
  // --- MODE SINGLE PLAYER ---
  window.socket.on("soalDariAI", (response) => {
    if (isPvP) return; // Jangan ganggu kalo lagi PvP

    console.log("✅ Data Math Diterima:", response);

    // Reset UI Tombol
    const btnStart = document.querySelector(".btn-start");
    if (btnStart) {
      btnStart.innerText = "MULAI BATTLE";
      btnStart.disabled = false;
    }

    // Parsing Data Cerdas
    let rawData = response.data;
    if (!rawData) return;

    if (Array.isArray(rawData)) {
      questionList = rawData;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      questionList = rawData.data;
    } else {
      console.error("Format data Math salah:", rawData);
      return;
    }

    if (questionList.length === 0) {
      alert("Soal kosong! Coba lagi.");
      return;
    }

    // Mulai Game
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");

    score = 0;
    currentQuestionIdx = 0;
    gameActive = true;

    scoreEl.innerText = score;
    if (totalQEl) totalQEl.innerText = questionList.length;

    tampilkanSoal();
  });

  // --- MODE PVP ---
  window.socket.on("startDuel", (data) => {
    if (!isPvP) return;
    console.log("⚔️ DUEL DIMULAI!", data);

    if (statusEl) statusEl.innerText = "⚔️ DUEL DIMULAI!";
    questionList = data.soal; // Soal dari server (sama utk kedua pemain)

    currentQuestionIdx = 0;
    score = 0;
    gameActive = true;

    if (totalQEl) totalQEl.innerText = questionList.length;
    tampilkanSoal();
  });

  window.socket.on("updateOpponentScore", (skorLawan) => {
    if (opponentScoreEl) opponentScoreEl.innerText = skorLawan;
  });

  window.socket.on("duelResult", (hasil) => {
    gameActive = false;
    alert(hasil.pesan); // "Kamu Menang!" atau "Kalah!"
    location.reload();
  });
}

// 5. LOGIKA GAMEPLAY
function tampilkanSoal() {
  if (currentQuestionIdx >= questionList.length) {
    endGame();
    return;
  }

  currentProblem = questionList[currentQuestionIdx];

  // Update UI Progress
  if (currentQEl) currentQEl.innerText = currentQuestionIdx + 1;

  const progressPercent = (currentQuestionIdx / questionList.length) * 100;
  if (progressBar) progressBar.style.width = `${progressPercent}%`;

  // Handle teks soal (support object atau string)
  let teksSoal = currentProblem.soal || currentProblem.question || "Error";
  if (typeof currentProblem === "string") teksSoal = currentProblem;

  questionEl.innerText = teksSoal;

  inputEl.value = "";
  inputEl.focus();
}

function checkAnswer() {
  if (!gameActive || !currentProblem) return;

  let jawabanUser = inputEl.value.trim();
  let jawabanBenar = String(
    currentProblem.jawaban || currentProblem.answer
  ).trim();

  if (jawabanUser.toLowerCase() === jawabanBenar.toLowerCase()) {
    // --- BENAR ---
    score += 10;
    scoreEl.innerText = score;
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Kirim skor jika PvP
    if (isPvP && window.socket) {
      window.socket.emit("updateDuelScore", { room: myRoom, skor: score });
    }

    // Efek Visual Hijau
    document.body.classList.add("correct-anim");
    setTimeout(() => document.body.classList.remove("correct-anim"), 500);
  } else {
    // --- SALAH ---
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Efek Visual Merah
    document.body.classList.add("wrong-anim");
    setTimeout(() => document.body.classList.remove("wrong-anim"), 500);

    inputEl.value = "";
    inputEl.placeholder = `Jawabannya: ${jawabanBenar}`;
    setTimeout(() => (inputEl.placeholder = "Ketik Jawaban..."), 1500);
  }

  currentQuestionIdx++;
  setTimeout(tampilkanSoal, 300);
}

// 6. GAME OVER & SERTIFIKAT
function endGame() {
  gameActive = false;
  if (progressBar) progressBar.style.width = "100%";

  // Jika PvP, tunggu hasil dari server (duelResult)
  if (isPvP) {
    if (statusEl) statusEl.innerText = "Menunggu hasil akhir...";
    return;
  }

  // Mode Single Player
  document.getElementById("game-screen").classList.add("hidden");
  if (gameOverScreen) {
    // 1. Set display flex dulu agar elemen ada di DOM
    gameOverScreen.style.display = "flex";

    // 2. Beri sedikit jeda (10ms) lalu tambahkan class 'active'
    setTimeout(() => {
      gameOverScreen.classList.add("active");
    }, 10);
  }

  if (finalScoreEl) finalScoreEl.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}

  if (window.socket) {
    console.log("💾 Simpan Skor Math:", score);
    window.socket.emit("mintaDataProfil", playerName);
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "math",
    });
  }
}

// Fitur Download Sertifikat (Dikembalikan)
function downloadSertifikat() {
  alert(
    "Fitur Download Sertifikat akan segera hadir! (Simulasi: 🏆 Sertifikat Tercetak)"
  );
  // Di sini nanti bisa tambahkan logika jsPDF atau html2canvas
  // Untuk saat ini fungsinya memanggil endGame atau alert
}
