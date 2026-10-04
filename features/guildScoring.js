// /features/guildScoring.js — the Crown Race: Glory ledger writes, monthly Chapters and Crowns

import {
    db,
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    writeBatch,
    runTransaction,
    query,
    where,
    increment,
    serverTimestamp,
} from '../firebase.js';
import * as state from '../state.js';
import { GUILDS, GUILD_IDS } from './guilds.js';
import { GLORY_PER_STAR } from '../constants.js';
import { isGameplaySeasonLiveFromAppState } from '../utils/schoolYear.js';
import {
    calculateGuildGloryDelta,
    chapterKeyFor,
    chapterKeyFromMonthKey,
    chapterTally,
    chaptersToSeal,
    compareCrownRaceRows,
    countedGuildGlory,
    exactGuildGloryDelta,
    findOrphanMemberGlory,
    guildChapterBook,
    isChapterOfSchoolYear,
    rankChapter,
    roundTo,
    schoolYearChapterKeys,
} from './guildScoringCore.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

/**
 * First Chapter that pays Crowns in a school year. Any year not listed starts with its
 * September. (2026-2027 switched to the Crown Race in October; see CROWN_RACE notes in docs.)
 */
export const CROWN_RACE_FIRST_CHAPTER = {
    '2026-2027': 'm2026_09',
};

export function getFirstCrownChapter(schoolYearKey = state.getActiveSchoolYearKey()) {
    return CROWN_RACE_FIRST_CHAPTER[schoolYearKey] || schoolYearChapterKeys(schoolYearKey)[0] || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get ISO week key e.g. "2026-W14" from a Date. */
export function getISOWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns the ISO week key that quiz work done "now" should target.
 * Mon–Fri → current ISO week (quiz is for this week's lessons).
 * Sat–Sun → next ISO week (quiz is being prepared over the weekend
 *           for next week's first lesson day).
 */
export function getTargetWeekKey(d = new Date()) {
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
        const next = new Date(d);
        next.setDate(d.getDate() + (day === 6 ? 2 : 1)); // Sat+2 or Sun+1 → Monday
        return getISOWeekKey(next);
    }
    return getISOWeekKey(d);
}

function _getStudent(studentId) {
    const students = state.get('allStudents') || [];
    return students.find((s) => s.id === studentId) || null;
}

function _getStudentScore(studentId) {
    const allScores = state.get('allStudentScores') || [];
    return allScores.find(sc => sc.id === studentId) || {};
}

/**
 * Which Chapter a Glory change belongs to. `chapter` is:
 *   true (default) → the Chapter running now;
 *   a month key ("2026-10") or chapter key → that Chapter (a correction of an older award);
 *   false → the year only (a new member's earlier stars, a leftover correction).
 * A Chapter outside the active school year, or one already sealed, is never touched.
 */
function _resolveChapterKey(chapter, guildData = {}, now = Date.now()) {
    if (chapter === false || chapter === null) return null;
    const key = chapter === true || chapter === undefined ? chapterKeyFor(new Date(now)) : chapterKeyFromMonthKey(chapter);
    const year = state.getActiveSchoolYearKey();
    if (!key || !isChapterOfSchoolYear(key, year)) return null;
    if (guildChapterBook(guildData, year).sealed[key]) return null;
    return key;
}

function _buildGuildScorePatch({ guildDef, guildId, starDelta, totalGloryDelta, guildData = {}, studentId, chapterKey }) {
    const amount = Number(totalGloryDelta) || 0;
    const patch = {
        guildId,
        guildName: guildDef?.name || guildData.guildName || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: increment(starDelta || 0),
        totalGlory: increment(amount),
        lastUpdated: serverTimestamp(),
    };
    if (guildData.totalGlory === undefined) patch.totalGlory = Number(guildData.totalStars || 0) * GLORY_PER_STAR + amount;
    // Keep each member's share on file so it leaves with them if they leave the school.
    if (studentId && amount && guildData.memberGloryYear &&
        guildData.memberGloryYear === guildData.activeSchoolYearKey &&
        guildData.activeSchoolYearKey === state.getActiveSchoolYearKey()) {
        patch[`memberGlory.${studentId}`] = increment(amount);
    }
    if (chapterKey && amount) {
        patch[`chapters.${chapterKey}.glory`] = increment(amount);
        if (studentId) patch[`chapters.${chapterKey}.members.${studentId}`] = increment(amount);
    }
    return patch;
}

function _buildNewGuildScoreDoc({ guildId, guildDef, delta, studentId, chapterKey }) {
    const amount = delta.totalGloryDelta;
    return {
        guildId,
        guildName: guildDef?.name || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: delta.starDelta,
        totalGlory: amount,
        memberCount: 0,
        memberIds: [],
        memberGlory: studentId ? { [studentId]: amount } : {},
        memberGloryYear: state.getActiveSchoolYearKey(),
        chapters: chapterKey ? { [chapterKey]: { glory: amount, members: studentId ? { [studentId]: amount } : {} } } : {},
        sealedChapters: {},
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
    };
}

function _gloryDelta({ starDelta, directGlory, exactGlory, scoreData }) {
    if (exactGlory !== null && exactGlory !== undefined && Number.isFinite(Number(exactGlory))) {
        return exactGuildGloryDelta({ starDelta, glory: exactGlory });
    }
    return calculateGuildGloryDelta({ starDelta, directGlory, scoreData, gloryPerStar: GLORY_PER_STAR });
}

function _eventPayload({ guildId, studentId, classId, source, delta, note, eventMeta, chapterKey }) {
    return {
        guildId,
        studentId,
        classId,
        schoolYearKey: state.getActiveSchoolYearKey(),
        chapterKey: chapterKey || 'none',
        source,
        starDelta: delta.starDelta,
        baseGlory: delta.baseGlory,
        modifierGlory: delta.modifierGlory,
        directGlory: delta.directGlory,
        totalGloryDelta: delta.totalGloryDelta,
        breakdown: delta.breakdown,
        note: String(note || '').slice(0, 280),
        eventMeta,
        createdAt: serverTimestamp(),
        createdBy: {
            uid: state.get('currentUserId') || null,
            name: state.get('currentTeacherName') || null,
        },
    };
}

async function _spendBannerCharges(studentId, starDelta, scoreData) {
    if (!(studentId && starDelta > 0 && Number(scoreData?.gloryBannerCharges) > 0)) return;
    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { gloryBannerCharges: increment(-Math.min(starDelta, Number(scoreData.gloryBannerCharges) || 0)) });
    } catch (_) { /* non-critical */ }
}

