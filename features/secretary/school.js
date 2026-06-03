import * as state from '../../state.js';
import { escapeHtml, renderTabHero, renderSubTabBar, initials } from '../roles/shared.js';
import {
    filteredClasses,
    filteredStudents,
    getClassMap,
    getStudentScoreMap,
    getLatestScoresByStudent,
    avatarVariant
} from './helpers.js';
import { getAssessmentValueLabel } from '../assessmentConfig.js';

function renderClassesList() {
    const classes = filteredClasses().slice().sort((a, b) => a.name.localeCompare(b.name));
    const students = state.get('allStudents') || [];
    const writtenScores = state.get('allWrittenScores') || [];
    const filter = state.get('secretaryView')?.classFilter || '';

    return `
        <div class="role-filter-bar">
            <input type="search" id="secretary-class-filter" value="${escapeHtml(filter)}" placeholder="Search classes by name, level, or teacher..." autocomplete="off">
        </div>
        ${classes.length
            ? classes.map((item) => {
                const classStudents = students.filter((s) => s.classId === item.id);
                const classScores = writtenScores.filter((s) => s.classId === item.id);
                const schedule = (item.scheduleDays || [])
                    .map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
                    .join(', ');
                return `
                    <div class="role-list-row" style="cursor:default">
                        <div class="role-list-row__avatar role-list-row__avatar--amber">${escapeHtml(item.logo || '📚')}</div>
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(item.name)}</div>
                            <div class="role-list-row__meta">${escapeHtml(item.questLevel || 'Level')} • ${escapeHtml(item.createdBy?.name || 'Teacher')} • ${classStudents.length} students • ${classScores.length} grades</div>
                            <div class="role-list-row__meta">${escapeHtml(schedule || 'Schedule not set')}${item.timeStart ? ` • ${escapeHtml(item.timeStart)}` : ''}</div>
                        </div>
                        <div class="role-list-row__actions">
                            <button type="button" class="role-chip-btn" data-secretary-edit-class="${item.id}">Edit class</button>
                        </div>
                    </div>`;
            }).join('')
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
                return `
                    <div class="role-list-row" style="cursor:default">
                        <div class="role-list-row__avatar role-list-row__avatar--${variant}">${escapeHtml(initials(student.name))}</div>
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
    const subTab = state.get('secretaryView')?.schoolSubTab || 'classes';
    const classes = filteredClasses();
    const students = filteredStudents();

    return `
        ${renderTabHero({
            icon: 'fa-school',
            iconColor: 'text-green-600',
            title: 'School',
            subtitle: 'Browse classes and students. Tap a button to edit details or send a message.'
        })}
        ${renderSubTabBar([
            { key: 'classes', label: 'Classes', icon: 'fa-chalkboard' },
            { key: 'students', label: 'Students', icon: 'fa-users' }
        ], subTab, 'data-secretary-school-subtab')}
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">${subTab === 'classes' ? 'Class list' : 'Student list'}</p>
                    <h3 class="role-card__title">${subTab === 'classes' ? 'All classes' : 'All students'}</h3>
                </div>
                <div class="role-card__badge">${subTab === 'classes' ? classes.length : students.length} total</div>
            </div>
            <div data-secretary-school-panel="classes" class="${subTab === 'classes' ? '' : 'hidden'}">${renderClassesList()}</div>
            <div data-secretary-school-panel="students" class="${subTab === 'students' ? '' : 'hidden'}">${renderStudentsList()}</div>
        </article>
    `;
}
