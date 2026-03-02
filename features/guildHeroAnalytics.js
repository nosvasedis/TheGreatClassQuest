// /features/guildHeroAnalytics.js
// Aggregates guild hero analytics from in-memory state.

import * as state from '../state.js';
import { getGuildLeaderboardData } from './guildScoring.js';
import { GUILD_IDS, getGuildById } from './guilds.js';

/**
 * @typedef {Object} HeroRow
 * @property {string} studentId
 * @property {string} name
 * @property {string|null} avatar
 * @property {string} heroClass
 * @property {string|null} classId
 * @property {string} className
 * @property {number} totalStars
 * @property {number} monthlyStars
 * @property {number} contributionPct
 */

/**
 * @typedef {Object} GuildAnalytics
 * @property {string} guildId
 * @property {string} guildName
 * @property {string} emoji
 * @property {{ primary: string, secondary: string, glow: string }} colors
 * @property {{ totalStars: number, monthlyStars: number, memberCount: number, perCapitaStars: number, monthlyPerCapitaStars: number }} totals
 * @property {{ monthlyChampion: HeroRow|null, allTimeChampion: HeroRow|null }} champions
 * @property {HeroRow[]} heroesTop
 * @property {{ activeHeroes: number, activeRatePct: number, top3SharePct: number, classContributions: Array<{classId: string|null, className: string, totalStars: number, sharePct: number}>, heroClassMix: Array<{heroClass: string, count: number}> }} breakdown
 * @property {{ rankByPerCapita: number, deltaToLeaderPerCapita: number, deltaToLeaderTotal: number }} comparison
 */

/**
 * @typedef {Object} GuildHeroAnalyticsPayload
 * @property {string} generatedAtMonthKey
 * @property {GuildAnalytics[]} guilds
 * @property {{ leaderGuildId: string|null, overallTopChampion: HeroRow|null, closestRace: {guildAId: string, guildBId: string, perCapitaGap: number, totalStarsGap: number}|null }} overview
 */

function _getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function _toHeroRow(student, score, guildTotal, className) {
    const totalStars = Number(score?.totalStars) || 0;
    const monthlyStars = Number(score?.monthlyStars) || 0;
    const contributionPct = guildTotal > 0 ? Math.round((totalStars / guildTotal) * 1000) / 10 : 0;
    return {
        studentId: student.id,
        name: student.name || 'Unknown Hero',
        avatar: student.avatar || null,
        heroClass: student.heroClass || 'Novice',
        classId: student.classId || null,
        className: className || 'Unassigned Class',
        totalStars,
        monthlyStars,
        contributionPct
    };
}

function _pickMonthlyChampion(persisted, heroesSortedByMonthly) {
    if (persisted?.studentId) {
        const fromRows = heroesSortedByMonthly.find(h => h.studentId === persisted.studentId);
        if (fromRows) {
            return {
                ...fromRows,
                monthlyStars: Number(persisted.monthlyStars) || fromRows.monthlyStars
            };
        }
        return {
            studentId: persisted.studentId,
            name: persisted.studentName || 'Unknown Hero',
            avatar: persisted.avatar || null,
            heroClass: 'Novice',
            classId: null,
            className: 'Unknown Class',
            totalStars: 0,
            monthlyStars: Number(persisted.monthlyStars) || 0,
            contributionPct: 0
        };
    }

    const fallback = heroesSortedByMonthly[0] || null;
    if (!fallback) return null;
    if (fallback.monthlyStars <= 0) return null;
    return fallback;
}

/**
 * Returns analytics for all guilds.
 * @returns {GuildHeroAnalyticsPayload}
 */
