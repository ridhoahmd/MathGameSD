// LABIRIN ILMU - VERSI PHASER (REFACTORED & ENHANCED)
// Game Maze pake Phaser 3 dengan Class Architecture
// ============================================

// ==========================================
// 0. UI HELPERS (DOM-based, non-blocking)
// ==========================================

/**
 * UI-FIX: Pengganti alert() untuk jawaban salah.
 * Menampilkan toast animasi in-game yang tidak memblokir Phaser loop.
 * @param {number} remaining - Sisa kesempatan jawab
 * @param {string} playerKey - "p1" atau "p2" (untuk warna toast)
 */
function showWrongAnswerToast(remaining, playerKey) {
  // Hapus toast lama jika masih ada (avoid stacking)
  const old = document.getElementById("wrong-answer-toast");
  if (old) old.remove();

  const isP2 = playerKey === "p2";
  const accentColor = isP2 ? "#ff00cc" : "#ff4444";
  const label = isP2 ? "PLAYER 2" : "PLAYER 1";

  const toast = document.createElement("div");
  toast.id = "wrong-answer-toast";
  toast.className = "wrong-answer-toast";
  toast.innerHTML = `
    <div class="wrong-toast-icon">❌</div>
    <div class="wrong-toast-body">
      <div class="wrong-toast-title" style="color:${accentColor}">${label}: Jawaban Salah!</div>
      <div class="wrong-toast-sub">Kesempatan tersisa: <strong>${remaining}</strong> kali lagi</div>
    </div>
  `;

  // Posisi: kiri untuk P1, kanan untuk P2 (agar tidak overlap di versus)
  toast.style.cssText = `
    position: fixed;
    ${isP2 ? "right: 20px" : "left: 20px"};
    top: 80px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(20,5,5,0.97), rgba(40,0,0,0.97));
    border: 2px solid ${accentColor};
    border-radius: 14px;
    padding: 14px 22px;
    box-shadow: 0 0 30px ${accentColor}55, 0 8px 20px rgba(0,0,0,0.6);
    font-family: Poppins, sans-serif;
    color: white;
    max-width: 280px;
    transform: translateX(${isP2 ? "130%" : "-130%"});
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease;
    opacity: 0;
    pointer-events: none;
  `;

  document.body.appendChild(toast);

  // Slide in
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity = "1";
  });

  // Slide out after 2.2s
  setTimeout(() => {
    toast.style.transform = `translateX(${isP2 ? "130%" : "-130%"})`;
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 350);
  }, 2200);
}

// ==========================================
// 1. CLASS DEFINITION: LabirinScene
// ==========================================
class LabirinScene extends Phaser.Scene {
  constructor() {
    super({ key: "LabirinScene" });

    // STATE: Validasi variabel global pindah ke sini
    this.grid = [];
    this.stack = [];
    this.players = { p1: null, p2: null };
    this.score = { p1: 0, p2: 0 };
    this.config = { cols: 10, rows: 10, size: 30 };
    this.isVersus = false;
    this.level = "mudah";
    this.questions = [];

    // Game objects
    this.mazeGraphics = null;
    this.finishNode = null;
    this.finishSprite = null;
    this.questionMarkers = [];

    // Helper state
    this.moveCooldown = { p1: false, p2: false };

    // Game Logic State
    // FIX #11: Per-player quiz tracking (was one shared flag → race condition in versus)
    this.isQuizActive = false; // Legacy: still used as global block in solo
    this.quizActivePlayer = null; // FIX #8: Track which player is currently in quiz
    this.wrongAttempts = { p1: 0, p2: 0 }; // FIX #11: Per-player wrong attempts
    this.maxWrongAttempts = 3;
    this.skipPenalty = 25;
    this.pointsPerObstacle = 80;
    this.finishBonus = 150;
  }

  init(data) {

    // Dependency Injection & Configuration
    this.isVersus = data.mode === "versus";
    this.config.cols = data.cols || 10;
    this.config.rows = data.cols || 10; // Square maze usually
    this.config.size = data.size || 30;
    this.level = data.level || "mudah";
    this.questions = data.questions || [];

    // Reset state
    this.score = { p1: 0, p2: 0 };
    this.grid = [];
    this.moveCooldown = { p1: false, p2: false };
    this.wrongAttempts = { p1: 0, p2: 0 }; // FIX #11: Per-player
    this.isQuizActive = false;
    this.quizActivePlayer = null;

    // Emit State Awal
    this.updateScoreUI();
  }

  create() {
    // 1. Generate Logic
    this.generateMaze();

    // 2. Setup Camera & World
    this.setupWorld();

    // 3. Draw Maze
    this.mazeGraphics = this.add.graphics();
    this.drawMaze();

    // 4. Create Players
    this.createPlayers();

    // 5. Create Objects (Finish line, Coins/Questions)
    this.createObjects();

    // 6. Setup Inputs
    this.setupInputs();

    // 7. Setup Cameras (Split screen if versus)
    this.setupCameras();

    // 8. Handle Resize
    this.scale.on("resize", this.handleResize, this);
  }

  setupWorld() {
    const width = this.config.cols * this.config.size;
    const height = this.config.rows * this.config.size;

    // Set physics bounds (if using arcade physics, but we are using grid implementation)
    this.cameras.main.setBounds(-width, -height, width * 3, height * 3);

    // Background Grid (Visual Aid) - Make it huge so the sharp border is off-screen
    this.add.grid(
      width / 2,
      height / 2,
      width * 3,
      height * 3,
      this.config.size,
      this.config.size,
      0x000000,
      0,
      0x1f4068,
      0.3,
    );
  }

