// /ui/core/avatar.js
// Avatar enlargement: the portrait flies out of the list into the Hero Stage card
// (markup: ui/core/heroStageView.mjs, satchel model: features/trophyRoomCore.mjs).
import * as state from '../../state.js';
import { getLocalMonthKey } from '../../utils.js';
import { currentArtifactFor, handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { renderFamiliarSprite, openFamiliarStatsOverlay } from '../../features/familiars.js';
import { getGuildById } from '../../features/guilds.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle } from '../../features/heroSkillTree.js';
import { buildTrophySatchel, buildActiveEffects, previewTrophySatchel } from '../../features/trophyRoomCore.mjs';
import { canUseFeature } from '../../utils/subscription.js';
import { openSkillTreeModal } from '../modals/skillTree.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';

const TREASURE_PREVIEW = 8;
const loadStageView = () => import('./heroStageView.mjs');

function escHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const FLIGHT_MS = 460;

/**
 * Wraps avatar HTML with the level-up indicator (arrow + glow) when the student has leveled up
 * but not yet been given a skill in the Skill Tree. Use on every tab where the student avatar appears.
 * @param {string} avatarInnerHtml - The img or div for the avatar.
 * @param {boolean} pendingSkillChoice - From scoreData.pendingSkillChoice.
 * @returns {string} HTML string: wrapper + optional arrow + avatar.
 */
export function wrapAvatarWithLevelUpIndicator(avatarInnerHtml, pendingSkillChoice) {
    if (!pendingSkillChoice) return avatarInnerHtml;
    const badge = '<span class="level-up-badge" aria-hidden="true" title="Level up! Assign skill in Skill Tree"><i class="fas fa-arrow-up"></i></span>';
    return `<div class="avatar-with-level-up-wrap">${badge}${avatarInnerHtml}</div>`;
}

// Crystal of Clarity is "used on your card": make the portrait on the open Hero Stage shine.
document.addEventListener('clarity-glimmer', (e) => {
    const { studentId } = e.detail || {};
    const slot = document.querySelector(`.hs-card[data-student-id="${CSS.escape(String(studentId || ''))}"] [data-hs-portrait]`);
    if (!slot) return;
    slot.classList.remove('clarity-glimmer');
    void slot.offsetWidth;
    slot.classList.add('clarity-glimmer');
    setTimeout(() => slot.classList.remove('clarity-glimmer'), 1500);
});

function findClass(classId) {
    if (!classId) return null;
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

/** Everything that changes when a relic is used (stats, effects, satchel). */
function buildStageBody(studentId) {
    const scoreData = (state.get('allStudentScores') || []).find((s) => s.id === studentId) || {};
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId) || {};
    const satchel = buildTrophySatchel(scoreData.inventory, { isUsable: isItemUsable, present: currentArtifactFor });
    return {
        firstName: String(student.name || 'Hero').trim().split(/\s+/)[0] || 'Hero',
        stats: {
            monthlyStars: scoreData.monthlyStars,
            totalStars: scoreData.totalStars,
            gold: getLiveYearGoldFromAppState(scoreData, state),
        },
        effects: buildActiveEffects(scoreData, getLocalMonthKey()),
        preview: previewTrophySatchel(satchel, { treasureLimit: TREASURE_PREVIEW }),
        total: satchel.total,
    };
}

function buildStageView(studentId) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId) || { id: studentId, name: 'Hero' };
    const scoreData = (state.get('allStudentScores') || []).find((s) => s.id === studentId) || {};
    const cls = findClass(student.classId);
    const heroClass = canUseFeature('heroProgression') && student.heroClass ? HERO_CLASSES[student.heroClass] : null;
    const level = Number(scoreData.heroLevel) || 0;
    const guildDef = canUseFeature('guilds') && student.guildId ? getGuildById(student.guildId) : null;
    return {
        student: { id: studentId, name: student.name || 'Hero' },
        classLabel: [cls?.logo, cls?.name].filter(Boolean).join(' '),
        path: heroClass ? { icon: heroClass.icon, title: level > 0 ? getHeroTitle(student.heroClass, level) : student.heroClass, level } : null,
        guild: guildDef ? { name: guildDef.name, emoji: guildDef.emoji, primary: guildDef.primary } : null,
        pendingSkillChoice: !!scoreData.pendingSkillChoice,
        hasFamiliar: !!scoreData.familiar,
        ...buildStageBody(studentId),
    };
}

/** Show a beautiful enlarged detail view of an item (also used from Treasure Vault). */
export function showInventoryItemDetail(itemData) {
    showItemDetail({
        name: itemData.name,
        desc: itemData.desc || itemData.description || '',
        icon: itemData.icon,
        image: itemData.image,
    });
}

