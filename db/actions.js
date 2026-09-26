// /db/actions.js — facade: re-exports from modular actions; keeps two legacy functions not yet in modules.
import {
    db,
    doc,
    collection,
    runTransaction,
    serverTimestamp,
    increment,
    deleteField
} from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi } from '../api.js';
import { getTodayDateString } from '../utils.js';
import { reconcileFamiliarLifecycle } from '../features/familiars.js';
import { canUseFeature } from '../utils/subscription.js';
import {
    filterDocsForActiveYear,
    normalizeSchoolYearState,
    yearScopeClauses,
    isActiveYearDoc,
    withSchoolYear,
} from '../utils/schoolYear.js';
import { updateGuildScores } from '../features/guildScoring.js';

export * from './actions/index.js';

const storyWeaverBonusInFlight = new Set();

export async function awardStoryWeaverBonusStarToClass(classId) {
    playSound('star2');
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    if (studentsInClass.length === 0) {
        showToast("No students in class to award bonus stars to.", "info");
        return;
    }

    if (storyWeaverBonusInFlight.has(classId)) return;
    storyWeaverBonusInFlight.add(classId);

    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        let guildAwards = [];

        // A transaction (not read-then-batch) so a concurrent award cannot make
        // us consume storyWeaverDoubleNext twice or from a stale read.
        await runTransaction(db, async (transaction) => {
            guildAwards = [];
            const scoreRefs = studentsInClass.map((student) => doc(db, `${publicDataPath}/student_scores`, student.id));
            const scoreSnaps = [];
            for (const scoreRef of scoreRefs) scoreSnaps.push(await transaction.get(scoreRef));

            studentsInClass.forEach((student, index) => {
                const scoreRef = scoreRefs[index];
                const scoreData = scoreSnaps[index].exists() ? scoreSnaps[index].data() : {};
                const doubleNext = scoreData.storyWeaverDoubleNext === true;
                const starAmount = doubleNext ? 1 : 0.5;
                guildAwards.push({ studentId: student.id, starAmount });

                const scoreUpdate = {
                    monthlyStars: increment(starAmount),
                    totalStars: increment(starAmount)
                };
                if (doubleNext) {
                    scoreUpdate.storyWeaverDoubleNext = deleteField();
                }
                transaction.update(scoreRef, scoreUpdate);

                const logRef = doc(collection(db, `${publicDataPath}/award_log`));
                transaction.set(logRef, withSchoolYear({
                    studentId: student.id,
                    classId: classId,
                    teacherId: state.get('currentUserId'),
                    stars: starAmount,
                    appliedStarCredit: starAmount,
                    reason: "story_weaver",
                    date: getTodayDateString(),
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                }, state.getActiveSchoolYearKey()));
            });
        });

        guildAwards.forEach(({ studentId, starAmount }) => {
            updateGuildScores(studentId, starAmount, 'story_weaver').catch((e) => console.warn('Story Weaver Guild Glory update failed:', e));
        });
        studentsInClass.forEach((student) => {
            reconcileFamiliarLifecycle(student.id, { announce: true, source: 'story-weaver' }).catch((e) => console.warn('Story Weaver familiar reconciliation failed:', e));
        });
        showToast("Story Weaver bonus stars awarded!", "success");

        if (canUseFeature('eliteAI')) {
            const word = state.get('currentStoryData')[classId]?.currentWord || "a new idea";
            const systemPrompt = "You are the 'Quest Master's Assistant'. A class just successfully added to their story. Write a very short, single-sentence, celebratory message for the whole class. Do not use markdown.";
            const userPrompt = `The new part of their story involves the word "${word}". Write the celebratory message.`;
            callGeminiApi(systemPrompt, userPrompt).then(comment => showPraiseToast(comment, '✒️')).catch(console.error);
        } else {
            showPraiseToast("Another chapter in your story — well done!", '✒️');
        }

    } catch (error) {
        console.error("Error awarding bonus stars:", error);
        showToast("Failed to award bonus stars.", "error");
    } finally {
        storyWeaverBonusInFlight.delete(classId);
    }
}

export async function ensureHistoryLoaded() {
    if (state.get('hasLoadedCalendarHistory')) return;

    const loader = document.getElementById('calendar-loader');
    if (loader) loader.classList.remove('hidden');

    const { getDocs, query, collection: firestoreCollection, where, db: firestoreDb } = await import('../firebase.js');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const schoolYearState = normalizeSchoolYearState(state.get('schoolYearState'));
    const activeYearKey = schoolYearState.activeYearKey;
    const enforceActiveYearQueries = schoolYearState.enforceActiveYearQueries === true;
    const includeUntagged = !enforceActiveYearQueries;

    const q = query(
        firestoreCollection(firestoreDb, `${publicDataPath}/award_log`),
        ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        where('createdAt', '>=', thirtyDaysAgo)
    );

    try {
        const snapshot = await getDocs(q);
        const historyLogs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((log) => isActiveYearDoc(log, activeYearKey, { includeUntagged }));

        const currentLogs = filterDocsForActiveYear(state.get('allAwardLogs'), schoolYearState);
        const logMap = new Map();

        historyLogs.forEach(log => logMap.set(log.id, log));
        currentLogs.forEach(log => logMap.set(log.id, log));

        const mergedLogs = filterDocsForActiveYear(Array.from(logMap.values()), schoolYearState);

        state.setAllAwardLogs(mergedLogs);
        state.setHasLoadedCalendarHistory(true);

    } catch (e) {
        console.error("Error loading history:", e);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}
