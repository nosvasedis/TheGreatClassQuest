// features/secretary/registry.js — Admin → Students & Classes.
// One place for the whole student journey: enrol a new student, seat returning
// students, give teachers their classes, and look after students who have left.
import * as state from '../../state.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { canUseFeature } from '../../utils/subscription.js';
import { escapeHtml } from '../roles/shared.js';
import { formatClassSchedule, getClassMap, liveSchoolClasses, renderOfficeAvatar } from './helpers.js';
import {
    LEAVE_REASONS,
    formatLeftDate,
    getFormerStudents,
    loadFormerStudents,
    reasonMeta
} from './formerStudents.js';

export const REGISTRY_LANES = Object.freeze([
    { key: 'students', label: 'Students', icon: 'fa-user-graduate' },
    { key: 'classes', label: 'Classes', icon: 'fa-chalkboard' },
    { key: 'former', label: 'Former students', icon: 'fa-box-archive' }
]);

function view() {
    return state.get('secretaryView') || {};
}

function currentLane() {
    const lane = view().registryLane;
    return REGISTRY_LANES.some((item) => item.key === lane) ? lane : 'students';
}

function enrolledStudents() {
    return (state.get('allStudents') || []).filter((student) => student.enrollmentStatus !== 'inactive');
}

function waitingStudents() {
    return enrolledStudents().filter((student) => student.enrollmentStatus === 'pendingPlacement' || !student.classId);
}

function rosterCount(classId) {
    return enrolledStudents().filter((student) => student.classId === classId && student.enrollmentStatus !== 'pendingPlacement').length;
}

function matches(query, ...fields) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return true;
    return fields.some((field) => String(field || '').toLowerCase().includes(needle));
}

export function renderLeagueTag(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) {
        return leagueName ? `<span class="office-league office-league--unknown">${escapeHtml(leagueName)}</span>` : '';
    }
    return `<span class="office-league league-picker-option--${escapeHtml(definition.pickerTheme)}"><i class="fas ${escapeHtml(definition.pickerIcon)}" aria-hidden="true"></i>${escapeHtml(definition.name)}</span>`;
}

function renderSearch(id, value, placeholder) {
    return `
        <label class="office-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" aria-label="${escapeHtml(placeholder)}">
        </label>
    `;
}

// The front counter: one path from an empty school to a full roster.
// Classes come first, students sit in them, and anyone waiting gets a seat.
// Every class card and class drawer below carries its own Enrol and Edit too.
function renderDeskActions(hasFullConsole) {
    const waiting = waitingStudents().length;
    const classCount = liveSchoolClasses().length;
    const lock = hasFullConsole ? '' : '<span class="office-desk__lock"><i class="fas fa-gem" aria-hidden="true"></i> Elite</span>';
    return `
        <div class="office-desks${waiting ? ' has-waiting' : ''}" role="group" aria-label="Students and classes">
            <button type="button" class="office-desk office-desk--classes${classCount ? '' : ' is-first'}" data-secretary-new-class>
                <span class="office-desk__step" aria-hidden="true">1</span>
                <span class="office-desk__icon" aria-hidden="true"><i class="fas fa-chalkboard-user"></i></span>
                <span class="office-desk__copy">
                    <strong>Open a new class</strong>
                    <small>${classCount
                        ? `${classCount} ${classCount === 1 ? 'class' : 'classes'} this year. Edit one from its card.`
                        : 'Start here: name, league, days and teacher.'}</small>
                </span>
                ${lock}
            </button>
            <span class="office-desks__link" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
            <button type="button" id="school-year-student-desk-open-btn" class="office-desk office-desk--enrol"${classCount ? '' : ' data-empty="1"'}>
                <span class="office-desk__step" aria-hidden="true">2</span>
                <span class="office-desk__icon" aria-hidden="true"><i class="fas fa-user-plus"></i></span>
                <span class="office-desk__copy">
                    <strong>Enrol a new student</strong>
                    <small>${classCount ? 'Pick their class, write their name. Done.' : 'Open a class first, or make one on the way.'}</small>
                </span>
                ${lock}
            </button>
            ${waiting ? `
                <button type="button" id="school-year-placement-open-btn" class="office-desk office-desk--seat has-waiting">
                    <span class="office-desk__icon" aria-hidden="true"><i class="fas fa-chair"></i></span>
                    <span class="office-desk__copy">
                        <strong>Seat returning students</strong>
                        <small>${waiting} ${waiting === 1 ? 'is' : 'are'} waiting for a class this year.</small>
                    </span>
                    <span class="office-desk__count" aria-label="${waiting} waiting">${waiting}</span>
                </button>` : ''}
        </div>
    `;
}

