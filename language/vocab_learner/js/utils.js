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