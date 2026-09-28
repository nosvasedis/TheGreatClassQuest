// /ui/wallpaperSkyCards.js — Projector Mode (The Director): the newer Sky Cards.
// Sky Watch (live weather, moon, daylight), class heroes (stars today, star of the week,
// next birthday), the school-year journey, and quick classroom games. Every builder
// returns null when it has nothing real to show, so the Director simply picks another card.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { resolveWeatherTheme } from '../features/weatherTheme.js';
import { getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import {
    escapeCardText as esc,
    getMoonPhase,
    moonPhaseSvg,
    getSunProgress,
    LETTER_HUNT_CATEGORIES,
    LETTER_HUNT_LETTERS,
    ODD_ONE_OUT,
    pickForDay,
    pickRandom,
    QUICK_DRAW,
    SPELL_IT_RIGHT,
    TRUE_OR_FALSE,
    WOULD_YOU_RATHER
} from './wallpaperDeck.mjs';

export const SKY_CARD_TYPES = Object.freeze([
    'sky_moon_phase', 'sky_daylight',
    'class_stars_today', 'class_star_of_week', 'class_next_birthday',
    'school_year_journey',
    'true_or_false', 'would_you_rather', 'odd_one_out', 'spell_it_right', 'letter_hunt', 'quick_draw'
]);

/** Deck entries the new cards add: school view gets the league-neutral ones. */
export function getSkyCardDeck(classId) {
    const shared = ['sky_moon_phase', 'sky_daylight', 'school_year_journey', 'true_or_false', 'would_you_rather', 'odd_one_out', 'spell_it_right', 'letter_hunt', 'quick_draw'];
    if (!classId) return shared;
    return [...shared, 'class_stars_today', 'class_stars_today', 'class_star_of_week', 'class_next_birthday'];
}

// ─── Weather the wallpaper already knows ────────────────────────────────────

let lastSkyWeather = null;

/** ui/wallpaper.js hands over what it fetched for the sky skin (code, temp, hi, lo). */
export function rememberSkyWeather(weather) {
    if (weather && Number.isFinite(Number(weather.code))) lastSkyWeather = { ...weather, at: Date.now() };
}

function readCachedWeather() {
    if (lastSkyWeather && Date.now() - lastSkyWeather.at < 3 * 3600000) return lastSkyWeather;
    try {
        const key = utils.getWeatherCacheKey('gcq_weather_data_open_meteo', utils.getActiveWeatherLocation());
        const data = JSON.parse(localStorage.getItem(key) || 'null');
        if (data?.weather && Date.now() - data.timestamp < 3 * 3600000) return data.weather;
    } catch (_) { /* Weather is optional. */ }
    return null;
}

const WEATHER_EMOJI = [
    [(c) => c === 0, '☀️', '🌙'],
    [(c) => c === 1 || c === 2, '⛅', '☁️'],
    [(c) => c === 3, '☁️', '☁️'],
    [(c) => c === 45 || c === 48, '🌫️', '🌫️'],
    [(c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82), '🌧️', '🌧️'],
    [(c) => (c >= 71 && c <= 77) || c === 85 || c === 86, '❄️', '❄️'],
    [(c) => c >= 95, '⛈️', '⛈️']
];

function weatherAdvice(code, temp) {
    if (code >= 95) return 'Stay inside and listen for the thunder. Count the seconds after a flash!';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'Umbrella day! What is the word for the smell of rain?';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow outside! Scarf, gloves and a warm hat.';
    if (code === 45 || code === 48) return 'Foggy: the clouds came down to visit us.';
    if (Number.isFinite(temp) && temp >= 30) return 'Hot day: drink water and find the shade.';
    if (Number.isFinite(temp) && temp <= 5) return 'Chilly! Wrap up warm before you go out.';
    return 'A good day for an adventure outside after class.';
}

/** Real weather for the school's location, from the cache the app already keeps. */
export function getLiveWeatherCard() {
    const weather = readCachedWeather();
    if (!weather) return null;
    const code = Number(weather.code);
    const isNight = document.body.classList.contains('night-mode');
    const theme = resolveWeatherTheme(code);
    const row = WEATHER_EMOJI.find(([test]) => test(code));
    const emoji = row ? (isNight ? row[2] : row[1]) : '🌤️';
    const temp = Number(weather.temp);
    const hasTemp = Number.isFinite(temp);
    const range = Number.isFinite(Number(weather.hi)) && Number.isFinite(Number(weather.lo))
        ? `<div class="sc-chips"><span class="sc-chip">▲ ${Math.round(weather.hi)}°</span><span class="sc-chip">▼ ${Math.round(weather.lo)}°</span></div>`
        : '';
    return {
        sigil: emoji,
        title: 'Right now outside',
        html: `<div class="sc-weather">
                <div class="sc-weather__temp">${hasTemp ? `${Math.round(temp)}°` : emoji}</div>
                <div class="sc-weather__text">
                    <p class="sc-big sc-big--sm">${esc(theme.weatherText || 'Outside')}</p>
                    ${range}
                </div>
            </div>
            <p class="sc-text">${esc(weatherAdvice(code, temp))}</p>`
    };
}

// ─── Sky Watch ──────────────────────────────────────────────────────────────

export function getMoonPhaseCard(now = new Date()) {
    const moon = getMoonPhase(now);
    const full = moon.name === 'Full Moon';
    return {
        sigil: moonPhaseSvg(moon.phase, { size: 54, className: 'sky-moon-svg sky-moon-svg--crest' }),
        title: "Tonight's Moon",
        html: `<div class="sc-moon">${moonPhaseSvg(moon.phase, { size: 110 })}</div>
            <p class="sc-big">${esc(moon.name)}</p>
            <div class="sc-meter" aria-hidden="true"><i style="width:${moon.illumination}%"></i></div>
            <p class="sc-sub">${moon.illumination}% lit${full ? '' : ` · full moon in ${moon.daysToFull} ${moon.daysToFull === 1 ? 'day' : 'days'}`}</p>
            <p class="sc-text">${esc(moon.note)}</p>`
    };
}

function formatClock(ms) {
    return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function getDaylightCard(now = Date.now()) {
    const sunrise = Number(utils.solarData?.sunrise);
    const sunset = Number(utils.solarData?.sunset);
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) return null;
    const progress = getSunProgress(now, sunrise, sunset);
    const lengthMin = Math.round((sunset - sunrise) / 60000);
    const hours = Math.floor(lengthMin / 60);
    const minutes = lengthMin % 60;
    const daytime = progress >= 0 && progress <= 1;
    const left = Math.max(0, Math.round((sunset - now) / 60000));
    const clamped = Math.max(0, Math.min(1, progress));
    // Sun marker on a half-circle arc (0 = left horizon, 1 = right horizon).
    const angle = Math.PI * (1 - clamped);
    const x = 50 + 42 * Math.cos(angle);
    const y = 52 - 42 * Math.sin(angle);
    let line;
    if (!daytime && progress < 0) line = `The sun rises at ${formatClock(sunrise)}.`;
    else if (!daytime) line = 'The sun has set. Good evening, heroes!';
    else if (left < 90) line = `Only ${left} minutes of sunlight left today.`;
    else line = `${Math.floor(left / 60)} h ${left % 60} min of sunlight left today.`;
    return {
        sigil: daytime ? '🌞' : '🌜',
        title: 'Daylight today',
        html: `<svg class="sc-daylight" viewBox="0 0 100 60" aria-hidden="true">
                <path d="M 8 52 A 42 42 0 0 1 92 52" class="sc-daylight__path" />
                <path d="M 8 52 A 42 42 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="sc-daylight__done" />
                <line x1="2" y1="52" x2="98" y2="52" class="sc-daylight__horizon" />
                <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" class="sc-daylight__sun ${daytime ? '' : 'is-set'}" />
            </svg>
            <div class="sc-split">
                <span><b>${formatClock(sunrise)}</b><small>Sunrise</small></span>
                <span><b>${hours}h ${String(minutes).padStart(2, '0')}m</b><small>of daylight</small></span>
                <span><b>${formatClock(sunset)}</b><small>Sunset</small></span>
            </div>
            <p class="sc-text">${esc(line)}</p>`
    };
}

// ─── Class heroes ───────────────────────────────────────────────────────────

function avatarHtml(student, size = 'md') {
    if (student?.avatar) return `<img src="${esc(student.avatar)}" alt="" class="sc-avatar sc-avatar--${size}">`;
    return `<span class="sc-avatar sc-avatar--${size} sc-avatar--letter">${esc((student?.name || '?').charAt(0))}</span>`;
}

function firstName(student) {
    return esc(String(student?.name || '').split(' ')[0]);
}

/** Today's live tally for the class, with the three brightest stars so far. */
export function getClassStarsTodayCard(classId) {
    if (!classId) return null;
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const todays = state.get('todaysStars') || {};
    const rows = students
        .map((s) => ({ student: s, stars: Number(todays[s.id]?.stars) || 0 }))
        .filter((row) => row.stars > 0)
        .sort((a, b) => b.stars - a.stars);
    const total = rows.reduce((sum, row) => sum + row.stars, 0);
    if (total === 0) return null;
    const top = rows.slice(0, 3);
    return {
        sigil: '🌟',
        title: 'Stars so far today',
        html: `<p class="sc-big sc-big--xl"><span class="js-count-up" data-target="${total}">0</span></p>
            <p class="sc-sub">stars for the whole class · ${rows.length} of ${students.length} heroes shining</p>
            <div class="sc-podium">
                ${top.map((row, i) => `<div class="sc-podium__step sc-podium__step--${i + 1}">
                    ${avatarHtml(row.student, 'sm')}
                    <b>${firstName(row.student)}</b>
                    <span>+${row.stars} ⭐</span>
                </div>`).join('')}
            </div>`
    };
}

function parseLogDate(log) {
    if (typeof log?.createdAt?.toMillis === 'function') return log.createdAt.toMillis();
    const parsed = utils.parseFlexibleDate?.(log?.date);
    return parsed ? parsed.getTime() : 0;
}

/** Most stars across the last seven days (awards logged for this class). */
export function getClassStarOfWeekCard(classId) {
    if (!classId) return null;
    const since = Date.now() - 7 * 86400000;
    const totals = new Map();
    (state.get('allAwardLogs') || []).forEach((log) => {
        if (log.classId !== classId || parseLogDate(log) < since) return;
        const credit = getAwardLogMonthlyStarCredit(log);
        if (credit > 0) totals.set(log.studentId, (totals.get(log.studentId) || 0) + credit);
    });
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return null;
    const [studentId, stars] = ranked[0];
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    if (!student) return null;
    const runnersUp = ranked.slice(1, 3)
        .map(([id]) => (state.get('allStudents') || []).find((s) => s.id === id))
        .filter(Boolean);
    return {
        sigil: '🏆',
        title: 'Star of the Week',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">👑</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <p class="sc-sub"><span class="js-count-up" data-target="${stars}">0</span> stars in the last 7 days</p>
            ${runnersUp.length ? `<p class="sc-text">Close behind: ${runnersUp.map((s) => firstName(s)).join(' and ')}</p>` : ''}`
    };
}

function daysUntilBirthday(birthday, now) {
    const match = /(\d{2})-(\d{2})$/.exec(String(birthday || ''));
    if (!match) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]));
    if (next < today) next = new Date(now.getFullYear() + 1, Number(match[1]) - 1, Number(match[2]));
    return Math.round((next - today) / 86400000);
}

/** The next birthday in the class (1 to 21 days away; today's has its own celebration card). */
export function getClassNextBirthdayCard(classId, now = new Date()) {
    if (!classId) return null;
    const upcoming = (state.get('allStudents') || [])
        .filter((s) => s.classId === classId)
        .map((s) => ({ student: s, days: daysUntilBirthday(s.birthday, now) }))
        .filter((row) => row.days !== null && row.days >= 1 && row.days <= 21)
        .sort((a, b) => a.days - b.days);
    if (!upcoming.length) return null;
    const { student, days } = upcoming[0];
    const when = days === 1 ? 'tomorrow' : `in ${days} days`;
    return {
        sigil: '🎁',
        title: 'Birthday coming up',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">🎈</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <p class="sc-sub">has a birthday ${when}!</p>
            <p class="sc-text">Start practising: Happy birthday to you… 🎶</p>`
    };
}

// ─── School year ────────────────────────────────────────────────────────────

export function getSchoolYearJourneyCard(now = new Date()) {
    const start = state.getActiveSchoolYearStartDate?.();
    const end = state.getActiveSchoolYearEndDate?.();
    if (!start || !end || end <= start || now < start || now > end) return null;
    const pct = Math.round(((now - start) / (end - start)) * 100);
    const daysLeft = Math.ceil((end - now) / 86400000);
    const months = [];
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        months.push(d);
    }
    const nowKey = now.getFullYear() * 12 + now.getMonth();
    return {
        sigil: '🧭',
        title: 'Our year of adventure',
        html: `<p class="sc-big sc-big--xl"><span class="js-count-up" data-target="${pct}">0</span>%</p>
            <p class="sc-sub">of the school year travelled · ${daysLeft} days to go</p>
            <div class="sc-months">
                ${months.map((m) => {
                    const key = m.getFullYear() * 12 + m.getMonth();
                    const cls = key < nowKey ? 'is-done' : key === nowKey ? 'is-now' : '';
                    return `<span class="${cls}">${m.toLocaleDateString('en-GB', { month: 'narrow' })}</span>`;
                }).join('')}
            </div>`
    };
}

