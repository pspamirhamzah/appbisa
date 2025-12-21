/* =========================================================
   VISUAL DEBUGGER SCRIPT (AKAN MUNCUL DI LAYAR)
   ========================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec'; // ⚠️ PASTE URL ANDA
const ADMIN_PASSWORD = 'pso123';

let rawData = [];
let currentSector = 'SUBSIDI'; 
let selectedYear = 2025; // Kita kunci dulu ke 2025

const MONTH_MAP = {
    'JAN': 0, 'JANUARI': 0, 'FEB': 1, 'FEBRUARI': 1, 'MAR': 2, 'MARET': 2,
    'APR': 3, 'APRIL': 3, 'MEI': 4, 'MAY': 4, 'JUN': 5, 'JUNI': 5,
    'JUL': 6, 'JULI': 6, 'AGU': 7, 'AGUSTUS': 7, 'AUG': 7, 'SEP': 8, 'SEPTEMBER': 8,
    'OKT': 9, 'OKTOBER': 9, 'NOV': 10, 'NOVEMBER': 10, 'DES': 11, 'DESEMBER': 11
};
const CHART_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
let chartNasional; 

// --- FUNGSI LOG KE LAYAR ---
function screenLog(msg) {
    let logBox = document.getElementById('debug-console');
    if (!logBox) {
        logBox = document.createElement('div');
        logBox.id = 'debug-console';
        logBox.style.cssText = "position:fixed; bottom:0; right:0; width:100%; height:200px; background:black; color:#0f0; font-family:monospace; font-size:12px; overflow-y:scroll; z-index:9999; padding:10px; border-top:2px solid #0f0; opacity:0.9;";
        document.body.appendChild(logBox);
    }
    const p = document.createElement('div');
    p.style.borderBottom = "1px solid #333";
    p.innerText = `> ${msg}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

window.onload = function() {
    screenLog("Script DIMULAI...");
    screenLog("Mencoba fetch ke: " + API_URL);
    loadData();
};

function loadData() {
    fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        screenLog("Fetch BERHASIL!");
        screenLog(`Jumlah Data Diterima: ${data.length} baris`);
        
        if (data.length > 0) {
            screenLog("Sampel Data Baris 1: " + JSON.stringify(data[0]));
        } else {
            screenLog("⚠️ DATA KOSONG! Cek Spreadsheet.");
        }

        processAndRender(data);
    })
    .catch(err => {
        screenLog("❌ FETCH ERROR: " + err.message);
    });
}

function processAndRender(data) {
    if (!Array.isArray(data)) return;

    let totalUrea = 0;
    let totalNPK = 0;
    let countLolos = 0;

    // --- LOOPING MANUAL UNTUK DIAGNOSA ---
    data.forEach((r, idx) => {
        // 1. Bersihkan Data
        let valStr = String(r['TONASE']).replace(/\./g, '').replace(/,/g, '.');
        let val = parseFloat(valStr) || 0;
        let tahun = parseInt(r['TAHUN']);
        let sektor = String(r['SEKTOR'] || '').toUpperCase();
        let jenis = String(r['JENIS'] || '').toUpperCase();
        let produk = String(r['PRODUK'] || '').toUpperCase();

        // 2. Cek Filter (Kita log 3 baris pertama saja)
        let isTahun = (tahun === selectedYear);
        let isSektor = sektor.includes('SUBSIDI');
        let isJenis = jenis.includes('REALISASI') || jenis.includes('PENJUALAN');
        
        if (idx < 3) {
            screenLog(`Baris ${idx+1}: Tahun=${tahun}(${isTahun}), Sektor=${sektor}(${isSektor}), Jenis=${jenis}(${isJenis}), Produk=${produk}, Tonase=${val}`);
        }

        // 3. Hitung
        if (isTahun && isSektor && isJenis) {
            countLolos++;
            if (produk.includes('UREA')) totalUrea += val;
            else if (produk.includes('NPK')) totalNPK += val;
        }
    });

    screenLog(`--- HASIL AKHIR ---`);
    screenLog(`Data Lolos Filter: ${countLolos}`);
    screenLog(`Total UREA: ${totalUrea}`);
    screenLog(`Total NPK: ${totalNPK}`);

    // --- UPDATE UI ---
    try {
        if(document.getElementById('val-urea')) document.getElementById('val-urea').innerText = new Intl.NumberFormat('id-ID').format(totalUrea);
        if(document.getElementById('val-npk')) document.getElementById('val-npk').innerText = new Intl.NumberFormat('id-ID').format(totalNPK);
        screenLog("UI Updated.");
    } catch (e) {
        screenLog("❌ UI UPDATE ERROR: " + e.message);
    }
}

// ... Fungsi Helper Lainnya (kosongkan dulu biar simple) ...
function setSector(s) {} 
function openLoginModal() {}
