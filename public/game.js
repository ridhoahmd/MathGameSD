// public/game.js - FULL CODE FIXED

// 1. CONFIG FIREBASE
const sfxBenar = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
const sfxSalah = new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg');

const firebaseConfig = {
    apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

let database = null;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (e) { console.log(e); }

const socket = io(); 
let score = 0;
let currentResult = 0;
let myRoom = ""; 

// Auto-isi nama
const savedName = localStorage.getItem("playerName");
if (savedName) {
    const inputNama = document.getElementById('username');
    if (inputNama) inputNama.value = savedName;
}

function startGame() {
    const name = document.getElementById('username').value;
    const room = document.getElementById('room-code').value;
    if(name.trim() === "" || room.trim() === "") return alert("Isi data dulu!");
    
    myRoom = room;
    socket.emit('joinRoom', { username: name, room: room });
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('block');
    
    generateQuestion();
}

function generateQuestion() {
    document.getElementById('question-display').innerText = "🤖 AI sedang berpikir...";
    document.getElementById('question-display').style.fontSize = "1.5rem";
    
    // FIX 1: Kirim kategori 'math'
    socket.emit('mintaSoalAI', 'math');
}

// FIX 2: Terima data dengan format baru
socket.on('soalDariAI', (res) => {
    // Cek apakah ini soal untuk math?
    if (res.kategori !== 'math') return;

    const data = res.data; // Ambil isinya
    document.getElementById('question-display').innerText = data.soal;
    currentResult = data.jawaban;
    
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').focus();
});

function checkAnswer() {
    const playerAnswer = parseInt(document.getElementById('answer-input').value);
    if (playerAnswer === currentResult) {
        score += 10; 
        sfxBenar.currentTime = 0; sfxBenar.play();
        alert("Benar! 🎉");
        socket.emit('laporSkor', { skor: score, room: myRoom }); 
    } else {
        sfxSalah.currentTime = 0; sfxSalah.play();
        alert("Salah! Jawabannya: " + currentResult);
    }
    document.getElementById('score').innerText = score;
    generateQuestion();
}

socket.on('updateSkorLawan', (skor) => {
    document.getElementById('opponent-score').innerText = skor;
});

async function downloadSertifikat() {
    const name = document.getElementById('username').value;
    if (database) {
        database.ref('leaderboard/' + name).update({ 
            nama: name, skor_math: score, waktu_math: new Date().toString()
        });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("SERTIFIKAT JUARA", 20, 20);
    doc.text(`Nama: ${name}`, 20, 40);
    doc.text(`Skor: ${score}`, 20, 50);
    doc.save(`Sertifikat_${name}.pdf`);
}