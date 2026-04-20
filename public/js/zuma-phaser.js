/**
 * ZUMA PHASER - VERSI KEREN
 * -----------------------------------
 * Fitur:
 * - Grafik Bola 3D Procedural (tanpa aset gambar eksternal)
 * - Sistem Tembak & Fisika Akurat
 * - Integrasi Socket.IO untuk Multiplayer & Skor
 * - Efek Partikel & Visual Modern
 */

// Config Phaser
const GAME_CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// Variabel Global
let socket = window.socket || null;
let playerName = localStorage.getItem("playerName") || "Guest";
let currentLevel = 1;
let selectedDifficulty = "mudah";
let levelConfig = {
  speed: 1, // Kecepatan bola
  spawnRate: 2000,
  maxEnemies: 20,
  pola: "spiral",
};

// SCENE ZUMAs
class ZumaScene extends Phaser.Scene {
  constructor() {
    super({ key: "ZumaScene" });
  }

  // 1. Inisialisasi
  init(data) {
    // Ambil skor sebelumnya
    this.score = data.score || 0;
    this.spawnedCount = 0;
    this.isGameOver = false;
    this.levelData = data.levelData || {};
    this.difficulty = data.difficulty || "mudah";

    // Setup kesulitan
    // Fallback to data.difficulty if provided, else use global
    this.difficulty = data.difficulty || selectedDifficulty || "mudah";

    let targetSpeed = 0.4;
    let targetDelay = 2000; // SPACING FIX: Increased from 1500ms for better spacing

    switch (this.difficulty.toLowerCase()) {
      case "mudah":
        targetSpeed = 0.4; // Pelan banget (User Request)
        targetDelay = 2000; // SPACING FIX: Increased from 1500ms
        break;
      case "sedang":
        targetSpeed = 0.7; // Normal
        targetDelay = 1600; // SPACING FIX: Increased from 1200ms
        break;
      case "sulit":
        targetSpeed = 1.0; // Cepat
        targetDelay = 1400; // SPACING FIX: Increased from 1000ms
        break;
      default:
        targetSpeed = 0.4;
        targetDelay = 2000; // SPACING FIX: Increased from 1500ms
    }

    // Mode cepat
    const isFast = (this.levelData.speed || "").toLowerCase() === "cepat";
    if (isFast) {
      targetSpeed = 1.5;
      targetDelay = 1000; // SPACING FIX: Increased from 800ms
    }

    this.gameSpeed = targetSpeed;
    this.spawnDelay = targetDelay;
    this.maxEnemies = 15 + currentLevel * 5;

    // Status Player
    this.playerAmmo = Math.floor(Math.random() * 9) + 1;
    this.canShoot = true;

    // Debug Mouse
    document.addEventListener("mousemove", (e) => {
      // Update teks debug
      if (this.debugText) {
        this.debugText.setText(
          `DOM: ${e.clientX},${e.clientY} | Phaser: Check...`,
        );
      }
    });

    document.addEventListener("mousedown", (e) => {
      console.log("DOM CLICK:", e.target);
    });
  }

  // 2. Preload
  preload() {
    // Bikin tekstur sendiri biar ringan
    // Load suara
    this.load.audio("shoot", "/explosion.mp3");
  }

