// tests/userHandler.test.js
// Coverage target: userHandler.js – handlers beyond versus mode
// (simpanSkor, mintaLeaderboard, mintaDataProfil)

// ─── Mock: prisma ───────────────────────────────────────────────
jest.mock("../src/config/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    update:     jest.fn(),
    upsert:     jest.fn(),
    create:     jest.fn(),
    updateMany: jest.fn(),
    findMany:   jest.fn(),
  },
  game: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, slug: "math", title: "MATH" }),
    create:     jest.fn().mockResolvedValue({ id: 1, slug: "math", title: "MATH" }),
  },
  score: {
    create:     jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
  versusMatch: {
    create:   jest.fn().mockResolvedValue(true),
    findMany: jest.fn().mockResolvedValue([]),
  },
}));

const userHandler = require("../src/sockets/userHandler");
const prisma      = require("../src/config/prisma");

// ─── Helper ─────────────────────────────────────────────────────
function makeSocket(overrides = {}) {
  return {
    id:           "socket-test-id",
    emit:         jest.fn(),
    on:           jest.fn(),
    isAuth:       false,
    decoded:      null,
    activeUser:   null,
    activeGameSession: null,
    handshake:    { address: "127.0.0.1" },
    ...overrides,
  };
}

function getCallback(socket, event) {
  const call = socket.on.mock.calls.find(c => c[0] === event);
  if (!call) throw new Error(`Event "${event}" tidak ditemukan di socket.on`);
  return call[1];
}

const baseUserDb = {
  id: 42, username: "TestUser", coins: 200, totalScore: 500,
  xp: 300, level: 1, role: "siswa",
  photoURL: null, equippedFrame: "default",
  activeTheme: "default", equippedBadge: null, inventory: ["default"],
};

