let mgChart;
const historyLimit = 20;
let mgHistory = [];
let lastSolar = 0;
let lastLoad = 0;
let isAlertActive = false;

function initMgChart() {
    const ctx = document.getElementById('mgChart').getContext('2d');
    mgChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(historyLimit).fill(''),
            datasets: [{
                label: 'Баланс (кВт)',
                data: Array(historyLimit).fill(0),
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { display: false } }
        }
    });
}

function addLog(message) {
    const logDiv = document.getElementById('mg-log');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.innerHTML = `<span class="text-secondary">[${time}]</span> > ${message}`;
    logDiv.prepend(entry);
    if (logDiv.childNodes.length > 50) logDiv.lastChild.remove();
}

async function fetchMicrogrid() {
    const simSolar = document.getElementById('sim-solar').value;
    const simLoad = document.getElementById('sim-load').value;

    if (Math.abs(simSolar - lastSolar) > 10) {
        addLog(`Користувач змінив інтенсивність генерації: ${simSolar} кВт`);
        lastSolar = simSolar;
    }
    if (Math.abs(simLoad - lastLoad) > 10) {
        addLog(`Зміна навантаження об'єкта: ${simLoad} кВт`);
        lastLoad = simLoad;
    }

    try {
        const response = await fetch(`/api/microgrid/current?solar=${simSolar}&load=${simLoad}`);
        const data = await response.json();

        document.getElementById('mg-total-gen').textContent = `${data.totalGeneration} кВт`;
        document.getElementById('mg-load').textContent = `${data.load.toFixed(1)} кВт`;
        document.getElementById('mg-battery').textContent = `${data.battery.toFixed(0)}%`;

        const exVal = parseFloat(data.balance);
        const exchangeEl = document.getElementById('mg-exchange');
        exchangeEl.textContent = `${exVal > 0 ? '+' : ''}${exVal} кВт`;
        exchangeEl.className = exVal >= 0 ? 'display-6 fw-bold text-success' : 'display-6 fw-bold text-danger';

        const root = document.documentElement;
        const lineLoad = document.getElementById('line-load');

        let powerFactor = parseFloat(data.totalGeneration) / 100;
        let newSpeed = Math.max(0.2, 3 - powerFactor);
        root.style.setProperty('--flow-speed', `${newSpeed}s`);

        if (exVal < 0) {
            lineLoad.classList.add('flow-danger');
        } else {
            lineLoad.classList.remove('flow-danger');
        }

        if (parseFloat(data.load) > parseFloat(data.totalGeneration) * 1.5) {
            if (!isAlertActive) {
                isAlertActive = true;
                Swal.fire({
                    title: 'Критичне перевантаження!',
                    text: `Навантаження (${data.load} кВт) перевищує генерацію на 50%!`,
                    icon: 'error',
                    confirmButtonText: 'Прийнято',
                    confirmButtonColor: '#e74c3c'
                }).then(() => { isAlertActive = false; });
            }
            addLog("<span class='text-danger'>КРИТИЧНА ПОМИЛКА: Перевантаження мережі!</span>");
        }

        if (exVal < -50 && !isAlertActive && parseFloat(data.load) <= parseFloat(data.totalGeneration) * 1.5) {
            addLog("<span class='text-danger'>Увага: Дефіцит потужності! Задіяно зовнішню мережу.</span>");
        }

        if (data.battery > 98) addLog("<span class='text-success'>Акумуляторний стек повністю заряджений.</span>");

        mgChart.data.datasets[0].data.push(exVal);
        mgChart.data.datasets[0].data.shift();
        mgChart.update('none');

        mgHistory.push({ time: new Date().toLocaleTimeString(), val: exVal });
        if (mgHistory.length > 100) mgHistory.shift();

    } catch (err) {
        console.error("Microgrid API error:", err);
    }
}

function exportToCSV() {
    let csv = "Time,Balance(kW)\n" + mgHistory.map(row => `${row.time},${row.val}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'microgrid_report.csv';
    a.click();
    addLog("Формування звіту завершено. Файл збережено.");
}

document.addEventListener('DOMContentLoaded', () => {
    initMgChart();
    setInterval(fetchMicrogrid, 3000);
    addLog("Ядро системи Microgrid v1.0 завантажено.");
});