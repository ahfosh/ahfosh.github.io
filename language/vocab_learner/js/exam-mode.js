import {
    EXAM_LOCKED_KEY,
    EXAM_MODE_KEY,
    EXAM_MODE_PASSWORD_HASH,
    EXAM_TIMER_END_KEY,
} from './constants.js';
import { showToast } from './toast.js';
import { formatCountdown, hashPassword, isEditableTarget } from './utils.js';

let examMode = false;
let examLocked = false;
let examTimerEnd = null;
let examTimerInterval = null;
let examPasswordResolver = null;
let examSetupResolver = null;

function closeExamPasswordModal(result) {
    const modal = document.getElementById('exam-password-modal');
    const input = document.getElementById('exam-password-input');
    const errorEl = document.getElementById('exam-password-error');

    modal.classList.add('hidden');
    input.value = '';
    errorEl.classList.add('hidden');

    if (examPasswordResolver) {
        examPasswordResolver(result);
        examPasswordResolver = null;
    }
}

function closeExamSetupModal(result) {
    const modal = document.getElementById('exam-setup-modal');
    const errorEl = document.getElementById('exam-setup-error');

    modal.classList.add('hidden');
    errorEl.classList.add('hidden');

    if (examSetupResolver) {
        examSetupResolver(result);
        examSetupResolver = null;
    }
}

function requestExamSetup() {
    return new Promise((resolve) => {
        examSetupResolver = resolve;

        const modal = document.getElementById('exam-setup-modal');
        const timerEnabled = document.getElementById('exam-timer-enabled');
        const timerFields = document.getElementById('exam-timer-fields');
        const hoursInput = document.getElementById('exam-timer-hours');
        const minutesInput = document.getElementById('exam-timer-minutes');
        const errorEl = document.getElementById('exam-setup-error');
        const confirmBtn = document.getElementById('exam-setup-confirm-btn');

        timerEnabled.checked = false;
        timerFields.classList.add('hidden');
        hoursInput.value = '0';
        minutesInput.value = '30';
        errorEl.classList.add('hidden');
        modal.classList.remove('hidden');

        timerEnabled.onchange = () => {
            timerFields.classList.toggle('hidden', !timerEnabled.checked);
            errorEl.classList.add('hidden');
        };

        const tryConfirm = () => {
            if (!timerEnabled.checked) {
                closeExamSetupModal({ timed: false, durationMs: 0 });
                return;
            }

            const hours = Math.max(0, parseInt(hoursInput.value, 10) || 0);
            const minutes = Math.max(0, parseInt(minutesInput.value, 10) || 0);
            const durationMs = (hours * 60 + minutes) * 60 * 1000;

            if (durationMs <= 0) {
                errorEl.classList.remove('hidden');
                return;
            }

            closeExamSetupModal({ timed: true, durationMs });
        };

        confirmBtn.onclick = tryConfirm;
        modal.querySelectorAll('[data-exam-setup-dismiss]').forEach((el) => {
            el.onclick = () => closeExamSetupModal(null);
        });
    });
}

function requestExamPassword() {
    return new Promise((resolve) => {
        examPasswordResolver = resolve;

        const modal = document.getElementById('exam-password-modal');
        const input = document.getElementById('exam-password-input');
        const errorEl = document.getElementById('exam-password-error');
        const confirmBtn = document.getElementById('exam-password-confirm-btn');

        errorEl.classList.add('hidden');
        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        const tryConfirm = async () => {
            const hash = await hashPassword(input.value);
            if (hash === EXAM_MODE_PASSWORD_HASH) {
                closeExamPasswordModal(true);
            } else {
                errorEl.classList.remove('hidden');
                input.select();
            }
        };

        confirmBtn.onclick = tryConfirm;
        modal.querySelectorAll('[data-exam-password-dismiss]').forEach((el) => {
            el.onclick = () => closeExamPasswordModal(false);
        });
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tryConfirm();
            }
        };
    });
}

export function isExamModeActive() {
    if (!examMode) return false;
    return !document.getElementById('main-screen').classList.contains('hidden');
}

export function updateTranslationProtection() {
    const active = isExamModeActive();
    const html = document.documentElement;

    html.classList.toggle('notranslate', active);
    if (active) {
        html.setAttribute('translate', 'no');
    } else {
        html.removeAttribute('translate');
    }

    document.body.classList.toggle('notranslate', active);

    const content = document.getElementById('rendered-content');
    if (content) content.classList.toggle('notranslate', active);

    document.querySelectorAll('.vocab-unit').forEach((unit) => {
        unit.classList.toggle('notranslate', active);
        if (active) {
            unit.setAttribute('translate', 'no');
        } else {
            unit.removeAttribute('translate');
        }
    });

    document.querySelectorAll('.vocab-input').forEach((input) => {
        if (active) {
            input.setAttribute('translate', 'no');
        } else {
            input.removeAttribute('translate');
        }
    });

    let meta = document.querySelector('meta[name="google"][content="notranslate"]');
    if (active && !meta) {
        meta = document.createElement('meta');
        meta.name = 'google';
        meta.content = 'notranslate';
        document.head.appendChild(meta);
    } else if (!active && meta) {
        meta.remove();
    }
}

export function applyExamLockUI() {
    document.body.classList.toggle('exam-locked', examLocked && isExamModeActive());

    document.querySelectorAll('.vocab-input').forEach((input) => {
        const locked = examLocked && isExamModeActive();
        input.readOnly = locked;
        input.tabIndex = locked ? -1 : 0;
    });
}

