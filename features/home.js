import { db, doc, getDoc } from '../firebase.js';
import * as ceremony from '../features/ceremony.js';
import { resolvePendingCeremonyMonth } from './ceremonyDomain.js';
import * as state from '../state.js';
import { normalizeQuestType, QUEST_TYPE_LABELS } from './specialQuestEngine.js';
import { isSpecialQuestType } from './specialQuestEngine.js';
import * as utils from '../utils.js';
import * as tabs from '../ui/tabs.js';
import * as modals from '../ui/modals.js';
import { wrapAvatarWithLevelUpIndicator } from '../ui/core/avatar.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as grandGuildCeremony from '../features/grandGuildCeremony.js';
import { DEFAULT_SCHOOL_NAME } from '../constants.js';
import { loadTeacherJourneyState, markTeacherGuideSeen } from './teacherJourney.js';
import { getNextAssessmentOccurrenceForToday, getUpcomingScheduledAssessment } from './assessmentConfig.js';
import { shouldShowQuizButton } from './quizOfTheWeek.js';
import { sumLiveMonthlyStarsFromStudentScores } from './awardLogReasonMeta.js';
import { escapeHtml } from './roles/shared.js';
import {
    getScheduleEmptyStateMarkupClass,
    resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';
import { getGreetingHillsHtml, getDayRingEmblemHtml, startDayRingClock } from './homeGreetingScene.js';
import { isSchoolYearAwaitingOpen } from '../utils/schoolYear.js';
import { sumLiveYearGoldFromAppState } from '../utils/yearGold.js';
import {
    HEADER_WEATHER_CLASSES,
    headerClassesForTheme,
    resolveWeatherTheme,
    withNightWeatherText
} from './weatherTheme.js';

export { initializeHeaderQuote, fetchDailySpice };

let homeInterval = null;
let homeQuestTimerInterval = null;
let homeClockInterval = null;
let renderDebounce = null;
let currentRenderedViewId = null;
let hasPlayedInitialHomeEntrance = false;

const FALLBACK_QUOTES = {
    quote_header: "Every great quest starts with one brave step.",
    quote_widget: "Curiosity turns every day into an adventure.",
    default: "The adventure begins with a single step."
};

let dailySpiceState = {
    day: null,
    value: null,
    fetchedAt: 0,
    promise: null
};
const DAILY_SPICE_FALLBACK_RETRY_MS = 5 * 60 * 1000;

const dailyContentInFlight = new Map();

// --- 1. DAILY SPICE (Cached AI) ---
async function fetchDailySpice() {
    const todayKey = utils.getLocalIsoDateString();

    // A static fallback (AI/cache unavailable, e.g. before sign-in) is only
    // reused for a short cooldown so a later attempt can fetch the real quote.
    const cachedIsFallback = isStaticFallbackQuote(dailySpiceState.value?.headerQuote, 'quote_header');
    if (
        dailySpiceState.day === todayKey &&
        dailySpiceState.value &&
        (!cachedIsFallback || Date.now() - (dailySpiceState.fetchedAt || 0) < DAILY_SPICE_FALLBACK_RETRY_MS)
    ) {
        updateHeaderQuote(dailySpiceState.value.headerQuote);
        return dailySpiceState.value;
    }

    if (dailySpiceState.promise) {
        return dailySpiceState.promise;
    }

    dailySpiceState.promise = (async () => {
        const headerQuote = await getAICachedContent('quote_header');

        const value = { headerQuote };

        dailySpiceState.day = todayKey;
        dailySpiceState.value = value;
        dailySpiceState.fetchedAt = Date.now();
        updateHeaderQuote(headerQuote);
        return value;
    })().finally(() => {
        dailySpiceState.promise = null;
    });

    return dailySpiceState.promise;
}

function initializeHeaderQuote() {
    fetchDailySpice();
}

function getHomeQuestTimerMeta(deadline) {
    const tone = utils.getCountdownTone(deadline);
    if (tone === 'critical') {
        return {
            tone,
            modifier: 'date-pill--quest-timer-critical',
            icon: 'fa-fire',
            meta: 'Final sprint'
        };
    }
    if (tone === 'warning') {
        return {
            tone,
            modifier: 'date-pill--quest-timer-warning',
            icon: 'fa-hourglass-half',
            meta: 'Pressure building'
        };
    }
    return {
        tone,
        modifier: 'date-pill--quest-timer-calm',
        icon: 'fa-clock',
        meta: 'Clock is ticking'
    };
}

function startHomeQuestTimerTicker() {
    if (homeQuestTimerInterval) clearInterval(homeQuestTimerInterval);

    const tick = () => {
        const timerCard = document.querySelector('[data-home-quest-timer]');
        if (!timerCard) {
            clearInterval(homeQuestTimerInterval);
            homeQuestTimerInterval = null;
            return;
        }

        const deadline = timerCard.dataset.deadline;
        const valueEl = timerCard.querySelector('[data-home-quest-value]');
        const subvalueEl = timerCard.querySelector('[data-home-quest-subvalue]');
        const iconEl = timerCard.querySelector('[data-home-quest-icon]');
        const metaEl = timerCard.querySelector('[data-home-quest-meta]');
        const parts = utils.getCountdownParts(deadline);
        const toneMeta = getHomeQuestTimerMeta(deadline);

        if (valueEl) {
            valueEl.textContent = utils.formatCountdownClock(deadline, { expiredLabel: '00:00:00' });
        }
        if (subvalueEl) {
            subvalueEl.textContent = utils.formatCountdownCompact(deadline, 'Expired');
        }

        if (timerCard.dataset.homeQuestTone !== toneMeta.tone) {
            timerCard.classList.remove('date-pill--quest-timer-calm', 'date-pill--quest-timer-warning', 'date-pill--quest-timer-critical');
            timerCard.classList.add(toneMeta.modifier, 'date-pill--quest-tone-shift');
            timerCard.dataset.homeQuestTone = toneMeta.tone;
            if (iconEl) {
                iconEl.innerHTML = `<i class="fas ${toneMeta.icon}"></i>`;
            }
            if (metaEl) {
                metaEl.textContent = toneMeta.meta;
            }
            window.setTimeout(() => timerCard.classList.remove('date-pill--quest-tone-shift'), 380);
        }

        if (parts.expired && !timerCard.classList.contains('date-pill--quest-exit')) {
            timerCard.classList.add('date-pill--quest-exit');
        }
    };

    tick();
    homeQuestTimerInterval = setInterval(tick, 1000);
}

// --- NEW HELPER FUNCTION ---
function updateHeaderQuote(quote) {
    const container = document.getElementById('header-quote-container');
    const textEl = document.getElementById('header-quote-text');
    if (container && textEl) {
        textEl.innerText = quote;
        container.classList.remove('hidden');
    }
}

// --- 2. MAIN RENDER ---
function announceHomeRendered(detail) {
    document.documentElement?.setAttribute('data-gcq-home-ready', 'true');
    document.dispatchEvent(new CustomEvent('home:rendered', { detail }));
}

export function renderHomeTab() {
    const container = document.getElementById('home-dashboard-container');
    if (!container) return;

    // Skeleton check
    if (!state.get('allSchoolClasses')) {
        container.innerHTML = getSkeleton();
        return;
    }

    if (!container.hasChildNodes()) container.innerHTML = getSkeleton();
    if (renderDebounce) clearTimeout(renderDebounce);
    renderDebounce = setTimeout(() => {
        void executeRenderHome().catch((error) => {
            console.error('Home render failed; keeping the usable dashboard shell:', error);
            announceHomeRendered({ degraded: true });
        });
    }, 100);
}

async function executeRenderHome() {
    const container = document.getElementById('home-dashboard-container');
    if (!container) return;

    // --- CONTEXT ---
    const activeClassId = state.get('globalSelectedClassId');
    const teacherName = state.get('currentTeacherName') || "Quest Master";
    const schoolName = state.get('schoolName') || DEFAULT_SCHOOL_NAME;

    // Dynamic Weather/Theme
    const weatherData = await fetchWeatherData();

    // One shared day/night source, so the greeting and the weather card never disagree.
    const dayPartInfo = utils.getCurrentDayPart();
    let theme = { isNight: dayPartInfo.isNight };

    // --- STEP 1: CALCULATE WEATHER STATE ---
    if (weatherData) {
        theme.temp = `${weatherData.temp}°C`;
        theme.hi = Number.isFinite(weatherData.hi) ? weatherData.hi : null;
        theme.lo = Number.isFinite(weatherData.lo) ? weatherData.lo : null;
        Object.assign(theme, resolveWeatherTheme(weatherData.code));

        if (theme.isNight) {
            if (theme.weatherIcon === 'fa-sun') theme.weatherIcon = 'fa-moon';
            if (theme.weatherIcon === 'fa-cloud-sun') theme.weatherIcon = 'fa-cloud-moon';
            theme.weatherText = withNightWeatherText(theme.weatherText);
        }
    } else {
        // Fallback
        theme.temp = '--°C';
        theme.weatherBg = 'w-day';
        theme.weatherIcon = 'fa-cloud-sun';
        theme.weatherText = 'Clear';
        if (theme.isNight) {
            theme.weatherIcon = 'fa-moon';
            theme.weatherText = 'Clear Night';
        }
    }

    // --- STEP 2: APPLY HEADER THEME ---
    const header = document.querySelector('#award-header-atmosphere header')
        || document.querySelector('header');
    const awardHeaderAtmosphere = document.getElementById('award-header-atmosphere');
    if (header) {
        // 1. Clean old classes
        header.classList.remove(...HEADER_WEATHER_CLASSES);

        // 2. Reset Background
        header.style.background = '';
        /* Match templates/app/header.js — overflow-visible keeps FA header clouds + Award expansion visible */
        header.className =
            'relative z-[1] flex w-full min-w-0 items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible transition-all duration-1000';

        // Night layer (`header-night`) stacks with concrete weather classes for header + Award sky.
        const headerWeather = headerClassesForTheme(theme, theme.isNight);
        if (headerWeather.length) header.classList.add(...headerWeather);

        const sunny = 'linear-gradient(to right, #89f7fe 0%, #66a6ff 100%)';
        const nightBar = 'linear-gradient(to right, #1e3a8a 0%, #312e81 100%)';
        const hasWeatherSkin = HEADER_WEATHER_CLASSES.some((name) => header.classList.contains(name));

        if (awardHeaderAtmosphere) {
            if (hasWeatherSkin) {
                const cs = getComputedStyle(header);
                const bi = cs.backgroundImage;
                const bc = cs.backgroundColor;
                if (bi && bi !== 'none') {
                    awardHeaderAtmosphere.style.background =
                        bc && bc !== 'rgba(0, 0, 0, 0)' ? `${bi}, ${bc}` : bi;
                } else if (bc && bc !== 'rgba(0, 0, 0, 0)') {
                    awardHeaderAtmosphere.style.background = bc;
                } else {
                    awardHeaderAtmosphere.style.background = theme.isNight ? nightBar : sunny;
                }
            } else if (theme.isNight) {
                awardHeaderAtmosphere.style.background = nightBar;
            } else {
                awardHeaderAtmosphere.style.background = sunny;
            }
        } else if (!hasWeatherSkin && !theme.isNight) {
            header.style.background = sunny;
        }

        utils.syncAwardSkyWeather(header);
    } else {
        utils.syncAwardSkyWeather();
    }

    // --- STEP 3: GREETING (same day/night source as the weather card) ---
    theme.greeting = dayPartInfo.greeting;
    theme.dayPart = dayPartInfo.part; // morning | afternoon | evening | night
    theme.greetingGradient = dayPartInfo.gradient;
    theme.nameGradient = "from-slate-700 to-slate-500";

    // --- STEP 4: FETCH SPICE & RENDER (non-blocking) ---
    const spice = { headerQuote: FALLBACK_QUOTES.quote_header };
    fetchDailySpice().then(s => {
        updateHeaderQuote(s.headerQuote);
    }).catch(() => {});

    const allClasses = state.get('allSchoolClasses') || [];
    let viewId = 'general';
    let contentHtml = '';

    if (activeClassId) {
        const classData = allClasses.find(c => c.id === activeClassId);
        if (classData) {
            viewId = `class_${activeClassId}`;
            contentHtml = getActiveDashboard(classData, teacherName, theme, spice);
        } else contentHtml = getGeneralDashboard(teacherName, theme, spice);
    } else {
        contentHtml = getGeneralDashboard(teacherName, theme, spice);
    }

    // DOM Update
    const isViewChange = currentRenderedViewId !== viewId;
    currentRenderedViewId = viewId;

    if (isViewChange) container.innerHTML = `<div class="home-fade w-full h-full">${contentHtml}</div>`;
    else container.innerHTML = `<div class="w-full h-full">${contentHtml}</div>`;

    // The coherent dashboard is now visible. Everything below enhances it and
    // must not hold the authenticated loading screen open.
    announceHomeRendered({ isInitialHomeRender: !hasPlayedInitialHomeEntrance, viewId });

    // Async: inject quiz button into weather card footer if applicable
    injectQuizButton();

    const isInitialHomeRender = !hasPlayedInitialHomeEntrance;
    if (isInitialHomeRender) {
        hasPlayedInitialHomeEntrance = true;
        container.classList.add('home-intro-root');
        requestAnimationFrame(() => {
            container.classList.add('home-intro-visible');
        });
        setTimeout(() => {
            container.classList.remove('home-intro-root', 'home-intro-visible');
        }, 950);
    }

    attachListeners(container);
    startHomeSmartLogic();
    startHomeQuestTimerTicker();
    startHomeClockTicker();
    startDayRingClock(container);

}

/** Moves the weather card clock hands each second; stops once the card leaves the DOM. */
function startHomeClockTicker() {
    if (homeClockInterval) clearInterval(homeClockInterval);
    const tick = () => {
        const clock = document.querySelector('#home-dashboard-container [data-home-clock]');
        if (!clock) {
            clearInterval(homeClockInterval);
            homeClockInterval = null;
            return;
        }
        const now = new Date();
        const angles = getClockHandAngles(now);
        clock.querySelectorAll('[data-clock-hand]').forEach((hand) => {
            hand.style.transform = `rotate(${angles[hand.dataset.clockHand]}deg)`;
        });
        const label = `Time ${formatClockTime(now)}`;
        if (clock.getAttribute('aria-label') !== label) clock.setAttribute('aria-label', label);
    };
    tick();
    homeClockInterval = setInterval(tick, 1000);
}

// --- 3. TEMPLATES (VIBRANT HORIZONS) ---

function getSkeleton() {
    return `<div class="animate-pulse space-y-6 max-w-7xl mx-auto p-4"><div class="grid grid-cols-12 gap-6"><div class="h-48 bg-gray-200 rounded-3xl col-span-8"></div><div class="h-48 bg-gray-200 rounded-3xl col-span-4"></div></div><div class="grid grid-cols-12 gap-6"><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div></div></div>`;
}

function patchHomeChronicleStory(classId, story) {
    if (state.get('globalSelectedClassId') !== classId) return;
    const root = document.getElementById('home-dashboard-container');
    if (!root) return;
    const wordEl = root.querySelector('[data-home-story-word]');
    const textEl = root.querySelector('[data-home-story-text]');
    if (wordEl && story?.currentWord != null) {
        wordEl.textContent = `Story: ${story.currentWord}`;
    }
    if (textEl && story?.currentSentence != null) {
        textEl.textContent = `"...${story.currentSentence}..."`;
    }
}

/** One Chronicle page (Home, class view). Tap unfolds it over the deck; the footer opens its tab. */
function getChroniclePageHtml({ kind, index, icon, kicker, kickerAttr = '', body, bodyAttr = '', openTarget, openLabel }) {
    return `
                <article class="ch-page ch-page--${kind}" style="--ch-i:${index}" role="button" tabindex="0" aria-expanded="false">
                    <span class="ch-page__ribbon" aria-hidden="true"></span>
                    <i class="fas ${icon} ch-page__watermark" aria-hidden="true"></i>
                    <span class="ch-page__ink" aria-hidden="true"></span>
                    <header class="ch-page__head">
                        <span class="ch-page__badge"><i class="fas ${icon}"></i></span>
                        <span class="ch-page__kicker" ${kickerAttr}>${kicker}</span>
                    </header>
                    <div class="ch-page__body" ${bodyAttr}>${body}</div>
                    <footer class="ch-page__foot">
                        <span class="ch-page__hint"><span class="ch-page__hint-more">Read</span><span class="ch-page__hint-less">Fold away</span><i class="fas fa-chevron-down"></i></span>
                        <button type="button" class="ch-page__open" data-ch-open="${openTarget}" tabindex="-1">${openLabel} <i class="fas fa-arrow-right"></i></button>
                    </footer>
                </article>`;
}

function getGeneralDashboard(name, theme, spice) {
    const today = utils.getTodayDateString();
    const activeLeague = resolveActiveHomeLeague();

    const myClasses = state.get('allTeachersClasses') || [];
    const totalStudents = state.get('allStudents').length;
    const allScores = state.get('allStudentScores') || [];

    const schoolStars = sumLiveMonthlyStarsFromStudentScores(allScores);

    const totalGold = sumLiveYearGoldFromAppState(allScores, state);
    const todaysClassCount = isSchoolYearAwaitingOpen(state.get('schoolYearState'))
        ? 0
        : utils.getClassesOnDay(
            today,
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        ).length;

    const tools = [
        { icon: 'fa-trophy', label: 'Hero Ranks', action: 'open-student-ranks', league: activeLeague },
        { icon: 'fa-plus-circle', label: 'New', action: 'create-class', league: activeLeague },
        { icon: 'fa-globe', label: 'Team History', action: 'open-team-history', league: activeLeague },
        { icon: 'fa-chalkboard-teacher', label: 'My Classes', action: 'open-my-classes' },
        { icon: 'fa-calendar-alt', label: 'Plan', action: 'open-day-planner', featureFlag: 'calendar' },
        { icon: 'fa-cog', label: 'Setup', action: 'open-settings' },
    ].filter(tool => !tool.featureFlag || canUseFeature(tool.featureFlag));

    return getLayout(
        name, theme, '',
        `
        <div class="vibrant-card h-span-6 stat-card-pop card-gradient-sun home-stat home-stat--sun">
            <i class="fas fa-star home-stat__watermark" aria-hidden="true"></i>
            <span class="home-stat__sparkles" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="home-stat__label text-amber-600"><span class="home-stat__icon"><i class="fas fa-star"></i></span> School Stars</span>
            <div class="stat-value-big text-amber-500 animate-pulse">${schoolStars}</div>
            <div class="text-sm font-bold text-amber-700/60">Total Monthly</div>
        </div>
        <div class="vibrant-card h-span-3 stat-card-pop card-gradient-sky home-stat home-stat--sky">
            <i class="fas fa-users home-stat__watermark" aria-hidden="true"></i>
            <span class="home-stat__label text-blue-600"><span class="home-stat__icon"><i class="fas fa-users"></i></span> Heroes</span>
            <div class="stat-value-big text-blue-500">${totalStudents}</div>
            <div class="text-sm font-bold text-blue-700/60">Active Students</div>
        </div>
        <div class="vibrant-card h-span-3 stat-card-pop card-gradient-royal home-stat home-stat--royal">
            <i class="fas fa-coins home-stat__watermark" aria-hidden="true"></i>
            <span class="home-stat__label text-purple-600"><span class="home-stat__icon"><i class="fas fa-coins"></i></span> Treasury</span>
            <div class="stat-value-big text-purple-500">${totalGold}</div>
            <div class="text-sm font-bold text-purple-700/60">Gold</div>
        </div>
        
        <!-- Grand Guild Ceremony Button (shown on ceremony day) -->
        <div id="grand-guild-ceremony-btn-home" class="hidden h-span-3">
            <div class="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 rounded-2xl shadow-lg animate-pulse h-full flex flex-col justify-center items-center cursor-pointer hover:scale-105 transition-transform" onclick="startGrandGuildCeremony()">
                <i class="fas fa-crown text-3xl mb-2"></i>
                <div class="font-title text-lg">Grand Guild Ceremony</div>
                <div class="text-sm opacity-75">Click to begin!</div>
            </div>
        </div>
        `,
        `
        <div class="vibrant-card h-span-4 card-glass-white">
            <div class="home-section-head">
                <h3 class="home-section-title"><span class="home-section-title__icon home-section-title__icon--tools"><i class="fas fa-toolbox"></i></span>Global Tools</h3>
            </div>
            <div class="tools-grid-v2">
                ${tools.map(t => `
                    <div
                        class="tool-btn-pop shortcut-action-btn"
                        data-action="${t.action}"
                        data-league="${t.league || ''}"
                        title="${t.league ? `${t.label} for ${t.league} League` : t.label}">
                        <i class="fas ${t.icon}"></i>
                        <span>${t.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="vibrant-card h-span-8 card-glass-white">
            <div class="home-section-head">
                <h3 class="home-section-title"><span class="home-section-title__icon home-section-title__icon--schedule"><i class="fas fa-calendar-day"></i></span>School Schedule</h3>
                ${todaysClassCount ? `
                <div class="home-schedule-legend" aria-hidden="true">
                    <span><i class="fas fa-crown home-schedule-legend__mine"></i>Yours</span>
                    <span><i class="fas fa-eye home-schedule-legend__colleague"></i>Colleague</span>                </div>` : ''}
            </div>
            <div class="schedule-list-v2 mt-4">
                ${getScheduleHtml(today, null)}
            </div>
        </div>
        `
    );
}

function getActiveDashboard(classData, name, theme, spice) {
    const classId = classData.id;
    const today = utils.getTodayDateString();

    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores') || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const { totalStars: monthlyStarsWithBonus } = utils.getClassMonthlyQuestStars(classData, students, scores, now);

    // NEW: Dynamic goal based on actual lessons, holidays, and overrides
    // NEW: Pass the full classData to match Leaderboard logic
    let goal = calculateMonthlyClassGoal(classData, students.length);
    if (goal < 18) goal = 18; // Shared safety floor
    const progress = Math.min(100, (monthlyStarsWithBonus / goal) * 100).toFixed(0);

    // Fetch story when missing; patch chronicle text only (avoid full home DOM swap / flash)
    if (!state.get('currentStoryData')[classId]) {
        const storyRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        getDoc(storyRef).then((docSnap) => {
            if (docSnap.exists()) {
                const currentData = state.get('currentStoryData');
                currentData[classId] = docSnap.data();
                state.setCurrentStoryData(currentData);
                patchHomeChronicleStory(classId, docSnap.data());
            }
        }).catch(() => {});
    }
    const story = state.get('currentStoryData')[classId];
    const storyText = (story && story.currentSentence) ? `"...${story.currentSentence}..."` : "The story awaits its first chapter...";
    const storyWord = (story && story.currentWord) ? story.currentWord : "Pending";

    const lastAssignment = state.get('allQuestAssignments')
        .filter(a => a.classId === classId)
        .sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0))[0];
    const scheduledTestStatus = canUseFeature('scholarScroll') ? getUpcomingScheduledAssessment(classId) : null;

    let assignmentText = lastAssignment ? lastAssignment.text : "No active homework.";

    if (scheduledTestStatus) {
        const badgePalettes = {
            red: 'bg-red-600 text-white border-red-700 shadow-md animate-pulse',
            rose: 'bg-rose-100 text-rose-700 border-rose-200',
            orange: 'bg-amber-100 text-amber-800 border-amber-200',
            emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            slate: 'bg-slate-100 text-slate-700 border-slate-200',
            amber: 'bg-red-50 text-red-600 border-red-100'
        };
        const badgeColor = badgePalettes[scheduledTestStatus.tone] || badgePalettes.amber;
        assignmentText = `
            <div class="flex flex-col gap-1">
                <span>${lastAssignment?.text || 'Scheduled assessment ahead.'}</span>
                <span class="text-xs font-bold px-2 py-1 rounded border ${badgeColor} self-start flex items-center gap-1 mt-1">
                    <i class="fas fa-${scheduledTestStatus.icon}"></i>
                    <span>${scheduledTestStatus.testData.title}</span>
                    <span class="opacity-80">• ${scheduledTestStatus.statusLabel}</span>
                </span>
                <span class="text-[11px] text-slate-500 mt-0.5">${scheduledTestStatus.detailLabel} • ${scheduledTestStatus.chipLabel}</span>
            </div>`;
    }

    const logs = state.get('allAdventureLogs').filter(l => l.classId === classId).sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));
    const lastLogText = logs.length > 0 ? logs[0].text : "No adventures chronicled yet.";
    const lastLogDate = logs.length > 0 ? new Date(utils.parseDDMMYYYY(logs[0].date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : '';

    const rosterHtml = students.length > 0
        ? students.sort((a, b) => a.name.localeCompare(b.name)).map(s => {
            const scoreData = scores.find(sc => sc.id === s.id);
            const stars = scoreData?.monthlyStars || 0;
            const avatarInner = s.avatar
                ? `<img src="${s.avatar}" alt="${s.name}" loading="lazy" decoding="async" class="roster-avatar enlargeable-avatar" data-student-id="${s.id}" title="${s.name} (${stars} ⭐)">`
                : `<div class="roster-avatar bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs enlargeable-avatar" data-student-id="${s.id}" title="${s.name} (${stars} ⭐)">${s.name.charAt(0)}</div>`;
            const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, !!scoreData?.pendingSkillChoice);
            return `<div class="relative group -ml-2 first:ml-0 transition-transform hover:z-50">${avatarHtml}</div>`;
        }).join('')
        : '<span class="text-xs text-gray-400 pl-2">Empty Roster</span>';

    const classLogs = state.get('allAwardLogs').filter(l => l.classId === classId);
    const reasons = {};
    classLogs.forEach(l => { if (l.reason) reasons[l.reason] = (reasons[l.reason] || 0) + l.stars; });
    const topReasonEntry = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    const topSkill = topReasonEntry ? topReasonEntry[0] : null;

    const tools = [
        { icon: 'fa-clipboard-check', label: 'Roll Call', action: 'open-attendance' },
        { icon: 'fa-magic', label: 'Report', action: 'open-report', id: classId },
        { icon: 'fa-feather-alt', label: 'Story', target: 'reward-ideas-tab' },
        { icon: 'fa-scroll', label: 'Trials', target: 'scholars-scroll-tab' },
        { icon: 'fa-star', label: 'Stars', target: 'award-stars-tab' },
        { icon: 'fa-pencil-alt', label: 'Edit', action: 'edit-class', id: classId },
    ];

    // FIX: Get content AND theme from the new function
    const skillData = getTopSkillHtml(topSkill);

    return getLayout(
        name, theme, getHomeBountyPillHtml(),
        `
        <div class="vibrant-card h-span-8 p-6 flex flex-col justify-center relative overflow-hidden quest-progress-card">
            <div class="absolute -bottom-14 -left-14 w-56 h-56 rounded-full bg-blue-400/25 blur-3xl pointer-events-none"></div>
            <div class="absolute -top-10 right-0 w-44 h-44 rounded-full bg-indigo-500/18 blur-2xl pointer-events-none"></div>
            <div class="absolute inset-0 pointer-events-none" style="background: linear-gradient(135deg, rgba(255,255,255,0.38) 0%, transparent 55%); border-radius: inherit;"></div>
            <div class="relative z-10 flex justify-between items-start mb-5">
                <div>
                    <h3 class="font-bold text-blue-400/80 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 border border-blue-300/40"><i class="fas fa-route text-[9px] text-blue-500"></i></span>
                        Quest Progress
                    </h3>
                    <div class="quest-pct-text">${progress}<span style="font-size:2.5rem">%</span></div>
                    <p class="text-[11px] text-blue-400/60 mt-1 font-semibold tracking-wide">of monthly goal</p>
                </div>
                <div class="quest-stars-pill">
                    <div class="font-title text-3xl text-amber-500 leading-none">${monthlyStarsWithBonus} ⭐</div>
                    <p class="text-[10px] font-bold text-amber-700/60 mt-0.5">this month</p>
                </div>
            </div>
            <div class="quest-progress-track relative z-10">
                <div class="quest-progress-fill" style="width: ${progress}%">
                    <div class="quest-progress-shine"></div>
                </div>
            </div>
            <div class="relative z-10 flex justify-between mt-2">
                <p class="text-[11px] text-blue-400/50 font-medium">Start</p>
                <p class="text-[11px] text-blue-500/70 font-bold">Goal: ${goal} ⭐</p>
            </div>
        </div>
        
        <div class="vibrant-card h-span-4 p-5 flex flex-col justify-between ${skillData.theme}">
            <div>
                <h3 class="text-xs font-bold opacity-70 uppercase tracking-widest mb-1"><i class="fas fa-bolt mr-1"></i> Top Skill</h3>
                ${skillData.html}
            </div>
            <div class="mt-4">
                <h3 class="text-xs font-bold opacity-70 uppercase tracking-widest mb-2 flex justify-between">
                    <span>Heroes</span>
                </h3>
                <div class="flex items-center flex-wrap pl-2 gap-y-2">
                    ${rosterHtml}
                </div>
            </div>
        </div>
        
        <!-- Grand Guild Ceremony Button (shown on ceremony day for this class) -->
        <div id="grand-guild-ceremony-btn-class" class="hidden h-span-4">
            <div class="bg-gradient-to-r from-purple-400 to-pink-500 text-white p-4 rounded-2xl shadow-lg animate-pulse h-full flex flex-col justify-center items-center cursor-pointer hover:scale-105 transition-transform" onclick="startGrandGuildCeremony(['${classId}'])">
                <i class="fas fa-crown text-3xl mb-2"></i>
                <div class="font-title text-lg">Your Class Ceremony</div>
                <div class="text-sm opacity-75">Click to begin!</div>
            </div>
        </div>
        `,
        `
        <div class="vibrant-card h-span-8 p-5 bg-gray-50/50 backdrop-blur-sm">
            <h3 class="home-section-title mb-4"><span class="home-section-title__icon home-section-title__icon--chronicle"><i class="fas fa-history"></i></span>The Chronicle</h3>
            
            <div class="ch-deck" data-chronicle-deck>
                ${getChroniclePageHtml({ kind: 'homework', index: 0, icon: 'fa-book', kicker: 'Homework', body: assignmentText, openTarget: 'adventure-log-tab', openLabel: 'Adventure Log' })}
                ${getChroniclePageHtml({ kind: 'story', index: 1, icon: 'fa-feather-alt', kicker: `Story: ${storyWord}`, kickerAttr: 'data-home-story-word', body: storyText, bodyAttr: 'data-home-story-text', openTarget: 'reward-ideas-tab', openLabel: 'Story Weavers' })}
                ${getChroniclePageHtml({ kind: 'log', index: 2, icon: 'fa-compass', kicker: lastLogDate || 'Adventure Log', body: lastLogText, openTarget: 'adventure-log-tab', openLabel: 'Adventure Log' })}
            </div>
        </div>

        <div class="vibrant-card h-span-4 card-glass-white">
            <div class="home-section-head">
                <h3 class="home-section-title"><span class="home-section-title__icon home-section-title__icon--tools"><i class="fas fa-magic"></i></span>Class Actions</h3>
            </div>
            <div class="grid grid-cols-3 gap-3 p-4 pt-3">
                ${tools.map(t => {
            const attr = t.target ? `data-target="${t.target}" class="tool-btn-pop shortcut-tab-btn"` : `data-action="${t.action}" data-id="${t.id || ''}" class="tool-btn-pop shortcut-action-btn"`;
            return `<div ${attr} style="aspect-ratio: 1/0.8"><i class="fas ${t.icon} text-xl mb-1"></i><span style="font-size: 0.65rem">${t.label}</span></div>`;
        }).join('')}
            </div>
        </div>
        `
    );
}

function formatClockTime(date = new Date()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Hand angles for the weather-card analogue clock. Angles grow through the day
 * (not modulo 360) so the CSS tick transition never spins a hand backwards.
 */
function getClockHandAngles(date = new Date()) {
    const secs = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return { h: secs / 120, m: secs / 10, s: secs * 6 };
}

/** Small glassy analogue clock that lives on the weather card. */
function getWeatherClockHtml() {
    const { h, m, s } = getClockHandAngles();
    const ticks = Array.from({ length: 12 }, (_, i) => {
        const major = i % 3 === 0;
        return `<line class="weather-clock__tick${major ? ' is-major' : ''}" x1="32" y1="${major ? 6.5 : 7.5}" x2="32" y2="${major ? 12 : 10.5}" transform="rotate(${i * 30} 32 32)"/>`;
    }).join('');
    return `
        <svg class="weather-clock" viewBox="0 0 64 64" role="img" aria-label="Time ${formatClockTime()}" data-home-clock>
            <defs>
                <radialGradient id="weather-clock-face" cx="34%" cy="28%" r="80%">
                    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
                    <stop offset="0.6" stop-color="#fff" stop-opacity="0.18"/>
                    <stop offset="1" stop-color="#fff" stop-opacity="0.08"/>
                </radialGradient>
            </defs>
            <circle class="weather-clock__halo" cx="32" cy="32" r="31"/>
            <circle class="weather-clock__face" cx="32" cy="32" r="28" fill="url(#weather-clock-face)"/>
            <path class="weather-clock__gloss" d="M12 24 A22 22 0 0 1 40 10.5 A26 26 0 0 0 12 24 Z"/>
            ${ticks}
            <g class="weather-clock__hand weather-clock__hand--h" data-clock-hand="h" style="transform: rotate(${h}deg)"><line x1="32" y1="35" x2="32" y2="19"/></g>
            <g class="weather-clock__hand weather-clock__hand--m" data-clock-hand="m" style="transform: rotate(${m}deg)"><line x1="32" y1="36" x2="32" y2="11.5"/></g>
            <g class="weather-clock__hand weather-clock__hand--s" data-clock-hand="s" style="transform: rotate(${s}deg)"><line x1="32" y1="39" x2="32" y2="9"/><circle cx="32" cy="9" r="1.6"/></g>
            <circle class="weather-clock__pin" cx="32" cy="32" r="2.7"/>
            <circle class="weather-clock__pin-dot" cx="32" cy="32" r="1.1"/>
        </svg>`;
}

/** Chips under the greeting: school · today's context (class or school-wide). The header already shows the date. */
function getGreetingChipsHtml() {
    const selectedId = state.get('globalSelectedClassId');
    const selectedClass = selectedId ? (state.get('allSchoolClasses') || []).find(c => c.id === selectedId) : null;
    const chips = [
        `<span class="greeting-chip greeting-chip--school"><i class="fas fa-university"></i><span data-school-name>${escapeHtml(state.get('schoolName') || DEFAULT_SCHOOL_NAME)}</span></span>`
    ];

    if (selectedClass) {
        chips.push(`<span class="greeting-chip greeting-chip--class"><span class="greeting-chip__emoji">${escapeHtml(selectedClass.logo || '📚')}</span>${escapeHtml(selectedClass.name)}${selectedClass.questLevel ? `<small>${escapeHtml(selectedClass.questLevel)}</small>` : ''}</span>`);
    } else if (!isSchoolYearAwaitingOpen(state.get('schoolYearState'))) {
        const todays = utils.getClassesOnDay(
            utils.getTodayDateString(),
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        );
        if (todays.length) {
            const myIds = new Set((state.get('allTeachersClasses') || []).map(c => c.id));
            const mine = todays.filter(c => myIds.has(c.id)).length;
            chips.push(`<span class="greeting-chip greeting-chip--today"><i class="fas fa-school"></i>${todays.length} ${todays.length === 1 ? 'class' : 'classes'} today${mine ? `<small>${mine} yours</small>` : ''}</span>`);
        }
    }
    return chips.join('');
}

function getWeatherMetaHtml(theme) {
    const chips = [];
    if (theme.hi != null && theme.lo != null) {
        chips.push(`<span class="weather-chip"><i class="fas fa-temperature-arrow-up"></i>${theme.hi}°<span class="weather-chip__sep">/</span><i class="fas fa-temperature-arrow-down"></i>${theme.lo}°</span>`);
    }
    return chips.join('');
}

function getLayout(name, theme, selector, row2, row3) {
    const heroEmoji = state.get('globalSelectedClassId')
        ? (state.get('allSchoolClasses').find(c => c.id === state.get('globalSelectedClassId'))?.logo || '✨')
        : '🏫';
    const dayPart = theme.dayPart || 'afternoon';
    const weatherIconMotion = theme.weatherIcon === 'fa-sun' ? 'weather-sun--spin'
        : theme.weatherIcon === 'fa-moon' ? 'weather-sun--sway' : 'weather-sun--float';

    return `
    <div class="w-full max-w-7xl mx-auto p-4">
        <div class="horizons-grid">

            <div class="vibrant-card h-span-8 greeting-panel greeting-panel--${dayPart}">
                <div class="greeting-bg-mesh"></div>
                <div class="greeting-sky" aria-hidden="true">
                    <span class="greeting-sky__glow"></span>
                    <span class="greeting-sky__stars"></span>
                    ${getGreetingHillsHtml()}
                </div>
                ${getDayRingEmblemHtml(escapeHtml(heroEmoji))}
                <div class="relative z-10 flex flex-col justify-between h-full">

                    <div class="greeting-top-row">
                        <div id="home-reminders-container" class="greeting-top-row__reminders flex flex-wrap items-center gap-3 py-1">
                            ${getReminderPills(state.get('globalSelectedClassId'))}
                        </div>
                        <div class="greeting-top-row__bounty">
                            ${selector}
                        </div>
                    </div>

                    <div class="greeting-main">
                        <h1 class="greeting-title font-title text-4xl md:text-5xl text-slate-800 drop-shadow-sm mb-2">
                            <span class="text-transparent bg-clip-text bg-gradient-to-r ${theme.greetingGradient}">${theme.greeting}</span>,
                            <span class="text-transparent bg-clip-text bg-gradient-to-r ${theme.nameGradient} whitespace-nowrap">${escapeHtml(name)}</span>!
                        </h1>
                        <div class="greeting-chips">${getGreetingChipsHtml()}</div>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-4 weather-card weather-card--v2 ${theme.weatherBg}${theme.isNight ? ' weather-night' : ''}${theme.intensity ? ` weather-${theme.intensity}` : ''}">
                <div class="weather-deco" aria-hidden="true">
                    <span class="weather-glow"></span>
                    <i class="fas fa-cloud weather-cloud"></i>
                    <i class="fas fa-cloud weather-cloud weather-cloud--b"></i>
                </div>
                <i class="fas ${theme.weatherIcon} weather-sun ${weatherIconMotion}" aria-hidden="true"></i>

                <div class="weather-top">
                    ${getWeatherClockHtml()}
                    <div class="weather-meta">${getWeatherMetaHtml(theme)}</div>
                </div>

                <div class="weather-info">
                    <div class="weather-temp font-title">${theme.temp}</div>
                    <div class="weather-cond">${escapeHtml(theme.weatherText)}</div>
                </div>

                <div class="weather-bottom">
                    <div id="weather-card-footer" class="weather-card-footer" data-quiz-class="${state.get('globalSelectedClassId') || ''}">
                    </div>
                </div>
            </div>

            ${row2}
            ${row3}

        </div>
    </div>`;
}

// --- HELPERS ---

/** Compact bounty launcher in greeting panel (replaces former “active class” chip). */
function getHomeBountyPillHtml() {
    return `
        <button type="button" id="open-bounty-modal-btn" class="home-bounty-pill group" title="Post a bounty for this class">
            <span class="home-bounty-pill__glow" aria-hidden="true"></span>
            <span class="home-bounty-pill__icon" aria-hidden="true"><i class="fas fa-crosshairs"></i></span>
            <div class="home-bounty-pill__text">
                <span class="home-bounty-pill__title font-title">Bounty</span>
            </div>
            <span class="home-bounty-pill__chev" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
        </button>`;
}

function resolveActiveHomeLeague() {
    const activeClassId = state.get('globalSelectedClassId');
    const activeClass = activeClassId
        ? (state.get('allSchoolClasses') || []).find(c => c.id === activeClassId)
        : null;
    if (activeClass?.questLevel) return activeClass.questLevel;

    const selectedLeague = state.get('globalSelectedLeague');
    if (selectedLeague) return selectedLeague;

    const todaysClasses = utils.getClassesOnDay(
        utils.getTodayDateString(),
        state.get('allSchoolClasses') || [],
        state.get('allScheduleOverrides') || [],
        state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
    );
    const myClassIds = new Set((state.get('allTeachersClasses') || []).map(c => c.id));
    const activeNow = todaysClasses.find(c =>
        myClassIds.has(c.id) && utils.isNowInClassWindow(c.timeStart, c.timeEnd)
    ) || todaysClasses.find(c => myClassIds.has(c.id));
    if (activeNow?.questLevel) return activeNow.questLevel;

    return null;
}

function getScheduleHtml(dateString, activeClassId) {
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const allScheduleOverrides = state.get('allScheduleOverrides') || [];
    const myClasses = state.get('allTeachersClasses') || [];
    const myClassIds = myClasses.map(c => c.id);
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};

    const todaysClasses = utils.getClassesOnDay(dateString, allSchoolClasses, allScheduleOverrides, classEndDates);
    const schoolYearState = state.get('schoolYearState');
    const allStudents = state.get('allStudents') || [];

    if (isSchoolYearAwaitingOpen(schoolYearState) || todaysClasses.length === 0) {
        const emptyState = resolveScheduleEmptyState({
            date: utils.parseFlexibleDate(dateString) || new Date(),
            schoolYearState,
            allSchoolClasses,
            allScheduleOverrides,
            schoolHolidayRanges: state.get('schoolHolidayRanges') || [],
            classEndDates
        });
        const emptyClass = getScheduleEmptyStateMarkupClass(emptyState);

        return `
        <div class="${emptyClass}" style="min-height: 325px;">
            <div class="text-7xl mb-4 animate-bounce-slow filter drop-shadow-sm">${escapeHtml(emptyState.icon)}</div>
            <h4 class="font-title text-3xl mb-2 schedule-empty-camp__title">${escapeHtml(emptyState.title)}</h4>
            <p class="text-base font-bold opacity-80 schedule-empty-camp__message">${escapeHtml(emptyState.message)}</p>
        </div>`;
    }

    const gradients = [
        "bg-gradient-to-br from-red-100 to-red-200", "bg-gradient-to-br from-orange-100 to-orange-200",
        "bg-gradient-to-br from-amber-100 to-amber-200", "bg-gradient-to-br from-green-100 to-green-200",
        "bg-gradient-to-br from-emerald-100 to-emerald-200", "bg-gradient-to-br from-teal-100 to-teal-200",
        "bg-gradient-to-br from-cyan-100 to-cyan-200", "bg-gradient-to-br from-sky-100 to-sky-200",
        "bg-gradient-to-br from-blue-100 to-blue-200", "bg-gradient-to-br from-indigo-100 to-indigo-200",
        "bg-gradient-to-br from-violet-100 to-violet-200", "bg-gradient-to-br from-purple-100 to-purple-200",
        "bg-gradient-to-br from-fuchsia-100 to-fuchsia-200", "bg-gradient-to-br from-pink-100 to-pink-200",
        "bg-gradient-to-br from-rose-100 to-rose-200"
    ];

    return todaysClasses.map(c => {
        const isMine = myClassIds.includes(c.id);
        const timeStr = (c.timeStart) ? `${c.timeStart}` : 'TBD';
        const isActive = c.id === activeClassId;
        const league = c.questLevel || 'Quest';
        const teacherName = c.createdBy?.name || 'Unknown';
        const colorIndex = utils.simpleHashCode(c.id) % gradients.length;
        const bgGradient = gradients[colorIndex];

        const isLive = utils.isNowInClassWindow(c.timeStart, c.timeEnd);
        const heroCount = allStudents.filter(s => s.classId === c.id && s.enrollmentStatus !== 'inactive').length;

        let cardClass = `schedule-card-square ${bgGradient} schedule-class-peek-btn`;
        if (isActive) cardClass += ' active-lesson';
        if (isLive) cardClass += ' is-live';
        cardClass += isMine ? ' is-mine' : ' is-colleague';

        const ownerMark = isMine
            ? '<div class="schedule-card-ribbon" title="Your class"><i class="fas fa-crown"></i></div>'
            : '<div class="schedule-card-ribbon schedule-card-ribbon--colleague" title="Colleague’s class — view only"><i class="fas fa-eye"></i></div>';

        return `
        <div class="${cardClass}" data-id="${escapeHtml(c.id)}" role="button" tabindex="0"
            title="${escapeHtml(c.name)} • ${escapeHtml(teacherName)} — view class roster"
            aria-label="View roster for ${escapeHtml(c.name)} (${escapeHtml(teacherName)})">
            ${ownerMark}
            <div class="time-pill">${isLive ? '<span class="schedule-live-dot" aria-hidden="true"></span>' : ''}${escapeHtml(timeStr)}</div>
            <div class="logo">${escapeHtml(c.logo || '📚')}</div>
            <div class="info-stack">
                <div class="name">${escapeHtml(c.name)}</div>
                <div class="league">${escapeHtml(league)}</div>
                <div class="teacher">${escapeHtml(teacherName)}</div>
            </div>
            <div class="schedule-card-peek" aria-hidden="true"><i class="fas fa-users"></i> ${heroCount} · Roster</div>
        </div>`;
    }).join('');
}

// --- Chronicle deck: press ink, FLIP unfold/fold, Esc / outside click to close ---

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Toggle a page between its grid slot and the unfolded sheet, animating from the old box to the new one. */
function setChroniclePageOpen(deck, page, open) {
    if (!page || page.classList.contains('is-open') === open) return;
    const before = page.getBoundingClientRect();
    page.classList.toggle('is-open', open);
    page.setAttribute('aria-expanded', String(open));
    deck.classList.toggle('has-open', open);
    page.querySelector('.ch-page__open')?.setAttribute('tabindex', open ? '0' : '-1');
    if (!open) page.scrollTop = 0;
    if (prefersReducedMotion() || typeof page.animate !== 'function') return;
    const after = page.getBoundingClientRect();
    if (!after.width || !after.height) return;
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    const sx = before.width / after.width;
    const sy = before.height / after.height;
    page.animate([
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: 'top left', transform: 'none' }
    ], { duration: open ? 420 : 320, easing: open ? 'cubic-bezier(0.2, 0.9, 0.25, 1.08)' : 'cubic-bezier(0.4, 0, 0.2, 1)' });
    // Hide the words while the sheet stretches, then let them settle in.
    page.querySelectorAll('.ch-page__head, .ch-page__body, .ch-page__foot').forEach(child => {
        child.animate([
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 0, transform: 'translateY(6px)', offset: 0.45 },
            { opacity: 1, transform: 'none' }
        ], { duration: open ? 520 : 380, easing: 'ease-out' });
    });
}

function closeOpenChroniclePages(except = null) {
    document.querySelectorAll('[data-chronicle-deck] .ch-page.is-open').forEach(page => {
        if (page !== except) setChroniclePageOpen(page.closest('[data-chronicle-deck]'), page, false);
    });
}

let chronicleDocumentListenersBound = false;

function wireChronicleDeck(deck) {
    if (!chronicleDocumentListenersBound) {
        chronicleDocumentListenersBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = document.querySelector('[data-chronicle-deck] .ch-page.is-open');
            if (!open) return;
            closeOpenChroniclePages();
            open.focus({ preventScroll: true });
        });
        document.addEventListener('pointerdown', (e) => {
            if (e.target.closest?.('[data-chronicle-deck] .ch-page.is-open')) return;
            closeOpenChroniclePages();
        });
    }

    deck.querySelectorAll('.ch-page').forEach(page => {
        page.addEventListener('pointerdown', (e) => {
            const rect = page.getBoundingClientRect();
            page.style.setProperty('--ch-ink-x', `${e.clientX - rect.left}px`);
            page.style.setProperty('--ch-ink-y', `${e.clientY - rect.top}px`);
            page.classList.remove('is-inking');
            void page.offsetWidth; // restart the ink bloom
            page.classList.add('is-inking');
        });
        page.addEventListener('animationend', (e) => {
            if (e.animationName === 'ch-ink-bloom') page.classList.remove('is-inking');
        });
        const toggle = () => {
            const willOpen = !page.classList.contains('is-open');
            closeOpenChroniclePages(page);
            setChroniclePageOpen(deck, page, willOpen);
        };
        page.addEventListener('click', (e) => {
            const openBtn = e.target.closest('.ch-page__open');
            if (openBtn) {
                e.stopPropagation();
                closeOpenChroniclePages();
                tabs.showTab(openBtn.dataset.chOpen);
                return;
            }
            toggle();
        });
        page.addEventListener('keydown', (e) => {
            if (e.target !== page || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            toggle();
        });
    });
}

function attachListeners(container) {
    container.querySelectorAll('[data-chronicle-deck]').forEach(wireChronicleDeck);

    container.querySelectorAll('.schedule-class-peek-btn').forEach(btn => {
        const open = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openScheduleClassRoster(btn.dataset.id);
        };
        btn.addEventListener('click', open);
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') open(e);
        });
    });
    container.querySelectorAll('.shortcut-tab-btn').forEach(btn => btn.addEventListener('click', () => tabs.showTab(btn.dataset.target)));
    container.querySelectorAll('.shortcut-action-btn').forEach(btn => btn.addEventListener('click', () => {
        handleAction(btn.dataset.action, btn.dataset);
    }));
}

/** School Schedule card → roster peek (lazy). Own classes get shortcuts; colleagues' are view-only. */
async function openScheduleClassRoster(classId, options = {}) {
    try {
        const { openClassRosterModal } = await import('../ui/modals/classRoster.js');
        openClassRosterModal(classId, {
            onEnterClass: (id) => {
                state.setGlobalSelectedClass(id, true);
                renderHomeTab();
            },
            onAwardStars: (id) => {
                state.setGlobalSelectedClass(id, true);
                tabs.showTab('award-stars-tab');
            },
            onEditClass: (id) => modals.openEditClassModal(id),
            onTeacherBoon: (id) => {
                state.setGlobalSelectedClass(id, true);
                renderHomeTab();
                modals.openTeacherBoonModal();
            }
        }, options);
    } catch (error) {
        console.error('Class roster unavailable:', error);
    }
}

/**
 * Hero view of the class roster for one student (Hero Stage → Hero stats).
 * @returns {boolean} false when the student's class is not on the school schedule.
 */
export function openRosterHeroView(studentId) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const known = student && (state.get('allSchoolClasses') || []).some((c) => c.id === student.classId);
    if (!known) return false;
    openScheduleClassRoster(student.classId, { heroId: studentId });
    return true;
}

async function activateOptionsSubtab(key) {
    await tabs.showOptionsSubtab(key);
}

async function openCreateClassForm(scopedLeague) {
    modals.openCreateClassModal({ league: scopedLeague });
}

async function handleAction(action, data) {
    const scopedLeague = (data?.league || '').trim();
    if (scopedLeague) {
        state.setGlobalSelectedLeague(scopedLeague, false);
    }

    if (action === 'open-day-planner') modals.openDayPlannerModal(utils.getTodayDateString(), document.body);
    else if (action === 'open-attendance') {
        const id = state.get('globalSelectedClassId');
        if (id) modals.openAttendanceChronicle(id); else tabs.showTab('adventure-log-tab');
    }
    else if (action === 'open-team-history') modals.openHistoryModal('team', { league: scopedLeague || null });
    else if (action === 'open-settings') await activateOptionsSubtab('classes');
    else if (action === 'open-holidays') await activateOptionsSubtab('planning');
    else if (action === 'open-my-classes') await activateOptionsSubtab('classes');
    else if (action === 'open-student-ranks') modals.openStudentRankingsModal();
    else if (action === 'create-class') await openCreateClassForm(scopedLeague);
    else if (action === 'edit-class') modals.openEditClassModal(data.id);
    else if (action === 'open-report') modals.handleGenerateReport(data.id);
}

function applyScheduleBasedClassSync() {
    const todayStr = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const todaysClasses = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    const myClasses = state.get('allTeachersClasses') || [];
    const myTodaysClasses = todaysClasses.filter(c => myClasses.some(mc => mc.id === c.id));
    const currentActiveLesson = utils.findCurrentLessonClass(myTodaysClasses);
    const currentSelectedId = state.get('globalSelectedClassId');
    const nextId = utils.resolveFollowScheduleClassId(
        state.get('classFollowSchedule'),
        currentActiveLesson,
        currentSelectedId
    );
    if (currentSelectedId !== nextId) {
        // setGlobalSelectedClass handles re-rendering the active tab internally
        state.setGlobalSelectedClass(nextId, false);
    }
}

function startHomeSmartLogic() {
    if (homeInterval) clearInterval(homeInterval);

    const checkLogic = () => {
        applyScheduleBasedClassSync();
        if (!document.hidden && canUseFeature('heroCampfire')) {
            const run = () => import('./campfire/campfireService.js').then(m => m.maybeKindleCampfire()).catch(e => console.warn('Campfire preparation unavailable:', e.code || e.message));
            if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 }); else setTimeout(run, 0);
        }

        // Update Grand Guild Ceremony buttons
        grandGuildCeremony.updateCeremonyButtons();
    };

    // Run immediately on load, then every 60 seconds
    checkLogic();
    homeInterval = setInterval(checkLogic, 60000);
}

/** One-shot: apply schedule-based class (in-session class, or General when none). */
export function runScheduleBasedClassSyncOnce() {
    applyScheduleBasedClassSync();
}

async function injectQuizButton() {
    const footer = document.getElementById('weather-card-footer');
    if (!footer) return;

    const classId = footer.dataset.quizClass || '';

    if (!classId) {
        // No class selected — no quiz button
        return;
    }

    try {
        const quizState = await shouldShowQuizButton(classId);

        if (quizState === 'show') {
            // Show Quiz button
            const quiz = await import('../db/actions/quizOfTheWeek.js').then(m =>
                m.getQuizForClass(classId)
            );
            const questionCount = quiz?.questions?.length || '?';

            footer.innerHTML = `<div class="quiz-week-btn-wrap"><button class="quiz-week-btn" id="quiz-week-trigger-btn" title="Quiz of the Week"><i class="fas fa-question"></i></button></div>`;

            document.getElementById('quiz-week-trigger-btn')?.addEventListener('click', () => {
                import('../ui/modals.js').then(m => m.openQuizModal(classId));
            });
        } else if (quizState === 'completed') {
            // Show completed state with results button
            footer.innerHTML = `<div class="quiz-week-btn-wrap"><button class="quiz-week-btn quiz-btn-completed" id="quiz-week-trigger-btn" title="View Quiz Results"><i class="fas fa-check"></i></button></div>`;

            document.getElementById('quiz-week-trigger-btn')?.addEventListener('click', () => {
                import('../ui/modals.js').then(m => m.openQuizModal(classId));
            });
        }
        // For all other states (not_first_lesson, outside_time, etc.), footer stays empty
    } catch (e) {
        console.warn('Quiz button injection failed:', e);
    }
}

export function setupHomeListeners() {
    document.querySelectorAll('[data-special-quest-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            const event = (state.get('allQuestEvents') || []).find((item) => item.id === button.dataset.specialQuestId);
            if (!event) return;
            const { openSpecialQuestRunner } = await import('../ui/modals/specialQuest.js');
            openSpecialQuestRunner(event);
        });
    });
    const infoBtn = document.getElementById('app-info-btn');
    if (infoBtn) {
        const newBtn = infoBtn.cloneNode(true);
        infoBtn.parentNode.replaceChild(newBtn, infoBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            modals.openAppInfoModal();
        });
    }

    const closeBtn = document.getElementById('app-info-close-btn');
    if (closeBtn) {
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', () => modals.hideModal('app-info-modal'));
    }

    const sBtn = document.getElementById('info-btn-students');
    const tBtn = document.getElementById('info-btn-teachers');
    const sContent = document.getElementById('info-content-students');
    const tContent = document.getElementById('info-content-teachers');

    const replayGuideAnimation = (rootEl) => {
        if (!rootEl) return;
        const animated = rootEl.querySelectorAll('.guide-stagger-item');
        animated.forEach(el => {
            el.style.animation = 'none';
        });
        // Force reflow so animation can restart cleanly
        void rootEl.offsetHeight;
        animated.forEach(el => {
            el.style.animation = '';
        });
    };

    if (sBtn && tBtn) {
        const newS = sBtn.cloneNode(true); sBtn.parentNode.replaceChild(newS, sBtn);
        const newT = tBtn.cloneNode(true); tBtn.parentNode.replaceChild(newT, tBtn);

        newS.addEventListener('click', () => {
            newS.classList.add('active');
            newT.classList.remove('active');
            sContent.classList.remove('hidden'); tContent.classList.add('hidden');
            replayGuideAnimation(sContent);
        });
        newT.addEventListener('click', () => {
            newT.classList.add('active');
            newS.classList.remove('active');
            tContent.classList.remove('hidden'); sContent.classList.add('hidden');
            replayGuideAnimation(tContent);
        });
    }

}

export async function maybeAutoShowGuideForTeacher(user) {
    if (!user?.uid) return;

    const teacherState = await loadTeacherJourneyState(user);
    if (teacherState.guideShownAt) return;

    setTimeout(() => {
        modals.openAppInfoModal();
    }, 900);

    try {
        await markTeacherGuideSeen(user);
    } catch (error) {
        console.warn('Could not mark guide as seen for teacher:', error);
    }
}

/**
 * One consistent Home reminder badge: icon bubble · eyebrow + title · optional tag.
 * Text is escaped here; `avatarHtml` / `trailingHtml` / `attrs` are trusted markup.
 */
function reminderPill({ tone = 'event', icon = '', emoji = '', avatarHtml = '', eyebrow = '', title = '', tag = '', trailingHtml = '', extraClass = '', tagName = 'div', attrs = '' }) {
    const lead = avatarHtml
        || `<span class="home-pill__icon" aria-hidden="true">${emoji ? escapeHtml(emoji) : `<i class="fas ${escapeHtml(icon)}"></i>`}</span>`;
    const typeAttr = tagName === 'button' ? ' type="button"' : '';
    return `
        <${tagName}${typeAttr} class="date-pill home-pill home-pill--${tone} ${extraClass}" ${attrs}>
            <span class="home-pill__shine" aria-hidden="true"></span>
            ${lead}
            <span class="home-pill__body">
                ${eyebrow ? `<span class="home-pill__eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
                <span class="home-pill__title">${escapeHtml(title)}</span>
            </span>
            ${tag ? `<span class="home-pill__tag">${escapeHtml(tag)}</span>` : ''}
            ${trailingHtml}
        </${tagName}>`;
}

function getReminderPills(classId) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let pills = [];

    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todaySuffix = `-${mm}-${dd}`;

    // 1. STUDENT BIRTHDAYS & NAMEDAYS
    let relevantStudents = state.get('allStudents');
    if (classId) {
        relevantStudents = relevantStudents.filter(s => s.classId === classId);
    } else {
        const myClassIds = state.get('allTeachersClasses').map(c => c.id);
        relevantStudents = relevantStudents.filter(s => myClassIds.includes(s.classId));
    }

    relevantStudents.forEach(s => {
        if (s.birthday && s.birthday.endsWith(todaySuffix)) {
            pills.push(reminderPill({ tone: 'birthday', emoji: '🎂', eyebrow: 'Birthday', title: `Happy Birthday, ${s.name.split(' ')[0]}!`, extraClass: 'home-pill--party' }));
        }
        if (s.nameday && s.nameday.endsWith(todaySuffix)) {
            pills.push(reminderPill({ tone: 'nameday', emoji: '🎈', eyebrow: 'Name day', title: `${s.name.split(' ')[0]}'s Nameday!` }));
        }
    });

    if (canUseFeature('scholarScroll')) {
        const todaysTests = getNextAssessmentOccurrenceForToday(classId);
        todaysTests.forEach((assignment) => {
            const classLine = assignment.classData ? `${assignment.classData.logo || '📚'} ${assignment.classData.name}` : 'Today';
            const testTones = { red: 'test-urgent', rose: 'test-rose', orange: 'test-amber', emerald: 'test-emerald', slate: 'test-slate', amber: 'test-rose' };
            pills.push(reminderPill({
                tone: testTones[assignment.tone] || 'test-rose',
                icon: `fa-${assignment.icon}`,
                eyebrow: classId ? assignment.statusLabel : classLine,
                title: assignment.testData?.title || 'Scheduled Test',
                tag: assignment.chipLabel
            }));
        });
    }

    // 2. CEREMONY REMINDER — previous instructional month only (never August)
    if (classId) {
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        const pending = resolvePendingCeremonyMonth(now);
        if (cls && pending) {
            const isDone = cls.ceremonyHistory && cls.ceremonyHistory[pending.monthKey] && cls.ceremonyHistory[pending.monthKey].complete;

            if (!isDone) {
                const isGrowth = cls.questLevel === 'Nursery' || cls.questLevel === 'Pre-Junior';
                const ceremonyClass = isGrowth ? 'date-pill--ceremony-growth' : '';
                const pillIcon = isGrowth ? 'fa-seedling' : 'fa-trophy';
                const kicker = isGrowth ? 'Growth Festival' : 'Ceremony of the Month';

                pills.push(`
                    <button type="button" id="trigger-ceremony-btn" class="date-pill date-pill--ceremony ${ceremonyClass}" data-class-id="${classId}" aria-label="Start the ${pending.monthName} ${kicker}">
                        <span class="date-pill--ceremony__aurora" aria-hidden="true"></span>
                        <span class="date-pill--ceremony__sheen" aria-hidden="true"></span>
                        <span class="date-pill--ceremony__spark date-pill--ceremony__spark--a" aria-hidden="true">✦</span>
                        <span class="date-pill--ceremony__spark date-pill--ceremony__spark--b" aria-hidden="true">✧</span>
                        <span class="date-pill--ceremony__icon" aria-hidden="true"><i class="fas ${pillIcon}"></i></span>
                        <span class="date-pill--ceremony__copy">
                            <span class="date-pill--ceremony__kicker">${kicker}</span>
                            <span class="date-pill--ceremony__title">${pending.monthName}</span>
                        </span>
                    </button>
                `);

                setTimeout(() => {
                    const btn = document.getElementById('trigger-ceremony-btn');
                    if (btn) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            import('./ceremony.js').then(m => {
                                m.checkAndInitCeremony(classId).then(params => {
                                    if (params) m.startCeremony(params);
                                });
                            });
                        };
                    }
                }, 100);
            }
        }
    }

    // 3. UPCOMING HOLIDAYS (Restored)
    const holidays = state.get('schoolHolidayRanges') || [];
    const upcomingHoliday = holidays.find(h => {
        const startDate = new Date(h.start);
        return startDate >= now && startDate <= endOfMonth;
    });

    if (upcomingHoliday) {
        const startDate = new Date(upcomingHoliday.start);
        const diffTime = startDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let label = upcomingHoliday.name;
        let icon = 'fa-umbrella-beach';
        let tone = 'holiday';
        let timeText = diffDays === 0 ? "Starts Today!" : (diffDays === 1 ? "Starts Tomorrow!" : `in ${diffDays} days`);

        if (label.toLowerCase().includes('christmas') || label.toLowerCase().includes('winter')) {
            icon = 'fa-snowflake';
            tone = 'holiday-winter';
            label = `🎄 ${label}`;
        } else if (label.toLowerCase().includes('easter')) {
            icon = 'fa-egg';
            tone = 'holiday-easter';
            label = `🐰 ${label}`; // Added Bunny Emoji here!
        }

        pills.push(reminderPill({ tone, icon, eyebrow: 'Holiday', title: label, tag: timeText }));
    }

    // 4. QUEST EVENTS (Test/Vocab/etc) — use smart date parser (any format)
    const events = state.get('allQuestEvents') || [];
    const sortedEvents = [...events].sort((a, b) => {
        const da = utils.parseFlexibleDate(a.date);
        const db = utils.parseFlexibleDate(b.date);
        return (da || 0) - (db || 0);
    });

    // When viewing a specific class, pre-compute which dates the class has lessons
    // so we only show events relevant to that class.
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const allScheduleOverrides = state.get('allScheduleOverrides') || [];
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};

    sortedEvents.forEach(e => {
        const eventDate = utils.parseFlexibleDate(e.dateKey || e.date);
        if (!eventDate) return;
        eventDate.setHours(0, 0, 0, 0);

        // Show only from today through end of month
        if (eventDate < now || eventDate > endOfMonth) return;

        // --- CLASS RELEVANCY FILTER ---
        // In a class view, only show the event if that class actually has a lesson on that day.
        // utils.getClassesOnDay uses parseDDMMYYYY which handles both DD-MM-YYYY and YYYY-MM-DD.
        if (classId) {
            const d = eventDate;
            const eventDateDDMMYYYY = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
            const classesOnThatDay = utils.getClassesOnDay(eventDateDDMMYYYY, allSchoolClasses, allScheduleOverrides, classEndDates);
            if (!classesOnThatDay.some(c => c.id === classId)) return; // Skip — not a lesson day for this class
        }

        const diffTime = eventDate - now;
        // Χρησιμοποιούμε round για να αποφύγουμε μικρολάθη στα milliseconds
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const timeText = diffDays === 0 ? "Today!" : (diffDays === 1 ? "Tomorrow!" : `in ${diffDays} days`);

        const normalizedType = normalizeQuestType(e.type);
        const title = e.details?.title || QUEST_TYPE_LABELS[normalizedType] || (normalizedType === 'double_star_day' ? '2x Star Day' : normalizedType === 'reason_bonus_day' ? 'Reason Bonus Day' : e.type);
        const isDoubleStar = title.toLowerCase().includes('2x star');

        // Ορίζουμε το στυλ: Αν είναι 2x Star Day, βάζουμε χρυσό gradient και animation
        pills.push(reminderPill(isDoubleStar
            ? { tone: 'star-day', icon: 'fa-bolt-lightning', eyebrow: 'Quest Event', title, tag: timeText, extraClass: 'star-day-glow' }
            : { tone: 'event', icon: 'fa-magic', eyebrow: 'Quest Event', title, tag: timeText }));
    });


    const todaysSpecial = sortedEvents.find((event) => {
        const eventDate = utils.parseFlexibleDate(event.dateKey || event.date);
        return eventDate && eventDate.toDateString() === now.toDateString() && isSpecialQuestType(normalizeQuestType(event.type)) && (!classId || !event.classId || event.classId === classId);
    });
    if (todaysSpecial) {
        pills.push(reminderPill({
            tone: 'special-quest', icon: 'fa-play-circle', eyebrow: 'Special Quest', title: "Start today's Quest",
            tagName: 'button', extraClass: 'home-pill--action', attrs: `data-special-quest-id="${escapeHtml(todaysSpecial.id)}"`
        }));
    }

    // 5. ACTIVE BOUNTY (Timer removed — shown in wallpaper mode instead)
    if (classId) {
        const activeBounty = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active' && b.type === 'standard');

        if (activeBounty) {
            const pct = Math.min(100, Math.round((activeBounty.currentProgress / activeBounty.target) * 100));
            pills.push(`
                <button type="button" class="date-pill date-pill--quest date-pill--quest-bounty" onclick="document.getElementById('bounty-board-container').scrollIntoView({behavior: 'smooth'})">
                    <span class="date-pill__glow"></span>
                    <span class="date-pill__orbit date-pill__orbit--one"></span>
                    <span class="date-pill__orbit date-pill__orbit--two"></span>
                    <span class="date-pill__icon-shell">
                        <span class="date-pill__icon-ring"></span>
                        <span class="date-pill__icon"><i class="fas fa-bullseye"></i></span>
                    </span>
                    <span class="date-pill__body">
                        <span class="date-pill__eyebrow">Active Bounty</span>
                        <span class="date-pill__title">${activeBounty.title}</span>
                        <span class="date-pill__meta">Progress is rolling in</span>
                    </span>
                    <span class="date-pill__value-wrap">
                        <span class="date-pill__value">${pct}%</span>
                        <span class="date-pill__subvalue">${activeBounty.currentProgress}/${activeBounty.target} stars</span>
                    </span>
                </button>
             `);
        }
    }

    // Hero of the Day Pill
    const reigningHero = state.get('reigningHero');
    if (reigningHero && classId) {
        const heroAvatar = reigningHero.avatar
            ? `<img src="${escapeHtml(reigningHero.avatar)}" alt="" class="home-pill__avatar">`
            : `<span class="home-pill__avatar home-pill__avatar--initial">${escapeHtml(reigningHero.name.charAt(0))}</span>`;
        pills.push(reminderPill({
            tone: 'hero', avatarHtml: heroAvatar, eyebrow: 'Reigning Hero', title: reigningHero.name.split(' ')[0],
            trailingHtml: '<span class="home-pill__perks"><i class="fas fa-shield-alt" title="Hero&#39;s Boon (+1 Star)"></i><i class="fas fa-tags" title="Merchant&#39;s Favorite (-2 Gold)"></i></span>'
        }));
    }

    if (pills.length === 0) return '';
    return pills.join('');
}