export function getGuildHeroAnalytics() {
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const guildChampions = state.get('guildChampions') || {};

    const scoreById = new Map(allStudentScores.map(s => [s.id, s]));
    const classById = new Map(allSchoolClasses.map(c => [c.id, c]));
    const leaderboard = getGuildLeaderboardData();
    const leaderboardByGuild = new Map(leaderboard.map((g, idx) => [g.guildId, { ...g, rankByPerCapita: idx + 1 }]));
    const leader = leaderboard[0] || null;

    /** @type {GuildAnalytics[]} */
    const guilds = GUILD_IDS.map((guildId) => {
        const guild = getGuildById(guildId);
        const lb = leaderboardByGuild.get(guildId) || {
            guildId,
            guildName: guild?.name || guildId,
            totalStars: 0,
            monthlyStars: 0,
            memberCount: 0,
            perCapitaStars: 0,
            monthlyPerCapitaStars: 0,
            rankByPerCapita: GUILD_IDS.length
        };

        const members = allStudents.filter(s => s.guildId === guildId);
        const heroRows = members.map((student) => {
            const score = scoreById.get(student.id);
            const className = classById.get(student.classId)?.name || 'Unassigned Class';
            return _toHeroRow(student, score, lb.totalStars, className);
        });

        const heroesByTotal = [...heroRows].sort((a, b) =>
            b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars || a.name.localeCompare(b.name)
        );
        const heroesByMonthly = [...heroRows].sort((a, b) =>
            b.monthlyStars - a.monthlyStars || b.totalStars - a.totalStars || a.name.localeCompare(b.name)
        );

        const activeHeroes = heroRows.filter(h => h.monthlyStars > 0).length;
        const top3Total = heroesByTotal.slice(0, 3).reduce((sum, h) => sum + h.totalStars, 0);

        const classBuckets = new Map();
        heroRows.forEach((h) => {
            const prev = classBuckets.get(h.classId || '') || { classId: h.classId, className: h.className, totalStars: 0 };
            prev.totalStars += h.totalStars;
            classBuckets.set(h.classId || '', prev);
        });

        const classContributions = Array.from(classBuckets.values())
            .sort((a, b) => b.totalStars - a.totalStars || a.className.localeCompare(b.className))
            .map((x) => ({
                classId: x.classId,
                className: x.className,
                totalStars: x.totalStars,
                sharePct: lb.totalStars > 0 ? Math.round((x.totalStars / lb.totalStars) * 1000) / 10 : 0
            }));

        const classMixBuckets = new Map();
        members.forEach((m) => {
            const heroClass = m.heroClass || 'Novice';
            classMixBuckets.set(heroClass, (classMixBuckets.get(heroClass) || 0) + 1);
        });
        const heroClassMix = Array.from(classMixBuckets.entries())
            .map(([heroClass, count]) => ({ heroClass, count }))
            .sort((a, b) => b.count - a.count || a.heroClass.localeCompare(b.heroClass));

        return {
            guildId,
            guildName: guild?.name || lb.guildName || guildId,
            emoji: guild?.emoji || '⚔️',
            colors: {
                primary: guild?.primary || '#6b7280',
                secondary: guild?.secondary || '#9ca3af',
                glow: guild?.glow || '#9ca3af'
            },
            totals: {
                totalStars: Number(lb.totalStars) || 0,
                monthlyStars: Number(lb.monthlyStars) || 0,
                memberCount: Number(lb.memberCount) || 0,
                perCapitaStars: Number(lb.perCapitaStars) || 0,
                monthlyPerCapitaStars: Number(lb.monthlyPerCapitaStars) || 0
            },
            champions: {
                monthlyChampion: _pickMonthlyChampion(guildChampions[guildId], heroesByMonthly),
                allTimeChampion: heroesByTotal[0] || null
            },
            heroesTop: heroesByTotal.slice(0, 5),
            breakdown: {
                activeHeroes,
                activeRatePct: lb.memberCount > 0 ? Math.round((activeHeroes / lb.memberCount) * 1000) / 10 : 0,
                top3SharePct: lb.totalStars > 0 ? Math.round((top3Total / lb.totalStars) * 1000) / 10 : 0,
                classContributions,
                heroClassMix
            },
            comparison: {
                rankByPerCapita: lb.rankByPerCapita || GUILD_IDS.length,
                deltaToLeaderPerCapita: leader ? Math.round(((leader.perCapitaStars || 0) - (lb.perCapitaStars || 0)) * 10) / 10 : 0,
                deltaToLeaderTotal: leader ? Math.max(0, (leader.totalStars || 0) - (lb.totalStars || 0)) : 0
            }
        };
    }).sort((a, b) =>
        a.comparison.rankByPerCapita - b.comparison.rankByPerCapita || b.totals.totalStars - a.totals.totalStars
    );

    const overallTopChampion = guilds
        .map(g => g.champions.allTimeChampion)
        .filter(Boolean)
        .sort((a, b) => b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars)[0] || null;

    let closestRace = null;
    if (guilds.length > 1) {
        for (let i = 0; i < guilds.length - 1; i++) {
            const a = guilds[i];
            const b = guilds[i + 1];
            const perCapitaGap = Math.abs((a.totals.perCapitaStars || 0) - (b.totals.perCapitaStars || 0));
            const totalStarsGap = Math.abs((a.totals.totalStars || 0) - (b.totals.totalStars || 0));
            if (!closestRace || perCapitaGap < closestRace.perCapitaGap) {
                closestRace = { guildAId: a.guildId, guildBId: b.guildId, perCapitaGap, totalStarsGap };
            }
        }
    }

    return {
        generatedAtMonthKey: _getCurrentMonthKey(),
        guilds,
        overview: {
            leaderGuildId: guilds[0]?.guildId || null,
            overallTopChampion,
            closestRace
        }
    };
}

/**
 * Returns analytics with requested guild moved to first position.
 * @param {string} guildId
 * @returns {GuildHeroAnalyticsPayload}
 */
export function getGuildHeroAnalyticsFor(guildId) {
    const payload = getGuildHeroAnalytics();
    if (!guildId) return payload;
    const found = payload.guilds.find(g => g.guildId === guildId);
    if (!found) return payload;
    return {
        ...payload,
        guilds: [found, ...payload.guilds.filter(g => g.guildId !== guildId)]
    };
}

