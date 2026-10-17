/**
 * ============================================================================
 * FINFLO — PERSONAL FINANCE BESTIE & DAILY BUDGET GUARDIAN (FOR ALZHA)
 * Platform  : Google Apps Script (100% Gratis & Jalan 24/7)
 * Zona Waktu: Asia/Jakarta (WIB)
 * Persona   : Finance Professional x Gen-Z Vibe
 * ============================================================================
 *
 * CARA PAKAI AWAL:
 * 1. Isi TELEGRAM_BOT_TOKEN dari @BotFather di baris 18.
 * 2. Klik Deploy -> New Deployment -> Web App (Who has access: Anyone).
 * 3. Copy URL Web App tersebut dan tempelkan ke WEBAPP_URL di baris 19.
 * 4. Pilih fungsi "setupBot" di menu atas, lalu klik tombol "Run / Jalankan".
 * ============================================================================
 */

const TELEGRAM_BOT_TOKEN = "ISI_TOKEN_DARI_BOTFATHER_DI_SINI";
const WEBAPP_URL = "ISI_URL_WEB_APP_GOOGLE_SCRIPT_DI_SINI";

// ============================================================================
// 1. FUNGSI SETUP 1-KLIK (Jalankan sekali dari menu atas Google Apps Script)
// ============================================================================
function setupBot() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.indexOf("ISI_TOKEN") !== -1) {
    Logger.log("❌ ERROR: Isi dulu TELEGRAM_BOT_TOKEN dari @BotFather di baris 18 ya!");
    return;
  }
  if (!WEBAPP_URL || WEBAPP_URL.indexOf("ISI_URL") !== -1) {
    Logger.log("❌ ERROR: Isi dulu WEBAPP_URL hasil Deploy di baris 19 ya!");
    return;
  }

  // 1. Pasang Webhook ke Telegram
  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/setWebhook?url=" + encodeURIComponent(WEBAPP_URL);
  const response = UrlFetchApp.fetch(url);
  Logger.log("✅ Respon Webhook Telegram: " + response.getContentText());

  // 2. Pasang Trigger Pengingat Harian Default (Jam 20:00 WIB)
  const props = PropertiesService.getScriptProperties();
  let jamNotif = props.getProperty("NOTIF_HOUR");
  if (!jamNotif) {
    jamNotif = "20";
    props.setProperty("NOTIF_HOUR", jamNotif);
  }
  if (jamNotif !== "off") {
    pasangTriggerJam(parseInt(jamNotif, 10));
    Logger.log("✅ Trigger reminder harian Finflo aktif di jam " + jamNotif + ":00 WIB.");
  }

  Logger.log("🎉 SETUP BERES! Sekarang buka bot Finflo di Telegram lalu ketik: /start");
}

// ============================================================================
// 2. WEBHOOK RECEIVER (Menerima Chat dari Telegram)
// ============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return;
    const update = JSON.parse(e.postData.contents);
    if (!update.message || !update.message.text) return;

    const chatId = String(update.message.chat.id);
    const firstName = update.message.from.first_name || "Alzha";
    const text = update.message.text.trim();

    const props = PropertiesService.getScriptProperties();
    let ownerChatId = props.getProperty("OWNER_CHAT_ID");

    // Kunci bot otomatis hanya untuk akun Telegram pemilik
    if (!ownerChatId) {
      ownerChatId = chatId;
      props.setProperty("OWNER_CHAT_ID", ownerChatId);
    } else if (chatId !== ownerChatId) {
      kirimPesan(chatId, "🔒 <i>Sorry bestie</i>, Finflo ini asisten CFO pribadi khusus buat Alzha aja ya!");
      return;
    }

    // Cek pergantian bulan otomatis (Reset ke 0 setiap Tanggal 1 bulan baru)
    cekPergantianBulanOtomatis(chatId);

    // Proses perintah atau input nominal
    prosesPesanMasuk(chatId, firstName, text);
  } catch (err) {
    Logger.log("Error doPost: " + err.toString());
  }
}

