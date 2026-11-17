require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenAI } = require('@google/genai');
const listingsManager = require('./src/services/listingsManager');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TELEGRAM_TOKEN || !GEMINI_API_KEY) {
  console.error('❌ [RALAT] Sila pastikan TELEGRAM_BOT_TOKEN dan GEMINI_API_KEY ditetapkan dalam fail .env');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

console.log('>>> Bot Telegram HartanahLelongBot berjaya dimulakan dan sedang mendengar mesej...');

const handleMessage = async (msg) => {
    const timeNow = new Date().toLocaleTimeString();
    console.log(`\n[${timeNow}] Mesej diterima! Chat ID: ${msg.chat.id} | Jenis: ${msg.chat.type}`);

    const text = msg.text || msg.caption;
    if (!text) {
        console.log('-> Mesej tidak mengandungi teks atau kapsyen.');
        return;
    }

    console.log(`-> Kandungan Teks: "${text.substring(0, 60)}..."`);

    try {
        const prompt = `
        Anda adalah pembantu AI untuk analisis hartanah lelong di Malaysia. 
        Sila ekstrak maklumat berikut dari teks iklan lelong di bawah dan berikan jawapan dalam format JSON sahaja (tanpa markdown atau teks lain):
        - jenis_hartanah
        - lokasi
        - harga_rizab
        - tarikh_lelong
        - link_rujukan

        Teks Iklan:
        ${text}
        `;

        let response;
        try {
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
        } catch (modelErr) {
            // Fallback automatik jika gemini-2.5-flash tidak tersedia
            response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
            });
        }

        const jsonResult = response.text;
        console.log('-> Hasil Gemini (JSON):', jsonResult);

        // Simpan unit ke dalam Pangkalan Data Katalog Langsung (untuk dijawab ke WhatsApp Business)
        try {
            const cleanJson = jsonResult.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(cleanJson);
            listingsManager.addListing(parsedData);
            console.log('-> ✅ Berjaya disegerakkan ke pangkalan data WhatsApp CRM.');
        } catch (e) {
            console.warn('-> Tidak dapat parse JSON untuk simpanan:', e.message);
        }

        // Hantar semula hasil JSON ke chat/channel sebagai pengesahan
        await bot.sendMessage(msg.chat.id, `🔍 *Hasil Ekstrak AI:*\n\`\`\`json\n${jsonResult}\n\`\`\``, { parse_mode: 'Markdown' });

    } catch (err) {
        console.error('-> Ralat memproses dengan Gemini:', err.message);
    }
};

bot.on('message', handleMessage);
bot.on('channel_post', handleMessage);

bot.on('polling_error', (error) => {
    console.error('Ralat Polling Telegram:', error.code || error.message);
});
