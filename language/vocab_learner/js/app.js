import { exportAnnotated } from './export.js';
import {
    clearMeanings,
    restoreSession,
    returnToUpload,
    setupDropZone,
} from './file.js';
import {
    restoreExamState,
    setupExamModeProtection,
    toggleExamMode,
} from './exam-mode.js';

function initializeApp() {
    restoreExamState();
    setupExamModeProtection();
    setupDropZone();

    document.getElementById('exam-mode-btn').addEventListener('click', toggleExamMode);
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