  // ==========================================
  // LOGIC: GENERATE MAZE (DFS Algorithm)
  // ==========================================
  generateMaze() {
    const { cols, rows } = this.config;
    this.grid = [];
    this.stack = [];

    // Create Grid
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        this.grid.push({
          i: i,
          j: j,
          walls: [true, true, true, true], // top, right, bottom, left
          visited: false,
          isQuestion: false,
          questionData: null,
        });
      }
    }

    // DFS
    let current = this.grid[0];
    current.visited = true;
    this.finishNode = this.grid[this.grid.length - 1];

    let processing = true;
    while (processing) {
      const next = this.checkNeighbors(current);
      if (next) {
        next.visited = true;
        this.stack.push(current);
        this.removeWalls(current, next);
        current = next;
      } else if (this.stack.length > 0) {
        current = this.stack.pop();
      } else {
        processing = false;
      }
    }

    // Add Questions/Obstacles
    this.placeObstacles();
  }

  checkNeighbors(cell) {
    const neighbors = [];
    const index = (i, j) => {
      if (
        i < 0 ||
        j < 0 ||
        i > this.config.cols - 1 ||
        j > this.config.rows - 1
      )
        return -1;
      return i + j * this.config.cols;
    };

    const top = this.grid[index(cell.i, cell.j - 1)];
    const right = this.grid[index(cell.i + 1, cell.j)];
    const bottom = this.grid[index(cell.i, cell.j + 1)];
    const left = this.grid[index(cell.i - 1, cell.j)];

    if (top && !top.visited) neighbors.push(top);
    if (right && !right.visited) neighbors.push(right);
    if (bottom && !bottom.visited) neighbors.push(bottom);
    if (left && !left.visited) neighbors.push(left);

    if (neighbors.length > 0) {
      return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
    return undefined;
  }

  removeWalls(a, b) {
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

  placeObstacles() {
    let qIndex = 0;
    const shuffledIndices = Array.from(
      { length: this.grid.length },
      (_, i) => i,
    ).sort(() => Math.random() - 0.5);

    for (const i of shuffledIndices) {
      // Avoid start and finish
      if (i > 0 && i < this.grid.length - 1 && qIndex < this.questions.length) {
        if (Math.random() < 0.3) {
          this.grid[i].isQuestion = true;
          this.grid[i].questionData = this.questions[qIndex];
          qIndex++;
        }
      }
    }
  }

  // ==========================================
  // VISUALS: DRAW
  // ==========================================
  drawMaze() {
    const g = this.mazeGraphics;
    const size = this.config.size;

    g.clear();

    // Neon Glow
    g.lineStyle(size / 3, 0x00f2ff, 0.5);
    this._drawWalls(g);

    // Bright Core
    g.lineStyle(2, 0xffffff, 1);
    this._drawWalls(g);
  }

  _drawWalls(graphics) {
    const size = this.config.size;
    for (const cell of this.grid) {
      const x = cell.i * size;
      const y = cell.j * size;

      graphics.beginPath();
      if (cell.walls[0]) {
        graphics.moveTo(x, y);
        graphics.lineTo(x + size, y);
      }
      if (cell.walls[1]) {
        graphics.moveTo(x + size, y);
        graphics.lineTo(x + size, y + size);
      }
      if (cell.walls[2]) {
        graphics.moveTo(x + size, y + size);
        graphics.lineTo(x, y + size);
      }
      if (cell.walls[3]) {
        graphics.moveTo(x, y + size);
        graphics.lineTo(x, y);
      }
      graphics.strokePath();
    }
  }

  createPlayers() {
    // Player 1
    this.players.p1 = this._createOnePlayer(1, this.grid[0], 0x00ffff);

    // Player 2 (Only if versus)
    if (this.isVersus) {
      this.players.p2 = this._createOnePlayer(2, this.grid[0], 0xff00ff);
    }
  }

  _createOnePlayer(id, startNode, color) {
    const size = this.config.size;
    const x = startNode.i * size + size / 2;
    const y = startNode.j * size + size / 2;
    const key = `player${id}`;

    // Generate texture if not exists
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 0.4);
      g.fillCircle(size / 2, size / 2, size / 2.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(size / 2, size / 2, size / 4);
      g.generateTexture(key, size, size);
    }

    const sprite = this.add.sprite(x, y, key).setDepth(10);
    sprite.gridPos = { ...startNode }; // Copy position

    // Trail effect
    this.add.particles(0, 0, key, {
      speed: 10,
      scale: { start: 0.5, end: 0 },
      blendMode: "ADD",
      lifespan: 200,
      frequency: 50,
      follow: sprite,
    });

    return sprite;
  }

  createObjects() {
    const size = this.config.size;

    // 1. Finish Line
    const fx = this.finishNode.i * size + size / 2;
    const fy = this.finishNode.j * size + size / 2;

    // Texture
    if (!this.textures.exists("finish")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x00ff00, 0.3);
      g.fillCircle(size / 2, size / 2, size / 2.2);
      g.lineStyle(2, 0x00ff00, 1);
      g.strokeCircle(size / 2, size / 2, size / 2.2);
      g.generateTexture("finish", size, size);
    }

    this.finishSprite = this.add.sprite(fx, fy, "finish").setDepth(5);
    this.add
      .text(fx, fy, "🏁", { fontSize: size / 2 + "px" })
      .setOrigin(0.5)
      .setDepth(6);

    this.tweens.add({
      targets: this.finishSprite,
      angle: 360,
      duration: 3000,
      repeat: -1,
    });

    // 2. Question Markers
    this.questionMarkers = [];
    this.grid.forEach((cell) => {
      if (cell.isQuestion) {
        const qx = cell.i * size + size / 2;
        const qy = cell.j * size + size / 2;
        const qKey = `q_${cell.i}_${cell.j}`;

        if (!this.textures.exists(qKey)) {
          const g = this.make.graphics({ x: 0, y: 0, add: false });
          g.lineStyle(2, 0xff00cc, 1);
          g.fillStyle(0xff00cc, 0.5);
          g.strokeRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
          g.fillRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
          g.generateTexture(qKey, size, size);
        }

        const marker = this.add.sprite(qx, qy, qKey).setDepth(5);
        marker.cell = cell; // Link to data

        this.tweens.add({
          targets: marker,
          angle: 360,
          duration: 2000,
          repeat: -1,
        });

        this.questionMarkers.push(marker);
      }
    });
  }

  // ==========================================
  // CAMERAS & SPLIT SCREEN
  // ==========================================
  setupCameras() {
    // Ukuran total layar
    const width = this.scale.width;
    const height = this.scale.height;

    // We defer the positioning logic to handleResize to keep it DRY (Don't Repeat Yourself)

    // Create Camera 2 if Versus Mode
    if (this.isVersus) {
      if (!this.camP2) {
        // Initialize with rough right-side viewport to ensure visibility even if resize fails
        this.camP2 = this.cameras.add(width / 2, 0, width / 2, height);
        this.camP2.setName("CamP2");
        this.camP2.startFollow(this.players.p2);
        this.camP2.setBackgroundColor("#1a0a0a");
      }
    }

    // Apply Logic
    this.handleResize(this.scale.gameSize);
  }

  // ==========================================
  // INPUTS & MOVEMENT
  // ==========================================
  setupInputs() {
    // Keyboard mapping
    // P1: Arrows
    this.input.keyboard.on("keydown-UP", () => this.tryMove("p1", 0, -1));
    this.input.keyboard.on("keydown-DOWN", () => this.tryMove("p1", 0, 1));
    this.input.keyboard.on("keydown-LEFT", () => this.tryMove("p1", -1, 0));
    this.input.keyboard.on("keydown-RIGHT", () => this.tryMove("p1", 1, 0));

    // P2: WASD
    if (this.isVersus) {
      this.input.keyboard.on("keydown-W", () => this.tryMove("p2", 0, -1));
      this.input.keyboard.on("keydown-S", () => this.tryMove("p2", 0, 1));
      this.input.keyboard.on("keydown-A", () => this.tryMove("p2", -1, 0));
      this.input.keyboard.on("keydown-D", () => this.tryMove("p2", 1, 0));
    }

    // Add onscreen control listeners (touch)
    // Note: These buttons are in HTML, not Phaser.
    // Logic needs to bridge HTML buttons to Phaser functions.
    // We can expose a global method or use the EventBus pattern.
    window.movePhaserPlayer = (playerKey, x, y) => {
      this.tryMove(playerKey, x, y);
    };
  }

  tryMove(playerKey, dx, dy) {
    // Move Logic
    // FIX #11: Block movement if THIS player OR any player has an active quiz (solo compat)
    // In versus: only block the player who is in the quiz, allow the other to move
    const myQuizActive = this.quizActivePlayer === playerKey;
    const globalQuizBlock = !this.isVersus && this.isQuizActive; // solo: global block
    if (this.moveCooldown[playerKey] || myQuizActive || globalQuizBlock) return;

    const player = this.players[playerKey];
    if (!player) return; // Player not active (e.g. P2 inactive in solo)

    const currentGridPos = player.gridPos;
    const currentIndex = currentGridPos.i + currentGridPos.j * this.config.cols;
    const currentCell = this.grid[currentIndex];

    // Check walls
    let blocked = false;
    if (dy === -1 && currentCell.walls[0]) blocked = true;
    if (dx === 1 && currentCell.walls[1]) blocked = true;
    if (dy === 1 && currentCell.walls[2]) blocked = true;
    if (dx === -1 && currentCell.walls[3]) blocked = true;

    if (blocked) {
      this.cameras.main.shake(100, 0.005); // Subtle shake feedback
      return;
    }

    // Logic coordinate update
    const nextI = currentCell.i + dx;
    const nextJ = currentCell.j + dy;
    const nextIndex = nextI + nextJ * this.config.cols;
    const nextCell = this.grid[nextIndex];

    // Move Animation
    const size = this.config.size;
    const nextX = nextI * size + size / 2;
    const nextY = nextJ * size + size / 2;

    this.moveCooldown[playerKey] = true;

    this.tweens.add({
      targets: player,
      x: nextX,
      y: nextY,
      duration: 150,
      onComplete: () => {
        this.moveCooldown[playerKey] = false;
        player.gridPos = { i: nextI, j: nextJ };

        // CHECK LOGIC: Collision with objects
        this.checkCollision(playerKey, nextCell);

        // Sound Effect: Move (Click)
        if (window.safePlayClick) window.safePlayClick();
      },
    });
  }

  checkCollision(playerKey, cell) {
    // 1. Finish Line
    if (cell === this.finishNode) {
      this.handleFinish(playerKey);
      return;
    }

    // 2. Questions/Obstacles
    if (cell.isQuestion) {
      this.triggerQuestion(playerKey, cell);
    }
  }

  triggerQuestion(playerKey, cell) {
    // FIX #11: If this player is already in a quiz, do nothing
    if (this.quizActivePlayer === playerKey) return;

    // FIX #8: If another player is in a quiz (versus), block this cell for now
    // (they can try again when the other resolves)
    if (this.isVersus && this.quizActivePlayer !== null && this.quizActivePlayer !== playerKey) {
      // Briefly shake camera to signal "wait"
      this.cameras.main.shake(80, 0.003);
      return;
    }

    // FIX #11: Per-player wrong attempt reset
    this.wrongAttempts[playerKey] = 0;
    this.isQuizActive = true; // Legacy solo-compat
    this.quizActivePlayer = playerKey; // FIX #8: Track who is in quiz
    this.lastQuestionData = cell.questionData;

    this.events.emit("showQuestion", {
      player: playerKey,
      question: cell.questionData,
      callback: (isCorrect, isSkip) => {
        if (isCorrect) {
          // Unlock only for this player's quiz
          this.isQuizActive = false;
          this.quizActivePlayer = null; // FIX #8: Release quiz lock
          const marker = this.questionMarkers.find((m) => m.cell === cell);
          if (marker) marker.destroy();
          cell.isQuestion = false;

          this.addScore(playerKey, this.pointsPerObstacle);
          if (window.safePlayCorrect) window.safePlayCorrect();
        } else if (isSkip) {
          this.isQuizActive = false;
          this.quizActivePlayer = null; // FIX #8: Release quiz lock
          const marker = this.questionMarkers.find((m) => m.cell === cell);
          if (marker) marker.destroy();
          cell.isQuestion = false;

          this.addScore(playerKey, -this.skipPenalty);
        } else {
          if (window.safePlayWrong) window.safePlayWrong();
          this.handleWrongAnswer(playerKey);
        }
      },
    });
  }

  handleWrongAnswer(playerKey) {
    // FIX #11: Per-player wrong attempts counter
    this.wrongAttempts[playerKey]++;
    if (this.wrongAttempts[playerKey] >= this.maxWrongAttempts) {
      // Trigger AI Tutor
      if (socket && this.lastQuestionData) {
        const tutorOverlay = document.getElementById("tutor-overlay");
        const textEl = document.getElementById("tutor-text");
        if (tutorOverlay && textEl) {
          tutorOverlay.style.display = "flex";
          textEl.innerHTML = "🤖 Sedang memanggil Guru Videa...";
        }

        const qData = this.lastQuestionData;
        socket.emit("mintaPenjelasan", {
          soal: qData.pertanyaan || qData.tanya || qData.soal,
          jawabanBenar: qData.jawaban || qData.jawab,
          jawabanUser: "",
          kategori: qData.topik || "Umum",
        });
      }
      // Reset this player's wrong-attempt counter (avoid spam)
      this.wrongAttempts[playerKey] = 0;
    } else {
      // UI-FIX: Ganti alert() browser yang memblokir dengan toast in-game
      // alert() membekukan seluruh tab & tidak bisa dikustomisasi tampilan.
      // showWrongAnswerToast() tetap di-dalam game, tidak blokir Phaser loop.
      const remaining = this.maxWrongAttempts - this.wrongAttempts[playerKey];
      showWrongAnswerToast(remaining, playerKey);

      // Tambahan feedback visual di Phaser: camera shake merah
      this.cameras.main.shake(300, 0.012);
      this.cameras.main.flash(200, 255, 60, 60, false); // Red flash
    }
  }

  handleFinish(playerKey) {
    this.addScore(playerKey, this.finishBonus);

    // Sound Win
    if (window.safePlayWin) window.safePlayWin();

    // ANIM-FIX: Animasi kemenangan dramatis sebelum emit gameFinished
    this._playFinishAnimation(playerKey);

    // Delay showing result modal agar animasi keburu tampil dulu
    this.time.delayedCall(1800, () => {
      this.events.emit("gameFinished", {
        winner: playerKey,
        score: this.score,
        isVersus: this.isVersus,
      });
    });
  }

  _playFinishAnimation(playerKey) {
    const player = this.players[playerKey];
    if (!player) return;

    const size = this.config.size;
    const px = player.x;
    const py = player.y;

    // --- 1. KAMERA: Shake keras lalu zoom ke player ---
    this.cameras.main.shake(400, 0.02);
    this.cameras.main.flash(300, 255, 230, 0, false); // Golden flash

    // Zoom in ke posisi pemain secara dramatis
    this.tweens.add({
      targets: this.cameras.main,
      zoom: this.cameras.main.zoom * 1.5,
      duration: 600,
      ease: "Cubic.easeOut",
      yoyo: true,
      hold: 400,
    });

    // --- 2. PLAYER: Scale up → burst → fade ---
    this.tweens.add({
      targets: player,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 800,
      ease: "Expo.easeOut",
    });

    // --- 3. PARTIKEL: Ledakan bintang warna-warni dari posisi player ---
    const colors = [0xffd700, 0x00f2ff, 0xff00cc, 0x00ff88, 0xff6600];
    colors.forEach((color, i) => {
      this.time.delayedCall(i * 80, () => {
        // Buat lingkaran kecil sebagai partikel ledakan
        const numDots = 12;
        for (let d = 0; d < numDots; d++) {
          const angle = (d / numDots) * Math.PI * 2;
          const speed = Phaser.Math.Between(80, 180);
          const dot = this.add.circle(px, py, Phaser.Math.Between(3, 7), color, 1);
          dot.setDepth(20);

          this.tweens.add({
            targets: dot,
            x: px + Math.cos(angle) * speed,
            y: py + Math.sin(angle) * speed,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: Phaser.Math.Between(500, 900),
            ease: "Cubic.easeOut",
            onComplete: () => dot.destroy(),
          });
        }
      });
    });

    // --- 4. TEKS: "BERHASIL!" melayang dari posisi player ---
    const winLabel = this.add.text(px, py - size, "🏆 BERHASIL!", {
      fontFamily: "Orbitron, sans-serif",
      fontSize: Math.max(16, size * 0.8) + "px",
      fontStyle: "bold",
      color: "#FFD700",
      stroke: "#000",
      strokeThickness: 4,
      shadow: { blur: 15, color: "#ffd700", fill: true },
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    this.tweens.add({
      targets: winLabel,
      y: py - size * 4,
      alpha: 1,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 700,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: winLabel,
          alpha: 0,
          y: py - size * 6,
          duration: 600,
          delay: 600,
          onComplete: () => winLabel.destroy(),
        });
      },
    });

    // --- 5. FINISH SPRITE: Pulse bersinar golden ---
    if (this.finishSprite) {
      this.tweens.add({
        targets: this.finishSprite,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 800,
        ease: "Expo.easeOut",
      });
    }

    // --- 6. KONFETI via canvas-confetti (jika tersedia di DOM) ---
    if (typeof confetti === "function") {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#FFD700", "#00F2FF", "#FF00CC", "#00FF88", "#FF6600"],
      });
    }
  }

  addScore(playerKey, points) {
    this.score[playerKey] += points;
    this.updateScoreUI();
  }

  updateScoreUI() {
    this.events.emit("updateScore", this.score);

    // Direct DOM Update for redundancy
    const scoreEl = document.getElementById("score");
    if (scoreEl) {
      if (this.isVersus) {
        scoreEl.innerText = `P1: ${this.score.p1} | P2: ${this.score.p2}`;
      } else {
        scoreEl.innerText = this.score.p1;
      }
    }
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Reset Default Viewport
    this.cameras.main.setViewport(0, 0, width, height);

    const isMobileVersus = this.isVersus && width <= 500;

    if (this.isVersus && !isMobileVersus) {
      // --- VERSUS SPLIT SCREEN ---
      const halfWidth = Math.floor(width / 2);
      const remainingWidth = width - halfWidth; // Ensure total width is filled

      const mazeWidth = this.config.cols * this.config.size;
      const mazeHeight = this.config.rows * this.config.size;

      // Calculate Smart Zoom that guarantees full visibility
      // Add padding (e.g. 40px)
      const zoomX = (halfWidth - 40) / mazeWidth;
      const zoomY = (height - 40) / mazeHeight;
      let smartZoom = Math.min(zoomX, zoomY);

      // Safety Clamp: Don't let it be 0 or infinite
      smartZoom = Math.max(0.1, smartZoom);

      // Camera 1 (Left - P1)
      this.cameras.main.setViewport(0, 0, halfWidth, height);
      this.cameras.main.setZoom(smartZoom);
      this.cameras.main.stopFollow(); // STOP FOLLOW to ensure it's static
      this.cameras.main.centerOn(mazeWidth / 2, mazeHeight / 2);
      this.cameras.main.setBackgroundColor("#0a0a1a");
      this.cameras.main.removeBounds();

      // Camera 2 (Right - P2)
      // Use direct reference if available, else try lookup
      const cam2 = this.camP2 || this.cameras.getCamera("CamP2");

      if (cam2) {
        cam2.setViewport(halfWidth, 0, remainingWidth, height);
        cam2.setZoom(smartZoom);
        cam2.stopFollow(); // STOP FOLLOW to ensure it's static
        cam2.centerOn(mazeWidth / 2, mazeHeight / 2);
        cam2.setBackgroundColor("#1a0a2a");
        cam2.removeBounds();
      } else {
        console.warn("⚠️ Camera P2 not found during resize!");
      }

      // Show P2 D-Pad
      const dpadP2 = document.querySelector(".d-pad-p2");
      if (dpadP2) dpadP2.style.display = "grid";
    } else {
      // --- SOLO SMART CAMERA / MOBILE VERSUS FALLBACK ---
      this.cameras.main.setViewport(0, 0, width, height);

      const mazeWidth = this.config.cols * this.config.size;
      const mazeHeight = this.config.rows * this.config.size;

      const zoomX = (width - 50) / mazeWidth;
      const zoomY = (height - 50) / mazeHeight;
      let smartZoom = Math.min(zoomX, zoomY);

      // Clamp zoom for Solo
      smartZoom = Math.max(0.6, Math.min(smartZoom, 2.0));

      this.cameras.main.setZoom(smartZoom);

      // Center it
      this.cameras.main.stopFollow();
      this.cameras.main.removeBounds();
      this.cameras.main.centerOn(mazeWidth / 2, mazeHeight / 2);

      // Disable P2 Cam if exists
      if (this.camP2) {
        // You ideally might want to hide it, but Phaser cams don't have 'visible'.
        // We can set its viewport to 0,0,0,0
        this.camP2.setViewport(0, 0, 0, 0);
      }

      // Manage P2 D-Pad visibility
      const dpadP2 = document.querySelector(".d-pad-p2");
      if (dpadP2) {
        if (this.isVersus) {
          dpadP2.style.display = "grid"; // Keep it visible in mobile versus fallback
        } else {
          dpadP2.style.display = "none"; // Hide in pure solo
        }
      }
    }
  }
}

