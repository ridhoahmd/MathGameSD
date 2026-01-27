require("dotenv").config();
const io = require("socket.io-client");

const BASE_URL = "http://localhost:3000";
const GURU_PASSWORD = process.env.GURU_PASSWORD || "rahasia"; // Sesuaikan dengan .env di server nanti

async function testSecurity() {
  console.log("🔒 SECURITY AUDIT STARTING...\n");

  // 1. TEST LOGIN GURU
  let guruToken = "";
  try {
    console.log("TEST 1: Login Guru (Expected Success)");
    const res = await fetch(`${BASE_URL}/api/login-guru`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: GURU_PASSWORD }),
    });
    const data = await res.json();

    if (data.success && data.token) {
      guruToken = data.token;
      console.log("✅ Login Success! Token received.\n");
    } else {
      console.error("❌ Login Failed: No token.\n");
    }
  } catch (e) {
    console.error("❌ Login Error (Is Server Running?):", e.message, "\n");
  }

  // 2. TEST GURU AUTHENTICATED SOCKET
  if (guruToken) {
    console.log("TEST 2: Connect Socket as Guru (With Token)");
    const socketGuru = io(BASE_URL, {
      auth: { token: guruToken },
    });

    socketGuru.on("connect", () => {
      console.log("✅ Socket Connected as Guru!");

      // Try sensitive action
      socketGuru.emit("adminResetSystem", { password: GURU_PASSWORD });
    });

    socketGuru.on("forceRefresh", () => {
      console.log("✅ Admin Action Success (Server Resetted)\n");
      socketGuru.close();
    });
  }

  // 3. TEST IMPERSONATION ATTACK
  console.log("TEST 3: Impersonation Attack");
  const socketHacker = io(BASE_URL); // No Token

  socketHacker.on("connect", () => {
    // Try to access admin profile
    socketHacker.emit("mintaDataProfil", { nama: "admin" });

    // Try to update role
    socketHacker.emit("updateUserRole", {
      targetUser: "hacker",
      newRole: "admin",
    });

    // Try to hack score
    socketHacker.emit("simpanSkor", {
      nama: "hacker",
      game: "math",
      skor: 9999999,
    });
  });

  socketHacker.on("errorAuth", (msg) => {
    console.log(`✅ Impersonation Blocked: ${msg}`);
  });

  socketHacker.on("errorUpdate", (msg) => {
    console.log(`✅ Role Update Blocked: ${msg}`);
  });

  socketHacker.on("info", (msg) => {
    if (msg.includes("batas maksimum")) {
      console.log(`✅ Score Hack Capped: ${msg}`);
      console.log(
        "\n✨ ALL TESTS PASSED (If all 3 checks appeared). Hit Ctrl+C to exit.",
      );
    }
  });
}

testSecurity();
