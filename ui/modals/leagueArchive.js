// /ui/modals/leagueArchive.js
// League Archive (Team Quest · past months): each closed month is a charted
// sheet of the atlas. A month rail with waypoint pips, league chips and a class
// search sit on top; every league gets a race chart (where each party stopped
// on the road), a champion's pennant and a standings ledger.
import { escapeHtml as esc } from '../../utils/html.mjs';
import '../../styles/league_archive.css';
import '../../styles/quest_ranks.css';
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { questLeagues, getQuestLeagueDefinition } from '../../constants.js';
import { getAwardLogMonthlyStarCredit, STAR_MANAGER_SOURCE } from '../../features/awardLogReasonMeta.js';
import {
    BEYOND_MARKS,
    QUEST_ROAD_STOPS,
    buildArchiveMonthEntry,
    collectArchiveCrossings,
    describeArchiveSky,
    listArchiveLostLessons,
    resolveArchiveHeroStars,
    sumArchiveLogStarsByStudent,
    describeArchiveGaps,
    describeArchiveStretch,
    describeChampionLine,
    formatArchiveStars,
    getArchiveTrackMax,
    getArchiveTrackPosition,
    layoutArchiveRaceLanes,
    summarizeArchiveLeague
} from '../../features/leagueArchiveCore.mjs';
import { QUEST_MAP_ZONES } from '../../features/questMapZones.mjs';
import { db, query, collection, where, getDocs } from '../../firebase.js';
import { showAnimatedModal, hideModal } from './base.js';
import { playSound } from '../../audio.js';
import { getSchoolYearStartMonthDate, getViewableCompletedMonthStart } from '../../utils/schoolYear.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
import { rankForLevel } from '../../features/questRanksCore.mjs';
import { rankCrestSvg } from '../../features/questRankCrest.mjs';

const MODAL_ID = 'league-archive-modal';
const ALL = 'all';

