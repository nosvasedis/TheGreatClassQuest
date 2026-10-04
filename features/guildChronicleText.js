// features/guildChronicleText.js — pure helpers for the Chapter chronicles: the facts of a
// sealed Chapter, the herald's record, and the Chronicler's AI prompt and its parser.
// No Firebase here, so tests can load it.

import { GUILDS, GUILD_IDS } from './guilds.js';
import { chapterName, guildChapterBook, parseChapterKey, roundTo } from './guildScoringCore.js';

const SEASON_TOUCH = {
    9: 'the first leaves of autumn', 10: 'the October storms', 11: 'the grey November rains', 12: 'the winter frost',
    1: 'the snows of the new year', 2: 'the short February days', 3: 'the March winds', 4: 'the April showers',
    5: 'the May blossoms', 6: 'the long June light', 7: 'the summer heat', 8: 'the summer heat',
};

function hash(seed = '') {
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
const pick = (list, seed) => list[hash(seed) % list.length];
const num = (n) => { const r = roundTo(Number(n) || 0, 1); return Number.isInteger(r) ? String(r) : r.toFixed(1); };
function joinNames(names = []) {
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Sealed Chapter keys of a school year, oldest first. */
export function sealedChapterKeys(allGuildScores = {}, schoolYearKey, firstKey = null) {
    const keys = new Set();
    for (const gid of GUILD_IDS) {
        const { sealed } = guildChapterBook(allGuildScores[gid] || {}, schoolYearKey);
        Object.keys(sealed).forEach((k) => { if (!firstKey || k >= firstKey) keys.add(k); });
    }
    return [...keys].sort();
}

/** The stored AI chronicle of a Chapter, if any guild doc carries it. */
export function storedChronicle(allGuildScores = {}, key) {
    for (const gid of GUILD_IDS) {
        const rec = allGuildScores[gid]?.chronicles?.[key];
        if (Array.isArray(rec?.lines) && rec.lines.length) return rec;
    }
    return null;
}

/**
 * The facts of one sealed Chapter: each guild's place, Crowns, Unity Seal, Glory per member and
 * brightest member, plus the Crown Race standing once it was sealed.
 */
export function chapterFacts(allGuildScores = {}, key, { schoolYearKey, students = [], firstKey = null } = {}) {
    const studentName = new Map(students.map((s) => [s.id, s.name]));
    const guilds = GUILD_IDS.map((gid) => {
        const book = guildChapterBook(allGuildScores[gid] || {}, schoolYearKey);
        const rec = book.sealed[key];
        if (!rec) return null;
        const members = book.chapters[key]?.members || {};
        const star = Object.entries(members)
            .filter(([id, g]) => studentName.has(id) && Number(g) > 0)
            .sort((a, b) => Number(b[1]) - Number(a[1]) || String(studentName.get(a[0])).localeCompare(String(studentName.get(b[0]))))[0];
        const crownsSoFar = Object.entries(book.sealed)
            .filter(([k]) => k <= key && (!firstKey || k >= firstKey))
            .reduce((sum, [, c]) => sum + (Number(c.crowns) || 0), 0);
        return {
            guildId: gid,
            name: GUILDS[gid]?.name || gid,
            motto: GUILDS[gid]?.motto || '',
            place: Number(rec.place) || 0,
            crowns: Number(rec.crowns) || 0,
            unity: Boolean(rec.unity),
            perMember: roundTo(Number(rec.perMember) || 0, 1),
            memberCount: Number(rec.memberCount) || 0,
            brightest: star ? studentName.get(star[0]) : null,
            crownsSoFar,
        };
    }).filter(Boolean).sort((a, b) => (a.place || 9) - (b.place || 9) || a.name.localeCompare(b.name));
    const standing = [...guilds].sort((a, b) => b.crownsSoFar - a.crownsSoFar || (a.place || 9) - (b.place || 9));
    return { key, month: chapterName(key), monthNumber: parseChapterKey(key)?.month || 0, guilds, standing };
}

/** The herald's record: four lines built from the results, always available. */
export function heraldChronicleLines(facts) {
    const { key, month, guilds, standing } = facts;
    const placed = guilds.filter((g) => g.place > 0);
    if (!placed.length) return [`${month} passed quietly.`, 'No guild earned Glory this Chapter.', 'The banners waited in the hall.', 'The road goes on.'];
    const winners = placed.filter((g) => g.place === 1);
    const others = placed.filter((g) => g.place > 1);
    const season = SEASON_TOUCH[facts.monthNumber] || 'the passing weeks';
    const line1 = winners.length > 1
        ? `Through ${season}, ${joinNames(winners.map((g) => g.name))} shared the ${month} Chapter.`
        : pick([
            `Through ${season}, ${winners[0].name} won the ${month} Chapter.`,
            `${winners[0].name} rode through ${season} and took the ${month} Chapter.`,
            `In ${month}, through ${season}, the crown went to ${winners[0].name}.`,
        ], `${key}:1`);
    const line2 = winners[0].brightest
        ? `${winners[0].brightest} shone brightest, and ${winners[0].name} earned ${num(winners[0].perMember)} Glory for every member.`
        : `${winners[0].name} earned ${num(winners[0].perMember)} Glory for every member.`;
    const sealed = placed.filter((g) => g.unity);
    const line3 = sealed.length
        ? pick([
            `${joinNames(sealed.map((g) => g.name))} stood as one and won the Unity Seal.`,
            `The Unity Seal was pressed for ${joinNames(sealed.map((g) => g.name))}: nearly every member helped.`,
        ], `${key}:3`)
        : others.length
            ? `${joinNames(others.map((g) => g.name))} pushed hard and will rise again.`
            : 'Every guild gave its best.';
    const top = standing[0];
    const level = standing.filter((g) => g.crownsSoFar === top.crownsSoFar);
    const line4 = level.length > 1
        ? `After ${month}, ${joinNames(level.map((g) => g.name))} are level with ${top.crownsSoFar} Crowns.`
        : `After ${month}, ${top.name} lead the Crown Race with ${top.crownsSoFar} Crown${top.crownsSoFar === 1 ? '' : 's'}.`;
    return [line1, line2, line3, line4];
}

// ─── The Chronicler (Elite AI) ───────────────────────────────────────────────

export function chroniclerPrompt(facts) {
    const rows = facts.guilds.map((g) => `- ${g.name} (motto "${g.motto}"): ${g.place ? `place ${g.place}` : 'no Glory'}, ${g.crowns} Crowns, ${g.perMember} Glory per member${g.unity ? ', won the Unity Seal' : ''}${g.brightest ? `, brightest member ${g.brightest}` : ''}. Crowns so far this year: ${g.crownsSoFar}.`).join('\n');
    const system = 'You are the Chronicler of a school guild competition for children learning English (ages 8 to 16). You write like a medieval herald: warm, vivid, never mocking a guild that lost. Use simple English. No markdown.';
    const user = `Write the chronicle of the ${facts.month} Chapter of the Crown Race in exactly four lines, each at most 16 words.
Line 1: who won the Chapter, with a touch of the season (${SEASON_TOUCH[facts.monthNumber] || 'the month'}).
Line 2: a proud detail about the winners (their brightest member or their Glory).
Line 3: the other guilds, kindly (the Unity Seal if anyone won it).
Line 4: where the Crown Race stands now.
Results:
${rows}
Answer only with a JSON array of four strings.`;
    return { system, user };
}

export function parseChroniclerLines(text) {
    let lines = null;
    try {
        const cleaned = String(text || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start >= 0 && end > start) lines = JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) { lines = null; }
    if (!Array.isArray(lines)) lines = String(text || '').split(/\n+/).map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
    lines = lines.map((l) => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (lines.length < 4 || lines.slice(0, 4).some((l) => l.length > 160)) return null;
    return lines.slice(0, 4);
}
