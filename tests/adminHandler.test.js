// tests/adminHandler.test.js
// Coverage target: adminHandler.js
// Events: simpanSoalManual, ubahPrioritasSoal, mintaAnalitikSiswa

// ─── Mock: prisma ───────────────────────────────────────────────
jest.mock("../src/config/prisma", () => ({
  gameQuestion: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  versusMatch: {
    findMany: jest.fn(),
  },
  score: {
    findMany: jest.fn(),
  },
}));

// ─── Mock: logger (biar test tidak flood console) ───────────────
jest.mock("../src/utils/logger", () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const adminHandler = require("../src/sockets/adminHandler");
const prisma       = require("../src/config/prisma");

// ─── Helper: buat socket mock ───────────────────────────────────
function makeSocket(overrides = {}) {
  return {
    id:       "test-socket-id",
    emit:     jest.fn(),
    on:       jest.fn(),
    isAuth:   false,
    decoded:  null,
    handshake: { address: "127.0.0.1" },
    ...overrides,
  };
}

// Guru socket yang sudah terautentikasi
function makeGuruSocket() {
  return makeSocket({
    isAuth:  true,
    decoded: { role: "guru", username: "Bu Ani" },
  });
}

// Admin socket yang sudah terautentikasi
function makeAdminSocket() {
  return makeSocket({
    isAuth:  true,
    decoded: { role: "admin", username: "SuperAdmin" },
  });
}

function getCallback(socket, event) {
  const call = socket.on.mock.calls.find((c) => c[0] === event);
  if (!call) throw new Error(`Event "${event}" tidak ditemukan di socket.on`);
  return call[1];
}

// ════════════════════════════════════════════════════════════════
describe("adminHandler.js", () => {
  let socket, ioMock;

  beforeEach(() => {
    ioMock = { emit: jest.fn() };
    jest.clearAllMocks();
    // Reset global state sebelum setiap test
    global.CONTENT_SOURCE_PRIORITY = "CACHE_FIRST";
  });

  // ══════════════════════════════════════════════════════════════
  // 1. simpanSoalManual
  // ══════════════════════════════════════════════════════════════
  describe("simpanSoalManual", () => {

    it("✅ harus simpan soal dan emit adminResponse sukses jika guru valid", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.gameQuestion.create.mockResolvedValue({ id: 1, category: "math", level: "Easy" });

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({
        kategori:  "math",
        level:     "mudah",
        kodeKelas: "IPA7A",
        soalData:  { soal: "2 + 2?", jawaban: "4" },
      });

      expect(prisma.gameQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category:  "math",
            level:     "Easy", // Harus ternormalisasi
            kodeKelas: "IPA7A",
          }),
        })
      );
      expect(ioMock.emit).toHaveBeenCalledWith(
        "soalBaruTersedia",
        expect.objectContaining({ game: "math" })
      );
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: true })
      );
    });

    it("✅ harus normalisasi level: sedang → Medium", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.gameQuestion.create.mockResolvedValue({ id: 2, level: "Medium" });

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ kategori: "zuma", level: "sedang", soalData: { data: [] } });

      expect(prisma.gameQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: "Medium" }),
        })
      );
    });

    it("✅ harus simpan kodeKelas sebagai null jika tidak dikirim (soal publik)", async () => {
      socket = makeAdminSocket();
      adminHandler(socket, ioMock);

      prisma.gameQuestion.create.mockResolvedValue({ id: 3 });

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ kategori: "nabi", level: "sulit", soalData: { data: [] } }); // tanpa kodeKelas

      expect(prisma.gameQuestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kodeKelas: null }),
        })
      );
    });

    it("❌ harus tolak dan emit adminResponse gagal jika socket tidak terautentikasi", async () => {
      socket = makeSocket(); // isAuth = false
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ kategori: "math", level: "mudah", soalData: {} });

      expect(prisma.gameQuestion.create).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false })
      );
    });

    it("❌ harus tolak jika role bukan guru/admin (siswa biasa)", async () => {
      socket = makeSocket({
        isAuth:  true,
        decoded: { role: "siswa", username: "Murid1" },
      });
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ kategori: "math", level: "mudah", soalData: {} });

      expect(prisma.gameQuestion.create).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false, message: expect.stringContaining("Ditolak") })
      );
    });

    it("❌ harus tolak jika data soal tidak lengkap (tanpa kategori)", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ level: "mudah", soalData: {} }); // tanpa kategori

      expect(prisma.gameQuestion.create).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false, message: expect.stringContaining("tidak lengkap") })
      );
    });

    it("❌ harus emit adminResponse gagal jika DB error", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.gameQuestion.create.mockRejectedValue(new Error("DB Connection Lost"));

      const fn = getCallback(socket, "simpanSoalManual");
      await fn({ kategori: "math", level: "mudah", soalData: { data: [] } });

      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false, message: expect.stringContaining("kesalahan server") })
      );
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 2. ubahPrioritasSoal
  // ══════════════════════════════════════════════════════════════
  describe("ubahPrioritasSoal", () => {

    it("✅ harus ubah global CONTENT_SOURCE_PRIORITY ke AI_ONLY", () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "ubahPrioritasSoal");
      fn("AI_ONLY");

      expect(global.CONTENT_SOURCE_PRIORITY).toBe("AI_ONLY");
      expect(ioMock.emit).toHaveBeenCalledWith("updatePrioritasMasaDepan", "AI_ONLY");
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: true })
      );
    });

    it("✅ harus ubah kembali ke CACHE_FIRST", () => {
      global.CONTENT_SOURCE_PRIORITY = "AI_ONLY"; // set dulu ke AI_ONLY
      socket = makeAdminSocket();
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "ubahPrioritasSoal");
      fn("CACHE_FIRST");

      expect(global.CONTENT_SOURCE_PRIORITY).toBe("CACHE_FIRST");
    });

    it("❌ harus tolak source yang tidak dikenali", () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "ubahPrioritasSoal");
      fn("INVALID_SOURCE");

      expect(global.CONTENT_SOURCE_PRIORITY).toBe("CACHE_FIRST"); // tidak berubah
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false, message: expect.stringContaining("tidak dikenali") })
      );
    });

    it("❌ harus tolak jika socket tidak terautentikasi", () => {
      socket = makeSocket(); // isAuth = false
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "ubahPrioritasSoal");
      fn("AI_ONLY");

      expect(global.CONTENT_SOURCE_PRIORITY).toBe("CACHE_FIRST"); // tidak berubah
      expect(socket.emit).toHaveBeenCalledWith(
        "adminResponse",
        expect.objectContaining({ success: false })
      );
    });
  });

  // ══════════════════════════════════════════════════════════════
  // 3. mintaAnalitikSiswa
  // ══════════════════════════════════════════════════════════════
  describe("mintaAnalitikSiswa", () => {

    const mockUser = { id: 42, xp: 800, coins: 150, level: 2 };

    it("✅ harus emit analitikSiswaData dengan data lengkap jika user ada", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.versusMatch.findMany.mockResolvedValue([
        {
          game: { title: "MATH" },
          p2Name: "Budi",
          status: "Win",
          p1Score: 300,
          playedAt: new Date("2026-04-01"),
        },
      ]);
      prisma.score.findMany.mockResolvedValue([
        { score: 200, game: { title: "MATH" } },
        { score: 150, game: { title: "ZUMA" } },
        { score: 250, game: { title: "MATH" } },
      ]);

      const fn = getCallback(socket, "mintaAnalitikSiswa");
      await fn("Andi");

      expect(socket.emit).toHaveBeenCalledWith(
        "analitikSiswaData",
        expect.objectContaining({
          success:          true,
          nama:             "Andi",
          xp:               800,
          frekuensiBermain: 3,
          rataRataSkor:     200, // (200+150+250)/3
          topikDominan:     "MATH", // MATH total 450 > ZUMA 150
          versus:           expect.arrayContaining([
            expect.objectContaining({ status: "Win", p2Name: "Budi" }),
          ]),
        })
      );
    });

    it("✅ harus emit success:false jika siswa tidak ditemukan di DB", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.user.findUnique.mockResolvedValue(null);

      const fn = getCallback(socket, "mintaAnalitikSiswa");
      await fn("UserTidakAda");

      expect(socket.emit).toHaveBeenCalledWith(
        "analitikSiswaData",
        expect.objectContaining({ success: false })
      );
    });

    it("✅ harus hitung rataRataSkor = 0 dan topikDominan = '-' jika belum pernah bermain", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.versusMatch.findMany.mockResolvedValue([]);
      prisma.score.findMany.mockResolvedValue([]); // Belum pernah main

      const fn = getCallback(socket, "mintaAnalitikSiswa");
      await fn("SiswaBaru");

      expect(socket.emit).toHaveBeenCalledWith(
        "analitikSiswaData",
        expect.objectContaining({
          success:          true,
          frekuensiBermain: 0,
          rataRataSkor:     0,
          topikDominan:     "-",
        })
      );
    });

    it("❌ harus return awal (tidak emit apa-apa) jika socket tidak terautentikasi", async () => {
      socket = makeSocket(); // isAuth = false
      adminHandler(socket, ioMock);

      const fn = getCallback(socket, "mintaAnalitikSiswa");
      await fn("Andi");

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it("❌ harus emit success:false jika DB error", async () => {
      socket = makeGuruSocket();
      adminHandler(socket, ioMock);

      prisma.user.findUnique.mockRejectedValue(new Error("Timeout"));

      const fn = getCallback(socket, "mintaAnalitikSiswa");
      await fn("Andi");

      expect(socket.emit).toHaveBeenCalledWith(
        "analitikSiswaData",
        expect.objectContaining({ success: false })
      );
    });
  });
});
