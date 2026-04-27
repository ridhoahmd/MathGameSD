// ============================================
// GAME TANGKAP BINTANG
// Game matematika simpel pake Phaser 3
// ============================================

// Koneksi socket buat save skor
// BUG-02 FIX: Pakai window.socket dari global.js (sudah include auth token jika guru/admin)
// Jangan buat koneksi baru! Duplikat socket = memory leak + tanpa token
const socket = window.socket;
const username = localStorage.getItem("playerName") || "Tamu";


// State Game
let gameActive = false;
let currentDifficulty = "mudah"; // pilihan: mudah, sedang, sulit
let combo = 0;
let maxCombo = 0;

// Config dasar: Cek resolusi layar (Mobile vs Desktop)
// FIX: Gunakan lebar aktual untuk tentukan layout portrait vs landscape
const isPortrait = window.innerWidth < window.innerHeight;
const screenW = window.innerWidth;
const screenH = window.innerHeight;

// Dimensi canvas game (aspek rasio 4:3 untuk landscape, 3:5 untuk portrait)
// FIX: Jika layar sesungguhnya lebih kecil dari dimensi target, gunakan layar aktual
const GAME_WIDTH  = isPortrait ? Math.min(480, screenW)  : Math.min(800, screenW);
const GAME_HEIGHT = isPortrait ? Math.min(700, screenH)  : Math.min(600, screenH);

// Tetap simpan isMobile untuk backward compat
const isMobile = isPortrait;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    // FIT: Skalakan canvas agar muat di layar tanpa memotong, sambil menjaga aspek rasio
    // CENTER_BOTH: Pastikan canvas selalu di tengah (horizontal & vertical)
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // parentIsWindow: true → Phaser center terhadap window viewport, bukan parent container
    // Ini kunci supaya canvas selalu tepat di tengah layar laptop!
    parentIsWindow: true,
    // Batas min/max supaya tidak terlalu kecil di mobile atau terlalu besar di 4K
    min: { width: 320, height: 320 },
    max: { width: 1200, height: 900 },
  },
};


// Variabel main game
let player;
let stars;
let cursors;
let score = 0;
let lives = 3;
let _shadowScore = 0; // Anti-cheat var
let _shadowLives = 3; // Anti-cheat var
let timeLeft = 60;
let currentQuestion = null;
let correctAnswer = null;
let gameOver = false;
let timerEvent;
let starSpawnTimer;

// Efek partikel
let emitter;

// Elemen HTML (DOM)
const scoreDisplay = document.getElementById("score-display");
const livesDisplay = document.getElementById("lives-display");
const timeDisplay = document.getElementById("time-display");
const questionText = document.getElementById("question-text");
const gameOverModal = document.getElementById("game-over-modal");
const startScreen = document.getElementById("start-screen");
const finalScoreEl = document.getElementById("final-score");

// Inisialisasi Phaser (Nunggu player klik start)
let game;

// --- PENGATURAN KESULITAN ---
const difficultySettings = {
  mudah: { spawnRate: 1500, speedMin: 2, speedMax: 4, ops: ["+"] },
  sedang: { spawnRate: 1200, speedMin: 4, speedMax: 6, ops: ["+", "-"] },
  sulit: { spawnRate: 800, speedMin: 6, speedMax: 9, ops: ["+", "-", "×"] },
};

// --- FUNGSI GLOBAL ---
window.selectDifficulty = function (level) {
  currentDifficulty = level;
  startScreen.classList.add("hidden"); // Umpetin layar start
  startGame();
};

