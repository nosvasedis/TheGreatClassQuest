// /features/pendingStarfall.js — Starfall that waits for the lesson.
// Marking at home: the bonus stars are saved on the class (`pendingStarfalls`) and the teacher
// gets a notice. During the class's next lesson the Scholar's Scroll shows a Starfall call;
// pressing it summons the Starfall window and the stars are bestowed in front of the class.
// Marking during the lesson (or a class with no timetable): the Starfall opens at once, as before.
import { escapeHtml as esc } from '../utils/html.mjs';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, runTransaction } from '../firebase.js';
import { dataPath } from '../utils/tenant.mjs';
import { notify, showToast, showUndoToast } from '../ui/effects.js';
import {
    lessonTimingFor,
    shouldDeferStarfall,
    findNextLessonStart,
    formatLessonWhen,
    formatMarkedDay,
    mergePendingStarfalls,
    takePendingStarfalls
} from './pendingStarfallCore.mjs';
import { starfallCallHtml, playStarfallSummon, formatStars, firstName } from '../ui/starfallCall.js';

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || null;
}

function scheduleContext() {
    return {
        classes: state.get('allSchoolClasses') || [],
        overrides: state.get('allScheduleOverrides') || [],
        holidays: state.get('schoolHolidayRanges') || [],
        endDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
    };
}

function meetsOn(classId, date) {
    const { classes, overrides, holidays, endDates } = scheduleContext();
    return utils.doesClassMeetOnDate(classId, date, classes, overrides, holidays, endDates);
}

/** Is this class sitting together right now (lesson time + the compass's 15-minute grace)? */
export function classLessonTiming(classId, now = new Date()) {
    const classData = classById(classId);
    if (!classData) return { hasSchedule: false, inLesson: false };
    return lessonTimingFor(classData, { meetsToday: meetsOn(classId, now), now });
}

export function nextLessonWhen(classId, now = new Date()) {
    const classData = classById(classId);
    const next = classData ? findNextLessonStart(classData, (d) => meetsOn(classId, d), now) : null;
    return next ? formatLessonWhen(next, now) : 'at the next lesson';
}

/** Waiting Starfalls of a class, for scholars who are still on the roll. */
export function getPendingStarfalls(classId) {
    const list = classById(classId)?.pendingStarfalls;
    if (!Array.isArray(list) || !list.length) return [];
    const students = new Map((state.get('allStudents') || []).map((s) => [s.id, s]));
    return list
        .filter((e) => e && students.has(e.studentId))
        .map((e) => {
            const s = students.get(e.studentId);
            return { ...e, name: s.name || e.name, avatar: s.avatar || '' };
        });
}

async function editPending(classId, change) {
    const ref = doc(db, dataPath('classes'), classId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('This class could not be found.');
        const current = Array.isArray(snap.data().pendingStarfalls) ? snap.data().pendingStarfalls : [];
        const { next, result } = change(current);
        tx.update(ref, { pendingStarfalls: next });
        return result;
    });
}

export function queuePendingStarfalls(classId, entries) {
    return editPending(classId, (current) => {
        const next = mergePendingStarfalls(current, entries, { now: Date.now(), queuedBy: state.get('currentUserId') || '' });
        return { next, result: next };
    });
}

/** Takes these stars off the class; returns the ones that were still waiting (another laptop may have been first). */
export function claimPendingStarfalls(classId, ids) {
    return editPending(classId, (current) => {
        const { taken, kept } = takePendingStarfalls(current, ids);
        return { next: kept, result: taken };
    });
}

function restorePendingStarfalls(classId, entries) {
    return editPending(classId, (current) => ({ next: mergePendingStarfalls(current, entries, { now: Date.now() }), result: true }));
}

// ───────────── After marking: now, or wait for the lesson ─────────────

/**
 * Called after a batch of trials is saved with its Starfall proposals.
 * @param {{ classId: string, students: Array, trialDate: string, trialTitle?: string }} opts
 */
