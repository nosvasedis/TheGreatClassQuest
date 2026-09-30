// features/secretary/familyLogins.js — Admin → Family Logins.
// The office's key cabinet: every enrolled student has a key tag on a hook, grouped by class.
// From here the Secretary sees who can sign in, creates logins (one, or a whole class at once),
// gives new passwords, changes usernames, switches access off and on, deletes logins,
// and prints family slips and the school's Parent sign-in QR poster.
import * as state from '../../state.js';
import { collection, db, doc, getDoc, getDocs } from '../../firebase.js';
import { showToast } from '../../ui/effects.js';
import { createParentAccess, deleteParentAccess, disableParentAccess, resetParentAccessPassword } from '../../utils/adminRuntime.js';
import { friendlyActionError } from '../../utils/friendlyErrors.js';
import {
    copyText,
    generateFamilyPassword,
    getParentLoginUrl,
    normalizeFamilyUsername,
    printFamilyPoster,
    printFamilySlips,
    renderQrSvg,
    suggestFamilyUsername
} from '../familyAccessKit.js';
import { escapeHtml, setBusyState } from '../roles/shared.js';
import { liveSchoolClasses, liveStudents, renderOfficeAvatar } from './helpers.js';
import { closeOfficeModal, openOfficeModal, releaseOfficeScrollLock } from './officeModal.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const DIALOG_ID = 'secretary-family-key-dialog';

export const FAMILY_FILTERS = Object.freeze([
    { key: 'all', label: 'Everyone', icon: 'fa-users' },
    { key: 'none', label: 'No login yet', icon: 'fa-circle-plus' },
    { key: 'active', label: 'Can sign in', icon: 'fa-key' },
    { key: 'off', label: 'Switched off', icon: 'fa-power-off' }
]);

let linksByStudent = new Map();
let loadState = 'idle'; // idle | loading | ready | error
let loadPromise = null;
let listener = null;
let posterQrSvg = '';
let posterQrUrl = '';

// The dialog's working state. Passwords live here only until the dialog closes.
const dialog = {
    mode: null, // create | manage | batch | done | confirm-delete | confirm-off
    studentId: '',
    classId: '',
    username: '',
    password: '',
    batch: [],
    results: [],
    running: false
};

// ── Data ───────────────────────────────────────────────────────────────────

export function setFamilyLoginsListener(fn) {
    listener = fn;
}

function notify() {
    listener?.();
}

export function loadFamilyLinks({ force = false } = {}) {
    if (loadPromise && !force) return loadPromise;
    loadState = 'loading';
    loadPromise = getDocs(collection(db, `${PUBLIC_DATA_PATH}/parent_links`))
        .then((snap) => {
            const next = new Map();
            snap.forEach((item) => next.set(item.id, { studentId: item.id, ...item.data() }));
            linksByStudent = next;
            loadState = 'ready';
        })
        .catch((error) => {
            console.error('Could not load family logins:', error);
            loadState = 'error';
            loadPromise = null;
        })
        .finally(notify);
    return loadPromise;
}

/** Fills the cabinet from links already in hand (the guidebook capture uses this to draw the real panel). */
export function primeFamilyLinks(links = []) {
    linksByStudent = new Map(links.map((link) => [link.studentId, link]));
    loadState = 'ready';
    loadPromise = Promise.resolve();
}

