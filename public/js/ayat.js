// --- 1. SETUP UI ---
const ui = {
  // Game Elements
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),

  // Data Elements
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  qCurrent: document.getElementById("q-current"),
  qTotal: document.getElementById("q-total"),
  score: document.getElementById("score"),
  finalScore: document.getElementById("final-score"),

  // Tutor UI (Pastikan ID di HTML sesuai)
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),

  // Latin UI
  latinText: document.getElementById("latin-text"),
};

// Global Vars
let questions = [];
let currentIndex = 0;
let score = 0;
let isAnswering = false;
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;
let currentLevel = "mudah";
let playerName = localStorage.getItem("playerName") || "Guest";

// --- 2. LISTENER LEVEL ---
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
  });
});

// --- 3. START GAME ---
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Membuka Mushaf...";
    btnStart.disabled = true;
  }

  if (window.socket) {
    window.socket.emit("mulaiGame", "ayat");
    window.socket.emit("mintaSoalAI", {
      kategori: "ayat",
      tingkat: currentLevel,
    });
  }

  // Safety Timeout
  setTimeout(() => {
    if (ui.start && !ui.start.classList.contains("hidden")) {
      if (btnStart) {
        btnStart.innerText = "⚠️ Timeout. Coba Lagi";
        btnStart.disabled = false;
      }
    }
  }, 8000);
}

// --- 4. TERIMA DATA ---
if (window.socket) {
  window.socket.on("soalDariAI", (response) => {
    if (!response.data || response.data.length === 0) {
      alert("Gagal memuat soal. Refresh halaman.");
      location.reload();
      return;
    }
    questions = response.data;
    currentIndex = 0;
    score = 0;
    isAnswering = false;
    tutorUsageCount = 0;

    if (ui.qTotal) ui.qTotal.innerText = questions.length;
    if (ui.score) ui.score.innerText = "0";

    ui.start.classList.add("hidden");
    ui.game.classList.remove("hidden");
    ui.game.classList.add("active");

    loadQuestion();
  });
}

// --- 5. RENDER SOAL ---
function loadQuestion() {
  isAnswering = false;

  if (currentIndex >= questions.length) {
    endGame();
    return;
  }

  const q = questions[currentIndex];
  if (ui.questionText) ui.questionText.innerText = q.tanya || q.soal;
  if (ui.qCurrent) ui.qCurrent.innerText = currentIndex + 1;
  if (ui.optionsContainer) ui.optionsContainer.innerHTML = "";

  // Latin setup
  if (ui.latinText) {
    ui.latinText.innerText = q.latin || "";
    ui.latinText.style.display = "none";
  }

  // Opsi Jawaban
  const daftarOpsi = q.opsi || [];
  daftarOpsi.forEach((opt) => {
    const btn = document.createElement("button");
    btn.classList.add("btn-option");
    btn.innerText = opt;

    btn.onclick = () => {
      if (isAnswering) return;
      isAnswering = true;

      const kunci = q.jawab || q.jawaban;
      const isCorrect = opt === kunci;

      if (isCorrect) {
        btn.classList.add("correct");

        // COMBO
        let multiplier = 1;
        if (typeof ComboManager !== "undefined")
          multiplier = ComboManager.addStreak();

        score += Math.round(20 * multiplier);
        if (ui.score) ui.score.innerText = score;
        try {
          AudioManager.playCorrect();
        } catch (e) {}

        setTimeout(() => {
          currentIndex++;
          loadQuestion();
        }, 2000);
      } else {
        if (typeof ComboManager !== "undefined") ComboManager.reset();
        btn.classList.add("wrong");
        try {
          AudioManager.playWrong();
        } catch (e) {}

        // Highlight yang benar
        const allBtns = document.querySelectorAll(".btn-option");
        allBtns.forEach((b) => {
          if (b.innerText === kunci) b.classList.add("correct");
        });

        // Panggil Tutor (Jika Kuota Ada)
        if (tutorUsageCount < MAX_TUTOR_USAGE) {
          setTimeout(() => {
            panggilTutor(q.tanya || q.soal, opt, kunci);
          }, 1000);
        } else {
          setTimeout(() => {
            currentIndex++;
            loadQuestion();
          }, 2500);
        }
      }
    };
    ui.optionsContainer.appendChild(btn);
  });
}

// --- 6. LOGIKA TUTOR (DIPERBAIKI DISPLAY-NYA) ---
function panggilTutor(soal, jawabUser, jawabBenar) {
  tutorUsageCount++;

  // [PENTING] Gunakan 'flex' agar CSS justify-content: center bekerja
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    ui.tutorOverlay.classList.remove("hidden");
  }

  if (ui.tutorText)
    ui.tutorText.innerHTML = `
  <div class="tutor-loading-box">
    <div class="loader-spinner"></div>
    <span class="loading-text">GURU SEDANG MENGANALISIS AYAT...</span>
  </div>
`;

  if (window.socket) {
    window.socket.emit("mintaPenjelasan", {
      game: "ayat",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// Terima Balasan Tutor
if (window.socket) {
  window.socket.on("penjelasanTutor", (data) => {
    if (ui.tutorText) {
      ui.tutorText.innerHTML =
        data.penjelasan || data.teks || "Maaf, koneksi terputus.";
    }
  });
}

// Tutup Tutor
window.tutupTutor = function () {
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "none";
  }
  // Lanjut game
  currentIndex++;
  loadQuestion();
};

// --- 7. TOGGLE LATIN ---
window.toggleLatin = function () {
  if (ui.latinText) {
    if (ui.latinText.style.display === "none") {
      ui.latinText.style.display = "block";
    } else {
      ui.latinText.style.display = "none";
    }
  }
};

// --- 8. END GAME ---
function endGame() {
  ui.game.classList.add("hidden");
  ui.result.classList.remove("hidden");
  if (ui.finalScore) ui.finalScore.innerText = score;

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "ayat",
    });
  }
}

// --- 9. INIT ---
document.addEventListener("DOMContentLoaded", () => {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    const newBtn = btnStart.cloneNode(true);
    btnStart.parentNode.replaceChild(newBtn, btnStart);
    newBtn.addEventListener("click", startGame);
  }
});
