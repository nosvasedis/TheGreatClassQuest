import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate } from '../roles/shared.js';
import {
    getStudentMap,
    getClassMap,
    getLatestScoreSummary,
    getThreadTypeMeta,
    getThreadStudentLabel
} from './helpers.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { DEFAULT_SCHOOL_NAME } from '../../constants.js';
import { sumLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { normalizeSchoolYearState, formatSchoolYearLabel } from '../../utils/schoolYear.js';
import { getFormerStudents } from './formerStudents.js';
import { renderOfficeAvatar } from './helpers.js';

function getSecretaryHomeTheme() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return {
            greeting: 'Good Morning',
            greetingGradient: 'from-amber-400 via-orange-400 to-rose-400',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school',
            isNight: false
        };
    }
    if (hour >= 12 && hour < 17) {
        return {
            greeting: 'Good Afternoon',
            greetingGradient: 'from-blue-400 via-cyan-400 to-teal-400',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school',
            isNight: false
        };
    }
    if (hour >= 17 && hour < 21) {
        return {
            greeting: 'Good Evening',
            greetingGradient: 'from-indigo-500 via-purple-500 to-pink-500',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school-flag',
            isNight: false
        };
    }
    return {
        greeting: 'Good Night',
        greetingGradient: 'from-indigo-900 via-purple-900 to-slate-800',
        weatherBg: 'w-night',
        weatherIcon: 'fa-moon',
        isNight: true
    };
}

function planBadgeMeta(tier) {
    const key = String(tier || 'starter').toLowerCase();
    if (key === 'elite') return { key, label: 'Elite', icon: 'fa-gem' };
    if (key === 'pro') return { key, label: 'Pro', icon: 'fa-bolt' };
    if (key === 'expired') return { key, label: 'Expired', icon: 'fa-hourglass-half' };
    return { key: 'starter', label: 'Starter', icon: 'fa-seedling' };
}

function planPillHtml(tier) {
    const plan = planBadgeMeta(tier);
    return `
        <span class="secretary-plan-pill secretary-plan-pill--${plan.key}">
            <span class="secretary-plan-pill__icon" aria-hidden="true"><i class="fas ${plan.icon}"></i></span>
            <span class="secretary-plan-pill__label">${escapeHtml(plan.label)} plan</span>
        </span>
    `;
}

function todayLabel() {
    try {
        return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
        return new Date().toDateString();
    }
}

// Things on the secretary's desk right now, most urgent first. Each one opens where it gets done.
function deskTasks({ waitingCount, unreadThreads, hasFullConsole, yearState }) {
    const tasks = [];
    if (waitingCount > 0) {
        tasks.push({
            tone: 'amber',
            icon: 'fa-chair',
            title: `Seat ${waitingCount} returning student${waitingCount === 1 ? '' : 's'}`,
            detail: 'They are waiting for a class this year.',
            action: 'Seat them',
            attrs: 'data-secretary-registry-seat="1"'
        });
    }
    if (hasFullConsole && unreadThreads > 0) {
        tasks.push({
            tone: 'violet',
            icon: 'fa-envelope-open-text',
            title: `${unreadThreads} family message${unreadThreads === 1 ? '' : 's'} waiting`,
            detail: 'Parents are waiting for an answer.',
            action: 'Open messages',
            attrs: 'data-secretary-tab-link="messages"'
        });
    }
    if (!yearState.closeDate) {
        tasks.push({
            tone: 'sky',
            icon: 'fa-calendar-day',
            title: 'Set the last school day',
            detail: `${formatSchoolYearLabel(yearState.activeYearKey) || 'This year'} has no end date yet.`,
            action: 'Open School Year',
            attrs: 'data-secretary-tab-link="admin" data-secretary-admin-subtab="year"'
        });
    }
    return tasks;
}

