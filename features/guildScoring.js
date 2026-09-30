// /features/guildScoring.js — Real-time guild score aggregation with Glory currency & composite Guild Power

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
    arrayUnion,
    serverTimestamp,
} from '../firebase.js';
import * as state from '../state.js';
import { GUILDS, GUILD_IDS } from './guilds.js';
import { GLORY_PER_STAR } from '../constants.js';
import { isGameplaySeasonLiveFromAppState } from '../utils/schoolYear.js';
import {
    calculateGuildGloryDelta,
    calculateGuildPower as calculateGuildPowerCore,
    compareGuildLeaderboardRows,
    getMomentumArrow,
    countActiveMembersThisWeek,
    countedGuildGlory,
    exactGuildGloryDelta,
    findOrphanMemberGlory,
    findWonGuildChallenges,
    guildSizeScale,
    resolveGuildWeek,
    weekMondayKey,
} from './guildScoringCore.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

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

/** Local Monday ("YYYY-MM-DD") of the week holding `d`. */
function getISOWeekMonday(d = new Date()) {
    return weekMondayKey(d);
}

// ─── Core scoring ────────────────────────────────────────────────────────────

function _getStudent(studentId) {
    const students = state.get('allStudents') || [];
    return students.find((s) => s.id === studentId) || null;
}

function _getStudentScore(studentId) {
    const allScores = state.get('allStudentScores') || [];
    return allScores.find(sc => sc.id === studentId) || {};
}

function _buildGuildScorePatch({ guildId, guildDef, starDelta, totalGloryDelta, guildData = {}, studentId, now = Date.now(), consumedGloryModifiers = null, affectsWeek = true }) {
    const currentMonday = getISOWeekMonday(new Date(now));
    const weekTurned = !guildData.lastWeeklyReset || guildData.lastWeeklyReset < currentMonday;
    const week = resolveGuildWeek(guildData, now);
    const previousIds = week.weeklyActiveMemberIds;
    // A correction of an older award belongs to the year, not to this week's form.
    const weekDelta = affectsWeek ? (Number(totalGloryDelta) || 0) : 0;
    const patch = {
        guildId,
        guildName: guildDef?.name || guildData.guildName || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: increment(starDelta || 0),
        totalGlory: increment(totalGloryDelta || 0),
        monthlyGlory: increment(totalGloryDelta || 0),
        weeklyGlory: weekTurned ? weekDelta : increment(weekDelta),
        lastUpdated: serverTimestamp(),
    };
    if (weekTurned) {
        // Last week's Glory only if the stored week really was last week (a guild
        // that sat out a whole week had 0 last week, not its older total).
        patch.previousWeekGlory = week.previousWeekGlory;
        patch.lastWeeklyReset = currentMonday;
        patch.weeklyActiveMemberIds = [];
        patch.weeklyActiveMembers = 0;
        patch.weeklyMemberGlory = studentId && weekDelta ? { [studentId]: weekDelta } : {};
        patch.weeklyMemberGloryWeek = currentMonday;
    } else if (studentId && weekDelta) {
        // Each member's net Glory this week, so a star given and taken back leaves them not active.
        patch[`weeklyMemberGlory.${studentId}`] = increment(weekDelta);
    }
    if (guildData.totalGlory === undefined) patch.totalGlory = Number(guildData.totalStars || 0) * GLORY_PER_STAR + (totalGloryDelta || 0);
    if (guildData.monthlyGlory === undefined) patch.monthlyGlory = totalGloryDelta || 0;
    if (!Array.isArray(guildData.gloryModifiers)) patch.gloryModifiers = [];
    if (guildData.chaliceActive === undefined) patch.chaliceActive = false;
    if (guildData.chaliceExpiresAt === undefined) patch.chaliceExpiresAt = 0;
    if (Array.isArray(consumedGloryModifiers)) patch.gloryModifiers = consumedGloryModifiers;
    // Keep each member's share on file so it leaves with them if they leave the school.
    if (studentId && Number(totalGloryDelta) && guildData.memberGloryYear &&
        guildData.memberGloryYear === guildData.activeSchoolYearKey &&
        guildData.activeSchoolYearKey === state.getActiveSchoolYearKey()) {
        patch[`memberGlory.${studentId}`] = increment(Number(totalGloryDelta));
    }
    // Only earning Glory makes a member "active"; a correction or a wheel curse does not.
    if (studentId && weekDelta > 0 && !previousIds.includes(studentId)) {
        // arrayUnion so two teachers awarding at once never drop each other's member.
        patch.weeklyActiveMemberIds = weekTurned ? [studentId] : arrayUnion(studentId);
        patch.weeklyActiveMembers = previousIds.length + 1;
    }
    return patch;
}

