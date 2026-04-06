const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Ensure log directory exists relative to project root
const logDir = path.join(__dirname, '../../logs');

// define the custom settings for each transport (file, console)
const options = {
    fileInfo: {
        level: 'info',
        filename: `${logDir}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        handleExceptions: true,
        json: true,
    },
    fileError: {
        level: 'error',
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d', // Keep errors longer
        handleExceptions: true,
        json: true,
    },
    console: {
        level: 'debug',
        handleExceptions: true,
        json: false,
        colorize: true,
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    },
};

// instantiate a new Winston Logger with the settings defined above
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile(options.fileInfo),
        new DailyRotateFile(options.fileError)
    ],
    exitOnError: false, // do not exit on handled exceptions
});

// If we're not in production then log to the `console`
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console(options.console));
}

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
    write: function(message, encoding) {
        // use the 'info' log level so the output will be picked up by both transports
        logger.info(message.trim());
    },
};

module.exports = logger;
