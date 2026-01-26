const prisma = require("../config/prisma");

const ITEM_PRICES = {
    neon: 500,
    gold: 1500,
    royal: 3000,
    fire: 5000,
    default: 0,
};

module.exports = (socket, io) => {
    socket.on("beliItem", async (data) => {
        const { username, itemId } = data;

        // 1. Cek Harga Server
        const hargaAsli = ITEM_PRICES[itemId];
        if (hargaAsli === undefined) {
            return socket.emit("transaksiGagal", "Item tidak valid/dijual.");
        }



        try {
            const user = await prisma.user.findUnique({
                where: { username: username },
            });
            if (!user) return;

            // 2. Cek Saldo & Inventory
            if (user.coins < hargaAsli) {
                socket.emit("transaksiGagal", "Maaf, Koin tidak cukup! 🪙");
                return;
            }

            let myInventory = user.inventory;
            if (typeof myInventory === "string")
                myInventory = JSON.parse(myInventory);
            if (!Array.isArray(myInventory)) myInventory = [];

            if (myInventory.includes(itemId)) {
                socket.emit("transaksiGagal", "Kamu sudah punya barang ini! ✅");
                return;
            }

            // 3. Proses Transaksi Aman
            myInventory.push(itemId);

            const updatedUser = await prisma.user.update({
                where: { username: username },
                data: {
                    coins: { decrement: hargaAsli },
                    inventory: myInventory,
                },
            });



            socket.emit("transaksiSukses", {
                itemId: itemId,
                sisaKoin: updatedUser.coins,
                inventory: myInventory,
            });

            socket.emit("updateProfil", {
                nama: updatedUser.username,
                koin: updatedUser.coins,
                skor: updatedUser.totalScore,
                role: updatedUser.role,
                foto: updatedUser.photoURL || null,
                frame: updatedUser.equippedFrame || "default",
                theme: updatedUser.activeTheme || "default",
            });
        } catch (err) {
            console.error("❌ Error Transaksi:", err.message);
            socket.emit("transaksiGagal", "Terjadi kesalahan server.");
        }
    });

    socket.on("pakaiItem", async (data) => {
        const { username, tipe, itemId } = data;

        try {
            if (tipe === "theme") {
                await prisma.user.update({
                    where: { username: username },
                    data: { activeTheme: itemId },
                });
            } else if (tipe === "frame") {
                await prisma.user.update({
                    where: { username: username },
                    data: { equippedFrame: itemId },
                });
            }
            socket.emit("itemTerpasang", { tipe, itemId });
        } catch (err) {
            console.error("❌ Gagal ganti item:", err.message);
        }
    });

    socket.on("mintaInventory", async (username) => {
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                inventory: true,
                activeTheme: true,
                equippedFrame: true,
                coins: true,
            },
        });

        if (user) {
            socket.emit("dataInventory", {
                owned: user.inventory || [],
                activeTheme: user.activeTheme,
                activeFrame: user.equippedFrame,
                koin: user.coins,
            });
        }
    });
};
