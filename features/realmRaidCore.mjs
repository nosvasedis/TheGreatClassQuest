/**
 * Realm Raid: three times a year, every class in the school fights one friendly Realm Guardian.
 * Pure rules; no DOM, no Firestore. The watcher is features/realmRaid.js, the hall ui/modals/realmRaid.js.
 * Covered by tests/realm-raid-core.test.mjs.
 *
 * The rules, in words a class understands:
 * - Once a term the Guardian, Eldhorn, comes to the Realm in a festival coat for one school week
 *   (Monday to Friday, five turns): the week before the last school week before Christmas, the last
 *   school week before Clean Monday, and the first school week of June.
 * - Its shield is made of one shard per class. A class's shard is as big as the stars its own
 *   Team Quest map expects from it in its raid lessons, a little gentler (80%). A class of 8 that
 *   meets once has a small shard, a class of 16 that meets twice a big one, so every class
 *   breaks its shard with the same normal, good week.
 * - Every star any class earns that week chips at the shield. Stars past a class's own shard keep
 *   helping the school. When all the stars together reach the whole shield, it breaks for everyone.
 * - Valor: a class that breaks its own shard gets +2 Gold for every hero, whatever happens.
 * - Victory: the shield breaks, and every class gets +5 Gold for every hero, the same step on its
 *   own Team Quest map (5% of its monthly goal), and one festival treasure for its Raid Hero.
 * - Legendary: the school reaches 120% before the week ends: +3 Gold for every hero and another
 *   2.5% step on the map.
 * - Nothing is ever taken away. If the shield holds, the Guardian bows and comes back next term.
 */

/** A raid is one school week, Monday to Friday: five turns. No lessons are held at weekends. */
export const RAID_LENGTH_DAYS = 5;
export const RAID_HERALD_DAYS = 7;
export const RAID_AFTERMATH_DAYS = 10;
/** A shard asks for this much of a class's normal Team Quest pace. */
export const RAID_EFFORT = 0.8;
/** Team Quest base pace per hero per month (utils.calculateMonthlyClassGoalForDate). */
export const QUEST_BASE_GOAL = 18;
export const QUEST_DIFFICULTY_STEP = 2.5;
export const WEEKS_PER_MONTH = 4.33;
export const LEGENDARY_AT = 1.2;

export const RAID_REWARDS = Object.freeze({
    valorGold: 2,
    victoryGold: 5,
    victoryQuestStep: 0.05,
    legendaryGold: 3,
    legendaryQuestStep: 0.025,
    heroFallbackGold: 10
});

/** The three raids of a school year, in order. `festival` is the Mystic Market stall it shares. */
export const RAID_SEASONS = Object.freeze([
    {
        id: 'winter',
        festival: 'christmas',
        name: 'The Winter Raid',
        coat: 'Winter Coat',
        guardian: 'Eldhorn',
        title: 'Eldhorn, Warden of the Winter Gate',
        emoji: '❄️',
        arrives: 'comes down from the frozen peaks',
        returns: 'in his Carnival coat'
    },
    {
        id: 'carnival',
        festival: 'carnival',
        name: 'The Carnival Raid',
        coat: 'Carnival Coat',
        guardian: 'Eldhorn',
        title: 'Eldhorn, Keeper of the Masked Gate',
        emoji: '🎭',
        arrives: 'dances in under the carnival lanterns',
        returns: 'in his Summer coat'
    },
    {
        id: 'summer',
        festival: 'endofyear',
        name: 'The Summer Raid',
        coat: 'Summer Coat',
        guardian: 'Eldhorn',
        title: 'Eldhorn, Guardian of the Sun Gate',
        emoji: '☀️',
        arrives: 'walks out of the golden fields',
        returns: 'next school year, in his Winter coat'
    }
]);

export function getRaidSeason(id) {
    const key = String(id || '').replace(/[-_]\d{4}$/, '');
    return RAID_SEASONS.find((season) => season.id === key) || null;
}

