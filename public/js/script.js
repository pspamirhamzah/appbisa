Chart.defaults.color = '#737373';
Chart.defaults.borderColor = '#333333';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.font.size = 11;

const app = (() => {
    const API_URL = 'https://script.google.com/macros/s/AKfycbzFanoakpPL3NaMh8CqbolDF5wo9iVb6ikIKQavQh15aGJYBCj7rGQdWyE3sMC911wxdA/exec';
    
    let state = {
        rawData: [],
        sector: 'SUBSIDI',      
        activeProduct: 'UREA',  
        selectedYear: new Date().getFullYear(),
        sidebarOpen: true
    };

    let chartNasional = null;
    let chartProvinsi = null;

    // --- UTILS ---
    const parseIndoNumber = (str) => {
        if(typeof str === 'number') return str;
        if(!str) return 0;
        let clean = String(str).replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(clean) || 0;
    };

    const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(Math.round(num));

    const normalizeMonth = (str) => {
        const map = {'JAN':0, 'JANUARI':0, 'FEB':1, 'FEBRUARI':1, 'MAR':2, 'MARET':2, 'APR':3, 'APRIL':3, 'MEI':4, 'MAY':4, 'JUN':5, 'JUNI':5, 'JUL':6, 'JULI':6, 'AGU':7, 'AGUSTUS':7, 'SEP':8, 'SEPTEMBER':8, 'OKT':9, 'OKTOBER':9, 'NOV':10, 'NOVEMBER':10, 'DES':11, 'DESEMBER':11};
        return map[String(str).toUpperCase().trim()] ?? -1;
    };
    
    const toTitleCase = (str) => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    
    const hexToRgbA = (hex, alpha) => {
        let c; if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){ c= hex.substring(1).split(''); if(c.length== 3){ c= [c[0], c[0], c[1], c[1], c[2], c[2]]; } c= '0x'+c.join(''); return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')'; } return hex;
    }

    // --- INIT & LOAD ---
    const init = () => { fetchData(); checkScreenSize(); };

    const checkScreenSize = () => {
        state.sidebarOpen = window.innerWidth > 768;
        renderSidebar();
    };

    const fetchData = async () => {
        document.getElementById('loader').style.display = 'flex';
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            processData(data);
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Gagal memuat data dari API.");
        } finally {
            document.getElementById('loader').style.display = 'none';
        }
    };

    const processData = (data) => {
        state.rawData = data.map(row => ({
            TAHUN: parseInt(row.TAHUN),
            BULAN: normalizeMonth(row.BULAN),
            SEKTOR: String(row.SEKTOR || '').toUpperCase(),
            PRODUK: String(row.PRODUK || '').toUpperCase(),
            JENIS: String(row.JENIS || '').toUpperCase(),
            PROVINSI: toTitleCase(String(row.PROVINSI || '')),
            TONASE: parseIndoNumber(row.TONASE)
        }));

        const years = [...new Set(state.rawData.map(r => r.TAHUN))].sort((a,b) => b-a);
        const yearSel = document.getElementById('year-select');
        yearSel.innerHTML = '';
        years.forEach(y => {
            let opt = document.createElement('option');
            opt.value = y; opt.text = y;
            if(y === state.selectedYear) opt.selected = true;
            yearSel.appendChild(opt);
        });
        
        updateDashboard(); 
    };

    const populateProvDropdown = (provKeys) => {
        const s = document.getElementById('dropdown-provinsi');
        const prevVal = s.value; 
        s.innerHTML = '';

        const sortedProvs = provKeys.filter(p => p && p !== 'Lainnya' && p !== 'LAINNYA').sort();
        
        if(sortedProvs.length === 0) {
            s.innerHTML = '<option>Tidak ada data</option>';
            return;
        }

        sortedProvs.forEach(prov => {
            let opt = document.createElement('option');
            opt.value = prov; opt.innerText = prov;
            s.appendChild(opt);
        });
        
        if (prevVal && sortedProvs.includes(prevVal)) s.value = prevVal;
    };

    // --- DASHBOARD LOGIC ---
    const updateDashboard = () => {
        const { rawData, selectedYear, sector, activeProduct } = state;
        
        let kpiStats = {
            curr: { UREA: {real:0, target:0}, NPK: {real:0, target:0} },
            prev: { UREA: {real:0}, NPK: {real:0} },
            nasional: { 
                UREA: {real:Array(12).fill(0), target:Array(12).fill(0), stock:Array(12).fill(0)}, 
                NPK: {real:Array(12).fill(0), target:Array(12).fill(0), stock:Array(12).fill(0)} 
            }
        };

        let rankStats = {}; 
        let dropdownProvs = new Set();

        rawData.forEach(r => {
            let isSectorMatch = (sector === 'SUBSIDI') ? r.SEKTOR.includes('SUBSIDI') : r.SEKTOR.includes('RETAIL');
            if (!isSectorMatch) return;

            let prodKey = '';
            if (r.PRODUK.includes('UREA') || r.PRODUK.includes('NITREA')) prodKey = 'UREA';
            else if (r.PRODUK.includes('NPK') || r.PRODUK.includes('PHONSKA')) prodKey = 'NPK';
            if (!prodKey) return;

            let isReal = r.JENIS.includes('REALISASI') || r.JENIS.includes('PENJUALAN');
            let isTarget = r.JENIS.includes('RKAP') || r.JENIS.includes('TARGET') || r.JENIS.includes('RKO');
            let isStock = r.JENIS.includes('STOK') || r.JENIS.includes('STOCK') || r.JENIS.includes('PERSEDIAAN') || r.JENIS.includes('AKTUAL');

            if (r.TAHUN === selectedYear) {
                if (isReal) {
                    kpiStats.curr[prodKey].real += r.TONASE;
                    if(r.BULAN >= 0) kpiStats.nasional[prodKey].real[r.BULAN] += r.TONASE;
                } else if (isTarget) {
                    kpiStats.curr[prodKey].target += r.TONASE;
                    if(r.BULAN >= 0) kpiStats.nasional[prodKey].target[r.BULAN] += r.TONASE;
                } else if (isStock) {
                    if(r.BULAN >= 0) kpiStats.nasional[prodKey].stock[r.BULAN] += r.TONASE;
                }
            }
            
            if (r.TAHUN === (selectedYear - 1) && isReal) {
                kpiStats.prev[prodKey].real += r.TONASE;
            }

            if (prodKey === activeProduct && r.TAHUN === selectedYear) {
                if (r.PROVINSI && r.PROVINSI !== 'Lainnya') {
                    dropdownProvs.add(r.PROVINSI);
                    if (!rankStats[r.PROVINSI]) rankStats[r.PROVINSI] = { real: 0, target: 0 };
                    if (isReal) rankStats[r.PROVINSI].real += r.TONASE;
                    if (isTarget) rankStats[r.PROVINSI].target += r.TONASE;
                }
            }
        });

        populateProvDropdown([...dropdownProvs]);
        renderKPI(kpiStats);
        renderRankings(rankStats);
        renderNasionalChart(kpiStats.nasional);
        renderProvChart(); 
    };

    const renderKPI = (stats) => {
        ['UREA', 'NPK'].forEach(key => {
            const real = stats.curr[key].real;
            const target = stats.curr[key].target;
            const prev = stats.prev[key].real;
            const pct = target > 0 ? (real/target*100) : 0;
            
            document.getElementById(`val-${key.toLowerCase()}-real`).innerText = formatNumber(real);
            document.getElementById(`val-${key.toLowerCase()}-target`).innerText = formatNumber(target);
            document.getElementById(`val-${key.toLowerCase()}-pct`).innerText = pct.toFixed(1) + '%';
            document.getElementById(`prog-${key.toLowerCase()}`).style.width = Math.min(pct, 100) + '%';

            let growthVal = 0;
            if(prev > 0) {
                growthVal = ((real - prev) / prev) * 100;
            } else if (real > 0) {
                growthVal = 100;
            }

            const badge = document.getElementById(`growth-${key.toLowerCase()}-badge`);
            document.getElementById(`growth-${key.toLowerCase()}-val`).innerText = Math.abs(growthVal).toFixed(1) + '%';
            badge.className = `growth-badge ${growthVal >= 0 ? 'growth-up' : 'growth-down'}`;
            badge.innerHTML = `<i class="fas fa-arrow-${growthVal >= 0 ? 'up' : 'down'}"></i> ${Math.abs(growthVal).toFixed(1)}%`;
        });
    };

    const renderRankings = (provData) => {
        let arr = Object.keys(provData).map(key => {
            const item = provData[key];
            let sortVal = state.sector === 'SUBSIDI' 
                ? (item.target > 0 ? (item.real / item.target) * 100 : 0)
                : item.real;
            
            return { 
                name: key, 
                val: sortVal, 
                display: state.sector === 'SUBSIDI' ? sortVal.toFixed(1) + '%' : formatNumber(item.real),
                rawReal: item.real 
            };
        }).filter(i => i.rawReal > 0).sort((a,b) => b.val - a.val);

        // Render Top 5
        const listTop5 = document.getElementById('list-top5');
        listTop5.innerHTML = arr.length > 0 
            ? arr.slice(0, 5).map((item, i) => `
                <div class="rank-item">
                    <div class="rank-left">
                        <div class="rank-num best">${i+1}</div>
                        <div class="rank-name">${item.name}</div>
                    </div>
                    <div class="rank-val val-best">${item.display}</div>
                </div>`).join('')
            : '<div style="padding:20px; text-align:center; color:gray;">Tidak ada data</div>';

        // Render Bottom 5
        const listOthers = document.getElementById('list-others');
        if(arr.length > 0) {
            const bottomCount = Math.min(arr.length > 5 ? 5 : arr.length, 5);
            const bottomData = arr.slice(-bottomCount).reverse();
            listOthers.innerHTML = bottomData.map(item => `
                <div class="rank-item">
                    <div class="rank-left">
                        <div class="rank-num warn">#${arr.indexOf(item) + 1}</div>
                        <div class="rank-name">${item.name}</div>
                    </div>
                    <div class="rank-val val-warn">${item.display}</div>
                </div>`).join('');
        } else {
            listOthers.innerHTML = '<div style="padding:20px; text-align:center; color:gray;">Tidak ada data</div>';
        }
    };

    const getChartOptions = () => ({
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true } },
            tooltip: {
                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                padding: 12,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)} Ton`
                }
            }
        },
        scales: {
            y: { grid: { color: '#262626' }, ticks: { callback: (v) => v >= 1000 ? (v/1000)+'k' : v } },
            x: { grid: { display: false } }
        }
    });

    const renderNasionalChart = (nasStats) => {
        const ctx = document.getElementById('chartNasional').getContext('2d');
        if(chartNasional) chartNasional.destroy();

        const color = state.activeProduct === 'UREA' ? '#fbbf24' : '#38bdf8';
        const data = state.activeProduct === 'UREA' ? nasStats.UREA : nasStats.NPK;
        
        const grad = ctx.createLinearGradient(0, 0, 0, 300);
        grad.addColorStop(0, hexToRgbA(color, 0.3)); grad.addColorStop(1, 'transparent');

        chartNasional = new Chart(ctx, {
            data: {
                labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
                datasets: [
                    { type: 'line', label: 'Realisasi', data: data.real, borderColor: color, backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4 },
                    { type: 'line', label: 'Target', data: data.target, borderColor: '#f87171', borderDash: [5,5], borderWidth: 2, pointRadius: 0, tension: 0.4 },
                    { type: 'bar', label: 'Stok', data: data.stock, backgroundColor: '#444', barPercentage: 0.5 }
                ]
            },
            options: getChartOptions()
        });
    };

    const renderProvChart = () => {
        const provName = document.getElementById('dropdown-provinsi').value;
        const ctx = document.getElementById('chartProvinsi').getContext('2d');
        if(chartProvinsi) chartProvinsi.destroy();

        if(!provName || provName === 'Tidak ada data') {
            document.getElementById('prov-placeholder').style.display = 'flex';
            return;
        }
        document.getElementById('prov-placeholder').style.display = 'none';

        let mReal = Array(12).fill(0), mTarget = Array(12).fill(0), mStock = Array(12).fill(0);
        state.rawData.forEach(r => {
            if (r.TAHUN === state.selectedYear && r.PROVINSI === provName) {
                let isSectorMatch = (state.sector === 'SUBSIDI') ? r.SEKTOR.includes('SUBSIDI') : r.SEKTOR.includes('RETAIL');
                let prodKey = (r.PRODUK.includes('UREA') || r.PRODUK.includes('NITREA')) ? 'UREA' : (r.PRODUK.includes('NPK') || r.PRODUK.includes('PHONSKA')) ? 'NPK' : '';
                
                if (isSectorMatch && prodKey === state.activeProduct && r.BULAN >= 0) {
                    if (r.JENIS.includes('REALISASI') || r.JENIS.includes('PENJUALAN')) mReal[r.BULAN] += r.TONASE;
                    else if (r.JENIS.includes('RKAP') || r.JENIS.includes('TARGET')) mTarget[r.BULAN] += r.TONASE;
                    else if (r.JENIS.includes('STOK') || r.JENIS.includes('STOCK')) mStock[r.BULAN] += r.TONASE;
                }
            }
        });

        const color = state.activeProduct === 'UREA' ? '#fbbf24' : '#38bdf8';
        chartProvinsi = new Chart(ctx, {
            data: {
                labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
                datasets: [
                    { type: 'line', label: 'Realisasi', data: mReal, borderColor: color, tension: 0.4, borderWidth: 3 },
                    { type: 'line', label: 'Target', data: mTarget, borderColor: '#f87171', borderDash: [5,5], pointRadius: 0 },
                    { type: 'bar', label: 'Stok', data: mStock, backgroundColor: '#444', barPercentage: 0.5 }
                ]
            },
            options: getChartOptions()
        });
    };

    const renderSidebar = () => {
        const sb = document.getElementById('sidebar');
        const main = document.getElementById('main-content');
        if (state.sidebarOpen) {
            sb.classList.remove('closed'); main.classList.remove('closed');
        } else {
            sb.classList.add('closed'); main.classList.add('closed');
        }
    };

    return {
        init,
        toggleSidebar: () => { state.sidebarOpen = !state.sidebarOpen; renderSidebar(); },
        setSector: (sec) => {
            state.sector = sec;
            document.getElementById('nav-subsidi').classList.toggle('active', sec === 'SUBSIDI');
            document.getElementById('nav-retail').classList.toggle('active', sec === 'RETAIL');
            document.getElementById('page-title-text').innerText = sec === 'SUBSIDI' ? 'Subsidi' : 'Retail';
            updateDashboard();
            if(window.innerWidth <= 768) { state.sidebarOpen = false; renderSidebar(); }
        },
        changeYear: (val) => { state.selectedYear = parseInt(val); updateDashboard(); },
        setChartProduct: (prod) => {
            state.activeProduct = prod;
            document.getElementById('btn-nas-urea').classList.toggle('active', prod === 'UREA');
            document.getElementById('btn-nas-npk').classList.toggle('active', prod === 'NPK');
            updateDashboard();
        },
        renderProvChart
    };
})();

window.onload = app.init;
