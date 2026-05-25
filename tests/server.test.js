const request = require("supertest");
const { app, server, io } = require("../server.js");
const prisma = require("../src/config/prisma.js");
const { Client } = require("socket.io-client");

describe("API Endpoints Testing", () => {
  afterAll(async () => {
    // Ensuring the server and socketio closes after tests are completed
    io.close();
    server.close();
    await prisma.$disconnect();
  });

  describe("GET /", () => {
    it("should serve the frontend index.html", async () => {
      const res = await request(app).get("/");
      expect(res.statusCode).toEqual(200);
      expect(res.headers["content-type"]).toMatch(/html/);
    });
  });

  describe("POST /api/login-guru", () => {
    it("should fail with wrong password", async () => {
      // Setup a dummy environment variable for the test
      process.env.GURU_PASSWORD = "test-password";
      process.env.JWT_SECRET = "test-secret";

      const res = await request(app)
        .post("/api/login-guru")
        .send({ kode: "wrong-password" });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should succeed with correct password", async () => {
      process.env.GURU_PASSWORD = "correct-password";
      process.env.JWT_SECRET = "test-secret";

      const res = await request(app)
        .post("/api/login-guru")
        .send({ kode: "correct-password" });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });
  });

  describe("GET /api/health", () => {
    it("✅ harus return status 200 dan field yang diperlukan", async () => {
      const res = await request(app).get("/api/health");

      // Status code: 200 (ok) atau 503 (DB down di environment test)
      expect([200, 503]).toContain(res.statusCode);
      expect(res.headers["content-type"]).toMatch(/json/);

      // Struktur response wajib ada
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("database");
      expect(res.body).toHaveProperty("memory");
      expect(res.body).toHaveProperty("responseTimeMs");
      expect(res.body).toHaveProperty("node");
    });

    it("✅ harus return uptime berupa angka non-negatif", async () => {
      const res = await request(app).get("/api/health");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it("✅ harus return memory.used dalam format string MB", async () => {
      const res = await request(app).get("/api/health");
      expect(res.body.memory.used).toMatch(/MB$/);
      expect(res.body.memory.total).toMatch(/MB$/);
    });

    it("✅ harus return responseTimeMs berupa angka positif", async () => {
      const res = await request(app).get("/api/health");
      expect(typeof res.body.responseTimeMs).toBe("number");
      expect(res.body.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