function renderLaneTabs(lane) {
    const counts = {
        students: enrolledStudents().length,
        classes: liveSchoolClasses().length,
        former: getFormerStudents().status === 'ready' ? getFormerStudents().items.length : null
    };
    return `
        <nav class="office-lanes" role="tablist" aria-label="Students and classes">
            ${REGISTRY_LANES.map((item) => `
                <button type="button" class="office-lane office-lane--${item.key}${lane === item.key ? ' is-active' : ''}"
                    data-secretary-registry-lane="${item.key}" role="tab" aria-selected="${lane === item.key ? 'true' : 'false'}">
                    <i class="fas ${item.icon}" aria-hidden="true"></i>
                    <span>${item.label}</span>
                    ${counts[item.key] == null ? '' : `<span class="office-lane__count">${counts[item.key]}</span>`}
                </button>
            `).join('')}
        </nav>
    `;
}

function renderStudentRow(student, classData) {
    const waiting = student.enrollmentStatus === 'pendingPlacement' || !student.classId;
    return `
        <li class="office-row">
            ${renderOfficeAvatar(student)}
            <span class="office-row__copy">
                <strong>${escapeHtml(student.name)}</strong>
                <small>${waiting
                    ? escapeHtml(student.previousClassName ? `Last year: ${student.previousClassName}` : 'Returning student')
                    : escapeHtml(student.heroClass ? `${student.heroClass} hero` : 'Hero path not chosen yet')}</small>
            </span>
            ${waiting ? '<span class="office-stamp office-stamp--waiting">Waiting</span>' : ''}
            <span class="office-row__actions">
                <button type="button" class="office-icon-btn" data-secretary-edit-student="${escapeHtml(student.id)}" title="Edit ${escapeHtml(student.name)}" aria-label="Edit ${escapeHtml(student.name)}">
                    <i class="fas fa-pen" aria-hidden="true"></i><span>Edit</span>
                </button>
                <button type="button" class="office-icon-btn office-icon-btn--leave" data-secretary-leave-student="${escapeHtml(student.id)}" title="${escapeHtml(student.name)} is leaving the school" aria-label="${escapeHtml(student.name)} is leaving the school">
                    <i class="fas fa-door-open" aria-hidden="true"></i><span>Leaves</span>
                </button>
            </span>
        </li>
    `;
}

