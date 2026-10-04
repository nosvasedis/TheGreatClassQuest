// /ui/modals/trophyRoom.js — Trophy Room modal (a student's satchel)
// Model: features/trophyRoomCore.mjs. Markup: ui/modals/trophyRoomView.js.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import { showAnimatedModal } from './base.js';
import { currentArtifactFor, handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { showInventoryItemDetail } from '../core/avatar.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { buildTrophySatchel, summarizeSatchel, buildActiveEffects } from '../../features/trophyRoomCore.mjs';
import { renderTrophyRosterHtml, renderTrophyIdleHtml, renderTrophySatchelHtml } from './trophyRoomView.js';
import '../../styles/hero_seals.css';
import { buildSealBookView } from '../../features/heroSealsCore.mjs';
import { ensureHeroSealsForClass } from '../../features/heroSeals.js';

const MODAL_ID = 'trophy-room-modal';
const CONTENT_ID = 'trophy-room-content';
const ROSTER_ID = 'trophy-room-roster';
const SWITCH_CLASS = 'tr-satchel--enter';

let currentClassId = '';
let currentStudentId = '';
let listenersBound = false;

const usable = { isUsable: isItemUsable, present: currentArtifactFor };

function findStudent(studentId) {
    return (state.get('allStudents') || []).find((s) => s.id === studentId) || null;
}

function findScore(studentId) {
    return (state.get('allStudentScores') || []).find((s) => s.id === studentId) || null;
}

function findClass(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function classLabel(cls) {
    return [cls?.logo, cls?.name].filter(Boolean).join(' ');
}

function classStudents(classId) {
    return (state.get('allStudents') || [])
        .filter((s) => s.classId === classId)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function rosterEntries(classId) {
    return classStudents(classId).map((s) => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar || '',
        ...summarizeSatchel(findScore(s.id)?.inventory, usable),
    }));
}

function isOpen() {
    const modal = document.getElementById(MODAL_ID);
    return !!modal && !modal.classList.contains('hidden');
}

function renderRoster() {
    const rosterEl = document.getElementById(ROSTER_ID);
    if (!rosterEl) return [];
    const entries = rosterEntries(currentClassId);
    const keepScroll = rosterEl.scrollTop;
    rosterEl.innerHTML = renderTrophyRosterHtml(entries, currentStudentId);
    rosterEl.scrollTop = keepScroll;

    const cls = findClass(currentClassId);
    const subtitle = document.getElementById('trophy-room-subtitle');
    if (subtitle) {
        const heroes = `${entries.length} hero${entries.length === 1 ? '' : 'es'}`;
        subtitle.textContent = cls ? `${classLabel(cls)} · ${heroes}` : heroes;
    }
    return entries;
}

function renderSatchel({ animate = false, keepScroll = false } = {}) {
    const contentEl = document.getElementById(CONTENT_ID);
    if (!contentEl) return;
    const scrollTop = contentEl.scrollTop;

    const student = currentStudentId ? findStudent(currentStudentId) : null;
    if (!student) {
        const entries = rosterEntries(currentClassId);
        contentEl.innerHTML = renderTrophyIdleHtml({
            heroCount: entries.length,
            itemCount: entries.reduce((sum, e) => sum + e.total, 0),
            readyCount: entries.reduce((sum, e) => sum + e.ready, 0),
        });
        contentEl.scrollTop = 0;
        return;
    }

    const scoreData = findScore(student.id);
    contentEl.innerHTML = renderTrophySatchelHtml({
        student: {
            id: student.id,
            name: student.name,
            avatar: student.avatar || '',
        },
        classLabel: classLabel(findClass(student.classId)),
        gold: getLiveYearGoldFromAppState(scoreData, state),
        satchel: buildTrophySatchel(scoreData?.inventory, usable),
        effects: buildActiveEffects(scoreData, utils.getLocalMonthKey()),
        seals: buildSealBookView({ student, heroSeals: scoreData?.heroSeals || null }),
    });
    contentEl.scrollTop = keepScroll ? scrollTop : 0;

    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const satchel = contentEl.querySelector('.tr-satchel');
        satchel?.classList.add(SWITCH_CLASS);
        satchel?.addEventListener('animationend', () => satchel.classList.remove(SWITCH_CLASS), { once: true });
    }
}

