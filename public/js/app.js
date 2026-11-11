/**
 * LOGIK ANTARA MUKA PENGGUNA (UI) & WEBSOCKET CLIENT
 */

let leadsData = [];
let ws = null;

document.addEventListener("DOMContentLoaded", () => {
  initWebSocket();
  loadInitialData();
});

/**
 * Inisialisasi Sambungan WebSocket Real-time
 */
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    addActivityLog("WebSocket bersambung ke pelayan setempat.", "info");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "STATUS_UPDATE") {
        updateWhatsAppUI(data.payload);
      } else if (data.type === "QR_UPDATE") {
        showQRCode(data.payload.qrDataUrl);
      } else if (data.type === "LEAD_UPDATE" || data.type === "LEAD_CREATE") {
        refreshLeads();
        addActivityLog(`Prospek dikemaskini: ${data.payload.nama} (${data.payload.status_rundingan})`, "success");
      } else if (data.type === "MESSAGE_RECEIVED") {
        addActivityLog(`Mesej masuk dari ${data.payload.phone}: "${data.payload.message}"`, "primary");
      } else if (data.type === "MESSAGE_SENT") {
        addActivityLog(`Mesej dihantar ke ${data.payload.to}: "${data.payload.text.substring(0, 50)}..."`, "info");
      }
    } catch (e) {
      console.error("Ralat WebSocket message:", e);
    }
  };

  ws.onclose = () => {
    addActivityLog("Sambungan WebSocket terputus, menyambung semula...", "warning");
    setTimeout(initWebSocket, 3000);
  };
}

/**
 * Muat Data Permulaan
 */
async function loadInitialData() {
  await Promise.all([refreshLeads(), checkSystemStatus()]);
}

/**
 * Semak Status Sistem (WhatsApp & Lesen)
 */
async function checkSystemStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    // Kemaskini WhatsApp Status
    if (data.whatsapp) {
      updateWhatsAppUI(data.whatsapp);
    }

    // Kemaskini Status Lesen
    if (data.license) {
      const licText = document.getElementById("licenseStatusText");
      const licBadge = document.getElementById("licenseBadge");
      if (data.license.valid) {
        licText.textContent = `Lesen: Sah (${data.license.agentName || "Ejen"})`;
        licBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700";
      } else {
        licText.textContent = `Lesen: ${data.license.status || "Tidak Sah"}`;
        licBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-700";
      }

      document.getElementById("settingMachineId").value = data.license.machineId || "";
      document.getElementById("settingLicenseKey").value = data.license.licenseKey || "";
    }

    if (data.config) {
      document.getElementById("settingScriptUrl").value = data.config.scriptUrl || "";
      document.getElementById("headerAgency").textContent = data.config.agencyName || "Hartanah Lelong Specialist";
    }
  } catch (err) {
    console.error("Gagal memeriksa status sistem:", err);
  }
}

/**
 * Kemaskini UI Sambungan WhatsApp
 */
function updateWhatsAppUI(wa) {
  const dot = document.getElementById("waStatusDot");
  const text = document.getElementById("waStatusText");
  const badge = document.getElementById("waStatusBadge");
  const authContainer = document.getElementById("authMethodsContainer");
  const connectedBanner = document.getElementById("connectedSuccessBanner");

  if (wa.status === "CONNECTED") {
    text.textContent = "WhatsApp: Bersambung";
    dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
    badge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700";
    
    if (authContainer) authContainer.classList.add("hidden");
    if (connectedBanner) connectedBanner.classList.remove("hidden");
    document.getElementById("waInstruction").textContent = "WhatsApp aktif. AI sedia menyaring prospek lelongan.";
  } else if (wa.status === "WAITING_QR_SCAN") {
    text.textContent = "WhatsApp: Menunggu Sambungan";
    dot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
    badge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700";
    
    if (authContainer) authContainer.classList.remove("hidden");
    if (connectedBanner) connectedBanner.classList.add("hidden");
    if (wa.qrCodeDataUrl) showQRCode(wa.qrCodeDataUrl);
  } else {
    text.textContent = "WhatsApp: Terputus";
    dot.className = "w-2.5 h-2.5 rounded-full bg-red-400";
    badge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-700";
    
    if (authContainer) authContainer.classList.remove("hidden");
    if (connectedBanner) connectedBanner.classList.add("hidden");
  }

  if (wa.autoReply !== undefined) {
    document.getElementById("autoReplyToggle").checked = wa.autoReply;
  }
}

