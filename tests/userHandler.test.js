// tests/userHandler.test.js
// Coverage target: userHandler.js – handlers beyond versus mode
// (simpanSkor, mintaLeaderboard, mintaDataProfil)

// ─── Mock: prisma ───────────────────────────────────────────────
jest.mock("../src/config/prisma", () => {
  // txMock dipakai oleh $transaction callback (BUG-04 fix: simpanSkor kini atomic)
  const txMock = {
    user: {
      findUnique: jest.fn(),
      upsert:     jest.fn(),
    },
    score: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  };

  return {
    // $transaction menjalankan callback dengan txMock sebagai argumen tx
    $transaction: jest.fn(async (cb) => cb(txMock)),
    _txMock: txMock, // expose agar test bisa configure per-skenario

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
      findMany:   jest.fn().mockResolvedValue([]),  // Dibutuhkan oleh mintaLeaderboard Q3
    },
    score: {
      create:     jest.fn().mockResolvedValue({ id: 1 }),
      deleteMany: jest.fn().mockResolvedValue({}),
      findMany:   jest.fn().mockResolvedValue([]),   // Dibutuhkan adminResetSystem (backup)
      groupBy:    jest.fn().mockResolvedValue([]),   // Dibutuhkan mintaLeaderboard Q2
    },
    versusMatch: {
      create:   jest.fn().mockResolvedValue(true),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
});

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
      // userHandler kini pakai upsert (bukan findUnique + create terpisah)
      prisma.user.upsert.mockResolvedValue(baseUserDb);
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("TestUser");
      expect(socket.emit).toHaveBeenCalledWith(
        "updateProfil",
        expect.objectContaining({ nama: "TestUser", koin: 200 })
      );
    });

    it("✅ harus membuat user baru jika belum ada di DB", async () => {
      // upsert menangani create & update sekaligus — kembalikan baseUserDb
      prisma.user.upsert.mockResolvedValue(baseUserDb);
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("UserBaru");
      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "updateProfil", expect.objectContaining({ nama: "TestUser" })
      );
    });

    it("✅ harus emit errorProfil jika DB error", async () => {
      // upsert reject → masuk catch → emit errorProfil
      prisma.user.upsert.mockRejectedValueOnce(new Error("DB Down"));
      const fn = getCallback(socket, "mintaDataProfil");
      await fn("TestUser");
      expect(socket.emit).toHaveBeenCalledWith(
        "errorProfil", expect.any(String)
      );
    });

    it("✅ harus return awal jika username kosong", async () => {
      const fn = getCallback(socket, "mintaDataProfil");
      await fn(""); // string kosong
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it("✅ harus accept data object {nama, foto}", async () => {
      prisma.user.upsert.mockResolvedValue(baseUserDb);
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
      // BUG-04 FIX: simpanSkor kini pakai $transaction → mock tx.user.findUnique & tx.user.upsert
      socket.activeGameSession = { game: "math", startTime: Date.now() - 60000 };
      prisma._txMock.user.findUnique.mockResolvedValueOnce({ xp: 300 });
      prisma._txMock.user.upsert.mockResolvedValueOnce({ ...baseUserDb, totalScore: 3000, coins: 510 });
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 99999 }); // jauh di atas max 3000
      expect(socket.emit).toHaveBeenCalledWith(
        "info", expect.stringContaining("maksimum")
      );
    });

    it("✅ harus simpan skor dan emit skorTersimpan jika valid", async () => {
      // BUG-04 FIX: mock $transaction path — tx.user.findUnique + tx.user.upsert + tx.score.create
      socket.activeGameSession = { game: "math", startTime: Date.now() - 30000 };
      prisma._txMock.user.findUnique.mockResolvedValueOnce({ xp: 300 });
      prisma._txMock.user.upsert.mockResolvedValueOnce({ ...baseUserDb, totalScore: 600, coins: 210 });
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 100 });
      expect(socket.emit).toHaveBeenCalledWith(
        "skorTersimpan", expect.objectContaining({ totalScore: 600 })
      );
      // score.create sekarang dipanggil di dalam tx, bukan di prisma langsung
      expect(prisma._txMock.score.create).toHaveBeenCalled();
    });

    it("✅ harus invalidate activeGameSession setelah skor tersimpan", async () => {
      // Verifikasi DB-ISU-1 FIX: session di-null setelah simpan sukses (anti-farming)
      socket.activeGameSession = { game: "math", startTime: Date.now() - 30000 };
      prisma._txMock.user.findUnique.mockResolvedValueOnce({ xp: 300 });
      prisma._txMock.user.upsert.mockResolvedValueOnce({ ...baseUserDb, totalScore: 600, coins: 210 });
      const fn = getCallback(socket, "simpanSkor");
      await fn({ nama: "TestUser", game: "math", skor: 100 });
      expect(socket.activeGameSession).toBeNull();
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
      // Implementasi baru: 3 query terpisah (findMany users → score.groupBy → game.findMany)
      // Q1: Top 50 users
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 1, username: "Andi", role: "siswa", totalScore: 800, coins: 80 }
      ]);
      // Q2: groupBy best score per user per game
      prisma.score.groupBy = jest.fn().mockResolvedValueOnce([
        { userId: 1, gameId: 10, _max: { score: 250 } }
      ]);
      // Q3: Game slugs lookup
      prisma.game.findMany.mockResolvedValueOnce([
        { id: 10, slug: "math" }
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

  // ─────────────────────────────────────────────────────────────
  // BUG-11 FIX: Test untuk adminResetSystem (sebelumnya 0% coverage)
  // Fungsi ini sangat berbahaya (hapus semua skor & reset koin) sehingga
  // wajib memiliki test yang komprehensif untuk semua jalur validasi.
  // ─────────────────────────────────────────────────────────────
  describe("adminResetSystem", () => {
    // Setup env password untuk test
    const RESET_PASSWORD = "rahasia-admin-123";

    beforeEach(() => {
      process.env.GURU_PASSWORD = RESET_PASSWORD;
    });

    it("❌ harus diam (tidak emit apa-apa) jika socket tidak terautentikasi", async () => {
      // isAuth = false → handler langsung return tanpa emit
      socket.isAuth = false;
      socket.decoded = null;
      const fn = getCallback(socket, "adminResetSystem");
      await fn({ password: RESET_PASSWORD });
      expect(socket.emit).not.toHaveBeenCalled();
      expect(prisma.score.deleteMany).not.toHaveBeenCalled();
    });

    it("❌ harus emit resetError jika role bukan admin (guru biasa)", async () => {
      // Guru tidak punya hak reset sistem
      socket.isAuth  = true;
      socket.decoded = { role: "guru", username: "BuAni" };
      const fn = getCallback(socket, "adminResetSystem");
      await fn({ password: RESET_PASSWORD });
      expect(socket.emit).toHaveBeenCalledWith(
        "resetError",
        expect.stringContaining("Hanya admin")
      );
      expect(prisma.score.deleteMany).not.toHaveBeenCalled();
    });

    it("❌ harus emit resetError jika password salah", async () => {
      socket.isAuth  = true;
      socket.decoded = { role: "admin", username: "SuperAdmin" };
      const fn = getCallback(socket, "adminResetSystem");
      await fn({ password: "password-yang-salah" });
      expect(socket.emit).toHaveBeenCalledWith(
        "resetError",
        expect.stringContaining("Password salah")
      );
      expect(prisma.score.deleteMany).not.toHaveBeenCalled();
    });

    it("✅ harus berhasil reset: hapus score, reset user, emit resetBerhasil", async () => {
      socket.isAuth  = true;
      socket.decoded = { role: "admin", username: "SuperAdmin" };

      // Mock backup reads — adminResetSystem memanggil user.findMany & score.findMany
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 1, username: "Andi", coins: 500, totalScore: 1000 }
      ]);
      prisma.score.findMany.mockResolvedValueOnce([
        { id: 1, userId: 1, gameId: 1, score: 200 }
      ]);
      prisma.score.deleteMany.mockResolvedValueOnce({ count: 5 });
      prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

      const fn = getCallback(socket, "adminResetSystem");
      await fn({ password: RESET_PASSWORD });

      // Harus hapus semua skor
      expect(prisma.score.deleteMany).toHaveBeenCalledWith({});

      // Harus reset semua user ke 0
      expect(prisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ coins: 0, totalScore: 0, xp: 0, level: 0 })
        })
      );

      // Harus emit resetBerhasil dengan metadata
      expect(socket.emit).toHaveBeenCalledWith(
        "resetBerhasil",
        expect.objectContaining({
          resetBy: "SuperAdmin",
          backup:  expect.stringContaining("backup_reset_"),
          message: expect.stringContaining("berhasil")
        })
      );
    });

    it("❌ harus emit resetError jika DB error saat reset", async () => {
      socket.isAuth  = true;
      socket.decoded = { role: "admin", username: "SuperAdmin" };

      // findMany untuk backup berhasil (user & score), tapi deleteMany gagal
      prisma.user.findMany.mockResolvedValueOnce([]);
      prisma.score.findMany.mockResolvedValueOnce([]);
      prisma.score.deleteMany.mockRejectedValueOnce(new Error("DB Connection Lost"));

      const fn = getCallback(socket, "adminResetSystem");
      await fn({ password: RESET_PASSWORD });

      expect(socket.emit).toHaveBeenCalledWith(
        "resetError",
        expect.stringContaining("Reset gagal")
      );
    });
  });
});
