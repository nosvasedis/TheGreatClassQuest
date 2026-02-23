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

// --- TAB NAVIGATION ---

export async function showTab(tabName) {
    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;
    const nextTab = document.getElementById(tabId);

    const currentTab = document.querySelector('.app-tab:not(.hidden)');

    if (!nextTab || (currentTab && currentTab.id === tabId)) {
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
            if (m.renderEconomyStudentSelect) m.renderEconomyStudentSelect();
        });

        // FIX: Call this directly (it is defined in this file, not core.js)
        renderStarManagerStudentSelect();

        if (document.getElementById('teacher-name-input')) {
            document.getElementById('teacher-name-input').value = state.get('currentTeacherName') || '';
        }
    }
}