function startGame() {
  // 🔧 FIX: Emit mulaiGame agar server mencatat sesi bermain yang valid
  // Tanpa ini, server akan menolak simpanSkor karena sesi dianggap tidak valid
  if (socket) {
    socket.emit("mulaiGame", "bintang");
    window._activeGameSlug = "bintang"; // BUG-03 FIX: agar reconnect handler bisa re-register sesi
  }

  if (!game) {
    game = new Phaser.Game(config);
    
    // FIX HUD OVERLAP: Setelah Phaser ready, geser canvas ke bawah HUD menggunakan transform
    // Alasan pakai transform bukan margin-top: Phaser bisa override margin tapi TIDAK override transform
    game.events.once('ready', () => {
      applyCanvasTopOffset();
      
      // Re-apply saat window resize (Phaser FIT akan recalculate posisi)
      window.addEventListener('resize', applyCanvasTopOffset);
    });
  } else {
    // Kalo game udah ada, restart aja scenenya
    game.scene.scenes[0].scene.restart();
    setTimeout(applyCanvasTopOffset, 200); // Delay kecil setelah restart
  }
  gameActive = true;
}

// Fungsi untuk menggeser canvas ke bawah area HUD
function applyCanvasTopOffset() {
  const canvas = document.querySelector('#game-container canvas');
  const topBar = document.querySelector('.top-bar');
  if (!canvas) return;
  
  // Hitung tinggi area HUD (top-bar + question) secara dinamis
  let hudBottom = 130; // fallback
  if (topBar) {
    const tbr = topBar.getBoundingClientRect();
    const qCont = document.getElementById('question-container');
    if (qCont) {
      const qRect = qCont.getBoundingClientRect();
      hudBottom = Math.ceil(qRect.bottom) + 10; // 10px margin bawah soal
    } else {
      hudBottom = Math.ceil(tbr.bottom) + 10;
    }
  }
  
  // Ambil posisi canvas saat ini dari Phaser (absolute top)
  const canvasRect = canvas.getBoundingClientRect();
  const currentTop = canvasRect.top;
  
  if (currentTop < hudBottom) {
    // Geser canvas ke bawah menggunakan transform translateY
    // Ini tidak diinterferensi oleh Phaser's internal centering logic
    const shiftY = hudBottom - currentTop;
    canvas.style.transform = `translateY(${shiftY}px)`;
    canvas.style.transformOrigin = 'top center';
  } else {
    // Canvas sudah di bawah HUD, tidak perlu shift
    canvas.style.transform = '';
  }
}

// Load aset dulu
function preload() {
  // Assets loaded
}

