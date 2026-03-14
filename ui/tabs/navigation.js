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
import { renderCalendarTab } from './selectors.js';
import { renderIdeasTabSelects, renderStarManagerStudentSelect } from './ideas.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';

// --- TAB NAVIGATION ---

const GATED_TABS = {
    'guilds-tab': { feature: 'Guilds', tier: 'Pro', message: 'Unlock the full Guild system and sorting quiz.' },
    'calendar-tab': { feature: 'Calendar & Day Planner', tier: 'Pro', message: 'Manage your schedule, holidays, and Quest Events.' },
    'scholars-scroll-tab': { feature: "Scholar's Scroll", tier: 'Pro', message: 'Track tests, dictations, and performance charts.' },
    'reward-ideas-tab': { feature: 'Story Weavers', tier: 'Pro', message: 'Collaborative story and Word of the Day.' }
};

const TAB_FEATURE_FLAGS = {
    'guilds-tab': 'guilds',
    'calendar-tab': 'calendar',
    'scholars-scroll-tab': 'scholarScroll',
    'reward-ideas-tab': 'storyWeavers'
};

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

        // Options subtabs (Manage / Planning / Profile / Danger)
        if (!window.__optionsSubtabsWired) {
            window.__optionsSubtabsWired = true;
            const buttons = document.querySelectorAll('.options-subtab-btn');
            const sections = document.querySelectorAll('[data-options-section]');
            const activate = (key) => {
                buttons.forEach(btn => {
                    const active = btn.dataset.optionsTab === key;
                    btn.classList.toggle('bg-sky-500', active && key === 'manage');
                    btn.classList.toggle('text-white', active);
                    btn.classList.toggle('bg-white/80', !active);
                });
                sections.forEach(sec => {
                    sec.classList.toggle('hidden', sec.dataset.optionsSection !== key);
                });
            };
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.optionsTab || 'manage';
                    activate(key);
                });
            });
            // Initial state
            activate('manage');
        }

        const tierEl = document.getElementById('app-tier-label');
        const versionEl = document.getElementById('app-version-label');
        if (tierEl) {
            const rawTier = getTier();
            const pretty =
                rawTier === 'elite' ? 'Elite' :
                rawTier === 'pro' ? 'Pro' : 'Starter';
            tierEl.textContent = `Plan: ${pretty}`;
        }
        if (versionEl) {
            const version = (constants && constants.APP_VERSION) || '0.0.2';
            versionEl.textContent = `Version ${version}`;
        }
    }
}
