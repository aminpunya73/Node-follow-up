# CRM Rumah Lelong & Enjin AI WhatsApp Follow-Up

Sistem Pengurusan Pelanggan (CRM) pintar dan ringan yang dibina khas untuk **Ejen & Perunding Hartanah Lelong di Malaysia**. Sistem ini memusatkan pengurusan prospek, menyaring kelayakan deposit 10% tunai secara automatik menggunakan **Google Gemini AI**, dan menjalankan urutan *drip follow-up* WhatsApp secara automatik menggunakan **Baileys WebSocket Engine** berintegrasi dengan pangkalan data awan percuma **Google Sheets**.

---

## 🌟 Ciri-Ciri Utama Sistem

1. **Enjin WhatsApp Pantas & Ringan (Baileys):**
   - Beroperasi terus melalui protokol rasmi WhatsApp Web tanpa memerlukan pelayar Chromium berat (jimat RAM komputer).
   - Menjana kod QR interaktif di papan pemuka untuk imbasan pantas.
   - Dilengkapi sistem perlindungan Anti-Ban: jeda rawak 15-35 saat dan simulasi ejen sedang menaip (*typing presence*).

2. **Saringan Kelayakan Automatik Rumah Lelong (Gemini AI Engine):**
   - Menapis secara automatik sama ada prospek mempunyai **10% Tunai / Bank Draft** (syarat wajib pelelong/mahkamah).
   - Menerangkan secara berhemah mengenai konsep bidaan (*As-Is-Where-Is*, tiada *Full Loan* pada hari bidaan, dan tempoh 90-120 hari untuk selesaikan baki pinjaman 90%).
   - Menyusun prospek terus ke peringkat saluran jualan yang tepat.

3. **Saluran Jualan Kanban (6 Peringkat Khas Lelong):**
   - 📥 **1. Lead Masuk (Baru)**
   - 🔍 **2. Sedang Disaring AI**
   - 💰 **3. Layak (Ada Deposit 10%)**
   - 📑 **4. Semak POS & Site Visit**
   - 🔨 **5. Daftar Bidaan (Bidding Day)**
   - 🏆 **6. Menang Lelong (Closed Won) / KIV**

4. **Pangkalan Data Percuma & Sistem Lesen Komputer (Google Sheets):**
   - Segala data prospek diselaraskan ke Google Sheets secara automatik.
   - Pengesahan lesen perkakasan (*Machine ID Fingerprint*) untuk mengelakkan perkongsian perisian tanpa kebenaran.

5. **Kitaran Drip Follow-Up Berjadual:**
   - **D+0 (Minit ke-0):** Balasan pengenalan segera dan soalan bajet/lokasi.
   - **D+1 (24 Jam):** Senarai 3 unit lelong berpotensi tinggi dengan diskaun sehingga 30%.
   - **D+3 (72 Jam):** 3 Checklist Wajib sebelum masuk dewan lelong (Site visit, semakan tunggakan maintenance & cukai pintu).
   - **D+7 (7 Hari):** Notis peringatan tarikh tutup pendaftaran bidaan.

---

## 🚀 Panduan Pemasangan & Penggunaan Pantas

### Langkah 1: Pasang Dependensi
Buka terminal (PowerShell / Command Prompt) di dalam folder projek:
```bash
npm install
```

### Langkah 2: Sediakan Pangkalan Data Google Sheets
1. Buka [Google Sheets](https://sheets.new) baharu di akaun Google anda.
2. Klik menu **Extensions** > **Apps Script**.
3. Padam kod asal, dan salin (copy) keseluruhan kandungan dari fail:
   👉 `google-apps-script/Code.gs`
4. Pilih fungsi `setupSheet` di bahagian atas bar alat dan klik **Run**.
   *(Semua helaian `Leads_Lelong`, `Licenses_Master`, dan `Activity_Logs` akan dicipta dengan susun atur korporat secara automatik)*.
5. Klik butang biru **Deploy** > **New deployment** > Pilih ikon gear **Web app**.
6. Tetapkan:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
7. Klik **Deploy**, beri kebenaran akaun Google, dan salin **Web App URL** (berakhir dengan `/exec`).

### Langkah 3: Konfigurasi Fail `.env`
Buka fail `.env` dan masukkan:
```env
PORT=3000
GEMINI_API_KEY=Kunci_API_Gemini_Anda
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
LICENSE_KEY=LELONG-PRO-DEMO-2026
```
*(Nota: Kunci Gemini API boleh didapati secara percuma di [Google AI Studio](https://aistudio.google.com/))*.

### Langkah 4: Jalankan Aplikasi
Jalankan arahan:
```bash
npm start
```
Buka pelayar web anda di:
👉 **`http://localhost:3000`**

---

## 📱 Menyambungkan WhatsApp
1. Di Dashboard, lihat kad **Sambungan Enjin WhatsApp Baileys**.
2. Buka aplikasi WhatsApp di telefon bimbit anda.
3. Pergi ke **Settings** > **Linked Devices** > **Link a Device**.
4. Imbas Kod QR yang terpapar di skrin dashboard.
5. Status akan bertukar kepada **"WhatsApp: Bersambung"** berwarna hijau. Sistem sedia membalas mesej prospek secara automatik!

---

## 🧪 Menjalankan Ujian Automatik (Test Suite)
Untuk memastikan kesemua enjin saringan AI, lesen perkakasan, dan pengurusan lead berfungsi dengan sempurna:
```bash
npm test
```

---

## 📁 Struktur Fail Projek

```
Node-follow up/
├── src/
│   ├── server.js                    # Pelayan Express & WebSocket Real-Time
│   ├── config/
│   │   ├── constants.js             # Tetapan Kanban, Drip & Had Anti-Spam
│   │   └── auctionPrompts.js        # Prompt AI Saringan 10% Deposit Lelong
│   └── services/
│       ├── baileysEngine.js         # Enjin WhatsApp Baileys Socket
│       ├── geminiLelongAI.js        # Saringan Prospek Google Gemini Flash
│       ├── leadManager.js           # Pengurusan Prospek & Metrik
│       ├── licenseManager.js        # Hardware Machine ID & Semakan Lesen
│       ├── scheduler.js             # Enjin Drip Follow-Up (Node-cron)
│       └── sheetsClient.js          # Sambungan API Google Apps Script
├── public/                          # Antara Muka Pengguna (UI)
│   ├── index.html                   # Papan Pemuka Ejen (Tailwind Corporate Blue)
│   └── js/
│       └── app.js                   # Logik Interaksi UI & WebSocket Client
├── google-apps-script/
│   └── Code.gs                      # Skrip Web App Google Sheet Master
├── test/
│   └── test-all.js                  # Suite Ujian Automatik
├── .env                             # Fail Konfigurasi Sistem
└── package.json
```
