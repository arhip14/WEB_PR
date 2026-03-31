AOS.init({ duration: 1000, once: true });

const params = [
    { name: "Вироблення біогазу", unit: "м³/год", min: 20, max: 80, normal: [40, 70] },
    { name: "Вміст метану", unit: "%", min: 55, max: 70, normal: [60, 68] },
    { name: "Температура реактора", unit: "°C", min: 35, max: 55, normal: [38, 45] },
    { name: "Вихідна електрична потужність", unit: "кВт", min: 0, max: 300, normal: [100, 250] },
    { name: "Рівень субстрату", unit: "%", min: 30, max: 100, normal: [50, 90] },
    { name: "pH середовища", unit: "", min: 6, max: 9, normal: [6.8, 7.5] },
    { name: "Час роботи установки", unit: "год", min: 0, max: 8760, normal: [0, 8760] }
];

let autoInterval = null;
let isAutoEnabled = false;
const dashboard = document.getElementById('monitoringDashboard');

function createDashboard() {
    dashboard.innerHTML = '';
    params.forEach((param, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('id', 'card' + idx);
        card.innerHTML = `
            <h5>${param.name}</h5>
            <div class="big-number" id="param${idx}">0</div>
            <div class="unit">${param.unit}</div>
            <div class="status-indicator status-normal" id="status${idx}">✔️</div>
        `;
        dashboard.appendChild(card);
        setTimeout(() => card.classList.add('show'), idx*200); // вау-анімація
    });
}

function getRandom(min, max, decimals = 1) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getStatus(value, param) {
    if (value >= param.normal[0] && value <= param.normal[1]) return 'normal';
    if (value >= param.min && value <= param.max) return 'warning';
    return 'danger';
}

function updateParameter(idx, value, param) {
    const numberEl = document.getElementById('param' + idx);
    const indicator = document.getElementById('status' + idx);
    numberEl.textContent = value;
    const status = getStatus(value, param);
    indicator.className = 'status-indicator status-' + status;
    if(status==='danger') {
        indicator.animate([{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 500 });
    }
}

function updateAll() {
    params.forEach((param, idx) => {
        const decimals = param.unit.includes('°') || param.unit.includes('%') ? 1 : 0;
        const value = getRandom(param.min, param.max, decimals);
        updateParameter(idx, value, param);
        chart.data.datasets[idx].data.push(value);
        if(chart.data.datasets[idx].data.length>20) chart.data.datasets[idx].data.shift();
    });
    chart.update();
}

function toggleAuto() {
    const btn = document.getElementById('autoUpdateBtn');
    const status = document.getElementById('autoStatus');
    if(!isAutoEnabled){
        autoInterval = setInterval(updateAll, 3000);
        isAutoEnabled = true;
        btn.textContent='⏸️ Зупинити';
        btn.className='btn btn-danger';
        status.textContent='Увімкнено (3 сек)';
    } else {
        clearInterval(autoInterval);
        isAutoEnabled=false;
        btn.textContent='▶️ Автооновлення';
        btn.className='btn btn-success';
        status.textContent='Вимкнено';
    }
}

const ctx = document.getElementById('monitoringChart').getContext('2d');
const chart = new Chart(ctx,{
    type:'line',
    data:{
        labels:Array(20).fill(''),
        datasets: params.map((p,i)=>({
            label:p.name,
            data:Array(20).fill(0),
            borderColor:`hsl(${i*45},70%,50%)`,
            backgroundColor:`hsla(${i*45},70%,50%,0.2)`,
            tension:0.3
        }))
    },
    options:{
        responsive:true,
        plugins:{ legend:{ position:'top' } },
        animation:{ duration:800 }
    }
});

document.addEventListener('DOMContentLoaded', ()=>{
    createDashboard();
    updateAll();
    document.getElementById('updateBtn').addEventListener('click', updateAll);
    document.getElementById('autoUpdateBtn').addEventListener('click', toggleAuto);
});