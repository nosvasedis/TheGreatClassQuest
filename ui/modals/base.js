// /ui/modals/base.js

// --- IMPORTS ---
import { isSecretaryOfficeActive, openOfficeModal, closeOfficeModal } from '../../features/secretary/officeModal.js';
import { fetchLogsForDate, fetchAttendanceForMonth, fetchLogsForMonth } from '../../db/queries.js';
import { db, doc, getDocs, collection, query, where, orderBy, limit } from '../../firebase.js';

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
let currentlySelectedDayCell = null;
export function setCurrentlySelectedDayCell(cell) {
    currentlySelectedDayCell = cell;
}
export function getCurrentlySelectedDayCell() {
    return currentlySelectedDayCell;
}

// --- GENERIC MODAL FUNCTIONS ---

// Exit keyframes hideModal waits for (logo-picker-out = lighter exit for the emoji-heavy logo picker).
const MODAL_EXIT_ANIMATIONS = new Set(['modal-shell-pop-out', 'logo-picker-out']);

export function showAnimatedModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Inside the Secretary Office every modal shares the office's own open/close motion.
    if (isSecretaryOfficeActive() && modalId !== 'fortunes-wheel-modal') {
        openOfficeModal(modal);
        return;
    }
    modal.classList.remove('office-modal');

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
    const iconContainer = document.getElementById('modal-icon-container');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    // --- Dynamic Icons & Theming ---
    if (iconContainer) {
        iconContainer.classList.add('hidden');
        iconContainer.innerHTML = '';
        
        // Specific theme: Story Milestone
        if (title === 'Story Milestone!') {
            iconContainer.classList.remove('hidden');
            iconContainer.innerHTML = '⭐';
            // Enhance buttons for this theme
            confirmBtn.className = "w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-title text-lg py-3 px-6 rounded-2xl shadow-lg shadow-amber-100 transition-all active:scale-95 border-b-4 border-amber-700 active:border-b-0 bubbly-button";
            document.getElementById('modal-message').classList.remove('italic');
            document.getElementById('modal-message').classList.add('font-bold', 'text-indigo-900');
        } else if (title.includes('Delete') || title.includes('Purge') || title.includes('Reset')) {
            iconContainer.classList.remove('hidden');
            iconContainer.innerHTML = '⚠️';
            confirmBtn.className = "w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-title text-lg py-3 px-6 rounded-2xl shadow-lg shadow-rose-100 transition-all active:scale-95 border-b-4 border-rose-800 active:border-b-0 bubbly-button";
        } else {
            // Default premium blue/violet
            confirmBtn.className = "w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-title text-lg py-3 px-6 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-95 border-b-4 border-indigo-800 active:border-b-0 bubbly-button";
        }
    }

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

