const VersusTajwid = (function () {
  const state = {
    isActive: false,
    questions: [],
    timerInterval: null,
    timeLeft: 60, // 60 seconds per round
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

  function init(data) {
    console.log("⚔️ VersusTajwid.init called. Raw data:", data);

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

    console.log("⚔️ VersusTajwid.init ready with", queue.length, "questions");
    state.questions = queue; // Shared queue source

    // Reset Player State
    state.p1 = { score: 0, index: 0, currentCard: null };
    state.p2 = { score: 0, index: 0, currentCard: null };
    state.timeLeft = 60;

    updateScoreUI();
    updateTimerUI();

    // Hide Solo UI
    document.getElementById("start-screen").classList.add("hidden");
    document.querySelector(".game-wrapper").style.display = "none";
    document.querySelector(".top-bar").style.display = "none";

    // Show Versus UI
    ui.container.classList.remove("hidden");
    ui.container.style.display = "flex"; // Force layout
    ui.container.style.zIndex = "100000"; // Force on top
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    // Start Game
    console.log("⚔️ VS UI Classes:", ui.container.className);
    startTimer();
    loadCard(1);
    loadCard(2);
  }

  function loadCard(playerId) {
    if (!state.isActive) return;

    const playerState = playerId === 1 ? state.p1 : state.p2;
    const uiArea = playerId === 1 ? ui.p1.cardArea : ui.p2.cardArea;

    // Verify index
    if (playerState.index >= state.questions.length) {
      playerState.index = 0; // Loop questions in Versus if run out
    }

    const cardData = state.questions[playerState.index];
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
  }

  function handleAnswer(playerId, side) {
    const pState = playerId === 1 ? state.p1 : state.p2;
    const card = pState.currentCard;

    if (!card) return;

    const isCorrect = side === card.hukum;

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
  }

  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    updateTimerUI();

    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      updateTimerUI();

      if (state.timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function updateTimerUI() {
    if (ui.timer) ui.timer.innerText = state.timeLeft;
  }

  function updateScoreUI() {
    if (ui.p1.score) ui.p1.score.innerText = state.p1.score;
    if (ui.p2.score) ui.p2.score.innerText = state.p2.score;
  }

  function endGame() {
    clearInterval(state.timerInterval);
    state.isActive = false;

    ui.container.classList.add("hidden");
    ui.resultScreen.classList.remove("hidden");

    // Determine Winner
    const p1s = state.p1.score;
    const p2s = state.p2.score;
    const winnerText = document.getElementById("v-winner-text");
    const finalP1 = document.getElementById("v-final-p1");
    const finalP2 = document.getElementById("v-final-p2");

    if (finalP1) finalP1.innerText = p1s;
    if (finalP2) finalP2.innerText = p2s;

    if (p1s > p2s) {
      winnerText.innerText = "🏆 PEMAIN 1 MENANG!";
    } else if (p2s > p1s) {
      winnerText.innerText = "🏆 PEMAIN 2 MENANG!";
    } else {
      winnerText.innerText = "🤝 SERI!";
    }

    // Play Sound
    if (typeof AudioManager !== "undefined") AudioManager.playWin();
  }

  // Public API
  return {
    init: init,
    handleInput: handleAnswer, // For bucket clicks
  };
})();
