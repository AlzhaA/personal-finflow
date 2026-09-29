"""
pdf_generator.py
Modul untuk membuat laporan keuangan berformat PDF berkualitas tinggi
menggunakan ReportLab & Matplotlib.
"""

import os
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
from PIL import Image as PILImage

from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image,
    PageBreak, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors

from data_processor import format_idr, calculate_core_metrics, get_category_comparison

def safe_image(path, max_width=500, max_height=260):
    """Membuka gambar dan menyesuaikan ukuran secara proporsional untuk dokumen PDF."""
    if not os.path.exists(path):
        return Spacer(1, 10)
    with PILImage.open(path) as img:
        w, h = img.size
    ratio = min(max_width / w, max_height / h)
    return Image(path, width=w * ratio, height=h * ratio)

def build_pdf_report(df_filtered: pd.DataFrame, df_all: pd.DataFrame, output_path: str) -> str:
    """Menghasilkan file PDF Laporan Keuangan lengkap."""
    if len(df_filtered) == 0:
        raise ValueError("Tidak ada data yang dipilih untuk diekspor ke PDF.")

    parent_dir = os.path.dirname(output_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    temp_dir = os.path.join(os.path.dirname(__file__), "temp_charts")
    os.makedirs(temp_dir, exist_ok=True)

    metrics = calculate_core_metrics(df_filtered)
    periode_text = metrics['periode_text']
    min_date = df_filtered['Tanggal'].min()

    # --- 1. GENERATE CHARTS SEBAGAI GAMBAR ---
    chart_harian_path = os.path.join(temp_dir, "harian.png")
    chart_kat_path = os.path.join(temp_dir, "kategori.png")
    chart_aset_path = os.path.join(temp_dir, "aset.png")
    chart_pie_path = os.path.join(temp_dir, "pie_combined.png")
    chart_trend_path = os.path.join(temp_dir, "trend.png")
    chart_compare_path = os.path.join(temp_dir, "comparison.png")

    # Chart 1: Top Hari Paling Boros
    df_harian = df_filtered.groupby(df_filtered['Tanggal'].dt.strftime('%d-%m-%Y'))['Expense'].sum().sort_values(ascending=False).head(7)
    plt.figure(figsize=(7.5, 3.8))
    per_hari_plot = df_harian
    plt.bar(per_hari_plot.index, per_hari_plot.values / 1000, color='#e74c3c', edgecolor='#c0392b', alpha=0.9)
    plt.title('Top Hari Paling Boros (dlm Ribuan Rp)', fontsize=11, fontweight='bold', pad=10)
    plt.xticks(rotation=30, ha='right', fontsize=9)
    plt.ylabel('Ribu Rupiah', fontsize=9)
    plt.grid(axis='y', linestyle='--', alpha=0.5)
    plt.tight_layout()
    plt.savefig(chart_harian_path, dpi=160)
    plt.close()

    # Chart 2: Top Kategori
    per_kategori = df_filtered.groupby('Kategori')['Expense'].sum().sort_values(ascending=False).head(6)
    plt.figure(figsize=(7.5, 3.8))
    plt.barh(per_kategori.index[::-1], (per_kategori.values[::-1]) / 1000, color='#3498db', edgecolor='#2980b9')
    plt.title('Top 6 Kategori Pengeluaran (dlm Ribuan Rp)', fontsize=11, fontweight='bold', pad=10)
    plt.xlabel('Ribu Rupiah', fontsize=9)
    plt.grid(axis='x', linestyle='--', alpha=0.5)
    plt.tight_layout()
    plt.savefig(chart_kat_path, dpi=160)
    plt.close()

    # Chart 3: Distribusi Pie (Kategori + Cashflow)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3.8))
    top5_kat = df_filtered.groupby('Kategori')['Expense'].sum().sort_values(ascending=False).head(5)
    if top5_kat.sum() > 0:
        ax1.pie(top5_kat.values, labels=top5_kat.index, autopct='%1.1f%%', startangle=140,
                colors=['#e74c3c', '#3498db', '#9b59b6', '#f39c12', '#1abc9c'])
        ax1.set_title('Proporsi Kategori Teratas', fontsize=10, fontweight='bold')
    else:
        ax1.text(0.5, 0.5, 'Tidak ada pengeluaran', ha='center')

    cashflow_vals = [metrics['income'], metrics['expense'], metrics['reimburse']]
    if sum(cashflow_vals) > 0:
        ax2.pie(cashflow_vals, labels=['Income', 'Expense', 'Reimburse'], autopct='%1.1f%%',
                colors=['#2ecc71', '#e74c3c', '#f1c40f'], startangle=140)
        ax2.set_title('Cashflow Breakdown', fontsize=10, fontweight='bold')
    else:
        ax2.text(0.5, 0.5, 'Tidak ada arus kas', ha='center')

    plt.tight_layout()
    plt.savefig(chart_pie_path, dpi=160)
    plt.close()

    # Chart 4: Trend Harian
    df_trend = df_filtered.groupby(df_filtered['Tanggal'].dt.strftime('%Y-%m-%d')).agg({
        'Income': 'sum',
        'Expense': 'sum'
    }).sort_index()

    plt.figure(figsize=(8.5, 3.6))
    plt.plot(df_trend.index, df_trend['Income'] / 1000, marker='o', label='Income', color='#2ecc71', linewidth=2)
    plt.plot(df_trend.index, df_trend['Expense'] / 1000, marker='s', label='Expense', color='#e74c3c', linewidth=2)
    plt.title('Trend Arus Kas Harian (dlm Ribuan Rp)', fontsize=11, fontweight='bold', pad=10)
    plt.xticks(rotation=40, ha='right', fontsize=8)
    plt.ylabel('Ribu Rupiah', fontsize=9)
    plt.legend(loc='upper right')
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    plt.savefig(chart_trend_path, dpi=160)
    plt.close()

    # Chart 5: Comparison MoM
    comp_data = get_category_comparison(df_all, min_date)
    comp_rows = comp_data['rows'][:6]
    if comp_rows:
        categories = [r['kategori'] for r in comp_rows][::-1]
        cur_vals = [r['current'] / 1000 for r in comp_rows][::-1]
        prev_vals = [r['previous'] / 1000 for r in comp_rows][::-1]

        plt.figure(figsize=(8, 3.8))
        import numpy as np
        y = np.arange(len(categories))
        height = 0.35
        plt.barh(y + height/2, cur_vals, height, label=comp_data['current_label'], color='#3498db')
        plt.barh(y - height/2, prev_vals, height, label=comp_data['prev_label'], color='#95a5a6')
        plt.yticks(y, categories, fontsize=9)
        plt.xlabel('Ribu Rupiah', fontsize=9)
        plt.title('Perbandingan Pengeluaran per Kategori vs Bulan Lalu', fontsize=11, fontweight='bold', pad=10)
        plt.legend()
        plt.grid(axis='x', linestyle='--', alpha=0.5)
        plt.tight_layout()
        plt.savefig(chart_compare_path, dpi=160)
        plt.close()

    # --- 2. SUSUN DOKUMEN PDF REPORTLAB ---
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1a365d'),
        alignment=0,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#4a5568'),
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#2b6cb0'),
        spaceBefore=10,
        spaceAfter=8
    )
    body_style = styles['Normal']

    elements = []

    # HEADER LAPORAN
    elements.append(Paragraph("LAPORAN KEUANGAN BULANAN", title_style))
    elements.append(Paragraph(f"<b>Periode Analisis:</b> {periode_text} &nbsp;|&nbsp; <b>Total Transaksi:</b> {metrics['total_transactions']}", subtitle_style))
    elements.append(Spacer(1, 4))

    # METRICS SUMMARY TABLE
    metric_table_data = [
        [
            Paragraph("<b>Total Pendapatan (Income)</b>", body_style),
            Paragraph(f"Rp {metrics['income_formatted']}", body_style),
            Paragraph("<b>Total Pengeluaran (Expense)</b>", body_style),
            Paragraph(f"Rp {metrics['expense_formatted']}", body_style),
        ],
        [
            Paragraph("<b>Reimbursement</b>", body_style),
            Paragraph(f"Rp {metrics['reimburse_formatted']}", body_style),
            Paragraph("<b>Net Balance</b>", body_style),
            Paragraph(f"<b>Rp {metrics['net_formatted']}</b>", body_style),
        ],
        [
            Paragraph("<b>Rasio Pengeluaran</b>", body_style),
            Paragraph(f"<b>{metrics['pct_expense']}%</b> dari Income", body_style),
            Paragraph("<b>Kategori Terbesar</b>", body_style),
            Paragraph(f"{metrics['kategori_terbesar']}", body_style),
        ]
    ]

    t_metrics = Table(metric_table_data, colWidths=[130, 130, 130, 130])
    t_metrics.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_metrics)
    elements.append(Spacer(1, 10))

    # INSIGHT BOX
    insight_text = f"""
    <b>Highlight Finansial:</b><br/>
    • <b>Hari Paling Boros:</b> {metrics['hari_terboros']}<br/>
    • <b>Transaksi Terbesar:</b> Rp {metrics['transaksi_terbesar_val']} ({metrics['transaksi_terbesar_detail']})<br/>
    • <b>Efisiensi Kas:</b> Saldo bersih tercatat senilai Rp {metrics['net_formatted']} dengan rasio belanja {metrics['pct_expense']}%.
    """
    insight_p = Paragraph(insight_text, ParagraphStyle('InsightBox', parent=body_style, fontSize=9, leading=13))
    t_insight = Table([[insight_p]], colWidths=[520])
    t_insight.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ebf8ff')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#bee3f8')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_insight)
    elements.append(Spacer(1, 12))

    # SECTION 1: VISUALISASI HARIAN & KATEGORI
    elements.append(Paragraph("1. Analisis Pengeluaran Harian & Kategori", h2_style))
    elements.append(safe_image(chart_harian_path, 520, 190))
    elements.append(Spacer(1, 6))
    elements.append(safe_image(chart_kat_path, 520, 190))

    elements.append(PageBreak())

    # SECTION 2: DISTRIBUSI & TREND
    elements.append(Paragraph("2. Distribusi Cashflow & Trend Harian", h2_style))
    elements.append(safe_image(chart_pie_path, 520, 200))
    elements.append(Spacer(1, 10))
    elements.append(safe_image(chart_trend_path, 520, 200))

    elements.append(PageBreak())

    # SECTION 3: PERBANDINGAN BULANAN (MOM)
    if os.path.exists(chart_compare_path) and comp_data.get('rows'):
        elements.append(Paragraph(f"3. Perbandingan Pengeluaran vs Bulan Lalu ({comp_data['prev_label']})", h2_style))
        elements.append(Paragraph(f"Grafik dan tabel berikut menganalisis alokasi belanja kategori periode <b>{comp_data['current_label']}</b> dibandingkan dengan <b>{comp_data['prev_label']}</b>:", subtitle_style))
        elements.append(safe_image(chart_compare_path, 520, 185))
        elements.append(Spacer(1, 10))

        # Tabel Komparasi MoM
        comp_headers = [
            'Kategori',
            f"{comp_data['current_label']}\n(Rp)",
            f"{comp_data['prev_label']}\n(Rp)",
            'Selisih\n(Rp)',
            'Perubahan\n(%)'
        ]
        comp_table_rows = [comp_headers]

        for r in comp_data['rows']:
            is_increase = r['diff'] > 0
            is_decrease = r['diff'] < 0
            prefix = "+" if is_increase else ""
            pct_str = f"{prefix}{r['pct']}%"
            diff_str = f"{prefix}{r['diff_formatted']}"

            comp_table_rows.append([
                r['kategori'],
                r['current_formatted'],
                r['previous_formatted'],
                diff_str,
                pct_str
            ])

        t_comp = Table(comp_table_rows, repeatRows=1, colWidths=[130, 100, 100, 100, 90])
        t_comp.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        elements.append(t_comp)

    elements.append(PageBreak())

    # SECTION 4: TABEL RAW DATA TRANSAKSI
    elements.append(Paragraph("4. Rincian Data Transaksi", h2_style))
    elements.append(Paragraph("Daftar transaksi yang termasuk dalam periode filter saat ini:", subtitle_style))
    elements.append(Spacer(1, 4))

    raw_headers = ['Tanggal', 'Kategori', 'Jenis', 'Jumlah (Rp)', 'Aset', 'Reimburse (Rp)', 'Komentar']
    raw_rows = [raw_headers]

    for _, row in df_filtered.iterrows():
        tgl_str = row['Tanggal'].strftime('%d-%m-%Y %H:%M') if pd.notna(row['Tanggal']) else "-"
        raw_rows.append([
            tgl_str,
            str(row['Kategori']),
            str(row['Jenis']),
            format_idr(row['Jumlah']),
            str(row['Aset']),
            format_idr(row['Reimburse']),
            str(row['Komentar'])[:35]
        ])

    if len(raw_rows) > 1500:
        raw_rows = raw_rows[:1500]

    t_raw = Table(raw_rows, repeatRows=1, colWidths=[68, 72, 60, 68, 55, 65, 132])
    t_raw.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('ALIGN', (5, 1), (5, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cbd5e0')),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))

    elements.append(t_raw)

    # BUILD DOCUMENT
    doc.build(elements)

    # Clean up temp charts
    for f in [chart_harian_path, chart_kat_path, chart_aset_path, chart_pie_path, chart_trend_path, chart_compare_path]:
        if os.path.exists(f):
            try:
                os.remove(f)
            except OSError:
                pass

    return output_path
