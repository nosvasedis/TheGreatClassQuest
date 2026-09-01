import { db, doc, collection, getDoc, getDocs, query, where, updateDoc, runTransaction, serverTimestamp, increment } from '../firebase.js';
import * as state from '../state.js';
import { createQuestEventDocument, getDefaultProgress, normalizeLegacyQuestEvent, reduceQuestProgress, canCompleteRun, isSpecialQuestType } from './specialQuestEngine.js';
import { withSchoolYear } from '../utils/schoolYear.js';
import { updateGuildScores } from './guildScoring.js';
import { reconcileFamiliarLifecycle } from './familiars.js';

const DATA = 'artifacts/great-class-quest/public/data';
const RUNS = `${DATA}/quest_event_runs`;
const ACTIONS = `${DATA}/quest_event_actions`;
const SCORES = `${DATA}/student_scores`;
const STUDENTS = `${DATA}/students`;
const AWARDS = `${DATA}/award_log`;

export function questRunId(eventId) { return String(eventId); }
export function completionActionId(eventId, runVersion = 1) { return `${eventId}__complete__v${runVersion}`; }
export function reversalActionId(eventId, runVersion = 1) { return `${eventId}__reverse__v${runVersion}`; }
export function awardId(actionId, studentId) { return `${actionId}__${studentId}`; }

function studentRoster(classId, attendance = state.get('allAttendanceRecords') || []) {
    const students = (state.get('allStudents') || []).filter((student) => student.classId === classId && student.enrollmentStatus !== 'inactive');
    const absent = new Set(attendance.filter((record) => record.classId === classId && record.status === 'absent').map((record) => record.studentId));
    return { eligible: students.filter((student) => !absent.has(student.id)).map((student) => student.id), excluded: students.filter((student) => absent.has(student.id)).map((student) => student.id) };
}

export async function startQuestRun(event, { startedBy = state.get('currentUserId'), recipientIds, attendance } = {}) {
    const normalized = normalizeLegacyQuestEvent(event);
    if (!isSpecialQuestType(normalized.type)) throw new Error('Only Special Quests can be started in the runner.');
    if (!normalized.classId) throw new Error('This legacy quest needs a class assignment before it can start.');
    const roster = studentRoster(normalized.classId, attendance);
    const recipients = Array.isArray(recipientIds) ? recipientIds.filter((id) => roster.eligible.includes(id)) : roster.eligible;
    const runRef = doc(db, RUNS, questRunId(event.id));
    const existing = await getDoc(runRef);
    if (existing.exists() && ['active', 'completed'].includes(existing.data().status)) return { id: runRef.id, ...existing.data() };
    const data = withSchoolYear({ schemaVersion: 1, eventId: event.id, eventGroupId: normalized.eventGroupId || null, classId: normalized.classId, type: normalized.type, dateKey: normalized.dateKey || normalized.date, status: 'active', runVersion: (existing.data()?.runVersion || 0) + 1, progress: getDefaultProgress(normalized), eligibleStudentIds: roster.eligible, excludedStudentIds: roster.excluded, finalRecipientIds: recipients, startedBy, startedAt: serverTimestamp(), updatedAt: serverTimestamp() }, state.getActiveSchoolYearKey());
    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(runRef);
        if (snapshot.exists() && ['active', 'completed'].includes(snapshot.data().status)) return;
        const activeRuns = await transaction.get(query(
            collection(db, RUNS),
            where('classId', '==', normalized.classId),
            where('status', '==', 'active')
        ));
        if (activeRuns.docs.some((item) => item.id !== runRef.id)) {
            throw new Error('Another Special Quest is already active for this class. Complete or cancel it first.');
        }
        transaction.set(runRef, data);
    });
    return { id: runRef.id, ...data };
}

