/**
 * VersusTajwid — Tajwid 1v1 Split Screen
 *
 * Fixes applied:
 *  - Client-side setInterval timer REMOVED (was cheatable via DevTools)
 *  - Timer is now driven by server-side tajwidTimerTick events
 *  - Each answer is reported to the server via submitTajwidAnswer for
 *    server-side score tracking and validation
 *  - Game end is triggered by tajwidGameEnded from the server
 *  - submitTajwidGameResult persists the result to the database
 *  - Disconnect cleanup stops any lingering state
 */
const VersusTajwid = (function () {
  const state = {
    isActive: false,
    questionsP1: [],
    questionsP2: [],
    // timerInterval removed — timer is now server-authoritative
    timeLeft: 60, // display-only; updated by server ticks
    roomId: null,  // unique room id sent to server when game starts
    gameStartTime: null,
    p1: { score: 0, currentCard: null, index: 0 },
    p2: { score: 0, currentCard: null, index: 0 },
  };

  const ui = {
    container: null,
    resultScreen: null,
    timer: null,
    p1: { score: null, card: null, buckets: null },
    p2: { score: null, card: null, buckets: null },
  };

  // Sound Effects (reuse existing)
  const sounds = {
    correct:
      typeof AudioManager !== "undefined" ? AudioManager.playCorrect : () => {},
    wrong:
      typeof AudioManager !== "undefined" ? AudioManager.playWrong : () => {},
    win: typeof AudioManager !== "undefined" ? AudioManager.playWin : () => {},
  };

  function exitVersus() {
    state.isActive = false;

    // Remove server-side timer listeners
    if (window.socket) {
      window.socket.off("tajwidTimerTick");
      window.socket.off("tajwidGameEnded");
    }

    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");
    
    // Cleanup DOM specifically for versus
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
        startScreen.classList.remove("hidden");
        startScreen.classList.add("active");
    }
    
    // Restore elements hidden during init
    const gameWrapper = document.querySelector(".game-wrapper");
    if (gameWrapper) gameWrapper.style.display = "";
    
    const topBar = document.querySelector(".top-bar");
    if (topBar) topBar.style.display = "";
  }

  function init(data) {
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
      state.p2.name = (result.value || "Guest").trim();
      

      if (!ui.container) {
        ui.container = document.getElementById("versus-container");
        ui.resultScreen = document.getElementById("versus-result");
        ui.timer = document.getElementById("v-timer");

        // P1 UI
        ui.p1.score = document.getElementById("v-p1-score");
        ui.p1.cardArea = document.getElementById("v-p1-card-area");
        ui.p1.buckets = {
          left: document.querySelector(
            "#versus-container .p1-area .v-bucket.left",
          ),
          right: document.querySelector(
            "#versus-container .p1-area .v-bucket.right",
          ),
        };

        // P2 UI
        ui.p2.score = document.getElementById("v-p2-score");
        ui.p2.cardArea = document.getElementById("v-p2-card-area");
        ui.p2.buckets = {
          left: document.querySelector(
            "#versus-container .p2-area .v-bucket.left",
          ),
          right: document.querySelector(
            "#versus-container .p2-area .v-bucket.right",
          ),
        };
      }

      // Reset State
      state.isActive = true;

      // Normalize Data: Ensure it's an array of objects
      let queue = [];
      if (data.data && Array.isArray(data.data)) {
        queue = data.data; // Object format used in Solo
        // Update Bucket Labels from Category Data
        if (data.kategori_kiri && data.kategori_kanan) {
          if (ui.p1.buckets.left)
            ui.p1.buckets.left.innerText = data.kategori_kiri;
          if (ui.p1.buckets.right)
            ui.p1.buckets.right.innerText = data.kategori_kanan;

          if (ui.p2.buckets.left)
            ui.p2.buckets.left.innerText = data.kategori_kiri;
          if (ui.p2.buckets.right)
            ui.p2.buckets.right.innerText = data.kategori_kanan;
        }
      } else if (Array.isArray(data)) {
        queue = data; // Direct array
      } else {
        console.error("VersusTajwid: Invalid data format", data);
        return;
      }

      // Shuffle function
      const shuffleArray = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      state.questionsP1 = shuffleArray(queue);
      state.questionsP2 = shuffleArray(queue);

      // Reset Player State
      state.p1 = { score: 0, index: 0, currentCard: null };
      
      // Preserve the name we just set for P2
      const guestName = state.p2.name;
      state.p2 = { score: 0, index: 0, currentCard: null, name: guestName };
      state.timeLeft = 60;

      updateScoreUI();
      updateTimerUI();

      // Hide Solo UI
      const startScreen = document.getElementById("start-screen");
      if (startScreen) {
          startScreen.classList.remove("active");
          startScreen.classList.add("hidden");
      }
      
      const gameWrapper = document.querySelector(".game-wrapper");
      if (gameWrapper) gameWrapper.style.display = "none";
      
      const topBar = document.querySelector(".top-bar");
      if (topBar) topBar.style.display = "none";

      // Show Versus UI
      if (ui.container) {
        ui.container.classList.remove("hidden");
        ui.container.style.display = "flex"; // Force layout
        ui.container.style.zIndex = "100000"; // Force on top
      }
      if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

      // Generate a unique room id for this game session
      state.roomId = `tajwid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      state.gameStartTime = Date.now();

      // Register server-side timer listeners before starting
      registerSocketListeners();

      // Tell the server to start the authoritative timer
      if (window.socket) {
        window.socket.emit("startTajwidVersusGame", {
          roomId: state.roomId,
          p2Name: state.p2.name || "Guest",
          duration: 60,
        });
      }

      // Start Game
      loadCard(1);
      loadCard(2);
    });
  }

  /**
   * Register (or re-register) socket event listeners for the server-side timer.
   * Uses .off() first to prevent duplicate listeners on rematch.
   */
  function registerSocketListeners() {
    if (!window.socket) return;

    window.socket.off("tajwidTimerTick");
    window.socket.off("tajwidGameEnded");

    // Server sends a tick every second with the authoritative time remaining
    window.socket.on("tajwidTimerTick", (data) => {
      if (!state.isActive) return;
      state.timeLeft = data.timeLeft;
      updateTimerUI();
    });

    // Server fires this when the timer reaches zero
    window.socket.on("tajwidGameEnded", (data) => {
      if (!state.isActive) return;
      // Use server-provided scores if available (they were validated server-side)
      if (data && typeof data.p1Score === "number") state.p1.score = data.p1Score;
      if (data && typeof data.p2Score === "number") state.p2.score = data.p2Score;
      endGame(true); // true = triggered by server
    });
  }

  function loadCard(playerId) {
    if (!state.isActive) return;

    const playerState = playerId === 1 ? state.p1 : state.p2;
    const uiArea = playerId === 1 ? ui.p1.cardArea : ui.p2.cardArea;

    const playerQuestions = playerId === 1 ? state.questionsP1 : state.questionsP2;
    
    // Verify index
    if (playerState.index >= playerQuestions.length) {
      playerState.index = 0; // Loop questions in Versus if run out
    }

    const cardData = playerQuestions[playerState.index];
    playerState.currentCard = cardData;

    // Create Card Element
    uiArea.innerHTML = ""; // Clear previous
    const card = document.createElement("div");
    card.className = "v-card glass-panel";
    card.innerText = cardData.teks || "Error";

    // Setup Drag/Touch events specifically for this card
    setupCardInput(card, playerId);

    uiArea.appendChild(card);
  }

  function setupCardInput(card, playerId) {
    let startX = 0;
    let isDragging = false;

    // Touch Events
    card.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        card.style.transition = "none";
      },
      { passive: true },
    );

    card.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diffX = currentX - startX;
        const rotate = diffX / 10;

        // P2 is rotated 180deg, so swipe directions visually might be tricky
        // But logic relies on screen coordinates.
        // Note: For P2 (Rotated), 'Left' visual is actually Screen Right?
        // Let's rely on raw X diff.
        // CSS handles visual rotation of the container.
        // Inputs are relative to screen.

        card.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
      },
      { passive: true },
    );

    card.addEventListener("touchend", (e) => {
      if (!isDragging) return;
      isDragging = false;

      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;
      const threshold = 50;

      card.style.transition = "transform 0.3s ease";

      if (diffX > threshold) {
        handleAnswer(playerId, "kanan");
      } else if (diffX < -threshold) {
        handleAnswer(playerId, "kiri");
      } else {
        card.style.transform = "translateX(0) rotate(0deg)";
      }
    });

    // Mouse Events for PC Testing
    card.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      isDragging = true;
      card.style.transition = "none";
    });

    const handleMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      const endX = e.clientX;
      const diffX = endX - startX;
      const threshold = 50;

      card.style.transition = "transform 0.3s ease";

      if (diffX > threshold) {
        handleAnswer(playerId, "kanan");
      } else if (diffX < -threshold) {
        handleAnswer(playerId, "kiri");
      } else {
        card.style.transform = "translateX(0) rotate(0deg)";
      }
    };

    card.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const diffX = currentX - startX;
      const rotate = diffX / 10;
      card.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    });

    card.addEventListener("mouseup", handleMouseUp);
    card.addEventListener("mouseleave", handleMouseUp);
  }

  function handleAnswer(playerId, side) {
    const pState = playerId === 1 ? state.p1 : state.p2;
    const card = pState.currentCard;

    if (!card) return;

    const isCorrect = side === card.hukum;
    const scoreDelta = isCorrect ? 10 : -5;

    if (isCorrect) {
      pState.score += 10;

      if (typeof sounds.correct === "function") sounds.correct(); // Play Sound
      // Correct Animation
      const cardEl =
        playerId === 1 ? ui.p1.cardArea.firstChild : ui.p2.cardArea.firstChild;
      if (cardEl) {
        cardEl.classList.add("correct-flash");
        const moveX = side === "kanan" ? 500 : -500;
        cardEl.style.transform = `translateX(${moveX}px) rotate(${moveX / 10}deg) scale(0)`;
      }

      // 💥 Particle Burst
      if (typeof ParticleManager !== "undefined") ParticleManager.burst(window.innerWidth / 2, window.innerHeight / 2, 40);

      setTimeout(() => {
        pState.index++;
        loadCard(playerId);
      }, 300);
    } else {
      pState.score = Math.max(0, pState.score - 5); // Penalty
      if (typeof sounds.wrong === "function") sounds.wrong();

      const cardEl =
        playerId === 1 ? ui.p1.cardArea.firstChild : ui.p2.cardArea.firstChild;
      if (cardEl) {
        cardEl.classList.add("wrong-flash");
        setTimeout(() => cardEl.classList.remove("wrong-flash"), 400);
      }
    }

    updateScoreUI();

    // Report answer to server for authoritative score tracking
    if (window.socket && state.roomId) {
      window.socket.emit("submitTajwidAnswer", {
        roomId: state.roomId,
        playerId,
        isCorrect,
        scoreDelta,
      });
    }
  }

  function updateTimerUI() {
    if (ui.timer) ui.timer.innerText = state.timeLeft;
  }

  function updateScoreUI() {
    if (ui.p1.score) ui.p1.score.innerText = state.p1.score;
    if (ui.p2.score) ui.p2.score.innerText = state.p2.score;
  }

  /**
   * End the game and show results.
   * @param {boolean} [serverTriggered=false] - true when called from tajwidGameEnded socket event
   */
  function endGame(serverTriggered = false) {
    if (!state.isActive) return; // Guard against double-call
    state.isActive = false;

    // Remove socket listeners to prevent stale callbacks
    if (window.socket) {
      window.socket.off("tajwidTimerTick");
      window.socket.off("tajwidGameEnded");
    }

    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.remove("hidden");

    // Determine Winner
    const p1s = state.p1.score;
    const p2s = state.p2.score;
    const winnerText = document.getElementById("v-winner-text");
    const finalP1 = document.getElementById("v-final-p1");
    const finalP2 = document.getElementById("v-final-p2");

    if (finalP1) finalP1.innerText = p1s;
    if (finalP2) finalP2.innerText = p2s;

    let finalStatus = "Draw";

    if (p1s > p2s) {
      if (winnerText) winnerText.innerText = "🏆 PEMAIN 1 MENANG!";
      finalStatus = "Win";
    } else if (p2s > p1s) {
      if (winnerText) winnerText.innerText = `🏆 ${state.p2.name ? state.p2.name.toUpperCase() : 'PEMAIN 2'} MENANG!`;
      finalStatus = "Lose";
    } else {
      if (winnerText) winnerText.innerText = "🤝 SERI!";
    }

    const durationMs = state.gameStartTime ? Date.now() - state.gameStartTime : null;

    // Submit result to server for persistence and final validation
    // Use submitTajwidGameResult (dedicated handler) instead of laporSkorVersusLokal
    // so the server can cross-check against its own tracked scores.
    if (window.socket) {
      window.socket.emit("submitTajwidGameResult", {
        roomId: state.roomId,
        p1Score: p1s,
        p2Score: p2s,
        p2Name: state.p2.name || "Guest",
        durationMs,
      });
    }

    // Play Sound
    if (typeof AudioManager !== "undefined") AudioManager.playWin();
  }

  // Expose global restart method for no-reload retry
  window.restartGame = function() {
    if (!state.questionsP1 || state.questionsP1.length === 0) {
      console.warn("No questions available for restart. Escaping.");
      exitVersus();
      return;
    }

    // Reset state but keep questions and p2 name
    state.isActive = true;
    state.timeLeft = 60;
    state.roomId = `tajwid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    state.gameStartTime = Date.now();

    const guestName = state.p2.name;
    state.p1 = { score: 0, index: 0, currentCard: null };
    state.p2 = { score: 0, index: 0, currentCard: null, name: guestName };

    updateScoreUI();
    updateTimerUI();

    // Reset UI visibility
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");
    if (ui.container) {
      ui.container.classList.remove("hidden");
      ui.container.style.display = "flex";
    }

    // Re-register socket listeners and start server-side timer
    registerSocketListeners();
    if (window.socket) {
      window.socket.emit("startTajwidVersusGame", {
        roomId: state.roomId,
        p2Name: guestName || "Guest",
        duration: 60,
      });
    }

    loadCard(1);
    loadCard(2);
  };

  // Clean up on disconnect
  if (window.socket) {
    window.socket.on("disconnect", () => {
      state.isActive = false;
      if (window.socket) {
        window.socket.off("tajwidTimerTick");
        window.socket.off("tajwidGameEnded");
      }
    });
  }

  // Public API
  return {
    init: init,
    handleInput: handleAnswer, // For bucket clicks
    exitVersus: exitVersus,   // BUG-05 FIX: expose exitVersus agar tombol keluar berfungsi
  };
})();
