// Simpan file ini sebagai checkModels.js
require('dotenv').config();

// Mengambil API Key dari file .env
const apiKey = process.env.API_KEY; 

if (!apiKey) {
  console.error("❌ API_KEY tidak ditemukan di file .env. Pastikan file .env ada dan berisi API_KEY=...");
  return;
}

console.log("🔑 Menggunakan API Key:", apiKey.substring(0, 20) + "...");

// URL endpoint untuk mengambil daftar model dari Google API
const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

// Menggunakan fetch (bawaan Node.js) untuk memanggil API
fetch(listModelsUrl)
  .then(response => {
    // Cek jika response-nya sukses (status 200-299)
    if (!response.ok) {
      // Jika tidak sukses, lempar error dengan statusnya
      throw new Error(`Gagal menghubungi API. Status: ${response.status} ${response.statusText}`);
    }
    // Jika sukses, ubah response menjadi JSON
    return response.json();
  })
  .then(data => {
    console.log("\n✅ Berhasil! Berikut adalah daftar model yang bisa Anda gunakan:");

    // Filter model yang mendukung 'generateContent'
    const validModels = data.models.filter(model => 
      model.supportedGenerationMethods.includes('generateContent')
    );

    if (validModels.length === 0) {
      console.log("Tidak ada model yang ditemukan yang mendukung generateContent.");
    } else {
      validModels.forEach(model => {
        // Kita hanya butuh nama modelnya, bukan 'models/' di depannya
        const modelName = model.name.replace('models/', '');
        console.log(`- ${modelName} (Nama: ${model.displayName})`);
      });
    }
  })
  .catch(error => {
    console.error("\n❌ Terjadi kesalahan:");
    console.error(error.message);
    console.log("\nKemungkinan penyebabnya:");
    console.log("1. API Key tidak valid atau salah ketik.");
    console.log("2. 'Generative Language API' tidak diaktifkan di Google Cloud Console untuk proyek yang terkait dengan API Key ini.");
  });