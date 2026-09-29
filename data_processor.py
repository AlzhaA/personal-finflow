"""
data_processor.py
Modul untuk pengolahan, pembersihan data transaksi, perhitungan metrik keuangan,
dan penyiapan data agregasi grafik.
"""

import numpy as np
import pandas as pd

MONTH_MAP_ID_TO_EN = {
    'Jan': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr',
    'Mei': 'May', 'Jun': 'Jun', 'Jul': 'Jul',
    'Agu': 'Aug', 'Sep': 'Sep', 'Okt': 'Oct',
    'Nov': 'Nov', 'Des': 'Dec'
}

def format_idr(value):
    """Format angka ke format Rupiah (tanpa simbol Rp)"""
    try:
        if pd.isna(value):
            return "0"
        return f"{int(round(float(value))):,}".replace(",", ".")
    except (ValueError, TypeError):
        return "0"

def preprocess_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Membersihkan dan menstandarisasi DataFrame transaksi."""
    df = df_raw.copy()

    # Pastikan kolom esensial ada
    required_cols = ['Tanggal', 'Kategori', 'Jenis', 'Jumlah']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Kolom wajib '{col}' tidak ditemukan dalam data.")

    # Kolom opsional default
    if 'Aset' not in df.columns:
        df['Aset'] = 'Cash'
    if 'Buku besar' not in df.columns:
        df['Buku besar'] = 'Utama'
    if 'Reimburse' not in df.columns:
        df['Reimburse'] = 0
    if 'Komentar' not in df.columns:
        df['Komentar'] = '[-]'

    # Parsing Tanggal dengan penggantian nama bulan Indonesia
    df['Tanggal_Raw'] = df['Tanggal'].astype(str)
    tanggal_clean = df['Tanggal_Raw'].copy()
    for id_mon, en_mon in MONTH_MAP_ID_TO_EN.items():
        tanggal_clean = tanggal_clean.str.replace(id_mon, en_mon, regex=False)

    df['Tanggal'] = pd.to_datetime(tanggal_clean, dayfirst=True, format='mixed', errors='coerce')
    # Jika ada tanggal kosong, isi dengan timestamp sekarang
    df['Tanggal'] = df['Tanggal'].fillna(pd.Timestamp.now())

    # Konversi Numerik
    df['Jumlah'] = pd.to_numeric(df['Jumlah'], errors='coerce').fillna(0)
    df['Reimburse'] = pd.to_numeric(df['Reimburse'], errors='coerce').fillna(0)

    # Standarisasi teks
    df['Kategori'] = df['Kategori'].fillna('Tidak Diketahui').astype(str).str.strip()
    df['Jenis'] = df['Jenis'].fillna('Pengeluaran').astype(str).str.strip()
    df['Aset'] = df['Aset'].fillna('Cash').astype(str).str.strip()
    df['Komentar'] = df['Komentar'].fillna('[-]').astype(str).str.strip()
    df['Buku besar'] = df['Buku besar'].fillna('Utama').astype(str).str.strip()

    # Hitung Expense & Income
    df['Expense'] = np.where(df['Jenis'].str.lower() == 'pengeluaran', df['Jumlah'].abs(), 0.0)
    df['Income'] = np.where(df['Jenis'].str.lower() == 'pendapatan', df['Jumlah'].abs(), 0.0)

    # Urutkan berdasarkan waktu transaksi
    df = df.sort_values('Tanggal').reset_index(drop=True)

    # Metadata Periode & Tanggal Format
    df['Bulan_Key'] = df['Tanggal'].dt.strftime('%Y-%m')
    df['Label_Bulan'] = df['Tanggal'].dt.strftime('%B %Y')
    df['Tanggal_Format'] = df['Tanggal'].dt.strftime('%d-%m-%Y %H:%M')
    df['Tanggal_Date'] = df['Tanggal'].dt.strftime('%Y-%m-%d')

    return df

def get_filter_options(df: pd.DataFrame) -> dict:
    """Mengambil daftar opsi unik untuk filter dropdown/checkbox."""
    months_order = df.sort_values('Tanggal')['Label_Bulan'].drop_duplicates().tolist()
    categories = sorted(df['Kategori'].unique().tolist())
    types = sorted(df['Jenis'].unique().tolist())
    assets = sorted(df['Aset'].unique().tolist())

    return {
        "Bulan": months_order,
        "Kategori": categories,
        "Jenis": types,
        "Aset": assets
    }

def apply_filters(df: pd.DataFrame, filters: dict = None, search_query: str = "", sort_by: str = "Tanggal", sort_asc: bool = False) -> pd.DataFrame:
    """Menerapkan filter bulan, kategori, jenis, aset, pencarian teks, dan pengurutan."""
    df_filtered = df.copy()

    if filters:
        column_mapping = {
            "Bulan": "Label_Bulan",
            "Kategori": "Kategori",
            "Jenis": "Jenis",
            "Aset": "Aset"
        }
        for filter_key, active_values in filters.items():
            if filter_key in column_mapping and active_values is not None:
                if len(active_values) > 0:
                    df_filtered = df_filtered[df_filtered[column_mapping[filter_key]].isin(active_values)]
                else:
                    return df_filtered.iloc[0:0]

    # Filter Kata Kunci Pencarian
    if search_query and search_query.strip():
        kw = search_query.strip().lower()
        search_cols = ['Tanggal_Format', 'Kategori', 'Jenis', 'Aset', 'Komentar', 'Buku besar']
        mask = False
        for c in search_cols:
            if c in df_filtered.columns:
                mask = mask | df_filtered[c].astype(str).str.lower().str.contains(kw, regex=False)
        df_filtered = df_filtered[mask]

    # Sort
    valid_sort_cols = ['Tanggal', 'Jumlah', 'Reimburse', 'Expense', 'Income', 'Kategori']
    if sort_by in valid_sort_cols:
        df_filtered = df_filtered.sort_values(by=sort_by, ascending=sort_asc)
    else:
        df_filtered = df_filtered.sort_values(by='Tanggal', ascending=False)

    return df_filtered

def calculate_core_metrics(df_filtered: pd.DataFrame) -> dict:
    """Menghitung ringkasan KPI keuangan dari data terfilter."""
    if len(df_filtered) == 0:
        return {
            'income': 0,
            'income_formatted': "0",
            'expense': 0,
            'expense_formatted': "0",
            'reimburse': 0,
            'reimburse_formatted': "0",
            'net': 0,
            'net_formatted': "0",
            'pct_expense': 0.0,
            'total_transactions': 0,
            'periode_text': "Tidak ada data",
            'hari_terboros': "-",
            'kategori_terbesar': "-",
            'transaksi_terbesar_val': "0",
            'transaksi_terbesar_detail': "-"
        }

    total_expense = float(df_filtered['Expense'].sum())
    total_income = float(df_filtered['Income'].sum())
    total_reimburse = float(df_filtered['Reimburse'].sum())
    net = total_income - total_expense + total_reimburse

    pct_expense = (total_expense / total_income * 100.0) if total_income > 0 else 0.0

    min_date = df_filtered['Tanggal'].min()
    max_date = df_filtered['Tanggal'].max()
    if min_date.strftime('%B %Y') == max_date.strftime('%B %Y'):
        periode_text = min_date.strftime('%B %Y')
    else:
        periode_text = f"{min_date.strftime('%B %Y')} - {max_date.strftime('%B %Y')}"

    # Insight Hari Terboros
    df_harian = df_filtered.groupby(df_filtered['Tanggal'].dt.strftime('%d-%m-%Y'))['Expense'].sum()
    hari_terboros = df_harian.idxmax() if len(df_harian) > 0 and df_harian.max() > 0 else "-"

    # Insight Kategori Terbesar
    df_kat = df_filtered.groupby('Kategori')['Expense'].sum()
    kategori_terbesar = df_kat.idxmax() if len(df_kat) > 0 and df_kat.max() > 0 else "-"

    # Transaksi Terbesar
    df_expense_only = df_filtered[df_filtered['Expense'] > 0]
    if len(df_expense_only) > 0:
        biggest_row = df_expense_only.loc[df_expense_only['Expense'].idxmax()]
        trx_terbesar_val = format_idr(biggest_row['Expense'])
        trx_terbesar_detail = f"{biggest_row['Kategori']} ({biggest_row['Komentar']})"
    else:
        trx_terbesar_val = "0"
        trx_terbesar_detail = "-"

    return {
        'income': total_income,
        'income_formatted': format_idr(total_income),
        'expense': total_expense,
        'expense_formatted': format_idr(total_expense),
        'reimburse': total_reimburse,
        'reimburse_formatted': format_idr(total_reimburse),
        'net': net,
        'net_formatted': format_idr(net),
        'pct_expense': round(pct_expense, 1),
        'total_transactions': len(df_filtered),
        'periode_text': periode_text,
        'hari_terboros': hari_terboros,
        'kategori_terbesar': kategori_terbesar,
        'transaksi_terbesar_val': trx_terbesar_val,
        'transaksi_terbesar_detail': trx_terbesar_detail
    }

def get_chart_data(df_filtered: pd.DataFrame) -> dict:
    """Menyiapkan struktur data siap pakai untuk grafik Chart.js di frontend."""
    if len(df_filtered) == 0:
        return {
            'top_days': {'labels': [], 'data': [], 'comments': []},
            'categories': {'labels': [], 'data': []},
            'assets': {'labels': [], 'data': []},
            'cashflow': {'labels': ['Income', 'Expense', 'Reimburse'], 'data': [0, 0, 0]},
            'trend': {'labels': [], 'income': [], 'expense': []}
        }

    # 1. Top Hari Terboros
    df_harian = df_filtered.copy()
    df_harian['Tanggal_Str'] = df_harian['Tanggal'].dt.strftime('%d-%m-%Y')
    per_hari = df_harian.groupby('Tanggal_Str')['Expense'].sum().sort_values(ascending=False).head(7)

    comments_map = (
        df_harian[df_harian['Expense'] > 0]
        .groupby('Tanggal_Str')['Komentar']
        .apply(lambda x: ", ".join(x.dropna().unique()[:2]))
        .to_dict()
    )
    top_days_labels = per_hari.index.tolist()
    top_days_data = [float(val) for val in per_hari.values]
    top_days_comments = [comments_map.get(d, "-") for d in top_days_labels]

    # 2. Kategori Pengeluaran
    per_kategori = df_filtered.groupby('Kategori')['Expense'].sum().sort_values(ascending=False)
    if len(per_kategori) > 8:
        top_kat = per_kategori.head(7)
        other_sum = per_kategori.iloc[7:].sum()
        kat_labels = top_kat.index.tolist() + ['Lainnya']
        kat_data = [float(v) for v in top_kat.values] + [float(other_sum)]
    else:
        kat_labels = per_kategori.index.tolist()
        kat_data = [float(v) for v in per_kategori.values]

    # 3. Pengeluaran per Aset
    per_aset = df_filtered.groupby('Aset')['Expense'].sum().sort_values(ascending=False)
    asset_labels = per_aset.index.tolist()
    asset_data = [float(v) for v in per_aset.values]

    # 4. Cashflow (Income, Expense, Reimburse)
    metrics = calculate_core_metrics(df_filtered)
    cashflow_data = [metrics['income'], metrics['expense'], metrics['reimburse']]

    # 5. Trend Waktu Harian
    df_trend = df_filtered.groupby(df_filtered['Tanggal'].dt.strftime('%Y-%m-%d')).agg({
        'Income': 'sum',
        'Expense': 'sum'
    }).sort_index()

    trend_labels = [pd.to_datetime(d).strftime('%d %b') for d in df_trend.index]
    trend_income = [float(v) for v in df_trend['Income'].values]
    trend_expense = [float(v) for v in df_trend['Expense'].values]

    return {
        'top_days': {
            'labels': top_days_labels,
            'data': top_days_data,
            'comments': top_days_comments
        },
        'categories': {
            'labels': kat_labels,
            'data': kat_data
        },
        'assets': {
            'labels': asset_labels,
            'data': asset_data
        },
        'cashflow': {
            'labels': ['Income', 'Expense', 'Reimburse'],
            'data': cashflow_data
        },
        'trend': {
            'labels': trend_labels,
            'income': trend_income,
            'expense': trend_expense
        }
    }

def get_category_comparison(df_all: pd.DataFrame, current_min_date: pd.Timestamp) -> dict:
    """Membandingkan pengeluaran kategori bulan aktif vs bulan sebelumnya."""
    df_kat = df_all.copy()
    df_kat['periode'] = df_kat['Tanggal'].dt.to_period('M')

    current_period = current_min_date.to_period('M')
    prev_period = current_period - 1

    df_current = df_kat[df_kat['periode'] == current_period]
    df_prev = df_kat[df_kat['periode'] == prev_period]

    kat_current = df_current[df_current['Expense'] > 0].groupby('Kategori')['Expense'].sum()
    kat_prev = df_prev[df_prev['Expense'] > 0].groupby('Kategori')['Expense'].sum()

    df_compare = pd.DataFrame({
        'Current': kat_current,
        'Previous': kat_prev
    }).fillna(0)

    df_compare['Diff'] = df_compare['Current'] - df_compare['Previous']
    
    def calc_pct(row):
        if row['Previous'] == 0:
            return 100.0 if row['Current'] > 0 else 0.0
        return ((row['Current'] - row['Previous']) / row['Previous']) * 100.0

    df_compare['Pct'] = df_compare.apply(calc_pct, axis=1)
    df_compare = df_compare.sort_values(by='Current', ascending=False)

    rows = []
    for kat, row in df_compare.iterrows():
        rows.append({
            'kategori': kat,
            'current': float(row['Current']),
            'current_formatted': format_idr(row['Current']),
            'previous': float(row['Previous']),
            'previous_formatted': format_idr(row['Previous']),
            'diff': float(row['Diff']),
            'diff_formatted': format_idr(row['Diff']),
            'pct': round(float(row['Pct']), 1)
        })

    return {
        'current_label': current_period.strftime('%B %Y'),
        'prev_label': prev_period.strftime('%B %Y'),
        'rows': rows
    }
