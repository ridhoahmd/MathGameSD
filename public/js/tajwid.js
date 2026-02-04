// 1. Setup Data
const ui = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
  card: document.getElementById("card"),
  text: document.getElementById("arabic-text"),
  score: document.getElementById("score"),
  finalScore: document.getElementById("final-score"),
  lblLeft: document.getElementById("label-left"),
  lblRight: document.getElementById("label-right"),
  overlay: document.getElementById("feedback-overlay"),
  // Tutor UI
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),
};

let queue = [];
let currentItem = null;
let score = 0;
let playerName = localStorage.getItem("playerName") || "Guest";

let namaKategoriKiri = "Kiri";
let namaKategoriKanan = "Kanan";

let selectedLevel = "mudah";
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// 2. Pilihan Level
document.addEventListener("DOMContentLoaded", () => {
  const diffButtons = document.querySelectorAll(".btn-difficulty");
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedLevel = btn.dataset.level;
    });
  });

  // Sambungin tombol start
  initStartButton();
});

function initStartButton() {
  const tombolMulai = document.querySelector(".btn-start");
  if (tombolMulai) {
    const tombolBaru = tombolMulai.cloneNode(true);
    tombolMulai.parentNode.replaceChild(tombolBaru, tombolMulai);
    tombolBaru.addEventListener("click", startGame);
    console.log("✅ Tajwid.js: Tombol Start Siap!");
  }
}

// 3. Mulai Game
function startGame() {
  const btnStart = document.querySelector(".btn-start");

  // A. Lapor server
  if (window.socket) {
    console.log("⏱️ Start Tajwid: Lapor Server...");
    window.socket.emit("mulaiGame", "tajwid");
  }

  // B. Loading text
  if (btnStart) {
    btnStart.innerText = "⏳ Menyusun Huruf...";
    btnStart.disabled = true;
  }

  // C. Siapin Audio
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // D. Minta Soal
  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "tajwid",
      tingkat: selectedLevel,
    });
  }
}

// 4. Data masuk dari server
if (window.socket) {
  window.socket.on("soalDariAI", (response) => {
    const btnStart = document.querySelector(".btn-start");

    // Cek data valid ga
    if (!response || !response.data) {
      console.error("Tajwid game: Data server error");
      alert("Gagal memuat soal. Silakan coba lagi.");

      if (btnStart) {
        btnStart.innerText = "MULAI GAME";
        btnStart.disabled = false;
      }

      if (ui.start && ui.start.classList.contains("hidden")) {
        ui.start.classList.remove("hidden");
        ui.start.classList.add("active");
      }
      return;
    }

    let incomingData = response.data;

    // Label kategori
    if (incomingData.kategori_kiri && incomingData.kategori_kanan) {
      namaKategoriKiri = incomingData.kategori_kiri;
      namaKategoriKanan = incomingData.kategori_kanan;

      if (ui.lblLeft) {
        ui.lblLeft.innerText = incomingData.kategori_kiri;
        if (ui.lblLeft.parentElement)
          ui.lblLeft.parentElement.style.border = "2px solid #00f2ff";
      }
      if (ui.lblRight) {
        ui.lblRight.innerText = incomingData.kategori_kanan;
        if (ui.lblRight.parentElement)
          ui.lblRight.parentElement.style.border = "2px solid #00f2ff";
      }

      queue = incomingData.data;
    } else if (Array.isArray(incomingData)) {
      queue = incomingData;
      if (ui.lblLeft) ui.lblLeft.innerText = "Kelompok Kiri";
      if (ui.lblRight) ui.lblRight.innerText = "Kelompok Kanan";
    } else {
      console.error("Format Data Salah:", incomingData);
      return;
    }

    if (!queue || queue.length === 0) return; // Cegah array kosong

    // Mulai sesi
    score = 0;
    if (ui.score) ui.score.innerText = "0";

    // Pindah Layar
    if (ui.start) {
      ui.start.classList.remove("active");
      ui.start.classList.add("hidden");
    }
    if (ui.game) {
      ui.game.classList.remove("hidden");
      ui.game.classList.add("active");
    }

    nextCard();
  });
}

// 5. Gameplay
function nextCard() {
  if (queue.length === 0) {
    endGame();
    return;
  }
  currentItem = queue.shift();

  if (ui.text) ui.text.innerText = currentItem.teks || "Error";

  // Reset Animasi Kartu
  if (ui.card) {
    ui.card.style.transform = "translateX(0) rotate(0deg)";
    ui.card.style.transition = "none";
  }
}

