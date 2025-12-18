// ==========================================
// LABIRIN.JS - FIXED & OPTIMIZED + AI TUTOR
// ==========================================

const socket = io();
const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");

// --- STATE GAME GLOBAL ---
let level = "mudah";
let cols, rows;
let size = 20;
let grid = [];
let current;
let stack = [];
let questions = [];
let score = 0;
let gameActive = false;
let finishNode;
let playerName = localStorage.getItem("playerName") || "Guest";

// 🔥 [BARU] VARIABEL AI TUTOR
const tutorOverlay = document.getElementById("tutor-overlay");
const tutorText = document.getElementById("tutor-text");
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// --- 🎨 ASET GAMBAR ---
const imgPlayer = new Image();
imgPlayer.src = "https://cdn-icons-png.flaticon.com/512/4140/4140047.png";

const imgFinish = new Image();
imgFinish.src = "https://cdn-icons-png.flaticon.com/512/1501/1501597.png";

const imgObstacle = new Image();
imgObstacle.src = "https://cdn-icons-png.flaticon.com/512/9183/9183226.png";

// --- SETUP LEVEL ---
document.querySelectorAll(".btn-level").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-level")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// 🔥 [BARU] LISTENER PENJELASAN AI
socket.on("penjelasanTutor", (data) => {
  if (tutorText) tutorText.innerText = data.penjelasan;
});

// 🔥 [BARU] FUNGSI TUTUP TUTOR
window.tutupTutorLabirin = function () {
  if (tutorOverlay) tutorOverlay.style.display = "none";
  // Opsional: Buka kembali modal kuis agar user bisa jawab ulang
  const modal = document.getElementById("quiz-modal");
  if (modal) modal.style.display = "flex";
};

// --- FUNGSI MINTA GAME KE SERVER ---
window.requestGame = function () {
  const btn = document.querySelector(".btn-start");
  btn.innerText = "⏳ MENGHUBUNGI SERVER...";
  btn.disabled = true;

  // Reset kuota tutor setiap game baru
  tutorUsageCount = 0;

  // Ambil Kode Kelas (jika ada)
  const inputKodeKelas = document.getElementById("inputKodeKelas");
  const kodeAkses = inputKodeKelas
    ? inputKodeKelas.value.trim().toUpperCase()
    : "";

  // Siapkan data permintaan
  const requestData = {
    kategori: "labirin",
    tingkat: level,
    kodeAkses: kodeAkses,
  };

  console.log("Mengirim permintaan soal dengan Kode Akses:", kodeAkses);
  socket.emit("mintaSoalAI", requestData);
};

// --- TERIMA DATA DARI SERVER ---
socket.on("soalDariAI", (response) => {
  document.getElementById("loading-screen").style.display = "none";

  if (response && response.kategori === "labirin") {
    // 🔥 VAKSIN DATA
    let info = response.data;
    if (Array.isArray(info)) info = info[0];

    cols = info.maze_size || 10;
    rows = info.maze_size || 10;
    questions = info.soal_list || [];

    const maxSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.6);
    size = Math.floor(maxSize / cols);
    canvas.width = cols * size;
    canvas.height = rows * size;

    setupMazeGrid();
    gameActive = true;
    draw();
  } else {
    alert(response.error || "Gagal memuat soal. Coba lagi.");
    location.reload();
  }
});

// --- GENERATOR MAZE (FIXED STRUCTURE) ---
function setupMazeGrid() {
  grid = [];
  stack = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let cell = new Cell(i, j);
      grid.push(cell);
    }
  }

  current = grid[0];
  current.visited = true;
  finishNode = grid[grid.length - 1];

  let processing = true;

  while (processing) {
    let next = current.checkNeighbors();
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

  let qIndex = 0;
  let randomGridIndices = Array.from({ length: grid.length }, (_, i) => i).sort(
    () => Math.random() - 0.5
  );

  for (let i of randomGridIndices) {
    if (i > 0 && i < grid.length - 1 && qIndex < questions.length) {
      if (Math.random() < 0.3) {
        grid[i].isQuestion = true;
        grid[i].questionData = questions[qIndex];
        qIndex++;
      }
    }
  }

  current = grid[0];
  score = 0;
  document.getElementById("score").innerText = score;

  const controlButtons = document.querySelectorAll(".btn-ctrl");
  controlButtons.forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const direction = newBtn.innerText;
      if (direction === "▲") movePlayer(0, -1);
      else if (direction === "▶") movePlayer(1, 0);
      else if (direction === "▼") movePlayer(0, 1);
      else if (direction === "◀") movePlayer(-1, 0);
    });
  });
}

