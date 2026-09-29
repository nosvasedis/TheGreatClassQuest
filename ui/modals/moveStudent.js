// ui/modals/moveStudent.js — the teacher's Move Student modal ("transfer orders").
// Two routes for a student who leaves their class:
//   • another class  → transferStudentToClass (stars, gold, guild and notes travel with them)
//   • the waiting list → releaseStudentToPlacement (they wait in Student placement, the same
//     lot the Secretary and the September rollover use, until someone seats them)
// A student who is already waiting can be seated in one of the teacher's own classes.
// Markup shell: templates/modals/student.js (#move-student-modal). Styles: styles/move_student.css.
import * as state from '../../state.js';
import { showAnimatedModal, hideModal } from './base.js';
import { showToast } from '../effects.js';
import { escapeHtml } from '../../features/roles/shared.js';
import {
    allocateReturningStudents,
    releaseStudentToPlacement,
    transferStudentToClass
} from '../../utils/adminRuntime.js';

const MODAL_ID = 'move-student-modal';
const ROUTE_CLASS = 'class';
const ROUTE_WAITING = 'waiting';

const view = {
    studentId: null,
    route: ROUTE_CLASS,
    classId: '',
    query: '',
    showOtherLeagues: false,
    busy: false
};

// ── Lookups ────────────────────────────────────────────────────────────────

function studentById(studentId) {
    return (state.get('allStudents') || []).find((item) => item.id === studentId) || null;
}

function classById(classId) {
    if (!classId) return null;
    return (state.get('allSchoolClasses') || []).find((item) => item.id === classId) || null;
}

function isWaiting(student) {
    return student?.enrollmentStatus === 'pendingPlacement' || !classById(student?.classId);
}

function liveClasses() {
    const yearKey = state.getActiveSchoolYearKey();
    return (state.get('allSchoolClasses') || []).filter((item) => {
        if (!item?.createdBy?.uid) return false;
        if (item.status === 'archived' || item.status === 'closed') return false;
        if (yearKey && item.schoolYearKey && item.schoolYearKey !== yearKey) return false;
        return true;
    });
}

function rosterSize(classId) {
    return (state.get('allStudents') || []).filter((item) => item.classId === classId
        && item.enrollmentStatus !== 'inactive'
        && item.enrollmentStatus !== 'pendingPlacement').length;
}

function waitingCount(excludeId) {
    return (state.get('allStudents') || []).filter((item) => item.id !== excludeId
        && item.enrollmentStatus === 'pendingPlacement').length;
}

function isMine(classData) {
    return Boolean(classData?.createdBy?.uid) && classData.createdBy.uid === state.get('currentUserId');
}

function byName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
}

function matchesQuery(classData) {
    const needle = view.query.trim().toLowerCase();
    if (!needle) return true;
    return [classData.name, classData.questLevel, classData.createdBy?.name]
        .some((value) => String(value || '').toLowerCase().includes(needle));
}

