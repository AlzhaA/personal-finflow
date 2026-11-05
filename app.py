"""
app.py
Server Utama Aplikasi Laporan Keuangan Bulanan.
Dijalankan dengan: python app.py
"""

import os
import io
import json
import urllib.request
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

# Muat konfigurasi .env secara manual (tanpa perlu dependensi eksternal)
ENV_PATH = os.path.join(BASE_DIR, '.env')
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-flash-latest')

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

        # Otomatis buka file PDF di pembaca PDF default & buka folder explorer
        try:
            os.startfile(output_pdf_path)
        except Exception as open_err:
            print(f"[WARN] Gagal membuka PDF otomatis: {open_err}")

        return jsonify({
            'status': 'success',
            'message': 'Laporan PDF berhasil dibuat!',
            'filename': pdf_filename,
            'file_path': output_pdf_path,
            'folder_path': OUTPUT_DIR
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Gagal membuat PDF: {str(e)}'}), 500

@app.route('/api/open_folder', methods=['POST'])
def api_open_folder():
    """Membuka folder exports di File Explorer"""
    try:
        os.startfile(OUTPUT_DIR)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/gemini_chat', methods=['POST'])
def api_gemini_chat():
    """Endpoint integrasi Gemini AI Advisor dengan konteks keuangan real-time"""
    global GEMINI_API_KEY, GEMINI_MODEL, CURRENT_DF

    payload = request.get_json() or {}
    user_prompt = payload.get('message', '').strip()
    active_filters = payload.get('filters', {})

    if not user_prompt:
        return jsonify({'status': 'error', 'message': 'Pesan tidak boleh kosong.'}), 400

    api_key = os.environ.get('GEMINI_API_KEY') or GEMINI_API_KEY
    if not api_key or 'your_gemini' in api_key.lower():
        return jsonify({
            'status': 'error',
            'message': 'Gemini API Key belum diatur di file .env. Silakan dapatkan API Key gratis di https://aistudio.google.com/apikey dan masukkan ke file .env.'
        }), 400

    # Buat ringkasan data keuangan aktif untuk diberikan ke Gemini
    context_text = "Data transaksi saat ini belum dimuat."
    if CURRENT_DF is not None and len(CURRENT_DF) > 0:
        try:
            df_filtered = apply_filters(CURRENT_DF, filters=active_filters)
            metrics = calculate_core_metrics(df_filtered)
            
            # Hitung pengeluaran per kategori
            df_exp = df_filtered[df_filtered['Expense'] > 0]
            cat_series = df_exp.groupby('Kategori')['Expense'].sum().sort_values(ascending=False)
            kategori_str = "\n".join([f"- {k}: Rp {format_idr(v)}" for k, v in cat_series.items()])

            context_text = f"""
[DATA KEUANGAN FINANCEFLOW SAAT INI]
• Periode Analisis: {metrics.get('periode_text', 'Semua')}
• Total Pemasukan (Income): Rp {format_idr(metrics.get('income', 0))}
• Total Pengeluaran (Expense): Rp {format_idr(metrics.get('expense', 0))}
• Sisa Saldo Bersih (Net Cashflow): Rp {format_idr(metrics.get('net', 0))}
• Rasio Pengeluaran terhadap Pemasukan: {metrics.get('pct_expense', 0):.1f}%
• Hari Paling Boros: {metrics.get('hari_terboros', '-')}
• Kategori Terbesar: {metrics.get('kategori_terbesar', '-')}
• Transaksi Tunggal Terbesar: {metrics.get('transaksi_terbesar_detail', '-')} (Rp {format_idr(metrics.get('transaksi_terbesar_val', 0))})

[RINCIAN PENGELUARAN PER KATEGORI]
{kategori_str if kategori_str else 'Belum ada pengeluaran'}
""".strip()
        except Exception as e:
            context_text = f"Gagal mengekstrak konteks data: {str(e)}"

    system_instruction = (
        "Kamu adalah Finflo, asisten dan konsultan keuangan pribadi cerdas di aplikasi FinanceFlow milik Alzha. "
        "Gaya bicaramu ramah, profesional, solutif, dan sedikit santai (Gen-Z friendly tapi tetap kredibel). "
        "Gunakan data keuangan di bawah ini untuk menjawab pertanyaan pengguna dengan akurat. "
        "Jika ditanya perhitungan atau rekomendasi anggaran, berikan analisis konkret berdasarkan data yang ada. "
        "Format jawaban dengan rapi menggunakan Markdown (bold, bullet points) agar mudah dibaca.\n\n"
        f"{context_text}"
    )

    # Ambil model aktif dari environment atau fallback ke daftar model stabil
    primary_model = os.environ.get('GEMINI_MODEL') or GEMINI_MODEL or 'gemini-3.5-flash-lite'
    candidate_models = [primary_model, 'gemini-3.1-flash-lite', 'gemini-3.5-flash']
    # Hapus duplikasi jika ada
    candidate_models = list(dict.fromkeys(candidate_models))

    req_body = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_instruction}\n\nPertanyaan Pengguna:\n{user_prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096
        }
    }

    last_error = None
    for model_name in candidate_models:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            req = urllib.request.Request(
                gemini_url,
                data=json.dumps(req_body).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=45) as response:
                res_json = json.loads(response.read().decode('utf-8'))
                reply_text = res_json['candidates'][0]['content']['parts'][0]['text']
                return jsonify({'status': 'success', 'reply': reply_text, 'model_used': model_name})
        except urllib.error.HTTPError as http_err:
            err_msg = http_err.read().decode('utf-8')
            last_error = f"HTTP {http_err.code} ({model_name}): {err_msg}"
            # Coba model berikutnya jika error 503 (server sibuk) atau 429
            continue
        except Exception as e:
            last_error = f"Error ({model_name}): {str(e)}"
            continue

    return jsonify({'status': 'error', 'message': f'Gagal menghubungi Gemini: {last_error}'}), 500

def start_server():
    """Menjalankan server Flask di background thread"""
    app.run(host='127.0.0.1', port=5000, debug=False, threaded=True)

if __name__ == '__main__':
    print("=" * 60)
    print(" [FINANCEFLOW] APLIKASI LAPORAN KEUANGAN BULANAN")
    print("=" * 60)

    try:
        import webview
        print(" [INFO] Membuka jendela desktop FinanceFlow...")
        print(" [INFO] Menutup jendela (klik X) akan keluar dari aplikasi secara otomatis.")
        print("=" * 60)

        # Jalankan server Flask di thread background (daemon)
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        # Buka jendela aplikasi desktop mandiri
        window = webview.create_window(
            title="FinanceFlow - Laporan Keuangan Bulanan",
            url="http://127.0.0.1:5000",
            width=1280,
            height=850,
            min_size=(960, 600),
            text_select=True
        )
        webview.start()

    except ImportError:
        print(" [WARN] pywebview tidak ditemukan, membuka di browser...")
        print(" [URL]  http://127.0.0.1:5000")
        print("=" * 60)
        threading.Timer(1.2, lambda: webbrowser.open("http://127.0.0.1:5000")).start()
        app.run(host='127.0.0.1', port=5000, debug=False)
