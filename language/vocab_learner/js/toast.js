import { ICON_CHECK_CIRCLE, ICON_ERROR_CIRCLE } from './constants.js';

export function showToast(message, success = true) {
    const toast = document.createElement('div');
    toast.className = `toast ${success ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `
        <div class="toast-body">
            ${success ? ICON_CHECK_CIRCLE : ICON_ERROR_CIRCLE}
            <span>${message}</span>
        </div>
    `;

    document.getElementById('toast-container').appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.25s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 200);
    }, 2800);
}