// ============================================================================
// 3. LOGIKA UTAMA PEMROSESAN PESAN & PERINTAH (PERSONA: FINFLO)
// ============================================================================
function prosesPesanMasuk(chatId, firstName, text) {
  const lower = text.toLowerCase();

  // A. Perintah Menu / Start / Bantuan
  if (lower === "/start" || lower === "/menu" || lower === "/bantuan" || text === "📖 Cheat Sheet Perintah") {
    const pesan =
      "✨ <b>Halo " + firstName + "! Kenalin, aku Finflo — <i>your personal finance bestie & CFO pribadi</i>!</b> 💼🔥\n\n" +
      "Tugas aku simpel: jagain <i>cashflow</i> bulanan kamu biar tetep <i>slay</i> dan nggak boncos sebelum akhir bulan.\n\n" +
      "📌 <b>1. Set Budget Bulanan (Bebas Tambah Kapan Aja):</b>\n" +
      "<code>/anggaran Makanan 1000000</code>\n" +
      "<code>/anggaran Rokok 300rb</code>\n" +
      "<code>/anggaran Travel 500rb</code>\n" +
      "<code>/anggaran Kopi 200rb</code>\n\n" +
      "📝 <b>2. Update Pengeluaran Harian (Liat dari Meow):</b>\n" +
      "• Langsung ketik angka akumulasi di layar Meow:\n" +
      "  <code>makanan 300000</code> atau <code>makanan 300rb</code>\n" +
      "• Atau kalau mau nambahin recehan dari angka kemarin (pake <code>+</code>):\n" +
      "  <code>+makanan 25rb</code>\n" +
      "<i>(Pro tip: Bisa kirim banyak baris sekaligus dalam 1 chat!)</i>\n\n" +
      "⚡ <b>3. Command Lainnya:</b>\n" +
      "• <code>/status</code> — Spill kondisi dompet semua kategori\n" +
      "• <code>/jadwal 20</code> — Ganti jam reminder harian (0-23 atau <code>off</code>)\n" +
      "• <code>/hapus [Kategori]</code> — Drop kategori yang nggak kepake\n" +
      "• <code>/reset</code> — Reset pemakaian ke Rp 0";

    kirimPesanDenganMenu(chatId, pesan);
    return;
  }

  // B. Perintah Cek Status Semua Kategori
  if (lower === "/status" || text === "📊 Spill Status Budget") {
    kirimLaporanSemuaKategori(chatId);
    return;
  }

  // C. Perintah Atur / Cek Jadwal Notifikasi
  if (lower.indexOf("/jadwal") === 0 || text === "⏰ Atur Jam Reminder") {
    kelolaJadwalNotifikasi(chatId, text);
    return;
  }

  // D. Perintah Tambah / Ubah Anggaran Kategori (/anggaran atau /set)
  if (lower.indexOf("/anggaran") === 0 || lower.indexOf("/set") === 0) {
    kelolaSetAnggaran(chatId, text);
    return;
  }

  // E. Perintah Hapus Kategori
  if (lower.indexOf("/hapus") === 0) {
    kelolaHapusKategori(chatId, text);
    return;
  }

  // F. Perintah Reset Pemakaian Bulanan
  if (lower === "/reset") {
    resetSemuaPemakaian(chatId, false);
    return;
  }

  // G. Input Pengeluaran Harian (Bisa 1 baris atau multi-baris)
  prosesInputPengeluaran(chatId, text);
}

