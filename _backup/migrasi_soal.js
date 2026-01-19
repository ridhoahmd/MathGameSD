// migrasi_soal.js - VERSI FINAL (UNIVERSAL)

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 MEMULAI MIGRASI DATA SOAL KE SQL...");

  // 1. Coba baca file JSON (Prioritas: bank_soal.json -> firebase_data.json)
  let rawData;
  let fileName;

  if (fs.existsSync('bank_soal.json')) {
    rawData = fs.readFileSync('bank_soal.json', 'utf8');
    fileName = 'bank_soal.json';
  } else if (fs.existsSync('firebase_data.json')) {
    rawData = fs.readFileSync('firebase_data.json', 'utf8');
    fileName = 'firebase_data.json';
  } else {
    console.error("❌ Gagal: Tidak ditemukan file 'bank_soal.json' atau 'firebase_data.json'");
    return;
  }

  const jsonData = JSON.parse(rawData);
  console.log(`📂 Membaca dari: ${fileName}`);

  // 2. Normalisasi Struktur Data
  // Kadang data dibungkus dalam "gudang_soal" atau "videa_latihan"
  let rootData = jsonData;
  if (jsonData.gudang_soal) rootData = jsonData.gudang_soal;
  else if (jsonData.videa_latihan) rootData = jsonData.videa_latihan;

  // 3. Bersihkan Tabel Soal Dulu (Supaya tidak duplikat kalau dijalankan 2x)
  console.log("🧹 Membersihkan tabel GameQuestion lama...");
  await prisma.gameQuestion.deleteMany({}); 

  // 4. Loop dan Masukkan ke SQL
  let totalSoal = 0;

  for (const [kategori, dataLevel] of Object.entries(rootData)) {
    if (typeof dataLevel !== 'object') continue;

    for (const [level, daftarSoal] of Object.entries(dataLevel)) {
      // Pastikan daftarSoal adalah Array
      const arraySoal = Array.isArray(daftarSoal) ? daftarSoal : Object.values(daftarSoal);
      
      console.log(`   ➡️  Memproses ${kategori} (${level}): ${arraySoal.length} soal`);

      for (const itemSoal of arraySoal) {
        if (!itemSoal) continue;

        await prisma.gameQuestion.create({
          data: {
            category: kategori.toLowerCase(), // math, nabi, dll
            level: level.toLowerCase(),       // mudah, sedang, sulit
            content: itemSoal                 // Simpan JSON mentah (fleksibel)
          }
        });
        totalSoal++;
      }
    }
  }

  console.log(`\n✅ SUKSES! Total ${totalSoal} soal berhasil masuk ke PostgreSQL.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());