import { db, doc, getDoc } from '../firebase.js';
import * as ceremony from '../features/ceremony.js';
import { resolvePendingCeremonyMonth } from './ceremonyDomain.js';
import { getCeremonyStarVerdict, ensureCeremonyStarVerdict } from './ceremonyStarCheck.js';
import * as state from '../state.js';
import { normalizeQuestType, QUEST_TYPE_LABELS } from './specialQuestEngine.js';
import { isSpecialQuestType } from './specialQuestEngine.js';
import * as utils from '../utils.js';
import { bountyAudienceLabel } from '../ui/bountyAudienceTag.js';
import * as tabs from '../ui/tabs.js';
import * as modals from '../ui/modals.js';
import { buildHomePartyCardHtml } from './homePartyCard.mjs';
import { buildHomeQuestRoadCardHtml } from './homeQuestRoadCard.mjs';
import { normalizeChroniclerText } from './adventurePageCore.mjs';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import { getHomeGlobalTools, getHomeClassActions, getClassToolCounts } from './homeGlobalTools.mjs';
import {
    DAILY_QUOTE_SYSTEM_PROMPT,
    buildDailyQuoteUserPrompt,
    cleanGeneratedQuote,
    decideDailyQuoteClaim,
    getCuratedDailyQuote,
    isCuratedDailyQuote,
    isTooSimilarQuote,
    isUsableQuote
} from '../utils/dailyQuote.mjs';
import * as grandGuildCeremony from '../features/grandGuildCeremony.js';
import { DEFAULT_SCHOOL_NAME } from '../constants.js';
import { loadTeacherJourneyState, markTeacherGuideSeen } from './teacherJourney.js';
import { getNextAssessmentOccurrenceForToday, getUpcomingScheduledAssessment } from './assessmentConfig.js';
import { shouldShowQuizButton } from './quizOfTheWeek.js';
import { quizLaunchButtonHtml } from '../ui/modals/quizStageMarkup.js';
import { sumLiveMonthlyStarsFromStudentScores } from './awardLogReasonMeta.js';
import { escapeHtml } from './roles/shared.js';
import { getRaidView, raidPill, subscribeRaid, openRealmRaid } from './realmRaid.js';
import {
    resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';
import { buildScheduleEmptySceneHtml } from '../utils/scheduleEmptyScene.js';
import { getGreetingSkyHtml, getDayRingEmblemHtml, startDayRingClock, syncDayRing } from './homeGreetingScene.js';
import { isSchoolYearAwaitingOpen } from '../utils/schoolYear.js';
import { sumLiveYearGoldFromAppState } from '../utils/yearGold.js';
import {
    resolveWeatherTheme,
    withNightWeatherText
} from './weatherTheme.js';
import { fetchLiveWeather, applyLiveSky, isWeatherForActiveLocation } from './liveWeather.js';
import { getSkyScene, getLastSkyReading } from './skyWeatherStage.js';
import { getWeatherCardHtml, getClockHandAngles, formatClockTime, refreshWeatherCardInPlace } from './weatherCard.js';
import { morphChildNodes } from '../utils/domMorph.mjs';
import { PUBLIC_DATA_PATH, dataPath } from '../utils/tenant.mjs';

export { initializeHeaderQuote, fetchDailySpice };

let homeInterval = null;
let homeQuestTimerInterval = null;
let homeClockInterval = null;
let renderDebounce = null;
let currentRenderedViewId = null;
let hasPlayedInitialHomeEntrance = false;
let homeEntrancePending = false;

// v2: day-seeded prompts + recent-quote memory. The new doc id also retires the
// old per-day cache entries that were generated from one fixed prompt.
const DAILY_QUOTE_TYPE = 'quote_daily_v2';
const DAILY_QUOTE_HISTORY_KEY = 'gcq_daily_quote_history_v2';
const DAILY_QUOTE_HISTORY_LIMIT = 21;
const DAILY_QUOTE_LOOKBACK_DAYS = 5;
// School-wide guard: one laptop claims the day's generation, the rest wait for it.
const DAILY_QUOTE_CLAIM_MS = 90 * 1000;
const DAILY_QUOTE_MAX_ATTEMPTS = 3; // AI calls per day for the whole school, even if the AI keeps failing
const DAILY_QUOTE_WAIT_POLLS = [8000, 12000, 20000];

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
    const cachedIsFallback = isCuratedDailyQuote(dailySpiceState.value?.headerQuote);
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
        const headerQuote = await getDailyQuote();

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

/** The weather card's words and colours for a reading, by day or by night. */
function weatherThemeForReading(weatherData, isNight) {
    const theme = { isNight };
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
    return theme;
}

// While Home is open, its weather card follows the sky in place: new weather or
// nightfall changes the words and glyph, and the stage melts the card's sky.
if (typeof window !== 'undefined') {
    window.addEventListener('gcq:sky-scene', (event) => {
        const card = document.querySelector('#home-tab .weather-card--v3, #home-dashboard-container .weather-card--v3');
        const scene = event.detail?.scene;
        if (!card || !scene) return;
        const reading = event.detail.reading || null;
        const theme = weatherThemeForReading(reading, utils.getCurrentDayPart().isNight);
        refreshWeatherCardInPlace(card, theme, scene, { reading, sun: utils.getSolarTimes() });
    });
}

/**
 * Draws Home. Live data (a colleague's stars, attendance, the school's settings) calls this
 * often, so a refresh of the same view only patches what changed (see patchHomeDashboard).
 * `entrance: true` (opening the Home tab) redraws it whole so the cards play their entrance.
 */
export function renderHomeTab({ entrance = false } = {}) {
    if (entrance) homeEntrancePending = true;
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

    // Dynamic Weather/Theme. The sky already on screen is the source: opening Home
    // never repaints it (new weather arrives on the live timer and melts in, see
    // features/liveWeather.js). Only the very first visit, before any reading, fetches.
    const lastReading = getSkyScene() ? getLastSkyReading() : null;
    const skyReading = isWeatherForActiveLocation(lastReading) ? lastReading : null;
    const weatherData = skyReading || await fetchLiveWeather();

    // One shared day/night source, so the greeting and the weather card never disagree.
    const dayPartInfo = utils.getCurrentDayPart();
    let theme = weatherThemeForReading(weatherData, dayPartInfo.isNight);

    // --- STEP 2: PAINT THE SKY (header band, Award sky, phone header, Projector) ---
    theme.reading = weatherData;
    theme.sky = skyReading ? getSkyScene() : applyLiveSky(weatherData);
    theme.sun = utils.getSolarTimes();

    // --- STEP 3: GREETING (same day/night source as the weather card) ---
    theme.greeting = dayPartInfo.greeting;
    theme.dayPart = dayPartInfo.part; // morning | afternoon | evening | night
    theme.greetingGradient = dayPartInfo.gradient;
    theme.nameGradient = "from-slate-700 to-slate-500";

    // --- STEP 4: FETCH SPICE & RENDER (non-blocking) ---
    const spice = { headerQuote: getCuratedDailyQuote(utils.getLocalIsoDateString()) };
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

    // DOM Update. A new view (another class, General) or opening the tab redraws the whole
    // dashboard; a live refresh of the same view only patches the cards that changed, so a
    // colleague's stars never make every card replay its entrance (the Home "flashing").
    const isViewChange = currentRenderedViewId !== viewId;
    currentRenderedViewId = viewId;
    const entrance = homeEntrancePending;
    homeEntrancePending = false;
    const fragment = homeDashboardFragment(contentHtml);
    const wrapper = container.firstElementChild;
    if (!isViewChange && !entrance && wrapper?.querySelector('.horizons-grid')) {
        patchHomeDashboard(wrapper, fragment, theme);
    } else {
        const fresh = document.createElement('div');
        fresh.className = isViewChange ? 'home-fade w-full h-full' : 'w-full h-full';
        fresh.appendChild(fragment);
        container.replaceChildren(fresh);
    }

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

/** Classes Home's scripts add for a while (an unfolded Chronicle page, its ink bloom): a patch keeps them. */
const HOME_SCRIPT_CLASSES = ['is-open', 'has-open', 'is-inking', 'date-pill--quest-tone-shift', 'date-pill--quest-exit'];

function hashMarkup(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

/**
 * The dashboard markup as nodes, each card stamped with a signature of its markup. A card whose
 * signature has not changed since the last draw is left exactly as it is on the next refresh.
 * The greeting hills get fresh gradient ids on every draw, so those are left out of the signature.
 */
function homeDashboardFragment(contentHtml) {
    const tpl = document.createElement('template');
    tpl.innerHTML = contentHtml;
    tpl.content.querySelectorAll('.horizons-grid > *').forEach((card) => {
        card.setAttribute('data-home-sig', hashMarkup(card.outerHTML.replace(/\bgh-\d+-/g, 'gh-')));
    });
    return tpl.content;
}

/**
 * Brings the dashboard on screen up to date in place. Unchanged cards stay untouched; changed
 * ones are morphed (only the differing text and attributes move). Parts that look after
 * themselves stay put: the weather card (refreshed in place, like the live sky does), the
 * greeting's sky and hills (painted by the sky stage) and the day ring (its own clock).
 */
function patchHomeDashboard(wrapper, fragment, theme) {
    morphChildNodes(wrapper, fragment, {
        keep(from, to) {
            const sig = to.getAttribute('data-home-sig');
            if (sig && from.getAttribute('data-home-sig') === sig) return true;
            if (from.classList.contains('weather-card--v3') && to.classList.contains('weather-card--v3')) {
                if (from.className !== to.className) from.className = to.className;
                if (sig) from.setAttribute('data-home-sig', sig);
                refreshWeatherCardInPlace(from, theme, theme.sky, { reading: theme.reading, sun: theme.sun });
                return true;
            }
            if (from.classList.contains('greeting-sky') && to.classList.contains('greeting-sky')) return true;
            if (from.hasAttribute('data-day-ring') && to.hasAttribute('data-day-ring')) return syncDayRing(from, to);
            return false;
        },
        // Badges other code mounts into the greeting (the Campfire) are theirs to keep.
        isForeign: (node) => node.classList.contains('campfire-entry'),
        keepClasses: HOME_SCRIPT_CLASSES,
    });
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

/** One launcher tile for Global Tools / Class Actions (styles/home.css .gt-tile). */
function homeToolTileHtml(t, i, activeLeague = '') {
    const league = t.scoped ? (activeLeague || '') : '';
    return `
                    <button type="button"
                        class="gt-tile gt-tile--${t.tone} shortcut-action-btn"
                        style="--gt-i:${i}"
                        data-action="${t.action}"
                        data-id="${t.classId || ''}"
                        data-subtab="${t.subtab || ''}"
                        data-league="${league}"
                        title="${league ? `${t.label} for ${league} League` : t.label}">
                        <span class="gt-tile__icon" aria-hidden="true"><i class="fas ${t.icon}"></i></span>
                        <span class="gt-tile__text">
                            <span class="gt-tile__label">${t.label}</span>
                            <span class="gt-tile__hint">${escapeHtml(t.hint)}</span>
                        </span>
                        <i class="fas fa-chevron-right gt-tile__go" aria-hidden="true"></i>
                    </button>`;
}

function getGeneralDashboard(name, theme, spice) {
    const today = utils.getTodayDateString();
    const activeLeague = resolveActiveHomeLeague();

    const myClasses = state.get('allTeachersClasses') || [];
    const totalStudents = state.get('allStudents').length;
    const allScores = state.get('allStudentScores') || [];

    const schoolStars = sumLiveMonthlyStarsFromStudentScores(allScores);

    const totalGold = sumLiveYearGoldFromAppState(allScores, state);
    const todaysClasses = isSchoolYearAwaitingOpen(state.get('schoolYearState'))
        ? []
        : utils.getClassesOnDay(
            today,
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        );
    const todaysClassCount = todaysClasses.length;
    const myClassIds = new Set(myClasses.map(c => c.id));
    const myTodaysClasses = todaysClasses.filter(c => myClassIds.has(c.id));
    const myLessonsToday = myTodaysClasses.length;
    const tools = getHomeGlobalTools({ canUseFeature, myLessonsToday, myClassCount: myClasses.length });

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
            <div class="gt-grid">
                ${tools.map((t, i) => homeToolTileHtml(t, i, activeLeague)).join('')}
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

    const { totalStars: monthlyStarsWithBonus, classBonus } = utils.getClassMonthlyQuestStars(classData, students, scores, now);

    // NEW: Dynamic goal based on actual lessons, holidays, and overrides
    // NEW: Pass the full classData to match Leaderboard logic
    let goal = calculateMonthlyClassGoal(classData, students.length);
    if (goal < 18) goal = 18; // Shared safety floor

    // Fetch story when missing; patch chronicle text only (avoid full home DOM swap / flash)
    if (!state.get('currentStoryData')[classId]) {
        const storyRef = doc(db, `${PUBLIC_DATA_PATH}/story_data`, classId);
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
    const lastLogText = logs.length > 0 ? normalizeChroniclerText(logs[0].text) : "No adventures chronicled yet.";
    const lastLogDate = logs.length > 0 ? new Date(utils.parseDDMMYYYY(logs[0].date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : '';

    const absentTodayIds = new Set(
        (state.get('allAttendanceRecords') || [])
            .filter(r => r.classId === classId && r.date === today)
            .map(r => r.studentId)
    );

    const partyHeroes = students.map(s => {
        const scoreData = scores.find(sc => sc.id === s.id);
        return { id: s.id, name: s.name, avatar: s.avatar, monthlyStars: scoreData?.monthlyStars || 0, pendingSkillChoice: !!scoreData?.pendingSkillChoice };
    });

    const classLogs = state.get('allAwardLogs').filter(l => l.classId === classId);
    const virtueStars = {};
    classLogs.forEach(l => { if (l.reason) virtueStars[l.reason] = (virtueStars[l.reason] || 0) + l.stars; });

    const boon = classData.teacherBoons?.[utils.getLocalMonthKey()] || null;
    const boonHero = boon ? students.find(st => st.id === boon.studentId) : null;
    const tools = getHomeClassActions({
        classId,
        heroCount: students.length,
        absentToday: absentTodayIds.size,
        boonWindow: utils.isTeacherBoonWindow(),
        boonGivenTo: boonHero ? String(boonHero.name || '').split(/\s+/)[0] : '',
        ...getClassToolCounts({ classData, studentIds: students.map(s => s.id), absentIds: absentTodayIds, dateKey: today }),
    });

    return getLayout(
        name, theme, getHomeBountyPillHtml(),
        `
        ${buildHomeQuestRoadCardHtml({ stars: monthlyStarsWithBonus, goal, bonus: classBonus, logo: classData.logo || '📚' })}
        
        ${buildHomePartyCardHtml({ students: partyHeroes, virtueStars, absentIds: absentTodayIds })}
        
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
            <div class="gt-grid">
                ${tools.map((t, i) => homeToolTileHtml(t, i)).join('')}
            </div>
        </div>
        `
    );
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

function getLayout(name, theme, selector, row2, row3) {
    const heroEmoji = state.get('globalSelectedClassId')
        ? (state.get('allSchoolClasses').find(c => c.id === state.get('globalSelectedClassId'))?.logo || '✨')
        : '🏫';
    const dayPart = theme.dayPart || 'afternoon';

    return `
    <div class="w-full max-w-7xl mx-auto p-4">
        <div class="horizons-grid">

            <div class="vibrant-card h-span-8 greeting-panel greeting-panel--${dayPart}">
                <div class="greeting-bg-mesh"></div>
                ${getGreetingSkyHtml()}
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

            ${getWeatherCardHtml(theme, theme.sky, { reading: theme.reading, sun: theme.sun, quizClassId: state.get('globalSelectedClassId') || '' })}

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
        return buildScheduleEmptySceneHtml(emptyState);
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
        if (!firstWiring(page)) return;
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

// A live refresh keeps most of Home's nodes, so each one is wired once, never twice.
const wiredHomeNodes = new WeakSet();
const firstWiring = (node) => {
    if (wiredHomeNodes.has(node)) return false;
    wiredHomeNodes.add(node);
    return true;
};

function attachListeners(container) {
    container.querySelectorAll('[data-chronicle-deck]').forEach(wireChronicleDeck);

    container.querySelectorAll('.schedule-class-peek-btn').forEach(btn => {
        if (!firstWiring(btn)) return;
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
    container.querySelectorAll('.shortcut-tab-btn').forEach(btn => {
        if (firstWiring(btn)) btn.addEventListener('click', () => tabs.showTab(btn.dataset.target));
    });
    container.querySelectorAll('.shortcut-action-btn').forEach(btn => {
        if (firstWiring(btn)) btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset));
    });
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
    else if (action === 'open-holidays') await activateOptionsSubtab('planning');
    else if (action === 'open-options') await activateOptionsSubtab(data?.subtab || 'classes');
    else if (action === 'open-student-ranks') modals.openStudentRankingsModal();
    else if (action === 'create-class') await openCreateClassForm(scopedLeague);
    else if (action === 'edit-class') modals.openEditClassModal(data.id);
    else if (action === 'open-report') modals.handleGenerateReport(data.id);
    else if (action === 'open-class-roster') openScheduleClassRoster(data.id);
    else if (action === 'open-prodigies') modals.openProdigyModal();
    else if (action === 'open-teacher-boon') modals.openTeacherBoonModal();
    else if (action === 'open-team-maker') import('../ui/modals/teamMaker.js').then(m => m.openTeamMaker(data?.id || null));
    else if (action === 'open-fair-picker') import('../ui/modals/fairPicker.js').then(m => m.openFairPicker(data?.id || null));
}

function applyScheduleBasedClassSync() {
    const todayStr = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const todaysClasses = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    const myClasses = state.get('allTeachersClasses') || [];
    const myTodaysClasses = todaysClasses.filter(c => myClasses.some(mc => mc.id === c.id));
    const currentActiveLesson = utils.findLessonClassWithGrace(myTodaysClasses);
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

/** Puts the quiz ticket in the weather card's footer; a live refresh with the same ticket leaves it be. */
function setQuizFooter(footer, html, classId) {
    if (!footer.isConnected) return;
    const key = `${classId}:${hashMarkup(html)}`;
    if (footer.dataset.quizKey === key && (footer.firstElementChild || !html)) return;
    footer.innerHTML = html;
    footer.dataset.quizKey = key;
    if (!html) return;
    footer.querySelector('#quiz-week-trigger-btn')?.addEventListener('click', () => {
        import('../ui/modals.js').then(m => m.openQuizModal(classId));
    });
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
            const questionCount = (quiz?.questions || []).filter(q => q.type === 'mcq').length;

            setQuizFooter(footer, quizLaunchButtonHtml({ questionCount }), classId);
        } else if (quizState === 'completed') {
            // Show completed state with results button
            setQuizFooter(footer, quizLaunchButtonHtml({ completed: true }), classId);
        } else {
            // All other states (not_first_lesson, outside_time, etc.): no ticket. A live
            // refresh keeps the card, so a ticket from earlier is taken down here.
            setQuizFooter(footer, '', classId);
        }
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
    // The guide wires its own close, chapter and search controls (ui/modals/adventurersGuide.js).
}

export async function maybeAutoShowGuideForTeacher(user) {
    if (!user?.uid) return;

    const teacherState = await loadTeacherJourneyState(user);
    if (teacherState.guideShownAt) return;

    setTimeout(() => {
        modals.openAppInfoModal({ audience: 'teacher', chapter: 'start' });
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

function ceremonyPillHtml(cls, pending) {
    const isGrowth = cls.questLevel === 'Pre-Junior';
    const ceremonyClass = isGrowth ? 'date-pill--ceremony-growth' : '';
    const pillIcon = isGrowth ? 'fa-seedling' : 'fa-trophy';
    const kicker = isGrowth ? 'Growth Festival' : 'Ceremony of the Month';
    return `
        <button type="button" id="trigger-ceremony-btn" class="date-pill date-pill--ceremony ${ceremonyClass}" data-class-id="${cls.id}" aria-label="Start the ${pending.monthName} ${kicker}">
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
    `;
}

function wireCeremonyPill(classId) {
    const btn = document.getElementById('trigger-ceremony-btn');
    if (!btn) return;
    btn.onclick = (e) => {
        e.stopPropagation();
        import('./ceremony.js').then(m => {
            m.checkAndInitCeremony(classId).then(params => {
                if (params) m.startCeremony(params);
            });
        });
    };
}

/** The Realm Raid pill: the whole school's raid, from its herald week to its aftermath. */
function raidPillHtml() {
    const pill = raidPill(getRaidView());
    if (!pill) return '';
    return reminderPill({
        tone: 'raid',
        icon: 'fa-shield-halved',
        eyebrow: pill.eyebrow,
        title: pill.title,
        tag: pill.tag,
        tagName: 'button',
        extraClass: pill.won ? 'is-won' : '',
        attrs: `id="home-raid-pill" data-home-raid data-sig="${escapeHtml(raidPillSig(pill))}" aria-label="Open the Realm Raid"`
    });
}

function raidPillSig(pill) {
    return pill ? [pill.eyebrow, pill.title, pill.won ? 1 : 0].join('|') : '';
}

let raidPillWatch = false;
function watchRaidPill() {
    if (raidPillWatch) return;
    raidPillWatch = true;
    document.addEventListener('click', (event) => {
        if (event.target.closest?.('[data-home-raid]')) openRealmRaid();
    });
    subscribeRaid(() => {
        const html = raidPillHtml().trim();
        const current = document.getElementById('home-raid-pill');
        if (current) {
            if (!html) current.remove();
            else if (current.dataset.sig !== raidPillSig(raidPill(getRaidView()))) current.outerHTML = html;
            return;
        }
        if (html) document.getElementById('home-reminders-container')?.insertAdjacentHTML('afterbegin', html);
    });
}

function getReminderPills(classId) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let pills = [];

    watchRaidPill();
    const raid = raidPillHtml();
    if (raid) pills.push(raid);

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

    // 2. CEREMONY REMINDER — previous instructional month only (never August),
    // and only when the class really earned stars that month (undone test stars count as nothing).
    if (classId) {
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        const pending = resolvePendingCeremonyMonth(now);
        const isDone = cls && pending && cls.ceremonyHistory?.[pending.monthKey]?.complete;
        if (cls && pending && !isDone) {
            const verdict = getCeremonyStarVerdict(classId, pending.monthKey);
            if (verdict === true) {
                pills.push(ceremonyPillHtml(cls, pending));
                setTimeout(() => wireCeremonyPill(classId), 100);
            } else if (verdict === undefined) {
                ensureCeremonyStarVerdict(classId, pending.monthKey).then((hasStars) => {
                    if (!hasStars || state.get('globalSelectedClassId') !== classId) return;
                    const container = document.getElementById('home-reminders-container');
                    if (!container || document.getElementById('trigger-ceremony-btn')) return;
                    container.insertAdjacentHTML('afterbegin', ceremonyPillHtml(cls, pending));
                    wireCeremonyPill(classId);
                });
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
                        <span class="date-pill__meta">${bountyAudienceLabel(activeBounty) ? `For ${escapeHtml(bountyAudienceLabel(activeBounty))}` : 'Progress is rolling in'}</span>
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

// --- Daily Wisdom quote (shared Firestore cache, one generation per day) ---

function dailyQuoteDocId(dayKey) {
    return `daily_content_${dayKey}_${DAILY_QUOTE_TYPE}`;
}

function readQuoteHistory() {
    try {
        const parsed = JSON.parse(localStorage.getItem(DAILY_QUOTE_HISTORY_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.day && entry.text) : [];
    } catch (_) {
        return [];
    }
}

function rememberQuote(dayKey, text) {
    try {
        const history = readQuoteHistory().filter((entry) => entry.day !== dayKey);
        history.unshift({ day: dayKey, text });
        localStorage.setItem(DAILY_QUOTE_HISTORY_KEY, JSON.stringify(history.slice(0, DAILY_QUOTE_HISTORY_LIMIT)));
    } catch (_) { /* storage full or blocked: history is only a nicety */ }
}

function shiftDayKey(dayKey, deltaDays) {
    const [y, m, d] = dayKey.split('-').map(Number);
    return utils.getLocalIsoDateString(new Date(y, m - 1, d + deltaDays));
}

/** Quotes from the last few days: local history plus the shared cache (few reads, generator only). */
async function collectRecentQuotes(todayKey) {
    const recent = readQuoteHistory().filter((entry) => entry.day !== todayKey).map((entry) => entry.text);
    const dayKeys = Array.from({ length: DAILY_QUOTE_LOOKBACK_DAYS }, (_, i) => shiftDayKey(todayKey, -(i + 1)));
    const snaps = await Promise.all(dayKeys.map((key) =>
        getDoc(doc(db, dataPath('daily_cache'), dailyQuoteDocId(key))).catch(() => null)
    ));
    snaps.forEach((snap) => {
        const text = snap?.exists?.() ? String(snap.data()?.content || '').trim() : '';
        if (text && !recent.includes(text)) recent.push(text);
    });
    return recent;
}

async function generateFreshQuote(todayKey, recentQuotes) {
    const avoid = [...recentQuotes, getCuratedDailyQuote(todayKey)];
    // Two tries at most: the second one sees the rejected line too.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const raw = await callGeminiApi(
            DAILY_QUOTE_SYSTEM_PROMPT,
            buildDailyQuoteUserPrompt(todayKey, avoid),
            { retries: 1, baseDelay: 500, timeoutMs: 20000, maxTokens: 80 }
        );
        const quote = cleanGeneratedQuote(raw);
        if (isUsableQuote(quote) && !isTooSimilarQuote(quote, avoid)) return quote;
        if (quote) avoid.unshift(quote);
    }
    return '';
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readSharedQuote(docRef) {
    const snap = await getDoc(docRef);
    return snap.exists() ? String(snap.data()?.content || '').trim() : '';
}

/**
 * Atomically decides who generates today's quote. Returns
 * { content } when it already exists, { claimed: true } for the one laptop that
 * should call the AI, { wait: true } while another laptop is generating, and
 * { exhausted: true } once the day's attempt budget is spent.
 */
async function claimDailyQuote(docRef, todayKey) {
    const { runTransaction } = await import('../firebase.js');
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        const data = snap.exists() ? snap.data() : {};
        const decision = decideDailyQuoteClaim(data, Date.now(), DAILY_QUOTE_MAX_ATTEMPTS);
        if (decision === 'use') return { content: String(data.content).trim() };
        if (decision === 'exhausted') return { exhausted: true };
        if (decision === 'wait') return { wait: true };
        tx.set(docRef, {
            date: todayKey,
            type: DAILY_QUOTE_TYPE,
            attempts: (Number(data?.attempts) || 0) + 1,
            claimedUntil: Date.now() + DAILY_QUOTE_CLAIM_MS
        }, { merge: true });
        return { claimed: true };
    });
}

async function getDailyQuote() {
    const todayKey = utils.getLocalIsoDateString();
    const docId = dailyQuoteDocId(todayKey);
    const localKey = `gcq_daily_content_${docId}`;
    const curated = getCuratedDailyQuote(todayKey);

    // 0. This laptop already has today's quote: no reads, no AI.
    try {
        const localCached = localStorage.getItem(localKey);
        if (localCached) return localCached;
    } catch (e) {
        console.warn("Local quote cache read failed.", e);
    }

    if (dailyContentInFlight.has(docId)) {
        return dailyContentInFlight.get(docId);
    }

    const requestPromise = (async () => {
        const docRef = doc(db, dataPath('daily_cache'), docId);
        const keep = (text) => {
            try { localStorage.setItem(localKey, text); } catch (_) { /* ignore */ }
            rememberQuote(todayKey, text);
            return text;
        };

        // 1. Shared cache: one read, and every laptop in the school gets the same quote.
        try {
            const content = await readSharedQuote(docRef);
            if (content) return keep(content);
        } catch (e) {
            console.warn("Daily quote cache read failed; showing today's curated line.");
            return curated;
        }

        // 2. Without Elite AI, the day's curated line (it still changes daily).
        if (!canUseFeature('eliteAI')) return curated;

        // 3. Claim the day's generation so only one laptop ever calls the AI.
        let claim;
        try {
            claim = await claimDailyQuote(docRef, todayKey);
        } catch (e) {
            // Offline or blocked: never generate without a claim.
            console.warn("Daily quote claim failed; showing today's curated line.", e);
            return curated;
        }
        if (claim.content) return keep(claim.content);
        if (claim.exhausted) return curated;
        if (claim.wait) {
            for (const delay of DAILY_QUOTE_WAIT_POLLS) {
                await pause(delay);
                const content = await readSharedQuote(docRef).catch(() => '');
                if (content) return keep(content);
            }
            return curated;
        }

        try {
            const recent = await collectRecentQuotes(todayKey);
            const content = await generateFreshQuote(todayKey, recent);
            if (!content) throw new Error('AI returned no usable fresh quote.');

            try {
                const { setDoc } = await import('../firebase.js');
                await setDoc(docRef, { content, claimedUntil: 0 }, { merge: true });
            } catch (e) {
                console.error("Failed to save to cache", e);
            }
            return keep(content);
        } catch (e) {
            console.error(e);
            // Release the claim so a later visit may retry, within the day's attempt budget.
            try {
                const { setDoc } = await import('../firebase.js');
                await setDoc(docRef, { claimedUntil: 0 }, { merge: true });
            } catch (_) { /* the claim simply expires */ }
            return curated;
        }
    })().finally(() => {
        dailyContentInFlight.delete(docId);
    });

    dailyContentInFlight.set(docId, requestPromise);
    return requestPromise;
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
