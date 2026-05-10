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
import { refreshFortunesWheelModalFromGlobalClass } from '../../features/fortunesWheel.js';
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

/**
 * Core tab re-renders (leaderboards, home, shop, award, …) without Options first-visit
 * or duplicate Options rows. Used by showTab and by header class/league changes.
 */
export async function applyTabPrimaryRefresh(tabId) {
    if (!tabId) return;

    if (tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab' || tabId === 'guilds-tab') {
        const { findAndSetCurrentClass } = await import('../core.js');
        findAndSetCurrentClass();
        updateCeremonyStatus(tabId);
    }

    if (tabId === 'class-leaderboard-tab') await renderClassLeaderboardTab();
    if (tabId === 'student-leaderboard-tab') await renderStudentLeaderboardTab();
    if (tabId === 'guilds-tab') await renderGuildsTab();
    if (tabId === 'my-classes-tab') renderManageClassesTab();
    if (tabId === 'manage-students-tab') renderManageStudentsTab();

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
        scholarScroll.renderScholarsScrollTab();
        findAndSetCurrentClass();
    }

    if (tabId === 'calendar-tab') {
        await ensureHistoryLoaded();
        renderCalendarTab();
    }

    if (tabId === 'about-tab') {
        renderHomeTab();
    }

    if (tabId === 'shop-tab') {
        import('../core/shop.js').then(m => m.initializeShopTab());
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
    const hasAccessCenter = canUseFeature('parentAccess') || canUseFeature('secretaryAccess') || state.get('currentUserRole') === 'secretary' || state.get('isSchoolAdmin');
    if (hasAccessCenter) {
        renderAccessCenterUi();
    }
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

    await applyTabPrimaryRefresh(tabId);

    if (tabId === 'reward-ideas-tab') {
        renderIdeasTabSelects();
    }

    if (tabId === 'options-tab') {
        const hasAssessmentAccess = canUseFeature('scholarScroll');
        const hasAccessCenter = canUseFeature('parentAccess') || canUseFeature('secretaryAccess') || state.get('currentUserRole') === 'secretary' || state.get('isSchoolAdmin');
        const hasQuizFeature = canUseFeature('quizOfTheWeek');
        const assessmentsBtn = document.querySelector('.options-subtab-btn[data-options-tab="assessments"]');
        const assessmentsSection = document.querySelector('[data-options-section="assessments"]');
        const accessBtn = document.querySelector('.options-subtab-btn[data-options-tab="access"]');
        const accessSection = document.querySelector('[data-options-section="access"]');
        const quizBtn = document.querySelector('.options-subtab-btn[data-options-tab="quiz"]');
        const quizSection = document.querySelector('[data-options-section="quiz"]');
        assessmentsBtn?.classList.toggle('hidden', !hasAssessmentAccess);
        assessmentsSection?.classList.toggle('hidden', !hasAssessmentAccess);
        accessBtn?.classList.toggle('hidden', !hasAccessCenter);
        accessSection?.classList.toggle('hidden', !hasAccessCenter);
        quizBtn?.classList.toggle('hidden', !hasQuizFeature);
        quizSection?.classList.toggle('hidden', !hasQuizFeature);

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
                if (key === 'quiz' && hasQuizFeature) {
                    renderQuizOptionsUi();
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

// =============================================================================
// Quiz of the Week Options UI
// =============================================================================

// Categories organised by quest level so suggestions are age-appropriate.
// Junior A = 7-8 yrs, Junior B = 8-9, A = 9-10, B = 10-11, C = 11-12, D = 12-13
const GRAMMAR_CATEGORIES = {
    'Junior A': [
        'Simple Present (I play / she plays)',
        'Is / Am / Are',
        'Singular & Plural',
        'Colors & Shapes',
        'Yes / No Questions',
        'Action Verbs (basic)',
        'Alphabet & Spelling'
    ],
    'Junior B': [
        'Simple Present',
        'Simple Past (basic — was/were/did)',
        'Can / Can\'t',
        'Have / Has',
        'Articles (a / an)',
        'Singular & Plural',
        'Yes / No Questions',
        'Prepositions (in / on / under)'
    ],
    'A': [
        'Simple Present',
        'Simple Past',
        'Present Continuous',
        'There is / There are',
        'Articles (a / an / the)',
        'Prepositions (in / on / at / under / next to)',
        'Comparatives (bigger, smaller, faster)',
        'Can / Could',
        'Wh- Questions (What, Where, Who, When)',
        'Imperatives',
        'Possessive Adjectives (my, your, his, her)'
    ],
    'B': [
        'Present Simple & Continuous',
        'Past Simple & Continuous',
        'Future (will / going to)',
        'Prepositions of Time & Place',
        'Articles',
        'Comparatives & Superlatives',
        'Question Formation',
        'Can / Should / Must',
        'Conjunctions (and / but / because / so)',
        'Countable & Uncountable Nouns',
        'Adverbs of Frequency (always, often, never)'
    ],
    'C': [
        'Present Perfect',
        'Past Simple vs Present Perfect',
        'Future Forms (will / going to / present continuous)',
        '1st Conditional (If … will)',
        'Modal Verbs (can / could / must / should / might)',
        'Passive Voice (basic)',
        'Relative Clauses (who / which / that)',
        'Prepositions',
        'Question Tags',
        'Reported Speech (basic)',
        'Gerunds vs Infinitives (intro)',
        'Conjunctions & Connectors'
    ],
    'D': [
        'All Tenses Review',
        '1st & 2nd Conditionals',
        'Modal Verbs (full range)',
        'Passive Voice',
        'Reported Speech',
        'Relative Clauses',
        'Gerunds & Infinitives',
        'Phrasal Verbs',
        'Question Formation',
        'Conjunctions & Discourse Markers',
        'Emphasis & Inversion'
    ]
};

const VOCABULARY_CATEGORIES = {
    'Junior A': [
        'Animals',
        'Colors & Shapes',
        'Numbers (1–20)',
        'Body Parts',
        'Classroom Objects',
        'Toys & Games',
        'Food (basic)',
        'Family Members',
        'Action Verbs (basic)'
    ],
    'Junior B': [
        'Animals (farm, wild, pets)',
        'Food & Drinks',
        'Classroom Objects',
        'Body Parts',
        'Family & Friends',
        'Colors & Numbers',
        'Daily Actions (eat, sleep, play, run)',
        'Clothes',
        'Weather & Seasons (basic)'
    ],
    'A': [
        'Animals',
        'Food & Drinks',
        'Weather & Seasons',
        'Sports & Hobbies',
        'House & Rooms',
        'Means of Transport',
        'School Subjects',
        'Daily Routines',
        'Clothes & Accessories',
        'Feelings & Emotions (basic)',
        'Days, Months & Time'
    ],
    'B': [
        'Food & Nutrition',
        'Sports & Hobbies',
        'Transport & Travel',
        'Jobs & Professions',
        'Nature & Environment',
        'Health & Body',
        'Technology (basic — computer, phone, internet)',
        'Holidays & Celebrations',
        'Emotions & Personality',
        'Shopping & Money',
        'House & Furniture',
        'Daily Routines'
    ],
    'C': [
        'Environment & Nature',
        'Technology & Media',
        'Sports & Fitness',
        'Travel & Tourism',
        'Health & Medicine',
        'Jobs & Careers',
        'Food & Nutrition',
        'Emotions & Character Traits',
        'Culture & Traditions',
        'Clothes & Fashion',
        'Science & Discovery',
        'Social Media & Communication'
    ],
    'D': [
        'Environment & Climate Change',
        'Technology & Innovation',
        'Global Issues & Current Events',
        'Health & Medicine',
        'Media & Communication',
        'Arts & Culture',
        'Science & Discovery',
        'Society & Everyday Life',
        'Business & Economy (basic)',
        'Idioms & Everyday Expressions',
        'Academic & Formal Vocabulary',
        'Compound Words & Word Formation'
    ]
};

const MIX_CATEGORIES = {
    'Junior A': [
        'Animals',
        'Colors & Shapes',
        'Classroom Objects',
        'Is / Am / Are',
        'Family Members',
        'Body Parts',
        'Simple Present',
        'Food (basic)',
        'Singular & Plural'
    ],
    'Junior B': [
        'Animals',
        'Food & Drinks',
        'Simple Present',
        'Can / Can\'t',
        'Family & Friends',
        'Body Parts',
        'Daily Actions',
        'Clothes',
        'Have / Has',
        'Weather & Seasons (basic)'
    ],
    'A': [
        'Animals',
        'Food & Drinks',
        'Weather & Seasons',
        'Simple Past',
        'Present Continuous',
        'Sports & Hobbies',
        'Daily Routines',
        'Prepositions',
        'Means of Transport',
        'Comparatives'
    ],
    'B': [
        'Past Simple & Continuous',
        'Future Forms',
        'Food & Travel',
        'Sports & Hobbies',
        'Comparatives & Superlatives',
        'Jobs & Professions',
        'Modal Verbs (can / should / must)',
        'Health & Body',
        'Question Formation',
        'Nature & Environment'
    ],
    'C': [
        'All Tenses',
        'Environment & Nature',
        '1st Conditional',
        'Technology & Media',
        'Modal Verbs',
        'Travel & Tourism',
        'Passive Voice (basic)',
        'Health & Medicine',
        'Relative Clauses',
        'Sports & Fitness',
        'Emotions & Character Traits'
    ],
    'D': [
        'Modal Verbs',
        'Passive Voice',
        'Global Issues',
        'Reported Speech',
        'Idioms & Expressions',
        'Conditionals',
        'Technology & Innovation',
        'Phrasal Verbs',
        'Gerunds & Infinitives',
        'Media & Society',
        'Academic Vocabulary',
        'Arts & Culture'
    ]
};

function getCategoriesForType(type, level) {
    const lvl = level || 'A';
    if (type === 'grammar') return GRAMMAR_CATEGORIES[lvl] || GRAMMAR_CATEGORIES['A'];
    if (type === 'vocabulary') return VOCABULARY_CATEGORIES[lvl] || VOCABULARY_CATEGORIES['A'];
    return MIX_CATEGORIES[lvl] || MIX_CATEGORIES['A'];
}

export async function renderQuizOptionsUi() {
    const quizContent = document.getElementById('options-quiz-content');
    const quizLocked = document.getElementById('options-quiz-locked');
    const hasQuiz = canUseFeature('quizOfTheWeek');

    if (quizLocked) quizLocked.classList.toggle('hidden', hasQuiz);
    if (quizContent) quizContent.classList.toggle('hidden', !hasQuiz);
    if (!hasQuiz) return;

    const classDisplay = document.getElementById('qow-class-display');
    const typeSelect     = document.getElementById('quiz-curriculum-type');  // hidden <select>
    const typePillsWrap  = document.getElementById('qow-type-pills');
    const categoriesChips = document.getElementById('quiz-categories-chips');
    const keywordsInput  = document.getElementById('quiz-keywords');
    const generateBtn    = document.getElementById('quiz-generate-btn');
    const generateLabel  = document.getElementById('quiz-generate-btn-label');
    const validationMsg  = document.getElementById('quiz-validation-msg');
    const statusArea     = document.getElementById('quiz-status-area');
    const statusIcon     = document.getElementById('quiz-status-icon');
    const statusText     = document.getElementById('quiz-status-text');
    const statusDetails  = document.getElementById('quiz-status-details');
    const statusBadge    = document.getElementById('qow-status-badge');
    const genProgress    = document.getElementById('qow-gen-progress');
    const genStep1       = document.getElementById('qow-gstep-1');
    const genStep2       = document.getElementById('qow-gstep-2');
    const genStep3       = document.getElementById('qow-gstep-3');
    const resetBtn       = document.getElementById('quiz-reset-btn');
    const historyArea    = document.getElementById('quiz-history-area');
    const historyList    = document.getElementById('quiz-history-list');
    const cardCurriculum = document.getElementById('qow-card-curriculum');
    const classMeta      = document.getElementById('qow-class-meta');
    const classLevelBadge = document.getElementById('qow-class-level-badge');
    const classMetaText  = document.getElementById('qow-class-meta-text');

    // Class comes from header (global selection)
    const classes = (state.get('allTeachersClasses') || []).sort((a, b) => a.name.localeCompare(b.name));

    // ── Type pills ──────────────────────────────────────────────────────────
    function setActivePill(type) {
        if (!typePillsWrap) return;
        typePillsWrap.querySelectorAll('.qow-type-pill').forEach(btn => {
            btn.classList.toggle('qow-type-pill-active', btn.dataset.type === type);
        });
        if (typeSelect) typeSelect.value = type;
    }

    typePillsWrap?.querySelectorAll('.qow-type-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            setActivePill(btn.dataset.type);
            renderCategories();
        });
    });

    // ── Category chips ───────────────────────────────────────────────────────
    function renderCategories() {
        if (!categoriesChips) return;
        const type = typeSelect?.value || 'mix';
        const classId = state.get('globalSelectedClassId');
        const classData = classes.find(c => c.id === classId);
        const level = classData?.questLevel || 'A';
        const categories = getCategoriesForType(type, level);
        categoriesChips.innerHTML = categories.map(cat => `
            <label class="qow-chip-label">
                <input type="checkbox" value="${cat}" class="qow-chip-check quiz-category-checkbox" />
                <span>${cat}</span>
            </label>
        `).join('');
    }

    renderCategories();

    // ── Class selector ───────────────────────────────────────────────────────
    function showClassMeta(classData) {
        if (!classData || !classMeta) return;
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const scheduleStr = (classData.scheduleDays || [])
            .map(d => days[d] || d).join(', ');
        const timeStr = classData.timeStart
            ? `${classData.timeStart}${classData.timeEnd ? '–' + classData.timeEnd : ''}`
            : '';
        if (classLevelBadge) classLevelBadge.textContent = `Level ${classData.questLevel || '?'}`;
        if (classMetaText) {
            classMetaText.textContent = [scheduleStr, timeStr].filter(Boolean).join(' · ');
        }
        classMeta.classList.remove('hidden');
    }

    function hideClassMeta() {
        classMeta?.classList.add('hidden');
    }

    async function syncQuizToHeaderClass() {
        const classId = state.get('globalSelectedClassId');
        if (classDisplay) {
            const cd = classes.find(c => c.id === classId);
            classDisplay.textContent = cd
                ? `${cd.logo || ''} ${cd.name} (${cd.questLevel || ''})`.trim()
                : 'Choose a class from the header…';
        }
        if (validationMsg) { validationMsg.classList.add('hidden'); validationMsg.textContent = ''; }

        if (!classId) {
            generateBtn.disabled = true;
            cardCurriculum?.classList.add('qow-card-disabled');
            statusArea?.classList.add('hidden');
            historyArea?.classList.add('hidden');
            hideClassMeta();
            renderCategories();
            return;
        }

        const classData = classes.find(c => c.id === classId);
        showClassMeta(classData);
        cardCurriculum?.classList.remove('qow-card-disabled');
        generateBtn.disabled = false;

        setActivePill('mix');
        if (keywordsInput) keywordsInput.value = '';
        renderCategories();

        try {
            const { getQuizForClass } = await import('../../db/actions/quizOfTheWeek.js');
            const existingQuiz = await getQuizForClass(classId);
            if (existingQuiz?.curriculum) {
                const c = existingQuiz.curriculum;
                if (c.type) { setActivePill(c.type); renderCategories(); }
                if (c.categories?.length) {
                    document.querySelectorAll('.quiz-category-checkbox').forEach(cb => {
                        cb.checked = c.categories.includes(cb.value);
                    });
                }
                if (keywordsInput && c.keywords != null) keywordsInput.value = c.keywords;
            }
        } catch (_) { /* non-fatal */ }

        await refreshQuizStatus(classId);
    }

    await syncQuizToHeaderClass();

    // ── Generate button ──────────────────────────────────────────────────────
    generateBtn?.addEventListener('click', async () => {
        const classId = state.get('globalSelectedClassId');
        if (!classId) return;

        const selectedCategories = [...document.querySelectorAll('.quiz-category-checkbox:checked')].map(cb => cb.value);
        const type = typeSelect?.value || 'mix';
        const keywords = keywordsInput?.value?.trim() || '';

        if (validationMsg) { validationMsg.classList.add('hidden'); validationMsg.textContent = ''; }

        if (selectedCategories.length === 0 && !keywords) {
            if (validationMsg) {
                validationMsg.textContent = 'Please tick at least one topic or write a custom focus before generating.';
                validationMsg.classList.remove('hidden');
            }
            return;
        }

        const classData = classes.find(c => c.id === classId);
        const questLevel = classData?.questLevel || 'A';

        // ── Show generation UI ──
        generateBtn.disabled = true;
        if (generateLabel) generateLabel.textContent = 'Generating…';
        generateBtn.querySelector('i').className = 'fas fa-spinner fa-spin';

        setStatusState('generating');
        if (genProgress) genProgress.classList.remove('hidden');
        // Restart progress bar animation
        if (genProgress) {
            const fill = genProgress.querySelector('.qow-gen-progress-fill');
            if (fill) { fill.style.animation = 'none'; void fill.offsetHeight; fill.style.animation = ''; }
        }
        setGenStep(1);

        try {
            const { saveQuizCurriculum, generateQuizQuestions } = await import('../../db/actions/quizOfTheWeek.js');

            await saveQuizCurriculum(classId, { type, categories: selectedCategories, keywords, questLevel });

            setGenStep(2);
            const result = await generateQuizQuestions(classId);
            setGenStep(3);

            // Small pause so the teacher sees "Saving" before we switch
            await new Promise(r => setTimeout(r, 700));

            if (genProgress) genProgress.classList.add('hidden');
            setStatusState('ready', {
                text: `Quiz ready! ${result.questionCount} questions${result.imageCount ? ` (${result.imageCount} with images)` : ''}.`,
                sub: `The play button will appear on the class's first lesson day of the week. ✨`
            });

            await refreshQuizStatus(classId);

        } catch (e) {
            console.error('Quiz generation failed:', e);
            if (genProgress) genProgress.classList.add('hidden');
            setStatusState('error', {
                text: 'Generation failed.',
                sub: String(e.message || '').slice(0, 180)
            });
        }

        generateBtn.disabled = false;
        if (generateLabel) generateLabel.textContent = 'Re-generate Quiz';
        generateBtn.querySelector('i').className = 'fas fa-rotate-right';
    });

    // ── Helpers: set status state ────────────────────────────────────────────
    function setStatusState(type, opts = {}) {
        if (!statusArea) return;
        statusArea.classList.remove('hidden', 'qow-status-ready', 'qow-status-active', 'qow-status-done', 'qow-status-error');

        const map = {
            generating: { emoji: '🤖', title: opts.text || 'AI is crafting questions…',
                          sub: opts.sub || 'This takes 30–60 seconds. Please wait.', cls: '' },
            ready:      { emoji: '✅', title: opts.text || 'Quiz ready!',
                          sub: opts.sub || 'The play button appears on the first lesson day.', cls: 'qow-status-ready' },
            active:     { emoji: '🟢', title: opts.text || 'Quiz is live!',
                          sub: opts.sub || 'Students can play now.', cls: 'qow-status-active' },
            completed:  { emoji: '🏆', title: opts.text || 'Quiz completed!',
                          sub: opts.sub || 'See results below.', cls: 'qow-status-done' },
            pending:    { emoji: '📝', title: opts.text || 'Curriculum saved — not yet generated.',
                          sub: opts.sub || 'Hit "Generate" when ready.', cls: '' },
            error:      { emoji: '❌', title: opts.text || 'Something went wrong.',
                          sub: opts.sub || '', cls: 'qow-status-error' },
        };
        const cfg = map[type] || map.pending;
        if (statusIcon)   statusIcon.textContent  = cfg.emoji;
        if (statusText)   statusText.textContent  = cfg.title;
        if (statusDetails) statusDetails.textContent = cfg.sub;
        if (cfg.cls) statusArea.classList.add(cfg.cls);
        if (statusBadge) statusBadge.classList.add('hidden');
    }

    function setGenStep(n) {
        [genStep1, genStep2, genStep3].forEach((el, i) => {
            if (!el) return;
            el.classList.remove('active', 'done');
            if (i + 1 < n) el.classList.add('done');
            else if (i + 1 === n) el.classList.add('active');
        });
    }


    async function refreshQuizStatus(classId) {
        try {
            const { getQuizForClass, getQuizHistory } = await import('../../db/actions/quizOfTheWeek.js');
            const quiz = await getQuizForClass(classId);

            if (quiz) {
                const qCount = quiz.questions?.length || 0;
                const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' };

                const statusMap = {
                    pending: {
                        type: 'pending',
                        text: 'Curriculum saved — quiz not yet generated.',
                        sub: 'Hit "Generate" to create the questions.',
                        badge: null
                    },
                    generating: {
                        type: 'generating',
                        text: 'Generating quiz…',
                        sub: 'This may take 30–60 seconds.',
                        badge: null
                    },
                    ready: {
                        type: 'ready',
                        text: `Quiz ready — ${qCount} question${qCount !== 1 ? 's' : ''}!`,
                        sub: quiz.curriculum
                            ? `${quiz.curriculum.type?.toUpperCase()} · ${(quiz.curriculum.categories || []).join(', ') || quiz.curriculum.keywords || ''}`
                            : 'The play button will appear on the first lesson day. ✨',
                        badge: { label: '✅ Ready', cls: 'qow-pill-ready' }
                    },
                    active: {
                        type: 'active',
                        text: `Quiz is live! ${qCount} questions available.`,
                        sub: 'Students can play right now from the dashboard.',
                        badge: { label: '🟢 Live', cls: 'qow-pill-active' }
                    },
                    completed: {
                        type: 'completed',
                        text: `Quiz completed ${tierEmoji[quiz.results?.tier] || '🏆'} ${(quiz.results?.tier || '').toUpperCase()}`,
                        sub: `${quiz.results?.firstTryCorrectPct ?? 0}% first-try accuracy · ${qCount} questions`,
                        badge: { label: '🏆 Done', cls: 'qow-pill-done' }
                    }
                };

                const cfg = statusMap[quiz.status] || { type: 'pending', text: 'Quiz status: ' + quiz.status, sub: '' };
                setStatusState(cfg.type, { text: cfg.text, sub: cfg.sub });

                // Show status badge pill
                if (statusBadge && cfg.badge) {
                    statusBadge.textContent = cfg.badge.label;
                    statusBadge.className = `qow-status-pill ${cfg.badge.cls}`;
                    statusBadge.classList.remove('hidden');
                } else if (statusBadge) {
                    statusBadge.classList.add('hidden');
                }

                // Show reset button only for pending/ready states
                const canReset = quiz.status === 'pending' || quiz.status === 'ready';
                if (resetBtn) resetBtn.classList.toggle('hidden', !canReset);

                // Update generate button label
                if (generateLabel && (quiz.status === 'ready' || quiz.status === 'pending')) {
                    generateLabel.textContent = 'Re-generate Quiz';
                    const icon = generateBtn?.querySelector('i');
                    if (icon) icon.className = 'fas fa-rotate-right';
                }
            } else {
                setStatusState('pending', {
                    text: 'No quiz set for this week.',
                    sub: 'Select your topics above and hit Generate!'
                });
                if (resetBtn) resetBtn.classList.add('hidden');
                if (statusBadge) statusBadge.classList.add('hidden');
            }

            // ── History ──────────────────────────────────────────────────────
            const history = await getQuizHistory(classId, 5);
            if (history?.length) {
                historyArea?.classList.remove('hidden');
                if (historyList) {
                    const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' };
                    const tierCls   = { legendary: 'qow-tier-legendary', epic: 'qow-tier-epic', rare: 'qow-tier-rare', common: 'qow-tier-common', heroic: 'qow-tier-heroic' };
                    historyList.innerHTML = history.map(h => {
                        const tier = h.results?.tier || 'common';
                        const pct  = h.results?.firstTryCorrectPct ?? 0;
                        const qc   = h.results?.totalQuestions || 0;
                        return `
                        <div class="qow-history-item">
                            <span class="qow-history-week">Week ${h.weekKey}</span>
                            <span class="qow-tier-badge ${tierCls[tier] || 'qow-tier-common'}">${tierEmoji[tier] || ''} ${tier.toUpperCase()}</span>
                            <span class="qow-history-pct">${pct}%</span>
                            <span class="qow-history-q">${qc} Q</span>
                        </div>`;
                    }).join('');
                }
            } else {
                historyArea?.classList.add('hidden');
            }

        } catch (e) {
            console.warn('Failed to refresh quiz status:', e);
        }
    }

    // ── Reset (delete) button ────────────────────────────────────────────────
    resetBtn?.addEventListener('click', async () => {
        const classId = state.get('globalSelectedClassId');
        if (!classId) return;
        if (!confirm("Delete this week's quiz for this class? You can then re-generate with a new or updated curriculum.")) return;

        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Deleting…';
        try {
            const { deleteQuizForClass } = await import('../../db/actions/quizOfTheWeek.js');
            await deleteQuizForClass(classId);

            // Reset form
            setActivePill('mix');
            renderCategories();
            if (keywordsInput) keywordsInput.value = '';
            if (validationMsg) { validationMsg.classList.add('hidden'); validationMsg.textContent = ''; }
            statusArea?.classList.add('hidden');
            if (generateLabel) generateLabel.textContent = 'Generate This Week\'s Quiz';
            const icon = generateBtn?.querySelector('i');
            if (icon) icon.className = 'fas fa-wand-magic-sparkles';
        } catch (e) {
            console.error('Failed to delete quiz:', e);
            alert('Failed to delete quiz: ' + (e.message || 'Unknown error'));
        }
        resetBtn.disabled = false;
        resetBtn.innerHTML = '<i class="fas fa-rotate-left mr-1"></i> Delete &amp; Reset This Week\'s Quiz';
    });
}
