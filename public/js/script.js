Chart.defaults.color = '#b3b3b3';
Chart.defaults.borderColor = '#424242';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

const app = (() => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec';
    let state = { rawData: [], sector: 'SUBSIDI', activeProduct: 'UREA', selectedYear: new Date().getFullYear(), sidebarOpen: true };
    let chartNasional = null; let chartProvinsi = null;

    const parseIndoNumber = (str) => {
        if(typeof str === 'number') return str;
        if(!str) return 0;
        return parseFloat(String(str).replace(/\./g, '').replace(/,/g, '.')) || 0;
    };

    const fetchData = async () => {
        document.getElementById('loader').style.display = 'flex';
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            state.rawData = data.map(row => ({
                TAHUN: parseInt(row.TAHUN),
                BULAN: normalizeMonth(row.BULAN),
                SEKTOR: String(row.SEKTOR || '').toUpperCase(),
                PRODUK: String(row.PRODUK || '').toUpperCase(),
                JENIS: String(row.JENIS || '').toUpperCase(),
                PROVINSI: String(row.PROVINSI || ''),
                TONASE: parseIndoNumber(row.TONASE)
            }));
            updateDashboard();
        } catch (err) { console.error(err); }
        finally { document.getElementById('loader').style.display = 'none'; }
    };

    const normalizeMonth = (str) => {
        const map = {'JAN':0,'FEB':1,'MAR':2,'APR':3,'MEI':4,'JUN':5,'JUL':6,'AGU':7,'SEP':8,'OKT':9,'NOV':10,'DES':11};
        return map[String(str).substring(0,3).toUpperCase()] ?? -1;
    };

    const updateDashboard = () => {
        const { rawData, selectedYear, sector, activeProduct } = state;
        let kpi = { curr: {UREA:{real:0,target:0}, NPK:{real:0,target:0}}, prev: {UREA:0,NPK:0}, nas: {UREA:{r:Array(12).fill(0),t:Array(12).fill(0),s:Array(12).fill(0)}, NPK:{r:Array(12).fill(0),t:Array(12).fill(0),s:Array(12).fill(0)}} };
        let ranks = {}; let provs = new Set();

        rawData.forEach(r => {
            const isSector = sector === 'SUBSIDI' ? (r.SEKTOR.includes('SUBSIDI') || r.SEKTOR.includes('PSO')) : (r.SEKTOR.includes('RETAIL') || r.SEKTOR.includes('NON'));
            if (!isSector) return;

            const pKey = r.PRODUK.includes('UREA') ? 'UREA' : r.PRODUK.includes('NPK') ? 'NPK' : '';
            if (!pKey) return;

            const isR = r.JENIS.includes('REAL'); const isT = r.JENIS.includes('RKAP') || r.JENIS.includes('TARGET'); const isS = r.JENIS.includes('STOK');

            if (r.TAHUN === selectedYear) {
                if(isR) { kpi.curr[pKey].real += r.TONASE; if(r.BULAN>=0) kpi.nas[pKey].r[r.BULAN]+=r.TONASE; }
                else if(isT) { kpi.curr[pKey].target += r.TONASE; if(r.BULAN>=0) kpi.nas[pKey].t[r.BULAN]+=r.TONASE; }
                else if(isS && r.BULAN>=0) kpi.nas[pKey].s[r.BULAN]+=r.TONASE;
                
                if(pKey === activeProduct && r.PROVINSI) {
                    provs.add(r.PROVINSI);
                    if(!ranks[r.PROVINSI]) ranks[r.PROVINSI] = {real:0,target:0};
                    if(isR) ranks[r.PROVINSI].real += r.TONASE; if(isT) ranks[r.PROVINSI].target += r.TONASE;
                }
            }
            if (r.TAHUN === selectedYear - 1 && isR) kpi.prev[pKey] += r.TONASE;
        });

        renderKPI(kpi);
        renderRankings(ranks);
        renderNasionalChart(kpi.nas);
    };

    const renderKPI = (k) => {
        ['UREA','NPK'].forEach(p => {
            const real = k.curr[p].real; const tar = k.curr[p].target; const prev = k.prev[p];
            const pct = tar > 0 ? (real/tar*100).toFixed(1) : 0;
            document.getElementById(`val-${p.toLowerCase()}-real`).innerText = new Intl.NumberFormat('id-ID').format(real);
            document.getElementById(`val-${p.toLowerCase()}-target`).innerText = new Intl.NumberFormat('id-ID').format(tar);
            document.getElementById(`val-${p.toLowerCase()}-pct`).innerText = pct + '%';
            document.getElementById(`prog-${p.toLowerCase()}`).style.width = Math.min(pct, 100) + '%';
            
            let growth = prev > 0 ? ((real-prev)/prev*100).toFixed(1) : 100;
            document.getElementById(`growth-${p.toLowerCase()}-val`).innerText = growth + '%';
        });
    };

    const renderRankings = (data) => {
        let arr = Object.keys(data).map(k => ({name:k, val: state.sector==='SUBSIDI' ? (data[k].target>0?(data[k].real/data[k].target*100):0) : data[k].real}));
        arr.sort((a,b) => b.val - a.val);
        const format = (v) => state.sector === 'SUBSIDI' ? v.toFixed(1)+'%' : new Intl.NumberFormat('id-ID').format(v);
        
        document.getElementById('list-top5').innerHTML = arr.slice(0,5).map((item,i)=>`<div class="rank-item"><div class="rank-left"><div class="rank-num">#${i+1}</div><div class="rank-name">${item.name}</div></div><div class="rank-val">${format(item.val)}</div></div>`).join('');
        document.getElementById('list-others').innerHTML = arr.slice(-5).reverse().map((item)=>`<div class="rank-item"><div class="rank-left"><div class="rank-num">#${arr.indexOf(item)+1}</div><div class="rank-name">${item.name}</div></div><div class="rank-val" style="color:var(--color-danger)">${format(item.val)}</div></div>`).join('');
    };

    const renderNasionalChart = (nas) => {
        const ctx = document.getElementById('chartNasional').getContext('2d');
        if(chartNasional) chartNasional.destroy();
        const data = state.activeProduct === 'UREA' ? nas.UREA : nas.NPK;
        const color = state.activeProduct === 'UREA' ? '#fbbf24' : '#38bdf8';
        
        chartNasional = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
                datasets: [
                    { label: 'Realisasi', data: data.r, borderColor: color, tension: 0.4, pointStyle: 'rect' },
                    { label: 'Target', data: data.t, borderColor: '#ff5252', borderDash: [5,5], tension: 0.4, pointStyle: 'rect' },
                    { label: 'Stok', data: data.s, type: 'bar', backgroundColor: '#4b5563', pointStyle: 'rect' }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { usePointStyle: true } } }
            }
        });
    };

    return {
        init: () => { fetchData(); },
        toggleSidebar: () => { state.sidebarOpen = !state.sidebarOpen; document.getElementById('sidebar').classList.toggle('closed'); document.getElementById('main-content').classList.toggle('closed'); },
        setSector: (s) => { state.sector = s; updateDashboard(); },
        setChartProduct: (p) => { state.activeProduct = p; updateDashboard(); }
    };
})();
window.onload = app.init;
