import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, initials, renderSubTabBar } from '../roles/shared.js';
import { getAssessmentValueLabel, getNormalizedPercentForScore } from '../assessmentConfig.js';
import { avatarVariant, getClassMap, getStudentMap } from './helpers.js';

export const GRADES_PAGE_SIZE = 20;

function timestampMs(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (value?.seconds) return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function renderStudentAvatar(student) {
    const variant = avatarVariant(student?.name);
    const avatarHtml = student?.avatar
        ? `<img src="${escapeHtml(student.avatar)}" alt="" loading="lazy" decoding="async">`
        : escapeHtml(initials(student?.name));
    return `<div class="role-list-row__avatar role-list-row__avatar--${variant}">${avatarHtml}</div>`;
}

function assignmentDate(item) {
    if (item.testData?.date) return item.testData.date;
    if (item.date) return item.date;
    return item.createdAt;
}

export function renderGradesBoard({ classId = '' } = {}) {
    const view = state.get('secretaryView') || {};
    const subTab = view.gradesBoardSubTab === 'homework' ? 'homework' : 'scroll';
    const bar = renderSubTabBar([
        { key: 'scroll', label: "Scholar's Scroll", icon: 'fa-scroll', tone: 'amber' },
        { key: 'homework', label: 'Quest Assignment', icon: 'fa-feather', tone: 'sky' }
    ], subTab, 'data-secretary-grades-board');

    return `
        ${bar}
        ${subTab === 'homework'
            ? renderHomeworkBoard({ classId, search: view.gradesSearch || '', page: view.gradesPage || 0 })
            : renderScrollBoard({ classId, search: view.gradesSearch || '', page: view.gradesPage || 0 })}
    `;
}

function matchesSearch(haystack, search) {
    if (!search) return true;
    return haystack.toLowerCase().includes(String(search).trim().toLowerCase());
}

function renderSearchBar(value, placeholder) {
    return `
        <div class="role-filter-bar">
            <input type="search" id="secretary-grades-search" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
        </div>
    `;
}

function renderPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    return `
        <div class="role-pagination">
            <button type="button" class="role-btn-secondary" data-secretary-grades-page="${safePage - 1}" ${safePage <= 0 ? 'disabled' : ''}>Previous</button>
            <span class="text-sm font-bold text-slate-600">Page ${safePage + 1} of ${totalPages}</span>
            <button type="button" class="role-btn-secondary" data-secretary-grades-page="${safePage + 1}" ${safePage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function renderScrollBoard({ classId, search, page }) {
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    let scores = (state.get('allWrittenScores') || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    if (classId) scores = scores.filter((item) => item.classId === classId);

    scores = scores.filter((item) => {
        const student = studentMap.get(item.studentId);
        const classData = classMap.get(item.classId);
        return matchesSearch([
            item.title,
            item.type,
            student?.name,
            classData?.name
        ].join(' '), search);
    });

    const numericScores = scores.filter((item) => item.gradingMode !== 'qualitative');
    const normalizedValues = scores
        .map((item) => getNormalizedPercentForScore(item, classMap.get(item.classId)))
        .filter((value) => Number.isFinite(value));
    const averagePercent = normalizedValues.length
        ? `${Math.round(normalizedValues.reduce((sum, value) => sum + value, 0) / normalizedValues.length)}%`
        : '—';

    const totalPages = Math.max(1, Math.ceil(scores.length / GRADES_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageScores = scores.slice(safePage * GRADES_PAGE_SIZE, (safePage + 1) * GRADES_PAGE_SIZE);

    const grouped = [];
    for (const item of pageScores) {
        const key = item.date || 'undated';
        const last = grouped[grouped.length - 1];
        if (last && last.date === key) last.items.push(item);
        else grouped.push({ date: key, items: [item] });
    }

    return `
        <div class="grades-board-stats">
            <div class="role-stat-tile role-stat-tile--sky">
                <div class="role-stat-tile__label">Recorded</div>
                <div class="role-stat-tile__value">${scores.length}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--emerald">
                <div class="role-stat-tile__label">Average</div>
                <div class="role-stat-tile__value" style="font-size:1.35rem">${escapeHtml(averagePercent)}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--amber">
                <div class="role-stat-tile__label">Numeric</div>
                <div class="role-stat-tile__value">${numericScores.length}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--violet">
                <div class="role-stat-tile__label">Written</div>
                <div class="role-stat-tile__value">${scores.length - numericScores.length}</div>
            </div>
        </div>
        ${renderSearchBar(search, 'Search by student, class, or assessment…')}
        ${pageScores.length ? grouped.map((group) => `
            <section class="grades-board-group">
                <h4 class="grades-board-group__date">${escapeHtml(formatFlexibleDate(group.date))}</h4>
                ${group.items.map((item) => {
                    const student = studentMap.get(item.studentId);
                    const classData = classMap.get(item.classId);
                    const label = getAssessmentValueLabel(item, classData) || item.scoreQualitative || 'Recorded';
                    const normalizedPercent = getNormalizedPercentForScore(item, classData);
                    return `
                        <article class="grades-board-row">
                            ${renderStudentAvatar(student || { name: 'Student' })}
                            <div class="grades-board-row__body">
                                <strong>${escapeHtml(student?.name || 'Student')}</strong>
                                <p>${escapeHtml(item.title || item.type || 'Assessment')} · ${escapeHtml(classData?.name || 'Class')}</p>
                            </div>
                            <div class="grades-board-row__score">
                                ${normalizedPercent !== null ? `<span class="role-score-pill">${normalizedPercent}%</span>` : ''}
                                <span class="role-score-pill role-score-pill--soft">${escapeHtml(label)}</span>
                            </div>
                        </article>
                    `;
                }).join('')}
            </section>
        `).join('') : '<div class="role-empty-state">No grades recorded yet.</div>'}
        ${renderPagination(safePage, totalPages)}
    `;
}

function renderHomeworkBoard({ classId, search, page }) {
    const classMap = getClassMap();
    let assignments = (state.get('allQuestAssignments') || [])
        .slice()
        .sort((a, b) => timestampMs(assignmentDate(b)) - timestampMs(assignmentDate(a)));

    if (classId) assignments = assignments.filter((item) => item.classId === classId);

    assignments = assignments.filter((item) => {
        const classData = classMap.get(item.classId);
        return matchesSearch([
            item.text,
            item.testData?.title,
            classData?.name
        ].join(' '), search);
    });

    const totalPages = Math.max(1, Math.ceil(assignments.length / GRADES_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageItems = assignments.slice(safePage * GRADES_PAGE_SIZE, (safePage + 1) * GRADES_PAGE_SIZE);

    return `
        <div class="grades-board-stats">
            <div class="role-stat-tile role-stat-tile--sky">
                <div class="role-stat-tile__label">Assignments</div>
                <div class="role-stat-tile__value">${assignments.length}</div>
            </div>
            <div class="role-stat-tile role-stat-tile--amber">
                <div class="role-stat-tile__label">With a test</div>
                <div class="role-stat-tile__value">${assignments.filter((item) => item.testData).length}</div>
            </div>
        </div>
        ${renderSearchBar(search, 'Search Quest Assignment by class or words…')}
        ${pageItems.length ? pageItems.map((item) => {
            const classData = classMap.get(item.classId);
            const dateLabel = formatFlexibleDate(assignmentDate(item));
            return `
                <article class="grades-homework-card">
                    <div class="grades-homework-card__badge" aria-hidden="true">${item.testData ? '📜' : '🪶'}</div>
                    <div>
                        <p class="grades-homework-card__meta">${escapeHtml(classData?.name || 'Class')} · ${escapeHtml(dateLabel)}</p>
                        <p class="grades-homework-card__text">${escapeHtml(item.text || item.testData?.title || 'Quest Assignment')}</p>
                        ${item.testData?.title && item.text ? `<p class="grades-homework-card__test">${escapeHtml(item.testData.title)}</p>` : ''}
                    </div>
                </article>
            `;
        }).join('') : '<div class="role-empty-state">No Quest Assignment yet.</div>'}
        ${renderPagination(safePage, totalPages)}
    `;
}