// ==========================================
// GAME INIT & GLOBAL INTERFACE
// ==========================================

let phaserGameInstance = null;
const socket = window.socket; // Global Socket

// Initialize Game (Called from Server Response)
// Initialize Game (Called from Server Response)
window.requestGame = async function () {

  // Robust Mode Detection
  let mode = window.currentMode || "solo";

  const loadingScreen = document.getElementById("loading-screen");

  // Prompt if Versus
  if (mode === "versus") {
    // Hide start screen first so Swal is not blocked by z-index issues
    if (loadingScreen) loadingScreen.style.display = "none";

    const result = await Swal.fire({
      title: "Masukkan Nama Lawan",
      input: "text",
      inputPlaceholder: "Nama Player 2 (Temanmu)",
      showCancelButton: true,
      confirmButtonText: "Mulai Balapan",
      cancelButtonText: "Batal",
      allowOutsideClick: false,
      background: "#1e1e2e",
      color: "#fff"
    });
    
    if (result.isDismissed) {
      if (window.resetGameMode) window.resetGameMode();
      // Restore start screen if user skips/cancels
      if (loadingScreen) loadingScreen.style.display = ""; 
      return;
    }
    window.guestName = (result.value || "Guest").trim();
  }

  const btn = document.querySelector(".btn-start-game");
  if (btn) {
    btn.innerText = "⏳ MENGHUBUNGI SERVER...";
    btn.disabled = true;
  }

  // Clean inputs
  const inputKodeKelas = document.getElementById("inputKodeKelas");
  const kodeAkses = inputKodeKelas
    ? inputKodeKelas.value.trim().toUpperCase()
    : "";

  // Robust Level Detection
  let level = "mudah";
  const activeLevelBtn = document.querySelector(
    ".buttons-row .btn-difficulty.active",
  );
  if (activeLevelBtn) {
    level = activeLevelBtn.getAttribute("data-level") || "mudah";
  }


  // TIMEOUT FALLBACK (5 Detik)
  // We capture 'level' and 'mode' in this closure.
  const serverTimeout = setTimeout(() => {
    console.warn("⚠️ Server Timeout! Menggunakan Data Lokal. Level:", level);
    const fallbackCols = level === "sulit" ? 20 : level === "sedang" ? 15 : 10;

    // START FALLBACK GAME
    startPhaserGame({
      cols: fallbackCols,
      rows: fallbackCols,
      questions: getFallbackQuestions(),
      mode: mode,
      level: level,
    });

    // Reset UI
    if (btn) {
      btn.innerText = "🚀 MULAI MISI (OFFLINE MODE)";
      btn.disabled = false;
      setTimeout(() => (btn.innerText = "🚀 MULAI MISI"), 2000);
    }
  }, 5000);

  if (socket) {
    // Listener one-time untuk clear timeout jika sukses
    // Define handler separately to allow removal
    const responseHandler = (response) => {
      // Clear timeout immediately
      clearTimeout(serverTimeout);
      socket.off("soalDariAI", responseHandler); // Cleanup listener

      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) loadingScreen.style.display = "none";

      if (response && response.kategori === "labirin") {
        let info = response.data;
        if (Array.isArray(info)) info = info[0];

        // OVERRIDE based on level (Server might be static, so we force client size)
        let mazeCols = info.maze_size || 10;
        if (level === "sedang") mazeCols = 15;
        if (level === "sulit") mazeCols = 20;

        startPhaserGame({
          cols: mazeCols,
          rows: mazeCols,
          questions: info.soal_list || [],
          mode: window.currentMode || "solo",
          level: level,
        });
      } else {
        alert(response.error || "Gagal memuat soal.");
        location.reload();
      }
    };

    // Attach Listener
    // Anti Memory Leak
    socket.off("soalDariAI", responseHandler);
    socket.on("soalDariAI", responseHandler);

    // 🔧 FIX: Emit mulaiGame agar server mencatat sesi bermain yang valid
    // Tanpa ini, server akan menolak simpanSkor karena sesi dianggap tidak valid
    socket.emit("mulaiGame", "labirin");
    window._activeGameSlug = "labirin"; // BUG-03 FIX: agar reconnect handler bisa re-register sesi

    // Emit Request
    socket.emit("mintaSoalAI", {
      kategori: "labirin",
      tingkat: level,
      kodeAkses: kodeAkses,
      mode: mode,
    });
  } else {
    // No socket at all? Fallback immediately
    console.warn("⚠️ No Socket Connection! Starting Offline.");
    clearTimeout(serverTimeout);
    const fallbackCols = level === "sulit" ? 20 : level === "sedang" ? 15 : 10;
    startPhaserGame({
      cols: fallbackCols,
      rows: fallbackCols,
      questions: getFallbackQuestions(),
      mode: mode,
      level: level,
    });
  }
};