function showQRCode(dataUrl) {
  const img = document.getElementById("qrImage");
  const ph = document.getElementById("qrPlaceholder");
  if (img && ph) {
    img.src = dataUrl;
    img.classList.remove("hidden");
    ph.classList.add("hidden");
  }
}

/**
 * Reset Sesi WhatsApp (Fresh Start)
 */
async function resetWhatsAppSession() {
  if (!confirm("Adakah anda pasti ingin reset kod QR WhatsApp ini? Ini akan memadam sesi lama dan menjana kod QR baharu.")) {
    return;
  }

  addActivityLog("Membersihkan sesi lama WhatsApp...", "warning");
  try {
    const res = await fetch("/api/whatsapp/reset", { method: "POST" });
    const data = await res.json();
    alert(data.message || "Sesi berjaya di-reset.");
    
    // Reset UI
    document.getElementById("qrImage").classList.add("hidden");
    document.getElementById("qrPlaceholder").classList.remove("hidden");
    
    checkSystemStatus();
  } catch (e) {
    alert("Ralat reset sesi: " + e.message);
  }
}

/**
 * Muat Semula Senarai Leads & Render Kanban Board
 */
async function refreshLeads() {
  try {
    const res = await fetch("/api/leads");
    const data = await res.json();
    leadsData = data.leads || [];

    // Kemaskini Metrik
    updateMetrics(data.metrics);

    // Bersihkan Kolum
    const columns = ["BARU", "DISARING_AI", "LAYAK_10_DEPOSIT", "SEMAK_POS_SITE_VISIT", "DAFTAR_BIDAAN", "MENANG_LELONG"];
    columns.forEach(col => {
      const el = document.getElementById(`col-${col}`);
      if (el) el.innerHTML = "";
      const countEl = document.getElementById(`count-${col}`);
      if (countEl) countEl.textContent = "0";
    });

    const colCounts = { BARU: 0, DISARING_AI: 0, LAYAK_10_DEPOSIT: 0, SEMAK_POS_SITE_VISIT: 0, DAFTAR_BIDAAN: 0, MENANG_LELONG: 0 };

    // Render Kad Prospek
    leadsData.forEach(lead => {
      const stage = mapStageToColumn(lead.status_rundingan);
      if (colCounts[stage] !== undefined) colCounts[stage]++;

      const colEl = document.getElementById(`col-${stage}`);
      if (colEl) {
        colEl.appendChild(createLeadCard(lead));
      }
    });

    // Kemaskini kaunter setiap kolum
    columns.forEach(col => {
      const countEl = document.getElementById(`count-${col}`);
      if (countEl) countEl.textContent = colCounts[col] || 0;
    });

    document.getElementById("kanbanCount").textContent = `${leadsData.length} Prospek Direkodkan`;

  } catch (err) {
    console.error("Gagal memuat senarai leads:", err);
  }
}

function mapStageToColumn(status) {
  if (status === "KIV_TIADA_DEPOSIT") return "MENANG_LELONG";
  return status || "BARU";
}

function updateMetrics(m) {
  if (!m) return;
  document.getElementById("metricTotal").textContent = m.total || 0;
  document.getElementById("metricDisaring").textContent = m.disaring || 0;
  document.getElementById("metricLayak").textContent = m.layakDeposit10 || 0;
  document.getElementById("metricPOS").textContent = m.semakPOS || 0;
  document.getElementById("metricBidaan").textContent = m.daftarBidaan || 0;
  document.getElementById("metricMenang").textContent = m.menangLelong || 0;
}

