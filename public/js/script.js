/* =================================================
   DASHBOARD SCRIPT – FINAL STABLE (DATA AKTIF)
   ================================================= */

/* ---------- CONFIG ---------- */
const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec';

const CACHE_KEY = 'dashboard_cache_v2';
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

/* ---------- STATE ---------- */
const state = {
    rawData: [],
    sector: 'SUBSIDI',
    activeProduct: 'UREA',
    selectedYear: new Date().getFullYear(),
    sidebarOpen: true
};

let chartNasional = null;
let chartProvinsi = null;
let loaderTimeout = null;

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

/* ---------- LOADER ---------- */
const showLoader = () => {
    const l = $('loader');
    if (l) l.style.display = 'flex';
    loaderTimeout = setTimeout(hideLoader, 15000);
};

const hideLoader = () => {
    clearTimeout(loaderTimeout);
    const l = $('loader');
    if (l) l.style.display = 'none';
};

/* ---------- CACHE ---------- */
const loadCache = () => {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (!c) return null;
        if (Date.now() - c.time > CACHE_TTL) return null;
        return c.data;
    } catch {
        return null;
    }
};

const saveCache = (data) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        time: Date.now(),
        data
    }));
};

/* ---------- HELPERS ---------- */
const safeDestroy = (chart) => {
    if (chart && typeof chart.destroy === 'function') chart.destroy();
};

const parseIndoNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
};

const normalizeMonth = (str) => {
    const m = {
        JAN:0, JANUARI:0, FEB:1, FEBRUARI:1, MAR:2, MARET:2,
        APR:3, APRIL:3, MEI:4, JUN:5, JUNI:5,
        JUL:6, JULI:6, AGU:7, AGUSTUS:7,
        SEP:8, SEPTEMBER:8, OKT:9, OKTOBER:9,
        NOV:10, NOVEMBER:10, DES:11, DESEMBER:11
    };
    return m[String(str).toUpperCase().trim()] ?? -1;
};

const toTitleCase = (s) =>
    s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());

/* ---------- INIT ---------- */
const init = () => {
    if (window.Chart) {
        Chart.defaults.color = '#b3b3b3';
        Chart.defaults.borderColor = '#424242';
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
        Chart.defaults.font.size = 11;
    }

    checkScreenSize();
    fetchData();
};

/* ---------- RESPONSIVE ---------- */
const checkScreenSize = () => {
    state.sidebarOpen = window.innerWidth > 768;
    renderSidebar();
};

window.addEventListener('resize', () => {
    clearTimeout(window.__rs);
    window.__rs = setTimeout(checkScreenSize, 300);
});

/* ---------- FETCH ---------- */
const fetchData = async () => {
    const cached = loadCache();
    if (cached) {
        processData(cached);
        return;
    }

    showLoader();
    try {
        const res = await fetch(API_URL, { cache: 'no-store' });
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data || [];
        saveCache(data);
        processData(data);
    } catch (e) {
        console.error(e);
        alert('Gagal memuat data');
    } finally {
        hideLoader();
    }
};

/* ---------- PROCESS ---------- */
const processData = (data) => {
    if (!Array.isArray(data)) return;

    state.rawData = data.map(r => ({
        TAHUN: +r.TAHUN,
        BULAN: normalizeMonth(r.BULAN),
        SEKTOR: String(r.SEKTOR || '').toUpperCase(),
        PRODUK: String(r.PRODUK || '').toUpperCase(),
        PROVINSI: toTitleCase(String(r.PROVINSI || '')),
        TONASE: parseIndoNumber(r.TONASE)
    }));

    const years = [...new Set(state.rawData.map(r => r.TAHUN))].sort((a,b)=>b-a);
    const ys = $('year-select');
    if (ys) {
        ys.innerHTML = '';
        years.forEach(y => {
            const o = document.createElement('option');
            o.value = y;
            o.textContent = y;
            ys.appendChild(o);
        });
        state.selectedYear = years[0];
        ys.value = state.selectedYear;
    }

    updateDashboard();
};

/* ---------- AGGREGATION ---------- */
const aggregateNasionalBulanan = () => {
    const result = Array(12).fill(0);

    state.rawData
        .filter(r =>
            r.TAHUN === state.selectedYear &&
            r.SEKTOR.includes(state.sector) &&
            r.PRODUK === state.activeProduct &&
            r.BULAN >= 0
        )
        .forEach(r => {
            result[r.BULAN] += r.TONASE;
        });

    return result;
};

/* ---------- DASHBOARD ---------- */
const updateDashboard = () => {
    renderNasionalChart();
};

/* ---------- CHART OPTIONS ---------- */
const chartOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { usePointStyle: true } } },
    scales: { y: { beginAtZero: true } }
});

/* ---------- NASIONAL CHART (AKTIF DATA) ---------- */
const renderNasionalChart = () => {
    const c = $('chartNasional');
    if (!c) return;

    safeDestroy(chartNasional);

    const dataBulanan = aggregateNasionalBulanan();

    chartNasional = new Chart(c, {
        type: 'line',
        data: {
            labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
            datasets: [{
                label: `${state.activeProduct} ${state.selectedYear}`,
                data: dataBulanan,
                borderColor: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions()
    });
};

/* ---------- SIDEBAR ---------- */
const renderSidebar = () => {
    const sb = $('sidebar');
    const mc = $('main-content');
    if (!sb || !mc) return;

    sb.classList.toggle('closed', !state.sidebarOpen);
    mc.classList.toggle('closed', !state.sidebarOpen);
};

/* ---------- PUBLIC API ---------- */
window.app = {
    toggleSidebar: () => {
        state.sidebarOpen = !state.sidebarOpen;
        renderSidebar();
    },
    setSector: (s) => {
        state.sector = s;
        updateDashboard();
    },
    setChartProduct: (p) => {
        state.activeProduct = p;
        updateDashboard();
    },
    changeYear: (y) => {
        state.selectedYear = +y;
        updateDashboard();
    }
};

window.addEventListener('load', init);

