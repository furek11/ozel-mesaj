const socket = io();

let myUsername = "";
let partnerUsername = "";

// Yeni HTML yapısına göre güncellenmiş DOM Elementleri
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// WhatsApp Web Düzeni için Hedef Alanlar
const targetNameTop = document.getElementById('target-name-top');
const targetNameSide = document.getElementById('target-name-side');
const targetStatus = document.getElementById('target-status');
const sideStatus = document.getElementById('side-status');

// Sunucu uykudan uyanıp yedek istediğinde tarayıcı hafızasındaki bilgileri gönder
socket.on('request_last_seen_backup', () => {
    const localBackup = {
        biyoloji: localStorage.getItem('lastSeen_biyoloji'),
        mat: localStorage.getItem('lastSeen_mat')
    };
    socket.emit('provide_last_seen_backup', localBackup);
});

// Giriş Butonu Tetikleyici
loginBtn.addEventListener('click', () => {
    const pass = passwordInput.value.trim();
    if (pass) socket.emit('auth', pass);
});

// Şifre ile enter tuşuna basarak da girilebilsin
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const pass = passwordInput.value.trim();
        if (pass) socket.emit('auth', pass);
    }
});

// Kimlik Doğrulama Başarılı Olduğunda
socket.on('auth_success', (data) => {
    myUsername = data.username;
    partnerUsername = myUsername === "Biyolojinin Son Kalesi" ? "Mat Dehası" : "Biyolojinin Son Kalesi";
    
    // Ekran geçişleri
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // İsimleri bas
    targetNameTop.innerText = partnerUsername;
    targetNameSide.innerText = partnerUsername;
    
    // Girişte sunucudan gelen son durum listesini tara, yedekle ve ekrana yaz
    if (data.statusList) {
        const biyoData = data.statusList["Biyolojinin Son Kalesi"];
        const matData = data.statusList["Mat Dehası"];

        if (biyoData && biyoData.lastSeen !== "Bilinmiyor") {
            localStorage.setItem('lastSeen_biyoloji', biyoData.lastSeen.includes("Bugün") ? biyoData.lastSeen : `Son görülme ${biyoData.lastSeen}`);
        }
        if (matData && matData.lastSeen !== "Bilinmiyor") {
            localStorage.setItem('lastSeen_mat', matData.lastSeen.includes("Bugün") ? matData.lastSeen : `Son görülme ${matData.lastSeen}`);
        }

        updateStatusUI(data.statusList[partnerUsername]);
    }
});

// Kimlik Doğrulama Başarısız Olduğunda
socket.on('auth_fail', (msg) => { 
    alert(msg); // Şık bir WhatsApp uyarısı yerine direkt alert bastık, hata mesajı alanını korumuş olduk
});

// Mesaj Gönderme Tetikleyicileri
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        messageInput.value = '';
    }
}

// Mesaj Geldiğinde (WhatsApp Koyu Tema Yapısına Göre Düzenlendi)
socket.on('chat_message', (data) => {
    const messageEl = document.createElement('div');
    messageEl.setAttribute('data-id', data.id); // Çift mavi tik eşleşmesi için ID
    
    if (data.sender === myUsername) {
        // Benim Mesajım (Sağa Yaslı - Koyu Yeşil Balon)
        messageEl.className = 'message sent';
        messageEl.innerHTML = `
            ${data.text}
            <span class="time">
                ${data.time} <span class="status-tick" style="margin-left: 3px; color: #8696a0;">✓</span>
            </span>
        `;
    } else {
        // Karşı Tarafın Mesajı (Sola Yaslı - Koyu Gri Balon)
        messageEl.className = 'message received';
        messageEl.innerHTML = `
            ${data.text}
            <span class="time">${data.time}</span>
        `;
        
        // Okundu sinyalini sunucuya fırlat
        socket.emit('message_read', { msgId: data.id });
    }
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Otomatik aşağı kaydır
});

// Karşı Taraf Mesajı Okuduğunda (Çift Mavi Tik Yapma)
socket.on('message_read_confirm', (data) => {
    const targetTick = document.querySelector(`[data-id="${data.msgId}"] .status-tick`);
    if (targetTick) {
        targetTick.innerText = "✓✓";
        targetTick.style.color = "#53bdeb"; // WhatsApp Canlı Mavi Tik Rengi
    }
});

// Karşı Tarafın Durumu Değiştiğinde (Anlık Tetiklenme)
socket.on('status_change', (data) => {
    if (data.user === partnerUsername) {
        updateStatusUI(data.status);
    }
});

// Sunucunun toplu uyanma güncellemelerini yakalama ve hafızaya alma
socket.on('status_update', (data) => {
    if (data.biyolojiStatus) localStorage.setItem('lastSeen_biyoloji', data.biyolojiStatus);
    if (data.matStatus) localStorage.setItem('lastSeen_mat', data.matStatus);

    if (partnerUsername === "Mat Dehası" && data.matStatus) {
        renderStatusTexts(data.matStatus);
    } else if (partnerUsername === "Biyolojinin Son Kalesi" && data.biyolojiStatus) {
        renderStatusTexts(data.biyolojiStatus);
    }
});

// Durum Verisini UI İşleyicisine Hazırlayan Yardımcı Fonksiyon
function updateStatusUI(statusObj) {
    if (!statusObj) return;

    if (statusObj.online) {
        renderStatusTexts("çevrimiçi");
    } else {
        let savedLastSeen = "Bilinmiyor";
        if (partnerUsername === "Mat Dehası") {
            savedLastSeen = localStorage.getItem('lastSeen_mat') || (statusObj.lastSeen !== "Bilinmiyor" ? statusObj.lastSeen : "Bilinmiyor");
        } else {
            savedLastSeen = localStorage.getItem('lastSeen_biyoloji') || (statusObj.lastSeen !== "Bilinmiyor" ? statusObj.lastSeen : "Bilinmiyor");
        }

        // Eğer ham zaman formatı geldiyse başına "Bugün " ekle, zaten ekliyse bozma
        if (savedLastSeen !== "Bilinmiyor" && !savedLastSeen.includes("Son görülme") && !savedLastSeen.includes("Bugün")) {
            savedLastSeen = `Son görülme Bugün ${savedLastSeen}`;
        } else if (savedLastSeen !== "Bilinmiyor" && !savedLastSeen.includes("Son görülme")) {
            savedLastSeen = `Son görülme ${savedLastSeen}`;
        }

        renderStatusTexts(savedLastSeen);
    }
}

// Hem üst barı hem de sol taraftaki mini listeyi güncelleyen fonksiyon
function renderStatusTexts(text) {
    targetStatus.innerText = text;
    sideStatus.innerText = text;
    
    // Çevrimiçi ise yeşil tonu yap, değilse WhatsApp gri tonu yap
    if (text === "çevrimiçi") {
        targetStatus.style.color = "#00a884";
        sideStatus.style.color = "#00a884";
    } else {
        targetStatus.style.color = "#8696a0";
        sideStatus.style.color = "#8696a0";
    }
}