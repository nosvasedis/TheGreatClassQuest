import * as state from '../../state.js';
import { escapeHtml, renderTabHero, renderSubTabBar, initials } from '../roles/shared.js';
import {
    filteredClasses,
    filteredStudents,
    formatClassSchedule,
    getClassMap,
    getStudentScoreMap,
    getLatestScoresByStudent,
    avatarVariant
} from './helpers.js';
import { getAssessmentValueLabel } from '../assessmentConfig.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getNextLessonDate, parseDDMMYYYY } from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { renderClassCockpit } from './classCockpit.js';

function formatLessonLabel(dateKey) {
    if (!dateKey) return 'No upcoming lesson';
    const parsed = parseDDMMYYYY(dateKey);
    if (!parsed || Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderLeagueChip(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) return `<span class="placement-league-chip placement-league-chip--unknown">${escapeHtml(leagueName || 'League')}</span>`;
    return `<span class="placement-league-chip league-picker-option--${escapeHtml(definition.pickerTheme)}">${escapeHtml(definition.name)}</span>`;
}

function renderClassesList() {
    const classes = filteredClasses().slice().sort((a, b) => a.name.localeCompare(b.name));
    const students = state.get('allStudents') || [];
    const filter = state.get('secretaryView')?.classFilter || '';
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];

    return `
        <div class="role-filter-bar">
            <input type="search" id="secretary-class-filter" value="${escapeHtml(filter)}" placeholder="Search classes by name, league, or teacher..." autocomplete="off">
        </div>
        ${classes.length
            ? `<div class="class-overview-grid">
                ${classes.map((item) => {
                    const classStudents = students.filter((s) => s.classId === item.id && s.enrollmentStatus !== 'inactive');
                    const nextLesson = getNextLessonDate(item.id, allSchoolClasses, overrides, holidays, {});
                    return `
                        <button type="button" class="class-overview-card" data-secretary-open-class="${item.id}">
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
                        </button>`;
                }).join('')}
              </div>`
            : '<div class="role-empty-state">No classes match your search.</div>'
        }
    `;
}

function renderStudentsList() {
    const students = filteredStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const classMap = getClassMap();
    const scoreMap = getStudentScoreMap();
    const latestScores = getLatestScoresByStudent();
    const threads = state.get('currentCommunicationThreads') || [];
    const filter = state.get('secretaryView')?.studentFilter || '';

    return `
        <div class="role-filter-bar">
            <input type="search" id="secretary-student-filter" value="${escapeHtml(filter)}" placeholder="Search students by name or class..." autocomplete="off">
        </div>
        ${students.length
            ? students.map((student) => {
                const classData = classMap.get(student.classId);
                const score = scoreMap.get(student.id) || {};
                const latestScore = latestScores.get(student.id);
                const thread = threads.find((item) => item.studentId === student.id);
                const variant = avatarVariant(student.name);
                const avatarHtml = student.avatar
                    ? `<img src="${escapeHtml(student.avatar)}" alt="" loading="lazy" decoding="async">`
                    : escapeHtml(initials(student.name));
                return `
                    <div class="role-list-row" style="cursor:default">
                        <div class="role-list-row__avatar role-list-row__avatar--${variant}">${avatarHtml}</div>
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(student.name)}</div>
                            <div class="role-list-row__meta">${escapeHtml(classData?.name || 'No class')} • ${Number(score.totalStars || 0)} stars • Latest: ${escapeHtml(latestScore ? (getAssessmentValueLabel(latestScore, classData) || latestScore.scoreQualitative || 'Recorded') : 'No grade yet')}</div>
                        </div>
                        <div class="role-list-row__actions">
                            <button type="button" class="role-chip-btn" data-secretary-edit-student="${student.id}">Edit</button>
                            <button type="button" class="role-chip-btn role-chip-btn--emerald" data-secretary-chronicle="${student.id}">Notes</button>
                            <button type="button" class="role-chip-btn role-chip-btn--violet ${thread ? '' : 'opacity-50'}" ${thread ? `data-secretary-thread="${thread.id}" data-secretary-open-messages="1"` : 'disabled'}>${thread ? 'Message' : 'No thread'}</button>
                        </div>
                    </div>`;
            }).join('')
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
    const selectedClass = subTab === 'classes'
        ? (state.get('allSchoolClasses') || []).find((item) => item.id === view.selectedClassId && item.status !== 'archived')
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
                            <p class="role-card__eyebrow">${subTab === 'classes' ? 'Class overview' : 'Student list'}</p>
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
