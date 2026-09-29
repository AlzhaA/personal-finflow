"""
app.py
Server Utama Aplikasi Laporan Keuangan Bulanan.
Dijalankan dengan: python app.py
"""

import os
import io
import threading
import webbrowser
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_file

from data_processor import (
    preprocess_dataframe,
    get_filter_options,
    apply_filters,
    calculate_core_metrics,
    get_chart_data,
    get_category_comparison,
    format_idr
)
from pdf_generator import build_pdf_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_CSV_PATH = os.path.join(BASE_DIR, 'sample_transaksi.csv')
OUTPUT_DIR = os.path.join(BASE_DIR, 'exports')
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static'),
    static_url_path='/static'
)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max

CURRENT_DF = None

def initialize_default_data():
    """Memuat data transaksi default saat server pertama kali start."""
    global CURRENT_DF
    if os.path.exists(SAMPLE_CSV_PATH):
        try:
            df_raw = pd.read_csv(SAMPLE_CSV_PATH)
            CURRENT_DF = preprocess_dataframe(df_raw)
            print(f"[OK] Data awal berhasil dimuat: {len(CURRENT_DF)} baris.")
        except Exception as e:
            print(f"[WARN] Gagal memuat data default: {e}")
            CURRENT_DF = pd.DataFrame()
    else:
        print("[WARN] sample_transaksi.csv tidak ditemukan.")
        CURRENT_DF = pd.DataFrame()

initialize_default_data()

@app.route('/')
def index():
    """Halaman Dashboard Utama"""
    return render_template('index.html')

@app.route('/api/init', methods=['GET'])
def api_init():
    """Mengembalikan opsi filter awal"""
    global CURRENT_DF
    if CURRENT_DF is None or len(CURRENT_DF) == 0:
        initialize_default_data()

    if CURRENT_DF is not None and len(CURRENT_DF) > 0:
        options = get_filter_options(CURRENT_DF)
        return jsonify({'status': 'success', 'options': options})
    return jsonify({'status': 'error', 'message': 'Data transaksi belum dimuat.'})

@app.route('/api/load_sample', methods=['POST'])
def api_load_sample():
    """Reset dan muat data transaksi sampel bawaan"""
    global CURRENT_DF
    initialize_default_data()
    if CURRENT_DF is not None and len(CURRENT_DF) > 0:
        options = get_filter_options(CURRENT_DF)
        return jsonify({'status': 'success', 'options': options})
    return jsonify({'status': 'error', 'message': 'File sampel tidak ditemukan.'}), 400

@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Mengunggah dan memproses file CSV baru dari pengguna"""
    global CURRENT_DF
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'Tidak ada file yang diunggah.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'Nama file kosong.'}), 400

    try:
        df_raw = pd.read_csv(io.BytesIO(file.read()))
        df_clean = preprocess_dataframe(df_raw)
        CURRENT_DF = df_clean
        options = get_filter_options(CURRENT_DF)
        return jsonify({
            'status': 'success',
            'message': f'Berhasil memproses {len(CURRENT_DF)} transaksi.',
            'options': options
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Gagal membaca CSV: {str(e)}'}), 400

@app.route('/api/dashboard', methods=['POST'])
def api_dashboard():
    """Menghitung metrik, data grafik, tabel terfilter, dan data komparasi"""
    global CURRENT_DF
    if CURRENT_DF is None or len(CURRENT_DF) == 0:
        return jsonify({'status': 'error', 'message': 'Data belum dimuat.'}), 400

    payload = request.get_json() or {}
    filters = payload.get('filters', {})
    search = payload.get('search', '')
    sort_by = payload.get('sort_by', 'Tanggal')
    sort_asc = payload.get('sort_asc', False)
    page = int(payload.get('page', 1))
    per_page = int(payload.get('per_page', 25))

    try:
        df_filtered = apply_filters(
            CURRENT_DF,
            filters=filters,
            search_query=search,
            sort_by=sort_by,
            sort_asc=sort_asc
        )

        metrics = calculate_core_metrics(df_filtered)
        charts = get_chart_data(df_filtered)

        min_date = df_filtered['Tanggal'].min() if len(df_filtered) > 0 else pd.Timestamp.now()
        comparison = get_category_comparison(CURRENT_DF, min_date) if len(CURRENT_DF) > 0 else {'current_label': '-', 'prev_label': '-', 'rows': []}

        total_records = len(df_filtered)
        total_pages = max(1, (total_records + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))

        start_idx = (page - 1) * per_page
        end_idx = min(start_idx + per_page, total_records)
        df_page = df_filtered.iloc[start_idx:end_idx]

        table_rows = []
        for _, row in df_page.iterrows():
            table_rows.append({
                'Tanggal_Format': row['Tanggal_Format'],
                'Kategori': row['Kategori'],
                'Jenis': row['Jenis'],
                'Jumlah': float(row['Jumlah']),
                'Jumlah_Formatted': format_idr(row['Jumlah']),
                'Aset': row['Aset'],
                'Reimburse': float(row['Reimburse']),
                'Reimburse_Formatted': format_idr(row['Reimburse']),
                'Komentar': row['Komentar']
            })

        pagination_info = {
            'current_page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'total_records': total_records,
            'start_index': start_idx + 1 if total_records > 0 else 0,
            'end_index': end_idx
        }

        return jsonify({
            'status': 'success',
            'metrics': metrics,
            'charts': charts,
            'comparison': comparison,
            'table_data': table_rows,
            'pagination': pagination_info
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/export_pdf', methods=['POST'])
def api_export_pdf():
    """Menghasilkan file PDF dan mengunduhnya"""
    global CURRENT_DF
    if CURRENT_DF is None or len(CURRENT_DF) == 0:
        return jsonify({'status': 'error', 'message': 'Data transaksi kosong.'}), 400

    payload = request.get_json() or {}
    filters = payload.get('filters', {})
    search = payload.get('search', '')
    sort_by = payload.get('sort_by', 'Tanggal')
    sort_asc = payload.get('sort_asc', False)

    try:
        df_filtered = apply_filters(
            CURRENT_DF,
            filters=filters,
            search_query=search,
            sort_by=sort_by,
            sort_asc=sort_asc
        )

        if len(df_filtered) == 0:
            return jsonify({'status': 'error', 'message': 'Tidak ada data transaksi yang dipilih untuk dicetak.'}), 400

        pdf_filename = f"laporan_keuangan_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_pdf_path = os.path.join(OUTPUT_DIR, pdf_filename)

        build_pdf_report(df_filtered, CURRENT_DF, output_pdf_path)

        return send_file(
            output_pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=pdf_filename
        )
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Gagal membuat PDF: {str(e)}'}), 500

def open_browser():
    """Membuka browser otomatis saat aplikasi dijalankan"""
    webbrowser.open_new_tab("http://127.0.0.1:5000")

if __name__ == '__main__':
    print("=" * 60)
    print(" [FINANCEFLOW] APLIKASI LAPORAN KEUANGAN BULANAN")
    print("=" * 60)
    print(" [URL] Server berjalan di: http://127.0.0.1:5000")
    print(" [INFO] Tekan CTRL+C di terminal untuk menghentikan server.")
    print("=" * 60)

    threading.Timer(1.2, open_browser).start()

    app.run(host='127.0.0.1', port=5000, debug=False)
