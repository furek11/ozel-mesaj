require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Kullanıcı durumlarını hafızada tutan obje
const usersStatus = {
    "Mat Dehası": { online: false, lastSeen: "Bilinmiyor", typing: false },
    "Biyolojinin Son Kalesi": { online: false, lastSeen: "Bilinmiyor", typing: false }
};

// ==========================================================================
// MAİL BİLDİRİM MOTORU (NODEMAILER YAPILANDIRMASI)
// ==========================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Mail Gönderme Fonksiyonu
function sendNotificationEmail(senderName, messagePreview) {
    const mailOptions = {
        from: `"Güvenli Sohbet Bildirimi" <${process.env.EMAIL_USER}>`,
        to: process.env.RECEIVER_EMAIL,
        subject: `🔔 ${senderName} Yeni Mesaj Gönderdi!`,
        text: `Merhaba, \n\nSohbet odasında ${senderName} size yeni bir mesaj bıraktı.\n\nMesaj Önizlemesi: ${messagePreview}\n\nOkumak için hemen uygulamaya giriş yapın.`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 500px;">
                <h2 style="color: #00a884; margin-top: 0;">🔔 Yeni Mesaj Bildirimi</h2>
                <p><strong>${senderName}</strong> size yeni bir mesaj gönderdi.</p>
                <blockquote style="background: #f9f9f9; padding: 10px 15px; border-left: 4px solid #00a884; margin: 15px 0;">
                    ${messagePreview}
                </blockquote>
                <p style="font-size: 13px; color: #8696a0;">Bu otomatik bir sistem bildirimidir. Lütfen bu maili yanıtlamayın.</p>
               </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Mail gönderme hatası:', error);
        } else {
            console.log('Bildirim maili başarıyla gönderildi:', info.response);
        }
    });
}

// ==========================================================================
// SOCKET.IO SOHBET VE AKTİVİTE AKIŞI
// ==========================================================================
io.on('connection', (socket) => {
    let authUser = null;

    socket.on('auth', (password) => {
        // Basit şifre kontrol mantığı (Projene göre burayı esnetebilirsin)
        if (password === "mat123") {
            authUser = "Mat Dehası";
        } else if (password === "bio123") {
            authUser = "Biyolojinin Son Kalesi";
        }

        if (authUser) {
            socket.join('chat-room');
            usersStatus[authUser].online = true;
            usersStatus[authUser].typing = false;
            
            socket.emit('auth_success', { username: authUser, statusList: usersStatus });
            io.to('chat-room').emit('status_update', {
                matOnline: usersStatus["Mat Dehası"].online,
                matLastSeen: usersStatus["Mat Dehası"].lastSeen,
                matTyping: usersStatus["Mat Dehası"].typing,
                biyolojiOnline: usersStatus["Biyolojinin Son Kalesi"].online,
                biyolojiLastSeen: usersStatus["Biyolojinin Son Kalesi"].lastSeen,
                biyolojiTyping: usersStatus["Biyolojinin Son Kalesi"].typing
            });
            socket.emit('request_last_seen_backup');
        } else {
            socket.emit('auth_fail', 'Geçersiz erişim şifresi!');
        }
    });

    socket.on('provide_last_seen_backup', (backup) => {
        if (backup) {
            if (backup.mat && usersStatus["Mat Dehası"].lastSeen === "Bilinmiyor") usersStatus["Mat Dehası"].lastSeen = backup.mat;
            if (backup.biyoloji && usersStatus["Biyolojinin Son Kalesi"].lastSeen === "Bilinmiyor") usersStatus["Biyolojinin Son Kalesi"].lastSeen = backup.biyoloji;
        }
    });

    socket.on('chat_message', (msgData) => {
        if (!authUser) return;

        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const messageId = '_' + Math.random().toString(36).substr(2, 9);

        const fullMessage = {
            id: messageId,
            sender: authUser,
            type: msgData.type,
            text: msgData.text,
            time: timestamp
        };

        // Mesajı odadaki herkese gönder
        io.to('chat-room').emit('chat_message', fullMessage);

        // --- AKILLI MAİL KONTROLÜ ---
        const partnerName = authUser === "Mat Dehası" ? "Biyolojinin Son Kalesi" : "Mat Dehası";
        
        // Eğer mesajı alan kişi o an uygulamada aktif DEĞİLSE mail gönder
        if (usersStatus[partnerName] && usersStatus[partnerName].online === false) {
            const previewText = msgData.type === 'sticker' ? '[Bir Çıkartma Gönderdi]' : msgData.text;
            sendNotificationEmail(authUser, previewText);
        }
    });

    socket.on('typing_status', (isTyping) => {
        if (!authUser) return;
        usersStatus[authUser].typing = isTyping;
        socket.to('chat-room').emit('status_update', {
            matOnline: usersStatus["Mat Dehası"].online,
            matLastSeen: usersStatus["Mat Dehası"].lastSeen,
            matTyping: usersStatus["Mat Dehası"].typing,
            biyolojiOnline: usersStatus["Biyolojinin Son Kalesi"].online,
            biyolojiLastSeen: usersStatus["Biyolojinin Son Kalesi"].lastSeen,
            biyolojiTyping: usersStatus["Biyolojinin Son Kalesi"].typing
        });
    });

    socket.on('message_read', (data) => {
        socket.to('chat-room').emit('message_read_confirm', { msgId: data.msgId });
    });

    socket.on('disconnect', () => {
        if (authUser) {
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            usersStatus[authUser].online = false;
            usersStatus[authUser].typing = false;
            usersStatus[authUser].lastSeen = now;

            io.to('chat-room').emit('status_update', {
                matOnline: usersStatus["Mat Dehası"].online,
                matLastSeen: usersStatus["Mat Dehası"].lastSeen,
                matTyping: usersStatus["Mat Dehası"].typing,
                biyolojiOnline: usersStatus["Biyolojinin Son Kalesi"].online,
                biyolojiLastSeen: usersStatus["Biyolojinin Son Kalesi"].lastSeen,
                biyolojiTyping: usersStatus["Biyolojinin Son Kalesi"].typing
            });
        }
    });
});

http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda başarıyla ayağa kalktı.`);
});