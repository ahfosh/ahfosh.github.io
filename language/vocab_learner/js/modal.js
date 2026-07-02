let verifyResolver = null;
let exportResolver = null;

function closeVerifyModal(result) {
    document.getElementById('verify-modal').classList.add('hidden');
    if (verifyResolver) {
        verifyResolver(result);
        verifyResolver = null;
    }
}

export function requestConfirmation({ title, message }) {
    return new Promise((resolve) => {
        verifyResolver = resolve;

        document.getElementById('verify-title').textContent = title;
        document.getElementById('verify-message').textContent = message;

        const modal = document.getElementById('verify-modal');
        modal.classList.remove('hidden');

        document.getElementById('verify-confirm-btn').onclick = () => closeVerifyModal(true);
        modal.querySelectorAll('[data-verify-dismiss]').forEach((el) => {
            el.onclick = () => closeVerifyModal(false);
        });
    });
}

function closeExportModal(result) {
    document.getElementById('export-modal').classList.add('hidden');
    if (exportResolver) {
        exportResolver(result);
        exportResolver = null;
    }
}

export function requestExportConfirmation({ filled, total, isComplete }) {
    return new Promise((resolve) => {
        exportResolver = resolve;

        const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
        const message = isComplete
            ? '所有词汇释义已填写完毕。'
            : `尚有 ${total - filled} 个词汇未填写释义。是否继续导出文件？`;

        document.getElementById('export-message').textContent = message;
        document.getElementById('export-progress-bar').style.width = `${percent}%`;
        document.getElementById('export-progress-text').textContent = `进度：${filled} / ${total}（${percent}%）`;

        const modal = document.getElementById('export-modal');
        modal.classList.remove('hidden');

        document.getElementById('export-confirm-btn').onclick = () => closeExportModal(true);
        modal.querySelectorAll('[data-export-dismiss]').forEach((el) => {
            el.onclick = () => closeExportModal(false);
        });
    });
}