function _sameIdSet(a = [], b = []) {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every(id => set.has(id));
}

function _eventCreatedMs(eventData = {}) {
    const createdAt = eventData.createdAt;
    if (!createdAt) return 0;
    if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
    if (Number.isFinite(Number(createdAt.seconds))) return Number(createdAt.seconds) * 1000;
    const parsed = new Date(createdAt).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

async function _setOrUpdateGuildScore(guildRef, guildId, patch, initialData = {}) {
    const snap = await getDoc(guildRef);
    if (snap.exists()) {
        await updateDoc(guildRef, patch);
        return snap.data() || {};
    }
    const guildDef = GUILDS[guildId];
    await setDoc(guildRef, {
        guildId,
        guildName: guildDef?.name || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: Number(initialData.totalStars) || 0,
        totalGlory: Number(initialData.totalGlory) || 0,
        monthlyGlory: Number(initialData.monthlyGlory) || 0,
        weeklyGlory: Number(initialData.weeklyGlory) || 0,
        previousWeekGlory: 0,
        weeklyActiveMembers: initialData.weeklyActiveMembers || 0,
        weeklyActiveMemberIds: initialData.weeklyActiveMemberIds || [],
        memberCount: 0,
        memberIds: [],
        gloryModifiers: [],
        chaliceActive: false,
        chaliceExpiresAt: 0,
        lastWeeklyReset: getISOWeekMonday(),
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
    });
    return {};
}

function _gloryDelta({ starDelta, directGlory, exactGlory, scoreData, guildData, now }) {
    if (exactGlory !== null && exactGlory !== undefined && Number.isFinite(Number(exactGlory))) {
        return exactGuildGloryDelta({ starDelta, glory: exactGlory, guildData });
    }
    return calculateGuildGloryDelta({ starDelta, directGlory, scoreData, guildData, gloryPerStar: GLORY_PER_STAR, now });
}

/**
 * Records an auditable Guild Glory event and updates the materialized guild score cache.
 */
export async function recordGuildGloryEvent({
    guildId,
    studentId = null,
    classId = null,
    source = 'guild_glory',
    starDelta = 0,
    directGlory = 0,
    scoreData = null,
    guildData = null,
    note = '',
    eventMeta = {},
    idempotencyKey = null,
    exactGlory = null,
    affectsWeek = true,
} = {}) {
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
    if (idempotencyKey) {
        return _recordIdempotentGuildGloryEvent({
            guildId, studentId, classId, source, starDelta, directGlory, note, eventMeta, idempotencyKey, exactGlory, affectsWeek,
        });
    }
    const now = Date.now();
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    let guildSnap = null;
    if (!guildData) {
        try {
            guildSnap = await getDoc(guildRef);
        } catch (_) { /* fall back to in-memory state */ }
    }
    const liveGuildData = guildData || (guildSnap?.exists?.() ? guildSnap.data() : (state.get('allGuildScores') || {})[guildId]) || {};
    const liveScoreData = scoreData || (studentId ? _getStudentScore(studentId) : {});
    const guildDef = GUILDS[guildId];
    const delta = _gloryDelta({ starDelta, directGlory, exactGlory, scoreData: liveScoreData, guildData: liveGuildData, now });

    if (!delta.starDelta && !delta.totalGloryDelta) return delta;

    const eventRef = doc(collection(db, `${publicDataPath}/guild_glory_events`));
    const batch = writeBatch(db);
    const eventPayload = {
        guildId,
        studentId,
        classId,
        schoolYearKey: state.getActiveSchoolYearKey(),
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

    batch.set(eventRef, eventPayload);

    const patch = _buildGuildScorePatch({
        guildId,
        guildDef,
        starDelta: delta.starDelta,
        totalGloryDelta: delta.totalGloryDelta,
        guildData: liveGuildData,
        studentId,
        now,
        consumedGloryModifiers: delta.consumedGloryModifiers,
        affectsWeek,
    });

    try {
        const snap = guildSnap || await getDoc(guildRef);
        if (snap.exists()) {
            batch.update(guildRef, patch);
        } else {
            batch.set(guildRef, {
                guildId,
                guildName: guildDef?.name || guildId,
                activeSchoolYearKey: state.getActiveSchoolYearKey(),
                totalStars: delta.starDelta,
                totalGlory: delta.totalGloryDelta,
                monthlyGlory: delta.totalGloryDelta,
                weeklyGlory: delta.totalGloryDelta,
                previousWeekGlory: 0,
                weeklyActiveMembers: studentId ? 1 : 0,
                weeklyActiveMemberIds: studentId ? [studentId] : [],
        weeklyMemberGlory: studentId ? { [studentId]: delta.totalGloryDelta } : {},
        weeklyMemberGloryWeek: getISOWeekMonday(),
                memberCount: 0,
                memberIds: [],
                memberGlory: studentId ? { [studentId]: delta.totalGloryDelta } : {},
                memberGloryYear: state.getActiveSchoolYearKey(),
                gloryModifiers: delta.consumedGloryModifiers || [],
                chaliceActive: false,
                chaliceExpiresAt: 0,
                lastWeeklyReset: getISOWeekMonday(),
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
            });
        }
        await batch.commit();
    } catch (err) {
        console.error('recordGuildGloryEvent failed:', err);
    }

    if (studentId && starDelta > 0 && Number(liveScoreData?.gloryBannerCharges) > 0) {
        try {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            await updateDoc(scoreRef, { gloryBannerCharges: increment(-Math.min(starDelta, Number(liveScoreData.gloryBannerCharges) || 0)) });
        } catch (_) { /* non-critical */ }
    }

    return { ...delta, eventId: eventRef.id };
}

function _buildNewGuildScoreDoc({ guildId, guildDef, delta, studentId }) {
    return {
        guildId,
        guildName: guildDef?.name || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: delta.starDelta,
        totalGlory: delta.totalGloryDelta,
        monthlyGlory: delta.totalGloryDelta,
        weeklyGlory: delta.totalGloryDelta,
        previousWeekGlory: 0,
        weeklyActiveMembers: studentId ? 1 : 0,
        weeklyActiveMemberIds: studentId ? [studentId] : [],
        weeklyMemberGlory: studentId ? { [studentId]: delta.totalGloryDelta } : {},
        weeklyMemberGloryWeek: getISOWeekMonday(),
        memberCount: 0,
        memberIds: [],
        memberGlory: studentId ? { [studentId]: delta.totalGloryDelta } : {},
        memberGloryYear: state.getActiveSchoolYearKey(),
        gloryModifiers: delta.consumedGloryModifiers || [],
        chaliceActive: false,
        chaliceExpiresAt: 0,
        lastWeeklyReset: getISOWeekMonday(),
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
    };
}

/**
 * Exactly-once variant used by retryable callers (Special Quest effects).
 * The Glory event id is derived from `idempotencyKey`; the event and the guild
 * score change commit in one transaction, so a retry after success is a no-op.
 * Unlike the fire-and-forget path, failures are thrown so callers can retry.
 */
async function _recordIdempotentGuildGloryEvent({
    guildId, studentId, classId, source, starDelta, directGlory, note, eventMeta, idempotencyKey, exactGlory = null, affectsWeek = true,
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
        const delta = _gloryDelta({ starDelta, directGlory, exactGlory, scoreData: liveScoreData, guildData: liveGuildData, now });
        // The marker event is written even for a zero delta so the key is
        // recorded as processed.
        transaction.set(eventRef, {
            guildId,
            studentId,
            classId,
            schoolYearKey: state.getActiveSchoolYearKey(),
            source,
            starDelta: delta.starDelta,
            baseGlory: delta.baseGlory,
            modifierGlory: delta.modifierGlory,
            directGlory: delta.directGlory,
            totalGloryDelta: delta.totalGloryDelta,
            breakdown: delta.breakdown,
            note: String(note || '').slice(0, 280),
            eventMeta: { ...(eventMeta || {}), idempotencyKey: String(idempotencyKey) },
            createdAt: serverTimestamp(),
            createdBy: {
                uid: state.get('currentUserId') || null,
                name: state.get('currentTeacherName') || null,
            },
        });
        if (delta.starDelta || delta.totalGloryDelta) {
            if (guildSnap.exists()) {
                transaction.update(guildRef, _buildGuildScorePatch({
                    guildId,
                    guildDef,
                    starDelta: delta.starDelta,
                    totalGloryDelta: delta.totalGloryDelta,
                    guildData: liveGuildData,
                    studentId,
                    now,
                    consumedGloryModifiers: delta.consumedGloryModifiers,
                    affectsWeek,
                }));
            } else {
                transaction.set(guildRef, _buildNewGuildScoreDoc({ guildId, guildDef, delta, studentId }));
            }
        }
        result = { ...delta, eventId: eventRef.id };
    });

    if (result && !result.skipped && studentId && starDelta > 0 && Number(liveScoreData?.gloryBannerCharges) > 0) {
        try {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            await updateDoc(scoreRef, { gloryBannerCharges: increment(-Math.min(starDelta, Number(liveScoreData.gloryBannerCharges) || 0)) });
        } catch (_) { /* non-critical */ }
    }
    return result;
}

/**
 * Update guild scores when a student earns stars. Now also writes a Glory event.
 * @param {string} studentId
 * @param {number} starDelta - Positive number of stars to add
 */
export async function updateGuildScores(studentId, starDelta, source = 'star_award', { idempotencyKey = null } = {}) {
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
    });
}