/**
 * Records an auditable Guild Glory event and updates the guild's totals and Chapter.
 * `chapter` says which Chapter the change counts for (see _resolveChapterKey).
 * `affectsWeek: false` is the older spelling of `chapter: false`.
 */
export async function recordGuildGloryEvent({
    guildId,
    studentId = null,
    classId = null,
    source = 'guild_glory',
    starDelta = 0,
    directGlory = 0,
    scoreData = null,
    note = '',
    eventMeta = {},
    idempotencyKey = null,
    exactGlory = null,
    affectsWeek = true,
    chapter = true,
} = {}) {
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
    const chapterArg = affectsWeek === false ? false : chapter;
    if (idempotencyKey) {
        return _recordIdempotentGuildGloryEvent({
            guildId, studentId, classId, source, starDelta, directGlory, note, eventMeta, idempotencyKey, exactGlory, chapter: chapterArg,
        });
    }
    const now = Date.now();
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    let guildSnap = null;
    try {
        guildSnap = await getDoc(guildRef);
    } catch (_) { /* fall back to in-memory state */ }
    const liveGuildData = (guildSnap?.exists?.() ? guildSnap.data() : (state.get('allGuildScores') || {})[guildId]) || {};
    const liveScoreData = scoreData || (studentId ? _getStudentScore(studentId) : {});
    const guildDef = GUILDS[guildId];
    const delta = _gloryDelta({ starDelta, directGlory, exactGlory, scoreData: liveScoreData });

    if (!delta.starDelta && !delta.totalGloryDelta) return delta;

    const chapterKey = _resolveChapterKey(chapterArg, liveGuildData, now);
    const eventRef = doc(collection(db, `${publicDataPath}/guild_glory_events`));
    const batch = writeBatch(db);
    batch.set(eventRef, _eventPayload({ guildId, studentId, classId, source, delta, note, eventMeta, chapterKey }));

    try {
        if (guildSnap?.exists?.()) {
            batch.update(guildRef, _buildGuildScorePatch({
                guildId, guildDef, starDelta: delta.starDelta, totalGloryDelta: delta.totalGloryDelta,
                guildData: liveGuildData, studentId, chapterKey,
            }));
        } else {
            batch.set(guildRef, _buildNewGuildScoreDoc({ guildId, guildDef, delta, studentId, chapterKey }));
        }
        await batch.commit();
    } catch (err) {
        console.error('recordGuildGloryEvent failed:', err);
    }

    await _spendBannerCharges(studentId, starDelta, liveScoreData);
    return { ...delta, chapterKey, eventId: eventRef.id };
}