function renderStudentsLane() {
    const search = view().registrySearch || '';
    const hasFullConsole = canUseFeature('secretaryAccess');
    const classMap = getClassMap();
    const students = enrolledStudents()
        .filter((student) => {
            const classData = classMap.get(student.classId);
            return matches(search, student.name, student.heroClass, classData?.name, classData?.questLevel, classData?.createdBy?.name, student.previousClassName);
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const groups = new Map();
    for (const student of students) {
        const waiting = student.enrollmentStatus === 'pendingPlacement' || !student.classId || !classMap.has(student.classId);
        const key = waiting ? '__waiting' : student.classId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(student);
    }
    const keys = [...groups.keys()].sort((a, b) => {
        if (a === '__waiting') return -1;
        if (b === '__waiting') return 1;
        return String(classMap.get(a)?.name || '').localeCompare(String(classMap.get(b)?.name || ''));
    });

    return `
        <div class="office-lane-bar">
            ${renderSearch('secretary-registry-search', search, 'Find a student, class or teacher…')}
        </div>
        <div data-secretary-live="registry-results">
        ${students.length ? `
            <div class="office-drawers">
                ${keys.map((key) => {
                    const list = groups.get(key);
                    const classData = key === '__waiting' ? null : classMap.get(key);
                    return `
                        <section class="office-drawer${classData ? '' : ' office-drawer--waiting'}">
                            <header class="office-drawer__head">
                                <span class="office-drawer__logo" aria-hidden="true">${escapeHtml(classData?.logo || '⏳')}</span>
                                <div class="office-drawer__title">
                                    <h4>${escapeHtml(classData?.name || 'Waiting for a class')}</h4>
                                    <p>${classData
                                        ? `${escapeHtml(classData.createdBy?.name || 'Teacher')} · ${escapeHtml(formatClassSchedule(classData))}`
                                        : 'Returning or re-admitted students who still need a class this year.'}</p>
                                </div>
                                ${classData ? `${renderLeagueTag(classData.questLevel)}${hasFullConsole ? `
                                    <button type="button" class="office-btn office-btn--small office-btn--enrol" data-secretary-enrol-in="${escapeHtml(classData.id)}" aria-label="Enrol a new student in ${escapeHtml(classData.name)}">
                                        <i class="fas fa-user-plus" aria-hidden="true"></i><span>Enrol</span>
                                    </button>` : ''}` : `
                                    <button type="button" class="office-btn office-btn--small office-btn--gold" data-secretary-registry-seat>
                                        <i class="fas fa-chair" aria-hidden="true"></i> Seat them
                                    </button>`}
                                <span class="office-drawer__count">${list.length}</span>
                            </header>
                            <ul class="office-rows">
                                ${list.map((student) => renderStudentRow(student, classData)).join('')}
                            </ul>
                        </section>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="office-empty">
                <i class="fas fa-user-graduate" aria-hidden="true"></i>
                <h4>${search ? 'Nobody matches that search' : 'No students yet'}</h4>
                <p>${search
                    ? 'Try a first name, a class, or a teacher.'
                    : (liveSchoolClasses().length
                        ? 'Enrol a new student into one of this year’s classes.'
                        : 'Open this year’s first class, then enrol students into it.')}</p>
                ${!search && hasFullConsole ? `
                    <button type="button" class="office-btn office-btn--primary" ${liveSchoolClasses().length ? 'data-secretary-enrol-in=""' : 'data-secretary-new-class'}>
                        <i class="fas ${liveSchoolClasses().length ? 'fa-user-plus' : 'fa-chalkboard-user'}" aria-hidden="true"></i> ${liveSchoolClasses().length ? 'Enrol a new student' : 'Open a new class'}
                    </button>` : ''}
            </div>
        `}
        </div>
    `;
}

function renderClassesLane() {
    const search = view().registrySearch || '';
    const classes = liveSchoolClasses()
        .filter((item) => matches(search, item.name, item.questLevel, item.createdBy?.name))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const hasFullConsole = canUseFeature('secretaryAccess');
    return `
        <div class="office-lane-bar">
            ${renderSearch('secretary-registry-search', search, 'Find a class, league or teacher…')}
        </div>
        <div data-secretary-live="registry-results">
        <div class="office-class-grid">
            ${classes.map((item) => {
                const count = rosterCount(item.id);
                return `
                    <article class="office-class-card">
                        <div class="office-class-card__top">
                            <span class="office-class-card__logo" aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                            <div>
                                <h4>${escapeHtml(item.name)}</h4>
                                ${renderLeagueTag(item.questLevel)}
                            </div>
                        </div>
                        <dl class="office-class-card__facts">
                            <div><dt><i class="fas fa-user" aria-hidden="true"></i><span class="sr-only">Teacher</span></dt><dd>${escapeHtml(item.createdBy?.name || 'No teacher yet')}</dd></div>
                            <div><dt><i class="fas fa-clock" aria-hidden="true"></i><span class="sr-only">Schedule</span></dt><dd>${escapeHtml(formatClassSchedule(item))}</dd></div>
                            <div><dt><i class="fas fa-users" aria-hidden="true"></i><span class="sr-only">Students</span></dt><dd>${count} ${count === 1 ? 'student' : 'students'}</dd></div>
                        </dl>
                        <div class="office-class-card__actions">
                            ${hasFullConsole ? `
                                <button type="button" class="office-btn office-btn--small office-btn--enrol" data-secretary-enrol-in="${escapeHtml(item.id)}" aria-label="Enrol a new student in ${escapeHtml(item.name)}">
                                    <i class="fas fa-user-plus" aria-hidden="true"></i> Enrol
                                </button>
                                <button type="button" class="office-btn office-btn--small office-btn--quiet" data-secretary-open-class-desk="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name)}">
                                    <i class="fas fa-pen" aria-hidden="true"></i> Edit
                                </button>` : ''}
                            <button type="button" class="office-btn office-btn--small office-btn--quiet${hasFullConsole ? ' office-btn--icon' : ''}" data-secretary-view-class="${escapeHtml(item.id)}" title="See how ${escapeHtml(item.name)} is doing" aria-label="See how ${escapeHtml(item.name)} is doing">
                                <i class="fas fa-eye" aria-hidden="true"></i>${hasFullConsole ? '' : ' View'}
                            </button>
                        </div>
                    </article>
                `;
            }).join('')}
            ${hasFullConsole && !search ? `
                <button type="button" class="office-class-card office-class-card--new" data-secretary-new-class>
                    <span class="office-class-card__plus" aria-hidden="true"><i class="fas fa-plus"></i></span>
                    <strong>Open a new class</strong>
                    <small>Name, emblem, league, days and teacher.</small>
                </button>` : ''}
        </div>
        ${!classes.length && search ? `
            <div class="office-empty"><i class="fas fa-chalkboard" aria-hidden="true"></i><h4>No class matches that search</h4><p>Try a class name, a league or a teacher.</p></div>
        ` : ''}
        </div>
    `;
}

function renderFormerCard(former) {
    const meta = reasonMeta(former.leftReason);
    const teacher = former.formerTeacher?.name || former.createdBy?.name || '';
    return `
        <li class="office-card-file">
            ${renderOfficeAvatar(former, { muted: true })}
            <div class="office-card-file__copy">
                <div class="office-card-file__name">
                    <strong>${escapeHtml(former.name)}</strong>
                    <span class="office-stamp office-stamp--${meta.tone}">${escapeHtml(meta.stamp)}</span>
                </div>
                <p>Left ${escapeHtml(formatLeftDate(former.leftSchoolAt))}${former.formerClassName ? ` · was in ${escapeHtml(former.formerClassName)}` : ''}${teacher ? ` with ${escapeHtml(teacher)}` : ''}</p>
                ${former.leftNote ? `<p class="office-card-file__note">“${escapeHtml(former.leftNote)}”</p>` : ''}
            </div>
            <div class="office-card-file__actions">
                <button type="button" class="office-btn office-btn--small office-btn--primary" data-secretary-return-student="${escapeHtml(former.id)}">
                    <i class="fas fa-door-open" aria-hidden="true"></i> Bring back
                </button>
                <button type="button" class="office-btn office-btn--small office-btn--danger-quiet" data-secretary-delete-former="${escapeHtml(former.id)}" aria-label="Delete ${escapeHtml(former.name)} forever">
                    <i class="fas fa-trash-can" aria-hidden="true"></i><span>Delete forever</span>
                </button>
            </div>
        </li>
    `;
}

function renderFormerLane() {
    const former = getFormerStudents();
    if (former.status === 'idle') void loadFormerStudents();
    const search = view().registrySearch || '';
    const filter = view().formerFilter || 'all';
    const counts = LEAVE_REASONS.reduce((acc, reason) => ({
        ...acc,
        [reason.key]: former.items.filter((item) => reasonMeta(item.leftReason).key === reason.key).length
    }), {});
    const items = former.items.filter((item) => (filter === 'all' || reasonMeta(item.leftReason).key === filter)
        && matches(search, item.name, item.formerClassName, item.formerTeacher?.name, item.leftNote));

    let body;
    if (former.status === 'loading' || former.status === 'idle') {
        body = `<ul class="office-cards is-loading" aria-busy="true">${'<li class="office-card-file office-card-file--skeleton"></li>'.repeat(3)}</ul>`;
    } else if (former.status === 'error' && !former.items.length) {
        body = `
            <div class="office-empty office-empty--error">
                <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                <h4>Could not open the former students file</h4>
                <p>${escapeHtml(former.error)}</p>
                <button type="button" class="office-btn office-btn--primary" data-secretary-former-reload><i class="fas fa-rotate" aria-hidden="true"></i> Try again</button>
            </div>`;
    } else if (!items.length) {
        body = `
            <div class="office-empty">
                <i class="fas fa-box-archive" aria-hidden="true"></i>
                <h4>${former.items.length ? 'Nobody matches' : 'No former students'}</h4>
                <p>${former.items.length
                    ? 'Try another name or reason.'
                    : 'When a student leaves, choose Leaves on their row. Their record is kept here, ready to bring back.'}</p>
            </div>`;
    } else {
        body = `<ul class="office-cards">${items.map(renderFormerCard).join('')}</ul>`;
    }

    return `
        <div class="office-lane-bar office-lane-bar--former">
            ${renderSearch('secretary-registry-search', search, 'Find a former student…')}
            <div class="office-filter" role="group" aria-label="Filter by reason">
                <button type="button" class="office-filter__chip${filter === 'all' ? ' is-active' : ''}" data-secretary-former-filter="all" aria-pressed="${filter === 'all'}">All <span>${former.items.length}</span></button>
                ${LEAVE_REASONS.map((reason) => `
                    <button type="button" class="office-filter__chip office-filter__chip--${reason.tone}${filter === reason.key ? ' is-active' : ''}" data-secretary-former-filter="${reason.key}" aria-pressed="${filter === reason.key}">
                        <i class="fas ${reason.icon}" aria-hidden="true"></i>${escapeHtml(reason.label)} <span>${counts[reason.key]}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <p class="office-lane-note"><i class="fas fa-shield-heart" aria-hidden="true"></i>Former students keep every star, grade and note. Nothing here is deleted unless you choose Delete forever.</p>
        <div data-secretary-live="registry-results">${body}</div>
    `;
}

export function renderRegistry() {
    const lane = currentLane();
    const hasFullConsole = canUseFeature('secretaryAccess');
    const body = lane === 'classes' ? renderClassesLane() : lane === 'former' ? renderFormerLane() : renderStudentsLane();
    return `
        <div class="office-registry">
            ${renderDeskActions(hasFullConsole)}
            <div class="office-folder office-registry__folder">
                ${renderLaneTabs(lane)}
                <div class="office-lane-panel office-lane-panel--${lane}" role="tabpanel">
                    ${body}
                </div>
            </div>
        </div>
    `;
}

// A short roll call for other screens, pointing into the registry.
export function renderRegistryRollCall() {
    const students = enrolledStudents().length;
    const waiting = waitingStudents().length;
    const classes = liveSchoolClasses().length;
    const former = getFormerStudents();
    return `
        <section class="office-rollcall office-folder">
            <span class="office-folder__tab">Students &amp; classes</span>
            <div class="office-rollcall__stats">
                <button type="button" data-secretary-registry-link="students"><strong>${students}</strong><span>students</span></button>
                <button type="button" data-secretary-registry-link="classes"><strong>${classes}</strong><span>classes</span></button>
                <button type="button" data-secretary-registry-link="students" class="${waiting ? 'is-alert' : ''}"><strong>${waiting}</strong><span>waiting for a class</span></button>
                <button type="button" data-secretary-registry-link="former"><strong>${former.status === 'ready' ? former.items.length : '—'}</strong><span>former students</span></button>
            </div>
            <p>Enrolling, seating, classes and former students all live in one place now.</p>
            <button type="button" class="office-btn office-btn--primary" data-secretary-registry-link="students">
                <i class="fas fa-folder-open" aria-hidden="true"></i> Open Students &amp; Classes
            </button>
        </section>
    `;
}