// ─── Dates (local midnight; no time zones) ──────────────────────────────────

const DAY_MS = 86400000;

export function startOfDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date, days) {
    const d = startOfDay(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function dayKey(date) {
    const d = startOfDay(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from a to b (b later is positive). */
export function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/** Reads "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", a Date or a Firestore timestamp. */
export function readDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const text = String(value).trim();
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Same algorithm as utils/shopCalendar.js#getOrthodoxEasterDate, as a local date. */
export function orthodoxEaster(year) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    const julian = new Date(year, month - 1, day);
    return addDays(julian, year >= 2100 ? 14 : 13);
}

function holidayRanges(holidays = []) {
    return (holidays || []).map((range) => {
        const start = readDate(range?.start);
        const end = readDate(range?.end);
        return start && end ? { start: startOfDay(start), end: startOfDay(end) } : null;
    }).filter(Boolean);
}

/** The holiday that covers `date`, or the first one that starts within `aheadDays` after it. */
function holidayAround(ranges, date, aheadDays = 0) {
    const day = startOfDay(date);
    return ranges.find((r) => r.start <= day && r.end >= day)
        || ranges.filter((r) => r.start > day && daysBetween(day, r.start) <= aheadDays).sort((a, b) => a.start - b.start)[0]
        || null;
}

/** Monday of the week that holds `date`. */
export function mondayOf(date) {
    const d = startOfDay(date);
    return addDays(d, -((d.getDay() + 6) % 7));
}

/** The last weekday before `date` (weekends skipped). */
function lastWeekdayBefore(date) {
    let d = addDays(date, -1);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, -1);
    return d;
}

/**
 * The raid window for one season of the school year that starts in `startYear` (September).
 * Always a Monday-to-Friday school week:
 * - Winter: the week before the last school week before the Christmas holiday.
 * - Carnival: the last school week before Clean Monday (or the holiday around it).
 * - Summer: the week of the first Monday of June (earlier if the school year closes before its Friday).
 */
export function raidWindow(seasonId, startYear, { holidays = [], closeDate = null } = {}) {
    const season = getRaidSeason(seasonId);
    if (!season || !Number.isFinite(startYear)) return null;
    const ranges = holidayRanges(holidays);
    let start;
    if (season.id === 'winter') {
        // The Christmas holiday: one that covers 24 December, or starts within a week before it.
        const eve = new Date(startYear, 11, 24);
        const holiday = holidayAround(ranges, new Date(startYear, 11, 17), 7);
        const usable = holiday && holiday.start <= eve && daysBetween(new Date(startYear, 11, 1), holiday.start) >= 10;
        const lastWeek = mondayOf(lastWeekdayBefore(usable ? holiday.start : eve));
        start = addDays(lastWeek, -7);
    } else if (season.id === 'carnival') {
        const cleanMonday = addDays(orthodoxEaster(startYear + 1), -48);
        const holiday = holidayAround(ranges, addDays(cleanMonday, -3), 3);
        const usable = holiday && holiday.start <= cleanMonday && holiday.end >= addDays(cleanMonday, -3);
        start = mondayOf(lastWeekdayBefore(usable ? holiday.start : cleanMonday));
    } else {
        const june = new Date(startYear + 1, 5, 1);
        start = addDays(june, (8 - june.getDay()) % 7);
        const close = readDate(closeDate);
        if (close && startOfDay(close) <= addDays(start, RAID_LENGTH_DAYS - 1) && close > new Date(startYear + 1, 4, 20)) {
            start = mondayOf(lastWeekdayBefore(close));
        }
    }
    start = startOfDay(start);
    const end = addDays(start, RAID_LENGTH_DAYS - 1);
    return {
        raidId: `${season.id}_${startYear}`,
        season,
        start,
        end,
        heraldFrom: addDays(start, -RAID_HERALD_DAYS),
        aftermathUntil: addDays(end, RAID_AFTERMATH_DAYS)
    };
}

/** The school year (its September year) that a date belongs to. */
export function schoolStartYear(date) {
    const d = startOfDay(date);
    return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Every raid of the school year that contains `date`. */
export function raidsOfYear(date, options = {}) {
    const year = schoolStartYear(date);
    return RAID_SEASONS.map((season) => raidWindow(season.id, year, options)).filter(Boolean);
}

/**
 * The raid that matters on `now`: heralded, active or just finished. Returns
 * { ...window, phase, dayNumber, daysToStart, daysLeft } or null.
 */
export function findRaid(now = new Date(), options = {}) {
    const today = startOfDay(now);
    const candidates = [schoolStartYear(today) - 1, schoolStartYear(today)]
        .flatMap((year) => RAID_SEASONS.map((season) => raidWindow(season.id, year, options)))
        .filter(Boolean);
    for (const raid of candidates) {
        if (today < raid.heraldFrom || today > raid.aftermathUntil) continue;
        let phase = 'aftermath';
        if (today < raid.start) phase = 'herald';
        else if (today <= raid.end) phase = 'active';
        return {
            ...raid,
            phase,
            dayNumber: phase === 'active' ? daysBetween(raid.start, today) + 1 : 0,
            daysToStart: Math.max(0, daysBetween(today, raid.start)),
            daysLeft: phase === 'active' ? daysBetween(today, raid.end) : 0
        };
    }
    return null;
}

/**
 * Any raid seen from `now`: { ...window, phase, dayNumber, daysToStart, daysLeft }.
 * Unlike findRaid it never returns null: a raid weeks away is 'herald' (with its countdown) and one
 * long past is 'over'. The Calendar opens raids this way.
 */
export function raidOn(raid, now = new Date()) {
    if (!raid) return null;
    const today = startOfDay(now);
    let phase = 'over';
    if (today < raid.start) phase = 'herald';
    else if (today <= raid.end) phase = 'active';
    else if (today <= raid.aftermathUntil) phase = 'aftermath';
    return {
        ...raid,
        phase,
        dayNumber: phase === 'active' ? daysBetween(raid.start, today) + 1 : 0,
        daysToStart: Math.max(0, daysBetween(today, raid.start)),
        daysLeft: phase === 'active' ? daysBetween(today, raid.end) : 0
    };
}

/** The raid with this id ("winter_2026"), or null. */
export function raidById(raidId, options = {}) {
    const m = String(raidId || '').match(/^([a-z]+)_(\d{4})$/);
    if (!m) return null;
    return raidWindow(m[1], Number(m[2]), options);
}

/**
 * The raid week a day falls in: { raid, dayNumber (1 to 7), first, last }, or null.
 * The Calendar marks these days.
 */
export function raidDayOf(date, options = {}) {
    const day = startOfDay(date);
    const year = schoolStartYear(day);
    for (const raid of [year - 1, year].flatMap((y) => RAID_SEASONS.map((s) => raidWindow(s.id, y, options)))) {
        if (!raid || day < raid.start || day > raid.end) continue;
        const dayNumber = daysBetween(raid.start, day) + 1;
        return { raid, dayNumber, first: dayNumber === 1, last: dayNumber === RAID_LENGTH_DAYS };
    }
    return null;
}

/** Raids whose week touches the given month (month 0 to 11). */
export function raidsInMonth(year, month, options = {}) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = schoolStartYear(first);
    return [start - 1, start]
        .flatMap((y) => RAID_SEASONS.map((s) => raidWindow(s.id, y, options)))
        .filter((raid) => raid && raid.start <= last && raid.end >= first);
}

/** The next raid after `now` (for "the Guardian returns ..." lines). */
export function nextRaid(now = new Date(), options = {}) {
    const today = startOfDay(now);
    return [schoolStartYear(today), schoolStartYear(today) + 1]
        .flatMap((year) => RAID_SEASONS.map((season) => raidWindow(season.id, year, options)))
        .filter((raid) => raid && raid.heraldFrom > today)
        .sort((a, b) => a.start - b.start)[0] || null;
}

export function raidDays(raid) {
    return Array.from({ length: RAID_LENGTH_DAYS }, (_, i) => addDays(raid.start, i));
}

// ─── Shares ─────────────────────────────────────────────────────────────────

const half = (n) => Math.round(n * 2) / 2;

/** Stars one hero is expected to earn in one lesson, from the class's Team Quest pace. */
export function lessonPace(classData) {
    const difficulty = Math.max(0, Number(classData?.difficultyLevel) || 0);
    const perMonth = QUEST_BASE_GOAL + difficulty * QUEST_DIFFICULTY_STEP;
    const lessonsPerWeek = Math.max(1, Array.isArray(classData?.scheduleDays) ? new Set(classData.scheduleDays).size : 1);
    return perMonth / (lessonsPerWeek * WEEKS_PER_MONTH);
}

/**
 * One shard per class. `meets(classId, date)` says whether a class has a lesson that day
 * (holidays and cancelled lessons included). Classes with no heroes or no raid lessons get no
 * shard; their stars still help.
 */
export function computeShares({ raid, classes = [], heroCounts = {}, meets = () => false }) {
    const days = raidDays(raid);
    return classes.map((classData) => {
        const heroes = Number(heroCounts[classData.id]) || 0;
        const lessonDates = days.filter((d) => meets(classData.id, d)).map(dayKey);
        const pace = lessonPace(classData);
        const share = heroes > 0 && lessonDates.length
            ? Math.max(1, Math.round(heroes * lessonDates.length * pace * RAID_EFFORT))
            : 0;
        return { classId: classData.id, heroes, lessonDates, pace, share };
    });
}

/**
 * The raid's rounds: one per day of the week, each as big as the lessons held that day. A class's
 * shard is split evenly over its own lesson days, so a day with one small class is a small round
 * and a day with no lessons is a rest. The rounds always add up to the whole shield.
 * `shares` are computeShares rows; `byDay` the stars dealt per day (tallyRaidStars). Returns
 * [{ n, key, date, plan, dealt, weight, classes, heroes, rest, cleared }].
 */
export function raidDayPlan(raid, shares = [], byDay = {}) {
    const days = raidDays(raid);
    const total = shares.reduce((sum, s) => sum + (Number(s.share) || 0), 0);
    return days.map((date, i) => {
        const key = dayKey(date);
        let plan = 0;
        let heroes = 0;
        const classes = [];
        shares.forEach((s) => {
            const dates = s.lessonDates || [];
            if (!(s.share > 0) || !dates.includes(key)) return;
            plan += s.share / dates.length;
            heroes += Number(s.heroes) || 0;
            classes.push(s.classId);
        });
        plan = half(plan);
        const dealt = Number(byDay[key]) || 0;
        return { n: i + 1, key, date, plan, dealt, weight: total > 0 ? plan / total : 0, classes, heroes, rest: plan <= 0, cleared: plan > 0 && dealt >= plan };
    });
}

// ─── Damage ─────────────────────────────────────────────────────────────────

/**
 * Stars each class and hero earned in the raid week. `credit(log)` is the star credit of one
 * award log (features/awardLogReasonMeta.js#getAwardLogMonthlyStarCredit). Negative logs are
 * ignored: the shield only ever takes hits.
 */
export function tallyRaidStars(logs = [], raid, { credit = (log) => Number(log?.stars) || 0 } = {}) {
    const from = startOfDay(raid.start);
    const to = startOfDay(raid.end);
    const byClass = {};
    const byHero = {};
    const byDay = {};
    const byDayClass = {};
    const byClassReason = {};
    const byDayClassReason = {};
    const seen = new Set();
    for (const log of logs) {
        if (!log?.classId || (log.id && seen.has(log.id))) continue;
        if (log.id) seen.add(log.id);
        const when = readDate(log.date) || readDate(log.createdAt);
        if (!when) continue;
        const day = startOfDay(when);
        if (day < from || day > to) continue;
        const stars = Number(credit(log)) || 0;
        if (!(stars > 0)) continue;
        byClass[log.classId] = (byClass[log.classId] || 0) + stars;
        const key = dayKey(day);
        byDay[key] = (byDay[key] || 0) + stars;
        byDayClass[key] = byDayClass[key] || {};
        byDayClass[key][log.classId] = (byDayClass[key][log.classId] || 0) + stars;
        const reason = String(log.reason || '');
        const mine = byClassReason[log.classId] || (byClassReason[log.classId] = {});
        mine[reason] = (mine[reason] || 0) + stars;
        const dayReasons = byDayClassReason[key] || (byDayClassReason[key] = {});
        const dayMine = dayReasons[log.classId] || (dayReasons[log.classId] = {});
        dayMine[reason] = (dayMine[reason] || 0) + stars;
        if (log.studentId) {
            const hero = byHero[log.studentId] || { studentId: log.studentId, classId: log.classId, stars: 0, days: new Set() };
            hero.stars += stars;
            hero.days.add(dayKey(day));
            byHero[log.studentId] = hero;
        }
    }
    Object.keys(byClass).forEach((id) => { byClass[id] = half(byClass[id]); });
    Object.keys(byDay).forEach((key) => { byDay[key] = half(byDay[key]); });
    Object.values(byDayClass).forEach((day) => Object.keys(day).forEach((id) => { day[id] = half(day[id]); }));
    Object.values(byClassReason).forEach((m) => Object.keys(m).forEach((r) => { m[r] = half(m[r]); }));
    return { byClass, byHero, byDay, byDayClass, byClassReason, byDayClassReason };
}

/**
 * The whole picture: shield size, stars dealt, each class's shard, and the outcome so far.
 * `locked` carries what the shared raid record already holds ({ brokenAt, legendaryAt }), so a
 * broken shield stays broken even if a late roster change makes the shield bigger.
 */
export function raidStatus({ shares = [], tally = { byClass: {} }, locked = {} }) {
    const hp = shares.reduce((sum, s) => sum + s.share, 0);
    const shareIds = new Set(shares.map((s) => s.classId));
    const dealt = half(Object.values(tally.byClass || {}).reduce((sum, n) => sum + n, 0));
    const classes = shares.map((s) => {
        const stars = Number(tally.byClass?.[s.classId]) || 0;
        const pct = s.share > 0 ? stars / s.share : 0;
        return { ...s, stars, pct, valor: s.share > 0 && stars >= s.share };
    });
    // Classes without a shard this week (no lessons) still help.
    const helpers = Object.entries(tally.byClass || {})
        .filter(([id, stars]) => !shareIds.has(id) && stars > 0)
        .map(([classId, stars]) => ({ classId, heroes: 0, lessonDates: [], pace: 0, share: 0, stars, pct: 0, valor: false, helper: true }));
    const pct = hp > 0 ? dealt / hp : 0;
    const broken = Boolean(locked.brokenAt) || (hp > 0 && dealt >= hp);
    const legendary = Boolean(locked.legendaryAt) || (hp > 0 && dealt >= hp * LEGENDARY_AT);
    return { hp, dealt, pct, broken, legendary, legendaryAt: Math.ceil(hp * LEGENDARY_AT), classes: [...classes, ...helpers] };
}

// ─── Rewards ────────────────────────────────────────────────────────────────

/** Team Quest bonus stars that move a class the same step along its own map. */
export function questStepStars(monthlyGoal, step) {
    const goal = Number(monthlyGoal) || 0;
    if (!(goal > 0) || !(step > 0)) return 0;
    return Math.max(1, half(goal * step));
}

/**
 * Everything a class is owed, compared with what its receipt says was already paid.
 * Returns the parts still to pay: { valor, victory, legendary, hero } (true/false each).
 * The Raid Hero waits until the class's raid lessons are over (or the raid has ended), so a
 * class that meets late in the week is not judged on an empty roll.
 */
export function owedRaidRewards({ status, classRow, receipt = {}, today = new Date(), raid }) {
    const paid = receipt || {};
    const phaseOver = startOfDay(today) > startOfDay(raid.end);
    const lastLesson = classRow?.lessonDates?.length ? classRow.lessonDates[classRow.lessonDates.length - 1] : null;
    const lessonsOver = phaseOver || (lastLesson ? dayKey(today) >= lastLesson : true);
    const inWindow = startOfDay(today) >= startOfDay(raid.start);
    return {
        valor: inWindow && Boolean(classRow?.valor) && !paid.valorAt,
        victory: inWindow && Boolean(status?.broken) && !paid.victoryAt,
        legendary: inWindow && Boolean(status?.legendary) && !paid.legendaryAt,
        heroReady: Boolean(status?.broken) && lessonsOver && !paid.hero
    };
}

/**
 * The Raid Hero: the hero who struck the shield in the most raid lessons, then the most stars,
 * then the fewest Raid Hero prizes so far. A remaining tie is settled by `random`.
 */
export function pickRaidHero(heroTallies = [], { pastWins = {}, random = Math.random } = {}) {
    const ranked = heroTallies
        .filter((hero) => hero && hero.stars > 0)
        .map((hero) => ({
            hero,
            days: hero.days instanceof Set ? hero.days.size : Number(hero.days) || 0,
            wins: Number(pastWins[hero.studentId]) || 0,
            roll: random()
        }))
        .sort((a, b) => (b.days - a.days) || (b.hero.stars - a.hero.stars) || (a.wins - b.wins) || (a.roll - b.roll));
    return ranked[0]?.hero || null;
}

/** How many Raid Hero prizes each hero of a class has won before, from the class's receipts. */
export function countRaidHeroWins(realmRaids = {}) {
    const wins = {};
    Object.values(realmRaids || {}).forEach((receipt) => {
        const id = receipt?.hero?.studentId;
        if (id) wins[id] = (wins[id] || 0) + 1;
    });
    return wins;
}

/** The Gold every hero of a class gets for each part (for the hall and the notices). */
export function goldFor(part) {
    if (part === 'valor') return RAID_REWARDS.valorGold;
    if (part === 'victory') return RAID_REWARDS.victoryGold;
    if (part === 'legendary') return RAID_REWARDS.legendaryGold;
    return 0;
}

/** The Guardian's mood from how much of the shield is gone (drives the pose). */
export function guardianMood(status) {
    if (status?.broken) return 'bow';
    const pct = Number(status?.pct) || 0;
    if (pct >= 0.75) return 'strain';
    if (pct >= 0.4) return 'brace';
    return 'proud';
}

/** Short countdown words for a raid, for pills and cards. */
export function raidCountdown(raid) {
    if (!raid) return '';
    if (raid.phase === 'herald') return raid.daysToStart === 1 ? 'arrives tomorrow' : `arrives in ${raid.daysToStart} days`;
    if (raid.phase === 'active') {
        if (raid.daysLeft === 0) return 'last day!';
        return raid.daysLeft === 1 ? '1 day left' : `${raid.daysLeft} days left`;
    }
    return 'the raid is over';
}

/** The outcome words for a finished raid, from a class receipt map or a status. */
export function raidOutcome({ status = null, receipts = [] } = {}) {
    if (status?.legendary || receipts.some((r) => r?.legendaryAt)) return 'legendary';
    if (status?.broken || receipts.some((r) => r?.victoryAt)) return 'won';
    return 'held';
}
