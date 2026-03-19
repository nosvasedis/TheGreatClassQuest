// /ui/core/avatar.js
import * as state from '../../state.js';
import { handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { renderFamiliarSprite, openFamiliarStatsOverlay } from '../../features/familiars.js';
import { openSkillTreeModal } from '../modals/skillTree.js';

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

document.addEventListener('clarity-glimmer', (e) => {
    const { studentId, itemIndex } = e.detail || {};
    const container = document.querySelector(`.inventory-container[data-student-id="${studentId}"]`);
    if (!container) return;
    const btn = container.querySelector(`.avatar-inventory-use-btn[data-item-index="${itemIndex}"]`);
    const card = btn?.closest('.avatar-inventory-item');
    if (card) {
        card.classList.add('clarity-glimmer');
        setTimeout(() => card.classList.remove('clarity-glimmer'), 1500);
    }
});

/** Build the inner HTML for the inventory section (title, gold, items grid). Used for initial render and after Use. */
function buildInventoryInnerHtml(studentId) {
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const inventory = scoreData?.inventory || [];
    const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
    const student = state.get('allStudents').find(s => s.id === studentId);

    if (inventory.length === 0) {
    return `
        <h3 class="font-title text-3xl text-white mb-1">${student?.name || 'Unknown'}'s Collection</h3>
        <p class="text-amber-400 font-bold mb-4">${gold} Gold Coins</p>
        <div class="avatar-inventory-items flex flex-wrap justify-center gap-4">
            <p class="text-white/50 text-sm italic">No artifacts collected yet.</p>
        </div>
        <p class="mt-4"><button type="button" class="open-trophy-room-link text-amber-400 hover:text-amber-300 underline text-sm" data-student-id="${studentId}">See full collection →</button></p>`;
}

    const itemsHtml = inventory.map((item, index) => {
        let visual = '';
        if (item.image) {
            visual = `<img src="${item.image}" class="w-16 h-16 rounded-lg border-2 border-amber-400 bg-black/50 shadow-lg transform group-hover:scale-110 transition-transform object-cover">`;
        } else {
            const icon = item.icon || '📦';
            visual = `<div class="w-16 h-16 rounded-lg border-2 border-amber-400 bg-indigo-900/80 shadow-lg transform group-hover:scale-110 transition-transform flex items-center justify-center text-3xl">${icon}</div>`;
        }
        const useBtn = isItemUsable(item.name)
            ? `<button type="button" class="avatar-inventory-use-btn mt-1 bg-amber-500 hover:bg-amber-600 text-amber-900 font-bold text-xs py-1 px-2 rounded transition-all disabled:opacity-50" data-item-index="${index}">Use</button>`
            : '';
        return `
            <div class="avatar-inventory-item relative group cursor-help flex flex-col items-center">
                ${visual}
                ${useBtn}
                <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/90 text-white text-xs p-2 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                    <strong class="text-amber-400 block mb-1">${item.name}</strong>
                    ${item.description}
                </div>
            </div>`;
    }).join('');

    return `
        <h3 class="font-title text-3xl text-white mb-1">${student?.name || 'Unknown'}'s Collection</h3>
        <p class="text-amber-400 font-bold mb-4">${gold} Gold Coins</p>
        <div class="avatar-inventory-items flex flex-wrap justify-center gap-4">
            ${itemsHtml}
        </div>
        <p class="mt-4"><button type="button" class="open-trophy-room-link text-amber-400 hover:text-amber-300 underline text-sm" data-student-id="${studentId}">See full collection →</button></p>`;
}

// --- AVATAR ENLARGEMENT ---
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

    const avatar = e.target.closest('.enlargeable-avatar');
    // Prevent closing if clicking the inventory itself
    if (e.target.closest('.inventory-container')) return; 
    
    // Close existing if open
    const existingEnlarged = document.querySelector('.enlarged-avatar-container');
    if (existingEnlarged) {
        existingEnlarged.click(); // Trigger close
    }

    if (avatar) {
        e.stopPropagation(); 
        
        // Find student data
        let studentId = null;
        // Try to find ID from parent elements
        const card = avatar.closest('[data-studentid], [data-id], .student-leaderboard-card');
        if (card) {
            studentId = card.dataset.studentid || card.dataset.id;
            // For leaderboard cards, finding ID is tricky if not set explicitly. 
            // Better to rely on the `img` dataset if we added it (we did in tabs.js: data-student-id)
        }
        if (!studentId && avatar.dataset.studentId) studentId = avatar.dataset.studentId;

        const rect = avatar.getBoundingClientRect();
        const isImageAvatar = avatar.tagName === 'IMG';
        const scoreData = studentId ? state.get('allStudentScores').find(sc => sc.id === studentId) : null;
        const pendingSkillChoice = !!scoreData?.pendingSkillChoice;

        const container = document.createElement('div');
        container.className = 'enlarged-avatar-container';
        
        // Wrapper for Layout
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'flex flex-col items-center gap-6 transform transition-all duration-300';
        contentWrapper.style.opacity = '0';
        
        const clone = avatar.cloneNode(true);
        clone.classList.add('enlarged-avatar-image');
        // Initial pos matches original
        clone.style.position = 'fixed'; // Initially fixed for animation
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.zIndex = '102';
        if (!isImageAvatar) {
            clone.style.display = 'flex';
            clone.style.alignItems = 'center';
            clone.style.justifyContent = 'center';
            clone.style.fontSize = `${Math.max(rect.width * 0.42, 24)}px`;
            clone.style.lineHeight = '1';
            clone.style.overflow = 'hidden';
        }
        
        let animatedEl = clone;
        if (pendingSkillChoice) {
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'enlarged-avatar-level-up-wrap';
            avatarWrap.style.position = 'fixed';
            avatarWrap.style.top = `${rect.top}px`;
            avatarWrap.style.left = `${rect.left}px`;
            avatarWrap.style.width = `${rect.width}px`;
            avatarWrap.style.height = `${rect.height}px`;
            avatarWrap.style.zIndex = '102';
            // Add clone first (as background), then badge on top
            clone.style.position = 'absolute';
            clone.style.top = '0';
            clone.style.left = '0';
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.borderRadius = '9999px';
            if (isImageAvatar) {
                clone.style.objectFit = 'cover';
            }
            avatarWrap.appendChild(clone);
            const badge = document.createElement('span');
            badge.className = 'level-up-badge level-up-badge--enlarged';
            badge.setAttribute('aria-hidden', 'true');
            badge.title = 'Level up! Click to open Skill Tree';
            badge.innerHTML = '<i class="fas fa-arrow-up"></i>';
            // Click badge to open skill tree
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                if (studentId) {
                    closeHandler();
                    openSkillTreeModal(studentId);
                }
            });
            avatarWrap.appendChild(badge);
            container.appendChild(avatarWrap);
            animatedEl = avatarWrap;
        } else {
            container.appendChild(clone);
        }
        
        // FAMILIAR companion display
        let familiarHtml = '';
        if (studentId && scoreData?.familiar) {
            const spriteHtml = renderFamiliarSprite(scoreData.familiar, 'small', studentId);
            familiarHtml = `<div class="enlargeable-familiar familiar-enlarged-companion mt-[-20px] z-[103]" data-student-id="${studentId}">${spriteHtml}</div>`;
        }

        // INVENTORY UI
        let inventoryHtml = '';
        if (studentId) {
            inventoryHtml = `
                <div class="inventory-container bg-indigo-950/90 backdrop-blur-md p-6 rounded-3xl border-2 border-indigo-500 shadow-2xl max-w-2xl w-full mx-4 text-center mt-[300px] z-101 opacity-0 transition-opacity duration-500 delay-100" data-student-id="${studentId}">
                    ${buildInventoryInnerHtml(studentId)}
                </div>
            `;
        }

        if (familiarHtml) container.insertAdjacentHTML('beforeend', familiarHtml);
        container.insertAdjacentHTML('beforeend', inventoryHtml);
        document.body.appendChild(container);

        const invContainer = container.querySelector('.inventory-container');
        if (invContainer && studentId) {
            invContainer.addEventListener('click', async (e) => {
                const link = e.target.closest('.open-trophy-room-link');
                if (link) {
                    const sid = invContainer.dataset.studentId;
                    if (sid) {
                        closeHandler();
                        import('../modals.js').then(m => m.openTrophyRoomModal(sid));
                    }
                    return;
                }
                const btn = e.target.closest('.avatar-inventory-use-btn');
                if (!btn || btn.disabled) return;
                const sid = invContainer.dataset.studentId;
                const itemIndex = parseInt(btn.dataset.itemIndex, 10);
                if (!sid || isNaN(itemIndex)) return;
                btn.disabled = true;
                btn.textContent = 'Using...';
                try {
                    await handleUseItem(sid, itemIndex);
                    invContainer.innerHTML = buildInventoryInnerHtml(sid);
                } catch (_) {
                    btn.disabled = false;
                    btn.textContent = 'Use';
                }
            });
        }

        // Animate
        requestAnimationFrame(() => {
            // Move image (or wrapper) to center
            animatedEl.style.top = `20%`;
            animatedEl.style.left = `50%`;
            animatedEl.style.width = `200px`;
            animatedEl.style.height = `200px`;
            animatedEl.style.transform = 'translate(-50%, -50%)';
            if (!isImageAvatar) {
                clone.style.fontSize = '6rem';
            }
            container.style.opacity = '1';
            
            const inv = container.querySelector('.inventory-container');
            if(inv) inv.style.opacity = '1';
        });

        const closeHandler = () => {
            animatedEl.style.top = `${rect.top}px`;
            animatedEl.style.left = `${rect.left}px`;
            animatedEl.style.width = `${rect.width}px`;
            animatedEl.style.height = `${rect.height}px`;
            animatedEl.style.transform = 'translate(0, 0)';
            if (!isImageAvatar) {
                clone.style.fontSize = `${Math.max(rect.width * 0.42, 24)}px`;
            }
            container.style.opacity = '0';
            container.removeEventListener('click', closeHandler);
            setTimeout(() => container.remove(), 300);
        };
        container.addEventListener('click', closeHandler);
    }
}
