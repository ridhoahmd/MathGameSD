/**
 * Leveling & XP System
 * Track player progression and calculate levels
 */

class LevelingSystem {
  constructor() {
    this.currentXP = this.loadXP();
    this.currentLevel = this.calculateLevel(this.currentXP);
  }

  /**
   * Load XP from localStorage
   */
  loadXP() {
    const saved = localStorage.getItem("player_xp");
    return saved ? parseInt(saved) : 0;
  }

  /**
   * Save XP to localStorage
   */
  saveXP() {
    localStorage.setItem("player_xp", this.currentXP.toString());
  }

  /**
   * Calculate level from XP
   * Formula: Level = floor(sqrt(XP / 100))
   */
  calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100));
  }

  /**
   * Calculate XP needed for specific level
   */
  xpForLevel(level) {
    return level * level * 100;
  }

  /**
   * Add XP and check for level up
   */
  addXP(amount) {
    const oldLevel = this.currentLevel;
    this.currentXP += amount;
    this.currentLevel = this.calculateLevel(this.currentXP);
    this.saveXP();

    if (this.currentLevel > oldLevel) {
      this.onLevelUp(oldLevel, this.currentLevel);
      return { leveledUp: true, newLevel: this.currentLevel };
    }

    return { leveledUp: false, newLevel: this.currentLevel };
  }

  /**
   * Get XP from game score
   * Different games give different XP rates
   */
  getXPFromScore(game, score) {
    const rates = {
      math: 1.0,
      zuma: 0.8,
      labirin: 1.2,
      memory: 1.1,
      piano: 1.0,
      kasir: 0.9,
      nabi: 1.0,
      ayat: 1.0,
      tajwid: 1.1,
    };

    const rate = rates[game] || 1.0;
    return Math.floor(score * rate);
  }

  /**
   * Handle level up
   */
  onLevelUp(oldLevel, newLevel) {
    this.showLevelUpNotification(newLevel);

    // Trigger confetti
    if (typeof confetti !== "undefined") {
      confetti.victory();
    }

    // Play sound
    if (typeof AudioManager !== "undefined") {
      try {
        AudioManager.playWin();
      } catch (e) {}
    }
  }

  /**
   * Show level up notification
   */
  showLevelUpNotification(level) {
    const notification = document.createElement("div");
    notification.className = "level-up-notification";
    notification.innerHTML = `
      <div class="level-up-content">
        <div class="level-up-icon">⬆️</div>
        <div class="level-up-text">
          <div class="level-up-title">NAIK LEVEL!</div>
          <div class="level-up-level">Level ${level}</div>
        </div>
      </div>
    `;

    // Add styles if not present
    if (!document.getElementById("level-up-styles")) {
      const style = document.createElement("style");
      style.id = "level-up-styles";
      style.textContent = `
        .level-up-notification {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0);
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 2rem 3rem;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          z-index: 10001;
          animation: levelUpBounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards,
                     levelUpFadeOut 0.3s ease-in 2.5s forwards;
        }

        .level-up-content {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .level-up-icon {
          font-size: 4rem;
          animation: levelUpIconSpin 1s ease-in-out;
        }

        .level-up-title {
          font-size: 1.5rem;
          font-weight: 900;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          letter-spacing: 2px;
        }

        .level-up-level {
          font-size: 2.5rem;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        @keyframes levelUpBounce {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes levelUpIconSpin {
          from {
            transform: rotate(0deg) scale(1);
          }
          to {
            transform: rotate(720deg) scale(1);
          }
        }

        @keyframes levelUpFadeOut {
          to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
        }

        @media (max-width: 768px) {
          .level-up-notification {
            padding: 1.5rem 2rem;
          }

          .level-up-icon {
            font-size: 3rem;
          }

          .level-up-title {
            font-size: 1.25rem;
          }

          .level-up-level {
            font-size: 2rem;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Get current level
   */
  getLevel() {
    return this.currentLevel;
  }

  /**
   * Get current XP
   */
  getXP() {
    return this.currentXP;
  }

  /**
   * Get XP progress to next level (0-100%)
   */
  getProgressToNextLevel() {
    const currentLevelXP = this.xpForLevel(this.currentLevel);
    const nextLevelXP = this.xpForLevel(this.currentLevel + 1);
    const xpInCurrentLevel = this.currentXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;

    return Math.round((xpInCurrentLevel / xpNeededForLevel) * 100);
  }

  /**
   * Get XP needed for next level
   */
  getXPToNextLevel() {
    const nextLevelXP = this.xpForLevel(this.currentLevel + 1);
    return nextLevelXP - this.currentXP;
  }

  /**
   * Update XP bar in sidebar
   */
  updateXPDisplay() {
    let xpEl = document.getElementById("xp-display");

    if (!xpEl) {
      xpEl = document.createElement("div");
      xpEl.id = "xp-display";
      xpEl.className = "xp-display";

      const sidebar = document.querySelector(".sidebar");
      if (sidebar) {
        const scoreBox = sidebar.querySelector(".stats-box");
        if (scoreBox) {
          scoreBox.after(xpEl);
        }
      }
    }

    const progress = this.getProgressToNextLevel();
    const xpToNext = this.getXPToNextLevel();

    xpEl.innerHTML = `
      <div class="xp-header">
        <span class="xp-level">Level ${this.currentLevel}</span>
        <span class="xp-next">${xpToNext} XP lagi</span>
      </div>
      <div class="xp-progress-bar">
        <div class="xp-progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="xp-text">
        <span>${this.currentXP.toLocaleString()} XP</span>
        <span>${progress}%</span>
      </div>
    `;

    // Add styles if not present
    if (!document.getElementById("xp-display-styles")) {
      const style = document.createElement("style");
      style.id = "xp-display-styles";
      style.textContent = `
        .xp-display {
          background: rgba(255, 255, 255, 0.05);
          padding: 1rem;
          border-radius: 12px;
          margin: 1rem 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .xp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .xp-level {
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffbe0b;
          text-shadow: 0 0 10px rgba(255, 190, 11, 0.5);
        }

        .xp-next {
          font-size: 0.75rem;
          color: #ccc;
        }

        .xp-progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .xp-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffbe0b, #ff006e);
          border-radius: 10px;
          transition: width 0.5s ease;
          position: relative;
          overflow: hidden;
        }

        .xp-progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          animation: shimmer 2s infinite;
        }

        .xp-text {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #aaa;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Create global instance
const PlayerLevel = new LevelingSystem();

// Update display on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    PlayerLevel.updateXPDisplay();
  });
} else {
  PlayerLevel.updateXPDisplay();
}

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = LevelingSystem;
}
