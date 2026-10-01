// /ui/modals/heroClass.js — Hero Class selection ceremony

import * as state from '../../state.js';
import { HERO_CLASSES, heroClassChangesRemaining, heroClassLockApplies } from '../../features/heroClasses.js';
import { getReasonDisplayName, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
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
let heldClass = null;

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

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const CLASS_MOTTOS = {
    Guardian: 'Stands tall and keeps every friend safe.',
    Sage: 'Dreams up ideas nobody has seen before.',
    Paladin: 'Leads the guild, shoulder to shoulder.',
    Artificer: 'Builds greatness one careful step at a time.',
    Scholar: 'Turns every trial into treasure.',
    Weaver: 'Spins stories that light up the room.',
    Nomad: 'Always finds the way back to the quest.',
    Patron: 'Grows stronger by giving to others.'
};

function numeralFor(className) {
    return NUMERALS[CLASS_NAMES.indexOf(className)] || '';
}

function cardStyle(info, index = 0) {
    return `--card-accent:${info.theme.accent};--card-accent-rgb:${info.theme.rgb};--i:${index};`;
}

function cardFaceHTML(className) {
    const info = HERO_CLASSES[className];
    const virtue = getReasonDisplayName(info.reason);
    return `<span class="hcs-card-face">
            <span class="hcs-card-numeral">${numeralFor(className)}</span>
            <span class="hcs-card-art"><span class="hcs-card-sigil">${info.icon}</span></span>
            <span class="hcs-card-name">${escapeHtml(className)}</span>
            <span class="hcs-card-virtue">${escapeHtml(virtue)}</span>
        </span>`;
}

function ranksHTML(className) {
    const titles = HERO_SKILL_TREE[className]?.titles || [];
    if (!titles.length) return '';
    return `<p class="hcs-pathranks-label">Ranks on this path</p>
        <ol class="hcs-pathranks-list">${titles.map((title, i) => `<li><span class="hcs-rank-step">${i + 1}</span>${escapeHtml(title)}</li>`).join('')}</ol>`;
}

function applyShellTheme(className) {
    const shell = document.getElementById('hcs-shell');
    if (!shell) return;

    const info = HERO_CLASSES[className];
    if (!info) {
        shell.removeAttribute('data-theme');
        shell.style.removeProperty('--hcs-accent');
        shell.style.removeProperty('--hcs-accent-rgb');
        return;
    }

    shell.dataset.theme = className;
    shell.style.setProperty('--hcs-accent', info.theme.accent);
    shell.style.setProperty('--hcs-accent-rgb', info.theme.rgb);
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
        const virtue = getReasonDisplayName(info.reason);
        return `<button type="button"
            class="hcs-card"
            role="option"
            aria-selected="false"
            aria-label="${escapeHtml(`${name}, ${virtue}`)}"
            data-class="${name}"
            data-index="${index}"
            style="${cardStyle(info, index)}">
            ${cardFaceHTML(name)}
            ${name === heldClass ? '<span class="hcs-card-current">Your path</span>' : ''}
            <span class="hcs-card-check" aria-hidden="true"><i class="fas fa-check"></i></span>
        </button>`;
    }).join('');

    // Deal the cards onto the cloth once per opening.
    mount.classList.remove('is-dealing', 'has-choice');
    void mount.offsetWidth;
    mount.classList.add('is-dealing');
    window.setTimeout(() => mount.classList.remove('is-dealing'), 1100);
}

