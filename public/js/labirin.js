// public/js/labirin.js - VERSI GRAFIS KEREN (SPRITES)

const socket = io();
const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

let level = 'mudah';
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

// --- 🎨 LOAD GAMBAR ASET (CARTOON STYLE) ---
// Robot Lucu
const imgPlayer = new Image();
imgPlayer.src = 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png'; 

// Portal Finish
const imgFinish = new Image();
imgFinish.src = 'https://cdn-icons-png.flaticon.com/512/1501/1501597.png'; 

// Rintangan (Kristal/Gembok)
const imgObstacle = new Image();
imgObstacle.src = 'https://cdn-icons-png.flaticon.com/512/9183/9183226.png'; // Kristal Ungu

// --- SETUP LEVEL ---
document.querySelectorAll('.btn-level').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        level = btn.dataset.level;
    });
});

function requestGame() {
    const btn = document.querySelector('.btn-start');
    btn.innerText = "⏳ MEMUAT MISI...";
    btn.disabled = true;
    socket.emit('mintaSoalAI', { kategori: 'labirin', tingkat: level });
}

// --- TERIMA DATA ---
socket.on('soalDariAI', (data) => {
    document.getElementById('loading-screen').style.display = 'none';

    if (data.kategori === 'labirin') {
        let info = data.data; 
        if (!info || !info.maze_size) {
            info = {
                maze_size: 10,
                soal_list: [{tanya: "1 + 1?", jawab: "2"}]
            };
        }
        
        cols = info.maze_size;
        rows = info.maze_size;
        questions = info.soal_list;
        
        const maxSize = Math.min(window.innerWidth * 0.90, window.innerHeight * 0.65);
        size = Math.floor(maxSize / cols);
        
        canvas.width = cols * size;
        canvas.height = rows * size;

        generateMazeDataOnly();
        gameActive = true; 
        draw(); 
    }
});

// --- GENERATOR LOGIKA MAZE ---
function generateMazeDataOnly() {
    grid = [];
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            let cell = new Cell(i, j);
            grid.push(cell);
        }
    }

    current = grid[0]; 
    current.visited = true;
    finishNode = grid[grid.length - 1]; 

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

    let qIndex = 0;
    for(let i=0; i<grid.length; i++) {
        if(Math.random() < 0.15 && qIndex < questions.length && i > 5 && i < grid.length-5) {
            grid[i].isQuestion = true;
            grid[i].questionData = questions[qIndex];
            qIndex++;
        }
    }
    current = grid[0]; 
}

// --- CLASS CELL (DENGAN GAMBAR) ---
class Cell {
    constructor(i, j) {
        this.i = i; this.j = j;
        this.walls = [true, true, true, true]; 
        this.visited = false;
        this.isQuestion = false; 
        this.questionData = null;
    }

    show() {
        let x = this.i * size;
        let y = this.j * size;
        
        // WARNA DINDING NEON
        ctx.strokeStyle = "#00f2ff"; 
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        ctx.beginPath();
        if (this.walls[0]) { ctx.moveTo(x, y); ctx.lineTo(x + size, y); }
        if (this.walls[1]) { ctx.moveTo(x + size, y); ctx.lineTo(x + size, y + size); }
        if (this.walls[2]) { ctx.moveTo(x + size, y + size); ctx.lineTo(x, y + size); }
        if (this.walls[3]) { ctx.moveTo(x, y + size); ctx.lineTo(x, y); }
        ctx.stroke();

        // 🖼️ GAMBAR RINTANGAN (Kristal)
        if (this.isQuestion) {
            let p = size * 0.2; // Padding 20%
            ctx.drawImage(imgObstacle, x + p, y + p, size - (2*p), size - (2*p));
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
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    if (x === -1) { a.walls[1] = false; b.walls[3] = false; }
    let y = a.j - b.j;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

// --- RENDER LOOP ---
function draw() {
    if(!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Gambar Semua Dinding & Rintangan
    for (let i = 0; i < grid.length; i++) {
        grid[i].show();
    }

    // 2. 🖼️ GAMBAR FINISH (Portal)
    if(finishNode) {
        let fx = finishNode.i * size;
        let fy = finishNode.j * size;
        ctx.drawImage(imgFinish, fx, fy, size, size);
    }

    // 3. 🖼️ GAMBAR PEMAIN (Robot)
    if(current) {
        let x = current.i * size;
        let y = current.j * size;
        // Gambar Robot sedikit lebih kecil dari kotak agar tidak nabrak visual dinding
        let p = size * 0.1;
        ctx.drawImage(imgPlayer, x + p, y + p, size - (2*p), size - (2*p));
    }
    
    requestAnimationFrame(draw);
}

// --- LOGIKA GERAK & QUIZ ---
function movePlayer(x, y) {
    if(!gameActive) return;

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
}

let pendingNode = null;

function openQuiz(node) {
    gameActive = false; 
    pendingNode = node;
    const modal = document.getElementById('quiz-modal');
    modal.style.display = 'flex';
    document.getElementById('q-text').innerText = node.questionData.tanya;
    const input = document.getElementById('q-input');
    input.value = "";
    input.focus();
}

function checkQuiz() {
    const userAns = document.getElementById('q-input').value.toLowerCase().trim();
    const correct = pendingNode.questionData.jawab.toLowerCase().trim();

    if (userAns.includes(correct) || correct.includes(userAns)) {
        try{ AudioManager.playCorrect(); } catch(e){}
        alert("✅ BENAR! Kristal hancur.");
        document.getElementById('quiz-modal').style.display = 'none';
        pendingNode.isQuestion = false; 
        score += 20;
        document.getElementById('score').innerText = score;
        current = pendingNode; 
        gameActive = true; 
        draw(); 
    } else {
        try{ AudioManager.playWrong(); } catch(e){}
        alert(`❌ SALAH! Jawaban: ${pendingNode.questionData.jawab}`);
        document.getElementById('quiz-modal').style.display = 'none';
        gameActive = true;
        draw();
    }
}

function checkFinish() {
    if (current === finishNode) {
        try{ AudioManager.playWin(); } catch(e){}
        score += 50; 
        gameActive = false;
        alert(`🏆 MISI SELESAI! Skor: ${score}`);
        socket.emit('simpanSkor', {
            nama: playerName,
            skor: score,
            game: 'labirin'
        });
        window.location.href = '/';
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') movePlayer(0, -1);
    if (e.key === 'ArrowRight') movePlayer(1, 0);
    if (e.key === 'ArrowDown') movePlayer(0, 1);
    if (e.key === 'ArrowLeft') movePlayer(-1, 0);
});