/**
 * Exactly-once variant used by retryable callers (Special Quest effects, Wheel and Market gifts).
 * The Glory event id is derived from `idempotencyKey`; the event and the guild change commit in
 * one transaction, so a retry after success is a no-op. Failures are thrown so callers can retry.
 */
async function _recordIdempotentGuildGloryEvent({
    guildId, studentId, classId, source, starDelta, directGlory, note, eventMeta, idempotencyKey, exactGlory = null, chapter = true,
}) {
    const now = Date.now();
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    const safeKey = String(idempotencyKey).replace(/\//g, '_').slice(0, 700);
    const eventRef = doc(db, `${publicDataPath}/guild_glory_events`, `idem_${safeKey}`);
    const liveScoreData = studentId ? _getStudentScore(studentId) : {};
    const guildDef = GUILDS[guildId];
    let result = null;

    await runTransaction(db, async (transaction) => {
        result = null;
        const existing = await transaction.get(eventRef);
        if (existing.exists()) {
            result = { skipped: true, eventId: eventRef.id };
            return;
        }
        const guildSnap = await transaction.get(guildRef);
        const liveGuildData = guildSnap.exists()
            ? guildSnap.data()
            : ((state.get('allGuildScores') || {})[guildId] || {});
        const delta = _gloryDelta({ starDelta, directGlory, exactGlory, scoreData: liveScoreData });
        const chapterKey = _resolveChapterKey(chapter, liveGuildData, now);
        // The marker event is written even for a zero delta so the key is recorded as processed.
        transaction.set(eventRef, _eventPayload({
            guildId, studentId, classId, source, delta, note, chapterKey,
            eventMeta: { ...(eventMeta || {}), idempotencyKey: String(idempotencyKey) },
        }));
        if (delta.starDelta || delta.totalGloryDelta) {
            if (guildSnap.exists()) {
                transaction.update(guildRef, _buildGuildScorePatch({
                    guildId, guildDef, starDelta: delta.starDelta, totalGloryDelta: delta.totalGloryDelta,
                    guildData: liveGuildData, studentId, chapterKey,
                }));
            } else {
                transaction.set(guildRef, _buildNewGuildScoreDoc({ guildId, guildDef, delta, studentId, chapterKey }));
            }
        }
        result = { ...delta, chapterKey, eventId: eventRef.id };
    });

    if (result && !result.skipped) await _spendBannerCharges(studentId, starDelta, liveScoreData);
    return result;
}

/**
 * Update guild Glory when a student earns (or loses) stars.
 * @param {string} studentId
 * @param {number} starDelta
 */
export async function updateGuildScores(studentId, starDelta, source = 'star_award', { idempotencyKey = null, chapter = true } = {}) {
    if (!studentId || !Number.isFinite(Number(starDelta)) || Number(starDelta) === 0) return;
    const student = _getStudent(studentId);
    const guildId = student?.guildId;
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
    return recordGuildGloryEvent({
        guildId,
        studentId,
        classId: student.classId || null,
        source,
        starDelta,
        idempotencyKey,
        chapter,
    });
}

/**
 * Gives `glory` to each listed student's guild, credited to that student, so it counts for
 * their Chapter and leaves with them if they leave. Used by the Wheel, the Quiz and the Market.
 * Returns the total Glory written per guild.
 */
export async function awardGloryToStudents(studentIds = [], glory = 0, source = 'guild_gift', { note = '', classId = null, idempotencyPrefix = null } = {}) {
    const amount = roundTo(Number(glory) || 0, 2);
    const byGuild = {};
    if (!(amount > 0)) return byGuild;
    for (const studentId of [...new Set(studentIds)]) {
        const student = _getStudent(studentId);
        const guildId = student?.guildId;
        if (!guildId || !GUILD_IDS.includes(guildId)) continue;
        await recordGuildGloryEvent({
            guildId,
            studentId,
            classId: classId || student.classId || null,
            source,
            directGlory: amount,
            note,
            idempotencyKey: idempotencyPrefix ? `${idempotencyPrefix}_${studentId}` : null,
        });
        byGuild[guildId] = roundTo((byGuild[guildId] || 0) + amount, 2);
    }
    return byGuild;
}

/** Glory a student has earned for their guild in this month's Chapter (from the live guild doc). */
export function chapterGloryOf(studentId, now = new Date()) {
    const guildId = _getStudent(studentId)?.guildId;
    const key = chapterKeyFor(now);
    const members = ((state.get('allGuildScores') || {})[guildId]?.chapters || {})[key]?.members || {};
    return Math.max(0, Number(members[studentId]) || 0);
}

/**
 * Takes up to `glory` from each student's Glory for their guild (a Fortune's Wheel storm).
 * Only Glory the child already earned this month can be lost, so no one ever drops below 0
 * in the Chapter. Returns the Glory actually taken, per guild and per student (as positive numbers).
 */
export async function takeGloryFromStudents(studentIds = [], glory = 0, source = 'wheel_storm', { note = '', classId = null, idempotencyPrefix = null } = {}) {
    const amount = roundTo(Number(glory) || 0, 2);
    const byGuild = {};
    const byStudent = {};
    if (!(amount > 0)) return { byGuild, byStudent };
    for (const studentId of [...new Set(studentIds)]) {
        const student = _getStudent(studentId);
        const guildId = student?.guildId;
        if (!guildId || !GUILD_IDS.includes(guildId)) continue;
        const take = roundTo(Math.min(amount, chapterGloryOf(studentId)), 2);
        if (!(take > 0)) continue;
        await recordGuildGloryEvent({
            guildId,
            studentId,
            classId: classId || student.classId || null,
            source,
            directGlory: -take,
            note,
            idempotencyKey: idempotencyPrefix ? `${idempotencyPrefix}_${studentId}` : null,
        });
        byGuild[guildId] = roundTo((byGuild[guildId] || 0) + take, 2);
        byStudent[studentId] = take;
    }
    return { byGuild, byStudent };
}

/** Current member count per guild (active students of this school year). */
export function getGuildMemberCounts() {
    const counts = {};
    for (const student of state.get('allStudents') || []) {
        if (student.guildId && GUILD_IDS.includes(student.guildId)) counts[student.guildId] = (counts[student.guildId] || 0) + 1;
    }
    return counts;
}

function _memberIdsByGuild() {
    const byGuild = Object.fromEntries(GUILD_IDS.map((gid) => [gid, []]));
    for (const student of state.get('allStudents') || []) {
        if (byGuild[student.guildId]) byGuild[student.guildId].push(student.id);
    }
    return byGuild;
}

// ─── Ledger sync (the ledger is the single source of truth) ──────────────────

let _ledgerSyncRunning = false;
let _ledgerSyncAttempts = 0;
// Bump to re-run the sync once on every guild (e.g. after fixing a write path).
// Version 3 also rebuilds each month's Chapter from the ledger (the Crown Race).
const LEDGER_SYNC_VERSION = 3;
const _ledgerSyncKey = (schoolYearKey) => `${schoolYearKey}#${LEDGER_SYNC_VERSION}`;

function _millis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

/** Which Chapter a ledger event counts for: its own record, else the month it was written. */
function _eventChapterKey(e = {}) {
    if (e.chapterKey === 'none') return null;
    if (e.chapterKey) return e.chapterKey;
    // Events written before the Crown Race: a new member's earlier stars and leftover
    // corrections belonged to the year only.
    if (e.source === 'guild_join' || e.source === 'glory_correction') return null;
    const ms = _millis(e.createdAt);
    return ms ? chapterKeyFor(new Date(ms)) : null;
}

/**
 * Once per school year (and once per LEDGER_SYNC_VERSION) a teacher's app rebuilds each guild's
 * totalGlory, totalStars, memberGlory and unsealed Chapters from the ledger, so Glory that reached
 * the totals without a ledger entry cannot linger. A guild is only rewritten if nothing touched
 * it while the ledger was being read. Sealed Chapters are never rewritten.
 */
export async function backfillGuildMemberGloryIfNeeded() {
    if (_ledgerSyncRunning || _ledgerSyncAttempts >= 3) return;
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    const schoolYearKey = state.getActiveSchoolYearKey();
    const allGuildScores = state.get('allGuildScores') || {};
    const stale = GUILD_IDS.filter((gid) => {
        const data = allGuildScores[gid];
        return data && data.activeSchoolYearKey === schoolYearKey && data.ledgerSyncKey !== _ledgerSyncKey(schoolYearKey);
    });
    if (!schoolYearKey || !stale.length) return;
    _ledgerSyncRunning = true;
    _ledgerSyncAttempts += 1; // each attempt reads the year's ledger, so a few per visit at most
    try {
        const before = {};
        for (const gid of stale) {
            const snap = await getDoc(doc(db, `${publicDataPath}/guild_scores`, gid));
            before[gid] = _millis(snap.data()?.lastUpdated);
        }
        const sums = Object.fromEntries(stale.map((gid) => [gid, { totalGlory: 0, totalStars: 0, memberGlory: {}, chapters: {} }]));
        const eventsSnap = await getDocs(query(
            collection(db, `${publicDataPath}/guild_glory_events`),
            where('schoolYearKey', '==', schoolYearKey),
        ));
        const r2 = (n) => Math.round(n * 100) / 100;
        eventsSnap.forEach((eventDoc) => {
            const e = eventDoc.data() || {};
            const sum = sums[e.guildId];
            if (!sum) return;
            const glory = Number(e.totalGloryDelta) || 0;
            sum.totalGlory = r2(sum.totalGlory + glory);
            sum.totalStars = r2(sum.totalStars + (Number(e.starDelta) || 0));
            if (e.studentId) sum.memberGlory[e.studentId] = r2((sum.memberGlory[e.studentId] || 0) + glory);
            const key = _eventChapterKey(e);
            if (key && isChapterOfSchoolYear(key, schoolYearKey) && glory) {
                const ch = sum.chapters[key] || (sum.chapters[key] = { glory: 0, members: {} });
                ch.glory = r2(ch.glory + glory);
                if (e.studentId) ch.members[e.studentId] = r2((ch.members[e.studentId] || 0) + glory);
            }
        });
        for (const gid of stale) {
            const ref = doc(db, `${publicDataPath}/guild_scores`, gid);
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(ref);
                if (!snap.exists() || _millis(snap.data()?.lastUpdated) !== before[gid]) return; // busy: next time
                const { sealed } = guildChapterBook(snap.data(), schoolYearKey);
                const keep = guildChapterBook(snap.data(), schoolYearKey).chapters;
                const chapters = { ...(snap.data()?.chapters || {}) };
                for (const key of Object.keys(chapters)) if (isChapterOfSchoolYear(key, schoolYearKey) && !sealed[key]) delete chapters[key];
                for (const [key, ch] of Object.entries(sums[gid].chapters)) chapters[key] = sealed[key] ? (keep[key] || ch) : ch;
                transaction.update(ref, {
                    totalGlory: sums[gid].totalGlory,
                    totalStars: sums[gid].totalStars,
                    memberGlory: sums[gid].memberGlory,
                    memberGloryYear: schoolYearKey,
                    chapters,
                    ledgerSyncKey: _ledgerSyncKey(schoolYearKey),
                });
            });
        }
    } catch (err) {
        console.warn('Guild ledger sync skipped:', err);
    } finally {
        _ledgerSyncRunning = false;
    }
}