// Fallback Data Generator
function getFallbackQuestions() {
  return [
    { pertanyaan: "1 + 1 = ?", jawaban: "2", topik: "Matematika Dasar" },
    { pertanyaan: "Ibukota Indonesia?", jawaban: "Jakarta", topik: "Geografi" },
    { pertanyaan: "5 x 5 = ?", jawaban: "25", topik: "Perkalian" },
    { pertanyaan: "Warna langit cerah?", jawaban: "Biru", topik: "Umum" },
    {
      pertanyaan: "Hewan berkaki 4 yang mengeong?",
      jawaban: "Kucing",
      topik: "Biologi",
    },
  ];
}

if (socket) {
  // Global listener cleanup (moved logic inside requestGame to handle timeout)
  // We keep AI Tutor listener here as it is passive
  socket.off("penjelasanTutor");
  socket.on("penjelasanTutor", (data) => {
    const textEl = document.getElementById("tutor-text");
    const tutorOverlay = document.getElementById("tutor-overlay");
    const quizModal = document.getElementById("quiz-modal");

    if (textEl && tutorOverlay) {
      if (quizModal) quizModal.style.display = "none";
      tutorOverlay.style.display = "flex";
      textEl.innerHTML = data.penjelasan || data.teks;
      if (phaserGameInstance) {
        const scene = phaserGameInstance.scene.getScene("LabirinScene");
        if (scene) scene.isQuizActive = true;
      }
    }
  });
}

