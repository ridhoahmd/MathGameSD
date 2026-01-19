// Simpan sebagai: cek_model.js
require('dotenv').config();

const apiKey = process.env.API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("🔍 Sedang memeriksa daftar model ke Google...");

fetch(url)
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error("❌ ERROR API KEY:", data.error.message);
    } else {
      console.log("\n✅ DAFTAR MODEL YANG BISA ANDA PAKAI:");
      console.log("========================================");
      let found = false;
      data.models.forEach(model => {
        // Kita hanya cari model yang bisa generate text (generateContent)
        if (model.supportedGenerationMethods.includes("generateContent")) {
          // Hapus awalan 'models/' agar bersih
          console.log(`👉 "${model.name.replace('models/', '')}"`);
          found = true;
        }
      });
      if (!found) console.log("⚠️ Tidak ada model generateContent yang ditemukan. Aneh.");
      console.log("========================================");
      console.log("TIP: Pilih salah satu nama di atas dan masukkan ke server.js");
    }
  })
  .catch(err => console.error("❌ Gagal koneksi internet:", err));