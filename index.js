const { WebcastPushConnection } = require('tiktok-live-connector');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = '8775027588:AAGxK-SFS4GCj1mWWE3pvAZpcA9vulfsL6E';
const CHAT_ID = '-1004472646194';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const searchKeywords = ['canlı', 'hediye', 'sandık', 'game', 'gt', 'pk', 'oyun', 'yayın', 'takip', 'kesfet'];

// TikTok engeline takılmamak için aynı anda dinlenecek güvenli yayın sayısı
const BATCH_SIZE = 15;
let scannedUsers = new Set();

async function fetchLiveUsers(keyword) {
    try {
        const response = await fetch(`https://www.tiktok.com/api/search/item/full/?keyword=${encodeURIComponent(keyword)}&type=1`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const data = await response.json();
        const users = [];

        if (data && data.item_list) {
            data.item_list.forEach(item => {
                const username = item.author?.unique_id;
                if (username) {
                    users.push(username);
                }
            });
        }
        return users;
    } catch (err) {
        return [];
    }
}

async function startScan() {
    console.log("TikTok canlı yayıncıları aranıyor...");
    let targetUsers = [];

    for (const keyword of searchKeywords) {
        const users = await fetchLiveUsers(keyword);
        users.forEach(username => {
            if (!scannedUsers.has(username) && !targetUsers.includes(username)) {
                targetUsers.push(username);
            }
        });
        if (targetUsers.length >= BATCH_SIZE) break;
    }

    if (targetUsers.length === 0) {
        console.log("Yayın listesi yenileniyor, 3 saniye sonra tekrar denenecek...");
        scannedUsers.clear();
        setTimeout(startScan, 3000);
        return;
    }

    const currentBatch = targetUsers.slice(0, BATCH_SIZE);
    console.log(`>>> ${currentBatch.length} ADET YAYIN AYNI ANDA DİNLENİYOR...`);

    currentBatch.forEach(u => scannedUsers.add(u));

    await Promise.all(currentBatch.map(username => checkStream(username)));

    console.log(">>> TARAMA TAMAMLANDI. YENİ YAYINLARA GEÇİLİYOR...");
    startScan();
}

function checkStream(username) {
    return new Promise((resolve) => {
        let tiktokLive = new WebcastPushConnection(username);
        let hasChest = false;

        const timer = setTimeout(() => {
            if (!hasChest) {
                try { tiktokLive.disconnect(); } catch (e) {}
                resolve();
            }
        }, 10000);

        tiktokLive.connect().then(() => {
            console.log(`[Aktif] ${username}`);
        }).catch(() => {
            clearTimeout(timer);
            resolve();
        });

        tiktokLive.on('envelope', data => {
            hasChest = true;
            console.log(`🎉 SANDIK BULUNDU: ${username}`);

            const message = `🎁 **YENİ SANDIK BULUNDU!**\n\n` +
                            `👤 **Yayıncı:** ${username}\n` +
                            `💎 **Coin/Hediye:** ${data.coins || 'Bilinmiyor'}\n` +
                            `⏰ **Süre:** ${data.unpackDelay} saniye\n` +
                            `🔗 **Yayın Linki:** https://www.tiktok.com/@${username}/live`;

            bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' }).catch(() => {});

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

startScan();
