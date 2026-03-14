// /ui/tabs/navigation.js

// --- IMPORTS ---
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { deleteClass, deleteStudent, ensureHistoryLoaded } from '../../db/actions.js';
import { db } from '../../firebase.js';
import { fetchMonthlyHistory } from '../../state.js';
import * as modals from '../modals.js';
import * as scholarScroll from '../../features/scholarScroll.js';
import * as avatar from '../../features/avatar.js';
import * as storyWeaver from '../../features/storyWeaver.js';
import { playSound } from '../../audio.js';
import { renderActiveBounties } from '../core.js';
import { updateCeremonyStatus } from '../../features/ceremony.js';
import { renderHomeTab } from '../../features/home.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { generateLeagueMapHtml } from '../../features/worldMap.js';
import { renderClassLeaderboardTab, renderStudentLeaderboardTab } from './leaderboard.js';
import { renderGuildsTab } from './guilds.js';
import { renderManageClassesTab, renderManageStudentsTab } from './classes.js';
import { renderAwardStarsTab } from './award.js';
import { renderAdventureLogTab } from './log.js';
import { handleSaveSchoolNameFromOptions } from '../../db/actions/school.js';
import { renderCalendarTab } from './selectors.js';
import { renderIdeasTabSelects, renderStarManagerStudentSelect } from './ideas.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { GATED_TABS, TAB_FEATURE_FLAGS, getTierSummary, getUpgradeMessage } from '../../config/tiers/features.js';

// --- TAB NAVIGATION ---