export function showTypedConfirmationModal({ title, message, expectedText, onConfirm, confirmText = 'Delete permanently' }) {
    const expected = String(expectedText || '');
    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const inputId = `typed-confirm-${Date.now()}`;
    showModal(
        title,
        `${message}
        <label for="${inputId}" class="mt-4 block text-left text-sm font-bold text-slate-700">
            Type <code class="rounded bg-slate-100 px-1.5 py-0.5 text-rose-700">${escapeHtml(expected)}</code> to continue
        </label>
        <input id="${inputId}" type="text" autocomplete="off" spellcheck="false"
            class="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200">`,
        onConfirm,
        confirmText,
        'Cancel'
    );
    const input = document.getElementById(inputId);
    const confirmButton = document.getElementById('modal-confirm-btn');
    if (!input || !confirmButton) return;
    confirmButton.disabled = true;
    confirmButton.classList.add('opacity-50', 'cursor-not-allowed');
    input.addEventListener('input', () => {
        const matches = input.value === expected;
        confirmButton.disabled = !matches;
        confirmButton.classList.toggle('opacity-50', !matches);
        confirmButton.classList.toggle('cursor-not-allowed', !matches);
    });
    requestAnimationFrame(() => input.focus());
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
    const releaseBackdrop = () => {
        if (modalId === 'logo-picker-modal') resumeLogoPickerBackdrop();
    };

    if (modal.classList.contains('office-modal')) {
        closeOfficeModal(modal, { onClosed: releaseBackdrop });
        if (currentlySelectedDayCell) {
            currentlySelectedDayCell.classList.remove('day-selected');
            currentlySelectedDayCell = null;
        }
        return;
    }

    if (innerContent) {
        if (reducedMotion) {
            modal.classList.add('hidden');
            releaseBackdrop();
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
                releaseBackdrop();
                modal.style.backgroundColor = '';
                modal.style.transition = '';
                modal.style.opacity = '';
                innerContent.classList.remove('is-modal-exiting', 'modal-origin-start');
            };

            const fallbackMs = 380;
            const fallback = setTimeout(finishClose, fallbackMs);
            innerContent.addEventListener('animationend', (e) => {
                if (e.target !== innerContent || !MODAL_EXIT_ANIMATIONS.has(e.animationName)) return;
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

// The picker walks the leagues in age order, grouped into the four stages of
// a hero's journey (QUEST_LEAGUE_DEFINITIONS' ageCategory).
const LEAGUE_PICKER_STAGES = [
    { key: 'early', title: 'Little Explorers', icon: 'fa-shapes' },
    { key: 'junior', title: 'Junior Adventurers', icon: 'fa-seedling' },
    { key: 'mid', title: 'Pathfinders', icon: 'fa-compass' },
    { key: 'senior', title: 'Champions', icon: 'fa-crown' }
];

function escapeLeaguePickerText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function leagueAgeLabel(ageGroup) {
    return String(ageGroup || '').replace('-', '–');
}

function leagueStageAgeLabel(definitions) {
    const first = String(definitions[0]?.ageGroup || '');
    const last = String(definitions[definitions.length - 1]?.ageGroup || '');
    const min = first.split('-')[0].replace('+', '');
    if (last.endsWith('+')) return `Ages ${min}+`;
    const max = last.split('-').pop();
    return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
}

function leaguePickerFollowHtml(scope, currentLeague) {
    if (scope !== 'leaderboard') return '';
    const classId = state.get('globalSelectedClassId');
    const activeClass = classId
        ? ((state.get('allSchoolClasses') || []).find((c) => c.id === classId)
            || (state.get('allTeachersClasses') || []).find((c) => c.id === classId))
        : null;
    const peeking = Boolean(state.get('leaderboardLeagueOverride'));
    if (!activeClass && !peeking) return '';

    const action = peeking
        ? `<button type="button" class="league-match-active-btn lp-follow__btn">
                <i class="fas fa-link" aria-hidden="true"></i><span>${activeClass ? 'Follow my class' : 'Back to my league'}</span>
            </button>`
        : `<span class="lp-follow__state"><i class="fas fa-circle-check" aria-hidden="true"></i>Following</span>`;
    const logo = activeClass?.logo
        ? `<span class="lp-follow__logo" aria-hidden="true">${activeClass.logo}</span>`
        : '<span class="lp-follow__logo lp-follow__logo--icon" aria-hidden="true"><i class="fas fa-chalkboard-teacher"></i></span>';
    const name = activeClass ? escapeLeaguePickerText(activeClass.name) : 'Your league';
    const league = activeClass?.questLevel
        ? `${escapeLeaguePickerText(activeClass.questLevel)} League`
        : 'Your selected class sets the league';
    const note = peeking && currentLeague
        ? `<span class="lp-follow__peek"><i class="fas fa-eye" aria-hidden="true"></i>Peeking at ${escapeLeaguePickerText(currentLeague)}</span>`
        : '';
    return `
        <div class="lp-follow${peeking ? ' is-peeking' : ''}">
            ${logo}
            <div class="lp-follow__copy">
                <span class="lp-follow__kicker">Active class</span>
                <span class="lp-follow__name font-title">${name}</span>
                <span class="lp-follow__league"><i class="fas fa-shield-halved" aria-hidden="true"></i>${league}${note}</span>
            </div>
            ${action}
        </div>`;
}

function leaguePickerCardHtml(definition, index, { currentLeague, classCounts, myCounts }) {
    const ageLabel = leagueAgeLabel(definition.ageGroup);
    const count = classCounts.get(definition.name) || 0;
    const mine = myCounts.get(definition.name) || 0;
    const isCurrent = definition.name === currentLeague;
    const countHtml = count
        ? `<span class="lp-card__count"><i class="fas fa-flag" aria-hidden="true"></i>${count} class${count === 1 ? '' : 'es'}</span>`
        : '<span class="lp-card__count lp-card__count--none">No classes yet</span>';
    const mineHtml = mine
        ? `<span class="lp-card__mine" title="${mine} of your classes race here"><i class="fas fa-star" aria-hidden="true"></i>${mine === 1 ? 'Your class' : `${mine} yours`}</span>`
        : '';
    const nowHtml = isCurrent
        ? '<span class="lp-card__now"><i class="fas fa-eye" aria-hidden="true"></i>Watching</span>'
        : '';
    const label = `${definition.name} league, ages ${ageLabel}, ${count || 'no'} class${count === 1 ? '' : 'es'}${mine ? `, ${mine} yours` : ''}${isCurrent ? ', currently shown' : ''}`;
    return `<button
            type="button"
            class="league-select-btn league-picker-option league-picker-option--${definition.pickerTheme} league-picker-motion--${definition.pickerMotion}${isCurrent ? ' is-current' : ''}${count ? '' : ' is-empty'}"
            style="--league-order:${index}"
            data-league="${escapeLeaguePickerText(definition.name)}"
            aria-pressed="${isCurrent ? 'true' : 'false'}"
            aria-label="${escapeLeaguePickerText(label)}"
        >
            <span class="league-picker-option__watermark" aria-hidden="true"><i class="fas ${definition.pickerIcon}"></i></span>
            <span class="league-picker-option__shine" aria-hidden="true"></span>
            ${nowHtml}
            <span class="lp-card__medal" aria-hidden="true"><i class="fas ${definition.pickerIcon}"></i></span>
            <span class="league-picker-option__label">${escapeLeaguePickerText(definition.name)}</span>
            <span class="league-picker-option__age">Ages ${ageLabel}</span>
            <span class="lp-card__meta">${countHtml}${mineHtml}</span>
            <span class="league-picker-option__spark league-picker-option__spark--one" aria-hidden="true"></span>
            <span class="league-picker-option__spark league-picker-option__spark--two" aria-hidden="true"></span>
            <span class="league-picker-option__spark league-picker-option__spark--three" aria-hidden="true"></span>
        </button>`;
}

export function showLeaguePicker(options = {}) {
    const scope = options.scope ?? 'leaderboard';
    const list = document.getElementById('league-picker-list');
    if (!list) return;

    // `is-selecting` is a short-lived click lock for the selection animation.
    // The list element itself survives modal closes, so always clear that lock
    // before rebuilding its buttons for a new picker session.
    list.classList.remove('is-selecting');

    const currentLeague = scope === 'leaderboard'
        ? state.getLeaderboardEffectiveLeague()
        : state.get('globalSelectedLeague');
    const classCounts = new Map();
    (state.get('allSchoolClasses') || []).forEach((c) => {
        if (c?.questLevel) classCounts.set(c.questLevel, (classCounts.get(c.questLevel) || 0) + 1);
    });
    const myCounts = new Map();
    (state.get('allTeachersClasses') || []).forEach((c) => {
        if (c?.questLevel) myCounts.set(c.questLevel, (myCounts.get(c.questLevel) || 0) + 1);
    });

    const chunks = [leaguePickerFollowHtml(scope, currentLeague)];
    let order = 0;
    LEAGUE_PICKER_STAGES.forEach((stage, stageIndex) => {
        const definitions = constants.QUEST_LEAGUE_DEFINITIONS.filter((d) => d.ageCategory === stage.key);
        if (!definitions.length) return;
        const cards = definitions
            .map((definition) => leaguePickerCardHtml(definition, order++, { currentLeague, classCounts, myCounts }))
            .join('');
        chunks.push(`
            <section class="lp-stage lp-stage--${stage.key}" style="--stage-i:${stageIndex}" aria-label="${escapeLeaguePickerText(stage.title)}">
                <div class="lp-stage__label">
                    <span class="lp-stage__icon" aria-hidden="true"><i class="fas ${stage.icon}"></i><b class="lp-stage__step">${stageIndex + 1}</b></span>
                    <span class="lp-stage__copy">
                        <span class="lp-stage__title font-title">${escapeLeaguePickerText(stage.title)}</span>
                        <span class="lp-stage__ages">${leagueStageAgeLabel(definitions)}</span>
                    </span>
                </div>
                <div class="lp-stage__grid">${cards}</div>
                ${stageIndex < LEAGUE_PICKER_STAGES.length - 1 ? '<span class="lp-stage__road" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>' : ''}
            </section>`);
    });
    list.innerHTML = chunks.join('');
    // Sound: bubbly-button global handler already plays click; avoid doubling.
    list.querySelector('.league-match-active-btn')?.addEventListener('click', () => {
        state.setLeaderboardLeagueOverride(null);
        hideModal('league-picker-modal');
    });
    list.querySelectorAll('.league-select-btn').forEach(btn => btn.addEventListener('click', () => {
        if (list.classList.contains('is-selecting')) return;
        list.classList.add('is-selecting');
        btn.classList.add('is-selected');
        window.setTimeout(() => {
            try {
                if (scope === 'leaderboard') {
                    state.setLeaderboardLeagueOverride(btn.dataset.league);
                } else {
                    state.setGlobalSelectedLeague(btn.dataset.league, true);
                }
            } finally {
                hideModal('league-picker-modal');
            }
        }, 360);
    }));
    showAnimatedModal('league-picker-modal');
    list.scrollTop = 0;
    // Land keyboard focus on the league being shown, so arrows/Tab start there.
    window.requestAnimationFrame(() => {
        list.querySelector('.league-select-btn.is-current')?.focus({ preventScroll: true });
    });
}

export function showLogoPicker(target) {
    logoPickerTarget = target || 'create';
    logoPickerCategory = 'all';
    logoPickerQuery = '';
    wireLogoPickerControls();
    ensureLogoPickerCatalog();

    const search = document.getElementById('logo-picker-search');
    if (search) search.value = '';

    syncLogoPickerSelection();
    applyLogoPickerFilter();
    freezeLogoPickerBackdrop();
    showAnimatedModal('logo-picker-modal');
    requestAnimationFrame(() => search?.focus({ preventScroll: true }));
    // Scrolling to the current emblem forces a full layout; wait until the entrance has finished.
    clearTimeout(logoPickerRevealTimer);
    logoPickerRevealTimer = setTimeout(() => {
        const selected = logoPickerSelectedButton;
        if (selected && !selected.hidden && selected.closest('[data-group]') !== logoPickerGroupEntries[0]?.group) {
            selected.scrollIntoView({ block: 'center' });
        }
    }, 220);
}

/** Build the (hidden) emblem grid ahead of time so the first open only has to paint it. */
export function prewarmLogoPicker() {
    if (logoPickerCatalogMounted) return;
    const run = () => ensureLogoPickerCatalog();
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 0);
}

let logoPickerFrozenAnimations = [];

/**
 * Pause the app's looping animations (nav clouds, header stars, fairy flight...) while the
 * emblem case covers them. Left running, they repaint and re-blur the whole screen under
 * the case on every frame, which is what made opening and scrolling it stutter.
 * Uses the Web Animations API so nothing else has to restyle.
 */
function freezeLogoPickerBackdrop() {
    if (logoPickerFrozenAnimations.length || typeof document.getAnimations !== 'function') return;
    const modal = document.getElementById('logo-picker-modal');
    const toasts = document.getElementById('toast-container');
    logoPickerFrozenAnimations = document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        if (animation.effect?.getTiming?.().iterations !== Infinity) return false;
        const target = animation.effect?.target;
        return !!target && !modal?.contains(target) && !toasts?.contains(target);
    });
    for (const animation of logoPickerFrozenAnimations) animation.pause();
}

function resumeLogoPickerBackdrop() {
    const frozen = logoPickerFrozenAnimations;
    logoPickerFrozenAnimations = [];
    for (const animation of frozen) {
        if (animation.playState === 'paused') animation.play();
    }
}

let logoPickerWired = false;
let logoPickerCatalogMounted = false;
let logoPickerTarget = 'create';
let logoPickerCategory = 'all';
let logoPickerQuery = '';
let logoPickerFilterRaf = 0;
let logoPickerRevealTimer = 0;
let logoPickerButtons = [];
let logoPickerButtonByLogo = new Map();
let logoPickerSelectedButton = null;
let logoPickerAppliedFilterKey = null;
let logoPickerGroupEntries = [];

function wireLogoPickerControls() {
    if (logoPickerWired) return;
    const modal = document.getElementById('logo-picker-modal');
    if (!modal) return;
    logoPickerWired = true;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal('logo-picker-modal');
            return;
        }
        const chip = event.target.closest('[data-logo-category]');
        if (chip) {
            logoPickerCategory = chip.dataset.logoCategory || 'all';
            syncLogoPickerChips();
            applyLogoPickerFilter();
            return;
        }
        const button = event.target.closest('.logo-select-btn');
        if (!button) return;
        playSound('click');
        applyLogoPickerChoice(button.dataset.logo);
        hideModal('logo-picker-modal');
    });

    document.getElementById('logo-picker-search')?.addEventListener('input', (event) => {
        logoPickerQuery = event.target.value || '';
        if (logoPickerFilterRaf) cancelAnimationFrame(logoPickerFilterRaf);
        logoPickerFilterRaf = requestAnimationFrame(() => {
            logoPickerFilterRaf = 0;
            applyLogoPickerFilter();
        });
    });

    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideModal('logo-picker-modal');
    });
}