// ============================================================================
// 4. MANAJEMEN KATEGORI & INPUT PENGELUARAN
// ============================================================================
function kelolaSetAnggaran(chatId, text) {
  const tanpaCommand = text.replace(/^\/(anggaran|set)\s*/i, "").trim();
  const match = tanpaCommand.match(/^(.+?)\s+([0-9.,]+\s*(?:jt|juta|rb|ribu|k)?)$/i);

  if (!match) {
    kirimPesan(
      chatId,
      "⚠️ <b>Waduh, formatnya agak meleset nih!</b>\n\nCoba ketik kayak gini ya:\n" +
      "• <code>/anggaran Makanan 1000000</code>\n" +
      "• <code>/anggaran Kopi 200rb</code>"
    );
    return;
  }

  const namaKategori = rapikanNama(match[1]);
  const key = namaKategori.toLowerCase();
  const nominal = parseNominal(match[2]);

  if (isNaN(nominal) || nominal <= 0) {
    kirimPesan(chatId, "⚠️ Nominal budget-nya harus angka lebih dari 0 ya bestie.");
    return;
  }

  const data = ambilDataAnggaran();
  const sudahAda = data[key] ? true : false;
  const spentLama = sudahAda ? (data[key].spent || 0) : 0;

  data[key] = {
    name: namaKategori,
    budget: nominal,
    spent: spentLama,
    updatedAt: formatTanggalIndo(new Date())
  };

  simpanDataAnggaran(data);

  const infoWaktu = hitungInfoHariBulanIni();
  const sisa = nominal - spentLama;
  const pembagiHari = infoWaktu.sisaHari > 0 ? infoWaktu.sisaHari : 1;
  const jatahHarian = sisa > 0 ? Math.floor(sisa / pembagiHari) : 0;

  const aksi = sudahAda ? "di-update" : "dikunci";
  const pesan =
    "🔥 <b>Sip! Budget \"" + namaKategori + "\" berhasil " + aksi + " sama Finflo!</b>\n\n" +
    "• <b>Anggaran Bulan Ini:</b> Rp " + formatRupiah(nominal) + "\n" +
    "• <b>Terpakai Saat Ini:</b> Rp " + formatRupiah(spentLama) + "\n" +
    "• <b>Sisa Anggaran:</b> Rp " + formatRupiah(sisa) + "\n" +
    "• <b>Jatah Aman Harian:</b> Maks Rp " + formatRupiah(jatahHarian) + " / hari <i>(sisa " + infoWaktu.sisaHari + " hari lagi)</i>";

  kirimPesanDenganMenu(chatId, pesan);
}

function kelolaHapusKategori(chatId, text) {
  const nama = text.replace(/^\/hapus\s*/i, "").trim();
  if (!nama) {
    kirimPesan(chatId, "⚠️ Mau drop kategori apa nih? Ketik kayak gini ya:\n<code>/hapus Kopi</code>");
    return;
  }

  const key = nama.toLowerCase();
  const data = ambilDataAnggaran();

  if (!data[key]) {
    kirimPesan(chatId, "🧐 Kategori <b>" + nama + "</b> nggak ketemu di catatan Finflo nih.");
    return;
  }

  const namaAsli = data[key].name;
  delete data[key];
  simpanDataAnggaran(data);

  kirimPesan(chatId, "🗑️ Oke, kategori <b>" + namaAsli + "</b> udah resmi Finflo drop dari daftar budget ya!");
}

