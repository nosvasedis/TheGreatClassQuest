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
import { renderAwardStarsTab, resetAwardCardVisualSession } from './award.js';
import { renderAdventureLogTab } from './log.js';
import {
    handleSaveSchoolNameFromOptions,
    renderAssessmentOptionsUi,
    handleSaveAssessmentSettingsFromOptions,
    initializeSchoolLocationOptionsUi,
    handleSearchSchoolLocationFromOptions,
    handleSchoolLocationResultChange,
    handleSaveSchoolLocationFromOptions
} from '../../db/actions/school.js';
import { renderCalendarTab } from './selectors.js';
import { renderIdeasTabSelects, renderStarManagerStudentSelect } from './ideas.js';
import { canUseFeature, getTier, getSubscriptionSnapshot } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { GATED_TABS, TAB_FEATURE_FLAGS, getTierSummary, getUpgradeMessage } from '../../config/tiers/features.js';
import { renderFamiliarOptionsUi } from '../../features/familiars.js';
import { renderAccessCenterUi, wireAccessCenterEvents } from '../../features/accessManagement.js';

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
        resetAwardCardVisualSession();
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
        const hasAssessmentAccess = canUseFeature('scholarScroll');
        const hasAccessCenter = canUseFeature('parentAccess') || canUseFeature('secretaryAccess') || state.get('currentUserRole') === 'secretary' || state.get('isSchoolAdmin');
        const assessmentsBtn = document.querySelector('.options-subtab-btn[data-options-tab="assessments"]');
        const assessmentsSection = document.querySelector('[data-options-section="assessments"]');
        const accessBtn = document.querySelector('.options-subtab-btn[data-options-tab="access"]');
        const accessSection = document.querySelector('[data-options-section="access"]');
        assessmentsBtn?.classList.toggle('hidden', !hasAssessmentAccess);
        assessmentsSection?.classList.toggle('hidden', !hasAssessmentAccess);
        accessBtn?.classList.toggle('hidden', !hasAccessCenter);
        accessSection?.classList.toggle('hidden', !hasAccessCenter);

        // Load holidays and the new economy selector
        import('../core.js').then(m => {
            if (m.renderHolidayList) m.renderHolidayList();
            if (m.renderClassEndDatesList) m.renderClassEndDatesList();
            if (m.renderEconomyStudentSelect) m.renderEconomyStudentSelect();
        });

        // FIX: Call this directly (it is defined in this file, not core.js)
        renderStarManagerStudentSelect();
        renderFamiliarOptionsUi();

        const teacherInput = document.getElementById('teacher-name-input');
        if (teacherInput) {
            teacherInput.value = state.get('currentTeacherName') || '';
        }
        const schoolInput = document.getElementById('options-school-name-input');
        if (schoolInput) {
            schoolInput.value = state.get('schoolName') || constants.DEFAULT_SCHOOL_NAME;
        }
        initializeSchoolLocationOptionsUi();
        if (hasAssessmentAccess) {
            renderAssessmentOptionsUi();
        }
        if (hasAccessCenter) {
            renderAccessCenterUi();
        }

        // Options subtabs: beautiful bar, active state, tier-aware Planning
        if (!window.__optionsSubtabsWired) {
            window.__optionsSubtabsWired = true;
            wireAccessCenterEvents();
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
                if (key === 'assessments' && hasAssessmentAccess) {
                    renderAssessmentOptionsUi();
                }
                if (key === 'access' && hasAccessCenter) {
                    renderAccessCenterUi();
                }
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
            const saveAssessmentSettingsBtn = document.getElementById('save-assessment-settings-btn');
            if (saveAssessmentSettingsBtn) {
                saveAssessmentSettingsBtn.addEventListener('click', () => {
                    handleSaveAssessmentSettingsFromOptions();
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
                            <button id="pricing-info-btn" class="ml-2 w-5 h-5 rounded-full bg-sky-200 hover:bg-sky-300 text-sky-600 flex items-center justify-center transition-colors" title="View all plans and pricing">
                                <i class="fas fa-info text-xs"></i>
                            </button>
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

        const capitalizeTier = (tier) => {
            const value = String(tier || '').trim().toLowerCase();
            if (!value) return 'Unknown';
            return value.charAt(0).toUpperCase() + value.slice(1);
        };
        const formatBillingDate = (iso) => {
            if (!iso) return '';
            const candidate = String(iso).includes('T') ? iso : `${iso}T12:00:00Z`;
            const d = new Date(candidate);
            return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        };
        const formatRemaining = (iso) => {
            if (!iso) return '';
            const candidate = String(iso).includes('T') ? iso : `${iso}T12:00:00Z`;
            const time = new Date(candidate).getTime();
            if (Number.isNaN(time)) return '';
            const diff = time - Date.now();
            const days = Math.ceil(diff / 86400000);
            if (days > 1) return `${days} days left`;
            if (days === 1) return '1 day left';
            if (days === 0) return 'ends today';
            return '';
        };
        const buildFactPill = (label, text, tone = 'slate') => {
            const tones = {
                slate: 'bg-slate-50 border-slate-200 text-slate-700',
                indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                amber: 'bg-amber-50 border-amber-200 text-amber-700',
                rose: 'bg-rose-50 border-rose-200 text-rose-700',
            };
            const cls = tones[tone] || tones.slate;
            return `
                <div class="rounded-xl border px-3 py-2 ${cls}">
                    <p class="text-[11px] font-bold uppercase tracking-wide opacity-80 mb-0.5">${label}</p>
                    <p class="text-sm font-medium">${text}</p>
                </div>
            `;
        };

        let billingUrl = (constants.BILLING_BASE_URL || '').trim().replace(/\/$/, '');
        if (billingUrl && !/^https?:\/\//i.test(billingUrl)) billingUrl = 'https://' + billingUrl;
        const schoolId = constants.BILLING_SCHOOL_ID || constants.firebaseConfig?.projectId || '';
        const manageWrap = document.getElementById('options-subscription-manage-wrap');
        const manageBtn = document.getElementById('options-manage-subscription-btn');
        if (manageWrap && manageBtn) {
            if (billingUrl && schoolId) {
                manageWrap.classList.remove('hidden');
                const detailsEl = document.getElementById('options-subscription-details');
                const factsEl = document.getElementById('options-subscription-facts');
                const sourceEl = document.getElementById('options-subscription-source');
                // Load accurate subscription details (period end, cancel-at-period-end, etc.)
                (async () => {
                    const runtime = getSubscriptionSnapshot() || {};
                    const runtimeTier = capitalizeTier(runtime?.tier || getTier());
                    const manualControlled = Boolean(runtime?.source === 'manual' || runtime?.startsAt || runtime?.endsAt || runtime?.notes);
                    const updateStatusCard = (stripeInfo = null, stripeError = false) => {
                        const facts = [];

                        if (runtime?.isGracePeriod && runtime?.graceEndsAt) {
                            if (detailsEl) detailsEl.textContent = `Starter grace day is active until ${formatBillingDate(runtime.graceEndsAt)}.`;
                            facts.push(buildFactPill('Access', `GCQ is temporarily unlocked for first-time setup.`, 'emerald'));
                        } else if (runtime?.tier === 'expired') {
                            if (detailsEl) detailsEl.textContent = runtime?.endsAt
                                ? `${runtimeTier} access ended on ${formatBillingDate(runtime.endsAt)}.`
                                : `${runtimeTier} access has ended.`;
                        } else if (runtime?.tier === 'pending') {
                            if (detailsEl) detailsEl.textContent = 'This school is currently locked behind the paywall.';
                        } else if (detailsEl) {
                            const endText = runtime?.endsAt ? ` until ${formatBillingDate(runtime.endsAt)}` : '';
                            detailsEl.textContent = `${runtimeTier} access is active${endText}.`;
                        }

                        if (runtime?.startsAt) {
                            facts.push(buildFactPill('Starts', formatBillingDate(runtime.startsAt), 'indigo'));
                        }
                        if (runtime?.endsAt && runtime?.tier !== 'expired') {
                            const remaining = formatRemaining(runtime.endsAt);
                            facts.push(buildFactPill('Current access window', `${formatBillingDate(runtime.endsAt)}${remaining ? ` • ${remaining}` : ''}`, runtime?.source === 'manual' ? 'amber' : 'indigo'));
                        }
                        if (runtime?.notes) {
                            facts.push(buildFactPill('Admin note', runtime.notes, 'amber'));
                        }

                        if (stripeInfo?.hasSubscription && stripeInfo?.tier) {
                            const stripeTier = capitalizeTier(stripeInfo.tier);
                            const stripeEnd = formatBillingDate(stripeInfo.currentPeriodEnd);
                            let stripeText = `${stripeTier} in Stripe`;
                            if (stripeInfo.cancelAtPeriodEnd && stripeEnd) {
                                stripeText += ` • ends ${stripeEnd}`;
                            } else if (stripeEnd) {
                                stripeText += ` • renews ${stripeEnd}`;
                            } else {
                                stripeText += ' • active';
                            }
                            facts.push(buildFactPill('Stripe', stripeText, 'emerald'));
                        } else if (stripeError) {
                            facts.push(buildFactPill('Stripe', 'Could not load live Stripe details right now.', 'rose'));
                        } else {
                            facts.push(buildFactPill('Stripe', 'No active paid subscription found in Stripe.', manualControlled ? 'amber' : 'slate'));
                        }

                        if (factsEl) {
                            factsEl.innerHTML = facts.join('');
                        }
                        if (sourceEl) {
                            if (manualControlled && stripeInfo?.hasSubscription) {
                                sourceEl.textContent = 'Current app access includes a manual school override, while Stripe still shows a paid subscription separately.';
                            } else if (manualControlled) {
                                sourceEl.textContent = 'Current app access is being controlled by a manual school setting saved in Firestore.';
                            } else if (stripeInfo?.hasSubscription) {
                                sourceEl.textContent = 'Current app access matches the paid Stripe subscription.';
                            } else {
                                sourceEl.textContent = 'No Stripe subscription or manual access window is active right now.';
                            }
                        }
                    };

                    updateStatusCard(null, false);
                    try {
                        const r = await fetch(billingUrl + '/subscription-info?schoolId=' + encodeURIComponent(schoolId), {
                            headers: { 'ngrok-skip-browser-warning': '1' }
                        });
                        if (!r.ok) {
                            updateStatusCard(null, true);
                            return;
                        }
                        const data = await r.json().catch(() => ({}));
                        updateStatusCard(data, false);
                    } catch {
                        updateStatusCard(null, true);
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
