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
    query,
    where,
    increment,
    serverTimestamp,
} from '../firebase.js';
import * as state from '../state.js';
import { GUILDS, GUILD_IDS } from './guilds.js';
import { GLORY_PER_STAR, GUILD_POWER_WEIGHTS } from '../constants.js';
import {
    calculateGuildGloryDelta,
    calculateGuildPower as calculateGuildPowerCore,
    compareGuildLeaderboardRows,
    getMomentumArrow,
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

/** Get ISO Monday date string for the start of this week. */
function getISOWeekMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().substring(0, 10);
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

function _buildGuildScorePatch({ guildId, guildDef, starDelta, totalGloryDelta, guildData = {}, studentId, now = Date.now(), consumedGloryModifiers = null }) {
    const patch = {
        guildId,
        guildName: guildDef?.name || guildData.guildName || guildId,
        activeSchoolYearKey: state.getActiveSchoolYearKey(),
        totalStars: increment(starDelta || 0),
        totalGlory: increment(totalGloryDelta || 0),
        monthlyGlory: increment(totalGloryDelta || 0),
        weeklyGlory: increment(totalGloryDelta || 0),
        lastUpdated: serverTimestamp(),
    };
    if (!guildData.lastWeeklyReset) patch.lastWeeklyReset = getISOWeekMonday(new Date(now));
    if (Array.isArray(consumedGloryModifiers)) patch.gloryModifiers = consumedGloryModifiers;
    if (studentId) {
        const ids = Array.isArray(guildData.weeklyActiveMemberIds) ? guildData.weeklyActiveMemberIds : [];
        if (!ids.includes(studentId)) {
            patch.weeklyActiveMemberIds = [...ids, studentId];
            patch.weeklyActiveMembers = ids.length + 1;
        }
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
} = {}) {
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
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
    const delta = calculateGuildGloryDelta({
        starDelta,
        directGlory,
        scoreData: liveScoreData,
        guildData: liveGuildData,
        gloryPerStar: GLORY_PER_STAR,
        now,
    });

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
                memberCount: 0,
                memberIds: [],
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

/**
 * Update guild scores when a student earns stars. Now also writes a Glory event.
 * @param {string} studentId
 * @param {number} starDelta - Positive number of stars to add
 */
export async function updateGuildScores(studentId, starDelta, source = 'star_award') {
    if (!studentId || starDelta <= 0) return;
    const student = _getStudent(studentId);
    const guildId = student?.guildId;
    if (!guildId || !GUILD_IDS.includes(guildId)) return;
    return recordGuildGloryEvent({
        guildId,
        studentId,
        classId: student.classId || null,
        source,
        starDelta,
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
                previousWeekGlory: guildData.weeklyGlory || 0,
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
    return calculateGuildPowerCore(guildData, maxima, GUILD_POWER_WEIGHTS);
}

export { getMomentumArrow };

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * Returns sorted guild list for leaderboard with Glory & Guild Power metrics.
 * Primary sort: guildPower (composite). Fallback compatible with old perCapitaStars.
 */
export function getGuildLeaderboardData() {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];

    // First pass: compute raw data
    const rawList = GUILD_IDS.map((gid) => {
        const gDoc = allGuildScores[gid] || {};
        const totalStars = Number(gDoc.totalStars) || 0;
        const totalGlory = Number(gDoc.totalGlory) || (totalStars * GLORY_PER_STAR);
        const memberIds = gDoc.memberIds || [];
        const members = allStudents.filter((s) => s.guildId === gid);
        const memberCount = members.length || memberIds.length || 0;
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
            monthlyGlory: Number(gDoc.monthlyGlory) || 0,
            weeklyGlory: Number(gDoc.weeklyGlory) || 0,
            previousWeekGlory: Number(gDoc.previousWeekGlory) || 0,
            weeklyActiveMembers: Number(gDoc.weeklyActiveMembers) || 0,
            gloryModifiers: gDoc.gloryModifiers || [],
        };
    });

    // Second pass: calculate Guild Power (needs per-member maxima across non-empty guilds)
    const maxPerCapitaGlory = Math.max(...rawList.map(g => g.memberCount > 0 ? (g.totalGlory / g.memberCount) : 0)) || 1;
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
            const memberCount = members.length || 1;
            const guildDef = GUILDS[gid];

            const monthlyStars = members.reduce((sum, s) => {
                const sc = allStudentScores.find(sc => sc.id === s.id);
                return sum + (Number(sc?.monthlyStars) || 0);
            }, 0);

            const perCapitaStars = Math.round((totalStars / memberCount) * 10) / 10;
            const monthlyPerCapitaStars = Math.round((monthlyStars / memberCount) * 10) / 10;

            // Pull global Guild Power values so rankings match the Guild Hall
            const global = globalByGuildId[gid] || {};

            return {
                guildId: gid,
                guildName: guildDef?.name || gDoc.guildName || gid,
                totalStars,
                monthlyStars,
                memberCount,
                perCapitaStars,
                monthlyPerCapitaStars,
                totalGlory: Number(gDoc.totalGlory) || (totalStars * GLORY_PER_STAR),
                monthlyGlory: Number(gDoc.monthlyGlory) || 0,
                weeklyGlory: Number(gDoc.weeklyGlory) || 0,
                previousWeekGlory: Number(gDoc.previousWeekGlory) || 0,
                weeklyActiveMembers: Number(gDoc.weeklyActiveMembers) || 0,
                gloryModifiers: gDoc.gloryModifiers || [],
                // Global Guild Power metrics — authoritative for ranking
                guildPower: global.guildPower || 0,
                gloryScore: global.gloryScore ?? 0,
                momentumScore: global.momentumScore ?? 0,
                activityScore: global.activityScore ?? 0,
                momentumPct: global.momentumPct ?? 0,
                momentumArrow: global.momentumArrow ?? getMomentumArrow(global.momentumPct ?? 0),
                perCapitaGlory: global.perCapitaGlory ?? 0,
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
