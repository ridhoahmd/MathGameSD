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
});
