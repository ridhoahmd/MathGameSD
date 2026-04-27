const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

// Cek koneksi database
prisma
  .$connect()
  .then(() => logger.info("✅ DATABASE POSTGRE: AMAN!"))
  .catch((e) => logger.error(`❌ DATABASE GA KONEK: ${e.message}`));

module.exports = prisma;
