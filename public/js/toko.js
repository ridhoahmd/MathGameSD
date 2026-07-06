// BUG-02 FIX: Pakai window.socket dari global.js (sudah include auth token jika guru/admin)
const socket = window.socket;
const username = localStorage.getItem("playerName");

// Daftar bingkai
const frameItems = [
  {
    id: "default",
    name: "Standar",
    price: 0,
    class: "frame-default",
    type: "frame",
  },
  {
    id: "neon",
    name: "Neon Cyber",
    price: 500,
    class: "frame-neon",
    type: "frame",
  },
  {
    id: "gold",
    name: "Sultan Gold",
    price: 1500,
    class: "frame-gold",
    type: "frame",
  },
  {
    id: "royal",
    name: "Royal Purple",
    price: 3000,
    class: "frame-royal",
    type: "frame",
  },
  {
    id: "fire",
    name: "Api Membara",
    price: 5000,
    class: "frame-fire",
    type: "frame",
  },
];

// Daftar lencana
const badgeItems = [
  {
    id: "badge_math",
    name: "Ahli Matematika",
    price: 800,
    emoji: "🎖️",
    type: "badge",
  },
  {
    id: "badge_quran",
    name: "Penghafal Quran",
    price: 1000,
    emoji: "📚",
    type: "badge",
  },
  {
    id: "badge_speed",
    name: "Si Kilat",
    price: 1200,
    emoji: "🚀",
    type: "badge",
  },
  {
    id: "badge_vip",
    name: "Mahkota VIP",
    price: 2500,
    emoji: "👑",
    type: "badge",
  },
];

// Daftar maskot
const mascotItems = [
  { id: "mascot_cat",     name: "Kucing Ajaib",     price: 600,  emoji: "🐱", animClass: "mascot-bounce",   type: "mascot" },
  { id: "mascot_fox",     name: "Rubah Cerdik",     price: 1200, emoji: "🦊", animClass: "mascot-pulse",    type: "mascot" },
  { id: "mascot_robot",   name: "Robot Pintar",     price: 2000, emoji: "🤖", animClass: "mascot-spin",     type: "mascot" },
  { id: "mascot_dragon",  name: "Naga Emas",        price: 1800, emoji: "🐉", animClass: "mascot-float",    type: "mascot" },
  { id: "mascot_unicorn", name: "Unicorn Pelangi",  price: 3500, emoji: "🦄", animClass: "mascot-sparkle",  type: "mascot" },
];

// Daftar aksesori
const accessoryItems = [
  { id: "acc_glasses",    name: "Kacamata Keren",   price: 700,  emoji: "🕶️",  type: "accessory" },
  { id: "acc_crown",      name: "Mahkota Emas",     price: 900,  emoji: "👑",  type: "accessory" },
  { id: "acc_wizard_hat", name: "Topi Penyihir",    price: 1400, emoji: "🎩",  type: "accessory" },
  { id: "acc_halo",       name: "Lingkaran Cahaya", price: 2200, emoji: "😇",  type: "accessory" },
  { id: "acc_fire_aura",  name: "Aura Api",         price: 4000, emoji: "🔥",  type: "accessory" },
];

// Tab aktif
let activeTab = "frame";
let serverData = null;

// 1. Ambil data pas loading
document.addEventListener("DOMContentLoaded", () => {
  // Guard: pastikan socket tersedia sebelum digunakan
  if (!socket) {
    console.error("[Toko] window.socket tidak tersedia. Pastikan global.js sudah dimuat.");
    document.getElementById("shop-container").innerHTML =
      "<p style='color:#ff4444;text-align:center;padding:40px'>⚠️ Koneksi gagal. Coba refresh halaman.</p>";
    return;
  }

  if (!username) {
    if (typeof Swal !== "undefined") {
      Swal.fire(
        "Login Diperlukan",
        "Silakan login terlebih dahulu.",
        "warning",
      ).then(() => (window.location.href = "index.html"));
    } else {
      alert("Silakan login dulu!");
      window.location.href = "index.html";
    }
    return;
  }

  // FIX: Daftarkan sesi user ke server (set socket.activeUser) agar
  // beliItem & pakaiItem di shopHandler tidak reject "harus login".
  // mintaDataProfil adalah satu-satunya cara server men-set socket.activeUser.
  socket.emit("mintaDataProfil", username);

  // Minta data inventory setelah sesi terdaftar
  socket.emit("mintaInventory", username);
});

