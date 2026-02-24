// /ui/modals/skillTree.js — Skill Tree modal: render, open, choose skill
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import { showAnimatedModal, hideModal } from '../modals.js';
import { playSound } from '../../audio.js';
import {
    HERO_SKILL_TREE,
    getHeroTitle,
    computeHeroLevel,
    starsToNextLevel,
    getActiveSkills,
    getReasonDisplayName
} from '../../features/heroSkillTree.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { db, doc, updateDoc } from '../../firebase.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

// ─── OPEN ─────────────────────────────────────────────────────────────────────

export function openSkillTreeModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    if (!student || !scoreData) {
        showToast('Student data not found.', 'error');
        return;
    }

    const heroClass = student.heroClass;
    const tree = heroClass ? HERO_SKILL_TREE[heroClass] : null;
    const classInfo = heroClass ? HERO_CLASSES[heroClass] : null;

    const panel = document.getElementById('skill-tree-modal-panel');
    const header = document.getElementById('skill-tree-modal-header');

    // Apply class theme
    if (tree) {
        panel.style.background = `linear-gradient(160deg, ${tree.auraColor}22 0%, #1e1b4b 40%, #0f0e1a 100%)`;
        panel.style.border = `2px solid ${tree.auraColor}55`;
        header.style.background = `linear-gradient(90deg, ${tree.auraColor}33 0%, transparent 100%)`;
        document.getElementById('skill-tree-progress-bar').style.background = tree.auraColor;
    } else {
        panel.style.background = 'linear-gradient(160deg, #1e1b4b 0%, #0f0e1a 100%)';
        panel.style.border = '2px solid #4f46e530';
        header.style.background = '';
        document.getElementById('skill-tree-progress-bar').style.background = '#6366f1';
    }

    // Header info
    document.getElementById('skill-tree-class-icon').textContent = classInfo?.icon || '⭐';
    document.getElementById('skill-tree-modal-title').textContent = heroClass || 'No Class Chosen';
    document.getElementById('skill-tree-student-name').textContent = student.name;

    _renderTree(student, scoreData, heroClass, tree);
    showAnimatedModal('skill-tree-modal');
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function _renderTree(student, scoreData, heroClass, tree) {
    const heroSkills = scoreData.heroSkills || [];
    const starsByReason = scoreData.starsByReason || {};
    const reason = tree?.reason || null;
    const starsInReason = reason ? (starsByReason[reason] || 0) : 0;
    const currentLevel = scoreData.heroLevel || 0;
    const pendingChoice = scoreData.pendingSkillChoice || false;
    const maxLevel = tree?.levels?.length || 0;

    // Progress bar
    const levelLabel = document.getElementById('skill-tree-level-label');
    const progressText = document.getElementById('skill-tree-progress-text');
    const progressBar = document.getElementById('skill-tree-progress-bar');

    if (tree && currentLevel < maxLevel) {
        const nextThreshold = tree.levels[currentLevel]?.threshold || 200;
        const prevThreshold = currentLevel > 0 ? tree.levels[currentLevel - 1].threshold : 0;
        const segmentTotal = nextThreshold - prevThreshold;
        const segmentDone = starsInReason - prevThreshold;
        const pct = Math.min(100, Math.max(0, Math.round((segmentDone / segmentTotal) * 100)));
        progressBar.style.width = pct + '%';
        levelLabel.textContent = currentLevel > 0 ? `${getHeroTitle(heroClass, currentLevel)} — Level ${currentLevel}` : 'No level yet';
        const needed = starsToNextLevel(heroClass, currentLevel, starsInReason);
        const reasonLabel = getReasonDisplayName(reason);
        progressText.textContent = `${starsInReason} ${reasonLabel} stars · ${needed} to Level ${currentLevel + 1}`;
    } else if (tree && currentLevel >= maxLevel) {
        progressBar.style.width = '100%';
        levelLabel.textContent = `${getHeroTitle(heroClass, maxLevel)} — MAX LEVEL`;
        progressText.textContent = `${starsInReason} ${getReasonDisplayName(reason)} stars — Legendary!`;
    } else {
        progressBar.style.width = '0%';
        levelLabel.textContent = 'No class chosen';
        progressText.textContent = '';
    }

    const content = document.getElementById('skill-tree-content');

    if (!tree) {
        content.innerHTML = `
            <div class="text-center py-12 text-white/50">
                <div class="text-6xl mb-4">🧭</div>
                <p class="text-lg font-bold text-white/60">This student hasn't chosen a Hero Class yet.</p>
                <p class="text-sm mt-2">Edit the student to assign a class first.</p>
            </div>`;
        return;
    }

    content.innerHTML = tree.levels.map((lvl, idx) => {
        const levelNumber = idx + 1;
        const isUnlocked = starsInReason >= lvl.threshold;
        const chosenSkillId = heroSkills[idx] || null;
        const needsChoice = isUnlocked && !chosenSkillId;
        const isCurrentPending = pendingChoice && levelNumber === currentLevel && needsChoice;

        const connectorHtml = idx < tree.levels.length - 1
            ? `<div class="flex justify-center my-1"><div class="w-0.5 h-6 ${isUnlocked ? 'bg-white/30' : 'bg-white/10'}"></div></div>`
            : '';

        const titleLabel = getHeroTitle(heroClass, levelNumber);
        const thresholdLabel = `${lvl.threshold} ${getReasonDisplayName(reason)} stars`;

        return `
            <div class="skill-tree-level-node ${isUnlocked ? '' : 'opacity-50'}" data-level="${levelNumber}">
                <!-- Level header row -->
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border-2
                        ${isUnlocked ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/15 text-white/30'}">
                        ${levelNumber}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-title text-base text-white ${isUnlocked ? '' : 'opacity-40'}">${titleLabel}</span>
                            ${isUnlocked ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 font-bold uppercase">Unlocked</span>` : `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 font-bold uppercase">🔒 ${thresholdLabel}</span>`}
                            ${isCurrentPending ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase animate-pulse" style="background:${tree.auraColor}44;color:${tree.auraColor}">Choose Now!</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Branch cards -->
                <div class="grid grid-cols-2 gap-3">
                    ${lvl.branches.map(branch => {
                        const isChosen = chosenSkillId === branch.id;
                        const canChoose = isUnlocked && !chosenSkillId;
                        return `
                            <div class="skill-branch-card relative rounded-2xl p-3 border-2 transition-all duration-200 cursor-default
                                ${isChosen
                                    ? `border-2 shadow-lg`
                                    : canChoose
                                        ? 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 cursor-pointer'
                                        : 'border-white/10 bg-white/3'
                                }"
                                style="${isChosen ? `border-color:${tree.auraColor};background:${tree.auraColor}22;box-shadow:${tree.auraGlow}` : ''}"
                                data-branch-id="${branch.id}"
                                data-student-id="${student.id}"
                                data-level-index="${idx}"
                                ${canChoose ? 'role="button" tabindex="0"' : ''}>
                                <div class="text-2xl mb-1.5">${branch.icon}</div>
                                <div class="font-bold text-sm text-white leading-tight mb-1">${branch.name}</div>
                                <div class="text-xs text-white/55 leading-snug">${branch.desc}</div>
                                ${isChosen ? `<div class="absolute top-2 right-2 text-xs font-bold rounded-full px-1.5 py-0.5" style="background:${tree.auraColor};color:white">✓ Active</div>` : ''}
                                ${canChoose ? `<div class="mt-2 text-xs font-bold text-center py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" style="color:${tree.auraColor}">Choose →</div>` : ''}
                            </div>`;
                    }).join('')}
                </div>
            </div>
            ${connectorHtml}
        `;
    }).join('');

    // Bind choose-skill clicks
    content.querySelectorAll('.skill-branch-card[role="button"]').forEach(card => {
        card.addEventListener('click', () => {
            _handleChooseSkill(
                card.dataset.studentId,
                card.dataset.branchId,
                parseInt(card.dataset.levelIndex),
                heroClass,
                tree
            );
        });
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') card.click();
        });
    });
}

// ─── CHOOSE SKILL ─────────────────────────────────────────────────────────────

async function _handleChooseSkill(studentId, branchId, levelIndex, heroClass, tree) {
    const branch = tree.levels[levelIndex]?.branches.find(b => b.id === branchId);
    if (!branch) return;

    const confirmEl = document.createElement('div');
    confirmEl.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 pop-in';
    confirmEl.innerHTML = `
        <div class="bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 border-2 shadow-2xl" style="border-color:${tree.auraColor}">
            <div class="text-4xl text-center mb-3">${branch.icon}</div>
            <h3 class="font-title text-xl text-white text-center mb-2">${branch.name}</h3>
            <p class="text-sm text-white/60 text-center mb-5">${branch.desc}</p>
            <p class="text-xs text-white/40 text-center mb-5 italic">This choice is permanent for this level.</p>
            <div class="flex gap-3">
                <button id="skill-confirm-cancel" class="flex-1 py-2 rounded-xl bg-white/10 text-white/60 font-bold text-sm hover:bg-white/20 transition-colors">Cancel</button>
                <button id="skill-confirm-ok" class="flex-1 py-2 rounded-xl font-bold text-sm text-white transition-colors hover:opacity-80" style="background:${tree.auraColor}">Confirm Choice</button>
            </div>
        </div>`;
    document.body.appendChild(confirmEl);

    await new Promise(resolve => {
        confirmEl.querySelector('#skill-confirm-cancel').addEventListener('click', () => { confirmEl.remove(); resolve(false); });
        confirmEl.querySelector('#skill-confirm-ok').addEventListener('click', () => { confirmEl.remove(); resolve(true); });
    }).then(async confirmed => {
        if (!confirmed) return;

        try {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
            const currentSkills = [...(scoreData?.heroSkills || [])];
            currentSkills[levelIndex] = branchId;

            await updateDoc(scoreRef, {
                heroSkills: currentSkills,
                pendingSkillChoice: false
            });

            playSound('magic_chime');
            showToast(`Skill unlocked: ${branch.name}!`, 'success');

            // Re-render the tree with updated state (listener will update allStudentScores)
            const updatedScore = { ...scoreData, heroSkills: currentSkills, pendingSkillChoice: false };
            const student = state.get('allStudents').find(s => s.id === studentId);
            _renderTree(student, updatedScore, heroClass, tree);
        } catch (err) {
            console.error('Failed to save skill choice:', err);
            showToast('Failed to save skill. Please try again.', 'error');
        }
    });
}