// Global: Close Tutor
window.tutupTutorLabirin = function () {
  const tutorOverlay = document.getElementById("tutor-overlay");
  if (tutorOverlay) tutorOverlay.style.display = "none";

  // Resume Game / Unlock
  if (phaserGameInstance) {
    const scene = phaserGameInstance.scene.getScene("LabirinScene");
    if (scene) {
      scene.isQuizActive = false;
      scene.quizActivePlayer = null; // FIX #8: Release per-player lock
    }
  }
};

// Global variable for mode selection
window.currentMode = "solo";
window.selectMode = function (mode) {
  window.currentMode = mode;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.classList.remove("active");
    if (b.dataset.mode === mode) b.classList.add("active");
  });
};

// Difficulty Selection Logic
document.querySelectorAll("[data-level]").forEach((btn) => {
  btn.addEventListener("click", function () {
    // Remove active from all level buttons
    document
      .querySelectorAll("[data-level]")
      .forEach((b) => b.classList.remove("active"));
    // Add active to clicked
    this.classList.add("active");
  });
});

function startPhaserGame(gameConfig) {
  // 1. Calculate Size (Only for Grid/Maze generation reference)
  // We still need a base size for the maze cells
  const cellSize = calculateOptimalSize(gameConfig.cols);
  gameConfig.size = cellSize;

  // 2. Phaser Config with RESIZE
  const config = {
    type: Phaser.AUTO,
    parent: "game-container-p1", // Single container
    backgroundColor: "#0a0a1a",
    scale: {
      mode: Phaser.Scale.RESIZE, // KUNCI UTAMA
      width: "100%",
      height: "100%",
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [LabirinScene],
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
  };

  // 3. Destroy Old Game (Only if exists)
  if (phaserGameInstance) {
    phaserGameInstance.destroy(true);
  }

  // 4. Create New Game
  phaserGameInstance = new Phaser.Game(config);

  // 5. Start with data
  phaserGameInstance.registry.set("gameData", gameConfig);
  phaserGameInstance.scene.start("LabirinScene", gameConfig);

  // 6. Setup Event Listeners
  phaserGameInstance.events.once("ready", () => {
    const scene = phaserGameInstance.scene.getScene("LabirinScene");
    if (scene) setupUIListeners(scene);
    else {
      phaserGameInstance.events.once("step", () => {
        const s = phaserGameInstance.scene.getScene("LabirinScene");
        if (s) setupUIListeners(s);
      });
    }
  });
}

// Global: Reset Mode when needed (e.g. Back button)
window.resetGameMode = function () {
  window.currentMode = "solo";
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.classList.remove("active");
    if (b.dataset.mode === "solo") b.classList.add("active");
  });
};