/**
 * Cipta Elemen Kad Prospek (Modern Corporate Card)
 */
function createLeadCard(lead) {
  const card = document.createElement("div");
  card.className = "bg-slate-50 hover:bg-white rounded-lg p-3.5 border border-slate-200 shadow-sm transition-all duration-200 space-y-2.5 text-xs hover:shadow";

  const isDepositReady = String(lead.deposit_ready).includes("Ya");
  const depositBadge = isDepositReady
    ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]"><i class="fa-solid fa-check mr-1"></i>Deposit 10% Sedia</span>`
    : `<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium text-[10px]"><i class="fa-solid fa-clock mr-1"></i>Deposit Belum Pasti</span>`;

  card.innerHTML = `
    <div class="flex items-start justify-between">
      <div>
        <h4 class="font-bold text-slate-800 text-sm">${escapeHtml(lead.nama)}</h4>
        <p class="text-[11px] text-slate-500 font-mono">${escapeHtml(lead.no_whatsapp)}</p>
      </div>
      <div>${depositBadge}</div>
    </div>

    <div class="bg-white p-2 rounded border border-slate-100 space-y-1">
      <div class="flex items-center text-slate-600">
        <i class="fa-solid fa-house-chimney text-blue-500 w-4"></i>
        <span class="font-medium">${escapeHtml(lead.jenis_hartanah || "Rumah Lelong")}</span>
      </div>
      <div class="flex items-center text-slate-500 text-[11px]">
        <i class="fa-solid fa-location-dot text-rose-500 w-4"></i>
        <span>${escapeHtml(lead.lokasi || "Lokasi belum dinyatakan")}</span>
      </div>
      <div class="flex items-center text-slate-700 font-semibold text-[11px]">
        <i class="fa-solid fa-tag text-emerald-600 w-4"></i>
        <span>Bajet: ${escapeHtml(lead.bajet || "-")}</span>
      </div>
    </div>

    ${lead.ringkasan_ai ? `
      <div class="bg-indigo-50/70 p-2 rounded border border-indigo-100 text-[11px] text-indigo-900 leading-tight">
        <strong class="font-semibold text-indigo-950 block mb-0.5"><i class="fa-solid fa-robot mr-1 text-indigo-600"></i>AI Saringan:</strong>
        ${escapeHtml(lead.ringkasan_ai)}
      </div>
    ` : ""}

    <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
      <span><i class="fa-solid fa-hourglass-half mr-1"></i>${escapeHtml(lead.tahap_drip || "Drip-0")}</span>
      <span class="text-blue-600 font-medium">${escapeHtml(lead.tarikh_next_followup || "")}</span>
    </div>

    <div class="flex items-center space-x-1.5 pt-1">
      <!-- Quick Action: Direct WhatsApp -->
      <a href="https://wa.me/${lead.no_whatsapp}" target="_blank" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-center font-semibold text-[11px] transition shadow-xs flex items-center justify-center space-x-1">
        <i class="fa-brands fa-whatsapp text-sm"></i>
        <span>Chat</span>
      </a>

      <!-- Quick Action: Move Stage -->
      <button onclick="promptNextStage('${lead.lead_id}')" class="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 font-medium text-[11px] transition" title="Tukar Peringkat Saluran">
        <i class="fa-solid fa-arrow-right-arrow-left"></i>
      </button>
    </div>
  `;

  return card;
}

/**
 * Tukar Peringkat Status Saluran
 */
async function promptNextStage(leadId) {
  const stages = [
    { id: "BARU", name: "1. Lead Masuk (Baru)" },
    { id: "DISARING_AI", name: "2. Sedang Disaring AI" },
    { id: "LAYAK_10_DEPOSIT", name: "3. Layak (Ada Tunai 10%)" },
    { id: "SEMAK_POS_SITE_VISIT", name: "4. Semak POS & Site Visit" },
    { id: "DAFTAR_BIDAAN", name: "5. Daftar Bidaan Mahkamah" },
    { id: "MENANG_LELONG", name: "6. Menang Lelong (Selesai)" }
  ];

  const selection = prompt(
    "Pilih nombor peringkat baharu:\n" +
    stages.map((s, idx) => `${idx + 1}. ${s.name}`).join("\n")
  );

  const idx = parseInt(selection) - 1;
  if (stages[idx]) {
    try {
      await fetch("/api/leads/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, stage: stages[idx].id })
      });
      refreshLeads();
    } catch (e) {
      alert("Gagal menukar status: " + e.message);
    }
  }
}