export async function routeStarfall({ classId, students, trialDate, trialTitle = '' }) {
    if (!students?.length) return;
    const showNow = () => import('../ui/modals/index.js').then((m) => m.showBatchStarfallModal(students));
    const timing = classLessonTiming(classId);
    if (!shouldDeferStarfall(timing)) {
        await showNow();
        return;
    }

    const entries = students.map((s) => ({ ...s, trialDate, trialTitle }));
    try {
        await queuePendingStarfalls(classId, entries);
    } catch (error) {
        // Not this teacher's class to write to (or offline): the Starfall simply opens now.
        console.warn('Starfall could not wait for the lesson; showing it now:', error);
        await showNow();
        return;
    }
    announceWaitingStarfall(classId, students);
    refreshStarfallCues();
}

function announceWaitingStarfall(classId, students) {
    const classData = classById(classId);
    const names = students.map((s) => `<b>${esc(firstName(s.name))}</b>`);
    const list = names.length <= 4
        ? names.join(', ').replace(/, ([^,]*)$/, ' and $1')
        : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
    const total = students.reduce((sum, s) => sum + (Number(s.bonusAmount) || 0), 0);
    notify({
        type: 'praise',
        className: 'herald--starfall',
        key: `starfall-wait-${classId}`,
        title: 'Starfall saved for the lesson',
        icon: '<span class="ssf-herald-star" aria-hidden="true">★</span>',
        message: `${list} earned a Starfall (${esc(formatStars(total))}&nbsp;★). The stars will wait for ${esc(classData?.name || 'the class')} ${esc(nextLessonWhen(classId))}, when a Starfall button appears in the Scholar’s Scroll.`,
        duration: 14000,
        actions: [{
            label: 'Bestow now instead',
            icon: 'fa-wand-magic-sparkles',
            className: 'herald__action--ghost',
            onClick: () => { openPendingStarfall(classId); }
        }]
    });
}

// ───────────── Opening a waiting Starfall ─────────────

let opening = false;

/** Summons the Starfall window for every star waiting on this class. */
export async function openPendingStarfall(classId, { origin = null } = {}) {
    if (opening) return;
    const entries = getPendingStarfalls(classId);
    if (!entries.length) {
        showToast('These stars have already fallen.', 'info');
        refreshStarfallCues();
        return;
    }
    opening = true;
    try {
        const [{ showBatchStarfallModal }, { handleBatchAwardBonus }] = await Promise.all([
            import('../ui/modals/index.js'),
            import('../db/actions/index.js')
        ]);
        await playStarfallSummon(origin);
        const markedAt = Math.min(...entries.map((e) => Number(e.queuedAt) || Date.now()));
        showBatchStarfallModal(entries, {
            delayed: { markedDay: formatMarkedDay(markedAt), trialTypes: [...new Set(entries.map((e) => e.trialType))] },
            laterLabel: 'Later in the lesson',
            onBestow: async () => {
                let claimed;
                try {
                    claimed = await claimPendingStarfalls(classId, entries.map((e) => e.id));
                } catch (error) {
                    console.error('Starfall claim failed:', error);
                    showToast('The stars could not be bestowed. Please try again.', 'error');
                    return;
                }
                if (!claimed.length) {
                    showToast('These stars were already bestowed on another screen.', 'info');
                    return;
                }
                const byId = new Map(entries.map((e) => [e.id, e]));
                const result = await handleBatchAwardBonus(claimed.map((e) => ({ ...e, name: byId.get(e.id)?.name || e.name })));
                // A failed save puts the unsaved stars back to wait, so none is lost.
                const missed = result === false ? claimed
                    : Array.isArray(result) ? claimed.filter((e) => !result.includes(e.studentId)) : [];
                if (missed.length) await restorePendingStarfalls(classId, missed).catch((e) => console.warn('Starfall restore failed:', e));
                refreshStarfallCues();
            }
        });
    } finally {
        opening = false;
    }
}

// ───────────── The Starfall call in the Scholar's Scroll ─────────────

