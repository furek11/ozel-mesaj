const socket = io();

let myUsername = "";

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');

const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatPartnerName = document.getElementById('chat-partner-name');

// Giriş Butonuna Basıldığında
loginBtn.addEventListener('click', () => {
    const pass = passwordInput.value.trim();
    if (pass) {
        socket.emit('auth', pass);
    }
});

// Giriş Başarılı ise
socket.on('auth_success', (data) => {
    myUsername = data.username;
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // Üst bar başlığını ayarla (Ben kimsem tepede diğeri yazsın mantığı)
    if (myUsername === "Biyolojinin Son Kalesi") {
        chatPartnerName.innerText = "Mat Dehası";
    } else {
        chatPartnerName.innerText = "Biyolojinin Son Kalesi";
    }
});

// Giriş Başarısız ise
socket.on('auth_fail', (msg) => {
    errorMsg.innerText = msg;
});

// Mesaj Gönderme
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        messageInput.value = '';
    }
}

// Mesaj Geldiğinde (WhatsApp Tipi Sağ/Sol Ayrımı)
socket.on('chat_message', (data) => {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message-wrapper');
    
    // Eğer mesajı ben gönderdiysem sağa, başkası gönderdiyse sola yasla
    if (data.sender === myUsername) {
        messageEl.innerHTML = `<div class="message my-message">${data.text}</div>`;
    } else {
        messageEl.innerHTML = `<div class="message other-message">${data.text}</div>`;
    }
    
    messagesBox.appendChild(messageEl);
    messagesBox.scrollTop = messagesBox.scrollHeight; // Otomatik aşağı kaydır
});