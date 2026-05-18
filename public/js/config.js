// =================================================================
// ⚠️ CATATAN KEAMANAN FIREBASE CONFIG
// =================================================================
// Firebase API Key di file ini SENGAJA ada di client-side — ini
// adalah desain Firebase (key ini hanya mengidentifikasi project,
// bukan memberikan akses penuh).
//
// YANG WAJIB DILAKUKAN DI FIREBASE CONSOLE:
// 1. Batasi API Key hanya untuk domain produksi:
//    Firebase Console → APIs & Services → Credentials → Edit API Key
//    → Application restrictions → HTTP referrers → Tambah domain
// 2. Aktifkan aturan Firebase Auth (hanya izinkan provider Google)
// 3. Jangan tambahkan Firebase Admin SDK key di sini
// =================================================================

const firebaseConfig = {
  apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
  authDomain: "mathgamesd.firebaseapp.com",
  projectId: "mathgamesd",
  storageBucket: "mathgamesd.firebasestorage.app",
  messagingSenderId: "595640141584",
  appId: "1:595640141584:web:d02523bc844e52550f4795",
};

// Nyalain Firebase (Cek dulu biar ga double)
if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

let auth;
if (typeof firebase !== "undefined") {
  auth = firebase.auth();
}
