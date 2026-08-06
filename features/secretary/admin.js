import * as state from '../../state.js';
import { escapeHtml } from '../roles/shared.js';
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
import { canUseFeature, getTier } from '../../utils/subscription.js';

const ADMIN_AREAS = [
    {
        key: 'year',
        label: 'School Year',
        description: 'Close, check, and prepare',
        icon: 'fa-calendar-alt',
        accent: 'sky'
    },
    {
        key: 'settings',
        label: 'School Settings',
        description: 'Identity and admin tools',
        icon: 'fa-school',
        accent: 'emerald'
    },
    {
        key: 'grading',
        label: 'Grading Setup',
        description: 'Rules for tests and dictations',
        icon: 'fa-clipboard-check',
        accent: 'violet'
    }
];

function getAdminAreas() {
    return canUseFeature('secretaryAccess')
        ? ADMIN_AREAS
        : ADMIN_AREAS.filter((area) => area.key !== 'grading');
}

function renderAdminHero() {
    return `
        <header class="secretary-admin-hero">
            <div class="secretary-admin-hero__main">
                <div class="secretary-admin-hero__icon" aria-hidden="true">
                    <i class="fas fa-sliders"></i>
                </div>
                <div>
                    <p class="secretary-admin-hero__eyebrow">Secretary workspace</p>
                    <h2 class="secretary-admin-hero__title">Admin control center</h2>
                    <p class="secretary-admin-hero__description">Set up the school year, keep the school identity tidy, and make grading rules easy for every class to follow.</p>
                </div>
            </div>
            <div class="secretary-admin-hero__status">
                <span>Setup workspace</span>
                <strong>3 areas</strong>
                <small>Choose a section below to get started.</small>
            </div>
        </header>
    `;
}

function renderAdminNav(activeKey) {
    const areas = getAdminAreas();
    return `
        <nav class="secretary-admin-nav" aria-label="Admin sections" role="tablist">
            ${areas.map((area, index) => `
                <button type="button"
                    class="secretary-admin-nav__item secretary-admin-nav__item--${area.accent}${activeKey === area.key ? ' is-active' : ''}"
                    data-secretary-admin-subtab="${area.key}"
                    role="tab"
                    aria-selected="${activeKey === area.key ? 'true' : 'false'}"
                    aria-controls="secretary-admin-panel-${area.key}">
                    <span class="secretary-admin-nav__number">${index + 1}</span>
                    <span class="secretary-admin-nav__icon" aria-hidden="true"><i class="fas ${area.icon}"></i></span>
                    <span class="secretary-admin-nav__copy">
                        <strong>${area.label}</strong>
                        <small>${area.description}</small>
                    </span>
                    <i class="fas fa-arrow-right secretary-admin-nav__arrow" aria-hidden="true"></i>
                </button>
            `).join('')}
        </nav>
    `;
}

function renderAdminSectionIntro(eyebrow, title, description, icon, accent) {
    return `
        <div class="secretary-admin-section-intro">
            <div class="secretary-admin-section-intro__icon secretary-admin-section-intro__icon--${accent}" aria-hidden="true">
                <i class="fas ${icon}"></i>
            </div>
            <div>
                <p class="secretary-admin-section-intro__eyebrow">${eyebrow}</p>
                <h2 class="secretary-admin-section-intro__title">${title}</h2>
                <p class="secretary-admin-section-intro__description">${description}</p>
            </div>
        </div>
    `;
}

