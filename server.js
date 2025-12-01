const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    // 1. FITUR JOIN ROOM
    socket.on('joinRoom', (data) => {
        socket.join(data.room);
        console.log(`🏠 User ${data.username} MASUK ke room: [${data.room}]`);
    });

    // 2. FITUR SKOR GAME
    socket.on('laporSkor', (data) => {
        // Kirim hanya ke lawan di room yang sama
        socket.to(data.room).emit('updateSkorLawan', data.skor);
    });

    // 3. FITUR CHAT GLOBAL (BARU)
    socket.on('chatMessage', (data) => {
        // Kirim ke SEMUA orang yang sedang online
        io.emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ User DISCONNECTED:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('------------------------------------------');
    console.log(`🚀 SERVER SIAP! Jalan di Port ${PORT}`);
    console.log('------------------------------------------');
});