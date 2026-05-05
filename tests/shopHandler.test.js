// tests/shopHandler.test.js
// Coverage target: shopHandler.js (sebelumnya 5.4%)

// ─── Mock: prisma ───────────────────────────────────────────────
jest.mock("../src/config/prisma", () => {
  const txMock = {
    user: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    }
  };

  return {
    $transaction: jest.fn(async (cb) => cb(txMock)),
    _txMock: txMock,              // expose for per-test config
    user: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    }
  };
});

const shopHandler = require("../src/sockets/shopHandler");
const prisma      = require("../src/config/prisma");

// ─── Helper ─────────────────────────────────────────────────────
function makeSocket(overrides = {}) {
  return {
    emit:       jest.fn(),
    on:         jest.fn(),
    activeUser: { username: "TestUser" },
    ...overrides,
  };
}

function getCallback(socket, event) {
  const call = socket.on.mock.calls.find(c => c[0] === event);
  if (!call) throw new Error(`Event "${event}" tidak terdaftar`);
  return call[1];
}

// ════════════════════════════════════════════════════════════════
describe("shopHandler.js", () => {

  let socket, ioMock;

  beforeEach(() => {
    socket  = makeSocket();
    ioMock  = { emit: jest.fn() };
    jest.clearAllMocks();
    shopHandler(socket, ioMock);
  });

  // ─────────────────────────────────────────────────────────────
  describe("beliItem", () => {

    it("✅ harus emit transaksiGagal jika user belum login", async () => {
      const noAuthSocket = makeSocket({ activeUser: null });
      shopHandler(noAuthSocket, ioMock);
      const fn = getCallback(noAuthSocket, "beliItem");
      await fn({ itemId: "neon" });
      expect(noAuthSocket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Anda harus login terlebih dahulu."
      );
    });

    it("✅ harus emit transaksiGagal jika itemId tidak valid", async () => {
      const fn = getCallback(socket, "beliItem");
      await fn({ itemId: "item_tidak_ada_di_katalog" });
      expect(socket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Item tidak valid/dijual."
      );
    });

    it("✅ harus berhasil membeli item jika saldo cukup & belum punya", async () => {
      // Setup transaction mock: user punya koin cukup, belum punya item
      prisma._txMock.user.findUnique.mockResolvedValueOnce({
        id: 1, username: "TestUser", coins: 1000, inventory: ["default"]
      });
      prisma._txMock.user.update.mockResolvedValueOnce({
        id: 1, username: "TestUser", coins: 500, inventory: ["default", "neon"],
        totalScore: 0, role: "siswa", photoURL: null,
        equippedFrame: "default", activeTheme: "default"
      });

      const fn = getCallback(socket, "beliItem");
      await fn({ itemId: "neon" }); // harga neon = 500

      expect(socket.emit).toHaveBeenCalledWith(
        "transaksiSukses",
        expect.objectContaining({ itemId: "neon", sisaKoin: 500 })
      );
    });

    it("✅ harus emit transaksiGagal jika koin tidak cukup", async () => {
      prisma._txMock.user.findUnique.mockResolvedValueOnce({
        id: 1, username: "TestUser", coins: 100, inventory: ["default"]
      });
      // Simulasikan $transaction melempar error INSUFFICIENT_COINS
      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const fakeTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1, coins: 100, inventory: ["default"]
            }),
            update: jest.fn()
          }
        };
        // Jalankan callback — akan throw karena coins < harga
        return cb(fakeTx);
      });

      const fn = getCallback(socket, "beliItem");
      await fn({ itemId: "neon" }); // butuh 500, punya 100
      expect(socket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Maaf, Koin tidak cukup! 🪙"
      );
    });

    it("✅ harus emit transaksiGagal jika item sudah dimiliki", async () => {
      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const fakeTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1, coins: 5000, inventory: ["default", "neon"]
            }),
            update: jest.fn()
          }
        };
        return cb(fakeTx);
      });

      const fn = getCallback(socket, "beliItem");
      await fn({ itemId: "neon" }); // sudah ada di inventory
      expect(socket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Kamu sudah punya barang ini! ✅"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("pakaiItem", () => {

    it("✅ harus emit transaksiGagal jika user belum login", async () => {
      const noAuthSocket = makeSocket({ activeUser: null });
      shopHandler(noAuthSocket, ioMock);
      const fn = getCallback(noAuthSocket, "pakaiItem");
      await fn({ tipe: "frame", itemId: "neon" });
      expect(noAuthSocket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Anda harus login terlebih dahulu."
      );
    });

    it("✅ harus emit transaksiGagal jika item belum dimiliki", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: ["default"] // belum punya neon
      });
      const fn = getCallback(socket, "pakaiItem");
      await fn({ tipe: "frame", itemId: "neon" });
      expect(socket.emit).toHaveBeenCalledWith(
        "transaksiGagal", "Kamu belum memiliki item ini!"
      );
    });

    it("✅ harus berhasil equip frame yang sudah dimiliki", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: ["default", "neon"]
      });
      prisma.user.update.mockResolvedValueOnce({});
      const fn = getCallback(socket, "pakaiItem");
      await fn({ tipe: "frame", itemId: "neon" });
      expect(socket.emit).toHaveBeenCalledWith(
        "itemTerpasang", { tipe: "frame", itemId: "neon" }
      );
    });

    it("✅ harus berhasil equip theme", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: ["default", "neon"]
      });
      prisma.user.update.mockResolvedValueOnce({});
      const fn = getCallback(socket, "pakaiItem");
      await fn({ tipe: "theme", itemId: "neon" });
      expect(socket.emit).toHaveBeenCalledWith(
        "itemTerpasang", { tipe: "theme", itemId: "neon" }
      );
    });

    it("✅ harus berhasil equip badge", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: ["default", "badge_math"]
      });
      prisma.user.update.mockResolvedValueOnce({});
      const fn = getCallback(socket, "pakaiItem");
      await fn({ tipe: "badge", itemId: "badge_math" });
      expect(socket.emit).toHaveBeenCalledWith(
        "itemTerpasang", { tipe: "badge", itemId: "badge_math" }
      );
    });

    it("✅ item 'default' selalu bisa dipakai tanpa cek inventory", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: [] // kosong, tapi default selalu boleh
      });
      prisma.user.update.mockResolvedValueOnce({});
      const fn = getCallback(socket, "pakaiItem");
      await fn({ tipe: "frame", itemId: "default" });
      expect(socket.emit).toHaveBeenCalledWith(
        "itemTerpasang", { tipe: "frame", itemId: "default" }
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("mintaInventory", () => {

    it("✅ harus emit dataInventory dengan data user", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory:     ["default", "neon"],
        activeTheme:   "default",
        equippedFrame: "neon",
        equippedBadge: null,
        coins:         450,
      });
      const fn = getCallback(socket, "mintaInventory");
      await fn("TestUser");
      expect(socket.emit).toHaveBeenCalledWith(
        "dataInventory",
        expect.objectContaining({
          owned: expect.arrayContaining(["neon"]),
          koin:  450,
        })
      );
    });

    it("✅ harus menggunakan activeUser.username jika tersedia (security)", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        inventory: ["default"], activeTheme: "default",
        equippedFrame: "default", equippedBadge: null, coins: 0,
      });
      const fn = getCallback(socket, "mintaInventory");
      // Kirim username berbeda, tapi activeUser.username yang dipakai
      await fn("HackerUser");
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { username: "TestUser" } })
      );
    });

    it("✅ harus tidak emit jika user tidak ditemukan di DB", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const fn = getCallback(socket, "mintaInventory");
      await fn("TestUser");
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });
});
