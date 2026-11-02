// /features/guildScoringCore.js — pure math for the Crown Race (Glory, Chapters, Crowns)
//
// Glory ⚜️  — what a guild's members earn (2 per star, plus Quiz, Wheel and Market gifts).
// Chapter  — one school month. Guilds race on Glory per member that month.
// Crowns 👑 — what a sealed Chapter pays by place. Most Crowns in June wins the year.

/** Crowns a sealed Chapter pays for 1st, 2nd, 3rd and 4th place. */
export const CHAPTER_CROWNS = [5, 3, 2, 1];

/** Unity Seal: +1 Crown when at least 4 in 5 members earned 6 Glory (3 stars) in the Chapter. */
export const UNITY_SEAL = { share: 0.8, minGlory: 6, crowns: 1 };

/** Months shown on the Crown Road, from the school year's September. */
export const SCHOOL_YEAR_CHAPTER_MONTHS = 10;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function roundTo(value, places = 1) {
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
}

export function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

// ─── Chapter keys ────────────────────────────────────────────────────────────

/** Chapter key for the local month holding `d`, e.g. "m2026_10" (safe as a Firestore field name). */
export function chapterKeyFor(d = new Date()) {
    const date = new Date(d);
    return `m${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** "m2026_10" ← "2026-10" (also accepts a key that is already a chapter key). */
export function chapterKeyFromMonthKey(monthKey = '') {
    const s = String(monthKey || '');
    if (/^m\d{4}_\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{4})-(\d{2})/);
    return m ? `m${m[1]}_${m[2]}` : null;
}

/** { year, month (1-12) } for a chapter key. */
export function parseChapterKey(key = '') {
    const m = String(key || '').match(/^m(\d{4})_(\d{2})$/);
    return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function chapterName(key) {
    const p = parseChapterKey(key);
    return p ? MONTH_NAMES[p.month - 1] : '';
}

export function chapterShortName(key) {
    return chapterName(key).slice(0, 3);
}

/** Chapter keys of a school year ("2026-2027" → m2026_09 … m2027_06). */
export function schoolYearChapterKeys(schoolYearKey, months = SCHOOL_YEAR_CHAPTER_MONTHS) {
    const m = String(schoolYearKey || '').match(/^(\d{4})-\d{4}$/);
    if (!m) return [];
    const keys = [];
    for (let i = 0; i < months; i += 1) keys.push(chapterKeyFor(new Date(Number(m[1]), 8 + i, 1)));
    return keys;
}

/** Days left in the Chapter holding `now`, today included. */
export function chapterDaysLeft(now = new Date()) {
    const d = new Date(now);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return last - d.getDate() + 1;
}

// ─── Glory deltas ────────────────────────────────────────────────────────────

/**
 * Glory for a star change: 2 per star, plus +1 per star while the student's Banner of Glory
 * has charges. A star taken back costs only its plain Glory.
 */
export function calculateGuildGloryDelta({
    starDelta = 0,
    directGlory = 0,
    scoreData = {},
    gloryPerStar = 2,
    tailwindPct = 0,
} = {}) {
    const safeStarDelta = Number(starDelta) || 0;
    const safeDirectGlory = Number(directGlory) || 0;
    const breakdown = [];

    const starGlory = safeStarDelta * gloryPerStar;
    if (safeStarDelta !== 0) {
        breakdown.push({ type: 'base_star_glory', amount: starGlory, detail: `${gloryPerStar} Glory per star` });
    }

    let bannerGlory = 0;
    if (safeStarDelta > 0 && Number(scoreData?.gloryBannerCharges) > 0) {
        bannerGlory = Math.min(safeStarDelta, Number(scoreData.gloryBannerCharges) || 0);
        breakdown.push({ type: 'banner_of_glory', amount: bannerGlory, detail: '+1 Glory per awarded star' });
    }

    if (safeDirectGlory) {
        breakdown.push({ type: 'direct_glory', amount: safeDirectGlory, detail: 'Direct Guild Glory event' });
    }

    // The Tailwind: a share more on what was gained (a loss is never made bigger).
    const windGlory = tailwindGlory(Math.max(0, starGlory) + bannerGlory + Math.max(0, safeDirectGlory), tailwindPct);
    if (windGlory) {
        breakdown.push({ type: 'tailwind', amount: windGlory, detail: `Tailwind +${Math.round(tailwindPct * 100)}%` });
    }

    return {
        starDelta: safeStarDelta,
        baseGlory: roundTo(starGlory, 2),
        modifierGlory: roundTo(bannerGlory, 2),
        directGlory: roundTo(safeDirectGlory, 2),
        windGlory,
        totalGloryDelta: roundTo(starGlory + bannerGlory + safeDirectGlory + windGlory, 2),
        breakdown,
    };
}

/** A Glory change of an exact size: takes back precisely what an award gave, or corrects leftovers. */
export function exactGuildGloryDelta({ starDelta = 0, glory = 0 } = {}) {
    const amount = roundTo(Number(glory) || 0, 2);
    return {
        starDelta: Number(starDelta) || 0,
        baseGlory: amount,
        modifierGlory: 0,
        directGlory: 0,
        windGlory: 0,
        totalGloryDelta: amount,
        breakdown: [{ type: 'exact_glory', amount, detail: 'Exact Glory change' }],
    };
}

// ─── Year Glory (the tie-breaker) ────────────────────────────────────────────

/**
 * Glory a guild counts for the year: everything it earned this year, minus what members who
 * have since left earned. `memberGlory` is only trusted for the year it was built for.
 */
export function countedGuildGlory(guildData = {}, currentMemberIds = []) {
    const totalGlory = Number(guildData?.totalGlory) || 0;
    const map = guildData?.memberGlory;
    if (!map || typeof map !== 'object' || !guildData.memberGloryYear ||
        guildData.memberGloryYear !== guildData.activeSchoolYearKey) {
        return { countedGlory: totalGlory, leaversGlory: 0, memberGloryReady: false };
    }
    const current = new Set(currentMemberIds);
    let leaversGlory = 0;
    for (const [studentId, glory] of Object.entries(map)) {
        if (!current.has(studentId)) leaversGlory += Number(glory) || 0;
    }
    return { countedGlory: totalGlory - leaversGlory, leaversGlory, memberGloryReady: true };
}

/**
 * Members holding Glory for stars they no longer have (a current member with no stars this year
 * cannot have earned star Glory). Returns corrections that bring each back to 0.
 */
export function findOrphanMemberGlory(guildData = {}, memberIds = [], starsByStudent = {}) {
    const { memberGloryReady } = countedGuildGlory(guildData, memberIds);
    if (!memberGloryReady) return [];
    const map = guildData.memberGlory || {};
    return memberIds
        .filter((id) => Math.abs(Number(map[id]) || 0) > 0.001 && !(Number(starsByStudent[id]) > 0))
        .map((id) => ({ studentId: id, glory: roundTo(-(Number(map[id]) || 0), 2) }));
}

// ─── Chapters ────────────────────────────────────────────────────────────────

/** True when a Chapter key falls inside a school year ("2026-2027" → m2026_09 … m2027_08). */
export function isChapterOfSchoolYear(key, schoolYearKey) {
    const m = String(schoolYearKey || '').match(/^(\d{4})-\d{4}$/);
    if (!m || !parseChapterKey(key)) return false;
    const start = Number(m[1]);
    return key >= `m${start}_09` && key <= `m${start + 1}_08`;
}

function _pickYear(map, schoolYearKey) {
    if (!map || typeof map !== 'object') return {};
    return Object.fromEntries(Object.entries(map).filter(([k]) => isChapterOfSchoolYear(k, schoolYearKey)));
}

/**
 * The guild's Chapter records for a school year. Keys are calendar months, so another
 * year's Chapters never mix in; they are simply left out.
 */
export function guildChapterBook(guildData = {}, schoolYearKey = guildData?.activeSchoolYearKey) {
    return {
        chapters: _pickYear(guildData?.chapters, schoolYearKey),
        sealed: _pickYear(guildData?.sealedChapters, schoolYearKey),
    };
}

/** True when a member's Chapter Glory reaches the Unity Seal line (6 Glory). */
export function isUnityReady(glory) {
    return (Number(glory) || 0) >= UNITY_SEAL.minGlory - 1e-9;
}

/**
 * The one way every screen reads Unity Seal progress from a chapterTally():
 * `ready` of `members` have 6 Glory; `needed` of them (4 in 5) seal it.
 */
export function unityProgress(tally = {}) {
    const members = Math.max(0, Number(tally.memberCount) || 0);
    const ready = Math.min(members, Math.max(0, Number(tally.unityCount) || 0));
    const needed = members > 0 ? Math.max(1, Number(tally.unityNeeded) || Math.ceil(members * UNITY_SEAL.share - 1e-9)) : 0;
    return { ready, members, needed, missing: Math.max(0, needed - ready), fill: needed > 0 ? Math.min(1, ready / needed) : 0 };
}

/** Short Unity progress words shared by the Hall, the guild banner and the Spotlight. */
export function unityProgressLabel(progress = {}) {
    const { ready = 0, members = 0, needed = 0, missing = 0 } = progress;
    if (!members) return 'No members yet';
    return `${ready} of ${members} ready · ${missing ? `${needed} needed` : 'enough to seal'}`;
}

/**
 * One guild's live Chapter: Glory its current members earned in it, shared per member, and
 * how many members already have the Unity Seal's 6 Glory. Leavers' Glory leaves with them.
 */
export function chapterTally(chapter = {}, memberIds = []) {
    const members = chapter?.members && typeof chapter.members === 'object' ? chapter.members : {};
    const current = new Set(memberIds);
    let leaversGlory = 0;
    for (const [id, glory] of Object.entries(members)) {
        if (!current.has(id)) leaversGlory += Number(glory) || 0;
    }
    const glory = Math.max(0, roundTo((Number(chapter?.glory) || 0) - leaversGlory, 2));
    const memberCount = memberIds.length;
    const unityCount = memberIds.filter((id) => isUnityReady(members[id])).length;
    const contributors = memberIds.filter((id) => (Number(members[id]) || 0) > 0.001).length;
    return {
        glory,
        memberCount,
        perMember: memberCount > 0 ? glory / memberCount : 0,
        unityCount,
        unityNeeded: Math.ceil(memberCount * UNITY_SEAL.share - 1e-9),
        unity: memberCount > 0 && glory > 0 && unityCount >= Math.ceil(memberCount * UNITY_SEAL.share - 1e-9),
        contributors,
    };
}

/**
 * Places and Crowns for one Chapter. `tallies` maps guildId → chapterTally().
 * Guilds that tie share the higher place; a guild with no Glory has no place and no Crowns.
 */
export function rankChapter(tallies = {}) {
    const entries = Object.entries(tallies).map(([guildId, t]) => ({ guildId, ...t }));
    const scoring = entries.filter((e) => e.perMember > 0.0001).sort((a, b) => b.perMember - a.perMember);
    const result = {};
    scoring.forEach((e, i) => {
        let place = i;
        while (place > 0 && Math.abs(scoring[place - 1].perMember - e.perMember) < 1e-6) place -= 1;
        const placeCrowns = CHAPTER_CROWNS[place] || 0;
        result[e.guildId] = { ...e, place: place + 1, placeCrowns, crowns: placeCrowns + (e.unity ? UNITY_SEAL.crowns : 0) };
    });
    entries.filter((e) => !(e.perMember > 0.0001)).forEach((e) => {
        result[e.guildId] = { ...e, place: null, placeCrowns: 0, crowns: 0, unity: false };
    });
    return result;
}

// ─── The Tailwind (catch-up for guilds the race has left behind) ─────────────

/**
 * Guilds are for life, so a guild that drew fewer star-collectors would trail all year. The
 * Tailwind gives such a guild a share more on every Glory its members earn (stars, Quiz, Wheel,
 * Market), sized by how far behind it is this year in stars per member:
 *   pct = closes × (leader's stars per member ÷ ours − 1), in 5% steps, at most `cap`.
 * `closes` (2/3) means it makes up about two thirds of the gap in earning speed and never all of
 * it, so the Tailwind alone can never carry a guild past one that earns more: the last third is
 * always effort. The leader, and anyone within a step of it, has calm air. Before the leader has
 * `minStars` stars per member this year, every guild has calm air.
 * Checked by simulation (8 classes, 4 guilds, 1500 school years, 2026-11-02): the strongest guild
 * won 75% of months with no wind and 51% with the Tailwind; all four guilds won a month in
 * 41% of years instead of 4%. The old Wheel-only wind did little unless every class spun weekly.
 */
export const TAILWIND = { closes: 2 / 3, cap: 0.3, step: 0.05, minStars: 5 };

/** The Tailwind's name for a share (0 → calm). */
export function tailwindLevel(pct = 0) {
    const p = Number(pct) || 0;
    if (p <= 0.0001) return { key: 'calm', name: 'Calm air', icon: '🍃' };
    if (p < 0.149) return { key: 'breeze', name: 'Breeze', icon: '🌬️' };
    if (p < 0.249) return { key: 'wind', name: 'Strong wind', icon: '🌬️' };
    return { key: 'gale', name: 'Gale', icon: '🌪️' };
}

/**
 * Tailwind for every guild from its stars per member this year: `{ [guildId]: { pct, ...level,
 * starsPerMember, leaderStarsPerMember } }`. Guilds with no members are left out of the race.
 */
export function tailwindsFor(starsPerMember = {}) {
    const racing = Object.entries(starsPerMember).filter(([, v]) => Number.isFinite(Number(v)) && v !== null);
    const best = Math.max(0, ...racing.map(([, v]) => Number(v) || 0));
    const out = {};
    for (const [guildId, v] of racing) {
        const mine = Math.max(0, Number(v) || 0);
        let pct = 0;
        if (best >= TAILWIND.minStars) {
            const raw = mine > 0 ? TAILWIND.closes * (best / mine - 1) : TAILWIND.cap;
            pct = Math.min(TAILWIND.cap, Math.round(raw / TAILWIND.step) * TAILWIND.step);
            pct = roundTo(pct, 2);
        }
        out[guildId] = { pct, ...tailwindLevel(pct), starsPerMember: roundTo(mine, 2), leaderStarsPerMember: roundTo(best, 2) };
    }
    return out;
}

/** The extra Glory the Tailwind adds to a gain (never to a loss). */
export function tailwindGlory(gain = 0, pct = 0) {
    const g = Number(gain) || 0;
    const p = Number(pct) || 0;
    return g > 0 && p > 0 ? roundTo(g * p, 2) : 0;
}

/**
 * Chapters that ended and still need sealing: keys some guild has data for, from `firstKey`
 * on, before the current Chapter, and not yet sealed on every guild.
 */
export function chaptersToSeal(allGuildScores = {}, schoolYearKey, now = new Date(), firstKey = null) {
    const current = chapterKeyFor(now);
    const books = Object.values(allGuildScores).map((g) => guildChapterBook(g, schoolYearKey));
    const keys = new Set();
    for (const book of books) Object.keys(book.chapters).forEach((k) => keys.add(k));
    for (const key of schoolYearChapterKeys(schoolYearKey)) if (key < current) keys.add(key);
    return [...keys]
        .filter((k) => parseChapterKey(k) && k < current && (!firstKey || k >= firstKey))
        .filter((k) => books.some((b) => !b.sealed[k]))
        .sort();
}

// ─── The Crown Race standings ────────────────────────────────────────────────

/**
 * Year order: most Crowns, then most Glory per member this year, then name.
 * `crowns` is the sealed total; the live Chapter only counts once it is sealed.
 */
export function compareCrownRaceRows(a = {}, b = {}) {
    return (Number(b.crowns) || 0) - (Number(a.crowns) || 0) ||
        (Number(b.yearGloryPerMember) || 0) - (Number(a.yearGloryPerMember) || 0) ||
        String(a.guildName || a.name || '').localeCompare(String(b.guildName || b.name || ''));
}

/** Final order at the Grand Guild Ceremony: the June Chapter is sealed as it stands. */
export function compareFinalCrownRows(a = {}, b = {}) {
    return compareCrownRaceRows(
        { ...a, crowns: (Number(a.crowns) || 0) + (Number(a.liveCrowns) || 0) },
        { ...b, crowns: (Number(b.crowns) || 0) + (Number(b.liveCrowns) || 0) },
    );
}

/** Shared places for a sorted list ("1st, 1st, 3rd") by a numeric score. */
export function sharedPlaces(rows = [], score = (r) => r.crowns) {
    return rows.map((row, i) => {
        let p = i;
        while (p > 0 && Math.abs((Number(score(rows[p - 1])) || 0) - (Number(score(row)) || 0)) < 1e-6) p -= 1;
        return p;
    });
}
