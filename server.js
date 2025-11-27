const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('✅ User CONNECTED:', socket.id);

    // 1. Saat user minta GABUNG ROOM
    socket.on('joinRoom', (data) => {
        socket.join(data.room);
        console.log(`🏠 User ${data.username} MASUK ke room: [${data.room}]`);
    });

    // 2. Saat user LAPOR SKOR
    socket.on('laporSkor', (data) => {
        console.log(`📢 Menerima Skor dari Room [${data.room}]: ${data.skor}`);
        
        // Cek apakah ada orang lain di room ini?
        const roomSize = io.sockets.adapter.rooms.get(data.room)?.size || 0;
        console.log(`   👉 Mengirim ke ${roomSize - 1} orang lain di room tersebut.`);

        // Kirim ke orang lain
        socket.to(data.room).emit('updateSkorLawan', data.skor);
    });

    socket.on('disconnect', () => {
        console.log('❌ User DISCONNECTED:', socket.id);
    });
});

const PORT = process.env.PORT || 3000; // <-- Ini kuncinya!

http.listen(PORT, () => {
    console.log('------------------------------------------');
    console.log(`🚀 SERVER SIAP! Jalan di Port ${PORT}`);
    console.log('------------------------------------------');
});