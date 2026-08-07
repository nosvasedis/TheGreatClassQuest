// /ui/modals/class.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { db, query, collection, where, getDocs } from '../../firebase.js';
import { showAnimatedModal, showModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { ensureHistoryLoaded } from '../../db/actions.js';

export function openCreateClassModal(options = {}) {
    const form = document.getElementById('add-class-form');
    if (form) form.reset();

    const logoInput = document.getElementById('class-logo');
    const logoButton = document.getElementById('logo-picker-btn');
    const suggestions = document.getElementById('class-name-suggestions');
    const generateButton = document.getElementById('generate-class-name-btn');
    const levelSelect = document.getElementById('class-level');

    if (logoInput) logoInput.value = '📚';
    if (logoButton) logoButton.innerText = '📚';
    if (suggestions) suggestions.innerHTML = '';

    if (levelSelect && options.league) {
        levelSelect.value = options.league;
        levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (generateButton) generateButton.disabled = !levelSelect?.value;

    showAnimatedModal('create-class-modal');
    requestAnimationFrame(() => document.getElementById('class-name')?.focus());
}


