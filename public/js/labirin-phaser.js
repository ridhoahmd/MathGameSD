// ============================================
// LABIRIN ILMU - VERSI PHASER
// Game Maze pake Phaser 3
// ============================================

// State & Socket
const socket = window.socket;
let playerName = localStorage.getItem("playerName") || "Guest";
let level = "mudah";
let cols, rows;
let size = 30;
let grid = [];
let current;
let stack = [];
let questions = [];
let score = 0;
let gameActive = false;
let finishNode;

// Variabel AI Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// Variabel Auto-Skip (Week 2 Bugfix)
let wrongAttempts = 0;
const MAX_WRONG_ATTEMPTS = 3;
const SKIP_PENALTY = 25; // REBALANCED: was 10

// Variabel Obstacle Completion (Finish Control)
let totalObstacles = 0;
let clearedObstacles = 0;

// Timer (for time bonus calculation - Labirin has no timer, default 0)
let timeLeft = 0;

// Point System (REBALANCED for fairness)
const POINTS_PER_OBSTACLE = 80; // was 20 → 4x increase
const FINISH_BONUS = 150; // was 50 → 3x increase
const TIME_BONUS_PER_30S = 30; // NEW: reward fast completion

// Elemen HTML
const tutorOverlay = document.getElementById("tutor-overlay");
const tutorText = document.getElementById("tutor-text");
const loadingScreen = document.getElementById("loading-screen");
const quizModal = document.getElementById("quiz-modal");

// Config Phaser
const config = {
  type: Phaser.AUTO,
  width: 600,
  height: 600,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 600,
    height: 600,
    // Maintain aspect ratio
    expandParent: false,
  },
};

// Variabel Game Phaser
let game;
let mazeGraphics;
let playerSprite;
let finishSprite;
let questionMarkers = [];
let cursors;
let moveCooldown = false;

// Tombol Level
document.querySelectorAll(".btn-difficulty").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-difficulty")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// Dengerin AI Tutor
if (socket) {
  socket.on("penjelasanTutor", (data) => {
    const textEl = document.getElementById("tutor-text");
    if (!textEl) return;

    const content = data.penjelasan || data.teks;
    textEl.innerHTML = content;
    textEl.style.opacity = 0;
    textEl.style.transition = "opacity 0.5s ease-in";
    setTimeout(() => {
      textEl.style.opacity = 1;
    }, 50);
  });
}

window.tutupTutorLabirin = function () {
  if (tutorOverlay) tutorOverlay.style.display = "none";
  if (quizModal) quizModal.style.display = "flex";
};

// Minta Game ke Server
window.requestGame = function () {
  if (socket) {
    socket.emit("mulaiGame", "labirin");
  }

  const btn = document.querySelector(".btn-start-game");
  if (btn) {
    btn.innerText = "⏳ MENGHUBUNGI SERVER...";
    btn.disabled = true;
  }

  tutorUsageCount = 0;

  const inputKodeKelas = document.getElementById("inputKodeKelas");
  const kodeAkses = inputKodeKelas
    ? inputKodeKelas.value.trim().toUpperCase()
    : "";

  socket.emit("mintaSoalAI", {
    kategori: "labirin",
    tingkat: level,
    kodeAkses: kodeAkses,
  });

  // Jaga-jaga kalo timeout
  setTimeout(() => {
    if (
      !gameActive &&
      loadingScreen &&
      loadingScreen.style.display !== "none"
    ) {
      if (btn) {
        btn.innerText = "🚀 MULAI MISI (RETRY)";
        btn.disabled = false;
      }
      alert("Server sedang sibuk. Silakan coba lagi.");
    }
  }, 10000);
};

// Pas data masuk
if (socket) {
  socket.on("soalDariAI", (response) => {
    if (loadingScreen) loadingScreen.style.display = "none";

    if (response && response.kategori === "labirin") {
      let info = response.data;
      if (Array.isArray(info)) info = info[0];

      cols = info.maze_size || 10;
      rows = info.maze_size || 10;
      questions = info.soal_list || [];

      // ✅ ENHANCED: Calculate size dynamically
      size = calculateOptimalSize();

      // Update Phaser config size
      config.width = Math.min(cols * size, 800); // Max width 800px
      config.height = Math.min(rows * size, 800); // Max height 800px
      config.scale.width = config.width;
      config.scale.height = config.height;

      // Initialize Phaser game
      initPhaserGame();
    } else {
      alert(response.error || "Gagal memuat soal. Coba lagi.");
      location.reload();
    }
  });
}

