/**
 * Tetapan Pemalar & Status Saluran Rumah Lelong
 */
module.exports = {
  // Peringkat Saluran Kanban (Pipeline Stages)
  KANBAN_STAGES: [
    { id: "BARU", label: "Lead Masuk (Baru)", color: "border-blue-500", badge: "bg-blue-100 text-blue-800" },
    { id: "DISARING_AI", label: "Sedang Disaring AI", color: "border-indigo-500", badge: "bg-indigo-100 text-indigo-800" },
    { id: "LAYAK_10_DEPOSIT", label: "Layak (Ada Deposit 10%)", color: "border-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
    { id: "SEMAK_POS_SITE_VISIT", label: "Semak POS & Site Visit", color: "border-amber-500", badge: "bg-amber-100 text-amber-800" },
    { id: "DAFTAR_BIDAAN", label: "Daftar Bidaan (Bidding Day)", color: "border-purple-500", badge: "bg-purple-100 text-purple-800" },
    { id: "MENANG_LELONG", label: "Menang Lelong (Closed Won)", color: "border-green-600", badge: "bg-green-100 text-green-900" },
    { id: "KIV_TIADA_DEPOSIT", label: "KIV / Belum Cukup Modal", color: "border-slate-400", badge: "bg-slate-100 text-slate-700" }
  ],

  // Peringkat Drip Follow-Up
  DRIP_STAGES: {
    D0_INSTANT: "Drip-0 (Minit ke-0: Pengenalan & Saringan Deposit)",
    D1_LISTING: "Drip-1 (24 Jam: 3 Senarai Unit Berdekatan)",
    D2_CHECKLIST: "Drip-2 (72 Jam: Panduan POS & Semakan Tunggakan)",
    D3_BID_REMINDER: "Drip-3 (7 Hari: Tarikh Bidaan & Bantuan Ejen)",
    COMPLETED: "Drip-Selesai"
  },

  // Had Keselamatan Penghantaran
  ANTI_SPAM: {
    DEFAULT_MIN_DELAY_MS: 15000, // 15 saat
    DEFAULT_MAX_DELAY_MS: 35000, // 35 saat
    TYPING_SIMULATION_MIN_MS: 2000,
    TYPING_SIMULATION_MAX_MS: 4000
  }
};
