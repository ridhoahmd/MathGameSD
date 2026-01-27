require("dotenv").config();
const io = require("socket.io-client");

const BASE_URL = "http://localhost:3000";
const socket = io(BASE_URL);

const TEST_USER = "Uji_Akumulasi_Skor_" + Math.floor(Math.random() * 1000);

console.log(`🧪 TEST SCORE ACCUMULATION: ${TEST_USER}`);

socket.on("connect", () => {
  console.log("✅ Connected");

  // 1. Initial State
  socket.emit("mintaDataProfil", TEST_USER);
});

let step = 1;
let initialScore = 0;

socket.on("updateProfil", (data) => {
  console.log(`📊 Profile Update [Step ${step}]: Score = ${data.skor}`);

  if (step === 1) {
    // Step 1: Initial check
    initialScore = data.skor;
    console.log("👉 Sending Score 1: 100 points...");
    socket.emit("simpanSkor", { nama: TEST_USER, game: "math", skor: 100 });

    // IMMEDIATE FETCH to simulate race condition
    socket.emit("mintaDataProfil", TEST_USER);
    step = 2;
  } else if (step === 2) {
    // Step 2: Check if score increased
    if (data.skor === initialScore) {
      console.log(
        "⚠️ POTENTIAL BUG: Score did not increase immediately (Race Condition confirmed?)",
      );
      // Retry fetch after delay to see if it eventually updates
      setTimeout(() => {
        console.log("⏳ Waiting 1s and fetching again...");
        step = 3;
        socket.emit("mintaDataProfil", TEST_USER);
      }, 1000);
    } else if (data.skor === initialScore + 100) {
      console.log("✅ Score increased by 100!");
      initialScore = data.skor;

      console.log("👉 Sending Score 2: 50 points...");
      socket.emit("simpanSkor", { nama: TEST_USER, game: "math", skor: 50 });

      // IMMEDIATE FETCH
      socket.emit("mintaDataProfil", TEST_USER);
      step = 4;
    }
  } else if (step === 3) {
    // Delayed check result
    if (data.skor === initialScore) {
      console.error("❌ FAILED: Score still not updated after delay.");
      process.exit(1);
    } else {
      console.log("✅ Score updated after delay (Race Condition Confirmed).");
      process.exit(0);
    }
  } else if (step === 4) {
    if (data.skor === initialScore + 50) {
      console.log("✅ Score accumulated correctly!");
      process.exit(0);
    } else {
      console.log("⚠️ Score did not increase immediately on 2nd try.");
      setTimeout(() => {
        step = 5;
        socket.emit("mintaDataProfil", TEST_USER);
      }, 1000);
    }
  } else if (step === 5) {
    if (data.skor === initialScore + 50) {
      console.log("✅ Score accumulated correctly after delay.");
      process.exit(0);
    } else {
      console.error(
        `❌ FAILED: Expected ${initialScore + 50}, got ${data.skor}`,
      );
      process.exit(1);
    }
  }
});
