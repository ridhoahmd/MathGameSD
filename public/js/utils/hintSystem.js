/**
 * Hint System for Tajwid Game
 * Memberikan petunjuk visual untuk membantu pemain
 */

const HintSystem = {
  maxHints: 2,
  hintsRemaining: 2,
  hintButton: null,
  hintCounter: null,
  isHintActive: false,

  init: function () {
    this.hintButton = document.getElementById("hint-btn");
    this.hintCounter = document.getElementById("hint-count");
    this.updateDisplay();
  },

  reset: function () {
    this.hintsRemaining = this.maxHints;
    this.isHintActive = false;
    this.updateDisplay();
  },

  updateDisplay: function () {
    if (this.hintCounter) {
      this.hintCounter.innerText = `${this.hintsRemaining}/${this.maxHints}`;
    }

    if (this.hintButton) {
      if (this.hintsRemaining <= 0) {
        this.hintButton.disabled = true;
        this.hintButton.classList.add("disabled");
      } else {
        this.hintButton.disabled = false;
        this.hintButton.classList.remove("disabled");
      }
    }
  },

  useHint: function (currentItem) {
    if (this.hintsRemaining <= 0) {
      this.showToast("Petunjuk sudah habis! 😅", "warning");
      return false;
    }

    if (this.isHintActive) {
      this.showToast("Petunjuk sudah aktif! 👀", "info");
      return false;
    }

    // Kurangi hint
    this.hintsRemaining--;
    this.isHintActive = true;
    this.updateDisplay();

    // Tampilkan hint visual
    this.showHintVisual(currentItem);

    // Hapus hint setelah 3 detik
    setTimeout(() => {
      this.hideHintVisual();
      this.isHintActive = false;
    }, 3000);

    // Play sound
    try {
      if (typeof AudioManager !== "undefined") {
        AudioManager.playTone(440, 0, 0.1);
      }
    } catch (e) {}

    return true;
  },

  showHintVisual: function (currentItem) {
    if (!currentItem) return;

    const card = document.getElementById("card");
    if (!card) return;

    // Tambah glow effect ke kartu
    card.classList.add("hint-glow");

    // Tambah hint label
    const hintLabel = document.createElement("div");
    hintLabel.id = "hint-label";
    hintLabel.className = "hint-label";

    // Tampilkan clue berdasarkan jawaban
    const hukum = currentItem.hukum;
    const labelKiri = document.getElementById("label-left").innerText;
    const labelKanan = document.getElementById("label-right").innerText;

    if (hukum === "kiri") {
      hintLabel.innerHTML = `💡 Coba ke <strong>${labelKiri}</strong>`;
      hintLabel.style.borderColor = "#4cd137";
    } else {
      hintLabel.innerHTML = `💡 Coba ke <strong>${labelKanan}</strong>`;
      hintLabel.style.borderColor = "#e84118";
    }

    card.parentElement.appendChild(hintLabel);

    // Animation
    setTimeout(() => {
      hintLabel.classList.add("show");
    }, 10);

    this.showToast("Petunjuk diaktifkan! ✨", "success");
  },

  hideHintVisual: function () {
    const card = document.getElementById("card");
    if (card) {
      card.classList.remove("hint-glow");
    }

    const hintLabel = document.getElementById("hint-label");
    if (hintLabel) {
      hintLabel.classList.remove("show");
      setTimeout(() => {
        if (hintLabel.parentNode) {
          hintLabel.parentNode.removeChild(hintLabel);
        }
      }, 300);
    }
  },

  showToast: function (message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `hint-toast hint-toast-${type}`;
    toast.innerHTML = message;

    // Style
    toast.style.position = "fixed";
    toast.style.top = "80px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background =
      type === "success"
        ? "linear-gradient(135deg, #00e676, #00c853)"
        : type === "warning"
          ? "linear-gradient(135deg, #ffd600, #ff6f00)"
          : "linear-gradient(135deg, #00f2ff, #0099ff)";
    toast.style.color = "white";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "30px";
    toast.style.fontWeight = "600";
    toast.style.fontSize = "0.9rem";
    toast.style.zIndex = "10001";
    toast.style.boxShadow = "0 5px 20px rgba(0,0,0,0.3)";
    toast.style.animation = "slideDown 0.3s ease-out";

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideUp 0.3s ease-in";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
  },
};

// Auto init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    HintSystem.init();
  });
} else {
  HintSystem.init();
}

// Global function untuk onclick
window.useHint = function () {
  // currentItem harus accessible dari tajwid.js
  if (typeof currentItem !== "undefined") {
    HintSystem.useHint(currentItem);
  } else {
    console.warn("currentItem not available for hint");
  }
};
