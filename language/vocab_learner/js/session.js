import { SESSION_KEY } from './constants.js';
import { state } from './state.js';

export function saveSession() {
    if (!state.originalMD || !state.currentFileName) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        fileName: state.currentFileName,
        content: state.originalMD,
    }));
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}