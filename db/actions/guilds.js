// /db/actions/guilds.js — Guild assignment, score doc creation, member tracking, Fortune's Wheel persistence

import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    increment,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
} from '../../firebase.js';
import * as state from '../../state.js';
import { GUILDS, GUILD_IDS } from '../../features/guilds.js';
import { getISOWeekKey } from '../../features/guildScoring.js';
import { GLORY_PER_STAR } from '../../constants.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

/**
 * Assign a student to a guild. Updates student doc and ensures guild_scores doc exists with member tracking.
 * Now includes Glory fields in new guild_scores docs.
 */
export async function assignStudentToGuild(studentId, guildId) {
    if (!studentId || !guildId || !GUILD_IDS.includes(guildId)) return;

    const studentRef = doc(db, `${publicDataPath}/students`, studentId);
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);

    const guildDef = GUILDS[guildId];
    const guildName = guildDef?.name || guildId;

    // Calculate student's existing Glory contribution
    const allScores = state.get('allStudentScores') || [];
    const studentScore = allScores.find(sc => sc.id === studentId);
    const studentGloryContribution = (Number(studentScore?.totalStars) || 0) * GLORY_PER_STAR;

    const guildSnap = await getDoc(guildRef);
    if (guildSnap.exists()) {
        const updates = {
            memberIds: arrayUnion(studentId),
            memberCount: increment(1),
            lastUpdated: serverTimestamp(),
        };
        // Add student's existing Glory when joining
        if (studentGloryContribution > 0) {
            updates.totalGlory = increment(studentGloryContribution);
        }
        await updateDoc(guildRef, updates);
    } else {
        await setDoc(guildRef, {
            guildId,
            guildName,
            totalStars: 0,
            totalGlory: studentGloryContribution,
            monthlyGlory: 0,
            weeklyGlory: 0,
            previousWeekGlory: 0,
            weeklyActiveMembers: 0,
            weeklyActiveMemberIds: [],
            gloryModifiers: [],
            chaliceActive: false,
            chaliceExpiresAt: 0,
            lastWeeklyReset: new Date().toISOString().substring(0, 10),
            memberCount: 1,
            memberIds: [studentId],
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
        });
    }

    await updateDoc(studentRef, {
        guildId,
        guildAssignmentDate: serverTimestamp(),
    });
}

/**
 * Get guild leaderboard snapshot. Prefer reading from state.allGuildScores when in app.
 */
export async function getGuildLeaderboardSnapshot() {
    const allGuildScores = state.get('allGuildScores') || {};
    const list = GUILD_IDS.map((gid) => {
        const data = allGuildScores[gid] || {};
        const guildDef = GUILDS[gid];
        return {
            guildId: gid,
            guildName: guildDef?.name || data.guildName || gid,
            totalStars: Number(data.totalStars) || 0,
            totalGlory: Number(data.totalGlory) || 0,
            memberCount: Number(data.memberCount) || 0,
        };
    });
    list.sort((a, b) => b.totalGlory - a.totalGlory);
    return list;
}

// ─── Fortune's Wheel Persistence ─────────────────────────────────────────────

/**
 * Save Fortune's Wheel spin results for a class.
 * @param {string} classId
 * @param {Array} results - Array of { guildId, segmentId, segmentLabel, segmentDescription, rarity, applied, affectedStudents, gloryDelta, modifierCreated }
 */
export async function saveFortuneWheelResult(classId, results) {
    const weekKey = getISOWeekKey();
    const docRef = doc(collection(db, `${publicDataPath}/fortune_wheel_log`));
    await setDoc(docRef, {
        classId,
        weekKey,
        spunAt: serverTimestamp(),
        spunBy: {
            uid: state.get('currentUserId'),
            name: state.get('currentTeacherName'),
        },
        results,
    });
}

/**
 * Check if the wheel has already been spun this week for a class.
 * @param {string} classId
 * @returns {Promise<boolean>}
 */
export async function hasSpunThisWeek(classId) {
    if (!classId) return true;
    const weekKey = getISOWeekKey();
    const q = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        where('classId', '==', classId),
        where('weekKey', '==', weekKey),
        limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
}

/**
 * Get recent wheel results for a class.
 * @param {string} classId
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
export async function getRecentWheelResults(classId, maxResults = 4) {
    if (!classId) return [];
    const q = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        where('classId', '==', classId),
        orderBy('spunAt', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Apply a Glory modifier to a guild (from Fortune's Wheel).
 * @param {string} guildId
 * @param {{ type: string, factor?: number, amount?: number, expiresAt: number, label: string }} modifier
 */
export async function applyGloryModifier(guildId, modifier) {
    if (!guildId || !modifier) return;
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    await updateDoc(guildRef, {
        gloryModifiers: arrayUnion(modifier),
        lastUpdated: serverTimestamp(),
    });
}

/**
 * Adjust guild Glory instantly (positive or negative delta).
 * @param {string} guildId
 * @param {number} delta - Can be negative
 * @param {string} reason - Audit label
 */
export async function adjustGuildGlory(guildId, delta, reason = 'wheel') {
    if (!guildId || delta === 0) return;
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    await updateDoc(guildRef, {
        totalGlory: increment(delta),
        weeklyGlory: increment(delta),
        monthlyGlory: increment(delta),
        lastUpdated: serverTimestamp(),
    });
}
