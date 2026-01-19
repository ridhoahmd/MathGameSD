// --- 1. SETUP UI & DATA ---
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
  // Elemen Tutor
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),
};

let queue = [];
let currentItem = null;
let score = 0;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedLevel = "mudah";
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// --- 2. LISTENER TOMBOL DIFFICULTY ---
document.addEventListener("DOMContentLoaded", () => {
  const diffButtons = document.querySelectorAll(".btn-diff");
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedLevel = btn.dataset.level;
    });
  });

  // Init Auto-Connect Tombol Start disini juga
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

// --- 3. FUNGSI START GAME ---
function startGame() {
  const btnStart = document.querySelector(".btn-start");

  // A. ANTI-CHEAT START
  if (window.socket) {
    console.log("⏱️ Start Tajwid: Lapor Server...");
    window.socket.emit("mulaiGame", "tajwid");
  }

  // B. UI Loading
  if (btnStart) {
    btnStart.innerText = "⏳ Menyusun Huruf...";
    btnStart.disabled = true;
  }

  // C. Audio
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // D. Request Soal
  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "tajwid",
      tingkat: selectedLevel,
    });
  }
}

// --- 4. TERIMA DATA SERVER (FINAL VERSION) ---
if (window.socket) {
  window.socket.on("soalDariAI", (response) => {
    const btnStart = document.querySelector(".btn-start");

    // 1. VALIDASI DATA (Punya Anda - Tetap Dipertahankan)
    if (!response || !response.data) {
      if (btnStart) {
        btnStart.innerText = "❌ Gagal Muat";
        btnStart.disabled = false;
      }
      return;
    }

    let incomingData = response.data;

    // 2. LOGIKA LABEL (Punya Saya - DITAMBAHKAN)
    // Cek apakah data mengandung nama hukum tajwid?
    if (incomingData.kategori_kiri && incomingData.kategori_kanan) {
      // Update Teks Label di Layar HTML
      if (ui.lblLeft) {
        ui.lblLeft.innerText = incomingData.kategori_kiri; // Ubah label Kiri
        // Tambah style border biar cantik (opsional)
        if (ui.lblLeft.parentElement)
          ui.lblLeft.parentElement.style.border = "2px solid #00f2ff";
      }
      if (ui.lblRight) {
        ui.lblRight.innerText = incomingData.kategori_kanan; // Ubah label Kanan
        if (ui.lblRight.parentElement)
          ui.lblRight.parentElement.style.border = "2px solid #00f2ff";
      }

      // Ambil array soalnya
      queue = incomingData.data;
    }
    // Fallback jika data cuma array biasa
    else if (Array.isArray(incomingData)) {
      queue = incomingData;
      // Reset label ke default jika tidak ada info kategori
      if (ui.lblLeft) ui.lblLeft.innerText = "Kelompok Kiri";
      if (ui.lblRight) ui.lblRight.innerText = "Kelompok Kanan";
    } else {
      console.error("Format Data Salah:", incomingData);
      return;
    }

    if (!queue || queue.length === 0) return; // Cegah array kosong

    // 3. LOGIKA MULAI GAME (Tetap Sama)
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

// --- 5. GAMEPLAY LOGIC ---
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

// [REVISI] Fungsi Answer dengan Visual Feedback
function answer(side) {
  // Validasi
  if (!currentItem) return;
  const isCorrect = side === currentItem.hukum;

  // Elemen Kartu untuk efek kedip
  const cardElement = document.getElementById("card");

  if (isCorrect) {
    // --- JAWABAN BENAR ---
    score += 10;
    if (ui.score) ui.score.innerText = score;

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // 1. Efek Kedip Hijau di Kartu
    if (cardElement) {
      cardElement.classList.add("correct-flash"); // Pastikan CSS .correct-flash ada
      setTimeout(() => cardElement.classList.remove("correct-flash"), 500);
    }

    // 2. Animasi Overlay (Lama)
    showFeedback(true);

    // 3. Animasi Geser Kartu (Swipe)
    animateSwipe(side);

    // 4. Lanjut Soal
    setTimeout(nextCard, 300);
  } else {
    // --- JAWABAN SALAH ---
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // 1. Efek Kedip Merah di Kartu
    if (cardElement) {
      cardElement.classList.add("wrong-flash"); // Pastikan CSS .wrong-flash ada
      setTimeout(() => cardElement.classList.remove("wrong-flash"), 500);
    }

    // 2. Animasi Overlay (Lama)
    showFeedback(false);

    // 3. Panggil Tutor (Jeda sebentar biar efek visual terlihat)
    setTimeout(() => {
      panggilTutor(currentItem.teks, side, currentItem.hukum);
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

// --- 6. AI TUTOR LOGIC ---
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

// --- 7. GAME OVER & SAVE ---
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
// [FIX] JEMBATAN UNTUK HTML (WAJIB ADA)
// ==========================================
// Agar onclick="handleInput('kiri')" di HTML bisa jalan
window.handleInput = function (side) {
  console.log("Input diterima:", side);
  answer(side);
};

// ==========================================
// [BARU] LOGIKA TOUCH SWIPE (HP)
// ==========================================
const cardElement = document.getElementById("card");
let startX = 0;
let isDragging = false;

if (cardElement) {
  // 1. Saat jari menyentuh layar
  cardElement.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      cardElement.style.transition = "none";
    },
    { passive: true },
  );

  // 2. Saat jari bergerak (Visual Feedback)
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

  // 3. Saat jari dilepas (Eksekusi Jawaban)
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