// ✅ ENHANCED SIZE CALCULATION FUNCTION
/**
 * Calculate optimal cell size for maze based on actual DOM layout
 * @returns {number} Cell size in pixels
 */
function calculateOptimalSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 1. Detect actual UI elements (tidak hardcode!)
  const header = document.querySelector(".game-header");
  const controls = document.querySelector(".game-controls");

  // Measure actual heights dengan fallback
  const headerHeight = header ? header.offsetHeight : 70;
  const controlsHeight = controls ? controls.offsetHeight : 100;

  // 2. Device detection untuk adaptive constraints
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const deviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  // 3. Safety margins (berbeda per device)
  const margins = {
    mobile: 20,
    tablet: 30,
    desktop: 40,
  };
  const margin = margins[deviceType];

  // 4. Calculate available space
  const availableWidth = vw - margin * 2;
  const availableHeight = vh - headerHeight - controlsHeight - margin * 2;

  // 5. Calculate cell size
  let cellSize = Math.floor(
    Math.min(availableWidth / cols, availableHeight / rows),
  );

  // 6. Device-adaptive constraints
  const constraints = {
    mobile: { min: 25, max: 50 },
    tablet: { min: 30, max: 70 },
    desktop: { min: 30, max: 80 },
  };

  const { min, max } = constraints[deviceType];
  cellSize = Math.max(min, Math.min(cellSize, max));

  // 7. Debug logging (helpful untuk troubleshooting)
  console.log(`📐 Layout Calculation:
    Viewport: ${vw}x${vh}
    Device: ${deviceType}
    Header: ${headerHeight}px
    Controls: ${controlsHeight}px
    Available: ${availableWidth}x${availableHeight}
    Cell Size: ${cellSize}px
    Canvas: ${cols * cellSize}x${rows * cellSize}`);

  return cellSize;
}

// Resize Dinamis
let resizeTimeout;
window.addEventListener("resize", () => {
  if (!gameActive) return;
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // ✅ Re-use the same calculation function
    const newSize = calculateOptimalSize();

    // Determine if significant change (avoid unnecessary reloads)
    if (Math.abs(newSize - size) > 2) {
      size = newSize;
      config.width = Math.min(cols * size, 800);
      config.height = Math.min(rows * size, 800);
      config.scale.width = config.width;
      config.scale.height = config.height;

      // Restart Phaser game to apply new config
      console.log("🔄 Reloading maze dengan ukuran baru...");
      initPhaserGame();
    }
  }, 500);
});

// ✅ ORIENTATION CHANGE SUPPORT (untuk mobile/tablet rotation)
let orientationTimeout;
window.addEventListener("orientationchange", () => {
  console.log("📱 Orientation changed, recalculating layout...");

  clearTimeout(orientationTimeout);

  // Wait for orientation to fully complete (browser quirk)
  orientationTimeout = setTimeout(() => {
    if (!gameActive) return;

    const newSize = calculateOptimalSize();

    // Check if size changed significantly
    if (Math.abs(newSize - size) > 5) {
      size = newSize;
      config.width = Math.min(cols * size, 800);
      config.height = Math.min(rows * size, 800);
      config.scale.width = config.width;
      config.scale.height = config.height;

      console.log("🔄 Reloading maze untuk orientasi baru...");
      initPhaserGame();
    }
  }, 300); // Delay sedikit biar DOM selesai update
});

// Mulai Phaser
function initPhaserGame() {
  if (game) {
    game.destroy(true);
  }

  score = 0;
  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.innerText = score;

  game = new Phaser.Game(config);
  gameActive = true;
}

// Preload (kosong gapapa)
function preload() {}

