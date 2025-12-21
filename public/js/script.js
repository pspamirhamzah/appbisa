/* =========================================================
   SCRIPT FINAL - DASHBOARD MONITORING
   Sinkron dengan HTML baru (ID: val-urea, val-npk, top-province-list)
   ========================================================= */

// URL APPS SCRIPT YANG SUDAH TERBUKTI BERHASIL DI DEBUG SEBELUMNYA
const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec'; 
const ADMIN_PASSWORD = 'pso123';

// VARIABEL GLOBAL
let rawData = [];
let currentSector = 'SUBSIDI'; 
let selectedYear = new Date().getFullYear(); // Default 2025

// KAMUS BULAN (PENTING UNTUK GRAFIK)
const MONTH_MAP = {
    'JAN': 0, 'JANUARI': 0, 'FEB': 1, 'FEBRUARI': 1, 
    'MAR': 2, 'MARET': 2, 'APR': 3, 'APRIL': 3, 
    'MEI': 4, 'MAY': 4, 'JUN': 5, 'JUNI': 5,
    'JUL': 6, 'JULI': 6, 'AGU': 7, 'AGUSTUS': 7, 'AUG': 7,
    'SEP': 8, 'SEPTEMBER': 8, 'OKT': 9, 'OKTOBER': 9,
    'NOV': 10, 'NOVEMBER': 10, 'DES': 11, 'DESEMBER': 11
};
const CHART_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
let chartNasional;

// --- 1. INISIALISASI ---
window.onload = function() {
    // Set Tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Load Data
    loadData();
    
    // Set Label Tahun Awal
    updateYearLabel(selectedYear);
};

// --- 2. AMBIL DATA DARI SERVER ---
function loadData() {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';

    fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        if (!Array.isArray(data)) {
            console.error("Format Data Salah (Bukan Array)");
            return;
        }
        
        // Proses Data Mentah
        processData(data);
        
        // Tampilkan ke Dashboard
        updateDashboard();
        
        if(loader) loader.style.display = 'none';
    })
    .catch(err => {
        console.error("Gagal Mengambil Data:", err);
        if(loader) loader.style.display = 'none';
    });
}

// --- 3. PROSES DATA (PEMBERSIHAN) ---
function processData(data) {
    rawData = data.map(r => {
        // A. Bersihkan Angka (Format Indo "1.250,50" -> Komputer 1250.50)
        let valStr = String(r['TONASE']).replace(/\./g, '').replace(/,/g, '.');
        let val = parseFloat(valStr) || 0;

        // B. Bersihkan Tahun
        let year = parseInt(r['TAHUN']) || 0;
        if (year === 0) year = new Date().getFullYear();

        // C. Bersihkan Bulan (Teks -> Angka Index)
        let txtBulan = String(r['BULAN'] || '').toUpperCase().trim();
        let monthIdx = MONTH_MAP[txtBulan] !== undefined ? MONTH_MAP[txtBulan] : -1;

        return {
            ...r,
            TAHUN: year,
            BULAN_IDX: monthIdx,
            // Simpan versi Huruf Besar untuk memudahkan filter
            SEKTOR_RAW: String(r['SEKTOR'] || '').toUpperCase().trim(),
            PRODUK_RAW: String(r['PRODUK'] || '').toUpperCase().trim(),
            JENIS_RAW: String(r['JENIS'] || '').toUpperCase().trim(),
            PROVINSI_RAW: String(r['PROVINSI'] || '').toUpperCase().trim(),
            TONASE: val
        };
    });

    // Auto-Switch Tahun (Jika 2025 kosong, cari tahun yang ada datanya)
    const hasData = rawData.some(r => r.TAHUN === selectedYear);
    if (!hasData && rawData.length > 0) {
        const uniqueYears = [...new Set(rawData.map(r => r.TAHUN))].sort((a,b) => b-a);
        if(uniqueYears.length > 0) {
            selectedYear = uniqueYears[0];
            updateYearLabel(selectedYear);
        }
    }
}

