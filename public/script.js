const socket = io();

let myUsername = "";
let partnerUsername = "";

// DOM Elementleri
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// WhatsApp Arayüz Elementleri
const targetNameTop = document.getElementById('target-name-top');
const targetNameSide = document.getElementById('target-name-side');
const targetStatus = document.getElementById('target-status');
const sideStatus = document.getElementById('side-status');

// Mobil ve Genel Kontrol Butonları
const chatItem = document.querySelector('.chat-item');
const backToListBtn = document.getElementById('back-to-list-btn');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');

// Sunucu uykudan uyandığında tarayıcı hafızasından yedek verileri fırlatır
socket.on('request_last_seen_backup', () => {
    const localBackup = {
        biyoloji: localStorage.getItem('lastSeen_biyoloji'),
        mat: localStorage.getItem('lastSeen_mat')
    };
    socket.emit('provide_last_seen_backup', localBackup);
});

// Otomatik Tam Ekran Başlatıcı Fonksiyonu (Google Bar Temizleyici)
function activateFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.log("Tam ekran başlatılamadı:", err));
    } else if (docEl.mozRequestFullScreen) { // Firefox
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) { // Chrome, Safari ve Opera
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) { // IE/Edge
        docEl.msRequestFullscreen();
    }
}

// Kimlik Doğrulama İstek Gönderimi
loginBtn.addEventListener('click', () => {
    const pass = passwordInput.value.trim();
    if (pass) socket.emit('auth', pass);
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const pass = passwordInput.value.trim();
        if (pass) socket.emit('auth', pass);
    }
});

// Giriş Başarılı Olduğunda
socket.on('auth_success', (data) => {
    myUsername = data.username;
    partnerUsername = myUsername === "Biyolojinin Son Kalesi" ? "Mat Dehası" : "Biyolojinin Son Kalesi";
    
    // Mobil tarayıcı barlarını uçurmak için tam ekranı tetikle
    activateFullscreen();

    // Arayüz geçişleri
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    targetNameTop.innerText = partnerUsername;
    targetNameSide.innerText = partnerUsername;
    
    // Sunucudan gelen ilk verileri lokal hafızaya yedekle ve UI güncelle
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

socket.on('auth_fail', (msg) => { 
    alert(msg); 
});

// Mesaj Gönderme Motoru
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        messageInput.value = '';
    }
}

// Mesaj Alındığında Akış Yönetimi
socket.on('chat_message', (data) => {
    const messageEl = document.createElement('div');
    messageEl.setAttribute('data-id', data.id);
    
    if (data.sender === myUsername) {
        messageEl.className = 'message sent';
        messageEl.innerHTML = `
            ${data.text}
            <span class="time">
                ${data.time} <span class="status-tick" style="margin-left: 3px; color: #8696a0;">✓</span>
            </span>
        `;
    } else {
        messageEl.className = 'message received';
        messageEl.innerHTML = `
            ${data.text}
            <span class="time">${data.time}</span>
        `;
        socket.emit('message_read', { msgId: data.id });
    }
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Çift Mavi Tik Doğrulaması
socket.on('message_read_confirm', (data) => {
    const targetTick = document.querySelector(`[data-id="${data.msgId}"] .status-tick`);
    if (targetTick) {
        targetTick.innerText = "✓✓";
        targetTick.style.color = "#53bdeb";
    }
});

// Anlık Durum Değişiklikleri
socket.on('status_change', (data) => {
    if (data.user === partnerUsername) {
        updateStatusUI(data.status);
    }
});

// Sunucu Uyanma Senkronizasyonu
socket.on('status_update', (data) => {
    if (data.biyolojiStatus) localStorage.setItem('lastSeen_biyoloji', data.biyolojiStatus);
    if (data.matStatus) localStorage.setItem('lastSeen_mat', data.matStatus);

    if (partnerUsername === "Mat Dehası" && data.matStatus) {
        renderStatusTexts(data.matStatus);
    } else if (partnerUsername === "Biyolojinin Son Kalesi" && data.biyolojiStatus) {
        renderStatusTexts(data.biyolojiStatus);
    }
});

// UI Durum Yardımcı Fonksiyonu
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

        if (savedLastSeen !== "Bilinmiyor" && !savedLastSeen.includes("Son görülme") && !savedLastSeen.includes("Bugün")) {
            savedLastSeen = `Son görülme Bugün ${savedLastSeen}`;
        } else if (savedLastSeen !== "Bilinmiyor" && !savedLastSeen.includes("Son görülme")) {
            savedLastSeen = `Son görülme ${savedLastSeen}`;
        }

        renderStatusTexts(savedLastSeen);
    }
}

function renderStatusTexts(text) {
    targetStatus.innerText = text;
    sideStatus.innerText = text;
    if (text === "çevrimiçi") {
        targetStatus.style.color = "#00a884";
        sideStatus.style.color = "#00a884";
    } else {
        targetStatus.style.color = "#8696a0";
        sideStatus.style.color = "#8696a0";
    }
}

// Mobil Panel Geçiş Tetikleyicileri
chatItem.addEventListener('click', () => {
    appContainer.classList.add('chat-active');
});

backToListBtn.addEventListener('click', () => {
    appContainer.classList.remove('chat-active');
});

// Manuel Tam Ekran Buton Kontrolü (Üst barda yer alan ikon)
fullscreenToggleBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        activateFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
});