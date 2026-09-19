import * as state from '../../state.js';
import {
    getLastLessonDate,
    getNextLessonDate,
    parseDDMMYYYY
} from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getGuildBadgeHtml, getGuildHouseDisplay } from '../guilds.js';
import { canUseFeature } from '../../utils/subscription.js';
import { escapeHtml, formatFlexibleDate, renderSubTabBar } from '../roles/shared.js';
import { renderGradesBoard, renderStudentAvatar } from './gradesBoard.js';
import { formatClassSchedule, getStudentScoreMap } from './helpers.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';

const PULSE_TABS = [
    { key: 'overview', label: 'Overview', icon: 'fa-heart', tone: 'sky' },
    { key: 'stars', label: 'Award Stars', icon: 'fa-star', tone: 'amber' },
    { key: 'team', label: 'Team Quest', icon: 'fa-route', tone: 'lime' },
    { key: 'challenge', label: "Hero's Challenge", icon: 'fa-user-graduate', tone: 'violet' },
    { key: 'market', label: 'Mystic Market', icon: 'fa-store', tone: 'emerald' },
    { key: 'guilds', label: 'Guild Hall', icon: 'fa-shield-alt', tone: 'indigo' },
    { key: 'log', label: 'Adventure Log', icon: 'fa-book-open', tone: 'teal' },
    { key: 'calendar', label: 'Quest Calendar', icon: 'fa-calendar-alt', tone: 'sky' },
    { key: 'attendance', label: 'Attendance', icon: 'fa-user-check', tone: 'rose' },
    { key: 'grades', label: 'Grades', icon: 'fa-scroll', tone: 'amber' }
];

const VIRTUES = [
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'creativity', label: 'Creativity' },
    { key: 'respect', label: 'Respect' },
    { key: 'focus', label: 'Focus' }
];

function renderLeagueChip(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) {
        return `<span class="placement-league-chip placement-league-chip--unknown">League not recorded</span>`;
    }
    const ageLabel = definition.ageGroup.includes('-')
        ? definition.ageGroup.replace('-', '–')
        : definition.ageGroup;
    return `
        <span class="placement-league-chip league-picker-option--${escapeHtml(definition.pickerTheme)}" title="Ages ${escapeHtml(ageLabel)}">
            <i class="fas ${escapeHtml(definition.pickerIcon)}" aria-hidden="true"></i>
            <span class="placement-league-chip__name">${escapeHtml(definition.name)}</span>
            <span class="placement-league-chip__age">Ages ${escapeHtml(ageLabel)}</span>
        </span>
    `;
}

