// /ui/modals/class.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { db } from '../../firebase.js';
import { query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal, showModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { ensureHistoryLoaded } from '../../db/actions.js';

export function openCreateClassModal() {
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
    if (generateButton) generateButton.disabled = !levelSelect?.value;

    showAnimatedModal('create-class-modal');
    requestAnimationFrame(() => document.getElementById('class-name')?.focus());
}


