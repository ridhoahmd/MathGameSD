/**
 * Achievement System
 * Unlock badges and track milestones
 */

class AchievementSystem {
  constructor() {
    this.achievements = this.defineAchievements();
    this.unlocked = this.loadUnlocked();
  }

  /**
   * Define all available achievements
   */
  defineAchievements() {
    return {
      // Beginner Achievements
      first_game: {
        id: "first_game",
        title: "🎮 First Steps",
        description: "Play your first game",
        icon: "🎮",
        points: 10,
        category: "beginner",
      },
      first_win: {
        id: "first_win",
        title: "🏆 First Victory",
        description: "Win your first game",
        icon: "🏆",
        points: 20,
        category: "beginner",
      },
      scorer_100: {
        id: "scorer_100",
        title: "💯 Century",
        description: "Score 100 points in a single game",
        icon: "💯",
        points: 15,
        category: "scorer",
      },

      // Game-Specific Achievements
      math_whiz: {
        id: "math_whiz",
        title: "🧮 Math Whiz",
        description: "Score 500+ in Math Battle",
        icon: "🧮",
        points: 30,
        category: "games",
        requirement: { game: "math", score: 500 },
      },
      zuma_master: {
        id: "zuma_master",
        title: "☄️ Zuma Master",
        description: "Score 1000+ in Zuma",
        icon: "☄️",
        points: 50,
        category: "games",
        requirement: { game: "zuma", score: 1000 },
      },
      memory_genius: {
        id: "memory_genius",
        title: "🧠 Memory Genius",
        description: "Complete Memory Lab in under 60 seconds",
        icon: "🧠",
        points: 40,
        category: "games",
      },

      // Streak Achievements
      streak_3: {
        id: "streak_3",
        title: "🔥 Hot Streak",
        description: "Login for 3 consecutive days",
        icon: "🔥",
        points: 25,
        category: "streak",
      },
      streak_7: {
        id: "streak_7",
        title: "⭐ Dedicated",
        description: "Login for 7 consecutive days",
        icon: "⭐",
        points: 50,
        category: "streak",
      },
      streak_30: {
        id: "streak_30",
        title: "👑 Legend",
        description: "Login for 30 consecutive days",
        icon: "👑",
        points: 100,
        category: "streak",
      },

      // Combo Achievements
      combo_5: {
        id: "combo_5",
        title: "🎯 Combo Starter",
        description: "Get a 5x combo",
        icon: "🎯",
        points: 20,
        category: "combo",
      },
      combo_10: {
        id: "combo_10",
        title: "⚡ Combo Master",
        description: "Get a 10x combo",
        icon: "⚡",
        points: 40,
        category: "combo",
      },

      // Collection Achievements
      all_rounder: {
        id: "all_rounder",
        title: "🌟 All Rounder",
        description: "Play all 9 games",
        icon: "🌟",
        points: 60,
        category: "collection",
      },
      theme_collector: {
        id: "theme_collector",
        title: "🎨 Style Master",
        description: "Unlock 5 themes",
        icon: "🎨",
        points: 35,
        category: "collection",
      },

      // Social/Leaderboard
      top_10: {
        id: "top_10",
        title: "🥉 Top 10",
        description: "Reach top 10 in leaderboard",
        icon: "🥉",
        points: 50,
        category: "leaderboard",
      },
      top_3: {
        id: "top_3",
        title: "🥈 Podium Finish",
        description: "Reach top 3 in leaderboard",
        icon: "🥈",
        points: 75,
        category: "leaderboard",
      },
      number_1: {
        id: "number_1",
        title: "🥇 Champion",
        description: "Reach #1 in leaderboard",
        icon: "🥇",
        points: 100,
        category: "leaderboard",
      },

      // Total Score Milestones
      scorer_1000: {
        id: "scorer_1000",
        title: "🎖️ Thousand Club",
        description: "Reach 1,000 total score",
        icon: "🎖️",
        points: 30,
        category: "milestone",
      },
      scorer_5000: {
        id: "scorer_5000",
        title: "💎 Diamond Tier",
        description: "Reach 5,000 total score",
        icon: "💎",
        points: 60,
        category: "milestone",
      },
      scorer_10000: {
        id: "scorer_10000",
        title: "🚀 Elite Player",
        description: "Reach 10,000 total score",
        icon: "🚀",
        points: 100,
        category: "milestone",
      },
    };
  }

  /**
   * Load unlocked achievements from localStorage
   */
  loadUnlocked() {
    const saved = localStorage.getItem("achievements_unlocked");
    return saved ? JSON.parse(saved) : [];
  }

  /**
   * Save unlocked achievements
   */
  saveUnlocked() {
    localStorage.setItem(
      "achievements_unlocked",
      JSON.stringify(this.unlocked),
    );
  }

  /**
   * Check if achievement is unlocked
   */
  isUnlocked(achievementId) {
    return this.unlocked.includes(achievementId);
  }