export async function adjustGuildScoresForWheel(studentId, starDelta) {
    if (!studentId || starDelta >= 0) return;
    const student = _getStudent(studentId);
    const guildId = student?.guildId;
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
    return recordGuildGloryEvent({
        guildId,
        studentId,
        classId: student.classId || null,
        source: 'wheel_star_adjustment',
        starDelta,
    });
}

/** Track unique active members this week (fire-and-forget). */
async function _trackWeeklyActiveMember(guildId, studentId) {
    try {
        const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
        const snap = await getDoc(guildRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const weeklyActiveMemberIds = data.weeklyActiveMemberIds || [];
        if (!weeklyActiveMemberIds.includes(studentId)) {
            const { arrayUnion } = await import('../firebase.js');
            await updateDoc(guildRef, {
                weeklyActiveMemberIds: arrayUnion(studentId),
                weeklyActiveMembers: (weeklyActiveMemberIds.length + 1),
            });
        }
    } catch (_) { /* non-critical */ }
}

// ─── Glory Challenge tally ───────────────────────────────────────────────────

const _talliedChallengeKeys = new Set();

/**
 * Pays the Fortune's Wheel Glory Challenge bonus once its week has ended.
 * Called whenever guild scores arrive; the idempotent ledger event makes sure
 * the bonus lands exactly once even when several teachers have the app open.
 */
export async function settleGuildChallenges() {
    const allStudents = state.get('allStudents') || [];
    // Teachers write the ledger; other roles only read the Hall.
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    if (!allStudents.length || !isGameplaySeasonLiveFromAppState(state)) return;
    const members = {};
    for (const student of allStudents) {
        if (student.guildId) members[student.guildId] = (members[student.guildId] || 0) + 1;
    }
    const won = findWonGuildChallenges(state.get('allGuildScores') || {}, members)
        .filter(({ key }) => !_talliedChallengeKeys.has(key));
    for (const { guildId, bonus, key } of won) {
        _talliedChallengeKeys.add(key);
        try {
            await recordGuildGloryEvent({
                guildId,
                source: 'wheel_challenge_won',
                directGlory: Math.round(bonus * guildSizeScale(members, guildId)),
                note: 'Won the Glory Challenge: most Glory per member last week',
                idempotencyKey: key,
            });
        } catch (err) {
            _talliedChallengeKeys.delete(key);
            console.warn('Glory Challenge tally failed:', err);
        }
    }
}

/** Current member count per guild (active students of this school year). */
export function getGuildMemberCounts() {
    const counts = {};
    for (const student of state.get('allStudents') || []) {
        if (student.guildId && GUILD_IDS.includes(student.guildId)) counts[student.guildId] = (counts[student.guildId] || 0) + 1;
    }
    return counts;
}

/** How much bigger (or smaller) this guild is than the average guild; flat Glory is sized by it. */
export function getGuildSizeScale(guildId) {
    return guildSizeScale(getGuildMemberCounts(), guildId);
}

// ─── Per-member Glory ledger (so leavers' Glory leaves with them) ─────────────

let _memberGloryBackfillStarted = false;

/**
 * Builds guild_scores.memberGlory (Glory each member earned for the guild this year) from
 * the Glory ledger, once per school year. Runs from the guild listener when a guild's map is
 * missing or belongs to an earlier year; afterwards every Glory event keeps it current.
 */
export async function backfillGuildMemberGloryIfNeeded() {
    if (_memberGloryBackfillStarted) return;
    if ((state.get('currentUserRole') || 'teacher') !== 'teacher') return;
    const schoolYearKey = state.getActiveSchoolYearKey();
    const allGuildScores = state.get('allGuildScores') || {};
    const stale = GUILD_IDS.filter((gid) => {
        const data = allGuildScores[gid];
        return data && data.activeSchoolYearKey === schoolYearKey && data.memberGloryYear !== schoolYearKey;
    });
    if (!schoolYearKey || !stale.length) return;
    _memberGloryBackfillStarted = true;
    try {
        const byGuild = Object.fromEntries(stale.map((gid) => [gid, {}]));
        const eventsSnap = await getDocs(query(
            collection(db, `${publicDataPath}/guild_glory_events`),
            where('schoolYearKey', '==', schoolYearKey),
        ));
        eventsSnap.forEach((eventDoc) => {
            const e = eventDoc.data() || {};
            const map = byGuild[e.guildId];
            if (!map || !e.studentId) return;
            map[e.studentId] = Math.round(((map[e.studentId] || 0) + (Number(e.totalGloryDelta) || 0)) * 100) / 100;
        });
        for (const gid of stale) {
            await updateDoc(doc(db, `${publicDataPath}/guild_scores`, gid), {
                memberGlory: byGuild[gid],
                memberGloryYear: schoolYearKey,
            });
        }
    } catch (err) {
        _memberGloryBackfillStarted = false;
        console.warn('Guild member Glory backfill skipped:', err);
    }
}

const _correctedOrphanKeys = new Set();
let _orphanRetryScheduled = false;

/**
 * Takes back Glory still credited to members who have no stars this year (left over from
 * stars that were given and then taken back). Idempotent per member and amount, so several
 * open apps correct it once. Counts for the year only, never for this week's form.
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
                    affectsWeek: false,
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

// ─── Weekly Glory Reset ──────────────────────────────────────────────────────

/**
 * Check and perform weekly Glory reset if week has turned over.
 * Called on app load and guild tab open.
 */
export async function checkAndPerformWeeklyGloryReset() {
    const currentMonday = getISOWeekMonday();
    const allGuildScores = state.get('allGuildScores') || {};

    for (const guildId of GUILD_IDS) {
        const guildData = allGuildScores[guildId];
        if (!guildData) continue;
        const lastReset = guildData.lastWeeklyReset || '';
        if (lastReset >= currentMonday) continue; // Already reset this week

        const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
        try {
            await updateDoc(guildRef, {
                previousWeekGlory: resolveGuildWeek(guildData).previousWeekGlory,
                weeklyGlory: 0,
                weeklyActiveMembers: 0,
                weeklyActiveMemberIds: [],
                lastWeeklyReset: currentMonday,
                // Expire old modifiers
                gloryModifiers: (guildData.gloryModifiers || []).filter(m => m.expiresAt > Date.now()),
                lastUpdated: serverTimestamp(),
            });
        } catch (err) {
            console.error(`Weekly Glory reset failed for ${guildId}:`, err);
        }
    }
}

// ─── Guild Migration (one-time) ──────────────────────────────────────────────

/**
 * Migrate existing guild_scores docs to include Glory fields if missing.
 * Runs on first read — idempotent.
 */
export async function migrateGuildGloryIfNeeded() {
    const allGuildScores = state.get('allGuildScores') || {};
    for (const guildId of GUILD_IDS) {
        const data = allGuildScores[guildId];
        if (!data || data.totalGlory !== undefined) continue; // Already migrated or doesn't exist
        const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
        try {
            const totalGlory = (data.totalStars || 0) * GLORY_PER_STAR;
            await updateDoc(guildRef, {
                activeSchoolYearKey: state.getActiveSchoolYearKey(),
                totalGlory,
                monthlyGlory: 0,
                weeklyGlory: 0,
                previousWeekGlory: 0,
                weeklyActiveMembers: 0,
                weeklyActiveMemberIds: [],
                gloryModifiers: [],
                lastWeeklyReset: getISOWeekMonday(),
                chaliceActive: false,
                chaliceExpiresAt: 0,
            });
        } catch (err) {
            console.error(`Glory migration failed for ${guildId}:`, err);
        }
    }
    await reconcileGuildScoreCacheIfDrift();
}

/**
 * Reconciles guild_scores from the canonical event ledger when available,
 * and always repairs roster counts from current student assignments.
 */
export async function reconcileGuildScoreCacheIfDrift({ force = false } = {}) {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const schoolYearKey = state.getActiveSchoolYearKey();
    const weekStart = new Date(getISOWeekMonday());
    const weekStartMs = weekStart.getTime();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const emptyTotals = () => ({
        eventCount: 0,
        totalStars: 0,
        totalGlory: 0,
        monthlyGlory: 0,
        weeklyGlory: 0,
        weeklyActiveMemberIds: new Set(),
    });
    const totalsByGuild = Object.fromEntries(GUILD_IDS.map(gid => [gid, emptyTotals()]));

    try {
        const eventsRef = collection(db, `${publicDataPath}/guild_glory_events`);
        const eventsSnap = await getDocs(query(eventsRef, where('schoolYearKey', '==', schoolYearKey)));
        eventsSnap.forEach((eventDoc) => {
            const eventData = eventDoc.data() || {};
            const guildId = eventData.guildId;
            if (!GUILD_IDS.includes(guildId)) return;
            const bucket = totalsByGuild[guildId];
            const totalGloryDelta = Number(eventData.totalGloryDelta) || 0;
            const starDelta = Number(eventData.starDelta) || 0;
            const createdMs = _eventCreatedMs(eventData);
            bucket.eventCount += 1;
            bucket.totalStars += starDelta;
            bucket.totalGlory += totalGloryDelta;
            if (createdMs >= weekStartMs) {
                bucket.weeklyGlory += totalGloryDelta;
                if (eventData.studentId) bucket.weeklyActiveMemberIds.add(eventData.studentId);
            }
            if (createdMs) {
                const created = new Date(createdMs);
                const createdMonthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
                if (createdMonthKey === monthKey) bucket.monthlyGlory += totalGloryDelta;
            }
        });
    } catch (err) {
        console.warn('Guild Glory event reconciliation read failed:', err);
    }

    for (const guildId of GUILD_IDS) {
        const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
        const guildDef = GUILDS[guildId];
        const data = allGuildScores[guildId] || {};
        const rosterIds = allStudents
            .filter(student => student.guildId === guildId)
            .map(student => student.id)
            .filter(Boolean)
            .sort();
        const patch = {
            guildId,
            guildName: guildDef?.name || data.guildName || guildId,
            activeSchoolYearKey: schoolYearKey,
            memberCount: rosterIds.length,
            memberIds: rosterIds,
            lastUpdated: serverTimestamp(),
        };

        const totals = totalsByGuild[guildId];
        if (totals.eventCount > 0) {
            const weeklyActiveMemberIds = [...totals.weeklyActiveMemberIds].filter(id => rosterIds.includes(id)).sort();
            Object.assign(patch, {
                totalStars: Math.round(totals.totalStars * 100) / 100,
                totalGlory: Math.round(totals.totalGlory * 100) / 100,
                monthlyGlory: Math.round(totals.monthlyGlory * 100) / 100,
                weeklyGlory: Math.round(totals.weeklyGlory * 100) / 100,
                weeklyActiveMemberIds,
                weeklyActiveMembers: weeklyActiveMemberIds.length,
            });
        } else if (
            _sameIdSet(Array.isArray(data.memberIds) ? data.memberIds : [], rosterIds) &&
            Number(data.memberCount) === rosterIds.length &&
            !force
        ) {
            continue;
        }

        const hasLedgerDrift = totals.eventCount > 0 && (
            Math.abs((Number(data.totalStars) || 0) - patch.totalStars) > 0.01 ||
            Math.abs((Number(data.totalGlory) || 0) - patch.totalGlory) > 0.01 ||
            Math.abs((Number(data.monthlyGlory) || 0) - patch.monthlyGlory) > 0.01 ||
            Math.abs((Number(data.weeklyGlory) || 0) - patch.weeklyGlory) > 0.01 ||
            !_sameIdSet(Array.isArray(data.weeklyActiveMemberIds) ? data.weeklyActiveMemberIds : [], patch.weeklyActiveMemberIds || [])
        );
        const hasRosterDrift = !_sameIdSet(Array.isArray(data.memberIds) ? data.memberIds : [], rosterIds) ||
            Number(data.memberCount) !== rosterIds.length;

        if (!force && !hasLedgerDrift && !hasRosterDrift) continue;

        try {
            await setDoc(guildRef, patch, { merge: true });
        } catch (err) {
            console.error(`Guild score reconciliation failed for ${guildId}:`, err);
        }
    }
}

// ─── Composite Guild Power ───────────────────────────────────────────────────

/**
 * Calculate composite Guild Power score (0-100 scale).
 * @param {object} guildData - Enriched guild data with Glory fields
 * @param {number} maxPerCapitaGlory - Highest per-capita Glory among all guilds (for normalization)
 * @returns {{ guildPower: number, gloryScore: number, momentumScore: number, activityScore: number, momentumPct: number }}
 */
export function calculateGuildPower(guildData, maxima) {
    return calculateGuildPowerCore(guildData, maxima);
}

export { getMomentumArrow };

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * Returns sorted guild list for leaderboard with Glory & Guild Power metrics.
 * Primary sort: guildPower (composite). Fallback compatible with old perCapitaStars.
 */
export function getGuildLeaderboardData() {
    const now = Date.now();
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];

    // First pass: compute raw data
    const rawList = GUILD_IDS.map((gid) => {
        const gDoc = allGuildScores[gid] || {};
        const week = resolveGuildWeek(gDoc, now);
        const totalStars = Number(gDoc.totalStars) || 0;
        const totalGlory = gDoc.totalGlory !== undefined ? (Number(gDoc.totalGlory) || 0) : (totalStars * GLORY_PER_STAR);
        const memberIds = gDoc.memberIds || [];
        const members = allStudents.filter((s) => s.guildId === gid);
        const memberIdSet = new Set(members.map((s) => s.id));
        const memberCount = members.length || memberIds.length || 0;
        const { countedGlory, leaversGlory } = countedGuildGlory(gDoc, [...memberIdSet]);
        const guildDef = GUILDS[gid];

        const monthlyStars = members.reduce((sum, s) => {
            const sc = allStudentScores.find((sc) => sc.id === s.id);
            return sum + (Number(sc?.monthlyStars) || 0);
        }, 0);

        const safeMemberCount = Math.max(memberCount, 1);
        const perCapitaStars = memberCount > 0 ? Math.round((totalStars / safeMemberCount) * 10) / 10 : 0;
        const monthlyPerCapitaStars = memberCount > 0 ? Math.round((monthlyStars / safeMemberCount) * 10) / 10 : 0;

        const topContributors = members
            .map((s) => {
                const sc = allStudentScores.find((sc) => sc.id === s.id) || {};
                const totalStars = Number(sc.totalStars) || 0;
                const monthlyStars = Number(sc.monthlyStars) || 0;
                const gloryEstimate = Math.round(totalStars * GLORY_PER_STAR);
                return {
                    studentId: s.id,
                    name: s.name,
                    avatar: s.avatar,
                    totalStars,
                    monthlyStars,
                    gloryEstimate,
                };
            })
            .sort((a, b) => b.gloryEstimate - a.gloryEstimate || b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars)
            .slice(0, 4);

        return {
            guildId: gid,
            guildName: guildDef?.name || gDoc.guildName || gid,
            totalStars,
            monthlyStars,
            memberCount,
            perCapitaStars,
            monthlyPerCapitaStars,
            topContributors,
            // Glory fields
            totalGlory,
            countedGlory: gDoc.totalGlory !== undefined ? countedGlory : totalGlory,
            leaversGlory,
            monthlyGlory: Number(gDoc.monthlyGlory) || 0,
            weeklyGlory: week.weeklyGlory,
            previousWeekGlory: week.previousWeekGlory,
            // Only current members count, so a member who left never lifts the share above 100%.
            weeklyActiveMembers: countActiveMembersThisWeek(week, [...memberIdSet]),
            gloryModifiers: gDoc.gloryModifiers || [],
        };
    });

    // Second pass: calculate Guild Power (needs per-member maxima across non-empty guilds)
    const maxPerCapitaGlory = Math.max(...rawList.map(g => g.memberCount > 0 ? (g.countedGlory / g.memberCount) : 0)) || 1;
    const maxWeeklyPerCapitaGlory = Math.max(...rawList.map(g => g.memberCount > 0 ? ((Number(g.weeklyGlory) || 0) / g.memberCount) : 0)) || 1;

    const list = rawList.map(g => {
        const power = calculateGuildPower(g, { maxPerCapitaGlory, maxWeeklyPerCapitaGlory });
        return {
            ...g,
            ...power,
        };
    });

    // Sort by authoritative Guild Power with deterministic fair tie-breakers.
    list.sort(compareGuildLeaderboardRows);
    return list;
}

