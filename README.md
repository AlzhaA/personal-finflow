# 📊 FinanceFlow - Aplikasi Laporan Keuangan Bulanan

Aplikasi desktop & web lokal interaktif untuk analisis keuangan bulanan, visualisasi pengeluaran/pendapatan, komparasi antar-bulan (*Month-over-Month*), dan ekspor laporan PDF ReportLab profesional.

---

## 🚀 Cara Menjalankan

### Cara 1: Menggunakan File Batch (Paling Mudah)
Cukup **klik ganda (double click)** file:
```
run.bat
```

### Cara 2: Melalui Terminal / Command Prompt
1. Buka Terminal / CMD di folder `Finance_Alzha`:
   ```bash
   cd C:\Users\alzha\Documents\Antigravity_Project\Finance_Alzha
   python app.py
   ```
2. Aplikasi akan otomatis membuka browser di:
   ```
   http://127.0.0.1:5000
   ```

---

## 🛠️ Fitur Utama

1. **Dashboard Metrik Interaktif**:
   - Total Income, Total Expense, Reimbursement, Saldo Bersih (*Net Balance*), dan Rasio Pengeluaran (% Expense).
   - Highlight: Hari paling boros, Kategori terbesar, dan Transaksi tunggal terbesar.
2. **Visualisasi Grafik (Chart.js)**:
   - 🔥 Top 7 Hari Paling Boros (Bar Chart + Keterangan)
   - 🏷️ Pengeluaran per Kategori (Horizontal Bar Chart)
   - 🥧 Komposisi Cashflow (Doughnut Chart)
   - 🏦 Pengeluaran per Rekening/Aset (BCA, Mandiri, Gopay, Cash)
   - 📈 Trend Arus Kas Harian (Smooth Line Chart)
3. **Komparasi Antar-Bulan (MoM)**:
   - Tabel dan grafik perbandingan pengeluaran kategori bulan aktif vs bulan sebelumnya, lengkap dengan persentase kenaikan/penurunan.
4. **Data Table Explorer**:
   - Pencarian instan (search filter).
   - Pengurutan dinamis (berdasarkan Tanggal, Jumlah, Reimburse, atau Expense).
   - Pagination (10, 25, 50, 100 baris per halaman).
5. **Ekspor Laporan PDF Profesional**:
   - Menghasilkan file PDF A4 berkualitas tinggi menggunakan **ReportLab**.
   - Menyertakan ringkasan metrik, grafik beresolusi tajam, tabel perbandingan, dan seluruh rincian transaksi.
6. **Upload CSV Fleksibel**:
   - Dukungan drag-and-drop file CSV baru kapan saja.
   - Format tanggal fleksibel dengan dukungan penamaan bulan bahasa Indonesia (`Mei`, `Agu`, `Okt`, `Des`, dll.).
   - Dilengkapi file `sample_transaksi.csv` bawaan siap uji.

---

## 📁 Struktur File Project

```
Finance_Alzha/
├── app.py                  # Entrypoint server Flask & REST API
├── data_processor.py       # Logika data preprocessing, metrik, dan agregasi
├── pdf_generator.py        # Modul pembuat laporan PDF ReportLab
├── sample_transaksi.csv    # Dataset transaksi contoh
├── requirements.txt        # Dependensi Python
├── run.bat                 # Shortcut 1-klik Windows
├── README.md               # Dokumentasi project
├── templates/
│   └── index.html          # Template antarmuka web modern
└── static/
    ├── css/
    │   └── style.css       # Styling sistem & glassmorphism
    └── js/
        └── app.js          # Interaktivitas frontend & Chart.js
```

---

## 📦 Dependensi

Jika menjalankan di komputer/lingkungan baru, instal dependensi dengan:
```bash
pip install -r requirements.txt
```