function applyLogoPickerChoice(logo) {
    if (!logo) return;
    if (logoPickerTarget === 'edit') {
        const input = document.getElementById('edit-class-logo');
        const button = document.getElementById('edit-logo-picker-btn');
        if (input) input.value = logo;
        if (button) button.innerText = logo;
        return;
    }
    if (logoPickerTarget === 'setup') {
        const input = document.getElementById('setup-class-logo');
        const preview = document.getElementById('setup-class-logo-preview');
        if (input) input.value = logo;
        if (preview) preview.textContent = logo;
        return;
    }
    if (logoPickerTarget === 'secretary') {
        const input = document.getElementById('class-desk-logo');
        const button = document.getElementById('class-desk-logo-btn');
        if (input) input.value = logo;
        if (button) button.innerText = logo;
        document.dispatchEvent(new CustomEvent('class-desk-logo-picked', { detail: { logo } }));
        return;
    }
    const input = document.getElementById('class-logo');
    const button = document.getElementById('logo-picker-btn');
    if (input) input.value = logo;
    if (button) button.innerText = logo;
}

function getLogoPickerCurrentLogo() {
    if (logoPickerTarget === 'edit') return document.getElementById('edit-class-logo')?.value || '📚';
    if (logoPickerTarget === 'setup') return document.getElementById('setup-class-logo')?.value || '📚';
    if (logoPickerTarget === 'secretary') return document.getElementById('class-desk-logo')?.value || '📚';
    return document.getElementById('class-logo')?.value || '📚';
}