  /**
   * Unlock achievement
   * @returns {Object|null} Achievement data if newly unlocked, null if already unlocked
   */
  unlock(achievementId) {
    if (this.isUnlocked(achievementId)) {
      return null; // Already unlocked
    }

    const achievement = this.achievements[achievementId];
    if (!achievement) {
      console.warn(`Achievement ${achievementId} not found`);
      return null;
    }

    this.unlocked.push(achievementId);
    this.saveUnlocked();

    // Show notification
    this.showAchievementToast(achievement);

    // Trigger confetti
    if (typeof confetti !== "undefined") {
      confetti.burst({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }

    return achievement;
  }

  /**
   * Show achievement unlock notification
   */
  showAchievementToast(achievement) {
    const toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML = `
      <div class="achievement-toast-content">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-desc">${achievement.description}</div>
          <div class="achievement-points">+${achievement.points} XP</div>
        </div>
      </div>
    `;

    // Add styles if not already in CSS
    if (!document.getElementById("achievement-toast-styles")) {
      const style = document.createElement("style");
      style.id = "achievement-toast-styles";
      style.textContent = `
        .achievement-toast {
          position: fixed;
          top: 80px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55),
                     slideOutRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) 3.5s forwards;
          max-width: 320px;
        }

        .achievement-toast-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .achievement-icon {
          font-size: 2.5rem;
          animation: bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .achievement-title {
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 0.25rem;
        }

        .achievement-desc {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .achievement-points {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.2);
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin-top: 0.25rem;
        }

        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .achievement-toast {
            top: auto;
            bottom: 80px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Remove after animation
    setTimeout(() => {
      toast.remove();
    }, 4000);

    // Play sound if available
    if (typeof AudioManager !== "undefined") {
      try {
        AudioManager.playWin();
      } catch (e) {}
    }
  }

  /**
   * Check game score for achievements
   */
  checkGameAchievements(game, score) {
    const unlocked = [];

    // First game
    if (!this.isUnlocked("first_game")) {
      unlocked.push(this.unlock("first_game"));
    }

    // Score milestones in single game
    if (score >= 100 && !this.isUnlocked("scorer_100")) {
      unlocked.push(this.unlock("scorer_100"));
    }

    // Game-specific achievements
    if (game === "math" && score >= 500 && !this.isUnlocked("math_whiz")) {
      unlocked.push(this.unlock("math_whiz"));
    }

    if (game === "zuma" && score >= 1000 && !this.isUnlocked("zuma_master")) {
      unlocked.push(this.unlock("zuma_master"));
    }

    return unlocked.filter((a) => a !== null);
  }

  /**
   * Check total score milestones
   */
  checkTotalScoreAchievements(totalScore) {
    const unlocked = [];

    if (totalScore >= 1000 && !this.isUnlocked("scorer_1000")) {
      unlocked.push(this.unlock("scorer_1000"));
    }

    if (totalScore >= 5000 && !this.isUnlocked("scorer_5000")) {
      unlocked.push(this.unlock("scorer_5000"));
    }

    if (totalScore >= 10000 && !this.isUnlocked("scorer_10000")) {
      unlocked.push(this.unlock("scorer_10000"));
    }

    return unlocked.filter((a) => a !== null);
  }

  /**
   * Check streak achievements
   */
  checkStreakAchievements(streak) {
    const unlocked = [];

    if (streak >= 3 && !this.isUnlocked("streak_3")) {
      unlocked.push(this.unlock("streak_3"));
    }

    if (streak >= 7 && !this.isUnlocked("streak_7")) {
      unlocked.push(this.unlock("streak_7"));
    }

    if (streak >= 30 && !this.isUnlocked("streak_30")) {
      unlocked.push(this.unlock("streak_30"));
    }

    return unlocked.filter((a) => a !== null);
  }

  /**
   * Get total achievement points
   */
  getTotalPoints() {
    return this.unlocked.reduce((total, id) => {
      return total + (this.achievements[id]?.points || 0);
    }, 0);
  }

  /**
   * Get unlocked count
   */
  getUnlockedCount() {
    return this.unlocked.length;
  }

  /**
   * Get total achievement count
   */
  getTotalCount() {
    return Object.keys(this.achievements).length;
  }

  /**
   * Get progression percentage
   */
  getProgressPercentage() {
    return Math.round((this.getUnlockedCount() / this.getTotalCount()) * 100);
  }

  /**
   * Get achievements by category
   */
  getByCategory(category) {
    return Object.values(this.achievements).filter(
      (a) => a.category === category,
    );
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements() {
    return this.unlocked.map((id) => this.achievements[id]).filter(Boolean);
  }

  /**
   * Get locked achievements
   */
  getLockedAchievements() {
    return Object.values(this.achievements).filter(
      (a) => !this.isUnlocked(a.id),
    );
  }
}

// Create global instance
const Achievements = new AchievementSystem();

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = AchievementSystem;
}