// ─── Games and talk ─────────────────────────────────────────────────────────

function tierOf(questLevel) {
    const tier = questLevel ? utils.getAgeTierForLeague(questLevel) : 'mid';
    return ['junior', 'mid', 'senior'].includes(tier) ? tier : 'mid';
}

function revealBlock(inner) {
    return `<div class="wallpaper-card-answer-blur sc-reveal">${inner}</div>`;
}

export function getTrueOrFalseCard(questLevel) {
    const item = pickRandom(TRUE_OR_FALSE[tierOf(questLevel)]);
    if (!item) return null;
    return {
        sigil: '⚖️',
        title: 'True or False?',
        html: `<p class="sc-quote">${esc(item.s)}</p>
            <div class="sc-choice sc-choice--pair"><span>👍 True</span><span>👎 False</span></div>
            ${revealBlock(`<p class="sc-answer">${item.a ? '✅ True!' : '❌ False!'}</p><p class="sc-text">${esc(item.why)}</p>`)}`,
        timedBlurAnswer: true
    };
}

export function getWouldYouRatherCard(questLevel) {
    const pair = pickForDay(WOULD_YOU_RATHER[tierOf(questLevel)], new Date(), new Date().getHours());
    if (!pair) return null;
    return {
        sigil: '🤔',
        title: 'Would you rather…',
        html: `<div class="sc-choice sc-choice--versus">
                <span>${esc(pair[0])}</span>
                <b>or</b>
                <span>${esc(pair[1])}</span>
            </div>
            <p class="sc-text">Tell your partner and say why: “I would rather… because…”</p>`
    };
}

