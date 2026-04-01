import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';
import { hideModal, showAnimatedModal } from './base.js';
import { TEACHER_BOON_PRESETS, awardTeacherBoon, formatTeacherBoonReason, getClassDataById, getTeacherBoonForMonth } from '../../features/boons.js';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const TEACHER_BOON_FIXED_STARS = 2;
const TEACHER_BOON_STEPS = [
    { step: 1, eyebrow: 'Choose', title: 'Select the student', description: 'Pick the student who receives the monthly boon.' },
    { step: 2, eyebrow: 'Reason', title: 'Set the message', description: 'Choose a preset reason or write your own.' },
    { step: 3, eyebrow: 'Confirm', title: 'Bestow the boon', description: 'Review the ceremony card, then award the two stars.' }
];

const teacherBoonModalState = {
    classId: null,
    selectedStudentId: null,
    selectedStars: TEACHER_BOON_FIXED_STARS,
    selectedPresetKey: '',
    customReason: '',
    existingBoon: null,
    isSubmitting: false,
    currentStep: 1
};

function getTeacherBoonClassData() {
    return getClassDataById(teacherBoonModalState.classId);
}

function getTeacherBoonStudents() {
    const students = state.get('allStudents').filter((student) => student.classId === teacherBoonModalState.classId);
    return students.sort((a, b) => {
        const aScore = Number(getTeacherBoonScore(a.id).monthlyStars) || 0;
        const bScore = Number(getTeacherBoonScore(b.id).monthlyStars) || 0;
        return bScore - aScore;
    });
}

function getTeacherBoonScore(studentId) {
    return state.get('allStudentScores').find((score) => score.id === studentId) || {};
}

function getTeacherBoonSelectedStudent() {
    return state.get('allStudents').find((student) => student.id === teacherBoonModalState.selectedStudentId) || null;
}

function isTeacherBoonReadOnly() {
    return Boolean(teacherBoonModalState.existingBoon);
}

function getTeacherBoonFinalReason() {
    const customReason = teacherBoonModalState.customReason.trim();
    if (customReason) return customReason;

    const preset = TEACHER_BOON_PRESETS.find((item) => item.key === teacherBoonModalState.selectedPresetKey);
    return preset?.label || '';
}

function getTeacherBoonSelectedPreset() {
    return TEACHER_BOON_PRESETS.find((item) => item.key === teacherBoonModalState.selectedPresetKey) || null;
}

function getTeacherBoonStepHint() {
    if (isTeacherBoonReadOnly()) {
        return 'This class has already received its Teacher Boon for the month.';
    }

    if (!teacherBoonModalState.selectedStudentId) {
        return 'Start by choosing the student who should receive the monthly boon.';
    }

    if (!getTeacherBoonFinalReason()) {
        return 'Next, choose one of the preset reasons or write a custom note.';
    }

    return 'Everything is ready. Confirm to award exactly two stars.';
}

function isTeacherBoonStepComplete(step) {
    if (step === 1) return Boolean(getTeacherBoonSelectedStudent());
    if (step === 2) return Boolean(getTeacherBoonFinalReason());
    if (step === 3) return Boolean(getTeacherBoonSelectedStudent() && getTeacherBoonFinalReason());
    return false;
}

function getTeacherBoonMaxUnlockedStep() {
    if (isTeacherBoonReadOnly()) return 3;
    if (isTeacherBoonStepComplete(2)) return 3;
    if (isTeacherBoonStepComplete(1)) return 2;
    return 1;
}

function setTeacherBoonCurrentStep(step) {
    const normalizedStep = Number(step) || 1;
    teacherBoonModalState.currentStep = Math.min(Math.max(normalizedStep, 1), getTeacherBoonMaxUnlockedStep());
}

