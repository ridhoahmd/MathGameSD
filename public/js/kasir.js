const ui = {
  screenText:   document.getElementById("screen-text"),
  storyText:    document.getElementById("story-text"),
  receiptItems: document.getElementById("receipt-items"),
  receiptMeta:  document.getElementById("receipt-meta"),
  displayTotal: document.getElementById("display-total"),
  displayPay:   document.getElementById("display-pay"),
  inputAnswer:  document.getElementById("input-answer"),
  feedback:     document.getElementById("feedback-msg"),
  score:        document.getElementById("score"),
  timer:        document.getElementById("timer"),
  finalScore:   document.getElementById("final-score"),
  startScreen:  document.getElementById("start-screen"),
  gameScreen:   document.getElementById("game-screen"),
  resultScreen: document.getElementById("result-screen"),
};

let currentLevel = "mudah";
let questions    = [];
let currentIndex = 0;
let score        = 0;
let timeLeft     = 0;
let timerInterval;
let isProcessing = false;
let playerName   = localStorage.getItem("playerName") || "Guest";
let _socketWired = false;

// ============================================================
// 🛒 PRODUCT CATALOG — Library Barang dengan Emoji
// Kategori berbeda agar setiap soal terasa fresh & bervariasi.
// ============================================================
const PRODUCT_CATALOG = [
  // Makanan Ringan
  { name: "Keripik Singkong",  emoji: "🥔", keywords: ["keripik","singkong","snack"] },
  { name: "Biskuit Cokelat",   emoji: "🍫", keywords: ["biskuit","cokelat","wafer"] },
  { name: "Permen Loli",       emoji: "🍭", keywords: ["permen","loli","candy"] },
  { name: "Kacang Goreng",     emoji: "🥜", keywords: ["kacang","goreng","nuts"] },
  { name: "Kerupuk Udang",     emoji: "🦐", keywords: ["kerupuk","udang","crackers"] },
  { name: "Chiki / Snack",     emoji: "🍿", keywords: ["chiki","popcorn","snack","makanan"] },

  // Minuman
  { name: "Air Mineral",       emoji: "💧", keywords: ["air","mineral","botol","minum"] },
  { name: "Jus Jeruk",         emoji: "🍊", keywords: ["jus","jeruk","orange","juice"] },
  { name: "Susu Cokelat",      emoji: "🥛", keywords: ["susu","cokelat","milk"] },
  { name: "Teh Botol",         emoji: "🫖", keywords: ["teh","botol","tea"] },
  { name: "Es Krim Cup",       emoji: "🍦", keywords: ["es","krim","ice","cream"] },

  // Buah & Sayur
  { name: "Apel Merah",        emoji: "🍎", keywords: ["apel","apple","buah"] },
  { name: "Pisang",            emoji: "🍌", keywords: ["pisang","banana"] },
  { name: "Jeruk Manis",       emoji: "🍊", keywords: ["jeruk","orange","buah"] },
  { name: "Wortel",            emoji: "🥕", keywords: ["wortel","carrot","sayur"] },
  { name: "Tomat",             emoji: "🍅", keywords: ["tomat","tomato"] },
  { name: "Anggur",            emoji: "🍇", keywords: ["anggur","grape"] },

  // Perlengkapan Sekolah
  { name: "Pensil",            emoji: "✏️", keywords: ["pensil","pencil","tulis"] },
  { name: "Buku Tulis",        emoji: "📓", keywords: ["buku","tulis","notebook"] },
  { name: "Penggaris",         emoji: "📏", keywords: ["penggaris","ruler"] },
  { name: "Penghapus",         emoji: "🧹", keywords: ["penghapus","eraser"] },
  { name: "Krayon",            emoji: "🖍️", keywords: ["krayon","crayon","warna"] },
  { name: "Tas Sekolah",       emoji: "🎒", keywords: ["tas","bag","sekolah"] },

  // Rumah Tangga
  { name: "Sabun Mandi",       emoji: "🧼", keywords: ["sabun","soap","mandi"] },
  { name: "Pasta Gigi",        emoji: "🪥", keywords: ["pasta","gigi","sikat","odol"] },
  { name: "Tisu",              emoji: "🧻", keywords: ["tisu","tissue","kertas"] },
  { name: "Sampo",             emoji: "🧴", keywords: ["sampo","shampoo","rambut"] },
  { name: "Lilin",             emoji: "🕯️", keywords: ["lilin","candle"] },

  // Makanan Berat
  { name: "Mie Instan",        emoji: "🍜", keywords: ["mie","instan","noodle","indomie"] },
  { name: "Nasi Bungkus",      emoji: "🍱", keywords: ["nasi","bungkus","rice"] },
  { name: "Roti Tawar",        emoji: "🍞", keywords: ["roti","tawar","bread"] },
  { name: "Telur Ayam",        emoji: "🥚", keywords: ["telur","ayam","egg"] },
  { name: "Sosis",             emoji: "🌭", keywords: ["sosis","sausage"] },

  // Default fallback
  { name: "Barang Belanja",    emoji: "🛍️", keywords: [] },
];

