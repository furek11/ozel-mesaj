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

// Otomatik Tam Ekran Başlatıcı
function activateFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.log("Tam ekran başlatılamadı:", err));
    } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

// Mobil Klavye Altında Kalma Çözümü (VisualViewport Motoru)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        if (keyboardHeight > 100) {
            // Klavye açıldığında tüm layout'u tam viewport boyuna sabitle
            appContainer.style.height = `${window.visualViewport.height}px`;
            document.body.style.height = `${window.visualViewport.height}px`;
            chatMessages.scrollTop = chatMessages.scrollHeight; // Mesajları kaydır
        } else {
            // Klavye kapandığında normale dön
            appContainer.style.height = '100dvh';
            document.body.style.height = '100dvh';
        }
    });
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
    
    // Mobil üst barları gizle
    activateFullscreen();

    // Arayüz geçişleri
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    targetNameTop.innerText = partnerUsername;
    targetNameSide.innerText = partnerUsername;
    
    // Sunucudan gelen ham listeye göre ilk arayüz kurulumu
    if (data.statusList) {
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

// Mesaj Alındığında
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

// Sunucudan Gelen Merkezi Durum Yönetim İstasyonu (Kökten Çözüm)
socket.on('status_update', (data) => {
    let partnerOnline = false;
    let partnerLastSeen = "Bilinmiyor";

    // Giriş yapan kişiye göre karşı tarafın bilgilerini ayıkla
    if (partnerUsername === "Mat Dehası") {
        partnerOnline = data.matOnline;
        partnerLastSeen = data.matLastSeen;
        if (partnerLastSeen !== "Bilinmiyor") localStorage.setItem('lastSeen_mat', partnerLastSeen);
    } else {
        partnerOnline = data.biyolojiOnline;
        partnerLastSeen = data.biyolojiLastSeen;
        if (partnerLastSeen !== "Bilinmiyor") localStorage.setItem('lastSeen_biyoloji', partnerLastSeen);
    }

    // Ekrana basma mantığı
    if (partnerOnline) {
        renderStatusTexts("çevrimiçi");
    } else {
        // Eğer sunucu uykudan yeni uyandıysa tarayıcı hafızasındaki yedeği çek
        if (partnerLastSeen === "Bilinmiyor") {
            partnerLastSeen = (partnerUsername === "Mat Dehası") ? 
                (localStorage.getItem('lastSeen_mat') || "Bilinmiyor") : 
                (localStorage.getItem('lastSeen_biyoloji') || "Bilinmiyor");
        }

        if (partnerLastSeen !== "Bilinmiyor" && !partnerLastSeen.includes("Son görülme")) {
            partnerLastSeen = `Son görülme ${partnerLastSeen}`;
        }
        renderStatusTexts(partnerLastSeen);
    }
});

// İlk girişteki UI güncellemesi
function updateStatusUI(partnerStatusObj) {
    if (!partnerStatusObj) return;
    if (partnerStatusObj.online) {
        renderStatusTexts("çevrimiçi");
    } else {
        let text = partnerStatusObj.lastSeen;
        if (text === "Bilinmiyor") {
            text = (partnerUsername === "Mat Dehası") ? 
                (localStorage.getItem('lastSeen_mat') || "Bilinmiyor") : 
                (localStorage.getItem('lastSeen_biyoloji') || "Bilinmiyor");
        }
        if (text !== "Bilinmiyor" && !text.includes("Son görülme")) {
            text = `Son görülme ${text}`;
        }
        renderStatusTexts(text);
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

// Mobil Panel Geçişleri
chatItem.addEventListener('click', () => {
    appContainer.classList.add('chat-active');
    setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
});

backToListBtn.addEventListener('click', () => {
    appContainer.classList.remove('chat-active');
});

fullscreenToggleBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        activateFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
});