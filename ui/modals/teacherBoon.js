import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';
import { hideModal, showAnimatedModal } from './base.js';
import { TEACHER_BOON_PRESETS, awardTeacherBoon, formatTeacherBoonReason, getClassDataById, getTeacherBoonForMonth } from '../../features/boons.js';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

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
    return getClassDataById(teacherBoonModalState.classId);
}

function getTeacherBoonStudents() {
    const students = state.get('allStudents').filter((student) => student.classId === teacherBoonModalState.classId);
    return students.sort((a, b) => {
        const aScore = Number((getTeacherBoonScore(a.id)).monthlyStars) || 0;
        const bScore = Number((getTeacherBoonScore(b.id)).monthlyStars) || 0;
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
    if (card) {
        requestAnimationFrame(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }
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

function syncTeacherBoonStarsSelection() {
    const container = document.getElementById('teacher-boon-stars');
    if (!container) return;
    const n = Number(teacherBoonModalState.selectedStars) || 0;
    container.querySelectorAll('[data-teacher-boon-stars]').forEach((btn) => {
        btn.classList.toggle('is-selected', Number(btn.dataset.teacherBoonStars) === n);
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
    const selectedPreset = getTeacherBoonSelectedPreset();
    const boonDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const isReady = Boolean(selectedStudent && teacherBoonModalState.selectedStars && finalReason);
    const readOnly = isTeacherBoonReadOnly();

    className.textContent = classData ? `${classData.logo || '🏰'} ${classData.name}` : 'Teacher Boon';
    shell.classList.toggle('teacher-boon-shell--readonly', readOnly);

    customReasonInput.disabled = readOnly;
    customReasonInput.value = teacherBoonModalState.customReason;
    customReasonInput.placeholder = readOnly
        ? 'Teacher Boon is set for this month.'
        : 'Optional note for the award…';

    if (readOnly) {
        const existingStudent = state.get('allStudents').find((student) => student.id === teacherBoonModalState.existingBoon.studentId);
        const readOnlyReason = formatTeacherBoonReason(teacherBoonModalState.existingBoon);
        banner.innerHTML = `
            <div class="teacher-boon-banner teacher-boon-banner--readonly">
                <div class="teacher-boon-banner-icon">✨</div>
                <div>
                    <div class="teacher-boon-banner-title">Teacher Boon</div>
                    <div class="teacher-boon-banner-copy">${existingStudent?.name || 'A student'} — ${teacherBoonModalState.existingBoon.stars} star${teacherBoonModalState.existingBoon.stars === 1 ? '' : 's'} — ${readOnlyReason}.</div>
                </div>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="teacher-boon-banner">
                <div class="teacher-boon-banner-icon">✨</div>
                <div>
                    <div class="teacher-boon-banner-title">Teacher Boon</div>
                    <div class="teacher-boon-banner-copy">One per class this month. Pick a student, stars, and a reason.</div>
                </div>
            </div>
        `;
    }

    const starIcons = teacherBoonModalState.selectedStars
        ? Array.from({ length: teacherBoonModalState.selectedStars }, (_, i) =>
            `<span class="teacher-boon-summary-star-icon">⭐</span>`
        ).join('')
        : '';

    const virtueBadge = selectedPreset
        ? `<div class="teacher-boon-summary-virtue-badge">${selectedPreset.icon} ${selectedPreset.label}</div>`
        : '';

    if (selectedStudent) {
        const avatar = selectedStudent.avatar
            ? `<img src="${selectedStudent.avatar}" alt="${selectedStudent.name}" class="teacher-boon-summary-avatar">`
            : `<div class="teacher-boon-summary-avatar teacher-boon-summary-avatar--placeholder">${selectedStudent.name.charAt(0)}</div>`;

        summary.innerHTML = `
            <div class="teacher-boon-summary-card ${isReady ? 'teacher-boon-summary-card--ready' : ''}">
                ${avatar}
                <div class="teacher-boon-summary-name">${selectedStudent.name}</div>
                <div class="teacher-boon-summary-stars">${starIcons || '—'}</div>
                ${virtueBadge}
                <div class="teacher-boon-summary-reason">${finalReason ? `"${finalReason}"` : 'Choose a reason to finish.'}</div>
                <div class="teacher-boon-summary-date">${readOnly ? 'Awarded this month.' : boonDate}</div>
            </div>
        `;
    } else {
        summary.innerHTML = `
            <div class="teacher-boon-summary-card teacher-boon-summary-card--empty">
                <div class="teacher-boon-summary-reason">Choose a student, stars, and a reason.</div>
            </div>
        `;
    }

    cancelBtn.textContent = readOnly ? 'Close' : 'Cancel';
    confirmBtn.disabled = readOnly || !isReady || teacherBoonModalState.isSubmitting;
    confirmBtn.querySelector('.teacher-boon-confirm-btn__glow')?.classList.toggle('hidden', !isReady || readOnly);

    const confirmLabel = teacherBoonModalState.isSubmitting
        ? '<i class="fas fa-circle-notch fa-spin"></i> Saving…'
        : '<span class="teacher-boon-confirm-btn__glow"></span><i class="fas fa-wand-magic-sparkles"></i> Bestow Teacher Boon';
    confirmBtn.innerHTML = confirmLabel;
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
        showToast('Choose the champion, stars, and virtue first.', 'info');
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

        playSound('ceremony');

        // Hide the launch button immediately — don't wait for the Firestore snapshot
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
    document.getElementById('teacher-boon-confirm-btn')?.addEventListener('click', submitTeacherBoon);
    document.getElementById('teacher-boon-custom-reason')?.addEventListener('input', (event) => {
        teacherBoonModalState.customReason = event.target.value || '';
        renderTeacherBoonSummary();
    });

    document.getElementById('teacher-boon-carousel-prev')?.addEventListener('click', () => scrollCarousel(-1));
    document.getElementById('teacher-boon-carousel-next')?.addEventListener('click', () => scrollCarousel(1));

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal('teacher-boon-modal');
            return;
        }

        const studentBtn = event.target.closest('[data-teacher-boon-student]');
        if (studentBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedStudentId = studentBtn.dataset.teacherBoonStudent;
            playSound('click');
            syncTeacherBoonStudentSelection();
            scrollCarouselToStudent(teacherBoonModalState.selectedStudentId);
            renderTeacherBoonSummary();
            return;
        }

        const starBtn = event.target.closest('[data-teacher-boon-stars]');
        if (starBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedStars = Number(starBtn.dataset.teacherBoonStars);
            playSound('star2');
            syncTeacherBoonStarsSelection();
            renderTeacherBoonSummary();
            return;
        }

        const presetBtn = event.target.closest('[data-teacher-boon-preset]');
        if (presetBtn && !isTeacherBoonReadOnly()) {
            teacherBoonModalState.selectedPresetKey = presetBtn.dataset.teacherBoonPreset;
            playSound('click');
            syncTeacherBoonPresetsSelection();
            renderTeacherBoonSummary();
        }
    });
}
