// features/guildChronicleCore.js — the Chronicler: four herald lines for every sealed
// Chapter of the Crown Race. On Elite the lines are written once by AI, from a teacher
// session, and stored on the guild docs (`chronicles.<chapterKey>`); everyone else, and
// any Chapter still waiting for its AI lines, gets the herald's own record built from
// the sealed results. Pure helpers live in guildChronicleText.js.

import { db, doc, runTransaction } from '../firebase.js';
import * as state from '../state.js';
import { GUILD_IDS } from './guilds.js';
import { chapterName, isChapterOfSchoolYear } from './guildScoringCore.js';
import { chapterFacts, chroniclerPrompt, heraldChronicleLines, parseChroniclerLines, sealedChapterKeys, storedChronicle } from './guildChronicleText.js';
import { getFirstCrownChapter } from './guildScoring.js';
import { isGameplaySeasonLiveFromAppState } from '../utils/schoolYear.js';

const PUBLIC = 'artifacts/great-class-quest/public/data';

/** The chronicle shown for a Chapter: the stored AI lines, else the herald's record. */
export function chronicleFor(allGuildScores, key, options) {
    const stored = storedChronicle(allGuildScores, key);
    if (stored) return { key, month: chapterName(key), lines: stored.lines.slice(0, 4).map(String), by: 'chronicler' };
    return { key, month: chapterName(key), lines: heraldChronicleLines(chapterFacts(allGuildScores, key, options)), by: 'herald' };
}

/** Every Chapter of the active school year, oldest first, with its chronicle. */
export function yearChronicles({ allGuildScores = state.get('allGuildScores') || {}, schoolYearKey = state.getActiveSchoolYearKey(), students = state.get('allStudents') || [] } = {}) {
    const firstKey = getFirstCrownChapter(schoolYearKey);
    return sealedChapterKeys(allGuildScores, schoolYearKey, firstKey)
        .map((key) => chronicleFor(allGuildScores, key, { schoolYearKey, students, firstKey }));
}

// ─── The Chronicler (Elite AI) ───────────────────────────────────────────────

let _writing = false;
const _triedThisVisit = new Set();

/**
 * Writes the AI chronicle of each sealed Chapter that has none (newest first, two per visit).
 * Teacher sessions on Elite only; the first writer wins, the others find it written.
 */
export async function ensureChapterChronicles() {
    if (_writing) return;
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    if (!isGameplaySeasonLiveFromAppState(state)) return;
    const { canUseFeature } = await import('../utils/subscription.js');
    if (!canUseFeature('eliteAI')) return;
    const allGuildScores = state.get('allGuildScores') || {};
    const schoolYearKey = state.getActiveSchoolYearKey();
    if (!schoolYearKey) return;
    const firstKey = getFirstCrownChapter(schoolYearKey);
    const missing = sealedChapterKeys(allGuildScores, schoolYearKey, firstKey)
        .filter((k) => isChapterOfSchoolYear(k, schoolYearKey) && !storedChronicle(allGuildScores, k) && !_triedThisVisit.has(k))
        .reverse()
        .slice(0, 2);
    if (!missing.length) return;
    _writing = true;
    try {
        const { callGeminiApi } = await import('../api.js');
        for (const key of missing) {
            _triedThisVisit.add(key);
            const facts = chapterFacts(allGuildScores, key, { schoolYearKey, students: state.get('allStudents') || [], firstKey });
            if (!facts.guilds.length) continue;
            const { system, user } = chroniclerPrompt(facts);
            const lines = parseChroniclerLines(await callGeminiApi(system, user).catch(() => null));
            if (!lines) continue;
            const refs = GUILD_IDS.map((gid) => doc(db, `${PUBLIC}/guild_scores`, gid));
            await runTransaction(db, async (tx) => {
                const snaps = [];
                for (const ref of refs) snaps.push(await tx.get(ref));
                if (snaps.some((s) => s.exists() && Array.isArray(s.data()?.chronicles?.[key]?.lines))) return;
                const record = { lines, by: 'chronicler', writtenAt: Date.now() };
                snaps.forEach((s, i) => { if (s.exists()) tx.update(refs[i], { [`chronicles.${key}`]: record }); });
            });
        }
    } catch (err) {
        console.warn('Chapter chronicle skipped:', err);
    } finally {
        _writing = false;
    }
}
