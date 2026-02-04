const prisma = require("../config/prisma");

// Rate pengali XP per game (sama kayak di frontend)
const XP_RATES = {
  math: 1.0,
  zuma: 0.8,
  labirin: 1.2,
  memory: 1.1,
  piano: 1.0,
  kasir: 0.9,
  nabi: 1.0,
  ayat: 1.0,
  tajwid: 1.1,
};

// Hitung XP dari skor
function getXPFromScore(game, score) {
  const rate = XP_RATES[game] || 1.0;
  return Math.floor(score * rate);
}

// Hitung level dari XP (Rumus: Level = floor(sqrt(XP / 100)))
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

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
    // 1. Jika user coba akses profil 'admin' atau 'guru', WAJIB punya token valid.
    // 2. Jika user punya token, paksa username sesuai token.
    if (socket.isAuth && socket.decoded) {
      if (socket.decoded.role === "guru" || socket.decoded.role === "admin") {
        // Log akses authenticated
        console.log(
          `✅ Authenticated ${socket.decoded.role} accessing profile: ${username}`,
        );
      }
    }

    try {
      // Cek DB dulu
      let user = await prisma.user.findUnique({
        where: { username: username },
      });

      // 🚨 CEGAH PENYAMARAN (SOFT CHECK)
      // Jika user di DB adalah admin/guru tapi socket ga punya token sah:
      // JANGAN BLOKIR total, tapi TURUNKAN ke 'siswa' biar tetep bisa main.
      let effectiveRole = user ? user.role : "siswa";

      if (user && (user.role === "admin" || user.role === "guru")) {
        if (
          !socket.isAuth ||
          (socket.decoded && socket.decoded.role !== "guru")
        ) {
          console.warn(
            `⚠️ Unauthorized access to ADMIN account ${username}. Downgrading to SISWA.`,
          );
          // Paksa jadi siswa sesi ini
          effectiveRole = "siswa";
        }
      }

      socket.activeUser = {
        username: username,
        role: effectiveRole,
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

      // Refetch biar yakin
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
        xp: user.xp || 0,
        level: user.level || 0,
        role: user.role,
        foto: finalFoto,
        frame: user.equippedFrame || "default",
        theme: user.activeTheme || "default",
        badge: user.equippedBadge || null,
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
    const MAX_SCORE_PER_GAME = 1000; // Contoh batas wajar
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
    const xpGained = getXPFromScore(gameSlug, skor);

    try {
      let gameDb = await prisma.game.findUnique({ where: { slug: gameSlug } });
      if (!gameDb) {
        gameDb = await prisma.game.create({
          data: { slug: gameSlug, title: gameSlug.toUpperCase() },
        });
      }

      // Hitung XP dan level baru
      let existingUser = await prisma.user.findUnique({
        where: { username: safeName },
      });
      const currentXP = existingUser ? existingUser.xp : 0;
      const newTotalXP = currentXP + xpGained;
      const newLevel = calculateLevel(newTotalXP);

      const updatedUser = await prisma.user.upsert({
        where: { username: safeName },
        update: {
          coins: { increment: koin },
          totalScore: { increment: skor },
          xp: newTotalXP,
          level: newLevel,
        },
        create: {
          username: safeName,
          role: "siswa",
          coins: koin,
          totalScore: skor,
          xp: xpGained,
          level: calculateLevel(xpGained),
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

      // Konfirmasi sukses ke client
      socket.emit("skorTersimpan", {
        totalScore: updatedUser.totalScore,
        koin: updatedUser.coins,
        xp: updatedUser.xp,
        level: updatedUser.level,
        xpGained: xpGained,
      });

      // Notifikasi ke guru (Global Emit via io)
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

    // 🛡️ SECURITY: CEK OTORITAS KETAT
    if (!socket.isAuth || !socket.decoded || socket.decoded.role !== "guru") {
      console.warn(`⚠️ Percobaan Update Role Ilegal oleh ${socket.id}`);
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

    // 🛡️ SECURITY: CEK TOKEN JUGA
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
      console.log("⚠️ SYSTEM RESET OLEH ADMIN TERVALIDASI");
      if (io) io.emit("forceRefresh");
    } catch (e) {
      console.error("Gagal Reset:", e);
    }
  });
};
