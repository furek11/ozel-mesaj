const socket = io();

let myUsername = "";
let partnerUsername = "";
let typingTimeout = null;
let isCurrentlyTyping = false;

// DOM Elementleri
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatFooter = document.querySelector('.chat-footer');

// Sticker Elementleri
const stickerBtn = document.getElementById('sticker-btn');
const stickerPanel = document.getElementById('sticker-panel');

const targetNameTop = document.getElementById('target-name-top');
const targetNameSide = document.getElementById('target-name-side');
const targetStatus = document.getElementById('target-status');
const sideStatus = document.getElementById('side-status');

const chatItem = document.querySelector('.chat-item');
const backToListBtn = document.getElementById('back-to-list-btn');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');

// ==========================================================================
// MİMARİ ENTEGRASYON: OTOMATİK 149 STICKER GENERATOR MOTORU
// ==========================================================================
if (stickerPanel) {
    let stickerHTML = "";
    for (let i = 1; i <= 149; i++) {
        stickerHTML += `<div class="sticker-option" data-name="s${i}.webp"><img src="/assets/stickers/s${i}.webp" alt="Sticker ${i}"></div>`;
    }
    stickerPanel.innerHTML = stickerHTML;
}

// ==========================================================================
// AKILLI ANİMASYON DURDURMA VE SONSUZ TIKLAMA MOTORU (YENİ)
// ==========================================================================
function manageStickerAnimation(imgElement) {
    const animatedSrc = imgElement.src;
    let stopTimeout = null;

    // Görseli o anki karede donduran fonksiyon (Canvas Hilesi)
    const freezeImage = () => {
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            setTimeout(freezeImage, 200);
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        try {
            ctx.drawImage(imgElement, 0, 0);
            imgElement.src = canvas.toDataURL('image/webp');
            imgElement.classList.add('frozen');
        } catch (e) {
            console.error("Sticker dondurulamadı:", e);
        }
    };

    // KURAL 1: İlk yüklendiğinde/gönderildiğinde 3 saniye (3 defa) oynasın ve dursun
    stopTimeout = setTimeout(() => {
        freezeImage();
    }, 3000);

    // KURAL 2: Sonsuz tıklama mekanizması
    imgElement.style.cursor = "pointer";
    imgElement.addEventListener('click', () => {
        // Eğer arkada işleyen aktif bir durdurma zamanlayıcısı varsa iptal et (çakışmasın)
        if (stopTimeout) clearTimeout(stopTimeout);

        // Görseli tekrar hareketli hâline döndür
        imgElement.src = animatedSrc;
        imgElement.classList.remove('frozen');

        // Her tıklamada tam 2 saniye (2 defa) oynasın ve tekrar donsun
        stopTimeout = setTimeout(() => {
            freezeImage();
        }, 2000);
    });
}

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

// Demir Yumruk: Mutlak Fixed Klavye Sabitleme ve Konumlandırma Motoru V4
if (window.visualViewport) {
    const sulaFixedKlavyeMotoru = () => {
        const vv = window.visualViewport;
        const totalHeight = window.innerHeight;
        
        const bottomOffset = totalHeight - vv.height - vv.offsetTop;
        
        if (bottomOffset > 30) {
            if (stickerPanel) stickerPanel.classList.add('hidden');
            chatFooter.style.bottom = `${bottomOffset}px`;
            chatMessages.style.paddingBottom = `${bottomOffset + 75}px`;
        } else {
            chatFooter.style.bottom = '0px';
            if (stickerPanel && !stickerPanel.classList.contains('hidden')) {
                chatMessages.style.paddingBottom = '330px'; 
            } else {
                chatMessages.style.paddingBottom = '80px';
            }
        }
        window.scrollTo(0, 0);
        setTimeout(() => {
            window.scrollTo(0, 0);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 15);
    };
    window.visualViewport.addEventListener('resize', sulaFixedKlavyeMotoru);
    window.visualViewport.addEventListener('scroll', sulaFixedKlavyeMotoru);
}

messageInput.addEventListener('focus', () => {
    if (stickerPanel) stickerPanel.classList.add('hidden');
    setTimeout(() => {
        window.scrollTo(0, 0);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 40);
});

if (stickerBtn && stickerPanel) {
    stickerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (document.activeElement === messageInput) {
            messageInput.blur();
        }
        stickerPanel.classList.toggle('hidden');
        if (!stickerPanel.classList.contains('hidden')) {
            chatMessages.style.paddingBottom = '330px';
        } else {
            chatMessages.style.paddingBottom = '80px';
        }
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 50);
    });

    stickerPanel.addEventListener('click', (e) => {
        const clickedSticker = e.target.closest('.sticker-option');
        if (clickedSticker) {
            const stickerName = clickedSticker.getAttribute('data-name');
            sendSticker(stickerName);
        }
    });
}

messageInput.addEventListener('input', function() {
    this.style.height = '38px'; 
    const nextHeight = this.scrollHeight;
    if (nextHeight > 38) {
        this.style.height = `${nextHeight}px`;
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const currentText = this.value;
    if (currentText.trim() === "") {
        clearTimeout(typingTimeout);
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            socket.emit('typing_status', false);
        }
        return;
    }
    if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        socket.emit('typing_status', true);
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            socket.emit('typing_status', false);
        }
    }, 1800);
});

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const isMobileDevice = window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches;
        if (isMobileDevice) {
            return; 
        } else {
            if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
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

sendBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sendMessage();
});

sendBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        clearTimeout(typingTimeout);
        isCurrentlyTyping = false;
        socket.emit('typing_status', false);
        socket.emit('chat_message', { type: 'text', text: text });
        messageInput.value = '';
        messageInput.style.height = '38px';
        messageInput.focus();
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            window.scrollTo(0, 0);
        }, 10);
    } else {
        messageInput.focus();
    }
}

function sendSticker(stickerName) {
    clearTimeout(typingTimeout);
    isCurrentlyTyping = false;
    socket.emit('typing_status', false);
    socket.emit('chat_message', { type: 'sticker', text: stickerName });
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 10);
}

socket.on('chat_message', (data) => {
    const messageEl = document.createElement('div');
    messageEl.setAttribute('data-id', data.id);
    
    let messageContent = "";

    if (data.type === 'sticker') {
        messageContent = `<img src="/assets/stickers/${data.text}" class="chat-sticker dynamic-anim-sticker" alt="Sticker">`;
    } else {
        messageContent = data.text;
    }

    if (data.sender === myUsername) {
        messageEl.className = data.type === 'sticker' ? 'message sent sticker-msg' : 'message sent';
        messageEl.innerHTML = `${messageContent}<span class="time">${data.time} <span class="status-tick" style="margin-left: 3px; color: #8696a0;">✓</span></span>`;
    } else {
        messageEl.className = data.type === 'sticker' ? 'message received sticker-msg' : 'message received';
        messageEl.innerHTML = `${messageContent}<span class="time">${data.time}</span>`;
        socket.emit('message_read', { msgId: data.id });
    }
    
    chatMessages.appendChild(messageEl);

    if (data.type === 'sticker') {
        const newlyAddedImg = messageEl.querySelector('.dynamic-anim-sticker');
        if (newlyAddedImg) {
            manageStickerAnimation(newlyAddedImg);
        }
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('message_read_confirm', (data) => {
    const targetTick = document.querySelector(`[data-id="${data.msgId}"] .status-tick`);
    if (targetTick) {
        targetTick.innerText = "✓✓";
        targetTick.style.color = "#53bdeb";
    }
});

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