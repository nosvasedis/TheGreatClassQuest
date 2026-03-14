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
import {
    handleSaveSchoolNameFromOptions,
    initializeSchoolLocationOptionsUi,
    handleSearchSchoolLocationFromOptions,
    handleSchoolLocationResultChange,
    handleSaveSchoolLocationFromOptions
} from '../../db/actions/school.js';
import { renderCalendarTab } from './selectors.js';
import { renderIdeasTabSelects, renderStarManagerStudentSelect } from './ideas.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { GATED_TABS, TAB_FEATURE_FLAGS, getTierSummary, getUpgradeMessage } from '../../config/tiers/features.js';

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
            btn.title = `${gate.feature} requires ${gate.tier}.`;
            return;
        }

        btn.removeAttribute('data-locked-tier');
        btn.removeAttribute('title');
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('gcq-subscription-updated', updateBottomNavGateState);
}

export async function showTab(tabName) {
    updateBottomNavGateState();

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
        initializeSchoolLocationOptionsUi();

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
            const searchSchoolLocationBtn = document.getElementById('search-school-location-btn');
            if (searchSchoolLocationBtn) {
                searchSchoolLocationBtn.addEventListener('click', () => {
                    handleSearchSchoolLocationFromOptions();
                });
            }
            const schoolLocationInput = document.getElementById('options-school-location-search');
            if (schoolLocationInput) {
                schoolLocationInput.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    handleSearchSchoolLocationFromOptions();
                });
            }
            const schoolLocationResults = document.getElementById('options-school-location-results');
            if (schoolLocationResults) {
                schoolLocationResults.addEventListener('change', () => {
                    handleSchoolLocationResultChange();
                });
            }
            const saveSchoolLocationBtn = document.getElementById('save-school-location-btn');
            if (saveSchoolLocationBtn) {
                saveSchoolLocationBtn.addEventListener('click', () => {
                    handleSaveSchoolLocationFromOptions();
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

        let billingUrl = (constants.BILLING_BASE_URL || '').trim().replace(/\/$/, '');
        if (billingUrl && !/^https?:\/\//i.test(billingUrl)) billingUrl = 'https://' + billingUrl;
        const schoolId = constants.BILLING_SCHOOL_ID || constants.firebaseConfig?.projectId || '';
        const manageWrap = document.getElementById('options-subscription-manage-wrap');
        const manageBtn = document.getElementById('options-manage-subscription-btn');
        if (manageWrap && manageBtn) {
            if (billingUrl && schoolId) {
                manageWrap.classList.remove('hidden');
                const detailsEl = document.getElementById('options-subscription-details');
                const formatDate = (iso) => {
                    if (!iso) return '';
                    const d = new Date(iso + 'T12:00:00Z');
                    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                };
                // Load accurate subscription details (period end, cancel-at-period-end, etc.)
                (async () => {
                    const fallbackTier = (() => {
                        const t = getTier();
                        return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
                    })();
                    const fallbackMsg = fallbackTier
                        ? `${fallbackTier} • Restart the billing server to see renewal date.`
                        : 'Subscription details unavailable.';
                    try {
                        const r = await fetch(billingUrl + '/subscription-info?schoolId=' + encodeURIComponent(schoolId), {
                            headers: { 'ngrok-skip-browser-warning': '1' }
                        });
                        if (!r.ok) {
                            if (detailsEl) detailsEl.textContent = fallbackMsg;
                            return;
                        }
                        const data = await r.json().catch(() => ({}));
                        if (detailsEl) {
                            if (!data.hasSubscription || !data.tier) {
                                detailsEl.textContent = 'No active subscription.';
                                return;
                            }
                            const tierCap = (data.tier || 'pro').charAt(0).toUpperCase() + (data.tier || '').slice(1);
                            const endDate = formatDate(data.currentPeriodEnd);
                            if (data.cancelAtPeriodEnd && endDate) {
                                detailsEl.textContent = `${tierCap} • Cancels at end of period on ${endDate}.`;
                            } else if (data.status === 'canceled' && data.canceledAt) {
                                detailsEl.textContent = `${tierCap} • Ended on ${formatDate(data.canceledAt)}.`;
                            } else if (endDate) {
                                detailsEl.textContent = `${tierCap} • Renews on ${endDate}.`;
                            } else {
                                detailsEl.textContent = `${tierCap} • Active subscription.`;
                            }
                        }
                    } catch {
                        if (detailsEl) detailsEl.textContent = fallbackMsg;
                    }
                })();
                // Health check: if billing server is unreachable, show hint and disable button
                (async () => {
                    try {
                        const r = await fetch(billingUrl + '/health', {
                            headers: { 'ngrok-skip-browser-warning': '1' }
                        });
                        if (!r.ok) throw new Error('Unreachable');
                        manageWrap.querySelector('[data-billing-hint]')?.remove();
                    } catch {
                        const hint = document.createElement('p');
                        hint.setAttribute('data-billing-hint', '');
                        hint.className = 'text-xs text-amber-600 mt-1';
                        hint.textContent = 'Billing server unreachable. Run node billing/server.js (port 3333) and point ngrok at it.';
                        manageBtn.after(hint);
                        manageBtn.disabled = true;
                    }
                })();
                manageBtn.onclick = async () => {
                    try {
                        const res = await fetch(billingUrl + '/create-portal-session', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'ngrok-skip-browser-warning': '1'
                            },
                            body: JSON.stringify({ schoolId, returnUrl: window.location.href })
                        });
                        const contentType = res.headers.get('Content-Type') || '';
                        if (!res.ok) {
                            const msg = contentType.includes('application/json')
                                ? (await res.json().catch(() => ({}))).error
                                : null;
                            const hint = res.status === 404
                                ? ' Start the billing server (e.g. node billing/server.js on port 3333) and point ngrok at that port — not at the app.'
                                : '';
                            modals.showModal('Subscription', msg || ('Could not open subscription management.' + hint), null, 'OK', 'Close');
                            return;
                        }
                        if (!contentType.includes('application/json')) {
                            modals.showModal('Subscription', 'Could not open subscription management. Invalid response from server.', null, 'OK', 'Close');
                            return;
                        }
                        const data = await res.json();
                        if (data.url) window.location.href = data.url;
                        else modals.showModal('Subscription', data.error || 'Could not open subscription management.', null, 'OK', 'Close');
                    } catch (e) {
                        console.error(e);
                        modals.showModal('Subscription', 'Could not open subscription management. Try again later.', null, 'OK', 'Close');
                    }
                };
            } else {
                manageWrap.classList.add('hidden');
            }
        }
    }
}
