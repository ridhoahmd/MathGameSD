const { sanitizeKey, sanitizeMessage } = require("../utils/security");

module.exports = (socket, io) => {
    socket.on("chatMessage", (msg) => {
        if (!msg.pesan || !msg.pesan.trim()) return;

        const cleanPesan = sanitizeMessage(msg.pesan);

        io.emit("chatMessage", {
            nama: sanitizeKey(msg.nama).substring(0, 15),
            pesan: cleanPesan,
            waktu: new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
            }),
        });
    });
};
