// features/grandCeremonyCore.mjs — pure maths for the Grand Guild Ceremony (end of year).
// No state and no DOM, so tests and the preview page use exactly what the ceremony uses.
//
//   finalCrownStandings  the Crown Race as the ceremony crowns it: every Chapter of the year
//                        (sealed, or ranked as it stands when it was never sealed, June included)
//   wheelYearSummary     Fortune's Wheel over the whole year, for the Wonders chapter
//   raidYearSummary      Realm Raids the classes won, from their receipts

import {
    CHAPTER_CROWNS,
    chapterKeyFor,
    chapterShortName,
    chapterTally,
    compareCrownRaceRows,
    countedGuildGlory,
    guildChapterBook,
    rankChapter,
    roundTo,
    schoolYearChapterKeys,
} from './guildScoringCore.js';

/** The Chapters of the year the race counts, from `firstKey` up to the Chapter holding `now`. */
export function ceremonyChapterKeys(allGuildScores = {}, schoolYearKey, { firstKey = null, now = new Date() } = {}) {
    const current = chapterKeyFor(now);
    const keys = new Set(schoolYearChapterKeys(schoolYearKey).filter((k) => k <= current));
    Object.values(allGuildScores || {}).forEach((g) => {
        const book = guildChapterBook(g || {}, schoolYearKey);
        Object.keys(book.sealed).forEach((k) => keys.add(k));
        Object.keys(book.chapters).filter((k) => k <= current).forEach((k) => keys.add(k));
    });
    return [...keys].filter((k) => !firstKey || k >= firstKey).sort();
}

/**
 * Final standings of the Crown Race. A Chapter sealed on a guild keeps its sealed record; one
 * nobody sealed (the June Chapter tonight, or a month no teacher app sealed) is ranked as it
 * stands from the guilds' Chapter tallies. Guilds with no members are left out.
 *
 * Returns rows in final order: { guildId, memberCount, crowns, chapters: [{ key, month, place,
 * crowns, unity, provisional }], chapterWins, unitySeals, yearGloryPerMember, rank, tieBreak }.
 * `tieBreak` is true when the row above or below has the same Crowns (the year's Glory decided).
 */
export function finalCrownStandings({ allGuildScores = {}, membersByGuild = {}, guildIds = [], schoolYearKey, firstKey = null, now = new Date() } = {}) {
    const ids = guildIds.length ? guildIds : Object.keys(membersByGuild);
    const books = Object.fromEntries(ids.map((gid) => [gid, guildChapterBook(allGuildScores[gid] || {}, schoolYearKey)]));
    const keys = ceremonyChapterKeys(Object.fromEntries(ids.map((gid) => [gid, allGuildScores[gid] || {}])), schoolYearKey, { firstKey, now });

    const perKey = {};
    keys.forEach((key) => {
        const sealedSomewhere = ids.some((gid) => books[gid].sealed[key]);
        if (sealedSomewhere) {
            perKey[key] = Object.fromEntries(ids.map((gid) => {
                const rec = books[gid].sealed[key];
                return [gid, rec
                    ? { place: rec.place ?? null, crowns: Number(rec.crowns) || 0, unity: Boolean(rec.unity), provisional: false }
                    : { place: null, crowns: 0, unity: false, provisional: false }];
            }));
            return;
        }
        const tallies = Object.fromEntries(ids.map((gid) => [gid, chapterTally(books[gid].chapters[key] || {}, membersByGuild[gid] || [])]));
        const ranked = rankChapter(tallies);
        perKey[key] = Object.fromEntries(ids.map((gid) => [gid, {
            place: ranked[gid]?.place ?? null,
            crowns: Number(ranked[gid]?.crowns) || 0,
            unity: Boolean(ranked[gid]?.unity),
            provisional: true,
        }]));
    });

    const rows = ids
        .map((gid) => {
            const memberIds = membersByGuild[gid] || [];
            const memberCount = memberIds.length;
            const chapters = keys.map((key) => ({ key, month: chapterShortName(key), ...perKey[key][gid] }));
            const { countedGlory } = countedGuildGlory(allGuildScores[gid] || {}, memberIds);
            return {
                guildId: gid,
                memberCount,
                crowns: chapters.reduce((sum, c) => sum + c.crowns, 0),
                chapters,
                chapterWins: chapters.filter((c) => c.place === 1).map((c) => c.key),
                unitySeals: chapters.filter((c) => c.unity).length,
                yearGloryPerMember: memberCount > 0 ? roundTo(countedGlory / memberCount, 1) : 0,
                guildName: gid,
            };
        })
        .filter((row) => row.memberCount > 0)
        .sort(compareCrownRaceRows);
    return rows.map((row, i) => ({
        ...row,
        rank: i + 1,
        tieBreak: [rows[i - 1], rows[i + 1]].some((other) => other && other.crowns === row.crowns),
    }));
}

