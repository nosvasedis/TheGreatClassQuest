import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';
import { hideModal, showAnimatedModal } from './base.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { TEACHER_BOON_PRESETS, awardTeacherBoon, formatTeacherBoonReason, getClassDataById, getTeacherBoonForMonth } from '../../features/boons.js';

const TEACHER_BOON_FIXED_STARS = 2;
const TEACHER_BOON_STEPS = [
    { step: 1, label: 'Hero' },
    { step: 2, label: 'Reason' },
    { step: 3, label: 'Bestow' }
];
// Icon + accent per preset; the emoji in TEACHER_BOON_PRESETS stays for logs and the ceremony.
const TEACHER_BOON_PRESET_STYLE = {
    leadership: { icon: 'fa-crown', accent: '#f59e0b' },
    perseverance: { icon: 'fa-fire', accent: '#f97316' },
    kindness: { icon: 'fa-heart', accent: '#f43f5e' },
    bravery: { icon: 'fa-shield-halved', accent: '#0ea5e9' },
    helping_others: { icon: 'fa-hand-holding-heart', accent: '#10b981' },
    remarkable_growth: { icon: 'fa-seedling', accent: '#8b5cf6' }
};

const teacherBoonModalState = {
    classId: null,
    selectedStudentId: null,
    selectedPresetKey: '',
    customReason: '',
    existingBoon: null,
    isSubmitting: false,
    currentStep: 1
};

function getPresetStyle(key) {
    return TEACHER_BOON_PRESET_STYLE[key] || { icon: 'fa-star', accent: '#f43f5e' };
}

function getTeacherBoonScore(studentId) {
    return state.get('allStudentScores').find((score) => score.id === studentId) || {};
}

function getTeacherBoonStudents() {
    const students = state.get('allStudents').filter((student) => student.classId === teacherBoonModalState.classId);
    return students.sort((a, b) => {
        const aScore = Number(getTeacherBoonScore(a.id).monthlyStars) || 0;
        const bScore = Number(getTeacherBoonScore(b.id).monthlyStars) || 0;
        return bScore - aScore;
    });
}

function getTeacherBoonSelectedStudent() {
    return state.get('allStudents').find((student) => student.id === teacherBoonModalState.selectedStudentId) || null;
}

function getTeacherBoonSelectedPreset() {
    return TEACHER_BOON_PRESETS.find((item) => item.key === teacherBoonModalState.selectedPresetKey) || null;
}

function isTeacherBoonReadOnly() {
    return Boolean(teacherBoonModalState.existingBoon);
}

function getTeacherBoonFinalReason() {
    const customReason = teacherBoonModalState.customReason.trim();
    if (customReason) return customReason;
    return getTeacherBoonSelectedPreset()?.label || '';
}

function isTeacherBoonStepComplete(step) {
    if (step === 1) return Boolean(getTeacherBoonSelectedStudent());
    if (step === 2) return Boolean(getTeacherBoonFinalReason());
    return Boolean(getTeacherBoonSelectedStudent() && getTeacherBoonFinalReason());
}

function getTeacherBoonMaxUnlockedStep() {
    if (isTeacherBoonReadOnly()) return 3;
    if (isTeacherBoonStepComplete(2) && isTeacherBoonStepComplete(1)) return 3;
    if (isTeacherBoonStepComplete(1)) return 2;
    return 1;
}

function goToTeacherBoonStep(step) {
    const target = Math.min(Math.max(Number(step) || 1, 1), getTeacherBoonMaxUnlockedStep());
    if (target === teacherBoonModalState.currentStep) return;
    const shell = document.getElementById('teacher-boon-shell');
    if (shell) shell.dataset.direction = target > teacherBoonModalState.currentStep ? 'forward' : 'back';
    teacherBoonModalState.currentStep = target;
    playSound('click');
    renderTeacherBoonChrome();
}

