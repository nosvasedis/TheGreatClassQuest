import * as state from '../state.js';
import { db, doc, setDoc, serverTimestamp } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import {
    previewYearRollover,
    closeSchoolYear,
    openSchoolYear,
    archiveCarriedYearGold
} from '../utils/adminRuntime.js';
import { openPlacementWizard, refreshPlacementWizardIfOpen } from './placementWizard.js';
import { openClassWizard, refreshClassWizardIfOpen } from './classWizard.js';
import { openStudentWizard, refreshStudentWizardIfOpen } from './studentWizard.js';
import { renderRegistryRollCall } from './secretary/registry.js';
import { openOfficeModal, closeOfficeModal } from './secretary/officeModal.js';
import {
    buildRolloverConfirmationText,
    closeDateToPickerValue,
    formatCloseDateLabel,
    formatSchoolYearLabel,
    getSchoolYearStartMonthDate,
    getScheduledActiveClasses,
    hasSchoolYearBegun,
    isCloseDateReached,
    isSchoolYearAwaitingOpen,
    normalizeCloseDateInput,
    normalizeSchoolYearState,
    PUBLIC_DATA_PATH
} from '../utils/schoolYear.js';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toIsoDateInputValue(date) {
    if (!date || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Enrolling, seating and classes live in Admin → Students & Classes; the year view
// only shows the roll call and points there.
function renderYearSetupLaunchers() {
    return renderRegistryRollCall();
}

function friendlyYearStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (['completed', 'complete', 'closed'].includes(status)) return 'Finished';
    if (['running', 'processing', 'in_progress'].includes(status)) return 'In progress';
    if (status === 'september_setup') return 'Between years';
    if (status === 'preparing') return 'Getting ready';
    if (status === 'active') return 'Open';
    return 'Ready';
}

function friendlyCountLabel(value) {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^./, (letter) => letter.toUpperCase());
}

function setBusyState(button, isBusy, busyLabel) {
    if (!button) return;
    if (!button.dataset.idleHtml) {
        button.dataset.idleHtml = button.innerHTML;
    }
    button.disabled = isBusy;
    button.classList.toggle('opacity-70', isBusy);
    button.classList.toggle('cursor-wait', isBusy);
    button.innerHTML = isBusy
        ? `<i class="fas fa-spinner fa-spin mr-2"></i>${escapeHtml(busyLabel)}`
        : button.dataset.idleHtml;
}

function getSchoolYearSummary() {
    const schoolYearState = normalizeSchoolYearState(state.get('schoolYearState') || {});
    return { schoolYearState };
}

function getActiveYearStartsAt(schoolYearState) {
    const years = state.get('allSchoolYears') || [];
    const definition = years.find((year) => year.id === schoolYearState.activeYearKey);
    return definition?.startsAt || null;
}

