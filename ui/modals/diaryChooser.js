// /ui/modals/diaryChooser.js — "Today's Page": opens from the diary's Write Today's Page
// button (and the crown button, the Wand) on a crowned page that is still blank. Right after
// Huzzah! the same choice comes as a notice instead (ui/core/todaysPageNotice.js), so the
// teacher can keep moving around the app; opening this sheet takes that notice's place. Auto hands the page to the
// AI Chronicler (db/actions/quests.js#writeAdventurePageWithChronicler); Manual opens the
// full page writer (features/adventurePageWriter.js); Later leaves the page waiting in the diary.
// Lazy: loaded only when a page is waiting. Markup in ./diaryChooserView.mjs.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db, doc, getDoc } from '../../firebase.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showToast } from '../effects.js';
import { buildDiaryChooserModel, isAwaitingAdventurePage, rankVirtueReasons } from '../../features/adventurePageCore.mjs';
import { diaryChooserHtml } from './diaryChooserView.mjs';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';

const MODAL_ID = 'diary-chooser-modal';

async function loadLog(logId) {
    const cached = (state.get('allAdventureLogs') || []).find(l => l.id === logId);
    if (cached) return cached;
    try {
        const snap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/adventure_logs`, logId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch {
        return null;
    }
}

function isOwnActivePage(log) {
    return log?.createdBy?.uid === state.get('currentUserId') && log.schoolYearKey === state.getActiveSchoolYearKey();
}

function buildModel(log) {
    const classData = (state.get('allTeachersClasses') || []).find(c => c.id === log.classId) || {};
    const students = state.get('allStudents') || [];
    const hero = (log.heroStudentId && students.find(s => s.id === log.heroStudentId)) || null;
    const awards = (state.get('allAwardLogs') || []).filter(a => a.classId === log.classId && utils.datesMatch(a.date, log.date));
    const dateObj = utils.parseFlexibleDate(log.date);
    const validDate = dateObj && !Number.isNaN(dateObj.getTime());
    return buildDiaryChooserModel({
        heroName: log.hero,
        heroAvatar: hero?.avatar || '',
        className: classData.name,
        dateLabel: validDate ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
        league: classData.questLevel || '',
        totalStars: log.totalStars,
        reasons: rankVirtueReasons(awards),
        learned: log.learnedToday,
        canAuto: canUseFeature('eliteAI'),
        isToday: log.date === utils.getTodayDateString()
    });
}

export function closeDiaryChooser() {
    const overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;
    overlay._cleanup?.();
    overlay.classList.add('is-leaving');
    const remove = () => overlay.remove();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) remove();
    else setTimeout(remove, 220);
}

async function focusPage(logId) {
    try {
        const { focusDiaryPage } = await import('../tabs/log.js');
        focusDiaryPage(logId);
    } catch { /* the diary tab may not be on screen */ }
}

/**
 * The page and the chooser's model, when this teacher can write it now; otherwise null.
 * `explain` shows the toast for a page that belongs to another teacher.
 */
export async function readWaitingPage(logId, { explain = true } = {}) {
    if (!logId || !canUseFeature('adventureLog')) return null;
    const log = await loadLog(logId);
    if (!log || !isAwaitingAdventurePage(log)) return null;
    if (!isOwnActivePage(log)) {
        if (explain) showToast('Only the teacher who crowned this hero can write the page.', 'info');
        return null;
    }
    return { log, model: buildModel(log) };
}

/**
 * Opens the chooser for a crowned, still-blank page owned by this teacher.
 * `onSettled` runs once, when the teacher has picked a path (or the chooser cannot open), so
 * after-crowning work (the Campfire's AI prep) queues behind the Chronicler, never in front.
 */
export async function openDiaryChooser(logId, { onSettled } = {}) {
    // A Today's Page notice for this page hands its after-choice hook over and steps aside.
    let handoff = null;
    try {
        const notice = await import('../core/todaysPageNotice.js');
        handoff = notice.handOffTodaysPageNotice(logId);
    } catch { /* no notice to take over */ }
    let settled = false;
    const settle = () => {
        if (settled) return;
        settled = true;
        try { onSettled?.(); } catch (error) { console.warn('After-choice hook failed:', error); }
        handoff?.settle?.();
    };
    if (handoff?.busy) return settle(); // the notice is already writing or opening this page
    const waiting = await readWaitingPage(logId);
    if (!waiting) return settle();

    document.getElementById(MODAL_ID)?._cleanup?.();
    document.getElementById(MODAL_ID)?.remove();
    const { model } = waiting;
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'diary-chooser-overlay';
    overlay.innerHTML = diaryChooserHtml(model);
    document.body.appendChild(overlay);

    const previousFocus = document.activeElement;
    let busy = false;
    const choose = async (choice) => {
        if (busy) return;
        if (choice === 'later') {
            closeDiaryChooser();
            settle();
            showToast("Today's page will wait for you in the diary. 🔖", 'info');
            return;
        }
        if (choice === 'manual') {
            closeDiaryChooser();
            settle();
            try {
                const writer = await import('../../features/adventurePageWriter.js');
                await writer.openAdventurePageWriter(logId);
            } catch (error) {
                console.error('Could not open the page writer:', error);
                showToast('The page could not be opened. Please try again.', 'error');
            }
            return;
        }
        if (choice === 'auto') {
            if (!model.canAuto) {
                showLockedNote(overlay);
                return;
            }
            busy = true;
            overlay.querySelector('[data-diary-stage="choose"]').hidden = true;
            overlay.querySelector('[data-diary-stage="writing"]').hidden = false;
            overlay.classList.add('is-writing');
            try {
                const actions = await import('../../db/actions.js');
                await actions.writeAdventurePageWithChronicler(logId, {
                    onStatus: (text) => {
                        const status = overlay.querySelector('[data-diary-writing-status]');
                        if (status) status.textContent = text;
                    }
                });
                busy = false;
                closeDiaryChooser();
                settle();
                showToast('The Chronicler is writing your page. It appears in the diary in a moment. ✨', 'success');
                focusPage(logId);
            } catch (error) {
                console.error('Chronicler could not start the page:', error);
                busy = false;
                overlay.classList.remove('is-writing');
                overlay.querySelector('[data-diary-stage="choose"]').hidden = false;
                overlay.querySelector('[data-diary-stage="writing"]').hidden = true;
                showToast(error?.message || 'The Chronicler could not start. Try again or write it yourself.', 'error');
            }
        }
    };

    overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-diary-choice]');
        if (button) {
            choose(button.dataset.diaryChoice);
            return;
        }
        if (event.target === overlay && !busy) choose('later');
    });

    const onKey = (event) => {
        if (busy || event.target?.matches?.('input, textarea')) return;
        if (event.key === 'Escape') { event.preventDefault(); choose('later'); return; }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === 'a') { event.preventDefault(); choose('auto'); }
        if (key === 'm') { event.preventDefault(); choose('manual'); }
        if (event.key === 'Tab') trapFocus(event, overlay);
    };
    document.addEventListener('keydown', onKey);
    overlay._cleanup = () => {
        document.removeEventListener('keydown', onKey);
        if (previousFocus?.focus && document.body.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };

    requestAnimationFrame(() => {
        overlay.querySelector(model.canAuto ? '.dc-choice--auto' : '.dc-choice--manual')?.focus({ preventScroll: true });
    });
}

function showLockedNote(overlay) {
    const stage = overlay.querySelector('[data-diary-stage="choose"]');
    if (!stage || stage.querySelector('.dc-locked-note')) return;
    import('../../config/tiers/features.js').then(({ getUpgradeMessage }) => {
        const note = document.createElement('p');
        note.className = 'dc-locked-note';
        note.setAttribute('role', 'status');
        note.textContent = `${getUpgradeMessage('Elite', 'adventureLog')} Choose Manual to write today's page yourself.`;
        stage.querySelector('.dc-choices')?.after(note);
    }).catch(() => {});
}

function trapFocus(event, overlay) {
    const focusables = [...overlay.querySelectorAll('button:not([disabled])')].filter(el => !el.closest('[hidden]'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