  // 3. Create
  create() {
    console.log("🔥 Phaser START CREATE");
    try {
      // A. Bikin Grafik 3D
      this.generateTextures();

      // B. Bikin Jalur
      this.createPath(this.levelData.pola || "spiral");

      // C. Grup Fisika
      this.marbles = this.physics.add.group();
      this.bullets = this.physics.add.group();

      // D. Penembak
      this.createTurret();
      if (this.turret) {
        this.turretInputReady = true;
        this.targetRotation = -Math.PI / 2; // Default facing up
      }

      // E. Input Mouse/Touch
      this.input.mouse.disableContextMenu();
      this.input.on("pointermove", (pointer) => {
        this.handleInputMove(pointer.x, pointer.y);
      });
      this.input.on("pointerdown", (pointer) => {
        this.handleInputClick(pointer.x, pointer.y);
      });

      // E2. Input Cadangan
      this.inputFallbackMove = (e) => {
        if (this.isGameOver || !this.turret) return;
        const canvas = this.game.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // Ukuran layar
        const scaleX = this.game.config.width / rect.width;
        const scaleY = this.game.config.height / rect.height;

        const gameX = (e.clientX - rect.left) * scaleX;
        const gameY = (e.clientY - rect.top) * scaleY;

        this.handleInputMove(gameX, gameY);
      };

      this.inputFallbackClick = (e) => {
        if (this.isGameOver || !this.turret) return;
        const canvas = this.game.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = this.game.config.width / rect.width;
        const scaleY = this.game.config.height / rect.height;
        const gameX = (e.clientX - rect.left) * scaleX;
        const gameY = (e.clientY - rect.top) * scaleY;
        this.handleInputClick(gameX, gameY);
      };

      document.addEventListener("mousemove", this.inputFallbackMove);
      document.addEventListener("mousedown", this.inputFallbackClick);

      // Add Resize Event Listener
      this.scale.on("resize", this.handleResize, this);

      // Bersihin event
      this.events.on("shutdown", () => {
        document.removeEventListener("mousemove", this.inputFallbackMove);
        document.removeEventListener("mousedown", this.inputFallbackClick);
        this.scale.off("resize", this.handleResize, this);
      });

      this.input.keyboard.on("keydown-SPACE", () => this.swapAmmo());

      // --- Logika Input ---
      this.handleInputMove = function (x, y) {
        if (this.isGameOver || !this.turret) return;
        // Hapus debug

        // Hitung sudut putar
        this.targetRotation = Phaser.Math.Angle.Between(
          this.turret.x,
          this.turret.y,
          x,
          y,
        );
      };

      this.handleInputClick = function (x, y) {
        if (this.isGameOver || !this.turret) return;
        if (
          Phaser.Math.Distance.Between(x, y, this.turret.x, this.turret.y) < 60
        ) {
          this.swapAmmo();
        } else {
          this.shootBullet({ x: x, y: y });
        }
      };

      // F. Tabrakan
      this.physics.add.overlap(
        this.bullets,
        this.marbles,
        this.handleCollision,
        null,
        this,
      );

      // G. Timer Muncul Bola
      this.time.addEvent({
        delay: this.spawnDelay,
        callback: this.spawnMarble,
        callbackScope: this,
        loop: true,
      });

      // H. Update UI
      this.updateUI();

      // Suara
      try {
        this.sound.play("shoot", { volume: 0 }); // Pre-warm audio
      } catch (e) {}

      console.log("✅ Phaser CREATE Finished");
    } catch (err) {
      console.error("❌ CRITICAL ERROR in CREATE:", err);
      alert("Game Error: " + err.message);
    }
  }

