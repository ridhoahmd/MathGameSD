// ==========================================
// KISAH NABI - RESTORE AI TUTOR & SESSION
// ==========================================
const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
};

const ui = {
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  qCurrent: document.getElementById("q-current"),
  qTotal: document.getElementById("q-total"),
  score: document.getElementById("score"),
  timer: document.getElementById("timer"),
  progressFill: document.getElementById("progress"),
  finalScore: document.getElementById("final-score"),
  resultMsg: document.getElementById("result-msg"),
  // Tutor UI
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),
};

let currentLevel = "mudah";
let questions = [];
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// Limit Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// 1. SETUP TOMBOL
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
    const disp = document.getElementById("difficulty-display");
    if (disp) disp.innerText = btn.innerText;
  });
});

// 2. START GAME
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Memuat...";
    btnStart.disabled = true;
  }
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // [FIX] REFRESH SESSION
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName); // <-- PENTING
    window.socket.emit("mulaiGame", "nabi");
    window.socket.emit("mintaSoalAI", {
      kategori: "nabi",
      tingkat: currentLevel,
    });
  }

  setTimeout(() => {
    if (screens.start.classList.contains("active")) {
      if (btnStart) {
        btnStart.innerText = "⚠️ Coba Lagi";
        btnStart.disabled = false;
      }
    }
  }, 8000);
}

// 3. TERIMA DATA
if (window.socket) {
  socket.on("soalDariAI", (response) => {
    if (response.kategori === "nabi") {
      questions = response.data;
      if (!questions || questions.length === 0) return;

      currentIndex = 0;
      score = 0;
      if (ui.score) ui.score.innerText = "0";
      if (ui.qTotal) ui.qTotal.innerText = questions.length;

      screens.start.classList.remove("active");
      screens.start.classList.add("hidden");
      screens.game.classList.remove("hidden");
      screens.game.classList.add("active");

      loadQuestion();
    }
  });
}

function loadQuestion() {
  if (currentIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentIndex];
  if (ui.questionText) ui.questionText.innerText = q.tanya;
  if (ui.qCurrent) ui.qCurrent.innerText = currentIndex + 1;
  if (ui.progressFill) {
    const pct = (currentIndex / questions.length) * 100;
    ui.progressFill.style.width = `${pct}%`;
  }
  if (ui.optionsContainer) {
    ui.optionsContainer.innerHTML = "";
    q.opsi.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;
      btn.onclick = () => checkAnswer(opt, q.jawab, btn);
      ui.optionsContainer.appendChild(btn);
    });
  }
  startTimer(20);
}

function startTimer(seconds) {
  if (timerInterval) clearInterval(timerInterval);
  timeLeft = seconds;
  if (ui.timer) ui.timer.innerText = timeLeft;
  timerInterval = setInterval(() => {
    timeLeft--;
    if (ui.timer) ui.timer.innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function handleTimeOut() {
  try {
    AudioManager.playWrong();
  } catch (e) {}
  const buttons = document.querySelectorAll(".btn-option");
  buttons.forEach((b) => (b.disabled = true));
  setTimeout(() => {
    currentIndex++;
    loadQuestion();
  }, 1000);
}

function checkAnswer(selectedRaw, correctRaw, btnElement) {
  clearInterval(timerInterval);
  const cleanStr = (str) => str.trim().toLowerCase().replace(/\s+/g, " ");
  const selected = cleanStr(selectedRaw);
  const correct = cleanStr(correctRaw);
  const allButtons = document.querySelectorAll(".btn-option");
  allButtons.forEach((b) => (b.disabled = true));

  const isCorrect =
    selected === correct ||
    selected.includes(correct) ||
    correct.includes(selected);

  if (isCorrect) {
    btnElement.classList.add("correct");
    btnElement.style.background = "#2ecc71";
    try {
      AudioManager.playCorrect();
    } catch (e) {}
    score += 20 + Math.floor(timeLeft / 2);
    if (ui.score) ui.score.innerText = score;
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
  } else {
    // SALAH
    btnElement.classList.add("wrong");
    btnElement.style.background = "#e74c3c";
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Highlight Benar
    allButtons.forEach((b) => {
      if (cleanStr(b.innerText).includes(correct))
        b.style.background = "#2ecc71";
    });

    // [FIX] PANGGIL AI TUTOR JIKA SALAH
    panggilTutor(
      document.getElementById("question-text").innerText,
      selectedRaw,
      correctRaw,
    );
  }
}

// [FIX] LOGIKA TUTOR
function panggilTutor(soal, jawabUser, jawabBenar) {
  if (tutorUsageCount >= MAX_TUTOR_USAGE) {
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
    return;
  }
  tutorUsageCount++;

  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    if (ui.tutorText) {
      ui.tutorText.innerHTML = `
    <div class="tutor-loading-box">
      <div class="loader-spinner"></div>
      <span class="loading-text">MEMBUKA GULUNGAN SEJARAH...</span>
    </div>
  `;
    }
  }

  if (window.socket) {
    socket.emit("mintaPenjelasan", {
      game: "nabi",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// TERIMA JAWABAN TUTOR
if (window.socket) {
  socket.on("penjelasanTutor", (data) => {
    if (ui.tutorText) ui.tutorText.innerHTML = data.penjelasan || data.teks;
  });
}

// TUTUP TUTOR
window.tutupTutor = function () {
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";
  currentIndex++;
  loadQuestion();
};

function endGame() {
  screens.game.classList.remove("active");
  screens.game.classList.add("hidden");
  screens.result.classList.remove("hidden");
  screens.result.classList.add("active");
  if (ui.finalScore) ui.finalScore.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName); // <-- Refresh session lagi
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "nabi",
    });
  }
}