function selectStudent(studentId, { focus = false } = {}) {
    if (studentId === currentStudentId) return;
    currentStudentId = studentId || '';
    renderRoster();
    renderSatchel({ animate: true });
    if (focus) {
        document.querySelector(`#${ROSTER_ID} .tr-roster-item.is-selected`)?.focus();
    }
    document.querySelector(`#${ROSTER_ID} .tr-roster-item.is-selected`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

async function useRelic(btn) {
    const studentId = btn.dataset.studentId;
    const index = Number.parseInt(btn.dataset.itemIndex, 10);
    if (!studentId || Number.isNaN(index)) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Using</span>';
    try {
        await handleUseItem(studentId, index);
    } finally {
        if (btn.isConnected) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
        if (isOpen() && studentId === currentStudentId) {
            renderRoster();
            renderSatchel({ keepScroll: true });
        }
    }
}

function bindListeners() {
    if (listenersBound) return;
    const rosterEl = document.getElementById(ROSTER_ID);
    const contentEl = document.getElementById(CONTENT_ID);
    if (!rosterEl || !contentEl) return;
    listenersBound = true;

    rosterEl.addEventListener('click', (e) => {
        const item = e.target.closest('.tr-roster-item');
        if (item) selectStudent(item.dataset.studentId);
    });

    // Arrow keys walk the hero list (up/down on desktop, left/right when it becomes a strip on phones).
    rosterEl.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
        const items = [...rosterEl.querySelectorAll('.tr-roster-item')];
        if (!items.length) return;
        e.preventDefault();
        const at = items.findIndex((el) => el === document.activeElement);
        let next;
        if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = items.length - 1;
        else next = Math.min(items.length - 1, Math.max(0, (at < 0 ? -1 : at) + keys[e.key]));
        selectStudent(items[next].dataset.studentId, { focus: true });
    });

    contentEl.addEventListener('click', (e) => {
        const bookBtn = e.target.closest('.tr-seal-book-btn');
        if (bookBtn) {
            import('./studentAnalytics.js').then((m) => m.openStudentAnalyticsModal(bookBtn.dataset.studentId, bookBtn, { tab: 'seals' })).catch(() => {});
            return;
        }
        const useBtn = e.target.closest('.tr-use-btn');
        if (useBtn) {
            if (!useBtn.disabled) useRelic(useBtn);
            return;
        }
        const zoom = e.target.closest('.tr-zoom');
        if (zoom) {
            const item = findScore(currentStudentId)?.inventory?.[Number(zoom.dataset.itemIndex)];
            if (item) showInventoryItemDetail(item);
        }
    });

    // Keep the open satchel honest if a purchase or a use elsewhere changes the scores.
    state.subscribe(['allStudentScores'], () => {
        if (!isOpen()) return;
        renderRoster();
        if (currentStudentId) renderSatchel({ keepScroll: true });
    });
}

export function openTrophyRoomModal(preselectedStudentId = null) {
    const preselected = preselectedStudentId ? findStudent(preselectedStudentId) : null;
    const classId = preselected?.classId || state.get('globalSelectedClassId') || '';

    if (!classId) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    currentClassId = classId;
    currentStudentId = preselected?.id || '';
    bindListeners();
    ensureHeroSealsForClass(classId).catch(() => {});
    renderRoster();
    renderSatchel();
    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => {
        document.querySelector(`#${ROSTER_ID} .tr-roster-item.is-selected`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
}

/** Re-render the Trophy Room for a student (kept for callers that refresh it directly). */
export function renderTrophyRoomContent(studentId) {
    currentStudentId = studentId || '';
    renderRoster();
    renderSatchel({ keepScroll: true });
}
