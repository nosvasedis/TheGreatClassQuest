import * as state from '../state.js';
import { db, doc, setDoc, serverTimestamp } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import {
    previewYearRollover,
    backfillSchoolYearData,
    closeSchoolYear,
    finalizeRollover,
    allocateReturningStudents,
    markStudentLeftSchool
} from '../utils/adminRuntime.js';
import {
    buildRolloverConfirmationText,
    closeDateToPickerValue,
    formatCloseDateLabel,
    formatSchoolYearLabel,
    isCloseDateReached,
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

function renderRolloverJobSummary(job) {
    if (!job) {
        return `
            <div class="secretary-inline-note">
                Run “Preview Year Close” any time. It checks the real data and shows what needs attention before the final close.
            </div>
        `;
    }
    return `
        <div class="school-year-job-summary">
            <div>
                <strong>${escapeHtml(job.status || 'Job')}</strong>
                <span>${escapeHtml(job.stage || job.type || 'latest check')}</span>
            </div>
            ${job.counts ? `
                <div class="school-year-job-counts">
                    ${Object.entries(job.counts).map(([key, value]) => `<span>${escapeHtml(key)}: ${Number(value || 0)}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderPreviewResult(result) {
    if (!result) return '';
    const warnings = result.warnings || [];
    const blockers = result.blockers || [];
    const checklist = result.checklist || [];
    return `
        <div class="school-year-preview-result">
            <div class="school-year-preview-header ${result.safeToClose ? 'school-year-preview-header--ready' : 'school-year-preview-header--warning'}">
                <strong>${result.safeToClose ? 'Ready to close' : 'Review before close'}</strong>
                <span>${escapeHtml(result.closingYearKey || '')} → ${escapeHtml(result.nextYearKey || '')}</span>
            </div>
            ${result.counts ? `
                <div class="school-year-job-counts mt-3">
                    ${Object.entries(result.counts).map(([key, value]) => `<span>${escapeHtml(key)}: ${Number(value || 0)}</span>`).join('')}
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
                    ${blockers.map((item) => `<p><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.fix || '')}</p>`).join('')}
                </div>
            ` : ''}
            ${warnings.length ? `
                <div class="school-year-alert school-year-alert--warning mt-3">
                    ${warnings.map((item) => `<p><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.fix || '')}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderSchoolYearSection() {
    const { schoolYearState } = getSchoolYearSummary();
    const activeYearKey = schoolYearState.activeYearKey;
    const nextYearKey = schoolYearState.nextYearKey;
    const closeReady = isCloseDateReached(schoolYearState.closeDate);
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const rolloverJob = state.get('currentRolloverJob');
    const pendingStudents = students
        .filter((student) => student.enrollmentStatus === 'pendingPlacement')
        .sort((a, b) => a.name.localeCompare(b.name));
    const activeClasses = classes
        .filter((classData) => classData.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name));
    const placedCount = students.filter((student) => student.enrollmentStatus === 'active' && student.classId).length;
    const inactiveCount = students.filter((student) => student.enrollmentStatus === 'inactive').length;
    const studentsMissingScores = students.filter((student) => !scores.some((score) => score.id === student.id));
    const confirmationText = buildRolloverConfirmationText(activeYearKey);
    const closeDateValue = schoolYearState.closeDate || '';
    const closeDatePickerValue = closeDateToPickerValue(closeDateValue);
    const closeDateSavedLabel = formatCloseDateLabel(closeDateValue);

    return `
        <div class="school-year-command">
            <section class="school-year-hero secretary-card secretary-card--featured">
                <div class="school-year-hero__copy">
                    <p class="secretary-card__eyebrow">School year</p>
                    <h2 class="secretary-card__title">Close ${escapeHtml(formatSchoolYearLabel(activeYearKey))}, then prepare for September.</h2>
                    <p class="text-sm text-slate-600 mt-2 leading-relaxed">
                        Set the official last school day below. Teachers can place returning students into their new classes; you oversee and can override any placement.
                    </p>
                </div>
                <div class="school-year-status-grid">
                    <div class="school-year-status-card school-year-status-card--sky">
                        <span>Active Year</span>
                        <strong>${escapeHtml(activeYearKey)}</strong>
                        <small>${escapeHtml(schoolYearState.rolloverStatus || 'preparing')}</small>
                    </div>
                    <div class="school-year-status-card school-year-status-card--emerald">
                        <span>Next Year</span>
                        <strong>${escapeHtml(nextYearKey)}</strong>
                        <small>September setup target</small>
                    </div>
                    <div class="school-year-status-card ${closeReady ? 'school-year-status-card--emerald' : 'school-year-status-card--amber'}">
                        <span>Final Close</span>
                        <strong>${closeReady ? 'Unlocked' : 'Locked'}</strong>
                        <small>${escapeHtml(closeDateSavedLabel)}</small>
                    </div>
                </div>
            </section>

            <section class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">School calendar</p>
                        <h3 class="secretary-card__title">Last day of the school year</h3>
                    </div>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">
                    Choose the date when the final year close becomes available. Until this date, the close button stays locked. Dates are shown in day/month/year order (for example 10/06/2026).
                </p>
                <p class="text-xs text-violet-700 mt-2"><span class="font-semibold">Saved last school day:</span> ${escapeHtml(closeDateSavedLabel)}</p>
                <div class="school-year-allocation-bar mt-4">
                    <label class="secretary-field flex-1">
                        <span>Last school day (year-end)</span>
                        <input type="date" id="school-year-close-date-input" value="${escapeHtml(closeDatePickerValue)}">
                    </label>
                    <button type="button" id="school-year-save-close-date-btn" class="secretary-shell__primary-btn">
                        <i class="fas fa-calendar-check mr-2"></i>Save Last School Day
                    </button>
                </div>
            </section>

            <section class="secretary-stat-grid">
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Ready for class</p>
                    <h3 class="secretary-card__metric">${placedCount}</h3>
                    <p class="text-sm text-slate-500">Students currently active in a class.</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Needs placement</p>
                    <h3 class="secretary-card__metric">${pendingStudents.length}</h3>
                    <p class="text-sm text-slate-500">Returning students waiting for September allocation.</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Left school</p>
                    <h3 class="secretary-card__metric">${inactiveCount}</h3>
                    <p class="text-sm text-slate-500">Kept for archive, hidden from daily class flow.</p>
                </article>
                <article class="secretary-card secretary-card--mini">
                    <p class="secretary-card__eyebrow">Missing scores</p>
                    <h3 class="secretary-card__metric">${studentsMissingScores.length}</h3>
                    <p class="text-sm text-slate-500">The migration can repair these automatically.</p>
                </article>
            </section>

            <section class="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <article class="secretary-card">
                    <div class="secretary-card__header">
                        <div>
                            <p class="secretary-card__eyebrow">Preparation</p>
                            <h3 class="secretary-card__title">Run safe checks before the final close</h3>
                        </div>
                    </div>
                    <div class="school-year-action-stack">
                        <button type="button" id="school-year-preview-btn" class="secretary-shell__primary-btn">
                            <i class="fas fa-list-check mr-2"></i>Preview Year Close
                        </button>
                        <button type="button" id="school-year-backfill-btn" class="secretary-shell__secondary-btn">
                            <i class="fas fa-wand-magic-sparkles mr-2"></i>Repair / Tag Existing Data
                        </button>
                        <button type="button" id="school-year-finalize-btn" class="secretary-shell__secondary-btn">
                            <i class="fas fa-rotate mr-2"></i>Finalize September Sync
                        </button>
                    </div>
                    <div id="school-year-preview-output" class="school-year-output mt-4">
                        ${renderRolloverJobSummary(rolloverJob)}
                    </div>
                </article>

                <article class="secretary-card">
                    <div class="secretary-card__header">
                        <div>
                            <p class="secretary-card__eyebrow">Final Close</p>
                            <h3 class="secretary-card__title">Secretary-only confirmation</h3>
                        </div>
                        <div class="secretary-card__badge">${closeReady ? 'Available' : 'Locked'}</div>
                    </div>
                    <p class="text-sm text-slate-600 leading-relaxed">
                        This archives the ended year, preserves gold and guild membership, resets stars/skills/levels/guild power, and moves returning students into “Needs placement” for September.
                    </p>
                    <label class="secretary-field mt-4">
                        <span>Type exactly: ${escapeHtml(confirmationText)}</span>
                        <input type="text" id="school-year-close-confirmation" placeholder="${escapeHtml(confirmationText)}">
                    </label>
                    <button type="button" id="school-year-close-btn" class="secretary-shell__primary-btn school-year-danger-btn mt-4" ${closeReady ? '' : 'disabled'}>
                        <i class="fas fa-lock mr-2"></i>${closeReady ? 'Close School Year' : `Close Unlocks On ${escapeHtml(closeDateSavedLabel)}`}
                    </button>
                </article>
            </section>

            <section class="secretary-card">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">September Roster Allocation</p>
                        <h3 class="secretary-card__title">Place returning students (office override)</h3>
                    </div>
                    <div class="secretary-card__badge">${pendingStudents.length} waiting</div>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed mb-4">
                    Teachers normally place students from their own class roster. Use this section when you need to place students into any teacher’s class.
                </p>
                <div class="school-year-allocation-bar">
                    <label class="secretary-field">
                        <span>September class</span>
                        <select id="school-year-allocation-class">
                            <option value="">Choose the class...</option>
                            ${activeClasses.map((classData) => `
                                <option value="${escapeHtml(classData.id)}">${escapeHtml(classData.name)} • ${escapeHtml(classData.questLevel || 'League')} • ${escapeHtml(classData.createdBy?.name || 'Teacher')}</option>
                            `).join('')}
                        </select>
                    </label>
                    <button type="button" id="school-year-allocate-btn" class="secretary-shell__primary-btn">
                        <i class="fas fa-people-arrows mr-2"></i>Place Selected Students
                    </button>
                </div>
                <div class="school-year-student-grid mt-5">
                    ${pendingStudents.length
                        ? pendingStudents.map((student) => `
                                <article class="school-year-student-card">
                                    <label class="school-year-student-check">
                                        <input type="checkbox" data-school-year-student-check value="${escapeHtml(student.id)}">
                                        <span>${escapeHtml(student.name)}</span>
                                    </label>
                                    <div class="school-year-student-meta">
                                        <span>Old class: ${escapeHtml(student.previousClassName || 'Not recorded')}</span>
                                        <span>League: ${escapeHtml(student.previousQuestLevel || '—')}</span>
                                        <span>Guild: ${escapeHtml(student.guildId || 'No guild yet')}</span>
                                    </div>
                                    <button type="button" class="secretary-chip-btn secretary-chip-btn--rose" data-school-year-left="${escapeHtml(student.id)}">Mark Left School</button>
                                </article>
                            `).join('')
                        : '<div class="secretary-empty">No students are waiting for September placement. After the final close, returning students will appear here.</div>'
                    }
                </div>
            </section>
        </div>
    `;
}