function escapeLogoPickerText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function ensureLogoPickerCatalog() {
    const list = document.getElementById('logo-picker-list');
    const chips = document.getElementById('logo-picker-categories');
    if (!list || !chips) return;
    if (logoPickerCatalogMounted && logoPickerButtons.length) return;

    chips.innerHTML = [
        { id: 'all', label: 'All', icon: '✨' },
        ...constants.classLogoCategories.map((category) => ({
            id: category.id,
            label: category.label,
            icon: category.icon
        }))
    ].map((chip) => (
        `<button type="button" class="logo-picker-chip" data-logo-category="${chip.id}" aria-pressed="false"><span aria-hidden="true">${chip.icon}</span><span>${escapeLogoPickerText(chip.label)}</span></button>`
    )).join('');

    list.innerHTML = constants.classLogoCategories.map((category) => {
        const buttons = category.items.map((item) => {
            const label = escapeLogoPickerText(item.name);
            const search = [item.emoji, item.name, category.id, category.label, ...item.keywords]
                .join(' ')
                .toLowerCase();
            return `<button type="button" class="logo-select-btn" data-logo="${item.emoji}" data-search="${escapeLogoPickerText(search)}" title="${label}" aria-label="${label}" aria-pressed="false">${item.emoji}</button>`;
        }).join('');
        return `<section class="logo-picker-group" data-group="${category.id}">
            <h3 class="logo-picker-group__title"><span aria-hidden="true">${category.icon}</span>${escapeLogoPickerText(category.label)}</h3>
            <div class="logo-picker-grid">${buttons}</div>
        </section>`;
    }).join('');

    logoPickerButtons = list.querySelectorAll('.logo-select-btn');
    logoPickerButtonByLogo = new Map();
    for (const button of logoPickerButtons) {
        if (!logoPickerButtonByLogo.has(button.dataset.logo)) logoPickerButtonByLogo.set(button.dataset.logo, button);
    }
    logoPickerSelectedButton = null;
    logoPickerAppliedFilterKey = null;
    logoPickerGroupEntries = [];
    for (const group of list.querySelectorAll('.logo-picker-group')) {
        logoPickerGroupEntries.push({
            group,
            buttons: group.querySelectorAll('.logo-select-btn')
        });
    }
    logoPickerCatalogMounted = true;
}

