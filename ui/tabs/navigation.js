// /ui/tabs/navigation.js

// --- IMPORTS ---
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { deleteClass, deleteStudent, ensureHistoryLoaded } from '../../db/actions.js';
import { filterDocsForActiveYear } from '../../utils/schoolYear.js';
import { db } from '../../firebase.js';
import { fetchMonthlyHistory } from '../../state.js';
import * as modals from '../modals.js';
import * as scholarScroll from '../../features/scholarScroll.js';
import * as avatar from '../../features/avatar.js';
import * as storyWeaver from '../../features/storyWeaver.js';
import { playSound } from '../../audio.js';
import { showToast } from '../effects.js';
import { renderActiveBounties } from '../core.js';
import { renderClassEndDatesList } from '../core/misc.js';
import { updateCeremonyStatus } from '../../features/ceremony.js';
import { renderHomeTab } from '../../features/home.js';
import { requestDayRingIntro } from '../../features/homeGreetingScene.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { refreshFortunesWheelModalFromGlobalClass } from '../../features/fortunesWheel.js';
import { renderClassLeaderboardTab, renderStudentLeaderboardTab } from './leaderboard.js';
import { renderGuildsTab } from './guilds.js';
import { renderManageClassesTab, renderManageStudentsTab } from './classes.js';
import { renderAwardStarsTab, resetAwardCardVisualSession } from './award.js';
import { renderAdventureLogTab } from './log.js';
import {
    renderAssessmentOptionsUi,
    handleSaveAssessmentSettingsFromOptions
} from '../../db/actions/school.js';
import { renderCalendarTab } from './selectors.js';
import { renderIdeasTabSelects, renderStarManagerStudentSelect } from './ideas.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { GATED_TABS, TAB_FEATURE_FLAGS, getTierSummary, getUpgradeMessage } from '../../config/tiers/features.js';
import { renderFamiliarOptionsUi } from '../../features/familiars.js';
import { renderAccessCenterUi, wireAccessCenterEvents } from '../../features/accessManagement.js';
import { renderMarketManagerUi, wireMarketManagerEvents } from '../core/marketManager.js';
import { renderQuizOptionsUi } from './quizSetup.js';

export { renderQuizOptionsUi };

// --- TAB NAVIGATION ---