// Bikin Scene Phaser
function create() {
  const scene = this;

  // Background Grid matching maze cells
  this.add.grid(
    config.width / 2,
    config.height / 2,
    config.width,
    config.height,
    size,
    size,
    0x000000,
    0,
    0x1f4068,
    0.3,
  );

  // Create graphics for maze
  mazeGraphics = this.add.graphics();

  // Bikin Labirin (Algoritma DFS)
  generateMaze();

  // Gambar Labirin
  drawMaze(mazeGraphics);

  // Bikin Player
  createPlayer(scene);

  // Bikin Finish
  createFinish(scene);

  // Bikin Penanda Soal
  createQuestionMarkers(scene);

  // Input handling
  cursors = this.input.keyboard.createCursorKeys();

  // Dukungan WASD
  this.input.keyboard.on("keydown-W", () => movePlayer(0, -1, scene));
  this.input.keyboard.on("keydown-A", () => movePlayer(-1, 0, scene));
  this.input.keyboard.on("keydown-S", () => movePlayer(0, 1, scene));
  this.input.keyboard.on("keydown-D", () => movePlayer(1, 0, scene));

  // Tombol Panah
  this.input.keyboard.on("keydown-UP", () => movePlayer(0, -1, scene));
  this.input.keyboard.on("keydown-LEFT", () => movePlayer(-1, 0, scene));
  this.input.keyboard.on("keydown-DOWN", () => movePlayer(0, 1, scene));
  this.input.keyboard.on("keydown-RIGHT", () => movePlayer(1, 0, scene));

  // Swipe buat HP
  let touchStartX = 0;
  let touchStartY = 0;

  this.input.on("pointerdown", (pointer) => {
    touchStartX = pointer.x;
    touchStartY = pointer.y;
  });

  this.input.on("pointerup", (pointer) => {
    const dx = pointer.x - touchStartX;
    const dy = pointer.y - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) {
        movePlayer(dx > 0 ? 1 : -1, 0, scene);
      }
    } else {
      if (Math.abs(dy) > 30) {
        movePlayer(0, dy > 0 ? 1 : -1, scene);
      }
    }
  });

  // Store scene reference
  this.gameScene = scene;
}

// Update loop Phaser
function update() {
  if (!gameActive) return;

  // Pulse effect for finish
  if (finishSprite) {
    const pulse = Math.sin(this.time.now / 200) * 0.1 + 1;
    finishSprite.setScale(pulse);
  }

  // Pulse effect for question markers
  questionMarkers.forEach((marker) => {
    if (marker.active) {
      const pulse = Math.sin(this.time.now / 300) * 0.1 + 1;
      marker.setScale(pulse);
    }
  });
}

// Bikin Labirin (Algoritma DFS)
function generateMaze() {
  grid = [];
  stack = [];

  // Bikin kotak-kotaknya
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grid.push({
        i: i,
        j: j,
        walls: [true, true, true, true], // top, right, bottom, left
        visited: false,
        isQuestion: false,
        questionData: null,
      });
    }
  }

  // Jalanin DFS
  current = grid[0];
  current.visited = true;
  finishNode = grid[grid.length - 1];

  let processing = true;
  while (processing) {
    const next = checkNeighbors(current);
    if (next) {
      next.visited = true;
      stack.push(current);
      removeWalls(current, next);
      current = next;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      processing = false;
    }
  }

  // Taro soal secara acak
  let qIndex = 0;
  const shuffledIndices = Array.from({ length: grid.length }, (_, i) => i).sort(
    () => Math.random() - 0.5,
  );

  // Reset obstacle counter
  totalObstacles = 0;
  clearedObstacles = 0;

  for (const i of shuffledIndices) {
    if (i > 0 && i < grid.length - 1 && qIndex < questions.length) {
      if (Math.random() < 0.3) {
        grid[i].isQuestion = true;
        grid[i].questionData = questions[qIndex];
        totalObstacles++; // Track total obstacles
        qIndex++;
      }
    }
  }

  // Balik ke awal
  current = grid[0];
}

function index(i, j) {
  if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
  return i + j * cols;
}