async function refreshLink(studentId) {
    try {
        const snap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/parent_links`, studentId));
        if (snap.exists()) linksByStudent.set(studentId, { studentId, ...snap.data() });
        else linksByStudent.delete(studentId);
    } catch (error) {
        console.warn('Could not refresh a family login:', error);
    }
}

function studentById(studentId) {
    return (state.get('allStudents') || []).find((item) => item.id === studentId) || null;
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((item) => item.id === classId) || null;
}

function linkStatus(link) {
    if (!link) return 'none';
    return String(link.status || 'active') === 'active' ? 'active' : 'off';
}

function takenUsernames(exceptStudentId = '') {
    return [...linksByStudent.values()]
        .filter((link) => link.studentId !== exceptStudentId)
        .map((link) => link.username)
        .filter(Boolean);
}

function schoolName() {
    return state.get('schoolName') || '';
}

function classLabel(classData) {
    if (!classData) return '';
    return [classData.name, classData.createdBy?.name].filter(Boolean).join(' · ');
}

// ── Panel ──────────────────────────────────────────────────────────────────

function view() {
    return state.get('secretaryView') || {};
}

function currentFilter() {
    const key = view().familyFilter;
    return FAMILY_FILTERS.some((item) => item.key === key) ? key : 'all';
}

function matchesSearch(student, link, classData) {
    const needle = String(view().familySearch || '').trim().toLowerCase();
    if (!needle) return true;
    return [student.name, link?.username, classData?.name, classData?.createdBy?.name]
        .some((field) => String(field || '').toLowerCase().includes(needle));
}

function groupedStudents() {
    const filter = currentFilter();
    const classes = liveSchoolClasses().slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const classIds = new Set(classes.map((item) => item.id));
    const students = liveStudents();
    const groups = classes.map((classData) => ({ classData, students: students.filter((student) => student.classId === classData.id) }));
    const unplaced = students.filter((student) => !classIds.has(student.classId));
    if (unplaced.length) groups.push({ classData: null, students: unplaced });
    return groups
        .map((group) => {
            const all = group.students.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            const visible = all.filter((student) => {
                const link = linksByStudent.get(student.id);
                if (filter !== 'all' && linkStatus(link) !== filter) return false;
                return matchesSearch(student, link, group.classData);
            });
            return { ...group, all, visible };
        })
        .filter((group) => group.visible.length);
}

function counts() {
    const tally = { all: 0, none: 0, active: 0, off: 0 };
    liveStudents().forEach((student) => {
        tally.all += 1;
        tally[linkStatus(linksByStudent.get(student.id))] += 1;
    });
    return tally;
}

function renderSummary(tally) {
    const percent = tally.all ? Math.round((tally.active / tally.all) * 100) : 0;
    return `
        <div class="family-keys__summary">
            <div class="family-keys__count">
                <span class="family-keys__count-big">${tally.active}<small>/${tally.all}</small></span>
                <span class="family-keys__count-copy">
                    <strong>${tally.active === 1 ? 'family can' : 'families can'} sign in</strong>
                    <span>${tally.none ? `${tally.none} still ${tally.none === 1 ? 'needs' : 'need'} a login` : 'Every student has a login'}${tally.off ? ` · ${tally.off} switched off` : ''}</span>
                </span>
            </div>
            <div class="family-keys__meter" role="img" aria-label="${percent}% of families can sign in"><span style="width:${percent}%"></span></div>
        </div>
    `;
}

function renderPosterCard() {
    const url = getParentLoginUrl();
    return `
        <aside class="family-keys__poster" aria-label="Family sign-in QR code">
            <div class="family-keys__poster-qr" data-family-poster-qr>${posterQrUrl === url && posterQrSvg ? posterQrSvg : '<span class="family-keys__qr-wait"><i class="fas fa-qrcode" aria-hidden="true"></i></span>'}</div>
            <div class="family-keys__poster-copy">
                <p class="office-kicker">For every family</p>
                <strong>Parent sign-in QR</strong>
                <span>Scanning it opens the sign-in screen straight on the Parent door.</span>
                <div class="family-keys__poster-actions">
                    <button type="button" class="office-btn office-btn--gold office-btn--small" data-family-print-poster><i class="fas fa-print" aria-hidden="true"></i> Print poster</button>
                    <button type="button" class="office-btn office-btn--gold office-btn--small" data-family-print-poster="el" lang="el" title="Print the poster in Greek"><i class="fas fa-print" aria-hidden="true"></i> Αφίσα στα ελληνικά</button>
                    <button type="button" class="office-btn office-btn--quiet office-btn--small" data-family-copy-link><i class="fas fa-link" aria-hidden="true"></i> Copy link</button>
                </div>
            </div>
        </aside>
    `;
}

function renderFilters(tally) {
    const active = currentFilter();
    return `
        <div class="family-keys__filters" role="group" aria-label="Show">
            ${FAMILY_FILTERS.map((item) => `
                <button type="button" class="family-chip family-chip--${item.key}${active === item.key ? ' is-active' : ''}" data-family-filter="${item.key}" aria-pressed="${active === item.key ? 'true' : 'false'}">
                    <i class="fas ${item.icon}" aria-hidden="true"></i>${item.label}<span class="family-chip__count">${tally[item.key]}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderTag(student) {
    const link = linksByStudent.get(student.id);
    const status = linkStatus(link);
    const statusLabel = status === 'active' ? 'Can sign in' : status === 'off' ? (link?.disabledReason === 'left-school' ? 'Paused, left school' : 'Switched off') : 'No login yet';
    return `
        <button type="button" class="family-tag family-tag--${status}" data-family-open="${escapeHtml(student.id)}"
            aria-label="${escapeHtml(`${student.name}: ${statusLabel}${link?.username ? `, username ${link.username}` : ''}`)}">
            <span class="family-tag__hole" aria-hidden="true"></span>
            ${renderOfficeAvatar(student)}
            <span class="family-tag__copy">
                <strong>${escapeHtml(student.name)}</strong>
                ${link?.username
                    ? `<code>${escapeHtml(link.username)}</code>`
                    : '<em>Tap to create a login</em>'}
            </span>
            <span class="family-tag__status"><i class="fas ${status === 'active' ? 'fa-key' : status === 'off' ? 'fa-power-off' : 'fa-plus'}" aria-hidden="true"></i><span>${statusLabel}</span></span>
        </button>
    `;
}

function renderDrawer(group) {
    const { classData, all, visible } = group;
    const missing = all.filter((student) => !linksByStudent.get(student.id)).length;
    const ready = all.filter((student) => linkStatus(linksByStudent.get(student.id)) === 'active').length;
    return `
        <section class="family-drawer">
            <header class="family-drawer__head">
                <span class="family-drawer__logo" aria-hidden="true">${escapeHtml(classData?.logo || '🗂️')}</span>
                <span class="family-drawer__title">
                    <strong>${escapeHtml(classData?.name || 'Waiting for a class')}</strong>
                    <small>${classData ? `${escapeHtml(classData.createdBy?.name || 'Teacher')} · ` : ''}${ready}/${all.length} can sign in</small>
                </span>
                ${missing ? `
                    <button type="button" class="office-btn office-btn--enrol office-btn--small" data-family-batch="${escapeHtml(classData?.id || '__unplaced')}">
                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Create ${missing} missing
                    </button>` : '<span class="family-drawer__done"><i class="fas fa-circle-check" aria-hidden="true"></i> All set</span>'}
            </header>
            <div class="family-drawer__hooks">
                ${visible.map(renderTag).join('')}
            </div>
        </section>
    `;
}

export function renderFamilyLogins() {
    if (loadState === 'idle') void loadFamilyLinks();
    if (!posterQrSvg || posterQrUrl !== getParentLoginUrl()) void paintPosterQr();

    const tally = counts();
    const body = loadState === 'error'
        ? `<div class="role-empty-state family-keys__empty">
                <p>We couldn’t open the key cabinet. Check the connection and try again.</p>
                <button type="button" class="office-btn office-btn--quiet office-btn--small" data-family-reload><i class="fas fa-rotate" aria-hidden="true"></i> Try again</button>
           </div>`
        : loadState !== 'ready'
            ? '<div class="family-keys__loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Opening the key cabinet…</div>'
            : (() => {
                const groups = groupedStudents();
                if (!liveStudents().length) return '<div class="role-empty-state family-keys__empty"><p>Enrol students first. Each one gets a key tag here for their family.</p></div>';
                if (!groups.length) return '<div class="role-empty-state family-keys__empty"><p>No students match. Try another name or filter.</p></div>';
                return groups.map(renderDrawer).join('');
            })();

    return `
        <div class="family-keys">
            <div class="family-keys__top">
                <div class="family-keys__intro">
                    <p class="office-kicker">Key cabinet</p>
                    <h2 class="family-keys__title">Family Logins</h2>
                    <p class="family-keys__lede">One login per student. Create it, print the slip with the QR code, and the family is in.</p>
                    <div data-secretary-live="family-summary">${renderSummary(tally)}</div>
                </div>
                ${renderPosterCard()}
            </div>
            <div class="family-keys__toolbar">
                <label class="office-search">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input type="search" id="secretary-family-search" value="${escapeHtml(view().familySearch || '')}" placeholder="Search a student, username or class" autocomplete="off" aria-label="Search a student, username or class">
                </label>
                <div data-secretary-live="family-filters">${renderFilters(tally)}</div>
            </div>
            <div class="family-keys__cabinet" data-secretary-live="family-cabinet">${body}</div>
        </div>
    `;
}

async function paintPosterQr() {
    const url = getParentLoginUrl();
    try {
        posterQrSvg = await renderQrSvg(url, { title: 'Parent sign-in QR code' });
        posterQrUrl = url;
        document.querySelectorAll('[data-family-poster-qr]').forEach((el) => { el.innerHTML = posterQrSvg; });
    } catch (error) {
        console.warn('Could not draw the family QR code:', error);
    }
}

// ── Dialog ─────────────────────────────────────────────────────────────────

function ensureDialog() {
    let modal = document.getElementById(DIALOG_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = DIALOG_ID;
    modal.className = 'office-dialog family-key-dialog hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'family-key-title');
    modal.innerHTML = `
        <div class="office-dialog__panel office-folder" data-office-panel>
            <span class="office-folder__tab" id="family-key-tab">Family login</span>
            <button type="button" class="office-close" data-family-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <header class="office-dialog__header">
                <p class="office-kicker" id="family-key-kicker"></p>
                <h3 class="office-dialog__title" id="family-key-title"></h3>
                <p class="office-dialog__subtitle" id="family-key-subtitle"></p>
            </header>
            <div class="office-dialog__body custom-scrollbar" id="family-key-body"></div>
            <footer class="office-dialog__footer" id="family-key-footer"></footer>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', handleDialogClick);
    modal.addEventListener('input', (event) => {
        if (event.target.id === 'family-key-username') {
            dialog.username = event.target.value;
            syncManageButtons();
        }
        if (event.target.id === 'family-key-password') {
            dialog.password = event.target.value;
            syncManageButtons();
        }
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !dialog.running) closeDialog();
        if (event.key === 'Enter' && event.target.matches?.('input')) {
            event.preventDefault();
            modal.querySelector('[data-family-save]:not(:disabled)')?.click();
        }
    });
    return modal;
}

function closeDialog() {
    if (dialog.running) return;
    const modal = document.getElementById(DIALOG_ID);
    // Passwords are forgotten the moment the dialog closes.
    Object.assign(dialog, { mode: null, password: '', batch: [], results: [] });
    closeOfficeModal(modal, { onClosed: releaseOfficeScrollLock });
}

function keyCard(student, link) {
    const classData = classById(student.classId);
    const status = linkStatus(link);
    return `
        <div class="family-keycard family-keycard--${status}">
            ${renderOfficeAvatar(student, { size: 'lg' })}
            <div class="family-keycard__copy">
                <strong>${escapeHtml(student.name)}</strong>
                <span>${classData ? `${escapeHtml(classData.logo || '📚')} ${escapeHtml(classLabel(classData))}` : 'Waiting for a class'}</span>
            </div>
            <span class="family-keycard__status">${status === 'active' ? '<i class="fas fa-key" aria-hidden="true"></i> Can sign in' : status === 'off' ? '<i class="fas fa-power-off" aria-hidden="true"></i> Switched off' : '<i class="fas fa-plus" aria-hidden="true"></i> No login yet'}</span>
        </div>
    `;
}

function credentialFields({ usernameLabel = 'Username', passwordLabel = 'Password', passwordHint = '' } = {}) {
    const normalized = normalizeFamilyUsername(dialog.username);
    const showHint = dialog.username && normalized !== dialog.username.trim();
    return `
        <div class="family-fields">
            <label class="office-field family-field">
                <span>${usernameLabel}</span>
                <span class="family-field__row">
                    <i class="fas fa-user" aria-hidden="true"></i>
                    <input id="family-key-username" type="text" value="${escapeHtml(dialog.username)}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40">
                </span>
                <small class="family-field__hint" data-family-username-hint>${showHint ? `Will be saved as <code>${escapeHtml(normalized || '…')}</code>` : 'Letters, numbers, dots or dashes. No spaces.'}</small>
            </label>
            <label class="office-field family-field">
                <span>${passwordLabel}</span>
                <span class="family-field__row">
                    <i class="fas fa-lock" aria-hidden="true"></i>
                    <input id="family-key-password" type="text" value="${escapeHtml(dialog.password)}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60">
                    <button type="button" class="family-field__dice" data-family-new-password title="Make a new one" aria-label="Make a new password"><i class="fas fa-dice" aria-hidden="true"></i></button>
                </span>
                <small class="family-field__hint">${passwordHint || 'At least 6 characters. Easy words are easier to type from the slip.'}</small>
            </label>
        </div>
    `;
}

function renderCreate(student) {
    return {
        tab: 'New family login',
        kicker: 'Family login',
        title: `A login for ${student.name}’s family`,
        subtitle: 'We suggested a username and an easy password. Change them if you like.',
        body: `
            ${keyCard(student, null)}
            ${credentialFields()}
            <ul class="office-facts">
                <li><i class="fas fa-print" aria-hidden="true"></i>Next you can print a slip with these details and the sign-in QR code.</li>
                <li><i class="fas fa-user-group" aria-hidden="true"></i>Brothers and sisters each get their own login.</li>
            </ul>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-family-close>Cancel</button>
            <button type="button" class="office-btn office-btn--primary" data-family-save="create"><i class="fas fa-key" aria-hidden="true"></i> Create login</button>
        `
    };
}

function renderManage(student, link) {
    const status = linkStatus(link);
    const off = status === 'off';
    return {
        tab: 'Family login',
        kicker: 'Family login',
        title: `${student.name}’s family login`,
        subtitle: off
            ? 'This login is switched off. Give it a new password to switch it back on.'
            : 'Give a new password, or change the username. The family uses the new details from their next sign-in.',
        body: `
            ${keyCard(student, link)}
            ${credentialFields({
                passwordLabel: 'New password',
                passwordHint: 'Passwords are never shown again, so saving gives you a fresh slip to print.'
            })}
            <div class="family-danger-row">
                ${off ? '' : '<button type="button" class="office-btn office-btn--quiet office-btn--small" data-family-ask-off><i class="fas fa-power-off" aria-hidden="true"></i> Switch off</button>'}
                <button type="button" class="office-btn office-btn--danger-quiet office-btn--small" data-family-ask-delete><i class="fas fa-trash" aria-hidden="true"></i> Delete login</button>
            </div>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-family-close>Cancel</button>
            <button type="button" class="office-btn office-btn--primary" data-family-save="manage"><i class="fas fa-key" aria-hidden="true"></i> <span data-family-save-label>${manageSaveLabel(link)}</span></button>
        `
    };
}

function manageSaveLabel(link) {
    const changedName = normalizeFamilyUsername(dialog.username) !== String(link?.username || '');
    if (linkStatus(link) === 'off') return changedName ? 'Save and switch on' : 'Switch back on';
    return changedName ? 'Save new username' : 'Save new password';
}

function syncManageButtons() {
    const modal = document.getElementById(DIALOG_ID);
    if (!modal) return;
    const hint = modal.querySelector('[data-family-username-hint]');
    if (hint) {
        const normalized = normalizeFamilyUsername(dialog.username);
        hint.innerHTML = dialog.username && normalized !== dialog.username.trim()
            ? `Will be saved as <code>${escapeHtml(normalized || '…')}</code>`
            : 'Letters, numbers, dots or dashes. No spaces.';
    }
    if (dialog.mode === 'manage') {
        const label = modal.querySelector('[data-family-save-label]');
        if (label) label.textContent = manageSaveLabel(linksByStudent.get(dialog.studentId));
    }
}

function renderConfirm(student, link, kind) {
    const isDelete = kind === 'delete';
    return {
        tab: isDelete ? 'Delete login' : 'Switch off',
        kicker: 'Family login',
        title: isDelete ? `Delete ${student.name}’s family login?` : `Switch off ${student.name}’s family login?`,
        subtitle: isDelete
            ? `The username ${link?.username || ''} stops working at once. You can create a new login any time.`
            : 'The family can’t sign in until you switch it back on with a new password.',
        body: `
            ${keyCard(student, link)}
            <ul class="office-facts">
                ${isDelete
                    ? `<li><i class="fas fa-trash" aria-hidden="true"></i>Removes the login and its link to ${escapeHtml(student.name)}.</li>
                       <li><i class="fas fa-box-archive" aria-hidden="true"></i>Keeps every star, grade and message on file.</li>`
                    : `<li><i class="fas fa-lock" aria-hidden="true"></i>Signs the family out and blocks new sign-ins.</li>
                       <li><i class="fas fa-rotate-left" aria-hidden="true"></i>Switch it back on here whenever you’re ready.</li>`}
            </ul>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-family-back>Back</button>
            <button type="button" class="office-btn ${isDelete ? 'office-btn--danger' : 'office-btn--stamp'}" data-family-confirm="${kind}">
                <i class="fas ${isDelete ? 'fa-trash' : 'fa-power-off'}" aria-hidden="true"></i> ${isDelete ? 'Delete login' : 'Switch off'}
            </button>
        `
    };
}

function renderBatch() {
    const classData = classById(dialog.classId);
    const running = dialog.running;
    const doneCount = dialog.results.filter((item) => item.ok).length;
    return {
        tab: 'Class logins',
        kicker: classData ? classLabel(classData) : 'Students waiting for a class',
        title: `Create ${dialog.batch.length} family login${dialog.batch.length === 1 ? '' : 's'}`,
        subtitle: 'Each family gets its own username and an easy password. You can print all the slips in one go.',
        body: `
            <ol class="family-batch">
                ${dialog.batch.map((item) => {
                    const result = dialog.results.find((entry) => entry.studentId === item.studentId);
                    const stateClass = result ? (result.ok ? ' is-done' : ' is-failed') : '';
                    return `
                        <li class="family-batch__row${stateClass}">
                            ${renderOfficeAvatar(studentById(item.studentId) || { name: item.studentName })}
                            <strong>${escapeHtml(item.studentName)}</strong>
                            <code>${escapeHtml(item.username)}</code>
                            <span class="family-batch__state">${result
                                ? (result.ok ? '<i class="fas fa-circle-check" aria-hidden="true"></i> Ready' : `<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${escapeHtml(result.error)}`)
                                : (running ? '<i class="fas fa-hourglass-half" aria-hidden="true"></i>' : '')}</span>
                        </li>`;
                }).join('')}
            </ol>
        `,
        footer: running
            ? `<span class="family-batch__progress"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Creating ${doneCount + 1} of ${dialog.batch.length}…</span>`
            : `
                <button type="button" class="office-btn office-btn--quiet" data-family-close>Cancel</button>
                <button type="button" class="office-btn office-btn--primary" data-family-run-batch><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Create ${dialog.batch.length} login${dialog.batch.length === 1 ? '' : 's'}</button>
            `
    };
}

function renderDone() {
    const ok = dialog.results.filter((item) => item.ok);
    const failed = dialog.results.filter((item) => !item.ok);
    const single = ok.length === 1 && !failed.length ? ok[0] : null;
    return {
        tab: 'Ready',
        kicker: 'Family login',
        title: single ? `${single.studentName}’s family can sign in` : `${ok.length} family login${ok.length === 1 ? '' : 's'} ready`,
        subtitle: 'Print the slip now or copy the details. For safety, passwords are not shown again after you close this.',
        body: `
            <div class="family-done">
                ${ok.map((item) => `
                    <div class="family-slip-preview">
                        <span class="family-slip-preview__name">${escapeHtml(item.studentName)}</span>
                        <span class="family-slip-preview__key"><small>Username</small><code>${escapeHtml(item.username)}</code></span>
                        <span class="family-slip-preview__key"><small>Password</small><code>${escapeHtml(item.password)}</code></span>
                        <button type="button" class="office-btn office-btn--quiet office-btn--small office-btn--icon" data-family-copy="${escapeHtml(item.studentId)}" aria-label="Copy ${escapeHtml(item.studentName)}’s login details"><i class="fas fa-copy" aria-hidden="true"></i></button>
                    </div>
                `).join('')}
                ${failed.length ? `
                    <div class="family-done__failed">
                        <strong><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${failed.length} couldn’t be created</strong>
                        <ul>${failed.map((item) => `<li>${escapeHtml(item.studentName)}: ${escapeHtml(item.error)}</li>`).join('')}</ul>
                        <span>Open their key tag to try again with another username.</span>
                    </div>` : ''}
            </div>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-family-close>Done</button>
            ${ok.length ? `<button type="button" class="office-btn office-btn--gold" data-family-print-slips><i class="fas fa-print" aria-hidden="true"></i> Print ${ok.length === 1 ? 'slip' : `${ok.length} slips`}</button>` : ''}
        `
    };
}

function paintDialog() {
    const modal = ensureDialog();
    const student = studentById(dialog.studentId);
    const link = linksByStudent.get(dialog.studentId) || null;
    let viewModel = null;
    if (dialog.mode === 'create' && student) viewModel = renderCreate(student);
    else if (dialog.mode === 'manage' && student) viewModel = renderManage(student, link);
    else if (dialog.mode === 'confirm-delete' && student) viewModel = renderConfirm(student, link, 'delete');
    else if (dialog.mode === 'confirm-off' && student) viewModel = renderConfirm(student, link, 'off');
    else if (dialog.mode === 'batch') viewModel = renderBatch();
    else if (dialog.mode === 'done') viewModel = renderDone();
    if (!viewModel) {
        closeDialog();
        return false;
    }
    modal.dataset.mode = dialog.mode;
    modal.querySelector('#family-key-tab').textContent = viewModel.tab;
    modal.querySelector('#family-key-kicker').textContent = viewModel.kicker;
    modal.querySelector('#family-key-title').textContent = viewModel.title;
    modal.querySelector('#family-key-subtitle').textContent = viewModel.subtitle;
    modal.querySelector('#family-key-body').innerHTML = viewModel.body;
    modal.querySelector('#family-key-footer').innerHTML = viewModel.footer;
    modal.querySelector('.office-close')?.classList.toggle('hidden', dialog.running);
    return true;
}

function showDialog({ focus = 'input' } = {}) {
    const modal = ensureDialog();
    const wasOpen = !modal.classList.contains('hidden');
    if (!paintDialog()) return;
    if (!wasOpen) {
        document.body.classList.add('placement-wizard-open');
        openOfficeModal(modal);
    }
    requestAnimationFrame(() => {
        const target = focus === 'input'
            ? modal.querySelector('#family-key-password') || modal.querySelector('[data-family-close]')
            : modal.querySelector('[data-family-print-slips], [data-family-confirm], [data-family-run-batch], [data-family-close]');
        target?.focus({ preventScroll: true });
        if (target?.id === 'family-key-password') target.select?.();
    });
}

/** Opens a student's key tag: create when there's no login, manage when there is. */
export function openFamilyLogin(studentId) {
    const student = studentById(studentId);
    if (!student) return;
    const open = () => {
        const link = linksByStudent.get(studentId) || null;
        Object.assign(dialog, {
            mode: link ? 'manage' : 'create',
            studentId,
            classId: student.classId || '',
            username: link?.username || suggestFamilyUsername(student.name, takenUsernames(studentId)),
            password: generateFamilyPassword(),
            batch: [],
            results: []
        });
        showDialog();
    };
    if (loadState === 'ready') open();
    else void loadFamilyLinks().then(open);
}

function openBatch(classKey) {
    const students = liveStudents()
        .filter((student) => (classKey === '__unplaced'
            ? !liveSchoolClasses().some((item) => item.id === student.classId)
            : student.classId === classKey))
        .filter((student) => !linksByStudent.get(student.id))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (!students.length) return;
    const taken = takenUsernames();
    const batch = students.map((student) => {
        const username = suggestFamilyUsername(student.name, taken);
        taken.push(username);
        return {
            studentId: student.id,
            studentName: student.name,
            classId: student.classId || '',
            username,
            password: generateFamilyPassword()
        };
    });
    Object.assign(dialog, { mode: 'batch', studentId: '', classId: classKey === '__unplaced' ? '' : classKey, batch, results: [], running: false });
    showDialog({ focus: 'action' });
}

function validateCredentials() {
    const username = normalizeFamilyUsername(dialog.username);
    const password = String(dialog.password || '').trim();
    if (username.length < 3) return { error: 'Choose a username with at least 3 letters or numbers.' };
    if (password.length < 6) return { error: 'Passwords need at least 6 characters.' };
    const clash = [...linksByStudent.values()].find((link) => link.studentId !== dialog.studentId && link.username === username);
    if (clash) {
        const other = studentById(clash.studentId);
        return { error: `${username} is already used by ${other ? `${other.name}’s family` : 'another family'}. Try another.` };
    }
    return { username, password };
}

async function saveSingle(button) {
    const student = studentById(dialog.studentId);
    if (!student) return;
    const link = linksByStudent.get(student.id) || null;
    const checked = validateCredentials();
    if (checked.error) {
        showToast(checked.error, 'error');
        document.getElementById(checked.error.startsWith('Passwords') ? 'family-key-password' : 'family-key-username')?.focus();
        return;
    }
    const { username, password } = checked;
    const onlyPassword = link && linkStatus(link) === 'active' && username === link.username;
    try {
        setBusyState(button, true, onlyPassword ? 'Saving password…' : 'Saving login…');
        if (onlyPassword) {
            await resetParentAccessPassword({ studentId: student.id, password });
        } else {
            // Creating, renaming and switching back on all go through the same call,
            // which also marks the family's profile active again.
            await createParentAccess({ studentId: student.id, classId: student.classId, studentName: student.name, username, password });
        }
        await refreshLink(student.id);
        Object.assign(dialog, {
            mode: 'done',
            results: [{ ok: true, studentId: student.id, studentName: student.name, className: classById(student.classId)?.name || '', username, password }]
        });
        showDialog({ focus: 'action' });
        notify();
    } catch (error) {
        console.error('Could not save family login:', error);
        showToast(friendlyActionError(error, 'Could not save the family login.'), 'error');
        setBusyState(button, false);
    }
}

async function runBatch() {
    if (dialog.running) return;
    dialog.running = true;
    dialog.results = [];
    paintDialog();
    for (const item of dialog.batch) {
        try {
            const student = studentById(item.studentId);
            await createParentAccess({
                studentId: item.studentId,
                classId: student?.classId || item.classId,
                studentName: student?.name || item.studentName,
                username: item.username,
                password: item.password
            });
            dialog.results.push({ ok: true, ...item, className: classById(item.classId)?.name || '' });
        } catch (error) {
            console.error('Could not create a family login:', error);
            dialog.results.push({ ok: false, ...item, error: friendlyActionError(error, 'Could not create this login.') });
        }
        paintDialog();
    }
    await loadFamilyLinks({ force: true });
    dialog.running = false;
    dialog.mode = 'done';
    showDialog({ focus: 'action' });
    const made = dialog.results.filter((item) => item.ok).length;
    if (made) showToast(`${made} family login${made === 1 ? '' : 's'} created.`, 'success');
}

async function confirmAction(kind, button) {
    const student = studentById(dialog.studentId);
    if (!student) return;
    try {
        setBusyState(button, true, kind === 'delete' ? 'Deleting…' : 'Switching off…');
        if (kind === 'delete') await deleteParentAccess({ studentId: student.id });
        else await disableParentAccess({ studentId: student.id });
        await refreshLink(student.id);
        closeDialog();
        showToast(kind === 'delete' ? `${student.name}’s family login was deleted.` : `${student.name}’s family login is switched off.`, 'success');
        notify();
    } catch (error) {
        console.error('Could not update family login:', error);
        showToast(friendlyActionError(error, 'Could not update the family login.'), 'error');
        setBusyState(button, false);
    }
}

function slipDetails(item) {
    return `${schoolName() ? `${schoolName()}\n` : ''}Family login for ${item.studentName}\nUsername: ${item.username}\nPassword: ${item.password}\nSign in: ${getParentLoginUrl()}`;
}

async function handleDialogClick(event) {
    const modal = document.getElementById(DIALOG_ID);
    if (event.target === modal) { closeDialog(); return; }
    if (event.target.closest('[data-family-close]')) { closeDialog(); return; }

    if (event.target.closest('[data-family-new-password]')) {
        dialog.password = generateFamilyPassword();
        const input = document.getElementById('family-key-password');
        if (input) {
            input.value = dialog.password;
            input.focus();
            input.select();
        }
        return;
    }
    const saveBtn = event.target.closest('[data-family-save]');
    if (saveBtn) { await saveSingle(saveBtn); return; }

    if (event.target.closest('[data-family-ask-off]')) { dialog.mode = 'confirm-off'; showDialog({ focus: 'action' }); return; }
    if (event.target.closest('[data-family-ask-delete]')) { dialog.mode = 'confirm-delete'; showDialog({ focus: 'action' }); return; }
    if (event.target.closest('[data-family-back]')) { dialog.mode = 'manage'; showDialog(); return; }
    const confirmBtn = event.target.closest('[data-family-confirm]');
    if (confirmBtn) { await confirmAction(confirmBtn.dataset.familyConfirm, confirmBtn); return; }

    if (event.target.closest('[data-family-run-batch]')) { await runBatch(); return; }

    const copyBtn = event.target.closest('[data-family-copy]');
    if (copyBtn) {
        const item = dialog.results.find((entry) => entry.studentId === copyBtn.dataset.familyCopy);
        if (item && await copyText(slipDetails(item))) showToast('Login details copied.', 'success');
        else showToast('Could not copy. Select the details and copy them by hand.', 'error');
        return;
    }
    const printBtn = event.target.closest('[data-family-print-slips]');
    if (printBtn) {
        const slips = dialog.results.filter((item) => item.ok).map((item) => ({
            studentName: item.studentName,
            className: item.className,
            username: item.username,
            password: item.password
        }));
        try {
            setBusyState(printBtn, true, 'Preparing…');
            await printFamilySlips({ schoolName: schoolName(), slips });
        } catch (error) {
            console.error('Could not print family slips:', error);
            showToast('Could not open printing. Try again.', 'error');
        } finally {
            setBusyState(printBtn, false);
        }
    }
}

// ── Panel clicks (wired from secretaryConsole.js) ──────────────────────────

/** Returns true when the click belonged to the Family Logins panel. */
export function handleFamilyLoginsClick(event) {
    const openBtn = event.target.closest('[data-family-open]');
    if (openBtn) { openFamilyLogin(openBtn.dataset.familyOpen); return true; }

    const batchBtn = event.target.closest('[data-family-batch]');
    if (batchBtn) { openBatch(batchBtn.dataset.familyBatch); return true; }

    const filterBtn = event.target.closest('[data-family-filter]');
    if (filterBtn) {
        state.setSecretaryView({ familyFilter: filterBtn.dataset.familyFilter });
        notify();
        return true;
    }
    if (event.target.closest('[data-family-reload]')) { void loadFamilyLinks({ force: true }); notify(); return true; }

    const posterBtn = event.target.closest('[data-family-print-poster]');
    if (posterBtn) {
        setBusyState(posterBtn, true, 'Preparing…');
        printFamilyPoster({ schoolName: schoolName(), lang: posterBtn.dataset.familyPrintPoster === 'el' ? 'el' : 'en' })
            .catch((error) => {
                console.error('Could not print the QR poster:', error);
                showToast('Could not open printing. Try again.', 'error');
            })
            .finally(() => setBusyState(posterBtn, false));
        return true;
    }
    if (event.target.closest('[data-family-copy-link]')) {
        copyText(getParentLoginUrl()).then((ok) => showToast(ok ? 'Parent sign-in link copied.' : 'Could not copy the link.', ok ? 'success' : 'error'));
        return true;
    }
    return false;
}