  // 4. Update Loop
  update(time, delta) {
    if (this.isGameOver) return;

    // --- Rotasi Mulus ---
    if (this.turret && this.targetRotation !== undefined) {
      const currentRotation = this.turret.rotation;
      this.turret.rotation = Phaser.Math.Angle.RotateTo(
        currentRotation,
        this.targetRotation,
        0.01 * delta,
      );

      // Putar balik biar ga kebalik
      // Biar tegak lurus
      if (this.ammoText) this.ammoText.setRotation(-this.turret.rotation);
      if (this.ammoVisual) this.ammoVisual.setRotation(-this.turret.rotation);
    }

    // Gerakin Kelereng
    this.marbles.getChildren().forEach((marble) => {
      // ... (Existing marble update)
      if (marble.active) {
        marble.pathProgress += 0.0005 * this.gameSpeed * (delta / 16);

        if (marble.pathProgress >= 1) {
          this.gameOver("Kelereng Mencapai Lubang!");
          return;
        }

        const point = this.pathCurve.getPoint(marble.pathProgress);
        if (point) {
          marble.setPosition(point.x, point.y);
          if (marble.textObject) {
            marble.textObject.setPosition(point.x, point.y);
          }
        }
      }
    });

    // Hapus peluru
    this.bullets.getChildren().forEach((bullet) => {
      // ... (Existing bullet update)
      if (
        bullet.active &&
        (bullet.x < -100 ||
          bullet.x > this.scale.width + 100 ||
          bullet.y < -100 ||
          bullet.y > this.scale.height + 100)
      ) {
        this.destroyBullet(bullet);
      }
      if (bullet.active && bullet.textObject) {
        bullet.textObject.setPosition(bullet.x, bullet.y);
      }
    });

    // Cek Level Selesai
    if (
      this.spawnedCount >= this.maxEnemies &&
      this.marbles.countActive() === 0
    ) {
      this.levelComplete();
    }
  }

  /* =========================================
     HELPER FUNCTIONS
     ========================================= */

