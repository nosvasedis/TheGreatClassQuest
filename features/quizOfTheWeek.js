import * as state from '../state.js';
import * as utils from '../utils.js';
import { getISOWeekKey, getTargetWeekKey } from '../features/guildScoring.js';
import { GUILDS } from './guilds.js';
import { canUseFeature } from '../utils/subscription.js';
import {
    getQuizForClass,
    getQuizParticipationHistory,
    saveQuizCurriculum,
    generateQuizQuestions,
    updateQuizStatus,
    logQuizAttempt,
    markQuizCompleted,
    distributeQuizRewards,
    getQuizHistory
} from '../db/actions/quizOfTheWeek.js';

// =============================================================================
// 0. QUESTION COUNT SCALING — Proportional to class size
// =============================================================================

export function calculateQuestionCount(enrolledCount) {
    if (!enrolledCount || enrolledCount <= 0) return 7;
    return Math.min(15, Math.max(5, Math.ceil(enrolledCount * 0.75)));
}

// =============================================================================
// 1. VISIBILITY LOGIC — Should the quiz button appear?
// =============================================================================

export async function shouldShowQuizButton(classId) {
    if (!classId) return false;
    if (!canUseFeature('quizOfTheWeek')) return false;

    const quiz = await getQuizForClass(classId);
    const currentWeek = getTargetWeekKey();

    // No quiz at all for this week → don't show
    if (!quiz) {
        return 'no_quiz';
    }

    // Quiz already completed this week → show results (persists all week)
    if (quiz.status === 'completed') {
        return 'completed';
    }

    // Quiz not ready yet → don't show play button
    if (quiz.status !== 'ready' && quiz.status !== 'active') {
        return quiz.weekKey === currentWeek ? 'generating' : 'no_quiz';
    }

    // Only allow starting the quiz on the first lesson day of the week, during lesson time
    if (!isFirstLessonDay(classId)) {
        return 'not_first_lesson';
    }
    if (!isWithinLessonTime(classId)) {
        return 'outside_time';
    }

    // Check that we have students
    const students = state.get('allStudents')?.filter(s => s.classId === classId) || [];
    if (students.length === 0) {
        return 'no_students';
    }

    return 'show';
}

export function getQuizButtonState(classId) {
    // Synchronous version for rendering — returns cached/predicted state
    if (!classId || !canUseFeature('quizOfTheWeek')) return null;

    const classes = state.get('allSchoolClasses') || [];
    const classData = classes.find(c => c.id === classId);
    if (!classData) return null;

    const students = state.get('allStudents')?.filter(s => s.classId === classId) || [];
    if (students.length === 0) return null;

    return { classId, classData };
}

// =============================================================================
// 2. FIRST-LESSON-OF-THE-WEEK LOGIC
// =============================================================================

function isFirstLessonDay(classId) {
    const classes = state.get('allSchoolClasses') || [];
    const classData = classes.find(c => c.id === classId);
    if (!classData || !classData.scheduleDays || classData.scheduleDays.length === 0) return false;

    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayStr = utils.getTodayDateString();

    // Check if class meets today
    const scheduleDays = classData.scheduleDays.map(Number);
    if (!scheduleDays.includes(todayDayOfWeek)) return false;

    // Check that today is the first scheduled day in the week for this class
    // Sort schedule days, take the lowest number that comes before or equals today
    const sortedDays = [...scheduleDays].sort((a, b) => a - b);
    const firstDay = sortedDays[0];

    // Check if there's an earlier scheduled day this week that was cancelled
    // If so, and today is the next available day, it should also count
    const earliestAvailableDay = getEarliestAvailableDayThisWeek(classData);
    return todayDayOfWeek === earliestAvailableDay;
}

function getEarliestAvailableDayThisWeek(classData) {
    const scheduleOverrides = state.get('allScheduleOverrides') || [];
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayStr = utils.getTodayDateString();

    const scheduleDays = (classData.scheduleDays || []).map(Number).sort((a, b) => a - b);

    for (const day of scheduleDays) {
        if (day < todayDayOfWeek) {
            // This day has already passed this week
            const dayOffset = day - todayDayOfWeek;
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() + dayOffset);
            const pastDateStr = utils.getDDMMYYYY(pastDate);

            const wasCancelled = scheduleOverrides.some(o =>
                o.classId === classData.id &&
                o.date === pastDateStr &&
                o.isCancelled === true
            );

            if (wasCancelled) continue;
            // Already passed without being cancelled — not relevant for today
            continue;
        }

        if (day === todayDayOfWeek) {
            // Today
            const todayCancelled = scheduleOverrides.some(o =>
                o.classId === classData.id &&
                o.date === todayStr &&
                o.isCancelled === true
            );
            if (!todayCancelled) return day;
            continue;
        }

        // Future day — but we don't care about future days for "first lesson" check
        // We only care about what's happening today
    }

    return todayDayOfWeek; // Fallback
}