// Bikin objek-objek game di sini
function create() {
  const scene = this; // Simpen referensi scene

  // Reset semua stats
  score = 0;
  lives = 3;
  _shadowScore = 0;
  _shadowLives = 3;
  timeLeft = 60;
  combo = 0;
  gameOver = false;
  window.gameEndingBintang = false; // Reset anti-spam flag
  updateUI();

  // Bikin background gradasi biar keren
  const bg = this.add.graphics();
  bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a3e, 0x1a1a3e, 1);
  bg.fillRect(0, 0, this.scale.width, this.scale.height);

  // Hiasan bintang bintang latar belakang
  for (let i = 0; i < 50; i++) {
    const x = Phaser.Math.Between(0, this.scale.width);
    const y = Phaser.Math.Between(0, this.scale.height);
    const size = Phaser.Math.Between(1, 3);
    const star = this.add.circle(x, y, size, 0xffffff, 0.3);

    // Animasi kedip-kedip
    this.tweens.add({
      targets: star,
      alpha: { from: 0.1, to: 0.5 },
      duration: Phaser.Math.Between(1000, 3000),
      yoyo: true,
      repeat: -1,
    });
  }

  // Bikin tekstur Player manual (ga pake gambar luar)
  if (!this.textures.exists("player")) {
    const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    playerGraphics.fillStyle(0x00f2ff, 0.3); // Cahaya glow
    playerGraphics.fillRoundedRect(-5, -5, 90, 40, 15);
    playerGraphics.fillStyle(0x00f2ff, 1); // Badan pesawat
    playerGraphics.fillRoundedRect(0, 0, 80, 30, 10);
    playerGraphics.fillStyle(0x00b4d8, 1); // Highlight
    playerGraphics.fillRoundedRect(5, 5, 70, 20, 8);
    playerGraphics.fillStyle(0xffffff, 0.5); // Kilap
    playerGraphics.fillRoundedRect(15, 8, 50, 5, 3);
    playerGraphics.generateTexture("player", 90, 40);
  }

  // Spawn Player
  player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 50, "player");
  player.setCollideWorldBounds(true);
  player.setImmovable(true);

  // Bikin tekstur Bintang (bintang beneran vs salah)
  if (!this.textures.exists("star")) {
    const starGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    starGraphics.fillStyle(0xffeb3b, 1);
    drawStar(starGraphics, 25, 25, 5, 25, 12);
    starGraphics.generateTexture("star", 50, 50);
  }

  if (!this.textures.exists("wrongStar")) {
    const wrongStarGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    wrongStarGraphics.fillStyle(0xff4444, 1);
    drawStar(wrongStarGraphics, 25, 25, 5, 25, 12);
    wrongStarGraphics.generateTexture("wrongStar", 50, 50);
  }

  // Tekstur partikel ledakan
  if (!this.textures.exists("particle")) {
    const p = this.make.graphics({ x: 0, y: 0, add: false });
    p.fillStyle(0xffffff, 1);
    p.fillCircle(4, 4, 4);
    p.generateTexture("particle", 8, 8);
  }

  // Setup Emitter Partikel
  const particles = this.add.particles(0, 0, "particle", {
    speed: { min: 50, max: 150 },
    scale: { start: 1, end: 0 },
    lifespan: 600,
    emitting: false,
  });
  emitter = particles;

  // Grup bintang jatuh
  stars = this.physics.add.group();

  // Deteksi tabrakan player sama bintang
  this.physics.add.overlap(player, stars, collectStar, null, this);

  // Input keyboard & mouse (FIX: Mobile UX Control)
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on("pointermove", (pointer) => {
    if (!gameOver) {
      if (pointer.pointerType === "touch" && !pointer.isDown) return;

      if (pointer.pointerType === "touch") {
        // Gerakan geser relatif agar jari tidak menutupi pesawat
        player.x += pointer.x - pointer.prevPosition.x;
      } else {
        // Gerakan absolut untuk mouse PC
        player.x = pointer.x;
      }
      player.x = Phaser.Math.Clamp(player.x, 40, scene.scale.width - 40);
    }
  });

  // Soal pertama
  generateQuestion();

  // Timer game
  timerEvent = this.time.addEvent({
    delay: 1000,
    callback: updateTimer,
    callbackScope: this,
    loop: true,
  });

  // Timer spawn bintang (sesuai kesulitan)
  const settings = difficultySettings[currentDifficulty];
  starSpawnTimer = this.time.addEvent({
    delay: settings.spawnRate,
    callback: spawnStar,
    callbackScope: this,
    loop: true,
  });

  // Spawn awal biar ga sepi
  for (let i = 0; i < 3; i++) {
    this.time.delayedCall(i * 500, spawnStar, [], this);
  }
  
  // Resize handler
  this.scale.on('resize', handleResize, this);
  this.events.on('shutdown', () => {
    this.scale.off('resize', handleResize, this);
  });
}

function handleResize(gameSize) {
    // FIT mode: Phaser mengelola ukuran canvas secara otomatis
    // Kita hanya perlu pastikan kamera update ke ukuran baru
    const width = gameSize.width;
    const height = gameSize.height;
    this.cameras.main.setViewport(0, 0, width, height);
    
    // Update posisi player agar tidak keluar layar setelah resize
    if (player && player.active) {
        player.x = Phaser.Math.Clamp(player.x, 40, width - 40);
        player.y = height - 50;
    }
}

// Loop Utama (Update setiap frame)
function update() {
  if (gameOver) return;

  // Kontrol keyboard
  if (cursors.left.isDown) {
    player.x -= 10;
  } else if (cursors.right.isDown) {
    player.x += 10;
  }

  // Jaga player tetep dalem layar
  player.x = Phaser.Math.Clamp(player.x, 40, this.scale.width - 40);

  // Gerakin bintang ke bawah
  stars.getChildren().forEach((star) => {
    star.y += star.getData("speed");
    star.rotation += 0.02; // Puter dikit biar dinamis

    // Update posisi teks angka di bintang
    const text = star.getData("text");
    if (text && text.active) {
      text.x = star.x;
      text.y = star.y;
    }

    // Hapus kalo udah lewat bawah layar
    if (star.y > this.scale.height + 30) {
      if (text) text.destroy();
      star.destroy();
    }
  });
}