export async function showTab(tabName) {
    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;
    const nextTab = document.getElementById(tabId);

    const currentTab = document.querySelector('.app-tab:not(.hidden)');

    if (!nextTab || (currentTab && currentTab.id === tabId)) {
        return;
    }

    const flag = TAB_FEATURE_FLAGS[tabId];
    if (flag && !canUseFeature(flag)) {
        const opts = GATED_TABS[tabId];
        if (opts) showUpgradePrompt(opts);
        return;
    }

    localStorage.setItem('quest_last_active_tab', tabId);

    document.querySelectorAll('.nav-button[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    if (tabId === 'manage-students-tab') {
        document.querySelector('.nav-button[data-tab="my-classes-tab"]').classList.add('active');
    }

    const animationDuration = 350;

    if (currentTab) {
        currentTab.classList.add('tab-animate-out');

        setTimeout(() => {
            currentTab.classList.add('hidden');
            currentTab.classList.remove('tab-animate-out');

            nextTab.classList.remove('hidden');
            nextTab.classList.add('tab-animate-in');

            setTimeout(() => {
                nextTab.classList.remove('tab-animate-in');
            }, animationDuration);

        }, animationDuration);
    } else {
        nextTab.classList.remove('hidden');
        nextTab.classList.add('tab-animate-in');
        setTimeout(() => {
            nextTab.classList.remove('tab-animate-in');
        }, animationDuration);
    }

    // --- Trigger specific render functions when a tab is shown ---
    if (tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab' || tabId === 'guilds-tab') {
        const { findAndSetCurrentLeague } = await import('../core.js');
        findAndSetCurrentLeague();
        updateCeremonyStatus(tabId); // Pass the ID!
    }

    if (tabId === 'class-leaderboard-tab') renderClassLeaderboardTab();
    if (tabId === 'student-leaderboard-tab') renderStudentLeaderboardTab();
    if (tabId === 'guilds-tab') renderGuildsTab();
    if (tabId === 'my-classes-tab') renderManageClassesTab();
    if (tabId === 'manage-students-tab') renderManageStudentsTab();

    if (tabId === 'award-stars-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        // First render with whatever state we have
        renderAwardStarsTab();
        // Then try to find the current class based on time, which will trigger a re-render via state.js if found
        findAndSetCurrentClass();
    }

    if (tabId === 'adventure-log-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        renderAdventureLogTab();
        findAndSetCurrentClass('adventure-log-class-select');
    }

    if (tabId === 'scholars-scroll-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        scholarScroll.renderScholarsScrollTab();
        findAndSetCurrentClass('scroll-class-select');
    }

    if (tabId === 'calendar-tab') {
        await ensureHistoryLoaded();
        renderCalendarTab();
    }

    if (tabId === 'about-tab') {
        renderHomeTab();
    }

    if (tabId === 'reward-ideas-tab') renderIdeasTabSelects();
        if (tabId === 'options-tab') {
        // Load holidays and the new economy selector
        import('../core.js').then(m => {
            if (m.renderHolidayList) m.renderHolidayList();
            if (m.renderClassEndDatesList) m.renderClassEndDatesList();
            if (m.renderEconomyStudentSelect) m.renderEconomyStudentSelect();
        });

        // FIX: Call this directly (it is defined in this file, not core.js)
        renderStarManagerStudentSelect();

        const teacherInput = document.getElementById('teacher-name-input');
        if (teacherInput) {
            teacherInput.value = state.get('currentTeacherName') || '';
        }
        const schoolInput = document.getElementById('options-school-name-input');
        if (schoolInput) {
            schoolInput.value = state.get('schoolName') || constants.DEFAULT_SCHOOL_NAME;
        }

        // Options subtabs: beautiful bar, active state, tier-aware Planning
        if (!window.__optionsSubtabsWired) {
            window.__optionsSubtabsWired = true;
            const buttons = document.querySelectorAll('.options-subtab-btn');
            const sections = document.querySelectorAll('[data-options-section]');
            const planningLocked = document.getElementById('options-planning-locked');
            const planningContent = document.getElementById('options-planning-content');

            const activate = (key) => {
                buttons.forEach(btn => {
                    btn.classList.toggle('options-subtab-active', btn.dataset.optionsTab === key);
                });
                sections.forEach(sec => {
                    const isVisible = sec.dataset.optionsSection === key;
                    sec.classList.toggle('hidden', !isVisible);
                    sec.classList.toggle('options-section-visible', isVisible);
                });
                // Tier: Planning is Pro+. Show locked card or real content
                const hasPlanning = canUseFeature('schoolYearPlanner');
                if (planningLocked) planningLocked.classList.toggle('hidden', hasPlanning || key !== 'planning');
                if (planningContent) planningContent.classList.toggle('hidden', !hasPlanning || key !== 'planning');
            };

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.optionsTab || 'manage';
                    activate(key);
                    if (typeof playSound === 'function') playSound('click');
                });
            });
            if (planningLocked) {
                planningLocked.addEventListener('click', () => {
                    showUpgradePrompt({ feature: 'School Year Planner', tier: 'Pro', message: getUpgradeMessage('Pro', 'schoolYearPlanner') });
                });
                planningLocked.style.cursor = 'pointer';
            }
            const saveSchoolBtn = document.getElementById('save-school-name-btn');
            if (saveSchoolBtn) {
                saveSchoolBtn.addEventListener('click', () => {
                    handleSaveSchoolNameFromOptions();
                });
            }
            activate('manage');
        }

        const tierEl = document.getElementById('app-tier-label');
        const versionEl = document.getElementById('app-version-label');
        const summaryEl = document.getElementById('options-tier-summary');

        const rawTier = getTier();
        const pretty =
            rawTier === 'elite' ? 'Elite' :
            rawTier === 'pro' ? 'Pro' : 'Starter';

        if (tierEl) {
            tierEl.textContent = `Plan: ${pretty}`;
        }
        if (versionEl) {
            const version = (constants && constants.APP_VERSION) || '0.0.2';
            versionEl.textContent = `Version ${version}`;
        }

        if (summaryEl) {
            const summary = getTierSummary(rawTier);
            const badgeEmoji = rawTier === 'elite' ? '🌟' : rawTier === 'pro' ? '🚀' : '🔰';
            summaryEl.innerHTML = `
                <div class="bg-gradient-to-r from-sky-50 via-slate-50 to-emerald-50 border border-sky-100 rounded-3xl shadow-md p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div class="flex-1">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-sky-100 text-xs font-semibold text-sky-700 mb-2">
                            <span>${badgeEmoji} ${summary.badge}</span>
                            <span class="h-1 w-1 rounded-full bg-sky-400"></span>
                            <span>Current plan: ${pretty}</span>
                        </div>
                        <h3 class="font-title text-xl text-slate-800 mb-1">${summary.title}</h3>
                        <p class="text-sm text-slate-600">${summary.body}</p>
                    </div>
                    <div class="md:w-56">
                        <div class="bg-white/80 rounded-2xl px-3 py-3 text-xs text-slate-600 border border-dashed border-sky-100">
                            <p class="font-semibold text-slate-800 mb-1">${summary.isTopTier ? "You're all set ✨" : 'Thinking about upgrading?'}</p>
                            <p>${summary.cta}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}