export function getOddOneOutCard(questLevel) {
    const item = pickRandom(ODD_ONE_OUT[tierOf(questLevel)]);
    if (!item) return null;
    return {
        sigil: '🔍',
        title: 'Odd one out',
        html: `<div class="sc-chips sc-chips--big">${item.words.map((w) => `<span class="sc-chip">${esc(w)}</span>`).join('')}</div>
            <p class="sc-sub">Which word does not belong?</p>
            ${revealBlock(`<p class="sc-answer">${esc(item.odd)}</p><p class="sc-text">${esc(item.why)}</p>`)}`,
        timedBlurAnswer: true
    };
}

export function getSpellItRightCard(questLevel) {
    const item = pickRandom(SPELL_IT_RIGHT[tierOf(questLevel)]);
    if (!item) return null;
    const options = Math.random() < 0.5 ? [item.right, item.wrong] : [item.wrong, item.right];
    return {
        sigil: '✍️',
        title: 'Spell it right',
        html: `<div class="sc-choice sc-choice--pair sc-choice--words">${options.map((w, i) => `<span><small>${i ? 'B' : 'A'}</small>${esc(w)}</span>`).join('')}</div>
            <p class="sc-sub">Which one is spelled correctly?</p>
            ${revealBlock(`<p class="sc-answer">✅ ${esc(item.right)}</p>`)}`,
        timedBlurAnswer: true
    };
}

