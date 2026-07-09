import { state } from './state.js';
import { requestExportConfirmation } from './modal.js';
import { showToast } from './toast.js';
import { getProgressStats } from './vocab.js';

export async function exportAnnotated() {
    if (!state.originalMD) {
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

    const meanings = state.meanings;
    // Match bold words and any trailing full-width annotation so re-export never doubles （）
    const exported = state.originalMD.replace(/\*\*([^*]+?)\*\*(?:（[^）]*）)?/g, (_, word) => {
        const w = word.trim();
        const meaning = meanings[w]?.trim();
        return meaning ? `**${w}**（${meaning}）` : `**${w}**`;
    });

    const blob = new Blob([exported], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.currentFileName || 'vocabulary').replace(/\.(md|markdown)$/i, '')}_带中文释义.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('已导出带中文释义的 Markdown 文件', true);
}