// 2. Data masuk dari server
socket.on("dataInventory", (data) => {
  serverData = data;

  // A. Update koin
  const coinEl = document.getElementById("user-coins");
  if (coinEl) coinEl.innerText = (data.koin || 0).toLocaleString();

  // B. Simpan maskot & aksesori ke localStorage biar bisa dibaca halaman game
  if (data.activeMascot)    localStorage.setItem("equippedMascot",    data.activeMascot);
  else                      localStorage.removeItem("equippedMascot");
  if (data.activeAccessory) localStorage.setItem("equippedAccessory", data.activeAccessory);
  else                      localStorage.removeItem("equippedAccessory");

  // C. Tampilkan toko
  renderTabs();
  renderShop();
});

// 3. Tampilkan Tab
function renderTabs() {
  const tabContainer = document.getElementById("shop-tabs");
  if (!tabContainer) return;

  const tabs = [
    { id: "frame",     label: "🖼️ Bingkai Avatar" },
    { id: "badge",     label: "🏆 Lencana Profil" },
    { id: "mascot",    label: "🐾 Maskot" },
    { id: "accessory", label: "🧢 Aksesori" },
  ];

  tabContainer.innerHTML = tabs
    .map(t => `<button class="tab-btn ${activeTab === t.id ? "active" : ""}" onclick="switchTab('${t.id}')">${t.label}</button>`)
    .join("");
}

// Ganti tab
window.switchTab = function (tab) {
  activeTab = tab;
  renderTabs();
  renderShop();
};

// 4. Tampilkan barang
function renderShop() {
  const container = document.getElementById("shop-container");
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

  if (!container || !serverData) return;
  container.innerHTML = "";

  let items;
  if (activeTab === "frame")     items = frameItems;
  else if (activeTab === "badge")     items = badgeItems;
  else if (activeTab === "mascot")    items = mascotItems;
  else if (activeTab === "accessory") items = accessoryItems;
  else items = [];

  items.forEach((item) => {
    const inventory  = serverData.owned || ["default"];
    const isOwned    = inventory.includes(item.id) || item.id === "default";

    let isEquipped = false;
    if (item.type === "frame")     isEquipped = serverData.activeFrame === item.id;
    else if (item.type === "badge")     isEquipped = serverData.activeBadge === item.id;
    else if (item.type === "mascot")    isEquipped = serverData.activeMascot === item.id;
    else if (item.type === "accessory") isEquipped = serverData.activeAccessory === item.id;

    const canAfford = serverData.koin >= item.price;

    let btnHtml = "";
    if (isEquipped) {
      btnHtml = `<button class="btn-equipped" disabled>SEDANG DIPAKAI</button>`;
    } else if (isOwned) {
      btnHtml = `<button class="btn-equip" onclick="equipItem('${item.id}', '${item.type}')">PAKAI</button>`;
    } else if (canAfford) {
      btnHtml = `<button class="btn-buy" onclick="buyItem('${item.id}', ${item.price})">BELI (${item.price})</button>`;
    } else {
      const kurang = item.price - serverData.koin;
      btnHtml = `<button class="btn-poor" disabled>Kurang ${kurang}</button>`;
    }

    let cardClass = "shop-card";
    if (item.type === "badge")     cardClass += " badge-card";
    if (item.type === "mascot")    cardClass += " mascot-card";
    if (item.type === "accessory") cardClass += " accessory-card";
    if (isEquipped)   cardClass += " card-equipped";
    else if (isOwned) cardClass += " card-owned";
    else if (canAfford) cardClass += " card-purchasable";
    else              cardClass += " card-locked";

    const priceLine = !isOwned
      ? `<span class="item-price">Harga: ${item.price} 🪙</span>`
      : `<span class="item-price text-owned">SUDAH DIMILIKI</span>`;

    let previewHtml = "";

    if (item.type === "frame") {
      previewHtml = `
        <div class="preview-box ${item.class}">
          <img src="${avatarUrl}" class="preview-img" alt="Preview">
        </div>`;
    } else if (item.type === "badge") {
      previewHtml = `
        <div class="badge-preview">
          <span class="badge-emoji">${item.emoji}</span>
        </div>`;
    } else if (item.type === "mascot") {
      previewHtml = `
        <div class="mascot-preview">
          <span class="mascot-emoji ${item.animClass}">${item.emoji}</span>
        </div>`;
    } else if (item.type === "accessory") {
      previewHtml = `
        <div class="preview-box acc-preview-box">
          <span class="acc-overlay-emoji">${item.emoji}</span>
          <img src="${avatarUrl}" class="preview-img" alt="Preview">
        </div>`;
    }

    const equippedLabel = isEquipped ? `<div class="equipped-label">★ DIPAKAI</div>` : "";
    const lockedIcon   = !isOwned && !canAfford ? `<div class="locked-icon">🔒</div>` : "";

    container.innerHTML += `
      <div class="${cardClass}">
        ${equippedLabel}
        ${lockedIcon}
        ${previewHtml}
        <span class="item-name">${item.name}</span>
        ${priceLine}
        ${btnHtml}
      </div>`;
  });
}

