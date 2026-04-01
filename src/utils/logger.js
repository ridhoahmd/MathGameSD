const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Format log kustom yang rapi dan mudah dibaca (Standard Text Format, bukan JSON mentah)
const customFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Setup rotasi untuk file Error log bulanan/harian
const errorTransport = new DailyRotateFile({
  filename: "logs/error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d", // Simpan maksimal 14 hari
  level: "error", // Hanya nangkep error
  format: combine(
    errors({ stack: true }), // Tangkap traceback stack error
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  )
});

// Setup rotasi untuk file aplikasi harian (mencatat semua aktivitas Info, Warn, Error)
const appTransport = new DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d", // Simpan maksimal 14 hari
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  )
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transports: [
    errorTransport,
    appTransport
  ],
  // Jangan biarin uncaught exception matiin server langsung tanpa terekam log
  exceptionHandlers: [
    new DailyRotateFile({
      filename: "logs/exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: "logs/rejections-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    })
  ]
});

// Jika kita di environment development/local, mending keluarin pake warna ke terminal juga
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      ),
    })
  );
}

module.exports = logger;
