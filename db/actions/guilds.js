// /db/actions/guilds.js — Guild assignment, score doc creation, member tracking

import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    increment,
} from '../../firebase.js';
import * as state from '../../state.js';
import { GUILDS, GUILD_IDS } from '../../features/guilds.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

/**
 * Assign a student to a guild. Updates student doc and ensures guild_scores doc exists with member tracking.
 * @param {string} studentId
 * @param {string} guildId
 */
export async function assignStudentToGuild(studentId, guildId) {
    if (!studentId || !guildId || !GUILD_IDS.includes(guildId)) return;

    const studentRef = doc(db, `${publicDataPath}/students`, studentId);
    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);

    const guildDef = GUILDS[guildId];
    const guildName = guildDef?.name || guildId;

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
            totalStars: 0,
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
 * Get guild leaderboard snapshot (for ceremony or export). Prefer reading from state.allGuildScores when in app.
 * @returns {Promise<Array<{ guildId: string, guildName: string, totalStars: number, memberCount: number }>>}
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
            memberCount: Number(data.memberCount) || 0,
        };
    });
    list.sort((a, b) => b.totalStars - a.totalStars);
    return list;
}
