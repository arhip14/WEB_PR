const Security = {
    escapeHTML: function(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    validatePayment: function(amount) {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            Swal.fire('Security Error', 'Некоректна сума платежу', 'error');
            return false;
        }
        if (parsed > 10000) {
            Swal.fire('Limit Exceeded', 'Максимальна сума поповнення — 10,000 ₴', 'warning');
            return false;
        }
        return true;
    },

    handleAuthError: async function(response) {
        if (response.status === 401) {
            await Swal.fire({
                title: 'Сесія завершена',
                text: 'Будь ласка, увійдіть в систему знову',
                icon: 'info'
            });
            window.location.href = '/';
            return true;
        }
        return false;
    },

    maskEmail: function(email) {
        const [name, domain] = email.split('@');
        return name.substring(0, 3) + "****@" + domain;
    }
};

const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 401 && !window.location.pathname.includes('landing')) {
        Security.handleAuthError(response);
    }

    return response;
};