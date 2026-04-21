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
        // 1. Отримуємо основні дані центру
        const resCenter = await fetch('/api/dispatch-center');

        // Перевірка на авторизацію (якщо сервер повернув 401 або перенаправлення)
        if (resCenter.status === 401) {
            console.warn("Сесія завершена. Перенаправлення на вхід...");
            window.location.href = '/landing.html';
            return;
        }

        const data = await resCenter.json();

        document.getElementById('dc-name').textContent = data.name;
        document.getElementById('dc-freq').textContent = data.frequency + " Гц";
        document.getElementById('dc-alarms').textContent = data.alarmCount;

        // 2. Отримуємо баланс
        const resBalance = await fetch('/api/dispatch-center/balance');

        // Якщо раптом 404 або інша помилка - перериваємо, щоб не ламати JSON парсер
        if (!resBalance.ok) throw new Error(`HTTP error! status: ${resBalance.status}`);

        const balanceData = await resBalance.json();

        const balanceEl = document.getElementById('dc-balance');
        const balanceValue = parseFloat(balanceData.balance);

        balanceEl.textContent = (balanceValue > 0 ? "+" : "") + balanceValue + " МВт";
        balanceEl.className = balanceValue >= 0
            ? "display-6 fw-bold text-success"
            : "display-6 fw-bold text-danger";

        document.getElementById('dc-gen').textContent = balanceData.generation + " МВт";

        let percent = 0;
        if (balanceData.generation > 0) {
            percent = (balanceData.load / balanceData.generation) * 100;
        }

        const genBar = document.getElementById('gen-bar');
        if (genBar) {
            genBar.style.width = Math.min(percent, 100) + "%";
        }

        // Оновлення графіка
        balanceHistory.push(balanceValue);
        balanceHistory.shift();
        if (trendChart) trendChart.update('none');

    } catch (e) {
        console.error("Помилка оновлення даних диспетчерської:", e);
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

        if (res.status === 401) {
            window.location.href = '/landing.html';
            return;
        }

        if (res.ok) {
            // Використовуємо SweetAlert2 для зворотного зв'язку (як у твоїх скриптах)
            Swal.fire({
                title: 'Команду відправлено',
                text: `Об'єкт ${targetId}: ${cmd}`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            await updateDispatchData();
        } else {
            const errData = await res.json();
            Swal.fire('Помилка', errData.error || 'Не вдалося виконати команду', 'error');
        }
    } catch (e) {
        console.error("Server error:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTrendChart();
    updateDispatchData();
    // Опитування кожні 5 секунд
    setInterval(updateDispatchData, 5000);
});