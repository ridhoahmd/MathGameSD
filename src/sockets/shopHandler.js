const prisma = require("../config/prisma");
const logger = require("../utils/logger");

const ITEM_PRICES = {
  // Frames
  neon: 500,
  gold: 1500,
  royal: 3000,
  fire: 5000,
  default: 0,
  // Badges
  badge_math: 800,
  badge_quran: 1000,
  badge_speed: 1200,
  badge_vip: 2500,
  // Mascots
  mascot_cat: 600,
  mascot_fox: 1200,
  mascot_robot: 2000,
  mascot_dragon: 1800,
  mascot_unicorn: 3500,
  // Accessories
  acc_glasses: 700,
  acc_crown: 900,
  acc_wizard_hat: 1400,
  acc_halo: 2200,
  acc_fire_aura: 4000,
};

module.exports = (socket, io) => {
  // ============================================================
  // BELI ITEM
  // 🛡️ SECURITY: Gunakan socket.activeUser.username (server-side),
  // bukan data.username dari client, untuk mencegah pembelian
  // atas nama user lain.
  // ============================================================
  socket.on("beliItem", async (data) => {
    // Ambil username dari server-side session, bukan dari client
    if (!socket.activeUser || !socket.activeUser.username) {
      return socket.emit("transaksiGagal", "Anda harus login terlebih dahulu.");
    }
    const username = socket.activeUser.username;
    const { itemId } = data;

    // 1. Cek Harga Server
    const hargaAsli = ITEM_PRICES[itemId];
    if (hargaAsli === undefined) {
      return socket.emit("transaksiGagal", "Item tidak valid/dijual.");
    }

    try {
      // 2. Gunakan Prisma Transaction untuk atomicity (mencegah race condition double-buy)
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { username },
        });

        if (!user) throw new Error("User tidak ditemukan.");

        // Cek Saldo
        if (user.coins < hargaAsli) {
          throw new Error("INSUFFICIENT_COINS");
        }

        // Cek Inventory
        let currentInv = user.inventory;
        if (typeof currentInv === "string") currentInv = JSON.parse(currentInv);
        if (!Array.isArray(currentInv)) currentInv = [];

        if (currentInv.includes(itemId)) {
          throw new Error("ALREADY_OWNED");
        }

        // Proses Transaksi
        currentInv.push(itemId);

        const updatedUser = await tx.user.update({
          where: { username },
          data: {
            coins: { decrement: hargaAsli },
            inventory: currentInv,
          },
        });

        return { updatedUser, currentInv };
      });

      socket.emit("transaksiSukses", {
        itemId: itemId,
        sisaKoin: result.updatedUser.coins,
        inventory: result.currentInv, // Kirim inventory TERBARU (sudah include item baru)
      });

      socket.emit("updateProfil", {
        nama: result.updatedUser.username,
        koin: result.updatedUser.coins,
        skor: result.updatedUser.totalScore,
        role: result.updatedUser.role,
        foto: result.updatedUser.photoURL || null,
        frame: result.updatedUser.equippedFrame || "default",
        theme: result.updatedUser.activeTheme || "default",
      });
    } catch (err) {
      if (err.message === "INSUFFICIENT_COINS") {
        socket.emit("transaksiGagal", "Maaf, Koin tidak cukup! 🪙");
      } else if (err.message === "ALREADY_OWNED") {
        socket.emit("transaksiGagal", "Kamu sudah punya barang ini! ✅");
      } else {
        logger.error(`❌ Error Transaksi beliItem: ${err.message}`);
        socket.emit("transaksiGagal", "Terjadi kesalahan server.");
      }
    }
  });

  // ============================================================
  // PAKAI ITEM
  // 🛡️ SECURITY: Gunakan socket.activeUser.username, bukan data.username
  // ============================================================
  socket.on("pakaiItem", async (data) => {
    if (!socket.activeUser || !socket.activeUser.username) {
      return socket.emit("transaksiGagal", "Anda harus login terlebih dahulu.");
    }
    const username = socket.activeUser.username;
    const { tipe, itemId } = data;

    try {
      // 🛡️ SECURITY: Cek user punya item ga sebelum dipake
      const user = await prisma.user.findUnique({
        where: { username },
        select: { inventory: true },
      });

      if (!user) {
        socket.emit("transaksiGagal", "User tidak ditemukan.");
        return;
      }

      let myInventory = user.inventory;
      if (typeof myInventory === "string") {
        myInventory = JSON.parse(myInventory);
      }
      if (!Array.isArray(myInventory)) {
        myInventory = ["default"];
      }

      // Cek kepemilikan (default selalu punya)
      if (itemId !== "default" && !myInventory.includes(itemId)) {
        logger.warn(
          `⚠️ Percobaan equip ilegal: ${username} mau pakai ${itemId}`,
        );
        socket.emit("transaksiGagal", "Kamu belum memiliki item ini!");
        return;
      }

      if (tipe === "theme") {
        await prisma.user.update({
          where: { username },
          data: { activeTheme: itemId },
        });
      } else if (tipe === "frame") {
        await prisma.user.update({
          where: { username },
          data: { equippedFrame: itemId },
        });
      } else if (tipe === "badge") {
        await prisma.user.update({
          where: { username },
          data: { equippedBadge: itemId },
        });
      } else if (tipe === "mascot") {
        // itemId === null berarti lepas maskot
        await prisma.user.update({
          where: { username },
          data: { equippedMascot: itemId || null },
        });
      } else if (tipe === "accessory") {
        // itemId === null berarti lepas aksesori
        await prisma.user.update({
          where: { username },
          data: { equippedAccessory: itemId || null },
        });
      }
      socket.emit("itemTerpasang", { tipe, itemId });
    } catch (err) {
      logger.error(`❌ Gagal ganti item: ${err.message}`);
      socket.emit("transaksiGagal", "Terjadi kesalahan server.");
    }
  });

  // ============================================================
  // MINTA INVENTORY
  // ============================================================
  socket.on("mintaInventory", async (username) => {
    // Jika ada activeUser di session, prioritaskan itu untuk keamanan
    const resolvedUsername = (socket.activeUser && socket.activeUser.username)
      ? socket.activeUser.username
      : username;

    if (!resolvedUsername) return;

    try {
      const user = await prisma.user.findUnique({
        where: { username: resolvedUsername },
        select: {
          inventory: true,
          activeTheme: true,
          equippedFrame: true,
          equippedBadge: true,
          equippedMascot: true,
          equippedAccessory: true,
          coins: true,
        },
      });

      if (user) {
        socket.emit("dataInventory", {
          owned: user.inventory || [],
          activeTheme: user.activeTheme,
          activeFrame: user.equippedFrame,
          activeBadge: user.equippedBadge,
          activeMascot: user.equippedMascot || null,
          activeAccessory: user.equippedAccessory || null,
          koin: user.coins,
        });
      }
    } catch (err) {
      logger.error(`❌ Error mintaInventory: ${err.message}`);
    }
  });
};
