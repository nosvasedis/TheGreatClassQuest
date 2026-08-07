import * as state from '../state.js';
import { db, doc, setDoc, serverTimestamp } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import {
    previewYearRollover,
    ensureOpenSchoolYears,
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
    getScheduledActiveClasses,
    hasSchoolYearBegun,
    isCloseDateReached,
    normalizeCloseDateInput,
    normalizeSchoolYearState,
    PUBLIC_DATA_PATH
} from '../utils/schoolYear.js';

let lastYearVerification = null;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function friendlyYearStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (['completed', 'complete', 'closed'].includes(status)) return 'Finished';
    if (['running', 'processing', 'in_progress'].includes(status)) return 'In progress';
    if (['september_setup', 'preparing'].includes(status)) return 'Getting ready';
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
    modal.className = 'fixed inset-0 z-[2200] hidden items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="school-year-preview-modal-panel pop-in w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-sky-100 flex flex-col">
            <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-emerald-50">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">School year</p>
                    <h3 class="font-title text-2xl text-slate-800">Readiness check</h3>
                </div>
                <button type="button" id="school-year-preview-modal-close" class="w-10 h-10 rounded-full bg-white text-slate-500 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 shadow-sm flex items-center justify-center" aria-label="Close preview">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="school-year-preview-modal-content" class="p-6 overflow-y-auto custom-scrollbar"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('#school-year-preview-modal-close')) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
    return modal;
}

function showPreviewModal(contentHtml) {
    const modal = ensurePreviewModal();
    const content = document.getElementById('school-year-preview-modal-content');
    if (content) content.innerHTML = contentHtml;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample }) {
    return `
        <section class="secretary-card school-year-close-date-card">
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">School calendar</p>
                    <h3 class="secretary-card__title">Last day of the school year</h3>
                </div>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">
                Optional for now. When you are ready later, this date unlocks finishing the year (for example ${escapeHtml(closeDateExample)}).
            </p>
            <p class="text-xs text-sky-700 mt-2"><span class="font-semibold">Saved:</span> ${escapeHtml(closeDateSavedLabel)}</p>
            <div class="school-year-allocation-bar mt-4">
                <label class="secretary-field flex-1">
                    <span>Last school day</span>
                    <input type="date" id="school-year-close-date-input" value="${escapeHtml(closeDatePickerValue)}">
                </label>
                <button type="button" id="school-year-save-close-date-btn" class="secretary-shell__primary-btn">
                    <i class="fas fa-calendar-check mr-2"></i>Save
                </button>
            </div>
        </section>
    `;
}

function renderPreparingMode({
    schoolYearState,
    activeYearKey,
    startsAtLabel,
    closeDatePickerValue,
    closeDateSavedLabel,
    closeDateExample
}) {
    return `
        <div class="school-year-command school-year-command--preparing">
            <section class="school-year-hero secretary-card secretary-card--featured school-year-hero--calm">
                <div class="school-year-hero__copy">
                    <p class="secretary-card__eyebrow">Your school year</p>
                    <h2 class="secretary-card__title">${escapeHtml(formatSchoolYearLabel(activeYearKey))}</h2>
                    <p class="school-year-status-pill school-year-status-pill--calm" role="status">Not started yet</p>
                    <p class="text-sm text-slate-600 mt-3 leading-relaxed max-w-xl">
                        Teachers have not set up scheduled classes for this year yet.
                        End-of-year tools stay hidden until a class has lesson days — or until ${escapeHtml(startsAtLabel)}.
                    </p>
                </div>
                <div class="school-year-status-grid">
                    <div class="school-year-status-card school-year-status-card--sky">
                        <span>Active year</span>
                        <strong>${escapeHtml(activeYearKey || '—')}</strong>
                        <small>${escapeHtml(friendlyYearStatus(schoolYearState.rolloverStatus))}</small>
                    </div>
                    <div class="school-year-status-card school-year-status-card--amber">
                        <span>Starts</span>
                        <strong>${escapeHtml(startsAtLabel)}</strong>
                        <small>Or when schedules appear</small>
                    </div>
                </div>
            </section>

            ${renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample })}
        </div>
    `;
}