/**
 * Returns sorted guild leaderboard scoped to students in a specific class.
 * Guild Power rankings use global values from getGuildLeaderboardData()
 * so the AI log and class-specific views always match the Guild Hall order.
 */
export function getGuildLeaderboardForClass(classId) {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];

    // Only consider students in this class
    const classStudents = allStudents.filter(s => s.classId === classId);
    const classGuildIds = new Set(classStudents.map(s => s.guildId).filter(Boolean));

    if (classGuildIds.size === 0) return [];

    // Use global leaderboard for authoritative guildPower rankings (matches Guild Hall)
    const globalLeaderboard = getGuildLeaderboardData();
    const globalByGuildId = {};
    for (const entry of globalLeaderboard) {
        globalByGuildId[entry.guildId] = entry;
    }

    // Build class-scoped data but reuse global guildPower for ranking
    const list = GUILD_IDS
        .filter(gid => classGuildIds.has(gid))
        .map((gid) => {
            const gDoc = allGuildScores[gid] || {};
            const totalStars = Number(gDoc.totalStars) || 0;
            const members = classStudents.filter(s => s.guildId === gid);
            const global = globalByGuildId[gid] || {};
            const memberCount = members.length || 1;
            const guildDef = GUILDS[gid];

            const monthlyStars = members.reduce((sum, s) => {
                const sc = allStudentScores.find(sc => sc.id === s.id);
                return sum + (Number(sc?.monthlyStars) || 0);
            }, 0);

            const perCapitaStars = Math.round((totalStars / memberCount) * 10) / 10;
            const monthlyPerCapitaStars = Math.round((monthlyStars / memberCount) * 10) / 10;

            return {
                guildId: gid,
                guildName: guildDef?.name || gDoc.guildName || gid,
                totalStars,
                monthlyStars,
                memberCount,
                perCapitaStars,
                monthlyPerCapitaStars,
                totalGlory: global.totalGlory ?? (totalStars * GLORY_PER_STAR),
                monthlyGlory: Number(gDoc.monthlyGlory) || 0,
                weeklyGlory: global.weeklyGlory ?? 0,
                previousWeekGlory: global.previousWeekGlory ?? 0,
                weeklyActiveMembers: global.weeklyActiveMembers ?? 0,
                gloryModifiers: gDoc.gloryModifiers || [],
                // Global Guild Power metrics — authoritative for ranking
                guildPower: global.guildPower || 0,
                gloryScore: global.gloryScore ?? 0,
                momentumScore: global.momentumScore ?? 0,
                activityScore: global.activityScore ?? 0,
                momentumPct: global.momentumPct ?? 0,
                momentumArrow: global.momentumArrow ?? getMomentumArrow(global.momentumPct ?? 0),
                perCapitaGlory: global.perCapitaGlory ?? 0,
                seasonGloryPerMember: global.seasonGloryPerMember ?? 0,
                weeklyPerCapitaGlory: global.weeklyPerCapitaGlory ?? 0,
            };
        });

    // Sort by global guildPower (desc), matching Guild Hall order
    list.sort(compareGuildLeaderboardRows);
    return list;
}

export { compareGuildLeaderboardRows };

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
