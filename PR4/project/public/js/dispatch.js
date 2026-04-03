let balanceHistory = Array(20).fill(0);
let trendChart;

function initTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                label: 'Живий тренд балансу (МВт)',
                data: balanceHistory,
                borderColor: '#0062ff',
                backgroundColor: 'rgba(0, 98, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { display: false }
            },
            animation: { duration: 1000 }
        }
    });
}

async function updateDispatchData() {
    try {
        const resCenter = await fetch('/api/dispatch-center');
        const data = await resCenter.json();

        document.getElementById('dc-name').textContent = data.name;
        document.getElementById('dc-freq').textContent = data.frequency + " Гц";
        document.getElementById('dc-alarms').textContent = data.alarmCount;

        const resBalance = await fetch('/api/dispatch-center/balance');
        const balanceData = await resBalance.json();

        const balanceEl = document.getElementById('dc-balance');
        const balanceValue = balanceData.balance;

        balanceEl.textContent = (balanceValue > 0 ? "+" : "") + balanceValue + " МВт";
        balanceEl.className = balanceValue >= 0
            ? "display-6 fw-bold text-success"
            : "display-6 fw-bold text-danger";

        document.getElementById('dc-gen').textContent = balanceData.generation + " МВт";

        let percent = 0;
        if (balanceData.generation > 0) {
            percent = (balanceData.load / balanceData.generation) * 100;
        }
        document.getElementById('gen-bar').style.width = Math.min(percent, 100) + "%";

        balanceHistory.push(balanceValue);
        balanceHistory.shift();
        if (trendChart) trendChart.update('none');

    } catch (e) {
        console.error("API error:", e);
    }
}

async function sendCommand(cmd) {
    const targetId = document.getElementById('object-select').value;
    try {
        const res = await fetch('/api/dispatch-center/commands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: cmd,
                targetId: parseInt(targetId)
            })
        });

        if (res.ok) {
            await updateDispatchData();
        }
    } catch (e) {
        console.error("Server error:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTrendChart();
    updateDispatchData();
    setInterval(updateDispatchData, 5000);
});