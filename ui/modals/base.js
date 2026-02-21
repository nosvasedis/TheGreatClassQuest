// /ui/modals.js

// --- IMPORTS ---
import { fetchLogsForDate, fetchAttendanceForMonth, fetchLogsForMonth } from '../db/queries.js';
import { db } from '../firebase.js';
import { doc, getDocs, collection, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// State and Constants
import * as state from '../state.js';
import { fetchMonthlyHistory } from '../state.js';
import * as constants from '../constants.js';
import * as utils from '../utils.js';
import { HERO_CLASSES } from '../features/heroClasses.js';

// Actions and Effects
import { playSound } from '../audio.js';
import { callGeminiApi } from '../api.js';
import { showToast, showPraiseToast } from './effects.js';
import {
    deleteClass,
    deleteStudent,
    handleEditClass,
    handleDeleteQuestEvent,
    handleCancelLesson,
    handleAddOneTimeLesson,
    handleDeleteAwardLog,
    saveAwardNote,
    saveAdventureLogNote,
    deleteAdventureLog,
    handleDeleteTrial,
    handleMoveStudent,
    handleMarkAbsent,
    handleAwardBonusStar,
    handleBatchAwardBonus, // NEW IMPORT
    addOrUpdateHeroChronicleNote,
    handleRemoveAttendanceColumn,
    deleteHeroChronicleNote, ensureHistoryLoaded
} from '../db/actions.js';

// Helper function to populate date dropdowns
function populateDateDropdowns(monthSelectId, daySelectId, dateString) { // dateString is YYYY-MM-DD
    const monthSelect = document.getElementById(monthSelectId);
    const daySelect = document.getElementById(daySelectId);

    // Populate months
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthSelect.innerHTML = '<option value="">-- Month --</option>' + months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

    // Populate days
    daySelect.innerHTML = '<option value="">-- Day --</option>' + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    
    // Set selected values if dateString exists
    if (dateString && dateString.includes('-')) {
        const parts = dateString.split('-');
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        monthSelect.value = month;
        daySelect.value = day;
    }
}

// --- LOCAL STATE FOR MODALS ---
let heroStatsChart = null;
let currentlySelectedDayCell = null;

// --- GENERIC MODAL FUNCTIONS ---

export function showAnimatedModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const innerContent = modal.querySelector('.pop-in');

    modal.classList.remove('hidden');
    if (innerContent) {
        innerContent.classList.add('modal-origin-start'); 
        innerContent.classList.remove('pop-out'); 
    }

    requestAnimationFrame(() => {
        if (innerContent) {
            innerContent.classList.remove('modal-origin-start');
        }
    });
}


export function showModal(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        playSound('click');
        if (onConfirm) onConfirm();
        hideModal('confirmation-modal');
    });
    showAnimatedModal('confirmation-modal');
}

export function hideModal(modalId) {
    if (modalId === 'quest-update-modal' || modalId === 'storybook-viewer-modal') {
        const audio = modalId === 'quest-update-modal' ? state.get('currentNarrativeAudio') : state.get('currentStorybookAudio');
        const btn = modalId === 'quest-update-modal' ? document.getElementById('play-narrative-btn') : document.getElementById('storybook-viewer-play-btn');
        if (audio && !audio.paused) {
            audio.pause();
            if(btn) btn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> ${btn.textContent.includes('Narrate') ? 'Narrate Story' : 'Play Narrative'}`;
        }
        if (modalId === 'quest-update-modal') state.set('currentNarrativeAudio', null);
        else state.set('currentStorybookAudio', null);
    }

    if (modalId === 'hero-stats-modal' && heroStatsChart) {
        heroStatsChart.destroy();
        heroStatsChart = null;
    }

    const modal = document.getElementById(modalId);
    if (!modal || modal.classList.contains('hidden')) return;

    const innerContent = modal.querySelector('.pop-in');

    if (innerContent) {
        innerContent.classList.add('pop-out');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
        if (innerContent) {
            innerContent.classList.remove('pop-out');
        }
    }, 200); 

    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
        currentlySelectedDayCell = null;
    }
}


// --- PICKER MODALS ---

export function showLeaguePicker() {
    const list = document.getElementById('league-picker-list');
    list.innerHTML = constants.questLeagues.map(league => `<button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${league}">${league}</button>`).join('');
    list.querySelectorAll('.league-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        state.setGlobalSelectedLeague(btn.dataset.league, true);
        hideModal('league-picker-modal');
    }));
    showAnimatedModal('league-picker-modal');
}

export function showLogoPicker(target) {
    const list = document.getElementById('logo-picker-list');
    list.innerHTML = constants.classLogos.map(logo => `<button class="logo-select-btn p-2 rounded-lg transition hover:bg-gray-200 bubbly-button" data-logo="${logo}">${logo}</button>`).join('');
    list.querySelectorAll('.logo-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        const logo = btn.dataset.logo;
        if (target === 'create') {
            document.getElementById('class-logo').value = logo;
            document.getElementById('logo-picker-btn').innerText = logo;
        } else if (target === 'edit') {
            document.getElementById('edit-class-logo').value = logo;
            document.getElementById('edit-logo-picker-btn').innerText = logo;
        }
        hideModal('logo-picker-modal');
    }));
    showAnimatedModal('logo-picker-modal');
}
