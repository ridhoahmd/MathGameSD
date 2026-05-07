const prisma = require("../config/prisma");
const { askAI } = require("../services/aiService");
const { getFallbackData } = require("../config/fallbackData");
const logger = require("../utils/logger");

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

  // FIX BUG-PROGRESS: Handler untuk auto-save checkpoint dari Tajwid, Nabi, Ayat.
  // Sebelumnya event ini di-emit frontend setiap 5 soal, tapi server tidak punya listener
  // sehingga toast "Progress Tersimpan" adalah bohong (silent fail).
  // Handler ini menyimpan snapshot progress sementara di socket session
  // dan mengirim ACK balik agar toast bermakna.
  socket.on("simpanProgress", (data) => {
    if (!data || !data.nama || !data.game) return;

    // Simpan snapshot progress di session socket (in-memory checkpoint)
    socket.lastProgress = {
      nama: data.nama,
      game: data.game,
      skor: parseInt(data.skor) || 0,
      soalDijawab: parseInt(data.soalDijawab) || 0,
      savedAt: Date.now(),
    };

    logger.info(
      `📊 [Progress Checkpoint] ${data.nama} | Game: ${data.game} | Skor: ${data.skor} | Soal: ${data.soalDijawab}`
    );

    // ACK balik ke client agar toast "Progress Tersimpan" bermakna
    socket.emit("progressTersimpan", {
      skor: socket.lastProgress.skor,
      soalDijawab: socket.lastProgress.soalDijawab,
    });
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
};
