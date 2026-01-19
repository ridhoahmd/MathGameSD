const fs = require('fs');

// Fungsi Acak Angka
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const database = {
  math: { mudah: [], sedang: [], sulit: [] },
  kasir: { mudah: [], sedang: [], sulit: [] },
  piano: { mudah: [], sedang: [], sulit: [] },
  zuma: { mudah: [], sedang: [], sulit: [] }
};

// 1. GENERATOR MATH (50 Soal per level)
for (let i = 0; i < 50; i++) {
  // Mudah: Penjumlahan/Pengurangan 1-20
  let a = rand(1, 20), b = rand(1, 20);
  database.math.mudah.push({ soal: `${a} + ${b}`, jawaban: a + b });
  
  // Sedang: Perkalian 1-10
  let c = rand(2, 10), d = rand(2, 10);
  database.math.sedang.push({ soal: `${c} x ${d}`, jawaban: c * d });

  // Sulit: Campuran 3 angka
  let e = rand(10, 50), f = rand(5, 20), g = rand(2, 5);
  database.math.sulit.push({ soal: `${e} + ${f} x ${g}`, jawaban: e + (f * g) });
}

// 2. GENERATOR KASIR (50 Soal per level)
for (let i = 0; i < 50; i++) {
  // Mudah (Ratusan)
  let price = rand(1, 9) * 500;
  let pay = price + (rand(1, 2) * 500); // Bayar pas atau lebih 500/1000
  database.kasir.mudah.push({ 
    cerita: `Jajan Rp ${price}. Bayar Rp ${pay}.`, 
    total_belanja: price, uang_bayar: pay, kembalian: pay - price 
  });

  // Sedang (Ribuan)
  let price2 = rand(10, 50) * 1000;
  let pay2 = price2 + (rand(1, 5) * 5000);
  database.kasir.sedang.push({ 
    cerita: `Belanja Rp ${price2}. Bayar Rp ${pay2}.`, 
    total_belanja: price2, uang_bayar: pay2, kembalian: pay2 - price2 
  });
  
  // Sulit (Puluhan Ribu Keriting)
  let price3 = rand(20, 100) * 1000 + 500;
  let pay3 = Math.ceil(price3 / 50000) * 50000; // Bayar pakai 50rb/100rb terdekat
  database.kasir.sulit.push({ 
    cerita: `Total Rp ${price3}. Bayar Rp ${pay3}.`, 
    total_belanja: price3, uang_bayar: pay3, kembalian: pay3 - price3 
  });
}

// 3. GENERATOR PIANO & ZUMA (Pola)
for (let i = 0; i < 50; i++) {
   // Piano
   let seqMudah = Array.from({length: 3}, () => rand(1,3));
   let seqSedang = Array.from({length: 5}, () => rand(1,5));
   let seqSulit = Array.from({length: 8}, () => rand(1,7));
   database.piano.mudah.push({ sequence: seqMudah });
   database.piano.sedang.push({ sequence: seqSedang });
   database.piano.sulit.push({ sequence: seqSulit });

   // Zuma (Variasi Warna)
   database.zuma.mudah.push({ speed: "lambat", pola: "spiral", deskripsi: `Level ${i+1}`, palet_warna: ["#F00", "#0F0"] });
   database.zuma.sedang.push({ speed: "sedang", pola: "zigzag", deskripsi: `Level ${i+1}`, palet_warna: ["#F00", "#0F0", "#00F"] });
   database.zuma.sulit.push({ speed: "cepat", pola: "acak", deskripsi: `Level ${i+1}`, palet_warna: ["#F00", "#0F0", "#00F", "#FF0"] });
}

// SIMPAN KE FILE
fs.writeFileSync('bank_soal_otomatis.json', JSON.stringify(database, null, 2));
console.log("✅ Berhasil membuat 600 soal baru di 'bank_soal_otomatis.json'");