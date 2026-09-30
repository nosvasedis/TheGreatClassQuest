import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, initials } from '../roles/shared.js';
import { getAssessmentValueLabel, getNormalizedPercentForScore } from '../assessmentConfig.js';
import { avatarVariant, getClassMap, getStudentMap, renderOfficeAvatar } from './helpers.js';

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

function scoreBand(percent) {
    if (percent === null || percent === undefined || !Number.isFinite(percent)) return 'words';
    if (percent >= 85) return 'great';
    if (percent >= 70) return 'good';
    if (percent >= 50) return 'fair';
    return 'low';
}

function renderBoardStat(label, value, tone, icon) {
    return `
        <div class="pulse-stat pulse-stat--${tone}">
            <span class="pulse-stat__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <span class="pulse-stat__copy"><small>${escapeHtml(label)}</small><strong class="font-title">${escapeHtml(String(value))}</strong></span>
        </div>
    `;
}

function renderEmptyBoard(icon, text) {
    return `
        <div class="pulse-empty">
            <span aria-hidden="true"><i class="fas ${icon}"></i></span>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

export function renderGradesBoard({ classId = '' } = {}) {
    const view = state.get('secretaryView') || {};
    const subTab = view.gradesBoardSubTab === 'homework' ? 'homework' : 'scroll';
    const scrollCount = (state.get('allWrittenScores') || []).filter((item) => !classId || item.classId === classId).length;
    const homeworkCount = (state.get('allQuestAssignments') || []).filter((item) => !classId || item.classId === classId).length;
    const modes = [
        { key: 'scroll', label: "Scholar's Scroll", note: 'Tests and dictations', icon: 'fa-scroll', tone: 'amber', count: scrollCount },
        { key: 'homework', label: 'Quest Assignment', note: 'Homework set by teachers', icon: 'fa-feather', tone: 'sky', count: homeworkCount }
    ];

    return `
        <div class="grades-modes" role="tablist" aria-label="Grades views">
            ${modes.map((mode) => `
                <button type="button" class="grades-mode grades-mode--${mode.tone}${subTab === mode.key ? ' is-active' : ''}"
                    data-secretary-grades-board="${mode.key}" role="tab" aria-selected="${subTab === mode.key ? 'true' : 'false'}">
                    <span class="grades-mode__icon" aria-hidden="true"><i class="fas ${mode.icon}"></i></span>
                    <span class="grades-mode__copy"><strong>${escapeHtml(mode.label)}</strong><small>${escapeHtml(mode.note)}</small></span>
                    <span class="grades-mode__count">${mode.count}</span>
                </button>
            `).join('')}
        </div>
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
        <label class="office-search grades-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="secretary-grades-search" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" aria-label="${escapeHtml(placeholder)}">
        </label>
    `;
}

function renderPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    return `
        <nav class="grades-pages" aria-label="Pages">
            <button type="button" class="office-btn office-btn--quiet" data-secretary-grades-page="${safePage - 1}" ${safePage <= 0 ? 'disabled' : ''}><i class="fas fa-arrow-left" aria-hidden="true"></i> Newer</button>
            <span>Page ${safePage + 1} of ${totalPages}</span>
            <button type="button" class="office-btn office-btn--quiet" data-secretary-grades-page="${safePage + 1}" ${safePage >= totalPages - 1 ? 'disabled' : ''}>Older <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
        </nav>
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
        <div class="pulse-stats" data-secretary-live="grades-stats">
            ${renderBoardStat('Recorded', scores.length, 'sky', 'fa-file-circle-check')}
            ${renderBoardStat('Average', averagePercent, 'emerald', 'fa-chart-line')}
            ${renderBoardStat('With marks', numericScores.length, 'amber', 'fa-hashtag')}
            ${renderBoardStat('With words', scores.length - numericScores.length, 'violet', 'fa-comment-dots')}
        </div>
        ${renderSearchBar(search, 'Search by student, class, or assessment…')}
        <div data-secretary-live="grades-results">
        ${pageScores.length ? grouped.map((group) => `
            <section class="grades-day">
                <h4 class="grades-day__date"><i class="fas fa-calendar-day" aria-hidden="true"></i>${escapeHtml(formatFlexibleDate(group.date))}<span>${group.items.length}</span></h4>
                <div class="grades-slips">
                    ${group.items.map((item) => {
                        const student = studentMap.get(item.studentId);
                        const classData = classMap.get(item.classId);
                        const label = getAssessmentValueLabel(item, classData) || item.scoreQualitative || 'Recorded';
                        const normalizedPercent = getNormalizedPercentForScore(item, classData);
                        const isTest = String(item.type || '').toLowerCase() === 'test';
                        return `
                            <article class="grades-slip grades-slip--${scoreBand(normalizedPercent)}">
                                ${renderOfficeAvatar(student || { name: 'Student' })}
                                <div class="grades-slip__copy">
                                    <strong>${escapeHtml(student?.name || 'Student')}</strong>
                                    <span class="grades-slip__meta">
                                        <span class="grades-slip__kind"><i class="fas ${isTest ? 'fa-file-pen' : 'fa-spell-check'}" aria-hidden="true"></i>${escapeHtml(item.title || item.type || 'Assessment')}</span>
                                        <span class="grades-slip__class">${escapeHtml(classData?.logo || '📚')} ${escapeHtml(classData?.name || 'Class')}</span>
                                    </span>
                                </div>
                                <div class="grades-slip__mark">
                                    <strong class="font-title">${normalizedPercent !== null && Number.isFinite(normalizedPercent) ? `${normalizedPercent}%` : escapeHtml(label)}</strong>
                                    ${normalizedPercent !== null && Number.isFinite(normalizedPercent) ? `<small>${escapeHtml(label)}</small>` : ''}
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
        `).join('') : renderEmptyBoard('fa-scroll', search ? 'No grades match that search.' : 'No grades recorded yet.')}
        ${renderPagination(safePage, totalPages)}
        </div>
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
        <div class="pulse-stats" data-secretary-live="grades-stats">
            ${renderBoardStat('Assignments', assignments.length, 'sky', 'fa-feather')}
            ${renderBoardStat('With a test', assignments.filter((item) => item.testData).length, 'amber', 'fa-file-pen')}
        </div>
        ${renderSearchBar(search, 'Search Quest Assignment by class or words…')}
        <div data-secretary-live="grades-results">
        ${pageItems.length ? `<div class="grades-quests">${pageItems.map((item) => {
            const classData = classMap.get(item.classId);
            const dateLabel = formatFlexibleDate(assignmentDate(item));
            return `
                <article class="grades-quest">
                    <header class="grades-quest__head">
                        <span class="grades-quest__logo" aria-hidden="true">${escapeHtml(classData?.logo || '📚')}</span>
                        <span><strong>${escapeHtml(classData?.name || 'Class')}</strong><small>${escapeHtml(dateLabel)}</small></span>
                    </header>
                    <p class="grades-quest__text">${escapeHtml(item.text || item.testData?.title || 'Quest Assignment')}</p>
                    ${item.testData?.title ? `<span class="grades-quest__test"><i class="fas fa-file-pen" aria-hidden="true"></i>${escapeHtml(item.testData.title)}${item.testData.date ? ` · ${escapeHtml(formatFlexibleDate(item.testData.date))}` : ''}</span>` : ''}
                </article>
            `;
        }).join('')}</div>` : renderEmptyBoard('fa-feather', search ? 'No Quest Assignment matches that search.' : 'No Quest Assignment yet.')}
        ${renderPagination(safePage, totalPages)}
        </div>
    `;
}
