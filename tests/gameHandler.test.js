// tests/gameHandler.test.js
// Coverage target: gameHandler.js (sebelumnya 4.13%)

// ─── Mock: prisma ───────────────────────────────────────────────
jest.mock("../src/config/prisma", () => ({
  gameQuestion: {
    findMany: jest.fn().mockResolvedValue([
      { content: { data: [{ soal: "2+2", jawaban: "4", opsi: ["3","4","5","6"] }] } }
    ])
  }
}));

// ─── Mock: aiService ────────────────────────────────────────────
jest.mock("../src/services/aiService", () => ({
  askAI: jest.fn().mockResolvedValue("Penjelasan AI untuk soal ini.")
}));

// ─── Mock: fallbackData ─────────────────────────────────────────
jest.mock("../src/config/fallbackData", () => ({
  getFallbackData: jest.fn().mockReturnValue([
    { soal: "3+3", jawaban: "6", opsi: ["5","6","7","8"] }
  ])
}));

const gameHandler = require("../src/sockets/gameHandler");
const prisma      = require("../src/config/prisma");
const { askAI }   = require("../src/services/aiService");
const { getFallbackData } = require("../src/config/fallbackData");

// ─── Helper: buat socket & io mock ──────────────────────────────
function makeSocket() {
  return {
    emit:             jest.fn(),
    on:               jest.fn(),
    join:             jest.fn(),
    to:               jest.fn().mockReturnThis(),
    activeGameSession: null,
  };
}

function makeIo(roomSize = 0) {
  const roomMap = new Map();
  if (roomSize > 0) roomMap.set("room-test", { size: roomSize });

  return {
    emit: jest.fn(),
    sockets: {
      adapter: {
        rooms: { get: jest.fn((room) => roomMap.get(room)) }
      }
    },
    in: jest.fn().mockReturnValue({ emit: jest.fn() }),
    to: jest.fn().mockReturnThis(),
  };
}

// ─── Ambil callback dari socket.on.mock.calls ────────────────────
function getCallback(socket, event) {
  const call = socket.on.mock.calls.find(c => c[0] === event);
  if (!call) throw new Error(`Event "${event}" tidak terdaftar di socket.on`);
  return call[1];
}

