// js/config.js

const firebaseConfig = {
  apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
  authDomain: "mathgamesd.firebaseapp.com",
  databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mathgamesd",
  storageBucket: "mathgamesd.firebasestorage.app",
  messagingSenderId: "595640141584",
  appId: "1:595640141584:web:d02523bc844e52550f4795",
};

// Mencegah error "Firebase already initialized"
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Membuat variabel global agar bisa dipakai di semua file
const auth = firebase.auth();
const database = firebase.database();

console.log("✅ Firebase Config Loaded!");