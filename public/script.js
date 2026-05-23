const socket = io();

let myUsername = "";
let partnerUsername = "";

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');

const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatPartnerStatus = document.getElementById('chat-partner-status');

loginBtn.addEventListener('click', () => {
    const pass = passwordInput.value.trim();
    if (pass) socket.emit('auth', pass);
});

socket.on('auth_success', (data) => {
    myUsername = data.username;
    partnerUsername = myUsername === "Biyolojinin Son Kalesi" ? "Mat Dehası" : "Biyolojinin Son Kalesi";
    
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    chatPartnerName.innerText = partnerUsername;
    
    // İlk girişte karşı tarafın durumunu ekrana bas
    updateStatusUI(data.statusList[partnerUsername]);
});

socket.on('auth_fail', (msg) => { errorMsg.innerText = msg; });

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        messageInput.value = '';
    }
}

// Mesaj Geldiğinde
socket.on('chat_message', (data) => {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message-wrapper');
    messageEl.setAttribute('data-id', data.id); // Tik güncellemesi için ID atıyoruz
    
    if (data.sender === myUsername) {
        // Benim mesajım: Tik işareti ekleniyor (Varsayılan: Tek Tik ✓)
        messageEl.innerHTML = `
            <div class="message my-message">
                ${data.text}
                <div class="message-meta">
                    <span class="time">${data.time}</span>
                    <span class="status-tick">✓</span>
                </div>
            </div>`;
    } else {
        // Karşı tarafın mesajı: Geldiği an "okundu" sinyali gönder
        messageEl.innerHTML = `
            <div class="message other-message">
                ${data.text}
                <div class="message-meta">
                    <span class="time">${data.time}</span>
                </div>
            </div>`;
        
        // Karşı tarafa okudum bilgisi gönderiyoruz
        socket.emit('message_read', { msgId: data.id });
    }
    
    messagesBox.appendChild(messageEl);
    messagesBox.scrollTop = messagesBox.scrollHeight;
});

// Karşı Taraf Mesajı Okuduğunda (Çift Mavi Tik Yapma)
socket.on('message_read_confirm', (data) => {
    const targetMsg = document.querySelector(`[data-id="${data.msgId}"] .status-tick`);
    if (targetMsg) {
        targetMsg.innerText = "✓✓";
        targetMsg.classList.add('read'); // Mavi renk sınıfı
    }
});

// Karşı Tarafın Çevrimiçi/Son Görülme Durumu Değiştiğinde
socket.on('status_change', (data) => {
    if (data.user === partnerUsername) {
        updateStatusUI(data.status);
    }
});

// Durum Yazısını Güncelleyen Yardımcı Fonksiyon
function updateStatusUI(statusObj) {
    if (statusObj.online) {
        chatPartnerStatus.innerText = "çevrimiçi";
        chatPartnerStatus.style.color = "#d9fdd3"; // Canlı yeşil tonu
    } else {
        chatPartnerStatus.innerText = `son görülmeBugün ${statusObj.lastSeen}`;
        chatPartnerStatus.style.color = "#f0f2f5";
    }
}