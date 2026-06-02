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
            <h3 class="inventory-title text-3xl mb-1">${student?.name || 'Unknown'}'s Collection</h3>
            <div class="inventory-gold-pill mb-4"><i class="fas fa-coins text-amber-400"></i> ${gold} Gold</div>
            <div class="avatar-inventory-items flex flex-wrap justify-center gap-6 mt-4">
                <p class="text-white/40 text-sm italic font-medium">No artifacts collected yet.</p>
            </div>
            <p class="mt-8"><button type="button" class="open-trophy-room-link text-amber-400 hover:text-amber-300 font-bold transition-all text-sm uppercase tracking-wider" data-student-id="${studentId}">Open Full Vault <i class="fas fa-chevron-right ml-1"></i></button></p>`;
    }

    const itemsHtml = inventory.map((item, index) => {
        let visual = '';
        if (item.image) {
            visual = `<div class="avatar-inventory-item-visual"><img src="${item.image}" alt="${item.name}"></div>`;
        } else {
            const icon = item.icon || '📦';
            visual = `<div class="avatar-inventory-item-visual"><div class="item-icon">${icon}</div></div>`;
        }
        const useBtn = isItemUsable(item.name)
            ? `<button type="button" class="avatar-inventory-use-btn" data-item-index="${index}">Use</button>`
            : '';
        
        return `
            <div class="avatar-inventory-item group" 
                 data-item-name="${item.name.replace(/"/g, '&quot;')}" 
                 data-item-desc="${item.description.replace(/"/g, '&quot;')}" 
                 data-item-icon="${item.icon || ''}" 
                 data-item-image="${item.image || ''}">
                ${visual}
                ${useBtn}
            </div>`;
    }).join('');

    return `
        <h3 class="inventory-title text-3xl mb-1">${student?.name || 'Unknown'}'s Collection</h3>
        <div class="inventory-gold-pill mb-4"><i class="fas fa-coins text-amber-400"></i> ${gold} Gold</div>
        <div class="avatar-inventory-items flex flex-wrap justify-center gap-6 mt-4">
            ${itemsHtml}
        </div>
        <p class="mt-8"><button type="button" class="open-trophy-room-link text-amber-400 hover:text-amber-300 font-bold transition-all text-sm uppercase tracking-wider" data-student-id="${studentId}">Open Full Vault <i class="fas fa-chevron-right ml-1"></i></button></p>`;
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
        ? `<div class="item-detail-visual"><img src="${itemData.image}" alt="${itemData.name}"></div>`
        : `<div class="item-detail-visual">${itemData.icon || '📦'}</div>`;

    overlay.innerHTML = `
        <div class="item-detail-card">
            ${visual}
            <h2 class="item-detail-name">${itemData.name}</h2>
            <p class="item-detail-description">${itemData.desc}</p>
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
        setTimeout(() => overlay.remove(), 300);
    };

    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetail();
    });
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

    // Don't re-trigger if we are clicking anything inside an already enlarged container
    // This prevents the "flash" bug when clicking the enlarged avatar itself.
    if (e.target.closest('.enlarged-avatar-container')) return;

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
            familiarHtml = `<div class="enlargeable-familiar familiar-enlarged-companion absolute top-[126px] left-[calc(50%+62px)] z-[103]" data-student-id="${studentId}">${spriteHtml}</div>`;
        }

        // INVENTORY UI
        let inventoryHtml = '';
        if (studentId) {
            inventoryHtml = `
                <div class="inventory-container max-w-2xl w-full mx-4 text-center mt-[320px] z-101 opacity-0" data-student-id="${studentId}">
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
                e.stopPropagation(); // Prevent closing the avatar view when clicking inside the inventory
                
                // Handle "Open Full Vault" link
                const link = e.target.closest('.open-trophy-room-link');
                if (link) {
                    const sid = invContainer.dataset.studentId;
                    if (sid) {
                        closeHandler();
                        import('../modals.js').then(m => m.openTrophyRoomModal(sid));
                    }
                    return;
                }

                // Handle "Use" button
                const btn = e.target.closest('.avatar-inventory-use-btn');
                if (btn && !btn.disabled) {
                    e.stopPropagation(); // Don't enlarge if using
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
                    return;
                }

                // Handle Item Enlarge
                const itemEl = e.target.closest('.avatar-inventory-item');
                if (itemEl) {
                    e.stopPropagation();
                    showItemDetail({
                        name: itemEl.dataset.itemName,
                        desc: itemEl.dataset.itemDesc,
                        icon: itemEl.dataset.itemIcon,
                        image: itemEl.dataset.itemImage
                    });
                    return;
                }
            });
        }

        // Create and append the premium skill tree button if student has a valid ID
        if (studentId) {
            const skillTreeBtn = document.createElement('button');
            skillTreeBtn.className = 'enlarged-avatar-skill-tree-btn';
            skillTreeBtn.type = 'button';
            skillTreeBtn.innerHTML = '<i class="fas fa-sitemap"></i>';
            skillTreeBtn.title = 'Open Skill Tree';
            skillTreeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeHandler();
                openSkillTreeModal(studentId);
            });
            container.appendChild(skillTreeBtn);
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
            container.classList.add('active');
            
            const inv = container.querySelector('.inventory-container');
        });

        const closeHandler = () => {
            container.classList.remove('active');
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
