// /features/guildScoring.js — Real-time guild score aggregation (total stars, no monthly reset)

import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    serverTimestamp,
} from '../firebase.js';
import * as state from '../state.js';
import { GUILDS, GUILD_IDS } from './guilds.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

/**
 * Update guild total stars when a student earns stars. Guild progress is cumulative for the school year (no monthly reset).
 * @param {string} studentId
 * @param {number} starDelta - Positive number of stars to add to the guild
 */
export async function updateGuildScores(studentId, starDelta) {
    if (!studentId || starDelta <= 0) return;
    const students = state.get('allStudents') || [];
    const student = students.find((s) => s.id === studentId);
    const guildId = student?.guildId;
    if (!guildId || !GUILD_IDS.includes(guildId)) return;

    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    try {
        const snap = await getDoc(guildRef);
        if (snap.exists()) {
            await updateDoc(guildRef, {
                totalStars: increment(starDelta),
                lastUpdated: serverTimestamp(),
            });
        } else {
            const guildDef = GUILDS[guildId];
            await setDoc(guildRef, {
                guildId,
                guildName: guildDef?.name || guildId,
                totalStars: starDelta,
                memberCount: 0,
                memberIds: [],
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
            });
        }
    } catch (err) {
        console.error('updateGuildScores failed:', err);
    }
}

/**
 * Returns sorted guild list for leaderboard: guildId, guildName, totalStars, memberCount, top contributors.
 * Uses in-memory state for sub-500ms response.
 * @returns {Array<{ guildId: string, guildName: string, totalStars: number, memberCount: number, topContributors: Array<{ name: string, avatar?: string, totalStars: number }> }>}
 */
export function getGuildLeaderboardData() {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];

    const list = GUILD_IDS.map((gid) => {
        const doc = allGuildScores[gid] || {};
        const totalStars = Number(doc.totalStars) || 0;
        const memberIds = doc.memberIds || [];
        const memberCount = memberIds.length || allStudents.filter((s) => s.guildId === gid).length;
        const guildDef = GUILDS[gid];
        const members = allStudents.filter((s) => s.guildId === gid);
        const topContributors = members
            .map((s) => ({
                studentId: s.id,
                name: s.name,
                avatar: s.avatar,
                totalStars: Number((allStudentScores.find((sc) => sc.id === s.id) || {}).totalStars) || 0,
            }))
            .sort((a, b) => b.totalStars - a.totalStars)
            .slice(0, 3);

        return {
            guildId: gid,
            guildName: guildDef?.name || doc.guildName || gid,
            totalStars,
            memberCount,
            topContributors,
        };
    });

    list.sort((a, b) => b.totalStars - a.totalStars);
    return list;
}
