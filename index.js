const { WebcastPushConnection } = require('tiktok-live-connector');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = '8775027588:AAGxK-SFS4GCj1mWWE3pvAZpcA9vulfsL6E';
const CHAT_ID = '-1004472646194';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const searchKeywords = ['canlı', 'hediye', 'sandık', 'game', 'gt', 'pk'];

async function run() {
    console.log("Tarama başlatıldı...");

    for (const keyword of searchKeywords) {
        try {
            const res = await fetch(`https://www.tiktok.com/api/search/live/full/?keyword=${encodeURIComponent(keyword)}`);
            const data = await res.json();

            if (data && data.item_list) {
                for (const item of data.item_list.slice(0, 3)) { // Her kelimeden ilk 3 yayına bak
                    const username = item.author?.unique_id;
                    if (username) {
                        await checkStream(username);
                    }
                }
            }
        } catch (e) {
            console.log(`Hata (${keyword}):`, e.message);
        }
    }

    console.log("Tarama tamamlandı, sorunsuz çıkılıyor.");
    process.exit(0);
}

function checkStream(username) {
    return new Promise((resolve) => {
        let tiktokLive = new WebcastPushConnection(username);
        
        let timer = setTimeout(() => {
            try { tiktokLive.disconnect(); } catch(e){}
            resolve();
        }, 3000); // Her yayın için maks 3 saniye bekle

        tiktokLive.connect().then(() => {
            console.log(`[Kontrol Ediliyor] ${username}`);
        }).catch(() => {
            clearTimeout(timer);
            resolve();
        });

        tiktokLive.on('envelope', data => {
            const message = `🎁 **YENİ SANDIK BULUNDU!**\n\n` +
                            `👤 **Yayıncı:** ${username}\n` +
                            `💎 **Coin/Hediye:** ${data.coins || 'Bilinmiyor'}\n` +
                            `⏰ **Süre:** ${data.unpackDelay} saniye\n` +
                            `🔗 **Yayın Linki:** https://www.tiktok.com/@${username}/live`;

            bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' }).catch(() => {});
        });
    });
}

run();