function hideTeacherBoonSuccessOverlay() {
    const overlay = document.getElementById('teacher-boon-success-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('teacher-boon-success-overlay--visible');
}

function scrollCarouselToStudent(studentId) {
    const carousel = document.getElementById('teacher-boon-student-grid');
    if (!carousel) return;
    const card = carousel.querySelector(`[data-teacher-boon-student="${studentId}"]`);
    if (!card) return;

    requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
}

function renderTeacherBoonStudentGrid() {
    const grid = document.getElementById('teacher-boon-student-grid');
    if (!grid) return;

    const students = getTeacherBoonStudents();
    if (!students.length) {
        grid.innerHTML = `
            <div class="teacher-boon-empty-state">
                <div class="teacher-boon-empty-icon">⭐</div>
                <div class="teacher-boon-empty-title">Teacher Boon</div>
                <div class="teacher-boon-empty-copy">Add students to this class first.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = students.map((student, index) => {
        const scoreData = getTeacherBoonScore(student.id);
        const monthlyStars = Number(scoreData.monthlyStars) || 0;
        const isSelected = teacherBoonModalState.selectedStudentId === student.id;
        const rank = index + 1;
        const rankBadge = rank <= 3
            ? `<span class="teacher-boon-student-rank teacher-boon-student-rank--medal">${RANK_MEDALS[rank - 1]}</span>`
            : `<span class="teacher-boon-student-rank teacher-boon-student-rank--number">${rank}</span>`;
        const avatar = student.avatar
            ? `<img src="${student.avatar}" alt="${student.name}" class="teacher-boon-student-avatar">`
            : `<div class="teacher-boon-student-avatar teacher-boon-student-avatar--placeholder">${student.name.charAt(0)}</div>`;

        return `
            <button
                class="teacher-boon-student-btn ${isSelected ? 'is-selected' : ''}"
                data-teacher-boon-student="${student.id}"
                ${isTeacherBoonReadOnly() ? 'disabled' : ''}
                type="button"
            >
                <div class="teacher-boon-student-aura"></div>
                ${rankBadge}
                ${avatar}
                <div class="teacher-boon-student-name">${student.name}</div>
                <div class="teacher-boon-student-stats">⭐ ${monthlyStars} this month</div>
            </button>
        `;
    }).join('');

    if (teacherBoonModalState.selectedStudentId) {
        scrollCarouselToStudent(teacherBoonModalState.selectedStudentId);
    }
}

function syncTeacherBoonStudentSelection() {
    const grid = document.getElementById('teacher-boon-student-grid');
    if (!grid) return;
    const selected = teacherBoonModalState.selectedStudentId;
    grid.querySelectorAll('[data-teacher-boon-student]').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.teacherBoonStudent === selected);
    });
}

function syncTeacherBoonPresetsSelection() {
    const container = document.getElementById('teacher-boon-presets');
    if (!container) return;
    const key = teacherBoonModalState.selectedPresetKey;
    container.querySelectorAll('[data-teacher-boon-preset]').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.teacherBoonPreset === key);
    });
}

function renderTeacherBoonPresets() {
    const container = document.getElementById('teacher-boon-presets');
    if (!container) return;

    container.innerHTML = TEACHER_BOON_PRESETS.map((preset) => `
        <button
            type="button"
            class="teacher-boon-preset-btn ${teacherBoonModalState.selectedPresetKey === preset.key ? 'is-selected' : ''}"
            data-teacher-boon-preset="${preset.key}"
            ${isTeacherBoonReadOnly() ? 'disabled' : ''}
        >
            <span class="teacher-boon-preset-icon">${preset.icon}</span>
            <span class="teacher-boon-preset-copy">
                <strong>${preset.label}</strong>
                <span>Use this reason</span>
            </span>
        </button>
    `).join('');
}

function buildTeacherBoonSummaryMarkup({ compact = false } = {}) {
    const selectedStudent = getTeacherBoonSelectedStudent();
    const finalReason = getTeacherBoonFinalReason();
    const selectedPreset = getTeacherBoonSelectedPreset();
    const boonDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const readOnly = isTeacherBoonReadOnly();
    const isReady = Boolean(selectedStudent && finalReason);
    const summaryClass = compact
        ? 'teacher-boon-summary-card teacher-boon-summary-card--compact'
        : `teacher-boon-summary-card ${isReady ? 'teacher-boon-summary-card--ready' : ''}`;

    if (!selectedStudent) {
        return `
            <div class="${summaryClass} teacher-boon-summary-card--empty">
                <div class="teacher-boon-summary-kicker">Awaiting a hero</div>
                <div class="teacher-boon-summary-reason">Choose a student in Step 1 to begin the monthly blessing.</div>
            </div>
        `;
    }

    const avatar = selectedStudent.avatar
        ? `<img src="${selectedStudent.avatar}" alt="${selectedStudent.name}" class="teacher-boon-summary-avatar">`
        : `<div class="teacher-boon-summary-avatar teacher-boon-summary-avatar--placeholder">${selectedStudent.name.charAt(0)}</div>`;
    const reasonBadge = selectedPreset
        ? `<div class="teacher-boon-summary-virtue-badge">${selectedPreset.icon} ${selectedPreset.label}</div>`
        : (teacherBoonModalState.customReason.trim()
            ? '<div class="teacher-boon-summary-virtue-badge teacher-boon-summary-virtue-badge--custom">✍️ Custom reason</div>'
            : '');

    return `
        <div class="${summaryClass}">
            <div class="teacher-boon-summary-kicker">Teacher Boon</div>
            ${avatar}
            <div class="teacher-boon-summary-name">${selectedStudent.name}</div>
            <div class="teacher-boon-summary-stars">
                <span class="teacher-boon-summary-star-icon">⭐</span>
                <span class="teacher-boon-summary-star-icon">⭐</span>
            </div>
            <div class="teacher-boon-summary-stars-copy">Two stars will be added to this hero.</div>
            ${reasonBadge}
            <div class="teacher-boon-summary-reason">${finalReason ? `“${finalReason}”` : 'Choose a preset reason or write your own note.'}</div>
            <div class="teacher-boon-summary-date">${readOnly ? 'Already awarded this month.' : boonDate}</div>
        </div>
    `;
}

function renderTeacherBoonSummary() {
    const summary = document.getElementById('teacher-boon-selected-summary');
    const sideSummary = document.getElementById('teacher-boon-side-summary');
    const banner = document.getElementById('teacher-boon-status-banner');
    const customReasonInput = document.getElementById('teacher-boon-custom-reason');
    const className = document.getElementById('teacher-boon-class-name');
    const stepHint = document.getElementById('teacher-boon-stage-hint');
    const stepper = document.getElementById('teacher-boon-stepper');
    const backBtn = document.getElementById('teacher-boon-back-btn');
    const nextBtn = document.getElementById('teacher-boon-next-btn');
    const confirmBtn = document.getElementById('teacher-boon-confirm-btn');
    const cancelBtn = document.getElementById('teacher-boon-cancel-btn');
    const shell = document.getElementById('teacher-boon-shell');
    if (!summary || !sideSummary || !banner || !customReasonInput || !className || !stepHint || !stepper || !backBtn || !nextBtn || !confirmBtn || !cancelBtn || !shell) return;

    const classData = getTeacherBoonClassData();
    const selectedStudent = getTeacherBoonSelectedStudent();
    const finalReason = getTeacherBoonFinalReason();
    const isReady = Boolean(selectedStudent && finalReason);
    const readOnly = isTeacherBoonReadOnly();
    const maxUnlockedStep = getTeacherBoonMaxUnlockedStep();
    const currentStepCopy = TEACHER_BOON_STEPS.find((item) => item.step === teacherBoonModalState.currentStep)?.description || '';

    className.textContent = classData ? `${classData.logo || '🏰'} ${classData.name}` : 'Teacher Boon';
    shell.classList.toggle('teacher-boon-shell--readonly', readOnly);
    shell.dataset.step = String(teacherBoonModalState.currentStep);

    customReasonInput.disabled = readOnly;
    customReasonInput.value = teacherBoonModalState.customReason;
    customReasonInput.placeholder = readOnly
        ? 'Teacher Boon is set for this month.'
        : 'Write a personal reason if you want something more specific.';

    if (readOnly) {
        const existingStudent = state.get('allStudents').find((student) => student.id === teacherBoonModalState.existingBoon.studentId);
        const readOnlyReason = formatTeacherBoonReason(teacherBoonModalState.existingBoon);
        banner.innerHTML = `
            <div class="teacher-boon-banner teacher-boon-banner--readonly">
                <div class="teacher-boon-banner-icon">✨</div>
                <div>
                    <div class="teacher-boon-banner-title">Teacher Boon already bestowed</div>
                    <div class="teacher-boon-banner-copy">${existingStudent?.name || 'A student'} received ${teacherBoonModalState.existingBoon.stars} star${teacherBoonModalState.existingBoon.stars === 1 ? '' : 's'} for ${readOnlyReason.toLowerCase()}.</div>
                </div>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="teacher-boon-banner">
                <div class="teacher-boon-banner-icon">🌅</div>
                <div>
                    <div class="teacher-boon-banner-title">One guided monthly boon</div>
                    <div class="teacher-boon-banner-copy">${currentStepCopy} Every Teacher Boon now awards exactly two stars.</div>
                </div>
            </div>
        `;
    }

    summary.innerHTML = buildTeacherBoonSummaryMarkup();
    sideSummary.innerHTML = buildTeacherBoonSummaryMarkup({ compact: true });
    stepHint.textContent = getTeacherBoonStepHint();

    stepper.innerHTML = TEACHER_BOON_STEPS.map(({ step, eyebrow, title }) => {
        const isComplete = step < teacherBoonModalState.currentStep && maxUnlockedStep >= step;
        const isActive = step === teacherBoonModalState.currentStep;
        const isLocked = step > maxUnlockedStep;
        const stateClass = isActive ? 'is-active' : (isComplete ? 'is-complete' : (isLocked ? 'is-locked' : ''));

        return `
            <button
                type="button"
                class="teacher-boon-step ${stateClass}"
                data-teacher-boon-step="${step}"
                ${isLocked ? 'disabled' : ''}
            >
                <span class="teacher-boon-step__index">${step}</span>
                <span class="teacher-boon-step__text">
                    <span class="teacher-boon-step__eyebrow">${eyebrow}</span>
                    <span class="teacher-boon-step__title">${title}</span>
                </span>
            </button>
        `;
    }).join('');

    shell.querySelectorAll('[data-teacher-boon-step-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', Number(panel.dataset.teacherBoonStepPanel) === teacherBoonModalState.currentStep);
    });

    cancelBtn.textContent = readOnly ? 'Close' : 'Cancel';
    backBtn.classList.toggle('hidden', readOnly || teacherBoonModalState.currentStep === 1);
    nextBtn.classList.toggle('hidden', readOnly || teacherBoonModalState.currentStep === 3);
    confirmBtn.classList.toggle('hidden', readOnly || teacherBoonModalState.currentStep !== 3);

    nextBtn.disabled = readOnly || (teacherBoonModalState.currentStep === 1
        ? !isTeacherBoonStepComplete(1)
        : !isTeacherBoonStepComplete(2));
    nextBtn.innerHTML = teacherBoonModalState.currentStep === 1
        ? '<span>Next: Choose reason</span><i class="fas fa-arrow-right"></i>'
        : '<span>Next: Confirm</span><i class="fas fa-arrow-right"></i>';

    confirmBtn.disabled = readOnly || !isReady || teacherBoonModalState.isSubmitting;
    confirmBtn.innerHTML = teacherBoonModalState.isSubmitting
        ? '<i class="fas fa-circle-notch fa-spin"></i> Saving…'
        : '<span class="teacher-boon-confirm-btn__glow"></span><i class="fas fa-wand-magic-sparkles"></i> Bestow Two-Star Teacher Boon';
}

function renderTeacherBoonModal() {
    renderTeacherBoonStudentGrid();
    renderTeacherBoonPresets();
    renderTeacherBoonSummary();
}

async function submitTeacherBoon() {
    if (isTeacherBoonReadOnly() || teacherBoonModalState.isSubmitting) return;

    const selectedStudent = getTeacherBoonSelectedStudent();
    const finalReason = getTeacherBoonFinalReason();
    if (!teacherBoonModalState.classId || !selectedStudent || !finalReason) {
        showToast('Choose the student and reason first.', 'info');
        return;
    }

    teacherBoonModalState.isSubmitting = true;
    renderTeacherBoonSummary();

    try {
        const result = await awardTeacherBoon({
            classId: teacherBoonModalState.classId,
            studentId: teacherBoonModalState.selectedStudentId,
            stars: TEACHER_BOON_FIXED_STARS,
            presetKey: teacherBoonModalState.selectedPresetKey,
            customReason: teacherBoonModalState.customReason
        });

        teacherBoonModalState.existingBoon = result;
        teacherBoonModalState.customReason = result.presetKey === 'custom' || result.reasonText !== result.presetLabel
            ? result.reasonText
            : '';
        teacherBoonModalState.selectedPresetKey = result.presetKey === 'custom' ? '' : result.presetKey;
        teacherBoonModalState.isSubmitting = false;
        teacherBoonModalState.currentStep = 3;
        renderTeacherBoonModal();

        const overlay = document.getElementById('teacher-boon-success-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            requestAnimationFrame(() => overlay.classList.add('teacher-boon-success-overlay--visible'));
        }

        playSound('ceremony');

        const launchBtn = document.getElementById('open-teacher-boon-btn');
        if (launchBtn) launchBtn.classList.add('hidden');

        setTimeout(() => {
            hideTeacherBoonSuccessOverlay();
            hideModal('teacher-boon-modal');
        }, 2200);
    } catch (error) {
        teacherBoonModalState.isSubmitting = false;
        renderTeacherBoonSummary();
        showToast(error?.message || 'Teacher Boon could not be saved.', 'error');
    }
}

export function openTeacherBoonModal() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        showToast('Select a class first.', 'info');
        return;
    }

    if (!utils.isTeacherBoonWindow()) {
        showToast('Teacher Boon appears during the last 3 days of the month.', 'info');
        return;
    }

    const classData = getClassDataById(classId);
    if (!classData) {
        showToast('Selected class not found.', 'error');
        return;
    }

    const existingBoon = getTeacherBoonForMonth(classData, utils.getLocalMonthKey());
    teacherBoonModalState.classId = classId;
    teacherBoonModalState.selectedStudentId = existingBoon?.studentId || null;
    teacherBoonModalState.selectedStars = Number(existingBoon?.stars) || TEACHER_BOON_FIXED_STARS;
    teacherBoonModalState.selectedPresetKey = existingBoon?.presetKey && existingBoon.presetKey !== 'custom'
        ? existingBoon.presetKey
        : '';
    teacherBoonModalState.customReason = existingBoon
        ? ((existingBoon.presetKey === 'custom' || existingBoon.reasonText !== existingBoon.presetLabel)
            ? existingBoon.reasonText
            : '')
        : '';
    teacherBoonModalState.existingBoon = existingBoon || null;
    teacherBoonModalState.isSubmitting = false;
    teacherBoonModalState.currentStep = existingBoon ? 3 : 1;

    hideTeacherBoonSuccessOverlay();
    renderTeacherBoonModal();
    showAnimatedModal('teacher-boon-modal');
}

function scrollCarousel(direction) {
    const carousel = document.getElementById('teacher-boon-student-grid');
    if (!carousel) return;
    const cardWidth = carousel.querySelector('.teacher-boon-student-btn')?.offsetWidth || 180;
    carousel.scrollBy({ left: direction * (cardWidth + 16), behavior: 'smooth' });
}

export function wireTeacherBoonModal() {
    const modal = document.getElementById('teacher-boon-modal');
    if (!modal || modal.dataset.wired === 'true') return;
    modal.dataset.wired = 'true';

    document.getElementById('teacher-boon-close-btn')?.addEventListener('click', () => hideModal('teacher-boon-modal'));
    document.getElementById('teacher-boon-cancel-btn')?.addEventListener('click', () => hideModal('teacher-boon-modal'));
    document.getElementById('teacher-boon-back-btn')?.addEventListener('click', () => {
        if (isTeacherBoonReadOnly()) return;
        setTeacherBoonCurrentStep(teacherBoonModalState.currentStep - 1);
        playSound('click');
        renderTeacherBoonSummary();
    });
    document.getElementById('teacher-boon-next-btn')?.addEventListener('click', () => {
        if (isTeacherBoonReadOnly()) return;
        if (teacherBoonModalState.currentStep === 1 && !isTeacherBoonStepComplete(1)) {
            showToast('Choose a student first.', 'info');
            return;
        }
        if (teacherBoonModalState.currentStep === 2 && !isTeacherBoonStepComplete(2)) {
            showToast('Choose a reason or write your own note first.', 'info');
            return;
        }

        setTeacherBoonCurrentStep(teacherBoonModalState.currentStep + 1);
        playSound('click');
        renderTeacherBoonSummary();
    });
    document.getElementById('teacher-boon-confirm-btn')?.addEventListener('click', submitTeacherBoon);
    document.getElementById('teacher-boon-custom-reason')?.addEventListener('input', (event) => {
        teacherBoonModalState.customReason = event.target.value || '';
        if (teacherBoonModalState.customReason.trim()) {
            teacherBoonModalState.selectedPresetKey = '';
        }
        renderTeacherBoonSummary();
    });

    document.getElementById('teacher-boon-carousel-prev')?.addEventListener('click', () => scrollCarousel(-1));
    document.getElementById('teacher-boon-carousel-next')?.addEventListener('click', () => scrollCarousel(1));

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal('teacher-boon-modal');
            return;
        }

        const stepBtn = event.target.closest('[data-teacher-boon-step]');
        if (stepBtn && !isTeacherBoonReadOnly()) {
            setTeacherBoonCurrentStep(stepBtn.dataset.teacherBoonStep);
            playSound('click');
            renderTeacherBoonSummary();
            return;
        }

        const studentBtn = event.target.closest('[data-teacher-boon-student]');
        if (studentBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedStudentId = studentBtn.dataset.teacherBoonStudent;
            setTeacherBoonCurrentStep(2);
            playSound('click');
            syncTeacherBoonStudentSelection();
            scrollCarouselToStudent(teacherBoonModalState.selectedStudentId);
            renderTeacherBoonSummary();
            return;
        }

        const presetBtn = event.target.closest('[data-teacher-boon-preset]');
        if (presetBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedPresetKey = presetBtn.dataset.teacherBoonPreset;
            teacherBoonModalState.customReason = '';
            playSound('click');
            syncTeacherBoonPresetsSelection();
            renderTeacherBoonSummary();
        }
    });
}