  // 1. TEXTURE GENERATOR (Membuat Bola 3D)
  generateTextures() {
    const colors = {
      red: 0xff0000,
      green: 0x00ff00,
      blue: 0x0000ff,
      yellow: 0xffff00,
      purple: 0xff00ff,
      cyan: 0x00ffff,
      orange: 0xff8800,
      lime: 0x88ff00,
      pink: 0xff0088,
    };

    Object.keys(colors).forEach((key) => {
      const c = Phaser.Display.Color.IntegerToColor(colors[key]);
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });

      // Base Shadow
      graphics.fillStyle(0x000000, 0.5);
      graphics.fillCircle(18, 18, 16);

      // Body (Gradient Pseudo-effect)
      graphics.fillStyle(colors[key], 1);
      graphics.fillCircle(16, 16, 16);

      // Highlight (White Glint)
      graphics.fillStyle(0xffffff, 0.4);
      graphics.fillCircle(12, 12, 6); // Top-left shine

      graphics.generateTexture(`marble_${key}`, 36, 36);
    });

    // Turret Texture
    const tG = this.make.graphics({ x: 0, y: 0, add: false });
    tG.fillStyle(0x444444);
    tG.fillCircle(0, 0, 40); // Base
    tG.fillStyle(0x00f2ff);
    tG.fillRect(0, -10, 50, 20); // Barrel
    tG.generateTexture("turret_tex", 100, 100);
  }

  // 2. PATH SISTEM
  // 2. PATH SISTEM
  createPath(pola) {
    this.pathGraphics = this.add.graphics();
    let points = [];
    const w = this.scale.width,
      h = this.scale.height;

    // Determine Pattern Based on Level if 'auto' or unspecified
    // Logic:
    // Levels 1-2: Sine (ZigZag)
    // Levels 3-4: Circle
    // Levels 5-6: Spiral
    // Levels 7+: Infinity
    let finalPola = pola;

    // Logic Override based on Current Level (Simple Progression)
    if (currentLevel <= 2) finalPola = "sine";
    else if (currentLevel <= 4) finalPola = "circle";
    else if (currentLevel <= 6) finalPola = "spiral";
    else finalPola = "infinity";

    console.log(`Generating Path: ${finalPola} for Level ${currentLevel}`);

    if (finalPola === "spiral") {
      // SPIRAL (Classic)
      for (let i = 0; i <= 300; i++) {
        let angle = 0.1 * i;
        let r = 20 + 2 * i;
        if (r > w / 2 - 50) break;
        points.push(
          new Phaser.Math.Vector2(
            w / 2 + r * Math.cos(angle),
            h / 2 + r * Math.sin(angle),
          ),
        );
      }
      points.reverse(); // Masuk dari luar ke dalam
    } else if (finalPola === "sine") {
      // SINE WAVE (ZigZag horizontal)
      const segmentCount = 40;
      for (let i = 0; i <= segmentCount; i++) {
        const progress = i / segmentCount;
        const px = 50 + progress * (w - 100); // 50 to 750
        // 3 Gelombang penuh
        const py = h / 2 + Math.sin(progress * Math.PI * 4) * 150;
        points.push(new Phaser.Math.Vector2(px, py));
      }
    } else if (finalPola === "circle") {
      // CIRCLE / OVAL
      const radiusX = 300;
      const radiusY = 200;
      for (let i = 0; i <= 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        // Start from Top (-PI/2) and go clockwise or counter
        const px = w / 2 + Math.cos(angle - Math.PI / 2) * radiusX;
        const py = h / 2 + Math.sin(angle - Math.PI / 2) * radiusY;
        points.push(new Phaser.Math.Vector2(px, py));
      }
      // Pastikan tidak tertutup penuh agar ada "lubang" tapi untuk Zuma biasanya hole ada di ujung
      // Kita biarkan terbuka sedikit atau overlap?
      // Logic Marble: Jika pathProgress >= 1 -> Over.
    } else if (finalPola === "infinity") {
      // FIGURE 8 (Lemniscate-ish)
      const scale = 250;
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        // Parametric equation for Lemniscate of Bernoulli or Lissajous
        const px = w / 2 + scale * Math.cos(t);
        const py = h / 2 + (scale * Math.sin(2 * t)) / 2;
        points.push(new Phaser.Math.Vector2(px, py));
      }
    } else {
      // Fallback Same as Sine
      const segmentCount = 40;
      for (let i = 0; i <= segmentCount; i++) {
        const progress = i / segmentCount;
        const px = 50 + progress * (w - 100);
        const py = h / 2 + Math.sin(progress * Math.PI * 4) * 150;
        points.push(new Phaser.Math.Vector2(px, py));
      }
    }

    this.pathCurve = new Phaser.Curves.Spline(points);

    // Gambar Jalur
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(40, 0x000000, 0.3); // Groove Shadow
    this.pathCurve.draw(this.pathGraphics, 64);
    this.pathGraphics.lineStyle(2, 0x00ffff, 0.2); // Guide Line
    this.pathCurve.draw(this.pathGraphics, 64);
  }

  // 3. Munculin Bola (Spawner)
  spawnMarble() {
    if (this.spawnedCount >= this.maxEnemies || this.isGameOver) return;

    const startPoint = this.pathCurve.getPoint(0);
    const colorKeys = [
      "red",
      "green",
      "blue",
      "yellow",
      "purple",
      "cyan",
      "orange",
    ];

    // Logika Angka
    const a = Phaser.Math.Between(1, 5);
    const b = Phaser.Math.Between(1, 5);
    const val = a + b;
    const txt = `${a}+${b}`;

    // Pilih Warna
    const colorKey = colorKeys[val % colorKeys.length];

    const marble = this.marbles.create(
      startPoint.x,
      startPoint.y,
      `marble_${colorKey}`,
    );
    marble.value = val;
    marble.colorKey = colorKey;
    marble.pathProgress = 0;
    marble.setCircle(16);

    // Tambahkan Teks di atas marble
    const textObj = this.add
      .text(startPoint.x, startPoint.y, txt, {
        fontSize: "11px",
        fontFamily: "Arial",
        color: "#000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    marble.textObject = textObj;
    this.spawnedCount++;
    this.updateUI();
  }

  // SPACING FIX: Find safe spawn position with minimum distance from existing marbles
  findSafeSpawnProgress() {
    const activeMarbles = this.marbles.getChildren().filter((m) => m.active);

    // If no marbles exist, spawn at start
    if (activeMarbles.length === 0) {
      return 0;
    }

    // Find the frontmost (highest progress) marble
    const frontMarble = activeMarbles.reduce((max, marble) => {
      return marble.pathProgress > max.pathProgress ? marble : max;
    }, activeMarbles[0]);

    // Calculate safe spawn position: behind front marble by minimum distance
    const safeProgress = Math.max(
      0,
      frontMarble.pathProgress - MARBLE_MIN_DISTANCE,
    );

    return safeProgress;
  }

  // 4. Penembak & Peluru
  createTurret() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Position turret near the bottom center
    this.turret = this.add.container(w / 2, h - 50);
    this.turret.setDepth(100);

    // 1. Laras (Barrel)
    const barrel = this.add.rectangle(20, 0, 60, 24, 0x444444);
    barrel.setStrokeStyle(2, 0x00f2ff);
    this.turret.add(barrel);

    // 2. Badan (Body)
    const body = this.add.circle(0, 0, 35, 0x222222);
    body.setStrokeStyle(4, 0x00f2ff);
    this.turret.add(body);

    // 3. Visual Peluru Aktif
    this.ammoVisual = this.add.sprite(0, 0, "marble_red").setScale(1.2);
    this.turret.add(this.ammoVisual);

    // 4. Teks Peluru
    this.ammoText = this.add
      .text(0, 0, "5", {
        fontSize: "32px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.turret.add(this.ammoText);

    this.updateAmmoVisual();
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Reset Viewport
    this.cameras.main.setViewport(0, 0, width, height);

    // Reposition turret
    if (this.turret) {
      this.turret.setPosition(width / 2, height - 50);
    }

    // Redraw Path (Optional, if you want the path to scale with screen)
    if (this.pathGraphics && this.levelData) {
      this.createPath(this.levelData.pola || "spiral");
    }
  }

  updateAmmoVisual() {
    const colorKeys = [
      "red",
      "green",
      "blue",
      "yellow",
      "purple",
      "cyan",
      "orange",
    ];
    const key = colorKeys[this.playerAmmo % colorKeys.length];

    if (this.textures.exists(`marble_${key}`)) {
      this.ammoVisual.setTexture(`marble_${key}`);
    }
    this.ammoText.setText(this.playerAmmo.toString());
  }

  shootBullet(pointer) {
    if (!this.canShoot) return;
    this.canShoot = false; // Jangan spam

    // Ambil koordinat target
    const targetX = pointer.x || 0;
    const targetY = pointer.y || 0;

    const colorKeys = [
      "red",
      "green",
      "blue",
      "yellow",
      "purple",
      "cyan",
      "orange",
    ];
    const key = colorKeys[this.playerAmmo % colorKeys.length];

    const bullet = this.bullets.create(
      this.turret.x,
      this.turret.y,
      `marble_${key}`,
    );
    bullet.setScale(0.7);
    bullet.setCircle(14);
    bullet.value = this.playerAmmo;

    const angle = this.turret.rotation;
    const vec = this.physics.velocityFromRotation(angle, 600); // Kecepatan 600
    bullet.setVelocity(vec.x, vec.y);

    // Teks di peluru
    const txt = this.add
      .text(this.turret.x, this.turret.y, this.playerAmmo.toString(), {
        fontSize: "12px",
        color: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    bullet.textObject = txt;

    // Suara
    try {
      this.sound.play("shoot");
    } catch (e) {}

    // Reload otomatis (200ms)
    this.time.delayedCall(200, () => {
      this.randomizeAmmo();
      this.canShoot = true; // Bisa tembak lagi
    });
  }

  randomizeAmmo() {
    // Pilih peluru acak
    const activeMarbles = this.marbles.getChildren().filter((m) => m.active);

    // Prioritaskan warna yang ada (90%)
    if (activeMarbles.length > 0 && Math.random() < 0.9) {
      const target =
        activeMarbles[Phaser.Math.Between(0, activeMarbles.length - 1)];
      this.playerAmmo = target.value;
    } else {
      this.playerAmmo = Phaser.Math.Between(1, 9);
    }
    this.updateAmmoVisual();

    // Animasi muncul
    this.tweens.add({
      targets: this.ammoVisual,
      scale: { from: 0.1, to: 1.2 },
      duration: 200,
      ease: "Back.out",
    });
  }

  swapAmmo() {
    this.randomizeAmmo();
  }

  handleCollision(bullet, marble) {
    if (!bullet.active || !marble.active) return;

    // Cek Kena
    if (bullet.value === marble.value) {
      // HIT BENAR
      // REBALANCED: Increased from 10 to 15 (line 718)
      this.score += 15;
      this.destroyMarble(marble);
      this.destroyBullet(bullet);

      // Efek Partikel
      this.createExplosion(marble.x, marble.y, marble.colorKey);

      // Sound Effect
      if (window.safePlayCorrect) window.safePlayCorrect();

      // Update Skor Socket
      if (socket) socket.emit("updateScore", this.score);
    } else {
      // HIT SALAH (Hapus bullet saja)
      // if(window.safePlayWrong) window.safePlayWrong();
      this.destroyBullet(bullet);
    }

    this.updateUI();
  }

  destroyMarble(marble) {
    if (marble.textObject) marble.textObject.destroy();
    marble.destroy();
  }

  destroyBullet(bullet) {
    if (bullet.textObject) bullet.textObject.destroy();
    bullet.destroy();
  }

  levelComplete() {
    // Panggil Game Over dengan status WIN
    this.gameOver("STAGE CLEARED!", true);
  }

  createExplosion(x, y, colorKey) {
    // Efek ledakan simpel
    const p = this.add.particles(0, 0, `marble_${colorKey}`, {
      x: x,
      y: y,
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      lifespan: 500,
      quantity: 5,
    });
    setTimeout(() => p.destroy(), 600);
  }

  updateUI() {
    // Update elemen DOM
    const scoreEl = document.getElementById("score");
    const targetEl = document.getElementById("target-count");

    if (scoreEl) scoreEl.innerText = this.score;
    if (targetEl)
      targetEl.innerText = `${this.spawnedCount}/${this.maxEnemies}`;
  }

  gameOver(reason, isWin = false) {
    this.isGameOver = true;
    this.physics.pause();

    console.log("GAME OVER:", reason);

    // Tampilkan Layar Game Over UI
    const goScreen = document.getElementById("game-over-screen");
    const finalScore = document.getElementById("final-score");
    // Cari judul h1 atau h2
    const actualTitle =
      goScreen.querySelector("h1") || goScreen.querySelector("h2");

    if (goScreen) {
      goScreen.style.display = "flex";
      goScreen.classList.remove("hidden");

      if (isWin) {
        if (actualTitle) {
          actualTitle.innerText = "LEVEL SELESAI!";
          actualTitle.style.color = "#00ff00";
        }
      } else {
        if (actualTitle) {
          actualTitle.innerText = "GAME OVER";
          actualTitle.style.color = "#ff0000";
        }
      }
    }
    if (finalScore) finalScore.innerText = this.score;

    // Setup Tombol Main Lagi / Lanjut
    const btnRestart = document.querySelector(".btn-restart");
    if (btnRestart) {
      // Hapus listener lama dengan clone
      const newBtn = btnRestart.cloneNode(true);
      btnRestart.parentNode.replaceChild(newBtn, btnRestart);

      // Hapus onclick biar gak error
      newBtn.removeAttribute("onclick");

      if (isWin) {
        newBtn.innerText = "Lanjut Level Berikutnya ⏩";
        newBtn.onclick = () => window.nextLevelZuma();
      } else {
        newBtn.innerText = "🔄 Main Lagi";
        newBtn.onclick = () => window.restartZuma();
      }
    }

    // Simpan Skor
    if (socket) {
      socket.emit("simpanSkor", {
        nama: playerName,
        skor: this.score,
        game: "zuma",
      });
    }
  }

  // --- Metode Baru buat Leveling ---
  retryLevel() {
    // Sembunyiin UI
    document.getElementById("game-over-screen").style.display = "none";
    // Restart scene dengan data level SAMA
    this.scene.restart({ levelData: this.levelData, score: this.score });
  }

  advanceLevel() {
    // Sembunyiin UI
    document.getElementById("game-over-screen").style.display = "none";

    // Naik global level
    currentLevel++;

    console.log("Minta Level Baru:", currentLevel);

    // Minta Data Baru (AI)
    if (socket) {
      socket.emit("mintaSoalAI", {
        kategori: "zuma",
        tingkat: selectedDifficulty,
      });

      socket.once("soalDariAI", (data) => {
        console.log("Data Level Baru:", data);
        this.scene.restart({ levelData: data.data, score: this.score });
      });
    } else {
      // Fallback Offline
      this.scene.restart({ levelData: this.levelData, score: this.score });
    }
  }
}

// === FUNGSI GLOBAL ===
window.restartZuma = function () {
  // Wrapper tombol restart
  const game = currentGameInstance;
  if (!game) {
    location.reload();
    return;
  }

  // Cek scene aktif
  const scene = game.scene.getScene("ZumaScene");
  if (scene) {
    scene.retryLevel();
  } else {
    location.reload();
  }
};

window.nextLevelZuma = function () {
  const game = currentGameInstance;
  if (!game) return;
  const scene = game.scene.getScene("ZumaScene");
  if (scene) scene.advanceLevel();
};

window.destroyZumaGame = function () {
  if (currentGameInstance) {
    currentGameInstance.destroy(true);
    currentGameInstance = null;
  }

  const container = document.getElementById("game-container");
  if (container) container.innerHTML = "";
};

// === BOOTSTRAP GAME ===
let currentGameInstance = null;

function initGame() {
  if (currentGameInstance) {
    console.warn("⚠️ Game udah ada! Hancurkan yang lama...");
    currentGameInstance.destroy(true);
    currentGameInstance = null;
  }

  const config = { ...GAME_CONFIG, scene: ZumaScene };
  currentGameInstance = new Phaser.Game(config);
  return currentGameInstance;
}

// === SOCKET LISTENERS ===
document.addEventListener("DOMContentLoaded", () => {
  // Tombol Start dengan Anti-Spam Protection
  const rawStartFunction = () => {
    // Cegah klik ganda
    const btn = document.querySelector(".btn-start");
    if (btn) btn.disabled = true;

    const nameInput = document.getElementById("username");
    if (nameInput && nameInput.value) playerName = nameInput.value;

    // Sembunyiin Login
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("game-hud").style.display = "flex";

    // Mulai Game
    const game = initGame(); // Start game immediately

    // Minta Data Level
    if (socket) {
      socket.emit("mintaSoalAI", {
        kategori: "zuma",
        tingkat: selectedDifficulty,
      });

      // Bersihin listener lama
      socket.off("soalDariAI");

      socket.once("soalDariAI", (data) => {
        // Pass data ke scene
        // Tunggu scene siap
        setTimeout(() => {
          const scene = game.scene.getScene("ZumaScene");
          if (scene) {
            console.log("📥 Data Level Masuk", data);
            // Restart buat apply param
            scene.scene.restart({ levelData: data.data });
          }
        }, 500);
      });
    }
  };

  // Anti-spam wrapper (500ms cooldown)
  if (window.GameUtils) {
    window.startGameMultiplayer = GameUtils.createClickGuard(
      rawStartFunction,
      500,
    );
  } else {
    window.startGameMultiplayer = rawStartFunction;
  }
});

// Update Difficulty Button
const btns = document.querySelectorAll(".btn-difficulty");
btns.forEach((btn) => {
  btn.addEventListener("click", () => {
    btns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedDifficulty = btn.dataset.level;
  });
});