function prosesInputPengeluaran(chatId, text) {
  const data = ambilDataAnggaran();
  const daftarKey = Object.keys(data);

  if (daftarKey.length === 0) {
    kirimPesan(
      chatId,
      "👀 <b>Eh, kamu belum set budget kategori sama sekali nih!</b>\n\n" +
      "Yuk set dulu biar Finflo bisa bantu ngitungin:\n" +
      "<code>/anggaran Makanan 1000000</code>\n" +
      "<code>/anggaran Rokok 300rb</code>\n" +
      "<code>/anggaran Travel 500rb</code>\n" +
      "<code>/anggaran Kopi 200rb</code>"
    );
    return;
  }

  const barisList = text.split(/\r?\n/);
  const infoWaktu = hitungInfoHariBulanIni();
  const laporanUpdate = [];
  const gagalBaris = [];

  for (let i = 0; i < barisList.length; i++) {
    const baris = barisList[i].trim();
    if (!baris) continue;

    // Cek apakah diawali tanda '+' (mode tambah) atau langsung (mode total Meow)
    const isModeTambah = baris.charAt(0) === "+";
    const bersih = isModeTambah ? baris.substring(1).trim() : baris;

    const match = bersih.match(/^(.+?)\s+([0-9.,]+\s*(?:jt|juta|rb|ribu|k)?)$/i);
    if (!match) {
      gagalBaris.push(baris);
      continue;
    }

    const inputNama = match[1].trim().toLowerCase();
    const nominalInput = parseNominal(match[2]);

    if (isNaN(nominalInput) || nominalInput < 0) {
      gagalBaris.push(baris);
      continue;
    }

    // Cari kategori yang cocok (exact match atau awalan kata seperti "makan" -> "Makanan")
    let targetKey = null;
    if (data[inputNama]) {
      targetKey = inputNama;
    } else {
      for (let k = 0; k < daftarKey.length; k++) {
        if (daftarKey[k].indexOf(inputNama) === 0 || inputNama.indexOf(daftarKey[k]) === 0) {
          targetKey = daftarKey[k];
          break;
        }
      }
    }

    if (!targetKey) {
      gagalBaris.push(baris + " <i>(kategori belum di-set)</i>");
      continue;
    }

    const item = data[targetKey];
    const spentSebelumnya = item.spent || 0;
    const spentBaru = isModeTambah ? (spentSebelumnya + nominalInput) : nominalInput;
    const selisihHariIni = spentBaru - spentSebelumnya;

    item.spent = spentBaru;
    item.updatedAt = infoWaktu.tanggalSingkat;

    laporanUpdate.push(buatBlokDetailKategori(item, selisihHariIni, infoWaktu));
  }

  if (laporanUpdate.length > 0) {
    simpanDataAnggaran(data);
    let balasan = "✅ <b>Noted bestie! Data per " + infoWaktu.tanggalLengkap + " udah Finflo update:</b>\n\n" + laporanUpdate.join("\n\n────────────────────\n\n");

    // Jika hari ini akhir bulan, tambahkan reminder rekap FinanceFlow
    if (infoWaktu.sisaHari === 0) {
      balasan += "\n\n" + buatPesanReminderAkhirBulan();
    }

    if (gagalBaris.length > 0) {
      balasan += "\n\n⚠️ <b>Yang ini gagal Finflo baca:</b>\n" + gagalBaris.join("\n");
    }
    kirimPesanDenganMenu(chatId, balasan);
  } else {
    const contohKat = data[daftarKey[0]].name.toLowerCase();
    kirimPesan(
      chatId,
      "🤔 <b>Hmm, Finflo agak bingung baca chat barusan.</b>\n\n" +
      "• Kalau mau update angka dari Meow:\n" +
      "  <code>" + contohKat + " 300000</code> atau <code>" + contohKat + " 300rb</code>\n" +
      "• Kalau mau tambah kategori baru:\n" +
      "  <code>/anggaran NamaKategori Nominal</code>\n" +
      "• Ketik <code>/status</code> buat cek semua budget kamu."
    );
  }
}