// 5. Fungsi Tombol

// Belanja item
window.buyItem = function (itemId, displayPrice) {
  if (!socket) return;

  if (typeof Swal === "undefined") {
    if (confirm(`Yakin beli ${itemId} seharga ${displayPrice} koin?`)) {
      socket.emit("beliItem", { username, itemId });
    }
    return;
  }

  Swal.fire({
    title: "Konfirmasi Pembelian",
    text: `Yakin beli ${itemId} seharga ${displayPrice} koin?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, Beli!",
    cancelButtonText: "Batal",
    background: "#1e1e2e",
    color: "#fff",
  }).then((result) => {
    if (result.isConfirmed) {
      // Loading state — cegah double klik
      Swal.fire({
        title: "Memproses...",
        text: "Transaksi sedang diproses oleh server",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
        background: "#1e1e2e",
        color: "#fff",
      });
      socket.emit("beliItem", { username, itemId });
    }
  });
};

// Pakai item
window.equipItem = function (itemId, itemType) {
  if (!socket) return;

  let tipe = itemType || "frame";

  // Deteksi tipe otomatis jika tidak disertakan
  if (!itemType) {
    if (itemId.startsWith("badge_")) {
      tipe = "badge";
    } else if (itemId.startsWith("mascot_")) {
      tipe = "mascot";
    } else if (itemId.startsWith("acc_")) {
      tipe = "accessory";
    } else {
      const frameList = ["default", "neon", "gold", "royal", "fire"];
      tipe = frameList.includes(itemId) ? "frame" : "theme";
    }
  }

  socket.emit("pakaiItem", { username, tipe, itemId });
};

// 6. Respon Server

socket.on("transaksiSukses", (data) => {
  // Mainkan efek suara pembelian premium
  if (typeof window.safePlayPurchase === "function") {
    window.safePlayPurchase();
  } else if (typeof window.safePlayWin === "function") {
    window.safePlayWin();
  }

  // Efek Partikel WOW (Confetti Premium)
  if (typeof confetti === "function") {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // Confetti turun dari atas agak tengah
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    // Ledakan besar emas di tengah sebagai highlight
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFFFFF', '#00f2ff'],
      zIndex: 10000
    });
  }

  Swal.fire({
    title: "Berhasil!",
    text: `Item ${data.itemId} berhasil dibeli!`,
    icon: "success",
    confirmButtonText: "Mantap",
    background: "#1e1e2e",
    color: "#fff",
  });

  socket.emit("mintaInventory", username);
});

socket.on("transaksiGagal", (pesan) => {
  Swal.fire({
    title: "Gagal!",
    text: pesan,
    icon: "error",
    confirmButtonText: "Oke",
    background: "#1e1e2e",
    color: "#fff",
  });
});

socket.on("itemTerpasang", (data) => {
  Swal.fire({
    icon: "success",
    title: "Terpasang!",
    text: `Item ${data.itemId} berhasil digunakan.`,
    background: "#1e1e2e",
    color: "#fff",
    timer: 1500,
    showConfirmButton: false,
    toast: true,
    position: "top-end",
  });
  socket.emit("mintaInventory", username);
});
