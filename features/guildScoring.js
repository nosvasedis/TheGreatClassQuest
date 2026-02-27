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
 * Returns sorted guild list for leaderboard: guildId, guildName, totalStars, memberCount,
 * monthlyStars, perCapitaStars, monthlyPerCapitaStars, top contributors.
 * Sorted by monthlyPerCapitaStars (fairest metric across guilds of different sizes).
 * Uses in-memory state for sub-500ms response.
 */
export function getGuildLeaderboardData() {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];

    const list = GUILD_IDS.map((gid) => {
        const doc = allGuildScores[gid] || {};
        const totalStars = Number(doc.totalStars) || 0;
        const memberIds = doc.memberIds || [];
        const members = allStudents.filter((s) => s.guildId === gid);
        const memberCount = members.length || memberIds.length || 1; // avoid div by zero
        const guildDef = GUILDS[gid];

        // Monthly stars: sum of all members' current monthlyStars
        const monthlyStars = members.reduce((sum, s) => {
            const sc = allStudentScores.find((sc) => sc.id === s.id);
            return sum + (Number(sc?.monthlyStars) || 0);
        }, 0);

        // Per-capita metrics (rounded to 1 decimal)
        const perCapitaStars = Math.round((totalStars / memberCount) * 10) / 10;
        const monthlyPerCapitaStars = Math.round((monthlyStars / memberCount) * 10) / 10;

        const topContributors = members
            .map((s) => ({
                studentId: s.id,
                name: s.name,
                avatar: s.avatar,
                totalStars: Number((allStudentScores.find((sc) => sc.id === s.id) || {}).totalStars) || 0,
                monthlyStars: Number((allStudentScores.find((sc) => sc.id === s.id) || {}).monthlyStars) || 0,
            }))
            .sort((a, b) => b.monthlyStars - a.monthlyStars)
            .slice(0, 3);

        return {
            guildId: gid,
            guildName: guildDef?.name || doc.guildName || gid,
            totalStars,
            monthlyStars,
            memberCount,
            perCapitaStars,
            monthlyPerCapitaStars,
            topContributors,
        };
    });

    // Sort by monthly per-capita stars (fairest), then by total stars as tiebreaker
    list.sort((a, b) => b.monthlyPerCapitaStars - a.monthlyPerCapitaStars || b.totalStars - a.totalStars);
    return list;
}


/**
 * Returns the current month's guild champion for each guild as { guildId → { studentId, studentName, avatar, monthlyStars } }.
 * Computed in-memory — no Firestore query needed for live display.
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
