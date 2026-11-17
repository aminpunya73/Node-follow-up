require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenAI } = require('@google/genai');

// Token Bot Telegram dan API Key Gemini (Disimpan secara selamat dalam fail .env)
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
  console.log('[TELEGRAM] Bersedia menerima mesej / siaran iklan lelong...\n');
}).catch(err => {
  console.error('[TELEGRAM] Ralat sambungan bot:', err.message);
});

async function processMessage(msg) {
  // Semak mesej datang dari channel atau chat peribadi/kumpulan
  const messageText = msg.text || msg.caption;
  if (!messageText) return;

  const sourceName = msg.chat?.title || msg.chat?.username || msg.from?.first_name || 'Channel/Chat';
  console.log(`\n[Mesej Baru Diterima] ID: ${msg.message_id} | Dari: ${sourceName}`);
  console.log(`Teks Iklan: "${messageText.substring(0, 120)}${messageText.length > 120 ? '...' : ''}"`);

  try {
    // Prompt arahan kepada Gemini untuk ekstrak data lelong
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
        // Cuba model seterusnya jika berlaku had atau ralat
      }
    }

    if (responseText) {
      console.log(`\n--- Hasil Ekstrak Gemini [Model: ${modelUsed}] (JSON) ---`);
      console.log(responseText);
    } else {
      console.error('❌ Ralat: Gagal memproses pengekstrakan dengan Gemini API.');
    }

  } catch (error) {
    console.error('Ralat semasa memproses dengan Gemini API:', error.message);
  }
}

// Dengar kedua-dua siaran channel (channel_post) dan mesej terus (message)
bot.on('channel_post', processMessage);
bot.on('message', processMessage);

bot.on('polling_error', (error) => {
  console.error('Ralat polling Telegram:', error.code || error.message);
});

module.exports = bot;