window.destroyLabirinGame = function () {
  if (phaserGameInstance) {
    try {
      phaserGameInstance.destroy(true);
    } catch(err) {
      console.error("Gagal membersihkan Phaser Labirin:", err);
    }
    phaserGameInstance = null;
  }
  
  const container = document.getElementById("game-container-p1");
  if (container) container.innerHTML = "";
};

// Bind Back Button
document.querySelector(".btn-back")?.addEventListener("click", () => {
  window.resetGameMode();
  window.destroyLabirinGame();
  document.getElementById("tutor-overlay").style.display = "none";
  document.getElementById("quiz-modal").style.display = "none";
});

// Expose global restart method
window.restartGame = window.restartLabirin = function() {
    // FIX: Re-emit mulaiGame agar sesi server diperbarui untuk simpanSkor berikutnya
    const socket = window.socket;
    if (socket) {
        socket.emit("mulaiGame", "labirin");
        window._activeGameSlug = "labirin";
    }

    // Sembunyikan layar hasil
    const goModal = document.getElementById("game-over-modal");
    if (goModal) goModal.style.display = "none";
    
    if (phaserGameInstance && phaserGameInstance.registry) {
        const gameConfig = phaserGameInstance.registry.get("gameData");
        if (gameConfig) {
            const scene = phaserGameInstance.scene.getScene("LabirinScene");
            if(scene) {
                scene.scene.restart(gameConfig);
                return;
            }
        }
    }
    
    // Fallback: If everything fails, invoke requestGame again
    window.requestGame();
};