// ============================================================================
// 5. PEMBUAT LAPORAN VISUAL & HITUNGAN JATAH HARIAN (GAYA FINFLO)
// ============================================================================
function buatBlokDetailKategori(item, selisihHariIni, infoWaktu) {
  const budget = item.budget || 0;
  const spent = item.spent || 0;
  const sisa = budget - spent;

  const pctTerpakai = budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0;
  const pctSisa = budget > 0 ? Math.max(0, Math.round((sisa / budget) * 1000) / 10) : 0;

  const pembagiHari = infoWaktu.sisaHari > 0 ? infoWaktu.sisaHari : 1;
  const jatahHarian = sisa > 0 ? Math.floor(sisa / pembagiHari) : 0;

  let barisSelisih = "";
  if (selisihHariIni !== null && selisihHariIni !== undefined && selisihHariIni !== 0) {
    if (selisihHariIni > 0) {
      barisSelisih = "\n• <b>Pengeluaran Hari Ini:</b> +Rp " + formatRupiah(selisihHariIni) + " <i>(naik dari kemarin Rp " + formatRupiah(spent - selisihHariIni) + ")</i>";
    } else {
      barisSelisih = "\n• <b>Koreksi Hari Ini:</b> -Rp " + formatRupiah(Math.abs(selisihHariIni));
    }
  }

  // Komentar ala CFO Gen-Z sesuai persentase pemakaian vs persentase perjalanan bulan
  const pctWaktuBerjalan = Math.round((infoWaktu.tanggalHariIni / infoWaktu.jumlahHariBulanIni) * 100);
  let vibeCheck = "";

  if (sisa < 0) {
    vibeCheck =
      "🚨 <b>RED FLAG / BONCOS ALERT:</b> Udah jebol <b>Rp " + formatRupiah(Math.abs(sisa)) + "</b> dari budget! Stop jajan di pos ini dulu ya bestie 🛑";
  } else if (pctTerpakai >= 85 && infoWaktu.sisaHari > 5) {
    vibeCheck =
      "💡 <b>Jatah Aman Harian:</b> Maks <b>Rp " + formatRupiah(jatahHarian) + " / hari</b>\n" +
      "⚠️ <i>Vibe Check: Udah lampu kuning nih! Rem tipis-tipis biar akhir bulan nggak makan promag.</i>";
  } else if (pctTerpakai > pctWaktuBerjalan + 15) {
    vibeCheck =
      "💡 <b>Jatah Aman Harian:</b> Maks <b>Rp " + formatRupiah(jatahHarian) + " / hari</b>\n" +
      "👀 <i>Vibe Check: Agak ngebut nih pengeluarannya dibanding tanggal kalender. Keep it mindful ya!</i>";
  } else {
    vibeCheck =
      "💡 <b>Jatah Aman Harian:</b> Maks <b>Rp " + formatRupiah(jatahHarian) + " / hari</b>\n" +
      "🟢 <i>Vibe Check: Cashflow masih sehat & on-track. Slay! ✨</i>";
  }

  return (
    "🏷️ <b>" + item.name.toUpperCase() + "</b>\n" +
    "<code>" + buatProgressBar(pctTerpakai) + " " + pctTerpakai + "% Terpakai</code>\n" +
    "• <b>Anggaran:</b> Rp " + formatRupiah(budget) + "\n" +
    "• <b>Terpakai:</b> Rp " + formatRupiah(spent) + " (" + pctTerpakai + "%)" +
    barisSelisih + "\n" +
    "• <b>Sisa Anggaran:</b> <b>Rp " + formatRupiah(sisa) + " (" + pctSisa + "% lagi)</b>\n\n" +
    "⏳ <b>Sisa Hari Bulan Ini:</b> " + infoWaktu.sisaHari + " hari lagi <i>(s/d " + infoWaktu.akhirBulanTeks + ")</i>\n" +
    vibeCheck
  );
}

function kirimLaporanSemuaKategori(chatId) {
  const data = ambilDataAnggaran();
  const keys = Object.keys(data);

  if (keys.length === 0) {
    kirimPesan(
      chatId,
      "📭 <b>Dompet masih kosong melompong di catatan Finflo nih!</b>\n\n" +
      "Ketik perintah ini buat mulai set budget kamu:\n" +
      "<code>/anggaran Makanan 1000000</code>\n" +
      "<code>/anggaran Rokok 300rb</code>\n" +
      "<code>/anggaran Travel 500rb</code>\n" +
      "<code>/anggaran Kopi 200rb</code>"
    );
    return;
  }

  const infoWaktu = hitungInfoHariBulanIni();
  let totalBudget = 0;
  let totalSpent = 0;
  const blokList = [];

  for (let i = 0; i < keys.length; i++) {
    const item = data[keys[i]];
    totalBudget += item.budget || 0;
    totalSpent += item.spent || 0;
    blokList.push(buatBlokDetailKategori(item, null, infoWaktu));
  }

  const totalSisa = totalBudget - totalSpent;
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;
  const totalPctSisa = totalBudget > 0 ? Math.max(0, Math.round((totalSisa / totalBudget) * 1000) / 10) : 0;
  const pembagiHari = infoWaktu.sisaHari > 0 ? infoWaktu.sisaHari : 1;
  const totalJatahHarian = totalSisa > 0 ? Math.floor(totalSisa / pembagiHari) : 0;

  const header =
    "📊 <b>LAPORAN CFO FINFLO — " + infoWaktu.tanggalLengkap.toUpperCase() + "</b>\n" +
    "⏳ Sisa <b>" + infoWaktu.sisaHari + " hari</b> lagi menuju tutup buku (" + infoWaktu.akhirBulanTeks + ")\n" +
    "════════════════════\n\n";

  let footer =
    "\n\n════════════════════\n" +
    "💼 <b>EXECUTIVE SUMMARY (" + keys.length + " Kategori)</b>\n" +
    "• Total Anggaran: Rp " + formatRupiah(totalBudget) + "\n" +
    "• Total Terpakai: Rp " + formatRupiah(totalSpent) + " (" + totalPct + "%)\n" +
    "• <b>Total Sisa: Rp " + formatRupiah(totalSisa) + " (" + totalPctSisa + "% lagi)</b>\n" +
    "💡 <b>Total Jatah Gabungan: Maks Rp " + formatRupiah(totalJatahHarian) + " / hari</b>";

  if (infoWaktu.sisaHari === 0) {
    footer += "\n\n" + buatPesanReminderAkhirBulan();
  }

  kirimPesanDenganMenu(chatId, header + blokList.join("\n\n────────────────────\n\n") + footer);
}