function checkNeighbors(cell) {
  const neighbors = [];
  const top = grid[index(cell.i, cell.j - 1)];
  const right = grid[index(cell.i + 1, cell.j)];
  const bottom = grid[index(cell.i, cell.j + 1)];
  const left = grid[index(cell.i - 1, cell.j)];

  if (top && !top.visited) neighbors.push(top);
  if (right && !right.visited) neighbors.push(right);
  if (bottom && !bottom.visited) neighbors.push(bottom);
  if (left && !left.visited) neighbors.push(left);

  if (neighbors.length > 0) {
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  }
  return undefined;
}

function removeWalls(a, b) {
  const x = a.i - b.i;
  if (x === 1) {
    a.walls[3] = false;
    b.walls[1] = false;
  }
  if (x === -1) {
    a.walls[1] = false;
    b.walls[3] = false;
  }

  const y = a.j - b.j;
  if (y === 1) {
    a.walls[0] = false;
    b.walls[2] = false;
  }
  if (y === -1) {
    a.walls[2] = false;
    b.walls[0] = false;
  }
}

// === DRAW MAZE ===
// === DRAW MAZE ===
function drawMaze(graphics) {
  graphics.clear();

  // 1. Draw Glow (Super Thick)
  graphics.lineStyle(12, 0x00f2ff, 0.5);
  drawWalls(graphics);

  // 2. Draw Core (Thin, bright)
  graphics.lineStyle(2, 0xffffff, 1);
  drawWalls(graphics);
}

function drawWalls(graphics) {
  for (const cell of grid) {
    const x = cell.i * size;
    const y = cell.j * size;

    if (cell.walls[0]) {
      // Top
      graphics.beginPath();
      graphics.moveTo(x, y);
      graphics.lineTo(x + size, y);
      graphics.strokePath();
    }
    if (cell.walls[1]) {
      // Right
      graphics.beginPath();
      graphics.moveTo(x + size, y);
      graphics.lineTo(x + size, y + size);
      graphics.strokePath();
    }
    if (cell.walls[2]) {
      // Bottom
      graphics.beginPath();
      graphics.moveTo(x + size, y + size);
      graphics.lineTo(x, y + size);
      graphics.strokePath();
    }
    if (cell.walls[3]) {
      // Left
      graphics.beginPath();
      graphics.moveTo(x, y + size);
      graphics.lineTo(x, y);
      graphics.strokePath();
    }
  }
}

// === CREATE PLAYER ===
// === CREATE PLAYER ===
function createPlayer(scene) {
  const x = current.i * size + size / 2;
  const y = current.j * size + size / 2;

  // Particle Trail
  const particles = scene.add.particles(0, 0, "player", {
    speed: 10,
    scale: { start: 0.5, end: 0 },
    blendMode: "ADD",
    lifespan: 200,
    frequency: 50,
    follow: null, // Will attach to sprite
  });

  // Create player texture (Glowing Orb)
  const playerGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  playerGraphics.fillStyle(0x00ffff, 0.4); // Glow
  playerGraphics.fillCircle(size / 2, size / 2, size / 2.5);
  playerGraphics.fillStyle(0xffffff, 1); // Core
  playerGraphics.fillCircle(size / 2, size / 2, size / 4);
  playerGraphics.generateTexture("player", size, size);

  playerSprite = scene.add.sprite(x, y, "player");
  playerSprite.setDepth(10);

  particles.startFollow(playerSprite);

  // Idle Animation (Pulse)
  scene.tweens.add({
    targets: playerSprite,
    scale: { from: 1, to: 1.1 },
    alpha: { from: 0.8, to: 1 },
    duration: 600,
    yoyo: true,
    repeat: -1,
  });
}

// === CREATE FINISH ===
function createFinish(scene) {
  const x = finishNode.i * size + size / 2;
  const y = finishNode.j * size + size / 2;

  // Finish Zone graphic
  const finishGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  finishGraphics.fillStyle(0x00ff00, 0.3);
  finishGraphics.fillCircle(size / 2, size / 2, size / 2.2); // Outer ring
  finishGraphics.lineStyle(2, 0x00ff00, 1);
  finishGraphics.strokeCircle(size / 2, size / 2, size / 2.2);
  finishGraphics.generateTexture("finish", size, size);

  finishSprite = scene.add.sprite(x, y, "finish");
  finishSprite.setDepth(5);

  // Rotating 'Portal' effect
  scene.tweens.add({
    targets: finishSprite,
    angle: 360,
    duration: 3000,
    repeat: -1,
  });

  // Flag Icon
  scene.add
    .text(x, y, "🏁", {
      fontSize: size / 2 + "px",
    })
    .setOrigin(0.5)
    .setDepth(6);
}