// Fungsi bantu gambar bintang
function drawStar(graphics, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  graphics.beginPath();
  graphics.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    graphics.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    graphics.lineTo(x, y);
    rot += step;
  }

  graphics.lineTo(cx, cy - outerRadius);
  graphics.closePath();
  graphics.fillPath();
}

// Bikin soal matematika random
function generateQuestion() {
  const settings = difficultySettings[currentDifficulty];
  const op = settings.ops[Math.floor(Math.random() * settings.ops.length)];
  let a, b;

  if (op === "+") {
    a = Phaser.Math.Between(1, 20);
    b = Phaser.Math.Between(1, 20);
    correctAnswer = a + b;
  } else if (op === "-") {
    a = Phaser.Math.Between(10, 30);
    b = Phaser.Math.Between(1, a);
    correctAnswer = a - b;
  } else if (op === "×") {
    a = Phaser.Math.Between(2, 9);
    b = Phaser.Math.Between(2, 9);
    correctAnswer = a * b;
  }

  currentQuestion = `${a} ${op} ${b} = ?`;
  questionText.textContent = currentQuestion;

  // Animasi dikit pas soal ganti
  questionText.style.transform = "scale(1.2)";
  setTimeout(() => (questionText.style.transform = "scale(1)"), 200);
}

// Munculin bintang
function spawnStar() {
  if (gameOver) return;

  const w = game ? game.scale.width : GAME_WIDTH;
  const h = game ? game.scale.height : GAME_HEIGHT;

  const x = Phaser.Math.Between(50, w - 50);
  const isCorrect = Math.random() < 0.4; // 40% kemungkinan bener

  const value = isCorrect
    ? correctAnswer
    : correctAnswer +
      (Phaser.Math.Between(0, 1) ? 1 : -1) * Phaser.Math.Between(1, 5);

  const texture = isCorrect ? "star" : "wrongStar";
  const star = stars.create(x, -40, texture);

  const settings = difficultySettings[currentDifficulty];
  // FIX: Standarisasi kecepatan layar (Speed Relatif ke GAME_HEIGHT)
  const speed =
    Phaser.Math.Between(settings.speedMin, settings.speedMax) *
    (h / 600);

  star.setData("value", value);
  star.setData("isCorrect", value === correctAnswer);
  star.setData("speed", speed);

  // Tampilin angkanya
  const scene = game.scene.scenes[0];
  const text = scene.add.text(x, -40, value.toString(), {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "18px",
    fontStyle: "bold",
    color: "#000",
  });
  text.setOrigin(0.5);
  star.setData("text", text);
}

// Pas bintang diambil
function collectStar(player, star) {
  // FIX: Cegah Ghost Collecting dari overlap ganda (tabrakan ganda dlm 1 frame)
  if (star.getData("collected")) return;
  star.setData("collected", true);

  const isCorrect = star.getData("isCorrect");
  const value = star.getData("value");
  const text = star.getData("text");
  const scene = this;

  // Bersihin
  if (text) text.destroy();
  star.destroy();

  if (value === correctAnswer) {
    // BENAR!
    // REBALANCED: Cap combo bonus to prevent farming (was unlimited 5x per combo)
    const basePoints = 8; // Reduced from 10
    const comboBonus = Math.min(combo * 3, 20); // Cap at +20 max (was unlimited combo * 5)
    score += basePoints + comboBonus;
    _shadowScore += basePoints + comboBonus; // Anticheat set

    combo++;
    if (combo > maxCombo) maxCombo = combo;

    // Bunyi ting!
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Efek visual
    showFeedback(
      scene,
      player.x,
      player.y - 50,
      `+${basePoints + comboBonus}`,
      0x38ef7d,
    );

    if (combo > 1) {
      const comboText =
        comboBonus >= 20 ? `${combo}x MAX COMBO!` : `${combo}x COMBO!`;
      showFeedback(scene, player.x, player.y - 80, comboText, 0xffeb3b);
    }

    // Partikel meledak
    if (emitter) {
      emitter.setPosition(player.x, player.y);
      emitter.setParticleTint(0x38ef7d);
      emitter.explode(10);
    }

    generateQuestion();

    // Hapus bintang lain biar ga bingung
    stars.getChildren().forEach((s) => {
      if (s.getData("text")) s.getData("text").destroy();
      s.destroy();
    });
  } else {
    // SALAH!
    combo = 0; // Reset Combo
    score = Math.max(0, score - 5);
    _shadowScore = score;
    lives--;
    _shadowLives--;

    // Bunyi tetot
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Visual merah
    showFeedback(scene, player.x, player.y - 50, "-5", 0xff4444);

    // Partikel merah
    if (emitter) {
      emitter.setPosition(player.x, player.y);
      emitter.setParticleTint(0xff4444);
      emitter.explode(10);
    }

    if (lives <= 0) endGame(scene);
  }

  updateUI();
}