// ============================================================================
// 6. PENGATURAN JADWAL & PENGINGAT HARIAN + REMINDER AKHIR BULAN FINANCEFLOW
// ============================================================================
function kelolaJadwalNotifikasi(chatId, text) {
  const props = PropertiesService.getScriptProperties();
  const arg = text.replace(/^\/jadwal\s*/i, "").trim().toLowerCase();

  if (!arg || text === "⏰ Atur Jam Reminder") {
    const jamSekarang = props.getProperty("NOTIF_HOUR") || "20";
    const statusTeks = jamSekarang === "off"
      ? "🔕 <b>Lagi Di-mute (Off)</b>"
      : "🔔 <b>Standby tiap jam " + jamSekarang.padStart(2, "0") + ":00 WIB</b>";

    kirimPesan(
      chatId,
      "⏰ <b>Jadwal Reminder Harian Finflo</b>\n\n" +
      "Status sekarang: " + statusTeks + "\n\n" +
      "<b>Mau ganti jam? Langsung ketik aja:</b>\n" +
      "• Jam 7 malam: <code>/jadwal 19</code>\n" +
      "• Jam 8 malam: <code>/jadwal 20</code>\n" +
      "• Jam 9 malam: <code>/jadwal 21</code>\n" +
      "• Libur dulu: <code>/jadwal off</code>"
    );
    return;
  }

  if (arg === "off" || arg === "mati") {
    hapusSemuaTriggerPengingat();
    props.setProperty("NOTIF_HOUR", "off");
    kirimPesan(chatId, "🔕 <b>Oke bestie, reminder harian Finflo udah di-mute dulu.</b>\nKetik <code>/jadwal 20</code> kapan aja kalau mau diaktifin lagi ya!");
    return;
  }

  const jamMatch = arg.match(/^(\d{1,2})(?::\d{2})?$/);
  if (!jamMatch) {
    kirimPesan(chatId, "⚠️ Ketik angka jam dari <code>0</code> sampai <code>23</code>, atau <code>off</code> ya.\nContoh: <code>/jadwal 20</code>");
    return;
  }

  const jam = parseInt(jamMatch[1], 10);
  if (jam < 0 || jam > 23) {
    kirimPesan(chatId, "⚠️ Angka jamnya antara 0 sampai 23 ya bestie.");
    return;
  }

  pasangTriggerJam(jam);
  props.setProperty("NOTIF_HOUR", String(jam));

  kirimPesan(
    chatId,
    "✅ <b>Siap! Jadwal reminder harian udah Finflo geser!</b>\n" +
    "Nanti aku bakal colek kamu tiap hari sekitar jam <b>" + String(jam).padStart(2, "0") + ":00 WIB</b>."
  );
}

function pasangTriggerJam(jam) {
  hapusSemuaTriggerPengingat();
  ScriptApp.newTrigger("kirimPengingatHarian")
    .timeBased()
    .atHour(jam)
    .everyDays(1)
    .inTimezone("Asia/Jakarta")
    .create();
}

