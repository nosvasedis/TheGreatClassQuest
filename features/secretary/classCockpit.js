import * as state from '../../state.js';
import {
    getLastLessonDate,
    getNextLessonDate,
    parseDDMMYYYY
} from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getGuildBadgeHtml, getGuildHouseDisplay } from '../guilds.js';
import { canUseFeature } from '../../utils/subscription.js';
import { escapeHtml, formatFlexibleDate } from '../roles/shared.js';
import { renderGradesBoard } from './gradesBoard.js';
import { formatClassSchedule, getStudentScoreMap, renderOfficeAvatar } from './helpers.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';

const PULSE_TABS = [
    { key: 'overview', label: 'Overview', icon: 'fa-heart', tone: 'sky', hint: 'The class at a glance' },
    { key: 'stars', label: 'Award Stars', icon: 'fa-star', tone: 'amber', hint: 'Stars by virtue' },
    { key: 'team', label: 'Team Quest', icon: 'fa-route', tone: 'lime', hint: 'The league race' },
    { key: 'challenge', label: "Hero's Challenge", icon: 'fa-user-graduate', tone: 'violet', hint: 'Top heroes' },
    { key: 'market', label: 'Mystic Market', icon: 'fa-store', tone: 'emerald', hint: 'Gold purses' },
    { key: 'guilds', label: 'Guild Hall', icon: 'fa-shield-alt', tone: 'indigo', hint: 'Guild houses' },
    { key: 'log', label: 'Adventure Log', icon: 'fa-book-open', tone: 'teal', hint: 'Class diary' },
    { key: 'calendar', label: 'Quest Calendar', icon: 'fa-calendar-alt', tone: 'sky', hint: 'Lessons and breaks' },
    { key: 'attendance', label: 'Attendance', icon: 'fa-user-check', tone: 'rose', hint: 'Absences' },
    { key: 'grades', label: 'Grades', icon: 'fa-scroll', tone: 'amber', hint: 'Tests and homework' }
];

