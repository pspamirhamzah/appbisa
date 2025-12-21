/* =========================================================
   1. CONFIGURATION
   ========================================================= */
// ⚠️ PASTE URL /exec ANDA DISINI
const API_URL = 'https://script.google.com/macros/s/AKfycbzTg_zhIghrwMz5X2SMH30i-QWE58eIgYjXVWurPKxdOyvSVXD76rYf57dOVwDydiwR0g/exec';
const ADMIN_PASSWORD = 'pso123';

/* =========================================================
   2. GLOBAL VARIABLES
   ========================================================= */
let rawData = [];
let currentSector = 'SUBSIDI'; 
let selectedYear = new Date().getFullYear(); 
let isAdminLoggedIn = false;

// Label Bulan untuk Grafik
const indoMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Kamus Bulan (Untuk mengatasi teks "Jan", "January", dll)
const MONTH_MAP = {
    'JAN': 0, 'JANUARI': 0,
    'FEB': 1, 'FEBRUARI': 1,
    'MAR': 2, 'MARET': 2,
    'APR': 3, 'APRIL': 3,
    'MEI': 4, 'MAY': 4,
    'JUN': 5, 'JUNI': 5,
    'JUL': 6, 'JULI': 6,
    'AGU': 7, 'AGUSTUS': 7,
    'SEP': 8, 'SEPTEMBER': 8,
    'OKT': 9, 'OKTOBER': 9,
    'NOV': 10, 'NOVEMBER': 10,
    'DES': 11, 'DESEMBER': 11
};

/* =========================================================
   3. INITIALIZATION
   ========================================================= */
window.onload = function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    loadData();
    
    // Update label tahun
    const yearLabel = document.querySelector('.page-info p');
    if(yearLabel) yearLabel.innerText = `Data Tahun: ${selectedYear}`;
};

function loadData() {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';

    fetch(API_URL)
    .then(response => response.json())
    .then(data => {
        if(data.error) { 
            console.error("Server Error:", data.error);
            if(loader) loader.style.display = 'none';
            return;
        }

        // PROSES DATA
        processData(data);
        
        // DEBUGGING: Cek di Console Browser (Tekan F12)
        console.log(`Total Data: ${data.length}`);
        console.log(`Data Tahun ${selectedYear}: ${rawData.filter(r => r.TAHUN == selectedYear).length}`);

        updateAll();
        
        if(loader) loader.style.display = 'none';
    })
    .catch(error => {
        console.error('Fetch Error:', error);
        if(loader) loader.style.display = 'none';
    });
}

function processData(data) {
    if (!Array.isArray(data)) return;
    
    rawData = data.map(r => {
        // 1. BERSIHKAN ANGKA TONASE (Hapus titik ribuan)
        let val = r['TONASE'];
        if (typeof val === 'string') {
            val = parseFloat(val.replace(/\./g, '').replace(/,/g, '.')) || 0;
        } else {
            val = Number(val) || 0;
        }

        // 2. AMBIL TAHUN (Pastikan jadi Angka)
        let year = parseInt(r['TAHUN']); 
        
        // 3. AMBIL BULAN (Teks atau Tanggal)
        let rawBulan = String(r['BULAN'] || '').toUpperCase().trim();
        let monthIdx = -1;

        // Cek apakah ini Format Tanggal ISO (2024-12-31...)
        if (rawBulan.includes('T') && rawBulan.includes('-')) {
            let d = new Date(r['BULAN']);
            if (!isNaN(d.getTime())) {
                // Konversi UTC ke WIB manual (Tambah 7 jam) biar tidak mundur ke 2024
                // Atau sederhananya: Ambil Bulan dari string-nya langsung jika format ISO
                // Tapi cara paling aman: Gunakan Timezone Browser User (WIB)
                monthIdx = d.getMonth(); 
                
                // Jika tahun kosong, ambil dari tanggal
                if (!year) year = d.getFullYear();
            }
        } 
        // Cek apakah ini Teks ("JAN", "FEB")
        else if (MONTH_MAP.hasOwnProperty(rawBulan)) {
            monthIdx = MONTH_MAP[rawBulan];
        }

        // Fallback Tahun
        if (!year) year = new Date().getFullYear();

        return {
            ...r,
            TAHUN: year,
            BULAN_IDX: monthIdx,
            // HAPUS TRIM/UPPERCASE DISINI AGAR FILTER TIDAK ERROR
            // Kita lakukan normalisasi SAAT FILTERING saja
            SEKTOR_RAW: String(r['SEKTOR'] || '').toUpperCase().trim(),
            PRODUK_RAW: String(r['PRODUK'] || '').toUpperCase().trim(),
            JENIS_RAW: String(r['JENIS'] || '').toUpperCase().trim(),
            PROVINSI_RAW: String(r['PROVINSI'] || '').toUpperCase().trim(),
            TONASE: val,
            _rowIndex: r['_rowIndex']
        };
    });
    
    // Auto-Select Tahun jika data tahun ini kosong
    const dataThisYear = rawData.filter(r => r.TAHUN === selectedYear);
    if (dataThisYear.length === 0 && rawData.length > 0) {
        // Cari tahun yang ada datanya
        const uniqueYears = [...new Set(rawData.map(item => item.TAHUN))].sort((a,b)=>b-a);
        if(uniqueYears.length > 0) {
            selectedYear = uniqueYears[0];
            const yearLabel = document.querySelector('.page-info p');
            if(yearLabel) yearLabel.innerText = `Data Tahun: ${selectedYear}`;
        }
    }
}

