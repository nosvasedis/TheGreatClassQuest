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
    limit,
    getDocs,
} from '../../firebase.js';
import * as state from '../../state.js';
import { GUILDS, GUILD_IDS } from '../../features/guilds.js';
import { getISOWeekKey, recordGuildGloryEvent } from '../../features/guildScoring.js';
import { GLORY_PER_STAR } from '../../constants.js';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { PUBLIC_DATA_PATH as publicDataPath } from '../../utils/tenant.mjs';


/**
 * Assign a student to a guild. Updates student doc and ensures guild_scores doc exists with member tracking.
 * Now includes Glory fields in new guild_scores docs.
 */
export async function assignStudentToGuild(studentId, guildId) {
    if (!studentId || !guildId || !GUILD_IDS.includes(guildId)) return;
    // Guilds are for life: a student who already belongs to a guild keeps it.
    const existing = (state.get('allStudents') || []).find(s => s.id === studentId);
    if (existing?.guildId && GUILD_IDS.includes(existing.guildId)) return;

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
        await updateDoc(guildRef, {
            memberIds: arrayUnion(studentId),
            memberCount: increment(1),
            lastUpdated: serverTimestamp(),
        });
    } else {
        await setDoc(guildRef, {
            guildId,
            guildName,
            activeSchoolYearKey: state.getActiveSchoolYearKey(),
            totalStars: 0,
            totalGlory: 0,
            memberCount: 1,
            memberIds: [studentId],
            memberGlory: {},
            memberGloryYear: state.getActiveSchoolYearKey(),
            chapters: {},
            sealedChapters: {},
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
        });
    }
    // Stars the student already earned this year come with them, written to the Glory
    // ledger like every other Glory change (so it can be checked and taken back).
    if (studentGloryContribution > 0) {
        await recordGuildGloryEvent({
            guildId,
            studentId,
            source: 'guild_join',
            exactGlory: studentGloryContribution,
            // They count for the year, not for the Chapter running now.
            chapter: false,
            note: 'Stars earned before joining the guild',
        });
    }

    await updateDoc(studentRef, {
        guildId,
        guildAssignmentDate: serverTimestamp(),
    });
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
    await setDoc(docRef, withSchoolYear({
        classId,
        weekKey,
        spunAt: serverTimestamp(),
        spunBy: {
            uid: state.get('currentUserId'),
            name: state.get('currentTeacherName'),
        },
        results,
    }, state.getActiveSchoolYearKey()));
}

/**
 * Check if the wheel has already been spun this week for a class.
 * @param {string} classId
 * @returns {Promise<boolean>}
 */
export async function hasSpunThisWeek(classId) {
    if (!classId) return true;
    const schoolYearKey = state.getActiveSchoolYearKey();
    if (!schoolYearKey) return true;
    const weekKey = getISOWeekKey();
    const q = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        where('schoolYearKey', '==', schoolYearKey),
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
    const schoolYearKey = state.getActiveSchoolYearKey();
    if (!schoolYearKey) return [];
    const q = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        where('schoolYearKey', '==', schoolYearKey),
        where('classId', '==', classId),
        limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
            const aTime = typeof a.spunAt?.toMillis === 'function' ? a.spunAt.toMillis() : new Date(a.spunAt || 0).getTime();
            const bTime = typeof b.spunAt?.toMillis === 'function' ? b.spunAt.toMillis() : new Date(b.spunAt || 0).getTime();
            return bTime - aTime;
        })
        .slice(0, maxResults);
}

/**
 * Adjust guild Glory instantly (positive or negative delta).
 * @param {string} guildId
 * @param {number} delta - Can be negative
 * @param {string} reason - Audit label
 */
export async function adjustGuildGlory(guildId, delta, reason = 'wheel') {
    if (!guildId || delta === 0) return;
    await recordGuildGloryEvent({
        guildId,
        source: reason,
        directGlory: delta,
        note: reason,
    });
}