function renderSchoolSettings() {
    const profile = state.get('currentUserProfile');
    const schoolName = state.get('schoolName') || 'Your School';
    const tier = String(getTier() || 'starter');
    const hasFullConsole = canUseFeature('secretaryAccess');

    return `
        <div class="secretary-admin-panel-content secretary-admin-panel-content--settings">
            ${renderAdminSectionIntro(
                'School settings',
                'Make the office feel like your school.',
                'Update the school identity and keep the most useful secretary actions within easy reach.',
                'fa-school',
                'emerald'
            )}

            <div class="secretary-settings-grid">
                <article class="role-card secretary-admin-card secretary-settings-card secretary-settings-card--identity">
                    <div class="secretary-admin-card__header">
                        <div class="secretary-admin-card__title-group">
                            <span class="secretary-admin-card__icon secretary-admin-card__icon--emerald" aria-hidden="true"><i class="fas fa-pen-to-square"></i></span>
                            <div>
                                <p class="role-card__eyebrow">School identity</p>
                                <h3 class="role-card__title">School name</h3>
                            </div>
                        </div>
                        <span class="secretary-admin-card__badge secretary-admin-card__badge--emerald">Visible across the app</span>
                    </div>
                    <p class="secretary-admin-card__description">This name appears in the secretary header and in school-facing areas. Keep it short enough to read comfortably on a laptop.</p>
                    <form id="secretary-school-name-form" class="secretary-settings-form">
                        <label class="role-field secretary-settings-form__field">
                            <span>School name</span>
                            <input type="text" id="secretary-school-name-input" value="${escapeHtml(schoolName)}" placeholder="School name" autocomplete="organization">
                        </label>
                        <div class="secretary-button-row">
                            <button type="submit" id="secretary-school-name-save-btn" class="role-btn-primary">
                                <i class="fas fa-save" aria-hidden="true"></i> Save school name
                            </button>
                            <button type="button" id="secretary-open-teacher-from-settings-btn" class="role-btn-secondary">
                                <i class="fas fa-chalkboard-teacher" aria-hidden="true"></i> Open Teacher App
                            </button>
                        </div>
                    </form>
                </article>

                <article class="role-card secretary-admin-card secretary-settings-card secretary-settings-card--identity">
                    <div class="secretary-admin-card__header">
                        <div class="secretary-admin-card__title-group">
                            <span class="secretary-admin-card__icon secretary-admin-card__icon--sky" aria-hidden="true"><i class="fas fa-cloud-sun"></i></span>
                            <div><p class="role-card__eyebrow">School identity</p><h3 class="role-card__title">Weather location</h3></div>
                        </div>
                    </div>
                    <p class="secretary-admin-card__description">Choose the Greek city used by the school-wide weather display.</p>
                    <div class="secretary-settings-form">
                        <label class="role-field secretary-settings-form__field"><span>City or area</span>
                            <input type="text" id="options-school-location-search" autocomplete="off" placeholder="e.g. Thessaloniki, Heraklion">
                        </label>
                        <button type="button" id="search-school-location-btn" class="role-btn-secondary"><i class="fas fa-search"></i> Search</button>
                        <select id="options-school-location-results" class="hidden role-field"></select>
                        <p id="options-school-location-status" class="text-xs text-gray-500">No weather location selected. Default Athens area is used.</p>
                        <button type="button" id="save-school-location-btn" class="role-btn-primary"><i class="fas fa-map-marker-alt"></i> Save weather location</button>
                    </div>
                </article>

                <article class="role-card secretary-admin-card secretary-settings-card secretary-settings-card--access">
                    <div class="secretary-admin-card__header">
                        <div class="secretary-admin-card__title-group">
                            <span class="secretary-admin-card__icon secretary-admin-card__icon--sky" aria-hidden="true"><i class="fas fa-user-shield"></i></span>
                            <div>
                                <p class="role-card__eyebrow">Your access</p>
                                <h3 class="role-card__title">Secretary permissions</h3>
                            </div>
                        </div>
                        <span class="secretary-admin-card__badge secretary-admin-card__badge--sky">Active</span>
                    </div>
                    <div class="secretary-settings-facts">
                        <div class="secretary-settings-fact">
                            <span class="secretary-settings-fact__label">Signed in as</span>
                            <strong>${escapeHtml(profile?.displayName || 'Secretary')}</strong>
                        </div>
                        <div class="secretary-settings-fact">
                            <span class="secretary-settings-fact__label">Access scope</span>
                            <strong>Whole school</strong>
                        </div>
                    </div>
                    <details class="secretary-disclosure">
                        <summary><span><i class="fas fa-circle-info" aria-hidden="true"></i> What can I manage?</span><i class="fas fa-chevron-down secretary-disclosure__chevron" aria-hidden="true"></i></summary>
                        <p>All classes, students, grades, and family messages are available here. The Teacher App opens the full teaching workspace when you need a broader view.</p>
                    </details>
                </article>
            </div>

            <article class="role-card secretary-admin-card secretary-settings-card">
                <div class="secretary-admin-card__header">
                    <div class="secretary-admin-card__title-group">
                        <span class="secretary-admin-card__icon secretary-admin-card__icon--amber" aria-hidden="true"><i class="fas fa-umbrella-beach"></i></span>
                        <div><p class="role-card__eyebrow">School calendar</p><h3 class="role-card__title">Holidays and breaks</h3></div>
                    </div>
                </div>
                <p class="secretary-admin-card__description">These periods apply to every teacher, class calendar, and lesson count.</p>
                <div class="grid grid-cols-2 gap-3">
                    <label class="role-field col-span-2"><span>Break name</span><input type="text" id="holiday-name" placeholder="e.g. Christmas Break"></label>
                    <label class="role-field"><span>Start date</span><input type="date" id="holiday-start"></label>
                    <label class="role-field"><span>End date</span><input type="date" id="holiday-end"></label>
                    <label class="role-field col-span-2"><span>Theme</span><select id="holiday-type"><option value="christmas">Christmas / Winter</option><option value="easter">Easter / Spring</option><option value="generic">Generic / Other</option></select></label>
                    <button type="button" id="add-holiday-btn" class="role-btn-primary col-span-2"><i class="fas fa-plus-circle"></i> Add school break</button>
                </div>
                <div id="holiday-list" class="space-y-2 mt-4"></div>
            </article>

            <div class="secretary-settings-grid">
                <article class="role-card secretary-admin-card secretary-settings-card">
                    <div class="secretary-admin-card__header"><div class="secretary-admin-card__title-group"><span class="secretary-admin-card__icon secretary-admin-card__icon--violet"><i class="fas fa-key"></i></span><div><p class="role-card__eyebrow">Account security</p><h3 class="role-card__title">Secretary credentials</h3></div></div></div>
                    <p class="secretary-admin-card__description">Confirm the current password, then change the username, password, or both. This account cannot delete or disable itself.</p>
                    <form id="secretary-credentials-form" class="secretary-settings-form">
                        <label class="role-field"><span>Current password</span><input type="password" id="secretary-current-password" required autocomplete="current-password"></label>
                        <label class="role-field"><span>New username (optional)</span><input type="text" id="secretary-new-username" autocomplete="username"></label>
                        <label class="role-field"><span>New password (optional)</span><input type="password" id="secretary-new-password" minlength="6" autocomplete="new-password"></label>
                        <button type="submit" id="secretary-credentials-save-btn" class="role-btn-primary"><i class="fas fa-shield-halved"></i> Update credentials</button>
                    </form>
                </article>

                <article class="role-card secretary-admin-card secretary-settings-card">
                    <div class="secretary-admin-card__header"><div class="secretary-admin-card__title-group"><span class="secretary-admin-card__icon secretary-admin-card__icon--emerald"><i class="fas fa-credit-card"></i></span><div><p class="role-card__eyebrow">Subscription</p><h3 class="role-card__title">Plan and billing</h3></div></div><span class="secretary-admin-card__badge secretary-admin-card__badge--emerald">${escapeHtml(tier.toUpperCase())}</span></div>
                    <p class="secretary-admin-card__description">Only the Secretary/admin can open the school billing portal or change the subscription.</p>
                    <button type="button" id="secretary-manage-subscription-btn" class="role-btn-primary"><i class="fas fa-arrow-up-right-from-square"></i> Manage plan in Stripe</button>
                </article>
            </div>

            ${hasFullConsole ? '' : `<div class="role-card secretary-admin-card"><p class="role-card__eyebrow">Elite Secretary Console</p><h3 class="role-card__title">School-wide editing is read-only on ${escapeHtml(tier)}.</h3><p class="secretary-admin-card__description">School identity, billing, school years, holidays, and credentials remain available. Upgrade to Elite for grading administration, bulk edits, backfills, and family messaging.</p></div>`}

            <article class="role-card secretary-admin-card secretary-settings-card secretary-settings-card--tools">
                <div class="secretary-admin-card__header">
                    <div class="secretary-admin-card__title-group">
                        <span class="secretary-admin-card__icon secretary-admin-card__icon--violet" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                        <div>
                            <p class="role-card__eyebrow">Office shortcuts</p>
                            <h3 class="role-card__title">Useful admin actions</h3>
                        </div>
                    </div>
                    <span class="secretary-admin-card__helper">Jump straight to common tasks</span>
                </div>
                <div class="role-ops-grid secretary-admin-action-grid">
                    ${hasFullConsole ? `<button type="button" id="secretary-run-backfill-btn" class="role-op-tile secretary-admin-action-tile">
                        <span class="secretary-admin-action-tile__icon secretary-admin-action-tile__icon--indigo"><i class="fas fa-rotate" aria-hidden="true"></i></span>
                        <span>Refresh parent summaries</span>
                        <small>Rebuild safe summaries for every student.</small>
                        <i class="fas fa-arrow-up-right-from-square secretary-admin-action-tile__arrow" aria-hidden="true"></i>
                    </button>` : ''}
                    ${hasFullConsole ? `<button type="button" class="role-op-tile secretary-admin-action-tile" data-secretary-tab-link="grades">
                        <span class="secretary-admin-action-tile__icon secretary-admin-action-tile__icon--amber"><i class="fas fa-chart-bar" aria-hidden="true"></i></span>
                        <span>View all grades</span>
                        <small>Jump to the schoolwide grade list.</small>
                        <i class="fas fa-arrow-up-right-from-square secretary-admin-action-tile__arrow" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="role-op-tile secretary-admin-action-tile" data-secretary-tab-link="messages">
                        <span class="secretary-admin-action-tile__icon secretary-admin-action-tile__icon--violet"><i class="fas fa-envelope" aria-hidden="true"></i></span>
                        <span>Answer families</span>
                        <small>Open the message inbox.</small>
                        <i class="fas fa-arrow-up-right-from-square secretary-admin-action-tile__arrow" aria-hidden="true"></i>
                    </button>` : ''}
                    <button type="button" class="role-op-tile secretary-admin-action-tile" data-secretary-tab-link="school" data-secretary-school-subtab="students">
                        <span class="secretary-admin-action-tile__icon secretary-admin-action-tile__icon--emerald"><i class="fas fa-users" aria-hidden="true"></i></span>
                        <span>Student list</span>
                        <small>${hasFullConsole ? 'Find a student and edit their details.' : 'Review the schoolwide student list.'}</small>
                        <i class="fas fa-arrow-up-right-from-square secretary-admin-action-tile__arrow" aria-hidden="true"></i>
                    </button>
                </div>
            </article>
        </div>
    `;
}

