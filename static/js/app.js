/**
 * app.js
 * Frontend interactivity, state management, Chart.js visualizations,
 * and AJAX communication for FinanceFlow Dashboard.
 */

// Global State
const state = {
    filterOptions: {
        Bulan: [],
        Kategori: [],
        Jenis: [],
        Aset: []
    },
    selectedFilters: {
        Bulan: [],
        Kategori: [],
        Jenis: [],
        Aset: []
    },
    searchQuery: '',
    sortBy: 'Tanggal',
    sortAsc: false,
    currentPage: 1,
    perPage: 25,
    totalRecords: 0,
    totalPages: 1
};

// Chart instances storage
const charts = {
    topDays: null,
    categories: null,
    cashflow: null,
    assets: null,
    trend: null,
    comparison: null
};

// DOM Elements
const elements = {
    filterTypeSelect: document.getElementById('filterTypeSelect'),
    checkboxContainer: document.getElementById('checkboxContainer'),
    btnSelectAll: document.getElementById('btnSelectAll'),
    btnClearAll: document.getElementById('btnClearAll'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    activeFiltersSummary: document.getElementById('activeFiltersSummary'),
    periodText: document.getElementById('periodText'),

    // KPI Cards
    kpiExpense: document.getElementById('kpiExpense'),
    kpiExpenseSub: document.getElementById('kpiExpenseSub'),
    kpiIncome: document.getElementById('kpiIncome'),
    kpiIncomeSub: document.getElementById('kpiIncomeSub'),
    kpiReimburse: document.getElementById('kpiReimburse'),
    kpiNet: document.getElementById('kpiNet'),
    kpiNetSub: document.getElementById('kpiNetSub'),

    // Insights Banner
    insightHariBoros: document.getElementById('insightHariBoros'),
    insightKategoriTerbesar: document.getElementById('insightKategoriTerbesar'),
    insightTrxTerbesar: document.getElementById('insightTrxTerbesar'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    totalDataCount: document.getElementById('totalDataCount'),

    // Table Controls
    searchInput: document.getElementById('searchInput'),
    sortBySelect: document.getElementById('sortBySelect'),
    btnSortOrder: document.getElementById('btnSortOrder'),
    sortOrderLabel: document.getElementById('sortOrderLabel'),
    perPageSelect: document.getElementById('perPageSelect'),
    tableBody: document.getElementById('tableBody'),
    paginationInfo: document.getElementById('paginationInfo'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    pageIndicator: document.getElementById('pageIndicator'),

    // Comparison Tab
    compareTitle: document.getElementById('compareTitle'),
    thCurMonth: document.getElementById('thCurMonth'),
    thPrevMonth: document.getElementById('thPrevMonth'),
    compareTableBody: document.getElementById('compareTableBody'),

    // Actions & Modals
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnOpenUploadModal: document.getElementById('btnOpenUploadModal'),
    btnExportPDF: document.getElementById('btnExportPDF'),
    uploadModal: document.getElementById('uploadModal'),
    btnCloseUploadModal: document.getElementById('btnCloseUploadModal'),
    btnCancelUpload: document.getElementById('btnCancelUpload'),
    dropzone: document.getElementById('dropzone'),
    csvFileInput: document.getElementById('csvFileInput'),
    selectedFileInfo: document.getElementById('selectedFileInfo'),
    selectedFileName: document.getElementById('selectedFileName'),
    btnRemoveSelectedFile: document.getElementById('btnRemoveSelectedFile'),
    btnSubmitUpload: document.getElementById('btnSubmitUpload'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingMessage: document.getElementById('loadingMessage'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

let uploadedFileObj = null;

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("Memuat data keuangan...");
    try {
        const res = await fetch('/api/init');
        const data = await res.json();
        if (data.status === 'success') {
            state.filterOptions = data.options;
            for (const key in data.options) {
                state.selectedFilters[key] = [...data.options[key]];
            }
            renderFilterCheckboxes();
            await refreshDashboard();
        } else {
            showToast("Gagal memuat data awal: " + data.message, true);
        }
    } catch (err) {
        console.error("Error init:", err);
        showToast("Koneksi gagal ke server", true);
    } finally {
        hideLoading();
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function initEventListeners() {
    elements.filterTypeSelect.addEventListener('change', () => {
        renderFilterCheckboxes();
    });

    elements.btnSelectAll.addEventListener('click', () => {
        const currentType = elements.filterTypeSelect.value;
        state.selectedFilters[currentType] = [...state.filterOptions[currentType]];
        renderFilterCheckboxes();
        onFilterChange();
    });

    elements.btnClearAll.addEventListener('click', () => {
        const currentType = elements.filterTypeSelect.value;
        state.selectedFilters[currentType] = [];
        renderFilterCheckboxes();
        onFilterChange();
    });

    elements.btnResetFilters.addEventListener('click', () => {
        for (const key in state.filterOptions) {
            state.selectedFilters[key] = [...state.filterOptions[key]];
        }
        state.searchQuery = '';
        elements.searchInput.value = '';
        renderFilterCheckboxes();
        onFilterChange();
    });

    let searchTimeout = null;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value;
            state.currentPage = 1;
            refreshDashboard();
        }, 300);
    });

    elements.sortBySelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        refreshDashboard();
    });

    elements.btnSortOrder.addEventListener('click', () => {
        state.sortAsc = !state.sortAsc;
        elements.sortOrderLabel.textContent = state.sortAsc ? '⬆️ Terlama / Terkecil' : '⬇️ Terbaru / Terbesar';
        refreshDashboard();
    });

    elements.perPageSelect.addEventListener('change', (e) => {
        state.perPage = parseInt(e.target.value, 10);
        state.currentPage = 1;
        refreshDashboard();
    });

    elements.btnPrevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            refreshDashboard();
        }
    });

    elements.btnNextPage.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            refreshDashboard();
        }
    });

    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabButtons.forEach(b => b.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.dataset.tab;
            document.getElementById(target).classList.add('active');

            if (target === 'tab-insights') {
                Object.values(charts).forEach(c => c && c.resize());
            } else if (target === 'tab-compare') {
                charts.comparison && charts.comparison.resize();
            }
        });
    });

    elements.btnLoadSample.addEventListener('click', async () => {
        showLoading("Memuat data sampel transaksi...");
        try {
            const res = await fetch('/api/load_sample', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                state.filterOptions = data.options;
                for (const key in data.options) {
                    state.selectedFilters[key] = [...data.options[key]];
                }
                state.currentPage = 1;
                renderFilterCheckboxes();
                await refreshDashboard();
                showToast("Data sampel berhasil dimuat!");
            }
        } catch (err) {
            showToast("Gagal memuat sampel data", true);
        } finally {
            hideLoading();
        }
    });

    elements.btnExportPDF.addEventListener('click', exportPDF);

    elements.btnOpenUploadModal.addEventListener('click', () => {
        elements.uploadModal.classList.add('active');
    });

    const closeModal = () => {
        elements.uploadModal.classList.remove('active');
        resetUploadForm();
    };

    elements.btnCloseUploadModal.addEventListener('click', closeModal);
    elements.btnCancelUpload.addEventListener('click', closeModal);

    elements.dropzone.addEventListener('click', () => {
        elements.csvFileInput.click();
    });

    elements.csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    elements.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropzone.classList.add('dragover');
    });

    elements.dropzone.addEventListener('dragleave', () => {
        elements.dropzone.classList.remove('dragover');
    });

    elements.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    elements.btnRemoveSelectedFile.addEventListener('click', () => {
        resetUploadForm();
    });

    elements.btnSubmitUpload.addEventListener('click', submitUploadFile);
}

