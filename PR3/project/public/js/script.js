const form = document.getElementById('form');
const resultDiv = document.getElementById('result');
const historyDiv = document.getElementById('history');

async function loadHistory() {
    try {
        const response = await fetch('/api/losses');
        const data = await response.json();

        if (data.length === 0) {
            historyDiv.innerHTML = '<p class="text-muted text-center py-4">Історія розрахунків порожня.</p>';
            return;
        }

        historyDiv.innerHTML = `
            <div class="table-responsive mt-4">
                <table class="table table-hover align-middle shadow-sm bg-white" style="border-radius: 15px; overflow: hidden;">
                    <thead class="table-dark">
                        <tr>
                            <th>Ділянка</th>
                            <th>Напруга (кВ)</th>
                            <th>Довжина (км)</th>
                            <th>Втрати (%)</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reverse().map(item => `
                            <tr class="${item.loss > 20 ? 'table-danger' : ''}">
                                <td class="fw-bold">${item.section}</td>
                                <td><span class="badge bg-secondary">${item.voltage} кВ</span></td>
                                <td>${item.length} км</td>
                                <td><span class="loss-badge" style="background: ${item.loss > 20 ? '#e74c3c' : '#2ecc71'}">${item.loss}%</span></td>
                                <td>
                                    <button onclick="deleteEntry('${item.id}')" class="btn btn-sm btn-outline-danger">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) { console.error(error); }
}

async function deleteEntry(id) {
    if (!confirm('Видалити цей запис?')) return;
    await fetch(`/api/losses/${id}`, { method: 'DELETE' });
    loadHistory();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    const submitBtn = form.querySelector('button');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const res = await fetch('/api/losses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 400) throw new Error("Некоректні дані");

        const json = await res.json();
        resultDiv.innerHTML = `
            <div class="alert alert-success border-0 shadow-lg animate-up d-inline-block">
                <strong>Успіх!</strong> Для ${json.section} втрати: ${json.loss}%
            </div>
        `;
        form.reset();
        loadHistory();
    } catch (err) {
        resultDiv.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Розрахувати';
    }
});

document.addEventListener('DOMContentLoaded', loadHistory);