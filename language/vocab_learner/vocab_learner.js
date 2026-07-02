const SESSION_KEY = 'vocab_learner_session';

function initializeTailwind() {
    document.documentElement.style.setProperty('--accent', '#2563eb');
}

function saveSession() {
    if (!window.originalMD || !window.currentFileName) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        fileName: window.currentFileName,
        content: window.originalMD,
        storageKey: window.storageKey
    }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function loadDocument(fileName, content, showLoadedToast = true) {
    window.originalMD = content;
    window.currentFileName = fileName;
    window.storageKey = getStorageKey(fileName, content);

    const stored = localStorage.getItem(window.storageKey);
    window.meanings = stored ? JSON.parse(stored) : {};

    document.getElementById('file-name-display').textContent = fileName;
    switchToMain();
    renderContent(window.originalMD);
    saveSession();

    if (showLoadedToast) {
        showToast(`已加载 ${fileName}`, true);
    }
}

function restoreSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;

    try {
        const session = JSON.parse(raw);
        if (!session.fileName || !session.content) {
            clearSession();
            return false;
        }

        window.storageKey = session.storageKey || getStorageKey(session.fileName, session.content);
        loadDocument(session.fileName, session.content, false);
        return true;
    } catch {
        clearSession();
        return false;
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

        result += `<strong class="vocab-word">${safeWord}</strong><input type="text" class="vocab-input" data-word="${safeWord}" placeholder="中文释义" />`;

        lastIndex = regex.lastIndex;
    }

    result += escapeHtml(text.substring(lastIndex));
    return result;
}

function renderContent(mdText) {
    const container = document.getElementById('rendered-content');
    container.innerHTML = '';

    const lines = mdText.trim().split('\n');
    let htmlParts = [];

    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('# ')) {
            const titleText = escapeHtml(trimmed.substring(2).trim());
            htmlParts.push(`<h1 class="text-3xl font-bold tracking-tighter mb-8 text-zinc-900 border-b border-zinc-100 pb-4">${titleText}</h1>`);
        } else {
            const processed = processParagraph(trimmed);
            htmlParts.push(`<p>${processed}</p>`);
        }
    }

    container.innerHTML = htmlParts.join('');

    attachInputListeners();
    loadMeaningsToInputs();
    updateStats();
    updateWordCountBadge();
}

function attachInputListeners() {
    const inputs = document.querySelectorAll('.vocab-input');

    inputs.forEach(input => {
        if (input.value.trim()) {
            input.classList.add('filled');
        }

        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const word = input.dataset.word;
                const value = input.value.trim();

                if (!window.meanings) window.meanings = {};
                window.meanings[word] = value;

                if (window.storageKey) {
                    localStorage.setItem(window.storageKey, JSON.stringify(window.meanings));
                }

                document.querySelectorAll(`.vocab-input[data-word="${word}"]`).forEach(otherInput => {
                    if (otherInput !== input) {
                        otherInput.value = value;
                        if (value) {
                            otherInput.classList.add('filled');
                        } else {
                            otherInput.classList.remove('filled');
                        }
                    }
                });

                if (value) {
                    input.classList.add('filled');
                } else {
                    input.classList.remove('filled');
                }

                updateStats();

                if (value.length > 0 && value.length % 3 === 0) {
                    showToast('已保存', true);
                }
            }, 180);
        });

        input.addEventListener('blur', () => {
            const word = input.dataset.word;
            const value = input.value.trim();
            if (window.meanings && window.storageKey) {
                window.meanings[word] = value;
                localStorage.setItem(window.storageKey, JSON.stringify(window.meanings));
            }
        });
    });
}

function loadMeaningsToInputs() {
    if (!window.meanings) window.meanings = {};

    const inputs = document.querySelectorAll('.vocab-input');
    inputs.forEach(input => {
        const word = input.dataset.word;
        if (window.meanings[word]) {
            input.value = window.meanings[word];
            input.classList.add('filled');
        } else {
            input.classList.remove('filled');
        }
    });
}

