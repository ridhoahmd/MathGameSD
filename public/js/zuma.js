// public/zuma.js - VERSI FINAL (FIXED INPUT HANDLER)

const socket = io(); // Koneksi ke Server
const sfxTembak = new Audio("/explosion.mp3");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const gameOverScreen = document.getElementById("game-over-screen");

let score = 0;
let gameActive = false;
let myName = "";
let myRoom = "";
let spawnRate = 4000;
let lastSpawnTime = 0;
let levelData = {}; // Data level dari AI

// --- LOGIKA KESULITAN ---
let selectedDifficulty = "mudah";
document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("playerName");
  if (savedName) document.getElementById("username").value = savedName;

  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

// --- OBJEK GAME ---
const pathPoints = [
  { x: 50, y: 50 },
  { x: 750, y: 50 },
  { x: 750, y: 500 },
  { x: 50, y: 500 },
  { x: 50, y: 300 },
  { x: 400, y: 300 },
];
const player = { x: 400, y: 550, angle: 0, currentAmmo: 0, color: "#ff9800" };
let bullets = [];
let enemies = [];

// --- HELPER FUNCTIONS ---
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function createMathProblem() {
  const a = randomInt(1, 5);
  const b = randomInt(1, 5);
  return { text: `${a} + ${b}`, value: a + b };
}
function getNextAmmo() {
  const activeEnemies = enemies.filter((e) => e.active);
  if (activeEnemies.length > 0)
    return activeEnemies[Math.floor(Math.random() * activeEnemies.length)]
      .value;
  return randomInt(2, 10);
}

// --- CLASS ---
class Bullet {
  constructor(x, y, angle, value) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 12;
    this.vy = Math.sin(angle) * 12;
    this.value = value;
    this.radius = 20;
    this.active = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (
      this.x < 0 ||
      this.x > canvas.width ||
      this.y < 0 ||
      this.y > canvas.height
    )
      this.active = false;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffeb3b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";
    ctx.stroke();
    ctx.fillStyle = "black";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value, this.x, this.y);
    ctx.closePath();
  }
}

class Enemy {
  constructor() {
    this.pathIndex = 0;
    this.x = pathPoints[0].x;
    this.y = pathPoints[0].y;
    this.speed =
      levelData.speed === "cepat"
        ? 0.8
        : levelData.speed === "lambat"
        ? 0.3
        : 0.5;
    this.radius = 35;
    const problem = createMathProblem();
    this.text = problem.text;
    this.value = problem.value;
    this.active = true;
    this.color = levelData.palet_warna
      ? levelData.palet_warna[randomInt(0, 3)]
      : "#e91e63";
  }
  update() {
    const target = pathPoints[this.pathIndex + 1];
    if (!target) {
      endGame();
      return;
    }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < this.speed) this.pathIndex++;
    else {
      this.x += (dx / distance) * this.speed;
      this.y += (dy / distance) * this.speed;
    }
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x, this.y);
    ctx.closePath();
  }
}

// --- GAME FLOW ---
// --- GANTI FUNGSI startGameMultiplayer DENGAN INI ---

function startGameMultiplayer() {
  const nameInput = document.getElementById("username").value;
  const roomInput = document.getElementById("room-code").value;

  // 1. Validasi: Hanya Nama yang wajib diisi
  if (nameInput.trim() === "") {
    alert("Silakan isi Nama Pilot dulu!");
    return;
  }

  myName = nameInput;

  // 2. Logika Room Otomatis (Single vs Multiplayer)
  if (roomInput.trim() === "") {
    // Jika Room KOSONG -> Mode Single Player
    // Kita buat nama room acak agar main sendirian (isolasi)
    myRoom = "solo_" + myName + "_" + Math.floor(Math.random() * 10000);
    console.log("Masuk Mode Single Player di room: " + myRoom);
  } else {
    // Jika Room DIISI -> Mode Multiplayer (bisa ketemu teman)
    myRoom = roomInput;
  }

  // Lanjut ke proses koneksi server (kode asli)
  socket.emit("joinRoom", { username: myName, room: myRoom });

  // Tampilkan loading screen sementara
  document.getElementById("login-screen").innerHTML =
    "<h2 style='color:white;'>🛸 Meminta Misi ke AI...</h2>";

  // Minta soal ke AI sesuai tingkat kesulitan
  socket.emit("mintaSoalAI", { kategori: "zuma", tingkat: selectedDifficulty });
}

socket.on("soalDariAI", (data) => {
  if (data.kategori === "zuma") {
    // 🔥 VAKSIN DATA
    let info = data.data;
    if (Array.isArray(info)) info = info[0]; // Ambil isi

    levelData = info;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("game-hud").style.display = "block";

    const bgColors = levelData.palet_warna || ["#000", "#333"];
    document.getElementById(
      "game-container"
    ).style.background = `linear-gradient(135deg, ${bgColors[0]}, ${bgColors[1]})`;

    alert(`MISI BARU: ${levelData.deskripsi}`);
    initGameEngine();
  }
});

function initGameEngine() {
  score = 0;
  bullets = [];
  enemies = [];
  scoreEl.innerText = score;
  player.currentAmmo = randomInt(2, 10);
  player.color = levelData.palet_warna[0];
  gameActive = true;
  requestAnimationFrame(update);
}