/** @internal */
function showItemDetail(itemData) {
    const overlay = document.createElement('div');
    overlay.className = 'item-detail-overlay';

    const visual = itemData.image
        ? `<div class="item-detail-visual"><img src="${escHtml(itemData.image)}" alt=""></div>`
        : `<div class="item-detail-visual">${escHtml(itemData.icon || '📦')}</div>`;

    overlay.innerHTML = `
        <div class="item-detail-card">
            ${visual}
            <h2 class="item-detail-name">${escHtml(itemData.name)}</h2>
            <p class="item-detail-description">${escHtml(itemData.desc)}</p>
            <p class="item-detail-close-hint">Tap anywhere to close</p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    const closeDetail = () => {
        overlay.classList.remove('active');
        window.removeEventListener('keydown', onKey, true);
        setTimeout(() => overlay.remove(), 300);
    };
    const onKey = (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        closeDetail();
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetail();
    });
}

/** Hero stats = the class roster's hero view (virtues, latest stars, boons, Scholar's Scroll). */
async function openHeroView(studentId) {
    const { openRosterHeroView } = await import('../../features/home.js');
    if (openRosterHeroView(studentId)) return;
    const { showToast } = await import('../effects.js');
    showToast("This hero's class could not be found.", 'error');
}

function placeFixed(el, rect) {
    el.style.position = 'fixed';
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
}

// --- AVATAR ENLARGEMENT (Hero Stage) ---
export function handleAvatarClick(e) {
    if (e.target.closest('.familiar-stats-overlay')) return;
    // Familiar tap — show stats overlay
    const familiarEl = e.target.closest('.enlargeable-familiar');
    if (familiarEl) {
        e.stopPropagation();
        const studentId = familiarEl.dataset.studentId;
        if (studentId) openFamiliarStatsOverlay(studentId);
        return;
    }

    // Clicks inside an open stage are handled by the stage itself.
    if (e.target.closest('.enlarged-avatar-container')) return;

    const avatar = e.target.closest('.enlargeable-avatar');

    // Close existing if open
    const existingEnlarged = document.querySelector('.enlarged-avatar-container:not(.is-closing)');
    if (existingEnlarged) existingEnlarged.click();

    if (!avatar) return;
    e.stopPropagation();

    let studentId = null;
    const card = avatar.closest('[data-studentid], [data-id], .student-leaderboard-card');
    if (card) studentId = card.dataset.studentid || card.dataset.id;
    if (!studentId && avatar.dataset.studentId) studentId = avatar.dataset.studentId;
    if (studentId && !(state.get('allStudents') || []).some((s) => s.id === studentId)) studentId = null;

    openHeroStage(avatar, studentId).catch((err) => console.error('Hero Stage failed to open:', err));
}

async function openHeroStage(avatar, studentId) {
    const { renderHeroStageHtml, renderHeroStageBodyHtml } = await loadStageView();
    // A quick double tap could land here twice while the markup module loads.
    if (document.querySelector('.enlarged-avatar-container:not(.is-closing)') || !avatar.isConnected) return;
    const rect = avatar.getBoundingClientRect();
    const isImageAvatar = avatar.tagName === 'IMG';
    const scoreData = studentId ? (state.get('allStudentScores') || []).find((sc) => sc.id === studentId) : null;
    const pendingSkillChoice = !!scoreData?.pendingSkillChoice;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const returnFocusTo = document.activeElement;

    const container = document.createElement('div');
    container.className = `enlarged-avatar-container hero-stage${studentId ? '' : ' hero-stage--portrait-only'}`;
    container.innerHTML = studentId
        ? renderHeroStageHtml(buildStageView(studentId))
        : '<div class="hs-card hs-card--bare" role="dialog" aria-modal="true" aria-label="Portrait"><div class="hs-portrait-slot" data-hs-portrait><span class="hs-aura" aria-hidden="true"></span></div></div>';

    const stageCard = container.querySelector('.hs-card');
    const slot = container.querySelector('[data-hs-portrait]');

    // --- The flying portrait (clone of the tapped avatar) ---
    const clone = avatar.cloneNode(true);
    clone.classList.remove('enlargeable-avatar');
    clone.classList.add('enlarged-avatar-image');
    clone.removeAttribute('id');
    clone.removeAttribute('tabindex');
    clone.setAttribute('aria-hidden', 'true');
    // List avatars carry layout utilities (margins, translate, max sizes) that must not follow them.
    Object.assign(clone.style, { transform: 'none', margin: '0', maxWidth: 'none', maxHeight: 'none', animation: 'none' });
    if (isImageAvatar) {
        clone.style.objectFit = 'cover';
    } else {
        clone.style.display = 'flex';
        clone.style.alignItems = 'center';
        clone.style.justifyContent = 'center';
        clone.style.lineHeight = '1';
        clone.style.overflow = 'hidden';
    }
    const setGlyphSize = (width) => {
        if (!isImageAvatar) clone.style.fontSize = `${Math.max(width * 0.42, 24)}px`;
    };

    let flyer = clone;
    if (pendingSkillChoice) {
        const wrap = document.createElement('div');
        wrap.className = 'enlarged-avatar-level-up-wrap';
        clone.style.position = 'absolute';
        clone.style.inset = '0';
        clone.style.width = '100%';
        clone.style.height = '100%';
        wrap.appendChild(clone);
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'level-up-badge level-up-badge--enlarged';
        badge.dataset.hsAction = 'skills';
        badge.title = 'Level up! Open the Skill Tree';
        badge.setAttribute('aria-label', 'Level up! Open the Skill Tree');
        badge.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
        wrap.appendChild(badge);
        flyer = wrap;
    }
    flyer.classList.add('hs-flyer');
    placeFixed(flyer, rect);
    setGlyphSize(rect.width);
    container.appendChild(flyer);

    // Familiar sprite (rendered by the familiar module) inside its companion bubble
    const familiarBtn = container.querySelector('.hs-familiar');
    if (familiarBtn && scoreData?.familiar) {
        familiarBtn.innerHTML = renderFamiliarSprite(scoreData.familiar, 'small', studentId);
    }

    document.body.appendChild(container);

    // Where the portrait lands. Offsets ignore the card's entrance transform, so this is its final pose.
    const target = {
        left: stageCard.offsetLeft + stageCard.clientLeft + slot.offsetLeft,
        top: stageCard.offsetTop + stageCard.clientTop + slot.offsetTop,
        width: slot.offsetWidth,
        height: slot.offsetHeight,
    };

    let docked = false;
    let closed = false;
    const dock = () => {
        if (docked || closed) return;
        docked = true;
        flyer.classList.add('is-docked');
        ['position', 'top', 'left', 'width', 'height'].forEach((p) => { flyer.style[p] = ''; });
        setGlyphSize(slot.clientWidth || target.width);
        slot.appendChild(flyer);
    };

    requestAnimationFrame(() => {
        container.classList.add('active');
        placeFixed(flyer, target);
        setGlyphSize(target.width);
        setTimeout(dock, reduceMotion ? 20 : FLIGHT_MS);
        (container.querySelector('.hs-close') || stageCard)?.focus?.({ preventScroll: true });
    });

    const close = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener('keydown', onKey, true);
        if (docked) {
            // Lift the portrait out of the card so it can fly home.
            // `is-docked` has no transition, so the jump back to fixed coordinates is instant.
            const from = slot.getBoundingClientRect();
            placeFixed(flyer, from);
            container.appendChild(flyer);
            void flyer.offsetWidth;
            flyer.classList.remove('is-docked');
            void flyer.offsetWidth;
        }
        const home = avatar.isConnected ? avatar.getBoundingClientRect() : null;
        container.classList.remove('active');
        container.classList.add('is-closing');
        if (home && home.width > 0) {
            placeFixed(flyer, home);
            setGlyphSize(home.width);
        } else {
            flyer.style.opacity = '0';
        }
        setTimeout(() => container.remove(), reduceMotion ? 20 : 340);
        if (returnFocusTo?.isConnected && typeof returnFocusTo.focus === 'function') {
            returnFocusTo.focus({ preventScroll: true });
        }
    };
    const closeThen = (fn) => { close(); fn(); };

    const onKey = (e) => {
        if (e.key !== 'Escape' || document.querySelector('.item-detail-overlay')) return;
        e.stopPropagation();
        close();
    };
    window.addEventListener('keydown', onKey, true);

    container.addEventListener('click', async (e) => {
        // Programmatic .click() on the container (another avatar opened) or a backdrop tap closes.
        if (e.target === container || !e.target.closest('.hs-card, .hs-flyer')) {
            close();
            return;
        }

        const actionEl = e.target.closest('[data-hs-action]');
        if (actionEl) {
            const action = actionEl.dataset.hsAction;
            if (action === 'close') close();
            else if (!studentId) return;
            else if (action === 'vault') closeThen(() => import('../modals.js').then((m) => m.openTrophyRoomModal(studentId)));
            else if (action === 'stats') closeThen(() => openHeroView(studentId));
            else if (action === 'skills') closeThen(() => openSkillTreeModal(studentId));
            else if (action === 'familiar') closeThen(() => openFamiliarStatsOverlay(studentId));
            return;
        }

        const useBtn = e.target.closest('[data-hs-use]');
        if (useBtn && !useBtn.disabled && studentId) {
            const itemIndex = parseInt(useBtn.dataset.hsUse, 10);
            if (Number.isNaN(itemIndex)) return;
            useBtn.disabled = true;
            useBtn.classList.add('is-busy');
            useBtn.querySelector('span').textContent = 'Using…';
            try {
                await handleUseItem(studentId, itemIndex);
                const body = container.querySelector('[data-hs-body]');
                if (body && !closed) body.innerHTML = renderHeroStageBodyHtml(buildStageBody(studentId));
            } catch (_) {
                useBtn.disabled = false;
                useBtn.classList.remove('is-busy');
                useBtn.querySelector('span').textContent = 'Use';
            }
            return;
        }

        const zoomEl = e.target.closest('[data-hs-zoom]');
        if (zoomEl && studentId) {
            const score = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
            const item = score?.inventory?.[parseInt(zoomEl.dataset.hsZoom, 10)];
            if (item) showInventoryItemDetail(item);
        }
    });
}
