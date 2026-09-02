// /ui/modals/heroClass.js — Hero Class selection ceremony

import * as state from '../../state.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getReasonDisplayName } from '../../features/heroSkillTree.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { showAnimatedModal, hideModal } from './base.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';

const MODAL_ID = 'hero-class-select-modal';
const CLASS_NAMES = Object.keys(HERO_CLASSES);

let currentStudentId = null;
let previewClass = null;
let restoreEditStudentId = null;
let listenersWired = false;
let ceremonyMode = 'pick';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getStudent(studentId) {
    return (state.get('allStudents') || []).find((s) => s.id === studentId) || null;
}

function applyShellTheme(className) {
    const shell = document.getElementById('hcs-shell');
    const watermark = document.getElementById('hcs-watermark');
    const headerEmoji = document.getElementById('hcs-header-emoji');
    if (!shell) return;

    const info = HERO_CLASSES[className];
    if (!info) {
        shell.removeAttribute('data-theme');
        shell.style.removeProperty('--hcs-accent');
        shell.style.removeProperty('--hcs-accent-rgb');
        if (watermark) watermark.textContent = '⚔️';
        if (headerEmoji) headerEmoji.textContent = '⚔️';
        return;
    }

    shell.dataset.theme = className;
    shell.style.setProperty('--hcs-accent', info.theme.accent);
    shell.style.setProperty('--hcs-accent-rgb', info.theme.rgb);
    if (watermark) watermark.textContent = info.icon;
    if (headerEmoji) headerEmoji.textContent = info.icon;
}

function setMode(mode) {
    ceremonyMode = mode;
    const shell = document.getElementById('hcs-shell');
    if (shell) shell.dataset.mode = mode;
}

function renderCards() {
    const mount = document.getElementById('hcs-cards');
    if (!mount) return;

    mount.innerHTML = CLASS_NAMES.map((name, index) => {
        const info = HERO_CLASSES[name];
        const selected = previewClass === name;
        const virtue = getReasonDisplayName(info.reason);
        return `<button type="button"
            class="hcs-card${selected ? ' is-selected' : ''}"
            role="option"
            aria-selected="${selected ? 'true' : 'false'}"
            data-class="${name}"
            data-index="${index}"
            style="--card-accent:${info.theme.accent};--card-accent-rgb:${info.theme.rgb};">
            <div class="hcs-card-top">
                <span class="hcs-card-icon">${info.icon}</span>
                <span class="hcs-card-check" aria-hidden="true"><i class="fas fa-check"></i></span>
            </div>
            <span class="hcs-card-name">${escapeHtml(name)}</span>
            <span class="hcs-card-virtue">${escapeHtml(virtue)}</span>
            <span class="hcs-card-perk">${escapeHtml(info.desc)}</span>
        </button>`;
    }).join('');
}

function updateSwearButton() {
    const swearBtn = document.getElementById('hcs-swear-btn');
    if (!swearBtn) return;
    swearBtn.disabled = !previewClass || ceremonyMode !== 'pick';
}

function preview(className) {
    if (!HERO_CLASSES[className]) return;
    previewClass = className;
    applyShellTheme(className);
    const subtitle = document.getElementById('hcs-subtitle');
    if (subtitle) subtitle.textContent = `The path of the ${className}`;
    renderCards();
    updateSwearButton();
    playSound('click');
}

function fillResult(className, { shrine = false } = {}) {
    const info = HERO_CLASSES[className];
    if (!info) return;
    applyShellTheme(className);
    const article = /^[AEIOU]/i.test(className) ? 'an' : 'a';
    const titleEl = document.getElementById('hcs-result-title');
    const nameEl = document.getElementById('hcs-result-name');
    const virtueEl = document.getElementById('hcs-result-virtue');
    const perkEl = document.getElementById('hcs-result-perk');
    const emblemEl = document.getElementById('hcs-result-emblem');
    const doneBtn = document.getElementById('hcs-done-btn');
    const kickerEl = document.getElementById('hcs-result-kicker');

    if (titleEl) titleEl.textContent = shrine ? 'Your Path' : `You are ${article} ${className}!`;
    if (nameEl) nameEl.textContent = `${info.icon} ${className}`;
    if (virtueEl) virtueEl.textContent = getReasonDisplayName(info.reason);
    if (perkEl) perkEl.textContent = info.desc;
    if (emblemEl) emblemEl.textContent = info.icon;
    if (kickerEl) kickerEl.textContent = shrine ? 'Hero Path locked' : 'Hero Path';
    if (doneBtn) doneBtn.textContent = shrine ? 'Close' : "Let's Go!";
}

async function refreshRosterIfVisible() {
    const tabs = await import('../tabs.js');
    tabs.renderManageStudentsTab?.();
}

