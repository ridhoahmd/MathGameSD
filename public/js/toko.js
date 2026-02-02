const socket = io();
const username = localStorage.getItem("playerName");

// --- DAFTAR ITEM FRAMES ---
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

// --- DAFTAR ITEM BADGES ---
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

// Current active tab
let activeTab = "frame";
let serverData = null;

// 1. MINTA DATA SAAT LOAD
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
  console.log("🛒 Meminta data toko untuk:", username);
  socket.emit("mintaInventory", username);
});

// 2. TERIMA DATA DARI SERVER
socket.on("dataInventory", (data) => {
  console.log("📦 Data Diterima:", data);
  serverData = data;

  // A. Update Koin
  const coinEl = document.getElementById("user-coins");
  if (coinEl) coinEl.innerText = (data.koin || 0).toLocaleString();

  // B. Render Tabs and Shop
  renderTabs();
  renderShop();
});

// 3. RENDER TABS
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

// Switch tab function
window.switchTab = function (tab) {
  activeTab = tab;
  renderTabs();
  renderShop();
};

// 4. FUNGSI RENDER TAMPILAN
function renderShop() {
  const container = document.getElementById("shop-container");
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

  if (!container || !serverData) return;
  container.innerHTML = "";

  const items = activeTab === "frame" ? frameItems : badgeItems;

  items.forEach((item) => {
    // Cek inventory user dari data server
    const inventory = serverData.owned || ["default"];
    const isOwned = inventory.includes(item.id) || item.id === "default";

    // Cek apakah sedang dipakai (Frame atau Badge)
    let isEquipped = false;
    if (item.type === "frame") {
      isEquipped = serverData.activeFrame === item.id;
    } else if (item.type === "badge") {
      isEquipped = serverData.activeBadge === item.id;
    }

    const canAfford = serverData.koin >= item.price;

    let btnHtml = "";

    // LOGIKA TOMBOL
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

    // HTML CARD - Different for frames vs badges
    let cardHtml = "";
    if (item.type === "frame") {
      cardHtml = `
        <div class="shop-card">
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
      // Badge card
      cardHtml = `
        <div class="shop-card badge-card">
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

// 5. GLOBAL FUNCTIONS (AKSI TOMBOL)

// --- A. BELI ITEM ---
window.buyItem = function (itemId, price) {
  if (typeof Swal === "undefined") {
    if (confirm(`Yakin beli ${itemId} seharga ${price} koin?`)) {
      socket.emit("beliItem", {
        username: username,
        itemId: itemId,
        harga: parseInt(price),
      });
    }
    return;
  }

  Swal.fire({
    title: "Konfirmasi Pembelian",
    text: `Yakin beli ${itemId} seharga ${price} koin?`,
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
        harga: parseInt(price),
      });
    }
  });
};

// --- B. PAKAI ITEM (EQUIP) ---
window.equipItem = function (itemId, itemType) {
  let tipe = itemType || "frame";

  // Auto-detect type if not provided
  if (!itemType) {
    if (itemId.startsWith("badge_")) {
      tipe = "badge";
    } else {
      const frameList = ["default", "neon", "gold", "royal", "fire"];
      tipe = frameList.includes(itemId) ? "frame" : "theme";
    }
  }

  console.log(`Mengirim request pakai: ${itemId} sebagai [${tipe}]`);

  socket.emit("pakaiItem", {
    username: username,
    tipe: tipe,
    itemId: itemId,
  });
};

// 6. RESPON SOCKET DARI SERVER

socket.on("transaksiSukses", (data) => {
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