// === CREATE QUESTION MARKERS ===
function createQuestionMarkers(scene) {
  questionMarkers = [];

  for (const cell of grid) {
    if (cell.isQuestion) {
      const x = cell.i * size + size / 2;
      const y = cell.j * size + size / 2;

      // Animated Square Shape (Modified)
      const markerGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
      markerGraphics.lineStyle(2, 0xff00cc, 1);
      markerGraphics.fillStyle(0xff00cc, 0.5);
      markerGraphics.strokeRect(
        size * 0.25,
        size * 0.25,
        size * 0.5,
        size * 0.5,
      );
      markerGraphics.fillRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
      markerGraphics.generateTexture(
        "question_" + cell.i + "_" + cell.j,
        size,
        size,
      );

      const marker = scene.add.sprite(
        x,
        y,
        "question_" + cell.i + "_" + cell.j,
      );
      marker.setDepth(5);
      marker.cellIndex = index(cell.i, cell.j);

      // Rotating Animation
      scene.tweens.add({
        targets: marker,
        angle: 360,
        duration: 2000,
        repeat: -1,
      });

      // Flashing "!"
      const text = scene.add
        .text(x, y, "!", {
          fontFamily: "Arial",
          fontSize: size / 2 + "px",
          fontStyle: "bold",
          color: "#fff",
        })
        .setOrigin(0.5)
        .setDepth(6);

      marker.textObj = text; // Link text to marker for cleanup
      questionMarkers.push(marker);
    }
  }
}

// === MOVE PLAYER ===
let pendingNode = null;

function movePlayer(dx, dy, scene) {
  if (!gameActive || moveCooldown) return;

  let next;
  let blocked = false;

  if (dx === 1) {
    if (current.walls[1]) blocked = true;
    else next = grid[index(current.i + 1, current.j)];
  } else if (dx === -1) {
    if (current.walls[3]) blocked = true;
    else next = grid[index(current.i - 1, current.j)];
  } else if (dy === 1) {
    if (current.walls[2]) blocked = true;
    else next = grid[index(current.i, current.j + 1)];
  } else if (dy === -1) {
    if (current.walls[0]) blocked = true;
    else next = grid[index(current.i, current.j - 1)];
  }

  if (!blocked && next) {
    if (next.isQuestion) {
      openQuiz(next);
    } else {
      // Move player
      current = next;
      moveCooldown = true;

      // CRITICAL: Safety timeout untuk unlock
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        moveCooldown = false; // Force unlock after 1s
      }, 1000);

      const targetX = current.i * size + size / 2;
      const targetY = current.j * size + size / 2;

      scene.tweens.add({
        targets: playerSprite,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: "Power2",
        onComplete: () => {
          clearTimeout(moveTimeout); // Clear safety timeout
          moveCooldown = false;
          checkFinish();
        },
      });
    }
  }
}

// === QUIZ FUNCTIONS ===
let moveTimeout = null; // Safety timeout

function openQuiz(node) {
  gameActive = false;
  pendingNode = node;

  // RESET wrong attempts untuk quiz baru
  wrongAttempts = 0;

  // CRITICAL: Pause Phaser scene
  if (game && game.scene.scenes[0]) {
    game.scene.scenes[0].scene.pause();
  }

  if (quizModal) {
    quizModal.style.display = "flex";

    const title = document.querySelector("#quiz-modal h2");
    if (title) {
      title.innerText = "RINTANGAN!";
      title.style.color = "#ff00cc";
    }

    const qText = document.getElementById("q-text");
    if (qText) {
      qText.innerText = node.questionData.tanya;
      qText.style.color = "white";
    }

    const input = document.getElementById("q-input");
    if (input) {
      input.value = "";
      input.style.display = "block";
      input.focus();
    }

    const submitBtn = document.querySelector(".btn-submit-answer");
    if (submitBtn) {
      submitBtn.innerText = "CEK JAWABAN";
      submitBtn.onclick = checkQuiz;
    }
  }
}

