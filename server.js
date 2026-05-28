require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Kullanıcı durumlarını hafızada tutan dinamik state objesi
const usersStatus = {
    "Mat Dehası": { online: false, lastSeen: "Bilinmiyor", typing: false },
    "Biyolojinin Son Kalesi": { online: false, lastSeen: "Bilinmiyor", typing: false }
};

// ==========================================================================
// MAİL BİLDİRİM MOTORU (RENDER BULUT UYUMLU TLS YAPILANDIRMASI)
// ==========================================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587, 
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    },
    tls: {
        rejectUnauthorized: false 
    }
});

function sendNotificationEmail(senderName, messagePreview) {
    const targetEmail = process.env.RECEIVER_EMAIL || process.env.EMAIL_USER;

    const mailOptions = {
        from: `"Güvenli Sohbet Bildirimi" <${process.env.EMAIL_USER}>`,
        to: targetEmail,
        subject: `🔔 ${senderName} Yeni Mesaj Gönderdi!`,
        text: `Merhaba, \n\nSohbet odasında ${senderName} size yeni bir mesaj bıraktı.\n\nMesaj Önizlemesi: ${messagePreview}\n\nOkumak için hemen uygulamaya giriş yapın.`,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 500px; background-color: #ffffff; color: #333333;">
                <h2 style="color: #00a884; margin-top: 0;">🔔 Yeni Mesaj Bildirimi</h2>
                <p><strong>${senderName}</strong> size yeni bir mesaj gönderdi.</p>
                <blockquote style="background: #f9f9f9; padding: 10px 15px; border-left: 4px solid #00a884; margin: 15px 0; color: #555555; font-style: italic;">
                    ${messagePreview}
                </blockquote>
                <p style="font-size: 13px; color: #8696a0;">Bu otomatik bir sistem bildirimidir. Lütfen bu maili yanıtlamayın.</p>
               </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Nodemailer Motor Hatası:', error);
        } else {
            console.log('Bildirim maili başarıyla fırlatıldı:', info.response);
        }
    });
}

// ==========================================================================
// SOCKET.IO SOHBET VE AKTİVİTE AKIŞI
// ==========================================================================
io.on('connection', (socket) => {
    let authUser = null;

    socket.on('auth', (password) => {
        // RENDER DEĞİŞKENLERİYLE TAM EŞİTLEME (pkn.png doğrultusunda)
        const MAT_PASS = process.env.SIFRE_MATEMATIK || "mat123";
        const BIO_PASS = process.env.SIFRE_BIYOLOJI || "bio123";

        if (password === MAT_PASS) {
            authUser = "Mat Dehası";
        } else if (password === BIO_PASS) {
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

            setTimeout(() => {
                socket.emit('request_last_seen_backup');
            }, 100);

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

        // Render'a girilen TZ=Europe/Istanbul sayesinde sunucu saati Türkiye saatine göre basılacak
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const messageId = '_' + Math.random().toString(36).substr(2, 9);

        const fullMessage = {
            id: messageId,
            sender: authUser,
            type: msgData.type,
            text: msgData.text,
            time: timestamp
        };

        io.to('chat-room').emit('chat_message', fullMessage);

        const partnerName = authUser === "Mat Dehası" ? "Biyolojinin Son Kalesi" : "Mat Dehası";
        
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