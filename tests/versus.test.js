// tests/versus.test.js
const userHandler = require("../src/sockets/userHandler");

// Mock prisma directly to bypass Database connection issues (Proxy rlwy.net)
jest.mock("../src/config/prisma", () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, xp: 100, username: "TestUser" }),
    update: jest.fn().mockResolvedValue({ id: 1, totalScore: 100, coins: 10, xp: 150, level: 1 })
  },
  game: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, slug: "math", title: "MATH" }),
    create: jest.fn()
  },
  score: {
    create: jest.fn().mockResolvedValue({ id: 1 })
  },
  versusMatch: {
    create: jest.fn().mockResolvedValue(true),
    findMany: jest.fn().mockResolvedValue([
      { game: { title: "MATH" }, p2Name: "Musuh Misterius", status: "Win", p1Score: 100, playedAt: new Date() }
    ])
  }
}));

const prisma = require("../src/config/prisma");

describe("Versus Mode Socket Testing", () => {
  let socketMock;
  let ioMock;
  
  beforeEach(() => {
    // Mock the socket connection coming from client
    socketMock = {
      isAuth: true,
      activeUser: { username: "TestUser" },
      // Simulasikan sesi bermain yang valid (mulaiGame sudah dipanggil sebelumnya)
      // Property `game` WAJIB cocok dengan game yang dikirim, dan `startTime`
      // harus >5000ms lalu agar lolos pengecekan speedhack di handler.
      activeGameSession: { game: "math", startTime: Date.now() - 10000 },
      emit: jest.fn(),
      on: jest.fn(),
      handshake: { address: '127.0.0.1' }
    };
    ioMock = {
       emit: jest.fn()
    };
    jest.clearAllMocks();
  });

  it("✅ Harus menyimpan riwayat duel ke database dan mengemit status kemenangan", async () => {
    // Inject handler
    userHandler(socketMock, ioMock);
    
    // Find the registered 'laporSkorVersusLokal' callback
    const laporCall = socketMock.on.mock.calls.find(c => c[0] === "laporSkorVersusLokal");
    expect(laporCall).toBeDefined();
    const handlerFn = laporCall[1];
    
    // Simulate frontend submitting match score
    await handlerFn({
      game: "math",
      status: "Win",
      score: 100,
      p2Name: "Player 2"
    });
    
    // 1. Check if prisma.versusMatch.create was called properly
    expect(prisma.versusMatch.create).toHaveBeenCalled();
    const createArgs = prisma.versusMatch.create.mock.calls[0][0];
    
    expect(createArgs.data.p2Name).toEqual("Player 2");
    expect(createArgs.data.status).toEqual("Win");
    expect(createArgs.data.p1Score).toEqual(100);
    expect(createArgs.data.user.connect.id).toBe(1);
    
    // 2. Check if socket emitted skorTersimpan back to client
    expect(socketMock.emit).toHaveBeenCalledWith("skorTersimpan", expect.objectContaining({
      isVersusWin: true
    }));
  });

  it("✅ Harus mengirim data profil lengkap saat mintaRiwayatVersus dipanggil", async () => {
    userHandler(socketMock, ioMock);
    
    const mintaCall = socketMock.on.mock.calls.find(c => c[0] === "mintaRiwayatVersus");
    expect(mintaCall).toBeDefined();
    
    const handlerFn = mintaCall[1];
    
    // Simulate user clicking "Riwayat Duel"
    await handlerFn({});
    
    // 1. Prisma should look up the records
    expect(prisma.versusMatch.findMany).toHaveBeenCalled();
    
    // 2. Server should emit 'riwayatVersusData' containing the parsed array
    expect(socketMock.emit).toHaveBeenCalledWith("riwayatVersusData", expect.arrayContaining([
      expect.objectContaining({
        game: "MATH",
        p2Name: "Musuh Misterius",
        status: "Win",
        score: 100
      })
    ]));
  });
});
