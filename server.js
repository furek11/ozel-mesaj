const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const SIFRE_BIYOLOJI = process.env.SIFRE_BIYOLOJI || "biyo123";
const SIFRE_MATEMATIK = process.env.SIFRE_MATEMATIK || "mat123";

// Kullanıcı durumlarını hafızada tutuyoruz
let userStatus = {
    "Biyolojinin Son Kalesi": { online: false, lastSeen: "Bilinmiyor", socketId: null },
    "Mat Dehası": { online: false, lastSeen: "Bilinmiyor", socketId: null }
};

// Durumları tüm istemcilere güvenli ve güncel şekilde yayınlayan merkezi fonksiyon
function broadcastStatuses() {
    io.emit('status_update', {
        biyolojiOnline: userStatus["Biyolojinin Son Kalesi"].online,
        biyolojiLastSeen: userStatus["Biyolojinin Son Kalesi"].lastSeen,
        matOnline: userStatus["Mat Dehası"].online,
        matLastSeen: userStatus["Mat Dehası"].lastSeen
    });
}

io.on('connection', (socket) => {
    let currentUser = null;

    // Sunucu uykudan uyandığında yedek talep eder
    socket.emit('request_last_seen_backup');

    // Tarayıcıdan gelen yedek durum bilgisini sadece ilgili kullanıcı ÇEVRİMDIŞI ise kabul et
    socket.on('provide_last_seen_backup', (backup) => {
        if (backup) {
            if (!userStatus["Biyolojinin Son Kalesi"].online && userStatus["Biyolojinin Son Kalesi"].lastSeen === "Bilinmiyor" && backup.biyoloji) {
                userStatus["Biyolojinin Son Kalesi"].lastSeen = backup.biyoloji;
            }
            if (!userStatus["Mat Dehası"].online && userStatus["Mat Dehası"].lastSeen === "Bilinmiyor" && backup.mat) {
                userStatus["Mat Dehası"].lastSeen = backup.mat;
            }
            broadcastStatuses();
        }
    });

    // Kullanıcı Giriş (Kimlik Doğrulama) işlemi
    socket.on('auth', (password) => {
        if (password === SIFRE_BIYOLOJI) currentUser = "Biyolojinin Son Kalesi";
        else if (password === SIFRE_MATEMATIK) currentUser = "Mat Dehası";

        if (currentUser) {
            userStatus[currentUser].online = true;
            userStatus[currentUser].socketId = socket.id;
            
            socket.emit('auth_success', { username: currentUser, statusList: userStatus });
            // Herkese son durum anlık postalanır
            broadcastStatuses();
        } else {
            socket.emit('auth_fail', 'Geçersiz Şifre!');
        }
    });

    // Mesaj Gönderme
    socket.on('chat_message', (msg) => {
        if (currentUser) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            const messageData = {
                id: Math.random().toString(36).substr(2, 9),
                text: msg,
                sender: currentUser,
                time: timeStr,
                read: false
            };
            io.emit('chat_message', messageData);
        }
    });

    // Görüldü Sinyali
    socket.on('message_read', (data) => {
        socket.broadcast.emit('message_read_confirm', { msgId: data.msgId });
    });

    // Bağlantı Koptuğunda
    socket.on('disconnect', () => {
        if (currentUser) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            userStatus[currentUser].online = false;
            userStatus[currentUser].lastSeen = "Bugün " + timeStr;
            userStatus[currentUser].socketId = null;

            // Çıkış anında durumu güncelle ve herkese duyur
            broadcastStatuses();
        }
    });
});

http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});