// --- NEW: Database-backed Shared Caching ---
function isStaticFallbackQuote(content, type) {
    const fallback = FALLBACK_QUOTES[type] || FALLBACK_QUOTES.default;
    return String(content || '').trim() === fallback;
}

function buildDailyQuoteUserPrompt(type, todayKey) {
    // Include the local day so each day's request is distinct for cache keys and model variety.
    if (type === 'quote_header') {
        return `For ${todayKey}, generate one fresh short quote about new beginnings or focus. Do not reuse yesterday's wording.`;
    }
    if (type === 'quote_widget') {
        return `For ${todayKey}, generate one fresh short quote about curiosity or nature. Do not reuse yesterday's wording.`;
    }
    return `For ${todayKey}, generate one fresh short inspiring classroom quote.`;
}

async function getAICachedContent(type) {
    const todayKey = utils.getLocalIsoDateString();
    const docId = `daily_content_${todayKey}_${type}`;
    const localKey = `gcq_daily_content_${docId}`;
    const fallback = FALLBACK_QUOTES[type] || FALLBACK_QUOTES.default;

    try {
        const localCached = localStorage.getItem(localKey);
        // Never treat the static fallback as a successful cache hit — that permanently
        // blocked daily AI retries after a single failed generation.
        if (localCached && !isStaticFallbackQuote(localCached, type)) return localCached;
        if (localCached && isStaticFallbackQuote(localCached, type)) {
            try { localStorage.removeItem(localKey); } catch (_) {}
        }
    } catch (e) {
        console.warn("Local quote cache read failed.", e);
    }

    if (dailyContentInFlight.has(docId)) {
        return dailyContentInFlight.get(docId);
    }

    const requestPromise = (async () => {
        // 1. Check Firebase First (Shared Cache)
        try {
            const docRef = doc(db, "artifacts/great-class-quest/public/data/daily_cache", docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const content = String(docSnap.data()?.content || '').trim();
                if (content && !isStaticFallbackQuote(content, type)) {
                    try {
                        localStorage.setItem(localKey, content);
                    } catch (e) {
                        console.warn("Local quote cache write failed.", e);
                    }
                    return content;
                }
            }
        } catch (e) {
            console.warn("Cache fetch skipped, trying generation.");
        }

        // 2. Generate if not found (Elite only)
        if (!canUseFeature('eliteAI')) {
            return fallback;
        }

        try {
            const systemPrompt = "You are a wise sage for a classroom. Generate a short, inspiring quote (max 10 words). No markdown. Just the text.";
            const userPrompt = buildDailyQuoteUserPrompt(type, todayKey);

            // Quotes can take >5s because the worker may throttle upstream requests.
            // Keep retries low, but allow enough time for a real response.
            const content = String(
                await callGeminiApi(systemPrompt, userPrompt, { retries: 1, baseDelay: 500, timeoutMs: 20000 })
            ).trim();
            if (!content || isStaticFallbackQuote(content, type)) {
                throw new Error('AI returned an empty or static fallback quote.');
            }

            // 3. Save to Firebase (So others don't have to generate)
            try {
                const { setDoc } = await import('../firebase.js');
                await setDoc(doc(db, "artifacts/great-class-quest/public/data/daily_cache", docId), {
                    content: content,
                    date: todayKey,
                    type: type
                });
            } catch (e) {
                console.error("Failed to save to cache", e);
            }

            try {
                localStorage.setItem(localKey, content);
            } catch (e) {
                console.warn("Local quote cache write failed.", e);
            }

            return content;
        } catch (e) {
            console.error(e);
            // Do not cache the static fallback — a transient AI failure must not
            // lock the home quote for the rest of the day.
            return fallback;
        }
    })().finally(() => {
        dailyContentInFlight.delete(docId);
    });

    dailyContentInFlight.set(docId, requestPromise);
    return requestPromise;
}