/**
 * Log Aktiviti UI
 */
function addActivityLog(text, type = "info") {
  const container = document.getElementById("activityLogs");
  const time = new Date().toLocaleTimeString("ms-MY");
  const row = document.createElement("div");
  row.className = "flex items-start space-x-2";

  let icon = '<i class="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>';
  if (type === "success") icon = '<i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>';
  if (type === "warning") icon = '<i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>';
  if (type === "primary") icon = '<i class="fa-solid fa-comment-dots text-indigo-500 mt-0.5"></i>';

  row.innerHTML = `
    <span class="text-slate-400 font-mono text-[10px] shrink-0">[${time}]</span>
    ${icon}
    <span class="text-slate-700">${escapeHtml(text)}</span>
  `;

  container.prepend(row);
}

/**
 * Kawalan WhatsApp
 */
async function reconnectWhatsApp() {
  addActivityLog("Memulakan semula sambungan WhatsApp...", "warning");
  await fetch("/api/whatsapp/reconnect", { method: "POST" });
}

async function toggleAutoReply() {
  const enabled = document.getElementById("autoReplyToggle").checked;
  await fetch("/api/whatsapp/auto-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  addActivityLog(`AI Auto-Reply ${enabled ? "Diaktifkan" : "Dinyahaktifkan"}.`, "info");
}

/**
 * Modal & Tetapan
 */
function openSettingsModal() { document.getElementById("settingsModal").classList.remove("hidden"); }
function closeSettingsModal() { document.getElementById("settingsModal").classList.add("hidden"); }

function openAddLeadModal() { document.getElementById("addLeadModal").classList.remove("hidden"); }
function closeAddLeadModal() { document.getElementById("addLeadModal").classList.add("hidden"); }

function copyMachineId() {
  const input = document.getElementById("settingMachineId");
  input.select();
  navigator.clipboard.writeText(input.value);
  alert("Machine ID disalin: " + input.value);
}

async function saveSettings() {
  const scriptUrl = document.getElementById("settingScriptUrl").value;
  const geminiKey = document.getElementById("settingGeminiKey").value;
  const licenseKey = document.getElementById("settingLicenseKey").value;

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptUrl, geminiKey, licenseKey })
    });
    const data = await res.json();
    alert(data.message || "Tetapan disimpan!");
    closeSettingsModal();
    checkSystemStatus();
  } catch (e) {
    alert("Ralat menyimpan tetapan: " + e.message);
  }
}

async function submitNewLead() {
  const nama = document.getElementById("newLeadName").value.trim();
  const no_whatsapp = document.getElementById("newLeadPhone").value.trim();
  const jenis_hartanah = document.getElementById("newLeadProperty").value.trim();
  const bajet = document.getElementById("newLeadBudget").value.trim();
  const deposit_ready = document.getElementById("newLeadDeposit").value;

  if (!nama || !no_whatsapp) {
    alert("Sila masukkan nama dan nombor WhatsApp prospek.");
    return;
  }

  try {
    await fetch("/api/leads/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        no_whatsapp,
        jenis_hartanah,
        bajet,
        deposit_ready,
        status_rundingan: deposit_ready.includes("Ya") ? "LAYAK_10_DEPOSIT" : "BARU"
      })
    });
    closeAddLeadModal();
    refreshLeads();
    addActivityLog(`Lead manual ditambah: ${nama} (${no_whatsapp})`, "success");
  } catch (e) {
    alert("Ralat menambah lead: " + e.message);
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
