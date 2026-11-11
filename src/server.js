/**
 * ==============================================================================
 * PELAYAN UTAMA APLIKASI CRM RUMAH LELONG & AI WHATSAPP FOLLOW-UP
 * ==============================================================================
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");

// Modul & Servis Dalaman
const baileysEngine = require("./services/baileysEngine");
const leadManager = require("./services/leadManager");
const licenseManager = require("./services/licenseManager");
const sheetsClient = require("./services/sheetsClient");
const geminiLelongAI = require("./services/geminiLelongAI");
const scheduler = require("./services/scheduler");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

/**
 * ==============================================================================
 * PENGENDALI WEBSOCKET & PENYIARAN MASA NYATA (REAL-TIME BROADCASTING)
 * ==============================================================================
 */
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Hubungkan Event Baileys ke WebSocket UI
baileysEngine.on("statusChange", data => broadcast("STATUS_UPDATE", data));
baileysEngine.on("qr", data => broadcast("QR_UPDATE", data));
baileysEngine.on("messageReceived", data => broadcast("MESSAGE_RECEIVED", data));
baileysEngine.on("messageSent", data => broadcast("MESSAGE_SENT", data));

// Hubungkan Event LeadManager ke WebSocket UI
leadManager.on("leadCreated", lead => broadcast("LEAD_CREATE", lead));
leadManager.on("leadUpdated", lead => broadcast("LEAD_UPDATE", lead));

/**
 * ==============================================================================
 * REST API ENDPOINTS
 * ==============================================================================
 */

// 1. Status Sistem & Pengesahan Lesen
app.get("/api/status", async (req, res) => {
  const licenseStatus = await licenseManager.verify();
  const waStatus = baileysEngine.getStatus();

  // Jika terputus dan tiada kod QR dijana, mulakan soket semula secara automatik
  if (waStatus.status === "DISCONNECTED" && !waStatus.qrCodeDataUrl) {
    baileysEngine.start();
  }

  res.json({
    license: licenseStatus,
    whatsapp: waStatus,
    config: {
      scriptUrl: process.env.GOOGLE_SCRIPT_URL,
      agentName: process.env.AGENT_NAME,
      agencyName: process.env.AGENCY_NAME
    }
  });
});

// 2. Senarai Prospek & Metrik Saluran
app.get("/api/leads", async (req, res) => {
  const leads = await leadManager.getAllLeads();
  const metrics = leadManager.getMetrics();
  res.json({ success: true, leads, metrics });
});

// 3. Tambah Prospek Baharu (Manual)
app.post("/api/leads/add", async (req, res) => {
  try {
    const lead = await leadManager.addOrUpdateLead(req.body);
    res.json({ success: true, lead });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. Kemas Kini Peringkat Saluran Kanban
app.post("/api/leads/stage", async (req, res) => {
  const { leadId, stage, notes } = req.body;
  try {
    const lead = await leadManager.updateStage(leadId, stage, notes);
    res.json({ success: true, lead });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. Sambung Semula WhatsApp
app.post("/api/whatsapp/reconnect", async (req, res) => {
  baileysEngine.start();
  res.json({ success: true, message: "Penyambungan semula WhatsApp dimulakan." });
});

// 5b. Reset Sesi WhatsApp (Fresh Start)
app.post("/api/whatsapp/reset", async (req, res) => {
  try {
    await baileysEngine.resetSession();
    res.json({ success: true, message: "Sesi WhatsApp telah di-reset dan kod baharu sedia dijana." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5c. Minta Pairing Code 8-Digit (Tanpa Imbas Kamera)
app.post("/api/whatsapp/pair", async (req, res) => {
  const { phone } = req.body;
  try {
    const pairingCode = await baileysEngine.requestPairingCode(phone);
    res.json({ success: true, pairingCode });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 6. Togol Auto-Reply AI
app.post("/api/whatsapp/auto-reply", (req, res) => {
  const { enabled } = req.body;
  baileysEngine.autoReplyEnabled = !!enabled;
  res.json({ success: true, autoReply: baileysEngine.autoReplyEnabled });
});

// 7. Simpan Tetapan
app.post("/api/settings", async (req, res) => {
  const { scriptUrl, geminiKey, licenseKey } = req.body;

  if (scriptUrl) {
    sheetsClient.setScriptUrl(scriptUrl);
    process.env.GOOGLE_SCRIPT_URL = scriptUrl;
  }
  if (geminiKey) {
    geminiLelongAI.setApiKey(geminiKey);
    process.env.GEMINI_API_KEY = geminiKey;
  }
  if (licenseKey) {
    process.env.LICENSE_KEY = licenseKey;
  }

  const lic = await licenseManager.verify(licenseKey);
  res.json({ success: true, message: "Tetapan berjaya disimpan.", license: lic });
});

/**
 * ==============================================================================
 * TITIK MULA PELAYAN (STARTUP SEQUENCE)
 * ==============================================================================
 */
server.listen(PORT, async () => {
  console.log("=================================================================");
  console.log(`🚀 CRM RUMAH LELONG & AI WHATSAPP BERJALAN DI PORT http://localhost:${PORT}`);
  console.log("=================================================================");

  // 1. Sahkan Lesen Komputer
  const lic = await licenseManager.verify();
  console.log(`[LESEN] Status: ${lic.status} | Ejen: ${lic.agentName} | Machine ID: ${lic.machineId}`);

  // 2. Mulakan Enjin Drip Scheduler
  scheduler.start();

  // 3. Mulakan Enjin WhatsApp Baileys (Hanya jika bukan mod ujian/CI)
  if (process.env.NODE_ENV !== "test") {
    baileysEngine.start();
  }
});

module.exports = { app, server };
