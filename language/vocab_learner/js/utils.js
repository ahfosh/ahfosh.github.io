export function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getStorageKey(filename, content) {
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const len = content.length;
    const prefix = content.substring(0, 80).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 24);
    return `vocab_meanings_${safeName}_${len}_${prefix}`;
}

export function isEditableTarget(target) {
    return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target.isContentEditable;
}

export async function hashPassword(text) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatCountdown(remainingMs) {
    const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}