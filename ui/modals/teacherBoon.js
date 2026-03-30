import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';
import { hideModal, showAnimatedModal } from './base.js';
import { TEACHER_BOON_PRESETS, awardTeacherBoon, formatTeacherBoonReason, getTeacherBoonForMonth } from '../../features/boons.js';

const teacherBoonModalState = {
    classId: null,
    selectedStudentId: null,
    selectedStars: 0,
    selectedPresetKey: '',
    customReason: '',
    existingBoon: null,
    isSubmitting: false
};

function getTeacherBoonClassData() {
    return state.get('allSchoolClasses').find((item) => item.id === teacherBoonModalState.classId) || null;
}

function getTeacherBoonStudents() {
    return state.get('allStudents').filter((student) => student.classId === teacherBoonModalState.classId);
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

function hideTeacherBoonSuccessOverlay() {
    const overlay = document.getElementById('teacher-boon-success-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('teacher-boon-success-overlay--visible');
}

function renderTeacherBoonStudentGrid() {
    const grid = document.getElementById('teacher-boon-student-grid');
    if (!grid) return;

    const students = getTeacherBoonStudents();
    if (!students.length) {
        grid.innerHTML = `
            <div class="teacher-boon-empty-state">
                <div class="teacher-boon-empty-icon">🌙</div>
                <div class="teacher-boon-empty-title">No students are ready for this boon yet.</div>
                <div class="teacher-boon-empty-copy">Add students to the selected class to bestow the monthly boon.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = students.map((student) => {
        const scoreData = getTeacherBoonScore(student.id);
        const monthlyStars = Number(scoreData.monthlyStars) || 0;
        const totalStars = Number(scoreData.totalStars) || 0;
        const isSelected = teacherBoonModalState.selectedStudentId === student.id;
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
                ${avatar}
                <div class="teacher-boon-student-meta">
                    <div class="teacher-boon-student-name">${student.name}</div>
                    <div class="teacher-boon-student-stats">
                        <span>${monthlyStars} this month</span>
                        <span>${totalStars} total</span>
                    </div>
                </div>
                <div class="teacher-boon-student-select">
                    ${isSelected ? 'Chosen' : 'Choose'}
                </div>
            </button>
        `;
    }).join('');
}

function renderTeacherBoonStars() {
    const container = document.getElementById('teacher-boon-stars');
    if (!container) return;

    container.innerHTML = [1, 2, 3].map((stars) => `
        <button
            type="button"
            class="teacher-boon-star-btn ${teacherBoonModalState.selectedStars === stars ? 'is-selected' : ''}"
            data-teacher-boon-stars="${stars}"
            ${isTeacherBoonReadOnly() ? 'disabled' : ''}
        >
            <span class="teacher-boon-star-btn-label">${stars} Star${stars === 1 ? '' : 's'}</span>
            <span class="teacher-boon-star-btn-stars">${'⭐'.repeat(stars)}</span>
        </button>
    `).join('');
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
            <span>${preset.label}</span>
        </button>
    `).join('');
}

function renderTeacherBoonSummary() {
    const summary = document.getElementById('teacher-boon-selected-summary');
    const banner = document.getElementById('teacher-boon-status-banner');
    const customReasonInput = document.getElementById('teacher-boon-custom-reason');
    const className = document.getElementById('teacher-boon-class-name');
    const confirmBtn = document.getElementById('teacher-boon-confirm-btn');
    const cancelBtn = document.getElementById('teacher-boon-cancel-btn');
    const shell = document.getElementById('teacher-boon-shell');
    if (!summary || !banner || !customReasonInput || !className || !confirmBtn || !cancelBtn || !shell) return;

    const classData = getTeacherBoonClassData();
    const selectedStudent = getTeacherBoonSelectedStudent();
    const finalReason = getTeacherBoonFinalReason();
    const boonDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const isReady = Boolean(selectedStudent && teacherBoonModalState.selectedStars && finalReason);
    const readOnly = isTeacherBoonReadOnly();

    className.textContent = classData ? `${classData.logo || '🏰'} ${classData.name}` : 'Teacher Boon';
    shell.classList.toggle('teacher-boon-shell--readonly', readOnly);

    customReasonInput.disabled = readOnly;
    customReasonInput.value = teacherBoonModalState.customReason;
    customReasonInput.placeholder = readOnly
        ? 'This boon has already been written into the class chronicle.'
        : 'Optional custom reason that will appear in the ceremony reveal...';

    if (readOnly) {
        const existingStudent = state.get('allStudents').find((student) => student.id === teacherBoonModalState.existingBoon.studentId);
        const readOnlyReason = formatTeacherBoonReason(teacherBoonModalState.existingBoon);
        banner.innerHTML = `
            <div class="teacher-boon-banner teacher-boon-banner--readonly">
                <div class="teacher-boon-banner-icon">📜</div>
                <div>
                    <div class="teacher-boon-banner-title">This month&apos;s Teacher Boon has already been bestowed.</div>
                    <div class="teacher-boon-banner-copy">${existingStudent?.name || 'A student'} received ${teacherBoonModalState.existingBoon.stars} star${teacherBoonModalState.existingBoon.stars === 1 ? '' : 's'} for ${readOnlyReason}.</div>
                </div>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="teacher-boon-banner">
                <div class="teacher-boon-banner-icon">✨</div>
                <div>
                    <div class="teacher-boon-banner-title">One monthly boon per class</div>
                    <div class="teacher-boon-banner-copy">Choose the hero, the stars, and the reason that will appear during the ceremony reveal.</div>
                </div>
            </div>
        `;
    }

    summary.innerHTML = selectedStudent
        ? `
            <div class="teacher-boon-summary-card">
                <div class="teacher-boon-summary-kicker">${readOnly ? 'Recorded Boon' : 'Ceremony Preview'}</div>
                <div class="teacher-boon-summary-name">${selectedStudent.name}</div>
                <div class="teacher-boon-summary-stars">${teacherBoonModalState.selectedStars || 0} Star${teacherBoonModalState.selectedStars === 1 ? '' : 's'}</div>
                <div class="teacher-boon-summary-reason">${finalReason || 'Choose a reason to complete the boon.'}</div>
                <div class="teacher-boon-summary-date">${readOnly ? 'Already sealed in the class chronicle' : `Will be sealed on ${boonDate}`}</div>
            </div>
        `
        : `
            <div class="teacher-boon-summary-card teacher-boon-summary-card--empty">
                <div class="teacher-boon-summary-kicker">Ceremony Preview</div>
                <div class="teacher-boon-summary-reason">Choose a student, stars, and a reason to craft the monthly boon.</div>
            </div>
        `;

    cancelBtn.textContent = readOnly ? 'Close' : 'Cancel';
    confirmBtn.disabled = readOnly || !isReady || teacherBoonModalState.isSubmitting;
    confirmBtn.innerHTML = teacherBoonModalState.isSubmitting
        ? '<i class="fas fa-circle-notch fa-spin mr-2"></i>Weaving the boon...'
        : '<i class="fas fa-wand-magic-sparkles mr-2"></i>Bestow Monthly Boon';
}

function renderTeacherBoonModal() {
    renderTeacherBoonStudentGrid();
    renderTeacherBoonStars();
    renderTeacherBoonPresets();
    renderTeacherBoonSummary();
}

async function submitTeacherBoon() {
    if (isTeacherBoonReadOnly() || teacherBoonModalState.isSubmitting) return;

    const selectedStudent = getTeacherBoonSelectedStudent();
    const finalReason = getTeacherBoonFinalReason();
    if (!teacherBoonModalState.classId || !selectedStudent || !teacherBoonModalState.selectedStars || !finalReason) {
        showToast('Choose the student, stars, and reason first.', 'info');
        return;
    }

    teacherBoonModalState.isSubmitting = true;
    renderTeacherBoonSummary();

    try {
        const result = await awardTeacherBoon({
            classId: teacherBoonModalState.classId,
            studentId: teacherBoonModalState.selectedStudentId,
            stars: teacherBoonModalState.selectedStars,
            presetKey: teacherBoonModalState.selectedPresetKey,
            customReason: teacherBoonModalState.customReason
        });

        teacherBoonModalState.existingBoon = result;
        teacherBoonModalState.customReason = result.reasonText === result.presetLabel ? '' : result.reasonText;
        teacherBoonModalState.isSubmitting = false;
        renderTeacherBoonModal();

        const overlay = document.getElementById('teacher-boon-success-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            requestAnimationFrame(() => overlay.classList.add('teacher-boon-success-overlay--visible'));
        }

        setTimeout(() => {
            hideTeacherBoonSuccessOverlay();
            hideModal('teacher-boon-modal');
        }, 1700);
    } catch (error) {
        teacherBoonModalState.isSubmitting = false;
        renderTeacherBoonSummary();
        showToast(error?.message || 'The monthly boon could not be bestowed.', 'error');
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

    const classData = state.get('allSchoolClasses').find((item) => item.id === classId);
    if (!classData) {
        showToast('Selected class not found.', 'error');
        return;
    }

    const existingBoon = getTeacherBoonForMonth(classData, utils.getLocalMonthKey());
    teacherBoonModalState.classId = classId;
    teacherBoonModalState.selectedStudentId = existingBoon?.studentId || null;
    teacherBoonModalState.selectedStars = Number(existingBoon?.stars) || 0;
    teacherBoonModalState.selectedPresetKey = existingBoon?.presetKey || '';
    teacherBoonModalState.customReason = existingBoon && existingBoon.reasonText !== existingBoon.presetLabel
        ? existingBoon.reasonText
        : '';
    teacherBoonModalState.existingBoon = existingBoon || null;
    teacherBoonModalState.isSubmitting = false;

    hideTeacherBoonSuccessOverlay();
    renderTeacherBoonModal();
    showAnimatedModal('teacher-boon-modal');
}

export function wireTeacherBoonModal() {
    const modal = document.getElementById('teacher-boon-modal');
    if (!modal || modal.dataset.wired === 'true') return;
    modal.dataset.wired = 'true';

    document.getElementById('teacher-boon-close-btn')?.addEventListener('click', () => hideModal('teacher-boon-modal'));
    document.getElementById('teacher-boon-cancel-btn')?.addEventListener('click', () => hideModal('teacher-boon-modal'));
    document.getElementById('teacher-boon-confirm-btn')?.addEventListener('click', submitTeacherBoon);
    document.getElementById('teacher-boon-custom-reason')?.addEventListener('input', (event) => {
        teacherBoonModalState.customReason = event.target.value || '';
        renderTeacherBoonSummary();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal('teacher-boon-modal');
            return;
        }

        const studentBtn = event.target.closest('[data-teacher-boon-student]');
        if (studentBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedStudentId = studentBtn.dataset.teacherBoonStudent;
            playSound('click');
            renderTeacherBoonModal();
            return;
        }

        const starBtn = event.target.closest('[data-teacher-boon-stars]');
        if (starBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedStars = Number(starBtn.dataset.teacherBoonStars);
            playSound('star2');
            renderTeacherBoonModal();
            return;
        }

        const presetBtn = event.target.closest('[data-teacher-boon-preset]');
        if (presetBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedPresetKey = presetBtn.dataset.teacherBoonPreset;
            playSound('click');
            renderTeacherBoonModal();
        }
    });
}
