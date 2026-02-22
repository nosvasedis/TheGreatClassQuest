// /ui/modals/trophyRoom.js — Trophy Room (Treasure Vault) modal
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import { showAnimatedModal } from './base.js';
import { handleUseItem, isItemUsable } from '../../features/powerUps.js';

const MODAL_ID = 'trophy-room-modal';
const CONTENT_ID = 'trophy-room-content';
const STUDENT_SELECT_ID = 'trophy-room-student-select';

document.addEventListener('clarity-glimmer', (e) => {
    const { studentId, itemIndex } = e.detail || {};
    const content = document.getElementById(CONTENT_ID);
    if (!content) return;
    const stage = content.querySelector(`.trophy-room-stage[data-student-id="${studentId}"]`);
    if (!stage) return;
    const card = stage.querySelector(`.trophy-room-item[data-item-index="${itemIndex}"]`);
    if (card) {
        card.classList.add('clarity-glimmer');
        setTimeout(() => card.classList.remove('clarity-glimmer'), 1500);
    }
});

/**
 * Open the Trophy Room modal. Optionally preselect a student (e.g. from avatar "See full collection").
 * @param {string} [preselectedStudentId] - If provided, this student is selected and their inventory shown.
 */
export function openTrophyRoomModal(preselectedStudentId = null) {
    const league = state.get('globalSelectedLeague');
    const classId = state.get('globalSelectedClassId');
    let leagueResolved = league;
    if (!leagueResolved && classId) {
        const cls = state.get('allSchoolClasses').find(c => c.id === classId) || state.get('allTeachersClasses').find(c => c.id === classId);
        if (cls) leagueResolved = cls.questLevel;
    }

    const myClasses = leagueResolved
        ? state.get('allTeachersClasses').filter(c => c.questLevel === leagueResolved)
        : state.get('allTeachersClasses');
    const myClassIds = myClasses.map(c => c.id);
    const validStudents = state.get('allStudents')
        .filter(s => myClassIds.includes(s.classId))
        .sort((a, b) => a.name.localeCompare(b.name));

    const selectEl = document.getElementById(STUDENT_SELECT_ID);
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">Choose adventurer...</option>' +
        validStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    if (preselectedStudentId && validStudents.some(s => s.id === preselectedStudentId)) {
        selectEl.value = preselectedStudentId;
    } else {
        selectEl.value = '';
    }

    renderTrophyRoomContent(selectEl.value);
    showAnimatedModal(MODAL_ID);
}

/**
 * Render the selected student's name, gold, and full inventory with Use buttons for legendaries.
 * @param {string} studentId
 */
export function renderTrophyRoomContent(studentId) {
    const contentEl = document.getElementById(CONTENT_ID);
    if (!contentEl) return;

    if (!studentId) {
        contentEl.innerHTML = `
            <div class="text-center py-12 text-indigo-300">
                <p class="text-xl font-title">Choose an adventurer to view their Trophy Room.</p>
            </div>`;
        return;
    }

    const student = state.get('allStudents').find(s => s.id === studentId);
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const inventory = scoreData?.inventory || [];
    const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars ?? 0);

    const radiusPercent = 46;
    const avatarHtml = student?.avatar
        ? `<img src="${student.avatar}" alt="" class="trophy-room-avatar">`
        : `<div class="trophy-room-avatar-placeholder">${(student?.name || '?').charAt(0)}</div>`;

    let itemsRingHtml = '';
    if (inventory.length > 0) {
        const n = inventory.length;
        const angleStep = (2 * Math.PI) / n;
        const startAngle = -Math.PI / 2;
        itemsRingHtml = inventory.map((item, index) => {
            const angle = startAngle + index * angleStep;
            const left = 50 + radiusPercent * Math.cos(angle);
            const top = 50 + radiusPercent * Math.sin(angle);
            const usable = isItemUsable(item.name);
            const visualInner = item.image
                ? `<img src="${item.image}" alt="">`
                : (item.icon || '📦');
            const useOrLabel = usable
                ? `<button type="button" class="trophy-room-use-btn trophy-room-item-use" data-student-id="${studentId}" data-item-index="${index}" title="Use this item">Use</button>`
                : '<span class="trophy-room-item-collectible">Collectible</span>';
            return `
                <div class="trophy-room-item" data-item-index="${index}" style="left:${left}%; top:${top}%; transform: translate(-50%, -50%);">
                    <div class="trophy-room-item-visual">${visualInner}</div>
                    <span class="trophy-room-item-name" title="${item.name}">${item.name}</span>
                    ${useOrLabel}
                </div>`;
        }).join('');
    }

    const emptyMsg = inventory.length === 0
        ? '<p class="trophy-room-empty-msg">No treasures yet. Visit the Shop to find artifacts!</p>'
        : '';

    contentEl.innerHTML = `
        <div class="trophy-room-stage" data-student-id="${studentId}">
            <div class="trophy-room-ring-visual" aria-hidden="true"></div>
            <div class="trophy-room-items-ring">${itemsRingHtml}</div>
            <div class="trophy-room-avatar-wrap">
                ${avatarHtml}
                <span class="trophy-room-name">${student?.name || 'Unknown'}</span>
                <span class="trophy-room-gold"><i class="fas fa-coins"></i> ${gold}</span>
                ${emptyMsg}
            </div>
        </div>`;

    // Delegated listener for Use buttons (survives re-renders)
    contentEl.querySelectorAll('.trophy-room-use-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentIdBtn = btn.dataset.studentId;
            const itemIndex = parseInt(btn.dataset.itemIndex, 10);
            if (studentIdBtn == null || isNaN(itemIndex)) return;

            const row = btn.closest('.trophy-room-item');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Using...';
            if (row) row.classList.add('opacity-60');

            try {
                await handleUseItem(studentIdBtn, itemIndex);
                // handleUseItem updates state and removes item; re-render to show updated list
                renderTrophyRoomContent(document.getElementById(STUDENT_SELECT_ID)?.value || studentIdBtn);
            } catch (_) {
                btn.disabled = false;
                btn.textContent = originalText;
                if (row) row.classList.remove('opacity-60');
            }
        });
    });
}