// --- 4. UPDATE TAMPILAN DASHBOARD ---
function updateDashboard() {
    if (rawData.length === 0) return;

    // Reset Variabel Hitungan
    let totalUrea = 0;
    let totalNPK = 0;
    let provStats = {};
    let chartData = { 
        UREA: { real: Array(12).fill(0), target: Array(12).fill(0) }, 
        NPK: { real: Array(12).fill(0), target: Array(12).fill(0) } 
    };

    // Looping Data
    rawData.forEach(r => {
        // Filter 1: Tahun
        if (r.TAHUN !== selectedYear) return;

        // Filter 2: Sektor (Subsidi vs Retail)
        let isSectorMatch = (currentSector === 'SUBSIDI') ? 
            (r.SEKTOR_RAW.includes('SUBSIDI') && !r.SEKTOR_RAW.includes('NON')) : 
            (r.SEKTOR_RAW.includes('RETAIL') || r.SEKTOR_RAW.includes('NON'));
        
        if (!isSectorMatch) return;

        // Identifikasi Jenis & Produk
        const isReal = r.JENIS_RAW.includes('REALISASI') || r.JENIS_RAW.includes('PENJUALAN');
        const isTarget = r.JENIS_RAW.includes('RKAP') || r.JENIS_RAW.includes('TARGET');
        
        let pKey = '';
        if (r.PRODUK_RAW.includes('UREA') || r.PRODUK_RAW.includes('NITREA')) pKey = 'UREA';
        else if (r.PRODUK_RAW.includes('NPK') || r.PRODUK_RAW.includes('PHONSKA')) pKey = 'NPK';

        if (!pKey) return;

        // --- HITUNG AGGREGASI ---
        if (isReal) {
            // Tambah Total Nasional
            if (pKey === 'UREA') totalUrea += r.TONASE;
            else totalNPK += r.TONASE;
            
            // Tambah Ranking Provinsi
            let prov = r.PROVINSI_RAW || 'LAINNYA';
            if (!provStats[prov]) provStats[prov] = 0;
            provStats[prov] += r.TONASE;
            
            // Tambah Grafik Bulanan
            if (r.BULAN_IDX >= 0) chartData[pKey].real[r.BULAN_IDX] += r.TONASE;
        } 
        else if (isTarget) {
            // Tambah Target Grafik
            if (r.BULAN_IDX >= 0) chartData[pKey].target[r.BULAN_IDX] += r.TONASE;
        }
    });

    // --- UPDATE ELEMEN HTML ---
    // Pastikan ID ini ada di HTML Anda (val-urea, val-npk)
    updateElement('val-urea', formatNumber(totalUrea));
    updateElement('val-npk', formatNumber(totalNPK));
    
    // Render Ranking & Grafik
    renderRanking(provStats);
    renderCharts(chartData);
}

// --- 5. FUNGSI RENDER KOMPONEN ---

function renderRanking(stats) {
    const list = document.getElementById('top-province-list');
    if (!list) return;

    // Convert Object -> Array -> Sort
    let sorted = Object.keys(stats).map(key => ({ name: toTitleCase(key), val: stats[key] }));
    sorted.sort((a, b) => b.val - a.val);

    // Buat HTML Top 5
    let html = '';
    sorted.slice(0, 5).forEach((item, idx) => {
        const isFirst = idx === 0;
        html += `
        <div class="rank-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; gap:12px; align-items:center;">
                <div class="rank-badge ${isFirst ? 'badge-1' : ''}" style="width:30px; height:30px; display:flex; justify-content:center; align-items:center; border-radius:8px; font-weight:bold; border:1px solid var(--border-color); font-size:12px;">
                    ${idx+1}
                </div>
                <div>
                    <span class="rank-name" style="font-weight:600; font-size:13px; display:block;">${item.name}</span>
                    <span class="rank-meta" style="font-size:11px; color:var(--text-secondary);">Realisasi Total</span>
                </div>
            </div>
            <div class="rank-val" style="font-weight:700; font-size:13px;">
                ${formatNumber(item.val)}
            </div>
        </div>`;
    });

    if (sorted.length === 0) {
        html = `<div style="text-align:center; padding:20px; font-size:12px; color:grey">Tidak ada data</div>`;
    }
    list.innerHTML = html;
}

