import { db, doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp, increment, arrayUnion, runTransaction, where, query, deleteDoc } from '../../firebase.js';
import * as state from '../../state.js';
import { compressImageBase64, getTodayDateString, getLeagueAiAudience, getLeagueAiVisualStyle } from '../../utils.js';
import { getISOWeekKey, getTargetWeekKey, updateGuildScores } from '../../features/guildScoring.js';
import { callGeminiApi, extractJsonFromAiText, callCloudflareAiImageApi } from '../../api.js';
import { applyClassQuestBonusDelta } from './fortuneWheelEffects.js';
import { adjustGuildGlory, applyGloryModifier } from './guilds.js';
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

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

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

export async function saveQuizCurriculum(classId, { type, categories, keywords, questLevel, reviewBeforeLive = false, carryForward = [] }) {
    const wk = weekKey();
    const docId = quizDocId(classId);
    const ref = doc(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week`, docId);
    const carried = (Array.isArray(carryForward) ? carryForward : [])
        .map((question, index) => sanitizeQuizQuestion(question, `r${index + 1}`))
        .filter(Boolean);

    await setDoc(ref, withSchoolYear({
        classId,
        weekKey: wk,
        status: 'pending',
        curriculum: { type, categories, keywords },
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
// =============================================================================

function buildGenerationPrompt() {
    return `You are a JSON API for an English language teaching application.
Your ONLY job is to output a single valid JSON object — no markdown, no code fences, no prose, no explanation.
The JSON object MUST have exactly one top-level key: "questions", whose value is a JSON array.
Do NOT wrap it in any other key. Do NOT add any text before or after the JSON.`;
}

function buildGenerationUserPrompt(curriculum, questLevel, questionCount = 7) {
    const ageDesc = getLeagueAiAudience(questLevel);
    const typeLabel = curriculum.type === 'grammar' ? 'English Grammar' :
        curriculum.type === 'vocabulary' ? 'English Vocabulary' :
        'English (Grammar and Vocabulary mix)';
    const categoriesList = (curriculum.categories || []).join(', ');
    const keywords = curriculum.keywords || '';

    return `Create a weekly English quiz for ${ageDesc}.
Subject: ${typeLabel}.
${categoriesList ? `Topics: ${categoriesList}.` : ''}
${keywords ? `Specific focus: "${keywords}".` : ''}

Rules:
- Generate exactly ${questionCount} questions (no more, no less).
- Use only this question type: "mcq" (4-option multiple choice).
- Make every question directly relevant to the topics/focus listed above.
- Keep language appropriate for ${ageDesc}.
- Keep explanations very short (max 10 words each).
- Do NOT produce any text outside the JSON object.

Output this exact JSON shape (nothing else):
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correctIndex":0,"correctAnswer":"A","explanation":"short reason"},{"type":"mcq","question":"Which word means happy?","options":["Sad","Joyful","Angry","Tired"],"correctIndex":1,"correctAnswer":"Joyful","explanation":"synonym for happy"},{"type":"mcq","question":"Choose the correct sentence.","options":["He are reading.","He is reading.","He reading.","He am reading."],"correctIndex":1,"correctAnswer":"He is reading.","explanation":"subject and verb agree"}]}`;
}

// Recursively search a parsed object for the first array whose items look like questions.
function deepFindQuestions(obj, depth = 0) {
    if (depth > 4 || obj === null || typeof obj !== 'object') return [];
    if (Array.isArray(obj)) {
        // If every item has a 'question' or 'type' field, treat as questions array
        if (obj.length > 0 && obj.every(item => item && (item.question || item.type))) return obj;
        for (const item of obj) {
            const found = deepFindQuestions(item, depth + 1);
            if (found.length > 0) return found;
        }
        return [];
    }
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (Array.isArray(val) && val.length > 0 && val.every(item => item && (item.question || item.type))) {
            return val;
        }
        if (val && typeof val === 'object') {
            const found = deepFindQuestions(val, depth + 1);
            if (found.length > 0) return found;
        }
    }
    return [];
}

