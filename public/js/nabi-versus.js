/**
 * Logic Mode Versus (1v1 Split Screen) - Jejak Nabi
 * Isolated from nabi.js to ensure zero-risk to solo mode.
 *
 * FIXES APPLIED:
 *  - BUG #3: rematch() no longer calls init() → no duplicate Swal prompt
 *  - BUG #4: window.restartGame calls _startRound() directly
 *  - BUG #5: exitVersus() has null-guard on ui.container
 *  - BUG #6: Added 30s deadlock timeout in checkRoundComplete
 *  - BUG #7: touchstart uses { once: true } to prevent double-fire
 *  - Added null-guards throughout
 */

const VersusNabi = (() => {
  let state = {
    isActive: false,
    _originalQuestions: [], // Save pool for rematch re-shuffle
    questions: [],
    currentIndex: 0,
    p1: { score: 0, ready: false },
    p2: { score: 0, ready: false },
    isRotated: false,
    isTransitioning: false,
    _deadlockTimeout: null, // FIX #6: deadlock prevention timer
  };

  // BUG-04 FIX: Lazy-init UI
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
    if (!ui.container) initUI();

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
      color: "#fff",
    }).then((result) => {
      if (result.isDismissed) {
        if (startScreen) {
          startScreen.classList.remove("hidden");
          startScreen.classList.add("active");
        }
        exitVersus();
        return;
      }

      state.p2.name = (result.value || "Guest").trim();
      state._originalQuestions = [...allQuestions]; // Save for rematch
      _startRound();
    });
  }

  /**
   * FIX #3 & #4: Internal start — resets and starts game WITHOUT Swal prompt.
   * Called by both first-start (after Swal) and rematch.
   */
  function _startRound() {
    state.isActive = true;
    // Always re-shuffle for each new round
    state.questions = shuffleArray([...state._originalQuestions]).slice(0, 10);
    state.currentIndex = 0;

    state.p1 = { score: 0, ready: false };
    state.p2 = { score: 0, ready: false, name: state.p2.name };
    state.isTransitioning = false;

    if (state._deadlockTimeout) {
      clearTimeout(state._deadlockTimeout);
      state._deadlockTimeout = null;
    }

    updateScoreUI();

    if (ui.container) ui.container.classList.remove("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    loadQuestion();
  }

  function toggleRotation() {
    state.isRotated = !state.isRotated;
    const p2Area = document.getElementById("p2-area");
    if (p2Area) {
      if (state.isRotated) {
        p2Area.classList.add("rotated");
      } else {
        p2Area.classList.remove("rotated");
      }
    }
  }

  function exitVersus() {
    state.isActive = false;
    if (state._deadlockTimeout) {
      clearTimeout(state._deadlockTimeout);
      state._deadlockTimeout = null;
    }

    // FIX #5: Null-guard on ui.container
    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    // FIX: Reset game mode to solo so main file doesn't keep routing to versus
    if (typeof window.selectMode === "function") {
      window.selectMode("solo");
    }

    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.classList.remove("hidden");
      startScreen.classList.add("active");
    }

    // BUG-V4 FIX: Kembalikan visibility solo game container
    const soloGameContainer = document.querySelector(".game-container");
    if (soloGameContainer) soloGameContainer.style.display = "";
  }

  // FIX #3: rematch no longer calls init() — directly starts new round
  function rematch() {
    if (!state._originalQuestions || state._originalQuestions.length === 0) {
      exitVersus();
      return;
    }
    _startRound();
  }

  // --- Private Game Logic ---

  function loadQuestion() {
    state.isTransitioning = false;

    if (state._deadlockTimeout) {
      clearTimeout(state._deadlockTimeout);
      state._deadlockTimeout = null;
    }

    if (state.currentIndex >= state.questions.length) {
      endGame();
      return;
    }

    const q = state.questions[state.currentIndex];

    renderPlayerUI(ui.p1, q, "p1");
    renderPlayerUI(ui.p2, q, "p2");

    // Reset ready states
    state.p1.ready = false;
    state.p2.ready = false;

    // FIX #6: 30s deadlock prevention — if both players idle, auto-advance
    state._deadlockTimeout = setTimeout(() => {
      if (state.isActive && !state.isTransitioning) {
        console.warn("[VersusNabi] Deadlock timeout — advancing to next question");
        state.isTransitioning = true;
        state.currentIndex++;
        loadQuestion();
      }
    }, 30000);
  }

  function renderPlayerUI(playerUI, q, playerId) {
    if (!playerUI.question || !playerUI.options) return;

    playerUI.question.innerText = q.tanya || "...";
    playerUI.question.style.color = "";
    playerUI.options.innerHTML = "";

    const opts = q.opsi || [];
    opts.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;

      // FIX #7: { once: true } prevents double-fire from touchstart+click
      btn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          handleAnswer(playerId, opt, q.jawab, btn);
        },
        { passive: false, once: true }
      );

      btn.addEventListener("click", () => {
        handleAnswer(playerId, opt, q.jawab, btn);
      });

      playerUI.options.appendChild(btn);
    });
  }

  function handleAnswer(playerId, selected, correct, btnElement) {
    if (!state.isActive || state.isTransitioning) return;

    const playerUI = ui[playerId];
    if (!playerUI) return;

    const buttons = playerUI.options.querySelectorAll(".btn-option");
    buttons.forEach((b) => (b.disabled = true));

    const clean = (str) => String(str).trim().toLowerCase();
    const isCorrect =
      clean(selected) === clean(correct) ||
      clean(selected).includes(clean(correct));

    if (isCorrect) {
      state.isTransitioning = true;

      const otherPlayerId = playerId === "p1" ? "p2" : "p1";
      const otherUI = ui[otherPlayerId];
      if (otherUI) {
        const otherButtons = otherUI.options.querySelectorAll(".btn-option");
        otherButtons.forEach((b) => (b.disabled = true));
        if (otherUI.question) {
          otherUI.question.innerText = `⏳ Terlambat! ${playerId.toUpperCase()} Benar!`;
          otherUI.question.style.color = "#ffeb3b";
        }
      }

      btnElement.classList.add("correct");
      state[playerId].score += 10;

      try { AudioManager.playCorrect(); } catch (e) {}

      if (typeof ParticleManager !== "undefined") {
        const rect = btnElement.getBoundingClientRect();
        ParticleManager.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
      }
    } else {
      btnElement.classList.add("wrong");
      try { AudioManager.playWrong(); } catch (e) {}

      // Highlight correct answer for this player
      buttons.forEach((b) => {
        if (clean(b.innerText).includes(clean(correct))) {
          b.classList.add("correct");
        }
      });
    }

    updateScoreUI();

    if (isCorrect) {
      setTimeout(() => {
        state.currentIndex++;
        loadQuestion();
      }, 1000);
    } else {
      state[playerId].ready = true;
      checkRoundComplete();
    }
  }

  function checkRoundComplete() {
    if (state.p1.ready && state.p2.ready) {
      if (state.isTransitioning) return;
      state.isTransitioning = true;
      setTimeout(() => {
        state.currentIndex++;
        loadQuestion();
      }, 1000);
    }
  }

  function updateScoreUI() {
    if (ui.p1.score) ui.p1.score.innerText = state.p1.score;
    if (ui.p2.score) ui.p2.score.innerText = state.p2.score;
  }

  function endGame() {
    state.isActive = false;
    if (state._deadlockTimeout) {
      clearTimeout(state._deadlockTimeout);
      state._deadlockTimeout = null;
    }

    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.remove("hidden");

    const endP1 = document.getElementById("end-score-p1");
    const endP2 = document.getElementById("end-score-p2");
    if (endP1) endP1.innerText = state.p1.score;
    if (endP2) endP2.innerText = state.p2.score;

    let winnerText = "SERI! 🤝";
    let finalStatus = "Draw";

    if (state.p1.score > state.p2.score) {
      winnerText = "PEMENANG: PLAYER 1! 🏆";
      finalStatus = "Win";
    } else if (state.p2.score > state.p1.score) {
      winnerText = `🏆 PEMENANG: ${state.p2.name ? state.p2.name.toUpperCase() : "PLAYER 2"}!`;
      finalStatus = "Lose";
    }

    const winnerEl = document.getElementById("v-winner-text");
    if (winnerEl) winnerEl.innerText = winnerText;

    if (window.socket) {
      window.socket.emit("laporSkorVersusLokal", {
        game: "nabi",
        status: finalStatus,
        score: state.p1.score,
        p2Name: state.p2.name || "Guest",
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

  // PUBLIC: Cek apakah versus sedang aktif
  function isActive() {
    return state.isActive ||
      (document.getElementById('versus-result') &&
       !document.getElementById('versus-result').classList.contains('hidden'));
  }

  // PUBLIC: Restart versus tanpa Swal prompt
  function restart() {
    if (!state._originalQuestions || state._originalQuestions.length === 0) {
      exitVersus();
      return;
    }
    _startRound();
  }

  return {
    init,
    toggleRotation,
    exitVersus,
    rematch,
    isActive,
    restart,
  };
})();
