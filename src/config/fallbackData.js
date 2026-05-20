// Konfigurasi Data Cadangan
// Dipakai kalau Database lagi ngambek atau kosong

const fallbacks = {
  math: [
    { soal: "10 + 10 = ?", jawaban: 20 },
    { soal: "5 x 5 = ?", jawaban: 25 },
    { soal: "100 - 25 = ?", jawaban: 75 },
    { soal: "12 x 3 = ?", jawaban: 36 },
    { soal: "50 / 2 = ?", jawaban: 25 },
  ],
  nabi: [
    {
      tanya: "Siapakah Nabi pertama?",
      opsi: ["Adam", "Nuh", "Ibrahim"],
      jawab: "Adam",
    },
    {
      tanya: "Nabi yang tertelan ikan paus?",
      opsi: ["Yunus", "Musa", "Isa"],
      jawab: "Yunus",
    },
    {
      tanya: "Nabi yang memiliki mukjizat membelah lautan?",
      opsi: ["Musa", "Nuh", "Hud"],
      jawab: "Musa",
    },
    {
      tanya: "Nabi terakhir umat Islam?",
      opsi: ["Muhammad SAW", "Isa", "Ibrahim"],
      jawab: "Muhammad SAW",
    },
    {
      tanya: "Nabi yang disebut Bapak para Nabi?",
      opsi: ["Ibrahim", "Ismail", "Yaqub"],
      jawab: "Ibrahim",
    },
  ],
  ayat: [
    {
      tanya: "Lanjutkan ayat: Qul huwallahu...",
      opsi: ["Ahad", "Somad"],
      jawab: "Ahad",
      latin: "Katakanlah: Dialah Allah, Yang Maha Esa.",
    },
    {
      tanya: "Lanjutkan ayat: Maliki yaumid...",
      opsi: ["Din", "Nas"],
      jawab: "Din",
      latin: "Yang Menguasai Hari Pembalasan.",
    },
    {
      tanya: "Lanjutkan ayat: Inna a'tainakal...",
      opsi: ["Kautsar", "Nasr"],
      jawab: "Kautsar",
      latin: "Sesungguhnya Kami telah memberikan kepadamu nikmat yang banyak.",
    },
    {
      tanya: "Lanjutkan ayat: Tabbat yada abi...",
      opsi: ["Lahabiw-watabb", "Jahab"],
      jawab: "Lahabiw-watabb",
      latin: "Binasalah kedua tangan Abu Lahab.",
    },
  ],
  kasir: [
    {
      cerita: "Pelanggan membeli permen seharga 500. Dia membayar 1000.",
      total_belanja: 500,
      uang_bayar: 1000,
      kembalian: 500,
    },
    {
      cerita: "Ibu membeli sayur 2500, membayar 5000.",
      total_belanja: 2500,
      uang_bayar: 5000,
      kembalian: 2500,
    },
    {
      cerita: "Budi beli mainan 12.000, bayar dengan 20.000.",
      total_belanja: 12000,
      uang_bayar: 20000,
      kembalian: 8000,
    },
    {
      cerita: "Harga buku 7.500. Uang Ani 10.000.",
      total_belanja: 7500,
      uang_bayar: 10000,
      kembalian: 2500,
    },
  ],
  memory: [
    { a: "A", b: "Apel" },
    { a: "B", b: "Bola" },
    { a: "C", b: "Ceri" },
    { a: "D", b: "Domba" },
    { a: "E", b: "Elang" },
    { a: "F", b: "Foto" },
    { a: "G", b: "Gajah" },
    { a: "H", b: "Harimau" },
  ],
  labirin: {
    maze_size: 15,
    soal_list: [
      { tanya: "10+10", jawab: "20" },
      { tanya: "5x5", jawab: "25" },
      { tanya: "9-3", jawab: "6" },
    ],
  },
  zuma: {
    deskripsi: "Mode Offline",
    palet_warna: ["#f00", "#0f0", "#00f", "#ff0"],
    speed: "sedang",
  },
  piano: { sequence: [1, 3, 5, 8] }, // Fallback dasar
  tajwid: {
    kategori_kiri: "Izhar",
    kategori_kanan: "Ikhfa",
    data: [
      { teks: "Min 'alakin", hukum: "kiri" },
      { teks: "Min syarri", hukum: "kanan" },
    ],
  },
};

function getFallbackData(kategori) {
  return fallbacks[kategori] || [];
}

module.exports = { getFallbackData };
