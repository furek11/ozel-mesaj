const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Render'ın bize vereceği portu veya yerelde 3000'i kullanıyoruz
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Güvenli Şifreler (Canlıda bunları Render panelinden yöneteceğiz)
const SIFRE_BIYOLOJI = process.env.SIFRE_BIYOLOJI || "biyo123";
const SIFRE_MATEMATIK = process.env.SIFRE_MATEMATIK || "mat123";

io.on('connection', (socket) => {
    let currentUser = null;

    // Giriş kontrolü (Sadece şifre alıyoruz)
    socket.on('auth', (password) => {
        if (password === SIFRE_BIYOLOJI) {
            currentUser = "Biyolojinin Son Kalesi";
            socket.emit('auth_success', { username: currentUser });
        } else if (password === SIFRE_MATEMATIK) {
            currentUser = "Mat Dehası";
            socket.emit('auth_success', { username: currentUser });
        } else {
            socket.emit('auth_fail', 'Geçersiz Şifre!');
        }
    });

    // Mesaj gönderme
    socket.on('chat_message', (msg) => {
        if (currentUser) {
            // Mesajı gönderen, mesaj metni ve gönderen kişinin kim olduğu
            io.emit('chat_message', { text: msg, sender: currentUser });
        }
    });
});

http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});