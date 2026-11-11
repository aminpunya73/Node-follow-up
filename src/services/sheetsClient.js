/**
 * Penghubung Klien API Google Apps Script & Google Sheets
 */
const https = require("https");
const http = require("http");
const url = require("url");

class SheetsClient {
  constructor() {
    this.scriptUrl = process.env.GOOGLE_SCRIPT_URL || "";
    this.localCacheLeads = [];
  }

  setScriptUrl(newUrl) {
    this.scriptUrl = newUrl;
  }

  /**
   * Pembantu Permintaan HTTP/HTTPS Generic dengan Pengendalian Redirect 302 Google Apps Script
   */
  async request(targetUrl, method = "GET", payload = null) {
    return new Promise((resolve, reject) => {
      if (!targetUrl || targetUrl.includes("AKfycb...")) {
        return reject(new Error("URL Google Apps Script belum dikonfigurasikan dalam .env atau Tetapan."));
      }

      const parsed = url.parse(targetUrl);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.path,
        method: method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "LelongCRM-NodeClient/1.0"
        }
      };

      if (payload && method === "POST") {
        const bodyStr = JSON.stringify(payload);
        options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
      }

      const req = client.request(options, (res) => {
        // Google Apps Script sering mengembalikan HTTP 302 Redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(this.request(res.headers.location, "GET", null));
        }

        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsedJson = JSON.parse(data);
            resolve(parsedJson);
          } catch (e) {
            resolve({ raw: data, statusCode: res.statusCode });
          }
        });
      });

      req.setTimeout(8000, () => {
        req.destroy(new Error("Google Apps Script request timeout (8s)"));
      });

      req.on("error", (err) => reject(err));

      if (payload && method === "POST") {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }

  /**
   * Sahkan Lesen dengan Google Sheets
   */
  async verifyLicense(licenseKey, machineId) {
    if (!this.scriptUrl || this.scriptUrl.includes("AKfycb...")) {
      // Mock verification untuk demo setempat
      return {
        valid: true,
        status: "ACTIVE",
        agentName: process.env.AGENT_NAME || "Farhan Hakimi",
        agency: process.env.AGENCY_NAME || "Hartanah Lelong Specialist",
        expiryDate: "2028-12-31",
        message: "Mod Percubaan / Tempatan Aktif"
      };
    }

    try {
      return await this.request(this.scriptUrl, "POST", {
        action: "verifyLicense",
        licenseKey,
        machineId
      });
    } catch (e) {
      console.warn("[SHEETS] Ralat semakan lesen Google Sheet:", e.message);
      return {
        valid: true,
        status: "ACTIVE_OFFLINE",
        message: "Lesen sah (Luar Talian)"
      };
    }
  }

  /**
   * Ambil Semua Prospek dari Google Sheet
   */
  async getLeads() {
    if (!this.scriptUrl || this.scriptUrl.includes("AKfycb...")) {
      return this.localCacheLeads;
    }

    try {
      const getUrl = `${this.scriptUrl}${this.scriptUrl.includes("?") ? "&" : "?"}action=getLeads`;
      const res = await this.request(getUrl, "GET");
      if (res && res.success && Array.isArray(res.data)) {
        this.localCacheLeads = res.data;
        return res.data;
      }
      return this.localCacheLeads;
    } catch (e) {
      console.warn("[SHEETS] Gagal mengambil senarai lead awan, menggunakan memori setempat:", e.message);
      return this.localCacheLeads;
    }
  }

  /**
   * Simpan atau Kemas Kini Prospek
   */
  async saveLead(lead) {
    // Simpan dalam memori setempat dahulu untuk UI pantas
    const existingIndex = this.localCacheLeads.findIndex(
      l => (lead.no_whatsapp && l.no_whatsapp === lead.no_whatsapp) || (lead.lead_id && l.lead_id === lead.lead_id)
    );

    if (existingIndex >= 0) {
      this.localCacheLeads[existingIndex] = { ...this.localCacheLeads[existingIndex], ...lead };
    } else {
      this.localCacheLeads.unshift(lead);
    }

    // Segerak ke Google Apps Script di latar belakang
    if (this.scriptUrl && !this.scriptUrl.includes("AKfycb...")) {
      try {
        await this.request(this.scriptUrl, "POST", { action: "saveLead", lead });
      } catch (err) {
        console.warn("[SHEETS] Segerak awan tertangguh:", err.message);
      }
    }

    return { success: true, lead };
  }

  /**
   * Kemaskini Status Peringkat Saluran (Kanban)
   */
  async updateStatus(leadId, status, dripStage, notes) {
    const lead = this.localCacheLeads.find(l => l.lead_id === leadId);
    if (lead) {
      if (status) lead.status_rundingan = status;
      if (dripStage) lead.tahap_drip = dripStage;
      if (notes) lead.nota_ejen = notes;
    }

    if (this.scriptUrl && !this.scriptUrl.includes("AKfycb...")) {
      try {
        await this.request(this.scriptUrl, "POST", {
          action: "updateStatus",
          leadId,
          status,
          dripStage,
          notes
        });
      } catch (e) {
        console.warn("[SHEETS] Kemaskini status awan tertangguh:", e.message);
      }
    }

    return { success: true };
  }

  /**
   * Log Aktiviti Sistem
   */
  async logActivity(leadId, activity, details, status = "SUCCESS") {
    if (this.scriptUrl && !this.scriptUrl.includes("AKfycb...")) {
      try {
        await this.request(this.scriptUrl, "POST", {
          action: "logActivity",
          leadId,
          activity,
          details,
          status
        });
      } catch (e) {
        // senyap
      }
    }
  }
}

module.exports = new SheetsClient();
