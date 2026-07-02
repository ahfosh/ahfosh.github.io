const SESSION_KEY = 'vocab_learner_session';

const ICON_CHECK = '<svg class="icon stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
const ICON_CHECK_CIRCLE = '<svg class="icon toast-icon-success" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.4-3.5-3.5 1.4-1.4 2.1 2.1 5-5 1.4 1.4-6.4 6.4z"/></svg>';
const ICON_ERROR_CIRCLE = '<svg class="icon toast-icon-error" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';

function saveSession() {
    if (!window.originalMD || !window.currentFileName) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        fileName: window.currentFileName,
        content: window.originalMD
    }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function getStorageKey(filename, content) {
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const len = content.length;
    const prefix = content.substring(0, 80).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 24);
    return `vocab_meanings_${safeName}_${len}_${prefix}`;
}

let verifyResolver = null;

function closeVerifyModal(result) {
    document.getElementById('verify-modal').classList.add('hidden');
    if (verifyResolver) {
        verifyResolver(result);
        verifyResolver = null;
    }
}

function requestConfirmation({ title, message }) {
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

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function processParagraph(text) {
    let result = '';
    let lastIndex = 0;
    const regex = /\*\*([^*]+?)\*\*/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        result += escapeHtml(text.substring(lastIndex, match.index));
        const word = match[1].trim();
        const safeWord = escapeHtml(word);
        result += `<span class="vocab-unit notranslate" translate="no"><strong class="vocab-word">${safeWord}</strong><input type="text" class="vocab-input" data-word="${safeWord}" placeholder="中文释义" translate="no" /></span>`;
        lastIndex = regex.lastIndex;
    }

    result += escapeHtml(text.substring(lastIndex));
    return result;
}

function renderContent(mdText) {
    const container = document.getElementById('rendered-content');
    const htmlParts = [];

    for (const line of mdText.trim().split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('# ')) {
            htmlParts.push(`<h1>${escapeHtml(trimmed.substring(2).trim())}</h1>`);
        } else {
            htmlParts.push(`<p>${processParagraph(trimmed)}</p>`);
        }
    }

    container.innerHTML = htmlParts.join('');
    attachInputListeners();
    loadMeaningsToInputs();
    updateProgressUI();
}

function setInputFilled(input, filled) {
    input.classList.toggle('filled', filled);
}

function saveWordMeaning(word, value) {
    if (!window.meanings) window.meanings = {};
    window.meanings[word] = value;

    if (window.storageKey) {
        localStorage.setItem(window.storageKey, JSON.stringify(window.meanings));
    }

    document.querySelectorAll(`.vocab-input[data-word="${word}"]`).forEach((input) => {
        input.value = value;
        setInputFilled(input, Boolean(value));
    });

    updateProgressUI();
}

function attachInputListeners() {
    document.querySelectorAll('.vocab-input').forEach((input) => {
        let debounceTimer;

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                saveWordMeaning(input.dataset.word, input.value.trim());
            }, 180);
        });

        input.addEventListener('blur', () => {
            clearTimeout(debounceTimer);
            saveWordMeaning(input.dataset.word, input.value.trim());
        });
    });
}

function loadMeaningsToInputs() {
    if (!window.meanings) window.meanings = {};

    document.querySelectorAll('.vocab-input').forEach((input) => {
        const value = window.meanings[input.dataset.word] || '';
        input.value = value;
        setInputFilled(input, Boolean(value));
    });
}

function getProgressStats() {
    const wordSet = new Set();
    document.querySelectorAll('.vocab-input').forEach((input) => wordSet.add(input.dataset.word));

    let filled = 0;
    wordSet.forEach((word) => {
        if (window.meanings?.[word]?.trim()) filled++;
    });

    const total = wordSet.size;
    return { total, filled, isComplete: total > 0 && filled === total };
}

function updateProgressUI() {
    const statsEl = document.getElementById('stats');
    const badgeEl = document.getElementById('word-count-badge');
    const { total, filled } = getProgressStats();

    if (total === 0) {
        statsEl.textContent = '无加粗词汇';
        statsEl.classList.add('hidden');
        badgeEl.textContent = '';
        return;
    }

    statsEl.classList.remove('hidden');
    statsEl.innerHTML = `
        <div class="stats-content">
            ${ICON_CHECK}
            <span>进度 <span class="stats-done">${filled}</span> / <span class="stats-total">${total}</span></span>
        </div>
    `;
    badgeEl.innerHTML = `<span class="word-count-num">${total}</span> 个词汇`;
}

