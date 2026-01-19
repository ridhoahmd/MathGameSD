// public/js/config.js - VERSI FINAL (HANYA AUTH)

// Konfigurasi Firebase (Tetap dipakai untuk Login Google)
const firebaseConfig = {
  apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
  authDomain: "mathgamesd.firebaseapp.com",
  projectId: "mathgamesd",
  storageBucket: "mathgamesd.firebasestorage.app",
  messagingSenderId: "595640141584",
  appId: "1:595640141584:web:d02523bc844e52550f4795",
};

// Inisialisasi Firebase (Cek dulu biar gak error double init)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// KITA HANYA PAKAI AUTH (Login). 
// Database Realtime dimatikan agar 100% data masuk ke PostgreSQL.
let auth;
if (typeof firebase !== 'undefined') {
    auth = firebase.auth();
}

console.log("✅ Firebase Auth Ready (Database disconnected)");