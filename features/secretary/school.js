import * as state from '../../state.js';
import { escapeHtml, renderTabHero, renderSubTabBar } from '../roles/shared.js';
import {
    filteredClasses,
    filteredStudents,
    formatClassSchedule,
    getClassMap,
    getLatestScoresByStudent,
    getStudentScoreMap
} from './helpers.js';
import { getAssessmentValueLabel } from '../assessmentConfig.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getNextLessonDate, parseDDMMYYYY } from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getGuildHouseDisplay } from '../guilds.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { renderStudentAvatar } from './gradesBoard.js';
import { renderClassCockpit } from './classCockpit.js';

function formatLessonLabel(dateKey) {
    if (!dateKey) return 'No upcoming lesson';
    const parsed = parseDDMMYYYY(dateKey);
    if (!parsed || Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderLeagueChip(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) {
        return leagueName
            ? `<span class="placement-league-chip placement-league-chip--unknown">${escapeHtml(leagueName)}</span>`
            : '';
    }
    return `<span class="placement-league-chip league-picker-option--${escapeHtml(definition.pickerTheme)}">${escapeHtml(definition.name)}</span>`;
}

function renderSearchBar(id, value, placeholder) {
    return `
        <label class="placement-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="${escapeHtml(id)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
        </label>
    `;
}

function renderClassesList() {
    const classes = filteredClasses().slice().sort((a, b) => a.name.localeCompare(b.name));
    const students = state.get('allStudents') || [];
    const filter = state.get('secretaryView')?.classFilter || '';
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];

    return `
        ${renderSearchBar('secretary-class-filter', filter, 'Search classes by name, league, or teacher…')}
        ${classes.length
            ? `<div class="class-overview-grid">
                ${classes.map((item) => {
                    const classStudents = students.filter((s) => s.classId === item.id && s.enrollmentStatus !== 'inactive');
                    const nextLesson = getNextLessonDate(item.id, allSchoolClasses, overrides, holidays, {});
                    return `
                        <button type="button" class="class-overview-card" data-secretary-open-class="${escapeHtml(item.id)}" aria-label="Open classroom overview for ${escapeHtml(item.name)}">
                            <span class="class-overview-card__logo" aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                            <span class="class-overview-card__copy">
                                <strong>${escapeHtml(item.name)}</strong>
                                <span class="class-overview-card__meta">
                                    ${renderLeagueChip(item.questLevel)}
                                    <span>${escapeHtml(item.createdBy?.name || 'Teacher')}</span>
                                </span>
                                <span class="class-overview-card__meta">${classStudents.length} ${classStudents.length === 1 ? 'hero' : 'heroes'} · ${escapeHtml(formatLessonLabel(nextLesson))}</span>
                                <span class="class-overview-card__meta">${escapeHtml(formatClassSchedule(item))}</span>
                            </span>
                            <span class="class-overview-card__go" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                        </button>`;
                }).join('')}
              </div>`
            : '<div class="role-empty-state">No classes match your search.</div>'
        }
    `;
}

function studentGroupKey(student) {
    if (student.enrollmentStatus === 'pendingPlacement' || !student.classId) return '__waiting';
    return student.classId;
}

function renderStudentCard(student, classData, scoreMap, latestScores, threads) {
    const score = scoreMap.get(student.id) || {};
    const latestScore = latestScores.get(student.id);
    const thread = threads.find((item) => item.studentId === student.id);
    const house = getGuildHouseDisplay(student.guildId);
    const gold = Math.round(getLiveYearGoldFromAppState(score, state) || 0);
    const gradeLabel = latestScore
        ? (getAssessmentValueLabel(latestScore, classData) || latestScore.scoreQualitative || 'Recorded')
        : 'No grade yet';
    return `
        <article class="school-hero-card">
            ${renderStudentAvatar(student)}
            <div class="school-hero-card__body">
                <div class="school-hero-card__title">
                    <strong>${escapeHtml(student.name)}</strong>
                    ${student.heroClass ? `<span class="school-hero-card__hero-class">${escapeHtml(student.heroClass)}</span>` : ''}
                </div>
                <div class="school-hero-card__meta">
                    ${classData ? renderLeagueChip(classData.questLevel) : '<span class="placement-league-chip placement-league-chip--unknown">Waiting</span>'}
                    ${house.assigned ? `<span class="school-hero-card__guild">${escapeHtml(house.label)}</span>` : ''}
                </div>
                <div class="school-hero-card__stats">
                    <span><i class="fas fa-star" aria-hidden="true"></i>${Number(score.monthlyStars || 0)} this month</span>
                    <span><i class="fas fa-coins" aria-hidden="true"></i>${gold} Gold</span>
                    <span><i class="fas fa-scroll" aria-hidden="true"></i>${escapeHtml(gradeLabel)}</span>
                </div>
                <div class="school-hero-card__actions">
                    <button type="button" class="secretary-chip-btn" data-secretary-edit-student="${escapeHtml(student.id)}">
                        <i class="fas fa-pen" aria-hidden="true"></i> Edit
                    </button>
                    <button type="button" class="secretary-chip-btn secretary-chip-btn--emerald" data-secretary-chronicle="${escapeHtml(student.id)}">
                        <i class="fas fa-book" aria-hidden="true"></i> Notes
                    </button>
                    ${thread
                        ? `<button type="button" class="secretary-chip-btn secretary-chip-btn--violet" data-secretary-thread="${escapeHtml(thread.id)}" data-secretary-open-messages="1">
                            <i class="fas fa-envelope" aria-hidden="true"></i> Message
                           </button>`
                        : '<span class="school-hero-card__quiet">No messages yet</span>'}
                </div>
            </div>
        </article>
    `;
}