// ==========================================================================
// FILTER LOGIC & RENDERING
// ==========================================================================
function renderFilterCheckboxes() {
    const currentType = elements.filterTypeSelect.value;
    const options = state.filterOptions[currentType] || [];
    const selected = state.selectedFilters[currentType] || [];

    elements.checkboxContainer.innerHTML = '';

    if (options.length === 0) {
        elements.checkboxContainer.innerHTML = '<div class="text-muted p-2">Tidak ada opsi</div>';
        return;
    }

    options.forEach(val => {
        const item = document.createElement('label');
        item.className = 'checkbox-item';

        const isChecked = selected.includes(val);
        item.innerHTML = `
            <input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''}>
            <span>${val}</span>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!state.selectedFilters[currentType].includes(val)) {
                    state.selectedFilters[currentType].push(val);
                }
            } else {
                state.selectedFilters[currentType] = state.selectedFilters[currentType].filter(v => v !== val);
            }
            onFilterChange();
        });

        elements.checkboxContainer.appendChild(item);
    });

    updateActiveFiltersSummary();
}

function updateActiveFiltersSummary() {
    let summaryText = [];
    for (const key in state.selectedFilters) {
        const selCount = state.selectedFilters[key].length;
        const totalCount = state.filterOptions[key].length;
        if (selCount < totalCount) {
            summaryText.push(`${key}: ${selCount}/${totalCount}`);
        }
    }
    if (summaryText.length === 0) {
        elements.activeFiltersSummary.innerHTML = '✨ <b>Semua data aktif</b>';
    } else {
        elements.activeFiltersSummary.innerHTML = `🔍 <b>Filter aktif:</b> ${summaryText.join(', ')}`;
    }
}

function onFilterChange() {
    state.currentPage = 1;
    updateActiveFiltersSummary();
    refreshDashboard();
}

// ==========================================================================
// DATA FETCHING & UI UPDATE
// ==========================================================================
async function refreshDashboard() {
    const payload = {
        filters: state.selectedFilters,
        search: state.searchQuery,
        sort_by: state.sortBy,
        sort_asc: state.sortAsc,
        page: state.currentPage,
        per_page: state.perPage
    };

    try {
        const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.status === 'success') {
            updateMetrics(data.metrics);
            updateTable(data.table_data, data.pagination);
            updateCharts(data.charts);
            updateComparison(data.comparison);
        } else {
            showToast("Error: " + data.message, true);
        }
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function updateMetrics(metrics) {
    elements.periodText.textContent = metrics.periode_text || "Periode Aktif";
    elements.kpiExpense.textContent = `Rp ${metrics.expense_formatted}`;
    elements.kpiExpenseSub.textContent = `${metrics.pct_expense}% dari total income`;
    elements.kpiIncome.textContent = `Rp ${metrics.income_formatted}`;
    elements.kpiReimburse.textContent = `Rp ${metrics.reimburse_formatted}`;
    elements.kpiNet.textContent = `Rp ${metrics.net_formatted}`;

    if (metrics.net >= 0) {
        elements.kpiNet.style.color = 'var(--text-main)';
        elements.kpiNetSub.textContent = 'Surplus / Arus Kas Positif';
    } else {
        elements.kpiNet.style.color = 'var(--danger)';
        elements.kpiNetSub.textContent = 'Defisit / Pengeluaran Berlebih';
    }

    elements.insightHariBoros.textContent = metrics.hari_terboros || '-';
    elements.insightKategoriTerbesar.textContent = metrics.kategori_terbesar || '-';
    elements.insightTrxTerbesar.textContent = `Rp ${metrics.transaksi_terbesar_val} (${metrics.transaksi_terbesar_detail})`;
}

function updateTable(rows, pagination) {
    state.totalRecords = pagination.total_records;
    state.totalPages = pagination.total_pages;
    elements.totalDataCount.textContent = pagination.total_records;

    elements.paginationInfo.textContent = `Menampilkan ${pagination.start_index} - ${pagination.end_index} dari ${pagination.total_records} data`;
    elements.pageIndicator.textContent = `Hal ${pagination.current_page} / ${pagination.total_pages}`;

    elements.btnPrevPage.disabled = pagination.current_page <= 1;
    elements.btnNextPage.disabled = pagination.current_page >= pagination.total_pages;

    elements.tableBody.innerHTML = '';

    if (!rows || rows.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    Tidak ada transaksi yang cocok dengan kriteria filter saat ini.
                </td>
            </tr>
        `;
        return;
    }

    rows.forEach(r => {
        const tr = document.createElement('tr');
        const isExpense = r.Jenis.toLowerCase() === 'pengeluaran';
        const typeBadge = isExpense ?
            '<span class="badge-type badge-expense">Pengeluaran</span>' :
            '<span class="badge-type badge-income">Pendapatan</span>';

        const amountClass = isExpense ? 'amount-expense' : 'amount-income';
        const amountPrefix = isExpense ? '- ' : '+ ';

        tr.innerHTML = `
            <td><b>${r.Tanggal_Format}</b></td>
            <td>${r.Kategori}</td>
            <td>${typeBadge}</td>
            <td class="text-right ${amountClass}">${amountPrefix}Rp ${r.Jumlah_Formatted}</td>
            <td><span class="chart-tag">${r.Aset}</span></td>
            <td class="text-right">${r.Reimburse > 0 ? 'Rp ' + r.Reimburse_Formatted : '-'}</td>
            <td class="text-muted">${r.Komentar || '-'}</td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

function updateComparison(comp) {
    if (!comp || !comp.rows) return;

    elements.compareTitle.textContent = `Perbandingan Kategori: ${comp.current_label} vs ${comp.prev_label}`;
    elements.thCurMonth.textContent = comp.current_label;
    elements.thPrevMonth.textContent = comp.prev_label;

    elements.compareTableBody.innerHTML = '';
    comp.rows.forEach(r => {
        const tr = document.createElement('tr');
        const isIncrease = r.diff > 0;
        const trendClass = isIncrease ? 'trend-up' : (r.diff < 0 ? 'trend-down' : '');
        const trendIcon = isIncrease ? '🔺 +' : (r.diff < 0 ? '🔻 ' : '');

        tr.innerHTML = `
            <td><b>${r.kategori}</b></td>
            <td class="text-right">Rp ${r.current_formatted}</td>
            <td class="text-right text-muted">Rp ${r.previous_formatted}</td>
            <td class="text-right ${trendClass}">Rp ${r.diff_formatted}</td>
            <td class="text-right ${trendClass}"><b>${trendIcon}${r.pct}%</b></td>
        `;
        elements.compareTableBody.appendChild(tr);
    });

    const topComp = comp.rows.slice(0, 6);
    const labels = topComp.map(r => r.kategori);
    const curData = topComp.map(r => r.current);
    const prevData = topComp.map(r => r.previous);

    const ctx = document.getElementById('chartComparison').getContext('2d');
    if (charts.comparison) charts.comparison.destroy();

    charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: comp.current_label,
                    data: curData,
                    backgroundColor: '#4361ee',
                    borderRadius: 6
                },
                {
                    label: comp.prev_label,
                    data: prevData,
                    backgroundColor: '#94a3b8',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: Rp ${ctx.raw.toLocaleString('id-ID')}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k'
                    }
                }
            }
        }
    });
}

// ==========================================================================
// CHART.JS RENDERING
// ==========================================================================
function updateCharts(chartData) {
    if (!chartData) return;

    // 1. Top Hari Boros Chart
    const ctxTopDays = document.getElementById('chartTopDays').getContext('2d');
    if (charts.topDays) charts.topDays.destroy();

    charts.topDays = new Chart(ctxTopDays, {
        type: 'bar',
        data: {
            labels: chartData.top_days.labels,
            datasets: [{
                label: 'Total Pengeluaran (Rp)',
                data: chartData.top_days.data,
                backgroundColor: '#ef4444',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Pengeluaran: Rp ${ctx.raw.toLocaleString('id-ID')}`,
                        afterLabel: (ctx) => `Ket: ${chartData.top_days.comments[ctx.dataIndex] || '-'}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' }
                }
            }
        }
    });

    // 2. Kategori Pengeluaran Chart (Horizontal Bar)
    const ctxCategories = document.getElementById('chartCategories').getContext('2d');
    if (charts.categories) charts.categories.destroy();

    charts.categories = new Chart(ctxCategories, {
        type: 'bar',
        data: {
            labels: chartData.categories.labels,
            datasets: [{
                label: 'Pengeluaran',
                data: chartData.categories.data,
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Rp ${ctx.raw.toLocaleString('id-ID')}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' }
                }
            }
        }
    });

    // 3. Cashflow Breakdown (Doughnut)
    const ctxCashflow = document.getElementById('chartCashflow').getContext('2d');
    if (charts.cashflow) charts.cashflow.destroy();

    charts.cashflow = new Chart(ctxCashflow, {
        type: 'doughnut',
        data: {
            labels: chartData.cashflow.labels,
            datasets: [{
                data: chartData.cashflow.data,
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: Rp ${ctx.raw.toLocaleString('id-ID')}`
                    }
                }
            }
        }
    });

    // 4. Pengeluaran per Aset Chart
    const ctxAssets = document.getElementById('chartAssets').getContext('2d');
    if (charts.assets) charts.assets.destroy();

    charts.assets = new Chart(ctxAssets, {
        type: 'bar',
        data: {
            labels: chartData.assets.labels,
            datasets: [{
                label: 'Pengeluaran per Aset',
                data: chartData.assets.data,
                backgroundColor: '#8b5cf6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Rp ${ctx.raw.toLocaleString('id-ID')}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' }
                }
            }
        }
    });

    // 5. Trend Line Chart
    const ctxTrend = document.getElementById('chartTrend').getContext('2d');
    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: chartData.trend.labels,
            datasets: [
                {
                    label: 'Pendapatan (Income)',
                    data: chartData.trend.income,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4
                },
                {
                    label: 'Pengeluaran (Expense)',
                    data: chartData.trend.expense,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: Rp ${ctx.raw.toLocaleString('id-ID')}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' }
                }
            }
        }
    });
}

