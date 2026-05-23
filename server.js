const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sadece senin ve X kişisinin giriş bilgilerini burada belirliyoruz
const GECERLI_KULLANICILAR = {
    "senin_kullanici_adin": "senin_sifren",
    "x_kullanici_adi": "x_sifresi"
};

// Web sitesi dosyalarımızın duracağı klasörü belirtiyoruz
app.use(express.static('public'));

// Biri siteye bağlandığında (Anlık iletişim başlangıcı)
io.on('connection', (socket) => {
    console.log('Biri sayfaya bağlandı!');

    // Bir mesaj geldiğinde bunu diğer kişiye ilet
    socket.on('yeni-mesaj', (data) => {
        // Gelen mesajı odadaki herkese (yani diğer kişiye) yayınla
        io.emit('mesaj-al', data);
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı.');
    });
});

// Sunucunun çalışacağı port (Bilgisayarımızda 3000 portunda çalışacak)
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Sitemiz şu an hazır! Tarayıcıdan http://localhost:${PORT} adresine giderek görebilirsin.`);
});