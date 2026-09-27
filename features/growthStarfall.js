// /features/growthStarfall.js — finds Growth Starfall candidates after a Scholar's Scroll save.
// Loaded on demand by db/actions/economy.js; the rules live in growthStarfallCore.mjs.
import * as state from '../state.js';
import { parseFlexibleDate } from '../utils.js';
import { getNormalizedPercentForScore, qualifiesForHighScore } from './assessmentConfig.js';
import { evaluateGrowthStarfall, isGrowthStarfallNote } from './growthStarfallCore.mjs';

/**
 * Growth Starfall candidates for a just-saved batch of trials.
 * Only earlier trials of the same type count toward the student's baseline, so the new mark
 * (which the live listener may already have added to state) never dilutes its own comparison.
 */
export function findGrowthStarfallStudents({ savedScoresData = [], classData = null, trialDate = '', alreadyProposedIds = new Set() }) {
    const trialDay = parseFlexibleDate(trialDate);
    if (!trialDay) return [];
    const trialDayStart = new Date(trialDay.getFullYear(), trialDay.getMonth(), trialDay.getDate()).getTime();
    const allScores = state.get('allWrittenScores') || [];
    const allLogs = state.get('allAwardLogs') || [];
    const students = state.get('allStudents') || [];
    const proposals = [];

    for (const saved of savedScoresData) {
        if (alreadyProposedIds.has(saved.studentId)) continue;
        const type = saved.type === 'dictation' ? 'dictation' : 'test';
        const newPercent = getNormalizedPercentForScore(saved, classData);
        if (!Number.isFinite(newPercent)) continue;

        const previousPercents = allScores
            .filter((score) => score.studentId === saved.studentId && score.type === type && score.id !== saved.id)
            .map((score) => ({ day: parseFlexibleDate(score.date), percent: getNormalizedPercentForScore(score, classData) }))
            .filter(({ day, percent }) => day && Number.isFinite(percent)
                && new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() < trialDayStart)
            .sort((a, b) => a.day - b.day)
            .map(({ percent }) => percent);

        const growthAwardsThisMonth = allLogs.filter((log) => {
            if (log.studentId !== saved.studentId || log.reason !== 'scholar_s_bonus' || !isGrowthStarfallNote(log.note)) return false;
            const day = parseFlexibleDate(log.date);
            return day && day.getFullYear() === trialDay.getFullYear() && day.getMonth() === trialDay.getMonth();
        }).length;

        const verdict = evaluateGrowthStarfall({
            newPercent,
            previousPercents,
            alreadyHighScore: qualifiesForHighScore(saved, type, classData),
            growthAwardsThisMonth
        });
        if (!verdict.eligible) continue;

        const student = students.find((item) => item.id === saved.studentId);
        if (!student) continue;
        proposals.push({
            studentId: student.id,
            name: student.name,
            bonusAmount: verdict.bonusStars,
            trialType: type,
            kind: 'growth',
            jump: verdict.jump
        });
    }
    return proposals;
}
