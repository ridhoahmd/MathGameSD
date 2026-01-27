const prisma = require("../config/prisma");

module.exports = (socket, io) => {
  // D. DATA PROFIL
  socket.on("mintaDataProfil", async (data) => {
    let username = "";
    let fotoGoogle = "";

    if (typeof data === "string") {
      username = data.trim();
    } else if (typeof data === "object") {
      username = data.nama.trim();
      fotoGoogle = data.foto;
    }

    if (!username) return;

    // SECURITY CHECKS
    // 1. Jika user mencoba mengakses profil 'admin' atau 'guru', WAJIB punya token valid.
    // 2. Jika user punya token, paksa username sesuai token.
    if (socket.isAuth && socket.decoded) {
      // Jika authenticated, username HARUS ikut token untuk konsistensi
      // Kecuali admin mau lihat profil orang lain?
      // Untuk sekarang asumsi: token guru = identity guru.
      if (socket.decoded.role === "guru" || socket.decoded.role === "admin") {
        // Izinkan login dengan hak akses tinggi
      }
    }

    try {
      // Cek DB dulu
      let user = await prisma.user.findUnique({
        where: { username: username },
      });

      // 🚨 PREVENT IMPERSONATION
      if (user && (user.role === "admin" || user.role === "guru")) {
        if (
          !socket.isAuth ||
          (socket.decoded && socket.decoded.role !== "guru")
        ) {
          console.warn(
            `⚠️ Unauthorized access attempt to ${username} (Role: ${user.role}) by unauthenticated socket.`,
          );
          socket.emit(
            "errorAuth",
            "Anda tidak memiliki izin mengakses akun ini.",
          );
          return;
        }
      }

      socket.activeUser = {
        username: username,
        role: user ? user.role : "siswa",
      };

      if (fotoGoogle) {
        await prisma.user.upsert({
          where: { username: username },
          update: { photoURL: fotoGoogle },
          create: {
            username: username,
            role: "siswa",
            coins: 0,
            totalScore: 0,
            photoURL: fotoGoogle,
          },
        });
      }

      // Refetch to be sure
      user = await prisma.user.findUnique({
        where: { username: username },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            username: username,
            coins: 0,
            totalScore: 0,
            role: "siswa",
          },
        });
      }

      socket.activeUser.role = user.role;

      const finalFoto =
        user.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;

      socket.emit("updateProfil", {
        nama: user.username,
        koin: user.coins,
        skor: user.totalScore || 0,
        role: user.role,
        foto: finalFoto,
        frame: user.equippedFrame || "default",
        theme: user.activeTheme || "default",
      });
    } catch (err) {
      console.error("❌ Gagal ambil profil SQL:", err.message);
      socket.emit("errorProfil", "Gagal memuat profil. Coba refresh.");
    }
  });

  // B. SIMPAN SKOR
  socket.on("simpanSkor", async (data) => {
    if (!data || !data.nama || !data.game) return;
    let skor = parseInt(data.skor);
    if (isNaN(skor)) skor = 0;

    // 🛡️ SECURITY: VALIDASI SKOR
    const MAX_SCORE_PER_GAME = 1000; // Contoh batas wajar per sesi
    if (skor > MAX_SCORE_PER_GAME) {
      console.warn(`⚠️ Suspicious Score Attempt: ${skor} by ${data.nama}`);
      skor = MAX_SCORE_PER_GAME; // Cap skor
      socket.emit("info", "Skor Anda disesuaikan dengan batas maksimum.");
    }
    if (skor < 0) skor = 0;

    // TODO: Add Server-Side Validation here later
    if (
      !socket.activeGameSession ||
      socket.activeGameSession.game !== data.game
    ) {
      // console.warn(⚠️ Warning: Skor tanpa sesi valid);
    }

    const safeName = data.nama;
    const gameSlug = data.game;
    const koin = Math.floor(skor / 10);

    try {
      let gameDb = await prisma.game.findUnique({ where: { slug: gameSlug } });
      if (!gameDb) {
        gameDb = await prisma.game.create({
          data: { slug: gameSlug, title: gameSlug.toUpperCase() },
        });
      }

      const updatedUser = await prisma.user.upsert({
        where: { username: safeName },
        update: {
          coins: { increment: koin },
          totalScore: { increment: skor },
        },
        create: {
          username: safeName,
          role: "siswa",
          coins: koin,
          totalScore: skor,
        },
      });

      await prisma.score.create({
        data: {
          score: skor,
          game: {
            connect: { id: gameDb.id },
          },
          user: {
            connect: { id: updatedUser.id },
          },
        },
      });

      // Confirm success to client so they can refresh
      socket.emit("skorTersimpan", {
        totalScore: updatedUser.totalScore,
        koin: updatedUser.coins,
      });

      // Notify teachers if needed (Global Emit can be handled via io)
      if (io) io.emit("refreshDataGuru");
    } catch (err) {
      console.error("❌ DB Error:", err.message);
    }
  });

  // C. LEADERBOARD
  socket.on("mintaLeaderboard", async () => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { totalScore: "desc" },
        take: 50,
        include: {
          scores: { include: { game: true } },
        },
      });

      const leaderboard = users.map((user) => {
        const skorMap = {};
        user.scores.forEach((record) => {
          const slug = record.game.slug;
          if (!skorMap[slug] || record.score > skorMap[slug]) {
            skorMap[slug] = record.score;
          }
        });

        return {
          nama: user.username,
          role: user.role,
          skor: user.totalScore || 0,
          koin: user.coins || 0,
          math: skorMap["math"] || 0,
          zuma: skorMap["zuma"] || 0,
          memory: skorMap["memory"] || 0,
          piano: skorMap["piano"] || 0,
          kasir: skorMap["kasir"] || 0,
          labirin: skorMap["labirin"] || 0,
          nabi: skorMap["nabi"] || 0,
          ayat: skorMap["ayat"] || 0,
        };
      });

      socket.emit("updateLeaderboard", leaderboard);
    } catch (err) {
      console.error("❌ Gagal ambil leaderboard SQL:", err.message);
      socket.emit("updateLeaderboard", []);
    }
  });

  // UPDATE ROLE USER
  socket.on("updateUserRole", async (data) => {
    const { targetUser, newRole } = data;

    // 🛡️ SECURITY: STRICT AUTH CHECK
    if (!socket.isAuth || !socket.decoded || socket.decoded.role !== "guru") {
      console.warn(`⚠️ Unauthorized Role Update Attempt by ${socket.id}`);
      socket.emit(
        "errorUpdate",
        "Akses Ditolak: Anda bukan Guru/Admin terverifikasi.",
      );
      return;
    }

    try {
      await prisma.user.update({
        where: { username: targetUser },
        data: { role: newRole },
      });

      if (io) io.emit("refreshDataGuru");
    } catch (err) {
      console.error("❌ Gagal update role:", err.message);
      socket.emit("errorUpdate", "Gagal mengupdate database.");
    }
  });

  // ADMIN RESET SYSTEM
  socket.on("adminResetSystem", async (data) => {
    const passwordInput = typeof data === "object" ? data.password : "";

    // 🛡️ SECURITY: ALSO CHECK TOKEN
    if (!socket.isAuth || !socket.decoded || socket.decoded.role !== "guru") {
      console.warn(`⚠️ Unauthorized Reset Attempt by ${socket.id}`);
      return;
    }

    if (passwordInput !== process.env.GURU_PASSWORD) {
      console.warn(
        `⚠️ Percobaan Reset Ilegal dari ${socket.id} (Password Salah)`,
      );
      return;
    }

    try {
      await prisma.score.deleteMany({});
      await prisma.user.updateMany({
        data: { coins: 0, totalScore: 0, inventory: ["default"] },
      });
      console.log("⚠️ SYSTEM RESET BY AUTHENTICATED ADMIN");
      if (io) io.emit("forceRefresh");
    } catch (e) {
      console.error("Gagal Reset:", e);
    }
  });
};
