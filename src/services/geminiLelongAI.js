const { 
  SYSTEM_PROMPT_LELONG, 
  BOT_NAME, 
  SPECIFIC_PROPERTY_URL, 
  ZONLELONG_GUIDE_URL 
} = require("../config/auctionPrompts");
const https = require("https");

class GeminiLelongAI {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Panggilan Terus ke Gemini REST API (Flash Model)
   */
  async callGeminiRest(prompt, systemInstruction = SYSTEM_PROMPT_LELONG) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasikan.");
    }

    const modelName = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const bodyData = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(endpoint);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return reject(new Error(parsed.error.message || "Ralat Gemini API"));
            }
            const candidateText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!candidateText) {
              return reject(new Error("Tiada teks diterima dari Gemini."));
            }
            resolve(JSON.parse(candidateText));
          } catch (e) {
            reject(new Error("Gagal menghurai respons JSON Gemini: " + e.message));
          }
        });
      });

      req.on("error", err => reject(err));
      req.write(JSON.stringify(bodyData));
      req.end();
    });
  }

  /**
   * Analisis Mesej Prospek Mengikut NodeFollow_KnowledgeBase_Ekstra_Detail_V2.xlsx (41 Skrip)
   */
  async analyzeAndQualify(prospectMessage, existingProfile = {}) {
    const prompt = `
Mesej terbaharu daripada prospek WhatsApp:
"${prospectMessage}"

Profil sedia ada:
${JSON.stringify(existingProfile, null, 2)}

Sila balas mengikut skrip dan SOP rasmi daripada Knowledge Base Ekstra Detail V2 (41 Skrip):
- Padankan niat mengikut 10 FAQ pembeli (KWSP, Full Loan/Markup, Penghuni, Kaveat, Kos Tersembunyi, Lawatan Dalam, Kerosakan, Joint Name, Batal Lelong, Tempoh Tukar Nama).
- Jika prospek jawab "Loan" atau "LPPSA", PICU LOGIK KHAS (KB-14) dengan ringkasan Step 1-5 A-Z.
- Jika prospek jawab nombor 1, 2, atau 3, ikut alur yang ditetapkan.
- Jika prospek baru, berikan sapaan dan menu 1, 2, 3.
Hasilkan output JSON mengikut format wajib.
    `;

    try {
      if (this.apiKey) {
        return await this.callGeminiRest(prompt);
      }
    } catch (err) {
      console.warn("[GEMINI AI] Ralat Gemini, beralih ke Knowledge Base Ekstra Detail V2 setempat:", err.message);
    }

    return this.fallbackRuleBasedQualification(prospectMessage, existingProfile);
  }

  /**
   * Enjin Saringan Knowledge Base Tempatan (100% Mengikut NodeFollow_KnowledgeBase_Ekstra_Detail_V2.xlsx)
   */
  fallbackRuleBasedQualification(message, profile = {}) {
    const text = message.trim().toLowerCase();
    let depositStatus = profile.deposit_10_status || "UNKNOWN";
    let stage = profile.status_rundingan || "BARU";
    let loanStatus = profile.loan_status || "UNKNOWN";
    let interest = profile.jenis_hartanah || "Rumah Lelong Melaka";
    let reply = "";

    // 1. FAQ: KWSP / EPF (KB-31)
    if (text.includes("kwsp") || text.includes("epf") || text.includes("akaun 2") || text.includes("akaun dua") || text.includes("keluarkan kwsp") || text.includes("claim kwsp")) {
      stage = "DISARING_AI";
      reply = `Ya, boleh! Pengeluaran KWSP Akaun 2 dibenarkan untuk pembelian rumah lelong, tapi perlu bayar guna duit sendiri dulu untuk deposit 10%, kemudian claim balik dari KWSP guna dokumen COS.`;
    }
    // 2. FAQ: FULL LOAN / MARK-UP (KB-32)
    else if (text.includes("full loan") || text.includes("markup") || text.includes("mark up") || text.includes("mark-up") || text.includes("100% loan") || text.includes("loan 100%") || text.includes("tanpa deposit") || text.includes("0 downpayment")) {
      depositStatus = "NOT_READY";
      stage = "KIV_TIADA_DEPOSIT";
      reply = `Rumah lelong TAK BOLEH mark-up loan. Margin pembiayaan maksimum adalah 90% dari harga belian (menang bidaan), bukan dari nilai pasaran (market value).`;
    }
    // 3. FAQ: STATUS PENGHUNI / PENYEWA (KB-33)
    else if (text.includes("penghuni") || text.includes("orang duduk") || text.includes("penyewa") || text.includes("masih ada orang") || text.includes("ada orang") || text.includes("kosongkan") || text.includes("as-is-where-is") || text.includes("owner duduk")) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Rumah dijual secara 'As-Is-Where-Is' (seadanya). Jika ada penghuni, pemilik baru (anda) perlu beri notis pengosongan. Jika ingkar, kita boleh apply arahan mahkamah (Distress Act).`;
    }
    // 4. FAQ: KAVEAT / CAVEAT (KB-34)
    else if (text.includes("kaveat") || text.includes("caveat") || text.includes("ada kaveat") || text.includes("halangan pejabat tanah")) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Jika rumah ada kaveat (halangan), bank takkan luluskan loan. Rumah berkaveat HANYA BOLEH dibeli menggunakan wang tunai (cash buyer).`;
    }
    // 5. FAQ: KOS TERSEMBUNYI (KB-35)
    else if (text.includes("kos tersembunyi") || text.includes("hidden cost") || text.includes("kos tambahan") || text.includes("kos lain") || text.includes("berapa kos selain deposit") || text.includes("kos sampingan") || text.includes("yuran guaman")) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Selain harga rumah, pembeli tanggung yuran guaman, duti setem, cukai tertunggak (pintu/tanah), dan caj utiliti tertunggak (bergantung kepada syarat POS - ada bank yang tanggung sebahagian).`;
    }
    // 6. FAQ: LAWATAN KE DALAM RUMAH (KB-36)
    else if (
      text.includes("lawatan ke dalam rumah") ||
      text.includes("lawatan dalam rumah") ||
      text.includes("lawatan dalam") ||
      text.includes("lawatan tapak") ||
      text.includes("lawatan fizikal") ||
      text.includes("lawatan") ||
      text.includes("lawat") ||
      text.includes("site visit") ||
      text.includes("sitevisit") ||
      text.includes("viewing") ||
      text.includes("open house") ||
      text.includes("openhouse") ||
      text.includes("tgk rumah") ||
      text.includes("tengok rumah") ||
      text.includes("lihat rumah") ||
      text.includes("tinjau rumah") ||
      text.includes("tengok dalam") ||
      text.includes("tgk dalam") ||
      text.includes("tengok dlm") ||
      text.includes("tgk dlm") ||
      text.includes("view dalam") ||
      text.includes("view dlm") ||
      text.includes("masuk dalam") ||
      text.includes("masuk dlm") ||
      text.includes("masuk rumah") ||
      text.includes("tengok bilik") ||
      text.includes("tgk bilik") ||
      text.includes("boleh view") ||
      text.includes("nak view") ||
      text.includes("boleh tengok") ||
      text.includes("boleh tgk") ||
      text.includes("nak tengok") ||
      text.includes("nak tgk") ||
      text.includes("tengok luar") ||
      text.includes("tgk luar") ||
      text.includes("tengok keadaan") ||
      text.includes("tgk keadaan") ||
      text.includes("masuk tengok") ||
      text.includes("masuk tgk")
    ) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `MAAF, kita tak boleh masuk ke dalam rumah lelong. Lawatan fizikal (site visit) hanya dibenarkan dari luar pagar rumah sahaja.`;
    }
    // 7. FAQ: KEROSAKAN DALAMAN (KB-37)
    else if (text.includes("kerosakan") || text.includes("bumbung bocor") || text.includes("paip pecah") || text.includes("wiring") || text.includes("kos repair") || text.includes("rumah rosak") || text.includes("siapa repair")) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Oleh kerana tak boleh masuk, segala kerosakan dalaman (paip, wiring, bumbung bocor) adalah di bawah tanggungan pembeli sepenuhnya. Bajet sikit untuk kos 'repair'.`;
    }
    // 8. FAQ: JOINT NAME / NAMA BERSAMA (KB-38)
    else if (text.includes("joint name") || text.includes("nama bersama") || text.includes("kongsi nama") || text.includes("beli berdua") || text.includes("suami isteri") || text.includes("gabung nama")) {
      stage = "DISARING_AI";
      reply = `Boleh, tapi kedua-dua penama wajib mendaftar sebagai pembida dan hadir semasa bidaan (atau hantar wakil dengan surat kuasa wakil / PA).`;
    }
    // 9. FAQ: BATAL LELONG / CALL-OFF (KB-39)
    else if (text.includes("batal") || text.includes("cancel") || text.includes("lelong dibatalkan") || text.includes("deposit hangus") || text.includes("call-off") || text.includes("tarik balik")) {
      reply = `Lelongan boleh ditarik balik oleh bank pada saat akhir jika owner asal bayar tunggakan. Jika ini berlaku, deposit anda dipulangkan 100%.`;
    }
    // 10. FAQ: TEMPOH TUKAR NAMA (KB-40)
    else if (text.includes("tukar nama") || text.includes("tempoh tukar nama") || text.includes("berapa lama proses") || text.includes("bila dapat kunci") || text.includes("serahan kunci")) {
      reply = `Proses tukar nama biasanya ambil masa 3 hingga 6 bulan bergantung kepada kecekapan peguam, pejabat tanah, dan kelulusan pinjaman anda.`;
    }
    // 11. FAQ: CARA BAYAR DEPOSIT (10% Bank Draft)
    else if (text.includes("cara bayar deposit") || text.includes("bayar deposit macam mana") || text.includes("bank draft") || text.includes("bila kena bayar deposit") || text.includes("bayar kat siapa")) {
      depositStatus = "NEED_EXPLANATION";
      reply = `Deposit 10% dibayar sama ada melalui Bank Draft atas nama bank berkenaan atau pindahan atas talian mengikut syarat platform pelelong, selewat-lewatnya 1-2 hari sebelum tarikh bidaan.`;
    }
    // 12. ⚡ LOGIK PICU KHAS: PEMOHON LOAN / LPPSA (KB-14 hingga KB-30)
    else if (text === "loan" || text === "lppsa" || text.includes("loan bank") || text.includes("guna loan") || text.includes("nak buat loan") || (text.includes("pinjaman") && !text.includes("boleh guna loan"))) {
      if (text.includes("lppsa")) loanStatus = "LPPSA";
      else loanStatus = "BANK_LOAN";
      stage = "LAYAK_10_DEPOSIT";
      reply = `Baik, memandangkan anda ingin guna kemudahan pinjaman, persediaan kena lebih rapi. Ini ringkasan padat proses beli rumah lelong dari A sampai Z:\n\n💰 Step 1: Sediakan Modal Permulaan (Kira-kira 20% dari harga rizab).\n👉 10% Deposit (Wajib untuk daftar bidaan).\n👉 10% Kos Tambahan (Yuran guaman SPA/Loan, duti setem, yuran penilai).\n\n🏦 Step 2: Semak Kelayakan Loan / LPPSA.\n👉 Sediakan slip gaji 3-6 bulan & penyata bank terkini.\n👉 Pastikan CCRIS/CTOS cantik (tiada tunggakan lebih 2 bulan).\n\n🏡 Step 3: Dapatkan POS (Perisytiharan Jualan) & Lawatan Tapak.\n👉 Kita akan semak status Kaveat di Pejabat Tanah (kalau ada kaveat, tak boleh guna loan).\n👉 Semak bil tertunggak (cukai pintu, cukai tanah, utiliti, maintenance).\n\n⚖️ Step 4: Pendaftaran Bidaan.\n👉 Sediakan Bank Draft 10% atau FPX. Jika kalah bida, deposit pulang 100% tanpa caj.\n\n🎉 Step 5: Jika Menang Bidaan.\n👉 Sign Kontrak Jualan (COS) on the spot.\n👉 Selesaikan baki 90% bayaran dalam masa 90 atau 120 hari (guna tunai/loan).\n\nJangan risau, saya akan guide dari mula sampai dapat kunci. Ada soalan lain? Boleh tanya je.`;
    }
    // 13. ALUR PILIHAN 3: PROSES LELONG A-Z (KB-15 hingga KB-30)
    else if (text === "3" || text.includes("3️⃣") || text.includes("info & proses") || text.includes("proses lelong") || text.includes("step lelong") || text.includes("langkah lelong") || text.includes("fahamkan info")) {
      interest = "Info & Proses Lelong (A-Z)";
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Ok, ini ringkasan padat proses beli rumah lelong dari A sampai Z:\n\n💰 Step 1: Sediakan Modal Permulaan (Kira-kira 20% dari harga rizab).\n👉 10% Deposit (Wajib untuk daftar bidaan).\n👉 10% Kos Tambahan (Yuran guaman SPA/Loan, duti setem, yuran penilai).\n\n🏦 Step 2: Semak Kelayakan Loan / LPPSA.\n👉 Sediakan slip gaji 3-6 bulan & penyata bank terkini.\n👉 Pastikan CCRIS/CTOS cantik (tiada tunggakan lebih 2 bulan).\n\n🏡 Step 3: Dapatkan POS (Perisytiharan Jualan) & Lawatan Tapak.\n👉 Kita akan semak status Kaveat di Pejabat Tanah (kalau ada kaveat, tak boleh guna loan).\n👉 Semak bil tertunggak (cukai pintu, cukai tanah, utiliti, maintenance).\n\n⚖️ Step 4: Pendaftaran Bidaan.\n👉 Sediakan Bank Draft 10% atau FPX. Jika kalah bida, deposit pulang 100% tanpa caj.\n\n🎉 Step 5: Jika Menang Bidaan.\n👉 Sign Kontrak Jualan (COS) on the spot.\n👉 Selesaikan baki 90% bayaran dalam masa 90 atau 120 hari (guna tunai/loan).\n\nJangan risau, saya akan guide dari mula sampai dapat kunci. Ada soalan lain? Boleh tanya je.`;
    }
    // 14. ALUR PILIHAN 1: DUDUK SENDIRI (KB-06 hingga KB-10)
    else if (text === "1" || text.includes("1️⃣") || text.includes("duduk sendiri") || text.includes("kediaman sendiri") || text.includes("beli untuk kediaman") || text.includes("tinggal sendiri")) {
      interest = "Duduk Sendiri (Kediaman)";
      stage = "DISARING_AI";
      reply = `Baik 👍, nak beli untuk kediaman sendiri.\n\nBoleh kongsikan sikit supaya saya boleh filter unit yang paling 'ngam':\n✅ Jenis rumah? (Teres / Semi-D / Apartment)\n✅ Bajet maksimum anda?\n✅ Daerah pilihan di Melaka? (Melaka Tengah / Alor Gajah / Jasin)`;
    }
    // 15. ALUR PILIHAN 2: PELABURAN / ROI (KB-12, KB-13)
    else if (text === "2" || text.includes("2️⃣") || text.includes("pelaburan") || text.includes("investment") || text.includes("roi") || text.includes("sewa")) {
      interest = "Pelaburan (ROI Tinggi)";
      stage = "DISARING_AI";
      reply = `Smart choice 💼. Rumah lelong memang lubuk ROI tinggi kalau kena gayanya.\n\nBoleh share bajet pelaburan & sasaran penyewa (student / pekerja / pelancong)? Nanti saya senaraikan unit 'hot'.`;
    }
    // 16. BUYER TANYA SENARAI UNIT SPESIFIK / CATALOG
    else if (text.includes("senarai unit") || text.includes("unit specific") || text.includes("senarai rumah lelong") || text.includes("list rumah") || text.includes("link lelong") || text.includes("catalog")) {
      interest = "Semakan Unit Spesifik";
      reply = `Untuk semakan senarai unit lelongan terkini yang spesifik, Tuan/Puan boleh rujuk terus pangkalan data rasmi kami di sini 👇:\n${SPECIFIC_PROPERTY_URL}`;
    }
    // 17. PROSPEK SUDAH BERI BAJET / LOKASI (KB-11)
    else if (this.extractBudget(text) || this.extractLocation(text)) {
      stage = "DISARING_AI";
      reply = `Bercadang nak beli guna loan bank, LPPSA atau tunai?`;
    }
    // 18. ESKALASI / BANTUAN PENASIHAT / SOALAN LAIN (KB-41)
    else if (
      text.includes("advisor") || text.includes("call me") || text.includes("telefon saya") || text.includes("peguam") ||
      text.includes("?") || text.includes("bagaimana") || text.includes("macam mana") || text.includes("mcmana") ||
      text.includes("kenapa") || text.includes("boleh ke") || text.includes("bolehkah")
    ) {
      stage = "SEMAK_POS_SITE_VISIT";
      reply = `Menarik soalan ni. Biar saya rujuk pada penasihat senior ZonLelong untuk pastikan fakta tepat, dan saya akan update Cik/Tuan semula secepat mungkin.`;
    }
    // 19. ONBOARDING / CUSTOMER BARU (KB-01, KB-02, KB-03, KB-04, KB-05)
    else {
      stage = "BARU";
      reply = `Hai 👋, saya Amin – Pakar Rumah Lelong Melaka.\n\nBiar saya bantu anda dapatkan rumah idaman pada harga bawah pasaran. Boleh pilih tujuan anda 👇:\n1️⃣ Cari rumah lelong untuk duduk sendiri\n2️⃣ Cari rumah lelong untuk pelaburan\n3️⃣ Nak fahamkan info & proses lelong`;
    }

    return {
      prospect_name: profile.nama || "Tuan/Puan",
      property_interest: interest,
      budget_detected: this.extractBudget(text) || profile.bajet || null,
      location_detected: this.extractLocation(text) || profile.lokasi || null,
      deposit_10_status: depositStatus,
      loan_status: loanStatus,
      qualification_stage: stage,
      key_findings: `Niat: ${interest}. Status: ${stage}.`,
      suggested_whatsapp_reply: reply
    };
  }

  extractBudget(text) {
    const match = text.match(/rm\s*(\d+[k0-9,]*)/i) || text.match(/(\d{2,4})\s*k/i);
    return match ? match[0].toUpperCase() : null;
  }

  extractLocation(text) {
    const locations = [
      "melaka tengah", "ayer keroh", "alor gajah", "jasin", "batu berendam", 
      "bukit katil", "klebang", "cheng", "masjid tanah", "krubong", "semabok", "melaka"
    ];
    for (const loc of locations) {
      if (text.includes(loc)) {
        return loc.replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    return null;
  }
}

module.exports = new GeminiLelongAI();