const ZONE_BADGES = {
    bronze: new URL('../../assets/team-quest-map/living-atlas/badge-bronze.webp', import.meta.url).href,
    silver: new URL('../../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

const RANK_WORDS = ['1st', '2nd', '3rd'];

// What the teacher is looking at; kept while stepping through months.
const view = { league: ALL, query: '', monthKey: '', journal: false };
// Per open: computed standings by month, and the year's quest completions.
const monthCache = new Map();
let questHistoryRows = null;
let starManagerRows = null;
let archiveToken = 0;
let bound = false;

function rankWord(rank) {
    return RANK_WORDS[rank - 1] || `${rank}th`;
}

function monthLong(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

/** Every closed month of this school year, oldest first (never the live month, never last year's). */
function listChartedMonths() {
    const start = getSchoolYearStartMonthDate(state.getActiveSchoolYearStartDate(), state.getActiveSchoolYearKey());
    const ceiling = getViewableCompletedMonthStart({
        startsAt: state.getActiveSchoolYearStartDate(),
        yearKey: state.getActiveSchoolYearKey(),
        now: new Date()
    });
    if (!ceiling) return [];
    const cursor = start ? new Date(start) : new Date(ceiling);
    const keys = [];
    while (cursor <= ceiling && keys.length < 24) {
        keys.push(utils.getMonthKey(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
}

function getLeaguesWithClasses() {
    const used = new Set((state.get('allSchoolClasses') || []).map((c) => c.questLevel).filter(Boolean));
    return questLeagues.filter((league) => used.has(league));
}

function getMyClassIds() {
    return new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
}

function leagueIcon(league) {
    return getQuestLeagueDefinition(league)?.pickerIcon || 'fa-shield-halved';
}

// --- Data -----------------------------------------------------------------

async function loadQuestHistory() {
    if (questHistoryRows) return questHistoryRows;
    const yearKey = state.getActiveSchoolYearKey();
    if (!yearKey) throw new Error('School year unavailable; quest history reads are blocked.');
    const snap = await getDocs(query(
        collection(db, `${PUBLIC_DATA_PATH}/quest_history`),
        where('schoolYearKey', '==', yearKey)
    ));
    questHistoryRows = snap.docs.map((d) => d.data());
    return questHistoryRows;
}

/**
 * Star Manager rows of the year (Settings › Add Historical Award). They are written
 * later than the lesson they are for, so a read by write time files them in the wrong
 * month: they are matched to their month by their own date instead.
 */
async function loadStarManagerRows() {
    if (starManagerRows) return starManagerRows;
    const yearKey = state.getActiveSchoolYearKey();
    if (!yearKey) return [];
    const snap = await getDocs(query(
        collection(db, `${PUBLIC_DATA_PATH}/award_log`),
        where('schoolYearKey', '==', yearKey),
        where('source', '==', STAR_MANAGER_SOURCE)
    ));
    starManagerRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return starManagerRows;
}

/** The goals the Ceremony of the Month locked for that month, by class id. */
async function loadLockedCeremonyGoals(monthKey) {
    const goals = new Map();
    const snap = await getDocs(query(
        collection(db, `${PUBLIC_DATA_PATH}/ceremony_snapshots`),
        where('monthKey', '==', monthKey)
    ));
    snap.docs.forEach((d) => {
        const data = d.data();
        if (!['locked', 'completed'].includes(data.status)) return;
        if (data.schoolYearKey && data.schoolYearKey !== state.getActiveSchoolYearKey()) return;
        (Array.isArray(data.classResults) ? data.classResults : []).forEach((row) => {
            const goal = Number(row?.goal);
            if (row?.id && goal > 0 && !goals.has(row.id)) goals.set(row.id, goal);
        });
    });
    return goals;
}

function createdAtOf(record) {
    const at = record?.createdAt;
    if (!at) return null;
    const d = typeof at.toDate === 'function' ? at.toDate() : new Date(at?.seconds ? at.seconds * 1000 : at);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Classes and heroes that did not exist yet by the end of that month are left out of it. */
function existedBy(record, monthEnd) {
    const created = createdAtOf(record);
    return !created || created <= monthEnd;
}

const withinTime = (promise, ms, fallback) => Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
]);

/**
 * Final standings of every league for one closed month, rebuilt from that month's own
 * facts: its heroes and their stars (archived counter, live counter, or the month's
 * award rows by their own date), the class's own Team Quest gifts, the quest level it
 * raced at, its lessons and holidays, and the goal it had to fill. Progress is not
 * clamped at 100%.
 */
async function computeMonth(monthKey) {
    if (monthCache.has(monthKey)) return monthCache.get(monthKey);

    const [year, month] = monthKey.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    let logs = [];
    let history = {};
    let questHistoryData = [];
    let lockedGoals = new Map();
    let readFailed = false;
    try {
        const { fetchLogsForMonth } = await import('../../db/queries.js');
        const { fetchMonthlyHistory } = await import('../../state.js');
        const [monthLogs, managerRows, archivedRows, records, goals] = await Promise.all([
            withinTime(fetchLogsForMonth(year, month, { throwOnError: true }), 8000, null),
            withinTime(loadStarManagerRows(), 6000, []),
            withinTime(fetchMonthlyHistory(monthKey), 8000, {}),
            withinTime(loadQuestHistory(), 6000, []),
            withinTime(loadLockedCeremonyGoals(monthKey), 5000, new Map())
        ]);
        if (monthLogs === null) readFailed = true;
        logs = [...(monthLogs || []), ...(managerRows || [])];
        history = archivedRows || {};
        questHistoryData = records || [];
        lockedGoals = goals || new Map();
    } catch (error) {
        console.error('League Archive fetch error:', error);
        readFailed = true;
    }

    const ranges = state.get('schoolHolidayRanges') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const allClasses = state.get('allSchoolClasses') || [];
    const allStudents = state.get('allStudents') || [];
    const scoresById = new Map((state.get('allStudentScores') || []).map((s) => [s.id, s]));
    const logTotals = sumArchiveLogStarsByStudent(logs, monthKey, getAwardLogMonthlyStarCredit);
    const crossings = collectArchiveCrossings(allClasses, questHistoryData);
    const byLeague = new Map();

    for (const league of questLeagues) {
        const classesInLeague = allClasses.filter((c) => c.questLevel === league && existedBy(c, monthEnd));
        if (!classesInLeague.length) continue;

        const entries = classesInLeague.map((c) => {
            const roster = allStudents.filter((s) => s.classId === c.id && existedBy(s, monthEnd));
            const heroStars = roster.reduce((sum, s) => sum + resolveArchiveHeroStars({
                studentId: s.id, monthKey, history, score: scoresById.get(s.id), logTotals
            }).stars, 0);
            const crossing = crossings.find((h) => h.classId === c.id && h.monthKey === monthKey) || null;
            const lessons = utils.getMonthlyLessonBalanceForDate(c, ranges, overrides, monthStart);
            const entry = buildArchiveMonthEntry({
                heroStars,
                classBonus: Number(c.teamQuestBonuses?.[monthKey]) || 0,
                goal: utils.calculateMonthlyClassGoalForDate(c, roster.length, ranges, overrides, monthStart, crossings),
                crossing,
                lockedGoal: lockedGoals.get(c.id) || 0
            });
            return {
                ...c,
                ...entry,
                heroes: roster.length,
                daysLost: lessons.lost,
                lessonsScheduled: lessons.scheduled,
                lostLessons: listArchiveLostLessons(c, monthKey, ranges, overrides),
                goalModifier: utils.getMonthlyGoalModifierForDate(c, ranges, overrides, monthStart),
                historicalLevel: utils.getHistoricalDifficultyForMonth(c, monthStart, crossings)
            };
        }).sort(utils.sortTeamQuestEntries)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

        byLeague.set(league, entries);
    }

    const result = { monthKey, byLeague, readFailed };
    // A month that could not be read is not kept, so stepping back to it tries again.
    if (!readFailed) monthCache.set(monthKey, result);
    return result;
}

// --- Controls ---------------------------------------------------------------

function controlsHtml(months) {
    const index = months.indexOf(view.monthKey);
    const leagues = getLeaguesWithClasses();
    const myLeagues = new Set((state.get('allTeachersClasses') || []).map((c) => c.questLevel));

    const stops = months.map((key) => {
        const [year, month] = key.split('-').map(Number);
        const on = key === view.monthKey;
        const short = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' });
        return `
            <button type="button" class="la-stop${on ? ' is-active' : ''}" data-la-month="${key}" aria-pressed="${on}" title="${esc(monthLong(key))}">
                <span class="la-stop__dot" aria-hidden="true">${on ? '<i class="fas fa-flag"></i>' : ''}</span>
                <span class="la-stop__label">${esc(short)}</span>
            </button>`;
    }).join('');

    const chip = (key, icon, label, extra = '') => {
        const on = view.league === key;
        return `<button type="button" class="la-pick${on ? ' is-active' : ''}" data-la-league="${esc(key)}" aria-pressed="${on}"><i class="fas ${esc(icon)}" aria-hidden="true"></i><span>${esc(label)}</span>${extra}</button>`;
    };
    const picks = [
        leagues.length > 1 ? chip(ALL, 'fa-earth-europe', 'All leagues') : '',
        ...leagues.map((league) => chip(
            league,
            leagueIcon(league),
            league,
            myLeagues.has(league) ? '<span class="la-pick__mine" title="One of your classes races here" aria-label="(your class races here)"></span>' : ''
        ))
    ].join('');

    return `
        <div class="la-rail">
            <button type="button" class="la-rail__step" data-la-step="-1" aria-label="Earlier month" ${index <= 0 ? 'disabled' : ''}><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
            <div class="la-rail__center">
                <span class="la-rail__pin" aria-hidden="true"><i class="fas fa-map-location-dot"></i></span>
                <div class="la-rail__label">
                    <span class="la-rail__kicker">Charted month</span>
                    <span class="la-rail__month font-title">${esc(monthLong(view.monthKey))}</span>
                </div>
            </div>
            <button type="button" class="la-rail__step" data-la-step="1" aria-label="Later month" ${index < 0 || index >= months.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
            ${months.length > 1 ? `<div class="la-trail" role="group" aria-label="Jump to a month"><div class="la-trail__inner">${stops}</div></div>` : ''}
        </div>
        <div class="la-scope">
            ${leagues.length ? `<div class="la-picks" role="group" aria-label="League">${picks}</div>` : ''}
            ${journalButtonHtml()}
            <label class="la-search">
                <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                <input type="search" class="la-search__input" placeholder="Find a class…" aria-label="Find a class" autocomplete="off" value="${esc(view.query)}">
            </label>
        </div>`;
}

function journalButtonHtml() {
    return `<button type="button" class="la-pick la-journal-btn${view.journal ? ' is-active' : ''}" data-la-journal aria-pressed="${view.journal}"><i class="fas fa-book-open" aria-hidden="true"></i><span>Map Journal</span></button>`;
}

/** The Map Journal replaces the month's sheets while it is open. */
async function showJournal() {
    const contentEl = document.getElementById('league-archive-content');
    if (!contentEl) return;
    const token = ++archiveToken;
    try {
        const { renderMapJournalHtml } = await import('./mapJournal.js');
        if (token !== archiveToken || !view.journal) return;
        contentEl.innerHTML = renderMapJournalHtml({ league: view.league, query: view.query });
    } catch (error) {
        console.error('Map Journal render error:', error);
        if (token === archiveToken) contentEl.innerHTML = emptyHtml('fa-triangle-exclamation', 'The Map Journal couldn’t open', 'Please try again.', 'error');
    }
}

function refreshControls() {
    const controlsEl = document.getElementById('league-archive-controls');
    if (!controlsEl) return;
    const months = listChartedMonths();
    if (!months.length) { controlsEl.innerHTML = `<div class="la-scope">${journalButtonHtml()}</div>`; return; }
    const hadFocus = document.activeElement?.classList?.contains('la-search__input');
    controlsEl.innerHTML = controlsHtml(months);
    const trail = controlsEl.querySelector('.la-trail');
    const active = controlsEl.querySelector('.la-stop.is-active');
    if (trail && active) {
        requestAnimationFrame(() => {
            trail.scrollLeft = active.offsetLeft - (trail.clientWidth - active.offsetWidth) / 2;
        });
    }
    if (hadFocus) {
        const input = controlsEl.querySelector('.la-search__input');
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
    }
}

function updateTitles() {
    const titleEl = document.getElementById('league-archive-title');
    const subEl = document.getElementById('league-archive-subtitle');
    if (titleEl) titleEl.textContent = view.league === ALL ? 'League Archive' : `${view.league} League Archive`;
    if (subEl) {
        subEl.textContent = view.league === ALL
            ? 'Every league’s race, charted when its month closes'
            : 'Every race, charted when its month closes';
    }
}

// --- Sheets -----------------------------------------------------------------

function badgeImg(zoneId, extraClass = '') {
    const src = ZONE_BADGES[zoneId] || ZONE_BADGES.bronze;
    return `<img class="la-badge${extraClass}" src="${src}" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false">`;
}

/**
 * Where a party stands on the race chart. Only a party that stepped through the Portal
 * climbs on into the Crystal Sky; one whose Portal stayed sealed waits at it.
 */
function chartProgress(entry) {
    const pct = Number(entry.progress) || 0;
    return entry.isQuestComplete ? pct : Math.min(100, pct);
}

function pctText(progress) {
    return `${Math.floor(Math.max(0, Number(progress) || 0))}%`;
}

function dayLabel(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function raceChartHtml(entries) {
    const runners = entries.filter((e) => e.totalStars > 0);
    if (!runners.length) return '';
    const trackMax = getArchiveTrackMax(runners.map(chartProgress));
    const positions = runners.map((e) => getArchiveTrackPosition(chartProgress(e), trackMax));
    const lanes = layoutArchiveRaceLanes(positions);
    const laneCount = Math.max(...lanes) + 1;
    const finish = getArchiveTrackPosition(100, trackMax);
    const myIds = getMyClassIds();
    const sky = trackMax > 100;

    const realms = QUEST_ROAD_STOPS.filter((stop) => stop.progress < 100).map((stop) => {
        const zone = QUEST_MAP_ZONES.find((z) => z.minPercent === stop.progress);
        return `<span class="la-race__realm" style="--at:${(getArchiveTrackPosition(stop.progress, trackMax) * 100).toFixed(2)}%" title="${esc(stop.label)} (${stop.progress}%)"><span aria-hidden="true">${zone?.icon || '•'}</span></span>`;
    }).join('');

    const top = Math.max(...runners.filter((e) => e.isQuestComplete).map((e) => Number(e.progress) || 0), 0);
    const stones = sky ? BEYOND_MARKS.filter((mark) => mark.at <= trackMax).map((mark) => `
        <span class="la-race__stone${top >= mark.at ? ' is-lit' : ''}" style="--at:${(getArchiveTrackPosition(mark.at, trackMax) * 100).toFixed(2)}%" title="${esc(mark.label)} (${mark.at}%)"><i class="fas ${esc(mark.icon)}" aria-hidden="true"></i></span>`).join('') : '';

    const tokens = runners.map((e, i) => {
        const x = (positions[i] * 100).toFixed(2);
        const inSky = e.isQuestComplete && e.progress >= 101;
        const sealed = !e.isQuestComplete && e.progress >= 100;
        const cls = ['la-runner', e.rank === 1 ? 'is-leader' : '', myIds.has(e.id) ? 'is-mine' : '', e.progress >= 100 ? 'is-home' : '', inSky ? 'is-sky' : '', sealed ? 'is-sealed' : '']
            .filter(Boolean).join(' ');
        const tip = inSky ? `${e.name} · ${pctText(e.progress)} · on the Starward Way`
            : sealed ? `${e.name} · ${pctText(e.progress)} · the Portal stayed sealed`
                : `${e.name} · ${pctText(e.progress)}`;
        return `
            <span class="${cls}" style="--x:${x}%;--lane:${lanes[i]};--i:${Math.min(i, 10)}">
                <span class="la-token" title="${esc(tip)}">
                    <span class="la-token__crest" aria-hidden="true">${esc(e.logo || '📚')}</span>
                    <span class="la-token__rank">${e.rank}</span>
                    ${sealed ? '<span class="la-token__seal" aria-hidden="true"><i class="fas fa-lock"></i></span>' : ''}
                </span>
            </span>`;
    }).join('');

    const endMark = BEYOND_MARKS.find((mark) => mark.at === trackMax);
    const label = runners.map((e) => `${e.rank}. ${e.name} ${pctText(e.progress)}`).join(', ');
    return `
        <div class="la-race${sky ? ' has-sky' : ''}" style="--lanes:${laneCount};--finish:${(finish * 100).toFixed(2)}%" role="img" aria-label="Where each party stopped: ${esc(label)}">
            <div class="la-race__field">
                ${sky ? '<div class="la-race__sky" aria-hidden="true"><span class="la-race__sky-name">Crystal Sky</span></div>' : ''}
                <div class="la-race__road" aria-hidden="true"></div>
                ${realms}
                ${stones}
                <span class="la-race__start" aria-hidden="true"></span>
                <span class="la-race__finish" aria-hidden="true"><i class="fas fa-flag-checkered"></i></span>
                ${tokens}
            </div>
            <div class="la-race__scale" aria-hidden="true">
                <span>Start</span>
                <span class="la-race__scale-goal" style="--at:${(finish * 100).toFixed(2)}%">Goal</span>
                ${sky ? `<span class="la-race__scale-end">${endMark ? `<span class="la-race__scale-name">${esc(endMark.label.replace(/^The /, ''))} </span>` : ''}${trackMax}%</span>` : ''}
            </div>
        </div>`;
}

function rowHtml(entry, index, gaps, trackMax, myIds, showLeague, monthKey) {
    const isMine = myIds.has(entry.id);
    const stretch = describeArchiveStretch(entry.progress, entry.totalStars, entry.diamondGoal);
    const skyInfo = describeArchiveSky(entry.progress, entry.isQuestComplete, entry.totalStars, entry.diamondGoal);
    const reached = entry.isQuestComplete || entry.progress >= 100;
    const gap = gaps.get(entry.id);
    const fill = getArchiveTrackPosition(entry.progress, trackMax);
    const finish = getArchiveTrackPosition(100, trackMax);
    const tone = entry.rank <= 3 ? ` la-row--top${entry.rank}` : '';
    const classes = `la-row${tone}${isMine ? ' is-mine' : ''}${reached ? ' is-complete' : ''}${skyInfo.inSky ? ' is-sky' : ''}`;
    const level = entry.historicalLevel + 1;
    const rank = rankForLevel(level);
    const monthName = monthLong(monthKey).split(' ')[0];
    const june = Number(String(monthKey).split('-')[1]) === 6;

    const lost = entry.lostLessons || [];
    const lessonsTip = entry.daysLost > 0
        ? `${entry.lessonsScheduled - entry.daysLost} of ${entry.lessonsScheduled} lessons ran in ${monthName}. ${lost.length ? `Lost: ${lost.map((l) => `${dayLabel(l.day)} (${l.why})`).join(', ')}.` : ''}${lost.length > entry.daysLost ? ' A make-up lesson gave one back.' : ''} The goal was eased to match.`
        : '';

    const chips = [
        showLeague ? `<span class="la-chip la-chip--league"><i class="fas ${esc(leagueIcon(entry.questLevel))}" aria-hidden="true"></i>${esc(entry.questLevel)}</span>` : '',
        isMine ? '<span class="la-chip la-chip--mine">Your class</span>' : '',
        entry.isQuestComplete ? '<span class="la-chip la-chip--goal"><i class="fas fa-dungeon" aria-hidden="true"></i>Crossed the Portal</span>'
            : reached ? '<span class="la-chip la-chip--goal"><i class="fas fa-gem" aria-hidden="true"></i>Goal reached</span>' : '',
        skyInfo.inSky ? `<span class="la-chip la-chip--sky" title="Past the goal, on the Starward Way above the Crystal Realm"><i class="fas ${esc(skyInfo.mark?.icon || 'fa-star')}" aria-hidden="true"></i>${esc(skyInfo.mark ? skyInfo.mark.label.replace(/^The /, '') : 'Starward Way')}</span>` : '',
        `<span class="la-chip la-chip--level qr-chip qr-chip--${rank.id}" title="Quest Level ${level} in ${esc(monthName)}${entry.isQuestComplete ? `; it rose to Level ${level + 1} by stepping through the Portal` : ''}">${rankCrestSvg(level, { className: 'qr-chip__crest' })}<span>${esc(rank.title)}</span><b>Lv ${level}</b></span>`,
        entry.daysLost > 0 ? `<span class="la-chip la-chip--lost" title="${esc(lessonsTip)}"><i class="fas fa-calendar-xmark" aria-hidden="true"></i>${entry.lessonsScheduled - entry.daysLost}/${entry.lessonsScheduled} lessons</span>` : '',
        june ? '<span class="la-chip la-chip--lost" title="June is a short month: every class needs half its usual goal"><i class="fas fa-sun" aria-hidden="true"></i>Half goal</span>' : ''
    ].filter(Boolean).join('');

    let where;
    if (skyInfo.inSky) {
        const mark = skyInfo.mark;
        const climbed = skyInfo.palace ? 'reached the Celestial Palace'
            : mark ? `climbed the Starward Way to ${esc(mark.label.replace(/^The /, 'the '))}` : 'stepped onto the Starward Way';
        const next = skyInfo.next && !skyInfo.palace ? ` · ${skyInfo.next.starsShort}★ short of ${esc(skyInfo.next.label.replace(/^The /, 'the '))}` : '';
        where = `${badgeImg('crystal')}<span>Crossed the Portal and ${climbed}${next}</span>`;
    } else if (entry.isQuestComplete) {
        where = `${badgeImg('crystal')}<span>Crossed the Portal</span>`;
    } else if (reached && entry.historicalLevel > 0) {
        where = `${badgeImg('crystal')}<span>Filled the goal${entry.progress >= 101 ? ` and ran ${formatArchiveStars(entry.totalStars - entry.diamondGoal)}★ past it` : ''} · the Portal stayed sealed</span>`;
    } else if (reached) {
        where = `${badgeImg('crystal')}<span>Filled the goal${entry.progress >= 101 ? ` and ran ${formatArchiveStars(entry.totalStars - entry.diamondGoal)}★ past it` : ''}</span>`;
    } else {
        where = `${badgeImg(stretch.zone.id)}<span>Stopped in ${esc(stretch.zone.label)} · ${stretch.starsShortOfGoal}★ short of the goal</span>`;
    }
    const chase = gap ? `<span class="la-row__gap"><i class="fas fa-person-running" aria-hidden="true"></i>${gap.starsToCatch}★ behind ${esc(gap.name)}</span>` : '';

    const goalWhy = [
        `${monthName}'s goal: ${formatArchiveStars(entry.diamondGoal)}★`,
        entry.goalSource === 'crossing' ? 'the goal it filled to open the Portal'
            : entry.goalSource === 'ceremony' ? 'as locked at the Ceremony of the Month'
                : `${entry.heroes} ${entry.heroes === 1 ? 'hero' : 'heroes'} at Quest Level ${level}${entry.goalModifier < 1 ? `, eased to ${Math.round(entry.goalModifier * 100)}% for ${june ? 'June' : 'lost lessons'}` : ''}`
    ].join(', ');
    const starsWhy = `${formatArchiveStars(entry.totalStars)}★ in ${monthName}${entry.classBonus > 0 ? `: ${formatArchiveStars(entry.heroStars)}★ by the heroes + ${formatArchiveStars(entry.classBonus)}★ Team Quest gifts (Pathfinder’s Map, Realm Raid, Fortune’s Wheel, Ember Oaths)` : ''}. ${goalWhy}.`;
    const over = entry.progress >= 101;
    const beyond = over ? Math.max(0, fill - finish) : 0;

    return `
        <li class="${classes}" id="la-row-${esc(entry.id)}" style="--i:${Math.min(index, 12)}">
            <span class="la-flag" aria-label="${rankWord(entry.rank)} place"><span class="la-flag__cloth"><span class="font-title">${entry.rank}</span></span></span>
            <span class="la-crest" aria-hidden="true">${esc(entry.logo || '📚')}</span>
            <div class="la-row__body">
                <div class="la-row__line">
                    <p class="la-row__name">${esc(entry.name)}</p>
                    ${chips ? `<div class="la-row__chips">${chips}</div>` : ''}
                </div>
                <span class="la-road${over ? ' is-over' : ''}" style="--finish:${(finish * 100).toFixed(2)}%" aria-hidden="true">
                    <span class="la-road__fill" style="--p:${Math.min(fill, finish).toFixed(4)}"></span>
                    ${over ? `<span class="la-road__beyond" style="--w:${(beyond * 100).toFixed(2)}%"></span>` : ''}
                    <span class="la-road__goal"></span>
                </span>
                <p class="la-row__note"><span class="la-row__where">${where}</span>${chase}</p>
            </div>
            <div class="la-row__score" title="${esc(starsWhy)}">
                <span class="la-row__pct font-title${over ? ' is-over' : ''}">${pctText(entry.progress)}</span>
                <span class="la-row__stars">${formatArchiveStars(entry.totalStars)} / ${formatArchiveStars(entry.diamondGoal)}<i class="fas fa-star" aria-hidden="true"></i></span>
                ${entry.classBonus > 0 ? `<span class="la-row__bonus">incl. +${formatArchiveStars(entry.classBonus)}★ team gifts</span>` : ''}
            </div>
        </li>`;
}

function sheetHtml(league, entries, sheetIndex, monthKey) {
    const myIds = getMyClassIds();
    const summary = summarizeArchiveLeague(entries);
    const runners = entries.filter((e) => e.totalStars > 0);
    const waiting = entries.filter((e) => !(e.totalStars > 0));
    const trackMax = getArchiveTrackMax(runners.map((e) => e.progress));
    const gaps = describeArchiveGaps(runners);
    const champ = summary.champion;
    const skyward = runners.filter((e) => e.isQuestComplete && e.progress >= 101).length;
    const crossed = runners.filter((e) => e.isQuestComplete).length;

    const facts = [
        `<span class="la-fact"><i class="fas fa-people-group" aria-hidden="true"></i><strong>${summary.parties}</strong> ${summary.parties === 1 ? 'party' : 'parties'}</span>`,
        `<span class="la-fact"><i class="fas fa-gem" aria-hidden="true"></i><strong>${summary.goalsReached}</strong> reached the goal</span>`,
        crossed ? `<span class="la-fact"><i class="fas fa-dungeon" aria-hidden="true"></i><strong>${crossed}</strong> crossed the Portal</span>` : '',
        skyward ? `<span class="la-fact la-fact--sky"><i class="fas fa-star" aria-hidden="true"></i><strong>${skyward}</strong> climbed into the Crystal Sky</span>` : '',
        `<span class="la-fact"><i class="fas fa-star" aria-hidden="true"></i><strong>${formatArchiveStars(summary.totalStars)}</strong> stars</span>`
    ].join('');

    const champion = champ ? `
        <div class="la-champ${myIds.has(champ.id) ? ' is-mine' : ''}">
            <span class="la-champ__pennant" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <span class="la-champ__crest" aria-hidden="true">${esc(champ.logo || '📚')}</span>
            <div class="la-champ__text">
                <span class="la-champ__kicker">Month champion</span>
                <span class="la-champ__name font-title">${esc(champ.name)}</span>
                <span class="la-champ__line">${esc(describeChampionLine(summary))}</span>
            </div>
        </div>` : '';

    const waitingHtml = waiting.length ? `
        <details class="la-waiting">
            <summary><i class="fas fa-campground" aria-hidden="true"></i> Still at the start line <span class="la-waiting__count">${waiting.length}</span><i class="fas fa-chevron-down la-waiting__caret" aria-hidden="true"></i></summary>
            <ul class="la-waiting__list">${waiting.map((e) => `<li><span aria-hidden="true">${esc(e.logo || '📚')}</span>${esc(e.name)}${myIds.has(e.id) ? ' <em>(your class)</em>' : ''}</li>`).join('')}</ul>
        </details>` : '';

    return `
        <section class="la-sheet" data-league="${esc(league)}" style="--s:${Math.min(sheetIndex, 6)}">
            <header class="la-sheet__head">
                <span class="la-sheet__medal" aria-hidden="true"><i class="fas ${esc(leagueIcon(league))}"></i></span>
                <div class="la-sheet__title">
                    <h3 class="font-title">${esc(league)} League</h3>
                    <div class="la-sheet__facts">${facts}</div>
                </div>
                ${champion}
            </header>
            ${runners.length ? raceChartHtml(runners) : ''}
            ${runners.length
                ? `<ol class="la-ranks">${runners.map((e, i) => rowHtml(e, i, gaps, trackMax, myIds, false, monthKey)).join('')}</ol>`
                : '<p class="la-sheet__quiet"><i class="fas fa-wind" aria-hidden="true"></i> No party set out this month.</p>'}
            ${waitingHtml}
        </section>`;
}

function yoursHtml(leagueMap) {
    const myIds = getMyClassIds();
    const cards = [];
    leagueMap.forEach((entries, league) => {
        const runners = entries.filter((e) => e.totalStars > 0);
        entries.forEach((e) => {
            if (!myIds.has(e.id)) return;
            const ran = e.totalStars > 0;
            const place = ran ? `${rankWord(e.rank)} of ${runners.length}` : 'Did not set out';
            const reached = e.isQuestComplete || e.progress >= 100;
            const pct = `${Math.floor(Math.max(0, Number(e.progress) || 0))}%`;
            cards.push(`
                <button type="button" class="la-mine${e.rank === 1 && ran ? ' is-champion' : ''}" ${ran ? `data-la-jump="${esc(e.id)}"` : 'disabled'}>
                    <span class="la-mine__crest" aria-hidden="true">${esc(e.logo || '📚')}</span>
                    <span class="la-mine__text">
                        <span class="la-mine__name">${esc(e.name)}</span>
                        <span class="la-mine__place">${e.rank === 1 && ran ? '<i class="fas fa-crown" aria-hidden="true"></i> ' : ''}${place} · ${esc(league)} League${ran ? ` · ${pct}` : ''}${reached ? ' · <i class="fas fa-gem" aria-hidden="true"></i>' : ''}</span>
                    </span>
                </button>`);
        });
    });
    if (!cards.length) return '';
    return `
        <section class="la-yours" aria-label="Your classes this month">
            <p class="la-yours__label"><i class="fas fa-compass" aria-hidden="true"></i> Your parties</p>
            <div class="la-yours__cards">${cards.join('')}</div>
        </section>`;
}

function emptyHtml(icon, title, text, tone = '') {
    return `
        <div class="la-empty${tone ? ` la-empty--${tone}` : ''}">
            <span class="la-empty__art" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <p class="la-empty__title font-title">${title}</p>
            <p class="la-empty__text">${text}</p>
        </div>`;
}

/**
 * The month's calendar strip: the school holidays that closed lessons that month, and
 * how they eased each class's goal (only the lessons a class really lost count).
 */
function monthConditionsHtml(monthKey) {
    const [year, month] = String(monthKey).split('-').map(Number);
    if (!year || !month) return '';
    const first = `${monthKey}-01`;
    const last = `${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const isoOf = (raw) => {
        const d = utils.parseFlexibleDate(raw);
        return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
    };
    const byName = new Map();
    (state.get('schoolHolidayRanges') || []).forEach((range) => {
        const start = isoOf(range?.start);
        const end = isoOf(range?.end);
        if (!start || !end || end < first || start > last) return;
        const name = range.name || 'School holiday';
        const from = start < first ? first : start;
        const to = end > last ? last : end;
        const known = byName.get(name);
        if (known) {
            if (from < known.from) known.from = from;
            if (to > known.to) known.to = to;
        } else byName.set(name, { name, icon: range.icon || '', from, to });
    });
    // Only closures that fall on a school day matter.
    const items = [...byName.values()].filter(({ from, to }) => {
        const cursor = new Date(`${from}T12:00:00`);
        const stop = new Date(`${to}T12:00:00`);
        for (; cursor <= stop; cursor.setDate(cursor.getDate() + 1)) {
            if (cursor.getDay() !== 0 && cursor.getDay() !== 6) return true;
        }
        return false;
    }).sort((a, b) => a.from.localeCompare(b.from));
    const june = month === 6;
    if (!items.length && !june) return '';
    const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const pills = items.map((h) => `<span class="la-cal__day">${h.icon ? `<span aria-hidden="true">${esc(h.icon)}</span>` : '<i class="fas fa-umbrella-beach" aria-hidden="true"></i>'}${esc(h.name)} <em>${esc(h.from === h.to ? fmt(h.from) : `${fmt(h.from)} – ${fmt(h.to)}`)}</em></span>`).join('');
    return `
        <section class="la-cal" aria-label="The month's calendar">
            <p class="la-cal__label"><i class="fas fa-calendar-days" aria-hidden="true"></i> ${esc(monthLong(monthKey).split(' ')[0])}’s calendar</p>
            <div class="la-cal__days">${pills}${june ? '<span class="la-cal__day la-cal__day--june"><i class="fas fa-sun" aria-hidden="true"></i>June: every goal is halved</span>' : ''}</div>
            ${items.length ? '<p class="la-cal__note">Each class’s goal was eased only for the lessons it really lost.</p>' : ''}
        </section>`;
}

function renderSheets(data) {
    const contentEl = document.getElementById('league-archive-content');
    if (!contentEl) return;
    const monthName = monthLong(data.monthKey);
    const leagues = view.league === ALL ? [...data.byLeague.keys()] : [view.league];
    const inView = new Map(leagues.filter((l) => data.byLeague.has(l)).map((l) => [l, data.byLeague.get(l)]));

    if (!inView.size) {
        contentEl.innerHTML = emptyHtml('fa-map', 'No parties in this league', 'No classes race in this league yet.');
        return;
    }

    const q = view.query.trim().toLowerCase();
    if (q) {
        const myIds = getMyClassIds();
        const hits = [];
        inView.forEach((entries) => {
            const runners = entries.filter((e) => e.totalStars > 0);
            const trackMax = getArchiveTrackMax(runners.map((e) => e.progress));
            const gaps = describeArchiveGaps(runners);
            entries.filter((e) => (e.name || '').toLowerCase().includes(q))
                .forEach((e) => hits.push(rowHtml(e, hits.length, gaps, trackMax, myIds, true, data.monthKey)));
        });
        contentEl.innerHTML = hits.length
            ? `<p class="la-found">${hits.length} ${hits.length === 1 ? 'class' : 'classes'} found in ${esc(monthName)}</p><ol class="la-ranks la-ranks--found">${hits.join('')}</ol>`
            : `<p class="la-noresults">No class called “${esc(view.query.trim())}” raced ${view.league === ALL ? 'in any league' : `in the ${esc(view.league)} League`}.</p>`;
        return;
    }

    const sheets = [];
    inView.forEach((entries, league) => {
        // In "All leagues", a league where nobody earned a star gets no sheet.
        if (view.league === ALL && !entries.some((e) => e.totalStars > 0)) return;
        sheets.push(sheetHtml(league, entries, sheets.length, data.monthKey));
    });

    if (!sheets.length || (view.league !== ALL && !inView.get(view.league).some((e) => e.totalStars > 0))) {
        contentEl.innerHTML = emptyHtml('fa-wind', 'Calm seas', `No stars were recorded in ${esc(monthName)}, so no race was charted.`);
        return;
    }

    const warning = data.readFailed
        ? '<p class="la-warn"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Part of this month’s star record could not be read just now, so some numbers may be low. Close and reopen the archive to try again.</p>'
        : '';
    contentEl.innerHTML = warning + yoursHtml(inView) + monthConditionsHtml(data.monthKey) + sheets.join('');
}

function loadingHtml(monthKey) {
    return `
        <div class="la-loading" aria-live="polite">
            <p><i class="fas fa-map" aria-hidden="true"></i> Unrolling the ${esc(monthLong(monthKey).split(' ')[0])} map…</p>
            <div class="la-skel la-skel--race"></div>
            ${'<div class="la-skel"><span></span><span></span><span></span></div>'.repeat(3)}
        </div>`;
}

async function showMonth(monthKey) {
    view.monthKey = monthKey;
    updateTitles();
    refreshControls();
    const contentEl = document.getElementById('league-archive-content');
    if (!contentEl) return;
    const token = ++archiveToken;
    if (!monthCache.has(monthKey)) contentEl.innerHTML = loadingHtml(monthKey);
    try {
        const data = await computeMonth(monthKey);
        if (token !== archiveToken) return; // a later month was chosen meanwhile
        renderSheets(data);
        contentEl.scrollTop = 0;
    } catch (error) {
        console.error('League Archive render error:', error);
        if (token !== archiveToken) return;
        contentEl.innerHTML = emptyHtml('fa-triangle-exclamation', 'This map couldn’t be unrolled', `${esc(error.message)} · Try another month.`, 'error');
    }
}

function rerenderCurrent() {
    if (view.journal) { showJournal(); return; }
    const data = monthCache.get(view.monthKey);
    if (data) renderSheets(data);
}

function flashRow(id) {
    const row = document.getElementById(`la-row-${id}`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
}

function bindOnce() {
    if (bound) return;
    const controlsEl = document.getElementById('league-archive-controls');
    const contentEl = document.getElementById('league-archive-content');
    const modal = document.getElementById(MODAL_ID);
    if (!controlsEl || !contentEl || !modal) return;
    bound = true;

    controlsEl.addEventListener('click', (e) => {
        const months = listChartedMonths();
        const step = e.target.closest('[data-la-step]');
        if (step && !step.disabled) {
            const next = months[months.indexOf(view.monthKey) + Number(step.dataset.laStep)];
            if (next) { playSound('click'); view.journal = false; showMonth(next); }
            return;
        }
        const stop = e.target.closest('[data-la-month]');
        if (stop && (stop.dataset.laMonth !== view.monthKey || view.journal)) {
            playSound('click');
            view.journal = false;
            showMonth(stop.dataset.laMonth);
            return;
        }
        if (e.target.closest('[data-la-journal]')) {
            playSound('click');
            view.journal = !view.journal;
            refreshControls();
            if (view.journal) showJournal();
            else if (view.monthKey) showMonth(view.monthKey);
            else showYearEmpty();
            return;
        }
        const pick = e.target.closest('[data-la-league]');
        if (pick && pick.dataset.laLeague !== view.league) {
            playSound('click');
            view.league = pick.dataset.laLeague;
            if (view.league !== ALL) state.setGlobalSelectedLeague(view.league, false);
            updateTitles();
            refreshControls();
            rerenderCurrent();
            contentEl.scrollTop = 0;
        }
    });
    controlsEl.addEventListener('input', (e) => {
        if (!e.target.closest('.la-search__input')) return;
        view.query = e.target.value;
        rerenderCurrent();
    });
    contentEl.addEventListener('click', (e) => {
        const jump = e.target.closest('[data-la-jump]');
        if (jump) flashRow(jump.dataset.laJump);
    });
    document.getElementById('league-archive-close-btn')?.addEventListener('click', () => hideModal(MODAL_ID));
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(MODAL_ID); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) hideModal(MODAL_ID);
    });
}

function showYearEmpty() {
    ++archiveToken;
    const contentEl = document.getElementById('league-archive-content');
    if (contentEl) {
        contentEl.innerHTML = emptyHtml('fa-feather-pointed', 'The first map is still being drawn', 'Each month’s race is charted here once the month closes. Last year’s races stay in last year’s archive. The Map Journal already keeps this month’s realms.', 'year');
    }
}

/** Opens the League Archive on the latest closed month. `league` preselects a league (else the header's league, else all). */
export function openLeagueArchive({ league = null } = {}) {
    bindOnce();
    monthCache.clear();
    questHistoryRows = null;
    starManagerRows = null;
    view.query = '';
    view.journal = false;

    const leagues = getLeaguesWithClasses();
    const preferred = league || state.get('globalSelectedLeague');
    view.league = leagues.includes(preferred) ? preferred : (leagues.length === 1 ? leagues[0] : ALL);

    const months = listChartedMonths();
    showAnimatedModal(MODAL_ID);

    if (!months.length) {
        view.monthKey = '';
        updateTitles();
        refreshControls();
        showYearEmpty();
        return;
    }
    showMonth(months[months.length - 1]);
}