function firstName(student) {
    return String(student?.name || 'this student').trim().split(/\s+/)[0];
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function avatar(student) {
    if (student.avatar) {
        return `<span class="ms-avatar ms-avatar--photo" aria-hidden="true"><img src="${escapeHtml(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`;
    }
    const initial = String(student.name || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span class="ms-avatar" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function classChip(classData, { current }) {
    const selected = view.classId === classData.id;
    const mine = isMine(classData);
    const size = rosterSize(classData.id);
    return `
        <button type="button" class="ms-class${selected ? ' is-selected' : ''}${mine ? ' is-mine' : ''}"
            data-ms-class="${escapeHtml(classData.id)}" aria-pressed="${selected ? 'true' : 'false'}">
            <span class="ms-class__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
            <span class="ms-class__copy">
                <strong>${escapeHtml(classData.name || 'Class')}</strong>
                <small>
                    ${mine ? '<span class="ms-class__you">Your class</span>' : `<i class="fas fa-chalkboard-user" aria-hidden="true"></i>${escapeHtml(classData.createdBy?.name || 'Teacher')}`}
                    <span class="ms-class__dot" aria-hidden="true">·</span>${size} ${size === 1 ? 'hero' : 'heroes'}
                </small>
            </span>
            <span class="ms-class__tick" aria-hidden="true"><i class="fas fa-check"></i></span>
        </button>
    `;
}

function renderClassPicker(student, current, { seatOnly }) {
    const homeLeague = current?.questLevel || student.previousQuestLevel || '';
    let classes = liveClasses().filter((item) => item.id !== current?.id);
    // A waiting student can only be seated by a teacher in their own class (the Office seats anywhere).
    if (seatOnly) classes = classes.filter(isMine);
    const visible = classes.filter(matchesQuery);
    const sameLeague = visible.filter((item) => (item.questLevel || '') === homeLeague).sort(byName);
    const otherLeagues = visible.filter((item) => (item.questLevel || '') !== homeLeague);
    const searching = Boolean(view.query.trim());
    const showOthers = view.showOtherLeagues || searching || !sameLeague.length
        || otherLeagues.some((item) => item.id === view.classId);
    const leagues = [...new Set(otherLeagues.map((item) => item.questLevel || 'Other'))].sort();

    if (!classes.length) {
        return `
            <div class="ms-empty">
                <i class="fas fa-school-circle-xmark" aria-hidden="true"></i>
                <p>${seatOnly
                    ? 'You have no class this school year to seat them in yet.'
                    : 'There is no other class this school year yet.'}</p>
                ${seatOnly ? '' : `<button type="button" class="ms-link" data-ms-route="${ROUTE_WAITING}">Send them to the waiting list instead</button>`}
            </div>
        `;
    }

    return `
        <label class="ms-search">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <span class="sr-only">Find a class</span>
            <input type="search" id="move-student-search" value="${escapeHtml(view.query)}"
                placeholder="Find a class, league or teacher" autocomplete="off" spellcheck="false">
        </label>
        ${sameLeague.length ? `
            <section class="ms-league" aria-label="${escapeHtml(homeLeague || 'Same league')}">
                <p class="ms-league__name">
                    <i class="fas fa-flag" aria-hidden="true"></i>${escapeHtml(homeLeague || 'Same league')}
                    <small>${current ? 'Same league' : 'Their league'}</small>
                </p>
                <div class="ms-class-grid">${sameLeague.map((item) => classChip(item, { current })).join('')}</div>
            </section>
        ` : ''}
        ${otherLeagues.length ? (showOthers ? leagues.map((league) => `
            <section class="ms-league ms-league--other" aria-label="${escapeHtml(league)}">
                <p class="ms-league__name"><i class="fas fa-flag" aria-hidden="true"></i>${escapeHtml(league)}</p>
                <div class="ms-class-grid">
                    ${otherLeagues.filter((item) => (item.questLevel || 'Other') === league).sort(byName)
                        .map((item) => classChip(item, { current })).join('')}
                </div>
            </section>
        `).join('') : `
            <button type="button" class="ms-more" data-ms-other-leagues>
                <i class="fas fa-layer-group" aria-hidden="true"></i>
                Show classes in other leagues <span>${otherLeagues.length}</span>
            </button>
        `) : ''}
        ${!visible.length ? `<p class="ms-none">No class matches “${escapeHtml(view.query.trim())}”.</p>` : ''}
    `;
}

function renderWaitingPanel(student, current) {
    const others = waitingCount(student.id);
    const name = escapeHtml(firstName(student));
    return `
        <div class="ms-lot">
            <div class="ms-lot__scene" aria-hidden="true">
                <span class="ms-lot__bench"><i class="fas fa-couch"></i></span>
                <span class="ms-lot__sign">Student placement</span>
            </div>
            <div class="ms-lot__copy">
                <h3>${name} leaves ${escapeHtml(current?.name || 'your class')} but stays in the school</h3>
                <p>They wait in <b>Student placement</b> with ${others
                    ? `${others} other student${others === 1 ? '' : 's'}`
                    : 'nobody else right now'} until a teacher or the School Office seats them in a class.</p>
            </div>
        </div>
        <ul class="ms-facts">
            <li><i class="fas fa-user-minus" aria-hidden="true"></i>Leaves your roster, lessons and class leaderboards straight away.</li>
            <li><i class="fas fa-box-archive" aria-hidden="true"></i>Stars, gold, hero path, guild and notes stay on file.</li>
            <li><i class="fas fa-chair" aria-hidden="true"></i>Seated again this school year, they keep this year’s progress.</li>
            <li><i class="fas fa-people-roof" aria-hidden="true"></i>The family app shows them as waiting for a class.</li>
        </ul>
        <p class="ms-hint"><i class="fas fa-circle-info" aria-hidden="true"></i>Leaving the school for good? The School Office records that from their file.</p>
    `;
}

function renderClassFacts(current, target) {
    if (!target) return '';
    const mine = isMine(target);
    const leagueChange = current && (target.questLevel || '') !== (current.questLevel || '');
    return `
        <ul class="ms-facts ms-facts--compact">
            <li><i class="fas fa-star" aria-hidden="true"></i>Stars, gold, hero path, guild and notes go with them.</li>
            ${mine
                ? '<li><i class="fas fa-house-user" aria-hidden="true"></i>They stay yours, in another of your classes.</li>'
                : `<li class="is-warn"><i class="fas fa-hand-holding-hand" aria-hidden="true"></i>${escapeHtml(target.createdBy?.name || 'Their new teacher')} takes them over. You can no longer manage them after the move.</li>`}
            ${leagueChange ? `<li class="is-warn"><i class="fas fa-flag" aria-hidden="true"></i>A different league: ${escapeHtml(current.questLevel || '—')} → ${escapeHtml(target.questLevel || '—')}.</li>` : ''}
            <li><i class="fas fa-people-roof" aria-hidden="true"></i>The family app and messages follow them.</li>
        </ul>
    `;
}

function stamp({ icon, logo, label, sub, tone }) {
    return `
        <span class="ms-stamp ms-stamp--${tone}">
            <span class="ms-stamp__mark" aria-hidden="true">${logo ? escapeHtml(logo) : `<i class="fas ${icon}"></i>`}</span>
            <span class="ms-stamp__copy"><strong>${escapeHtml(label)}</strong>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</span>
        </span>
    `;
}

// ── Render ─────────────────────────────────────────────────────────────────

function render({ keepFocus = false } = {}) {
    const modal = document.getElementById(MODAL_ID);
    const student = studentById(view.studentId);
    if (!modal || !student) return;
    const waiting = isWaiting(student);
    const current = waiting ? null : classById(student.classId);
    const seatOnly = waiting;
    const route = seatOnly ? ROUTE_CLASS : view.route;
    const target = route === ROUTE_CLASS ? classById(view.classId) : null;

    const search = modal.querySelector('#move-student-search');
    const hadFocus = keepFocus && search && document.activeElement === search;
    const caret = hadFocus ? search.selectionStart : null;
    const body = modal.querySelector('.ms-body');
    const scrollTop = body ? body.scrollTop : 0;

    const fromStamp = current
        ? stamp({ logo: current.logo || '📚', label: current.name, sub: current.questLevel || '', tone: 'from' })
        : stamp({ icon: 'fa-couch', label: 'Student placement', sub: 'Waiting for a class', tone: 'from' });
    let toStamp;
    if (route === ROUTE_WAITING) {
        toStamp = stamp({ icon: 'fa-couch', label: 'Student placement', sub: 'Waiting list', tone: 'lot' });
    } else if (target) {
        toStamp = stamp({ logo: target.logo || '📚', label: target.name, sub: isMine(target) ? 'Your class' : (target.createdBy?.name || ''), tone: 'to' });
    } else {
        toStamp = stamp({ icon: 'fa-question', label: 'Pick a destination', sub: '', tone: 'empty' });
    }

    let confirmLabel;
    let confirmIcon;
    if (route === ROUTE_WAITING) {
        confirmLabel = 'Send to waiting list';
        confirmIcon = 'fa-couch';
    } else if (target) {
        confirmLabel = `${seatOnly ? 'Seat in' : 'Move to'} ${target.name}`;
        confirmIcon = seatOnly ? 'fa-chair' : 'fa-people-arrows';
    } else {
        confirmLabel = 'Pick a class';
        confirmIcon = 'fa-hand-pointer';
    }
    const canConfirm = !view.busy && (route === ROUTE_WAITING || Boolean(target));

    const currentLine = current
        ? `Now in <b>${escapeHtml(current.logo || '📚')} ${escapeHtml(current.name)}</b>${current.questLevel ? ` · ${escapeHtml(current.questLevel)}` : ''}`
        : `Waiting for a class${student.previousClassName ? ` · last in <b>${escapeHtml(student.previousClassName)}</b>` : ''}`;

    modal.querySelector('.ms-card').innerHTML = `
        <header class="ms-head">
            ${avatar(student)}
            <div class="ms-head__copy">
                <p class="ms-kicker"><i class="fas fa-scroll" aria-hidden="true"></i>${seatOnly ? 'Seat a student' : 'Transfer orders'}</p>
                <h2 id="move-student-title" class="ms-title">${seatOnly
                    ? `Seat ${escapeHtml(firstName(student))} in a class`
                    : `Where is ${escapeHtml(firstName(student))} heading?`}</h2>
                <p class="ms-current">${currentLine}</p>
            </div>
            <button type="button" class="ms-close" data-ms-cancel aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        </header>
        ${seatOnly ? '' : `
            <div class="ms-routes" role="radiogroup" aria-label="Where they go">
                <button type="button" class="ms-route ms-route--class${route === ROUTE_CLASS ? ' is-active' : ''}"
                    role="radio" aria-checked="${route === ROUTE_CLASS}" data-ms-route="${ROUTE_CLASS}">
                    <span class="ms-route__icon" aria-hidden="true"><i class="fas fa-people-arrows"></i></span>
                    <span class="ms-route__copy">
                        <strong>Another class</strong>
                        <small>Switches class and keeps every star.</small>
                    </span>
                </button>
                <button type="button" class="ms-route ms-route--lot${route === ROUTE_WAITING ? ' is-active' : ''}"
                    role="radio" aria-checked="${route === ROUTE_WAITING}" data-ms-route="${ROUTE_WAITING}">
                    <span class="ms-route__icon" aria-hidden="true"><i class="fas fa-couch"></i></span>
                    <span class="ms-route__copy">
                        <strong>Waiting list</strong>
                        <small>Leaves your class, waits to be seated.</small>
                    </span>
                </button>
            </div>
        `}
        <div class="ms-body" data-route="${route}">
            ${route === ROUTE_WAITING ? renderWaitingPanel(student, current) : renderClassPicker(student, current, { seatOnly })}
            ${route === ROUTE_CLASS ? renderClassFacts(current, target) : ''}
        </div>
        <footer class="ms-foot">
            <div class="ms-ticket" aria-label="Summary">
                ${fromStamp}
                <span class="ms-ticket__arrow" aria-hidden="true"><i class="fas fa-arrow-right-long"></i></span>
                ${toStamp}
            </div>
            <div class="ms-actions">
                <button type="button" class="ms-btn ms-btn--ghost" data-ms-cancel>Cancel</button>
                <button type="button" id="move-student-confirm-btn" class="ms-btn ms-btn--${route === ROUTE_WAITING ? 'lot' : 'go'}" data-ms-confirm ${canConfirm ? '' : 'disabled'}>
                    ${view.busy
                        ? `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${route === ROUTE_WAITING ? 'Sending...' : (seatOnly ? 'Seating...' : 'Moving...')}`
                        : `<i class="fas ${confirmIcon}" aria-hidden="true"></i> <span>${escapeHtml(confirmLabel)}</span>`}
                </button>
            </div>
        </footer>
    `;

    const nextBody = modal.querySelector('.ms-body');
    if (nextBody) nextBody.scrollTop = scrollTop;
    if (hadFocus) {
        const nextSearch = modal.querySelector('#move-student-search');
        nextSearch?.focus({ preventScroll: true });
        if (nextSearch && caret !== null) nextSearch.setSelectionRange(caret, caret);
    }
}

// ── Actions ────────────────────────────────────────────────────────────────

function close() {
    if (view.busy) return;
    hideModal(MODAL_ID);
}

async function offerUndo(message, onUndo) {
    try {
        const { showUndoBar } = await import('../../features/secretary/formerStudents.js');
        showUndoBar(message, onUndo);
    } catch (error) {
        console.error('Could not show the undo bar:', error);
        showToast(message, 'success');
    }
}

async function confirm() {
    const student = studentById(view.studentId);
    if (!student || view.busy) return;
    const waiting = isWaiting(student);
    const current = waiting ? null : classById(student.classId);
    const route = waiting ? ROUTE_CLASS : view.route;
    const target = route === ROUTE_CLASS ? classById(view.classId) : null;
    if (route === ROUTE_CLASS && !target) {
        showToast('Pick the class they move to.', 'info');
        return;
    }

    view.busy = true;
    render();
    try {
        if (route === ROUTE_WAITING) {
            await releaseStudentToPlacement({ studentId: student.id });
            view.busy = false;
            hideModal(MODAL_ID);
            if (current && isMine(current)) {
                offerUndo(`${student.name} is waiting in Student placement.`, async () => {
                    await allocateReturningStudents({ classId: current.id, studentIds: [student.id] });
                    showToast(`${student.name} is back in ${current.name}.`, 'success');
                });
            } else {
                showToast(`${student.name} is waiting in Student placement.`, 'success');
            }
        } else if (waiting) {
            await allocateReturningStudents({ classId: target.id, studentIds: [student.id] });
            view.busy = false;
            hideModal(MODAL_ID);
            showToast(`${student.name} now sits in ${target.name}.`, 'success');
        } else {
            await transferStudentToClass({ studentId: student.id, classId: target.id });
            view.busy = false;
            hideModal(MODAL_ID);
            // They stay ours only when the new class is ours too, so only then can it be undone.
            if (current && isMine(target)) {
                offerUndo(`${student.name} moved to ${target.name}.`, async () => {
                    await transferStudentToClass({ studentId: student.id, classId: current.id });
                    showToast(`${student.name} is back in ${current.name}.`, 'success');
                });
            } else {
                showToast(`${student.name} moved to ${target.name}. ${target.createdBy?.name || 'Their new teacher'} has them now.`, 'success');
            }
        }
    } catch (error) {
        console.error('Could not move student:', error);
        view.busy = false;
        render();
        showToast(error?.message || 'Could not move that student. Please try again.', 'error');
    }
}

// ── Wiring ─────────────────────────────────────────────────────────────────

function bind(modal) {
    if (modal.dataset.msBound === '1') return;
    modal.dataset.msBound = '1';

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            close();
            return;
        }
        if (view.busy) return;
        if (event.target.closest('[data-ms-cancel]')) {
            close();
            return;
        }
        const routeBtn = event.target.closest('[data-ms-route]');
        if (routeBtn) {
            view.route = routeBtn.dataset.msRoute === ROUTE_WAITING ? ROUTE_WAITING : ROUTE_CLASS;
            render();
            modal.querySelector(`[data-ms-route="${view.route}"]`)?.focus({ preventScroll: true });
            return;
        }
        const classBtn = event.target.closest('[data-ms-class]');
        if (classBtn) {
            const id = classBtn.dataset.msClass;
            view.classId = view.classId === id ? '' : id;
            render();
            modal.querySelector(`[data-ms-class="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
            return;
        }
        if (event.target.closest('[data-ms-other-leagues]')) {
            view.showOtherLeagues = true;
            render();
            return;
        }
        if (event.target.closest('[data-ms-confirm]')) confirm();
    });

    modal.addEventListener('input', (event) => {
        if (event.target.id !== 'move-student-search') return;
        view.query = event.target.value;
        render({ keepFocus: true });
    });

    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
            return;
        }
        // Arrow keys switch between the two routes, like a radio group.
        const routeBtn = event.target.closest?.('[data-ms-route]');
        if (routeBtn && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            view.route = view.route === ROUTE_CLASS ? ROUTE_WAITING : ROUTE_CLASS;
            render();
            modal.querySelector(`[data-ms-route="${view.route}"]`)?.focus({ preventScroll: true });
        }
    });
}

export function openMoveStudentModal(studentId, options = {}) {
    const student = studentById(studentId);
    const modal = document.getElementById(MODAL_ID);
    if (!student || !modal) return;
    if (student.enrollmentStatus === 'inactive') {
        showToast(`${student.name} has left the school.`, 'info');
        return;
    }
    Object.assign(view, {
        studentId,
        route: options.route === ROUTE_WAITING ? ROUTE_WAITING : ROUTE_CLASS,
        classId: '',
        query: '',
        showOtherLeagues: false,
        busy: false
    });
    modal.dataset.studentId = studentId;
    bind(modal);
    render();
    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => {
        const focusTarget = modal.querySelector('.ms-route.is-active')
            || modal.querySelector('#move-student-search')
            || modal.querySelector('[data-ms-cancel]');
        focusTarget?.focus({ preventScroll: true });
    });
}
