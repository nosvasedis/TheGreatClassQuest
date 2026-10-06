import { db, doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp, increment, arrayUnion, runTransaction, where, query, deleteDoc } from '../../firebase.js';
import * as state from '../../state.js';
import { compressImageBase64, getTodayDateString, getLeagueAiAudience, getLeagueAiVisualStyle, getAgeCategoryForLeague } from '../../utils.js';
import { getISOWeekKey, getTargetWeekKey, updateGuildScores } from '../../features/guildScoring.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../../api.js';
import { applyClassQuestBonusDelta } from './fortuneWheelEffects.js';
import { playSound } from '../../audio.js';
import { showToast, showPraiseToast } from '../../ui/effects.js';
import { withActiveScoreYear, withSchoolYear } from '../../utils/schoolYear.js';
import {
    QUIZ_MIN_QUESTIONS,
    computeQuestionStats,
    freshQuestionCount,
    mergeCarriedQuestions,
    sanitizeQuizQuestion,
    selectMissedQuestions,
    shuffleQuestionOptions,
    statToCarriedQuestion
} from '../../features/quizReviewCore.mjs';
import { sanitizeLessonFocus } from '../../features/quizCurriculumCore.mjs';
import {
    QUIZ_PICTURE_NEGATIVE_PROMPT,
    countKinds,
    pictureToListenQuestion,
    questionKind,
    quizAgeBand,
    quizPicturePrompt
} from '../../features/quizKindsCore.mjs';
import { writeQuizQuestions } from '../../features/quizWriterCore.mjs';
import {
    QUIZ_PRIZE_FALLBACK_GOLD,
    QUIZ_TEAM_BONUS,
    computeHeroRewards,
    computeQuizRewardTier,
    countQuizPrizeWins,
    pickQuizChampion,
    quizPrizeCandidates
} from '../../features/quizRewardsCore.mjs';
import { grantStallTreasure, loadLeagueStall } from './stallTreasure.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';


function weekKey() {
    return getTargetWeekKey();
}

function quizDocId(classId) {
    return `${classId}_${weekKey()}`;
}

function quizDocRef(classId) {
    return doc(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week`, quizDocId(classId));
}

function quizAttemptsCollection(classId, week) {
    return collection(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week/${classId}_${week}/attempts`);
}

function quizAttemptsCollectionRef(classId) {
    return collection(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week/${quizDocId(classId)}/attempts`);
}

// =============================================================================
// 1. CRUD
// =============================================================================

export async function getQuizForClass(classId) {
    const ref = quizDocRef(classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return { id: snap.id, ...data };
}

export async function saveQuizCurriculum(classId, { type, categories, keywords, lessonFocus = null, questLevel, reviewBeforeLive = false, carryForward = [] }) {
    const wk = weekKey();
    const docId = quizDocId(classId);
    const ref = doc(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week`, docId);
    const carried = (Array.isArray(carryForward) ? carryForward : [])
        .map((question, index) => sanitizeQuizQuestion(question, `r${index + 1}`))
        .filter(Boolean);
    const curriculum = {
        type,
        categories,
        keywords,
        lessonFocus: lessonFocus ? sanitizeLessonFocus(lessonFocus) : null
    };

    await setDoc(ref, withSchoolYear({
        classId,
        weekKey: wk,
        status: 'pending',
        curriculum,
        // Optional teacher choices: review before the quiz goes live, and bring back missed questions.
        reviewBeforeLive: Boolean(reviewBeforeLive),
        carryForward: carried,
        questLevel,
        questions: [],
        results: null,
        generatedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    }, state.getActiveSchoolYearKey()), { merge: true });

    return { docId, weekKey: wk };
}

export async function updateQuizStatus(classId, status, questions = null) {
    const ref = quizDocRef(classId);
    const updates = { status, updatedAt: serverTimestamp() };
    if (questions) updates.questions = questions;
    if (status === 'ready' || status === 'review' || status === 'generating') updates.generatedAt = serverTimestamp();
    await setDoc(ref, updates, { merge: true });
}

