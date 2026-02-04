const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Cek koneksi database
prisma
  .$connect()
  .then(() => console.log("✅ DATABASE POSTGRE: AMAN!"))
  .catch((e) => console.error("❌ DATABASE GA KONEK:", e.message));

module.exports = prisma;