window.checkQuiz = function () {
  const userAns = document.getElementById("q-input").value.toLowerCase().trim();
  const correct = pendingNode.questionData.jawab.toLowerCase().trim();

  const title = document.querySelector("#quiz-modal h2");
  const qText = document.getElementById("q-text");

  if (
    userAns === correct ||
    (correct.includes(userAns) && userAns.length > 1)
  ) {
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    if (title) {
      title.innerText = "✅ RINTANGAN HANCUR!";
      title.style.color = "#00ff00";
    }
    if (qText) qText.innerText = "Jalan terbuka...";

    setTimeout(() => {
      if (quizModal) quizModal.style.display = "none";
      pendingNode.isQuestion = false;

      // Remove marker
      const markerToRemove = questionMarkers.find(
        (m) => m.cellIndex === index(pendingNode.i, pendingNode.j),
      );
      if (markerToRemove) markerToRemove.destroy();

      score += POINTS_PER_OBSTACLE; // REBALANCED: was hardcoded 20
      const scoreEl = document.getElementById("score");
      if (scoreEl) scoreEl.innerText = score;

      // Increment cleared obstacles counter
      clearedObstacles++;

      current = pendingNode;

      // Move player
      const scene = game.scene.scenes[0];
      const targetX = current.i * size + size / 2;
      const targetY = current.j * size + size / 2;

      scene.tweens.add({
        targets: playerSprite,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: "Power2",
      });

      gameActive = true;

      // Resume scene after quiz
      setTimeout(() => {
        if (game && game.scene.scenes[0]) {
          game.scene.scenes[0].scene.resume();
        }
      }, 1500);

      checkFinish();
    }, 1000);
  } else {
    try {
      AudioManager.playWrong();
    } catch (e) {}

    if (tutorUsageCount < MAX_TUTOR_USAGE) {
      tutorUsageCount++;

      if (quizModal) quizModal.style.display = "none";

      if (tutorOverlay) {
        tutorOverlay.style.display = "flex";
        if (tutorText) {
          tutorText.innerHTML = `
            <div class="tutor-loading-box">
              <div class="loader-spinner"></div>
              <span class="loading-text">GURU SEDANG MEMBACA PETA...</span>
              <div style="margin-top: 8px; font-size: 0.85rem; color: #ffd700;">
                (Sisa Bantuan: ${MAX_TUTOR_USAGE - tutorUsageCount})
              </div>
            </div>
          `;
        }
      }

      socket.emit("mintaPenjelasan", {
        game: "labirin",
        soal: document.getElementById("q-text").innerText,
        jawabanUser: userAns,
        jawabanBenar: correct,
      });
    } else {
      if (title) {
        title.innerText = "❌ SALAH! (Bantuan Habis)";
        title.style.color = "red";
      }
      if (qText) {
        qText.style.color = "#ff6b6b";
        qText.innerText = "Coba lagi ya...";
      }

      document.getElementById("q-input").value = "";

      setTimeout(() => {
        if (title) {
          title.innerText = "RINTANGAN!";
          title.style.color = "#ff00cc";
        }
        if (qText) {
          qText.style.color = "white";
          qText.innerText = pendingNode.questionData.tanya;
        }
      }, 1500);
    }
  }
};

