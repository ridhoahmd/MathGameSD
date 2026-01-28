/**
 * Daily Streak System
 * Track consecutive login days and reward users
 */

class DailyStreakSystem {
  constructor() {
    this.init();
  }

  init() {
    const streak = this.loadStreak();
    this.currentStreak = streak.count;
    this.lastLogin = streak.lastLogin;
    this.longestStreak = streak.longest;

    this.checkAndUpdateStreak();
  }

  /**
   * Load streak from localStorage
   */
  loadStreak() {
    const data = localStorage.getItem("daily_streak");
    if (data) {
      return JSON.parse(data);
    }
    return { count: 0, lastLogin: null, longest: 0 };
  }

  /**
   * Save streak to localStorage
   */
  saveStreak() {
    localStorage.setItem(
      "daily_streak",
      JSON.stringify({
        count: this.currentStreak,
        lastLogin: this.lastLogin,
        longest: this.longestStreak,
      }),
    );
  }

  /**
   * Check if dates are consecutive days
   */
  isConsecutiveDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    // Reset to midnight for comparison
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    const diffTime = d2 - d1;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays === 1;
  }

  /**
   * Check if same day
   */
  isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Check and update streak on login
   */
  checkAndUpdateStreak() {
    const today = new Date();

    if (!this.lastLogin) {
      // First time login
      this.currentStreak = 1;
      this.lastLogin = today.toISOString();
      this.longestStreak = 1;
      this.saveStreak();
      this.showStreakNotification(1, true);
      return true;
    }

    const lastLoginDate = new Date(this.lastLogin);

    if (this.isSameDay(today, lastLoginDate)) {
      // Already logged in today
      return false;
    }

    if (this.isConsecutiveDay(lastLoginDate, today)) {
      // Consecutive day - increment streak!
      this.currentStreak++;
      this.lastLogin = today.toISOString();

      if (this.currentStreak > this.longestStreak) {
        this.longestStreak = this.currentStreak;
      }

      this.saveStreak();
      this.showStreakNotification(this.currentStreak);

      // Check for streak achievements
      if (typeof Achievements !== "undefined") {
        Achievements.checkStreakAchievements(this.currentStreak);
      }

      return true;
    } else {
      // Streak broken!
      const oldStreak = this.currentStreak;
      this.currentStreak = 1;
      this.lastLogin = today.toISOString();
      this.saveStreak();

      if (oldStreak > 3) {
        this.showStreakBrokenNotification(oldStreak);
      }

      this.showStreakNotification(1, true);
      return false;
    }
  }

  /**
   * Get current streak
   */
  getCurrentStreak() {
    return this.currentStreak;
  }

  /**
   * Get longest streak
   */
  getLongestStreak() {
    return this.longestStreak;
  }

  /**
   * Show streak notification
   */
  showStreakNotification(streak, isFirst = false) {
    const messages = {
      1: isFirst
        ? "Selamat datang! Mulai streak hari ini! 🎯"
        : "Streak dimulai lagi! 🌱",
      3: "Streak 3 hari! Kamu hebat! 🔥",
      7: "Streak 7 hari! Dedikasi luar biasa! ⭐",
      14: "Streak 2 minggu! Tak terhentikan! 💪",
      30: "Streak 30 hari! Kamu legenda! 👑",
      100: "Streak 100 hari! Luar biasa! 🚀",
    };

    const message = messages[streak] || `Streak ${streak} hari! Lanjutkan! 🎉`;

    this.showToast(message, "streak", streak >= 3);
  }

  /**
   * Show streak broken notification
   */
  showStreakBrokenNotification(oldStreak) {
    this.showToast(
      `Streak terputus! Sebelumnya ${oldStreak} hari. Mulai lagi! 💔`,
      "broken",
      false,
    );
  }

  /**
   * Show toast notification
   */
  showToast(message, type = "streak", celebration = false) {
    const toast = document.createElement("div");
    toast.className = `streak-toast streak-toast-${type}`;
    toast.innerHTML = `
      <div class="streak-toast-content">
        ${type === "streak" ? "🔥" : "💔"} ${message}
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById("streak-toast-styles")) {
      const style = document.createElement("style");
      style.id = "streak-toast-styles";
      style.textContent = `
        .streak-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 2rem;
          border-radius: 50px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: streakSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
                     streakSlideOut 0.3s ease-in 3.5s forwards;
          font-weight: 600;
          min-width: 200px;
          text-align: center;
        }

        .streak-toast-broken {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        @keyframes streakSlideIn {
          from {
            transform: translateX(-50%) translateY(-100px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        @keyframes streakSlideOut {
          from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
          to {
            transform: translateX(-50%) translateY(-100px);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .streak-toast {
            max-width: 90%;
            font-size: 0.875rem;
            padding: 0.75rem 1.5rem;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    if (celebration && typeof confetti !== "undefined") {
      confetti.shower({
        particleCount: 30,
        startVelocity: 15,
      });
    }

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  /**
   * Get days until streak milestone
   */
  getDaysToNextMilestone() {
    const milestones = [3, 7, 14, 30, 100];
    const nextMilestone = milestones.find((m) => m > this.currentStreak);
    return nextMilestone ? nextMilestone - this.currentStreak : null;
  }

  /**
   * Update sidebar with streak info
   */
  updateStreakDisplay() {
    let streakEl = document.getElementById("streak-display");

    if (!streakEl) {
      // Create streak display element if it doesn't exist
      streakEl = document.createElement("div");
      streakEl.id = "streak-display";
      streakEl.className = "streak-display";

      const sidebar = document.querySelector(".sidebar");
      if (sidebar) {
        const statsBox = sidebar.querySelector(".stats-box");
        if (statsBox) {
          statsBox.after(streakEl);
        }
      }
    }

    const daysToNext = this.getDaysToNextMilestone();
    const nextMilestoneText = daysToNext
      ? `${daysToNext} more days to next milestone!`
      : "Maximum milestone reached!";

    streakEl.innerHTML = `
      <div class="streak-header">
        <span class="streak-icon">🔥</span>
        <span class="streak-title">Streak Harian</span>
      </div>
      <div class="streak-count">${this.currentStreak} ${this.currentStreak === 1 ? "hari" : "hari"}</div>
      <div class="streak-progress">
        <div class="streak-bar-bg">
          <div class="streak-bar-fill" style="width: ${Math.min(100, (this.currentStreak / 30) * 100)}%"></div>
        </div>
      </div>
      <div class="streak-info">
        <span class="streak-best">Terbaik: ${this.longestStreak}</span>
        <span class="streak-next">${daysToNext ? `+${daysToNext} lagi` : "👑"}</span>
      </div>
    `;

    // Add styles if not present
    if (!document.getElementById("streak-display-styles")) {
      const style = document.createElement("style");
      style.id = "streak-display-styles";
      style.textContent = `
        .streak-display {
          background: rgba(255, 255, 255, 0.05);
          padding: 1rem;
          border-radius: 12px;
          margin: 1rem 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .streak-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .streak-icon {
          font-size: 1.5rem;
        }

        .streak-title {
          font-weight: 600;
          color: #fff;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .streak-count {
          font-size: 2rem;
          font-weight: 700;
          color: #00f2ff;
          margin-bottom: 0.5rem;
        }

        .streak-progress {
          margin-bottom: 0.75rem;
        }

        .streak-bar-bg {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
        }

        .streak-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff6b6b, #ffbe0b, #00f2ff);
          border-radius: 10px;
          transition: width 0.5s ease;
        }

        .streak-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #ccc;
        }

        .streak-best {
          font-weight: 600;
        }

        .streak-next {
          opacity: 0.8;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Create global instance
const DailyStreak = new DailyStreakSystem();

// Update display on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    DailyStreak.updateStreakDisplay();
  });
} else {
  DailyStreak.updateStreakDisplay();
}

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = DailyStreakSystem;
}