// --- CLASS CELL ---
class Cell {
  constructor(i, j) {
    this.i = i;
    this.j = j;
    this.walls = [true, true, true, true];
    this.visited = false;
    this.isQuestion = false;
    this.questionData = null;
  }

  show() {
    let x = this.i * size;
    let y = this.j * size;

    ctx.strokeStyle = "#00f2ff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    if (this.walls[0]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + size, y);
    }
    if (this.walls[1]) {
      ctx.moveTo(x + size, y);
      ctx.lineTo(x + size, y + size);
    }
    if (this.walls[2]) {
      ctx.moveTo(x + size, y + size);
      ctx.lineTo(x, y + size);
    }
    if (this.walls[3]) {
      ctx.moveTo(x, y + size);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (this.isQuestion && imgObstacle.complete) {
      let p = size * 0.2;
      ctx.drawImage(imgObstacle, x + p, y + p, size - 2 * p, size - 2 * p);
    }
  }

  checkNeighbors() {
    let neighbors = [];
    let top = grid[index(this.i, this.j - 1)];
    let right = grid[index(this.i + 1, this.j)];
    let bottom = grid[index(this.i, this.j + 1)];
    let left = grid[index(this.i - 1, this.j)];

    if (top && !top.visited) neighbors.push(top);
    if (right && !right.visited) neighbors.push(right);
    if (bottom && !bottom.visited) neighbors.push(bottom);
    if (left && !left.visited) neighbors.push(left);

    if (neighbors.length > 0) {
      let r = Math.floor(Math.random() * neighbors.length);
      return neighbors[r];
    } else {
      return undefined;
    }
  }
}

function index(i, j) {
  if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
  return i + j * cols;
}

function removeWalls(a, b) {
  let x = a.i - b.i;
  if (x === 1) {
    a.walls[3] = false;
    b.walls[1] = false;
  }
  if (x === -1) {
    a.walls[1] = false;
    b.walls[3] = false;
  }
  let y = a.j - b.j;
  if (y === 1) {
    a.walls[0] = false;
    b.walls[2] = false;
  }
  if (y === -1) {
    a.walls[2] = false;
    b.walls[0] = false;
  }
}

// --- RENDER LOOP ---
function draw() {
  if (!gameActive) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < grid.length; i++) {
    grid[i].show();
  }

  if (finishNode && imgFinish.complete) {
    let fx = finishNode.i * size;
    let fy = finishNode.j * size;
    let p = size * 0.1;
    ctx.drawImage(imgFinish, fx + p, fy + p, size - 2 * p, size - 2 * p);
  }

  if (current && imgPlayer.complete) {
    let x = current.i * size;
    let y = current.j * size;
    let p = size * 0.15;
    ctx.drawImage(imgPlayer, x + p, y + p, size - 2 * p, size - 2 * p);
  }

  requestAnimationFrame(draw);
}

// --- LOGIKA GERAK ---
window.movePlayer = function (x, y) {
  if (!gameActive) return;

  let next;
  let blocked = false;

  if (x === 1) {
    if (current.walls[1]) blocked = true;
    else next = grid[index(current.i + 1, current.j)];
  } else if (x === -1) {
    if (current.walls[3]) blocked = true;
    else next = grid[index(current.i - 1, current.j)];
  } else if (y === 1) {
    if (current.walls[2]) blocked = true;
    else next = grid[index(current.i, current.j + 1)];
  } else if (y === -1) {
    if (current.walls[0]) blocked = true;
    else next = grid[index(current.i, current.j - 1)];
  }

  if (!blocked && next) {
    if (next.isQuestion) {
      openQuiz(next);
    } else {
      current = next;
      checkFinish();
    }
  }
};

let pendingNode = null;

function openQuiz(node) {
  gameActive = false;
  pendingNode = node;
  const modal = document.getElementById("quiz-modal");
  modal.style.display = "flex";

  const title = document.querySelector("#quiz-modal h2");
  title.innerText = "RINTANGAN!";
  title.style.color = "#ff00cc";

  const qText = document.getElementById("q-text");
  qText.innerText = node.questionData.tanya;
  qText.style.color = "white";

  const input = document.getElementById("q-input");
  input.value = "";
  input.focus();
}