function classStudents(classId) {
    return (state.get('allStudents') || [])
        .filter((student) => student.classId === classId && student.enrollmentStatus !== 'inactive')
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function formatLessonLabel(dateKey) {
    if (!dateKey) return 'Not set';
    const parsed = parseDDMMYYYY(dateKey) || (typeof dateKey === 'string' && dateKey.includes('-') ? new Date(`${dateKey}T12:00:00`) : null);
    if (!parsed || Number.isNaN(parsed.getTime())) return formatFlexibleDate(dateKey);
    return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function nextAndLast(classId) {
    const classes = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    return {
        next: getNextLessonDate(classId, classes, overrides, holidays, {}),
        last: getLastLessonDate(classId, classes, overrides, holidays, {})
    };
}

function scoreFor(studentId) {
    return getStudentScoreMap().get(studentId) || {};
}

function classStarTotals(students) {
    return students.reduce((acc, student) => {
        const score = scoreFor(student.id);
        acc.monthly += Number(score.monthlyStars || 0);
        acc.total += Number(score.totalStars || 0);
        acc.gold += getLiveYearGoldFromAppState(score, state);
        return acc;
    }, { monthly: 0, total: 0, gold: 0 });
}

function latestAssignment(classId) {
    return (state.get('allQuestAssignments') || [])
        .filter((item) => item.classId === classId)
        .slice()
        .sort((a, b) => {
            const aMs = a.createdAt?.toMillis?.() || 0;
            const bMs = b.createdAt?.toMillis?.() || 0;
            return bMs - aMs;
        })[0] || null;
}

function latestLog(classId) {
    return (state.get('allAdventureLogs') || [])
        .filter((item) => item.classId === classId)
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
}

function attendanceForClass(classId, students) {
    const ids = new Set(students.map((student) => student.id));
    return (state.get('allAttendanceRecords') || []).filter((item) => (
        item.classId === classId || ids.has(item.studentId)
    ));
}

function renderPulseStat(label, value, tone = 'sky') {
    return `
        <div class="role-stat-tile role-stat-tile--${tone}">
            <div class="role-stat-tile__label">${escapeHtml(label)}</div>
            <div class="role-stat-tile__value">${value}</div>
        </div>
    `;
}

function renderOverview(classData, students) {
    const totals = classStarTotals(students);
    const lessons = nextAndLast(classData.id);
    const assignment = latestAssignment(classData.id);
    const log = latestLog(classData.id);
    const absences = attendanceForClass(classData.id, students);
    return `
        <div class="class-pulse-stats">
            ${renderPulseStat('Heroes', students.length, 'sky')}
            ${renderPulseStat('Stars this month', Math.round(totals.monthly * 10) / 10, 'amber')}
            ${renderPulseStat('Gold', Math.round(totals.gold), 'emerald')}
            ${renderPulseStat('Absences (30 days)', absences.length, 'rose')}
        </div>
        <div class="class-pulse-insight-grid">
            <article class="class-pulse-insight">
                <p>Next lesson</p>
                <strong>${escapeHtml(formatLessonLabel(lessons.next))}</strong>
            </article>
            <article class="class-pulse-insight">
                <p>Last lesson</p>
                <strong>${escapeHtml(formatLessonLabel(lessons.last))}</strong>
            </article>
            <article class="class-pulse-insight">
                <p>Quest Assignment</p>
                <strong>${escapeHtml(assignment?.text || assignment?.testData?.title || 'None yet')}</strong>
            </article>
            <article class="class-pulse-insight">
                <p>Adventure Log</p>
                <strong>${escapeHtml(log?.title || log?.diary?.title || (log ? formatFlexibleDate(log.date) : 'None yet'))}</strong>
            </article>
        </div>
        <h4 class="class-pulse-section-title">Roster</h4>
        <div class="class-pulse-roster">
            ${students.length ? students.map((student) => {
                const score = scoreFor(student.id);
                const house = getGuildHouseDisplay(student.guildId);
                return `
                    <article class="class-pulse-hero">
                        ${renderStudentAvatar(student)}
                        <div>
                            <strong>${escapeHtml(student.name)}</strong>
                            <p>${Number(score.monthlyStars || 0)} stars this month${house.assigned ? ` · ${escapeHtml(house.label)}` : ''}</p>
                        </div>
                    </article>
                `;
            }).join('') : '<div class="role-empty-state">No students seated in this class yet.</div>'}
        </div>
    `;
}

function renderStars(classData, students) {
    const logs = (state.get('allAwardLogs') || []).filter((item) => item.classId === classData.id);
    const virtueTotals = Object.fromEntries(VIRTUES.map((virtue) => [virtue.key, 0]));
    for (const student of students) {
        const byReason = scoreFor(student.id).starsByReason || {};
        for (const virtue of VIRTUES) {
            virtueTotals[virtue.key] += Number(byReason[virtue.key] || 0);
        }
    }
    return `
        <div class="class-pulse-stats">
            ${VIRTUES.map((virtue) => renderPulseStat(virtue.label, Math.round(virtueTotals[virtue.key] * 10) / 10, 'amber')).join('')}
        </div>
        <p class="placement-hint">${logs.length} Award Stars records this month for this class.</p>
        <div class="class-pulse-roster">
            ${students.map((student) => {
                const score = scoreFor(student.id);
                const byReason = score.starsByReason || {};
                const mix = VIRTUES
                    .map((virtue) => `${virtue.label[0]} ${Number(byReason[virtue.key] || 0)}`)
                    .join(' · ');
                return `
                    <article class="class-pulse-hero">
                        ${renderStudentAvatar(student)}
                        <div>
                            <strong>${escapeHtml(student.name)}</strong>
                            <p>${Number(score.monthlyStars || 0)} this month · ${Number(score.totalStars || 0)} all year</p>
                            <p class="class-pulse-muted">${escapeHtml(mix)}</p>
                        </div>
                    </article>
                `;
            }).join('') || '<div class="role-empty-state">No stars yet.</div>'}
        </div>
    `;
}

function renderTeamQuest(classData, students) {
    const totals = classStarTotals(students);
    const peers = (state.get('allSchoolClasses') || [])
        .filter((item) => item.status !== 'archived' && item.questLevel === classData.questLevel)
        .map((item) => {
            const roster = classStudents(item.id);
            return { id: item.id, name: item.name, logo: item.logo, monthly: classStarTotals(roster).monthly };
        })
        .sort((a, b) => b.monthly - a.monthly);
    const rank = peers.findIndex((item) => item.id === classData.id) + 1;
    const events = (state.get('allQuestEvents') || []).filter((item) => item.classId === classData.id);
    return `
        <div class="class-pulse-stats">
            ${renderPulseStat('Monthly stars', Math.round(totals.monthly * 10) / 10, 'amber')}
            ${renderPulseStat('League rank', rank ? `${rank} of ${peers.length}` : '—', 'sky')}
            ${renderPulseStat('Quest Events', events.length, 'violet')}
        </div>
        <div class="class-pulse-rank-list">
            ${peers.map((item, index) => `
                <article class="class-pulse-rank${item.id === classData.id ? ' is-self' : ''}">
                    <span>${index + 1}</span>
                    <strong>${escapeHtml(item.logo || '📚')} ${escapeHtml(item.name)}</strong>
                    <em>${Math.round(item.monthly * 10) / 10}</em>
                </article>
            `).join('') || '<div class="role-empty-state">No league peers yet.</div>'}
        </div>
    `;
}

function renderChallenge(students) {
    const ranked = students
        .map((student) => ({ student, monthly: Number(scoreFor(student.id).monthlyStars || 0), total: Number(scoreFor(student.id).totalStars || 0) }))
        .sort((a, b) => b.monthly - a.monthly || b.total - a.total || a.student.name.localeCompare(b.student.name));
    return `
        <div class="class-pulse-rank-list">
            ${ranked.map((row, index) => `
                <article class="class-pulse-rank">
                    <span>${index + 1}</span>
                    ${renderStudentAvatar(row.student)}
                    <strong>${escapeHtml(row.student.name)}</strong>
                    <em>${row.monthly} / ${row.total}</em>
                </article>
            `).join('') || '<div class="role-empty-state">No heroes to rank yet.</div>'}
        </div>
        <p class="placement-hint">Monthly stars / all-year stars. Gold spent never lowers rank.</p>
    `;
}

function renderMarket(students) {
    const ranked = students
        .map((student) => ({ student, gold: getLiveYearGoldFromAppState(scoreFor(student.id), state) }))
        .sort((a, b) => b.gold - a.gold);
    const total = ranked.reduce((sum, row) => sum + row.gold, 0);
    return `
        <div class="class-pulse-stats">
            ${renderPulseStat('Class gold', Math.round(total), 'emerald')}
        </div>
        <div class="class-pulse-rank-list mt-4">
            ${ranked.map((row) => `
                <article class="class-pulse-rank">
                    ${renderStudentAvatar(row.student)}
                    <strong>${escapeHtml(row.student.name)}</strong>
                    <em>${Math.round(row.gold)} Gold</em>
                </article>
            `).join('') || '<div class="role-empty-state">No gold recorded yet.</div>'}
        </div>
    `;
}

function renderGuilds(students) {
    const groups = new Map();
    for (const student of students) {
        const key = student.guildId || 'unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(student);
    }
    return `
        <div class="class-pulse-guild-grid">
            ${[...groups.entries()].map(([guildId, members]) => {
                const house = getGuildHouseDisplay(guildId);
                return `
                    <article class="class-pulse-guild">
                        <div class="class-pulse-guild__head">
                            ${getGuildBadgeHtml(guildId, 'w-10 h-10') || '<span class="class-pulse-guild__empty">🛡️</span>'}
                            <div>
                                <strong>${escapeHtml(house.label)}</strong>
                                <p>${members.length} ${members.length === 1 ? 'hero' : 'heroes'}</p>
                            </div>
                        </div>
                        <p>${members.map((student) => escapeHtml(student.name)).join(', ')}</p>
                    </article>
                `;
            }).join('') || '<div class="role-empty-state">No guild houses in this class yet.</div>'}
        </div>
    `;
}

function renderLog(classData) {
    const logs = (state.get('allAdventureLogs') || [])
        .filter((item) => item.classId === classData.id)
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return logs.length ? logs.map((log) => `
        <article class="class-pulse-log">
            ${log.imageUrl ? `<img src="${escapeHtml(log.imageUrl)}" alt="" class="class-pulse-log__art">` : ''}
            <div>
                <p class="class-pulse-log__date">${escapeHtml(formatFlexibleDate(log.date))} · Hero of the Day: ${escapeHtml(log.hero || log.heroOfTheDay || 'The class')}</p>
                <strong>${escapeHtml(log.title || log.diary?.title || 'Adventure Log')}</strong>
                <p>${escapeHtml(log.entry || log.diary?.entry || '')}</p>
            </div>
        </article>
    `).join('') : '<div class="role-empty-state">No Adventure Log entries in the last 30 days.</div>';
}

function renderCalendar(classData) {
    const lessons = nextAndLast(classData.id);
    const holidays = (state.get('schoolHolidayRanges') || []).slice(0, 6);
    return `
        <p class="class-pulse-schedule-line">${escapeHtml(formatClassSchedule(classData))}</p>
        <div class="class-pulse-insight-grid">
            <article class="class-pulse-insight">
                <p>Next lesson</p>
                <strong>${escapeHtml(formatLessonLabel(lessons.next))}</strong>
            </article>
            <article class="class-pulse-insight">
                <p>Last lesson</p>
                <strong>${escapeHtml(formatLessonLabel(lessons.last))}</strong>
            </article>
        </div>
        <h4 class="class-pulse-section-title">School holidays</h4>
        ${holidays.length ? holidays.map((range) => `
            <article class="class-pulse-holiday">
                <strong>${escapeHtml(range.name || 'Holiday')}</strong>
                <p>${escapeHtml(formatFlexibleDate(range.start || range.startDate))} – ${escapeHtml(formatFlexibleDate(range.end || range.endDate))}</p>
            </article>
        `).join('') : '<div class="role-empty-state">No holiday ranges on the school calendar.</div>'}
    `;
}

function renderAttendance(classData, students) {
    const records = attendanceForClass(classData.id, students);
    const byStudent = new Map();
    for (const record of records) {
        byStudent.set(record.studentId, (byStudent.get(record.studentId) || 0) + 1);
    }
    return `
        <p class="placement-hint">Absences recorded in the last 30 days. Present days are not stored as extra rows.</p>
        <div class="class-pulse-roster">
            ${students.map((student) => {
                const absences = byStudent.get(student.id) || 0;
                return `
                    <article class="class-pulse-hero">
                        ${renderStudentAvatar(student)}
                        <div>
                            <strong>${escapeHtml(student.name)}</strong>
                            <p>${absences} ${absences === 1 ? 'absence' : 'absences'}</p>
                        </div>
                    </article>
                `;
            }).join('') || '<div class="role-empty-state">No roster to chart.</div>'}
        </div>
    `;
}

function renderPulseBody(classData, students, subTab) {
    if (subTab === 'stars') return renderStars(classData, students);
    if (subTab === 'team') return renderTeamQuest(classData, students);
    if (subTab === 'challenge') return renderChallenge(students);
    if (subTab === 'market') return renderMarket(students);
    if (subTab === 'guilds') return renderGuilds(students);
    if (subTab === 'log') return renderLog(classData);
    if (subTab === 'calendar') return renderCalendar(classData);
    if (subTab === 'attendance') return renderAttendance(classData, students);
    if (subTab === 'grades') return renderGradesBoard({ classId: classData.id });
    return renderOverview(classData, students);
}

export function renderClassCockpit(classData) {
    const students = classStudents(classData.id);
    const view = state.get('secretaryView') || {};
    const subTab = PULSE_TABS.some((tab) => tab.key === view.classPulseSubTab)
        ? view.classPulseSubTab
        : 'overview';
    const hasFullConsole = canUseFeature('secretaryAccess');

    return `
        <button type="button" class="class-pulse-back" data-secretary-class-back>
            <i class="fas fa-arrow-left" aria-hidden="true"></i> All classes
        </button>
        <header class="class-pulse-hero-card">
            <span class="class-pulse-hero-card__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
            <div class="class-pulse-hero-card__copy">
                <p class="secretary-card__eyebrow">${escapeHtml(classData.createdBy?.name || 'Teacher')}</p>
                <h3>${escapeHtml(classData.name)}</h3>
                <div class="class-pulse-hero-card__meta">
                    ${renderLeagueChip(classData.questLevel)}
                    <span>${escapeHtml(formatClassSchedule(classData))}</span>
                    <span>${students.length} ${students.length === 1 ? 'hero' : 'heroes'}</span>
                </div>
            </div>
            ${hasFullConsole ? `
                <button type="button" class="secretary-shell__secondary-btn" data-secretary-open-class-desk="${escapeHtml(classData.id)}">
                    Open class desk
                </button>
            ` : ''}
        </header>
        ${renderSubTabBar(PULSE_TABS, subTab, 'data-secretary-class-pulse')}
        <div class="class-pulse-body">
            ${renderPulseBody(classData, students, subTab)}
        </div>
    `;
}
