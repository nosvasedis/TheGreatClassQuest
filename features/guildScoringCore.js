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

    return {
        starDelta: safeStarDelta,
        baseGlory: roundTo(starGlory, 2),
        modifierGlory: roundTo(bannerGlory, 2),
        directGlory: roundTo(safeDirectGlory, 2),
        totalGloryDelta: roundTo(starGlory + bannerGlory + safeDirectGlory, 2),
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
    const unityCount = memberIds.filter((id) => (Number(members[id]) || 0) >= UNITY_SEAL.minGlory - 1e-9).length;
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