// --- LOGIKA CEK JAWABAN (MODIFIED FOR AI TUTOR) ---
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

    title.innerText = "✅ RINTANGAN HANCUR!";
    title.style.color = "#00ff00";
    qText.innerText = "Jalan terbuka...";

    setTimeout(() => {
      document.getElementById("quiz-modal").style.display = "none";
      pendingNode.isQuestion = false;

      score += 20;
      document.getElementById("score").innerText = score;

      current = pendingNode;
      gameActive = true;
      draw();
      checkFinish();
    }, 1000);
  } else {
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // 🔥 LOGIKA AI TUTOR: Jika Salah, Cek Kuota & Panggil AI
    if (tutorUsageCount < MAX_TUTOR_USAGE) {
      tutorUsageCount++;

      // Tutup modal quiz sementara biar overlay AI terlihat
      document.getElementById("quiz-modal").style.display = "none";

      if (tutorOverlay) {
        tutorOverlay.style.display = "flex";
        tutorText.innerText = `Guru Videa sedang membaca peta... (Sisa Bantuan: ${
          MAX_TUTOR_USAGE - tutorUsageCount
        })`;
      }

      socket.emit("mintaPenjelasan", {
        game: "labirin",
        soal: document.getElementById("q-text").innerText,
        jawabanUser: userAns,
        jawabanBenar: correct,
      });
    } else {
      // Jika Kuota Habis, Jalankan Logika Salah Biasa (Original)
      title.innerText = "❌ SALAH! (Bantuan Habis)";
      title.style.color = "red";
      qText.style.color = "#ff6b6b";
      qText.innerText = "Coba lagi ya...";

      document.getElementById("q-input").value = "";

      setTimeout(() => {
        title.innerText = "RINTANGAN!";
        title.style.color = "#ff00cc";
        qText.style.color = "white";
        qText.innerText = pendingNode.questionData.tanya;
      }, 1500);
    }
  }
};

function checkFinish() {
  if (current === finishNode) {
    try {
      AudioManager.playWin();
    } catch (e) {}
    score += 50;
    gameActive = false;

    socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "labirin",
    });

    const modal = document.getElementById("quiz-modal");
    modal.style.display = "flex";
    document.querySelector("#quiz-modal h2").innerText = "🏆 MISI SELESAI!";
    document.querySelector("#quiz-modal h2").style.color = "#00f2ff";
    document.getElementById("q-text").innerText = `Skor Akhir: ${score}`;
    document.getElementById("q-input").style.display = "none";
    document.querySelector(".btn-submit").innerText = "KEMBALI KE MENU";
    document.querySelector(".btn-submit").onclick = function () {
      window.location.href = "/";
    };
  }
}

// Keyboard Listener
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") movePlayer(0, -1);
  if (e.key === "ArrowRight") movePlayer(1, 0);
  if (e.key === "ArrowDown") movePlayer(0, 1);
  if (e.key === "ArrowLeft") movePlayer(-1, 0);
});

// layarr sentuh Variabel untuk menyimpan posisi awal jari
let touchStartX = 0;
let touchStartY = 0;

// 1. Saat jari MENYENTUH layar (Mulai)
document.addEventListener(
  "touchstart",
  (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  },
  { passive: false }
);

// 2. Saat jari DIANGKAT dari layar (Selesai)
document.addEventListener(
  "touchend",
  (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
  },
  { passive: false }
);

// 3. Logika Menghitung Arah
function handleSwipe(sx, sy, ex, ey) {
  const dx = ex - sx;
  const dy = ey - sy;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > 30) {
      if (dx > 0) movePlayer(1, 0);
      else movePlayer(-1, 0);
    }
  } else {
    if (Math.abs(dy) > 30) {
      if (dy > 0) movePlayer(0, 1);
      else movePlayer(0, -1);
    }
  }
}

// --- FITUR AUTO-RECONNECT & OVERLAY ---

function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
        <div class="wifi-icon">📡</div>
        <div class="conn-text">KONEKSI TERPUTUS</div>
        <div class="conn-sub">Sedang mencoba menghubungkan kembali...</div>
    `;
  document.body.appendChild(overlay);
}

createOfflineUI();

let isReconnecting = false;
let disconnectTimeout;

socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi putus:", reason);
  disconnectTimeout = setTimeout(() => {
    isReconnecting = true;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "flex";
    if (typeof gameActive !== "undefined") gameActive = false;
  }, 1500);
});

socket.on("connect", () => {
  clearTimeout(disconnectTimeout);
  if (isReconnecting) {
    console.log("✅ Terhubung kembali!");
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
    if (typeof gameActive !== "undefined") {
      gameActive = true;
      if (typeof update === "function") requestAnimationFrame(draw);
      else requestAnimationFrame(draw);
    }
  }
});