function showFeedback(scene, x, y, text, color) {
  const feedback = scene.add.text(x, y, text, {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "24px",
    fontStyle: "bold",
    color: Phaser.Display.Color.IntegerToColor(color).rgba,
    stroke: "#000",
    strokeThickness: 3,
  });
  feedback.setOrigin(0.5);

  scene.tweens.add({
    targets: feedback,
    y: y - 50,
    alpha: 0,
    duration: 800,
    onComplete: () => feedback.destroy(),
  });
}

function updateUI() {
  // FIX: Validasi Anti-Cheat Sederhana
  if (lives > _shadowLives || score > _shadowScore) {
    console.warn("Manipulasi Variabel Memory Terdeteksi!");
    // Paksa reset
    lives = _shadowLives;
    score = _shadowScore;
  }

  scoreDisplay.innerText = score;
  timeDisplay.innerText = timeLeft;

  let hearts = "";
  for (let i = 0; i < lives; i++) hearts += "❤️";
  for (let i = lives; i < 3; i++) hearts += "🖤";
  livesDisplay.innerText = hearts;
}

function updateTimer() {
  if (gameOver) return;
  timeLeft--;
  timeDisplay.innerText = timeLeft;
  if (timeLeft <= 0) endGame(this);
}

function endGame(scene) {
  // ANTI-SPAM: Prevent multiple calls
  if (window.gameEndingBintang) return;
  window.gameEndingBintang = true;

  gameOver = true;
  if (timerEvent) timerEvent.remove();
  if (starSpawnTimer) starSpawnTimer.remove();

  finalScoreEl.innerText = score;
  gameOverModal.classList.remove("hidden");

  // Kirim skor ke server (sekali saja)
  if (socket) {
    socket.emit("simpanSkor", {
      nama: username,
      game: "bintang",
      skor: score,
    });
  }
}

// 🔧 FIX: Alias restartGame standar agar konsisten dengan game lain
window.restartGame = function () {
  if (game) {
    game.scene.scenes[0].scene.restart();
    setTimeout(applyCanvasTopOffset, 200);
  } else {
    location.reload();
  }
};

// FIX MEMORY LEAK: Destroy game instance
window.destroyBintangGame = function () {
  if (game) {
    try {
      game.destroy(true); // Hapus seluruh canvas dan event listener dari RAM
    } catch(err) {
      console.error("Gagal membersihkan Phaser:", err);
    }
    game = null;
  }
  
  if (timerEvent) {
    timerEvent.remove();
    timerEvent = null;
  }
  if (starSpawnTimer) {
    starSpawnTimer.remove();
    starSpawnTimer = null;
  }
  
  // Bersihkan DOM
  const container = document.getElementById("game-container");
  if (container) container.innerHTML = "";
  
  gameActive = false;
};

// Pastikan memori dilepas saat anak SD menutup tab atau pindah halaman
window.addEventListener("beforeunload", () => {
  if (typeof window.destroyBintangGame === "function") {
    window.destroyBintangGame();
  }
});