function isWithinLessonTime(classId) {
    const classes = state.get('allSchoolClasses') || [];
    const classData = classes.find(c => c.id === classId);
    if (!classData) return false;

    // Older classes may not have explicit times yet; treat as whole-day eligibility.
    if (!classData.timeStart && !classData.timeEnd) return true;

    const startMinutes = utils.parseClockToMinutes(classData.timeStart);
    const endMinutes = utils.parseClockToMinutes(classData.timeEnd);
    if (startMinutes == null || endMinutes == null) {
        // Be permissive for malformed legacy time strings instead of hiding the button.
        return true;
    }

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// =============================================================================
// 3. QUIZ STATE MACHINE (for the game-show modal)
// =============================================================================

const quizState = {};

export function initQuiz(classId) {
    quizState[classId] = {
        classId,
        questions: [],
        remainingQuestions: [],
        answeredQuestions: [],
        currentQuestion: null,
        studentPool: [],
        currentStudent: null,
        exhaustedStudents: new Set(),
        correctFirstTry: 0,
        totalQuestions: 0,
        absentCount: 0,
        priorityStudentOrder: [],
        selectionCursor: 0,
        studentsSeenThisQuiz: new Set(),
        attempts: [],
        inProgress: false
    };
    return quizState[classId];
}

function buildPriorityStudentOrder(students, participationHistory) {
    const recencyIndexByStudent = new Map();

    participationHistory.forEach((week, index) => {
        for (const studentId of week.participantIds || []) {
            if (!recencyIndexByStudent.has(studentId)) {
                recencyIndexByStudent.set(studentId, index);
            }
        }
    });

    return [...students]
        .map((student) => {
            const recencyIndex = recencyIndexByStudent.has(student.id)
                ? recencyIndexByStudent.get(student.id)
                : Number.POSITIVE_INFINITY;
            return {
                student,
                recencyIndex,
                tieBreaker: Math.random()
            };
        })
        .sort((a, b) => {
            if (a.recencyIndex !== b.recencyIndex) {
                return b.recencyIndex - a.recencyIndex;
            }
            return a.tieBreaker - b.tieBreaker;
        })
        .map((entry) => entry.student.id);
}

function chooseNextStudentId(qs, question) {
    const eligibleStudentIds = qs.studentPool.filter((studentId) => !qs.exhaustedStudents.has(studentId + '_' + question.id));
    if (eligibleStudentIds.length === 0) return null;

    const unseenEligibleIds = eligibleStudentIds.filter((studentId) => !qs.studentsSeenThisQuiz.has(studentId));
    const candidateIds = unseenEligibleIds.length > 0 ? unseenEligibleIds : eligibleStudentIds;
    const candidateSet = new Set(candidateIds);
    const priorityOrder = qs.priorityStudentOrder?.length > 0 ? qs.priorityStudentOrder : qs.studentPool;

    for (let offset = 0; offset < priorityOrder.length; offset++) {
        const index = (qs.selectionCursor + offset) % priorityOrder.length;
        const candidateId = priorityOrder[index];
        if (!candidateSet.has(candidateId)) continue;

        qs.selectionCursor = (index + 1) % priorityOrder.length;
        qs.studentsSeenThisQuiz.add(candidateId);
        return candidateId;
    }

    const fallbackId = candidateIds[0];
    qs.studentsSeenThisQuiz.add(fallbackId);
    return fallbackId;
}

export function getQuizState(classId) {
    return quizState[classId] || null;
}

export async function loadQuizForClass(classId) {
    const quiz = await getQuizForClass(classId);
    if (!quiz || !quiz.questions || quiz.questions.length === 0) return false;

    const students = state.get('allStudents')?.filter(s => s.classId === classId) || [];
    if (students.length === 0) return false;

    // Filter out absent students for today's session
    const absentIds = new Set(
        (state.get('allAttendanceRecords') || [])
            .filter(r => r.classId === classId && r.date === utils.getTodayDateString())
            .map(r => r.studentId)
    );
    const presentStudents = students.filter(s => !absentIds.has(s.id));
    if (presentStudents.length === 0) return false;

    const qs = initQuiz(classId);
    // Fully MCQ-only: typed-answer quiz types are excluded from the live experience.
    qs.questions = [...quiz.questions].filter((q) => q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2);
    if (qs.questions.length === 0) return false;
    qs.totalQuestions = qs.questions.length;
    qs.absentCount = absentIds.size;
    qs.inProgress = true;

    // Shuffle questions
    for (let i = qs.questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs.questions[i], qs.questions[j]] = [qs.questions[j], qs.questions[i]];
    }
    qs.remainingQuestions = [...qs.questions];

    let participationHistory = [];
    try {
        participationHistory = await getQuizParticipationHistory(classId, 10);
    } catch (error) {
        console.warn('Failed to load quiz participation history, falling back to current roster shuffle:', classId, error);
    }

    qs.priorityStudentOrder = buildPriorityStudentOrder(presentStudents, participationHistory);
    qs.studentPool = [...qs.priorityStudentOrder];

    return true;
}