// ════════════════════════════════════════════════════════════════
describe("userHandler.js — tambahan coverage", () => {

  let socket, ioMock;

  beforeEach(() => {
    socket  = makeSocket();
    ioMock  = { emit: jest.fn() };
    jest.clearAllMocks();
    userHandler(socket, ioMock);
  });

  // ─────────────────────────────────────────────────────────────
  describe("mintaDataProfil", () => {

    it("✅ harus emit updateProfil jika user ada di DB", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUserDb);
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("TestUser");
      expect(socket.emit).toHaveBeenCalledWith(
        "updateProfil",
        expect.objectContaining({ nama: "TestUser", koin: 200 })
      );
    });

    it("✅ harus membuat user baru jika belum ada di DB", async () => {
      // findUnique dipanggil 2x (cek + refetch). Pertama null, kedua null → create
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUserDb);
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("UserBaru");
      expect(prisma.user.create).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "updateProfil", expect.objectContaining({ nama: "TestUser" })
      );
    });

    it("✅ harus emit errorProfil jika DB error", async () => {
      prisma.user.findUnique.mockRejectedValueOnce(new Error("DB Down"));
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("TestUser");
      expect(socket.emit).toHaveBeenCalledWith(
        "errorProfil", expect.any(String)
      );
    });

    it("✅ harus return awal jika username kosong", async () => {
      const fn = getCallback(socket, "mintaDataProfil");
      await fn(""); // string kosong
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("✅ harus accept data object {nama, foto}", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUserDb);
      prisma.user.upsert = jest.fn().mockResolvedValue(baseUserDb);
      const fn = getCallback(socket, "mintaDataProfil");
      await fn({ nama: "TestUser", foto: "https://foto.example.com/avatar.png" });
      expect(socket.emit).toHaveBeenCalledWith(
        "updateProfil", expect.objectContaining({ nama: "TestUser" })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("simpanSkor", () => {

    it("✅ harus emit errorSkor jika tidak ada sesi aktif", async () => {
      socket.activeGameSession = null;
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 100 });
      expect(socket.emit).toHaveBeenCalledWith(
        "errorSkor", expect.any(String)
      );
    });

    it("✅ harus emit errorSkor jika game sesi tidak cocok", async () => {
      socket.activeGameSession = { game: "zuma", startTime: Date.now() - 20000 };
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 100 });
      expect(socket.emit).toHaveBeenCalledWith(
        "errorSkor", expect.any(String)
      );
    });

    it("✅ harus emit errorSkor jika skor terlalu cepat (speedhack)", async () => {
      socket.activeGameSession = { game: "math", startTime: Date.now() - 100 }; // baru 100ms
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 200 }); // >50 → trigger speedhack
      expect(socket.emit).toHaveBeenCalledWith(
        "errorSkor", expect.stringContaining("anomali")
      );
    });

    it("✅ harus cap skor melebihi MAX dan emit info", async () => {
      socket.activeGameSession = { game: "math", startTime: Date.now() - 60000 };
      prisma.user.findUnique.mockResolvedValue(baseUserDb);
      prisma.user.upsert.mockResolvedValue({ ...baseUserDb, totalScore: 3000, coins: 510 });
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 99999 }); // jauh di atas max 3000
      expect(socket.emit).toHaveBeenCalledWith(
        "info", expect.stringContaining("maksimum")
      );
    });

    it("✅ harus simpan skor dan emit skorTersimpan jika valid", async () => {
      socket.activeGameSession = { game: "math", startTime: Date.now() - 30000 };
      prisma.user.findUnique.mockResolvedValue(baseUserDb);
      prisma.user.upsert.mockResolvedValue({ ...baseUserDb, totalScore: 600, coins: 210 });
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 100 });
      expect(socket.emit).toHaveBeenCalledWith(
        "skorTersimpan", expect.objectContaining({ totalScore: 600 })
      );
      expect(prisma.score.create).toHaveBeenCalled();
    });

    it("✅ harus return awal jika data tidak lengkap (no nama/game)", async () => {
      const fn = getCallback(socket, "simpanSkor");
      await fn({ skor: 100 }); // tidak ada nama & game
      expect(prisma.game.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("mintaLeaderboard", () => {

    it("✅ harus emit updateLeaderboard dengan data terformat", async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        {
          username: "Andi", role: "siswa", totalScore: 800, coins: 80, xp: 400, level: 2,
          scores: [
            { score: 250, game: { slug: "math" } },
            { score: 100, game: { slug: "zuma" } }
          ]
        }
      ]);
      const fn = getCallback(socket, "mintaLeaderboard");
      await fn();
      expect(socket.emit).toHaveBeenCalledWith(
        "updateLeaderboard",
        expect.arrayContaining([
          expect.objectContaining({ nama: "Andi", skor: 800, math: 250 })
        ])
      );
    });

    it("✅ harus emit array kosong jika DB error", async () => {
      prisma.user.findMany.mockRejectedValueOnce(new Error("DB Error"));
      const fn = getCallback(socket, "mintaLeaderboard");
      await fn();
      expect(socket.emit).toHaveBeenCalledWith("updateLeaderboard", []);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("updateUserRole — validasi keamanan", () => {

    it("✅ harus tolak jika socket tidak terautentikasi", async () => {
      socket.isAuth = false;
      const fn = getCallback(socket, "updateUserRole");
      await fn({ targetUser: "Siswa1", newRole: "guru" });
      expect(socket.emit).toHaveBeenCalledWith("errorUpdate", expect.any(String));
    });

    it("✅ harus tolak jika role tidak valid", async () => {
      socket.isAuth = true;
      socket.decoded = { username: "Admin1", role: "admin" };
      const fn = getCallback(socket, "updateUserRole");
      await fn({ targetUser: "Siswa1", newRole: "superuser" }); // bukan valid role
      expect(socket.emit).toHaveBeenCalledWith("errorUpdate", expect.any(String));
    });

    it("✅ harus tolak jika edit diri sendiri", async () => {
      socket.isAuth  = true;
      socket.decoded = { username: "Admin1", role: "admin" };
      prisma.user.findUnique.mockResolvedValueOnce({ role: "admin", username: "Admin1" });
      const fn = getCallback(socket, "updateUserRole");
      await fn({ targetUser: "Admin1", newRole: "siswa" });
      expect(socket.emit).toHaveBeenCalledWith("errorUpdate", expect.stringContaining("sendiri"));
    });

    it("✅ harus berhasil update role jika semua validasi pass", async () => {
      socket.isAuth  = true;
      socket.decoded = { username: "Admin1", role: "admin" };
      prisma.user.findUnique.mockResolvedValueOnce({ role: "siswa", username: "Murid1" });
      prisma.user.update.mockResolvedValueOnce({ role: "guru" });
      const fn = getCallback(socket, "updateUserRole");
      await fn({ targetUser: "Murid1", newRole: "guru" });
      expect(socket.emit).toHaveBeenCalledWith(
        "roleUpdateSuccess", expect.objectContaining({ newRole: "guru" })
      );
    });
  });
});