function update(timestamp) {
  if (!gameActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++)
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 10;
  ctx.setLineDash([20, 20]);
  ctx.stroke();
  ctx.setLineDash([]);

  let currentSpawnRate = levelData.speed === "cepat" ? 2500 : 4000;
  if (timestamp - lastSpawnTime > currentSpawnRate) {
    enemies.push(new Enemy());
    lastSpawnTime = timestamp;
    if (enemies.length === 1) player.currentAmmo = enemies[0].value;
  }

  enemies = enemies.filter((e) => e.active);
  enemies.forEach((e) => {
    e.update();
    e.draw();
  });
  bullets = bullets.filter((b) => b.active);
  bullets.forEach((b) => {
    b.update();
    b.draw();
  });

  checkCollisions();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, -15, 70, 30);
  ctx.rotate(-player.angle);
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.fillText(player.currentAmmo, 0, 0);
  ctx.restore();

  requestAnimationFrame(update);
}

function checkCollisions() {
  bullets.forEach((bullet) => {
    enemies.forEach((enemy) => {
      if (!bullet.active || !enemy.active) return;
      const dist = Math.sqrt(
        (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2
      );
      if (dist < bullet.radius + enemy.radius + 30) {
        bullet.active = false;
        if (bullet.value === enemy.value) {
          enemy.active = false;
          score += 10;
          AudioManager.playCorrect();
          scoreEl.innerText = score;
          socket.emit("simpanSkor", { skor: score, room: myRoom });
          player.currentAmmo = getNextAmmo();
        }
      }
    });
  });
}

socket.on("updateSkorLawan", (skorLawan) => {
  document.getElementById("opponent-score").innerText = skorLawan;
});

function endGame() {
  if (!gameActive) return;
  gameActive = false;
  finalScoreEl.innerText = score;
  gameOverScreen.style.display = "block";
  socket.emit("simpanSkor", { nama: myName, skor: score, game: "zuma" });
  AudioManager.playWin();
}

// --- INPUT HANDLER (DENGAN SKALA OTOMATIS) ---

// 1. Fungsi Helper: Menghitung Posisi Mouse/Touch Akurat
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect(); // Ukuran visual kanvas di layar HP

  // Hitung Rasio (Penting agar tidak meleset saat layar mengecil)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Deteksi apakah ini Sentuhan (Touch) atau Mouse
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

  // Kembalikan koordinat yang sudah dikalikan rasio
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// 2. Gerakkan Bidikan (Mouse Move)
canvas.addEventListener("mousemove", (e) => {
  if (!gameActive) return;

  const pos = getMousePos(canvas, e);
  // Hitung sudut berdasarkan posisi yang sudah dikoreksi
  player.angle = Math.atan2(pos.y - player.y, pos.x - player.x);
});

// 3. Tembak (Mouse Click)
canvas.addEventListener("mousedown", (e) => {
  if (!gameActive) return;

  // Update sudut sekali lagi saat klik (biar presisi)
  const pos = getMousePos(canvas, e);
  player.angle = Math.atan2(pos.y - player.y, pos.x - player.x);

  try {
    AudioManager.playTone(600, 0, 0.1);
  } catch (err) {}

  // Tembak Peluru
  bullets.push(
    new Bullet(player.x, player.y, player.angle, player.currentAmmo)
  );
  setTimeout(() => {
    player.currentAmmo = getNextAmmo();
  }, 100);
});

// 4. Tembak & Bidik (Layar Sentuh HP)
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!gameActive) return;
    e.preventDefault(); // Mencegah layar scroll saat main

    try {
      sfxTembak.currentTime = 0;
      sfxTembak.play();
    } catch (err) {}

    // Gunakan fungsi helper yang sama
    const pos = getMousePos(canvas, e);
    player.angle = Math.atan2(pos.y - player.y, pos.x - player.x);

    // Tembak Peluru
    bullets.push(
      new Bullet(player.x, player.y, player.angle, player.currentAmmo)
    );
    setTimeout(() => {
      player.currentAmmo = getNextAmmo();
    }, 100);
  },
  { passive: false }
);

// ==========================================
// FITUR AUTO-RECONNECT (VERSI FINAL - ANTI ZOMBIE START)
// ==========================================

// 1. Fungsi Membuat Tampilan Layar Gelap (Overlay)
function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.innerHTML = `
        <div class="wifi-icon">📡</div>
        <div class="conn-text">KONEKSI TERPUTUS</div>
        <div class="conn-sub">Sedang mencoba menghubungkan kembali...</div>
    `;
  document.body.appendChild(overlay);
}

// Panggil agar elemen siap
createOfflineUI();

// 2. Variabel Status Koneksi
let isReconnecting = false;
let wasPlaying = false; // 🔥 INI VARIABEL BARU: Mengingat status main

// 3. Saat Koneksi Putus
socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi putus:", reason);
  isReconnecting = true;

  // 🔥 LOGIKA PENTING: Simpan status, apakah tadi sedang main?
  // Jika gameActive true, berarti user sedang main.
  // Jika gameActive false, berarti user cuma di menu login.
  wasPlaying = gameActive;

  // Tampilkan Layar Gelap
  const overlay = document.getElementById("connection-overlay");
  if (overlay) overlay.style.display = "flex";

  // Matikan game sementara
  if (typeof gameActive !== "undefined") gameActive = false;
});

// 4. Saat Terhubung Kembali
socket.on("connect", () => {
  if (isReconnecting) {
    console.log("✅ Terhubung kembali!");
    isReconnecting = false;

    // Sembunyikan Layar Gelap
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";

    // 🔥 LOGIKA PENTING: Hanya lanjutkan game JIKA tadi memang sedang main
    if (wasPlaying) {
      console.log("▶️ Melanjutkan Game...");
      gameActive = true;

      // Jalankan ulang animasi loop
      if (typeof update === "function") {
        requestAnimationFrame(update);
      }
    } else {
      console.log("⏸️ User tadi di menu, jadi game tetap diam.");
      // Game tetap diam (gameActive false), user tetap di menu login
    }
  }
});