function renderGradingSetup() {
    const classes = (state.get('allSchoolClasses') || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const schoolDefaults = getSchoolAssessmentDefaults();
    const selectedClassId = state.get('secretaryView')?.selectedGradingClassId || '';
    const selectedClass = classes.find((c) => c.id === selectedClassId);

    return `
        <div class="secretary-admin-panel-content secretary-admin-panel-content--grading">
            ${renderAdminSectionIntro(
                'Grading setup',
                'Set the rules once, then fine-tune by class.',
                'School defaults keep marking consistent. Class overrides are optional for the moments when one class needs a different scale.',
                'fa-clipboard-check',
                'violet'
            )}

            <div class="secretary-grading-savebar">
                <div>
                    <span class="secretary-grading-savebar__label"><i class="fas fa-cloud-arrow-up" aria-hidden="true"></i> Grading changes are ready to save</span>
                    <small>Save school defaults and the selected class override together.</small>
                </div>
                <button type="button" id="secretary-save-assessment-btn" class="role-btn-primary">
                    <i class="fas fa-save" aria-hidden="true"></i> Save grading setup
                </button>
            </div>

            <section class="role-card secretary-admin-card secretary-grading-defaults-card">
                <div class="secretary-admin-card__header">
                    <div class="secretary-admin-card__title-group">
                        <span class="secretary-admin-card__icon secretary-admin-card__icon--violet" aria-hidden="true"><i class="fas fa-layer-group"></i></span>
                        <div>
                            <p class="role-card__eyebrow">School-wide defaults</p>
                            <h3 class="role-card__title">Default rules by league</h3>
                        </div>
                    </div>
                    <div class="secretary-assessment-editor-actions">
                        <button type="button" class="secretary-chip-btn" data-secretary-assessment-details-action="open">Open all</button>
                        <button type="button" class="secretary-chip-btn secretary-chip-btn--soft" data-secretary-assessment-details-action="close">Collapse all</button>
                    </div>
                </div>
                <p class="secretary-admin-card__description">These settings apply automatically to every class in the matching league unless that class uses its own override.</p>
                <div class="secretary-assessment-preview">
                    ${Object.entries(schoolDefaults).map(([league, config]) => `
                        <div class="secretary-assessment-preview__item">
                            <div class="secretary-assessment-preview__heading">
                                <strong>${escapeHtml(league)}</strong>
                                <span>Default</span>
                            </div>
                            <div class="secretary-assessment-preview__rule"><span>Tests</span><strong>${escapeHtml(describeAssessmentScheme(config.tests))}</strong></div>
                            <div class="secretary-assessment-preview__rule"><span>Dictations</span><strong>${escapeHtml(describeAssessmentScheme(config.dictations))}</strong></div>
                        </div>
                    `).join('')}
                </div>
                <div id="secretary-assessment-defaults-editor" class="secretary-assessment-defaults-editor">
                    ${getAssessmentDefaultsEditorHtml(schoolDefaults)}
                </div>
            </section>

            <section class="role-card secretary-admin-card secretary-grading-overrides-card">
                <div class="secretary-admin-card__header">
                    <div class="secretary-admin-card__title-group">
                        <span class="secretary-admin-card__icon secretary-admin-card__icon--amber" aria-hidden="true"><i class="fas fa-sliders"></i></span>
                        <div>
                            <p class="role-card__eyebrow">Per-class overrides</p>
                            <h3 class="role-card__title">Choose a class to edit</h3>
                        </div>
                    </div>
                    <span class="secretary-admin-card__helper">Optional</span>
                </div>
                <p class="secretary-admin-card__description">Select a class when it needs different rules from its league default. Classes using school defaults stay in sync automatically.</p>
                <div class="secretary-grading-overrides-layout">
                    <div class="secretary-class-picker-pane">
                        <div class="secretary-class-picker-pane__header">
                            <span>Classes</span>
                            <strong>${classes.length}</strong>
                        </div>
                        <div class="secretary-class-list">
                            ${classes.map((classData) => `
                                <button type="button" class="role-list-row secretary-class-choice ${selectedClassId === classData.id ? 'is-selected' : ''}" data-secretary-grading-class="${escapeHtml(classData.id)}" aria-pressed="${selectedClassId === classData.id ? 'true' : 'false'}">
                                    <div class="role-list-row__avatar role-list-row__avatar--amber">${escapeHtml(classData.logo || '📚')}</div>
                                    <div class="role-list-row__body">
                                        <div class="role-list-row__title">${escapeHtml(classData.name)}</div>
                                        <div class="role-list-row__meta">${escapeHtml(classData.questLevel || 'Level')}</div>
                                    </div>
                                    ${selectedClassId === classData.id ? '<span class="secretary-class-choice__state">Editing</span>' : '<i class="fas fa-chevron-right secretary-class-choice__arrow" aria-hidden="true"></i>'}
                                </button>
                            `).join('') || '<div class="role-empty-state">No classes yet.</div>'}
                        </div>
                    </div>

                    <div class="secretary-class-editor-pane">
                        ${selectedClass ? `
                            <div id="secretary-class-assessment-editor" class="secretary-class-editor-card">
                                <div class="secretary-class-editor-card__heading">
                                    <div>
                                        <p class="role-card__eyebrow">Editing class</p>
                                        <h4 class="secretary-class-editor-card__title">${escapeHtml(selectedClass.logo || '📚')} ${escapeHtml(selectedClass.name)}</h4>
                                    </div>
                                    <span class="secretary-admin-card__badge secretary-admin-card__badge--amber">${escapeHtml(selectedClass.questLevel || 'Class')}</span>
                                </div>
                                ${getAssessmentConfigCardHtml(
                                    selectedClass.assessmentConfig || normalizeClassAssessmentConfig(null, selectedClass.questLevel),
                                    `secretary-class-${selectedClass.id}`,
                                    {
                                        allowInherit: true,
                                        questLevel: selectedClass.questLevel,
                                        title: 'Class-specific rules',
                                        description: 'Use the school defaults unless this class needs a different assessment setup.'
                                    }
                                )}
                            </div>
                        ` : `
                            <div class="secretary-class-editor-empty">
                                <span class="secretary-class-editor-empty__icon" aria-hidden="true"><i class="fas fa-hand-pointer"></i></span>
                                <h4>Choose a class to continue</h4>
                                <p>The class editor will open here, beside your class list, so you can keep the school defaults in view.</p>
                            </div>
                        `}
                    </div>
                </div>
            </section>
        </div>
    `;
}

export function renderSecretaryAdmin() {
    const requestedSubTab = state.get('secretaryView')?.adminSubTab || 'year';
    const subTab = requestedSubTab === 'grading' && !canUseFeature('secretaryAccess') ? 'settings' : requestedSubTab;

    return `
        <div class="secretary-admin-page">
            ${renderAdminHero()}
            ${renderAdminNav(subTab)}
            <div class="secretary-admin-panels">
                <div id="secretary-admin-panel-year" data-secretary-admin-panel="year" class="${subTab === 'year' ? '' : 'hidden'}" role="tabpanel">${renderSchoolYearSection()}</div>
                <div id="secretary-admin-panel-settings" data-secretary-admin-panel="settings" class="${subTab === 'settings' ? '' : 'hidden'}" role="tabpanel">${renderSchoolSettings()}</div>
                ${canUseFeature('secretaryAccess') ? `<div id="secretary-admin-panel-grading" data-secretary-admin-panel="grading" class="${subTab === 'grading' ? '' : 'hidden'}" role="tabpanel">${renderGradingSetup()}</div>` : ''}
            </div>
        </div>
    `;
}
