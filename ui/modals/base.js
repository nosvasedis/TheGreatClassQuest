// /ui/modals/base.js

// --- IMPORTS ---
import { fetchLogsForDate, fetchAttendanceForMonth, fetchLogsForMonth } from '../../db/queries.js';
import { db } from '../../firebase.js';
import { doc, getDocs, collection, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// State and Constants
import * as state from '../../state.js';
import { fetchMonthlyHistory } from '../../state.js';
import * as constants from '../../constants.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';

// Actions and Effects
import { playSound } from '../../audio.js';
import { callGeminiApi } from '../../api.js';
import { showToast, showPraiseToast } from '../effects.js';
import { isSpeaking, stopSpeech } from '../../features/tts.js';
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
    handleBatchAwardBonus,
    addOrUpdateHeroChronicleNote,
    handleRemoveAttendanceColumn,
    deleteHeroChronicleNote,
    ensureHistoryLoaded
} from '../../db/actions.js';

// Helper function to populate date dropdowns
export function populateDateDropdowns(monthSelectId, daySelectId, dateString) { // dateString is YYYY-MM-DD
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
export function setCurrentlySelectedDayCell(cell) {
    currentlySelectedDayCell = cell;
}
export function getCurrentlySelectedDayCell() {
    return currentlySelectedDayCell;
}

// --- GENERIC MODAL FUNCTIONS ---

export function showAnimatedModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const innerContent = modal.querySelector('.pop-in');
    innerContent?.classList.remove('is-modal-exiting', 'modal-origin-start', 'pop-out');
    modal.style.backgroundColor = '';
    modal.style.transition = '';
    modal.style.opacity = '';

    if (modalId === 'fortunes-wheel-modal' && innerContent) {
        innerContent.classList.remove('fw-card--exit', 'modal-origin-start', 'pop-out');
        innerContent.classList.remove('fw-card--enter');
        modal.querySelector('.fw-backdrop')?.classList.remove('fw-backdrop--exit');
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        innerContent.classList.add('fw-card--enter');
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            innerContent.classList.remove('fw-card--enter');
            return;
        }
        const onEnterEnd = (e) => {
            if (e.target !== innerContent || e.animationName !== 'fw-relic-open') return;
            innerContent.classList.remove('fw-card--enter');
            innerContent.removeEventListener('animationend', onEnterEnd);
        };
        innerContent.addEventListener('animationend', onEnterEnd);
        return;
    }

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


export function showModal(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', onCancel = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerHTML = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newConfirmBtn.addEventListener('click', () => {
        playSound('click');
        if (onConfirm) onConfirm();
        hideModal('confirmation-modal');
    });
    newCancelBtn.addEventListener('click', () => {
        playSound('click');
        if (onCancel) onCancel();
        hideModal('confirmation-modal');
    });
    showAnimatedModal('confirmation-modal');
}

export function hideModal(modalId) {
    if (modalId === 'quest-update-modal' || modalId === 'storybook-viewer-modal') {
        const btn = modalId === 'quest-update-modal' ? document.getElementById('play-narrative-btn') : document.getElementById('storybook-viewer-play-btn');
        if (isSpeaking()) {
            stopSpeech();
        }
        if (btn) btn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> ${modalId === 'storybook-viewer-modal' ? 'Narrate Story' : 'Play Commentary'}`;
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

    if (modalId === 'fortunes-wheel-modal') {
        const backdrop = modal.querySelector('.fw-backdrop');
        backdrop?.classList.add('fw-backdrop--exit');
        if (innerContent) {
            innerContent.classList.remove('fw-card--enter', 'modal-origin-start');
            innerContent.classList.add('fw-card--exit');
        }

        const finishFwClose = () => {
            modal.classList.add('hidden');
            modal.style.backgroundColor = '';
            modal.style.transition = '';
            modal.style.opacity = '';
            innerContent?.classList.remove('fw-card--exit', 'modal-origin-start');
            backdrop?.classList.remove('fw-backdrop--exit');
        };

        let fwClosed = false;
        const settleFw = () => {
            if (fwClosed) return;
            fwClosed = true;
            finishFwClose();
        };

        const fwFallbackMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 240 : 520;
        const fwFallback = setTimeout(settleFw, fwFallbackMs);
        if (innerContent) {
            innerContent.addEventListener('animationend', (e) => {
                if (e.target === innerContent && e.animationName === 'fw-relic-close') {
                    clearTimeout(fwFallback);
                    settleFw();
                }
            }, { once: true });
        } else {
            clearTimeout(fwFallback);
            settleFw();
        }

        if (currentlySelectedDayCell) {
            currentlySelectedDayCell.classList.remove('day-selected');
            currentlySelectedDayCell = null;
        }
        return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (innerContent) {
        if (reducedMotion) {
            modal.classList.add('hidden');
            innerContent.classList.remove('is-modal-exiting', 'modal-origin-start');
        } else {
            innerContent.classList.add('is-modal-exiting');
            modal.style.transition = 'background-color 0.32s ease';
            requestAnimationFrame(() => {
                modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';
            });

            let settled = false;
            const finishClose = () => {
                if (settled) return;
                settled = true;
                modal.classList.add('hidden');
                modal.style.backgroundColor = '';
                modal.style.transition = '';
                modal.style.opacity = '';
                innerContent.classList.remove('is-modal-exiting', 'modal-origin-start');
            };

            const fallbackMs = 380;
            const fallback = setTimeout(finishClose, fallbackMs);
            innerContent.addEventListener('animationend', (e) => {
                if (e.target !== innerContent || e.animationName !== 'modal-shell-pop-out') return;
                clearTimeout(fallback);
                finishClose();
            }, { once: true });
        }
    } else {
        modal.style.transition = 'opacity 0.25s ease';
        modal.style.opacity = '0';

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.backgroundColor = '';
            modal.style.transition = '';
            modal.style.opacity = '';
        }, 250);
    }

    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
        currentlySelectedDayCell = null;
    }
}


// --- PICKER MODALS ---

export function showLeaguePicker(options = {}) {
    const scope = options.scope ?? 'leaderboard';
    const list = document.getElementById('league-picker-list');
    const chunks = [];
    if (scope === 'leaderboard') {
        chunks.push(`<button type="button" class="league-match-active-btn w-full col-span-2 p-3 font-title text-base text-emerald-900 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow border-2 border-emerald-200 transition hover:from-emerald-100 hover:to-teal-100 bubbly-button">
            <i class="fas fa-link text-emerald-600 mr-2"></i>Use active class&rsquo;s league
        </button>`);
    }
    chunks.push(...constants.questLeagues.map(league => `<button type="button" class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${league}">${league}</button>`));
    list.innerHTML = chunks.join('');
    // Sound: bubbly-button global handler already plays click; avoid doubling.
    list.querySelector('.league-match-active-btn')?.addEventListener('click', () => {
        state.setLeaderboardLeagueOverride(null);
        hideModal('league-picker-modal');
    });
    list.querySelectorAll('.league-select-btn').forEach(btn => btn.addEventListener('click', () => {
        if (scope === 'leaderboard') {
            state.setLeaderboardLeagueOverride(btn.dataset.league);
        } else {
            state.setGlobalSelectedLeague(btn.dataset.league, true);
        }
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
