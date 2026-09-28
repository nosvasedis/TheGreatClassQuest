// /ui/modals/skillTree.js — Ascension Path (Skill Tree) modal: open, render, choose + awaken a skill.
// Model: features/skillTreeCore.mjs · Markup: ui/modals/skillTreeView.mjs · Styles: styles/skill_tree.css
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import { showAnimatedModal } from '../modals.js';
import { playSound } from '../../audio.js';
import { HERO_SKILL_TREE, getReasonDisplayName } from '../../features/heroSkillTree.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { buildSkillTreeModel } from '../../features/skillTreeCore.mjs';
import {
    renderSkillTreeStage,
    renderSkillRiteHtml,
    renderAwakenBurstHtml,
    skillTreeThemeStyle
} from './skillTreeView.mjs';
import { db, doc, updateDoc } from '../../firebase.js';
import { requireProHeroProgression } from '../../utils/upgradePrompt.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

function modelFor(student, scoreData) {
    const heroClass = student.heroClass || null;
    const tree = heroClass ? HERO_SKILL_TREE[heroClass] : null;
    return buildSkillTreeModel({
        heroClass,
        tree,
        classIcon: HERO_CLASSES[heroClass]?.icon || '⭐',
        studentName: student.name,
        heroSkills: scoreData.heroSkills || [],
        starsInReason: tree ? (scoreData.starsByReason || {})[tree.reason] || 0 : 0,
        reasonLabel: tree ? getReasonDisplayName(tree.reason) : '',
        titles: tree?.titles || []
    });
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

    _renderTree(student, scoreData, { entering: true });
    showAnimatedModal('skill-tree-modal');
    _scrollToFocus(false);
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function _renderTree(student, scoreData, { entering = false } = {}) {
    const model = modelFor(student, scoreData);
    const panel = document.getElementById('skill-tree-modal-panel');
    const stage = document.getElementById('skill-tree-stage');
    if (!panel || !stage) return model;

    panel.setAttribute('style', skillTreeThemeStyle(model));
    panel.classList.toggle('is-pathless', !model.hasPath);
    panel.classList.toggle('is-entering', entering && !prefersReducedMotion());
    const sigil = document.getElementById('skill-tree-class-bg-icon');
    if (sigil) sigil.textContent = model.icon;

    stage.innerHTML = renderSkillTreeStage(model);
    if (entering) {
        clearTimeout(panel._stEnterTimer);
        panel._stEnterTimer = setTimeout(() => panel.classList.remove('is-entering'), 2400);
    }

    stage.querySelectorAll('.st-skill.is-choosable').forEach(card => {
        card.addEventListener('click', () => {
            _handleChooseSkill(student.id, card.dataset.branchId, parseInt(card.dataset.levelIndex, 10), card);
        });
    });
    return model;
}

function _scrollToFocus(smooth) {
    requestAnimationFrame(() => {
        const scroller = document.getElementById('skill-tree-content');
        const focus = scroller?.querySelector('.st-tier.is-focus');
        if (!scroller || !focus) return;
        const top = focus.offsetTop - (scroller.clientHeight - focus.offsetHeight) / 2;
        scroller.scrollTo({ top: Math.max(0, top), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    });
}

// ─── CHOOSE SKILL ─────────────────────────────────────────────────────────────

function _askRite(branch, tier) {
    const panel = document.getElementById('skill-tree-modal-panel');
    const rite = document.createElement('div');
    rite.className = 'st-rite';
    rite.innerHTML = renderSkillRiteHtml(branch, tier);
    panel.appendChild(rite);
    requestAnimationFrame(() => rite.classList.add('is-open'));
    rite.querySelector('[data-rite="ok"]')?.focus({ preventScroll: true });

    return new Promise(resolve => {
        const close = (result) => {
            document.removeEventListener('keydown', onKey, true);
            rite.classList.remove('is-open');
            setTimeout(() => { rite.remove(); resolve(result); }, prefersReducedMotion() ? 0 : 260);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(false); }
        };
        document.addEventListener('keydown', onKey, true);
        rite.addEventListener('click', (e) => {
            if (e.target === rite) return close(false);
            const action = e.target.closest('[data-rite]')?.dataset.rite;
            if (action) close(action === 'ok');
        });
    });
}

async function _handleChooseSkill(studentId, branchId, levelIndex, card) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    if (!student || !scoreData) return;
    const model = modelFor(student, scoreData);
    const tier = model.tiers[levelIndex];
    const branch = tier?.branches.find(b => b.id === branchId);
    if (!branch || branch.state !== 'choosable') return;

    card?.classList.add('is-considered');
    const confirmed = await _askRite(branch, tier);
    card?.classList.remove('is-considered');
    if (!confirmed) return;

    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        const latest = state.get('allStudentScores').find(s => s.id === studentId) || scoreData;
        const currentSkills = [...(latest.heroSkills || [])];
        currentSkills[levelIndex] = branchId;

        await updateDoc(scoreRef, {
            heroSkills: currentSkills,
            pendingSkillChoice: false
        });

        const updatedScore = { ...latest, heroSkills: currentSkills, pendingSkillChoice: false };
        syncLocalStudentScore(studentId, updatedScore);
        refreshVisibleSkillIndicators().catch((error) => console.warn('Could not refresh skill indicators:', error));

        playSound('magic_chime');
        showToast(`Skill awakened: ${branch.name}!`, 'success');

        // Re-render with the new state (the listener still reconciles allStudentScores), then play the awakening.
        _renderTree(student, updatedScore);
        _playAwakening(branchId, levelIndex);
    } catch (err) {
        console.error('Failed to save skill choice:', err);
        showToast('Failed to save skill. Please try again.', 'error');
    }
}

function _playAwakening(branchId, levelIndex) {
    const stage = document.getElementById('skill-tree-stage');
    const tierEl = stage?.querySelector(`.st-tier[data-level="${levelIndex + 1}"]`);
    const node = tierEl?.querySelector(`.st-skill[data-branch-id="${CSS.escape(branchId)}"]`);
    const scroller = document.getElementById('skill-tree-content');
    if (!tierEl || !node || !scroller) return;

    const top = tierEl.offsetTop - (scroller.clientHeight - tierEl.offsetHeight) / 2;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    if (prefersReducedMotion()) return;

    tierEl.classList.add('is-just-awakened');
    node.classList.add('is-just-awakened');
    node.querySelector('.st-skill-orb')?.insertAdjacentHTML('beforeend', renderAwakenBurstHtml());
    setTimeout(() => {
        tierEl.classList.remove('is-just-awakened');
        node.classList.remove('is-just-awakened');
        node.querySelector('.st-burst')?.remove();
        // If another seal is already open, glide up to it.
        if (stage.querySelector('.st-tier.is-choosing')) _scrollToFocus(true);
    }, 1900);
}
