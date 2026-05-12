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

// Tab aktif
let activeTab = "frame";
let serverData = null;

// 1. Ambil data pas loading
document.addEventListener("DOMContentLoaded", () => {
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
  socket.emit("mintaInventory", username);
});

// 2. Data masuk dari server
socket.on("dataInventory", (data) => {
  serverData = data;

  // A. Update koin
  const coinEl = document.getElementById("user-coins");
  if (coinEl) coinEl.innerText = (data.koin || 0).toLocaleString();

  // B. Tampilkan toko
  renderTabs();
  renderShop();
});

// 3. Tampilkan Tab
function renderTabs() {
  const tabContainer = document.getElementById("shop-tabs");
  if (!tabContainer) return;

  tabContainer.innerHTML = `
    <button class="tab-btn ${activeTab === "frame" ? "active" : ""}" onclick="switchTab('frame')">
      🖼️ Bingkai Avatar
    </button>
    <button class="tab-btn ${activeTab === "badge" ? "active" : ""}" onclick="switchTab('badge')">
      🏆 Lencana Profil
    </button>
  `;
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

  const items = activeTab === "frame" ? frameItems : badgeItems;

  items.forEach((item) => {
    // Cek inventory
    const inventory = serverData.owned || ["default"];
    const isOwned = inventory.includes(item.id) || item.id === "default";

    // Cek apa lagi dipake
    let isEquipped = false;
    if (item.type === "frame") {
      isEquipped = serverData.activeFrame === item.id;
    } else if (item.type === "badge") {
      isEquipped = serverData.activeBadge === item.id;
    }

    const canAfford = serverData.koin >= item.price;

    let btnHtml = "";

    // Logika tombol
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

    // HTML Kartu
    let cardClass = "shop-card";
    if (item.type === "badge") cardClass += " badge-card";

    // Tambahan class indikator visual
    if (isEquipped) {
      cardClass += " card-equipped";
    } else if (isOwned) {
      cardClass += " card-owned";
    } else if (canAfford) {
      cardClass += " card-purchasable";
    } else {
      cardClass += " card-locked";
    }

    if (item.type === "frame") {
      cardHtml = `
        <div class="${cardClass}">
          ${isEquipped ? '<div class="equipped-label">★ DIPAKAI</div>' : ''}
          ${!isOwned && !canAfford ? '<div class="locked-icon">🔒</div>' : ''}
          <div class="preview-box ${item.class}">
            <img src="${avatarUrl}" class="preview-img" alt="Preview">
          </div>
          <span class="item-name">${item.name}</span>
          ${
            !isOwned
              ? `<span class="item-price">Harga: ${item.price}</span>`
              : `<span class="item-price text-owned">SUDAH DIMILIKI</span>`
          }
          ${btnHtml}
        </div>
      `;
    } else {
      // Kartu Badge
      cardHtml = `
        <div class="${cardClass}">
          ${isEquipped ? '<div class="equipped-label">★ DIPAKAI</div>' : ''}
          ${!isOwned && !canAfford ? '<div class="locked-icon">🔒</div>' : ''}
          <div class="badge-preview">
            <span class="badge-emoji">${item.emoji}</span>
          </div>
          <span class="item-name">${item.name}</span>
          ${
            !isOwned
              ? `<span class="item-price">Harga: ${item.price}</span>`
              : `<span class="item-price text-owned">SUDAH DIMILIKI</span>`
          }
          ${btnHtml}
        </div>
      `;
    }

    container.innerHTML += cardHtml;
  });
}

// 5. Fungsi Tombol

// Belanja item
window.buyItem = function (itemId, displayPrice) {
  if (typeof Swal === "undefined") {
    if (confirm(`Yakin beli ${itemId} seharga ${displayPrice} koin?`)) {
      socket.emit("beliItem", {
        username: username,
        itemId: itemId,
        // FIX: Hapus pengiriman harga dari sisi client, karena rawan IDOR/manipulasi harga!
        // Harga harus ditentukan absolute oleh server
      });
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
      socket.emit("beliItem", {
        username: username,
        itemId: itemId,
        // FIX: Hapus pengiriman harga dari client
      });
    }
  });
};

// Pakai item
window.equipItem = function (itemId, itemType) {
  let tipe = itemType || "frame";

  // Cek tipe otomatis
  if (!itemType) {
    if (itemId.startsWith("badge_")) {
      tipe = "badge";
    } else {
      const frameList = ["default", "neon", "gold", "royal", "fire"];
      tipe = frameList.includes(itemId) ? "frame" : "theme";
    }
  }


  socket.emit("pakaiItem", {
    username: username,
    tipe: tipe,
    itemId: itemId,
  });
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