export function getLetterHuntCard(questLevel) {
    const letter = pickRandom(LETTER_HUNT_LETTERS);
    const category = pickRandom(LETTER_HUNT_CATEGORIES[tierOf(questLevel)]);
    if (!letter || !category) return null;
    return {
        sigil: '🔤',
        title: 'Letter hunt',
        html: `<div class="sc-letter">${letter}</div>
            <p class="sc-big sc-big--sm">Name five ${esc(category)} that start with <b>${letter}</b></p>
            <p class="sc-text">Race the card! The bar below is your timer.</p>`
    };
}

export function getQuickDrawCard(questLevel) {
    const prompt = pickRandom(QUICK_DRAW[tierOf(questLevel)]);
    if (!prompt) return null;
    return {
        sigil: '🖍️',
        title: 'Quick draw',
        html: `<p class="sc-sub">Pencils ready. Draw…</p>
            <p class="sc-quote">${esc(prompt)}</p>
            <p class="sc-text">Finish before the bar runs out, then show your partner and describe it in English.</p>`
    };
}

/** Builds one of the new cards, or null. */
export function hydrateSkyCard(baseType, classId, questLevel) {
    switch (baseType) {
        case 'sky_moon_phase': return getMoonPhaseCard();
        case 'sky_daylight': return getDaylightCard();
        case 'class_stars_today': return getClassStarsTodayCard(classId);
        case 'class_star_of_week': return getClassStarOfWeekCard(classId);
        case 'class_next_birthday': return getClassNextBirthdayCard(classId);
        case 'school_year_journey': return getSchoolYearJourneyCard();
        case 'true_or_false': return getTrueOrFalseCard(questLevel);
        case 'would_you_rather': return getWouldYouRatherCard(questLevel);
        case 'odd_one_out': return getOddOneOutCard(questLevel);
        case 'spell_it_right': return getSpellItRightCard(questLevel);
        case 'letter_hunt': return getLetterHuntCard(questLevel);
        case 'quick_draw': return getQuickDrawCard(questLevel);
        default: return null;
    }
}
