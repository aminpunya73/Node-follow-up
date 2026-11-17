require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenAI } = require('@google/genai');

// Token Bot Telegram dan API Key Gemini (Disimpan secara selamat dalam .env)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TELEGRAM_TOKEN || !GEMINI_API_KEY) {
  console.error('❌ [RALAT] Sila pastikan TELEGRAM_BOT_TOKEN dan GEMINI_API_KEY ditetapkan dalam fail .env');
  process.exit(1);
}

// Inisialisasi Bot Telegram dan SDK Gemini
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Senarai model Gemini utama & fallback pintar
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

console.log('=============================================================');
console.log('🤖 Bot Telegram Lelong & Gemini API sedang berjalan...');
console.log('=============================================================');

bot.getMe().then(me => {
  console.log(`[TELEGRAM] Disambungkan sebagai: @${me.username} (ID: ${me.id})`);
  console.log('[TELEGRAM] Bersedia menerima mesej daripada Private Chat, Channel, dan Group...\n');
}).catch(err => {
  console.error('[TELEGRAM] Ralat sambungan bot:', err.message);
});

// Respon kepada arahan /start
bot.onText(/\/start/, (msg) => {
  const welcomeText = `👋 Salam sejahtera!\n\nSaya adalah *Bot AI Analisis Hartanah Lelong Melaka*.\n\n📌 *Cara Penggunaan:*\n1. Hantar atau 'forward' sebarang teks iklan rumah lelong ke sini.\n2. Atau masukkan bot ini ke dalam *Channel Telegram* anda sebagai *Admin*.\n\nAI akan mengekstrak maklumat jenis rumah, lokasi, harga rizab, dan tarikh lelong secara automatik!`;
  bot.sendMessage(msg.chat.id, welcomeText, { parse_mode: 'Markdown' }).catch(() => {});
});

/**
 * Fungsi Pengekstrakan Iklan Lelong Menggunakan Gemini AI
 */
async function processMessage(msg) {
  const messageText = msg.text || msg.caption;
  if (!messageText) return;

  // Abaikan arahan /start kerana sudah diproses
  if (messageText.trim().startsWith('/start')) return;

  const chatId = msg.chat?.id;
  const isChannel = msg.chat?.type === 'channel' || !!msg.sender_chat;
  const sourceName = msg.chat?.title || msg.chat?.username || msg.from?.first_name || 'User';

  console.log(`\n=============================================================`);
  console.log(`📥 [Mesej Baru Diterima] ID: ${msg.message_id} | Jenis: ${msg.chat?.type || 'unknown'} | Sumber: ${sourceName}`);
  console.log(`Teks Iklan: "${messageText.substring(0, 150)}${messageText.length > 150 ? '...' : ''}"`);

  try {
    // Hantar status 'typing' di Telegram
    if (chatId) {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }

    const prompt = `
Anda adalah pembantu AI untuk analisis hartanah lelong di Malaysia. 
Sila ekstrak maklumat berikut dari teks iklan lelong di bawah dan berikan jawapan dalam format JSON sahaja (tanpa teks tambahan):
- jenis_hartanah (Contoh: Apartment, Rumah Teres, Tanah, dll)
- lokasi (Kawasan, Bandar, Negeri)
- harga_rizab (Nilai dalam RM)
- tarikh_lelong (Tarikh jika ada)
- link_rujukan (Jika ada)

Teks Iklan:
${messageText}
`;

    let responseText = null;
    let modelUsed = '';

    for (const model of GEMINI_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
        });
        responseText = response.text;
        modelUsed = model;
        break;
      } catch (err) {
        // Cuba model alternatif jika gagal
      }
    }

    if (responseText) {
      console.log(`\n--- Hasil Ekstrak Gemini [Model: ${modelUsed}] (JSON) ---`);
      console.log(responseText);

      // Bersihkan dan semak JSON
      const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = {};
      try {
        parsed = JSON.parse(cleanJsonStr);
      } catch (e) {
        parsed = { raw: cleanJsonStr };
      }

      // Balas semula ke Telegram jika diizinkan (Private chat atau channel)
      if (chatId && !isChannel) {
        const replyMessage = `✅ *Data Lelongan Berjaya Diekstrak (Gemini AI)*\n\n` +
          `🏠 *Jenis Hartanah:* ${parsed.jenis_hartanah || '-'}\n` +
          `📍 *Lokasi:* ${parsed.lokasi || '-'}\n` +
          `💰 *Harga Rizab:* ${parsed.harga_rizab || '-'}\n` +
          `📅 *Tarikh Lelong:* ${parsed.tarikh_lelong || '-'}\n` +
          `🔗 *Rujukan:* ${parsed.link_rujukan || '-'}`;

        await bot.sendMessage(chatId, replyMessage, {
          parse_mode: 'Markdown',
          reply_to_message_id: msg.message_id
        }).catch(err => {
          console.warn('[TELEGRAM] Tidak dapat membalas ke chat:', err.message);
        });
      }
    } else {
      console.error('❌ Ralat: Gagal memproses pengekstrakan dengan Gemini API.');
      if (chatId && !isChannel) {
        bot.sendMessage(chatId, '⚠️ Maaf, AI tidak dapat mengekstrak data daripada teks ini. Sila pastikan teks mengandungi butiran iklan lelong.', {
          reply_to_message_id: msg.message_id
        }).catch(() => {});
      }
    }

  } catch (error) {
    console.error('Ralat semasa memproses mesej:', error.message);
  }
}

// Dengar mesej dari semua sumber
bot.on('channel_post', processMessage);
bot.on('message', processMessage);
bot.on('edited_channel_post', processMessage);
bot.on('edited_message', processMessage);

bot.on('polling_error', (error) => {
  if (error.code !== 'EFATAL') {
    // abaikan polling error kecil
  }
  console.error('[TELEGRAM] Ralat polling:', error.code || error.message);
});

module.exports = bot;