function renderCharts(data) {
    const ctx = document.getElementById('chartNasional');
    if (!ctx) return;
    
    // Hapus chart lama jika ada
    if (chartNasional) chartNasional.destroy();

    const styles = getComputedStyle(document.body);
    const cUrea = styles.getPropertyValue('--color-urea').trim() || '#F7DA19';
    const cText = styles.getPropertyValue('--text-secondary').trim() || '#888';

    chartNasional = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: CHART_LABELS,
            datasets: [
                { 
                    label: 'Realisasi', 
                    data: data.UREA.real, 
                    borderColor: cUrea, 
                    backgroundColor: cUrea + '20', 
                    fill: true, 
                    tension: 0.4, 
                    borderWidth: 3, 
                    pointRadius: 3 
                },
                { 
                    label: 'Target', 
                    data: data.UREA.target, 
                    borderColor: cText, 
                    borderDash: [5,5], 
                    fill: false, 
                    tension: 0.4, 
                    borderWidth: 2, 
                    pointRadius: 0 
                }
            ]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: true, position: 'top', align: 'end', labels: { color: cText, boxWidth: 10 } } 
            },
            scales: { 
                x: { grid: { display: false }, ticks: { color: cText } }, 
                y: { border: { display: false }, grid: { color: '#333' }, ticks: { color: cText } } 
            }
        }
    });
}

// --- 6. UTILS & HELPER ---

function updateElement(id, value) {
    const el = document.getElementById(id);
    if(el) el.innerText = value;
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function updateYearLabel(y) {
    const el = document.querySelector('.page-info p');
    if(el) el.innerText = `Data Tahun: ${y}`;
}

// Interaksi Menu Sektor
function setSector(s) {
    currentSector = s;
    document.getElementById('nav-subsidi').className = s === 'SUBSIDI' ? 'nav-item active' : 'nav-item';
    document.getElementById('nav-retail').className = s === 'RETAIL' ? 'nav-item active' : 'nav-item';
    document.querySelector('.page-info h2').innerText = s === 'SUBSIDI' ? 'Subsidi' : 'Retail';
    
    updateDashboard();
    
    if(window.innerWidth <= 768) toggleSidebar();
}

// Interaksi Tema & Sidebar
function toggleTheme() {
    const current = localStorage.getItem('theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    const icon = document.getElementById('theme-icon-sidebar');
    if(icon) icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay'); 
    if(sb) sb.classList.toggle('show');
    if(overlay) overlay.classList.toggle('active');
}

// --- ADMIN (PLACEHOLDER) ---
function openLoginModal() { 
    if(!document.getElementById('loginModal')) createLoginModalHTML();
    openModal('loginModal'); 
}
function attemptLogin() { 
    if(document.getElementById('adminPass').value === ADMIN_PASSWORD) {
        closeAllModals(); 
        alert("Login Berhasil!"); 
    } else { alert("Password Salah"); }
}
function openAdminPanel() { alert("Fitur Admin aktif setelah login"); }
function openModal(id) { document.getElementById(id).classList.add('open'); document.querySelector('.backdrop').classList.add('open'); }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); document.querySelectorAll('.backdrop').forEach(b => b.classList.remove('open')); }
document.addEventListener('click', (e) => { if(e.target.classList.contains('backdrop')) closeAllModals(); });
function createLoginModalHTML() {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal" id="loginModal"><div class="modal-header"><h3>Admin</h3><button class="btn-close" onclick="closeAllModals()">&times;</button></div><div class="modal-body"><input type="password" id="adminPass" class="form-control" placeholder="Password"></div><div class="modal-footer"><button class="btn btn-primary" onclick="attemptLogin()">Masuk</button></div></div>`;
    document.body.appendChild(div);
}