function renderPreviewResult(result) {
    if (!result) return '';
    const warnings = result.warnings || [];
    const blockers = result.blockers || [];
    const checklist = result.checklist || [];
    return `
        <div class="school-year-preview-result">
            <div class="school-year-preview-header ${result.safeToClose ? 'school-year-preview-header--ready' : 'school-year-preview-header--warning'}">
                <strong>${result.safeToClose ? 'Ready to finish' : 'A few things need attention'}</strong>
                <span>${escapeHtml(result.closingYearKey || '')} → ${escapeHtml(result.nextYearKey || '')}</span>
            </div>
            ${result.counts ? `
                <div class="school-year-job-counts mt-3">
                    ${Object.entries(result.counts).map(([key, value]) => `<span>${escapeHtml(friendlyCountLabel(key))}: ${Number(value || 0)}</span>`).join('')}
                </div>
            ` : ''}
            ${checklist.length ? `
                <div class="school-year-checklist mt-3">
                    ${checklist.map((item) => `
                        <div class="school-year-check-item">${escapeHtml(item.label)} — ${escapeHtml(item.status || '')}</div>
                    `).join('')}
                </div>
            ` : ''}
            ${blockers.length ? `
                <div class="school-year-alert school-year-alert--danger mt-3">
                    ${blockers.map((item) => `<p><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.message || '')}</p>`).join('')}
                </div>
            ` : ''}
            ${warnings.length ? `
                <div class="school-year-alert school-year-alert--warning mt-3">
                    ${warnings.map((item) => `<p><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.message || '')}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function ensurePreviewModal() {
    let modal = document.getElementById('school-year-preview-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'school-year-preview-modal';
    modal.className = 'office-dialog hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'school-year-preview-title');
    modal.innerHTML = `
        <div class="school-year-preview-modal-panel office-dialog__panel office-folder" data-office-panel>
            <span class="office-folder__tab">School year</span>
            <button type="button" id="school-year-preview-modal-close" class="office-close" aria-label="Close preview">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
            <header class="office-dialog__header">
                <p class="office-kicker">Before you finish the year</p>
                <h3 class="office-dialog__title" id="school-year-preview-title">Readiness check</h3>
            </header>
            <div id="school-year-preview-modal-content" class="office-dialog__body custom-scrollbar"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('#school-year-preview-modal-close')) {
            closeOfficeModal(modal);
        }
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeOfficeModal(modal);
    });
    return modal;
}

function showPreviewModal(contentHtml) {
    const modal = ensurePreviewModal();
    const content = document.getElementById('school-year-preview-modal-content');
    if (content) content.innerHTML = contentHtml;
    if (modal.classList.contains('hidden')) openOfficeModal(modal);
}

// A tear-off calendar leaf: the saved day and month, or a blank page when nothing is set.
function renderCalendarLeaf(pickerValue, isSaved, tone) {
    const match = isSaved ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(pickerValue || '')) : null;
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
    const month = date ? date.toLocaleDateString('en-GB', { month: 'short' }) : 'Date';
    const day = date ? String(date.getDate()) : '?';
    return `
        <span class="office-leaf office-leaf--${tone}${date ? '' : ' is-blank'}" aria-hidden="true">
            <span class="office-leaf__rings"><i></i><i></i></span>
            <span class="office-leaf__month">${escapeHtml(month)}</span>
            <span class="office-leaf__day font-title">${escapeHtml(day)}</span>
        </span>
    `;
}

function renderDateCard({ tone, kicker, title, lead, savedLabel, pickerValue, fieldLabel, controls }) {
    const isSaved = savedLabel && savedLabel !== 'Not set yet';
    return `
        <section class="secretary-card office-date-card office-date-card--${tone}">
            <div class="office-date-card__top">
                ${renderCalendarLeaf(pickerValue, isSaved, tone)}
                <div class="office-date-card__copy">
                    <p class="secretary-card__eyebrow">${escapeHtml(kicker)}</p>
                    <h3 class="secretary-card__title">${escapeHtml(title)}</h3>
                    <p class="office-date-card__saved${isSaved ? ' is-set' : ''}">
                        <i class="fas ${isSaved ? 'fa-circle-check' : 'fa-circle-question'}" aria-hidden="true"></i>
                        ${isSaved ? `Saved: ${escapeHtml(savedLabel)}` : 'Not set yet'}
                    </p>
                </div>
            </div>
            <p class="office-date-card__lead">${lead}</p>
            <label class="secretary-field office-date-card__field">
                <span>${escapeHtml(fieldLabel)}</span>
                <span class="office-inline-field">${controls}</span>
            </label>
        </section>
    `;
}

function renderOpeningDayCard({ openingDayPickerValue, openingDaySavedLabel, openingDayExample }) {
    return renderDateCard({
        tone: 'sky',
        kicker: 'School calendar',
        title: 'Opening day',
        lead: `The first day of lessons. Days before it never count as class days on the attendance register or the Quest Calendar (for example ${escapeHtml(openingDayExample)}).`,
        savedLabel: openingDaySavedLabel,
        pickerValue: openingDayPickerValue,
        fieldLabel: 'First day of lessons',
        controls: `
            <input type="date" id="school-year-opening-day-input" value="${escapeHtml(openingDayPickerValue)}">
            <button type="button" id="school-year-save-opening-day-btn" class="secretary-shell__primary-btn">
                <i class="fas fa-calendar-plus mr-2"></i>Save
            </button>`
    });
}

function renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample }) {
    return renderDateCard({
        tone: 'amber',
        kicker: 'School calendar',
        title: 'Last day of the school year',
        lead: `Optional for now. When you are ready, this date unlocks finishing the year (for example ${escapeHtml(closeDateExample)}).`,
        savedLabel: closeDateSavedLabel,
        pickerValue: closeDatePickerValue,
        fieldLabel: 'Last school day',
        controls: `
            <input type="date" id="school-year-close-date-input" value="${escapeHtml(closeDatePickerValue)}">
            <button type="button" id="school-year-save-close-date-btn" class="secretary-shell__primary-btn">
                <i class="fas fa-calendar-check mr-2"></i>Save
            </button>`
    });
}

function renderDateCards(cards) {
    return `<div class="office-year-dates">${cards.join('')}</div>`;
}

// The year's cover: its name on a wall calendar, a status stamp and a few facts.
function renderYearHero({ mood, statusLabel, activeYearKey, lead, facts }) {
    return `
        <section class="school-year-hero secretary-card office-year-hero office-year-hero--${mood}">
            <div class="office-year-hero__calendar" aria-hidden="true">
                <span class="office-year-hero__rings"><i></i><i></i><i></i></span>
                <span class="office-year-hero__label">School year</span>
                <span class="office-year-hero__years font-title">${escapeHtml(formatSchoolYearLabel(activeYearKey)).replace(' / ', '<small>/</small>')}</span>
            </div>
            <div class="office-year-hero__copy">
                <p class="secretary-card__eyebrow">Your school year</p>
                <h2 class="secretary-card__title">${escapeHtml(formatSchoolYearLabel(activeYearKey))}</h2>
                <p class="school-year-status-pill office-year-hero__stamp office-year-hero__stamp--${mood}" role="status">${escapeHtml(statusLabel)}</p>
                <p class="office-year-hero__lead">${lead}</p>
                <ul class="office-year-hero__facts">
                    ${facts.map((fact) => `
                        <li class="office-year-fact office-year-fact--${fact.tone}">
                            <span class="office-year-fact__icon" aria-hidden="true"><i class="fas ${fact.icon}"></i></span>
                            <span class="office-year-fact__copy">
                                <small>${escapeHtml(fact.label)}</small>
                                <strong>${escapeHtml(fact.value)}</strong>
                                ${fact.note ? `<em>${escapeHtml(fact.note)}</em>` : ''}
                            </span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </section>
    `;
}

function renderPreparingMode({
    schoolYearState,
    activeYearKey,
    startsAtLabel,
    openingDayPickerValue,
    openingDaySavedLabel,
    openingDayExample,
    closeDatePickerValue,
    closeDateSavedLabel,
    closeDateExample,
    pendingStudents
}) {
    return `
        <div class="school-year-command school-year-command--preparing">
            ${renderYearHero({
                mood: 'calm',
                statusLabel: 'Not started yet',
                activeYearKey,
                lead: `Create this year’s classes for each teacher. End-of-year tools stay hidden until a class has lesson days, or until ${escapeHtml(startsAtLabel)}.`,
                facts: [
                    { tone: 'sky', icon: 'fa-calendar', label: 'Year', value: activeYearKey || '—', note: friendlyYearStatus(schoolYearState.rolloverStatus) },
                    { tone: 'amber', icon: 'fa-flag', label: 'Starts', value: startsAtLabel, note: 'Or when schedules appear' }
                ]
            })}

            ${renderYearSetupLaunchers()}

            ${renderDateCards([
                renderOpeningDayCard({ openingDayPickerValue, openingDaySavedLabel, openingDayExample }),
                renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample })
            ])}
        </div>
    `;
}

function renderBetweenYearsMode({
    schoolYearState,
    activeYearKey,
    startsAtLabel,
    openingDayPickerValue,
    openingDaySavedLabel,
    openingDayExample,
    lastClosedYearKey,
    pendingStudents
}) {
    const previousLabel = lastClosedYearKey
        ? formatSchoolYearLabel(lastClosedYearKey)
        : 'the previous year';
    return `
        <div class="school-year-command school-year-command--between">
            ${renderYearHero({
                mood: 'summer',
                statusLabel: 'Between years',
                activeYearKey,
                lead: `${escapeHtml(previousLabel)} is sealed. Teachers see the summer break until you open ${escapeHtml(formatSchoolYearLabel(activeYearKey))}. You can still seat returning students anytime.`,
                facts: [
                    { tone: 'sky', icon: 'fa-calendar', label: 'Next year', value: activeYearKey || '—', note: friendlyYearStatus(schoolYearState.rolloverStatus) },
                    { tone: 'amber', icon: 'fa-sun', label: 'Opens', value: startsAtLabel, note: 'Or open it now below' },
                    { tone: 'emerald', icon: 'fa-chair', label: 'Waiting for a class', value: String(pendingStudents.length), note: 'Returning students' }
                ]
            })}

            ${renderYearSetupLaunchers()}

            ${renderDateCards([renderOpeningDayCard({ openingDayPickerValue, openingDaySavedLabel, openingDayExample })])}

            <section class="secretary-card school-year-open-section">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">New year</p>
                        <h3 class="secretary-card__title">Open the school year</h3>
                    </div>
                    <div class="secretary-card__badge">Ready</div>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed mb-4">
                    Opens ${escapeHtml(formatSchoolYearLabel(activeYearKey))} for teachers. Summer messaging ends;
                    student placement stays available until everyone is seated.
                </p>
                <button type="button" id="school-year-open-btn" class="secretary-shell__primary-btn">
                    <i class="fas fa-sun mr-2"></i>Open school year
                </button>
            </section>

        </div>
    `;
}

function renderUnderwayMode({
    schoolYearState,
    activeYearKey,
    scheduledCount,
    closeReady,
    openingDayPickerValue,
    openingDaySavedLabel,
    openingDayExample,
    closeDatePickerValue,
    closeDateSavedLabel,
    closeDateExample,
    confirmationText,
    pendingStudents
}) {
    return `
        <div class="school-year-command school-year-command--underway">
            ${renderYearHero({
                mood: 'live',
                statusLabel: 'In progress',
                activeYearKey,
                lead: 'Classes are under way. Set the last school day, check readiness when you need to, then finish the year when that day arrives.',
                facts: [
                    { tone: 'sky', icon: 'fa-calendar', label: 'Year', value: activeYearKey || '—', note: friendlyYearStatus(schoolYearState.rolloverStatus) },
                    { tone: 'emerald', icon: 'fa-chalkboard', label: 'Classes with lesson days', value: String(scheduledCount) },
                    { tone: closeReady ? 'emerald' : 'amber', icon: closeReady ? 'fa-lock-open' : 'fa-lock', label: 'Finish year', value: closeReady ? 'Available' : 'Not yet', note: closeDateSavedLabel === 'Not set yet' ? 'Last day not set' : `From ${closeDateSavedLabel}` }
                ]
            })}

            ${renderYearSetupLaunchers()}

            ${renderDateCards([
                renderOpeningDayCard({ openingDayPickerValue, openingDaySavedLabel, openingDayExample }),
                renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample })
            ])}

            <section class="secretary-card school-year-end-section office-finish${closeReady ? ' is-ready' : ''}">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">End of year</p>
                        <h3 class="secretary-card__title">Finish the school year</h3>
                    </div>
                    <div class="secretary-card__badge office-finish__badge"><i class="fas ${closeReady ? 'fa-lock-open' : 'fa-lock'}" aria-hidden="true"></i> ${closeReady ? 'Available' : 'Locked'}</div>
                </div>
                <p class="office-finish__lead">
                    This stores the finished year, archives last year's Gold, keeps guild houses, keeps that year's Fortune Ledger with the closed year, resets live progress (stars, Gold, Golden Legend, and this year's Prodigy counts), and moves returning students into placement.
                </p>
                <ol class="office-finish__steps">
                    <li class="office-finish__step${schoolYearState.closeDate ? ' is-done' : ''}">
                        <span class="office-finish__num" aria-hidden="true">${schoolYearState.closeDate ? '<i class="fas fa-check"></i>' : '1'}</span>
                        <div>
                            <strong>Set the last school day</strong>
                            <small>${schoolYearState.closeDate ? `Saved: ${escapeHtml(closeDateSavedLabel)}` : 'Use the calendar card above.'}</small>
                        </div>
                    </li>
                    <li class="office-finish__step">
                        <span class="office-finish__num" aria-hidden="true">2</span>
                        <div>
                            <strong>Check that everything is ready</strong>
                            <small>See what finishing the year will do before you start.</small>
                            <button type="button" id="school-year-preview-btn" class="secretary-shell__secondary-btn">
                                <i class="fas fa-list-check mr-2"></i>Check readiness
                            </button>
                        </div>
                    </li>
                    <li class="office-finish__step">
                        <span class="office-finish__num" aria-hidden="true">3</span>
                        <div>
                            <strong>Type the confirmation and finish</strong>
                            <label class="secretary-field">
                                <span>Type exactly: ${escapeHtml(confirmationText)}</span>
                                <input type="text" id="school-year-close-confirmation" placeholder="${escapeHtml(confirmationText)}" ${closeReady ? '' : 'disabled'}>
                            </label>
                            <button type="button" id="school-year-close-btn" class="secretary-shell__primary-btn school-year-danger-btn" ${closeReady ? '' : 'disabled'}>
                                <i class="fas fa-lock mr-2"></i>${closeReady ? 'Finish school year' : (schoolYearState.closeDate ? `Available on ${escapeHtml(closeDateSavedLabel)}` : 'Set the last school day first')}
                            </button>
                        </div>
                    </li>
                </ol>
            </section>
        </div>
    `;
}

export function renderSchoolYearSection() {
    const { schoolYearState } = getSchoolYearSummary();
    const activeYearKey = schoolYearState.activeYearKey;
    const closeReady = isCloseDateReached(schoolYearState.closeDate);
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const pendingStudents = students
        .filter((student) => student.enrollmentStatus === 'pendingPlacement')
        .sort((a, b) => a.name.localeCompare(b.name));
    const activeClasses = classes
        .filter((classData) => classData.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name));
    const scheduledClasses = getScheduledActiveClasses(activeClasses);
    const startsAt = getActiveYearStartsAt(schoolYearState);
    const yearBegun = hasSchoolYearBegun({
        startsAt,
        activeClasses,
        now: new Date()
    });
    const confirmationText = buildRolloverConfirmationText(activeYearKey);
    const closeDateValue = schoolYearState.closeDate || '';
    const closeDatePickerValue = closeDateToPickerValue(closeDateValue);
    const closeDateSavedLabel = formatCloseDateLabel(closeDateValue);
    const closeDateExample = `10/06/${String(activeYearKey || '').slice(5) || 'YYYY'}`;
    const startsAtLabel = formatCloseDateLabel(startsAt) === 'Not set yet'
        ? 'the official start date'
        : formatCloseDateLabel(startsAt);
    const openingDayPickerValue = startsAt
        ? closeDateToPickerValue(startsAt)
        : toIsoDateInputValue(getSchoolYearStartMonthDate(startsAt, activeYearKey));
    const openingDaySavedLabel = startsAt ? formatCloseDateLabel(startsAt) : 'Not set yet';
    const openingDayExample = `18/09/${String(activeYearKey || '').slice(0, 4) || 'YYYY'}`;

    if (isSchoolYearAwaitingOpen(schoolYearState)) {
        return renderBetweenYearsMode({
            schoolYearState,
            activeYearKey,
            startsAtLabel,
            openingDayPickerValue,
            openingDaySavedLabel,
            openingDayExample,
            lastClosedYearKey: schoolYearState.lastClosedYearKey || null,
            pendingStudents
        });
    }

    if (!yearBegun) {
        return renderPreparingMode({
            schoolYearState,
            activeYearKey,
            startsAtLabel,
            openingDayPickerValue,
            openingDaySavedLabel,
            openingDayExample,
            closeDatePickerValue,
            closeDateSavedLabel,
            closeDateExample,
            pendingStudents
        });
    }

    return renderUnderwayMode({
        schoolYearState,
        activeYearKey,
        scheduledCount: scheduledClasses.length,
        closeReady,
        openingDayPickerValue,
        openingDaySavedLabel,
        openingDayExample,
        closeDatePickerValue,
        closeDateSavedLabel,
        closeDateExample,
        confirmationText,
        pendingStudents
    });
}

async function saveSchoolYearCloseDate(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const closeDate = normalizeCloseDateInput(document.getElementById('school-year-close-date-input')?.value);
    if (!closeDate) {
        const exampleYear = String(schoolYearState.activeYearKey || '').slice(5) || 'YYYY';
        showToast(`Enter a valid last school day (for example 10/06/${exampleYear}).`, 'error');
        return;
    }
    try {
        setBusyState(button, true, 'Saving...');
        await setDoc(doc(db, `${PUBLIC_DATA_PATH}/school_year_state/current`), {
            closeDate,
            updatedAt: serverTimestamp()
        }, { merge: true });
        await setDoc(doc(db, `${PUBLIC_DATA_PATH}/school_years/${schoolYearState.activeYearKey}`), {
            endsAt: closeDate,
            closeAvailableAt: closeDate,
            updatedAt: serverTimestamp()
        }, { merge: true });
        state.setSchoolYearState({ ...schoolYearState, closeDate });
        showToast('Last school day saved.', 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Could not save close date:', error);
        showToast(error?.message || 'Could not save the last school day.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function saveSchoolYearOpeningDay(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const activeYearKey = schoolYearState.activeYearKey;
    if (!activeYearKey) {
        showToast('The active school year is unavailable right now.', 'error');
        return;
    }
    const startsAt = closeDateToPickerValue(document.getElementById('school-year-opening-day-input')?.value);
    if (!startsAt) {
        showToast('Enter a valid opening day (the first day of lessons).', 'error');
        return;
    }
    try {
        setBusyState(button, true, 'Saving...');
        await setDoc(doc(db, `${PUBLIC_DATA_PATH}/school_years/${activeYearKey}`), {
            startsAt,
            updatedAt: serverTimestamp()
        }, { merge: true });
        const years = state.get('allSchoolYears') || [];
        state.setAllSchoolYears(years.map((year) =>
            year.id === activeYearKey ? { ...year, startsAt } : year
        ));
        showToast('Opening day saved.', 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Could not save opening day:', error);
        showToast(error?.message || 'Could not save the opening day.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearPreview(button) {
    const { schoolYearState } = getSchoolYearSummary();
    try {
        setBusyState(button, true, 'Checking...');
        const loadingHtml = `
            <div class="school-year-alert school-year-alert--warning">
                <i class="fas fa-spinner fa-spin mr-2"></i> Checking ${escapeHtml(formatSchoolYearLabel(schoolYearState.activeYearKey))}...
            </div>
        `;
        showPreviewModal(loadingHtml);
        const result = await previewYearRollover({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey
        });
        const resultHtml = renderPreviewResult(result);
        showPreviewModal(resultHtml);
        showToast(result?.safeToClose ? 'Everything is ready to finish the year.' : 'The check found a few things to review.', result?.safeToClose ? 'success' : 'info');
    } catch (error) {
        console.error('Year close preview failed:', error);
        const errorHtml = `<div class="school-year-alert school-year-alert--danger">${escapeHtml(error?.message || 'Could not run preview.')}</div>`;
        showPreviewModal(errorHtml);
        showToast(error?.message || 'Could not run year-close preview.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearClose(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const confirmation = document.getElementById('school-year-close-confirmation')?.value?.trim() || '';
    try {
        setBusyState(button, true, 'Closing school year...');
        await closeSchoolYear({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey,
            confirmation
        });
        showToast('The school year is safely finished.', 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('School year close failed:', error);
        showToast(error?.message || 'Could not close the school year.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearOpen(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const yearLabel = formatSchoolYearLabel(schoolYearState.activeYearKey);
    const confirmed = window.confirm(
        `Open ${yearLabel} now?\n\nTeachers will leave summer break messaging. Returning students can still be placed afterward.`
    );
    if (!confirmed) return;
    try {
        setBusyState(button, true, 'Opening school year...');
        const result = await openSchoolYear({
            schoolYearKey: schoolYearState.activeYearKey
        });
        showToast(
            result?.alreadyOpen
                ? `${yearLabel} is already open.`
                : `${yearLabel} is open. Welcome back, heroes!`,
            'success'
        );
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('School year open failed:', error);
        showToast(error?.message || 'Could not open the school year.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

let onSchoolYearConsoleRerender = null;
let carriedGoldArchivePromise = null;

function maybeArchiveCarriedYearGold() {
    const schoolYearState = normalizeSchoolYearState(state.get('schoolYearState') || {});
    if (!schoolYearState.lastClosedYearKey) return;
    if (String(schoolYearState.rolloverStatus || '').toLowerCase() !== 'active') return;
    if (carriedGoldArchivePromise) return;
    carriedGoldArchivePromise = archiveCarriedYearGold().catch((error) => {
        console.warn('Could not archive last year\'s Gold:', error);
        carriedGoldArchivePromise = null;
    });
}

export function wireSchoolYearConsoleHandlers({ onRerender }) {
    onSchoolYearConsoleRerender = () => {
        onRerender?.();
        refreshPlacementWizardIfOpen();
        refreshClassWizardIfOpen();
        refreshStudentWizardIfOpen();
    };
    maybeArchiveCarriedYearGold();
}

export function handleSchoolYearConsoleClick(event) {
    const previewBtn = event.target.closest('#school-year-preview-btn');
    if (previewBtn) {
        runSchoolYearPreview(previewBtn);
        return true;
    }

    const closeBtn = event.target.closest('#school-year-close-btn');
    if (closeBtn) {
        runSchoolYearClose(closeBtn);
        return true;
    }

    const openBtn = event.target.closest('#school-year-open-btn');
    if (openBtn) {
        runSchoolYearOpen(openBtn);
        return true;
    }

    const saveOpeningDayBtn = event.target.closest('#school-year-save-opening-day-btn');
    if (saveOpeningDayBtn) {
        saveSchoolYearOpeningDay(saveOpeningDayBtn);
        return true;
    }

    const saveCloseDateBtn = event.target.closest('#school-year-save-close-date-btn');
    if (saveCloseDateBtn) {
        saveSchoolYearCloseDate(saveCloseDateBtn);
        return true;
    }

    const studentDeskBtn = event.target.closest('#school-year-student-desk-open-btn');
    if (studentDeskBtn) {
        openStudentWizard({ onRerender: () => onSchoolYearConsoleRerender?.() });
        return true;
    }

    const classDeskBtn = event.target.closest('#school-year-class-desk-open-btn');
    if (classDeskBtn) {
        openClassWizard({ onRerender: () => onSchoolYearConsoleRerender?.() });
        return true;
    }

    const placementOpenBtn = event.target.closest('#school-year-placement-open-btn');
    if (placementOpenBtn) {
        openPlacementWizard({ onRerender: () => onSchoolYearConsoleRerender?.() });
        return true;
    }

    return false;
}
