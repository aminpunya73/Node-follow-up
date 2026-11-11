const sheetsClient = require("./sheetsClient");
const EventEmitter = require("events");

class LeadManager extends EventEmitter {
  constructor() {
    super();
    this.leads = [];
    this.initSampleData();
  }

  initSampleData() {
    this.leads = [
      {
        lead_id: "LD-20261102-1001",
        tarikh_masuk: "2026-11-02 14:20:00",
        nama: "Ahmad Razif",
        no_whatsapp: "60123456789",
        jenis_hartanah: "Kondo Lelong Vista Alam",
        lokasi: "Shah Alam Seksyen 7",
        bajet: "RM 280,000",
        deposit_ready: "Ya (Ada Tunai 10%)",
        loan_ready: "Layak (Gaji Bersih RM4.8k)",
        status_rundingan: "LAYAK_10_DEPOSIT",
        tahap_drip: "Drip-1 (24 Jam)",
        tarikh_next_followup: "Esok, 10:00 AM",
        ringkasan_ai: "Sangat berminat unit Vista Alam. Tunai bank draft 10% sudah sedia di Maybank. Menunggu POS.",
        nota_ejen: "Dapatkan POS dari pelelong esok."
      },
      {
        lead_id: "LD-20261102-1002",
        tarikh_masuk: "2026-11-02 16:45:00",
        nama: "Noraini Sulaiman",
        no_whatsapp: "60178899001",
        jenis_hartanah: "Teres 2 Tingkat Lelong",
        lokasi: "Bangi Seksyen 3",
        bajet: "RM 420,000",
        deposit_ready: "Belum Pasti (Tanya Full Loan)",
        loan_ready: "Belum Semak",
        status_rundingan: "DISARING_AI",
        tahap_drip: "Drip-0 (Mula)",
        tarikh_next_followup: "Hari ini, 08:00 PM",
        ringkasan_ai: "AI menerangkan bahawa lelongan wajib tunai 10%. Prospek sedang semak simpanan ASB.",
        nota_ejen: "Follow up status dividen ASB beliau."
      },
      {
        lead_id: "LD-20261102-1003",
        tarikh_masuk: "2026-11-01 10:15:00",
        nama: "Tan Wei Meng",
        no_whatsapp: "60163344552",
        jenis_hartanah: "Pangsapuri Servis Lelong",
        lokasi: "Cyberjaya",
        bajet: "RM 210,000",
        deposit_ready: "Ya (Tunai Sedia)",
        loan_ready: "Beli Tunai Penuh",
        status_rundingan: "DAFTAR_BIDAAN",
        tahap_drip: "Drip-3 (Peringatan Bidaan)",
        tarikh_next_followup: "Rabu, 09:30 AM",
        ringkasan_ai: "Pelabur berpengalaman. Bank draft atas nama Mahkamah Tinggi Shah Alam sudah disediakan.",
        nota_ejen: "Daftar bidaan online (e-Lelong) sebelum pukul 4 petang Selasa."
      }
    ];
  }

  async getAllLeads() {
    return this.leads;
  }

  getLeadById(id) {
    return this.leads.find(l => l.lead_id === id);
  }

  getLeadByPhone(phone) {
    const clean = String(phone).replace(/[^0-9]/g, "");
    return this.leads.find(l => String(l.no_whatsapp).replace(/[^0-9]/g, "").includes(clean) || clean.includes(String(l.no_whatsapp).replace(/[^0-9]/g, "")));
  }

  async addOrUpdateLead(leadData) {
    const cleanPhone = String(leadData.no_whatsapp || "").replace(/[^0-9]/g, "");
    let existing = this.getLeadByPhone(cleanPhone);

    if (existing) {
      Object.assign(existing, leadData);
      this.emit("leadUpdated", existing);
      sheetsClient.saveLead(existing).catch(() => {});
      return existing;
    } else {
      const newLead = {
        lead_id: leadData.lead_id || `LD-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(1000 + Math.random() * 9000)}`,
        tarikh_masuk: new Date().toISOString().replace("T", " ").substring(0, 19),
        nama: leadData.nama || "Prospek WhatsApp",
        no_whatsapp: cleanPhone,
        jenis_hartanah: leadData.jenis_hartanah || "Rumah Lelong",
        lokasi: leadData.lokasi || "Belum Ditentukan",
        bajet: leadData.bajet || "Belum Dinyatakan",
        deposit_ready: leadData.deposit_ready || "Belum Pasti",
        loan_ready: leadData.loan_ready || "Belum Semak",
        status_rundingan: leadData.status_rundingan || "BARU",
        tahap_drip: leadData.tahap_drip || "Drip-0 (Mula)",
        tarikh_next_followup: leadData.tarikh_next_followup || "Hari ini",
        ringkasan_ai: leadData.ringkasan_ai || "Prospek baru masuk dari WhatsApp",
        nota_ejen: leadData.nota_ejen || ""
      };
      this.leads.unshift(newLead);
      this.emit("leadCreated", newLead);
      sheetsClient.saveLead(newLead).catch(() => {});
      return newLead;
    }
  }

  async updateStage(leadId, newStage, notes = "") {
    const lead = this.getLeadById(leadId);
    if (!lead) return null;

    lead.status_rundingan = newStage;
    if (notes) lead.nota_ejen = notes;

    this.emit("leadUpdated", lead);
    sheetsClient.updateStatus(leadId, newStage, lead.tahap_drip, lead.nota_ejen).catch(() => {});
    return lead;
  }

  getMetrics() {
    return {
      total: this.leads.length,
      baru: this.leads.filter(l => l.status_rundingan === "BARU").length,
      disaring: this.leads.filter(l => l.status_rundingan === "DISARING_AI").length,
      layakDeposit10: this.leads.filter(l => l.status_rundingan === "LAYAK_10_DEPOSIT").length,
      semakPOS: this.leads.filter(l => l.status_rundingan === "SEMAK_POS_SITE_VISIT").length,
      daftarBidaan: this.leads.filter(l => l.status_rundingan === "DAFTAR_BIDAAN").length,
      menangLelong: this.leads.filter(l => l.status_rundingan === "MENANG_LELONG").length,
      kiv: this.leads.filter(l => l.status_rundingan === "KIV_TIADA_DEPOSIT").length
    };
  }
}

module.exports = new LeadManager();