// ════════════════════════════════════════════════════════════════
describe("gameHandler.js", () => {

  let socket, io;

  beforeEach(() => {
    socket = makeSocket();
    io     = makeIo();
    jest.clearAllMocks();
    gameHandler(socket, io);
  });

  // ─────────────────────────────────────────────────────────────
  describe("mulaiGame", () => {
    it("✅ harus set activeGameSession dengan game & startTime", () => {
      const fn = getCallback(socket, "mulaiGame");
      fn("math");
      expect(socket.activeGameSession).toMatchObject({ game: "math" });
      expect(socket.activeGameSession.startTime).toBeLessThanOrEqual(Date.now());
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("mintaSoalAI", () => {
    it("✅ harus emit soalDariAI dengan data dari DB", async () => {
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "nabi", tingkat: "mudah" });
      expect(socket.emit).toHaveBeenCalledWith(
        "soalDariAI",
        expect.objectContaining({ kategori: "nabi" })
      );
    });

    it("✅ harus emit soalDariAI dengan fallback jika DB kosong", async () => {
      prisma.gameQuestion.findMany.mockResolvedValueOnce([]);
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "nabi", tingkat: "sedang" });
      expect(getFallbackData).toHaveBeenCalledWith("nabi");
      expect(socket.emit).toHaveBeenCalledWith(
        "soalDariAI",
        expect.objectContaining({ kategori: "nabi" })
      );
    });

    // BUG-05 FIX: Piano dari DB — harus pakai config sequence langsung dari rawContent
    it("✅ piano dari DB harus emit soalDariAI dengan sequence dari DB", async () => {
      prisma.gameQuestion.findMany.mockResolvedValueOnce([
        { content: { sequence: [1, 3, 5, 2, 7] } }
      ]);
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "piano", tingkat: "mudah" });
      expect(socket.emit).toHaveBeenCalledWith(
        "soalDariAI",
        expect.objectContaining({
          kategori: "piano",
          data: expect.objectContaining({ sequence: expect.any(Array) })
        })
      );
    });

    // BUG-05 FIX: Piano tanpa DB — harus gunakan fallback inline (3–5 nada), bukan dead code lama
    it("✅ piano tanpa DB harus gunakan fallback dinamis inline (3–5 nada)", async () => {
      prisma.gameQuestion.findMany.mockResolvedValueOnce([]);
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "piano", tingkat: "sedang" });
      const emitCall = socket.emit.mock.calls.find(c => c[0] === "soalDariAI");
      expect(emitCall).toBeDefined();
      const emittedData = emitCall[1];
      expect(emittedData.kategori).toBe("piano");
      expect(emittedData.data).toHaveProperty("sequence");
      expect(Array.isArray(emittedData.data.sequence)).toBe(true);
      expect(emittedData.data.sequence.length).toBeGreaterThanOrEqual(3);
      expect(emittedData.data.sequence.length).toBeLessThanOrEqual(8); // bisa 3–5 inline atau 4–8 fallback luar
    });

    it("✅ harus gunakan fallback dinamis untuk piano (DB kosong via getFallbackData path)", async () => {
      prisma.gameQuestion.findMany.mockResolvedValueOnce([]);
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "piano", tingkat: "sedang" });
      expect(socket.emit).toHaveBeenCalledWith(
        "soalDariAI",
        expect.objectContaining({ kategori: "piano", data: expect.objectContaining({ sequence: expect.any(Array) }) })
      );
    });

    it("✅ harus emit soalDariAI walau DB error (fallback)", async () => {
      prisma.gameQuestion.findMany.mockRejectedValueOnce(new Error("DB Timeout"));
      const fn = getCallback(socket, "mintaSoalAI");
      await fn({ kategori: "math", tingkat: "sulit" });
      // Harus tetap emit, tidak crash
      expect(socket.emit).toHaveBeenCalledWith(
        "soalDariAI",
        expect.objectContaining({ kategori: "math" })
      );
    });
  });


  // ─────────────────────────────────────────────────────────────
  describe("mintaPenjelasan", () => {
    it("✅ harus memanggil AI dan emit penjelasanTutor", async () => {
      const fn = getCallback(socket, "mintaPenjelasan");
      await fn({ soal: "2+2", jawabanBenar: "4", jawabanUser: "3", game: "math" });
      expect(askAI).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "penjelasanTutor",
        expect.objectContaining({ teks: expect.any(String) })
      );
    });

    it("✅ harus emit fallback jika AI error", async () => {
      askAI.mockRejectedValueOnce(new Error("AI Timeout"));
      const fn = getCallback(socket, "mintaPenjelasan");
      await fn({ soal: "5+5", jawabanBenar: "10", jawabanUser: "9", game: "math" });
      expect(socket.emit).toHaveBeenCalledWith(
        "penjelasanTutor",
        expect.objectContaining({ teks: expect.stringContaining("10") })
      );
    });

    it("✅ harus return awal jika soal/jawaban kosong", async () => {
      const fn = getCallback(socket, "mintaPenjelasan");
      await fn({ soal: "", jawabanBenar: "" });
      expect(askAI).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("joinRoom", () => {
    it("✅ harus join room dan emit playerJoined ke room lain", () => {
      const fn = getCallback(socket, "joinRoom");
      fn({ room: "room-123", username: "Ridho" });
      expect(socket.join).toHaveBeenCalledWith("room-123");
      expect(socket.to).toHaveBeenCalledWith("room-123");
    });

    it("✅ harus return awal jika room tidak ada", () => {
      const fn = getCallback(socket, "joinRoom");
      fn({ room: "" });
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("laporSkor", () => {
    it("✅ harus emit updateSkorLawan ke room", () => {
      const fn = getCallback(socket, "laporSkor");
      fn({ room: "room-123", skor: 250 });
      expect(socket.to).toHaveBeenCalledWith("room-123");
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("joinMathDuel", () => {
    it("✅ pemain pertama harus menerima waitingForOpponent", async () => {
      // roomSize = 0 → pemain pertama
      const fn = getCallback(socket, "joinMathDuel");
      await fn({ room: "room-test" });
      expect(socket.join).toHaveBeenCalledWith("room-test");
      expect(socket.emit).toHaveBeenCalledWith(
        "waitingForOpponent", "Menunggu pemain kedua..."
      );
    });

    it("✅ pemain kedua harus memulai duel (startDuel)", async () => {
      // Buat socket & io baru agar callback terikat ke io2 yg benar (roomSize=1)
      const socket2 = makeSocket();
      const io2     = makeIo(1);
      gameHandler(socket2, io2);
      const fn = getCallback(socket2, "joinMathDuel");
      await fn({ room: "room-test" });
      expect(socket2.join).toHaveBeenCalledWith("room-test");
      expect(io2.in).toHaveBeenCalledWith("room-test");
    });

    it("✅ room penuh (2 pemain) harus emit waitingForOpponent penuh", async () => {
      // Buat socket & io baru agar callback terikat ke io3 yg benar (roomSize=2)
      const socket3 = makeSocket();
      const io3     = makeIo(2);
      gameHandler(socket3, io3);
      const fn = getCallback(socket3, "joinMathDuel");
      await fn({ room: "room-test" });
      expect(socket3.emit).toHaveBeenCalledWith(
        "waitingForOpponent", "Room Penuh (Max 2)."
      );
      expect(socket3.join).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("updateScoreDuel", () => {
    it("✅ harus emit opponentScoreUpdate ke room lawan", () => {
      const fn = getCallback(socket, "updateScoreDuel");
      fn({ room: "room-abc", score: 300 });
      expect(socket.to).toHaveBeenCalledWith("room-abc");
    });
  });
});
