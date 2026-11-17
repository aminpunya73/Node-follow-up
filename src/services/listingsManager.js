const fs = require("fs");
const path = require("path");

const LISTINGS_FILE = path.join(__dirname, "../config/liveListings.json");

class ListingsManager {
  constructor() {
    this.listings = this.loadListings();
  }

  loadListings() {
    try {
      if (fs.existsSync(LISTINGS_FILE)) {
        const raw = fs.readFileSync(LISTINGS_FILE, "utf8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("[LISTINGS] Gagal membaca liveListings.json:", e.message);
    }
    return [];
  }

  saveListings() {
    try {
      fs.writeFileSync(LISTINGS_FILE, JSON.stringify(this.listings, null, 2), "utf8");
    } catch (e) {
      console.error("[LISTINGS] Gagal menyimpan liveListings.json:", e.message);
    }
  }

  addListing(rawItem) {
    if (!rawItem || (!rawItem.lokasi && !rawItem.jenis_hartanah)) return null;

    // Bersihkan nilai harga
    let hargaRaw = 0;
    if (rawItem.harga_rizab) {
      const match = rawItem.harga_rizab.replace(/,/g, "").match(/\d+/);
      if (match) hargaRaw = parseInt(match[0], 10);
    }

    // Kesan daerah di Melaka
    let daerah = "Melaka";
    const loc = (rawItem.lokasi || "").toLowerCase();
    if (loc.includes("alor gajah") || loc.includes("masjid tanah")) daerah = "Alor Gajah";
    else if (loc.includes("jasin") || loc.includes("merlimau")) daerah = "Jasin";
    else if (loc.includes("pokok mangga") || loc.includes("ayer keroh") || loc.includes("bukit katil") || loc.includes("klebang") || loc.includes("cheng") || loc.includes("batu berendam") || loc.includes("krubong") || loc.includes("melaka tengah")) {
      daerah = "Melaka Tengah";
    }

    const newItem = {
      id: "LST-" + Date.now().toString().slice(-6),
      jenis_hartanah: rawItem.jenis_hartanah || "Rumah Lelong",
      lokasi: rawItem.lokasi || "Melaka",
      harga_rizab: rawItem.harga_rizab || "Hubungi Ejen",
      harga_raw: hargaRaw,
      daerah: daerah,
      tarikh_lelong: rawItem.tarikh_lelong || "Akan Diumumkan",
      link_rujukan: rawItem.link_rujukan || "",
      tarikh_masuk: new Date().toISOString().split("T")[0]
    };

    // Semak duplikasi mengikut pautan atau lokasi
    const exists = this.listings.find(l => 
      (l.link_rujukan && l.link_rujukan === newItem.link_rujukan) ||
      (l.lokasi && l.lokasi.toLowerCase() === newItem.lokasi.toLowerCase())
    );

    if (exists) {
      Object.assign(exists, newItem);
      this.saveListings();
      return exists;
    }

    this.listings.unshift(newItem);
    if (this.listings.length > 100) this.listings = this.listings.slice(0, 100);
    this.saveListings();
    console.log(`[LISTINGS] ✅ Unit lelong baru berjaya disimpan: ${newItem.jenis_hartanah} (${newItem.harga_rizab})`);
    return newItem;
  }

  getListings(limit = 5) {
    return this.listings.slice(0, limit);
  }

  findMatchingListings({ type, maxBudget, location }) {
    return this.listings.filter(item => {
      let match = true;
      if (type && item.jenis_hartanah) {
        const t = type.toLowerCase();
        const it = item.jenis_hartanah.toLowerCase();
        if (t.includes("apartment") || t.includes("flat") || t.includes("kondo")) {
          match = match && (it.includes("apartment") || it.includes("flat") || it.includes("kondo"));
        } else if (t.includes("teres")) {
          match = match && it.includes("teres");
        } else if (t.includes("semi-d") || t.includes("semid")) {
          match = match && (it.includes("semi-d") || it.includes("semid"));
        }
      }

      if (maxBudget && item.harga_raw > 0) {
        match = match && (item.harga_raw <= maxBudget);
      }

      if (location && item.lokasi) {
        const l = location.toLowerCase();
        const il = (item.lokasi + " " + item.daerah).toLowerCase();
        match = match && il.includes(l);
      }

      return match;
    });
  }

  formatListingForWhatsApp(item) {
    return `🏠 *${item.jenis_hartanah}*\n` +
      `📍 *Lokasi:* ${item.lokasi}\n` +
      `💰 *Harga Rizab:* ${item.harga_rizab}\n` +
      `📅 *Tarikh Lelong:* ${item.tarikh_lelong}\n` +
      (item.link_rujukan ? `🔗 *Maklumat Penuh:* ${item.link_rujukan}\n` : "");
  }
}

module.exports = new ListingsManager();
