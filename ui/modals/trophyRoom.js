// /ui/modals/trophyRoom.js — Trophy Room (Treasure Vault) modal
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import { showAnimatedModal } from './base.js';
import { handleUseItem, isItemUsable } from '../../features/powerUps.js';

const MODAL_ID = 'trophy-room-modal';
const CONTENT_ID = 'trophy-room-content';
const STUDENT_SELECT_ID = 'trophy-room-student-select';
const trophyRoomFeedback = new Map();

document.addEventListener('clarity-glimmer', (e) => {
    const { studentId, itemIndex } = e.detail || {};
    const content = document.getElementById(CONTENT_ID);
    if (!content) return;
    const room = content.querySelector(`.trophy-room-shell[data-student-id="${studentId}"]`);
    if (!room) return;
    const card = room.querySelector(`.trophy-room-item[data-item-index="${itemIndex}"]`);
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
            <div class="trophy-room-empty-shell text-center py-12 text-indigo-300">
                <p class="text-xl font-title">Choose an adventurer to open their inventory vault.</p>
            </div>`;
        return;
    }

    const student = state.get('allStudents').find(s => s.id === studentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student?.classId)
        || state.get('allTeachersClasses').find(c => c.id === student?.classId);
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const inventory = scoreData?.inventory || [];
    const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars ?? 0);
    const usableCount = inventory.filter(item => isItemUsable(item.name)).length;
    const collectibleCount = inventory.length - usableCount;
    const featuredItem = inventory.find(item => isItemUsable(item.name)) || inventory[0] || null;
    const avatarHtml = student?.avatar
        ? `<img src="${student.avatar}" alt="" class="trophy-room-avatar">`
        : `<div class="trophy-room-avatar-placeholder">${(student?.name || '?').charAt(0)}</div>`;
    const feedback = trophyRoomFeedback.get(studentId) || null;

    const activeEffects = [];
    if (scoreData?.hasGildedEffect) {
        activeEffects.push({ icon: '✨', title: 'Gilded Star Ready', body: 'The next star will pay triple Gold.' });
    }
    if (scoreData?.luckDate) {
        activeEffects.push({ icon: '🍀', title: 'Luck Stored', body: `Ready for the next lesson on ${scoreData.luckDate}.` });
    }
    if (scoreData?.starfallCatalystActive) {
        activeEffects.push({ icon: '📜', title: 'Starfall Catalyst', body: 'The next high-score bonus will be doubled.' });
    }
    if (scoreData?.pendingHeroStatus) {
        activeEffects.push({ icon: '🎭', title: 'Protagonist Mask', body: 'The next Story Log will feature this student as the hero.' });
    }

    const activeEffectsHtml = activeEffects.length > 0
        ? `
            <div class="mt-5">
                <p class="trophy-room-panel-kicker mb-2">Active Effects</p>
                <div class="flex flex-wrap gap-2">
                    ${activeEffects.map((effect) => `
                        <div class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-left">
                            <div class="text-xs font-black uppercase tracking-wide text-emerald-200">${effect.icon} ${effect.title}</div>
                            <div class="text-xs text-indigo-100 mt-1">${effect.body}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
        : `
            <div class="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-indigo-200">
                No active relic effects right now. Use an item to arm the next magical bonus.
            </div>
        `;

    const featuredHtml = featuredItem
        ? (() => {
            const featuredUsable = isItemUsable(featuredItem.name);
            const featuredVisual = featuredItem.image
                ? `<img src="${featuredItem.image}" alt="">`
                : (featuredItem.icon || '📦');
            return `
                <div class="trophy-room-featured-card">
                    <div class="trophy-room-featured-header">
                        <span class="trophy-room-featured-label">${featuredUsable ? 'Ready Relic' : 'Featured Treasure'}</span>
                        <span class="trophy-room-featured-rarity">${featuredItem.id?.startsWith('leg_') ? 'Legendary' : 'Vault Item'}</span>
                    </div>
                    <div class="trophy-room-featured-body">
                        <div class="trophy-room-featured-visual">${featuredVisual}</div>
                        <div class="trophy-room-featured-copy">
                            <h3>${featuredItem.name}</h3>
                            <p>${featuredItem.description || 'A prized item carried back from the quest.'}</p>
                        </div>
                    </div>
                </div>
            `;
        })()
        : `
            <div class="trophy-room-featured-card trophy-room-featured-card-empty">
                <div class="trophy-room-featured-header">
                    <span class="trophy-room-featured-label">Featured Slot</span>
                    <span class="trophy-room-featured-rarity">Empty</span>
                </div>
                <div class="trophy-room-featured-body">
                    <div class="trophy-room-featured-visual">✨</div>
                    <div class="trophy-room-featured-copy">
                        <h3>Awaiting the next relic</h3>
                        <p>Visit the Mystic Market and keep earning rewards to stock this vault.</p>
                    </div>
                </div>
            </div>
        `;

    const inventoryHtml = inventory.length > 0
        ? inventory.map((item, index) => {
            const usable = isItemUsable(item.name);
            const visualInner = item.image
                ? `<img src="${item.image}" alt="">`
                : (item.icon || '📦');
            const useOrLabel = usable
                ? `<button type="button" class="trophy-room-use-btn trophy-room-item-use" data-student-id="${studentId}" data-item-index="${index}" title="Use this item">Use Item</button>`
                : '<span class="trophy-room-item-collectible">Collectible</span>';
            return `
                <div class="trophy-room-item ${usable ? 'trophy-room-item-usable' : ''}" data-item-index="${index}">
                    <div class="trophy-room-item-topline">
                        <span class="trophy-room-item-slot">Slot ${String(index + 1).padStart(2, '0')}</span>
                        <span class="trophy-room-item-kind">${usable ? 'Active' : 'Vault'}</span>
                    </div>
                    <div class="trophy-room-item-visual">${visualInner}</div>
                    <span class="trophy-room-item-name" title="${item.name}">${item.name}</span>
                    <p class="trophy-room-item-description">${item.description || 'A treasured item collected during the quest.'}</p>
                    ${useOrLabel}
                </div>`;
        }).join('')
        : `
            <div class="trophy-room-empty-state">
                <div class="trophy-room-empty-icon">🧰</div>
                <h3>No treasures stored yet</h3>
                <p>Visit the Mystic Market to start building this adventurer's collection.</p>
            </div>
        `;

    contentEl.innerHTML = `
        <div class="trophy-room-shell" data-student-id="${studentId}">
            <section class="trophy-room-hero-panel">
                <div class="trophy-room-panel-kicker">Adventurer Profile</div>
                ${feedback ? `
                    <div class="mb-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-left">
                        <div class="text-xs font-black uppercase tracking-wide text-amber-200">${feedback.icon || '✨'} ${feedback.title || 'Relic Activated'}</div>
                        <div class="text-sm text-indigo-100 mt-1">${feedback.body || ''}</div>
                    </div>
                ` : ''}
                ${featuredHtml}
                <div class="trophy-room-avatar-stage">
                    <div class="trophy-room-avatar-aura" aria-hidden="true"></div>
                    <div class="trophy-room-avatar-wrap">
                        ${avatarHtml}
                    </div>
                </div>
                <div class="trophy-room-hero-meta">
                    <span class="trophy-room-name">${student?.name || 'Unknown'}</span>
                    <span class="trophy-room-class-line">${studentClass?.logo || '📚'} ${studentClass?.name || 'Unassigned Class'}${studentClass?.questLevel ? ` • ${studentClass.questLevel}` : ''}</span>
                    <div class="trophy-room-stat-row">
                        <span class="trophy-room-gold"><i class="fas fa-coins"></i> ${gold} Gold</span>
                        <span class="trophy-room-stat-pill"><i class="fas fa-backpack"></i> ${inventory.length} Items</span>
                        <span class="trophy-room-stat-pill"><i class="fas fa-bolt"></i> ${usableCount} Active</span>
                        <span class="trophy-room-stat-pill"><i class="fas fa-gem"></i> ${collectibleCount} Collectibles</span>
                    </div>
                    ${activeEffectsHtml}
                </div>
            </section>
            <section class="trophy-room-inventory-panel">
                <div class="trophy-room-inventory-header">
                    <div>
                        <p class="trophy-room-panel-kicker">Inventory Grid</p>
                        <h3 class="trophy-room-inventory-title">Quest Backpack</h3>
                    </div>
                    <p class="trophy-room-inventory-subtitle">${inventory.length > 0 ? 'Use active relics directly from this vault.' : 'The backpack is currently empty.'}</p>
                </div>
                <div class="trophy-room-inventory-grid">
                    ${inventoryHtml}
                </div>
            </section>
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
                const result = await handleUseItem(studentIdBtn, itemIndex);
                if (result?.success && result.feedback) {
                    trophyRoomFeedback.set(studentIdBtn, result.feedback);
                }
                renderTrophyRoomContent(document.getElementById(STUDENT_SELECT_ID)?.value || studentIdBtn);
            } catch (_) {
                btn.disabled = false;
                btn.textContent = originalText;
                if (row) row.classList.remove('opacity-60');
            }
        });
    });
}
