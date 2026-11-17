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

// Senarai model Gemini utama & fallback
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

console.log('=============================================================');
console.log('🤖 BOT TELEGRAM LELONG & GEMINI API SEDANG BERJALAN...');
console.log('=============================================================');

bot.getMe().then(me => {
  console.log(`[TELEGRAM] Disambungkan sebagai: @${me.username} (ID: ${me.id})`);
  console.log('[TELEGRAM] Bersedia menerima iklan lelong daripada channel / chat...\n');
}).catch(err => {
  console.error('[TELEGRAM] Ralat sambungan bot:', err.message);
});

/**
 * Fungsi Pengekstrakan Iklan Lelong Menggunakan Gemini AI
 */
async function processAuctionText(messageText, messageId, sourceName) {
  console.log(`\n-------------------------------------------------------------`);
  console.log(`📥 [Iklan Baharu Diterima] ID: ${messageId} | Sumber: ${sourceName}`);
  console.log(`Teks Asal:\n"${messageText.substring(0, 150)}${messageText.length > 150 ? '...' : ''}"`);

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

  let extractedText = null;
  let usedModel = '';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      extractedText = response.text;
      usedModel = model;
      break;
    } catch (err) {
      console.warn(`[GEMINI] Model ${model} tidak dapat digunakan (${err.message}). Mencuba model alternatif...`);
    }
  }

  if (extractedText) {
    console.log(`\n--- Hasil Ekstrak Gemini [Model: ${usedModel}] (JSON) ---`);
    console.log(extractedText);

    // Cuba parse JSON untuk pengesahan struktur
    try {
      const cleanJsonStr = extractedText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJsonStr);
      console.log('✅ Struktur JSON Berjaya Disahkan:', parsedData);
    } catch (parseErr) {
      console.log('ℹ️ Output diterima dalam bentuk teks JSON.');
    }
  } else {
    console.error('❌ Gagal mengekstrak iklan lelong menggunakan semua model Gemini yang tersedia.');
  }
}

/**
 * Pengendali Mesej (Channel Post & Mesej Biasa)
 */
async function handleIncomingMessage(msg) {
  // Semak mesej daripada channel atau chat biasa
  const isChannel = msg.chat?.type === 'channel' || !!msg.sender_chat;
  const messageText = msg.text || msg.caption;

  if (!messageText) return;

  const sourceName = msg.chat?.title || msg.chat?.username || msg.from?.first_name || 'Channel/User';
  await processAuctionText(messageText, msg.message_id, sourceName);
}

// Dengar kedua-dua channel_post (iklan channel) dan message (chat biasa / group)
bot.on('channel_post', handleIncomingMessage);
bot.on('message', handleIncomingMessage);

bot.on('polling_error', (error) => {
  // Jangan banjiri log dengan error polling kecil jika tiada internet
  console.error('[TELEGRAM] Ralat polling Telegram:', error.code || error.message);
});

module.exports = { bot, processAuctionText };
