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

    // 3. FITUR CHAT GLOBAL (DENGAN WAKTU)
    socket.on('chatMessage', (data) => {
        // Ambil waktu server saat ini
        const now = new Date();
        // Format jam:menit (contoh: 14:30)
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // Bungkus data lengkap
        const fullData = {
            nama: data.nama,
            pesan: data.pesan,
            waktu: timeString // <--- INI DATA BARUNYA
        };

        // Kirim ke SEMUA orang
        io.emit('chatMessage', fullData);
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