// UI HELPERS & EVENT LISTENERS
function setupUIListeners(scene) {

  scene.events.on("updateScore", (scores) => {
    const scoreEl = document.getElementById("score");
    if (scoreEl) {
      scoreEl.innerText = scene.isVersus
        ? `P1: ${scores.p1} | P2: ${scores.p2}`
        : scores.p1;
    }
  });

  scene.events.on("showQuestion", (data) => {
    showQuizModal(data);
  });

  scene.events.on("gameFinished", (data) => {
    // Freeze the game to prevent further movement
    if (scene && scene.scene) {
      scene.scene.pause();
    }

    // Show Modal instead of alert
    const modal = document.getElementById("game-over-modal");
    if (modal) {
      modal.style.display = "flex";

      const title = document.getElementById("go-title");
      const winnerText = document.getElementById("go-winner");
      const scoreP1 = document.getElementById("go-score-p1");
      const scoreP2Container = document.getElementById("go-score-p2-container");
      const scoreP2 = document.getElementById("go-score-p2");

      if (data.isVersus) {
        title.innerText = "⚔️ BALAPAN SELESAI!";
        
        let finalStatus = "Draw";
        if (data.score.p1 > data.score.p2 || data.winner === "p1") {
            winnerText.innerText = "🎉 PLAYER 1 MENANG!";
            winnerText.style.color = "cyan";
            finalStatus = "Win";
        } else if (data.score.p2 > data.score.p1 || data.winner === "p2") {
            winnerText.innerText = `🎉 ${(window.guestName ? window.guestName.toUpperCase() : 'PLAYER 2')} MENANG!`;
            winnerText.style.color = "magenta";
            finalStatus = "Lose";
        } else {
            winnerText.innerText = "🤝 SERI!";
            winnerText.style.color = "yellow";
        }

        scoreP2Container.style.display = "block";
        scoreP2.innerText = data.score.p2;

        // Kirim skor versus lokal
        if (window.socket) {
          window.socket.emit("laporSkorVersusLokal", {
            game: "labirin",
            status: finalStatus,
            score: data.score.p1, 
            p2Name: window.guestName || "Guest"
          });
        }
      } else {
        title.innerText = "🏁 MISI SELESAI!";
        winnerText.innerText = "Selamat! Kamu berhasil.";
        winnerText.style.color = "#00f2ff";
        scoreP2Container.style.display = "none";
        
        // Kirim Skor Solo Lokal (jika ada handler lama)
        if (window.socket && !data.isVersus) {
          window.socket.emit("simpanSkor", {
            nama: localStorage.getItem("playerName") || "Guest",
            game: "labirin",
            skor: data.score.p1,
          });
        }
      }

      scoreP1.innerText = data.score.p1;
    }
  });
}

