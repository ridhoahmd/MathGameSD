const io = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("🔵 Connected to server");

  // TEST 1: Minta Soal Math (Harusnya Ada)
  console.log("👉 Requesting Math...");
  socket.emit("mintaSoalAI", { kategori: "math", tingkat: "sedang" });
});

socket.on("soalDariAI", (response) => {
  console.log("🟢 TERIMA RESPON DARI SERVER:");

  if (response.error) {
    console.error("❌ ERROR SERVER:", response.error);
  } else if (response.data) {
    console.log(
      `✅ Sukses! Diterima ${
        Array.isArray(response.data) ? response.data.length : 1
      } soal.`
    );
    console.log(
      "Isi Data:",
      JSON.stringify(response.data).substring(0, 100) + "..."
    );
  } else {
    console.log("⚠️ Data kosong tapi tidak error.");
  }

  // Matikan koneksi test
  socket.disconnect();
});
