/**
 * =====================================================================
 * ENJIN WHATSAPP BAILEYS (MULTI-DEVICE & ANTI-BAN SAFE ENGINE)
 * =====================================================================
 * Ciri-ciri:
 * 1. Menjana Kod QR Resolusi Tinggi (320px) untuk imbasan mudah telefon.
 * 2. Menyokong Kaedah Pairing Code (Gandigan 8-Digit tanpa kamera).
 * 3. Penyambungan semula secara pintar (Auto-reconnect) & Reset Sesi.
 * 4. Perlindungan Anti-Ban: Jeda rawak (15-35 saat) dan simulasi menaip (composing).
 * 5. Integrasi langsung dengan Gemini AI & Knowledge Base Clean V2.
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const pino = require("pino");
const EventEmitter = require("events");
const geminiLelongAI = require("./geminiLelongAI");
const leadManager = require("./leadManager");
const sheetsClient = require("./sheetsClient");
const { ANTI_SPAM } = require("../config/constants");

class BaileysEngine extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.qrCodeDataUrl = null;
    this.rawQrString = null;
    this.connectionStatus = "DISCONNECTED"; // DISCONNECTED | CONNECTING | WAITING_QR_SCAN | CONNECTED | WAITING_PAIRING_CODE
    this.authFolder = path.join(process.cwd(), "auth_info_baileys");
    this.autoReplyEnabled = true;
    this.outgoingQueue = [];
    this.isProcessingQueue = false;
    this.isStarting = false;
    this.isPairingMode = false;
  }

  /**
   * Mulakan Sambungan Sesi WhatsApp (Mod Imbasan QR)
   */
  async start() {
    if (this.isStarting) return;
    this.isStarting = true;
    this.isPairingMode = false;

    try {
      this.connectionStatus = "CONNECTING";
      this.emit("statusChange", { status: this.connectionStatus });

      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      this.sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.windows("Desktop"),
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this.isPairingMode) {
          try {
            this.rawQrString = qr;
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              width: 320,
              margin: 2,
              errorCorrectionLevel: "M",
              color: { dark: "#000000", light: "#FFFFFF" }
            });
            this.connectionStatus = "WAITING_QR_SCAN";
            this.emit("qr", { qrDataUrl: this.qrCodeDataUrl, raw: qr });
            this.emit("statusChange", { status: this.connectionStatus });
            console.log("[BAILEYS] Kod QR resolusi tinggi sedia untuk diimbas.");
          } catch (e) {
            console.error("[BAILEYS] Ralat janaan QR:", e.message);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          this.connectionStatus = "DISCONNECTED";
          this.qrCodeDataUrl = null;
          this.rawQrString = null;
          this.isStarting = false;
          this.emit("statusChange", { status: this.connectionStatus, reason: statusCode });
          console.log(`[BAILEYS] Sambungan ditutup (${statusCode}). Is Logged Out: ${isLoggedOut}`);

          if (isLoggedOut) {
            console.log("[BAILEYS] Sesi lama tamat/invalid (401). Membersihkan fail sesi lama untuk janaan QR baharu...");
            try {
              if (fs.existsSync(this.authFolder)) {
                fs.rmSync(this.authFolder, { recursive: true, force: true });
                fs.mkdirSync(this.authFolder, { recursive: true });
              }
            } catch (e) {}
            setTimeout(() => this.start(), 2000);
          } else if (!this.isPairingMode) {
            setTimeout(() => this.start(), 4000);
          }
        } else if (connection === "open") {
          this.connectionStatus = "CONNECTED";
          this.qrCodeDataUrl = null;
          this.rawQrString = null;
          this.isPairingMode = false;
          this.emit("statusChange", { status: this.connectionStatus });
          console.log("[BAILEYS] ✅ Berjaya disambungkan ke WhatsApp Web!");
          this.isStarting = false;
        }
      });

      this.setupMessageListener();

    } catch (err) {
      console.error("[BAILEYS] Ralat memulakan soket WhatsApp:", err.message);
      this.connectionStatus = "ERROR";
      this.isStarting = false;
      this.emit("statusChange", { status: this.connectionStatus, error: err.message });
    }
  }

  /**
   * Minta Kod Gandingan (Pairing Code) 8-Digit Tanpa Kamera
   */
  async requestPairingCode(phoneNumber) {
    const clean = String(phoneNumber).replace(/[^0-9]/g, "");
    if (!clean || clean.length < 9) {
      throw new Error("Nombor telefon tidak sah. Sila sertakan kod negara (cth: 601123973138).");
    }

    this.isPairingMode = true;
    this.connectionStatus = "WAITING_PAIRING_CODE";
    this.qrCodeDataUrl = null;
    this.emit("statusChange", { status: this.connectionStatus });

    // Hentikan soket lama
    if (this.sock) {
      try { this.sock.end(); } catch (e) {}
      this.sock = null;
    }

    // Bersihkan sesi lama supaya WhatsApp menjana handshake baru
    if (fs.existsSync(this.authFolder)) {
      try {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        fs.mkdirSync(this.authFolder, { recursive: true });
      } catch (e) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

    this.sock = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.windows("Desktop"),
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        this.connectionStatus = "CONNECTED";
        this.isPairingMode = false;
        this.emit("statusChange", { status: this.connectionStatus });
        console.log("[BAILEYS] ✅ Berjaya disambungkan melalui Pairing Code!");
      }
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        console.log(`[BAILEYS] Sambungan pairing ditutup (${statusCode})`);
      }
    });

    this.setupMessageListener();

    // Beri masa 2 saat untuk soket bersedia
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[BAILEYS] Menjana Pairing Code rasmi WhatsApp untuk: ${clean}`);
    const code = await this.sock.requestPairingCode(clean);
    return code;
  }

  /**
   * Pendengar Mesej Masuk
   */
  setupMessageListener() {
    if (!this.sock) return;
    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        await this.handleIncomingMessage(msg);
      }
    });
  }

  /**
   * Padam Sesi & Sedia Kod QR Baharu (Fresh Reset)
   */
  async resetSession() {
    try {
      this.isPairingMode = false;
      if (this.sock) {
        try { await this.sock.logout(); } catch (e) {}
        try { this.sock.end(); } catch (e) {}
        this.sock = null;
      }

      this.connectionStatus = "DISCONNECTED";
      this.qrCodeDataUrl = null;
      this.rawQrString = null;
      this.isStarting = false;

      if (fs.existsSync(this.authFolder)) {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      console.log("[BAILEYS] Sesi lama dibersihkan. Memulakan sesi baru...");
      await this.start();
      return { success: true, message: "Sesi WhatsApp berjaya di-reset." };
    } catch (e) {
      console.error("[BAILEYS] Ralat reset sesi:", e.message);
      throw e;
    }
  }

  /**
   * Mengendalikan Mesej Masuk dari Prospek
   */
  async handleIncomingMessage(msg) {
    try {
      const fromJid = msg.key.remoteJid;
      if (fromJid.endsWith("@g.us") || fromJid.includes("broadcast") || fromJid === "status@broadcast") return;

      // Elakkan bot membalas mesej daripada akaun bot sendiri
      const myId = this.sock?.user?.id || "";
      const myCleanPhone = myId.split(":")[0].replace(/[^0-9]/g, "");
      const cleanFrom = fromJid.split("@")[0].replace(/[^0-9]/g, "");

      if (cleanFrom === myCleanPhone || (myCleanPhone && fromJid.includes(myCleanPhone))) {
        return;
      }

      const rawPhone = fromJid.replace("@s.whatsapp.net", "").replace("@lid", "");
      const senderName = msg.pushName || "Prospek";
      const messageBody = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          msg.message.imageMessage?.caption || "";

      if (!messageBody.trim()) return;

      console.log(`[BAILEYS] Mesej masuk dari ${rawPhone} (${senderName}): "${messageBody}"`);

      let lead = leadManager.getLeadByPhone(rawPhone);
      if (!lead) {
        lead = await leadManager.addOrUpdateLead({
          nama: senderName,
          no_whatsapp: rawPhone,
          status_rundingan: "BARU",
          tahap_drip: "Drip-0 (Mula)"
        });
      }

      this.emit("messageReceived", { phone: rawPhone, name: senderName, message: messageBody });

      if (this.autoReplyEnabled) {
        const aiResult = await geminiLelongAI.analyzeAndQualify(messageBody, lead);

        lead.deposit_ready = aiResult.deposit_10_status === "READY" ? "Ya (Ada Tunai 10%)" :
                            aiResult.deposit_10_status === "NOT_READY" ? "Belum Sedia (Perlukan Masa)" : "Sedang Disemak";
        lead.status_rundingan = aiResult.qualification_stage;
        lead.ringkasan_ai = aiResult.key_findings;
        if (aiResult.budget_detected) lead.bajet = aiResult.budget_detected;
        if (aiResult.location_detected) lead.lokasi = aiResult.location_detected;

        await leadManager.addOrUpdateLead(lead);

        if (aiResult.suggested_whatsapp_reply) {
          await this.queueMessage(fromJid, aiResult.suggested_whatsapp_reply, lead.lead_id);
        }
      }
    } catch (err) {
      console.error("[BAILEYS] Ralat mengendalikan mesej masuk:", err.message);
    }
  }

  /**
   * Masukkan Mesej ke Giliran Penghantaran Selamat (Safe Anti-Ban Queue)
   */
  async queueMessage(toJid, text, leadId = null) {
    this.outgoingQueue.push({ toJid, text, leadId });
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Proses Giliran Penghantaran Mesej
   */
  async processQueue() {
    if (this.outgoingQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const task = this.outgoingQueue.shift();

    try {
      if (this.sock && this.connectionStatus === "CONNECTED") {
        await this.sock.sendPresenceUpdate("composing", task.toJid);
        const typingDelay = Math.floor(Math.random() * (ANTI_SPAM.TYPING_SIMULATION_MAX_MS - ANTI_SPAM.TYPING_SIMULATION_MIN_MS)) + ANTI_SPAM.TYPING_SIMULATION_MIN_MS;
        await new Promise(r => setTimeout(r, typingDelay));

        await this.sock.sendPresenceUpdate("paused", task.toJid);
        await this.sock.sendMessage(task.toJid, { text: task.text });
        console.log(`[BAILEYS] Mesej berjaya dihantar ke ${task.toJid}`);

        this.emit("messageSent", { to: task.toJid, text: task.text, leadId: task.leadId });
        sheetsClient.logActivity(task.leadId, "HANTAR_MESEJ_AI", task.text.substring(0, 80) + "...").catch(() => {});
      } else {
        console.warn(`[BAILEYS] WhatsApp belum bersambung. Mesej dibatalkan untuk ${task.toJid}`);
      }
    } catch (err) {
      console.error(`[BAILEYS] Gagal menghantar mesej ke ${task.toJid}:`, err.message);
    }

    const nextDelay = Math.floor(Math.random() * (ANTI_SPAM.DEFAULT_MAX_DELAY_MS - ANTI_SPAM.DEFAULT_MIN_DELAY_MS)) + ANTI_SPAM.DEFAULT_MIN_DELAY_MS;
    setTimeout(() => this.processQueue(), nextDelay);
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      qrCodeDataUrl: this.qrCodeDataUrl,
      rawQrString: this.rawQrString,
      autoReply: this.autoReplyEnabled,
      queueLength: this.outgoingQueue.length,
      isPairingMode: this.isPairingMode
    };
  }
}

module.exports = new BaileysEngine();
