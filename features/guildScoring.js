// /features/guildScoring.js — Real-time guild score aggregation with Glory currency & composite Guild Power

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
import { GLORY_PER_STAR, GUILD_POWER_WEIGHTS } from '../constants.js';

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

/** Get ISO Monday date string for the start of this week. */
function getISOWeekMonday(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().substring(0, 10);
}

// ─── Core scoring ────────────────────────────────────────────────────────────

/**
 * Update guild scores when a student earns stars. Now also updates Glory.
 * @param {string} studentId
 * @param {number} starDelta - Positive number of stars to add
 */
export async function updateGuildScores(studentId, starDelta) {
    if (!studentId || starDelta <= 0) return;
    const students = state.get('allStudents') || [];
    const student = students.find((s) => s.id === studentId);
    const guildId = student?.guildId;
    if (!guildId || !GUILD_IDS.includes(guildId)) return;

    // Calculate Glory with modifiers
    let gloryDelta = starDelta * GLORY_PER_STAR;

    // Check student inventory for Glory-boosting artifact effects
    const allScores = state.get('allStudentScores') || [];
    const studentScore = allScores.find(sc => sc.id === studentId);
    if (studentScore?.gloryBannerCharges > 0) {
        gloryDelta += 1; // +1 bonus Glory per star while Banner charges remain
    }

    // Check active guild modifiers (from Fortune's Wheel)
    const allGuildScores = state.get('allGuildScores') || {};
    const guildData = allGuildScores[guildId] || {};
    const now = Date.now();
    const modifiers = (guildData.gloryModifiers || []).filter(m => m.expiresAt > now);
    for (const mod of modifiers) {
        if (mod.type === 'multiply') {
            gloryDelta = Math.round(gloryDelta * mod.factor);
        } else if (mod.type === 'bonus_per_star') {
            gloryDelta += mod.amount * starDelta;
        }
    }

    // Check guild-wide Chalice of Radiance effect
    if (guildData.chaliceActive && guildData.chaliceExpiresAt > now) {
        gloryDelta += 1;
    }

    const guildRef = doc(db, `${publicDataPath}/guild_scores`, guildId);
    try {
        const snap = await getDoc(guildRef);
        if (snap.exists()) {
            const updates = {
                totalStars: increment(starDelta),
                totalGlory: increment(gloryDelta),
                monthlyGlory: increment(gloryDelta),
                weeklyGlory: increment(gloryDelta),
                lastUpdated: serverTimestamp(),
            };
            await updateDoc(guildRef, updates);
        } else {
            const guildDef = GUILDS[guildId];
            await setDoc(guildRef, {
                guildId,
                guildName: guildDef?.name || guildId,
                totalStars: starDelta,
                totalGlory: gloryDelta,
                monthlyGlory: gloryDelta,
                weeklyGlory: gloryDelta,
                previousWeekGlory: 0,
                weeklyActiveMembers: 1,
                memberCount: 0,
                memberIds: [],
                gloryModifiers: [],
                lastWeeklyReset: getISOWeekMonday(),
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
            });
        }
    } catch (err) {
        console.error('updateGuildScores failed:', err);
    }

    // Decrement Banner charges locally (Firestore update happens in powerUps)
    if (studentScore?.gloryBannerCharges > 0) {
        try {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            await updateDoc(scoreRef, { gloryBannerCharges: increment(-1) });
        } catch (_) { /* non-critical */ }
    }

    // Track weekly active member
    _trackWeeklyActiveMember(guildId, studentId);
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
}

// ─── Composite Guild Power ───────────────────────────────────────────────────

/**
 * Calculate composite Guild Power score (0-100 scale).
 * @param {object} guildData - Enriched guild data with Glory fields
 * @param {number} maxPerCapitaGlory - Highest per-capita Glory among all guilds (for normalization)
 * @returns {{ guildPower: number, gloryScore: number, momentumScore: number, activityScore: number, momentumPct: number }}
 */
export function calculateGuildPower(guildData, maxPerCapitaGlory) {
    const memberCount = Math.max(guildData.memberCount || 1, 1);
    const totalGlory = Number(guildData.totalGlory) || 0;
    const weeklyGlory = Number(guildData.weeklyGlory) || 0;
    const previousWeekGlory = Number(guildData.previousWeekGlory) || 0;
    const weeklyActiveMembers = Number(guildData.weeklyActiveMembers) || 0;

    // 1. Glory Score: per-capita Glory normalized against leader (0-100)
    const perCapitaGlory = totalGlory / memberCount;
    const normalizedMax = Math.max(maxPerCapitaGlory, 1);
    const gloryScore = Math.min(100, (perCapitaGlory / normalizedMax) * 100);

    // 2. Momentum Score: week-over-week change (0-100)
    // -100% change = 0, 0% change = 50, +100% change = 100, clamped [-100%, +200%]
    let momentumPct = 0;
    if (previousWeekGlory > 0) {
        momentumPct = ((weeklyGlory - previousWeekGlory) / previousWeekGlory) * 100;
    } else if (weeklyGlory > 0) {
        momentumPct = 100; // First week with activity = strong positive signal
    }
    // Clamp to [-100, +200]
    momentumPct = Math.max(-100, Math.min(200, momentumPct));
    // Map [-100, +200] → [0, 100]
    const momentumScore = ((momentumPct + 100) / 300) * 100;

    // 3. Activity Score: weekly active members / total members (0-100)
    const activityScore = Math.min(100, (weeklyActiveMembers / memberCount) * 100);

    // Composite
    const guildPower = Math.round(
        (gloryScore * GUILD_POWER_WEIGHTS.glory +
         momentumScore * GUILD_POWER_WEIGHTS.momentum +
         activityScore * GUILD_POWER_WEIGHTS.activity) * 10
    ) / 10;

    return {
        guildPower: Math.max(0, guildPower),
        gloryScore: Math.round(gloryScore * 10) / 10,
        momentumScore: Math.round(momentumScore * 10) / 10,
        activityScore: Math.round(activityScore * 10) / 10,
        momentumPct: Math.round(momentumPct),
        perCapitaGlory: Math.round(perCapitaGlory * 10) / 10,
    };
}

/** Get momentum trend arrow from percentage. */
export function getMomentumArrow(pct) {
    if (pct >= 50) return '⬆️';
    if (pct >= 15) return '↗️';
    if (pct > -15) return '➡️';
    if (pct > -50) return '↘️';
    return '⬇️';
}

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
        const memberCount = members.length || memberIds.length || 1;
        const guildDef = GUILDS[gid];

        const monthlyStars = members.reduce((sum, s) => {
            const sc = allStudentScores.find((sc) => sc.id === s.id);
            return sum + (Number(sc?.monthlyStars) || 0);
        }, 0);

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
            .sort((a, b) => b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars)
            .slice(0, 3);

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

    // Second pass: calculate Guild Power (needs max per-capita Glory)
    const maxPerCapitaGlory = Math.max(...rawList.map(g => (g.totalGlory / Math.max(g.memberCount, 1)))) || 1;

    const list = rawList.map(g => {
        const power = calculateGuildPower(g, maxPerCapitaGlory);
        return {
            ...g,
            ...power,
        };
    });

    // Sort by composite Guild Power (desc), then by perCapitaGlory as tiebreaker
    list.sort((a, b) => b.guildPower - a.guildPower || b.perCapitaGlory - a.perCapitaGlory || b.totalGlory - a.totalGlory);
    return list;
}

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