export function pickNextQuestion(classId) {
    const qs = quizState[classId];
    if (!qs || qs.remainingQuestions.length === 0) return null;

    const question = qs.remainingQuestions.shift();
    qs.currentQuestion = question;

    const studentId = chooseNextStudentId(qs, question);
    if (!studentId) return null;
    qs.currentStudent = studentId;

    const students = state.get('allStudents') || [];
    const student = students.find(s => s.id === studentId);
    const scores = state.get('allStudentScores') || [];
    const score = scores.find(s => s.id === studentId);

    return {
        question,
        questionIndex: qs.questions.indexOf(question),
        totalQuestions: qs.totalQuestions,
        student: student ? { id: student.id, name: student.name, avatar: student.avatar } : null,
        score: score ? { totalStars: score.totalStars } : { totalStars: 0 },
        correctFirstTry: qs.correctFirstTry,
        answeredCount: qs.answeredQuestions.length
    };
}

export function getCurrentQuestion(classId) {
    return pickNextQuestion(classId);
}

export async function handleAnswer(classId, selectedAnswer, correct) {
    const qs = quizState[classId];
    if (!qs || !qs.currentQuestion || !qs.currentStudent) return null;

    const question = qs.currentQuestion;

    // Log the attempt
    const attemptNumber = (qs.attempts.filter(a => a.questionId === question.id).length) + 1;
    const attempt = {
        studentId: qs.currentStudent,
        questionId: question.id,
        selectedAnswer,
        correct,
        attemptNumber,
        answeredAt: new Date().toISOString()
    };
    qs.attempts.push(attempt);

    try {
        await logQuizAttempt(classId, attempt);
    } catch (e) {
        console.warn('Failed to log quiz attempt:', e);
    }

    let questionPassedToNextStudent = false;
    let questionResolved = false;
    let questionFailedUnsolved = false;

    if (correct) {
        qs.answeredQuestions.push(question);
        if (attemptNumber === 1) {
            qs.correctFirstTry++;
        }
        qs.currentQuestion = null;
        qs.currentStudent = null;
        questionResolved = true;
    } else {
        // Mark this student as exhausted for THIS question
        qs.exhaustedStudents.add(qs.currentStudent + '_' + question.id);

        // Check if we should still try another student
        const eligibleStudents = qs.studentPool.filter(s =>
            !qs.exhaustedStudents.has(s + '_' + question.id)
        );

        if (eligibleStudents.length === 0) {
            // No more students to try — move question to answered (as incorrect on first try)
            qs.answeredQuestions.push({ ...question, forceSkipped: true });
            qs.currentQuestion = null;
            qs.currentStudent = null;
            questionResolved = true;
            questionFailedUnsolved = true;
        } else {
            // Don't consume current question — pick a new student for the same question
            qs.remainingQuestions.unshift(question); // Put it back
            questionPassedToNextStudent = true;
        }
    }

    return {
        ...getQuizProgress(classId),
        questionResolved,
        questionFailedUnsolved,
        questionPassedToNextStudent
    };
}

export function skipQuestion(classId) {
    const qs = quizState[classId];
    if (!qs || !qs.currentQuestion) return null;

    qs.answeredQuestions.push({ ...qs.currentQuestion, forceSkipped: true });
    qs.currentQuestion = null;
    qs.currentStudent = null;
    return getQuizProgress(classId);
}

export function getQuizProgress(classId) {
    const qs = quizState[classId];
    if (!qs) return null;

    return {
        totalQuestions: qs.totalQuestions,
        answeredCount: qs.answeredQuestions.length,
        correctFirstTry: qs.correctFirstTry,
        remainingCount: qs.remainingQuestions.length + (qs.currentQuestion ? 1 : 0),
        isComplete: qs.answeredQuestions.length >= qs.totalQuestions,
        firstTryCorrectPct: qs.totalQuestions > 0
            ? Math.round((qs.correctFirstTry / qs.totalQuestions) * 100)
            : 0
    };
}

