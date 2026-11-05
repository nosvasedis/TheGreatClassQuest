// /ui/tabs/ideas.js
import * as storyWeaver from '../../features/storyWeaver.js';
import { renderTrainingGrounds } from '../../features/trainingGrounds.js';

export function renderIdeasTabSelects() {
    storyWeaver.handleStoryWeaversClassSelect();
    renderTrainingGrounds();
}

/**
 * Builds or refreshes the Student Star Manager (Settings › Student Tools). Its code and look
 * load only when Student Tools is open, so the startup bundle stays small.
 */
let starManagerModule = null;
export function renderStarManagerStudentSelect() {
    const root = document.getElementById('star-manager-root');
    if (!root) return;
    const section = root.closest('[data-options-section]');
    const optionsTab = document.getElementById('options-tab');
    if (section?.classList.contains('hidden') || optionsTab?.classList.contains('hidden')) return;
    starManagerModule = starManagerModule || import('../../features/starManager.js');
    starManagerModule
        .then((m) => m.mountStarManager(root))
        .catch((error) => {
            starManagerModule = null;
            console.warn('Star Manager failed to load:', error);
            root.innerHTML = '<p class="sm-loading">The Star Manager could not open. Check the connection and open Student Tools again.</p>';
        });
}
