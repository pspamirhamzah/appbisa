/* =========================================================
   APP SCRIPT CONFIGURATION
   ========================================================= */
// GANTI URL INI DENGAN URL DEPLOYMENT TERBARU ANDA (AKHIRAN /exec)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvQc8_pnXd6PrcU9bQZ28Trh0Ad0P5OHrCKs9203wwY-Sk7u9KvCeKKHpucoQmAyBunA/exec';

// Password Admin (Sesuai keinginan)
const ADMIN_PASSWORD = 'pso123';

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */
let rawData = [];
let currentSector = 'SUBSIDI'; // Default View
let isAdminLoggedIn = false;

/* =========================================================
   1. INITIALIZATION & FETCH DATA
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Tema yang tersimpan
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // 2. Load Data
    fetchData();
});

function fetchData() {
    // Tampilkan Loading
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';

    fetch(GOOGLE_SCRIPT_URL)
        .then(response => {
            if (!response.ok) throw new Error("HTTP Error");
            return response.json();
        })
        .then(data => {
            // Validasi Data
            if(!data || !data.subsidi || !data.retail) {
                throw new Error("Format Data Salah");
            }
            
            // Simpan ke variabel global
            rawData = data;
            
            // Update Tampilan
            updateDashboard();
            
            // Sembunyikan Loading
            if(loader) loader.style.display = 'none';
        })
        .catch(error => {
            console.error('Error:', error);
            if(loader) loader.style.display = 'none';
            
            // Tampilkan Pesan Error yang Lebih Spesifik
            alert("Gagal mengambil data. Pastikan:\n1. URL Web App di script.js sudah benar (versi /exec)\n2. Deployment Apps Script diatur ke 'Anyone'\n3. Koneksi internet stabil.");
        });
}

/* =========================================================
   2. DASHBOARD LOGIC
   ========================================================= */
function setSector(sector) {
    currentSector = sector;
    
    // Update Active Menu Sidebar
    // Gunakan pengecekan (if) agar tidak error jika elemen hilang
    const navSubsidi = document.getElementById('nav-subsidi');
    const navRetail = document.getElementById('nav-retail');
    
    if(navSubsidi) navSubsidi.className = sector === 'SUBSIDI' ? 'nav-item active' : 'nav-item';
    if(navRetail) navRetail.className = sector === 'RETAIL' ? 'nav-item active' : 'nav-item';
    
    updateDashboard();
    
    // Di Mobile, tutup sidebar setelah klik menu
    if(window.innerWidth <= 768) toggleSidebar(); 
}

function updateDashboard() {
    if(!rawData.subsidi) return; // Cegah error jika data belum siap

    // Tentukan data mana yang dipakai (Subsidi / Retail)
    const data = currentSector === 'SUBSIDI' ? rawData.subsidi : rawData.retail;
    
    // 1. Update Judul Halaman & Tanggal
    const pageTitle = document.querySelector('.page-info h2');
    const lastUpdate = document.querySelector('.page-info p');
    if(pageTitle) pageTitle.innerText = currentSector === 'SUBSIDI' ? 'Subsidi' : 'Retail';
    if(lastUpdate) lastUpdate.innerText = `Update: ${rawData.lastUpdate || '-'}`;

    // 2. Update Kartu Atas (KPI) - SAFE MODE
    updateElement('val-urea', formatNumber(data.urea_real));
    updateElement('val-npk', formatNumber(data.npk_real));
    
    // 3. Update Chart Sederhana (Growth) - Jika library chart tidak dipakai, skip
    // (Di sini kita asumsikan pakai gambar statis atau teks dulu jika chart library belum diload)
    
    // LOGIC LAINNYA DISINI...
    // Karena kode grafik panjang, pastikan fungsi updateElement aman:
}

// Fungsi Aman untuk Update Teks (Mencegah Error jika ID tidak ketemu)
function updateElement(id, value) {
    const el = document.getElementById(id);
    if(el) {
        el.innerText = value;
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

/* =========================================================
   3. THEME & UI INTERACTION
   ========================================================= */
function toggleTheme() {
    const current = localStorage.getItem('theme') || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    
    // Update Icon di Sidebar (Matahari/Bulan)
    const icon = document.getElementById('theme-icon-sidebar');
    if(icon) {
        icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if(sb) sb.classList.toggle('show');
    if(overlay) overlay.classList.toggle('active');
}

/* =========================================================
   4. ADMIN LOGIN SYSTEM (MODAL)
   ========================================================= */
function openLoginModal() {
    if(isAdminLoggedIn) {
        // Jika sudah login, maka fungsi tombol berubah jadi LOGOUT
        isAdminLoggedIn = false;
        alert("Anda telah logout.");
        
        // Reset Tombol Menu
        const btn = document.getElementById('btn-login-trigger');
        if(btn) btn.innerHTML = '<i class="fas fa-lock"></i> <span>Login Admin</span>';
        
        // Sembunyikan menu Kelola Data
        const adminPanelBtn = document.getElementById('btn-admin-panel');
        if(adminPanelBtn) adminPanelBtn.style.display = 'none';
        
        toggleSidebar();
    } else {
        // Buka Modal Login
        const modal = document.getElementById('loginModal');
        const backdrop = document.getElementById('modalBackdrop'); // Pastikan ID ini ada di HTML atau pakai class
        
        // Karena struktur HTML modal kita pakai class 'modal', kita panggil fungsi helper:
        openModal('loginModal');
    }
}

function attemptLogin() {
    const input = document.getElementById('adminPass');
    if(!input) return;
    
    if(input.value === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        closeAllModals();
        input.value = ''; // Bersihkan password
        
        // Ubah Tampilan Menu Sidebar
        const btn = document.getElementById('btn-login-trigger');
        if(btn) btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Logout</span>';
        
        // Munculkan menu Kelola Data
        const adminPanelBtn = document.getElementById('btn-admin-panel');
        if(adminPanelBtn) adminPanelBtn.style.display = 'flex';
        
        alert("Login Berhasil!");
        toggleSidebar(); // Tutup sidebar
    } else {
        alert("Password Salah!");
    }
}

// HELPER MODALS
function openModal(modalId) {
    const m = document.getElementById(modalId);
    const b = document.querySelector('.backdrop'); // Selektor class backdrop
    if(m) m.classList.add('open');
    if(b) b.classList.add('open');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.backdrop').forEach(b => b.classList.remove('open'));
}

// Event Listener untuk menutup modal saat klik backdrop
document.addEventListener('click', (e) => {
    if(e.target.classList.contains('backdrop')) {
        closeAllModals();
    }
});