// Walk the raw AI text character-by-character and recover every complete {…} object
// that looks like a question. Handles truncated responses gracefully.
function extractPartialQuestions(rawText) {
    const found = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < rawText.length; i++) {
        const ch = rawText[i];
        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                try {
                    const obj = JSON.parse(rawText.slice(start, i + 1));
                    if (obj && obj.type && obj.question) found.push(obj);
                } catch (_) { /* incomplete or invalid — skip */ }
                start = -1;
            }
        }
    }
    return found;
}

export async function generateQuizQuestions(classId) {
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
            await updateQuizStatus(classId, finalStatus, processedOnlyReview);
            await setDoc(quizDocRef(classId), { expectedQuestionCount: questionCount, updatedAt: serverTimestamp() }, { merge: true });
            return { success: true, questionCount: processedOnlyReview.length, expectedQuestionCount: questionCount, imageCount: 0, carriedCount: carried.length, status: finalStatus };
        }

        const systemPrompt = buildGenerationPrompt();
        const userPrompt = buildGenerationUserPrompt(quiz.curriculum, quiz.questLevel, freshCount);

        const aiResult = await callGeminiApi(systemPrompt, userPrompt, { retries: 2, baseDelay: 1000, timeoutMs: 60000 });
        let parsed = null;
        try {
            parsed = extractJsonFromAiText(aiResult);
        } catch (parseErr) {
            // JSON couldn't be parsed at all — fall through to partial recovery below
        }

        // Accept { questions: [...] }, a bare array, a deeply-nested questions key,
        // or — if the response was truncated — recover all complete question objects.
        let questions = parsed == null ? [] :
            Array.isArray(parsed)
                ? parsed
                : (Array.isArray(parsed?.questions) ? parsed.questions : deepFindQuestions(parsed));

        if (questions.length === 0) {
            // Last resort: scan the raw string for complete question objects
            questions = extractPartialQuestions(aiResult);
        }

        const minimumFresh = Math.min(QUIZ_MIN_QUESTIONS, freshCount);
        if (questions.length < minimumFresh || (questions.length + carried.length) < QUIZ_MIN_QUESTIONS) {
            console.error('Quiz: not enough questions recovered. Raw AI response:', aiResult, 'Parsed:', parsed, 'Recovered:', questions);
            throw new Error(`Only ${questions.length} question(s) recovered from AI response (need at least ${minimumFresh}). Raw response logged to console.`);
        }

        const processed = questions.slice(0, freshCount).map((q, i) => ({
            id: `q${i + 1}`,
            type: q.type || 'mcq',
            question: q.question || '',
            options: q.type === 'mcq' ? (q.options || ['A', 'B', 'C', 'D']) : [],
            correctIndex: q.type === 'mcq' ? Math.max(0, Math.min(3, q.correctIndex || 0)) : null,
            correctAnswer: q.correctAnswer || (q.type === 'mcq' ? ((q.options || [])[q.correctIndex || 0] || '') : ''),
            imagePrompt: q.type === 'image' ? q.imagePrompt || '' : '',
            imageUrl: null,
            explanation: q.explanation || ''
        }));

        // Generate images for image-type questions and upload to Storage
        const { uploadImageToStorage } = await import('../../utils.js');
        const imagePromises = processed.map(async (q) => {
            if (q.type === 'image' && q.imagePrompt) {
                try {
                    const ageStyle = getLeagueAiVisualStyle(quiz.questLevel);
                    const fullPrompt = `${q.imagePrompt}, ${ageStyle}`;
                    const rawBase64 = await callCloudflareAiImageApi(fullPrompt, '', {}, { retries: 1, timeoutMs: 30000 });
                    const base64 = await compressImageBase64(rawBase64, 768, 768, 0.82);
                    const storagePath = `quiz_images/${state.get('currentUserId')}/${quizDocId(classId)}_${q.id}.jpg`;
                    q.imageUrl = await uploadImageToStorage(base64, storagePath);
                } catch (e) {
                    console.warn('Quiz image generation failed for question:', q.id, e);
                }
            }
        });

        await Promise.allSettled(imagePromises);

        const finalQuestions = mergeCarriedQuestions(processed, carried, questionCount);
        await updateQuizStatus(classId, finalStatus, finalQuestions);
        // Store expected question count for reference
        await setDoc(quizDocRef(classId), { expectedQuestionCount: questionCount, updatedAt: serverTimestamp() }, { merge: true });
        return {
            success: true,
            questionCount: finalQuestions.length,
            expectedQuestionCount: questionCount,
            imageCount: finalQuestions.filter(q => q.imageUrl).length,
            carriedCount: carried.length,
            status: finalStatus
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
// 4. REWARD DISTRIBUTION (SAFE TRANSACTIONS)
// =============================================================================

function computePerformanceTier(firstTryCorrectPct) {
    if (firstTryCorrectPct === 100) return 'legendary';
    if (firstTryCorrectPct >= 80) return 'epic';
    if (firstTryCorrectPct >= 60) return 'rare';
    if (firstTryCorrectPct >= 40) return 'common';
    return 'heroic';
}

const REWARD_TABLE = {
    legendary: { starPerCorrect: 1, goldPerCorrect: 2, questBonus: 3, gloryPerGuild: 3, gloryMultiplier: true, artifactChance: 0.3 },
    epic:      { starPerCorrect: 0.5, goldPerCorrect: 1, questBonus: 2, gloryPerGuild: 2, gloryMultiplier: false, artifactChance: 0.15 },
    rare:      { starPerCorrect: 0.5, goldPerCorrect: 0.5, questBonus: 1, gloryPerGuild: 1, gloryMultiplier: false, artifactChance: 0 },
    common:    { starPerCorrect: 0.25, goldPerCorrect: 0.25, questBonus: 1, gloryPerGuild: 1, gloryMultiplier: false, artifactChance: 0 },
    heroic:    { starPerCorrect: 0, goldPerCorrect: 0.25, questBonus: 0.5, gloryPerGuild: 0.5, gloryMultiplier: false, artifactChance: 0.05 }
};

const LEGENDARY_ARTIFACTS = [
    { id: 'leg_gilded', name: 'Scroll of the Gilded Star', icon: '📜', description: 'Triple gold on next star award' },
    { id: 'leg_luck', name: 'Elixir of Luck', icon: '🧪', description: '50% chance for bonus star next lesson' },
    { id: 'leg_banner', name: 'Banner of Glory', icon: '🏳️', description: 'Next 3 stars give +1 bonus Glory' },
    { id: 'leg_chalice', name: 'Chalice of Radiance', icon: '🏆', description: 'Guildmates get +1 Glory on next star' },
    { id: 'leg_compass', name: 'Compassion Token', icon: '💝', description: 'Free Hero Boons for rest of month' }
];

function pickRandomItem(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

export async function distributeQuizRewards(classId, results) {
    const tier = computePerformanceTier(results.firstTryCorrectPct);
    const rewards = REWARD_TABLE[tier];
    const correctAnswerCounts = results.correctAnswerCounts || {};
    const correctStudentIds = Object.keys(correctAnswerCounts).filter((studentId) => (correctAnswerCounts[studentId] || 0) > 0);
    const allParticipatingIds = results.allParticipating || [];
    const guildMap = results.studentGuilds || {};
    const classData = state.get('allSchoolClasses')?.find(c => c.id === classId);
    const questLevel = classData?.questLevel || 'A';

    if (correctStudentIds.length === 0 && allParticipatingIds.length === 0) {
        return { tier, distributed: false, message: 'No students to reward.' };
    }

    try {
        // --- Transaction 1: Individual rewards (stars + gold + possible artifacts) ---
        const rewardedStudents = [];
        const awardedArtifacts = [];

        // Firestore transactions require ALL reads to be executed before ALL writes.
        // We collect refs + rolls outside then do a two-pass: reads first, then writes.
        await runTransaction(db, async (transaction) => {
            // ── PASS 1: All reads ──────────────────────────────────────────────────
            const correctReads = await Promise.all(
                correctStudentIds.map(async (studentId) => {
                    const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                    const scoreSnap = await transaction.get(scoreRef);
                    return { studentId, scoreRef, scoreSnap };
                })
            );

            // Heroic participation reads (only students not already in correct list)
            const heroicParticipantIds = tier === 'heroic'
                ? allParticipatingIds.filter(id => !correctStudentIds.includes(id))
                : [];
            const heroicReads = await Promise.all(
                heroicParticipantIds.map(async (studentId) => {
                    const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                    const scoreSnap = await transaction.get(scoreRef);
                    return { studentId, scoreRef, scoreSnap };
                })
            );

            // ── PASS 2: All writes ─────────────────────────────────────────────────
            for (const { studentId, scoreRef, scoreSnap } of correctReads) {
                const correctCount = Math.max(1, Number(correctAnswerCounts[studentId]) || 0);
                const starsAwarded = rewards.starPerCorrect * correctCount;
                const goldAwarded = rewards.goldPerCorrect * correctCount;
                const scoreData = scoreSnap.exists() ? scoreSnap.data() : {};

                const updates = {
                    totalStars: increment(starsAwarded),
                    monthlyStars: increment(starsAwarded),
                    gold: increment(goldAwarded),
                };

                if (scoreSnap.exists()) {
                    transaction.update(scoreRef, updates);
                } else {
                    const student = state.get('allStudents')?.find(s => s.id === studentId);
                    transaction.set(scoreRef, withActiveScoreYear({
                        totalStars: starsAwarded,
                        monthlyStars: starsAwarded,
                        gold: goldAwarded,
                        inventory: [],
                        createdBy: student?.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    }, state.getActiveSchoolYearKey()));
                }

                const logRef = doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`));
                transaction.set(logRef, withSchoolYear({
                    studentId,
                    classId,
                    teacherId: state.get('currentUserId'),
                    stars: starsAwarded,
                    appliedStarCredit: starsAwarded,
                    reason: 'quiz_of_the_week',
                    note: `Quiz of the Week - ${correctCount} correct answer${correctCount === 1 ? '' : 's'} - Tier: ${tier.toUpperCase()}`,
                    date: getTodayDateString(),
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                }, state.getActiveSchoolYearKey()));

                rewardedStudents.push({ studentId, correctCount, stars: starsAwarded, gold: goldAwarded });
            }

            // Heroic tier: participation gold writes
            for (const { studentId, scoreRef, scoreSnap } of heroicReads) {
                if (scoreSnap.exists()) {
                    transaction.update(scoreRef, { gold: increment(rewards.goldPerCorrect) });
                } else {
                    const student = state.get('allStudents')?.find(s => s.id === studentId);
                    transaction.set(scoreRef, withActiveScoreYear({
                        totalStars: 0,
                        monthlyStars: 0,
                        gold: rewards.goldPerCorrect,
                        inventory: [],
                        createdBy: student?.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    }, state.getActiveSchoolYearKey()));
                }
            }
        });

        // --- Reward 2: Class Quest Bonus (safe, separate transaction) ---
        if (rewards.questBonus > 0) {
            await applyClassQuestBonusDelta(classId, rewards.questBonus, `Quiz of the Week - ${tier.toUpperCase()}`);
        }

        for (const rewarded of rewardedStudents) {
            if (Number(rewarded.stars) > 0) {
                await updateGuildScores(rewarded.studentId, Number(rewarded.stars), 'quiz_of_the_week');
            }
        }

        // --- Reward 3: Guild Glory ---
        const guildGloryByGuild = {};
        for (const studentId of correctStudentIds) {
            const gId = guildMap[studentId];
            if (gId) {
                guildGloryByGuild[gId] = (guildGloryByGuild[gId] || 0) + (rewards.gloryPerGuild * (correctAnswerCounts[studentId] || 0));
            }
        }
        for (const [guildId, glory] of Object.entries(guildGloryByGuild)) {
            if (glory > 0) {
                await adjustGuildGlory(guildId, glory, 'quiz_of_the_week');
            }
        }

        // --- Reward 4: Glory multiplier for legendary tier ---
        if (rewards.gloryMultiplier) {
            const bestGuild = Object.entries(guildGloryByGuild).sort((a, b) => b[1] - a[1])[0];
            if (bestGuild) {
                const now = Date.now();
                await applyGloryModifier(bestGuild[0], {
                    type: 'multiply',
                    factor: 1.2,
                    source: 'quiz_week_triumph',
                    label: 'Quiz Week Triumph',
                    expiresAt: now + (24 * 60 * 60 * 1000)
                });
            }
        }

        // --- Reward 5: One lucky top-scorer gets an artifact (legendary/epic tiers only) ---
        const isTreasureTier = tier === 'legendary' || tier === 'epic';
        if (isTreasureTier && correctStudentIds.length > 0) {
            const luckyId = correctStudentIds[Math.floor(Math.random() * correctStudentIds.length)];
            const randomArtifact = pickRandomItem(LEGENDARY_ARTIFACTS);
            if (randomArtifact) {
                try {
                    await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, luckyId);
                        const scoreSnap = await transaction.get(scoreRef);
                        const currentInventory = scoreSnap.exists()
                            ? (Array.isArray(scoreSnap.data().inventory) ? scoreSnap.data().inventory : [])
                            : [];
                        transaction.update(scoreRef, {
                            inventory: [...currentInventory, { ...randomArtifact, source: 'quiz_treasure', awardedAt: new Date().toISOString() }]
                        });
                    });
                    awardedArtifacts.push({ studentId: luckyId, artifact: randomArtifact, type: 'treasure' });
                } catch (e) {
                    console.warn('Random class treasure failed:', e);
                }
            }
        }

        // --- Mark quiz as completed ---
        await markQuizCompleted(classId, {
            tier,
            firstTryCorrectPct: results.firstTryCorrectPct,
            totalQuestions: results.totalQuestions,
            correctFirstTry: results.correctFirstTry,
            rewardedStudents: rewardedStudents.length,
            totalCorrectAnswers: Object.values(correctAnswerCounts).reduce((sum, count) => sum + count, 0),
            awardedArtifacts: awardedArtifacts.length
        });

        playSound('magic_chime');
        const student = state.get('allStudents')?.find(s => s.id === allParticipatingIds[0]);
        const studentName = student ? student.name : 'Hero';
        showPraiseToast(`Quiz complete! ${tier.toUpperCase()} performance — rewards granted!`, '🎯');

        return {
            tier,
            rewardedStudents: rewardedStudents.length,
            studentRewards: rewardedStudents.map((rewardedStudent) => ({
                studentId: rewardedStudent.studentId,
                correctCount: rewardedStudent.correctCount,
                stars: rewardedStudent.stars,
                gold: rewardedStudent.gold
            })),
            questBonus: rewards.questBonus,
            guildGloryByGuild,
            totalGloryDistributed: Object.values(guildGloryByGuild).reduce((a, b) => a + b, 0),
            awardedArtifacts
        };

    } catch (error) {
        console.error('Quiz reward distribution failed:', error);
        showToast('Failed to distribute quiz rewards.', 'error');
        throw error;
    }
}
