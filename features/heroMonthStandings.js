// /features/heroMonthStandings.js
// This month's hero standings for one class, read from app state, so every
// screen that ranks heroes by month stars (the Hero's Challenge board, the
// Teacher Boon picker) shows the same order, the same shared places and the
// same Co-Prodigies. The rules themselves live in features/heroRanking.js.

import * as state from '../state.js';
import * as utils from '../utils.js';
import { getNormalizedPercentForScore } from './assessmentConfig.js';
import {
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from './awardLogReasonMeta.js';
import { getSchoolYearStartMonthDate } from '../utils/schoolYear.js';
import {
    buildHeroTieStats,
    currentMonthStarsFromScore,
    pickProdigyWinners,
    rankHeroes
} from './heroRanking.js';

/** Stars this month from a student_scores doc, kept to two decimals so half stars (19.5) rank and tie exactly. */
export function heroMonthStars(scoreData, monthStart = utils.getStartOfMonthString()) {
    return Math.round(currentMonthStarsFromScore(scoreData, monthStart) * 100) / 100;
}

/** This month's award logs and written scores for one hero (pathfinder bonuses left out). */
export function heroMonthRecords(studentId, { allLogs = state.get('allAwardLogs') || [], allScores = state.get('allWrittenScores') || [], now = new Date() } = {}) {
    const month = now.getMonth();
    const year = now.getFullYear();
    const logs = allLogs.filter((log) => {
        if (log.studentId !== studentId || log.reason === 'pathfinder_bonus') return false;
        const d = utils.parseDDMMYYYY(log.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    const scores = allScores.filter((s) => {
        if (s.studentId !== studentId || !s.date) return false;
        const d = utils.parseFlexibleDate(s.date);
        return d && d.getMonth() === month && d.getFullYear() === year;
    });
    return { logs, scores };
}

/** Tie-break stats for this month, by the Ceremony's rules. */
export function heroMonthTieStats(studentId, options = {}) {
    const { logs, scores } = heroMonthRecords(studentId, options);
    return buildHeroTieStats(logs, scores, getNormalizedPercentForScore);
}

/**
 * One class ranked on this month's stars, exactly as the Hero's Challenge
 * board ranks it: [{ ...student, stars, stats, rank }], best first.
 */
export function rankClassHeroesThisMonth(classId, { now = new Date() } = {}) {
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const allStudentScores = state.get('allStudentScores') || [];
    const allLogs = state.get('allAwardLogs') || [];
    const allScores = state.get('allWrittenScores') || [];
    const monthStart = utils.getStartOfMonthString();
    return rankHeroes(students.map((s) => ({
        ...s,
        stars: heroMonthStars(allStudentScores.find((sc) => sc.id === s.id), monthStart),
        stats: heroMonthTieStats(s.id, { allLogs, allScores, now })
    })));
}

// --- Reigning Prodigies --------------------------------------------------------
// Last month's winners, fetched once per session (cached by month).
// { [classId]: Set<studentId> }: a Set, so Co-Prodigies all wear the crown.
let prodigyCacheKey = null;
let prodigyCache = {};

export function peekReigningProdigies() {
    return prodigyCache;
}

export async function getReigningProdigies() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cacheKey = `${state.getActiveSchoolYearKey() || 'legacy'}:${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;
    const yearStart = getSchoolYearStartMonthDate(
        state.getActiveSchoolYearStartDate(),
        state.getActiveSchoolYearKey()
    );

    if (prodigyCacheKey === cacheKey) return prodigyCache;

    if (yearStart && prevMonth < yearStart) {
        prodigyCacheKey = cacheKey;
        prodigyCache = {};
        return prodigyCache;
    }

    try {
        const { fetchLogsForMonth } = await import('../db/queries.js');

        const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
        const logs = await fetchLogsForMonth(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
        const archived = await state.fetchMonthlyHistory(monthKey).catch(() => ({}));
        const allScores = state.get('allWrittenScores') || [];

        const logsByClass = {};
        logs.forEach((l) => {
            if (!l.classId) return;
            if (!logsByClass[l.classId]) logsByClass[l.classId] = [];
            logsByClass[l.classId].push(l);
        });

        const result = {};
        const vm = prevMonth.getMonth();
        const vy = prevMonth.getFullYear();

        Object.entries(logsByClass).forEach(([classId, classLogs]) => {
            const students = state.get('allStudents').filter((s) => s.classId === classId);
            const fromLogsTotals = sumMonthlyStarCreditsByStudentFromAwardLogs(classLogs);
            const mergedTotals = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogsTotals, archived || {});

            // Same rules as the Ceremony and the Hall of Prodigies (features/heroRanking.js).
            const ranked = rankHeroes(students.map((s) => {
                const sScores = allScores.filter((sc) => {
                    const scDate = utils.parseFlexibleDate(sc.date);
                    return sc.studentId === s.id && scDate && scDate.getMonth() === vm && scDate.getFullYear() === vy;
                });
                return {
                    id: s.id,
                    name: s.name,
                    stars: Number(mergedTotals[s.id]) || 0,
                    stats: buildHeroTieStats(classLogs.filter((l) => l.studentId === s.id), sScores, getNormalizedPercentForScore)
                };
            }));
            const winners = pickProdigyWinners(ranked);
            if (winners.length === 0) return;

            result[classId] = new Set(winners.map((w) => w.id));
        });

        prodigyCacheKey = cacheKey;
        prodigyCache = result;
    } catch (e) {
        console.warn('Could not load reigning prodigies:', e);
    }
    return prodigyCache;
}
