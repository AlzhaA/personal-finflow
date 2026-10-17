# Panduan Pemasangan Finflo — Bot Telegram CFO Pribadi (Google Apps Script)

File kode utama sudah siap di [`Code.gs`](./Code.gs). Ikuti 3 tahap mudah di bawah ini untuk mengaktifkan **Finflo** secara gratis 24 jam menggunakan **Google Apps Script**.

---

## Tahap 1: Buat Bot "Finflo" di Aplikasi Telegram (1 Menit)

1. Buka aplikasi **Telegram** di HP atau Laptop Anda.
2. Di kolom pencarian, ketik **`@BotFather`** (pilih akun resmi yang ada tanda centang biru).
3. Klik tombol **Start** atau kirim pesan:
   ```text
   /newbot
   ```
4. **BotFather** akan meminta nama tampilan bot Anda. Balas:
   ```text
   Finflo
   ```
5. **BotFather** akan meminta *username* untuk bot Anda (wajib diakhiri kata `bot` dan tanpa spasi). Contoh:
   ```text
   finflo_alzha_bot
   ```
   *(Jika username tersebut sudah dipakai orang lain, tambahkan angka misalnya `finflo_alzha26_bot`).*
6. Setelah berhasil, **BotFather** akan memberikan pesan berisi **HTTP API Token** (contohnya seperti: `7123456789:AAHxyz123456...`).
7. **Salin (Copy) kode Token tersebut.**

---

## Tahap 2: Pasang Kode di Google Apps Script (3 Menit)

1. Buka browser di laptop Anda dan kunjungi: **[https://script.google.com](https://script.google.com)** (login dengan akun Gmail Anda).
2. Klik tombol **New project** (atau **Proyek baru**) di pojok kiri atas.
3. Di bagian atas, ganti nama `Untitled project` menjadi **`Finflo - Bot Alzha`**.
4. Hapus seluruh isi teks bawaan (`function myFunction() { ... }`) di kotak editor kode.
5. Buka file [`telegram_bot/Code.gs`](./Code.gs) dari folder proyek ini, **Copy seluruh isinya**, lalu **Paste** ke dalam editor Google Apps Script.
6. Lihat **Baris 18** di kode tersebut:
   ```javascript
   const TELEGRAM_BOT_TOKEN = "ISI_TOKEN_DARI_BOTFATHER_DI_SINI";
   ```
   Ganti tulisan `ISI_TOKEN_DARI_BOTFATHER_DI_SINI` dengan **Token** yang Anda dapat dari `@BotFather` pada Tahap 1 (pastikan tanda kutip `"` tetap ada).
7. Tekan **`Ctrl + S`** (atau klik ikon disket **Simpan**) di bagian atas.

---

## Tahap 3: Deploy & Aktifkan Finflo (2 Menit)

1. Di pojok kanan atas layar Google Apps Script, klik tombol biru **Deploy** $\rightarrow$ pilih **New deployment** (*Deployment baru*).
2. Klik ikon **Roda Gigi (⚙️)** di sebelah tulisan *Select type*, lalu pilih **Web app** (*Aplikasi web*).
3. Isi pengaturannya seperti ini:
   * **Description:** `Finflo v1`
   * **Execute as:** `Me` *(Saya)*
   * **Who has access:** Pilih **`Anyone`** *(Siapa saja)* — **Wajib pilih Anyone agar server Telegram bisa meneruskan chat ke Finflo.**
4. Klik tombol **Deploy**.
   * *Catatan: Jika muncul jendela "Authorize access" (Izinkan akses), klik **Authorize access** $\rightarrow$ pilih akun Gmail Anda $\rightarrow$ klik tulisan kecil **Advanced** (Lanjutan) di kiri bawah $\rightarrow$ klik **Go to Finflo - Bot Alzha (unsafe)** $\rightarrow$ klik **Allow** (Izinkan).*
5. Setelah berhasil, akan muncul **Web app URL** (berakhiran `/exec`). Klik tombol **Copy** di bawah URL tersebut, lalu klik **Done**.
6. Tempelkan URL tersebut ke **Baris 19** di dalam kode Anda:
   ```javascript
   const WEBAPP_URL = "https://script.google.com/macros/s/....../exec";
   ```
7. Tekan **`Ctrl + S`** (Simpan) sekali lagi!
8. Terakhir, lihat deretan menu di bagian atas kode (di sebelah tombol **Run / Jalankan** dan **Debug**):
   * Pastikan pilihan fungsi di sebelahnya tertulis **`setupBot`**.
   * Klik tombol **Run** (atau **Jalankan**).
   * Di bagian bawah layar (*Execution log*) akan muncul tulisan:
     `🎉 SETUP BERES! Sekarang buka bot Finflo di Telegram lalu ketik: /start`

---

## Tahap 4: Mulai Ngobrol Sama Finflo di Telegram!

Buka bot **Finflo** di Telegram Anda, klik **Start** (atau ketik `/start`), lalu masukkan 4 kategori awal Anda:

```text
/anggaran Makanan 1000000
/anggaran Rokok 300000
/anggaran Travel 500000
/anggaran Kopi 200000
```

Dan setiap malam saat diingatkan Finflo, cukup balas sesuai angka di **Meow Money Manager**:
```text
makanan 300000
```
atau sekaligus beberapa baris:
```text
makanan 300rb
rokok 50rb
kopi 25rb
```