function renderDeskTasks(tasks) {
    if (!tasks.length) {
        return `
            <div class="office-home-clear">
                <span class="office-home-clear__icon" aria-hidden="true"><i class="fas fa-mug-hot"></i></span>
                <div>
                    <strong>All clear</strong>
                    <p>Nothing is waiting on you right now.</p>
                </div>
            </div>
        `;
    }
    return `
        <ul class="office-home-tasks">
            ${tasks.map((task) => `
                <li>
                    <button type="button" class="office-home-task office-home-task--${task.tone}" ${task.attrs}>
                        <span class="office-home-task__icon" aria-hidden="true"><i class="fas ${task.icon}"></i></span>
                        <span class="office-home-task__copy">
                            <strong>${escapeHtml(task.title)}</strong>
                            <small>${escapeHtml(task.detail)}</small>
                        </span>
                        <span class="office-home-task__go">${escapeHtml(task.action)}<i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                    </button>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderStatCard({ tone, icon, label, value, note, attrs = '' }) {
    const tag = attrs ? 'button type="button"' : 'div';
    const close = attrs ? 'button' : 'div';
    return `
        <${tag} class="office-home-stat office-home-stat--${tone}" ${attrs}>
            <span class="office-home-stat__label"><i class="fas ${icon}" aria-hidden="true"></i>${escapeHtml(label)}</span>
            <span class="office-home-stat__value font-title">${escapeHtml(value)}</span>
            <span class="office-home-stat__note">${escapeHtml(note)}</span>
        </${close}>
    `;
}

export function renderSecretaryHome() {
    const classes = state.get('allSchoolClasses') || [];
    const allStudents = (state.get('allStudents') || []).filter((student) => student.enrollmentStatus !== 'inactive');
    const scores = state.get('allStudentScores') || [];
    const threads = state.get('currentCommunicationThreads') || [];
    const totalStars = scores.reduce((sum, item) => sum + Number(item.totalStars || 0), 0);
    const totalGold = sumLiveYearGoldFromAppState(scores, state);
    const unreadThreads = threads.filter((t) => !t.lastReadAt || t.lastReadAt < t.lastMessageAt).length;
    const latestThread = threads[0] || null;
    const latestScoreInfo = getLatestScoreSummary();
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const profile = state.get('currentUserProfile') || {};
    const schoolName = state.get('schoolName') || DEFAULT_SCHOOL_NAME;
    const hasFullConsole = canUseFeature('secretaryAccess');
    const tier = String(getTier() || 'starter');
    const secretaryName = profile.displayName || 'Secretary';
    const theme = getSecretaryHomeTheme();
    const yearState = normalizeSchoolYearState(state.get('schoolYearState') || {});
    const waitingCount = allStudents.filter((student) => student.enrollmentStatus === 'pendingPlacement' || !student.classId).length;
    const seatedCount = allStudents.length - waitingCount;
    const formerCount = getFormerStudents()?.length;
    const tasks = deskTasks({ waitingCount, unreadThreads, hasFullConsole, yearState });

    const tools = [
        { icon: 'fa-chalkboard', label: 'Classes', note: 'Timetable and rosters', tone: 'sky', tab: 'school', schoolSub: 'classes' },
        { icon: 'fa-user-graduate', label: 'Students', note: 'Every hero at school', tone: 'emerald', tab: 'school', schoolSub: 'students' },
        ...(hasFullConsole ? [
            { icon: 'fa-chart-simple', label: 'Grades', note: 'Tests and report cards', tone: 'indigo', tab: 'grades' },
            { icon: 'fa-comments', label: 'Messages', note: 'Talk with families', tone: 'violet', tab: 'messages' }
        ] : []),
        { icon: 'fa-folder-open', label: 'Students & Classes', note: 'Enrol, seat, former', tone: 'amber', tab: 'admin', adminSub: 'registry' },
        { icon: 'fa-cog', label: 'Settings', note: 'School and plan', tone: 'slate', tab: 'admin', adminSub: 'settings' }
    ];

    const latestGradeHtml = latestScoreInfo
        ? `<button type="button" class="office-home-note office-home-note--grade"${hasFullConsole ? ' data-secretary-tab-link="grades"' : ''}>
                <span class="office-home-note__kicker"><i class="fas fa-star" aria-hidden="true"></i>Latest grade</span>
                <span class="office-home-note__who">
                    ${renderOfficeAvatar(latestScoreInfo.student || {})}
                    <span>
                        <strong>${escapeHtml(latestScoreInfo.student?.name || 'Student')}</strong>
                        <small>${escapeHtml(latestScoreInfo.classData?.name || 'Class')} · ${escapeHtml(formatFlexibleDate(latestScoreInfo.score.date))}</small>
                    </span>
                </span>
                <span class="office-home-note__line">
                    <span>${escapeHtml(latestScoreInfo.score.title || latestScoreInfo.score.type || 'Assessment')}</span>
                    <span class="office-home-note__mark">${escapeHtml(latestScoreInfo.label)}</span>
                </span>
           </button>`
        : `<div class="office-home-note office-home-note--grade is-empty">
                <span class="office-home-note__kicker"><i class="fas fa-star" aria-hidden="true"></i>Latest grade</span>
                <p>New grades will appear here when teachers add them.</p>
           </div>`;

    const latestMessageHtml = latestThread && hasFullConsole
        ? (() => {
            const meta = getThreadTypeMeta(latestThread.threadType);
            const labels = getThreadStudentLabel(latestThread, studentMap, classMap);
            const student = studentMap.get(latestThread.studentId) || { name: labels.studentName };
            return `<button type="button" class="office-home-note office-home-note--message" data-secretary-thread="${escapeHtml(latestThread.id)}" data-secretary-open-messages="1">
                <span class="office-home-note__kicker"><i class="fas ${meta.icon}" aria-hidden="true"></i>${escapeHtml(meta.label)}</span>
                <span class="office-home-note__who">
                    ${renderOfficeAvatar(student)}
                    <span>
                        <strong>${escapeHtml(labels.studentName)}</strong>
                        <small>${escapeHtml(labels.className)}</small>
                    </span>
                </span>
                <span class="office-home-note__line"><span>Open the conversation</span><i class="fas fa-arrow-right" aria-hidden="true"></i></span>
            </button>`;
        })()
        : `<div class="office-home-note office-home-note--message is-empty">
                <span class="office-home-note__kicker"><i class="fas fa-comments" aria-hidden="true"></i>Latest conversation</span>
                <p>${hasFullConsole ? 'Family conversations will appear here when they begin.' : 'Family messaging is available with the Elite plan.'}</p>
           </div>`;

    return `
    <div class="office-home${theme.isNight ? ' is-night' : ''}">
        <section class="office-home-desk">
            <div class="office-home-desk__window" aria-hidden="true">
                <i class="fas ${theme.weatherIcon}"></i>
                <span class="office-home-desk__cloud office-home-desk__cloud--a"></span>
                <span class="office-home-desk__cloud office-home-desk__cloud--b"></span>
            </div>
            <div class="office-home-desk__copy">
                <p class="office-home-desk__date">${escapeHtml(todayLabel())}</p>
                <h2 class="font-title office-home-desk__greeting">
                    <span class="office-home-desk__hello bg-gradient-to-r ${theme.greetingGradient}">${theme.greeting},</span>
                    <span class="office-home-desk__name">${escapeHtml(secretaryName)}!</span>
                </h2>
                <p class="office-home-desk__school" data-school-name><i class="fas fa-university" aria-hidden="true"></i>${escapeHtml(schoolName)}</p>
                <div class="office-home-desk__pills">${planPillHtml(tier)}</div>
            </div>
            <div class="office-home-desk__plate" aria-hidden="true">
                <span class="office-home-desk__bell"><i class="fas fa-bell-concierge"></i></span>
                <span class="office-home-desk__plate-text">Front desk</span>
            </div>
        </section>

        <div class="office-home-grid">
            <section class="office-home-board">
                <header class="office-home-board__head">
                    <span class="office-home-board__pin" aria-hidden="true"></span>
                    <h3>On your desk today</h3>
                    ${tasks.length ? `<span class="office-home-board__count">${tasks.length}</span>` : ''}
                </header>
                ${renderDeskTasks(tasks)}
            </section>

            <section class="office-home-stats" aria-label="School at a glance">
                ${renderStatCard({ tone: 'sky', icon: 'fa-user-graduate', label: 'Students', value: allStudents.length.toLocaleString(), note: waitingCount ? `${seatedCount} seated · ${waitingCount} waiting` : 'All seated in a class', attrs: 'data-secretary-tab-link="school" data-secretary-school-subtab="students"' })}
                ${renderStatCard({ tone: 'emerald', icon: 'fa-chalkboard', label: 'Classes', value: classes.length.toLocaleString(), note: 'Across the school', attrs: 'data-secretary-tab-link="school" data-secretary-school-subtab="classes"' })}
                ${renderStatCard({ tone: 'amber', icon: 'fa-star', label: 'School stars', value: totalStars.toLocaleString(), note: 'Earned so far' })}
                ${renderStatCard({ tone: 'violet', icon: 'fa-coins', label: 'Treasury', value: totalGold.toLocaleString(), note: 'Gold this year' })}
            </section>
        </div>

        <div class="office-home-grid office-home-grid--lower">
            <section class="office-home-cabinet">
                <h3 class="office-home-heading"><i class="fas fa-box-archive" aria-hidden="true"></i>Office drawers</h3>
                <div class="office-home-drawers">
                    ${tools.map((tool) => `
                        <button type="button" class="office-home-drawer office-home-drawer--${tool.tone}"
                            data-secretary-tab-link="${tool.tab}"
                            ${tool.schoolSub ? `data-secretary-school-subtab="${tool.schoolSub}"` : ''}
                            ${tool.adminSub ? `data-secretary-admin-subtab="${tool.adminSub}"` : ''}
                            title="${escapeHtml(tool.label)}">
                            <span class="office-home-drawer__icon" aria-hidden="true"><i class="fas ${tool.icon}"></i></span>
                            <span class="office-home-drawer__label">
                                <strong>${escapeHtml(tool.label)}</strong>
                                <small>${escapeHtml(tool.note)}</small>
                            </span>
                            <span class="office-home-drawer__handle" aria-hidden="true"></span>
                        </button>
                    `).join('')}
                </div>
                ${formerCount ? `<p class="office-home-former"><i class="fas fa-box-archive" aria-hidden="true"></i>${formerCount} former student${formerCount === 1 ? '' : 's'} on file. <button type="button" data-secretary-registry-link="former">View them</button></p>` : ''}
            </section>

            <section class="office-home-latest">
                <h3 class="office-home-heading"><i class="fas fa-thumbtack" aria-hidden="true"></i>Latest at school</h3>
                <div class="office-home-notes">
                    ${latestGradeHtml}
                    ${latestMessageHtml}
                </div>
            </section>
        </div>
    </div>`;
}
