const ComboManager = {
  currentStreak: 0,
  maxStreak: 0,
  comboContainer: null,

  // Audio notes (C Major Scale)
  tones: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25],

  init: function () {
    // Buat container UI jika belum ada
    if (!document.getElementById("combo-container")) {
      const div = document.createElement("div");
      div.id = "combo-container";
      div.style.position = "absolute";
      div.style.top = "20%";
      div.style.left = "50%";
      div.style.transform = "translate(-50%, -50%)";
      div.style.pointerEvents = "none"; // Agar tidak menutupi klik
      div.style.zIndex = "9999";
      div.style.textAlign = "center";
      document.body.appendChild(div);
      this.comboContainer = div;
    } else {
      this.comboContainer = document.getElementById("combo-container");
    }
  },

  addStreak: function () {
    this.currentStreak++;

    // Mainkan suara nada naik
    this.playComboSound();

    // Tampilkan efek visual
    this.showComboVisual();

    return this.calculateBonus();
  },

  reset: function () {
    if (this.currentStreak > 1) {
      // Efek "Combo Broken" (optional)
      this.showComboBreak();
    }
    this.currentStreak = 0;
  },

  calculateBonus: function () {
    // Bonus multiplier:
    // Streak 2-4: x1.2
    // Streak 5-9: x1.5
    // Streak 10+: x2.0
    if (this.currentStreak < 2) return 1;
    if (this.currentStreak < 5) return 1.2;
    if (this.currentStreak < 10) return 1.5;
    return 2.0;
  },

  playComboSound: function () {
    // Gunakan AudioManager yang ada di global scope (dari audio.js)
    if (typeof AudioManager !== "undefined" && AudioManager.ctx) {
      // Pilih nada berdasarkan streak (looping jika > 8)
      const noteIndex = (this.currentStreak - 1) % this.tones.length;
      const freq = this.tones[noteIndex];

      // Naikkan oktaf setiap 8 streak
      const octaveMultiplier = Math.pow(
        2,
        Math.floor((this.currentStreak - 1) / 8),
      );

      AudioManager.playTone(freq * octaveMultiplier, 0, 0.2);
    }
  },

  showComboVisual: function () {
    if (!this.comboContainer) this.init();

    // Hapus elemen lama agar tidak numpuk
    this.comboContainer.innerHTML = "";

    if (this.currentStreak > 1) {
      const span = document.createElement("span");

      // Icon based on streak level — P2: tambah spark untuk streak 2-4
      let icon = "";
      let extraClass = "";

      if (this.currentStreak >= 10) {
        // Mega combo - Lightning + Rainbow
        icon = ' <span class="combo-lightning">⚡</span>';
        extraClass = "combo-rainbow combo-glow";
      } else if (this.currentStreak >= 5) {
        // High combo - Flame
        icon = ' <span class="combo-flame">🔥</span>';
        extraClass = "combo-glow";
      } else if (this.currentStreak >= 3) {
        // Medium combo - Sparkle (P2: BARU)
        icon = ' <span class="combo-spark">✨</span>';
        extraClass = "combo-sparkle";
      } else {
        // First combo (streak 2) - quick zap (P2: BARU)
        icon = ' <span class="combo-spark">⚡</span>';
      }

      span.innerHTML = `${this.currentStreak}x COMBO!${icon}`;
      span.style.fontSize = `${2 + this.currentStreak * 0.2}rem`;
      span.style.fontWeight = "bold";
      span.style.color = this.getComboColor();
      span.style.textShadow = "0 0 10px rgba(0,0,0,0.5)";
      span.style.display = "block";
      span.className = `combo-anim ${extraClass}`;

      // Inline animation
      span.animate(
        [
          { transform: "scale(0.5)", opacity: 0 },
          { transform: "scale(1.2)", opacity: 1, offset: 0.3 },
          { transform: "scale(1.0)", opacity: 1, offset: 0.5 },
          { transform: "scale(1.1)", opacity: 0, offset: 1 },
        ],
        {
          duration: 800,
          easing: "ease-out",
        },
      );

      this.comboContainer.appendChild(span);

      // Check for milestones
      if (
        this.currentStreak === 5 ||
        this.currentStreak === 10 ||
        this.currentStreak === 15 ||
        this.currentStreak === 20
      ) {
        this.showMilestoneEffect(this.currentStreak);
      }

      // Remove after animation
      setTimeout(() => {
        if (span.parentNode) span.parentNode.removeChild(span);
      }, 800);
    }
  },

  // P1: Floating score — menampilkan "+N ×M" melayang di dekat elemen skor
  showFloatingScore: function(points, multiplier, anchorEl) {
    const el = document.createElement('div');
    el.className = 'floating-points';

    if (multiplier > 1) {
      el.innerHTML = `<span class="fp-points">+${points}</span><span class="fp-multi"> ×${multiplier.toFixed(1)}</span>`;
      el.style.color = multiplier >= 2 ? '#ff6b35' : '#ffd600';
    } else {
      el.textContent = `+${points}`;
      el.style.color = '#00e676';
    }

    // Posisikan di atas elemen skor jika tersedia, fallback ke kanan tengah
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      el.style.left = (rect.left + rect.width / 2) + 'px';
      el.style.top  = (rect.top - 8) + 'px';
      el.style.transform = 'translateX(-50%)';
    } else {
      el.style.right = '20px';
      el.style.top   = '18%';
    }

    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '10000';
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
  },

  showMilestoneEffect: function (streak) {
    // Screen shake
    const gameWrapper = document.querySelector(".game-wrapper");
    if (gameWrapper) {
      gameWrapper.classList.add("screen-shake");
      setTimeout(() => {
        gameWrapper.classList.remove("screen-shake");
      }, 500);
    }

    // Milestone burst text
    const burst = document.createElement("div");
    burst.className = "milestone-burst";
    burst.innerText = `🎉 ${streak}X STREAK! 🎉`;
    document.body.appendChild(burst);

    // Trigger confetti from particle system
    if (typeof ParticleManager !== "undefined") {
      ParticleManager.confettiRain(60);
    }

    setTimeout(() => {
      if (burst.parentNode) {
        burst.parentNode.removeChild(burst);
      }
    }, 1000);
  },

  showComboBreak: function () {
    if (!this.comboContainer) this.init();
    this.comboContainer.innerHTML = "";

    const span = document.createElement("span");
    span.innerText = "MISS!";
    span.style.fontSize = "2rem";
    span.style.color = "#ff4444";
    span.style.fontWeight = "bold";

    this.comboContainer.appendChild(span);

    span.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(50px)", opacity: 0 },
      ],
      {
        duration: 600,
        easing: "ease-in",
      },
    );

    setTimeout(() => {
      if (span.parentNode) span.parentNode.removeChild(span);
    }, 600);
  },

  getComboColor: function () {
    if (this.currentStreak < 5) return "#00e676"; // Green
    if (this.currentStreak < 10) return "#ffd600"; // Yellow/Gold
    return "#ff1744"; // Red/Fire (rainbow handled by CSS)
  },
};

// Auto Init saat load
document.addEventListener("DOMContentLoaded", () => {
  ComboManager.init();
});
