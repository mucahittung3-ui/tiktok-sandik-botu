const { WebcastPushConnection } = require('tiktok-live-connector');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = '8775027588:AAGxK-SFS4GCj1mWWE3pvAZpcA9vulfsL6E';
const CHAT_ID = '-1004472646194';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const searchKeywords = ['canlı', 'hediye', 'sandık', 'game', 'gt', 'pk'];
const activeConnections = new Map();

async function autoScan() {
    console.log("TikTok yayınları taranıyor...");

    for (const keyword of searchKeywords) {
        try {
            const response = await fetch(`https://www.tiktok.com/api/search/live/full/?keyword=${encodeURIComponent(keyword)}`);
            const data = await response.json();

            if (data && data.item_list) {
                data.item_list.forEach(item => {
                    const username = item.author.unique_id;
                    if (!activeConnections.has(username)) {
                        listenStream(username);
                    }
                });
            }
        } catch (err) {
            console.log(`Arama hatası (${keyword}):`, err.message);
        }
    }

    // 35 saniye sonra tüm canlı yayın bağlantılarını kapat ve çıkış yap
    setTimeout(() => {
        console.log("Tarama süresi doldu. Bağlantılar kapatılıyor...");
        
        for (const [username, connection] of activeConnections.entries()) {
            try {
                connection.disconnect();
            } catch (e) {}
        }
        
        console.log("İşlem başarıyla tamamlandı.");
        process.exit(0);
    }, 35000);
}

function listenStream(username) {
    let tiktokLive = new WebcastPushConnection(username);
    activeConnections.set(username, tiktokLive);

    tiktokLive.connect().then(() => {
        console.log(`[Aktif] ${username} yayını dinleniyor...`);
    }).catch(() => {
        activeConnections.delete(username);
    });

    tiktokLive.on('envelope', data => {
        const message = `🎁 **YENİ SANDIK BULUNDU!**\n\n` +
                        `👤 **Yayıncı:** ${username}\n` +
                        `💎 **Coin/Hediye:** ${data.coins || 'Bilinmiyor'}\n` +
                        `⏰ **Süre:** ${data.unpackDelay} saniye\n` +
                        `🔗 **Yayın Linki:** https://www.tiktok.com/@${username}/live`;

        bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    });

    tiktokLive.on('streamEnd', () => {
        activeConnections.delete(username);
    });
}

autoScan();
