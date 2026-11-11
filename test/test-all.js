/**
 * SUITE UJIAN AUTOMATIK: KNOWLEDGE BASE EKSTRA DETAIL V2 (41 SKRIP AMIN)
 */

const assert = require("assert");

async function runTests() {
  console.log("==========================================================");
  console.log("🧪 MEMULAKAN UJIAN 41 SKRIP KNOWLEDGE BASE EKSTRA DETAIL V2");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;
  const geminiLelongAI = require("../src/services/geminiLelongAI");

  async function testCase(name, inputMsg, expectedSnippet) {
    try {
      process.stdout.write(`${name}... `);
      const res = await geminiLelongAI.analyzeAndQualify(inputMsg);
      assert(
        res.suggested_whatsapp_reply.toLowerCase().includes(expectedSnippet.toLowerCase()),
        `Jawapan tidak mengandungi: "${expectedSnippet}".\nDapat: "${res.suggested_whatsapp_reply}"`
      );
      console.log("✅ LULUS");
      passed++;
    } catch (e) {
      console.log("❌ GAGAL:", e.message);
      failed++;
    }
  }

  // 1. Onboarding Customer Baru
  await testCase(
    "1. Onboarding Customer Baru (KB-01, 02)",
    "Hai, selamat petang",
    "Pakar Rumah Lelong Melaka"
  );

  // 2. Pilihan 1: Duduk Sendiri
  await testCase(
    "2. Pilihan 1: Duduk Sendiri (KB-06-10)",
    "1",
    "Jenis rumah? (Teres / Semi-D / Apartment)"
  );

  // 3. Pilihan 2: Pelaburan
  await testCase(
    "3. Pilihan 2: Pelaburan (KB-12, 13)",
    "2",
    "sasaran penyewa"
  );

  // 4. Pilihan 3: Proses Lelong A-Z
  await testCase(
    "4. Pilihan 3: Proses Lelong A-Z (KB-15-30)",
    "3",
    "Step 1: Sediakan Modal Permulaan"
  );

  // 5. ⚡ Logik Picu Khas: Loan / LPPSA
  await testCase(
    "5. Logik Picu Khas Pemohon Loan/LPPSA (KB-14)",
    "Saya nak beli guna loan bank",
    "memandangkan anda ingin guna kemudahan pinjaman"
  );

  // 6. FAQ KWSP
  await testCase(
    "6. FAQ: Boleh keluar KWSP? (KB-31)",
    "Boleh guna duit KWSP akaun 2 ke untuk beli rumah lelong?",
    "Pengeluaran KWSP Akaun 2 dibenarkan"
  );

  // 7. FAQ Full Loan / Mark-up
  await testCase(
    "7. FAQ: Boleh Full Loan / Mark-up? (KB-32)",
    "Boleh mark-up full loan ke rumah lelong?",
    "Rumah lelong TAK BOLEH mark-up loan"
  );

  // 8. FAQ Status Penghuni
  await testCase(
    "8. FAQ: Status Penghuni (KB-33)",
    "Kalau dalam rumah ada orang duduk atau penyewa macam mana?",
    "As-Is-Where-Is"
  );

  // 9. FAQ Kaveat
  await testCase(
    "9. FAQ: Kaveat / Caveat (KB-34)",
    "Kalau rumah tu ada kaveat boleh buat loan tak?",
    "Rumah berkaveat HANYA BOLEH dibeli menggunakan wang tunai"
  );

  // 10. FAQ Kos Tersembunyi
  await testCase(
    "10. FAQ: Kos Tersembunyi (KB-35)",
    "Ada kos tersembunyi apa lagi selain deposit 10%?",
    "yuran guaman, duti setem, cukai tertunggak"
  );

  // 11. FAQ Lawatan Dalam Rumah
  await testCase(
    "11. FAQ: Lawatan Dalam Rumah (KB-36)",
    "Boleh view masuk dalam bilik rumah dulu ke?",
    "MAAF, kita tak boleh masuk ke dalam rumah lelong"
  );

  // 12. FAQ Kerosakan Dalaman
  await testCase(
    "12. FAQ: Kerosakan Dalaman (KB-37)",
    "Kalau dalam rumah bumbung bocor atau paip pecah siapa repair?",
    "segala kerosakan dalaman"
  );

  // 13. FAQ Joint Name
  await testCase(
    "13. FAQ: Joint Name / Nama Bersama (KB-38)",
    "Boleh tak beli joint name suami isteri?",
    "kedua-dua penama wajib mendaftar sebagai pembida"
  );

  // 14. FAQ Batal Lelong
  await testCase(
    "14. FAQ: Batal Lelong (KB-39)",
    "Kalau bank cancel lelongan deposit saya hangus ke?",
    "deposit anda dipulangkan 100%"
  );

  // 15. FAQ Tempoh Tukar Nama
  await testCase(
    "15. FAQ: Tempoh Tukar Nama (KB-40)",
    "Berapa lama proses tukar nama sampai dapat kunci?",
    "3 hingga 6 bulan"
  );

  // 16. Fallback Eskalasi
  await testCase(
    "16. Fallback Eskalasi (KB-41)",
    "Boleh panggil advisor hubungi saya?",
    "penasihat senior ZonLelong"
  );

  console.log("\n==========================================================");
  console.log(`KEPUTUSAN: ${passed} LULUS, ${failed} GAGAL`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