function showQuizModal(data) {
  const modal = document.getElementById("quiz-modal");
  const qText = document.getElementById("q-text");
  const qInput = document.getElementById("q-input");

  if (!modal) console.error("[UI] Error: #quiz-modal not found!");
  if (!qText) console.error("[UI] Error: #q-text not found!");

  if (modal && qText) {
    modal.style.display = "flex";

    // Normalize Data (Handle DB 'pertanyaan' vs Fallback 'tanya'/'soal')
    const qContent = data.question;
    const text =
      qContent.pertanyaan ||
      qContent.tanya ||
      qContent.soal ||
      "Pertanyaan ???";
    qText.innerText = text;

    if (qInput) {
      qInput.value = "";
      setTimeout(() => qInput.focus(), 100); // 🚀 Quick Win UX
    }

    // Callback stored globally for HTML button access
    window.currentQuizCallback = data.callback;
    window.currentQuizAnswer = qContent.jawaban || qContent.jawab;

    // Store full data for AI Tutor context if needed
    window.currentQuestionData = data.question;
  }
}

// Global handler for HTML button
// Global handler for HTML button
window.checkQuiz = function () {
  const inputEl = document.getElementById("q-input");
  const feedbackEl = document.getElementById("quiz-feedback");
  const input = inputEl.value.trim();
  const correct = window.currentQuizAnswer; // Normalized in showQuizModal

  if (!inputEl) {
    console.error("❌ Error: Element #q-input tidak ditemukan!");
    return;
  }
  if (!feedbackEl) {
    console.error("❌ Error: Element #quiz-feedback tidak ditemukan!");
    return;
  }

  // Reset State
  inputEl.classList.remove("correct", "wrong");
  feedbackEl.innerText = "";
  feedbackEl.style.color = "white";

  if (input.toLowerCase() === correct.toLowerCase()) {
    // Correct!
    inputEl.classList.add("correct");
    feedbackEl.innerText = "Benar! 🎉";
    feedbackEl.style.color = "#00ff00";

    if (window.safePlayCorrect) window.safePlayCorrect();

    // Delay Closing
    setTimeout(() => {
      document.getElementById("quiz-modal").style.display = "none";
      if (window.currentQuizCallback) window.currentQuizCallback(true, false);

      // Cleanup UI for next time
      inputEl.classList.remove("correct");
      feedbackEl.innerText = "";
      inputEl.value = "";
    }, 1000);
  } else {
    // Wrong!
    inputEl.classList.add("wrong");
    feedbackEl.innerText = "Salah! Coba lagi.";
    feedbackEl.style.color = "#ff0000";

    if (window.safePlayWrong) window.safePlayWrong();

    // Remove wrong class after animation
    setTimeout(() => {
      inputEl.classList.remove("wrong");
    }, 500);

    if (window.currentQuizCallback) window.currentQuizCallback(false, false);
  }
};

window.confirmSkipObstacle = function () {
  if (confirm("Yakin lewati? Poin dikurangi 25.")) {
    document.getElementById("quiz-modal").style.display = "none";
    if (window.currentQuizCallback) window.currentQuizCallback(false, true); // isSkip = true
  }
};

// Note: tutupTutorLabirin is defined above (line ~896) with the full fix.
// This second definition is intentionally removed to avoid override.

// UI HELPER: Calculate Size (Advanced)
function calculateOptimalSize(cols) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const header = document.querySelector(".game-header");
  const controls = document.querySelector(".game-controls");

  const headerHeight = header ? header.offsetHeight : 70;
  const controlsHeight = controls ? controls.offsetHeight : 100;

  const isMobile = vw < 640;
  const margin = isMobile ? 20 : 40;

  const availableWidth = vw - margin * 2;
  const availableHeight = vh - headerHeight - controlsHeight - margin * 2;

  let cellSize = Math.floor(
    Math.min(availableWidth / cols, availableHeight / cols),
  );

  const constraints = {
    mobile: { min: 25, max: 50 },
    desktop: { min: 30, max: 80 },
  };

  const { min, max } = isMobile ? constraints.mobile : constraints.desktop;
  return Math.max(min, Math.min(cellSize, max));
}

// D-PAD Bridge (Updated for P1 and P2)
// P1 Controls
document
  .querySelector(".btn-up-p1")
  ?.addEventListener("click", () => window.movePhaserPlayer("p1", 0, -1));
document
  .querySelector(".btn-down-p1")
  ?.addEventListener("click", () => window.movePhaserPlayer("p1", 0, 1));
document
  .querySelector(".btn-left-p1")
  ?.addEventListener("click", () => window.movePhaserPlayer("p1", -1, 0));
document
  .querySelector(".btn-right-p1")
  ?.addEventListener("click", () => window.movePhaserPlayer("p1", 1, 0));

// P2 Controls
document
  .querySelector(".btn-up-p2")
  ?.addEventListener("click", () => window.movePhaserPlayer("p2", 0, -1));
document
  .querySelector(".btn-down-p2")
  ?.addEventListener("click", () => window.movePhaserPlayer("p2", 0, 1));
document
  .querySelector(".btn-left-p2")
  ?.addEventListener("click", () => window.movePhaserPlayer("p2", -1, 0));
document
  .querySelector(".btn-right-p2")
  ?.addEventListener("click", () => window.movePhaserPlayer("p2", 1, 0));

// Pastikan memori dilepas saat anak SD menutup tab atau pindah halaman
window.addEventListener("beforeunload", () => {
  if (typeof window.destroyLabirinGame === "function") {
    window.destroyLabirinGame();
  }
});