function hapusSemuaTriggerPengingat() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "kirimPengingatHarian") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function buatPesanReminderAkhirBulan() {
  return (
    "💻 <b> WAKTUNYA TUTUP BUKU BULANAN (FINANCEFLOW REMINDER)!</b> 📊\n" +
    "Berhubung hari ini udah penghujung bulan, jangan lupa:\n" +
    "1️⃣ Klik <b>Export CSV</b> di aplikasi <i>Meow Money Manager</i> kamu.\n" +
    "2️⃣ Buka laptop & nyalain aplikasi <b>FinanceFlow (<code>Finance_Alzha</code>)</b>.\n" +
    "3️⃣ Upload CSV-nya dan <b>Export Laporan PDF</b> bulananmu biar <i>track record</i> finansial kamu makin rapi! 🚀✨"
  );
}

// Fungsi yang dipanggil otomatis setiap hari oleh Trigger Google
function kirimPengingatHarian() {
  const props = PropertiesService.getScriptProperties();
  const ownerChatId = props.getProperty("OWNER_CHAT_ID");
  if (!ownerChatId) return;

  cekPergantianBulanOtomatis(ownerChatId);

  const data = ambilDataAnggaran();
  const keys = Object.keys(data);
  const infoWaktu = hitungInfoHariBulanIni();

  if (keys.length === 0) {
    kirimPesan(
      ownerChatId,
      "🔔 <b>Ping dari Finflo! (" + infoWaktu.tanggalSingkat + ")</b>\n" +
      "Bestie, kamu belum set budget bulanan nih. Yuk ketik <code>/anggaran Makanan 1jt</code> biar kita mulai kawal dompetmu!"
    );
    return;
  }

  const barisKategori = [];
  for (let i = 0; i < keys.length; i++) {
    const item = data[keys[i]];
    const sisa = (item.budget || 0) - (item.spent || 0);
    barisKategori.push(
      "• <b>" + item.name + "</b> (Kemarin: Rp " + formatRupiah(item.spent || 0) + " | Sisa: Rp " + formatRupiah(sisa) + ")"
    );
  }

  const contoh = data[keys[0]].name.toLowerCase();
  let pesan =
    "🔔 <b>Time Check dari Finflo! (" + infoWaktu.tanggalSingkat + ")</b> 💼✨\n\n" +
    "Malam Alzha! Coba intip aplikasi <b>Meow Money Manager</b> di HP kamu sekarang, udah keluar berapa aja nih hari ini?\n\n" +
    barisKategori.join("\n") + "\n\n" +
    "⏳ <i>Sisa " + infoWaktu.sisaHari + " hari lagi menuju akhir bulan (" + infoWaktu.akhirBulanTeks + ").</i>\n" +
    "✍️ Langsung bales chat ini pake format: <code>" + contoh + " 300000</code>";

  // Jika hari ini adalah hari terakhir di bulan tersebut (Misal tgl 30/31, sisaHari === 0)
  if (infoWaktu.sisaHari === 0) {
    pesan += "\n\n────────────────────\n" + buatPesanReminderAkhirBulan();
  }

  kirimPesanDenganMenu(ownerChatId, pesan);
}

// ============================================================================
// 7. DETEKSI PERGANTIAN BULAN OTOMATIS (TANGGAL 1) & RESET
// ============================================================================
function cekPergantianBulanOtomatis(chatId) {
  const props = PropertiesService.getScriptProperties();
  const bulanSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM");
  const bulanTersimpan = props.getProperty("ACTIVE_MONTH");

  if (!bulanTersimpan) {
    props.setProperty("ACTIVE_MONTH", bulanSekarang);
    return;
  }

  if (bulanSekarang !== bulanTersimpan) {
    props.setProperty("ACTIVE_MONTH", bulanSekarang);
    resetSemuaPemakaian(chatId, true);
  }
}

