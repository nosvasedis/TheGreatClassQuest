import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, renderTabHero } from '../roles/shared.js';
import { getStudentMap, getClassMap } from './helpers.js';
import {
    getAssessmentValueLabel,
    getNormalizedPercentForScore
} from '../assessmentConfig.js';

const PAGE_SIZE = 20;

export function renderSecretaryGrades() {
    const view = state.get('secretaryView') || {};
    const search = String(view.gradesSearch || '').trim().toLowerCase();
    const page = Math.max(0, Number(view.gradesPage) || 0);
    let scores = (state.get('allWrittenScores') || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    if (search) {
        const studentMap = getStudentMap();
        const classMap = getClassMap();
        scores = scores.filter((item) => {
            const student = studentMap.get(item.studentId);
            const classData = classMap.get(item.classId);
            const haystack = [
                item.title,
                item.type,
                student?.name,
                classData?.name
            ].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    const numericScores = scores.filter((item) => item.gradingMode !== 'qualitative');
    const normalizedValues = scores
        .map((item) => getNormalizedPercentForScore(item, getClassMap().get(item.classId)))
        .filter((value) => Number.isFinite(value));
    const averagePercent = normalizedValues.length
        ? `${Math.round(normalizedValues.reduce((sum, value) => sum + value, 0) / normalizedValues.length)}%`
        : 'N/A';

    const totalPages = Math.max(1, Math.ceil(scores.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageScores = scores.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    const studentMap = getStudentMap();
    const classMap = getClassMap();

    return `
        ${renderTabHero({
            icon: 'fa-chart-bar',
            iconColor: 'text-amber-500',
            title: 'Grades',
            subtitle: 'Search and browse recent grades recorded by teachers.'
        })}

        <div class="role-stat-grid mb-4">
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

        <article class="role-card">
            <div class="role-filter-bar">
                <input type="search" id="secretary-grades-search" value="${escapeHtml(view.gradesSearch || '')}" placeholder="Search by student, class, or assessment..." autocomplete="off">
            </div>
            ${pageScores.length
                ? pageScores.map((item) => {
                    const student = studentMap.get(item.studentId);
                    const classData = classMap.get(item.classId);
                    const label = getAssessmentValueLabel(item, classData) || item.scoreQualitative || 'Recorded';
                    const normalizedPercent = getNormalizedPercentForScore(item, classData);
                    return `
                        <div class="role-list-row" style="cursor:default">
                            <div class="role-list-row__body">
                                <div class="role-list-row__title">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                <div class="role-list-row__meta">${escapeHtml(student?.name || 'Student')} • ${escapeHtml(classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(item.date))}</div>
                            </div>
                            <div class="role-list-row__actions">
                                ${normalizedPercent !== null ? `<span class="role-score-pill">${normalizedPercent}%</span>` : ''}
                                <span class="role-score-pill role-score-pill--soft">${escapeHtml(label)}</span>
                            </div>
                        </div>`;
                }).join('')
                : '<div class="role-empty-state">No grades recorded yet.</div>'
            }
            ${scores.length > PAGE_SIZE ? `
                <div class="role-pagination">
                    <button type="button" class="role-btn-secondary" data-secretary-grades-page="${safePage - 1}" ${safePage <= 0 ? 'disabled' : ''}>Previous</button>
                    <span class="text-sm font-bold text-slate-600">Page ${safePage + 1} of ${totalPages}</span>
                    <button type="button" class="role-btn-secondary" data-secretary-grades-page="${safePage + 1}" ${safePage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
                </div>
            ` : ''}
            <div class="mt-3 text-center">
                <button type="button" class="role-inline-link" data-secretary-tab-link="admin" data-secretary-admin-subtab="grading">Edit grading setup</button>
            </div>
        </article>
    `;
}

export { PAGE_SIZE as GRADES_PAGE_SIZE };