function getSelectedSchoolYearStudentIds() {
    return Array.from(document.querySelectorAll('[data-school-year-student-check]:checked'))
        .map((input) => input.value)
        .filter(Boolean);
}

async function saveSchoolYearCloseDate(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const closeDate = normalizeCloseDateInput(document.getElementById('school-year-close-date-input')?.value);
    if (!closeDate) {
        showToast('Enter a valid last school day (for example 10/06/2026).', 'error');
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

async function runSchoolYearPreview(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const output = document.getElementById('school-year-preview-output');
    try {
        setBusyState(button, true, 'Checking Year Close...');
        const result = await previewYearRollover({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey
        });
        if (output) output.innerHTML = renderPreviewResult(result);
        showToast(result?.safeToClose ? 'Year-close preview is ready.' : 'Preview found items to review.', result?.safeToClose ? 'success' : 'info');
    } catch (error) {
        console.error('Year close preview failed:', error);
        if (output) output.innerHTML = `<div class="school-year-alert school-year-alert--danger">${escapeHtml(error?.message || 'Could not run preview.')}</div>`;
        showToast(error?.message || 'Could not run year-close preview.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearBackfill(button) {
    const { schoolYearState } = getSchoolYearSummary();
    try {
        setBusyState(button, true, 'Repairing Existing Data...');
        const result = await backfillSchoolYearData({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey
        });
        showToast(`Migration repair complete: ${result?.writeCount || 0} records updated.`, 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('School year backfill failed:', error);
        showToast(error?.message || 'Could not repair school-year data.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearClose(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const confirmation = document.getElementById('school-year-close-confirmation')?.value?.trim() || '';
    try {
        setBusyState(button, true, 'Closing School Year...');
        const result = await closeSchoolYear({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey,
            confirmation
        });
        showToast(`School year closed. Job: ${result?.jobId || 'completed'}`, 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('School year close failed:', error);
        showToast(error?.message || 'Could not close the school year.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearFinalize(button) {
    const { schoolYearState } = getSchoolYearSummary();
    try {
        setBusyState(button, true, 'Finalizing September...');
        const result = await finalizeRollover({
            schoolYearKey: schoolYearState.activeYearKey
        });
        showToast(`September sync complete: ${result?.activeStudents || 0} active students checked.`, 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Finalize rollover failed:', error);
        showToast(error?.message || 'Could not finalize September sync.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearAllocation(button) {
    const classId = document.getElementById('school-year-allocation-class')?.value || '';
    const studentIds = getSelectedSchoolYearStudentIds();
    if (!classId || studentIds.length === 0) {
        showToast('Choose a September class and at least one student.', 'info');
        return;
    }
    try {
        setBusyState(button, true, 'Placing Students...');
        const result = await allocateReturningStudents({ classId, studentIds });
        showToast(`${result?.placedCount || studentIds.length} students placed for September.`, 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Allocation failed:', error);
        showToast(error?.message || 'Could not place those students.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runMarkStudentLeft(button, studentId) {
    if (!studentId) return;
    try {
        setBusyState(button, true, 'Marking Left...');
        await markStudentLeftSchool({ studentId });
        showToast('Student marked as left school. Their archive stays safe.', 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Could not mark student left:', error);
        showToast(error?.message || 'Could not update that student.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

let onSchoolYearConsoleRerender = null;

export function wireSchoolYearConsoleHandlers({ onRerender }) {
    onSchoolYearConsoleRerender = onRerender;
}

export function handleSchoolYearConsoleClick(event) {
    const previewBtn = event.target.closest('#school-year-preview-btn');
    if (previewBtn) {
        runSchoolYearPreview(previewBtn);
        return true;
    }

    const backfillBtn = event.target.closest('#school-year-backfill-btn');
    if (backfillBtn) {
        runSchoolYearBackfill(backfillBtn);
        return true;
    }

    const closeBtn = event.target.closest('#school-year-close-btn');
    if (closeBtn) {
        runSchoolYearClose(closeBtn);
        return true;
    }

    const finalizeBtn = event.target.closest('#school-year-finalize-btn');
    if (finalizeBtn) {
        runSchoolYearFinalize(finalizeBtn);
        return true;
    }

    const allocateBtn = event.target.closest('#school-year-allocate-btn');
    if (allocateBtn) {
        runSchoolYearAllocation(allocateBtn);
        return true;
    }

    const saveCloseDateBtn = event.target.closest('#school-year-save-close-date-btn');
    if (saveCloseDateBtn) {
        saveSchoolYearCloseDate(saveCloseDateBtn);
        return true;
    }

    const leftBtn = event.target.closest('[data-school-year-left]');
    if (leftBtn) {
        runMarkStudentLeft(leftBtn, leftBtn.dataset.schoolYearLeft);
        return true;
    }

    return false;
}