const VIRTUES = [
    { key: 'teamwork', label: 'Teamwork', icon: 'fa-people-group', tone: 'sky' },
    { key: 'creativity', label: 'Creativity', icon: 'fa-palette', tone: 'violet' },
    { key: 'respect', label: 'Respect', icon: 'fa-handshake', tone: 'emerald' },
    { key: 'focus', label: 'Focus', icon: 'fa-bullseye', tone: 'rose' }
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

const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;

function renderPulseStat(label, value, tone = 'sky', icon = 'fa-circle', note = '') {
    return `
        <div class="pulse-stat pulse-stat--${tone}">
            <span class="pulse-stat__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <span class="pulse-stat__copy">
                <small>${escapeHtml(label)}</small>
                <strong class="font-title">${value}</strong>
                ${note ? `<em>${escapeHtml(note)}</em>` : ''}
            </span>
        </div>
    `;
}

function renderEmpty(icon, text) {
    return `
        <div class="pulse-empty">
            <span aria-hidden="true"><i class="fas ${icon}"></i></span>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

function renderSection(title, icon, content, aside = '') {
    return `
        <section class="pulse-section">
            <header class="pulse-section__head">
                <h4><i class="fas ${icon}" aria-hidden="true"></i>${escapeHtml(title)}</h4>
                ${aside}
            </header>
            ${content}
        </section>
    `;
}

function renderMeter(value, max, tone) {
    const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
    return `<span class="pulse-meter pulse-meter--${tone}" aria-hidden="true"><span style="width:${value > 0 ? pct : 0}%"></span></span>`;
}

function renderOverview(classData, students) {
    const totals = classStarTotals(students);
    const lessons = nextAndLast(classData.id);
    const assignment = latestAssignment(classData.id);
    const log = latestLog(classData.id);
    const absences = attendanceForClass(classData.id, students);
    const maxMonthly = Math.max(0, ...students.map((student) => Number(scoreFor(student.id).monthlyStars || 0)));
    return `
        <div class="pulse-stats">
            ${renderPulseStat('Heroes', students.length, 'sky', 'fa-users')}
            ${renderPulseStat('Stars this month', round1(totals.monthly), 'amber', 'fa-star')}
            ${renderPulseStat('Gold', Math.round(totals.gold), 'emerald', 'fa-coins')}
            ${renderPulseStat('Absences', absences.length, 'rose', 'fa-user-clock', 'Last 30 days')}
        </div>
        <div class="pulse-notes">
            <article class="pulse-note pulse-note--sky">
                <span class="pulse-note__icon" aria-hidden="true"><i class="fas fa-calendar-day"></i></span>
                <div><small>Next lesson</small><strong>${escapeHtml(formatLessonLabel(lessons.next))}</strong><em>Last: ${escapeHtml(formatLessonLabel(lessons.last))}</em></div>
            </article>
            <article class="pulse-note pulse-note--amber">
                <span class="pulse-note__icon" aria-hidden="true"><i class="fas fa-feather"></i></span>
                <div><small>Quest Assignment</small><strong>${escapeHtml(assignment?.text || assignment?.testData?.title || 'None yet')}</strong></div>
            </article>
            <article class="pulse-note pulse-note--teal">
                <span class="pulse-note__icon" aria-hidden="true"><i class="fas fa-book-open"></i></span>
                <div><small>Adventure Log</small><strong>${escapeHtml(log?.title || log?.diary?.title || (log ? formatFlexibleDate(log.date) : 'None yet'))}</strong></div>
            </article>
        </div>
        ${renderSection('Heroes in this class', 'fa-users', students.length ? `
            <div class="pulse-heroes">
                ${students.map((student) => {
                    const score = scoreFor(student.id);
                    const monthly = Number(score.monthlyStars || 0);
                    const house = getGuildHouseDisplay(student.guildId);
                    return `
                        <article class="pulse-hero">
                            ${renderOfficeAvatar(student, { size: 'lg' })}
                            <div class="pulse-hero__copy">
                                <strong>${escapeHtml(student.name)}</strong>
                                <small>${house.assigned ? `${escapeHtml(house.emoji)} ${escapeHtml(house.name)}` : 'No guild yet'}</small>
                                <span class="pulse-hero__stars"><i class="fas fa-star" aria-hidden="true"></i>${round1(monthly)} ${renderMeter(monthly, maxMonthly, 'amber')}</span>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        ` : renderEmpty('fa-chair', 'No students seated in this class yet.'))}
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
    const maxMonthly = Math.max(0, ...students.map((student) => Number(scoreFor(student.id).monthlyStars || 0)));
    return `
        <div class="pulse-stats">
            ${VIRTUES.map((virtue) => renderPulseStat(virtue.label, round1(virtueTotals[virtue.key]), virtue.tone, virtue.icon)).join('')}
        </div>
        ${renderSection('Stars per hero', 'fa-star', students.length ? `
            <div class="pulse-list">
                ${students.map((student) => {
                    const score = scoreFor(student.id);
                    const byReason = score.starsByReason || {};
                    const monthly = Number(score.monthlyStars || 0);
                    return `
                        <article class="pulse-row">
                            ${renderOfficeAvatar(student)}
                            <div class="pulse-row__copy">
                                <strong>${escapeHtml(student.name)}</strong>
                                <span class="pulse-virtues">
                                    ${VIRTUES.map((virtue) => `<span class="pulse-virtue pulse-virtue--${virtue.tone}" title="${escapeHtml(virtue.label)}"><i class="fas ${virtue.icon}" aria-hidden="true"></i>${round1(byReason[virtue.key])}</span>`).join('')}
                                </span>
                            </div>
                            <div class="pulse-row__value">
                                <strong>${round1(monthly)}</strong>
                                <small>${round1(score.totalStars)} all year</small>
                                ${renderMeter(monthly, maxMonthly, 'amber')}
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        ` : renderEmpty('fa-star', 'No stars yet.'), `<span class="pulse-section__aside">${logs.length} award${logs.length === 1 ? '' : 's'} this month</span>`)}
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
    const leader = peers[0]?.monthly || 0;
    return `
        <div class="pulse-stats">
            ${renderPulseStat('Monthly stars', round1(totals.monthly), 'amber', 'fa-star')}
            ${renderPulseStat('League place', rank ? `${rank}<small> of ${peers.length}</small>` : '—', 'sky', 'fa-flag-checkered')}
            ${renderPulseStat('Quest Events', events.length, 'violet', 'fa-wand-sparkles')}
        </div>
        ${renderSection(`${classData.questLevel || 'League'} race this month`, 'fa-route', peers.length ? `
            <ol class="pulse-race">
                ${peers.map((item, index) => `
                    <li class="pulse-race__lane${item.id === classData.id ? ' is-self' : ''}">
                        <span class="pulse-place pulse-place--${index < 3 ? index + 1 : 'n'}">${index + 1}</span>
                        <span class="pulse-race__logo" aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                        <span class="pulse-race__name">${escapeHtml(item.name)}</span>
                        <span class="pulse-race__track">${renderMeter(item.monthly, leader, item.id === classData.id ? 'sky' : 'lime')}</span>
                        <strong>${round1(item.monthly)}</strong>
                    </li>
                `).join('')}
            </ol>
        ` : renderEmpty('fa-route', 'No league peers yet.'))}
    `;
}

function renderChallenge(students) {
    const ranked = students
        .map((student) => ({ student, monthly: Number(scoreFor(student.id).monthlyStars || 0), total: Number(scoreFor(student.id).totalStars || 0) }))
        .sort((a, b) => b.monthly - a.monthly || b.total - a.total || a.student.name.localeCompare(b.student.name));
    if (!ranked.length) return renderEmpty('fa-user-graduate', 'No heroes to rank yet.');
    const podium = ranked.slice(0, 3);
    const order = [podium[1], podium[0], podium[2]].filter(Boolean);
    return `
        <div class="pulse-podium">
            ${order.map((row) => {
                const place = ranked.indexOf(row) + 1;
                return `
                    <div class="pulse-podium__spot pulse-podium__spot--${place}">
                        ${place === 1 ? '<i class="fas fa-crown pulse-podium__crown" aria-hidden="true"></i>' : ''}
                        ${renderOfficeAvatar(row.student, { size: 'lg' })}
                        <strong>${escapeHtml(row.student.name)}</strong>
                        <small>${round1(row.monthly)} stars</small>
                        <span class="pulse-podium__step font-title">${place}</span>
                    </div>
                `;
            }).join('')}
        </div>
        ${ranked.length > 3 ? renderSection('Everyone else', 'fa-list-ol', `
            <div class="pulse-list">
                ${ranked.slice(3).map((row, index) => `
                    <article class="pulse-row">
                        <span class="pulse-place pulse-place--n">${index + 4}</span>
                        ${renderOfficeAvatar(row.student)}
                        <div class="pulse-row__copy"><strong>${escapeHtml(row.student.name)}</strong><small>${round1(row.total)} stars all year</small></div>
                        <div class="pulse-row__value"><strong>${round1(row.monthly)}</strong><small>this month</small></div>
                    </article>
                `).join('')}
            </div>
        `) : ''}
        <p class="pulse-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> Ranked by stars this month, then all year. Spending Gold never lowers a place.</p>
    `;
}

function renderMarket(students) {
    const ranked = students
        .map((student) => ({ student, gold: getLiveYearGoldFromAppState(scoreFor(student.id), state) }))
        .sort((a, b) => b.gold - a.gold);
    const total = ranked.reduce((sum, row) => sum + row.gold, 0);
    const richest = ranked[0]?.gold || 0;
    return `
        <div class="pulse-stats">
            ${renderPulseStat('Class gold', Math.round(total), 'emerald', 'fa-coins')}
            ${renderPulseStat('Average purse', ranked.length ? Math.round(total / ranked.length) : 0, 'amber', 'fa-sack-dollar')}
        </div>
        ${renderSection('Purses', 'fa-coins', ranked.length ? `
            <div class="pulse-list">
                ${ranked.map((row) => `
                    <article class="pulse-row">
                        ${renderOfficeAvatar(row.student)}
                        <div class="pulse-row__copy"><strong>${escapeHtml(row.student.name)}</strong>${renderMeter(row.gold, richest, 'gold')}</div>
                        <div class="pulse-row__value pulse-row__value--gold"><strong>${Math.round(row.gold)}</strong><small>Gold</small></div>
                    </article>
                `).join('')}
            </div>
        ` : renderEmpty('fa-coins', 'No gold recorded yet.'))}
    `;
}

function renderGuilds(students) {
    const groups = new Map();
    for (const student of students) {
        const key = student.guildId || 'unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(student);
    }
    if (!groups.size) return renderEmpty('fa-shield-alt', 'No guild houses in this class yet.');
    return `
        <div class="pulse-guilds">
            ${[...groups.entries()].map(([guildId, members]) => {
                const house = getGuildHouseDisplay(guildId);
                return `
                    <article class="pulse-guild">
                        <header class="pulse-guild__head">
                            ${getGuildBadgeHtml(guildId, 'w-12 h-12') || '<span class="pulse-guild__empty" aria-hidden="true">🛡️</span>'}
                            <div>
                                <strong>${escapeHtml(house.label)}</strong>
                                <small>${members.length} ${members.length === 1 ? 'hero' : 'heroes'}</small>
                            </div>
                        </header>
                        <ul class="pulse-guild__members">
                            ${members.map((student) => `<li>${renderOfficeAvatar(student)}<span>${escapeHtml(student.name)}</span></li>`).join('')}
                        </ul>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderLog(classData) {
    const logs = (state.get('allAdventureLogs') || [])
        .filter((item) => item.classId === classData.id)
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!logs.length) return renderEmpty('fa-book-open', 'No Adventure Log entries in the last 30 days.');
    return `
        <div class="pulse-journal">
            ${logs.map((log) => `
                <article class="pulse-entry">
                    ${log.imageUrl ? `<img src="${escapeHtml(log.imageUrl)}" alt="" class="pulse-entry__art" loading="lazy">` : '<span class="pulse-entry__art pulse-entry__art--blank" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>'}
                    <div class="pulse-entry__copy">
                        <p class="pulse-entry__date">${escapeHtml(formatFlexibleDate(log.date))}</p>
                        <strong>${escapeHtml(log.title || log.diary?.title || 'Adventure Log')}</strong>
                        <p>${escapeHtml(log.entry || log.diary?.entry || '')}</p>
                        <span class="pulse-entry__hero"><i class="fas fa-medal" aria-hidden="true"></i> Hero of the Day: ${escapeHtml(log.hero || log.heroOfTheDay || 'The class')}</span>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function renderDateLeaf(dateKey, label, tone) {
    const text = formatLessonLabel(dateKey);
    const parts = text === 'Not set' ? null : text.split(' ');
    return `
        <article class="pulse-leaf pulse-leaf--${tone}">
            <span class="pulse-leaf__page" aria-hidden="true">
                <span class="pulse-leaf__month">${escapeHtml(parts ? parts[2] || '' : '—')}</span>
                <span class="pulse-leaf__day font-title">${escapeHtml(parts ? parts[1] || '' : '?')}</span>
            </span>
            <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(text)}</strong></div>
        </article>
    `;
}

function renderCalendar(classData) {
    const lessons = nextAndLast(classData.id);
    const holidays = (state.get('schoolHolidayRanges') || []).slice(0, 6);
    return `
        <div class="pulse-schedule"><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(formatClassSchedule(classData))}</div>
        <div class="pulse-leaves">
            ${renderDateLeaf(lessons.next, 'Next lesson', 'sky')}
            ${renderDateLeaf(lessons.last, 'Last lesson', 'violet')}
        </div>
        ${renderSection('School breaks', 'fa-umbrella-beach', holidays.length ? `
            <div class="pulse-breaks">
                ${holidays.map((range) => `
                    <article class="pulse-break">
                        <strong>${escapeHtml(range.name || 'Holiday')}</strong>
                        <small>${escapeHtml(formatFlexibleDate(range.start || range.startDate))} – ${escapeHtml(formatFlexibleDate(range.end || range.endDate))}</small>
                    </article>
                `).join('')}
            </div>
        ` : renderEmpty('fa-umbrella-beach', 'No breaks on the school calendar yet.'))}
    `;
}

function renderAttendance(classData, students) {
    const records = attendanceForClass(classData.id, students);
    const byStudent = new Map();
    for (const record of records) {
        byStudent.set(record.studentId, (byStudent.get(record.studentId) || 0) + 1);
    }
    const perfect = students.filter((student) => !byStudent.get(student.id)).length;
    return `
        <div class="pulse-stats">
            ${renderPulseStat('Absences', records.length, 'rose', 'fa-user-clock', 'Last 30 days')}
            ${renderPulseStat('Never missed', `${perfect}<small> of ${students.length}</small>`, 'emerald', 'fa-user-check')}
        </div>
        ${renderSection('Each hero', 'fa-user-check', students.length ? `
            <div class="pulse-heroes">
                ${students.map((student) => {
                    const absences = byStudent.get(student.id) || 0;
                    return `
                        <article class="pulse-hero">
                            ${renderOfficeAvatar(student)}
                            <div class="pulse-hero__copy">
                                <strong>${escapeHtml(student.name)}</strong>
                                <span class="pulse-absence${absences ? ' has-absences' : ''}">${absences ? `${absences} ${absences === 1 ? 'absence' : 'absences'}` : '<i class="fas fa-check" aria-hidden="true"></i> Always here'}</span>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        ` : renderEmpty('fa-user-check', 'No roster to show.'))}
        <p class="pulse-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> Only absences are stored, so a day without one means the hero was there.</p>
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

function renderPulseNav(activeKey) {
    return `
        <nav class="pulse-nav" role="tablist" aria-label="Class views">
            ${PULSE_TABS.map((tab) => `
                <button type="button" class="pulse-nav__tab pulse-nav__tab--${tab.tone}${tab.key === activeKey ? ' is-active' : ''}"
                    data-secretary-class-pulse="${escapeHtml(tab.key)}" role="tab" aria-selected="${tab.key === activeKey ? 'true' : 'false'}">
                    <span class="pulse-nav__icon" aria-hidden="true"><i class="fas ${tab.icon}"></i></span>
                    <span class="pulse-nav__label">${escapeHtml(tab.label)}</span>
                </button>
            `).join('')}
        </nav>
    `;
}

export function renderClassCockpit(classData) {
    const students = classStudents(classData.id);
    const view = state.get('secretaryView') || {};
    const subTab = PULSE_TABS.some((tab) => tab.key === view.classPulseSubTab)
        ? view.classPulseSubTab
        : 'overview';
    const active = PULSE_TABS.find((tab) => tab.key === subTab);
    const hasFullConsole = canUseFeature('secretaryAccess');
    const teacherName = classData.createdBy?.name || 'Teacher';

    return `
        <div class="class-pulse">
            <button type="button" class="class-pulse-back" data-secretary-class-back>
                <i class="fas fa-arrow-left" aria-hidden="true"></i> All classes
            </button>
            <header class="class-pulse-hero-card">
                <span class="class-pulse-hero-card__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
                <div class="class-pulse-hero-card__copy">
                    <h3 class="font-title">${escapeHtml(classData.name)}</h3>
                    <p class="class-pulse-hero-card__teacher">
                        ${renderOfficeAvatar({ name: teacherName })}
                        <span><small>Teacher</small>${escapeHtml(teacherName)}</span>
                    </p>
                    <div class="class-pulse-hero-card__meta">
                        ${renderLeagueChip(classData.questLevel)}
                        <span class="class-pulse-chip"><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(formatClassSchedule(classData))}</span>
                        <span class="class-pulse-chip"><i class="fas fa-users" aria-hidden="true"></i>${students.length} ${students.length === 1 ? 'hero' : 'heroes'}</span>
                    </div>
                </div>
                ${hasFullConsole ? `
                    <button type="button" class="office-btn office-btn--quiet class-pulse-hero-card__desk" data-secretary-open-class-desk="${escapeHtml(classData.id)}">
                        <i class="fas fa-folder-open" aria-hidden="true"></i> Open class desk
                    </button>
                ` : ''}
            </header>
            ${renderPulseNav(subTab)}
            <section class="class-pulse-body pulse-panel--${active.tone}">
                <header class="pulse-panel__head">
                    <span class="pulse-panel__icon" aria-hidden="true"><i class="fas ${active.icon}"></i></span>
                    <div>
                        <h4 class="font-title">${escapeHtml(active.label)}</h4>
                        <p>${escapeHtml(active.hint)}</p>
                    </div>
                </header>
                ${renderPulseBody(classData, students, subTab)}
            </section>
        </div>
    `;
}
