/**
 * ENJIN JADUAL DRIP FOLLOW-UP RUMAH LELONG (NODE-CRON)
 */

const cron = require("node-cron");
const leadManager = require("./leadManager");
const baileysEngine = require("./baileysEngine");
const { DRIP_TEMPLATES } = require("../config/auctionPrompts");
const sheetsClient = require("./sheetsClient");

class DripScheduler {
  constructor() {
    this.cronTask = null;
    this.isRunning = false;
  }

  /**
   * Mulakan Penjadual Automatik (Dijalankan setiap 30 minit)
   */
  start() {
    if (this.isRunning) return;

    console.log("[SCHEDULER] Enjin Drip Follow-Up diaktifkan (Semakan setiap 30 minit).");
    this.cronTask = cron.schedule("*/30 * * * *", async () => {
      await this.runFollowUpCycle();
    });

    this.isRunning = true;
  }

  /**
   * Jalankan Kitaran Semakan Follow-Up
   */
  async runFollowUpCycle() {
    try {
      const leads = await leadManager.getAllLeads();
      const now = new Date();
      console.log(`[SCHEDULER] Memulakan semakan susulan untuk ${leads.length} prospek...`);

      for (const lead of leads) {
        // Jangan follow-up jika kes sudah ditutup, menang, atau dibatalkan
        if (["MENANG_LELONG", "BATAL"].includes(lead.status_rundingan)) {
          continue;
        }

        const createdAt = new Date(lead.tarikh_masuk);
        const hoursPassed = (now - createdAt) / (1000 * 60 * 60);
        const jid = `${lead.no_whatsapp}@s.whatsapp.net`;

        // 1. Drip-1: 24 Jam Selepas Mesej Pertama (Jika belum terima unit)
        if (lead.tahap_drip === "Drip-0 (Mula)" && hoursPassed >= 24) {
          const text = DRIP_TEMPLATES.D1_LISTINGS(lead.nama, lead.lokasi, lead.bajet);
          await baileysEngine.queueMessage(jid, text, lead.lead_id);
          lead.tahap_drip = "Drip-1 (24 Jam: Senarai Unit)";
          lead.tarikh_next_followup = "Dalam 48 Jam (Checklist POS)";
          await leadManager.addOrUpdateLead(lead);
          sheetsClient.logActivity(lead.lead_id, "DRIP_1_SENT", "Senarai 3 unit lelong dihantar").catch(() => {});
        }
        // 2. Drip-2: 72 Jam (3 Hari) - Checklist POS & Site Visit
        else if (lead.tahap_drip.includes("Drip-1") && hoursPassed >= 72) {
          const text = DRIP_TEMPLATES.D3_AUCTION_CHECKLIST(lead.nama);
          await baileysEngine.queueMessage(jid, text, lead.lead_id);
          lead.tahap_drip = "Drip-2 (72 Jam: Checklist POS)";
          lead.tarikh_next_followup = "Dalam 4 Hari (Notis Bidaan)";
          await leadManager.addOrUpdateLead(lead);
          sheetsClient.logActivity(lead.lead_id, "DRIP_2_SENT", "Panduan semakan POS dihantar").catch(() => {});
        }
        // 3. Drip-3: 168 Jam (7 Hari) - Notis Peringatan Hari Bidaan
        else if (lead.tahap_drip.includes("Drip-2") && hoursPassed >= 168) {
          const text = DRIP_TEMPLATES.D7_BIDDING_NOTICE(lead.nama);
          await baileysEngine.queueMessage(jid, text, lead.lead_id);
          lead.tahap_drip = "Drip-3 (Selesai)";
          lead.tarikh_next_followup = "Selesai (Menunggu Respon)";
          await leadManager.addOrUpdateLead(lead);
          sheetsClient.logActivity(lead.lead_id, "DRIP_3_SENT", "Notis hari bidaan dihantar").catch(() => {});
        }
      }
    } catch (e) {
      console.error("[SCHEDULER] Ralat semasa kitaran follow-up:", e.message);
    }
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.isRunning = false;
      console.log("[SCHEDULER] Enjin Drip dihentikan.");
    }
  }
}

module.exports = new DripScheduler();