const _correctedOrphanKeys = new Set();
let _orphanRetryScheduled = false;

/**
 * Takes back Glory still credited to members who have no stars this year (left over from
 * stars that were given and then taken back). Idempotent per member and amount, so several
 * open apps correct it once. Counts for the year only, never for a Chapter.
 */
export async function correctOrphanMemberGlory() {
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    if (!isGameplaySeasonLiveFromAppState(state)) return;
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    if (!allStudents.length || !allStudentScores.length) {
        // Rosters load alongside guild scores; look again shortly (once).
        if (!_orphanRetryScheduled) {
            _orphanRetryScheduled = true;
            setTimeout(() => { correctOrphanMemberGlory().catch(() => {}); }, 20000);
        }
        return;
    }
    const starsByStudent = Object.fromEntries(allStudentScores.map((sc) => [sc.id, Number(sc.totalStars) || 0]));
    const allGuildScores = state.get('allGuildScores') || {};
    for (const guildId of GUILD_IDS) {
        const data = allGuildScores[guildId];
        if (!data || data.activeSchoolYearKey !== state.getActiveSchoolYearKey()) continue;
        // Corrections only make sense once the totals match the ledger.
        if (data.ledgerSyncKey !== _ledgerSyncKey(data.activeSchoolYearKey)) continue;
        // Only once the guild has been quiet for a while: a star taken back writes the
        // student's score first and the guild's Glory a moment later.
        const lastUpdatedMs = typeof data.lastUpdated?.toMillis === 'function' ? data.lastUpdated.toMillis() : 0;
        if (!lastUpdatedMs || Date.now() - lastUpdatedMs < 5 * 60 * 1000) continue;
        const memberIds = allStudents.filter((st) => st.guildId === guildId).map((st) => st.id);
        for (const { studentId, glory } of findOrphanMemberGlory(data, memberIds, starsByStudent)) {
            const key = `orphan_${guildId}_${studentId}_${String(glory).replace('.', '_')}`;
            if (_correctedOrphanKeys.has(key)) continue;
            _correctedOrphanKeys.add(key);
            try {
                await recordGuildGloryEvent({
                    guildId,
                    studentId,
                    source: 'glory_correction',
                    exactGlory: glory,
                    chapter: false,
                    note: 'Glory left over from stars that were taken back',
                    idempotencyKey: key,
                });
            } catch (err) {
                _correctedOrphanKeys.delete(key);
                console.warn('Guild Glory correction skipped:', err);
            }
        }
    }
}