export async function finalizeQuiz(classId) {
    const qs = quizState[classId];
    if (!qs) return null;

    const progress = getQuizProgress(classId);

    // Build student guild map
    const students = state.get('allStudents') || [];
    const questionsById = Object.fromEntries((qs.questions || []).map((question) => [question.id, question]));
    const studentGuilds = {};
    const correctStudents = [];
    const allParticipating = new Set();
    const correctAnswerCounts = {};
    const studentPerformance = {};

    for (const attempt of qs.attempts) {
        allParticipating.add(attempt.studentId);

        if (!studentPerformance[attempt.studentId]) {
            studentPerformance[attempt.studentId] = {
                attemptedCount: 0,
                correctCount: 0,
                wrongCount: 0,
                solvedAnswers: []
            };
        }

        studentPerformance[attempt.studentId].attemptedCount++;

        if (attempt.correct && !correctStudents.includes(attempt.studentId)) {
            correctStudents.push(attempt.studentId);
        }

        if (attempt.correct) {
            studentPerformance[attempt.studentId].correctCount++;
            correctAnswerCounts[attempt.studentId] = (correctAnswerCounts[attempt.studentId] || 0) + 1;
            studentPerformance[attempt.studentId].solvedAnswers.push({
                questionId: attempt.questionId,
                prompt: questionsById[attempt.questionId]?.question || '',
                answer: attempt.selectedAnswer || ''
            });
        } else {
            studentPerformance[attempt.studentId].wrongCount++;
        }
    }

    for (const studentId of allParticipating) {
        const student = students.find(s => s.id === studentId);
        if (student?.guildId) {
            studentGuilds[studentId] = student.guildId;
        }
    }

    const results = {
        totalQuestions: progress.totalQuestions,
        correctFirstTry: progress.correctFirstTry,
        firstTryCorrectPct: progress.firstTryCorrectPct,
        correctStudents,
        allParticipating: [...allParticipating],
        studentGuilds,
        correctAnswerCounts,
        studentPerformance
    };

    try {
        const rewardResult = await distributeQuizRewards(classId, results);
        const studentRewardsById = Object.fromEntries(
            (rewardResult?.studentRewards || []).map((reward) => [reward.studentId, reward])
        );

        // Enrich rewards with human-readable student and guild details for results display
        const correctStudentDetails = correctStudents.map(id => {
            const s = students.find(st => st.id === id);
            const perf = studentPerformance[id] || { attemptedCount: 0, correctCount: 0, wrongCount: 0, solvedAnswers: [] };
            const reward = studentRewardsById[id] || { stars: 0, gold: 0, correctCount: perf.correctCount };
            return s ? {
                id: s.id,
                name: s.name,
                avatar: s.avatar || null,
                guildId: s.guildId || null,
                attemptedCount: perf.attemptedCount,
                correctCount: perf.correctCount,
                wrongCount: perf.wrongCount,
                solvedAnswers: perf.solvedAnswers,
                awardedStars: reward.stars || 0,
                awardedGold: reward.gold || 0
            } : { id };
        }).sort((a, b) => (b.correctCount || 0) - (a.correctCount || 0) || (b.awardedStars || 0) - (a.awardedStars || 0));

        const guildContributors = correctStudentDetails.reduce((acc, student) => {
            if (!student.guildId) return acc;
            if (!acc[student.guildId]) acc[student.guildId] = [];
            acc[student.guildId].push({
                name: student.name || 'Hero',
                correctCount: student.correctCount || 0
            });
            return acc;
        }, {});

        const guildGloryByGuild = rewardResult?.guildGloryByGuild || {};
        const guildDetails = Object.entries(guildGloryByGuild)
            .filter(([, glory]) => glory > 0)
            .map(([guildId, glory]) => {
                const def = GUILDS[guildId];
                return {
                    guildId,
                    name: def?.name || guildId,
                    emoji: def?.emoji || '⚜️',
                    primary: def?.primary || '#fbbf24',
                    glory,
                    contributors: (guildContributors[guildId] || []).sort((a, b) => b.correctCount - a.correctCount)
                };
            })
            .sort((a, b) => b.glory - a.glory);

        const finalResults = { ...results, rewards: { ...rewardResult, correctStudentDetails, guildDetails } };
        await markQuizCompleted(classId, finalResults);
        return finalResults;
    } catch (e) {
        console.error('Failed to distribute rewards:', e);
        return results;
    }
}

export function resetQuiz(classId) {
    delete quizState[classId];
}

// =============================================================================
// 4. UTILITY — format date for override lookup
// =============================================================================

function formatDateKey(date) {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}
