const prisma = require("../config/prisma");

// Global variable untuk menyimpan prioritas konten (AI vs Cache)
global.CONTENT_SOURCE_PRIORITY = "CACHE_FIRST";

module.exports = (socket, io) => {
  // 1. Simpan Soal Manual
  socket.on("simpanSoalManual", async (data) => {
    try {
      // Pastikan ada auth token dengan role guru/admin
      if (!socket.isAuth || (socket.decoded.role !== "guru" && socket.decoded.role !== "admin")) {
        console.warn(`[Admin] Unauthorized simpan soal request from ${socket.id}`);
        socket.emit("adminResponse", { success: false, message: "Akses Ditolak: Khusus Guru/Admin" });
        return;
      }

      const { kategori, level, kodeKelas, soalData } = data;

      if (!kategori || !level || !soalData) {
        return socket.emit("adminResponse", { success: false, message: "Data soal tidak lengkap!" });
      }

      // Struktur data di DB kita: category, level, content
      // Supaya gampang, content kita jadikan bentuk Array jika ini kumpulan soal,
      // atau satu objek spesifik. GameHandler mengambil "data.opsi" atau "data" dalam content.
      
      const newQuestion = await prisma.gameQuestion.create({
        data: {
          category: kategori,
          level: level.toLowerCase() === "mudah" ? "Easy" : level.toLowerCase() === "sedang" ? "Medium" : "Hard",
          content: [soalData] // Format array seperti struktur kuis kita
        }
      });

      // Broadcast Soal Real-Time ke murid-murid
      io.emit("soalBaruTersedia", { game: kategori, level: level });

      console.log(`[Admin] ✅ Soal manual '${kategori}' berhasil disimpan oleh ${socket.decoded.username}`);
      socket.emit("adminResponse", { success: true, message: "Soal berhasil disimpan di database!" });
    } catch (err) {
      console.error("[Admin] ❌ Gagal menyimpan soal manual:", err.message);
      socket.emit("adminResponse", { success: false, message: "Terjadi kesalahan server saat menyimpan." });
    }
  });

  // 2. Ubah Pengaturan Sumber Soal
  socket.on("ubahPrioritasSoal", (source) => {
    if (!socket.isAuth || (socket.decoded.role !== "guru" && socket.decoded.role !== "admin")) {
      socket.emit("adminResponse", { success: false, message: "Akses Ditolak" });
      return;
    }

    if (source === "CACHE_FIRST" || source === "AI_ONLY") {
      global.CONTENT_SOURCE_PRIORITY = source;
      console.log(`[Admin] 🔄 Prioritas Sumber Soal diubah ke: ${source} oleh ${socket.decoded.username}`);
      
      // Broadcast ke semua admin yang sedang online
      io.emit("updatePrioritasMasaDepan", source);
      
      socket.emit("adminResponse", { success: true, message: `Sumber soal disetel ke ${source}` });
    } else {
      socket.emit("adminResponse", { success: false, message: "Sumber soal tidak dikenali" });
    }
  });

  // 3. Minta Detail Analitik Siswa (Rapor)
  socket.on("mintaAnalitikSiswa", async (usernameSiswa) => {
    if (!socket.isAuth || (socket.decoded.role !== "guru" && socket.decoded.role !== "admin")) return;
    
    try {
      const targetUser = await prisma.user.findUnique({
        where: { username: usernameSiswa },
        select: { xp: true, coins: true, level: true, id: true }
      });
      
      if (!targetUser) {
        socket.emit("analitikSiswaData", { success: false });
        return;
      }

      // Ambil 5 duel versus terakhir
      const versusHistory = await prisma.versusMatch.findMany({
        where: { p1Id: targetUser.id },
        orderBy: { playedAt: "desc" },
        take: 5,
        include: { game: true }
      });

      const formattedVersus = versusHistory.map(h => ({
        game: h.game.title,
        p2Name: h.p2Name,
        status: h.status,
        score: h.p1Score,
        playedAt: h.playedAt
      }));

      socket.emit("analitikSiswaData", {
        success: true,
        nama: usernameSiswa,
        xp: targetUser.xp,
        coins: targetUser.coins,
        level: targetUser.level,
        versus: formattedVersus
      });

    } catch (err) {
      console.error("[Admin] Gagal ambil analitik siswa:", err.message);
      socket.emit("analitikSiswaData", { success: false });
    }
  });
};