function resetSemuaPemakaian(chatId, isOtomatisBulanBaru) {
  const data = ambilDataAnggaran();
  const keys = Object.keys(data);

  for (let i = 0; i < keys.length; i++) {
    data[keys[i]].spent = 0;
    data[keys[i]].updatedAt = formatTanggalIndo(new Date());
  }
  simpanDataAnggaran(data);

  if (isOtomatisBulanBaru) {
    kirimPesan(
      chatId,
      "🗓️ <b>Happy New Month, Alzha! Welcome to Tanggal 1!</b> ✨\n\n" +
      "Finflo udah otomatis nge-reset angka pemakaian semua kategori kamu balik ke <b>Rp 0</b> buat bulan baru ini (batas budget bulanan kamu tetep aman tersimpan).\n\n" +
      "💡 <i>Anyway, kalau kamu belum sempet rekap pengeluaran bulan kemarin, jangan lupa export CSV dari Meow terus jalanin <b>FinanceFlow (Finance_Alzha)</b> di laptop ya!</i> 💻📊"
    );
  } else {
    kirimPesanDenganMenu(
      chatId,
      "🔄 <b>Fresh Start!</b>\nSemua angka pemakaian kategori udah Finflo reset balik ke <b>Rp 0</b> ya bestie."
    );
  }
}

// ============================================================================
// 8. UTILITAS TANGGAL, FORMAT RUPIAH, & TELEGRAM API
// ============================================================================
function hitungInfoHariBulanIni() {
  const now = new Date();
  const tahun = parseInt(Utilities.formatDate(now, "Asia/Jakarta", "yyyy"), 10);
  const bulanIndex = parseInt(Utilities.formatDate(now, "Asia/Jakarta", "M"), 10) - 1; // 0-11
  const tanggalHariIni = parseInt(Utilities.formatDate(now, "Asia/Jakarta", "d"), 10);

  const jumlahHariBulanIni = new Date(tahun, bulanIndex + 1, 0).getDate();
  const sisaHari = Math.max(0, jumlahHariBulanIni - tanggalHariIni);

  const namaBulanPendek = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const namaBulanPanjang = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  return {
    tanggalHariIni: tanggalHariIni,
    jumlahHariBulanIni: jumlahHariBulanIni,
    sisaHari: sisaHari,
    tanggalSingkat: tanggalHariIni + " " + namaBulanPendek[bulanIndex],
    tanggalLengkap: tanggalHariIni + " " + namaBulanPanjang[bulanIndex] + " " + tahun,
    akhirBulanTeks: jumlahHariBulanIni + " " + namaBulanPendek[bulanIndex]
  };
}

function parseNominal(str) {
  if (!str) return NaN;
  let s = str.toLowerCase().trim();
  let multiplier = 1;

  if (s.endsWith("juta") || s.endsWith("jt")) {
    multiplier = 1000000;
    s = s.replace(/(juta|jt)$/i, "").trim();
  } else if (s.endsWith("ribu") || s.endsWith("rb") || s.endsWith("k")) {
    multiplier = 1000;
    s = s.replace(/(ribu|rb|k)$/i, "").trim();
  }

  if (multiplier > 1) {
    s = s.replace(",", ".");
    return Math.round(parseFloat(s) * multiplier);
  } else {
    s = s.replace(/[.,\s]/g, "");
    return parseInt(s, 10);
  }
}

function formatRupiah(angka) {
  const isNegatif = angka < 0;
  const abs = Math.abs(Math.round(angka || 0));
  const hasil = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNegatif ? "-" + hasil : hasil;
}

function buatProgressBar(persen) {
  const p = Math.max(0, Math.min(100, persen));
  const terisi = Math.round(p / 10);
  const kosong = 10 - terisi;
  return "[" + "█".repeat(terisi) + "░".repeat(kosong) + "]";
}

function rapikanNama(str) {
  return str
    .trim()
    .split(/\s+/)
    .map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatTanggalIndo(dateObj) {
  return Utilities.formatDate(dateObj, "Asia/Jakarta", "dd-MM-yyyy HH:mm");
}

function ambilDataAnggaran() {
  const raw = PropertiesService.getScriptProperties().getProperty("BUDGET_DATA");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function simpanDataAnggaran(data) {
  PropertiesService.getScriptProperties().setProperty("BUDGET_DATA", JSON.stringify(data));
}

function kirimPesan(chatId, text) {
  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: String(chatId),
    text: text,
    parse_mode: "HTML"
  };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function kirimPesanDenganMenu(chatId, text) {
  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: String(chatId),
    text: text,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "📊 Spill Status Budget" }, { text: "⏰ Atur Jam Reminder" }],
        [{ text: "📖 Cheat Sheet Perintah" }]
      ],
      resize_keyboard: true
    }
  };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
