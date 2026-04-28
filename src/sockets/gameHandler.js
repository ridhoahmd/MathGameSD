const prisma = require("../config/prisma");
const { askAI } = require("../services/aiService");
const { getFallbackData } = require("../config/fallbackData");
const logger = require("../utils/logger");
const { validateScore } = require("../utils/gameValidator");
const { logGameEvent, logGameStart, logGameEnd, logSuspiciousActivity } = require("../utils/gameLogger");

// In-memory store for active Tajwid versus game rooms
// Key: roomId (string), Value: { timer, timeLeft, p1SocketId, p2SocketId, p1Score, p2Score, p2Name, startedAt }
const gameRooms = new Map();

// --- STRATEGI PROMPT ---
// Versi simpel, idealnya dipisah kalau makin kompleks.
// Anggap ini strategi dasar.

module.exports = (socket, io) => {
  // LOAD STRATEGI PROMPT
  let PROMPT_STRATEGIES = {};
  try {
    const path = require("path");
    PROMPT_STRATEGIES = require(
      path.join(process.cwd(), "prompts", "gamePrompts"),
    );
  } catch (e) {
    // console.log("ℹ️ Pake Strategi Cadangan (gamePrompts ga ketemu)");
  }

  socket.on("mulaiGame", (kategori) => {
    socket.activeGameSession = {
      game: kategori,
      startTime: Date.now(),
    };
  });

  socket.on("mintaSoalAI", async (reqData) => {
    const { kategori, tingkat } = reqData || {};
    const levelRequest = tingkat || "sedang";

    let finalData = [];

    try {
      // 1. SETTING LEVEL DWI-BAHASA
      let levelAlt = levelRequest;
      if (levelRequest.toLowerCase() === "mudah") levelAlt = "Easy";
      else if (levelRequest.toLowerCase() === "sedang") levelAlt = "Medium";
      else if (levelRequest.toLowerCase() === "sulit") levelAlt = "Hard";

      // 2. QUERY DATABASE
      let questions = await prisma.gameQuestion.findMany({
        where: {
          AND: [
            { category: { equals: kategori, mode: "insensitive" } },
            {
              OR: [
                { level: { equals: levelRequest, mode: "insensitive" } },
                { level: { equals: levelAlt, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: { content: true }, // Ambil isinya aja biar irit
        take: 200,
      });

      // Logika Darurat buat Zuma kalo level spesifik kosong
      if ((!questions || questions.length === 0) && kategori === "zuma") {
        questions = await prisma.gameQuestion.findMany({
          where: { category: { equals: "zuma", mode: "insensitive" } },
          take: 50,
        });
      }

      // 3. PROSES DATA
      if (questions && questions.length > 0) {
        let rawContent = questions.map((q) => q.content);

        // --- KELOMPOK 1: CONFIG GAME (Zuma, Labirin, Piano) ---
        if (["zuma", "labirin", "piano"].includes(kategori)) {
          if (kategori === "piano" && (!questions || questions.length === 0)) {
            // Generate nada piano dinamis jika DB kosong
            const randomSeq = [];
            const len = 3 + Math.floor(Math.random() * 3); // 3-5 nada
            for (let i = 0; i < len; i++)
              randomSeq.push(Math.floor(Math.random() * 8) + 1);
            finalData = { sequence: randomSeq };
          } else if (rawContent.length > 0) {
            const randomIndex = Math.floor(Math.random() * rawContent.length);
            finalData = rawContent[randomIndex];
          }
        }
        // --- KELOMPOK 2: GAME TAJWID (PENGELOMPOKAN PINTAR) ---
        else if (kategori === "tajwid") {
          const refRow =
            rawContent[Math.floor(Math.random() * rawContent.length)];
          const matchingRows = rawContent.filter(
            (row) =>
              row.kategori_kiri === refRow.kategori_kiri &&
              row.kategori_kanan === refRow.kategori_kanan,
          );

          let poolSoal = [];
          matchingRows.forEach((row) => {
            if (row.data && Array.isArray(row.data)) {
              poolSoal.push(...row.data);
            }
          });

          poolSoal = poolSoal.sort(() => Math.random() - 0.5).slice(0, 10);

          finalData = {
            kategori_kiri: refRow.kategori_kiri,
            kategori_kanan: refRow.kategori_kanan,
            data: poolSoal,
          };
        }
        // --- KELOMPOK 3: KUIS BIASA ---
        else {
          let poolSoal = [];
          rawContent.forEach((item) => {
            if (item.data && Array.isArray(item.data))
              poolSoal.push(...item.data);
            else if (Array.isArray(item)) poolSoal.push(...item);
            else poolSoal.push(item);
          });

          finalData = poolSoal.sort(() => Math.random() - 0.5);
          if (kategori === "kasir") finalData = finalData.slice(0, 10);
          else finalData = finalData.slice(0, 20);

          if (finalData.length > 0 && finalData[0].opsi) {
            finalData = finalData.map((soal) => {
              let newSoal = JSON.parse(JSON.stringify(soal));
              if (Array.isArray(newSoal.opsi))
                newSoal.opsi.sort(() => Math.random() - 0.5);
              return newSoal;
            });
          }
        }
      }
    } catch (err) {
      logger.error(`❌ DB ERROR mintaSoalAI: ${err.message}`);
    }

    // 4. FALLBACK (CADANGAN)
    if (
      !finalData ||
      (Array.isArray(finalData) && finalData.length === 0) ||
      (kategori === "tajwid" && !finalData.data)
    ) {
      finalData = getFallbackData(kategori);

      // Fallback Piano Dinamis biar ga bosen
      if (kategori === "piano") {
        const randomSeq = [];
        const len = 4 + Math.floor(Math.random() * 4); // 4-8 nada
        for (let i = 0; i < len; i++)
          randomSeq.push(Math.floor(Math.random() * 8) + 1);
        finalData = { sequence: randomSeq };
      }

      if (kategori === "tajwid" && !finalData.data)
        finalData = getFallbackData("tajwid");
    }

    socket.emit("soalDariAI", { kategori, data: finalData });
  });

  // TUTOR AI
  socket.on("mintaPenjelasan", async (data) => {
    const cleanSoal = data.soal || "";
    const cleanJawabBenar = data.jawabanBenar || data.jawabBenar;
    const cleanJawabUser = data.jawabanUser || data.jawabUser;
    const gameType = data.game || data.kategori || "Umum";

    if (!cleanSoal || !cleanJawabBenar) return;

    try {
      let prompt;
      if (PROMPT_STRATEGIES && PROMPT_STRATEGIES.tutor) {
        prompt = PROMPT_STRATEGIES.tutor(
          cleanSoal,
          cleanJawabUser,
          cleanJawabBenar,
          gameType,
        );
      } else {
        prompt = `Jelaskan kenapa jawaban ${cleanJawabBenar} benar untuk soal ${cleanSoal}.`;
      }

      const penjelasanAI = await askAI(prompt);
      socket.emit("penjelasanTutor", {
        teks: penjelasanAI,
        penjelasan: penjelasanAI,
      });
    } catch (e) {
      logger.error(`❌ Tutor Error: ${e.message}`);
      const fallback = `Jawaban yang benar: ${cleanJawabBenar}. Tetap semangat!`;
      socket.emit("penjelasanTutor", { teks: fallback, penjelasan: fallback });
    }
  });

  // LOGIKA ROOM
  socket.on("joinRoom", (data) => {
    if (!data.room) return;
    socket.join(data.room);
    socket.to(data.room).emit("playerJoined", data.username);
  });

  socket.on("laporSkor", (data) => {
    if (data.room) socket.to(data.room).emit("updateSkorLawan", data.skor);
  });

  // LOGIKA MATH DUEL
  socket.on("joinMathDuel", async (data) => {
    const room = data.room;
    // Pake adapter.rooms.get biar kompatibel socket.io v3+
    const roomInstance = io.sockets.adapter.rooms.get(room);
    const playerCount = roomInstance ? roomInstance.size : 0;
    if (playerCount >= 2) {
      socket.emit("waitingForOpponent", "Room Penuh (Max 2).");
      return;
    }

    // Node itu single threaded, jadi aman langsung
    socket.join(room);

    if (playerCount === 0) {
      socket.emit("waitingForOpponent", "Menunggu pemain kedua...");
    } else {
      let soalDuel = getFallbackData("math");
      io.in(room).emit("startDuel", { soal: soalDuel });
    }
  });

  socket.on("updateScoreDuel", (data) => {
    socket.to(data.room).emit("opponentScoreUpdate", data.score);
  });

  // ─── TAJWID VERSUS: Server-Side Timer & Answer Validation ───────────────────

  /**
   * Client emits this when both players are ready to start a Tajwid versus game.
   * Payload: { roomId, p2Name, duration }
   *   roomId   – unique room identifier (e.g. socket.id of P1)
   *   p2Name   – display name of the local P2 player
   *   duration – game duration in seconds (default 60)
   */
  socket.on("startTajwidVersusGame", (data) => {
    const { roomId, p2Name, duration } = data || {};
    if (!roomId) return;

    // Clean up any existing room with the same id
    if (gameRooms.has(roomId)) {
      const existing = gameRooms.get(roomId);
      if (existing.timer) clearInterval(existing.timer);
      gameRooms.delete(roomId);
    }

    const totalSeconds = Math.min(Math.max(parseInt(duration, 10) || 60, 10), 120);

    const room = {
      p1SocketId: socket.id,
      p2Name: (p2Name || "Guest").trim().slice(0, 50),
      p1Score: 0,
      p2Score: 0,
      timeLeft: totalSeconds,
      startedAt: Date.now(),
      timer: null,
    };

    // Tick every second, broadcast remaining time to the initiating socket
    room.timer = setInterval(() => {
      room.timeLeft--;

      // Push authoritative time to the client
      socket.emit("tajwidTimerTick", { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0) {
        clearInterval(room.timer);
        room.timer = null;

        // Tell the client the game is over (server-authoritative end)
        socket.emit("tajwidGameEnded", {
          p1Score: room.p1Score,
          p2Score: room.p2Score,
          p2Name: room.p2Name,
          durationMs: Date.now() - room.startedAt,
        });

        logGameEvent("TAJWID_TIMER_EXPIRED", { roomId, p1Score: room.p1Score, p2Score: room.p2Score });
        gameRooms.delete(roomId);
      }
    }, 1000);

    gameRooms.set(roomId, room);

    const p1Name = socket.activeUser ? socket.activeUser.username : socket.id;
    logGameStart("tajwid", p1Name, room.p2Name, roomId);
    logGameEvent("TAJWID_GAME_STARTED", { roomId, duration: totalSeconds, p1: p1Name, p2: room.p2Name });
  });

  /**
   * Client emits this each time a player swipes a card.
   * Payload: { roomId, playerId, isCorrect, scoreDelta }
   *   playerId  – 1 (P1) or 2 (P2)
   *   isCorrect – boolean
   *   scoreDelta – points to add (positive) or subtract (negative, for penalty)
   */
  socket.on("submitTajwidAnswer", (data) => {
    const { roomId, playerId, isCorrect, scoreDelta } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.timer) return; // Game already ended

    const delta = parseInt(scoreDelta, 10);
    if (isNaN(delta)) return;

    // Clamp delta to prevent abuse: max +10 per correct, max -5 per wrong
    const clampedDelta = isCorrect
      ? Math.min(delta, 10)
      : Math.max(delta, -5);

    if (playerId === 1) {
      room.p1Score = Math.max(0, room.p1Score + clampedDelta);
    } else if (playerId === 2) {
      room.p2Score = Math.max(0, room.p2Score + clampedDelta);
    }

    logGameEvent("TAJWID_ANSWER", {
      roomId,
      playerId,
      isCorrect,
      delta: clampedDelta,
      p1Score: room.p1Score,
      p2Score: room.p2Score,
    });
  });

  /**
   * Client emits this when the game ends (either timer expired client-side or
   * the server already fired tajwidGameEnded). Used to persist the result.
   * Payload: { roomId, p1Score, p2Score, p2Name, durationMs }
   */
  socket.on("submitTajwidGameResult", async (data) => {
    const { roomId, p1Score, p2Score, p2Name, durationMs } = data || {};

    // If the room is still active, stop the server timer
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId);
      if (room.timer) clearInterval(room.timer);
      gameRooms.delete(roomId);
    }

    if (!socket.activeUser || !socket.activeUser.username) return;
    const safeName = socket.activeUser.username;

    // Validate score before persisting
    const scoreValidation = validateScore("tajwid", p1Score, { durationMs });
    let finalScore = scoreValidation.score;

    if (scoreValidation.reason) {
      logSuspiciousActivity("tajwid", safeName, scoreValidation.reason, {
        submittedScore: p1Score,
        cappedScore: finalScore,
        durationMs,
      });
      socket.emit("info", "Skor Anda disesuaikan dengan batas maksimum permainan.");
    }

    const status = finalScore > p2Score ? "Win" : finalScore < p2Score ? "Lose" : "Draw";
    const guestName = (p2Name || "Guest").trim().slice(0, 50);

    logGameEnd("tajwid", safeName, guestName, status, finalScore, { durationMs });

    try {
      let gameDb = await prisma.game.findUnique({ where: { slug: "tajwid" } });
      if (!gameDb) {
        gameDb = await prisma.game.create({
          data: { slug: "tajwid", title: "TAJWID" },
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { username: safeName } });
      if (!existingUser) {
        logger.warn(`⚠️ [Tajwid Versus] User not found: ${safeName}`);
        return;
      }

      // XP / coin rewards
      const XP_RATE = 1.1;
      let xpGained = Math.floor(finalScore * XP_RATE);
      let koin = Math.floor(finalScore / 10);
      if (status === "Win") { xpGained += 50; koin += 20; }

      const newTotalXP = existingUser.xp + xpGained;
      const newLevel = Math.floor(Math.sqrt(newTotalXP / 100));

      const updatedUser = await prisma.user.update({
        where: { username: safeName },
        data: {
          coins: { increment: koin },
          totalScore: { increment: finalScore },
          xp: newTotalXP,
          level: newLevel,
        },
      });

      await prisma.score.create({
        data: {
          score: finalScore,
          game: { connect: { id: gameDb.id } },
          user: { connect: { id: existingUser.id } },
        },
      });

      await prisma.versusMatch.create({
        data: {
          p1Score: finalScore,
          p2Name: guestName,
          status,
          game: { connect: { id: gameDb.id } },
          user: { connect: { id: existingUser.id } },
        },
      });

      logger.info(`✅ [Tajwid Versus] Match saved: ${safeName} vs ${guestName} | score=${finalScore} status=${status}`);

      socket.emit("skorTersimpan", {
        totalScore: updatedUser.totalScore,
        koin: updatedUser.coins,
        xp: updatedUser.xp,
        level: updatedUser.level,
        xpGained,
        isVersusWin: status === "Win",
      });

      if (io) io.emit("refreshDataGuru");
    } catch (err) {
      logger.error(`❌ DB Error Tajwid Versus: ${err.message}`);
      socket.emit("errorSkor", "Gagal menyimpan hasil permainan. Coba lagi.");
    }
  });

  // Clean up any active game room when the socket disconnects
  socket.on("disconnect", () => {
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.p1SocketId === socket.id) {
        if (room.timer) clearInterval(room.timer);
        gameRooms.delete(roomId);
        logGameEvent("TAJWID_ROOM_CLEANED_ON_DISCONNECT", { roomId, socketId: socket.id });
      }
    }
  });
};