async function finishClose() {
    hideModal(MODAL_ID);
    const restoreId = restoreEditStudentId;
    restoreEditStudentId = null;
    currentStudentId = null;
    previewClass = null;
    if (restoreId) {
        const { openEditStudentModal } = await import('./student.js');
        openEditStudentModal(restoreId, { tab: 'hero' });
        return;
    }
    await refreshRosterIfVisible();
}

async function swearPath() {
    if (!previewClass || !currentStudentId) return;
    const swearBtn = document.getElementById('hcs-swear-btn');
    if (swearBtn) {
        swearBtn.disabled = true;
        swearBtn.textContent = 'Swearing…';
    }
    try {
        const { saveStudentHeroClass } = await import('../../db/actions.js');
        const result = await saveStudentHeroClass(currentStudentId, previewClass);
        if (!result?.saved) {
            if (swearBtn) {
                swearBtn.disabled = false;
                swearBtn.textContent = 'Swear this Path';
            }
            return;
        }
        playSound('magic_chime');
        fillResult(previewClass, { shrine: false });
        setMode('result');
    } catch (error) {
        console.error('Hero Class ceremony failed:', error);
        showToast(error?.message || 'Could not swear this path.', 'error');
        if (swearBtn) {
            swearBtn.disabled = false;
            swearBtn.textContent = 'Swear this Path';
        }
    }
}

function focusCardByOffset(offset) {
    const cards = [...document.querySelectorAll('#hcs-cards .hcs-card')];
    if (!cards.length) return;
    const currentIndex = cards.findIndex((card) => card.classList.contains('is-selected') || card === document.activeElement);
    const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + offset + cards.length) % cards.length;
    cards[nextIndex].focus();
}

function wireListeners() {
    if (listenersWired) return;
    listenersWired = true;

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    document.getElementById('hcs-cards')?.addEventListener('click', (event) => {
        const card = event.target.closest('.hcs-card');
        if (!card || ceremonyMode !== 'pick') return;
        preview(card.dataset.class);
    });

    document.getElementById('hcs-swear-btn')?.addEventListener('click', () => {
        swearPath();
    });

    document.getElementById('hcs-cancel-btn')?.addEventListener('click', () => {
        finishClose();
    });
    document.getElementById('hcs-close-btn')?.addEventListener('click', () => {
        finishClose();
    });
    document.getElementById('hcs-done-btn')?.addEventListener('click', () => {
        finishClose();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.classList.contains('hcs-backdrop')) {
            if (ceremonyMode === 'pick') finishClose();
        }
    });

    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            finishClose();
            return;
        }
        if (ceremonyMode !== 'pick') return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            focusCardByOffset(1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusCardByOffset(-1);
        } else if (event.key === 'Enter' && document.activeElement?.classList.contains('hcs-card')) {
            event.preventDefault();
            preview(document.activeElement.dataset.class);
        }
    });
}

export function openHeroClassSelectModal(studentId, options = {}) {
    if (!canUseFeature('heroProgression')) {
        showUpgradePrompt({
            feature: 'Hero Classes & Skill Tree',
            tier: 'Pro',
            message: getUpgradeMessage('Pro', 'heroProgression')
        });
        return;
    }

    const student = getStudent(studentId);
    if (!student) return;

    wireListeners();
    currentStudentId = studentId;
    restoreEditStudentId = options.restoreEditStudent ? studentId : null;
    previewClass = null;

    const nameEl = document.getElementById('hcs-student-name');
    if (nameEl) nameEl.textContent = student.name || '';

    const banner = document.getElementById('hcs-lock-banner');
    const subtitle = document.getElementById('hcs-subtitle');
    const swearBtn = document.getElementById('hcs-swear-btn');
    if (swearBtn) swearBtn.textContent = 'Swear this Path';

    if (options.restoreEditStudent) {
        const edit = document.getElementById('edit-student-modal');
        if (edit) {
            edit.classList.add('hidden');
            edit.querySelector('.pop-in')?.classList.remove('is-modal-exiting', 'modal-origin-start', 'pop-out');
            edit.style.backgroundColor = '';
            edit.style.transition = '';
            edit.style.opacity = '';
        }
    }

    if (student.isHeroClassLocked && student.heroClass && HERO_CLASSES[student.heroClass]) {
        fillResult(student.heroClass, { shrine: true });
        setMode('shrine');
        if (banner) banner.classList.add('hidden');
    } else {
        applyShellTheme(null);
        if (subtitle) subtitle.textContent = 'Who will you become?';
        if (banner) {
            const showWarn = Boolean(student.heroClass && !student.isHeroClassLocked);
            banner.classList.toggle('hidden', !showWarn);
            if (showWarn) {
                banner.textContent = `You are a ${student.heroClass}. This is your one change — after this, the path locks.`;
            }
        }
        renderCards();
        updateSwearButton();
        setMode('pick');
    }

    showAnimatedModal(MODAL_ID);
}

export function closeHeroClassSelectModal() {
    finishClose();
}

export function wireHeroClassSelectModal() {
    wireListeners();
}
