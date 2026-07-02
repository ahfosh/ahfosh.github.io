import { ICON_CHECK } from './constants.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { applyExamLockUI, updateTranslationProtection } from './exam-mode.js';

function setInputFilled(input, filled) {
    input.classList.toggle('filled', filled);
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
        result += `<span class="vocab-unit"><strong class="vocab-word">${safeWord}</strong><input type="text" class="vocab-input" data-word="${safeWord}" placeholder="中文释义" /></span>`;
        lastIndex = regex.lastIndex;
    }

    result += escapeHtml(text.substring(lastIndex));
    return result;
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
    document.querySelectorAll('.vocab-input').forEach((input) => {
        const value = state.meanings[input.dataset.word] || '';
        input.value = value;
        setInputFilled(input, Boolean(value));
    });
}

export function saveWordMeaning(word, value) {
    state.meanings[word] = value;

    if (state.storageKey) {
        localStorage.setItem(state.storageKey, JSON.stringify(state.meanings));
    }

    document.querySelectorAll(`.vocab-input[data-word="${word}"]`).forEach((input) => {
        input.value = value;
        setInputFilled(input, Boolean(value));
    });

    updateProgressUI();
}

export function renderContent(mdText) {
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
    updateTranslationProtection();
    applyExamLockUI();
    updateProgressUI();
}

export function getProgressStats() {
    const wordSet = new Set();
    document.querySelectorAll('.vocab-input').forEach((input) => wordSet.add(input.dataset.word));

    let filled = 0;
    wordSet.forEach((word) => {
        if (state.meanings[word]?.trim()) filled++;
    });

    const total = wordSet.size;
    return { total, filled, isComplete: total > 0 && filled === total };
}

export function updateProgressUI() {
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

export function clearAllInputs() {
    document.querySelectorAll('.vocab-input').forEach((input) => {
        input.value = '';
        setInputFilled(input, false);
    });
}