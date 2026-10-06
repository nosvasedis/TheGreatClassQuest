// /ui/modals/leagueArchive.js
// League Archive (Team Quest · past months): each closed month is a charted
// sheet of the atlas. A month rail with waypoint pips, league chips and a class
// search sit on top; every league gets a race chart (where each party stopped
// on the road), a champion's pennant and a standings ledger.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { questLeagues, getQuestLeagueDefinition } from '../../constants.js';
import {
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import {
    QUEST_ROAD_STOPS,
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
let archiveToken = 0;
let bound = false;

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

/** Final standings of every league for one closed month (same numbers and order as before the redesign). */
async function computeMonth(monthKey) {
    if (monthCache.has(monthKey)) return monthCache.get(monthKey);

    let monthlyScores = {};
    let questHistoryData = [];
    try {
        const { fetchLogsForMonth } = await import('../../db/queries.js');
        const { fetchMonthlyHistory } = await import('../../state.js');
        const [year, month] = monthKey.split('-').map(Number);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const [logs, archivedRows, history] = await Promise.all([
            Promise.race([fetchLogsForMonth(year, month), timeout]).catch(() => []),
            fetchMonthlyHistory(monthKey).catch(() => ({})),
            loadQuestHistory()
        ]);
        monthlyScores = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(
            sumMonthlyStarCreditsByStudentFromAwardLogs(logs || []),
            archivedRows || {}
        );
        questHistoryData = history || [];
    } catch (error) {
        console.error('League Archive fetch error:', error);
    }

    const ranges = state.get('schoolHolidayRanges') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const monthStart = new Date(`${monthKey}-01T00:00:00`);
    const allClasses = state.get('allSchoolClasses') || [];
    const allStudents = state.get('allStudents') || [];
    const byLeague = new Map();

    for (const league of questLeagues) {
        const classesInLeague = allClasses.filter((c) => c.questLevel === league);
        if (!classesInLeague.length) continue;

        const entries = classesInLeague.map((c) => {
            const daysLost = utils.calculateMonthlyDaysLostForDate(c, ranges, overrides, monthStart);
            // A completion snapshot is the official record for that month.
            const record = questHistoryData.find((h) => h.classId === c.id && h.monthKey === monthKey);
            if (record) {
                return {
                    ...c,
                    totalStars: Number(record.starsEarned) || 0,
                    progress: 100,
                    diamondGoal: Number(record.goalTarget) || 0,
                    daysLost,
                    historicalLevel: (Number(record.levelReached) || 1) - 1,
                    isQuestComplete: true
                };
            }
            // Otherwise rebuild it from the month's star logs.
            const roster = allStudents.filter((s) => s.classId === c.id);
            const bonus = Number(c.teamQuestBonuses?.[monthKey]) || 0;
            const totalStars = roster.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0) + bonus;
            const diamondGoal = utils.calculateMonthlyClassGoalForDate(c, roster.length, ranges, overrides, monthStart, questHistoryData);
            return {
                ...c,
                totalStars,
                progress: diamondGoal > 0 ? (totalStars / diamondGoal) * 100 : 0,
                diamondGoal,
                daysLost,
                historicalLevel: utils.getHistoricalDifficultyForMonth(c, monthStart, questHistoryData),
                isQuestComplete: false
            };
        }).sort(utils.sortTeamQuestEntries)
            .map((entry, index) => ({
                ...entry,
                progress: Number.isFinite(entry.progress) ? entry.progress : 0,
                rank: index + 1
            }));

        byLeague.set(league, entries);
    }

    const result = { monthKey, byLeague };
    monthCache.set(monthKey, result);
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

function raceChartHtml(entries, trackMax) {
    const runners = entries.filter((e) => e.totalStars > 0);
    if (!runners.length) return '';
    const positions = runners.map((e) => getArchiveTrackPosition(e.progress, trackMax));
    const lanes = layoutArchiveRaceLanes(positions);
    const laneCount = Math.max(...lanes) + 1;
    const finish = getArchiveTrackPosition(100, trackMax);
    const myIds = getMyClassIds();

    const realms = QUEST_ROAD_STOPS.filter((stop) => stop.progress < 100).map((stop) => {
        const zone = QUEST_MAP_ZONES.find((z) => z.minPercent === stop.progress);
        return `<span class="la-race__realm" style="--at:${(getArchiveTrackPosition(stop.progress, trackMax) * 100).toFixed(2)}%" title="${esc(stop.label)} (${stop.progress}%)"><span aria-hidden="true">${zone?.icon || '•'}</span></span>`;
    }).join('');

    const tokens = runners.map((e, i) => {
        const x = (positions[i] * 100).toFixed(2);
        const cls = ['la-runner', e.rank === 1 ? 'is-leader' : '', myIds.has(e.id) ? 'is-mine' : '', e.progress >= 100 ? 'is-home' : '']
            .filter(Boolean).join(' ');
        return `
            <span class="${cls}" style="--x:${x}%;--lane:${lanes[i]};--i:${Math.min(i, 10)}">
                <span class="la-token" title="${esc(e.name)} · ${Math.round(e.progress)}%">
                    <span class="la-token__crest" aria-hidden="true">${esc(e.logo || '📚')}</span>
                    <span class="la-token__rank">${e.rank}</span>
                </span>
            </span>`;
    }).join('');

    const label = runners.map((e) => `${e.rank}. ${e.name} ${Math.round(e.progress)}%`).join(', ');
    return `
        <div class="la-race" style="--lanes:${laneCount};--finish:${(finish * 100).toFixed(2)}%" role="img" aria-label="Where each party stopped: ${esc(label)}">
            <div class="la-race__field">
                <div class="la-race__road" aria-hidden="true"></div>
                ${realms}
                <span class="la-race__start" aria-hidden="true"></span>
                <span class="la-race__finish" aria-hidden="true"><i class="fas fa-flag-checkered"></i></span>
                ${tokens}
            </div>
            <div class="la-race__scale" aria-hidden="true">
                <span>Start</span>
                <span class="la-race__scale-goal" style="--at:${(finish * 100).toFixed(2)}%">Goal</span>
                ${trackMax > 100 ? `<span class="la-race__scale-end">${trackMax}%</span>` : ''}
            </div>
        </div>`;
}

function rowHtml(entry, index, gaps, trackMax, myIds, showLeague) {
    const isMine = myIds.has(entry.id);
    const stretch = describeArchiveStretch(entry.progress, entry.totalStars, entry.diamondGoal);
    const reached = entry.isQuestComplete || entry.progress >= 100;
    const gap = gaps.get(entry.id);
    const fill = getArchiveTrackPosition(entry.progress, trackMax);
    const finish = getArchiveTrackPosition(100, trackMax);
    const tone = entry.rank <= 3 ? ` la-row--top${entry.rank}` : '';
    const classes = `la-row${tone}${isMine ? ' is-mine' : ''}${reached ? ' is-complete' : ''}`;

    const chips = [
        showLeague ? `<span class="la-chip la-chip--league"><i class="fas ${esc(leagueIcon(entry.questLevel))}" aria-hidden="true"></i>${esc(entry.questLevel)}</span>` : '',
        isMine ? '<span class="la-chip la-chip--mine">Your class</span>' : '',
        reached ? '<span class="la-chip la-chip--goal"><i class="fas fa-gem" aria-hidden="true"></i>Goal reached</span>' : '',
        entry.historicalLevel > 0 ? `<span class="la-chip la-chip--level" title="Quest difficulty that month">Lvl ${entry.historicalLevel + 1}</span>` : '',
        entry.daysLost > 0 ? `<span class="la-chip la-chip--lost" title="${entry.daysLost} lesson day${entry.daysLost === 1 ? '' : 's'} lost to holidays or cancellations">−${entry.daysLost} day${entry.daysLost === 1 ? '' : 's'}</span>` : ''
    ].filter(Boolean).join('');

    const where = reached
        ? `${badgeImg('crystal')}<span>Crossed the Portal</span>`
        : `${badgeImg(stretch.zone.id)}<span>Stopped in ${esc(stretch.zone.label)} · ${stretch.starsShortOfGoal}★ short of the goal</span>`;
    const chase = gap ? `<span class="la-row__gap"><i class="fas fa-person-running" aria-hidden="true"></i>${gap.starsToCatch}★ behind ${esc(gap.name)}</span>` : '';

    return `
        <li class="${classes}" id="la-row-${esc(entry.id)}" style="--i:${Math.min(index, 12)}">
            <span class="la-flag" aria-label="${rankWord(entry.rank)} place"><span class="la-flag__cloth"><span class="font-title">${entry.rank}</span></span></span>
            <span class="la-crest" aria-hidden="true">${esc(entry.logo || '📚')}</span>
            <div class="la-row__body">
                <div class="la-row__line">
                    <p class="la-row__name">${esc(entry.name)}</p>
                    ${chips ? `<div class="la-row__chips">${chips}</div>` : ''}
                </div>
                <span class="la-road" style="--finish:${(finish * 100).toFixed(2)}%" aria-hidden="true">
                    <span class="la-road__fill" style="--p:${fill.toFixed(4)}"></span>
                    <span class="la-road__goal"></span>
                </span>
                <p class="la-row__note"><span class="la-row__where">${where}</span>${chase}</p>
            </div>
            <div class="la-row__score">
                <span class="la-row__pct font-title">${Math.round(entry.progress)}%</span>
                <span class="la-row__stars">${formatArchiveStars(entry.totalStars)} / ${formatArchiveStars(entry.diamondGoal)}<i class="fas fa-star" aria-hidden="true"></i></span>
            </div>
        </li>`;
}

function sheetHtml(league, entries, sheetIndex) {
    const myIds = getMyClassIds();
    const summary = summarizeArchiveLeague(entries);
    const runners = entries.filter((e) => e.totalStars > 0);
    const waiting = entries.filter((e) => !(e.totalStars > 0));
    const trackMax = getArchiveTrackMax(runners.map((e) => e.progress));
    const gaps = describeArchiveGaps(runners);
    const champ = summary.champion;

    const facts = [
        `<span class="la-fact"><i class="fas fa-people-group" aria-hidden="true"></i><strong>${summary.parties}</strong> ${summary.parties === 1 ? 'party' : 'parties'}</span>`,
        `<span class="la-fact"><i class="fas fa-gem" aria-hidden="true"></i><strong>${summary.goalsReached}</strong> reached the goal</span>`,
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
            ${runners.length ? raceChartHtml(runners, trackMax) : ''}
            ${runners.length
                ? `<ol class="la-ranks">${runners.map((e, i) => rowHtml(e, i, gaps, trackMax, myIds, false)).join('')}</ol>`
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
            cards.push(`
                <button type="button" class="la-mine${e.rank === 1 && ran ? ' is-champion' : ''}" ${ran ? `data-la-jump="${esc(e.id)}"` : 'disabled'}>
                    <span class="la-mine__crest" aria-hidden="true">${esc(e.logo || '📚')}</span>
                    <span class="la-mine__text">
                        <span class="la-mine__name">${esc(e.name)}</span>
                        <span class="la-mine__place">${e.rank === 1 && ran ? '<i class="fas fa-crown" aria-hidden="true"></i> ' : ''}${place} · ${esc(league)} League${ran ? ` · ${Math.round(e.progress)}%` : ''}${reached ? ' · <i class="fas fa-gem" aria-hidden="true"></i>' : ''}</span>
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
                .forEach((e) => hits.push(rowHtml(e, hits.length, gaps, trackMax, myIds, true)));
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
        sheets.push(sheetHtml(league, entries, sheets.length));
    });

    if (!sheets.length || (view.league !== ALL && !inView.get(view.league).some((e) => e.totalStars > 0))) {
        contentEl.innerHTML = emptyHtml('fa-wind', 'Calm seas', `No stars were recorded in ${esc(monthName)}, so no race was charted.`);
        return;
    }

    contentEl.innerHTML = yoursHtml(inView) + sheets.join('');
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
