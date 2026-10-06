// /db/actions.js — facade: re-exports from modular actions; keeps two legacy functions not yet in modules.
import {
    db,
    doc,
    collection,
    runTransaction,
    serverTimestamp,
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
import { applyAwardOutwardSkillEffects, applyReasonAwardScoreTransaction, showHeroLevelUpCelebration } from './actions/stars.js';
import { heroClassEarnsFrom } from '../features/heroSkillTree.js';
import { TRAINING_BONUS_STARS, TRAINING_GAMES } from '../features/trainingGroundsCore.mjs';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

export * from './actions/index.js';

const trainingBonusInFlight = new Set();

const TRAINING_PRAISE = {
    story: { emoji: '✒️', fallback: 'Another chapter in your story — well done!', moment: 'A class just successfully added to their story.' },
    hoard: { emoji: '🐉', fallback: 'Sharp eyes! The dragon could not fool you.', moment: 'A class just won a memory game by spotting every treasure a dragon stole.' },
    map: { emoji: '🗺️', fallback: 'Together you read the torn map. Brilliant teamwork!', moment: 'A class just solved a riddle by sharing clues between groups.' },
    council: { emoji: '🕯️', fallback: 'A council of true respect. Every voice was heard.', moment: 'A class just held a respectful discussion where everyone listened and took turns.' }
};

/** Story Weavers keeps its own entry point; it is the Creativity game of the Training Grounds. */
export function awardStoryWeaverBonusStarToClass(classId) {
    return awardTrainingBonusToClass(classId, 'story');
}

/**
 * Gives every student in the class the Training Grounds bonus for one game: +0.5 stars
 * (+1 for Story Weavers with an Archivist's Quill), logged under the game's own reason so it
 * never touches the daily skill award. Vanguards also get their Gold, skills and Hero Path.
 */
export async function awardTrainingBonusToClass(classId, gameKey = 'story') {
    const game = TRAINING_GAMES[gameKey];
    if (!game) return;
    playSound('star2');
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    if (studentsInClass.length === 0) {
        showToast("No students in class to award bonus stars to.", "info");
        return;
    }

    const flightKey = `${classId}:${gameKey}`;
    if (trainingBonusInFlight.has(flightKey)) return;
    trainingBonusInFlight.add(flightKey);

    try {
        const publicDataPath = PUBLIC_DATA_PATH;
        let awards = [];

        // A transaction (not read-then-batch) so a concurrent award cannot make
        // us consume storyWeaverDoubleNext twice or from a stale read.
        await runTransaction(db, async (transaction) => {
            awards = [];
            const scoreRefs = studentsInClass.map((student) => doc(db, `${publicDataPath}/student_scores`, student.id));
            const scoreSnaps = [];
            for (const scoreRef of scoreRefs) scoreSnaps.push(await transaction.get(scoreRef));

            studentsInClass.forEach((student, index) => {
                const scoreRef = scoreRefs[index];
                const scoreData = scoreSnaps[index].exists() ? scoreSnaps[index].data() : null;
                const doubleNext = gameKey === 'story' && scoreData?.storyWeaverDoubleNext === true;
                const starAmount = doubleNext ? TRAINING_BONUS_STARS * 2 : TRAINING_BONUS_STARS;

                const { levelUpInfo, totalStarsDelta } = applyReasonAwardScoreTransaction(transaction, {
                    scoreRef,
                    studentId: student.id,
                    studentData: student,
                    scoreData,
                    reason: game.reason,
                    awardedStars: starAmount
                });
                if (doubleNext) transaction.update(scoreRef, { storyWeaverDoubleNext: deleteField() });
                awards.push({ student, starAmount, totalStarsDelta, levelUpInfo });

                const logRef = doc(collection(db, `${publicDataPath}/award_log`));
                transaction.set(logRef, withSchoolYear({
                    studentId: student.id,
                    classId: classId,
                    teacherId: state.get('currentUserId'),
                    stars: starAmount,
                    appliedStarCredit: totalStarsDelta,
                    reason: game.reason,
                    date: getTodayDateString(),
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                }, state.getActiveSchoolYearKey()));
            });
        });

        awards.forEach(({ student, totalStarsDelta }) => {
            updateGuildScores(student.id, totalStarsDelta, game.reason).catch((e) => console.warn('Training Grounds Guild Glory update failed:', e));
            reconcileFamiliarLifecycle(student.id, { announce: true, source: 'training-grounds' }).catch((e) => console.warn('Training Grounds familiar reconciliation failed:', e));
        });
        showToast(`${game.skillLabel} bonus stars awarded!`, "success");

        // Vanguards spread their gifts one at a time, so two never race on a classmate's Gold.
        (async () => {
            for (const { student, starAmount } of awards) {
                if (!heroClassEarnsFrom(student.heroClass, game.reason)) continue;
                await applyAwardOutwardSkillEffects(student.id, classId, game.reason, starAmount, { wholeClass: true })
                    .catch((e) => console.warn('Vanguard skill effect failed:', e));
            }
        })();
        const levelUps = awards.map((a) => a.levelUpInfo).filter(Boolean);
        if (levelUps.length) showHeroLevelUpCelebration(levelUps[0]);
        if (levelUps.length > 1) showToast(`${levelUps.length - 1} more Vanguard${levelUps.length > 2 ? 's' : ''} levelled up too!`, 'success');

        const praise = TRAINING_PRAISE[gameKey] || TRAINING_PRAISE.story;
        if (canUseFeature('eliteAI')) {
            const word = gameKey === 'story' ? (state.get('currentStoryData')[classId]?.currentWord || "a new idea") : '';
            const systemPrompt = "You are the 'Quest Master's Assistant'. Write a very short, single-sentence, celebratory message for the whole class. Do not use markdown.";
            const userPrompt = word
                ? `${praise.moment} The new part of their story involves the word "${word}". Write the celebratory message.`
                : `${praise.moment} Celebrate their ${game.skillLabel.toLowerCase()}.`;
            callGeminiApi(systemPrompt, userPrompt).then(comment => showPraiseToast(comment, praise.emoji)).catch(console.error);
        } else {
            showPraiseToast(praise.fallback, praise.emoji);
        }

    } catch (error) {
        console.error("Error awarding bonus stars:", error);
        showToast("Failed to award bonus stars.", "error");
    } finally {
        trainingBonusInFlight.delete(flightKey);
    }
}

export async function ensureHistoryLoaded() {
    if (state.get('hasLoadedCalendarHistory')) return;

    const loader = document.getElementById('calendar-loader');
    if (loader) loader.classList.remove('hidden');

    const { getDocs, query, collection: firestoreCollection, where, db: firestoreDb } = await import('../firebase.js');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const publicDataPath = PUBLIC_DATA_PATH;
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
