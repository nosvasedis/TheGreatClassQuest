import { db, doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp, increment, arrayUnion, runTransaction, where, query } from '../../firebase.js';
import * as state from '../../state.js';
import { getTodayDateString } from '../../utils.js';
import { getISOWeekKey } from '../../features/guildScoring.js';
import { callGeminiApi, extractJsonFromAiText, callCloudflareAiImageApi } from '../../api.js';
import { applyClassQuestBonusDelta } from './fortuneWheelEffects.js';
import { adjustGuildGlory, applyGloryModifier } from './guilds.js';
import { playSound } from '../../audio.js';
import { showToast, showPraiseToast } from '../../ui/effects.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

function weekKey() {
    return getISOWeekKey(new Date());
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

export async function saveQuizCurriculum(classId, { type, categories, keywords, questLevel }) {
    const wk = weekKey();
    const docId = quizDocId(classId);
    const ref = doc(db, `${PUBLIC_DATA_PATH}/quiz_of_the_week`, docId);

    await setDoc(ref, {
        classId,
        weekKey: wk,
        status: 'pending',
        curriculum: { type, categories, keywords },
        questLevel,
        questions: [],
        results: null,
        generatedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    }, { merge: true });

    return { docId, weekKey: wk };
}

export async function updateQuizStatus(classId, status, questions = null) {
    const ref = quizDocRef(classId);
    const updates = { status, updatedAt: serverTimestamp() };
    if (questions) updates.questions = questions;
    if (status === 'ready' || status === 'generating') updates.generatedAt = serverTimestamp();
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

// =============================================================================
// 2. AI QUESTION GENERATION
// =============================================================================

const AGE_PROMPTS = {
    'Junior A': 'young children aged 7-8 (very simple words, short sentences, playful tone)',
    'Junior B': 'children aged 8-9 (simple language, fun facts, short sentences)',
    'A': 'students aged 9-10 (clear and friendly language, interesting facts)',
    'B': 'students aged 10-11 (moderate vocabulary, engaging content)',
    'C': 'students aged 11-12 (good vocabulary, thought-provoking content)',
    'D': 'students aged 12-13 (advanced vocabulary, challenging content okay)'
};

function buildGenerationPrompt() {
    return `You are a JSON API. Respond ONLY with a valid JSON object. No markdown, no explanation, no extra text.`;
}

function buildGenerationUserPrompt(curriculum, questLevel) {
    const ageDesc = AGE_PROMPTS[questLevel] || AGE_PROMPTS['A'];
    const typeLabel = curriculum.type === 'grammar' ? 'English Grammar' :
        curriculum.type === 'vocabulary' ? 'English Vocabulary' :
        'English (Grammar and Vocabulary mix)';
    const categoriesList = (curriculum.categories || []).join(', ');
    const keywords = curriculum.keywords || '';

    return `Create a weekly English quiz for ${ageDesc}.
Topic: ${typeLabel}.
${categoriesList ? `Categories: ${categoriesList}.` : ''}
${keywords ? `Keywords: "${keywords}".` : ''}

Generate 5 to 10 questions. Mix these question types:
- "mcq": 4-option multiple choice
- "fill": fill-in-the-blank (one word or short phrase answer)
- "image": describe an image for an AI image generator, then ask what is shown

Return a JSON object with this exact shape:
{
  "questions": [
    {
      "type": "mcq",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "correctAnswer": "option A",
      "explanation": "why this is correct"
    },
    {
      "type": "fill",
      "question": "The cat sat on the ___.",
      "correctAnswer": "mat",
      "explanation": "brief explanation"
    },
    {
      "type": "image",
      "question": "What animal is shown?",
      "imagePrompt": "a friendly golden retriever dog sitting in a sunny park, colorful cartoon style",
      "correctAnswer": "dog",
      "explanation": "brief explanation"
    }
  ]
}`;
}

const IMAGE_AGE_PROMPTS = {
    'Junior A': 'simple colorful cartoon illustration for young children aged 7-8, friendly and playful, bright colors, no text',
    'Junior B': 'colorful illustration for children aged 8-9, fun and engaging, bright and clear',
    'A': 'clear educational illustration for students aged 9-10, engaging and informative',
    'B': 'vibrant illustration for students aged 10-11, moderately detailed',
    'C': 'detailed illustration for students aged 11-12, thought-provoking and mature visual style',
    'D': 'high quality illustration for students aged 12-13, sophisticated and nuanced visual style'
};

export async function generateQuizQuestions(classId) {
    const quiz = await getQuizForClass(classId);
    if (!quiz || !quiz.curriculum) throw new Error('No quiz curriculum found');

    await updateQuizStatus(classId, 'generating');

    try {
        const systemPrompt = buildGenerationPrompt();
        const userPrompt = buildGenerationUserPrompt(quiz.curriculum, quiz.questLevel);

        const aiResult = await callGeminiApi(systemPrompt, userPrompt, { retries: 2, baseDelay: 1000, timeoutMs: 60000, jsonMode: true });
        const parsed = extractJsonFromAiText(aiResult);
        // Accept both { questions: [...] } wrapper and bare array
        let questions = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);

        if (questions.length === 0) throw new Error('AI generated no questions');

        const processed = questions.slice(0, 10).map((q, i) => ({
            id: `q${i + 1}`,
            type: q.type || 'mcq',
            question: q.question || '',
            options: q.type === 'mcq' ? (q.options || ['A', 'B', 'C', 'D']) : [],
            correctIndex: q.type === 'mcq' ? Math.max(0, Math.min(3, q.correctIndex || 0)) : null,
            correctAnswer: q.correctAnswer || (q.type === 'mcq' ? (q.options || [])[q.correctIndex || 0] : ''),
            imagePrompt: q.type === 'image' ? q.imagePrompt || '' : '',
            imageUrl: null,
            explanation: q.explanation || ''
        }));

        // Generate images for image-type questions in background
        const imagePromises = processed.map(async (q) => {
            if (q.type === 'image' && q.imagePrompt) {
                try {
                    const ageStyle = IMAGE_AGE_PROMPTS[quiz.questLevel] || IMAGE_AGE_PROMPTS['A'];
                    const fullPrompt = `${q.imagePrompt}, ${ageStyle}`;
                    q.imageUrl = await callCloudflareAiImageApi(fullPrompt, '', {}, { retries: 1, timeoutMs: 30000 });
                } catch (e) {
                    console.warn('Quiz image generation failed for question:', q.id, e);
                }
            }
        });

        await Promise.allSettled(imagePromises.map(p => p.catch(e => console.warn(e))));

        await updateQuizStatus(classId, 'ready', processed);
        return { success: true, questionCount: processed.length, imageCount: processed.filter(q => q.imageUrl).length };

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
    { id: 'leg_luck', name: 'Elixir of Luck', icon: '🧪', description: '20% chance for bonus star next lesson' },
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
    const correctStudentIds = results.correctStudents || [];
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

        await runTransaction(db, async (transaction) => {
            for (const studentId of correctStudentIds) {
                const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                const scoreSnap = await transaction.get(scoreRef);
                const scoreData = scoreSnap.exists() ? scoreSnap.data() : {};
                const currentGold = typeof scoreData.gold === 'number' ? scoreData.gold : 0;
                const currentInventory = Array.isArray(scoreData.inventory) ? scoreData.inventory : [];

                let inventoryUpdate = null;
                const artifactRoll = rewards.artifactChance > 0 && Math.random() < rewards.artifactChance;
                if (artifactRoll) {
                    const artifact = pickRandomItem(LEGENDARY_ARTIFACTS);
                    if (artifact) {
                        inventoryUpdate = [...currentInventory, { ...artifact, source: 'quiz_of_the_week', awardedAt: new Date().toISOString() }];
                        awardedArtifacts.push({ studentId, artifact });
                    }
                }

                const updates = {
                    totalStars: increment(rewards.starPerCorrect),
                    monthlyStars: increment(rewards.starPerCorrect),
                    gold: increment(rewards.goldPerCorrect),
                };
                if (inventoryUpdate) updates.inventory = inventoryUpdate;

                if (scoreSnap.exists()) {
                    transaction.update(scoreRef, updates);
                } else {
                    const student = state.get('allStudents')?.find(s => s.id === studentId);
                    transaction.set(scoreRef, {
                        totalStars: rewards.starPerCorrect,
                        monthlyStars: rewards.starPerCorrect,
                        gold: rewards.goldPerCorrect,
                        inventory: inventoryUpdate || [],
                        createdBy: student?.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    });
                }

                const logRef = doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`));
                transaction.set(logRef, {
                    studentId,
                    classId,
                    teacherId: state.get('currentUserId'),
                    stars: rewards.starPerCorrect,
                    reason: 'quiz_of_the_week',
                    note: `Quiz of the Week - Tier: ${tier.toUpperCase()}`,
                    date: getTodayDateString(),
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                });

                rewardedStudents.push(studentId);
            }

            // Heroic tier: participation gold for everyone (no stars)
            if (tier === 'heroic') {
                for (const studentId of allParticipatingIds) {
                    if (correctStudentIds.includes(studentId)) continue;
                    const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                    const scoreSnap = await transaction.get(scoreRef);
                    if (scoreSnap.exists()) {
                        transaction.update(scoreRef, { gold: increment(rewards.goldPerCorrect) });
                    } else {
                        const student = state.get('allStudents')?.find(s => s.id === studentId);
                        transaction.set(scoreRef, {
                            totalStars: 0,
                            monthlyStars: 0,
                            gold: rewards.goldPerCorrect,
                            inventory: [],
                            createdBy: student?.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        });
                    }
                }
            }
        });

        // --- Reward 2: Class Quest Bonus (safe, separate transaction) ---
        if (rewards.questBonus > 0) {
            await applyClassQuestBonusDelta(classId, rewards.questBonus, `Quiz of the Week - ${tier.toUpperCase()}`);
        }

        // --- Reward 3: Guild Glory ---
        const guildGloryByGuild = {};
        for (const studentId of correctStudentIds) {
            const gId = guildMap[studentId];
            if (gId) {
                guildGloryByGuild[gId] = (guildGloryByGuild[gId] || 0) + rewards.gloryPerGuild;
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

        // --- Reward 5: Random class treasure (1 random participant gets an artifact) ---
        if (allParticipatingIds.length > 0) {
            const luckyId = allParticipatingIds[Math.floor(Math.random() * allParticipatingIds.length)];
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
            awardedArtifacts: awardedArtifacts.length
        });

        playSound('magic_chime');
        const student = state.get('allStudents')?.find(s => s.id === allParticipatingIds[0]);
        const studentName = student ? student.name : 'Hero';
        showPraiseToast(`Quiz complete! ${tier.toUpperCase()} performance — rewards granted!`, '🎯');

        return {
            tier,
            rewardedStudents: rewardedStudents.length,
            questBonus: rewards.questBonus,
            totalGloryDistributed: Object.values(guildGloryByGuild).reduce((a, b) => a + b, 0),
            awardedArtifacts
        };

    } catch (error) {
        console.error('Quiz reward distribution failed:', error);
        showToast('Failed to distribute quiz rewards.', 'error');
        throw error;
    }
}