/* =========================================================
   4. DASHBOARD LOGIC
   ========================================================= */
function setSector(sector) {
    currentSector = sector;
    
    // Update Menu Visual
    const navSubsidi = document.getElementById('nav-subsidi');
    const navRetail = document.getElementById('nav-retail');
    if(navSubsidi) navSubsidi.className = sector === 'SUBSIDI' ? 'nav-item active' : 'nav-item';
    if(navRetail) navRetail.className = sector === 'RETAIL' ? 'nav-item active' : 'nav-item';
    
    const title = document.querySelector('.page-info h2');
    if(title) title.innerText = sector === 'SUBSIDI' ? 'Subsidi' : 'Retail';

    updateAll();
    if(window.innerWidth <= 768) toggleSidebar();
}

function updateAll() {
    if (rawData.length === 0) return;

    let totalUrea = 0;
    let totalNPK = 0;
    let provStats = {};
    
    // Data Grafik
    let chartData = {
        UREA: { real: Array(12).fill(0), target: Array(12).fill(0) },
        NPK: { real: Array(12).fill(0), target: Array(12).fill(0) }
    };

    rawData.forEach(r => {
        // 1. FILTER TAHUN (Pakai == biar "2025" sama dengan 2025)
        if (r.TAHUN != selectedYear) return;

        // 2. FILTER SEKTOR (Pakai Includes)
        let isSectorMatch = false;
        if (currentSector === 'SUBSIDI') {
            isSectorMatch = r.SEKTOR_RAW.includes('SUBSIDI') && !r.SEKTOR_RAW.includes('NON');
        } else {
            isSectorMatch = r.SEKTOR_RAW.includes('RETAIL') || r.SEKTOR_RAW.includes('NON');
        }
        if (!isSectorMatch) return;

        // 3. IDENTIFIKASI JENIS & PRODUK (Pakai Includes)
        const isReal = r.JENIS_RAW.includes('REALISASI') || r.JENIS_RAW.includes('PENJUALAN');
        const isTarget = r.JENIS_RAW.includes('RKAP') || r.JENIS_RAW.includes('TARGET');
        
        let prodKey = '';
        if (r.PRODUK_RAW.includes('UREA') || r.PRODUK_RAW.includes('NITREA')) prodKey = 'UREA';
        else if (r.PRODUK_RAW.includes('NPK') || r.PRODUK_RAW.includes('PHONSKA')) prodKey = 'NPK';

        if (!prodKey) return; 

        // 4. AGGREGASI
        if (isReal) {
            if (prodKey === 'UREA') totalUrea += r.TONASE;
            else totalNPK += r.TONASE;

            // Ranking
            let prov = r.PROVINSI_RAW || 'LAINNYA';
            if (!provStats[prov]) provStats[prov] = 0;
            provStats[prov] += r.TONASE;

            // Grafik
            if (r.BULAN_IDX >= 0 && r.BULAN_IDX < 12) {
                chartData[prodKey].real[r.BULAN_IDX] += r.TONASE;
            }
        } else if (isTarget) {
            // Grafik Target
            if (r.BULAN_IDX >= 0 && r.BULAN_IDX < 12) {
                chartData[prodKey].target[r.BULAN_IDX] += r.TONASE;
            }
        }
    });

    // UPDATE UI
    updateElement('val-urea', formatNumber(totalUrea));
    updateElement('val-npk', formatNumber(totalNPK));
    
    renderRanking(provStats);
    renderCharts(chartData);
}