function clearExamTimerState() {
    examTimerEnd = null;
    localStorage.removeItem(EXAM_TIMER_END_KEY);

    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }
}

function updateExamTimerUI() {
    const badge = document.getElementById('exam-timer-badge');
    if (!badge) return;

    if (!examMode || !isExamModeActive()) {
        badge.classList.add('hidden');
        badge.textContent = '';
        badge.classList.remove('urgent', 'locked');
        return;
    }

    if (examLocked) {
        badge.classList.remove('hidden', 'urgent');
        badge.classList.add('locked');
        badge.textContent = '已锁定';
        return;
    }

    if (!examTimerEnd) {
        badge.classList.add('hidden');
        badge.textContent = '';
        badge.classList.remove('urgent', 'locked');
        return;
    }

    const remaining = examTimerEnd - Date.now();
    badge.classList.remove('hidden', 'locked');
    badge.classList.toggle('urgent', remaining <= 5 * 60 * 1000);
    badge.textContent = `剩余 ${formatCountdown(remaining)}`;
}

function lockExam({ silent = false } = {}) {
    examLocked = true;
    localStorage.setItem(EXAM_LOCKED_KEY, '1');
    applyExamLockUI();
    updateExamTimerUI();
    updateExamModeUI();

    if (!silent) {
        showToast('考试时间到，已自动锁定', false);
    }
}

function unlockExam() {
    examLocked = false;
    localStorage.removeItem(EXAM_LOCKED_KEY);
    applyExamLockUI();
    updateExamTimerUI();
}

function checkExamTimerExpiry() {
    if (!examMode || !examTimerEnd || examLocked) return;

    if (Date.now() >= examTimerEnd) {
        lockExam();
    }
}

function startExamTimer() {
    if (!examTimerEnd) return;

    checkExamTimerExpiry();
    if (examLocked) return;

    updateExamTimerUI();

    if (examTimerInterval) clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        checkExamTimerExpiry();
        updateExamTimerUI();
    }, 1000);
}

export function updateExamModeUI() {
    const btn = document.getElementById('exam-mode-btn');
    const badge = document.querySelector('.mode-badge');

    if (btn) {
        btn.setAttribute('aria-pressed', String(examMode));
        if (examLocked && examMode) {
            btn.title = '考试已锁定，关闭需输入密码';
        } else if (examMode) {
            btn.title = '考试模式已开启，关闭需输入密码';
        } else {
            btn.title = '开启后禁止复制和翻译文章内容';
        }
    }

    document.body.classList.toggle('exam-mode', isExamModeActive());
    applyExamLockUI();
    updateTranslationProtection();
    updateExamTimerUI();

    if (badge) {
        if (!examMode) {
            badge.textContent = '词汇检查模式';
        } else if (examLocked) {
            badge.textContent = '考试模式 · 已锁定';
        } else if (examTimerEnd) {
            badge.textContent = '考试模式 · 限时';
        } else {
            badge.textContent = '考试模式';
        }
        badge.classList.toggle('exam-active', examMode);
    }
}

function setExamMode(enabled, { silent = false, setup = null, preserveTimer = false } = {}) {
    examMode = enabled;
    localStorage.setItem(EXAM_MODE_KEY, enabled ? '1' : '0');

    if (enabled) {
        if (setup?.timed) {
            examTimerEnd = Date.now() + setup.durationMs;
            localStorage.setItem(EXAM_TIMER_END_KEY, String(examTimerEnd));
            startExamTimer();
        } else if (!preserveTimer) {
            clearExamTimerState();
        }
    } else {
        clearExamTimerState();
        unlockExam();
    }

    updateExamModeUI();

    if (!silent) {
        if (enabled) {
            const timerNote = setup?.timed ? '，计时已开始' : '，不限时间';
            showToast(`已开启考试模式，禁止复制和翻译${timerNote}`, true);
        } else {
            showToast('已关闭考试模式', true);
        }
    }
}

export async function toggleExamMode() {
    if (!examMode) {
        const setup = await requestExamSetup();
        if (!setup) return;

        setExamMode(true, { setup });
        return;
    }

    const verified = await requestExamPassword();
    if (!verified) return;

    setExamMode(false);
}

export function restoreExamState() {
    const enabled = localStorage.getItem(EXAM_MODE_KEY) === '1';
    examLocked = localStorage.getItem(EXAM_LOCKED_KEY) === '1';

    const storedEnd = localStorage.getItem(EXAM_TIMER_END_KEY);
    examTimerEnd = storedEnd ? Number(storedEnd) : null;

    setExamMode(enabled, { silent: true, preserveTimer: true });

    if (enabled && examTimerEnd) {
        if (Date.now() >= examTimerEnd) {
            lockExam({ silent: true });
        } else {
            startExamTimer();
        }
    } else if (enabled && examLocked) {
        applyExamLockUI();
        updateExamTimerUI();
    }
}

export function setupExamModeProtection() {
    document.addEventListener('copy', (e) => {
        if (isExamModeActive()) e.preventDefault();
    });

    document.addEventListener('cut', (e) => {
        if (isExamModeActive() && !isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('contextmenu', (e) => {
        if (isExamModeActive() && !isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('selectstart', (e) => {
        if (isExamModeActive() && !isEditableTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!isExamModeActive() || !(e.ctrlKey || e.metaKey)) return;

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