/**
 * Cari produk yang paling cocok berdasarkan kata kunci dari teks cerita.
 * Jika tidak ada yang cocok, ambil produk acak dari katalog.
 * @param {string} text - Teks cerita dari server
 * @param {number} itemIndex - Index item (untuk anti-repeat)
 * @param {Set} usedEmojis - Set emoji yang sudah dipakai di soal ini
 * @returns {{ name: string, emoji: string }}
 */
function matchProduct(text, itemIndex, usedEmojis) {
  const lower = (text || "").toLowerCase();

  // Coba cari berdasarkan keyword
  for (const product of PRODUCT_CATALOG) {
    if (product.keywords.length === 0) continue;
    if (usedEmojis.has(product.emoji)) continue;
    if (product.keywords.some(kw => lower.includes(kw))) {
      usedEmojis.add(product.emoji);
      return product;
    }
  }

  // Fallback: ambil produk acak yang belum dipakai
  const available = PRODUCT_CATALOG.filter(p => !usedEmojis.has(p.emoji) && p.keywords.length > 0);
  const pool = available.length > 0 ? available : PRODUCT_CATALOG.slice(0, -1);
  const pick = pool[(itemIndex * 7 + Math.floor(Math.random() * pool.length)) % pool.length];
  usedEmojis.add(pick.emoji);
  return pick;
}

/**
 * Hasilkan nomor struk unik per soal.
 * Format: #VD-XXXXXX
 */
function generateReceiptNumber() {
  return "#VD-" + Math.floor(100000 + Math.random() * 900000);
}

/**
 * Hasilkan waktu transaksi (jam saat ini + offset kecil).
 */
function getTransactionTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m} WIB`;
}

/**
 * Parse daftar item dari teks cerita server.
 * Server biasanya kirim format seperti:
 * "Beli 2 pensil @Rp500, 1 buku @Rp2000"
 * atau array items jika ada field q.items.
 * Kembalikan array: [{ name, qty, price }]
 */
function parseItems(q) {
  // Jika server sudah kirim array items (format ideal), pakai langsung
  if (q.items && Array.isArray(q.items)) {
    return q.items.map(item => ({
      name:  item.nama || item.name || "Barang",
      qty:   item.qty  || item.jumlah || 1,
      price: item.harga || item.price || 0,
    }));
  }

  // Jika server kirim teks cerita, ekstrak angka & nama dari teks
  // Contoh pola: "2 pensil @Rp500" atau "pensil seharga Rp5.000 sebanyak 2 buah"
  const cerita = q.cerita || "";
  const items  = [];
  const total  = q.total_belanja || 0;

  // Pola 1: "N namabarang @RpXXX"
  const pattern1 = /(\d+)\s+([a-zA-Z\s]+)\s*@\s*Rp\s*([\d.,]+)/gi;
  let match;
  while ((match = pattern1.exec(cerita)) !== null) {
    const qty   = parseInt(match[1]);
    const name  = match[2].trim();
    const price = parseInt(match[3].replace(/[.,]/g, ""));
    items.push({ name, qty, price });
  }

  // Pola 2: "namabarang seharga RpXXX" atau "namabarang Rp XXX"
  if (items.length === 0) {
    const pattern2 = /([a-zA-Z\s]+)\s+(?:seharga|harga)?\s*Rp\s*([\d.,]+)/gi;
    while ((match = pattern2.exec(cerita)) !== null) {
      const name  = match[1].trim();
      const price = parseInt(match[2].replace(/[.,]/g, ""));
      if (name.length > 1 && price > 0) {
        items.push({ name, qty: 1, price });
      }
    }
  }

  // Jika tidak bisa parse, buat satu item dengan total keseluruhan
  if (items.length === 0) {
    items.push({ name: cerita || "Belanja", qty: 1, price: total });
  }

  return items;
}

/**
 * Render struk belanja bergambar di dalam receipt-body.
 * @param {object} q - Objek soal dari server
 */
function renderReceiptItems(q) {
  if (!ui.receiptItems) return;

  const items = parseItems(q);
  const usedEmojis = new Set();

  // Render nomor & waktu struk
  if (ui.receiptMeta) {
    const date = new Date();
    const dateStr = date.toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" });
    ui.receiptMeta.innerHTML =
      `No: ${generateReceiptNumber()} &nbsp;|&nbsp; ${dateStr} ${getTransactionTime()}`;
  }

  // Render konteks pelanggan dari teks cerita (versi singkat)
  const shortStory = (q.cerita || "").split(/[.,]/)[0] || "Pelanggan datang berbelanja";
  if (ui.storyText) {
    ui.storyText.textContent = "👤 " + shortStory;
  }

  // Render tiap baris item
  let html = "";
  items.forEach((item, i) => {
    const product = matchProduct(item.name, i, usedEmojis);
    const itemTotal = item.qty * item.price;
    const priceStr  = item.price > 0 ? `Rp ${item.price.toLocaleString("id-ID")}` : "";
    const totalStr  = itemTotal > 0  ? `Rp ${itemTotal.toLocaleString("id-ID")}` : "";

    html += `
      <div class="receipt-item">
        <div class="item-left">
          <span class="item-emoji">${product.emoji}</span>
          <div class="item-detail">
            <div class="item-name">${product.name}</div>
            ${priceStr ? `<div class="item-unit">${item.qty}x ${priceStr}</div>` : ""}
          </div>
        </div>
        <div class="item-price">${totalStr || priceStr}</div>
      </div>
    `;
  });

  ui.receiptItems.innerHTML = html;

  // Animasi: tiap item masuk dengan slide-down bergiliran
  const itemEls = ui.receiptItems.querySelectorAll(".receipt-item");
  itemEls.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    el.style.transition = `opacity 0.25s ease ${i * 0.08}s, transform 0.25s ease ${i * 0.08}s`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });
  });
}

// ============================================================
// Tombol Level
// ============================================================
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn-diff").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
  });
});

// ============================================================
// Game Flow
// ============================================================
function startGame() {
  if (window.socket) window.socket.emit("mulaiGame", "kasir");
  const btn = document.querySelector(".btn-start");

  btn.innerText = "⏳ Menyiapkan Toko...";
  btn.disabled  = true;

  if (typeof AudioManager !== "undefined") AudioManager.init();

  score = 0;
  ui.score.innerText = "0";

  if (window.socket) {
    window.socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });
  }

  // Safety Net 10 detik
  setTimeout(() => {
    if (ui.startScreen.classList.contains("active")) {
      btn.innerText = "⚠️ Gagal Buka Toko. Ulangi?";
      btn.disabled  = false;
    }
  }, 10000);
}

function mintaSoalKeServer() {
  ui.screenText.innerText = "RESTOCKING...";
  if (ui.storyText) ui.storyText.innerText = "Mengambil data transaksi...";
  if (ui.receiptItems) ui.receiptItems.innerHTML = "";
  if (window.socket) {
    window.socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });
  }
}

// ============================================================
// Socket
// ============================================================
function wireSocketEvents() {
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
      if (response.kategori === "kasir") {
        if (!response.data) {
          console.error("Kasir game: No data received from server");
          alert("Gagal memuat soal. Silakan coba lagi.");
          const btn = document.querySelector(".btn-start");
          if (btn) { btn.innerText = "BUKA KASIR"; btn.disabled = false; }
          ui.startScreen.classList.remove("hidden");
          ui.startScreen.classList.add("active");
          return;
        }

        const data = response.data;
        questions = Array.isArray(data) ? data : [data];
        currentIndex = 0;

        ui.startScreen.classList.remove("active");
        ui.startScreen.classList.add("hidden");
        ui.gameScreen.classList.remove("hidden");
        ui.gameScreen.classList.add("active");

        const btn = document.querySelector(".btn-start");
        if (btn) { btn.innerText = "BUKA KASIR"; btn.disabled = false; }

        tampilkanSoal();
      }
    });

  } else {
    setTimeout(wireSocketEvents, 100);
  }
}

// ============================================================
// Format Rupiah
// ============================================================
function formatRupiah(angka) {
  return "Rp " + angka.toLocaleString("id-ID");
}

function formatRupiahInput(input) {
  let value = input.value.replace(/[^0-9]/g, "");
  if (value) value = parseInt(value, 10).toLocaleString("id-ID");
  input.value = value;
}

// ============================================================
// Tampilkan Soal
// ============================================================
function tampilkanSoal() {
  if (currentIndex >= questions.length) {
    // Semua soal selesai
    ui.storyText.innerText = "Transaksi selesai! Mau lanjut atau selesai?";
    ui.screenText.innerText = "PILIHAN";
    ui.displayTotal.innerText = "";
    ui.displayPay.innerText   = "";
    ui.inputAnswer.style.display = "none";
    if (ui.receiptItems) ui.receiptItems.innerHTML = "";
    if (ui.receiptMeta)  ui.receiptMeta.innerHTML  = "";

    ui.feedback.innerText   = "";
    ui.feedback.className   = "feedback";
    ui.feedback.innerHTML   = `
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
        <button onclick="lanjutKasir()" class="btn-primary" style="padding:10px 20px;">LANJUT TRANSAKSI</button>
        <button onclick="endGame()" class="btn-danger" style="background:#ff4757;color:white;padding:10px 20px;border:none;border-radius:8px;">SELESAI</button>
      </div>
    `;
    return;
  }

  const q = questions[currentIndex];

  // Render struk bergambar
  renderReceiptItems(q);

  ui.displayTotal.innerText = formatRupiah(q.total_belanja);
  ui.displayPay.innerText   = formatRupiah(q.uang_bayar);
  ui.screenText.innerText   = "INPUT KEMBALIAN";

  ui.inputAnswer.value  = "";
  ui.inputAnswer.style.display = "block";
  setTimeout(() => ui.inputAnswer.focus(), 100);
  ui.feedback.innerText = "";
  ui.feedback.className = "feedback";

  isProcessing = false;
  startTimer(30);
}

// ============================================================
// Timer
// ============================================================
function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeft = seconds;
  ui.timer.innerText = timeLeft;
  ui.timer.style.color = "";
  ui.timer.style.animation = "";
  ui.timer.classList.remove("timer-danger");

  timerInterval = setInterval(() => {
    timeLeft--;
    ui.timer.innerText = timeLeft;

    if (timeLeft <= 10) {
      ui.timer.classList.add("timer-danger");
    } else if (timeLeft <= 20) {
      ui.timer.style.color = "#e17055";
      ui.timer.classList.remove("timer-danger");
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      checkAnswer(true);
    }
  }, 1000);
}

function handleEnter(e) {
  if (e.key === "Enter") checkAnswer();
}

// ============================================================
// Check Answer
// ============================================================
function checkAnswer(isTimeOut = false) {
  if (isProcessing) return;
  clearInterval(timerInterval);
  isProcessing = true;

  let rawValue  = ui.inputAnswer.value.replace(/\./g, "").replace(/[^0-9]/g, "");
  let userAnswer = Math.abs(Math.floor(parseFloat(rawValue))) || 0;

  const q = questions[currentIndex];
  const correctAnswer = q.kembalian !== undefined ? q.kembalian : q.uang_bayar - q.total_belanja;

  if (!isTimeOut && userAnswer === correctAnswer) {
    ui.feedback.innerText = "LUNAS! TRANSAKSI BERHASIL. ✅";
    ui.feedback.classList.remove("wrong");
    ui.feedback.classList.add("correct", "success-pulse", "bounce-on-hover");
    ui.screenText.innerText = "SUKSES";

    try { AudioManager.playCorrect(); } catch(e) {}

    let point = 100 + Math.floor(timeLeft * 5);
    score += point;
    ui.score.innerText = score;

    setTimeout(() => { currentIndex++; tampilkanSoal(); }, 1500);
  } else {
    ui.feedback.innerText = `SALAH! Harusnya: ${formatRupiah(correctAnswer)}`;
    ui.feedback.classList.remove("correct", "success-pulse", "bounce-on-hover");
    ui.feedback.classList.add("wrong", "shake");
    ui.screenText.innerText = "GAGAL";
    ui.inputAnswer.classList.add("shake");
    setTimeout(() => ui.inputAnswer.classList.remove("shake"), 500);

    try { AudioManager.playWrong(); } catch(e) {}

    setTimeout(endGame, 2500);
  }
}

// ============================================================
// End Game
// ============================================================
function endGame() {
  clearInterval(timerInterval);
  isProcessing = false;

  if (ui.gameScreen) {
    ui.gameScreen.classList.remove("active");
    ui.gameScreen.classList.add("hidden");
  }
  if (ui.resultScreen) {
    ui.resultScreen.classList.remove("hidden");
    ui.resultScreen.classList.add("active");
  }
  if (ui.finalScore) ui.finalScore.innerText = "Rp " + score.toLocaleString("id-ID");

  try { AudioManager.playWin(); } catch(e) {}

  if (window.socket) {
    window.socket.emit("simpanSkor", { nama: playerName, skor: score, game: "kasir" });
  }
  if (typeof Achievements !== "undefined") {
    Achievements.checkGameAchievements("kasir", score);
  }
}

// ============================================================
// Lanjut Endless Mode
// ============================================================
window.lanjutKasir = function () {
  ui.inputAnswer.style.display = "block";
  mintaSoalKeServer();
};

// ============================================================
// Restart
// ============================================================
window.restartGame = function () {
  clearInterval(timerInterval);
  isProcessing = false;

  questions    = [];
  currentIndex = 0;
  score        = 0;
  timeLeft     = 0;

  if (ui.score)    ui.score.innerText    = "0";
  if (ui.timer)    ui.timer.innerText    = "00";
  if (ui.screenText) ui.screenText.innerText = "KASIR READY...";
  if (ui.feedback) {
    ui.feedback.innerText = "";
    ui.feedback.classList.remove("correct", "wrong");
  }
  if (ui.inputAnswer) {
    ui.inputAnswer.value = "";
    ui.inputAnswer.style.display = "";
  }
  if (ui.receiptItems) ui.receiptItems.innerHTML = "";
  if (ui.receiptMeta)  ui.receiptMeta.innerHTML  = "";

  if (ui.resultScreen) {
    ui.resultScreen.classList.remove("active");
    ui.resultScreen.classList.add("hidden");
  }
  if (ui.gameScreen) {
    ui.gameScreen.classList.remove("active");
    ui.gameScreen.classList.add("hidden");
  }
  if (ui.startScreen) {
    ui.startScreen.classList.remove("hidden");
    ui.startScreen.classList.add("active");
  }

  const btnStart = document.querySelector(".btn-start");
  if (btnStart) { btnStart.innerText = "BUKA KASIR"; btnStart.disabled = false; }
};

// Pastikan HTML siap baru jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
