/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: PANGKALAN DATA & SISTEM PENGESAHAN LESEN RUMAH LELONG CRM
 * ==============================================================================
 * Panduan Pemasangan:
 * 1. Buka Google Sheets baharu di Google Drive anda.
 * 2. Klik Extensions -> Apps Script.
 * 3. Padamkan semua kod sedia ada dan tampal (paste) keseluruhan skrip ini.
 * 4. Jalankan fungsi "setupSheet()" sekali untuk mencipta semua jadual & data contoh.
 * 5. Klik "Deploy" -> "New deployment" -> Pilih jenis "Web app".
 * 6. Setkan:
 *    - Execute as: Me (akaun Google anda)
 *    - Who has access: Anyone
 * 7. Salin URL Web App (berakhir dengan /exec) dan masukkan ke fail .env atau Tetapan Sistem.
 * ==============================================================================
 */

// Nama Helaian (Sheet Tabs)
const SHEET_LEADS = "Leads_Lelong";
const SHEET_LICENSES = "Licenses_Master";
const SHEET_LOGS = "Activity_Logs";

/**
 * Pengendali Permintaan HTTP GET
 */
function doGet(e) {
  try {
    const action = e.parameter.action || "ping";

    if (action === "ping") {
      return jsonResponse({ success: true, message: "Google Apps Script CRM Lelong Online", timestamp: new Date() });
    }

    if (action === "getLeads") {
      return jsonResponse({ success: true, data: fetchAllLeads() });
    }

    if (action === "verifyLicense") {
      const licenseKey = e.parameter.licenseKey;
      const machineId = e.parameter.machineId;
      return jsonResponse(checkLicense(licenseKey, machineId));
    }

    return jsonResponse({ success: false, error: "Action tidak sah: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Pengendali Permintaan HTTP POST
 */
function doPost(e) {
  try {
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter || {};
    }

    const action = body.action;

    if (action === "verifyLicense") {
      return jsonResponse(checkLicense(body.licenseKey, body.machineId));
    }

    if (action === "saveLead") {
      return jsonResponse(saveOrUpdateLead(body.lead));
    }

    if (action === "updateStatus") {
      return jsonResponse(updateLeadStatus(body.leadId, body.status, body.dripStage, body.notes));
    }

    if (action === "logActivity") {
      return jsonResponse(addActivityLog(body.leadId, body.activity, body.details, body.status));
    }

    return jsonResponse({ success: false, error: "Action POST tidak sah: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Fungsi Pengesahan Lesen & Pengikatan Machine ID Komputer (Hardware-Bound)
 */
function checkLicense(licenseKey, machineId) {
  if (!licenseKey) {
    return { valid: false, message: "Kunci lesen (License Key) diperlukan." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LICENSES);
  if (!sheet) {
    return { valid: false, message: "Helaian " + SHEET_LICENSES + " belum dicipta. Sila jalankan setupSheet()." };
  }

  const data = sheet.getDataRange().getValues();
  // Header: [license_key, machine_id, nama_ejen, agensi, tarikh_luput, status, max_devices]
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const key = String(row[0]).trim();
    let boundMachine = String(row[1]).trim();
    const agentName = row[2];
    const agency = row[3];
    const expiry = new Date(row[4]);
    const status = String(row[5]).trim().toUpperCase();

    if (key === String(licenseKey).trim()) {
      // Semak tarikh luput
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expiry < today) {
        return { valid: false, status: "EXPIRED", message: "Lesen telah tamat tempoh pada " + expiry.toLocaleDateString("ms-MY") };
      }

      if (status !== "ACTIVE") {
        return { valid: false, status: status, message: "Status lesen adalah: " + status };
      }

      // Jika belum diikat ke mana-mana komputer, ikat sekarang (Auto-binding peranti pertama)
      if (!boundMachine && machineId) {
        sheet.getRange(i + 1, 2).setValue(machineId);
        boundMachine = machineId;
      }

      // Semak padanan perkakasan komputer
      if (machineId && boundMachine && boundMachine !== machineId) {
        return {
          valid: false,
          status: "DEVICE_MISMATCH",
          message: "Kunci lesen ini telah diikat kepada peranti komputer lain. Sila hubungi pentadbir untuk reset peranti."
        };
      }

      return {
        valid: true,
        status: "ACTIVE",
        agentName: agentName,
        agency: agency,
        expiryDate: expiry.toISOString().split("T")[0],
        message: "Lesen sah untuk " + agentName + " (" + agency + ")"
      };
    }
  }

  return { valid: false, status: "NOT_FOUND", message: "Kunci lesen tidak dijumpai dalam pangkalan data." };
}

/**
 * Simpan atau Kemas Kini Maklumat Prospek Rumah Lelong
 */
function saveOrUpdateLead(lead) {
  if (!lead || !lead.no_whatsapp) {
    return { success: false, error: "Nombor WhatsApp prospek diperlukan." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet) return { success: false, error: "Helaian " + SHEET_LEADS + " tidak dijumpai." };

  const cleanPhone = String(lead.no_whatsapp).replace(/[^0-9]/g, "");
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    const existingPhone = String(data[i][3]).replace(/[^0-9]/g, "");
    if (existingPhone === cleanPhone || (lead.lead_id && String(data[i][0]) === String(lead.lead_id))) {
      rowIndex = i + 1;
      break;
    }
  }

  const now = new Date();
  const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  if (rowIndex > 0) {
    // Kemas kini rekod sedia ada
    if (lead.nama) sheet.getRange(rowIndex, 3).setValue(lead.nama);
    if (lead.jenis_hartanah) sheet.getRange(rowIndex, 5).setValue(lead.jenis_hartanah);
    if (lead.lokasi) sheet.getRange(rowIndex, 6).setValue(lead.lokasi);
    if (lead.bajet) sheet.getRange(rowIndex, 7).setValue(lead.bajet);
    if (lead.deposit_ready !== undefined) sheet.getRange(rowIndex, 8).setValue(lead.deposit_ready);
    if (lead.loan_ready !== undefined) sheet.getRange(rowIndex, 9).setValue(lead.loan_ready);
    if (lead.status_rundingan) sheet.getRange(rowIndex, 10).setValue(lead.status_rundingan);
    if (lead.tahap_drip) sheet.getRange(rowIndex, 11).setValue(lead.tahap_drip);
    if (lead.tarikh_next_followup) sheet.getRange(rowIndex, 12).setValue(lead.tarikh_next_followup);
    if (lead.ringkasan_ai) sheet.getRange(rowIndex, 13).setValue(lead.ringkasan_ai);
    if (lead.nota_ejen) sheet.getRange(rowIndex, 14).setValue(lead.nota_ejen);

    return { success: true, updated: true, lead_id: data[rowIndex - 1][0] };
  } else {
    // Cipta ID Baharu: LD-LELONG-XXXX
    const newId = lead.lead_id || "LD-" + Utilities.formatDate(now, "GMT+8", "yyyyMMdd") + "-" + Math.floor(1000 + Math.random() * 9000);
    
    sheet.appendRow([
      newId,
      timestampStr,
      lead.nama || "Prospek WhatsApp",
      cleanPhone,
      lead.jenis_hartanah || "Rumah Lelong",
      lead.lokasi || "Belum Ditentukan",
      lead.bajet || "Belum Dinyatakan",
      lead.deposit_ready || "Belum Pasti",
      lead.loan_ready || "Belum Semak",
      lead.status_rundingan || "Baru",
      lead.tahap_drip || "Drip-0 (Mula)",
      lead.tarikh_next_followup || "",
      lead.ringkasan_ai || "Prospek baru masuk melalui WhatsApp",
      lead.nota_ejen || ""
    ]);

    return { success: true, created: true, lead_id: newId };
  }
}

/**
 * Kemas kini Status Saluran Jualan
 */
function updateLeadStatus(leadId, status, dripStage, notes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(leadId)) {
      if (status) sheet.getRange(i + 1, 10).setValue(status);
      if (dripStage) sheet.getRange(i + 1, 11).setValue(dripStage);
      if (notes) sheet.getRange(i + 1, 14).setValue(notes);
      return { success: true, message: "Status berjaya dikemaskini." };
    }
  }

  return { success: false, error: "Lead ID tidak dijumpai: " + leadId };
}

/**
 * Ambil Semua Rekod Prospek untuk Segerak ke Aplikasi Desktop
 */
function fetchAllLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const lead = {
      lead_id: row[0],
      tarikh_masuk: row[1],
      nama: row[2],
      no_whatsapp: row[3],
      jenis_hartanah: row[4],
      lokasi: row[5],
      bajet: row[6],
      deposit_ready: row[7],
      loan_ready: row[8],
      status_rundingan: row[9],
      tahap_drip: row[10],
      tarikh_next_followup: row[11],
      ringkasan_ai: row[12],
      nota_ejen: row[13]
    };
    results.push(lead);
  }

  return results;
}

/**
 * Log Aktiviti Penghantaran & Tindakan
 */
function addActivityLog(leadId, activity, details, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LOGS);
  if (!sheet) return { success: false };

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([timestamp, leadId || "SYSTEM", activity, details, status || "SUCCESS"]);
  return { success: true };
}

/**
 * Utiliti Menjana Respons JSON Selamat
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ==============================================================================
 * FUNGSI SETUP JADUAL & DATA PERMULAAN
 * Jalankan fungsi ini sekali sahaja di konsol script untuk membentuk pangkalan data.
 * ==============================================================================
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Cipta Tab Leads_Lelong
  let sLeads = ss.getSheetByName(SHEET_LEADS);
  if (!sLeads) {
    sLeads = ss.insertSheet(SHEET_LEADS);
  }
  sLeads.clear();
  const headersLeads = [
    "ID Prospek", "Tarikh Masuk", "Nama Prospek", "No WhatsApp",
    "Kategori Hartanah", "Lokasi Pilihan", "Bajet Maksimum", "Deposit 10% Sedia?",
    "Status Pinjaman", "Status Rundingan", "Tahap Drip", "Tarikh Next Follow-Up",
    "Ringkasan AI", "Nota Ejen"
  ];
  sLeads.appendRow(headersLeads);
  sLeads.getRange(1, 1, 1, headersLeads.length)
    .setBackground("#1E40AF")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  // Contoh Data Percubaan
  sLeads.appendRow([
    "LD-20261102-1001",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    "Ahmad Razif",
    "60123456789",
    "Kondo Lelong",
    "Shah Alam Seksyen 7",
    "RM 280,000",
    "Ya (Ada Tunai)",
    "Layak (Gaji RM4.8k)",
    "Layak (Semak POS)",
    "Drip-1",
    "Esok, 10:00 AM",
    "Sangat berminat unit Vista Alam. Tunai bank draft 10% sudah ada di Maybank.",
    "Beri senarai kos tunggakan maintenance sebelum bidaan."
  ]);

  // 2. Cipta Tab Licenses_Master
  let sLic = ss.getSheetByName(SHEET_LICENSES);
  if (!sLic) {
    sLic = ss.insertSheet(SHEET_LICENSES);
  }
  sLic.clear();
  const headersLic = [
    "License Key", "Machine ID (Bound)", "Nama Ejen",
    "Agensi", "Tarikh Luput", "Status", "Max Devices"
  ];
  sLic.appendRow(headersLic);
  sLic.getRange(1, 1, 1, headersLic.length)
    .setBackground("#0F172A")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  // Lesen Demo Sedia Digunakan
  sLic.appendRow([
    "LELONG-PRO-DEMO-2026",
    "", // Akan diisi automatik oleh machine-id pertama yang menggunakannya
    "Farhan Hakimi",
    "Hartanah Lelong Specialist Malaysia",
    "2028-12-31",
    "ACTIVE",
    1
  ]);

  // 3. Cipta Tab Activity_Logs
  let sLog = ss.getSheetByName(SHEET_LOGS);
  if (!sLog) {
    sLog = ss.insertSheet(SHEET_LOGS);
  }
  sLog.clear();
  const headersLog = ["Timestamp", "Lead ID", "Aktiviti", "Perincian", "Status"];
  sLog.appendRow(headersLog);
  sLog.getRange(1, 1, 1, headersLog.length)
    .setBackground("#334155")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  // Bekukan Baris Tajuk (Freeze Header)
  sLeads.setFrozenRows(1);
  sLic.setFrozenRows(1);
  sLog.setFrozenRows(1);

  Logger.log("Pangkalan Data Hartanah Lelong Berjaya Dicipta!");
}