export async function markQuizCompleted(classId, results) {
    const ref = quizDocRef(classId);
    await setDoc(ref, {
        status: 'completed',
        results,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function deleteQuizForClass(classId) {
    const ref = quizDocRef(classId);
    await deleteDoc(ref);
}

export async function getQuizHistory(classId, limitCount = 5) {
    const q = query(
        collection(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week`),
        where('classId', '==', classId),
        where('status', '==', 'completed')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.completedAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || 0))
        .slice(0, limitCount);
}

export async function getQuizParticipationHistory(classId, limitCount = 8) {
    const history = await getQuizHistory(classId, limitCount);
    const participationByWeek = [];

    for (const quiz of history) {
        const inlineParticipants = Array.isArray(quiz.results?.allParticipating)
            ? quiz.results.allParticipating.filter(Boolean)
            : [];
        const detailedRewardParticipants = Array.isArray(quiz.results?.rewards?.correctStudentDetails)
            ? quiz.results.rewards.correctStudentDetails.map((student) => student?.id).filter(Boolean)
            : [];
        const rewardParticipants = Array.isArray(quiz.results?.rewards?.studentRewards)
            ? quiz.results.rewards.studentRewards.map((student) => student?.studentId).filter(Boolean)
            : [];

        let participantIds = [...new Set([
            ...inlineParticipants,
            ...detailedRewardParticipants,
            ...rewardParticipants
        ])];

        if (participantIds.length === 0 && quiz.weekKey) {
            try {
                const attempts = await getQuizAttempts(classId, quiz.weekKey);
                participantIds = [...new Set(attempts.map((attempt) => attempt.studentId).filter(Boolean))];
            } catch (error) {
                console.warn('Failed to load quiz participation attempts for history:', classId, quiz.weekKey, error);
            }
        }

        participationByWeek.push({
            weekKey: quiz.weekKey,
            participantIds
        });
    }

    return participationByWeek;
}

// =============================================================================
// 2. AI QUESTION GENERATION
// Rules for the four question kinds and the prompt live in features/quizKindsCore.mjs.
// =============================================================================

/**
 * Ask the AI for fresh questions in parts (rules in features/quizWriterCore.mjs).
 */
async function writeFreshQuestions({ curriculum, questLevel, freshCount, avoid = [], onProgress }) {
    return writeQuizQuestions({
        curriculum,
        freshCount,
        avoid,
        onProgress,
        band: quizAgeBand(getAgeCategoryForLeague(questLevel)),
        ageDesc: getLeagueAiAudience(questLevel),
        askAi: (systemPrompt, userPrompt) => callGeminiApi(systemPrompt, userPrompt, { retries: 2, baseDelay: 1000, timeoutMs: 60000 })
    });
}

/**
 * Draw the four small pictures of every picture question, once, when the quiz is made.
 * A question whose pictures cannot all be drawn becomes Listen and choose instead.
 */
async function drawQuizPictures(classId, questions, { questLevel, onProgress } = {}) {
    const pictureQuestions = questions.filter((question) => questionKind(question) === 'picture');
    if (!pictureQuestions.length) return { questions, drawn: 0 };
    const { uploadImageToStorage, isLikelyBlackImageBase64 } = await import('../../utils.js');
    const style = getLeagueAiVisualStyle(questLevel);
    const stamp = Date.now().toString(36);
    const total = pictureQuestions.length * 4;
    let done = 0;
    onProgress?.({ stage: 'pictures', done, total });

    const drawOne = async (question, index) => {
        const prompt = quizPicturePrompt(question.picturePrompts?.[index] || question.options[index], style);
        try {
            const draw = () => callCloudflareAiImageApi(prompt, QUIZ_PICTURE_NEGATIVE_PROMPT, {}, { retries: 1, timeoutMs: 45000 });
            let raw = await draw();
            // The image model sometimes returns a blank black square: one more try, then give up.
            if (await isLikelyBlackImageBase64(raw).catch(() => false)) raw = await draw();
            if (await isLikelyBlackImageBase64(raw).catch(() => false)) throw new Error('Blank picture');
            const base64 = await compressImageBase64(raw, 320, 320, 0.8);
            const path = `quiz_images/${state.get('currentUserId')}/${quizDocId(classId)}_${stamp}_${question.id}_${index + 1}.jpg`;
            return await uploadImageToStorage(base64, path, { cacheControl: 'public, max-age=31536000' });
        } finally {
            done += 1;
            onProgress?.({ stage: 'pictures', done, total });
        }
    };

    const drawn = await Promise.all(pictureQuestions.map(async (question) => {
        const results = await Promise.allSettled(question.options.map((_, index) => drawOne(question, index)));
        const urls = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
        return { id: question.id, urls };
    }));
    const byId = new Map(drawn.map((entry) => [entry.id, entry.urls]));
    let complete = 0;
    const out = questions.map((question) => {
        if (!byId.has(question.id)) return question;
        const urls = byId.get(question.id);
        if (urls.every(Boolean)) {
            complete += 1;
            return { ...question, optionImages: urls };
        }
        console.warn('Quiz: pictures missing for a picture question, it becomes Listen and choose:', question.question);
        return pictureToListenQuestion(question);
    });
    return { questions: out, drawn: complete };
}

/**
 * Write this week's questions. `onProgress({ stage: 'writing'|'pictures'|'saving', done, total })`
 * lets Settings show how far it has got.
 */
export async function generateQuizQuestions(classId, { onProgress } = {}) {
    const quiz = await getQuizForClass(classId);
    if (!quiz || !quiz.curriculum) throw new Error('No quiz curriculum found');

    await updateQuizStatus(classId, 'generating');

    try {
        // Calculate question count based on class enrollment
        const { calculateQuestionCount } = await import('../../features/quizOfTheWeek.js');
        const allStudents = state.get('allStudents') || [];
        const enrolledCount = allStudents.filter(s => s.classId === classId).length;
        const questionCount = calculateQuestionCount(enrolledCount);

        // Optional review questions carried from last week take the first slots.
        const carried = (Array.isArray(quiz.carryForward) ? quiz.carryForward : [])
            .map((question, index) => sanitizeQuizQuestion(question, `r${index + 1}`))
            .filter(Boolean)
            .slice(0, questionCount)
            .map((question) => shuffleQuestionOptions(question));
        const freshCount = freshQuestionCount(questionCount, carried.length);
        const finalStatus = quiz.reviewBeforeLive ? 'review' : 'ready';

        if (freshCount === 0) {
            const processedOnlyReview = mergeCarriedQuestions([], carried, questionCount);
            onProgress?.({ stage: 'saving' });
            await updateQuizStatus(classId, finalStatus, processedOnlyReview);
            await setDoc(quizDocRef(classId), { expectedQuestionCount: questionCount, updatedAt: serverTimestamp() }, { merge: true });
            return { success: true, questionCount: processedOnlyReview.length, expectedQuestionCount: questionCount, imageCount: 0, carriedCount: carried.length, status: finalStatus, kinds: countKinds(processedOnlyReview) };
        }

        const { questions: written, mix } = await writeFreshQuestions({
            curriculum: quiz.curriculum,
            questLevel: quiz.questLevel,
            freshCount,
            avoid: carried.map((question) => question.correctAnswer),
            onProgress
        });

        const minimumFresh = Math.min(QUIZ_MIN_QUESTIONS, freshCount);
        if (written.length < minimumFresh || (written.length + carried.length) < QUIZ_MIN_QUESTIONS) {
            throw new Error(`Only ${written.length} usable question${written.length === 1 ? '' : 's'} came back from the AI (need at least ${minimumFresh}). Please try again.`);
        }

        const { questions: pictured, drawn } = await drawQuizPictures(classId, written, { questLevel: quiz.questLevel, onProgress });
        const processed = pictured
            .map((question, index) => sanitizeQuizQuestion(question, `q${index + 1}`))
            .filter(Boolean);

        onProgress?.({ stage: 'saving' });
        const finalQuestions = mergeCarriedQuestions(processed, carried, questionCount);
        await updateQuizStatus(classId, finalStatus, finalQuestions);
        await setDoc(quizDocRef(classId), { expectedQuestionCount: questionCount, kindPlan: mix, updatedAt: serverTimestamp() }, { merge: true });
        return {
            success: true,
            questionCount: finalQuestions.length,
            expectedQuestionCount: questionCount,
            imageCount: drawn * 4,
            carriedCount: carried.length,
            status: finalStatus,
            kinds: countKinds(finalQuestions)
        };

    } catch (error) {
        console.error('Quiz generation failed:', error);
        await setDoc(quizDocRef(classId), { status: 'pending', updatedAt: serverTimestamp() }, { merge: true });
        throw error;
    }
}

// =============================================================================
// 3. QUIZ ATTEMPTS (LOGGING)
// =============================================================================

export async function logQuizAttempt(classId, { studentId, questionId, correct, attemptNumber, answeredAt, selectedAnswer }) {
    const ref = doc(quizAttemptsCollectionRef(classId));
    await setDoc(ref, {
        quizId: quizDocId(classId),
        studentId,
        classId,
        weekKey: weekKey(),
        questionId,
        selectedAnswer,
        correct,
        attemptNumber,
        answeredAt,
        teacherId: state.get('currentUserId'),
        createdAt: serverTimestamp()
    });
}

export async function getQuizAttempts(classId, week) {
    const wk = week || weekKey();
    const collRef = collection(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week/${classId}_${wk}/attempts`);
    const snap = await getDocs(collRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =============================================================================
// 3b. TEACHER REVIEW + CARRY-FORWARD (both optional)
// =============================================================================

/**
 * Save the teacher's edited questions. `approve: true` makes a quiz that was waiting
 * in review ready to play. A quiz that is already ready simply keeps its status.
 */
export async function saveReviewedQuestions(classId, questions = [], { approve = false } = {}) {
    const quiz = await getQuizForClass(classId);
    if (!quiz) throw new Error('No quiz found for this class this week.');
    if (quiz.status === 'completed' || quiz.status === 'active') {
        throw new Error('This quiz has already been played, so its questions can no longer change.');
    }

    const cleaned = questions
        .map((question, index) => sanitizeQuizQuestion(question, `q${index + 1}`))
        .filter(Boolean)
        .map((question, index) => ({ ...question, id: `q${index + 1}` }));
    if (cleaned.length < QUIZ_MIN_QUESTIONS) {
        throw new Error(`Keep at least ${QUIZ_MIN_QUESTIONS} complete questions (a question and at least two answers).`);
    }

    const nextStatus = approve ? 'ready' : (quiz.status === 'review' ? 'review' : quiz.status);
    await setDoc(quizDocRef(classId), {
        questions: cleaned,
        status: nextStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
        updatedAt: serverTimestamp()
    }, { merge: true });
    return { status: nextStatus, questionCount: cleaned.length };
}

/**
 * The most recent completed quiz before this week, with item analysis and the questions
 * the class missed. Older quizzes without stored stats are analysed from their attempts.
 */
export async function getPreviousQuizReview(classId) {
    const currentWeek = weekKey();
    const history = await getQuizHistory(classId, 3);
    const previous = history.find((quiz) => quiz.weekKey && quiz.weekKey !== currentWeek);
    if (!previous) return null;

    let stats = Array.isArray(previous.results?.questionStats) ? previous.results.questionStats : null;
    if (!stats) {
        const attempts = await getQuizAttempts(classId, previous.weekKey).catch(() => []);
        stats = computeQuestionStats(previous.questions || [], attempts);
    }
    const missed = selectMissedQuestions(stats);
    return {
        weekKey: previous.weekKey,
        tier: previous.results?.tier || null,
        stats,
        missed,
        // Paired so the settings list can show each missed stat next to the question it would carry.
        carryCandidates: missed
            .map((stat, index) => ({ stat, question: statToCarriedQuestion(stat, previous.weekKey, index) }))
            .filter((candidate) => candidate.question)
    };
}

// =============================================================================
// 4. REWARDS — rules in features/quizRewardsCore.mjs
// =============================================================================

const QUIZ_ALREADY_PAID = 'quiz-rewards-already-paid';

/** One treasure from the league's stall for the champion, or Gold when the stall is empty. */
async function grantQuizPrize(classId, studentId, tier, league) {
    const candidates = quizPrizeCandidates(await loadLeagueStall(league), tier).slice(0, 5);
    return grantStallTreasure(studentId, candidates, { league, source: 'quiz_prize', fallbackGold: QUIZ_PRIZE_FALLBACK_GOLD });
}

/**
 * Pays this week's quiz once. `attempts` are the turns logged during the show.
 * Returns what was paid so the curtain call can show it.
 */
export async function distributeQuizRewards(classId, results, { attempts = [] } = {}) {
    const tier = computeQuizRewardTier(results.firstTryCorrectPct);
    const heroRewards = computeHeroRewards(attempts);
    const empty = { tier, distributed: false, studentRewards: [], questBonus: 0, guildGloryByGuild: {}, prize: null };
    if (!heroRewards.length) return empty;

    const classData = state.get('allSchoolClasses')?.find((c) => c.id === classId);
    const yearKey = state.getActiveSchoolYearKey();
    const teacher = { uid: state.get('currentUserId'), name: state.get('currentTeacherName') };
    const goldContext = getLiveYearGoldContextFromState(state);

    try {
        // ── Stars and Gold for every hero who took a turn, and the paid mark, in one transaction ──
        await runTransaction(db, async (transaction) => {
            const quizSnap = await transaction.get(quizDocRef(classId));
            if (quizSnap.exists() && (quizSnap.data().rewardsPaidAt || quizSnap.data().status === 'completed')) {
                throw new Error(QUIZ_ALREADY_PAID);
            }
            const reads = await Promise.all(heroRewards.map(async (hero) => {
                const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, hero.studentId);
                return { hero, scoreRef, scoreSnap: await transaction.get(scoreRef) };
            }));

            for (const { hero, scoreRef, scoreSnap } of reads) {
                if (!(hero.stars > 0) && !(hero.gold > 0)) continue;
                if (scoreSnap.exists()) {
                    const current = getLiveYearGold(scoreSnap.data(), goldContext);
                    const updates = { gold: current + hero.gold };
                    if (hero.stars > 0) {
                        updates.totalStars = increment(hero.stars);
                        updates.monthlyStars = increment(hero.stars);
                    }
                    transaction.update(scoreRef, updates);
                } else {
                    const student = state.get('allStudents')?.find((s) => s.id === hero.studentId);
                    transaction.set(scoreRef, withActiveScoreYear({
                        totalStars: hero.stars,
                        monthlyStars: hero.stars,
                        gold: hero.gold,
                        inventory: [],
                        createdBy: student?.createdBy || teacher
                    }, yearKey));
                }
                if (hero.stars > 0) {
                    const parts = [
                        hero.firstTry ? `${hero.firstTry} first try` : '',
                        hero.rescues ? `${hero.rescues} rescue${hero.rescues === 1 ? '' : 's'}` : ''
                    ].filter(Boolean).join(', ');
                    transaction.set(doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`)), withSchoolYear({
                        studentId: hero.studentId,
                        classId,
                        teacherId: teacher.uid,
                        stars: hero.stars,
                        appliedStarCredit: hero.stars,
                        reason: 'quiz_of_the_week',
                        note: `Quiz of the Week: ${parts}`,
                        date: getTodayDateString(),
                        createdAt: serverTimestamp(),
                        createdBy: teacher
                    }, yearKey));
                }
            }
            transaction.set(quizDocRef(classId), { rewardsPaidAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        });

        // ── Glory comes from the stars, the same as any other star ──
        const guildGloryByGuild = {};
        for (const hero of heroRewards) {
            if (!(hero.stars > 0)) continue;
            const delta = await updateGuildScores(hero.studentId, hero.stars, 'quiz_of_the_week').catch((error) => {
                console.warn('Quiz Glory failed for a hero:', error);
                return null;
            });
            const guildId = state.get('allStudents')?.find((s) => s.id === hero.studentId)?.guildId;
            const glory = Number(delta?.totalGloryDelta) || 0;
            if (guildId && glory > 0) guildGloryByGuild[guildId] = Math.round(((guildGloryByGuild[guildId] || 0) + glory) * 100) / 100;
        }

        // ── Team Quest bonus for the whole class, from the class score ──
        const questBonus = QUIZ_TEAM_BONUS[tier] || 0;
        if (questBonus > 0) {
            await applyClassQuestBonusDelta(classId, questBonus, `Quiz of the Week - ${tier.toUpperCase()}`).catch((error) => {
                console.warn('Quiz Team Quest bonus failed:', error);
            });
        }

        // ── One Quiz Champion, one treasure from the league's stall ──
        let prize = null;
        const history = await getQuizHistory(classId, 60).catch(() => []);
        const championId = pickQuizChampion(heroRewards, { prizeWins: countQuizPrizeWins(history) });
        if (championId) {
            prize = await grantQuizPrize(classId, championId, tier, classData?.questLevel || 'A').catch((error) => {
                console.warn('Quiz prize failed:', error);
                return null;
            });
        }

        playSound('magic_chime');
        showPraiseToast('Quiz complete! Rewards are in the heroes’ pockets.', '🎯');

        return {
            tier,
            distributed: true,
            rewardedStudents: heroRewards.filter((hero) => hero.stars > 0 || hero.gold > 0).length,
            studentRewards: heroRewards.map((hero) => ({
                studentId: hero.studentId,
                correctCount: hero.correct,
                firstTry: hero.firstTry,
                rescues: hero.rescues,
                stars: hero.stars,
                gold: hero.gold,
                brave: hero.brave
            })),
            questBonus,
            guildGloryByGuild,
            totalGloryDistributed: Object.values(guildGloryByGuild).reduce((a, b) => a + b, 0),
            prize
        };
    } catch (error) {
        if (error?.message === QUIZ_ALREADY_PAID) {
            showToast('This week’s quiz rewards were already given.', 'info');
            return { ...empty, alreadyPaid: true };
        }
        console.error('Quiz reward distribution failed:', error);
        showToast('Failed to distribute quiz rewards.', 'error');
        throw error;
    }
}