async function fetchWeatherData() {
    const location = utils.getActiveWeatherLocation();
    const storageKey = utils.getWeatherCacheKey('gcq_weather_data_open_meteo', location);
    const now = Date.now();

    let cached = null;
    try {
        cached = localStorage.getItem(storageKey);
    } catch (_) {
        // Storage may be unavailable in hardened/private browser profiles.
    }
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (now - data.timestamp < 3600000) {
                return data.weather;
            }
        } catch (e) { localStorage.removeItem(storageKey); }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`, {
            signal: controller.signal
        });
        if (!response.ok) throw new Error('Weather API failed');
        const data = await response.json();

        const hi = Number(data.daily?.temperature_2m_max?.[0]);
        const lo = Number(data.daily?.temperature_2m_min?.[0]);
        const weather = {
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
            hi: Number.isFinite(hi) ? Math.round(hi) : null,
            lo: Number.isFinite(lo) ? Math.round(lo) : null
        };

        try {
            localStorage.setItem(storageKey, JSON.stringify({ timestamp: now, weather }));
        } catch (_) {
            // Weather is optional; a blocked local cache must not break home.
        }
        return weather;
    } catch (e) {
        if (e?.name === 'AbortError') {
            console.warn('Open-Meteo timed out; continuing without the optional weather card.');
        } else {
            console.error("Open-Meteo fetch failed:", e);
        }
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * SOURCE OF TRUTH: This function implements the EXACT math from the Team Quest (tabs.js).
 * It uses a monthly modifier based on holidays rather than counting lessons.
 */
function calculateMonthlyClassGoal(classData, studentCount) {
    return utils.calculateMonthlyClassGoal(
        classData,
        studentCount,
        state.get('schoolHolidayRanges'),
        state.get('allScheduleOverrides')
    );
}

function getTopSkillHtml(skill) {
    if (!skill) {
        return {
            html: `<div class="font-title text-3xl text-green-800 truncate">Ready to Quest!</div>`,
            theme: 'card-gradient-mint'
        };
    }

    // Define colors and gradients for each skill
    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'purple', name: 'Teamwork', theme: 'bg-gradient-to-br from-violet-100 to-purple-200 border-purple-300' },
        creativity: { icon: 'fa-lightbulb', color: 'pink', name: 'Creativity', theme: 'bg-gradient-to-br from-pink-100 to-rose-200 border-rose-300' },
        respect: { icon: 'fa-hands-helping', color: 'green', name: 'Respect', theme: 'bg-gradient-to-br from-emerald-100 to-green-200 border-green-300' },
        focus: { icon: 'fa-brain', color: 'yellow', name: 'Focus', theme: 'bg-gradient-to-br from-amber-100 to-yellow-200 border-amber-300' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'cyan', name: 'Welcome', theme: 'bg-gradient-to-br from-cyan-100 to-sky-200 border-sky-300' },
        story_weaver: { icon: 'fa-feather-alt', color: 'cyan', name: 'Story', theme: 'bg-gradient-to-br from-cyan-100 to-blue-200 border-cyan-300' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'amber', name: 'Scholar', theme: 'bg-gradient-to-br from-orange-100 to-amber-200 border-orange-300' }
    };

    const info = reasonInfo[skill] || { icon: 'fa-star', color: 'gray', name: skill.replace('_', ' '), theme: 'card-gradient-mint' };

    const html = `
        <div class="flex items-center gap-3">
            <div class="text-4xl text-${info.color}-600 filter drop-shadow-sm"><i class="fas ${info.icon}"></i></div>
            <div class="text-left">
                <div class="font-title text-2xl text-${info.color}-900 truncate capitalize">${info.name}</div>
            </div>
        </div>
    `;

    return { html, theme: info.theme };
}
