AOS.init({ duration: 1000, once: true });

const imgModal = document.getElementById('imgModal');
if (imgModal) {
    imgModal.addEventListener('show.bs.modal', event => {
        const button = event.relatedTarget;
        document.getElementById('modalImg').src = button.getAttribute('data-bs-img');
    });
}