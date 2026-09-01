const { WebcastPushConnection } = require('tiktok-live-connector');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = '8775027588:AAGxK-SFS4GCj1mWWE3pvAZpcA9vulfsL6E';
const CHAT_ID = '-1004472646194';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const searchKeywords = ['canlı', 'hediye', 'sandık', 'game', 'gt', 'pk', 'oyun', 'yayın', 'takip'];

// Aynı anda taranacak yayın sayısı
const BATCH_SIZE = 61;
let scannedUsers = new Set();

async function startMultiScan() {
    console.log("TikTok üzerinde yayıncı havuzu toplanıyor...");
    let targets = [];

    // Anahtar kelimelerden yayıncı topla
    for (const keyword of searchKeywords) {
        try {
            const response = await fetch(`https://www.tiktok.com/api/search/live/full/?keyword=${encodeURIComponent(keyword)}`);
            const data = await response.json();

            if (data && data.item_list) {
                data.item_list.forEach(item => {
                    const username = item.author?.unique_id;
                    if (username && !scannedUsers.has(username) && !targets.includes(username)) {
                        targets.push(username);
                    }
                });
            }
        } catch (err) {
            console.log(`Arama hatası (${keyword}):`, err.message);
        }
    }

    // İlk 61 kişiyi gruba al
    const currentGroup = targets.slice(0, BATCH_SIZE);

    if (currentGroup.length === 0) {
        console.log("Yeni yayın bulunamadı, hafıza temizlenip tekrar taranıyor...");
        scannedUsers.clear();
        setTimeout(startMultiScan, 5000);
        return;
    }

    console.log(`>>> TOPLAM ${currentGroup.length} YAYIN AYNI ANDA TARANACAK...`);
    
    // 61 kişinin hepsini hafızaya ekle ki tekrar taranmasınlar
    currentGroup.forEach(u => scannedUsers.add(u));

    // 61 yayını aynı anda kontrol et
    await Promise.all(currentGroup.map(username => checkStreamWithTimeout(username)));

    console.log(">>> 61 YAYININ KONTROLÜ BİTTİ. BİR SONRAKİ 61 YAYINA GEÇİLİYOR...");
    
    // Beklemeden hemen yeni 61 adaya geç
    startMultiScan();
}

function checkStreamWithTimeout(username) {
    return new Promise((resolve) => {
        let tiktokLive = new WebcastPushConnection(username);
        let hasChest = false;

        // Her yayın için 12 saniye süre tanı (Sandık paketi genelde ilk 5-10 sn içinde gelir)
        const timer = setTimeout(() => {
            if (!hasChest) {
                // Sandık yoksa bağlantıyı kopar ve temizle
                try { tiktokLive.disconnect(); } catch (e) {}
                resolve();
            }
        }, 12000);

        tiktokLive.connect().then(() => {
            console.log(`[Bağlandı] ${username}`);
        }).catch(() => {
            clearTimeout(timer);
            resolve();
        });

        // Sandık (Envelope) yakalandığında
        tiktokLive.on('envelope', data => {
            hasChest = true;
            console.log(`🎉 SANDIK BULUNDU: ${username}`);
            
            const message = `🎁 **YENİ SANDIK BULUNDU!**\n\n` +
                            `👤 **Yayıncı:** ${username}\n` +
                            `💎 **Coin/Hediye:** ${data.coins || 'Bilinmiyor'}\n` +
                            `⏰ **Süre:** ${data.unpackDelay} saniye\n` +
                            `🔗 **Yayın Linki:** https://www.tiktok.com/@${username}/live`;

            bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
            
            clearTimeout(timer);
            try { tiktokLive.disconnect(); } catch (e) {}
            resolve();
        });

        tiktokLive.on('streamEnd', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

// Sistemi Başlat
startMultiScan();
            
