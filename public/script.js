const socket = io();
let aktifKullanici = "";

// Giriş Bilgileri (Server.js'deki bilgilerle aynı olmalı)
const HESAPLAR = {
    "senin_kullanici_adin": "senin_sifren",
    "x_kullanici_adi": "x_sifresi"
};

function girisYap() {
    const kAdi = document.getElementById('kullanici-adi').value;
    const sifre = document.getElementById('sifre').value;
    const hata = document.getElementById('hata-mesaji');

    if (HESAPLAR[kAdi] && HESAPLAR[kAdi] === sifre) {
        aktifKullanici = kAdi;
        document.getElementById('giris-ekrani').classList.add('gizli');
        document.getElementById('sohbet-ekrani').classList.remove('gizli');
        document.getElementById('giriş yapan-kullanici').innerText = `Giriş: ${kAdi}`;
    } else {
        hata.innerText = "Kullanıcı adı veya şifre hatalı!";
    }
}

function mesajGonder() {
    const girdi = document.getElementById('mesaj-girdisi');
    const mesajMetni = girdi.value.trim();

    if (mesajMetni !== "") {
        // Mesajı sunucuya gönderiyoruz
        socket.emit('yeni-mesaj', {
            gonderen: aktifKullanici,
            metin: mesajMetni
        });
        girdi.value = ""; // Kutuyu temizle
    }
}

// Sunucudan yeni bir mesaj geldiğinde çalışır
socket.on('mesaj-al', (data) => {
    const mesajlarAlani = document.getElementById('mesajlar-alani');
    const mesajKutusu = document.createElement('div');
    
    // Mesajı biz mi gönderdik yoksa karşı taraf mı?
    if (data.gonderen === aktifKullanici) {
        mesajKutusu.className = "mesaj benden";
    } else {
        mesajKutusu.className = "mesaj ondan";
    }

    mesajKutusu.innerHTML = `<span class="mesaj-sahibi">${data.gonderen}</span>${data.metin}`;
    mesajlarAlani.appendChild(mesajKutusu);
    
    // Sohbeti otomatik olarak en aşağı kaydır
    mesajlarAlani.scrollTop = mesajlarAlani.scrollHeight;
});

// Enter tuşuna basınca mesaj gönderme kolaylığı
document.getElementById('mesaj-girdisi')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        mesajGonder();
    }
});