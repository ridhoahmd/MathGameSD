const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

prisma
  .$connect()
  .then(() => console.log("✅ DATABASE POSTGRE: TERHUBUNG!"))
  .catch((e) => console.error("❌ DATABASE ERROR:", e.message));

module.exports = prisma;
