/**
 * Logic Mode Versus (1v1 Split Screen) - Jejak Nabi
 * Isolated from nabi.js to ensure zero-risk to solo mode.
 *
 * Fixes applied:
 *  - Independent currentQuestionIndex per player (no shared index)
 *  - 30-second per-question timeout with auto-skip
 *  - Fairness check: game ends when both players finish their questions
 *  - Enhanced server reporting (questionCount, durationMs, timestamp)
 *  - Proper cleanup on disconnect / exit
 */

const VersusNabi = (() => {
  // --- State ---
  let state = {
    isActive: false,
    questions: [],
    // Each player tracks their own question index independently
    p1: { score: 0, ready: false, currentQuestionIndex: 0, answered: false, timeoutId: null },
    p2: { score: 0, ready: false, currentQuestionIndex: 0, answered: false, timeoutId: null },
    isRotated: false,
    gameStartTime: null,
    totalQuestions: 10,
  };

  // BUG-04 FIX: Lazy-init UI — jangan query DOM saat module load, tapi saat game init()
  // Sebelumnya: eager query di sini → null jika DOM belum ready
  const ui = {
    container: null,
    resultScreen: null,
    p1: { score: null, question: null, options: null },
    p2: { score: null, question: null, options: null },
  };

  function initUI() {
    ui.container = document.getElementById("versus-container");
    ui.resultScreen = document.getElementById("versus-result");
    ui.p1.score = document.getElementById("v-score-p1");
    ui.p1.question = document.getElementById("v-q-p1");
    ui.p1.options = document.getElementById("v-opts-p1");
    ui.p2.score = document.getElementById("v-score-p2");
    ui.p2.question = document.getElementById("v-q-p2");
    ui.p2.options = document.getElementById("v-opts-p2");
  }

  // --- Public Methods ---

  function init(allQuestions) {
    if (!ui.container) initUI(); // Lazy-init UI saat pertama kali dibutuhkan
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.classList.remove("active");
      startScreen.classList.add("hidden");
    }

    Swal.fire({
      title: "Masukkan Nama Lawan",
      input: "text",
      inputPlaceholder: "Nama Player 2 (Temanmu)",
      showCancelButton: true,
      confirmButtonText: "Mulai Duel",
      cancelButtonText: "Batal",
      allowOutsideClick: false,
      background: "#1e1e2e",
      color: "#fff"
    }).then((result) => {
      if (result.isDismissed) {
        if (startScreen) {
          startScreen.classList.remove("hidden");
          startScreen.classList.add("active");
        }
        exitVersus();
        return;
      }
      
      const p2Name = (result.value || "Guest").trim();

      state.isActive = true;
      state.questions = shuffleArray([...allQuestions]).slice(0, 10);
      state.totalQuestions = state.questions.length;
      state.gameStartTime = Date.now();

      // Reset per-player state independently
      state.p1 = { score: 0, ready: false, currentQuestionIndex: 0, answered: false, timeoutId: null, name: "Player 1" };
      state.p2 = { score: 0, ready: false, currentQuestionIndex: 0, answered: false, timeoutId: null, name: p2Name };

      updateScoreUI();

      // Show UI
      if (ui.container) ui.container.classList.remove("hidden");
      ui.resultScreen.classList.add("hidden");

      // Start Game — each player gets their own first question
      loadPlayerQuestion("p1");
      loadPlayerQuestion("p2");
    });
  }

  function toggleRotation() {
    state.isRotated = !state.isRotated;
    const p2Area = document.getElementById("p2-area");
    if (state.isRotated) {
      p2Area.classList.add("rotated");
    } else {
      p2Area.classList.remove("rotated");
    }
  }

  function exitVersus() {
    state.isActive = false;
    clearPlayerTimeout("p1");
    clearPlayerTimeout("p2");
    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    // Show Start Screen cleanly
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
        startScreen.classList.remove("hidden");
        startScreen.classList.add("active");
    }
  }

  function rematch() {
    init(state.questions);
  }

  // --- Private Game Logic ---

  /** Clear the per-question timeout for a player. */
  function clearPlayerTimeout(playerId) {
    if (state[playerId].timeoutId) {
      clearTimeout(state[playerId].timeoutId);
      state[playerId].timeoutId = null;
    }
  }

  /**
   * Load the next question for a specific player independently.
   * Each player advances through the question list at their own pace.
   */
  function loadPlayerQuestion(playerId) {
    if (!state.isActive) return;

    const pState = state[playerId];

    if (pState.currentQuestionIndex >= state.questions.length) {
      // This player has finished all questions
      checkBothComplete();
      return;
    }

    const q = state.questions[pState.currentQuestionIndex];
    pState.answered = false;

    renderPlayerUI(ui[playerId], q, playerId);
    startPlayerTimeout(playerId, q);
  }

  /**
   * Start a 30-second timeout for a player's current question.
   * If they don't answer in time, auto-skip to the next question.
   */
  function startPlayerTimeout(playerId, q) {
    clearPlayerTimeout(playerId);

    state[playerId].timeoutId = setTimeout(() => {
      if (!state.isActive || state[playerId].answered) return;

      // Mark as answered (timed out) and show correct answer
      state[playerId].answered = true;
      const playerUI = ui[playerId];
      const buttons = playerUI.options.querySelectorAll(".btn-option");
      buttons.forEach((b) => {
        b.disabled = true;
        const clean = (s) => s.trim().toLowerCase();
        if (clean(b.innerText).includes(clean(q.jawab))) {
          b.classList.add("correct");
        }
      });
      playerUI.question.style.color = "#ff7043";
      playerUI.question.innerText = `⏰ Waktu Habis! Jawaban: ${q.jawab}`;

      setTimeout(() => {
        playerUI.question.style.color = "";
        state[playerId].currentQuestionIndex++;
        loadPlayerQuestion(playerId);
      }, 1200);
    }, 30000); // 30 seconds per question
  }

  function renderPlayerUI(playerUI, q, playerId) {
    playerUI.question.innerText = q.tanya;
    playerUI.options.innerHTML = "";

    q.opsi.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;

      // Touchstart for faster reaction
      btn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault(); // Prevent ghost clicks
          handleAnswer(playerId, opt, q.jawab, btn);
        },
        { passive: false },
      );

      // Click fallback for non-touch
      btn.addEventListener("click", () => {
        handleAnswer(playerId, opt, q.jawab, btn);
      });

      playerUI.options.appendChild(btn);
    });
  }

  function handleAnswer(playerId, selected, correct, btnElement) {
    if (!state.isActive || state[playerId].answered) return;

    // Mark this player as having answered this question
    state[playerId].answered = true;
    clearPlayerTimeout(playerId);

    // Disable buttons for this player immediately
    const playerUI = ui[playerId];
    const buttons = playerUI.options.querySelectorAll(".btn-option");
    buttons.forEach((b) => (b.disabled = true));

    const clean = (str) => str.trim().toLowerCase();
    const isCorrect =
      clean(selected) === clean(correct) ||
      clean(selected).includes(clean(correct));

    if (isCorrect) {
      btnElement.classList.add("correct");
      state[playerId].score += 10;
      try { AudioManager.playCorrect(); } catch (e) {}

      // 💥 Particle Burst
      if (typeof ParticleManager !== "undefined") {
        const rect = btnElement.getBoundingClientRect();
        ParticleManager.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
      }
    } else {
      btnElement.classList.add("wrong");
      try { AudioManager.playWrong(); } catch (e) {}
      // Show correct answer
      buttons.forEach((b) => {
        if (clean(b.innerText).includes(clean(correct))) {
          b.classList.add("correct");
        }
      });
    }

    updateScoreUI();

    // Advance this player to their next question independently
    setTimeout(() => {
      if (!state.isActive) return;
      state[playerId].currentQuestionIndex++;
      loadPlayerQuestion(playerId);
    }, 1000);
  }

  /**
   * Check if both players have finished all their questions.
   * End the game only when both are done (fairness guarantee).
   */
  function checkBothComplete() {
    const p1Done = state.p1.currentQuestionIndex >= state.questions.length;
    const p2Done = state.p2.currentQuestionIndex >= state.questions.length;
    if (p1Done && p2Done) {
      endGame();
    }
  }

  function updateScoreUI() {
    ui.p1.score.innerText = state.p1.score;
    ui.p2.score.innerText = state.p2.score;
  }

  function endGame() {
    if (!state.isActive) return; // Guard against double-call
    state.isActive = false;

    // Clear any remaining timeouts
    clearPlayerTimeout("p1");
    clearPlayerTimeout("p2");

    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.remove("hidden");

    document.getElementById("end-score-p1").innerText = state.p1.score;
    document.getElementById("end-score-p2").innerText = state.p2.score;

    let winnerText = "SERI!";
    let finalStatus = "Draw";
    
    if (state.p1.score > state.p2.score) {
      winnerText = "PEMENANG: PLAYER 1! 🏆";
      finalStatus = "Win";
    }
    if (state.p2.score > state.p1.score) {
      winnerText = `🏆 PEMENANG: ${state.p2.name ? state.p2.name.toUpperCase() : 'PLAYER 2'}!`;
      finalStatus = "Lose";
    }

    document.getElementById("v-winner-text").innerText = winnerText;
    
    // Kirim skor ke server dengan metadata tambahan untuk validasi
    if (window.socket) {
      window.socket.emit("laporSkorVersusLokal", {
        game: "nabi",
        status: finalStatus,
        score: state.p1.score,
        p2Name: state.p2.name || "Guest",
        questionCount: state.totalQuestions,
        durationMs: state.gameStartTime ? Date.now() - state.gameStartTime : null,
        timestamp: Date.now(),
      });
    }

    try { AudioManager.playWin(); } catch (e) {}
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Expose global restart method for no-reload retry
  window.restartGame = function() {
    if (!state.questions || state.questions.length === 0) {
      exitVersus();
      return;
    }
    rematch();
  };

  // Clean up timeouts if the page is unloaded / socket disconnects
  if (window.socket) {
    window.socket.on("disconnect", () => {
      clearPlayerTimeout("p1");
      clearPlayerTimeout("p2");
      state.isActive = false;
    });
  }

  return {
    init,
    toggleRotation,
    exitVersus,
    rematch,
  };
})();