export async function updateQuestProgress(eventId, action, { runVersion } = {}) {
    const runRef = doc(db, RUNS, questRunId(eventId));
    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(runRef);
        if (!snapshot.exists()) throw new Error('Quest run not found. Start the quest first.');
        const run = snapshot.data();
        if (run.status !== 'active') throw new Error('This quest run is no longer active.');
        if (runVersion && Number(run.runVersion) !== Number(runVersion)) throw new Error('Quest changed on another device. Refresh to continue.');
        const event = (state.get('allQuestEvents') || []).find((item) => item.id === eventId) || { id: eventId, type: run.type };
        const progress = reduceQuestProgress(event, run.progress, action);
        transaction.update(runRef, { progress, updatedAt: serverTimestamp() });
    });
    const snapshot = await getDoc(runRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function completeQuestRun(event, { recipientIds, completedBy = state.get('currentUserId') } = {}) {
    const normalized = normalizeLegacyQuestEvent(event);
    const runRef = doc(db, RUNS, questRunId(event.id));
    const runSnapshot = await getDoc(runRef);
    if (!runSnapshot.exists()) throw new Error('Quest run not found.');
    const run = runSnapshot.data();
    if (!canCompleteRun(run)) throw new Error('Complete the quest goal before awarding its reward.');
    const recipients = (Array.isArray(recipientIds) ? recipientIds : run.finalRecipientIds || []).filter((id) => (run.eligibleStudentIds || []).includes(id));
    if (!recipients.length) throw new Error('Select at least one recipient.');
    const stars = Number(normalized.rewardSpec?.starsPerRecipient || 1);
    const actionId = completionActionId(event.id, run.runVersion || 1);
    const actionRef = doc(db, ACTIONS, actionId);
    const rewardWrites = recipients.map((studentId) => ({ studentId, scoreRef: doc(db, SCORES, studentId), studentRef: doc(db, STUDENTS, studentId), awardRef: doc(db, AWARDS, awardId(actionId, studentId)) }));
    await runTransaction(db, async (transaction) => {
        const freshRun = await transaction.get(runRef);
        if (!freshRun.exists()) throw new Error('Quest run not found.');
        const freshData = freshRun.data();
        if (freshData.status === 'completed') return;
        if (!canCompleteRun(freshData)) throw new Error('Quest goal is not complete.');
        const actionSnapshot = await transaction.get(actionRef);
        if (actionSnapshot.exists()) return;
        const studentSnapshots = [];
        for (const write of rewardWrites) studentSnapshots.push({ write, score: await transaction.get(write.scoreRef), student: await transaction.get(write.studentRef) });
        for (const { write, score, student } of studentSnapshots) {
            if (!student.exists()) continue;
            const scoreData = score.exists() ? score.data() : {};
            if (score.exists()) transaction.update(write.scoreRef, { totalStars: increment(stars), monthlyStars: increment(stars), gold: increment(stars) });
            else transaction.set(write.scoreRef, withSchoolYear({ totalStars: stars, monthlyStars: stars, gold: stars, inventory: [], createdBy: student.data().createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') } }, state.getActiveSchoolYearKey()));
            transaction.set(write.awardRef, withSchoolYear({ studentId: write.studentId, classId: freshData.classId, teacherId: state.get('currentUserId'), stars, appliedStarCredit: stars, reason: 'special_quest', questType: normalized.type, eventId: event.id, actionId, date: freshData.dateKey, createdAt: serverTimestamp(), createdBy: { uid: completedBy, name: state.get('currentTeacherName') } }, state.getActiveSchoolYearKey()));
        }
        transaction.set(actionRef, withSchoolYear({ schemaVersion: 1, type: 'completion', eventId: event.id, runId: runRef.id, runVersion: freshData.runVersion, classId: freshData.classId, schoolYearKey: state.getActiveSchoolYearKey(), recipientIds: recipients, starsPerRecipient: stars, totalStars: stars * recipients.length, totalGold: stars * recipients.length, coreStatus: 'applied', effects: { guild: 'pending', familiars: 'pending' }, createdBy: completedBy, createdAt: serverTimestamp() }, state.getActiveSchoolYearKey()));
        transaction.update(runRef, { status: 'completed', finalRecipientIds: recipients, completedBy, completedAt: serverTimestamp(), completionActionId: actionId, rewardSummary: { totalStars: stars * recipients.length, totalGold: stars * recipients.length }, updatedAt: serverTimestamp() });
    });
    const effectResults = await Promise.allSettled(recipients.map(async (studentId) => {
        await updateGuildScores(studentId, stars, 'special_quest');
        await reconcileFamiliarLifecycle(studentId, { announce: true, source: 'special-quest' });
    }));
    if (effectResults.every((result) => result.status === 'fulfilled')) {
        await updateDoc(actionRef, { 'effects.guild': 'complete', 'effects.familiars': 'complete', updatedAt: serverTimestamp() }).catch(() => {});
    }
    return { actionId, recipientIds: recipients, starsPerRecipient: stars, totalStars: stars * recipients.length };
}

export async function reverseQuestCompletion(eventId, { reversedBy = state.get('currentUserId') } = {}) {
    const runRef = doc(db, RUNS, questRunId(eventId));
    const runSnapshot = await getDoc(runRef); if (!runSnapshot.exists()) throw new Error('Quest run not found.');
    const run = runSnapshot.data(); if (run.status !== 'completed' || !run.completionActionId) throw new Error('Only a completed run can be undone.');
    const actionRef = doc(db, ACTIONS, run.completionActionId); const actionSnapshot = await getDoc(actionRef); if (!actionSnapshot.exists()) throw new Error('Completion action not found.');
    const action = actionSnapshot.data(); const reverseId = reversalActionId(eventId, run.runVersion || 1); const reverseRef = doc(db, ACTIONS, reverseId);
    await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(reverseRef); if (existing.exists()) return;
        const scoreSnapshots = []; for (const studentId of action.recipientIds || []) scoreSnapshots.push({ studentId, ref: doc(db, SCORES, studentId), snapshot: await transaction.get(doc(db, SCORES, studentId)) });
        for (const item of scoreSnapshots) {
            const data = item.snapshot.data() || {}; const gold = Number(data.gold) || 0; if (gold < Number(action.starsPerRecipient)) throw new Error('Undo blocked: a recipient has already spent part of this reward.');
        }
        for (const item of scoreSnapshots) transaction.update(item.ref, { totalStars: increment(-Number(action.starsPerRecipient)), monthlyStars: increment(-Number(action.starsPerRecipient)), gold: increment(-Number(action.starsPerRecipient)) });
        transaction.set(reverseRef, withSchoolYear({ schemaVersion: 1, type: 'reversal', eventId, runId: runRef.id, runVersion: run.runVersion, classId: run.classId, recipientIds: action.recipientIds, starsPerRecipient: action.starsPerRecipient, totalStars: -action.totalStars, totalGold: -action.totalGold, coreStatus: 'applied', effects: { guild: 'pending', familiars: 'pending' }, reversesActionId: action.id || run.completionActionId, createdBy: reversedBy, createdAt: serverTimestamp() }, state.getActiveSchoolYearKey()));
        transaction.update(runRef, { status: 'reversed', updatedAt: serverTimestamp() });
    });
    const effectResults = await Promise.allSettled((action.recipientIds || []).map(async (studentId) => {
        await updateGuildScores(studentId, -Number(action.starsPerRecipient), 'special_quest_reversal');
        await reconcileFamiliarLifecycle(studentId, { announce: false, source: 'special-quest-reversal' });
    }));
    if (effectResults.every((result) => result.status === 'fulfilled')) {
        await updateDoc(reverseRef, { 'effects.guild': 'complete', 'effects.familiars': 'complete', updatedAt: serverTimestamp() }).catch(() => {});
    }
    return { reversalActionId: reverseId };
}

export function questEventForType(type, overrides = {}) {
    return createQuestEventDocument({ type, ...overrides });
}

/** Retry non-critical effects after startup/class selection without replaying core rewards. */
export async function reconcilePendingQuestEffects() {
    const year = state.getActiveSchoolYearKey();
    if (!year) return { processed: 0 };
    const snapshot = await getDocs(query(collection(db, ACTIONS), where('schoolYearKey', '==', year)));
    let processed = 0;
    for (const actionDoc of snapshot.docs) {
        const action = actionDoc.data();
        if (action.effects?.guild === 'complete' && action.effects?.familiars === 'complete') continue;
        const results = await Promise.allSettled((action.recipientIds || []).map(async (studentId) => {
            const delta = Number(action.totalStars || 0) / Math.max(1, action.recipientIds.length);
            await updateGuildScores(studentId, delta, action.type === 'reversal' ? 'special_quest_reversal' : 'special_quest');
            await reconcileFamiliarLifecycle(studentId, { announce: false, source: 'special-quest-retry' });
        }));
        if (results.every((result) => result.status === 'fulfilled')) {
            await updateDoc(doc(db, ACTIONS, actionDoc.id), { 'effects.guild': 'complete', 'effects.familiars': 'complete', updatedAt: serverTimestamp() }).catch(() => {});
            processed += 1;
        }
    }
    return { processed };
}