function updateStats() {
    const statsEl = document.getElementById('stats');
    const inputs = document.querySelectorAll('.vocab-input');

    if (inputs.length === 0) {
        statsEl.innerHTML = `<span class="px-3">无加粗词汇</span>`;
        statsEl.classList.add('hidden');
        return;
    }

    statsEl.classList.remove('hidden');

    const wordSet = new Set();
    inputs.forEach(inp => wordSet.add(inp.dataset.word));

    const totalUnique = wordSet.size;
    let filledUnique = 0;

    wordSet.forEach(w => {
        const meaning = (window.meanings && window.meanings[w]) ? window.meanings[w].trim() : '';
        if (meaning !== '') filledUnique++;
    });

    statsEl.innerHTML = `
        <div class="flex items-center gap-x-1.5">
            <span class="text-emerald-600"><i class="fa-solid fa-check-double"></i></span>
            <span>进度<span class="font-semibold text-emerald-600">${filledUnique}</span> / <span class="font-semibold text-zinc-700">${totalUnique}</span></span>
        </div>
    `;
}

function updateWordCountBadge() {
    const badge = document.getElementById('word-count-badge');
    const inputs = document.querySelectorAll('.vocab-input');
    if (inputs.length === 0) {
        badge.textContent = '';
        return;
    }
    const unique = new Set();
    inputs.forEach(i => unique.add(i.dataset.word));
    badge.innerHTML = `<span class="font-mono">${unique.size}</span> 个独特词汇`;
}

function getStorageKey(filename, content) {
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const len = content.length;
    const prefix = content.substring(0, 80).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 24);
    return `vocab_meanings_${safeName}_${len}_${prefix}`;
}

function switchToMain() {
    document.getElementById('upload-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('block');
}

function handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.md') && !file.name.toLowerCase().endsWith('.markdown')) {
        showToast('请选择 .md 或 .markdown 文件', false);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        loadDocument(file.name, e.target.result);
    };
    reader.onerror = function() {
        showToast('文件读取失败，请重试', false);
    };
    reader.readAsText(file, 'UTF-8');
}

function exportAnnotated() {
    if (!window.originalMD) {
        showToast('没有可导出的内容', false);
        return;
    }

    let exported = window.originalMD;
    const meanings = window.meanings || {};

    exported = exported.replace(/\*\*([^*]+?)\*\*/g, (match, word) => {
        const w = word.trim();
        const meaning = meanings[w] ? meanings[w].trim() : '';
        if (meaning) {
            return `**${w}**（${meaning}）`;
        } else {
            return `**${w}**`;
        }
    });

    const blob = new Blob([exported], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const baseName = (window.currentFileName || 'vocabulary').replace(/\.(md|markdown)$/i, '');
    a.download = `${baseName}_带中文释义.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('已导出带中文释义的 Markdown 文件', true);
}

function clearMeanings() {
    if (!window.storageKey) return;

    if (!confirm('确定要清除当前文章的所有中文释义吗？\n此操作仅清除本地缓存中的释义数据。')) {
        return;
    }

    window.meanings = {};
    localStorage.removeItem(window.storageKey);

    document.querySelectorAll('.vocab-input').forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });

    updateStats();
    showToast('已清除所有释义', true);
}

function showToast(message, success = true) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast flex items-center gap-x-3 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium border ${success ?
        'bg-emerald-50 border-emerald-200 text-emerald-700' :
        'bg-red-50 border-red-200 text-red-700'}`;

    toast.innerHTML = `
        <div class="flex items-center gap-x-2.5">
            <i class="fa-solid ${success ? 'fa-check-circle text-emerald-500' : 'fa-exclamation-circle text-red-500'} text-lg"></i>
            <span>${message}</span>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.25s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
    }, 2800);
}

function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

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

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    dropZone.setAttribute('tabindex', '0');
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
}

function initializeApp() {
    initializeTailwind();
    setupDropZone();

    document.getElementById('export-btn').addEventListener('click', exportAnnotated);
    document.getElementById('clear-btn').addEventListener('click', clearMeanings);

    document.getElementById('back-btn').addEventListener('click', () => {
        if (confirm('返回上传界面？当前进度已自动保存至本地缓存。')) {
            clearSession();
            window.originalMD = null;
            window.currentFileName = null;
            window.storageKey = null;
            window.meanings = {};
            document.getElementById('main-screen').classList.add('hidden');
            document.getElementById('upload-screen').classList.remove('hidden');
            document.getElementById('rendered-content').innerHTML = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.metaKey && e.key === 'e' && !document.getElementById('main-screen').classList.contains('hidden')) {
            e.preventDefault();
            exportAnnotated();
        }
    });

    restoreSession();

    console.log('%c[VocabLearner] 应用已初始化完成', 'color:#64748b');
}

window.onload = initializeApp;