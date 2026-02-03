/**
 * ZUMA PHASER - REFACTORED & ENHANCED
 * -----------------------------------
 * Fitur:
 * - Grafik Bola 3D Procedural (tanpa aset gambar eksternal)
 * - Sistem Tembak & Fisika Akurat
 * - Integrasi Socket.IO untuk Multiplayer & Skor
 * - Efek Partikel & Visual Modern
 */

// === KONFIGURASI GLOBAL ===
const GAME_CONFIG = {
  width: 800,
  height: 600,
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// === VARIABEL GLOBAL (State Management) ===
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

/* =========================================
   SCENE UTAMA: ZUMA GAMEPLAY
   ========================================= */
class ZumaScene extends Phaser.Scene {
  constructor() {
    super({ key: "ZumaScene" });
  }

  // --- 1. INITIALIZATION ---
  init(data) {
    this.score = 0;
    this.spawnedCount = 0;
    this.isGameOver = false;
    this.levelData = data.levelData || {};
    this.difficulty = data.difficulty || "mudah";

    // Setup Level Params
    const isFast = (this.levelData.speed || "").toLowerCase() === "cepat";
    this.gameSpeed = isFast ? 1.5 : 0.8;
    // Jarak lebih rapat (Delay dikurangi drastis)
    this.spawnDelay = isFast ? 1000 : 1200;
    this.maxEnemies = 15 + currentLevel * 5;

    // Player State
    this.playerAmmo = Math.floor(Math.random() * 9) + 1;
    this.canShoot = true;

    // DEBUG: DOM Level Listener
    document.addEventListener("mousemove", (e) => {
      // Update debug text directly if scene is running
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

  // --- 2. PRELOAD (Generate Aset) ---
  preload() {
    // Kita buat tekstur secara procedural di create() agar tidak perlu file eksternal
    // Load Audio jika ada
    this.load.audio("shoot", "/explosion.mp3");
  }

  // --- 3. CREATE (Setup Game Objects) ---
  create() {
    console.log("🔥 Phaser START CREATE");
    try {
      // A. SETUP GRAFIS 3D (Procedural Textures)
      this.generateTextures();

      // B. WORLD SETUP
      this.createPath(this.levelData.pola || "spiral");

      // C. GROUPS
      this.marbles = this.physics.add.group();
      this.bullets = this.physics.add.group();

      // D. PLAYER (TURRET)
      this.createTurret();
      if (this.turret) {
        this.turretInputReady = true;
        this.targetRotation = -Math.PI / 2; // Default facing up
      }

      // E. INPUT HANDLERS (PHASER)
      this.input.mouse.disableContextMenu();
      this.input.on("pointermove", (pointer) => {
        this.handleInputMove(pointer.x, pointer.y);
      });
      this.input.on("pointerdown", (pointer) => {
        this.handleInputClick(pointer.x, pointer.y);
      });

      // E2. GLOBAL FALLBACK INPUT (DOM LEVEL)
      this.inputFallbackMove = (e) => {
        if (this.isGameOver || !this.turret) return;
        const canvas = this.game.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // Scaling factor (Canvas size vs Display size)
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

      // Cleanup saat shutdown
      this.events.on("shutdown", () => {
        document.removeEventListener("mousemove", this.inputFallbackMove);
        document.removeEventListener("mousedown", this.inputFallbackClick);
      });

      this.input.keyboard.on("keydown-SPACE", () => this.swapAmmo());

      // --- LOGIC INPUT CORE ---
      this.handleInputMove = function (x, y) {
        if (this.isGameOver || !this.turret) return;
        // DEBUG TEXT REMOVED

        // Calculate target angle but DO NOT set rotation immediately
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

      // F. COLLIDERS
      this.physics.add.overlap(
        this.bullets,
        this.marbles,
        this.handleCollision,
        null,
        this,
      );

      // G. SPAWNER TIMER
      this.time.addEvent({
        delay: this.spawnDelay,
        callback: this.spawnMarble,
        callbackScope: this,
        loop: true,
      });

      // H. UI UPDATE
      this.updateUI();

      // SFX
      try {
        this.sound.play("shoot", { volume: 0 }); // Pre-warm audio
      } catch (e) {}

      console.log("✅ Phaser CREATE Finished");
    } catch (err) {
      console.error("❌ CRITICAL ERROR in CREATE:", err);
      alert("Game Error: " + err.message);
    }
  }

  // --- 4. UPDATE LOOP ---
  update(time, delta) {
    if (this.isGameOver) return;

    // --- SMOOTH ROTATION LOGIC ---
    if (this.turret && this.targetRotation !== undefined) {
      const currentRotation = this.turret.rotation;
      this.turret.rotation = Phaser.Math.Angle.RotateTo(
        currentRotation,
        this.targetRotation,
        0.01 * delta,
      );

      // Counter-rotation Logic (Fix agar angka & bola TIDAK TEBALIK)
      // Kita lawan rotasi container agar isi-nya tetap tegak lurus
      if (this.ammoText) this.ammoText.setRotation(-this.turret.rotation);
      if (this.ammoVisual) this.ammoVisual.setRotation(-this.turret.rotation);
    }

    // Gerakkan Kelereng ... (Existing logic)
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

    // Cleanup Bullets
    this.bullets.getChildren().forEach((bullet) => {
      // ... (Existing bullet update)
      if (
        bullet.active &&
        (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600)
      ) {
        this.destroyBullet(bullet);
      }
      if (bullet.active && bullet.textObject) {
        bullet.textObject.setPosition(bullet.x, bullet.y);
      }
    });

    // Cek Level Complete
    if (
      this.spawnedCount >= this.maxEnemies &&
      this.marbles.countActive() === 0
    ) {
      this.levelComplete();
    }
  }

  // ...

  shootBullet(pointer) {
    if (!this.canShoot) return;
    this.canShoot = false; // Prevent spam

    // ... (Existing shooting logic)
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
    const vec = this.physics.velocityFromRotation(angle, 600);
    bullet.setVelocity(vec.x, vec.y);

    // Add text to bullet
    const txt = this.add
      .text(this.turret.x, this.turret.y, this.playerAmmo.toString(), {
        fontSize: "12px",
        color: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    bullet.textObject = txt;

    // Sfx
    try {
      this.sound.play("shoot");
    } catch (e) {}

    // AUTO RELOAD logic (200ms delay)
    this.time.delayedCall(200, () => {
      this.randomizeAmmo();
      this.canShoot = true; // Enable shoot again
    });
  }

  randomizeAmmo() {
    // Pick random ammo from existing marbles or completely random
    const activeMarbles = this.marbles.getChildren().filter((m) => m.active);

    // Prioritize existing colors (90% chance) to make game playable
    if (activeMarbles.length > 0 && Math.random() < 0.9) {
      const target =
        activeMarbles[Phaser.Math.Between(0, activeMarbles.length - 1)];
      // Copy value/key
      this.playerAmmo = target.value;
    } else {
      // Fallback random
      this.playerAmmo = Phaser.Math.Between(1, 9);
    }
    this.updateAmmoVisual();

    // Animation pop for feedback
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
  createPath(pola) {
    this.pathGraphics = this.add.graphics();
    let points = [];
    const w = 800,
      h = 600;

    // Pola Spiral
    if (pola.includes("spiral")) {
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
    } else {
      // Default ZigZag
      for (let i = 0; i <= 10; i++) {
        points.push(
          new Phaser.Math.Vector2((i / 10) * w, h / 2 + Math.sin(i * 2) * 150),
        );
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

  // 3. SPAWNER
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

  // 4. TURRET & SHOOTING
  createTurret() {
    this.turret = this.add.container(400, 550);
    this.turret.setDepth(100);

    // 1. Barrel (Laras)
    const barrel = this.add.rectangle(20, 0, 60, 24, 0x444444);
    barrel.setStrokeStyle(2, 0x00f2ff);
    this.turret.add(barrel);

    // 2. Body (Bulatan)
    const body = this.add.circle(0, 0, 35, 0x222222);
    body.setStrokeStyle(4, 0x00f2ff);
    this.turret.add(body);

    // 3. Ammo Visual (Bola current)
    this.ammoVisual = this.add.sprite(0, 0, "marble_red").setScale(1.2);
    this.turret.add(this.ammoVisual);

    // 4. Ammo Text
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
    this.canShoot = false; // Prevent spam

    // Fallback coordinate extraction
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
    const vec = this.physics.velocityFromRotation(angle, 600); // Speed 600
    bullet.setVelocity(vec.x, vec.y);

    // Add text to bullet
    const txt = this.add
      .text(this.turret.x, this.turret.y, this.playerAmmo.toString(), {
        fontSize: "12px",
        color: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    bullet.textObject = txt;

    // Sfx
    try {
      this.sound.play("shoot");
    } catch (e) {}

    // AUTO RELOAD logic (200ms delay)
    this.time.delayedCall(200, () => {
      this.randomizeAmmo();
      this.canShoot = true; // Enable shoot again
    });
  }

  randomizeAmmo() {
    // Pick random ammo
    const activeMarbles = this.marbles.getChildren().filter((m) => m.active);

    // Prioritize existing colors (90% chance)
    if (activeMarbles.length > 0 && Math.random() < 0.9) {
      const target =
        activeMarbles[Phaser.Math.Between(0, activeMarbles.length - 1)];
      this.playerAmmo = target.value;
    } else {
      this.playerAmmo = Phaser.Math.Between(1, 9);
    }
    this.updateAmmoVisual();

    // Animation pop
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

    // Cek Hit
    if (bullet.value === marble.value) {
      // HIT BENAR
      this.score += 10;
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
    // Simple particle burst
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
    // Update DOM elements via JS
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
    const goTitle = goScreen.querySelector("h2"); // Assuming h1 or h2

    // Correct selector if h2 not found
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
      // Clear old event listeners by cloning
      const newBtn = btnRestart.cloneNode(true);
      btnRestart.parentNode.replaceChild(newBtn, btnRestart);

      // Remove onclick attribute that might cause reference errors if not handled
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

  // --- NEW METHODS FOR LEVELING ---
  retryLevel() {
    // Hide UI
    document.getElementById("game-over-screen").style.display = "none";
    // Restart scene with SAME level data
    this.scene.restart({ levelData: this.levelData });
  }

  advanceLevel() {
    // Hide UI
    document.getElementById("game-over-screen").style.display = "none";

    // Increment global level
    currentLevel++;

    console.log("Requesting Next Level:", currentLevel);

    // Request New Data (AI)
    if (socket) {
      socket.emit("mintaSoalAI", {
        kategori: "zuma",
        tingkat: selectedDifficulty,
        // Backend might not support 'level' param yet, but we simulates difficulty increase?
        // If backend is stateless, we just request new generic data.
      });

      socket.once("soalDariAI", (data) => {
        console.log("Next Level Data:", data);
        this.scene.restart({ levelData: data.data });
      });
    } else {
      // Offline Fallback
      this.scene.restart({ levelData: this.levelData });
    }
  }

  levelComplete() {
    this.isGameOver = true;
    alert(`LEVEL ${currentLevel} SELESAI!`);
    currentLevel++;
    // Reload scene dengan difficulty baru
    this.scene.restart({ levelData: this.levelData }); // Harusnya fetch level baru
    // Di versi ini kita simple reload page atau request baru
  }
}

// === GLOBAL HELPERS ===
window.restartZuma = function () {
  // Wrapper for restart button
  const game = currentGameInstance;
  if (!game) {
    location.reload();
    return;
  }

  // Check context (Win vs Lose)
  // We can just trigger the active scene's restart logic
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

// === BOOTSTRAP GAME ===
let currentGameInstance = null;

function initGame() {
  if (currentGameInstance) {
    console.warn("⚠️ Game instance already exists! Destroying old instance...");
    currentGameInstance.destroy(true);
    currentGameInstance = null;
  }

  const config = { ...GAME_CONFIG, scene: ZumaScene };
  currentGameInstance = new Phaser.Game(config);
  return currentGameInstance;
}

// === SOCKET LISTENERS ===
document.addEventListener("DOMContentLoaded", () => {
  // Tombol Start
  window.startGameMultiplayer = () => {
    // Prevent double clicks
    const btn = document.querySelector(".btn-start");
    if (btn) btn.disabled = true;

    const nameInput = document.getElementById("username");
    if (nameInput && nameInput.value) playerName = nameInput.value;

    // Hide Login
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("game-hud").style.display = "flex";

    // Start Game
    const game = initGame(); // Start game immediately

    // Request Data Level
    if (socket) {
      socket.emit("mintaSoalAI", {
        kategori: "zuma",
        tingkat: selectedDifficulty,
      });

      // Clean previous listeners to avoid dupes
      socket.off("soalDariAI");

      socket.once("soalDariAI", (data) => {
        // Pass data ke scene
        // Wait for scene to be ready
        setTimeout(() => {
          const scene = game.scene.getScene("ZumaScene");
          if (scene) {
            console.log("📥 Level Data Received", data);
            // Instead of full restart, just update data if possible, or restart if needed.
            // For now, restart is safer to apply params.
            scene.scene.restart({ levelData: data.data });
          }
        }, 500);
      });
    }
  };
});

// === GLOBAL HELPERS ===
window.restartZuma = function () {
  console.log("🔄 Restarting Level...");
  const game = currentGameInstance;
  if (!game) {
    location.reload();
    return;
  }
  const scene = game.scene.getScene("ZumaScene");
  if (scene) {
    scene.retryLevel();
  } else {
    location.reload();
  }
};

window.nextLevelZuma = function () {
  console.log("⏩ Advancing to Next Level...");
  const game = currentGameInstance;
  if (!game) return;
  const scene = game.scene.getScene("ZumaScene");
  if (scene) scene.advanceLevel();
};

// Update Difficulty Button
const btns = document.querySelectorAll(".btn-difficulty");
btns.forEach((btn) => {
  btn.addEventListener("click", () => {
    btns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedDifficulty = btn.dataset.level;
  });
});
