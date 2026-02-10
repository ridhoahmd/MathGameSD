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
  // UI Tutor
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

// Batas Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// 1. Tombol Difficulty
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

// 2. Mulai Game
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Memuat...";
    btnStart.disabled = true;
  }
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // Refresh Sesi
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName);
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

// 3. Terima Data
if (window.socket) {
  socket.on("soalDariAI", (response) => {
    if (response.kategori === "nabi") {
      // Cek error dulu
      if (!response.data || response.data.length === 0) {
        console.error("Nabi game: Error data");
        alert("Gagal memuat soal. Silakan coba lagi.");

        const btnStart = document.querySelector(".btn-start");
        if (btnStart) {
          btnStart.innerText = "MULAI GAME";
          btnStart.disabled = false;
        }

        if (screens.start) {
          screens.start.classList.remove("hidden");
          screens.start.classList.add("active");
        }

        isRequestingQuestions = false; // Reset flag
        return;
      }

      // ENDLESS MODE: Determine if initial load or append
      const isInitialLoad = questions.length === 0;

      if (isInitialLoad) {
        // Original behavior - first load
        questions = response.data;

        currentIndex = 0;
        score = 0;
        if (ui.score) ui.score.innerText = "0";
        if (ui.qTotal) ui.qTotal.innerText = questions.length;

        screens.start.classList.remove("active");
        screens.start.classList.add("hidden");
        screens.game.classList.remove("hidden");
        screens.game.classList.add("active");

        loadQuestion();
      } else {
        // ENDLESS MODE: Append new questions
        const prevLength = questions.length;
        questions.push(...response.data);
        isRequestingQuestions = false;

        console.log(
          `✅ Added ${response.data.length} questions. Total: ${questions.length}`,
        );

        // Visual feedback
        showToast(`📥 +${response.data.length} soal baru dimuat`);

        // If waiting for questions, continue
        if (currentIndex >= prevLength) {
          loadQuestion();
        }
      }
    }
  });
}

function loadQuestion() {
  // ENDLESS MODE: Check if need more questions
  if (currentIndex >= questions.length - 2) {
    requestMoreQuestions();
  }

  // If truly out of questions, show loading
  if (currentIndex >= questions.length) {
    showLoadingMessage();
    return;
  }

  // Auto-save check
  checkAutoSave();
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
  startTimer(25); // ENDLESS MODE: 25 seconds per question
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

    // Hitung Combo
    let multiplier = 1;
    if (typeof ComboManager !== "undefined")
      multiplier = ComboManager.addStreak();

    let basePoints = 20 + Math.floor(timeLeft / 2);
    score += Math.round(basePoints * multiplier);
    if (ui.score) ui.score.innerText = score;
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
  } else {
    // SALAH
    if (typeof ComboManager !== "undefined") ComboManager.reset();
    btnElement.classList.add("wrong");
    btnElement.style.background = "#e74c3c";
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Kasih tau jawaban bener
    allButtons.forEach((b) => {
      if (cleanStr(b.innerText).includes(correct))
        b.style.background = "#2ecc71";
    });

    // Panggil AI klo salah
    panggilTutor(
      document.getElementById("question-text").innerText,
      selectedRaw,
      correctRaw,
    );
  }
}

// Logika Tutor
function panggilTutor(soal, jawabUser, jawabBenar) {
  if (tutorUsageCount >= MAX_TUTOR_USAGE) {
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
    return;
  }
  tutorUsageCount++;

  // Stop timer pas tutor muncul
  clearInterval(timerInterval);

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
    window.socket.emit("mintaPenjelasan", {
      game: "nabi",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// Terima jawaban tutor
if (window.socket) {
  socket.on("penjelasanTutor", (data) => {
    if (ui.tutorText) ui.tutorText.innerHTML = data.penjelasan || data.teks;
  });
}

// Tutup tutor
window.tutupTutor = function () {
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";
  currentIndex++;
  loadQuestion();
};

function endGame() {
  // Bersihin timer
  clearInterval(timerInterval);

  screens.game.classList.remove("active");
  screens.game.classList.add("hidden");
  screens.result.classList.remove("hidden");
  screens.result.classList.add("active");
  if (ui.finalScore) ui.finalScore.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName);
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "nabi",
    });
  }
}

// ==========================================
// ENDLESS MODE FUNCTIONS
// ==========================================

// Auto-request more questions
let isRequestingQuestions = false;
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 5000; // 5 seconds

function requestMoreQuestions() {
  // Rate limiting
  const now = Date.now();
  if (isRequestingQuestions || now - lastRequestTime < REQUEST_COOLDOWN) {
    console.log("⏳ Request cooldown active");
    return;
  }

  isRequestingQuestions = true;
  lastRequestTime = now;

  console.log("📥 Requesting more questions...");

  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "nabi",
      tingkat: currentLevel,
      mode: "endless",
    });
  }
}

function showLoadingMessage() {
  if (ui.questionText) {
    ui.questionText.innerText = "⏳ Memuat soal berikutnya...";
  }
  // Retry after delay
  setTimeout(() => {
    if (currentIndex < questions.length) {
      loadQuestion();
    } else {
      requestMoreQuestions();
    }
  }, 2000);
}

// Auto-save system
function checkAutoSave() {
  if (currentIndex > 0 && currentIndex % 5 === 0) {
    autoSaveProgress();
  }
}

function autoSaveProgress() {
  console.log("💾 Auto-saving progress...");

  if (window.socket) {
    window.socket.emit("simpanProgress", {
      nama: playerName,
      game: "nabi",
      skor: score,
      soalDijawab: currentIndex,
      timestamp: Date.now(),
    });
  }

  // Visual feedback
  showToast("💾 Progress tersimpan");
}

// Save and exit
window.saveAndExit = function () {
  // Confirmation
  const confirmMsg =
    `Yakin ingin menyimpan dan keluar?\n\n` +
    `✅ Skor: ${score}\n` +
    `📝 Soal terjawab: ${currentIndex}`;

  if (!confirm(confirmMsg)) return;

  // Stop timer
  clearInterval(timerInterval);

  // Save score
  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "nabi",
      soalDijawab: currentIndex,
      mode: "endless",
    });
  }

  // Show result
  endGame();
};

// Toast notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Auto-save on page close (emergency backup)
window.addEventListener("beforeunload", (e) => {
  if (score > 0 && currentIndex > 0) {
    // Quick sync save attempt
    if (navigator.sendBeacon && window.socket) {
      const data = JSON.stringify({
        nama: playerName,
        game: "nabi",
        skor: score,
        soalDijawab: currentIndex,
      });
      // Note: This endpoint needs to be implemented server-side
      navigator.sendBeacon("/api/quick-save", data);
    }
  }
});