function renderPlacementSection({ pendingStudents, activeClasses }) {
    if (!pendingStudents.length) return '';
    return `
        <section class="secretary-card">
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">September placement</p>
                    <h3 class="secretary-card__title">Place returning students</h3>
                </div>
                <div class="secretary-card__badge">${pendingStudents.length} waiting</div>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed mb-4">
                Choose a class, select students, then place them. Only appears when someone is waiting.
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
                    <i class="fas fa-people-arrows mr-2"></i>Place selected
                </button>
            </div>
            <div class="school-year-student-grid mt-5">
                ${pendingStudents.map((student) => `
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
                        <button type="button" class="secretary-chip-btn secretary-chip-btn--rose" data-school-year-left="${escapeHtml(student.id)}">Mark left school</button>
                        <p class="school-year-student-meta mt-2 text-xs text-slate-500">Turns off parent access now. Removes this student from the app after 30 days.</p>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderUnderwayMode({
    schoolYearState,
    activeYearKey,
    scheduledCount,
    closeReady,
    closeDatePickerValue,
    closeDateSavedLabel,
    closeDateExample,
    confirmationText,
    pendingStudents,
    activeClasses
}) {
    return `
        <div class="school-year-command school-year-command--underway">
            <section class="school-year-hero secretary-card secretary-card--featured">
                <div class="school-year-hero__copy">
                    <p class="secretary-card__eyebrow">Your school year</p>
                    <h2 class="secretary-card__title">${escapeHtml(formatSchoolYearLabel(activeYearKey))}</h2>
                    <p class="school-year-status-pill school-year-status-pill--live" role="status">In progress</p>
                    <p class="text-sm text-slate-600 mt-3 leading-relaxed max-w-xl">
                        Classes are under way. Set the last school day, check readiness when you need to, then finish the year when that day arrives.
                    </p>
                </div>
                <div class="school-year-status-grid">
                    <div class="school-year-status-card school-year-status-card--sky">
                        <span>Active year</span>
                        <strong>${escapeHtml(activeYearKey || '—')}</strong>
                        <small>${escapeHtml(friendlyYearStatus(schoolYearState.rolloverStatus))}</small>
                    </div>
                    <div class="school-year-status-card school-year-status-card--emerald">
                        <span>Scheduled classes</span>
                        <strong>${scheduledCount}</strong>
                        <small>With lesson days</small>
                    </div>
                    <div class="school-year-status-card ${closeReady ? 'school-year-status-card--emerald' : 'school-year-status-card--amber'}">
                        <span>Finish year</span>
                        <strong>${closeReady ? 'Available' : 'Not yet'}</strong>
                        <small>${escapeHtml(closeDateSavedLabel)}</small>
                    </div>
                </div>
            </section>

            ${renderCloseDateCard({ closeDatePickerValue, closeDateSavedLabel, closeDateExample })}

            <section class="secretary-card school-year-end-section">
                <div class="secretary-card__header">
                    <div>
                        <p class="secretary-card__eyebrow">End of year</p>
                        <h3 class="secretary-card__title">Finish when you are ready</h3>
                    </div>
                    <div class="secretary-card__badge">${closeReady ? 'Available' : 'Locked'}</div>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed mb-4">
                    This stores the finished year, keeps gold and guilds, resets live progress, and moves returning students into placement for September.
                </p>
                <div class="school-year-action-stack school-year-action-stack--simple">
                    <button type="button" id="school-year-preview-btn" class="secretary-shell__secondary-btn">
                        <i class="fas fa-list-check mr-2"></i>Check readiness
                    </button>
                    <button type="button" id="school-year-finalize-btn" class="secretary-shell__secondary-btn">
                        <i class="fas fa-flag-checkered mr-2"></i>Finish September setup
                    </button>
                </div>
                <div id="school-year-preview-output" class="school-year-output mt-4"></div>
                <label class="secretary-field mt-4">
                    <span>Type exactly: ${escapeHtml(confirmationText)}</span>
                    <input type="text" id="school-year-close-confirmation" placeholder="${escapeHtml(confirmationText)}">
                </label>
                <button type="button" id="school-year-close-btn" class="secretary-shell__primary-btn school-year-danger-btn mt-4" ${closeReady ? '' : 'disabled'}>
                    <i class="fas fa-lock mr-2"></i>${closeReady ? 'Finish school year' : `Available on ${escapeHtml(closeDateSavedLabel)}`}
                </button>
                <details class="school-year-repair mt-4">
                    <summary>Repair data (rarely needed)</summary>
                    <div class="school-year-action-stack mt-3">
                        <button type="button" id="school-year-verify-records-btn" class="secretary-shell__secondary-btn">
                            <i class="fas fa-shield-check mr-2"></i>Check year setup
                        </button>
                        <button type="button" id="school-year-backfill-btn" class="secretary-shell__secondary-btn">
                            <i class="fas fa-wand-magic-sparkles mr-2"></i>Fix missing year details
                        </button>
                    </div>
                </details>
            </section>

            ${renderPlacementSection({ pendingStudents, activeClasses })}
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

    if (!yearBegun) {
        return renderPreparingMode({
            schoolYearState,
            activeYearKey,
            startsAtLabel,
            closeDatePickerValue,
            closeDateSavedLabel,
            closeDateExample
        });
    }

    return renderUnderwayMode({
        schoolYearState,
        activeYearKey,
        scheduledCount: scheduledClasses.length,
        closeReady,
        closeDatePickerValue,
        closeDateSavedLabel,
        closeDateExample,
        confirmationText,
        pendingStudents,
        activeClasses
    });
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

async function runSchoolYearPreview(button) {
    const { schoolYearState } = getSchoolYearSummary();
    const output = document.getElementById('school-year-preview-output');
    try {
        setBusyState(button, true, 'Checking...');
        const loadingHtml = `
            <div class="school-year-alert school-year-alert--warning">
                <i class="fas fa-spinner fa-spin mr-2"></i> Checking ${escapeHtml(formatSchoolYearLabel(schoolYearState.activeYearKey))}...
            </div>
        `;
        if (output) output.innerHTML = loadingHtml;
        showPreviewModal(loadingHtml);
        const result = await previewYearRollover({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey
        });
        const resultHtml = renderPreviewResult(result);
        if (output) output.innerHTML = resultHtml;
        showPreviewModal(resultHtml);
        showToast(result?.safeToClose ? 'Everything is ready to finish the year.' : 'The check found a few things to review.', result?.safeToClose ? 'success' : 'info');
    } catch (error) {
        console.error('Year close preview failed:', error);
        const errorHtml = `<div class="school-year-alert school-year-alert--danger">${escapeHtml(error?.message || 'Could not run preview.')}</div>`;
        if (output) output.innerHTML = errorHtml;
        showPreviewModal(errorHtml);
        showToast(error?.message || 'Could not run year-close preview.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runVerifyYearRecords(button) {
    try {
        setBusyState(button, true, 'Verifying...');
        lastYearVerification = await ensureOpenSchoolYears();
        showToast(
            lastYearVerification?.writes
                ? `${lastYearVerification.writes} missing school-year detail(s) safely added.`
                : 'The current and next school years are ready.',
            'success'
        );
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('School-year record verification failed:', error);
        showToast(error?.message || 'Could not verify the school-year records.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSchoolYearBackfill(button) {
    const { schoolYearState } = getSchoolYearSummary();
    try {
        setBusyState(button, true, 'Updating year details...');
        const result = await backfillSchoolYearData({
            closingYearKey: schoolYearState.activeYearKey,
            nextYearKey: schoolYearState.nextYearKey
        });
        showToast(`School-year details updated: ${result?.writeCount || 0} item(s) fixed.`, 'success');
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

async function runSchoolYearFinalize(button) {
    const { schoolYearState } = getSchoolYearSummary();
    try {
        setBusyState(button, true, 'Finishing September setup...');
        const result = await finalizeRollover({
            schoolYearKey: schoolYearState.activeYearKey
        });
        showToast(`September setup complete: ${result?.activeStudents || 0} active students checked.`, 'success');
        onSchoolYearConsoleRerender?.();
    } catch (error) {
        console.error('Finalize rollover failed:', error);
        showToast(error?.message || 'Could not finish the September setup.', 'error');
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
        setBusyState(button, true, 'Placing students...');
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
        setBusyState(button, true, 'Marking left...');
        await markStudentLeftSchool({ studentId });
        showToast('Student marked as left school. Parent access is turned off now. Their data is removed from the app after 30 days.', 'success');
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
    const verifyRecordsBtn = event.target.closest('#school-year-verify-records-btn');
    if (verifyRecordsBtn) {
        runVerifyYearRecords(verifyRecordsBtn);
        return true;
    }

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
