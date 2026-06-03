import * as state from '../../state.js';
import { escapeHtml, renderTabHero, renderSubTabBar } from '../roles/shared.js';
import { renderSchoolYearSection } from '../schoolYearConsole.js';
import {
    getAssessmentDefaultsEditorHtml,
    getAssessmentConfigCardHtml
} from '../../ui/assessmentEditor.js';
import {
    describeAssessmentScheme,
    getSchoolAssessmentDefaults,
    normalizeClassAssessmentConfig
} from '../assessmentConfig.js';

function renderSchoolSettings() {
    const profile = state.get('currentUserProfile');
    const schoolName = state.get('schoolName') || 'Your School';

    return `
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">School settings</p>
                    <h3 class="role-card__title">School name and tools</h3>
                </div>
            </div>
            <form id="secretary-school-name-form">
                <label class="role-field">
                    <span>School name</span>
                    <input type="text" id="secretary-school-name-input" value="${escapeHtml(schoolName)}" placeholder="School name">
                </label>
                <div class="flex flex-wrap gap-2">
                    <button type="submit" id="secretary-school-name-save-btn" class="role-btn-primary">
                        <i class="fas fa-save"></i> Save name
                    </button>
                    <button type="button" id="secretary-open-teacher-from-settings-btn" class="role-btn-secondary">
                        <i class="fas fa-chalkboard-teacher"></i> Open Teacher App
                    </button>
                </div>
            </form>
            <div class="mt-4 space-y-2">
                <div class="secretary-inline-note"><strong>Signed in as:</strong> ${escapeHtml(profile?.displayName || 'Secretary')}</div>
                <div class="secretary-inline-note"><strong>Access:</strong> All classes, students, grades, and family messages.</div>
            </div>
        </article>

        <article class="role-card">
            <p class="role-card__eyebrow">Tools</p>
            <h3 class="role-card__title mb-3">Useful admin actions</h3>
            <div class="role-ops-grid">
                <button type="button" id="secretary-run-backfill-btn" class="role-op-tile">
                    <i class="fas fa-rotate text-indigo-500"></i>
                    <span>Refresh parent summaries</span>
                    <small>Rebuild safe summaries for every student.</small>
                </button>
                <button type="button" class="role-op-tile" data-secretary-tab-link="grades">
                    <i class="fas fa-chart-bar text-amber-500"></i>
                    <span>View all grades</span>
                    <small>Jump to the schoolwide grade list.</small>
                </button>
                <button type="button" class="role-op-tile" data-secretary-tab-link="messages">
                    <i class="fas fa-envelope text-violet-500"></i>
                    <span>Answer families</span>
                    <small>Open the message inbox.</small>
                </button>
                <button type="button" class="role-op-tile" data-secretary-tab-link="school" data-secretary-school-subtab="students">
                    <i class="fas fa-users text-emerald-500"></i>
                    <span>Student list</span>
                    <small>Find a student and edit their details.</small>
                </button>
            </div>
        </article>
    `;
}

function renderGradingSetup() {
    const classes = (state.get('allSchoolClasses') || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const schoolDefaults = getSchoolAssessmentDefaults();
    const selectedClassId = state.get('secretaryView')?.selectedGradingClassId || '';
    const selectedClass = classes.find((c) => c.id === selectedClassId);

    return `
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Grading setup</p>
                    <h3 class="role-card__title">School grading rules</h3>
                </div>
                <button type="button" id="secretary-save-assessment-btn" class="role-btn-primary">
                    <i class="fas fa-save"></i> Save
                </button>
            </div>
            <div class="secretary-assessment-preview">
                ${Object.entries(schoolDefaults).map(([league, config]) => `
                    <div class="secretary-assessment-preview__item">
                        <strong>${escapeHtml(league)}</strong>
                        <span>Tests: ${escapeHtml(describeAssessmentScheme(config.tests))}</span>
                        <span>Dictations: ${escapeHtml(describeAssessmentScheme(config.dictations))}</span>
                    </div>
                `).join('')}
            </div>
            <div id="secretary-assessment-defaults-editor" class="mt-4">
                ${getAssessmentDefaultsEditorHtml(schoolDefaults)}
            </div>
        </article>

        <article class="role-card">
            <p class="role-card__eyebrow">Per-class overrides</p>
            <h3 class="role-card__title mb-3">Choose a class to edit</h3>
            <div class="grid gap-2 sm:grid-cols-2">
                ${classes.map((classData) => `
                    <button type="button" class="role-list-row ${selectedClassId === classData.id ? 'border-indigo-300 bg-indigo-50' : ''}" data-secretary-grading-class="${classData.id}">
                        <div class="role-list-row__avatar role-list-row__avatar--amber">${escapeHtml(classData.logo || '📚')}</div>
                        <div class="role-list-row__body">
                            <div class="role-list-row__title">${escapeHtml(classData.name)}</div>
                            <div class="role-list-row__meta">${escapeHtml(classData.questLevel || 'Level')}</div>
                        </div>
                    </button>
                `).join('') || '<div class="role-empty-state">No classes yet.</div>'}
            </div>
        </article>

        ${selectedClass ? `
            <article class="role-card" id="secretary-class-assessment-editor">
                ${getAssessmentConfigCardHtml(
                    selectedClass.assessmentConfig || normalizeClassAssessmentConfig(null, selectedClass.questLevel),
                    `secretary-class-${selectedClass.id}`,
                    {
                        allowInherit: true,
                        questLevel: selectedClass.questLevel,
                        title: `${selectedClass.logo || '📚'} ${selectedClass.name}`,
                        description: `${selectedClass.questLevel || 'Level'} class`
                    }
                )}
            </article>
        ` : `
            <div class="role-empty-state">Select a class above to edit its grading rules.</div>
        `}
    `;
}

export function renderSecretaryAdmin() {
    const subTab = state.get('secretaryView')?.adminSubTab || 'year';

    return `
        ${renderTabHero({
            icon: 'fa-cog',
            iconColor: 'text-gray-600',
            title: 'Admin',
            subtitle: 'School year, settings, and grading setup.'
        })}
        ${renderSubTabBar([
            { key: 'year', label: 'School Year', icon: 'fa-calendar-alt' },
            { key: 'settings', label: 'School Settings', icon: 'fa-school' },
            { key: 'grading', label: 'Grading Setup', icon: 'fa-clipboard-check' }
        ], subTab, 'data-secretary-admin-subtab')}
        <div data-secretary-admin-panel="year" class="${subTab === 'year' ? '' : 'hidden'}">${renderSchoolYearSection()}</div>
        <div data-secretary-admin-panel="settings" class="${subTab === 'settings' ? '' : 'hidden'}">${renderSchoolSettings()}</div>
        <div data-secretary-admin-panel="grading" class="${subTab === 'grading' ? '' : 'hidden'}">${renderGradingSetup()}</div>
    `;
}