// === AUTO-SKIP OBSTACLE FUNCTION (Week 2 Bugfix) ===
function autoSkipObstacle() {
  // Apply penalty
  score = Math.max(0, score - SKIP_PENALTY); // REBALANCED: was 10
  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.innerText = score;

  // Show skip notification
  showTemporaryNotification(
    `⚠️ Rintangan Dilewati<br>-${SKIP_PENALTY} Poin<br><small>Setelah ${MAX_WRONG_ATTEMPTS}x salah</small>`,
    "warning",
  );

  // Reset counter
  wrongAttempts = 0;

  // Close modals
  if (quizModal) quizModal.style.display = "none";
  if (tutorOverlay) tutorOverlay.style.display = "none";

  // Mark obstacle sebagai passed
  if (pendingNode) {
    pendingNode.isQuestion = false;

    // Remove marker
    const markerToRemove = questionMarkers.find(
      (m) => m.cellIndex === index(pendingNode.i, pendingNode.j),
    );
    if (markerToRemove) {
      markerToRemove.destroy();
      if (markerToRemove.textObj) markerToRemove.textObj.destroy();
    }

    // Increment cleared obstacles (meski di-skip)
    clearedObstacles++;

    // Move player
    current = pendingNode;

    const scene = game.scene.scenes[0];
    const targetX = current.i * size + size / 2;
    const targetY = current.j * size + size / 2;

    scene.tweens.add({
      targets: playerSprite,
      x: targetX,
      y: targetY,
      duration: 150,
      ease: "Power2",
    });
  }

  // Resume game
  gameActive = true;
  setTimeout(() => {
    if (game && game.scene.scenes[0]) {
      game.scene.scenes[0].scene.resume();
    }
  }, 500);

  checkFinish();
}

// Konfirmasi manual skip (tombol Exit)
window.confirmSkipObstacle = function () {
  const confirmed = confirm(
    `Lewati rintangan ini?\n\nPenalty: -${SKIP_PENALTY} poin\n\nAnda yakin?`,
  );

  if (confirmed) {
    autoSkipObstacle();
  }
};

// Helper untuk notification
function showTemporaryNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `skip-notification ${type}`;
  notification.innerHTML = message;
  document.body.appendChild(notification);

  // Auto-remove
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => notification.remove(), 500);
  }, 2500);
}

// === CHECK FINISH ===
function checkFinish() {
  if (current === finishNode) {
    // CRITICAL FIX: Only finish if all obstacles cleared
    if (clearedObstacles < totalObstacles) {
      // Show warning message
      showTemporaryNotification(
        `⚠️ Selesaikan Rintangan!<br><small>${clearedObstacles}/${totalObstacles} Selesai</small>`,
        "warning",
      );
      return; // Don't finish yet
    }

    // All obstacles cleared, game complete!
    try {
      AudioManager.playWin();
    } catch (e) {}

    // REBALANCED: Calculate time bonus (reward fast completion)
    const timeRemaining = Math.max(0, timeLeft || 0);
    const timeBonus = Math.floor(timeRemaining / 30) * TIME_BONUS_PER_30S;

    score += FINISH_BONUS + timeBonus; // REBALANCED: was 50, now 150 + time bonus
    gameActive = false;

    socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "labirin",
    });

    if (game && game.scene.scenes[0]) {
      game.scene.scenes[0].scene.pause();
    }

    if (quizModal) {
      quizModal.style.display = "flex";

      const title = document.querySelector("#quiz-modal h2");
      if (title) {
        title.innerText = "🎯 MISI SELESAI!";
        title.style.color = "#00ff00";
      }

      const qText = document.getElementById("q-text");
      if (qText) {
        qText.innerText = `Skor Akhir: ${score}`;
        if (timeBonus > 0) {
          qText.innerText += `\n⏱️ Bonus Waktu: +${timeBonus}`;
        }
      }

      const input = document.getElementById("q-input");
      if (input) input.style.display = "none";

      const submitBtn = document.querySelector(".btn-submit-answer");
      if (submitBtn) {
        submitBtn.innerText = "KEMBALI KE MENU";
        submitBtn.onclick = function () {
          window.location.href = "/";
        };
      }

      // Hide skip button di game over
      const skipBtn = document.querySelector(".btn-skip-quiz");
      if (skipBtn) skipBtn.style.display = "none";
    }
  }
}

// === CONTROL BUTTONS (Mobile) ===
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn-ctrl").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!game || !game.scene.scenes[0]) return;
      const scene = game.scene.scenes[0];
      const direction = btn.innerText;

      if (direction === "▲") movePlayer(0, -1, scene);
      else if (direction === "▶") movePlayer(1, 0, scene);
      else if (direction === "▼") movePlayer(0, 1, scene);
      else if (direction === "◀") movePlayer(-1, 0, scene);
    });
  });
});
