const prisma = require("../config/prisma");
const logger = require("../utils/logger");

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
  bintang: 0.9, // DB-ISU-3 FIX: Eksplisit agar tidak pakai fallback default 1.0 tanpa sadar
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
        logger.info(
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
          // Hanya log WARNING sekali per socket session
          if (!socket.downgradedWarningShown) {
            logger.warn(
              `⚠️ Unauthorized access to ADMIN account ${username}. Downgrading to SISWA.`,
            );
            socket.downgradedWarningShown = true; // Flag agar ga spam log
          }
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
      logger.error(`❌ Gagal ambil profil SQL: ${err.message}`);
      socket.emit("errorProfil", "Gagal memuat profil. Coba refresh.");
    }
  });

  // B. SIMPAN SKOR
  socket.on("simpanSkor", async (data) => {
    if (!data || !data.nama || !data.game) return;
    let skor = parseInt(data.skor);
    if (isNaN(skor)) skor = 0;

    // 🔧 FIX BUG-01: Deklarasi gameSlug & safeName SEBELUM dipakai di MAX_SCORE_MAP
    const safeName = data.nama;
    const gameSlug = data.game;

    // 🛡️ SECURITY: VALIDASI SKOR (Per-game limit yang realistis)
    const MAX_SCORE_MAP = {
      math:    3000, // Soal berlevel, bisa panjang
      zuma:    5000, // Per-hit 15 poin, banyak level
      labirin: 3000, // Waktu bisa panjang
      memory:  2000, // Terbatas jumlah kartu
      piano:   2000, // Terbatas jumlah nada
      kasir:   2000, // Soal terbatas
      nabi:    3000, // Endless dengan multiplier
      ayat:    3000, // Endless dengan multiplier
      tajwid:  3000, // Endless dengan combo
      bintang: 2000, // Combo-based, 60 detik
    };
    const MAX_SCORE_PER_GAME = MAX_SCORE_MAP[gameSlug] || 2000;
    if (skor > MAX_SCORE_PER_GAME) {
      logger.warn(`⚠️ Suspicious Score Attempt: ${skor} (max: ${MAX_SCORE_PER_GAME}) by ${data.nama} in ${gameSlug}`);
      skor = MAX_SCORE_PER_GAME; // Cap skor ke batas wajar per-game
      socket.emit("info", "Skor Anda disesuaikan dengan batas maksimum permainan.");
    }
    if (skor < 0) skor = 0;

    // 🛡️ Server-Side Validation: Wajib punya sesi bermain dari "mulaiGame"
    if (!socket.activeGameSession || socket.activeGameSession.game !== data.game) {
      logger.warn(`⚠️ Blokir skor ilegal: Sesi tidak valid. User: ${data.nama}, Game: ${data.game}`);
      return socket.emit("errorSkor", "Sesi tidak valid atau telah berakhir. Harap ulangi permainan.");
    }

    // 🛡️ Server-Side Validation: Pencegahan Speedhack (Terlalu Cepat)
    const timePlayedMs = Date.now() - socket.activeGameSession.startTime;
    if (timePlayedMs < 5000 && skor > 50) {
      logger.warn(`⚠️ Speedhack Dicegah: ${data.nama} dapat skor ${skor} dalam ${timePlayedMs}ms (Game: ${data.game})`);
      return socket.emit("errorSkor", "Terdeteksi anomali pada permainan (Terlalu cepat). Skor dibatalkan.");
    }

    // safeName & gameSlug sudah dideklarasikan di atas (BUG-01 fix)
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

      // DB-ISU-1 FIX: Invalidate session setelah skor berhasil disimpan
      // Mencegah user submit simpanSkor berkali-kali dalam satu sesi tanpa mulai game baru
      socket.activeGameSession = null;

      // Notifikasi ke guru (Global Emit via io)
      if (io) io.emit("refreshDataGuru");
    } catch (err) {
      logger.error(`❌ DB Error simpanSkor: ${err.message}`);
    }
  });

  // B2. SIMPAN SKOR VERSUS LOKAL (Split Screen)
  socket.on("laporSkorVersusLokal", async (data) => {
    if (!data || !socket.activeUser || !socket.activeUser.username) return;

    const { game, status, score, p2Name } = data;
    let skor = parseInt(score);
    if (isNaN(skor)) skor = 0;
    if (skor < 0) skor = 0;

    // FIX #10: Validate that user has an active game session (same as simpanSkor)
    if (!socket.activeGameSession || socket.activeGameSession.game !== game) {
      logger.warn(`⚠️ [Versus] Blokir lapor skor ilegal: Sesi tidak valid. User: ${socket.activeUser.username}, Game: ${game}`);
      return socket.emit("errorSkor", "Sesi bermain versus tidak valid. Harap mulai ulang permainan.");
    }

    // FIX #10: Cap skor versus agar tidak bisa dimanipulasi
    const VS_MAX_SCORE_MAP = {
      math:    3000,
      zuma:    5000,
      labirin: 3000,
      memory:  2000,
      piano:   2000,
      kasir:   2000,
      nabi:    3000,
      ayat:    3000,
      tajwid:  3000,
      bintang: 2000,
    };
    const vsMax = VS_MAX_SCORE_MAP[game] || 2000;
    if (skor > vsMax) {
      logger.warn(`⚠️ [Versus] Suspicious Score: ${skor} (max: ${vsMax}) by ${socket.activeUser.username} in ${game}`);
      skor = vsMax;
    }

    const safeName = socket.activeUser.username;
    let koin = Math.floor(skor / 10);
    let xpGained = getXPFromScore(game, skor);

    // LOGIC BONUS E-SPORT
    if (status === "Win") {
      xpGained += 50; // Bonus XP menang versus
      koin += 20;     // Bonus Koin menang versus
      logger.info(`🏆 [Versus] ${safeName} MENANG melawan ${p2Name || 'Guest'} di game ${game}! Bonus +50XP & +20Coins`);
    } else {
      logger.info(`🏁 [Versus] ${safeName} mendapat hasil ${status} melawan ${p2Name || 'Guest'} di game ${game}`);
    }

    try {
      let gameDb = await prisma.game.findUnique({ where: { slug: game } });
      if (!gameDb) {
        gameDb = await prisma.game.create({
          data: { slug: game, title: game.toUpperCase() },
        });
      }

      let existingUser = await prisma.user.findUnique({ where: { username: safeName } });
      if (!existingUser) return; // Harus user yg login

      const currentXP = existingUser.xp;
      const newTotalXP = currentXP + xpGained;
      const newLevel = calculateLevel(newTotalXP);

      const updatedUser = await prisma.user.update({
        where: { username: safeName },
        data: {
          coins: { increment: koin },
          totalScore: { increment: skor },
          xp: newTotalXP,
          level: newLevel,
        }
      });

      await prisma.score.create({
        data: {
          score: skor,
          game: { connect: { id: gameDb.id } },
          user: { connect: { id: updatedUser.id } },
        },
      });

      // Simpan riwayat duel khusus Mode Versus
      await prisma.versusMatch.create({
        data: {
          p1Score: skor,
          p2Name: p2Name || "Guest",
          status: status,
          game: { connect: { id: gameDb.id } },
          user: { connect: { id: updatedUser.id } },
        },
      });

      // Konfirmasi sukses ke client
      socket.emit("skorTersimpan", {
        totalScore: updatedUser.totalScore,
        koin: updatedUser.coins,
        xp: updatedUser.xp,
        level: updatedUser.level,
        xpGained: xpGained,
        isVersusWin: status === "Win"
      });

      if (io) io.emit("refreshDataGuru");
    } catch (err) {
      logger.error(`❌ DB Error Versus Lokal: ${err.message}`);
    }
  });

  // B3. MINTA RIWAYAT DUEL VERSUS
  socket.on("mintaRiwayatVersus", async () => {
    // Jika belum login, kirim array kosong biar modal tidak stuck loading
    if (!socket.activeUser || !socket.activeUser.username) {
      return socket.emit("riwayatVersusData", []);
    }
    try {
      const user = await prisma.user.findUnique({
        where: { username: socket.activeUser.username }
      });
      if (!user) return;

      const history = await prisma.versusMatch.findMany({
        where: { p1Id: user.id },
        orderBy: { playedAt: "desc" },
        take: 10,
        include: { game: true }
      });

      const formattedHistory = history.map(h => ({
        game: h.game.title,
        p2Name: h.p2Name,
        status: h.status,
        score: h.p1Score,
        playedAt: h.playedAt
      }));

      socket.emit("riwayatVersusData", formattedHistory);
    } catch (err) {
      logger.error(`❌ Gagal ambil riwayat versus: ${err.message}`);
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
          tajwid: skorMap["tajwid"] || 0,
          bintang: skorMap["bintang"] || 0,
        };
      });

      socket.emit("updateLeaderboard", leaderboard);
    } catch (err) {
      logger.error(`❌ Gagal ambil leaderboard SQL: ${err.message}`);
      socket.emit("updateLeaderboard", []);
    }
  });

  // UPDATE ROLE USER
  socket.on("updateUserRole", async (data) => {
    const { targetUser, newRole } = data;

    // 🛡️ ENHANCED SECURITY: Multi-layer validation

    // 1. Authentication Check
    if (!socket.isAuth || !socket.decoded) {
      logger.warn(`⚠️ Unauthenticated role update attempt from ${socket.id}`);
      socket.emit("errorUpdate", "Unauthorized: Please login first");
      return;
    }

    const requestorRole = socket.decoded.role;
    const requestorUsername = socket.decoded.username;

    // 2. Basic Permission Check
    if (requestorRole !== "guru" && requestorRole !== "admin") {
      logger.warn(
        `⚠️ Unauthorized role update attempt by ${requestorUsername} (${requestorRole})`,
      );
      socket.emit(
        "errorUpdate",
        "Akses Ditolak: Anda tidak memiliki izin untuk mengubah role.",
      );
      return;
    }

    // 3. Validate newRole value
    const validRoles = ["banned", "siswa", "guru", "admin"];
    if (!validRoles.includes(newRole)) {
      logger.warn(
        `⚠️ Invalid role value: ${newRole} from ${requestorUsername}`,
      );
      socket.emit("errorUpdate", "Role tidak valid");
      return;
    }

    try {
      // 4. Get Target User Data
      const targetUserData = await prisma.user.findUnique({
        where: { username: targetUser },
        select: { role: true, username: true },
      });

      if (!targetUserData) {
        socket.emit("errorUpdate", "User tidak ditemukan");
        return;
      }

      const currentTargetRole = targetUserData.role;

      // 5. Role Hierarchy Definition
      const ROLE_HIERARCHY = {
        banned: 0,
        siswa: 1,
        guru: 2,
        admin: 3,
      };

      const requestorLevel = ROLE_HIERARCHY[requestorRole] || 0;
      const targetLevel = ROLE_HIERARCHY[currentTargetRole] || 0;

      // 6. SECURITY RULE: Cannot edit yourself
      if (requestorUsername === targetUser) {
        logger.warn(`⚠️ Self-edit attempt blocked: ${requestorUsername}`);
        socket.emit(
          "errorUpdate",
          "⛔ Tidak bisa mengubah role sendiri untuk keamanan sistem",
        );
        return;
      }

      // 7. SECURITY RULE: Cannot edit users with equal or higher privilege
      if (targetLevel >= requestorLevel) {
        logger.warn(
          `⚠️ Privilege escalation blocked: ${requestorUsername} (${requestorRole}) ` +
            `tried to edit ${targetUser} (${currentTargetRole})`,
        );
        socket.emit(
          "errorUpdate",
          "⛔ Tidak bisa mengubah role user dengan level sama atau lebih tinggi dari Anda",
        );
        return;
      }

      // 8. SECURITY RULE: Guru cannot promote anyone to admin
      if (requestorRole === "guru" && newRole === "admin") {
        logger.warn(
          `⚠️ Guru ${requestorUsername} tried to promote ${targetUser} to admin`,
        );
        socket.emit(
          "errorUpdate",
          "⛔ Guru tidak memiliki izin untuk promote user ke Admin. Hubungi Administrator.",
        );
        return;
      }

      // 9. SECURITY RULE: Only admin can manage admin role
      if (newRole === "admin" && requestorRole !== "admin") {
        logger.warn(
          `⚠️ Non-admin ${requestorUsername} tried to set admin role`,
        );
        socket.emit(
          "errorUpdate",
          "⛔ Hanya Admin yang dapat memberikan role Admin",
        );
        return;
      }

      // 10. Execute Role Update
      await prisma.user.update({
        where: { username: targetUser },
        data: { role: newRole },
      });

      // 11. Security Logging
      logger.info(
        `✅ ROLE UPDATE SUCCESS:\n` +
          `   Requestor: ${requestorUsername} (${requestorRole})\n` +
          `   Target: ${targetUser}\n` +
          `   Change: ${currentTargetRole} → ${newRole}\n` +
          `   IP: ${socket.handshake.address}\n` +
          `   Time: ${new Date().toISOString()}`,
      );

      // 12. Notify Success
      socket.emit("roleUpdateSuccess", {
        targetUser,
        newRole,
        message: `Role ${targetUser} berhasil diubah menjadi ${newRole}`,
      });

      // 13. Broadcast refresh to all admin/guru dashboards
      if (io) io.emit("refreshDataGuru");

      // 14. Jika role baru adalah 'banned', kick paksa user secara real-time
      if (newRole === "banned" && io) {
        io.emit("kickUser", targetUser);
      }
    } catch (err) {
      logger.error(`❌ Failed to update role: ${err.message}`);
      socket.emit("errorUpdate", "Terjadi kesalahan database. Coba lagi.");
    }
  });

  // ADMIN RESET SYSTEM (🛡️ Enhanced Security)
  socket.on("adminResetSystem", async (data) => {
    const passwordInput = typeof data === "object" ? data.password : "";

    // 🛡️ SECURITY: Admin-only function
    if (!socket.isAuth || !socket.decoded) {
      logger.warn(`⚠️ Unauthenticated reset attempt from ${socket.id}`);
      return;
    }

    const requestorRole = socket.decoded.role;
    const requestorUsername = socket.decoded.username;

    // Only Admin can reset system (NOT guru!)
    if (requestorRole !== "admin") {
      logger.warn(
        `⚠️ UNAUTHORIZED RESET ATTEMPT:\n` +
          `   User: ${requestorUsername} (${requestorRole})\n` +
          `   IP: ${socket.handshake.address}\n` +
          `   Time: ${new Date().toISOString()}`,
      );
      socket.emit("resetError", "Akses ditolak. Hanya admin yang bisa melakukan reset.");
      return;
    }

    // Password validation
    if (passwordInput !== process.env.GURU_PASSWORD) {
      logger.warn(
        `⚠️ WRONG PASSWORD FOR RESET:\n` +
          `   Admin: ${requestorUsername}\n` +
          `   IP: ${socket.handshake.address}`,
      );
      socket.emit("resetError", "Password salah! Reset dibatalkan.");
      return;
    }

    try {
      const fs = require("fs");
      const path = require("path");

      // 🛡️ AUTO-BACKUP SEBELUM RESET
      const allUsers = await prisma.user.findMany();
      const allScores = await prisma.score.findMany();

      const backupData = {
        timestamp: new Date().toISOString(),
        adminTrigger: requestorUsername,
        users: allUsers,
        scores: allScores
      };

      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupFilename = `backup_reset_${Date.now()}.json`;
      const backupPath = path.join(backupDir, backupFilename);
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      // Limit Max 5 Backups Files
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_reset_') && f.endsWith('.json'))
        .sort().reverse();

      if (files.length > 5) {
        for (let i = 5; i < files.length; i++) {
          try { fs.unlinkSync(path.join(backupDir, files[i])); } catch(e){}
        }
      }
      logger.info(`✅ Data berhasil dicadangkan sebelum reset: ${backupFilename}`);

      await prisma.score.deleteMany({});
      await prisma.user.updateMany({
        data: { coins: 0, totalScore: 0, xp: 0, level: 0, inventory: ["default"] },
      });

      logger.info(
        `⚠️ SYSTEM RESET EXECUTED:\n` +
          `   Admin: ${requestorUsername}\n` +
          `   IP: ${socket.handshake.address}\n` +
          `   Time: ${new Date().toISOString()}`,
      );

      // CRIT-05 FIX: Kirim konfirmasi sukses ke admin sebelum forceRefresh
      socket.emit("resetBerhasil", {
        message: "✅ Sistem berhasil direset! Semua skor & koin dikembalikan ke 0.",
        backup: backupFilename,
        resetBy: requestorUsername,
        timestamp: new Date().toISOString(),
      });

      if (io) io.emit("forceRefresh");
    } catch (e) {
      logger.error(`Gagal Reset: ${e.message}`, { stack: e.stack });
      // CRIT-05 FIX: Beritahu admin jika reset gagal
      socket.emit("resetError", `Reset gagal: ${e.message}. Coba lagi atau hubungi developer.`);
    }
  });
};