// Fungsi jawab + efek visual
function answer(side) {
  // Validasi
  if (!currentItem) return;
  const isCorrect = side === currentItem.hukum;

  // Kartu kedip-kedip
  const cardElement = document.getElementById("card");

  if (isCorrect) {
    // JAWABAN BENAR

    // Logic Combo
    let multiplier = 1;
    if (typeof ComboManager !== "undefined")
      multiplier = ComboManager.addStreak();

    score += Math.round(10 * multiplier);
    if (ui.score) ui.score.innerText = score;

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // 1. Kedip Hijau
    if (cardElement) {
      cardElement.classList.add("correct-flash"); // Pastikan CSS .correct-flash ada
      setTimeout(() => cardElement.classList.remove("correct-flash"), 500);
    }

    // 2. Animasi Overlay
    showFeedback(true);

    // 3. Geser Kartu
    animateSwipe(side);

    // 4. Lanjut
    setTimeout(nextCard, 300);
  } else {
    // JAWABAN SALAH
    if (typeof ComboManager !== "undefined") ComboManager.reset();
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // 1. Kedip Merah
    if (cardElement) {
      cardElement.classList.add("wrong-flash");
      setTimeout(() => cardElement.classList.remove("wrong-flash"), 500);
    }

    // 2. Animasi Overlay
    showFeedback(false);

    // 3. Panggil Guru
    setTimeout(() => {
      let teksJawabanUser =
        side === "kiri" ? namaKategoriKiri : namaKategoriKanan;
      let teksJawabanBenar =
        currentItem.hukum === "kiri" ? namaKategoriKiri : namaKategoriKanan;
      panggilTutor(currentItem.teks, teksJawabanUser, teksJawabanBenar);
    }, 600);
  }
}

function animateSwipe(side) {
  const moveX = side === "kanan" ? 500 : -500;
  if (ui.card) {
    ui.card.style.transition = "transform 0.3s ease";
    ui.card.style.transform = `translateX(${moveX}px) rotate(${moveX / 10}deg)`;
  }
}

function showFeedback(isWin) {
  if (!ui.overlay) return;
  ui.overlay.className = isWin ? "correct-anim" : "wrong-anim";
  setTimeout(() => {
    ui.overlay.className = "";
  }, 500);
}

// 6. Logika AI Tutor
function panggilTutor(soal, jawabUser, jawabBenar) {
  if (tutorUsageCount >= MAX_TUTOR_USAGE) return;
  tutorUsageCount++;

  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    ui.tutorOverlay.classList.remove("hidden");
  }
  if (ui.tutorText)
    ui.tutorText.innerHTML = `
  <div class="tutor-loading-box">
    <div class="loader-spinner"></div>
    <span class="loading-text">MENGANALISIS HUKUM BACAAN...</span>
  </div>
`;

  if (window.socket) {
    window.socket.emit("mintaPenjelasan", {
      game: "tajwid",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

if (window.socket) {
  window.socket.on("penjelasanTutor", (data) => {
    if (ui.tutorText) ui.tutorText.innerHTML = data.penjelasan || data.teks;
  });
}

window.tutupTutor = function () {
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "none";
    ui.tutorOverlay.classList.add("hidden");
  }
  nextCard(); // Lanjut main setelah tutup tutor
};

// 7. Selesai & Simpan
function endGame() {
  if (ui.game) {
    ui.game.classList.remove("active");
    ui.game.classList.add("hidden");
  }
  if (ui.result) {
    ui.result.classList.remove("hidden");
    ui.result.classList.add("active");
  }
  if (ui.finalScore) ui.finalScore.innerText = score;

  try {
    AudioManager.playWin();
  } catch (e) {}

  if (window.socket) {
    console.log("💾 Simpan Skor Tajwid...");
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "tajwid",
    });
  }
}

// Input Keyboard
document.addEventListener("keydown", (e) => {
  if (ui.game && ui.game.classList.contains("active")) {
    if (e.key === "ArrowLeft") answer("kiri");
    if (e.key === "ArrowRight") answer("kanan");
  }
});

// ==========================================
// Buat tombol HTML
// ==========================================
// Agar onclick="handleInput('kiri')" di HTML bisa jalan
window.handleInput = function (side) {
  console.log("Input diterima:", side);
  answer(side);
};

// ==========================================
// Fitur Swipe di HP
// ==========================================
const cardElement = document.getElementById("card");
let startX = 0;
let isDragging = false;

if (cardElement) {
  // 1. Pas disentuh
  cardElement.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      cardElement.style.transition = "none";
    },
    { passive: true },
  );

  // 2. Pas digeser
  cardElement.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      const currentX = e.touches[0].clientX;
      const diffX = currentX - startX;
      const rotate = diffX / 20; // Efek miring sedikit

      // Geser kartu mengikuti jari
      cardElement.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    },
    { passive: true },
  );

  // 3. Pas dilepas
  cardElement.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    const threshold = 100;

    cardElement.style.transition = "transform 0.3s ease";

    if (diffX > threshold) {
      answer("kanan");
    } else if (diffX < -threshold) {
      answer("kiri");
    } else {
      cardElement.style.transform = "translateX(0) rotate(0deg)";
    }
  });
}
