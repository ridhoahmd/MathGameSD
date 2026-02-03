const prisma = require("../config/prisma");
const { askAI } = require("../services/aiService");
const { getFallbackData } = require("../config/fallbackData");

// --- PROMPT STRATEGIES (MOVED FROM LOCAL REQUIRE) ---
// Simplified version, ideally this should be imported if complex
// But for now we will assume basic prompt strategy or move it to a service if it grows.
// For now, I will keep the fallback logic within the handler as it was in server.js but cleaner.

module.exports = (socket, io) => {
  // PROMPT STRATEGY LOADING
  let PROMPT_STRATEGIES = {};
  try {
    // Assuming existing prompts folder is still at root, need to adjust path relative to this file
    // server.js was at root, src/sockets/gameHandler.js is 2 levels deep
    const path = require("path");
    PROMPT_STRATEGIES = require(
      path.join(process.cwd(), "prompts", "gamePrompts"),
    );
  } catch (e) {
    // console.log("ℹ️ Menggunakan Fallback Strategy (gamePrompts tidak ditemukan)");
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
      // 1. SETUP LEVEL DWI-BAHASA
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
        select: { content: true }, // Optimization: Only fetch JSON content
        take: 200,
      });

      // Logika Darurat jika level spesifik kosong
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
            // Generate dynamic piano sequence if DB is empty
            const randomSeq = [];
            const len = 3 + Math.floor(Math.random() * 3); // 3-5 notes
            for (let i = 0; i < len; i++)
              randomSeq.push(Math.floor(Math.random() * 8) + 1);
            finalData = { sequence: randomSeq };
          } else if (rawContent.length > 0) {
            const randomIndex = Math.floor(Math.random() * rawContent.length);
            finalData = rawContent[randomIndex];
          }
        }
        // --- KELOMPOK 2: GAME TAJWID (SMART GROUPING) ---
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
      console.error("❌ DB ERROR:", err.message);
    }

    // 4. FALLBACK
    if (
      !finalData ||
      (Array.isArray(finalData) && finalData.length === 0) ||
      (kategori === "tajwid" && !finalData.data)
    ) {
      finalData = getFallbackData(kategori);

      // Special Dynamic Fallback for Piano if static fallback is too boring
      if (kategori === "piano") {
        const randomSeq = [];
        const len = 4 + Math.floor(Math.random() * 4); // 4-8 notes
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
      console.error("❌ Tutor Error:", e.message);
      const fallback = `Jawaban yang benar: ${cleanJawabBenar}. Tetap semangat!`;
      socket.emit("penjelasanTutor", { teks: fallback, penjelasan: fallback });
    }
  });

  // ROOM LOGIC
  socket.on("joinRoom", (data) => {
    if (!data.room) return;
    socket.join(data.room);
    socket.to(data.room).emit("playerJoined", data.username);
  });

  socket.on("laporSkor", (data) => {
    if (data.room) socket.to(data.room).emit("updateSkorLawan", data.skor);
  });

  // MATH DUEL LOGIC
  socket.on("joinMathDuel", async (data) => {
    const room = data.room;
    // NOTE: In socket.io v3+, access to rooms is different, but for compatibility
    // we use io.sockets.adapter.rooms.get(room) which returns a Set
    const roomInstance = io.sockets.adapter.rooms.get(room);
    const playerCount = roomInstance ? roomInstance.size : 0;
    if (playerCount >= 2) {
      socket.emit("waitingForOpponent", "Room Penuh (Max 2).");
      return;
    }

    // Double check after small delay to reduce race if necessary,
    // but Node is single threaded, so synchronous check is usually fine.
    // We will just proceed.

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
};
