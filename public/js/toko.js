// public/js/toko.js - FINAL FIXED VERSION

const socket = io();
const username = localStorage.getItem("playerName");

// --- DAFTAR ITEM ---
const shopItems = [
  { id: "default", name: "Standar", price: 0, class: "frame-default" },
  { id: "neon", name: "Neon Cyber", price: 500, class: "frame-neon" },
  { id: "gold", name: "Sultan Gold", price: 1500, class: "frame-gold" },
  { id: "royal", name: "Royal Purple", price: 3000, class: "frame-royal" },
  { id: "fire", name: "Api Membara", price: 5000, class: "frame-fire" },
];

// 1. MINTA DATA SAAT LOAD
document.addEventListener("DOMContentLoaded", () => {
  if (!username) {
    // Ganti alert biasa dengan SweetAlert jika library sudah load, atau fallback ke alert
    if (typeof Swal !== "undefined") {
      Swal.fire(
        "Login Diperlukan",
        "Silakan login terlebih dahulu.",
        "warning"
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

  // A. Update Koin
  const coinEl = document.getElementById("user-coins");
  if (coinEl) coinEl.innerText = (data.koin || 0).toLocaleString();

  // B. Render Ulang Toko
  renderShop(data);
});

// 3. FUNGSI RENDER TAMPILAN
function renderShop(serverData) {
  const container = document.getElementById("shop-container");
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

  if (container) container.innerHTML = "";

  shopItems.forEach((item) => {
    // Cek inventory user dari data server
    const inventory = serverData.owned || ["default"];
    const isOwned = inventory.includes(item.id);

    // Cek apakah sedang dipakai (Frame atau Theme)
    const isEquipped =
      serverData.activeFrame === item.id || serverData.activeTheme === item.id;
    const canAfford = serverData.koin >= item.price;

    let btnHtml = "";

    // LOGIKA TOMBOL
    if (isEquipped) {
      btnHtml = `<button class="btn-equipped" disabled>SEDANG DIPAKAI</button>`;
    } else if (isOwned) {
      // Tombol PAKAI memanggil equipItem
      btnHtml = `<button class="btn-equip" onclick="equipItem('${item.id}')">PAKAI</button>`;
    } else if (canAfford) {
      // Tombol BELI memanggil buyItem
      btnHtml = `<button class="btn-buy" onclick="buyItem('${item.id}', ${item.price})">BELI (${item.price})</button>`;
    } else {
      const kurang = item.price - serverData.koin;
      btnHtml = `<button class="btn-poor" disabled>Kurang ${kurang}</button>`;
    }

    // HTML CARD
    const card = `
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
    if (container) container.innerHTML += card;
  });
}

// 4. GLOBAL FUNCTIONS (AKSI TOMBOL)

// --- A. BELI ITEM ---
window.buyItem = function (itemId, price) {
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
window.equipItem = function (itemId) {
  const frameList = ["default", "neon", "gold", "royal", "fire"];
  let tipe = "theme";

  // Deteksi apakah ini Frame atau Theme
  if (itemId.includes("frame") || frameList.includes(itemId)) {
    tipe = "frame";
  }

  console.log(`Mengirim request pakai: ${itemId} sebagai [${tipe}]`);

  socket.emit("pakaiItem", {
    username: username,
    tipe: tipe,
    itemId: itemId,
  });
};

// 5. RESPON SOCKET DARI SERVER

socket.on("transaksiSukses", (data) => {
  Swal.fire({
    title: "Berhasil!",
    text: `Item ${data.itemId} berhasil dibeli!`,
    icon: "success",
    confirmButtonText: "Mantap",
    background: "#1e1e2e",
    color: "#fff",
  });
  // Update inventory otomatis terjadi karena server mengirim updateProfil/Inventory
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
  // Refresh data agar tombol berubah jadi "SEDANG DIPAKAI"
  socket.emit("mintaInventory", username);
});
