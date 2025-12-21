/* =========================================================
   APP SCRIPT CONFIGURATION
   ========================================================= */
// ⚠️ PASTE URL /exec ANDA DISINI (JANGAN SALAH)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvQc8_pnXd6PrcU9bQZ28Trh0Ad0P5OHrCKs9203wwY-Sk7u9KvCeKKHpucoQmAyBunA/exec';

const ADMIN_PASSWORD = 'pso123';

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */
let rawData = [];
let currentSector = 'SUBSIDI'; 

/* =========================================================
   1. INITIALIZATION
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    fetchData();
});

function fetchData() {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';

    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            // DIAGNOSA DATA
            console.log("Data Diterima:", data); 

            if (Array.isArray(data) && data.length > 0) {
                rawData = data;
                
                // Cek isi data baris pertama untuk memastikan kolom terbaca
                const firstRow = data[0];
                console.log("Contoh Baris Pertama:", firstRow);
                
                updateDashboard(); 
                if(loader) loader.style.display = 'none';
            } else {
                if(loader) loader.style.display = 'none';
                alert("Data berhasil terhubung, tapi isinya KOSONG []. Cek Google Sheet Anda.");
            }
        })
        .catch(error => {
            console.error(error);
            if(loader) loader.style.display = 'none';
        });
}

/* =========================================================
   2. SMART CALCULATION (AUTO DETECT COLUMN NAME)
   ========================================================= */
function setSector(sector) {
    currentSector = sector;
    
    // Update Menu Aktif
    const navSubsidi = document.getElementById('nav-subsidi');
    const navRetail = document.getElementById('nav-retail');
    if(navSubsidi) navSubsidi.className = sector === 'SUBSIDI' ? 'nav-item active' : 'nav-item';
    if(navRetail) navRetail.className = sector === 'RETAIL' ? 'nav-item active' : 'nav-item';
    
    updateDashboard();
    
    // Mobile Sidebar
    if(window.innerWidth <= 768) toggleSidebar();
}

// FUNGSI PINTAR: Mencari nilai kolom tanpa peduli Huruf Besar/Kecil
function getSmartValue(row, columnName) {
    // Cari kunci yang cocok (misal: 'Tonase' cocok dengan 'TONASE')
    const key = Object.keys(row).find(k => k.toUpperCase() === columnName.toUpperCase());
    return key ? row[key] : null;
}

function updateDashboard() {
    if (rawData.length === 0) return;

    let totalUrea = 0;
    let totalNPK = 0;

    rawData.forEach(row => {
        // GUNAKAN FUNGSI PINTAR UNTUK AMBIL DATA
        const valSektor = getSmartValue(row, 'SEKTOR');
        const valProduk = getSmartValue(row, 'PRODUK');
        const valTonase = getSmartValue(row, 'TONASE');

        // Bersihkan Data
        const sektor = valSektor ? valSektor.toString().toUpperCase().trim() : '';
        const produk = valProduk ? valProduk.toString().toUpperCase().trim() : '';
        
        // Bersihkan Angka (Handle string "1.000" atau number 1000)
        let tonase = 0;
        if (typeof valTonase === 'string') {
            tonase = parseFloat(valTonase.replace(/\./g, '').replace(/,/g, '.')) || 0;
        } else {
            tonase = parseFloat(valTonase) || 0;
        }

        // Logika Penjumlahan
        if (sektor === currentSector) {
            if (produk.includes('UREA') || produk.includes('NITREA')) {
                totalUrea += tonase;
            } 
            else if (produk.includes('NPK') || produk.includes('PHONSKA')) {
                totalNPK += tonase;
            }
        }
    });

    // Update UI
    const pageTitle = document.querySelector('.page-info h2');
    if(pageTitle) pageTitle.innerText = currentSector === 'SUBSIDI' ? 'Subsidi' : 'Retail';

    updateElement('val-urea', formatNumber(totalUrea));
    updateElement('val-npk', formatNumber(totalNPK));
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if(el) el.innerText = value;
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

/* =========================================================
   3. THEME & UI
   ========================================================= */
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

/* =========================================================
   4. ADMIN LOGIN
   ========================================================= */
let isAdminLoggedIn = false;

function openLoginModal() {
    if(isAdminLoggedIn) {
        isAdminLoggedIn = false;
        alert("Anda telah logout.");
        document.getElementById('btn-login-trigger').innerHTML = '<i class="fas fa-lock"></i> <span>Login Admin</span>';
        if(document.getElementById('btn-admin-panel')) document.getElementById('btn-admin-panel').style.display = 'none';
        toggleSidebar();
    } else {
        openModal('loginModal');
    }
}

function attemptLogin() {
    const input = document.getElementById('adminPass');
    if(input && input.value === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        closeAllModals();
        input.value = '';
        document.getElementById('btn-login-trigger').innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Logout</span>';
        if(document.getElementById('btn-admin-panel')) document.getElementById('btn-admin-panel').style.display = 'flex';
        alert("Login Berhasil!");
        toggleSidebar();
    } else {
        alert("Password Salah!");
    }
}

function openModal(modalId) {
    const m = document.getElementById(modalId);
    const b = document.querySelector('.backdrop');
    if(m) m.classList.add('open');
    if(b) b.classList.add('open');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.overlay, .backdrop').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.backdrop').forEach(b => b.classList.remove('open'));
}

document.addEventListener('click', (e) => {
    if(e.target.classList.contains('backdrop') || e.target.classList.contains('overlay')) {
        closeAllModals();
        const sb = document.getElementById('sidebar');
        if(sb && sb.classList.contains('show')) toggleSidebar();
    }
});