/** Draws (or removes) the Starfall call at the top of the Scholar's Scroll notices. */
export function renderStarfallCall(classId, host) {
    const existing = document.getElementById('scroll-starfall-call');
    const entries = classId ? getPendingStarfalls(classId) : [];
    if (!host || !entries.length) {
        existing?.remove();
        return;
    }
    const timing = classLessonTiming(classId);
    const { state: callState, html } = starfallCallHtml({ entries, timing, nextWhen: timing.hasSchedule ? nextLessonWhen(classId) : '' });
    const key = `${classId}|${callState}|${html}`;
    if (existing && host.firstElementChild !== existing) host.prepend(existing);
    if (existing && existing.dataset.renderKey === key) return;

    const call = existing || document.createElement('article');
    const wakes = existing && existing.dataset.state === 'asleep' && callState === 'ready';
    call.id = 'scroll-starfall-call';
    call.className = `ss-notice ssf-call ssf-call--${callState}${existing && !wakes ? ' is-settled' : ''}`;
    call.dataset.state = callState;
    call.dataset.renderKey = key;
    call.setAttribute('aria-label', 'Starfall');
    call.innerHTML = html;
    if (!existing) host.prepend(call);

    call.onclick = (e) => {
        const btn = e.target.closest('[data-ssf]');
        if (!btn) return;
        if (btn.dataset.ssf === 'open') {
            openPendingStarfall(classId, { origin: btn.querySelector('.ssf-call__btn-star') || btn });
            return;
        }
        if (btn.dataset.ssf === 'discard') discardPending(classId, entries);
    };
    startCueClock();
}

async function discardPending(classId, entries) {
    let taken;
    try {
        taken = await claimPendingStarfalls(classId, entries.map((e) => e.id));
    } catch (error) {
        console.error('Could not let the stars go:', error);
        showToast('Could not change this Starfall. Please try again.', 'error');
        return;
    }
    refreshStarfallCues();
    if (!taken.length) return;
    showUndoToast(`The waiting Starfall for ${taken.length} scholar${taken.length === 1 ? '' : 's'} was let go.`, async () => {
        await restorePendingStarfalls(classId, taken);
        refreshStarfallCues();
    }, { key: `starfall-discard-${classId}` });
}

// ───────────── Cues: the Scroll call and the nav star follow the clock ─────────────

let cueTimer = null;
let cueWired = false;

function wireCues() {
    if (cueWired) return;
    cueWired = true;
    state.subscribe(['allSchoolClasses', 'allStudents'], () => refreshStarfallCues());
    window.addEventListener('gcq:class-selected', () => refreshStarfallCues());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshStarfallCues(); });
}

function startCueClock() {
    wireCues();
    if (!cueTimer) cueTimer = setInterval(refreshStarfallCues, 30000);
}

/** Keeps the Scroll's Starfall call and the nav star in step with the clock and the class docs. */
export function refreshStarfallCues() {
    wireCues();
    const mine = state.get('allTeachersClasses') || [];
    const anyWaiting = mine.some((c) => Array.isArray(c.pendingStarfalls) && c.pendingStarfalls.length);
    const ready = anyWaiting && mine.some((c) => Array.isArray(c.pendingStarfalls) && c.pendingStarfalls.length
        && getPendingStarfalls(c.id).length && classLessonTiming(c.id).inLesson);
    document.querySelectorAll('[data-tab="scholars-scroll-tab"]').forEach((btn) => {
        btn.classList.toggle('has-starfall', ready);
        if (ready) btn.dataset.starfallHint = 'A Starfall is waiting';
        else delete btn.dataset.starfallHint;
    });

    const tab = document.getElementById('scholars-scroll-tab');
    if (tab && !tab.classList.contains('hidden')) {
        const host = document.getElementById('scroll-dashboard-queues');
        renderStarfallCall(state.get('globalSelectedClassId'), host);
    }
    if (anyWaiting) startCueClock();
    else if (cueTimer) {
        clearInterval(cueTimer);
        cueTimer = null;
    }
}
