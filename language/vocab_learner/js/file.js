import { SESSION_KEY } from './constants.js';
import { requestConfirmation } from './modal.js';
import { clearSession, saveSession } from './session.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { getStorageKey } from './utils.js';
import { updateExamModeUI } from './exam-mode.js';
import { clearAllInputs, renderContent, updateProgressUI } from './vocab.js';

export function loadDocument(fileName, content, showLoadedToast = true) {
    state.originalMD = content;
    state.currentFileName = fileName;
    state.storageKey = getStorageKey(fileName, content);

    const stored = localStorage.getItem(state.storageKey);
    state.meanings = stored ? JSON.parse(stored) : {};

    document.getElementById('file-name-display').textContent = fileName;
    document.getElementById('upload-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    updateExamModeUI();
    renderContent(state.originalMD);
    saveSession();

    if (showLoadedToast) {
        showToast(`已加载 ${fileName}`, true);
    }
}

export function restoreSession() {
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

export function handleFile(file) {
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

export function setupDropZone() {
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

export async function clearMeanings() {
    if (!state.storageKey) return;

    const verified = await requestConfirmation({
        title: '清除释义',
        message: '确定要清除当前文章的所有中文释义吗？此操作仅清除本地缓存中的释义数据，且无法恢复。',
    });
    if (!verified) return;

    state.meanings = {};
    localStorage.removeItem(state.storageKey);
    clearAllInputs();
    updateProgressUI();
    showToast('已清除所有释义', true);
}

export async function returnToUpload() {
    const verified = await requestConfirmation({
        title: '返回上传',
        message: '当前进度已自动保存至本地缓存。确定要离开当前文章吗？',
    });
    if (!verified) return;

    clearSession();
    state.originalMD = null;
    state.currentFileName = null;
    state.storageKey = null;
    state.meanings = {};
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('upload-screen').classList.remove('hidden');
    document.getElementById('rendered-content').innerHTML = '';
    updateExamModeUI();
}