function renderStudentsList() {
    const students = filteredStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const classMap = getClassMap();
    const scoreMap = getStudentScoreMap();
    const latestScores = getLatestScoresByStudent();
    const threads = state.get('currentCommunicationThreads') || [];
    const filter = state.get('secretaryView')?.studentFilter || '';
    const groups = new Map();

    for (const student of students) {
        const key = studentGroupKey(student);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(student);
    }

    const orderedKeys = [...groups.keys()].sort((a, b) => {
        if (a === '__waiting') return -1;
        if (b === '__waiting') return 1;
        const nameA = classMap.get(a)?.name || '';
        const nameB = classMap.get(b)?.name || '';
        return nameA.localeCompare(nameB);
    });

    return `
        ${renderSearchBar('secretary-student-filter', filter, 'Search heroes by name, class, league, or teacher…')}
        ${students.length
            ? `<div class="school-hero-groups">
                ${orderedKeys.map((key) => {
                    const groupStudents = groups.get(key);
                    const classData = key === '__waiting' ? null : classMap.get(key);
                    const title = classData?.name || 'Waiting for a class';
                    const meta = classData
                        ? `${escapeHtml(classData.createdBy?.name || 'Teacher')} · ${escapeHtml(formatClassSchedule(classData))}`
                        : 'These heroes still need a class this year.';
                    return `
                        <section class="school-hero-group">
                            <header class="school-hero-group__header">
                                <span class="school-hero-group__logo" aria-hidden="true">${escapeHtml(classData?.logo || '⏳')}</span>
                                <div>
                                    <h4>${escapeHtml(title)}</h4>
                                    <p>${meta}</p>
                                </div>
                                <div class="school-hero-group__aside">
                                    <span class="school-hero-group__count">${groupStudents.length}</span>
                                    ${classData ? `
                                        <button type="button" class="secretary-chip-btn secretary-chip-btn--soft" data-secretary-open-class="${escapeHtml(classData.id)}">
                                            View class
                                        </button>
                                    ` : ''}
                                </div>
                            </header>
                            <div class="school-hero-grid">
                                ${groupStudents.map((student) => renderStudentCard(student, classData, scoreMap, latestScores, threads)).join('')}
                            </div>
                        </section>
                    `;
                }).join('')}
              </div>`
            : '<div class="role-empty-state">No students match your search.</div>'
        }
    `;
}

export function renderSecretarySchool() {
    const view = state.get('secretaryView') || {};
    const subTab = view.schoolSubTab || 'classes';
    const classes = filteredClasses();
    const students = filteredStudents();
    const hasFullConsole = canUseFeature('secretaryAccess');
    const selectedClass = subTab === 'classes' && view.selectedClassId
        ? (state.get('allSchoolClasses') || []).find((item) => item.id === view.selectedClassId)
        : null;

    return `
        ${renderTabHero({
            icon: 'fa-school',
            iconColor: 'text-green-600',
            title: 'School',
            subtitle: selectedClass
                ? `A live look at ${selectedClass.name} — every classroom ritual, read-only.`
                : (hasFullConsole
                    ? 'Open a class to see how the Quest is going. Create and edit classes from Admin → School Year.'
                    : 'A clear, read-only view of every class and student in your school.')
        })}
        ${selectedClass ? '' : renderSubTabBar([
            { key: 'classes', label: 'Classes', icon: 'fa-chalkboard', tone: 'sky' },
            { key: 'students', label: 'Students', icon: 'fa-users', tone: 'emerald' }
        ], subTab, 'data-secretary-school-subtab')}
        <article class="role-card">
            ${selectedClass
                ? renderClassCockpit(selectedClass)
                : `
                    <div class="role-card__header">
                        <div>
                            <p class="role-card__eyebrow">${subTab === 'classes' ? 'Class overview' : 'School roster'}</p>
                            <h3 class="role-card__title">${subTab === 'classes' ? 'All classes' : 'All students'}</h3>
                        </div>
                        <div class="role-card__badge">${subTab === 'classes' ? classes.length : students.length} total</div>
                    </div>
                    <div data-secretary-school-panel="classes" class="${subTab === 'classes' ? '' : 'hidden'}">${renderClassesList()}</div>
                    <div data-secretary-school-panel="students" class="${subTab === 'students' ? '' : 'hidden'}">${renderStudentsList()}</div>
                `}
        </article>
    `;
}