// ─── Sealing Chapters ────────────────────────────────────────────────────────

let _sealRunning = false;
const _sealedThisVisit = new Set();

/**
 * Seals every Chapter that has ended: works out its places, Crowns and Unity Seals from the
 * current rosters and writes them once to all four guilds. Several open apps may try at once;
 * the transaction makes the first one win and the others find it sealed.
 */
export async function sealFinishedChapters(now = new Date()) {
    if (_sealRunning) return;
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    if (!isGameplaySeasonLiveFromAppState(state)) return;
    const schoolYearKey = state.getActiveSchoolYearKey();
    const allStudents = state.get('allStudents') || [];
    if (!schoolYearKey || !allStudents.length) return;
    const allGuildScores = state.get('allGuildScores') || {};
    // Wait for the ledger sync, so a Chapter is never sealed from half-rebuilt totals.
    if (GUILD_IDS.some((gid) => allGuildScores[gid] && allGuildScores[gid].ledgerSyncKey !== _ledgerSyncKey(schoolYearKey))) return;
    const pending = chaptersToSeal(allGuildScores, schoolYearKey, now, getFirstCrownChapter(schoolYearKey))
        .filter((k) => !_sealedThisVisit.has(k));
    if (!pending.length) return;
    _sealRunning = true;
    try {
        const members = _memberIdsByGuild();
        const refs = Object.fromEntries(GUILD_IDS.map((gid) => [gid, doc(db, `${publicDataPath}/guild_scores`, gid)]));
        await runTransaction(db, async (transaction) => {
            const snaps = {};
            for (const gid of GUILD_IDS) snaps[gid] = await transaction.get(refs[gid]);
            const patches = Object.fromEntries(GUILD_IDS.map((gid) => [gid, {}]));
            for (const key of pending) {
                const books = Object.fromEntries(GUILD_IDS.map((gid) => [gid, guildChapterBook(snaps[gid].exists() ? snaps[gid].data() : {}, schoolYearKey)]));
                if (GUILD_IDS.every((gid) => books[gid].sealed[key] || !snaps[gid].exists())) continue;
                const tallies = Object.fromEntries(GUILD_IDS.map((gid) => [gid, chapterTally(books[gid].chapters[key] || {}, members[gid])]));
                const ranked = rankChapter(tallies);
                for (const gid of GUILD_IDS) {
                    const r = ranked[gid];
                    patches[gid][`sealedChapters.${key}`] = {
                        glory: roundTo(r.glory, 2),
                        memberCount: r.memberCount,
                        perMember: roundTo(r.perMember, 3),
                        place: r.place,
                        placeCrowns: r.placeCrowns,
                        unity: Boolean(r.unity),
                        unityCount: r.unityCount,
                        crowns: r.crowns,
                        sealedAt: Date.now(),
                    };
                }
            }
            for (const gid of GUILD_IDS) {
                if (!snaps[gid].exists() || !Object.keys(patches[gid]).length) continue;
                transaction.update(refs[gid], patches[gid]);
            }
        });
        pending.forEach((k) => _sealedThisVisit.add(k));
    } catch (err) {
        console.warn('Sealing finished Chapters skipped:', err);
    } finally {
        _sealRunning = false;
    }
}