function syncSelection() {
    const mount = document.getElementById('hcs-cards');
    if (!mount) return;
    mount.classList.toggle('has-choice', Boolean(previewClass));
    mount.querySelectorAll('.hcs-card').forEach((card) => {
        const selected = card.dataset.class === previewClass;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
}

function renderReading() {
    const mount = document.getElementById('hcs-reading');
    if (!mount) return;
    const info = HERO_CLASSES[previewClass];
    if (!info) {
        mount.classList.remove('has-reading');
        mount.style.cssText = '';
        mount.innerHTML = `<div class="hcs-reading-empty">
                <div class="hcs-cardback" aria-hidden="true"><span>✦</span></div>
                <div>
                    <p class="hcs-reading-prompt">Every hero walks one path.</p>
                    <p class="hcs-reading-hint">Tap a card to read its fortune.</p>
                </div>
            </div>`;
        return;
    }
    mount.classList.add('has-reading');
    mount.style.cssText = cardStyle(info);
    mount.innerHTML = `<div class="hcs-reading-card">
            <p class="hcs-reading-numeral">${numeralFor(previewClass)}</p>
            <h3 class="hcs-reading-name"><span aria-hidden="true">${info.icon}</span> The ${escapeHtml(previewClass)}</h3>
            <p class="hcs-reading-motto">${escapeHtml(CLASS_MOTTOS[previewClass] || '')}</p>
            <dl class="hcs-reading-facts">
                <div><dt>Virtue</dt><dd><span class="hcs-virtue-chip">${escapeHtml(getReasonDisplayName(info.reason))}</span></dd></div>
                <div><dt>Reward</dt><dd class="hcs-reward"><span class="hcs-coin" aria-hidden="true"></span>${escapeHtml(info.desc)}</dd></div>
            </dl>
            <div class="hcs-pathranks">${ranksHTML(previewClass)}</div>
        </div>`;
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
    syncSelection();
    renderReading();
    updateSwearButton();
    playSound('click');
}

function fillResult(className, { shrine = false, studentName = '' } = {}) {
    const info = HERO_CLASSES[className];
    if (!info) return;
    applyShellTheme(className);
    const article = /^[AEIOU]/i.test(className) ? 'an' : 'a';
    const titleEl = document.getElementById('hcs-result-title');
    const nameEl = document.getElementById('hcs-result-name');
    const virtueEl = document.getElementById('hcs-result-virtue');
    const perkEl = document.getElementById('hcs-result-perk');
    const emblemEl = document.getElementById('hcs-result-emblem');
    const ranksEl = document.getElementById('hcs-result-ranks');
    const doneBtn = document.getElementById('hcs-done-btn');
    const kickerEl = document.getElementById('hcs-result-kicker');
    const name = studentName || getStudent(currentStudentId)?.name || '';

    if (titleEl) titleEl.textContent = shrine ? `The path of the ${className}` : `You are ${article} ${className}!`;
    if (nameEl) {
        nameEl.textContent = name || className;
    }
    if (virtueEl) virtueEl.textContent = `Virtue of ${getReasonDisplayName(info.reason)}`;
    if (perkEl) perkEl.textContent = info.desc;
    if (emblemEl) {
        emblemEl.style.cssText = cardStyle(info);
        emblemEl.innerHTML = `<div class="hcs-card hcs-card--hero" style="${cardStyle(info)}">${cardFaceHTML(className)}</div>`;
    }
    if (ranksEl) ranksEl.innerHTML = ranksHTML(className);
    if (kickerEl) kickerEl.textContent = shrine ? 'Sworn for this school year' : 'Your card is drawn';
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
    const focused = cards.indexOf(document.activeElement);
    const currentIndex = focused >= 0 ? focused : cards.findIndex((card) => card.classList.contains('is-selected'));
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
    heldClass = HERO_CLASSES[student.heroClass] ? student.heroClass : null;

    const nameEl = document.getElementById('hcs-student-name');
    if (nameEl) nameEl.textContent = student.name || '';

    const banner = document.getElementById('hcs-lock-banner');
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

    const pathLocked = heroClassLockApplies(student, state.getActiveSchoolYearKey());
    if (pathLocked && student.heroClass && HERO_CLASSES[student.heroClass]) {
        fillResult(student.heroClass, { shrine: true, studentName: student.name });
        setMode('shrine');
        if (banner) banner.classList.add('hidden');
    } else {
        applyShellTheme(null);
        if (banner) {
            const showWarn = Boolean(student.heroClass && !pathLocked);
            banner.classList.toggle('hidden', !showWarn);
            if (showWarn) {
                const remaining = heroClassChangesRemaining(student, state.getActiveSchoolYearKey());
                banner.textContent = remaining === 1
                    ? `You are a ${student.heroClass}. You have one class change left this school year.`
                    : `You are a ${student.heroClass}. You keep this class, and you can change it twice this school year.`;
            }
        }
        renderCards();
        renderReading();
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
