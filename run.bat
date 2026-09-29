@echo off
title FinanceFlow - Laporan Keuangan Bulanan
cd /d "%~dp0"
echo ========================================================
echo   Menjalankan Aplikasi Laporan Keuangan Bulanan
echo ========================================================
echo Membuka server lokal di http://127.0.0.1:5000 ...
python app.py
pause