// ─── The Crown Race standings ────────────────────────────────────────────────

/**
 * One row per guild, in year order (Crowns, then the year's Glory per member):
 *   crowns           sealed Crowns this school year
 *   chapters         [{ key, place, crowns, unity, perMember }] for each sealed Chapter
 *   live             the running Chapter: glory, perMember, place, crowns if it ended now, Unity progress
 *   yearGloryPerMember / countedGlory  the tie-breaker
 */
export function getGuildLeaderboardData(now = new Date()) {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    const schoolYearKey = state.getActiveSchoolYearKey();
    const liveKey = chapterKeyFor(now);
    const firstKey = getFirstCrownChapter(schoolYearKey);
    const members = _memberIdsByGuild();
    const scoreById = new Map(allStudentScores.map((sc) => [sc.id, sc]));
    const studentById = new Map(allStudents.map((s) => [s.id, s]));

    const books = Object.fromEntries(GUILD_IDS.map((gid) => [gid, guildChapterBook(allGuildScores[gid] || {}, schoolYearKey)]));
    const liveTallies = Object.fromEntries(GUILD_IDS.map((gid) => [gid, chapterTally(books[gid].chapters[liveKey] || {}, members[gid])]));
    const liveRanked = rankChapter(liveTallies);
    const liveCounts = !firstKey || liveKey >= firstKey;

    const rows = GUILD_IDS.map((gid) => {
        const gDoc = allGuildScores[gid] || {};
        const memberIds = members[gid];
        const memberCount = memberIds.length;
        const guildDef = GUILDS[gid];
        const totalStars = Number(gDoc.totalStars) || 0;
        const totalGlory = gDoc.totalGlory !== undefined ? (Number(gDoc.totalGlory) || 0) : totalStars * GLORY_PER_STAR;
        const { countedGlory, leaversGlory, memberGloryReady } = countedGuildGlory(gDoc, memberIds);
        const memberGlory = memberGloryReady ? (gDoc.memberGlory || {}) : null;

        const sealedList = Object.entries(books[gid].sealed)
            .filter(([key]) => !firstKey || key >= firstKey)
            .map(([key, rec]) => ({ key, ...rec }))
            .sort((a, b) => a.key.localeCompare(b.key));
        const crowns = sealedList.reduce((sum, c) => sum + (Number(c.crowns) || 0), 0);

        const live = liveRanked[gid];
        const liveMembers = books[gid].chapters[liveKey]?.members || {};
        const person = (id, glory) => {
            const s = studentById.get(id);
            return s ? { studentId: id, name: s.name, avatar: s.avatar, classId: s.classId, glory: roundTo(glory, 1) } : null;
        };
        const chapterTop = memberIds
            .map((id) => person(id, Number(liveMembers[id]) || 0))
            .filter((p) => p && p.glory > 0)
            .sort((a, b) => b.glory - a.glory || a.name.localeCompare(b.name))
            .slice(0, 5);
        const topContributors = memberIds
            .map((id) => {
                const sc = scoreById.get(id) || {};
                const glory = memberGlory ? (Number(memberGlory[id]) || 0) : (Number(sc.totalStars) || 0) * GLORY_PER_STAR;
                const p = person(id, glory);
                return p ? { ...p, gloryEstimate: Math.round(glory), totalStars: Number(sc.totalStars) || 0, monthlyStars: Number(sc.monthlyStars) || 0 } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.gloryEstimate - a.gloryEstimate || b.totalStars - a.totalStars || a.name.localeCompare(b.name))
            .slice(0, 4);
        const standards = Array.isArray(books[gid].chapters[liveKey]?.standards) ? books[gid].chapters[liveKey].standards : [];

        return {
            guildId: gid,
            guildName: guildDef?.name || gDoc.guildName || gid,
            memberCount,
            totalStars,
            totalGlory,
            countedGlory,
            leaversGlory,
            yearGloryPerMember: memberCount > 0 ? countedGlory / memberCount : 0,
            crowns,
            chapterWins: sealedList.filter((c) => c.place === 1).map((c) => c.key),
            chapters: sealedList,
            live: { key: liveKey, counts: liveCounts, ...live, crowns: liveCounts ? live.crowns : 0 },
            liveCrowns: liveCounts ? live.crowns : 0,
            chapterTop,
            topContributors,
            standards,
            // Per-member Glory, for the Guild Spotlight (this Chapter and the year).
            liveMemberGlory: Object.fromEntries(memberIds.map((id) => [id, roundTo(Number(liveMembers[id]) || 0, 1)])),
            yearMemberGlory: Object.fromEntries(memberIds.map((id) => [id, memberGlory
                ? roundTo(Number(memberGlory[id]) || 0, 1)
                : (Number(scoreById.get(id)?.totalStars) || 0) * GLORY_PER_STAR])),
        };
    });

    rows.sort(compareCrownRaceRows);
    return rows;
}

/** The Chapter keys the Crown Road shows for this school year. */
export function getCrownRoadKeys() {
    const year = state.getActiveSchoolYearKey();
    const firstKey = getFirstCrownChapter(year);
    return schoolYearChapterKeys(year).filter((k) => !firstKey || k >= firstKey);
}

export { compareCrownRaceRows };

/**
 * Returns the current month's guild champion for each guild.
 */
export function getGuildChampionsForMonth(allStudents, allStudentScores) {
    const champions = {};
    for (const guildId of GUILD_IDS) {
        const members = allStudents.filter(s => s.guildId === guildId);
        let topStudent = null;
        let topStars = -1;
        for (const member of members) {
            const score = allStudentScores.find(sc => sc.id === member.id);
            const monthlyStars = score?.monthlyStars || 0;
            if (monthlyStars > topStars) {
                topStars = monthlyStars;
                topStudent = { studentId: member.id, studentName: member.name, avatar: member.avatar || null, monthlyStars };
            }
        }
        if (topStudent && topStudent.monthlyStars > 0) {
            champions[guildId] = topStudent;
        }
    }
    return champions;
}
