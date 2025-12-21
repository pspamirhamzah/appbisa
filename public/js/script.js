/* =========================================================
   SCRIPT FINAL - FILTER SINKRON (NASIONAL & PROVINSI)
   ========================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec';
const ADMIN_PASSWORD = 'pso123';

// GLOBAL DATA
let rawData = [];
let currentSector = 'SUBSIDI'; 
let activeProduct = 'UREA'; // Variabel Global Produk yang Aktif
let selectedYear = new Date().getFullYear();

// KAMUS BULAN
const MONTH_MAP = {
    'JAN': 0, 'JANUARI': 0, 'FEB': 1, 'FEBRUARI': 1, 'MAR': 2, 'MARET': 2,
    'APR': 3, 'APRIL': 3, 'MEI': 4, 'MAY': 4, 'JUN': 5, 'JUNI': 5,
    'JUL': 6, 'JULI': 6, 'AGU': 7, 'AGUSTUS': 7, 'AUG': 7,
    'SEP': 8, 'SEPTEMBER': 8, 'OKT': 9, 'OKTOBER': 9,
    'NOV': 10, 'NOVEMBER': 10, 'DES': 11, 'DESEMBER': 11
};
const CHART_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// CHART INSTANCES
let chartNasionalInstance, chartProvInstance, sparkUreaInstance, sparkNpkInstance;

// 1. INIT
window.onload = function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    loadData();
};

// 2. LOAD DATA
function loadData() {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';

    fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        if (!Array.isArray(data)) { console.error("Data Error"); return; }
        
        processData(data);      // 1. Bersihkan Data
        populateProvDropdown(); // 2. Isi Dropdown
        updateDashboard();      // 3. Render Dashboard
        
        if(loader) loader.style.display = 'none';
    })
    .catch(err => {
        console.error(err);
        if(loader) loader.style.display = 'none';
    });
}

// 3. PROCESS DATA
function processData(data) {
    rawData = data.map(r => {
        let valStr = String(r['TONASE']).replace(/\./g, '').replace(/,/g, '.');
        let val = parseFloat(valStr) || 0;
        let year = parseInt(r['TAHUN']) || new Date().getFullYear();
        let txtBulan = String(r['BULAN'] || '').toUpperCase().trim();
        let monthIdx = MONTH_MAP[txtBulan] !== undefined ? MONTH_MAP[txtBulan] : -1;

        return {
            ...r,
            TAHUN: year,
            BULAN_IDX: monthIdx,
            SEKTOR_RAW: String(r['SEKTOR'] || '').toUpperCase().trim(),
            PRODUK_RAW: String(r['PRODUK'] || '').toUpperCase().trim(),
            JENIS_RAW: String(r['JENIS'] || '').toUpperCase().trim(),
            PROVINSI_RAW: String(r['PROVINSI'] || '').toUpperCase().trim(),
            PROVINSI_CLEAN: toTitleCase(String(r['PROVINSI'] || '')),
            TONASE: val
        };
    });

    // Auto Switch Tahun
    const hasData = rawData.some(r => r.TAHUN === selectedYear);
    if (!hasData && rawData.length > 0) {
        const uniqueYears = [...new Set(rawData.map(r => r.TAHUN))].sort((a,b) => b-a);
        if(uniqueYears.length > 0) {
            selectedYear = uniqueYears[0];
            updateEl('year-label', `Data Tahun: ${selectedYear}`);
        }
    }
}

// 4. UPDATE DASHBOARD UTAMA
function updateDashboard() {
    if (rawData.length === 0) return;

    let stats = {
        UREA: { real: 0, rkap: 0, realMonthly: Array(12).fill(0), rkapMonthly: Array(12).fill(0) },
        NPK:  { real: 0, rkap: 0, realMonthly: Array(12).fill(0), rkapMonthly: Array(12).fill(0) }
    };
    let provStats = {}; 

    rawData.forEach(r => {
        // Filter Global
        if (r.TAHUN !== selectedYear) return;
        let isSectorMatch = (currentSector === 'SUBSIDI') ? 
            (r.SEKTOR_RAW.includes('SUBSIDI') && !r.SEKTOR_RAW.includes('NON')) : 
            (r.SEKTOR_RAW.includes('RETAIL') || r.SEKTOR_RAW.includes('NON'));
        if (!isSectorMatch) return;

        const isReal = r.JENIS_RAW.includes('REALISASI') || r.JENIS_RAW.includes('PENJUALAN');
        const isTarget = r.JENIS_RAW.includes('RKAP') || r.JENIS_RAW.includes('TARGET');
        
        let pKey = '';
        if (r.PRODUK_RAW.includes('UREA') || r.PRODUK_RAW.includes('NITREA')) pKey = 'UREA';
        else if (r.PRODUK_RAW.includes('NPK') || r.PRODUK_RAW.includes('PHONSKA')) pKey = 'NPK';

        if (!pKey) return;

        // Init Provinsi Stats
        let prov = r.PROVINSI_RAW || 'LAINNYA';
        if (!provStats[prov]) provStats[prov] = { real: 0, rkap: 0 };

        // Hitung Aggregasi
        if (isReal) {
            stats[pKey].real += r.TONASE;
            provStats[prov].real += r.TONASE;
            if (r.BULAN_IDX >= 0) stats[pKey].realMonthly[r.BULAN_IDX] += r.TONASE;
        } 
        else if (isTarget) {
            stats[pKey].rkap += r.TONASE;
            provStats[prov].rkap += r.TONASE;
            if (r.BULAN_IDX >= 0) stats[pKey].rkapMonthly[r.BULAN_IDX] += r.TONASE;
        }
    });

    // Update Kartu
    updateCard('urea', stats.UREA);
    updateCard('npk', stats.NPK);

    // Update Sparklines
    drawSparkline('sparkUrea', stats.UREA.realMonthly, 'var(--color-urea)', sparkUreaInstance, (inst) => sparkUreaInstance = inst);
    drawSparkline('sparkNpk', stats.NPK.realMonthly, 'var(--color-npk)', sparkNpkInstance, (inst) => sparkNpkInstance = inst);

    // Update Rankings
    renderRankings(provStats);

    // Update Grafik Nasional (Sesuai tombol aktif)
    renderNasionalChart(stats);
    
    // Update Grafik Provinsi (Sesuai tombol aktif & dropdown)
    renderProvChart();
}

// 5. CHART NASIONAL (KIRI)
function renderNasionalChart(stats) {
    const ctx = document.getElementById('chartNasional');
    if (!ctx) return;
    if (chartNasionalInstance) chartNasionalInstance.destroy();

    // Data sesuai produk yang AKTIF
    const d = (activeProduct === 'UREA') ? stats.UREA : stats.NPK;
    const colorMain = activeProduct === 'UREA' ? '#F7DA19' : '#055AA1'; 

    chartNasionalInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: CHART_LABELS,
            datasets: [
                { label: 'Realisasi', data: d.realMonthly, borderColor: colorMain, backgroundColor: colorMain+'20', fill: true, tension: 0.4 },
                { label: 'Target', data: d.rkapMonthly, borderColor: '#888', borderDash: [5,5], fill: false, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#333' } } }
        }
    });
}

// 6. CHART PROVINSI (KANAN) - LOGIKA BARU
function populateProvDropdown() {
    const dropdown = document.getElementById('prov-select');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
    const uniqueProvs = [...new Set(rawData.map(r => r.PROVINSI_CLEAN))].sort();
    uniqueProvs.forEach(prov => {
        if(prov) {
            const opt = document.createElement('option');
            opt.value = prov;
            opt.innerText = prov;
            dropdown.appendChild(opt);
        }
    });
}

function renderProvChart() {
    const selectedProv = document.getElementById('prov-select').value;
    const ctx = document.getElementById('chartProv');
    if (!ctx) return;
    if (chartProvInstance) chartProvInstance.destroy();

    if (!selectedProv) return; // Jika kosong, chart bersih

    // Siapkan Wadah Data untuk Provinsi Terpilih
    let dataReal = Array(12).fill(0);
    let dataTarget = Array(12).fill(0);
    let dataStok = Array(12).fill(0);

    rawData.forEach(r => {
        // Filter Global
        if (r.TAHUN !== selectedYear) return;
        
        // Filter Sektor
        let isSectorMatch = (currentSector === 'SUBSIDI') ? 
            (r.SEKTOR_RAW.includes('SUBSIDI') && !r.SEKTOR_RAW.includes('NON')) : 
            (r.SEKTOR_RAW.includes('RETAIL') || r.SEKTOR_RAW.includes('NON'));
        if (!isSectorMatch) return;

        // Filter PROVINSI
        if (r.PROVINSI_CLEAN !== selectedProv) return;

        // Filter PRODUK (Sesuai Tombol yang Aktif: UREA atau NPK)
        let isProductMatch = false;
        if (activeProduct === 'UREA') isProductMatch = r.PRODUK_RAW.includes('UREA') || r.PRODUK_RAW.includes('NITREA');
        else isProductMatch = r.PRODUK_RAW.includes('NPK') || r.PRODUK_RAW.includes('PHONSKA');
        
        if (!isProductMatch) return;

        // Masukkan Data ke Array
        if (r.BULAN_IDX >= 0 && r.BULAN_IDX < 12) {
            if (r.JENIS_RAW.includes('REALISASI') || r.JENIS_RAW.includes('PENJUALAN')) {
                dataReal[r.BULAN_IDX] += r.TONASE;
            } else if (r.JENIS_RAW.includes('RKAP') || r.JENIS_RAW.includes('TARGET')) {
                dataTarget[r.BULAN_IDX] += r.TONASE;
            } else if (r.JENIS_RAW.includes('STOK') || r.JENIS_RAW.includes('STOCK')) {
                dataStok[r.BULAN_IDX] += r.TONASE;
            }
        }
    });

    // Tentukan Warna berdasarkan Produk Aktif
    const colorMain = activeProduct === 'UREA' ? '#F7DA19' : '#055AA1';
    const colorStock = '#2ecc71'; // Hijau untuk stok

    chartProvInstance = new Chart(ctx, {
        type: 'bar', // Gunakan tipe Bar agar Stok terlihat jelas
        data: {
            labels: CHART_LABELS,
            datasets: [
                {
                    label: 'Realisasi',
                    data: dataReal,
                    type: 'line', // Garis Solid
                    borderColor: colorMain,
                    backgroundColor: colorMain + '20',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    order: 1
                },
                {
                    label: 'Target',
                    data: dataTarget,
                    type: 'line', // Garis Putus-putus
                    borderColor: '#888',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 0,
                    order: 0
                },
                {
                    label: 'Stok',
                    data: dataStok,
                    type: 'bar', // Batang
                    backgroundColor: colorStock + '80', // Transparan
                    barPercentage: 0.5,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#333' } } }
        }
    });
}

// 7. UI ACTION (TOMBOL FILTER)
// ==========================================
function setGlobalProduct(product) {
    activeProduct = product; // Update Variabel Global
    
    // Update Tampilan Tombol
    updateEl('btn-chart-urea', '', el => el.className = product === 'UREA' ? 'btn-toggle active' : 'btn-toggle');
    updateEl('btn-chart-npk', '', el => el.className = product === 'NPK' ? 'btn-toggle active' : 'btn-toggle');
    
    // Update KEDUA Chart (Nasional & Provinsi)
    // Karena updateDashboard() memanggil keduanya, kita panggil itu saja biar aman
    updateDashboard(); 
}

function setSector(s) {
    currentSector = s;
    updateEl('nav-subsidi', '', el => el.className = s === 'SUBSIDI' ? 'nav-item active' : 'nav-item');
    updateEl('nav-retail', '', el => el.className = s === 'RETAIL' ? 'nav-item active' : 'nav-item');
    updateEl('page-heading', s === 'SUBSIDI' ? 'Subsidi' : 'Retail');
    updateDashboard();
    if(window.innerWidth <= 768) toggleSidebar();
}

// 8. HELPER LAINNYA (SAMA SEPERTI SEBELUMNYA)
function updateCard(type, data) {
    const real = data.real;
    const rkap = data.rkap;
    const pct = rkap > 0 ? (real / rkap * 100) : 0;
    const sisa = rkap - real;
    updateEl(`val-${type}`, formatNumber(real));
    updateEl(`txt-${type}-rkap`, formatNumber(rkap));
    updateEl(`kpi-${type}-pct`, pct.toFixed(1) + '%');
    updateEl(`txt-${type}-sisa`, formatNumber(sisa));
    const progEl = document.getElementById(`prog-${type}`);
    if(progEl) progEl.style.width = Math.min(pct, 100) + '%';
}

function renderRankings(stats) {
    const listBest = document.getElementById('list-best');
    const listWarn = document.getElementById('list-warn');
    if (!listBest) return;
    let rankArray = Object.keys(stats).map(prov => ({ name: toTitleCase(prov), real: stats[prov].real }));
    rankArray.sort((a,b) => b.real - a.real);
    listBest.innerHTML = rankArray.slice(0, 5).map((item, i) => `<div class="rank-item" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333; font-size:13px;"><div><span style="color:#F7DA19; margin-right:8px;">${i+1}</span> ${item.name}</div><div style="font-weight:bold;">${formatNumber(item.real)}</div></div>`).join('');
    if(rankArray.length > 5) {
        listWarn.innerHTML = rankArray.slice(-5).reverse().map((item, i) => `<div class="rank-item" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333; font-size:13px;"><div><span style="color:red; margin-right:8px;">${i+1}</span> ${item.name}</div><div style="font-weight:bold;">${formatNumber(item.real)}</div></div>`).join('');
    } else { listWarn.innerHTML = '<div style="padding:10px; color:grey; font-size:12px">Data kurang</div>'; }
}

function drawSparkline(id, data, colorVar, instance, setInstance) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const color = getComputedStyle(document.body).getPropertyValue(colorVar.replace('var(','').replace(')','')).trim() || '#fff';
    if (instance) instance.destroy();
    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: CHART_LABELS, datasets: [{ data: data, borderColor: color, borderWidth: 2, fill: false, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false}, tooltip: {enabled: false} }, scales: { x: {display:false}, y: {display:false} } }
    });
    setInstance(chart);
}

function updateEl(id, val, cb) {
    const el = document.getElementById(id);
    if(el) { if(val !== '') el.innerText = val; if(cb) cb(el); }
}
function formatNumber(n) { return new Intl.NumberFormat('id-ID').format(n || 0); }
function toTitleCase(s) { return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()); }
function toggleTheme() { setTheme(localStorage.getItem('theme') === 'dark' ? 'light' : 'dark'); }
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('show'); document.querySelector('.overlay').classList.toggle('active'); }
function openLoginModal() { alert("Login Placeholder"); }
function openAdminPanel() { }
function closeAllModals() { document.querySelector('.backdrop').classList.remove('open'); }