function syncLogoPickerChips() {
    const chips = document.getElementById('logo-picker-categories');
    if (!chips) return;
    for (const chip of chips.children) {
        const isActive = chip.dataset.logoCategory === logoPickerCategory;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
}

function syncLogoPickerSelection() {
    const selectedLogo = getLogoPickerCurrentLogo();
    const preview = document.getElementById('logo-picker-preview');
    if (preview) preview.textContent = selectedLogo;

    // Only the previous and the new selection change; touching all ~400 tiles invalidates their style.
    const next = logoPickerButtonByLogo.get(selectedLogo) || null;
    if (next === logoPickerSelectedButton) return;
    if (logoPickerSelectedButton) {
        logoPickerSelectedButton.classList.remove('is-selected');
        logoPickerSelectedButton.setAttribute('aria-pressed', 'false');
    }
    if (next) {
        next.classList.add('is-selected');
        next.setAttribute('aria-pressed', 'true');
    }
    logoPickerSelectedButton = next;
}

function applyLogoPickerFilter() {
    const list = document.getElementById('logo-picker-list');
    const empty = document.getElementById('logo-picker-empty');
    if (!list) return;

    const query = String(logoPickerQuery || '').trim().toLowerCase();
    const filterKey = `${logoPickerCategory}\u0000${query}`;
    if (filterKey === logoPickerAppliedFilterKey) {
        // Nothing to re-filter (e.g. reopening on "All"): skip ~400 DOM writes.
        list.scrollTop = 0;
        syncLogoPickerChips();
        return;
    }
    logoPickerAppliedFilterKey = filterKey;
    let visibleCount = 0;

    for (const { group, buttons } of logoPickerGroupEntries) {
        const categoryMatch = logoPickerCategory === 'all' || group.dataset.group === logoPickerCategory;
        let groupVisible = 0;
        for (const button of buttons) {
            const matches = categoryMatch && (!query || (button.dataset.search || '').includes(query));
            if (button.hidden === matches) button.hidden = !matches;
            if (matches) groupVisible += 1;
        }
        const groupHidden = groupVisible === 0;
        if (group.hidden !== groupHidden) group.hidden = groupHidden;
        visibleCount += groupVisible;
    }

    const isEmpty = visibleCount === 0;
    list.classList.toggle('hidden', isEmpty);
    empty?.classList.toggle('hidden', !isEmpty);
    if (!isEmpty) list.scrollTop = 0;
    syncLogoPickerChips();
}
