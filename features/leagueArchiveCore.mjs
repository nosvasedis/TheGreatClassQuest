// features/leagueArchiveCore.mjs
// Pure helpers for the League Archive (Team Quest · past months): the race
// chart's scale and lanes, each party's final stretch of the road, gaps to the
// party ahead, and a league's month in numbers. No DOM, no state.

import { getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import { QUEST_ROAD_STOPS, starsToReachPercent } from './teamQuestRace.mjs';
import { BEYOND_FROM, BEYOND_MARKS, BEYOND_MAX, beyondMarkFor, nextBeyondMark } from './questWorld/starwardWay.mjs';

export { QUEST_ROAD_STOPS, BEYOND_MARKS, BEYOND_MAX };

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** Stars shown in the archive: whole numbers stay whole, quarters are kept. */
export function formatArchiveStars(value) {
    const rounded = Math.round(num(value) * 4) / 4;
    return Number.isInteger(rounded) ? rounded.toLocaleString('en-GB') : String(rounded);
}

/**
 * The race chart's right edge in percent of the goal. It is the finish line (100)
 * unless a party ran past it: then the chart opens into the Crystal Sky and ends
 * at the next named stone of the Starward Way (Moonstep 110%, Comet's Rest 125%,
 * the Star Crown 150%, Aurora Bridge 175%, the Celestial Palace 200%).
 */
export function getArchiveTrackMax(progressValues = [], cap = BEYOND_MAX) {
    const top = Math.max(0, ...progressValues.map(num));
    if (top <= 100) return 100;
    const mark = BEYOND_MARKS.find((m) => top <= m.at);
    return Math.min(cap, mark ? mark.at : cap);
}

/** Where a party sits on the chart, 0..1 of the track width. */
export function getArchiveTrackPosition(progress, trackMax = 100) {
    const max = num(trackMax) > 0 ? num(trackMax) : 100;
    return Math.min(1, Math.max(0, num(progress) / max));
}

/**
 * Stack race tokens in lanes so crests don't sit on top of each other.
 * `positions` are 0..1 in finishing order (leader first). A token goes in the
 * first lane where it keeps `minGap` from every token already there; when all
 * lanes are crowded it takes the lane whose nearest token is furthest away.
 */
export function layoutArchiveRaceLanes(positions = [], { minGap = 0.075, lanes = 3 } = {}) {
    const placed = Array.from({ length: Math.max(1, lanes) }, () => []);
    return positions.map((raw) => {
        const pos = Math.min(1, Math.max(0, num(raw)));
        let best = 0;
        let bestRoom = -1;
        for (let lane = 0; lane < placed.length; lane++) {
            const room = placed[lane].length
                ? Math.min(...placed[lane].map((other) => Math.abs(other - pos)))
                : Infinity;
            if (room >= minGap) { best = lane; bestRoom = room; break; }
            if (room > bestRoom) { best = lane; bestRoom = room; }
        }
        placed[best].push(pos);
        return best;
    });
}

/** The furthest realm a party reached, and the road stop it was heading for. */
export function describeArchiveStretch(progress, stars, goal) {
    const pct = num(progress);
    const zone = getQuestMapZoneForProgressPercent(Math.min(100, Math.max(0, pct)));
    const complete = pct >= 100;
    const next = complete ? null : QUEST_ROAD_STOPS.find((stop) => pct < stop.progress) || null;
    return {
        zone,
        complete,
        next: next
            ? { ...next, starsShort: Math.max(1, starsToReachPercent(stars, goal, next.progress)) }
            : null,
        starsShortOfGoal: complete ? 0 : Math.max(1, starsToReachPercent(stars, goal, 100))
    };
}

/**
 * Finishing gaps for ranked entries (leader first). Goals differ per class, so a
 * gap is the stars a party would have needed to match the progress of the party
 * just ahead, measured past the finish line too (the archive is not clamped).
 */
export function describeArchiveGaps(entries = []) {
    const gaps = new Map();
    entries.forEach((entry, index) => {
        const ahead = entries[index - 1];
        if (!ahead) { gaps.set(entry.id, null); return; }
        const starsToCatch = starsToReachPercent(entry.totalStars, entry.diamondGoal, num(ahead.progress));
        gaps.set(entry.id, { id: ahead.id, name: ahead.name || 'Class', starsToCatch: Math.max(1, starsToCatch) });
    });
    return gaps;
}

/** A league's month in numbers, for the sheet header and the summary line. */
export function summarizeArchiveLeague(entries = []) {
    const raced = entries.filter((entry) => num(entry.totalStars) > 0);
    const goalsReached = entries.filter((entry) => entry.isQuestComplete || num(entry.progress) >= 100).length;
    const totalStars = entries.reduce((sum, entry) => sum + num(entry.totalStars), 0);
    const champion = raced[0] || null;
    const runnerUp = raced[1] || null;
    const margin = champion && runnerUp
        ? Math.max(1, starsToReachPercent(runnerUp.totalStars, runnerUp.diamondGoal, num(champion.progress)))
        : null;
    return {
        parties: entries.length,
        raced: raced.length,
        goalsReached,
        totalStars,
        champion,
        runnerUp,
        margin
    };
}

/** One line for the champion's banner: how the month was won. */
export function describeChampionLine(summary) {
    if (!summary?.champion) return '';
    const { champion, runnerUp, margin } = summary;
    if (!runnerUp) return `${champion.name} raced the road alone`;
    if (margin <= 2) return `A photo finish: ${runnerUp.name} was only ${margin}★ behind`;
    return `Planted the flag ${margin}★ ahead of ${runnerUp.name}`;
}

// --- The month as it really was --------------------------------------------

/** "YYYY-MM" of a Date. */
function monthKeyOfDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The month an award_log row belongs to: its own `date` (DD-MM-YYYY, or YYYY-MM-DD),
 * so a Star Manager row added in November for an October lesson counts for October.
 * Rows without a date fall back to when they were written.
 */
export function awardLogMonthKey(log) {
    const raw = String(log?.date || '').trim();
    let m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[3]}-${String(Number(m[2])).padStart(2, '0')}`;
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
    const created = toDate(log?.createdAt);
    return created ? monthKeyOfDate(created) : '';
}

/**
 * Every star an award_log row credited in `monthKey`, by student. Rows are matched by
 * their own date (see awardLogMonthKey) and counted once even when two reads overlap.
 * `creditOf` is awardLogReasonMeta.getAwardLogMonthlyStarCredit (half stars, wheel
 * stars, Showdown / Quiz of the Week / Quiet Dragon / Ember Oath gifts all count).
 */
export function sumArchiveLogStarsByStudent(logs = [], monthKey, creditOf) {
    const totals = {};
    const seen = new Set();
    for (const log of logs || []) {
        if (!log?.studentId) continue;
        if (log.id) {
            if (seen.has(log.id)) continue;
            seen.add(log.id);
        }
        if (awardLogMonthKey(log) !== monthKey) continue;
        const credit = num(creditOf ? creditOf(log) : log.stars);
        totals[log.studentId] = (totals[log.studentId] || 0) + credit;
    }
    return totals;
}

/**
 * One hero's stars for a closed month, from the most faithful record there is:
 *   1. monthly_history/{month}: the counter archived when the next month began
 *      (Star Manager repairs are written into it too);
 *   2. the live counter, when it still holds that month (no star yet since: the
 *      counter rolls over lazily, so last month often still lives here);
 *   3. that month's award_log rows.
 */
export function resolveArchiveHeroStars({ studentId, monthKey, history = {}, score = null, logTotals = {} }) {
    if (history && Object.prototype.hasOwnProperty.call(history, studentId)) {
        return { stars: num(history[studentId]), source: 'history' };
    }
    if (score && score.lastMonthlyResetDate === `${monthKey}-01`) {
        return { stars: num(score.monthlyStars), source: 'counter' };
    }
    return { stars: num(logTotals?.[studentId]), source: 'logs' };
}

/**
 * Every Portal crossing of the year, one per class and month: the quest_history rows,
 * plus the crossings kept on the class docs (portalCrossings) for any row that could
 * not be read. Shaped like quest_history rows (utils.getHistoricalDifficultyForMonth).
 */
export function collectArchiveCrossings(classes = [], questHistory = []) {
    const byKey = new Map();
    for (const row of questHistory || []) {
        if (!row?.classId || typeof row.monthKey !== 'string') continue;
        const key = `${row.classId}|${row.monthKey}`;
        if (!byKey.has(key)) byKey.set(key, { ...row });
    }
    for (const c of classes || []) {
        const crossings = c?.portalCrossings;
        if (!c?.id || !crossings || typeof crossings !== 'object') continue;
        for (const [monthKey, info] of Object.entries(crossings)) {
            if (!/^\d{4}-\d{2}$/.test(monthKey) || !info) continue;
            const key = `${c.id}|${monthKey}`;
            const known = byKey.get(key);
            if (known) {
                if (!(num(known.goalTarget) > 0) && num(info.goal) > 0) known.goalTarget = num(info.goal);
                if (!(num(known.starsEarned) > 0) && num(info.stars) > 0) known.starsEarned = num(info.stars);
                continue;
            }
            byKey.set(key, {
                classId: c.id,
                className: c.name || '',
                monthKey,
                levelReached: num(info.level) || undefined,
                goalTarget: num(info.goal),
                starsEarned: num(info.stars),
                fromClassDoc: true
            });
        }
    }
    return [...byKey.values()];
}

/**
 * A party's closed month, put together from the month's own facts.
 *   heroStars   the heroes' stars that month (resolveArchiveHeroStars, summed)
 *   classBonus  Team Quest stars given to the class itself (Pathfinder's Map, Realm Raid,
 *               Fortune's Wheel, Ember Oaths: classes.teamQuestBonuses[month])
 *   goal        the goal worked out for that month (roster, level, lessons that ran)
 *   crossing    the Portal crossing record of that month, if the party stepped through
 *   lockedGoal  the goal the Ceremony of the Month locked for the class, if any
 * The goal a crossing recorded (the one the party filled) wins, then the ceremony's.
 * Progress is never clamped: a party that ran on past its goal shows how far.
 */
export function buildArchiveMonthEntry({ heroStars = 0, classBonus = 0, goal = 0, crossing = null, lockedGoal = 0 } = {}) {
    const counted = num(heroStars) + num(classBonus);
    const crossed = Boolean(crossing);
    // Stars never go below what the party had when it stepped through.
    const totalStars = crossed ? Math.max(counted, num(crossing.starsEarned)) : counted;
    const goalSource = crossed && num(crossing.goalTarget) > 0 ? 'crossing'
        : num(lockedGoal) > 0 ? 'ceremony' : 'computed';
    const diamondGoal = goalSource === 'crossing' ? num(crossing.goalTarget)
        : goalSource === 'ceremony' ? num(lockedGoal) : num(goal);
    const progress = diamondGoal > 0 ? (totalStars / diamondGoal) * 100 : 0;
    return {
        totalStars,
        heroStars: num(heroStars),
        classBonus: num(classBonus),
        diamondGoal,
        goalSource,
        progress: Number.isFinite(progress) ? progress : 0,
        isQuestComplete: crossed
    };
}

/**
 * Where a party ended the month past its goal. Only a party that stepped through the
 * Portal climbs the Starward Way into the Crystal Sky; one that filled its goal while
 * the Portal stayed sealed waits at the Portal, however far past the goal it ran.
 */
export function describeArchiveSky(progress, crossed, stars = 0, goal = 0) {
    const pct = num(progress);
    if (!crossed || pct < BEYOND_FROM) return { inSky: false, overGoal: Math.max(0, pct - 100), mark: null, next: null };
    const mark = beyondMarkFor(pct);
    const nextMark = nextBeyondMark(pct);
    return {
        inSky: true,
        overGoal: pct - 100,
        mark,
        next: nextMark ? { ...nextMark, starsShort: Math.max(1, starsToReachPercent(stars, goal, nextMark.at)) } : null,
        palace: pct >= BEYOND_MAX
    };
}

/**
 * The class's lessons that month, for the ledger: how many its rotation put in the
 * month, how many ran, and which days were lost (and why). Counts come from
 * utils.getMonthlyLessonBalanceForDate (the goal's source of truth); this only names
 * the lost days, so a holiday on a day the class has no lesson is never listed.
 */
export function listArchiveLostLessons(classData, monthKey, ranges = [], overrides = []) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return [];
    const rotation = new Set((Array.isArray(classData?.scheduleDays) ? classData.scheduleDays : []).map(String));
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOf = (raw) => {
        const m = String(raw || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const d = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return d ? d[0] : '';
    };
    const isoDay = (raw) => {
        if (typeof raw === 'string') return dayOf(raw);
        const d = toDate(raw);
        return d ? iso(d) : '';
    };
    const types = new Map();
    for (const o of overrides || []) {
        if (!o || o.classId !== classData?.id) continue;
        const day = dayOf(o.date);
        if (!day) continue;
        if (!types.has(day)) types.set(day, new Set());
        types.get(day).add(o.type);
    }
    const lost = [];
    const days = new Date(year, month, 0).getDate();
    for (let d = 1; d <= days; d++) {
        const date = new Date(year, month - 1, d);
        if (!rotation.has(String(date.getDay()))) continue;
        const day = iso(date);
        const t = types.get(day) || new Set();
        if (t.has('one-time') && !t.has('cancelled')) continue;
        if (t.has('cancelled')) { lost.push({ day, why: 'Lesson cancelled' }); continue; }
        const range = (ranges || []).find((r) => r?.start && r?.end && day >= isoDay(r.start) && day <= isoDay(r.end));
        if (range) lost.push({ day, why: range.name || 'School holiday' });
    }
    return lost;
}
