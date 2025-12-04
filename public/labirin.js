const socket = io();
const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

let level = 'mudah';
let cols, rows;
let size = 20; // Ukuran kotak (pixel)
let grid = [];
let current; // Posisi pemain
let stack = [];
let questions = []; // Soal dari AI
let score = 0;
let gameActive = false;
let finishNode;
let playerName = localStorage.getItem("playerName") || "Guest";

// Setup Level
document.querySelectorAll('.btn-level').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        level = btn.dataset.level;
    });
});

// 1. Minta Data ke Server
function requestGame() {
    const btn = document.querySelector('.btn-start');
    btn.innerText = "⏳ MEMBANGUN LABIRIN...";
    btn.disabled = true;
    socket.emit('mintaSoalAI', { kategori: 'labirin', tingkat: level });
}

// 2. Terima Data & Buat Labirin
socket.on('soalDariAI', (data) => {
    if (data.kategori === 'labirin') {
        const info = data.data; // { maze_size, soal_list }
        
        // Setup Ukuran
        cols = info.maze_size;
        rows = info.maze_size;
        questions = info.soal_list;
        
        // Sesuaikan ukuran canvas agar pas di layar
        const maxSize = Math.min(window.innerWidth * 0.95, window.innerHeight * 0.6);
        size = Math.floor(maxSize / cols);
        canvas.width = cols * size;
        canvas.height = rows * size;

        // Generate Maze
        generateMaze();
        
        // Sembunyikan Loading
        document.getElementById('loading-screen').style.display = 'none';
        gameActive = true;
    }
});

// --- ALGORITMA PEMBUAT LABIRIN (DFS) ---
class Cell {
    constructor(i, j) {
        this.i = i; this.j = j;
        this.walls = [true, true, true, true]; // Top, Right, Bottom, Left
        this.visited = false;
        this.isQuestion = false; // Apakah ini rintangan?
        this.questionData = null;
    }

    show() {
        let x = this.i * size;
        let y = this.j * size;
        
        ctx.strokeStyle = "#00f2ff"; // Warna Neon
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00f2ff";

        ctx.beginPath();
        if (this.walls[0]) { ctx.moveTo(x, y); ctx.lineTo(x + size, y); }
        if (this.walls[1]) { ctx.moveTo(x + size, y); ctx.lineTo(x + size, y + size); }
        if (this.walls[2]) { ctx.moveTo(x + size, y + size); ctx.lineTo(x, y + size); }
        if (this.walls[3]) { ctx.moveTo(x, y + size); ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // Gambar Rintangan (Soal)
        if (this.isQuestion) {
            ctx.fillStyle = "#ff00cc";
            ctx.font = "20px Arial";
            ctx.fillText("?", x + size/3, y + size/1.5);
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

function generateMaze() {
    grid = [];
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            let cell = new Cell(i, j);
            grid.push(cell);
        }
    }

    current = grid[0]; // Start pojok kiri atas
    current.visited = true;
    finishNode = grid[grid.length - 1]; // Finish pojok kanan bawah

    // Loop pembuatan maze
    let stack = [];
    let processing = true;
    while(processing) {
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

    // Sebar Soal di jalan buntu
    let qIndex = 0;
    for(let i=0; i<grid.length; i++) {
        if(Math.random() < 0.1 && qIndex < questions.length && i > 5 && i < grid.length-5) {
            grid[i].isQuestion = true;
            grid[i].questionData = questions[qIndex];
            qIndex++;
        }
    }

    current = grid[0]; // Reset posisi player
    draw();
}

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    if (x === -1) { a.walls[1] = false; b.walls[3] = false; }
    let y = a.j - b.j;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

// --- GAMBAR GAME ---
function draw() {
    if(!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Gambar Labirin
    for (let i = 0; i < grid.length; i++) {
        grid[i].show();
    }

    // Gambar Player (Bola Kuning)
    let x = current.i * size + size / 2;
    let y = current.j * size + size / 2;
    ctx.fillStyle = "#ffff00";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ffff00";
    ctx.beginPath();
    ctx.arc(x, y, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Gambar Finish (Kotak Hijau)
    let fx = finishNode.i * size;
    let fy = finishNode.j * size;
    ctx.fillStyle = "#38ef7d";
    ctx.fillRect(fx + 5, fy + 5, size - 10, size - 10);
    
    requestAnimationFrame(draw);
}

// --- GERAKAN PEMAIN ---
function movePlayer(x, y) {
    if(!gameActive) return;

    // Cek Tembok
    let next;
    let blocked = false;

    if (x === 1) { // Kanan
        if (current.walls[1]) blocked = true;
        else next = grid[index(current.i + 1, current.j)];
    } else if (x === -1) { // Kiri
        if (current.walls[3]) blocked = true;
        else next = grid[index(current.i - 1, current.j)];
    } else if (y === 1) { // Bawah
        if (current.walls[2]) blocked = true;
        else next = grid[index(current.i, current.j + 1)];
    } else if (y === -1) { // Atas
        if (current.walls[0]) blocked = true;
        else next = grid[index(current.i, current.j - 1)];
    }

    if (!blocked && next) {
        // Cek apakah ada soal?
        if (next.isQuestion) {
            openQuiz(next);
        } else {
            current = next;
            checkFinish();
        }
    }
}

// --- LOGIKA QUIZ ---
let pendingNode = null;

function openQuiz(node) {
    gameActive = false; // Pause
    pendingNode = node;
    const modal = document.getElementById('quiz-modal');
    modal.style.display = 'flex';
    document.getElementById('q-text').innerText = node.questionData.tanya;
    document.getElementById('q-input').value = "";
    document.getElementById('q-input').focus();
}

function checkQuiz() {
    const userAns = document.getElementById('q-input').value.toLowerCase().trim();
    const correct = pendingNode.questionData.jawab.toLowerCase().trim();

    if (userAns === correct) {
        alert("BENAR! Jalan terbuka.");
        document.getElementById('quiz-modal').style.display = 'none';
        pendingNode.isQuestion = false; // Hapus soal
        score += 20;
        document.getElementById('score').innerText = score;
        
        current = pendingNode; // Pindah
        gameActive = true;
        draw();
    } else {
        alert(`SALAH! Jawaban: ${pendingNode.questionData.jawab}`);
        document.getElementById('quiz-modal').style.display = 'none';
        gameActive = true; // Kembali tapi tidak pindah
        draw();
    }
}

function checkFinish() {
    if (current === finishNode) {
        score += 50; // Bonus finish
        gameActive = false;
        alert(`LABIRIN SELESAI! Skor: ${score}`);
        
        // Simpan Skor
        socket.emit('simpanSkor', {
            nama: playerName,
            skor: score,
            game: 'math' // Gabung ke poin umum
        });
        
        window.location.href = '/';
    }
}

// Keyboard Listener
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') movePlayer(0, -1);
    if (e.key === 'ArrowRight') movePlayer(1, 0);
    if (e.key === 'ArrowDown') movePlayer(0, 1);
    if (e.key === 'ArrowLeft') movePlayer(-1, 0);
});