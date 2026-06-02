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
import { requireProHeroProgression } from '../../utils/upgradePrompt.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

function syncLocalStudentScore(studentId, updatedScore) {
    const allScores = state.get('allStudentScores') || [];
    state.setAllStudentScores(allScores.map((score) => score.id === studentId ? updatedScore : score));
}

async function refreshVisibleSkillIndicators() {
    const tabs = await import('../tabs.js');
    const activeRenderers = [
        ['award-stars-tab', () => tabs.renderAwardStarsStudentList?.(state.get('globalSelectedClassId'), false)],
        ['manage-students-tab', () => tabs.renderManageStudentsTab?.()],
        ['student-leaderboard-tab', () => tabs.renderStudentLeaderboardTab?.()],
        ['class-leaderboard-tab', () => tabs.renderClassLeaderboardTab?.()]
    ];

    activeRenderers.forEach(([tabId, render]) => {
        const tab = document.getElementById(tabId);
        if (tab && !tab.classList.contains('hidden')) render();
    });

    const { renderHomeTab } = await import('../../features/home.js');
    renderHomeTab();
}

// ─── OPEN ─────────────────────────────────────────────────────────────────────

export function openSkillTreeModal(studentId) {
    if (!requireProHeroProgression({ feature: 'Skill Tree' })) return;

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
        panel.style.background = `linear-gradient(165deg, ${tree.auraColor}33 0%, #0f172a 60%, #020617 100%)`;
        panel.style.borderColor = `${tree.auraColor}44`;
        document.getElementById('skill-tree-class-icon-glow').style.background = tree.auraColor;
        document.getElementById('skill-tree-class-bg-icon').textContent = classInfo?.icon || '⭐';
        document.getElementById('skill-tree-class-bg-icon').style.color = tree.auraColor;
        document.getElementById('skill-tree-progress-bar').style.background = `linear-gradient(90deg, ${tree.auraColor}aa, ${tree.auraColor})`;
        document.getElementById('skill-tree-progress-bar').style.boxShadow = `0 0 15px ${tree.auraColor}66`;
    } else {
        panel.style.background = 'linear-gradient(165deg, #1e1b4b 0%, #0f172a 60%, #020617 100%)';
        panel.style.borderColor = '#ffffff10';
        document.getElementById('skill-tree-class-icon-glow').style.background = '#6366f1';
        document.getElementById('skill-tree-class-bg-icon').textContent = '🧭';
        document.getElementById('skill-tree-class-bg-icon').style.color = '#ffffff10';
        document.getElementById('skill-tree-progress-bar').style.background = '#6366f1';
    }

    // Header info
    document.getElementById('skill-tree-class-icon').textContent = classInfo?.icon || '⭐';
    document.getElementById('skill-tree-modal-title').textContent = heroClass || 'No Class Chosen';
    document.querySelector('#skill-tree-student-name .student-name-text').textContent = student.name;

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
        levelLabel.textContent = currentLevel > 0 ? `${getHeroTitle(heroClass, currentLevel)}` : 'Initiate';
        const needed = starsToNextLevel(heroClass, currentLevel, starsInReason);
        const reasonLabel = getReasonDisplayName(reason);
        progressText.textContent = `Lvl ${currentLevel} · ${starsInReason} ${reasonLabel} · ${needed} to next level`;
    } else if (tree && currentLevel >= maxLevel) {
        progressBar.style.width = '100%';
        levelLabel.textContent = `${getHeroTitle(heroClass, maxLevel)}`;
        progressText.textContent = `${starsInReason} ${getReasonDisplayName(reason)} stars — MAX LEVEL REACHED`;
    } else {
        progressBar.style.width = '0%';
        levelLabel.textContent = 'No class chosen';
        progressText.textContent = '';
    }

    const content = document.getElementById('skill-tree-content');

    if (!tree) {
        content.innerHTML = `
            <div class="text-center py-16 text-white/50">
                <div class="text-7xl mb-6 filter drop-shadow-2xl">🧭</div>
                <p class="text-xl font-title text-white/80">Path Unchosen</p>
                <p class="text-sm mt-3 text-white/40 max-w-xs mx-auto">This student hasn't stepped onto a hero's path yet. Assign a Hero Class in their settings to begin.</p>
            </div>`;
        return;
    }

    content.innerHTML = tree.levels.map((lvl, idx) => {
        const levelNumber = idx + 1;
        const isUnlocked = starsInReason >= lvl.threshold;
        const chosenSkillId = heroSkills[idx] || null;
        const needsChoice = isUnlocked && !chosenSkillId;
        const isCurrentPending = pendingChoice && levelNumber === (heroSkills.length + 1) && needsChoice;

        const connectorHtml = idx < tree.levels.length - 1
            ? `<div class="flex justify-center my-2"><div class="w-1 h-12 rounded-full ${isUnlocked ? 'bg-gradient-to-b from-white/30 to-white/10' : 'bg-white/5 shadow-inner'}"></div></div>`
            : '';

        const titleLabel = getHeroTitle(heroClass, levelNumber);
        const thresholdLabel = `${lvl.threshold} ${getReasonDisplayName(reason)} stars`;

        return `
            <div class="skill-tree-level-node group ${isUnlocked ? 'is-unlocked' : 'is-locked opacity-60'}" data-level="${levelNumber}">
                <!-- Level header row -->
                <div class="flex items-center gap-4 mb-5">
                    <div class="relative w-12 h-12 flex-shrink-0">
                        <div class="absolute inset-0 rounded-xl rotate-45 transition-all duration-500
                            ${isUnlocked ? 'bg-white/10 border border-white/20 scale-100' : 'bg-black/40 border border-white/5 scale-90'}"></div>
                        <div class="relative flex items-center justify-center h-full text-lg font-title
                            ${isUnlocked ? 'text-white' : 'text-white/30'}">
                            ${levelNumber}
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-col">
                            <h3 class="font-title text-xl text-white flex items-center gap-3">
                                ${titleLabel}
                                ${isUnlocked ? '<i class="fas fa-check-circle text-[10px] text-green-400 opacity-60"></i>' : '<i class="fas fa-lock text-[10px] opacity-30"></i>'}
                            </h3>
                            <div class="flex items-center gap-2 mt-1">
                                ${isUnlocked 
                                    ? `<span class="text-[9px] px-2 py-0.5 rounded-md bg-white/10 text-white/60 font-bold uppercase tracking-wider">Unlocked</span>` 
                                    : `<span class="text-[9px] px-2 py-0.5 rounded-md bg-black/40 text-white/30 font-bold uppercase tracking-wider border border-white/5">Requires ${thresholdLabel}</span>`
                                }
                                ${isCurrentPending ? `<span class="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.2)]" style="background:${tree.auraColor};color:white">Level Up! Choice Pending</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Branch cards -->
                <div class="grid grid-cols-2 gap-4">
                    ${lvl.branches.map(branch => {
                        const isChosen = chosenSkillId === branch.id;
                        const canChoose = isUnlocked && !chosenSkillId && (idx === 0 || !!heroSkills[idx-1]);
                        
                        return `
                            <div class="skill-branch-card group/card relative rounded-[1.5rem] p-4 border transition-all duration-500
                                ${isChosen
                                    ? `is-active border-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]`
                                    : canChoose
                                        ? 'is-available border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer hover:-translate-y-1 hover:shadow-xl'
                                        : 'is-unavailable border-white/5 bg-black/20 grayscale-[0.8] opacity-50'
                                }"
                                style="${isChosen ? `border-color:${tree.auraColor};background:linear-gradient(135deg, ${tree.auraColor}22, ${tree.auraColor}11);box-shadow:inset 0 0 20px ${tree.auraColor}11` : ''}"
                                data-branch-id="${branch.id}"
                                data-student-id="${student.id}"
                                data-level-index="${idx}"
                                ${canChoose ? 'role="button" tabindex="0"' : ''}>
                                
                                <div class="relative w-12 h-12 flex items-center justify-center rounded-2xl bg-black/40 border border-white/10 mb-3 group-hover/card:scale-110 transition-transform duration-500">
                                    <div class="text-3xl filter drop-shadow-md">${branch.icon}</div>
                                    ${isChosen ? `<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style="background:${tree.auraColor}"><i class="fas fa-check"></i></div>` : ''}
                                </div>
                                
                                <div class="font-title text-sm text-white leading-tight mb-1.5 group-hover/card:text-white transition-colors">${branch.name}</div>
                                <div class="text-[11px] text-white/50 leading-relaxed line-clamp-3 group-hover/card:text-white/70 transition-colors">${branch.desc}</div>
                                
                                ${isChosen ? `<div class="mt-3 flex items-center gap-2"><div class="h-1 flex-1 rounded-full overflow-hidden bg-white/10"><div class="h-full w-full" style="background:${tree.auraColor}"></div></div><span class="text-[8px] font-bold uppercase tracking-widest text-white/40">Active</span></div>` : ''}
                                ${canChoose ? `<div class="mt-4 py-2 rounded-xl text-center text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/20 group-hover/card:border-solid group-hover/card:bg-white group-hover/card:text-black transition-all">Select Skill</div>` : ''}
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
    confirmEl.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/0 backdrop-blur-0 p-4 transition-all duration-300';
    confirmEl.innerHTML = `
        <div class="confirm-card relative bg-[#0f172a] rounded-[2.5rem] p-8 max-w-sm w-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden pop-in modal-origin-start">
            <!-- Background Glow -->
            <div class="absolute -top-20 -left-20 w-40 h-40 blur-[80px] opacity-30" style="background:${tree.auraColor}"></div>
            
            <div class="relative z-10">
                <div class="w-20 h-20 mx-auto flex items-center justify-center rounded-3xl bg-black/40 border border-white/10 text-5xl mb-6 shadow-inner">
                    ${branch.icon}
                </div>
                
                <div class="text-center mb-6">
                    <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Confirm Awakening</p>
                    <h3 class="font-title text-2xl text-white mb-2">${branch.name}</h3>
                    <p class="text-xs text-white/60 leading-relaxed">${branch.desc}</p>
                </div>
                
                <div class="bg-black/30 rounded-2xl p-4 mb-8 border border-white/5">
                    <p class="text-[10px] text-white/30 text-center italic leading-tight">
                        Choose wisely, Hero. This skill will become a permanent part of your legend.
                    </p>
                </div>
                
                <div class="flex flex-col gap-3">
                    <button id="skill-confirm-ok" class="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg" style="background:${tree.auraColor}">
                        Commit to this Path
                    </button>
                    <button id="skill-confirm-cancel" class="w-full py-3 rounded-2xl text-white/40 font-bold text-xs hover:text-white/60 transition-colors">
                        Reconsider
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(confirmEl);

    // Animate in
    requestAnimationFrame(() => {
        confirmEl.classList.replace('bg-black/0', 'bg-black/80');
        confirmEl.classList.replace('backdrop-blur-0', 'backdrop-blur-sm');
        confirmEl.querySelector('.confirm-card').classList.remove('modal-origin-start');
    });

    await new Promise(resolve => {
        const close = (result) => {
            confirmEl.classList.replace('bg-black/80', 'bg-black/0');
            confirmEl.classList.replace('backdrop-blur-sm', 'backdrop-blur-0');
            confirmEl.querySelector('.confirm-card').classList.add('modal-origin-start');
            setTimeout(() => {
                confirmEl.remove();
                resolve(result);
            }, 300);
        };
        confirmEl.querySelector('#skill-confirm-cancel').addEventListener('click', () => close(false));
        confirmEl.querySelector('#skill-confirm-ok').addEventListener('click', () => close(true));
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

            const updatedScore = { ...scoreData, heroSkills: currentSkills, pendingSkillChoice: false };
            syncLocalStudentScore(studentId, updatedScore);
            refreshVisibleSkillIndicators().catch((error) => console.warn('Could not refresh skill indicators:', error));

            playSound('magic_chime');
            showToast(`Skill unlocked: ${branch.name}!`, 'success');

            // Re-render the tree with updated state (listener will still reconcile allStudentScores)
            const student = state.get('allStudents').find(s => s.id === studentId);
            _renderTree(student, updatedScore, heroClass, tree);
        } catch (err) {
            console.error('Failed to save skill choice:', err);
            showToast('Failed to save skill. Please try again.', 'error');
        }
    });
}