function hideTeacherBoonSuccessOverlay() {
    const overlay = document.getElementById('teacher-boon-success-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('is-visible');
}

function renderAvatar(student, className) {
    const name = escapeHtml(student.name);
    return student.avatar
        ? `<img src="${escapeHtml(student.avatar)}" alt="" class="${className}">`
        : `<span class="${className} ${className}--initial" aria-hidden="true">${escapeHtml(student.name.charAt(0))}</span>`
            + `<span class="sr-only">${name}</span>`;
}

function renderTeacherBoonStudentGrid() {
    const grid = document.getElementById('teacher-boon-student-grid');
    if (!grid) return;

    const students = getTeacherBoonStudents();
    if (!students.length) {
        grid.innerHTML = `
            <div class="tb-empty">
                <i class="fas fa-user-plus" aria-hidden="true"></i>
                <p>Add students to this class to give a Teacher Boon.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = students.map((student, index) => {
        const monthlyStars = Number(getTeacherBoonScore(student.id).monthlyStars) || 0;
        const isSelected = teacherBoonModalState.selectedStudentId === student.id;
        const rankBadge = index < 3 && monthlyStars > 0
            ? `<span class="tb-student__rank tb-student__rank--${index + 1}" aria-label="Rank ${index + 1}">${index + 1}</span>`
            : '';

        return `
            <button
                type="button"
                class="tb-student ${isSelected ? 'is-selected' : ''}"
                data-teacher-boon-student="${escapeHtml(student.id)}"
                aria-pressed="${isSelected}"
                style="--i:${Math.min(index, 18)}"
            >
                ${rankBadge}
                <span class="tb-student__avatar-wrap">${renderAvatar(student, 'tb-student__avatar')}</span>
                <span class="tb-student__name">${escapeHtml(student.name)}</span>
                <span class="tb-student__stars"><i class="fas fa-star" aria-hidden="true"></i>${monthlyStars}<span class="sr-only"> stars this month</span></span>
            </button>
        `;
    }).join('');
}

function renderTeacherBoonPresets() {
    const container = document.getElementById('teacher-boon-presets');
    if (!container) return;

    container.innerHTML = TEACHER_BOON_PRESETS.map((preset, index) => {
        const { icon, accent } = getPresetStyle(preset.key);
        const isSelected = teacherBoonModalState.selectedPresetKey === preset.key;
        return `
            <button
                type="button"
                class="tb-reason ${isSelected ? 'is-selected' : ''}"
                data-teacher-boon-preset="${preset.key}"
                aria-pressed="${isSelected}"
                style="--tb-accent:${accent};--i:${index}"
            >
                <span class="tb-reason__icon"><i class="fas ${icon}" aria-hidden="true"></i></span>
                <span class="tb-reason__label">${escapeHtml(preset.label)}</span>
            </button>
        `;
    }).join('');
}

function syncSelection(containerId, attr, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(`[${attr}]`).forEach((btn) => {
        const isSelected = btn.getAttribute(attr) === value;
        btn.classList.toggle('is-selected', isSelected);
        btn.setAttribute('aria-pressed', String(isSelected));
    });
}

function buildTeacherBoonCardMarkup() {
    const student = getTeacherBoonSelectedStudent();
    const readOnly = isTeacherBoonReadOnly();
    if (!student) {
        return `
            <div class="tb-card">
                <p class="tb-card__meta">This month’s boon has been given.</p>
            </div>
        `;
    }

    const preset = getTeacherBoonSelectedPreset();
    const customReason = teacherBoonModalState.customReason.trim();
    const stars = readOnly ? (Number(teacherBoonModalState.existingBoon.stars) || TEACHER_BOON_FIXED_STARS) : TEACHER_BOON_FIXED_STARS;
    let reasonMarkup = '';
    if (customReason) {
        reasonMarkup = `<p class="tb-card__quote">“${escapeHtml(customReason)}”</p>`;
    } else if (preset) {
        const { icon, accent } = getPresetStyle(preset.key);
        reasonMarkup = `<span class="tb-card__virtue" style="--tb-accent:${accent}"><i class="fas ${icon}" aria-hidden="true"></i>${escapeHtml(preset.label)}</span>`;
    } else if (readOnly) {
        reasonMarkup = `<p class="tb-card__quote">“${escapeHtml(formatTeacherBoonReason(teacherBoonModalState.existingBoon))}”</p>`;
    }

    const meta = readOnly
        ? '<i class="fas fa-circle-check" aria-hidden="true"></i> Given this month'
        : escapeHtml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

    return `
        <div class="tb-card ${readOnly ? 'tb-card--given' : ''}">
            <div class="tb-card__rays" aria-hidden="true"></div>
            <div class="tb-card__avatar-wrap">${renderAvatar(student, 'tb-card__avatar')}</div>
            <p class="tb-card__name">${escapeHtml(student.name)}</p>
            <div class="tb-card__stars" aria-label="${stars} stars">
                ${'<i class="fas fa-star" aria-hidden="true"></i>'.repeat(Math.max(1, stars))}
            </div>
            ${reasonMarkup}
            <p class="tb-card__meta">${meta}</p>
        </div>
    `;
}

function ensureTeacherBoonStepper() {
    const stepper = document.getElementById('teacher-boon-stepper');
    if (!stepper || stepper.childElementCount) return stepper;
    stepper.innerHTML = TEACHER_BOON_STEPS.map(({ step, label }) => `
        ${step > 1 ? '<span class="tb-steps__line" aria-hidden="true"><span></span></span>' : ''}
        <button type="button" class="tb-steps__item" data-teacher-boon-step="${step}">
            <span class="tb-steps__dot">
                <span class="tb-steps__num">${step}</span>
                <i class="fas fa-check tb-steps__check" aria-hidden="true"></i>
            </span>
            <span class="tb-steps__label">${label}</span>
        </button>
    `).join('');
    return stepper;
}

function renderTeacherBoonChrome() {
    const shell = document.getElementById('teacher-boon-shell');
    const className = document.getElementById('teacher-boon-class-name');
    const customReasonInput = document.getElementById('teacher-boon-custom-reason');
    const summary = document.getElementById('teacher-boon-selected-summary');
    const backBtn = document.getElementById('teacher-boon-back-btn');
    const nextBtn = document.getElementById('teacher-boon-next-btn');
    const confirmBtn = document.getElementById('teacher-boon-confirm-btn');
    const cancelBtn = document.getElementById('teacher-boon-cancel-btn');
    const stepper = ensureTeacherBoonStepper();
    if (!shell || !className || !customReasonInput || !summary || !backBtn || !nextBtn || !confirmBtn || !cancelBtn || !stepper) return;

    const classData = getClassDataById(teacherBoonModalState.classId);
    const readOnly = isTeacherBoonReadOnly();
    const step = teacherBoonModalState.currentStep;
    const maxUnlockedStep = getTeacherBoonMaxUnlockedStep();

    className.textContent = classData
        ? `${classData.logo || '🏰'} ${classData.name} · ${readOnly ? 'given this month' : 'two stars, once a month'}`
        : '';
    shell.classList.toggle('tb-shell--given', readOnly);
    shell.dataset.step = String(step);

    if (customReasonInput.value !== teacherBoonModalState.customReason) {
        customReasonInput.value = teacherBoonModalState.customReason;
    }
    customReasonInput.disabled = readOnly;

    stepper.classList.toggle('hidden', readOnly);
    stepper.querySelectorAll('[data-teacher-boon-step]').forEach((btn) => {
        const itemStep = Number(btn.dataset.teacherBoonStep);
        btn.classList.toggle('is-active', itemStep === step);
        btn.classList.toggle('is-complete', itemStep < step || (itemStep < maxUnlockedStep && itemStep !== step));
        btn.disabled = itemStep > maxUnlockedStep;
        if (itemStep === step) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
    });
    stepper.querySelectorAll('.tb-steps__line').forEach((line, index) => {
        line.classList.toggle('is-filled', index + 2 <= step);
    });

    shell.querySelectorAll('[data-teacher-boon-step-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', Number(panel.dataset.teacherBoonStepPanel) === step);
    });
    if (step === 3) summary.innerHTML = buildTeacherBoonCardMarkup();

    cancelBtn.textContent = readOnly ? 'Close' : 'Cancel';
    cancelBtn.classList.toggle('hidden', !readOnly && step > 1);
    backBtn.classList.toggle('hidden', readOnly || step === 1);
    nextBtn.classList.toggle('hidden', readOnly || step === 3);
    confirmBtn.classList.toggle('hidden', readOnly || step !== 3);

    nextBtn.disabled = !isTeacherBoonStepComplete(step);
    nextBtn.innerHTML = '<span>Continue</span><i class="fas fa-arrow-right" aria-hidden="true"></i>';

    confirmBtn.disabled = readOnly || !isTeacherBoonStepComplete(3) || teacherBoonModalState.isSubmitting;
    confirmBtn.innerHTML = teacherBoonModalState.isSubmitting
        ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span>Bestowing…</span>'
        : '<i class="fas fa-star" aria-hidden="true"></i><span>Bestow boon</span>';
}

function renderTeacherBoonModal() {
    renderTeacherBoonStudentGrid();
    renderTeacherBoonPresets();
    renderTeacherBoonChrome();
}

async function submitTeacherBoon() {
    if (isTeacherBoonReadOnly() || teacherBoonModalState.isSubmitting) return;

    const selectedStudent = getTeacherBoonSelectedStudent();
    if (!teacherBoonModalState.classId || !selectedStudent || !getTeacherBoonFinalReason()) {
        showToast('Choose a student and a reason first.', 'info');
        return;
    }

    teacherBoonModalState.isSubmitting = true;
    renderTeacherBoonChrome();

    try {
        const result = await awardTeacherBoon({
            classId: teacherBoonModalState.classId,
            studentId: teacherBoonModalState.selectedStudentId,
            stars: TEACHER_BOON_FIXED_STARS,
            presetKey: teacherBoonModalState.selectedPresetKey,
            customReason: teacherBoonModalState.customReason
        });

        teacherBoonModalState.existingBoon = result;
        teacherBoonModalState.isSubmitting = false;

        const copy = document.getElementById('teacher-boon-success-copy');
        if (copy) copy.textContent = `${selectedStudent.name} earns two stars.`;
        const overlay = document.getElementById('teacher-boon-success-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            requestAnimationFrame(() => overlay.classList.add('is-visible'));
        }

        playSound('ceremony');
        document.getElementById('open-teacher-boon-btn')?.classList.add('hidden');

        setTimeout(() => {
            hideModal('teacher-boon-modal');
            setTimeout(hideTeacherBoonSuccessOverlay, 400);
        }, 2200);
    } catch (error) {
        teacherBoonModalState.isSubmitting = false;
        renderTeacherBoonChrome();
        showToast(error?.message || 'The Teacher Boon could not be saved. Please try again.', 'error');
    }
}

export function openTeacherBoonModal() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        showToast('Select a class first.', 'info');
        return;
    }

    const classData = getClassDataById(classId);
    if (!utils.isTeacherBoonWindow()) {
        showToast('Teacher Boon opens in the last week of the month.', 'info');
        return;
    }
    if (!classData) {
        showToast('Selected class not found.', 'error');
        return;
    }

    const existingBoon = getTeacherBoonForMonth(classData, utils.getLocalMonthKey());
    teacherBoonModalState.classId = classId;
    teacherBoonModalState.selectedStudentId = existingBoon?.studentId || null;
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

    const shell = document.getElementById('teacher-boon-shell');
    if (shell) shell.dataset.direction = 'forward';

    hideTeacherBoonSuccessOverlay();
    renderTeacherBoonModal();
    showAnimatedModal('teacher-boon-modal');
}

export function wireTeacherBoonModal() {
    const modal = document.getElementById('teacher-boon-modal');
    if (!modal || modal.dataset.wired === 'true') return;
    modal.dataset.wired = 'true';

    const close = () => {
        hideModal('teacher-boon-modal');
    };

    document.getElementById('teacher-boon-close-btn')?.addEventListener('click', close);
    document.getElementById('teacher-boon-cancel-btn')?.addEventListener('click', close);
    document.getElementById('teacher-boon-back-btn')?.addEventListener('click', () => {
        if (!isTeacherBoonReadOnly()) goToTeacherBoonStep(teacherBoonModalState.currentStep - 1);
    });
    document.getElementById('teacher-boon-next-btn')?.addEventListener('click', () => {
        if (isTeacherBoonReadOnly()) return;
        if (!isTeacherBoonStepComplete(teacherBoonModalState.currentStep)) {
            showToast(teacherBoonModalState.currentStep === 1 ? 'Choose a student first.' : 'Pick a reason or write your own.', 'info');
            return;
        }
        goToTeacherBoonStep(teacherBoonModalState.currentStep + 1);
    });
    document.getElementById('teacher-boon-confirm-btn')?.addEventListener('click', submitTeacherBoon);
    document.getElementById('teacher-boon-custom-reason')?.addEventListener('input', (event) => {
        teacherBoonModalState.customReason = event.target.value || '';
        if (teacherBoonModalState.customReason.trim() && teacherBoonModalState.selectedPresetKey) {
            teacherBoonModalState.selectedPresetKey = '';
            syncSelection('teacher-boon-presets', 'data-teacher-boon-preset', '');
        }
        renderTeacherBoonChrome();
    });

    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            close();
            return;
        }
        if (isTeacherBoonReadOnly()) return;

        const stepBtn = event.target.closest('[data-teacher-boon-step]');
        if (stepBtn) {
            goToTeacherBoonStep(stepBtn.dataset.teacherBoonStep);
            return;
        }

        const studentBtn = event.target.closest('[data-teacher-boon-student]');
        if (studentBtn) {
            teacherBoonModalState.selectedStudentId = studentBtn.dataset.teacherBoonStudent;
            playSound('click');
            syncSelection('teacher-boon-student-grid', 'data-teacher-boon-student', teacherBoonModalState.selectedStudentId);
            renderTeacherBoonChrome();
            return;
        }

        const presetBtn = event.target.closest('[data-teacher-boon-preset]');
        if (presetBtn) {
            teacherBoonModalState.selectedPresetKey = presetBtn.dataset.teacherBoonPreset;
            teacherBoonModalState.customReason = '';
            playSound('click');
            syncSelection('teacher-boon-presets', 'data-teacher-boon-preset', teacherBoonModalState.selectedPresetKey);
            renderTeacherBoonChrome();
        }
    });
}
