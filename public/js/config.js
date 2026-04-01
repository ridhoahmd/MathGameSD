// Settingan Firebase
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

console.log("✅ Firebase Auth Aman (Database putus)");