function loadDocument(fileName, content, showLoadedToast = true) {
    window.originalMD = content;
    window.currentFileName = fileName;
    window.storageKey = getStorageKey(fileName, content);

    const stored = localStorage.getItem(window.storageKey);
    window.meanings = stored ? JSON.parse(stored) : {};

    document.getElementById('file-name-display').textContent = fileName;
    document.getElementById('upload-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    renderContent(window.originalMD);
    saveSession();

    if (showLoadedToast) {
        showToast(`已加载 ${fileName}`, true);
    }
}

function restoreSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
        const session = JSON.parse(raw);
        if (!session.fileName || !session.content) {
            clearSession();
            return;
        }
        loadDocument(session.fileName, session.content, false);
    } catch {
        clearSession();
    }
}

function handleFile(file) {
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
        showToast('请选择 .md 或 .markdown 文件', false);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => loadDocument(file.name, e.target.result);
    reader.onerror = () => showToast('文件读取失败，请重试', false);
    reader.readAsText(file, 'UTF-8');
}

let exportResolver = null;

function closeExportModal(result) {
    document.getElementById('export-modal').classList.add('hidden');
    if (exportResolver) {
        exportResolver(result);
        exportResolver = null;
    }
}

function requestExportConfirmation({ filled, total, isComplete }) {
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

async function exportAnnotated() {
    if (!window.originalMD) {
        showToast('没有可导出的内容', false);
        return;
    }

    const { total, filled, isComplete } = getProgressStats();
    if (total === 0) {
        showToast('没有可加粗词汇', false);
        return;
    }

    const confirmed = await requestExportConfirmation({ filled, total, isComplete });
    if (!confirmed) return;

    const meanings = window.meanings || {};
    const exported = window.originalMD.replace(/\*\*([^*]+?)\*\*/g, (_, word) => {
        const w = word.trim();
        const meaning = meanings[w]?.trim();
        return meaning ? `**${w}**（${meaning}）` : `**${w}**`;
    });

    const blob = new Blob([exported], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(window.currentFileName || 'vocabulary').replace(/\.(md|markdown)$/i, '')}_带中文释义.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('已导出带中文释义的 Markdown 文件', true);
}

async function clearMeanings() {
    if (!window.storageKey) return;

    const verified = await requestConfirmation({
        title: '清除释义',
        message: '确定要清除当前文章的所有中文释义吗？此操作仅清除本地缓存中的释义数据，且无法恢复。'
    });
    if (!verified) return;

    window.meanings = {};
    localStorage.removeItem(window.storageKey);

    document.querySelectorAll('.vocab-input').forEach((input) => {
        input.value = '';
        setInputFilled(input, false);
    });

    updateProgressUI();
    showToast('已清除所有释义', true);
}

function showToast(message, success = true) {
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

async function returnToUpload() {
    const verified = await requestConfirmation({
        title: '返回上传',
        message: '当前进度已自动保存至本地缓存。确定要离开当前文章吗？'
    });
    if (!verified) return;

    clearSession();
    window.originalMD = null;
    window.currentFileName = null;
    window.storageKey = null;
    window.meanings = {};
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('upload-screen').classList.remove('hidden');
    document.getElementById('rendered-content').innerHTML = '';
}

function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
            e.target.value = '';
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
}

function isEditableTarget(target) {
    return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target.isContentEditable;
}

function setupCopyProtection() {
    const blockCopy = (e) => e.preventDefault();

    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', (e) => {
        if (!isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });
    document.addEventListener('contextmenu', (e) => {
        if (!isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });
    document.addEventListener('selectstart', (e) => {
        if (!isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;

        const key = e.key.toLowerCase();
        if (key === 'c') {
            e.preventDefault();
            return;
        }

        if (key === 'x' && !isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });
}

function initializeApp() {
    setupCopyProtection();
    setupDropZone();

    document.getElementById('export-btn').addEventListener('click', exportAnnotated);
    document.getElementById('clear-btn').addEventListener('click', clearMeanings);

    document.getElementById('back-btn').addEventListener('click', returnToUpload);

    document.addEventListener('keydown', (e) => {
        if (e.metaKey && e.key === 'e' && !document.getElementById('main-screen').classList.contains('hidden')) {
            e.preventDefault();
            exportAnnotated();
        }
    });

    restoreSession();
}

window.addEventListener('DOMContentLoaded', initializeApp);