// ==========================================================================
// UPLOAD & FILE HANDLING
// ==========================================================================
function handleSelectedFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast("Hanya file dengan ekstensi .csv yang didukung", true);
        return;
    }
    uploadedFileObj = file;
    elements.selectedFileName.textContent = file.name;
    elements.selectedFileInfo.style.display = 'flex';
    elements.btnSubmitUpload.disabled = false;
}

function resetUploadForm() {
    uploadedFileObj = null;
    elements.csvFileInput.value = '';
    elements.selectedFileInfo.style.display = 'none';
    elements.btnSubmitUpload.disabled = true;
}

async function submitUploadFile() {
    if (!uploadedFileObj) return;

    showLoading("Mengunggah dan memproses data CSV...");
    const formData = new FormData();
    formData.append('file', uploadedFileObj);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
            state.filterOptions = data.options;
            for (const key in data.options) {
                state.selectedFilters[key] = [...data.options[key]];
            }
            state.currentPage = 1;
            renderFilterCheckboxes();
            await refreshDashboard();
            elements.uploadModal.classList.remove('active');
            resetUploadForm();
            showToast("File CSV berhasil dimuat!");
        } else {
            showToast("Gagal memproses file: " + data.message, true);
        }
    } catch (err) {
        showToast("Terjadi kesalahan saat upload", true);
    } finally {
        hideLoading();
    }
}

// ==========================================================================
// EXPORT PDF
// ==========================================================================
async function exportPDF() {
    showLoading("Menyusun laporan PDF & merender grafik...");
    const payload = {
        filters: state.selectedFilters,
        search: state.searchQuery,
        sort_by: state.sortBy,
        sort_asc: state.sortAsc
    };

    try {
        const res = await fetch('/api/export_pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Gagal membuat PDF');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Keuangan_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast("Laporan PDF berhasil diunduh!");
    } catch (err) {
        showToast(err.message, true);
    } finally {
        hideLoading();
    }
}

// ==========================================================================
// UTILITIES (LOADING & TOAST)
// ==========================================================================
function showLoading(msg = "Memproses...") {
    elements.loadingMessage.textContent = msg;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

function showToast(msg, isError = false) {
    elements.toastMessage.textContent = msg;
    elements.toast.style.background = isError ? '#ef4444' : '#1e293b';
    elements.toast.classList.add('active');
    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3500);
}