export function updateBottomNavGateState() {
    const navButtons = document.querySelectorAll('.nav-button[data-tab]');
    if (!navButtons.length) return;

    navButtons.forEach(btn => {
        const tabId = btn.dataset.tab;
        const featureFlag = TAB_FEATURE_FLAGS[tabId];
        const gate = GATED_TABS[tabId];
        const isLocked = Boolean(featureFlag) && !canUseFeature(featureFlag);

        btn.classList.toggle('nav-button-locked', isLocked);
        btn.setAttribute('aria-disabled', isLocked ? 'true' : 'false');

        if (isLocked && gate) {
            btn.dataset.lockedTier = (gate.tier || '').toLowerCase();
            btn.dataset.lockedLabel = gate.tier || '';
            btn.title = `${gate.feature} requires ${gate.tier}.`;
            return;
        }

        btn.removeAttribute('data-locked-tier');
        btn.removeAttribute('data-locked-label');
        btn.removeAttribute('title');
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('gcq-subscription-updated', updateBottomNavGateState);
}

// --- Award tab scroll-pause: freeze all card animations while the user scrolls ---
// Uses a debounce to re-enable animations ~150 ms after scrolling stops.
if (typeof window !== 'undefined') {
    let _awardScrollPauseTimer = null;
    document.addEventListener('scroll', () => {
        const tab = document.getElementById('award-stars-tab');
        if (!tab || tab.classList.contains('hidden')) return;
        tab.classList.add('award-scroll-pause');
        if (_awardScrollPauseTimer !== null) clearTimeout(_awardScrollPauseTimer);
        _awardScrollPauseTimer = setTimeout(() => {
            _awardScrollPauseTimer = null;
            tab.classList.remove('award-scroll-pause');
        }, 150);
    }, { passive: true, capture: true }); // capture: the tab scrolls inside <main>, whose scroll events do not bubble
}

/** Delay before immersive Award sky (ms), after navigating onto the tab. */
const AWARD_IMMERSIVE_SKY_DELAY_MS = 1500;

/** Matches `--award-sky-reveal-duration` + small buffer for fold cleanup */
const AWARD_SKY_EXIT_FALLBACK_MS = 1360;

let awardSkyDelayTimer = null;
let trimRejoinTimer = null;
let awardSkyExitFallbackTimer = null;
/** @type {{ sky: HTMLElement, handler: (e: AnimationEvent) => void } | null} */
let awardSkyExitAnimListener = null;

function clearAwardSkyDelayTimer() {
    if (awardSkyDelayTimer != null) {
        clearTimeout(awardSkyDelayTimer);
        awardSkyDelayTimer = null;
    }
}

function clearAwardSkyExitAnimation() {
    if (awardSkyExitFallbackTimer != null) {
        clearTimeout(awardSkyExitFallbackTimer);
        awardSkyExitFallbackTimer = null;
    }
    if (awardSkyExitAnimListener) {
        const { sky, handler } = awardSkyExitAnimListener;
        sky?.removeEventListener('animationend', handler);
        awardSkyExitAnimListener = null;
    }
}

/** Header height as a share of the sky, so the Award sky grows out of (and back into) the bar. */
function setAwardSkyOrigin(appScreen) {
    const band = document.getElementById('m-teacher-header')?.offsetHeight
        || document.getElementById('award-header-atmosphere')?.offsetHeight
        || 0;
    const sky = document.getElementById('award-immersive-sky');
    const tall = (sky?.offsetHeight || window.innerHeight || 1) * 1.28 || 1;
    const from = Math.min(0.5, Math.max(0.04, band / tall));
    appScreen.style.setProperty('--award-sky-from', from.toFixed(3));
    // Folding back, the sky's solid part (all but its soft 28vh edge) lands exactly on the bar.
    appScreen.style.setProperty('--award-sky-to', Math.min(0.64, Math.max(0.05, from * 1.28)).toFixed(3));
}

function finalizeAwardSkyOff(appScreen) {
    appScreen?.classList.remove('award-sky-active', 'award-sky-leaving');
}

const AWARD_SKY_FOLD_ANIMATION_NAMES = new Set(['awardImmersiveSkyFoldUp', 'awardImmersiveSkyFoldRm']);

/**
 * Full-viewport sky behind Award Stars (`#award-immersive-sky` + `.award-sky-active`).
 * Enter: delay + unfold when switching onto the tab from elsewhere.
 * Exit: fold back into the header band, then tear down (see `.award-sky-leaving`).
 * @param {string} tabId
 * @param {{ continueSession?: boolean }} [opts] — if true (e.g. class change while already on Award), do not reset timer or replay immersion.
 */
export function syncAwardImmersiveSky(tabId, opts = {}) {
    const appScreen = document.getElementById('app-screen');
    if (!appScreen) return;

    const continueSession = opts.continueSession === true;

    if (tabId !== 'award-stars-tab') {
        clearAwardSkyDelayTimer();

        if (appScreen.classList.contains('award-sky-leaving')) {
            return;
        }

        if (appScreen.classList.contains('award-sky-active')) {
            clearAwardSkyExitAnimation();
            setAwardSkyOrigin(appScreen);
            appScreen.classList.add('award-sky-leaving');

            const sky = document.getElementById('award-immersive-sky');
            const finishExit = () => {
                clearAwardSkyExitAnimation();
                finalizeAwardSkyOff(appScreen);
                // The header thread has just wrapped back into its gem: let the gem glimmer.
                appScreen.classList.add('gcq-trim-rejoin');
                clearTimeout(trimRejoinTimer);
                trimRejoinTimer = window.setTimeout(() => appScreen.classList.remove('gcq-trim-rejoin'), 900);
            };

            const handler = (e) => {
                if (e.target !== sky) return;
                if (!AWARD_SKY_FOLD_ANIMATION_NAMES.has(e.animationName)) return;
                finishExit();
            };

            if (sky) {
                awardSkyExitAnimListener = { sky, handler };
                sky.addEventListener('animationend', handler);
            }

            awardSkyExitFallbackTimer = window.setTimeout(finishExit, AWARD_SKY_EXIT_FALLBACK_MS);
            return;
        }

        clearAwardSkyExitAnimation();
        finalizeAwardSkyOff(appScreen);
        return;
    }

    clearAwardSkyExitAnimation();
    appScreen.classList.remove('award-sky-leaving', 'gcq-trim-rejoin');

    if (
        continueSession &&
        (appScreen.classList.contains('award-sky-active') || awardSkyDelayTimer != null)
    ) {
        return;
    }

    clearAwardSkyDelayTimer();
    appScreen.classList.remove('award-sky-active');

    const delayMs = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 0
        : AWARD_IMMERSIVE_SKY_DELAY_MS;

    if (delayMs === 0) {
        setAwardSkyOrigin(appScreen);
        appScreen.classList.add('award-sky-active');
        return;
    }

    awardSkyDelayTimer = window.setTimeout(() => {
        awardSkyDelayTimer = null;
        const visible = document.querySelector('.app-tab:not(.hidden)');
        if (visible?.id === 'award-stars-tab') {
            setAwardSkyOrigin(appScreen);
            appScreen.classList.add('award-sky-active');
        }
    }, delayMs);
}

/**
 * Core tab re-renders (leaderboards, home, shop, award, …) without Options first-visit
 * or duplicate Options rows. Used by showTab and by header class/league changes.
 */
export async function applyTabPrimaryRefresh(tabId, opts = {}) {
    if (!tabId) return;

    const { activateDataFeature, deactivateDataFeature } = await import('../../db/listeners.js');
    if (tabId !== 'about-tab') {
        activateDataFeature('assessments');
        activateDataFeature('attendance');
        if (tabId === 'guilds-tab' || tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab') {
            activateDataFeature('guilds');
        } else {
            deactivateDataFeature('guilds');
        }
    } else {
        deactivateDataFeature('assessments');
        deactivateDataFeature('attendance');
        deactivateDataFeature('guilds');
    }

    if (tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab' || tabId === 'guilds-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        findAndSetCurrentClass();
        updateCeremonyStatus(tabId);
    }

    if (tabId === 'class-leaderboard-tab') await renderClassLeaderboardTab({ freshVisit: true });
    if (tabId === 'student-leaderboard-tab') await renderStudentLeaderboardTab({ freshVisit: true });
    if (tabId === 'guilds-tab') await renderGuildsTab();
    if (tabId === 'manage-students-tab') renderManageStudentsTab();
    if (tabId === 'options-tab') {
        const classesSection = document.querySelector('[data-options-section="classes"]');
        if (classesSection && !classesSection.classList.contains('hidden')) {
            renderManageClassesTab();
        }
    }

    if (tabId === 'award-stars-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        resetAwardCardVisualSession();
        renderAwardStarsTab();
        findAndSetCurrentClass();
    }

    if (tabId === 'adventure-log-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        renderAdventureLogTab();
        findAndSetCurrentClass();
    }

    if (tabId === 'scholars-scroll-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        await scholarScroll.renderScholarsScrollTab(null, { subtleReenter: opts.subtleScrollEnter === true });
        findAndSetCurrentClass();
    }

    if (tabId === 'calendar-tab') {
        state.setAllAwardLogs(
            filterDocsForActiveYear(state.get('allAwardLogs'), state.get('schoolYearState')),
        );
        await ensureHistoryLoaded();
        renderCalendarTab();
    }

    if (tabId === 'about-tab') {
        // Opening Home plays the day/night ring's intro; background refreshes don't.
        requestDayRingIntro();
        renderHomeTab();
    }

    if (tabId === 'shop-tab') {
        const { initializeShopTab } = await import('../core/shop.js');
        await initializeShopTab();
    }
}

function patchOptionsTabForClassChange() {
    import('../core.js').then(m => {
        if (m.renderEconomyStudentSelect) m.renderEconomyStudentSelect();
    });
    renderStarManagerStudentSelect();
    renderFamiliarOptionsUi();
    if (canUseFeature('scholarScroll')) {
        renderAssessmentOptionsUi();
    }
    if (canUseFeature('quizOfTheWeek')) {
        renderQuizOptionsUi().catch(() => {});
    }
    if (canUseFeature('eliteAI')) {
        renderMarketManagerUi();
    }
    const hasAccessCenter = canUseFeature('parentAccess');
    if (hasAccessCenter) {
        renderAccessCenterUi();
    }
    renderClassEndDatesList();
}

/** Prefer the tab that is actually visible (not only localStorage). */
export async function refreshVisibleTabForGlobalClassChange() {
    const visible = document.querySelector('.app-tab:not(.hidden)');
    const tabId = visible?.id || localStorage.getItem('quest_last_active_tab') || 'about-tab';
    await applyTabPrimaryRefresh(tabId);
    if (tabId === 'reward-ideas-tab') {
        renderIdeasTabSelects();
    }
    if (tabId === 'options-tab') {
        patchOptionsTabForClassChange();
    }
    const fwModal = document.getElementById('fortunes-wheel-modal');
    if (fwModal && !fwModal.classList.contains('hidden')) {
        await refreshFortunesWheelModalFromGlobalClass();
    }

    const visibleAgain = document.querySelector('.app-tab:not(.hidden)');
    syncAwardImmersiveSky(visibleAgain?.id || '', { continueSession: true });
}

function getOptionsSubtabButtons() {
    return Array.from(document.querySelectorAll('#options-tab .options-subtab-btn'));
}

function optionsSubtabLabel(btn) {
    return (btn?.textContent || '').replace(/\s+/g, ' ').trim();
}

function setOptionsSubtabSelectOpen(open) {
    const trigger = document.getElementById('options-subtab-trigger');
    const menu = document.getElementById('options-subtab-menu');
    const wrap = document.getElementById('options-subtab-select');
    if (!trigger || !menu) return;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.classList.toggle('hidden', !open);
    wrap?.classList.toggle('is-open', open);
}

function syncOptionsSubtabSelect() {
    const trigger = document.getElementById('options-subtab-trigger');
    const iconEl = document.getElementById('options-subtab-trigger-icon');
    const labelEl = document.getElementById('options-subtab-trigger-label');
    const menu = document.getElementById('options-subtab-menu');
    const wrap = document.getElementById('options-subtab-select');
    if (!trigger || !menu) return;

    const visible = getOptionsSubtabButtons().filter((btn) => !btn.classList.contains('hidden'));
    const active = visible.find((btn) => btn.classList.contains('options-subtab-active')) || visible[0];
    const activeKey = active?.dataset.optionsTab || 'classes';

    if (wrap) wrap.dataset.activeTab = activeKey;
    if (iconEl) {
        const icon = active?.querySelector('i')?.className || 'fas fa-tools';
        iconEl.innerHTML = `<i class="${icon}"></i>`;
    }
    if (labelEl) labelEl.textContent = optionsSubtabLabel(active) || 'My Classes';
    const hintEl = document.getElementById('options-subtab-trigger-hint');
    if (hintEl) hintEl.textContent = active?.dataset.hint || '';

    menu.innerHTML = visible.map((btn) => {
        const key = btn.dataset.optionsTab;
        const icon = btn.querySelector('i')?.className || 'fas fa-circle';
        const label = optionsSubtabLabel(btn);
        const hint = btn.dataset.hint || '';
        const isActive = key === activeKey;
        return `<button type="button" class="options-subtab-select__option${isActive ? ' is-active' : ''}" data-options-tab="${key}" role="option" aria-selected="${isActive}">
            <span class="options-subtab-select__option-icon" aria-hidden="true"><i class="${icon}"></i></span>
            <span class="options-subtab-select__option-text">
                <span class="options-subtab-select__option-label">${label}</span>
                ${hint ? `<span class="options-subtab-select__option-hint">${hint}</span>` : ''}
            </span>
            ${isActive ? '<i class="fas fa-check options-subtab-select__check" aria-hidden="true"></i>' : ''}
        </button>`;
    }).join('');
}

function wireOptionsSubtabSelect() {
    const trigger = document.getElementById('options-subtab-trigger');
    const menu = document.getElementById('options-subtab-menu');
    const wrap = document.getElementById('options-subtab-select');
    if (!trigger || !menu || trigger.dataset.wired) return;
    trigger.dataset.wired = '1';

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = trigger.getAttribute('aria-expanded') === 'true';
        setOptionsSubtabSelectOpen(!open);
        if (!open) syncOptionsSubtabSelect();
    });

    menu.addEventListener('click', (event) => {
        const option = event.target.closest('[data-options-tab]');
        if (!option) return;
        const btn = document.querySelector(`#options-tab .options-subtab-btn[data-options-tab="${option.dataset.optionsTab}"]`);
        btn?.click();
        setOptionsSubtabSelectOpen(false);
    });

    document.addEventListener('click', (event) => {
        if (wrap && !wrap.contains(event.target)) {
            setOptionsSubtabSelectOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOptionsSubtabSelectOpen(false);
    });
}

// Profile: the staff badge beside the name field mirrors what is typed.
function syncTeacherBadge() {
    const input = document.getElementById('teacher-name-input');
    const nameEl = document.getElementById('ts-badge-name');
    const initialsEl = document.getElementById('ts-badge-initials');
    if (!input || !nameEl) return;
    const name = input.value.trim();
    nameEl.textContent = name || 'Your name';
    if (initialsEl) {
        const words = name.replace(/^(mr|mrs|ms|miss|dr|mx)\.?\s+/i, '').split(/\s+/).filter(Boolean);
        const initials = words.length > 1
            ? `${words[0][0]}${words[words.length - 1][0]}`
            : (words[0] || '?').slice(0, 2);
        initialsEl.textContent = initials.toUpperCase();
    }
}

export async function showOptionsSubtab(key) {
    await showTab('options-tab');
    const button = document.querySelector(`#options-tab .options-subtab-btn[data-options-tab="${key}"]`);
    if (!button || button.classList.contains('hidden')) return;
    button.click();
}

export async function showTab(tabName) {
    updateBottomNavGateState();

    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;

    // My Classes lives under Teacher Settings now
    if (tabId === 'my-classes-tab') {
        await showOptionsSubtab('classes');
        return;
    }

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

    syncAwardImmersiveSky(tabId);

    document.querySelectorAll('.nav-button[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Keep in sync with tab-fade-out / tab-fade-in in styles/transitions.css.
    const exitDuration = 200;
    const enterDuration = 400;

    // Every tab shares the one <main> scroller, so a new tab would otherwise open at the
    // previous tab's scroll depth. Reset at the moment the new tab is revealed.
    const resetTabScroll = () => {
        const scroller = nextTab.closest('main');
        if (scroller && scroller.scrollTop !== 0) scroller.scrollTo({ top: 0, behavior: 'instant' });
    };

    if (currentTab) {
        currentTab.classList.add('tab-animate-out');

        setTimeout(() => {
            currentTab.classList.add('hidden');
            currentTab.classList.remove('tab-animate-out');

            nextTab.classList.remove('hidden');
            resetTabScroll();
            nextTab.classList.add('tab-animate-in');

            setTimeout(() => {
                nextTab.classList.remove('tab-animate-in');
            }, enterDuration);

        }, exitDuration);
    } else {
        nextTab.classList.remove('hidden');
        resetTabScroll();
        nextTab.classList.add('tab-animate-in');
        setTimeout(() => {
            nextTab.classList.remove('tab-animate-in');
        }, enterDuration);
    }

    await applyTabPrimaryRefresh(tabId, { subtleScrollEnter: tabId === 'scholars-scroll-tab' });

    if (tabId === 'reward-ideas-tab') {
        renderIdeasTabSelects();
    }

    if (tabId === 'options-tab') {
        const hasAssessmentAccess = canUseFeature('scholarScroll');
        const hasAccessCenter = canUseFeature('parentAccess');
        const hasQuizFeature = canUseFeature('quizOfTheWeek');
        const hasMarketManager = canUseFeature('eliteAI');
        const assessmentsBtn = document.querySelector('#options-tab .options-subtab-btn[data-options-tab="assessments"]');
        const assessmentsSection = document.querySelector('#options-tab [data-options-section="assessments"]');
        const accessBtn = document.querySelector('#options-tab .options-subtab-btn[data-options-tab="access"]');
        const accessSection = document.querySelector('#options-tab [data-options-section="access"]');
        const quizBtn = document.querySelector('#options-tab .options-subtab-btn[data-options-tab="quiz"]');
        const quizSection = document.querySelector('#options-tab [data-options-section="quiz"]');
        const marketBtn = document.querySelector('#options-tab .options-subtab-btn[data-options-tab="market"]');
        const marketSection = document.querySelector('#options-tab [data-options-section="market"]');
        assessmentsBtn?.classList.toggle('hidden', !hasAssessmentAccess);
        accessBtn?.classList.toggle('hidden', !hasAccessCenter);
        quizBtn?.classList.toggle('hidden', !hasQuizFeature);
        marketBtn?.classList.toggle('hidden', !hasMarketManager);
        if (!hasAssessmentAccess) assessmentsSection?.classList.add('hidden');
        if (!hasAccessCenter) accessSection?.classList.add('hidden');
        if (!hasQuizFeature) quizSection?.classList.add('hidden');
        if (!hasMarketManager) marketSection?.classList.add('hidden');

        // Load teacher-owned settings; isolate failures so one broken renderer doesn't block the others
        import('../core.js').then(m => {
            try {
                m.renderClassEndDatesList?.();
            } catch (e) {
                console.warn('renderClassEndDatesList failed:', e);
            }
            try {
                m.renderEconomyStudentSelect?.();
            } catch (e) {
                console.warn('renderEconomyStudentSelect failed:', e);
            }
        });

        // FIX: Call this directly (it is defined in this file, not core.js)
        renderStarManagerStudentSelect();
        renderFamiliarOptionsUi();

        const teacherInput = document.getElementById('teacher-name-input');
        if (teacherInput) {
            teacherInput.value = state.get('currentTeacherName') || '';
            if (!teacherInput.dataset.badgeWired) {
                teacherInput.dataset.badgeWired = '1';
                teacherInput.addEventListener('input', syncTeacherBadge);
            }
            syncTeacherBadge();
        }
        if (hasAssessmentAccess) {
            renderAssessmentOptionsUi();
        }
        if (hasAccessCenter) {
            renderAccessCenterUi();
        }

        // Options subtabs: dropdown selector, active state, tier-aware Planning
        if (!window.__optionsSubtabsWired) {
            window.__optionsSubtabsWired = true;
            wireAccessCenterEvents();
            wireMarketManagerEvents();
            wireOptionsSubtabSelect();
            const buttons = getOptionsSubtabButtons();
            const sections = document.querySelectorAll('#options-tab [data-options-section]');
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
                syncOptionsSubtabSelect();
                if (key === 'classes') {
                    renderManageClassesTab();
                }
                if (key === 'assessments' && hasAssessmentAccess) {
                    renderAssessmentOptionsUi();
                }
                if (key === 'access' && hasAccessCenter) {
                    renderAccessCenterUi();
                }
                if (key === 'quiz' && hasQuizFeature) {
                    renderQuizOptionsUi();
                }
                if (key === 'market' && hasMarketManager) {
                    renderMarketManagerUi();
                }
                // Tier: Planning is Pro+. Show locked card or real content
                const hasPlanning = canUseFeature('schoolYearPlanner');
                if (planningLocked) planningLocked.classList.toggle('hidden', hasPlanning || key !== 'planning');
                if (planningContent) planningContent.classList.toggle('hidden', !hasPlanning || key !== 'planning');
                // Planning UI (holidays + class end dates) must refresh when this sub-tab is shown — async import on main options visit can race or skip if Holidays throws.
                if (key === 'planning' && hasPlanning) {
                    renderClassEndDatesList();
                }
            };

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.optionsTab || 'classes';
                    activate(key);
                    if (typeof playSound === 'function') playSound('click');
                });
            });
            if (planningLocked) {
                planningLocked.addEventListener('click', () => {
                    showUpgradePrompt({ feature: 'My Planning', tier: 'Pro', message: getUpgradeMessage('Pro', 'schoolYearPlanner') });
                });
                planningLocked.style.cursor = 'pointer';
            }
            const saveAssessmentSettingsBtn = document.getElementById('save-assessment-settings-btn');
            if (saveAssessmentSettingsBtn) {
                saveAssessmentSettingsBtn.addEventListener('click', () => {
                    handleSaveAssessmentSettingsFromOptions();
                });
            }
            activate('classes');
        }
        syncOptionsSubtabSelect();

        const summaryEl = document.getElementById('options-tier-summary');

        const rawTier = getTier();
        const pretty =
            rawTier === 'elite' ? 'Elite' :
            rawTier === 'pro' ? 'Pro' : 'Starter';

        if (summaryEl) {
            const summary = getTierSummary(rawTier);
            const badgeEmoji = rawTier === 'elite' ? '🌟' : rawTier === 'pro' ? '🚀' : '🔰';
            summaryEl.innerHTML = `
                <div class="ts-plan" data-tier="${rawTier}">
                    <div class="ts-plan__stub" aria-hidden="true">
                        <span class="ts-plan__emoji">${badgeEmoji}</span>
                        <span class="ts-plan__tier font-title">${pretty}</span>
                    </div>
                    <div class="ts-plan__body">
                        <p class="ts-plan__eyebrow">${summary.badge} · Current plan: ${pretty}</p>
                        <h3 class="font-title ts-plan__title">${summary.title}</h3>
                        <p class="ts-plan__text">${summary.body}</p>
                        <p class="ts-plan__foot"><i class="fas fa-circle-info" aria-hidden="true"></i> Subscription and billing changes are managed by the Secretary/admin.</p>
                    </div>
                </div>
            `;
        }
    }
}