function renderRanking(provStats) {
    const container = document.getElementById('top-province-list');
    if(!container) return;

    // Mapping ulang nama provinsi agar Title Case (Agar Rapi di Tampilan)
    // Karena tadi di-Upper Case semua
    let sorted = Object.keys(provStats).map(key => ({ name: toTitleCase(key), val: provStats[key] }));
    sorted.sort((a, b) => b.val - a.val);

    let html = '';
    sorted.slice(0, 5).forEach((item, index) => {
        const isFirst = index === 0;
        html += `
        <div class="rank-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="rank-badge ${isFirst ? 'badge-1' : ''}" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; border: 1px solid var(--border-color);">
                    ${index + 1}
                </div>
                <div>
                    <span class="rank-name" style="font-weight: 600; font-size: 13px; display: block;">${item.name}</span>
                    <span class="rank-meta" style="font-size: 11px; color: var(--text-secondary);">Realisasi Total</span>
                </div>
            </div>
            <div class="rank-val" style="font-weight: 700; font-size: 13px;">${formatNumber(item.val)}</div>
        </div>`;
    });
    
    if (sorted.length === 0) html = `<p style="text-align:center; padding:20px; font-size:12px; color:grey">Tidak ada data realisasi tahun ${selectedYear}</p>`;
    container.innerHTML = html;
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function renderCharts(data) {
    drawChart('chartNasional', data.UREA.real, data.UREA.target, 'UREA');
    // Jika ingin grafik NPK juga, bisa panggil fungsi drawChart lagi ke canvas ID lain
}

function drawChart(canvasId, dReal, dTarget, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const context = ctx.getContext('2d');
    const styles = getComputedStyle(document.body);
    const colorMain = label === 'UREA' ? styles.getPropertyValue('--color-urea').trim() || '#F7DA19' : styles.getPropertyValue('--color-npk').trim() || '#055AA1';
    const colorText = styles.getPropertyValue('--text-secondary').trim() || '#888';
    
    if (canvasId === 'chartNasional' && chartNasional) chartNasional.destroy();
    
    const config = {
        type: 'line',
        data: {
            labels: indoMonths,
            datasets: [
                {
                    label: 'Realisasi',
                    data: dReal,
                    borderColor: colorMain,
                    backgroundColor: colorMain + '20',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                },
                {
                    label: 'Target',
                    data: dTarget,
                    borderColor: colorText,
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', align: 'end', labels: { color: colorText, font: { size: 11 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: colorText, font: { size: 10 } } },
                y: { border: { display: false }, grid: { color: '#333333' }, ticks: { color: colorText, font: { size: 10 } }, beginAtZero: true }
            }
        }
    };

    const newChart = new Chart(context, config);
    if (canvasId === 'chartNasional') chartNasional = newChart;
}

/* =========================================================
   5. UTILS & ADMIN
   ========================================================= */
function updateElement(id, value) {
    const el = document.getElementById(id);
    if(el) el.innerText = value;
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

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

function openLoginModal() {
    if(isAdminLoggedIn) {
        isAdminLoggedIn = false;
        alert("Logout Berhasil");
        document.getElementById('btn-login-trigger').innerHTML = '<i class="fas fa-lock"></i> <span>Login Admin</span>';
        if(document.getElementById('btn-admin-panel')) document.getElementById('btn-admin-panel').style.display = 'none';
        toggleSidebar();
    } else {
        if(!document.getElementById('loginModal')) createLoginModalHTML();
        openModal('loginModal');
    }
}

function attemptLogin() {
    const pass = document.getElementById('adminPass').value;
    if(pass === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        closeAllModals();
        document.getElementById('btn-login-trigger').innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Logout</span>';
        if(document.getElementById('btn-admin-panel')) document.getElementById('btn-admin-panel').style.display = 'flex';
        alert("Login Berhasil!");
        toggleSidebar();
        openAdminPanel();
    } else {
        alert("Password Salah!");
    }
}

function openAdminPanel() {
    if(!document.getElementById('adminPanelModal')) createAdminPanelHTML();
    renderAdminTable();
    openModal('adminPanelModal');
}

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    rawData.slice(0, 50).forEach(row => {
        let tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border-subtle)";
        tr.innerHTML = `<td style="padding:10px;"><button class="btn btn-primary" style="padding:4px 8px; font-size:11px;">Edit</button></td><td style="padding:10px; font-size:12px;">${row['SEKTOR_RAW']}</td><td style="padding:10px; font-size:12px;">${row['PRODUK_RAW']}</td><td style="padding:10px; font-size:12px;">${row['JENIS_RAW']}</td><td style="padding:10px; font-size:12px;">${row['PROVINSI_RAW']}</td><td style="padding:10px; font-size:12px;">${formatNumber(row['TONASE'])}</td>`;
        tbody.appendChild(tr);
    });
}

function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.querySelector('.backdrop').classList.add('open');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.backdrop').forEach(b => b.classList.remove('open'));
}

document.addEventListener('click', (e) => {
    if(e.target.classList.contains('backdrop')) closeAllModals();
});

function createLoginModalHTML() {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal" id="loginModal"><div class="modal-header"><h3 class="modal-title">Admin Login</h3><button class="btn-close" onclick="closeAllModals()">&times;</button></div><div class="modal-body"><input type="password" id="adminPass" class="form-control" placeholder="Password..."></div><div class="modal-footer"><button class="btn btn-primary" onclick="attemptLogin()">Masuk</button></div></div>`;
    document.body.appendChild(div);
}
function createAdminPanelHTML() {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal large" id="adminPanelModal" style="width:95%; max-width:800px;"><div class="modal-header"><h3 class="modal-title">Kelola Data</h3><button class="btn-close" onclick="closeAllModals()">&times;</button></div><div class="modal-body"><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; color:var(--text-primary);"><thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;"><th style="padding:10px;">Aksi</th><th>Sektor</th><th>Produk</th><th>Jenis</th><th>Provinsi</th><th>Tonase</th></tr></thead><tbody id="adminTableBody"></tbody></table></div></div></div>`;
    document.body.appendChild(div);
}
