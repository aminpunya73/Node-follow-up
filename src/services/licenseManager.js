const crypto = require("crypto");
const os = require("os");
const sheetsClient = require("./sheetsClient");

class LicenseManager {
  constructor() {
    this.machineId = this.generateMachineId();
    this.cachedStatus = null;
    this.lastChecked = null;
  }

  /**
   * Menjana ID Unik Perkakasan Komputer (Hardware Fingerprint)
   */
  generateMachineId() {
    try {
      // Cuba gunakan node-machine-id jika sedia ada
      const { machineIdSync } = require("node-machine-id");
      return machineIdSync();
    } catch (e) {
      // Fallback perkakasan berasaskan maklumat CPU & Rangkaian OS
      const cpus = os.cpus().map(c => c.model).join(";");
      const network = JSON.stringify(os.networkInterfaces());
      const rawId = `${os.hostname()}_${os.platform()}_${cpus}_${network}`;
      return crypto.createHash("sha256").update(rawId).digest("hex").substring(0, 32);
    }
  }

  /**
   * Mengesahkan Lesen dengan Google Sheets
   */
  async verify(licenseKey) {
    const key = licenseKey || process.env.LICENSE_KEY || "LELONG-PRO-DEMO-2026";
    
    try {
      const result = await sheetsClient.verifyLicense(key, this.machineId);
      
      this.cachedStatus = {
        valid: result.valid === true,
        status: result.status || (result.valid ? "ACTIVE" : "INVALID"),
        agentName: result.agentName || process.env.AGENT_NAME || "Ejen Berdaftar",
        agency: result.agency || process.env.AGENCY_NAME || "Hartanah Agensi",
        expiryDate: result.expiryDate || "2028-12-31",
        machineId: this.machineId,
        licenseKey: key,
        message: result.message || "Lesen disahkan aktif."
      };
      this.lastChecked = new Date();
      return this.cachedStatus;
    } catch (err) {
      console.warn("[LICENSE] Ralat sambungan awan Google Sheet:", err.message);
      
      // Mod luar talian / fallback setempat jika baru memasang
      if (key === "LELONG-PRO-DEMO-2026") {
        return {
          valid: true,
          status: "ACTIVE_OFFLINE_DEMO",
          agentName: process.env.AGENT_NAME || "Farhan Hakimi (Demo)",
          agency: process.env.AGENCY_NAME || "Hartanah Lelong Specialist",
          expiryDate: "2028-12-31",
          machineId: this.machineId,
          licenseKey: key,
          message: "Mod Percubaan / Tempatan Aktif (Machine ID Terpaut)"
        };
      }

      return {
        valid: false,
        status: "NETWORK_ERROR",
        machineId: this.machineId,
        licenseKey: key,
        message: "Gagal berhubung dengan pangkalan data lesen Google Sheets: " + err.message
      };
    }
  }

  getStatus() {
    return this.cachedStatus || {
      valid: true,
      status: "PENDING_VERIFY",
      machineId: this.machineId,
      licenseKey: process.env.LICENSE_KEY || "LELONG-PRO-DEMO-2026"
    };
  }
}

module.exports = new LicenseManager();
