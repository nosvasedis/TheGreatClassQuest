// features/questPortal.js
// Team Quest ranks and Portal runes, read from the app state. The rules are in
// questRanksCore.mjs; this file gathers one class's numbers for them (this month's goal,
// each hero's own stars, the class bonus, the stars of each virtue on the award log and the
// Guardian's record on the class doc). The goal comes from utils.calculateMonthlyClassGoal,
// untouched.

import * as state from '../state.js';
import * as utils from '../utils.js';
import { evaluatePortal, VIRTUES } from './questRanksCore.mjs';
import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';
import { currentMonthStarsFromScore } from './heroRanking.js';

const VIRTUE_IDS = new Set(VIRTUES.map((v) => v.id));

function monthStartOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function logMonthKey(log) {
    const at = log?.createdAt;
    if (at) {
        const d = typeof at.toDate === 'function' ? at.toDate() : new Date(at?.seconds ? at.seconds * 1000 : at);
        if (!Number.isNaN(d.getTime())) return utils.getMonthKey(d);
    }
    if (typeof log?.date === 'string' && log.date) return utils.getMonthKey(utils.parseDDMMYYYY(log.date));
    return null;
}

/** Stars of each virtue a class earned this month (award_log rows in the app state). */
export function classVirtueStars(classId, { now = new Date(), awardLogs = null } = {}) {
    const monthKey = utils.getMonthKey(now);
    const out = { teamwork: 0, creativity: 0, respect: 0, focus: 0 };
    for (const log of awardLogs || state.get('allAwardLogs') || []) {
        if (log?.classId !== classId || !VIRTUE_IDS.has(log.reason)) continue;
        if (logMonthKey(log) !== monthKey) continue;
        out[log.reason] += getAwardLogMonthlyStarCredit(log);
    }
    return out;
}

/** The Guardian's record for this month on the class doc: { passed, triedToday }. */
export function guardianRecord(classData, now = new Date()) {
    const entry = classData?.portalGuardian?.[utils.getMonthKey(now)] || {};
    return {
        passed: Boolean(entry.passedAt),
        triedToday: entry.lastTry === utils.getLocalIsoDateString(now),
        tries: Number(entry.tries) || 0
    };
}

export function completedThisMonth(classData, now = new Date()) {
    const at = classData?.questCompletedAt;
    if (!at) return false;
    const d = typeof at.toDate === 'function' ? at.toDate() : new Date(at?.seconds ? at.seconds * 1000 : at);
    return !Number.isNaN(d.getTime()) && utils.getMonthKey(d) === utils.getMonthKey(now);
}

/**
 * Where one class stands against the Portal this month (see evaluatePortal).
 * `classData` needs its `id`. Students, scores and logs default to the app state.
 */
export function classPortalStatus(classData, { now = new Date(), students = null, scores = null, awardLogs = null } = {}) {
    if (!classData?.id) return null;
    const roster = students || (state.get('allStudents') || []).filter((s) => s.classId === classData.id);
    const scoreList = scores || state.get('allStudentScores') || [];
    const byId = scoreList instanceof Map ? scoreList : new Map(scoreList.map((s) => [s.id, s]));
    const monthStart = monthStartOf(now);
    const goal = roster.length
        ? utils.calculateMonthlyClassGoalForDate(classData, roster.length, state.get('schoolHolidayRanges'), state.get('allScheduleOverrides'), now)
        : 0;
    const level = utils.getHistoricalDifficultyForMonth(classData, now) + 1;
    return evaluatePortal({
        level,
        goal,
        heroStars: roster.map((s) => currentMonthStarsFromScore(byId.get(s.id), monthStart)),
        classBonus: utils.getClassQuestBonusForMonth(classData, now),
        virtueStars: classVirtueStars(classData.id, { now, awardLogs }),
        guardian: guardianRecord(classData, now),
        completed: completedThisMonth(classData, now)
    });
}

/** True when the signed-in teacher owns the class (only the owner can write its Portal). */
export function ownsClass(classData) {
    const uid = state.get('currentUserId');
    return Boolean(uid) && classData?.createdBy?.uid === uid;
}
