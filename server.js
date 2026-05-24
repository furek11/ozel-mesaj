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

io.on('connection', (socket) => {
    let currentUser = null;

    // Sunucu uykudan yeni uyandıysa, bağlanan ilk tarayıcıdan localStorage yedeklerini talep et
    socket.emit('request_last_seen_backup');

    // Tarayıcıdan gelen yedek durum bilgisini sunucu hafızasına yaz
    socket.on('provide_last_seen_backup', (backup) => {
        if (backup) {
            if (userStatus["Biyolojinin Son Kalesi"].lastSeen === "Bilinmiyor" && backup.biyoloji) {
                userStatus["Biyolojinin Son Kalesi"].lastSeen = backup.biyoloji;
            }
            if (userStatus["Mat Dehası"].lastSeen === "Bilinmiyor" && backup.mat) {
                userStatus["Mat Dehası"].lastSeen = backup.mat;
            }
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
            // Diğer kullanıcıya benim çevrimiçi olduğumu haber ver
            socket.broadcast.emit('status_change', { user: currentUser, status: userStatus[currentUser] });
        } else {
            socket.emit('auth_fail', 'Geçersiz Şifre!');
        }
    });

    // Mesaj Gönderme (Saat bilgisi ekleniyor)
    socket.on('chat_message', (msg) => {
        if (currentUser) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            const messageData = {
                id: Math.random().toString(36).substr(2, 9), // Mesajı eşleştirmek için rastgele ID
                text: msg,
                sender: currentUser,
                time: timeStr,
                read: false
            };
            io.emit('chat_message', messageData);
        }
    });

    // Görüldü Sinyali Alındığında
    socket.on('message_read', (data) => {
        // Mesajı gönderen dışındaki kişiye görüldü bilgisini ilet
        socket.broadcast.emit('message_read_confirm', { msgId: data.msgId });
    });

    // Bağlantı Koptuğunda (Son Görülme Zamanı Kaydedilir)
    socket.on('disconnect', () => {
        if (currentUser) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            userStatus[currentUser].online = false;
            userStatus[currentUser].lastSeen = "Bugün " + timeStr;
            userStatus[currentUser].socketId = null;

            // Diğer kullanıcıya son görülme zamanımı yayınla
            socket.broadcast.emit('status_change', { user: currentUser, status: userStatus[currentUser] });
        }
    });
});

http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});