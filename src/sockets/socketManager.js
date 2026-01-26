const socketIo = require("socket.io");
const { isSocketRateLimited, cleanUpSocketRateLimit } = require("../utils/rateLimit");

// Handlers
const userHandler = require("./userHandler");
const gameHandler = require("./gameHandler");
const chatHandler = require("./chatHandler");
const shopHandler = require("./shopHandler");

module.exports = (httpServer) => {
    const io = socketIo(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log(`✅ User CONNECTED: ${socket.id}`);

        // Global Middleware / Rate Limit Check for specific heavy events could be applied here
        // For now we just bind the handlers

        // Bind Handlers
        userHandler(socket, io);
        gameHandler(socket, io);
        chatHandler(socket, io);
        shopHandler(socket, io);

        socket.on("disconnect", () => {
            cleanUpSocketRateLimit(socket.id);
            console.log(`❌ User DISCONNECTED: ${socket.id}`);
        });
    });

    return io;
};
