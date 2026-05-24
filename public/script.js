const socket = io();

let myUsername = "";
let partnerUsername = "";
let typingTimeout = null;

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

const chatItem = document.querySelector('.chat-item');
const backToListBtn = document.getElementById('back-to-list-btn');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');

socket.on('request_last_seen_backup', () => {
    const localBackup = {
        biyoloji: localStorage.getItem('lastSeen_biyoloji'),
        mat: localStorage.getItem('lastSeen_mat')
    };
    socket.emit('provide_last_seen_backup', localBackup);
});

function activateFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.log(err));
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    }
}

// Geliştirilmiş Mobil Klavye Sabitleyici (Z-Index ve Kadraj Koruma Motoru)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const currentViewportHeight = window.visualViewport.height;
        const totalWindowHeight = window.innerHeight;
        
        // Klavye açıldıysa daralmayı yakala
        if (currentViewportHeight < totalWindowHeight - 60) {
            // Ana gövdeyi daralan viewport boyuna getir, yukarı taşmayı kilitle
            appContainer.style.height = `${currentViewportHeight}px`;
            document.body.style.height = `${currentViewportHeight}px`;
            
            // Mesaj alanını ve footer konumunu yeniden hesapla
            const mainChatEl = document.querySelector('.main-chat');
            mainChatEl.style.height = `${currentViewportHeight}px`;
            
            // Mesajları en alta kaydır
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 50);
        } else {
            // Klavye kapandığında orijinal boyutlara çek
            appContainer.style.height = '100dvh';
            document.body.style.height = '100dvh';
            const mainChatEl = document.querySelector('.main-chat');
            mainChatEl.style.height = '100%';
        }
    });
}

// "Yazıyor..." Tetikleme Mekanizması
messageInput.addEventListener('input', () => {
    // Sunucuya yazıyor bilgisini gönder
    socket.emit('typing_status', true);

    // Eski zamanlayıcıyı temizle, kullanıcı yazmayı bırakınca tetiklenecek
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing_status', false);
    }, 1500); // 1.5 saniye hareketsiz kalırsa yazıyor yazısı silinir
});

// Karşı tarafın yazma durumunu dinleme
socket.on('user_typing', (data) => {
    if (data.user === partnerUsername) {
        if (data.typing) {
            renderStatusTexts("yazıyor...");
        } else {
            // Yazmayı bıraktıysa sunucudan güncel durumu tekrar talep et veya durumu yenile
            socket.emit('request_last_seen_backup');
        }
    }
});

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

socket.on('auth_success', (data) => {
    myUsername = data.username;
    partnerUsername = myUsername === "Biyolojinin Son Kalesi" ? "Mat Dehası" : "Biyolojinin Son Kalesi";
    
    activateFullscreen();

    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    targetNameTop.innerText = partnerUsername;
    targetNameSide.innerText = partnerUsername;
    
    if (data.statusList) {
        updateStatusUI(data.statusList[partnerUsername]);
    }
});

socket.on('auth_fail', (msg) => { alert(msg); });

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('typing_status', false); // Mesaj gittiği an yazıyor durumunu kapat
        socket.emit('chat_message', text);
        messageInput.value = '';
    }
}

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

socket.on('message_read_confirm', (data) => {
    const targetTick = document.querySelector(`[data-id="${data.msgId}"] .status-tick`);
    if (targetTick) {
        targetTick.innerText = "✓✓";
        targetTick.style.color = "#53bdeb";
    }
});

// Merkezi Durum Dinleyicisi
socket.on('status_update', (data) => {
    let partnerOnline = false;
    let partnerLastSeen = "Bilinmiyor";
    let partnerTyping = false;

    if (partnerUsername === "Mat Dehası") {
        partnerOnline = data.matOnline;
        partnerLastSeen = data.matLastSeen;
        partnerTyping = data.matTyping;
        if (partnerLastSeen !== "Bilinmiyor") localStorage.setItem('lastSeen_mat', partnerLastSeen);
    } else {
        partnerOnline = data.biyolojiOnline;
        partnerLastSeen = data.biyolojiLastSeen;
        partnerTyping = data.biyolojiTyping;
        if (partnerLastSeen !== "Bilinmiyor") localStorage.setItem('lastSeen_biyoloji', partnerLastSeen);
    }

    // Öncelik Sıralaması: 1. Yazıyor, 2. Çevrimiçi, 3. Son Görülme
    if (partnerTyping) {
        renderStatusTexts("yazıyor...");
    } else if (partnerOnline) {
        renderStatusTexts("çevrimiçi");
    } else {
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

function updateStatusUI(partnerStatusObj) {
    if (!partnerStatusObj) return;
    if (partnerStatusObj.typing) {
        renderStatusTexts("yazıyor...");
    } else if (partnerStatusObj.online) {
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
    if (text === "çevrimiçi" || text === "yazıyor...") {
        targetStatus.style.color = "#00a884";
        if(text === "yazıyor...") sideStatus.innerText = "yazıyor...";
        sideStatus.style.color = "#00a884";
    } else {
        targetStatus.style.color = "#8696a0";
        sideStatus.style.color = "#8696a0";
    }
}

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