/** The largest Crowns a single Chapter can pay (place + Unity Seal), for scaling bars. */
export const MAX_CHAPTER_CROWNS = CHAPTER_CROWNS[0] + 1;

const RARITY_RANK = { storm: 0, cursed: 0, envoy: 0, twist: 1, common: 1, trial: 2, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, omen: 6 };

/** Glory a spin moved, per guild (newer spins record every guild they touched). */
export function spinGloryByGuild(result) {
    if (result?.gloryByGuild && typeof result.gloryByGuild === 'object') return result.gloryByGuild;
    return result?.guildId ? { [result.guildId]: Number(result.gloryDelta) || 0 } : {};
}

/**
 * Fortune's Wheel across the year for some classes: spins (one per guild turn), Omens seen,
 * storms braved, the luckiest guild by Glory the Wheel moved, and the rarest find.
 */
export function wheelYearSummary(entries = [], classIds = []) {
    const classSet = new Set(classIds);
    const mine = (entries || []).filter((e) => !classSet.size || classSet.has(e?.classId));
    const glory = {};
    let spins = 0;
    let omens = 0;
    let braved = 0;
    let envoys = 0;
    let rarest = null;
    mine.forEach((entry) => (entry.results || []).forEach((r) => {
        if (!r) return;
        spins += 1;
        if (r.rarity === 'omen') omens += 1;
        if (r.braved) braved += 1;
        if (r.envoy) envoys += 1;
        Object.entries(spinGloryByGuild(r)).forEach(([gid, n]) => { glory[gid] = roundTo((glory[gid] || 0) + (Number(n) || 0), 2); });
        const rank = (x) => (RARITY_RANK[x?.rarity] ?? 1) * 1000 + (Number(x?.gloryDelta) || 0);
        if (r.guildId && !r.envoy && (!rarest || rank(r) > rank(rarest))) rarest = r;
    }));
    const lucky = Object.entries(glory).sort(([, a], [, b]) => b - a)[0];
    return {
        wheelDays: mine.length,
        totalSpins: spins,
        omens,
        braved,
        envoys,
        gloryByGuild: glory,
        luckiestGuild: lucky && lucky[1] > 0 ? { guildId: lucky[0], totalGlory: lucky[1] } : null,
        rarestFind: rarest && (RARITY_RANK[rarest.rarity] ?? 1) >= 3
            ? { guildId: rarest.guildId, label: String(rarest.segmentLabel || ''), rarity: rarest.rarity }
            : null,
    };
}

/** Realm Raids won by the classes (a raid counts once however many classes struck it). */
export function raidYearSummary(classes = []) {
    const won = new Set();
    const legendary = new Set();
    const heroes = [];
    (classes || []).forEach((c) => Object.entries(c?.realmRaids || {}).forEach(([raidId, receipt]) => {
        if (receipt?.victoryAt) won.add(raidId);
        if (receipt?.legendaryAt) legendary.add(raidId);
        if (receipt?.hero?.name) heroes.push({ name: receipt.hero.name, studentId: receipt.hero.studentId || null, classId: c.id });
    }));
    return { victories: won.size, legendary: legendary.size, raidHeroes: heroes };
}
