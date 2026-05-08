import * as state from '../state.js';
import * as utils from '../utils.js';
import { getISOWeekKey } from '../features/guildScoring.js';
import { canUseFeature } from '../utils/subscription.js';
import {
    getQuizForClass,
    saveQuizCurriculum,
    generateQuizQuestions,
    updateQuizStatus,
    logQuizAttempt,
    distributeQuizRewards,
    getQuizHistory
} from '../db/actions/quizOfTheWeek.js';

// =============================================================================
// 1. VISIBILITY LOGIC — Should the quiz button appear?
// =============================================================================

export async function shouldShowQuizButton(classId) {
    if (!classId) return false;
    if (!canUseFeature('quizOfTheWeek')) return false;

    const quiz = await getQuizForClass(classId);
    const currentWeek = getISOWeekKey(new Date());

    // No quiz at all for this week → don't show
    if (!quiz) {
        return 'no_quiz';
    }

    // Quiz already completed this week → show results
    if (quiz.status === 'completed') {
        return 'completed';
    }

    // Quiz not ready yet → don't show play button
    if (quiz.status !== 'ready' && quiz.status !== 'active') {
        return quiz.weekKey === currentWeek ? 'generating' : 'no_quiz';
    }

    // Check if today is the class's first scheduled day of the week
    if (!isFirstLessonDay(classId)) {
        return 'not_first_lesson';
    }

    // Check if we're within the class's lesson time window
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

    if (!isFirstLessonDay(classId)) return null;
    if (!isWithinLessonTime(classId)) return null;

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
    if (!classData || !classData.timeStart || !classData.timeEnd) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= classData.timeStart && currentTime <= classData.timeEnd;
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
        attempts: [],
        inProgress: false
    };
    return quizState[classId];
}

export function getQuizState(classId) {
    return quizState[classId] || null;
}

export async function loadQuizForClass(classId) {
    const quiz = await getQuizForClass(classId);
    if (!quiz || !quiz.questions || quiz.questions.length === 0) return false;

    const students = state.get('allStudents')?.filter(s => s.classId === classId) || [];
    if (students.length === 0) return false;

    const qs = initQuiz(classId);
    qs.questions = [...quiz.questions];
    qs.totalQuestions = quiz.questions.length;
    qs.inProgress = true;

    // Shuffle questions
    for (let i = qs.questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs.questions[i], qs.questions[j]] = [qs.questions[j], qs.questions[i]];
    }
    qs.remainingQuestions = [...qs.questions];

    // Build shuffled student pool
    qs.studentPool = students.map(s => s.id);
    for (let i = qs.studentPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs.studentPool[i], qs.studentPool[j]] = [qs.studentPool[j], qs.studentPool[i]];
    }

    return true;
}

export function pickNextQuestion(classId) {
    const qs = quizState[classId];
    if (!qs || qs.remainingQuestions.length === 0) return null;

    const question = qs.remainingQuestions.shift();
    qs.currentQuestion = question;

    // Pick random student from the pool
    const pool = qs.studentPool.filter(s => !qs.exhaustedStudents.has(s + '_' + question.id));
    if (pool.length === 0) {
        // Reset exhausted students for this question
        qs.exhaustedStudents = new Set();
    }

    const studentPool = qs.studentPool.filter(s => !qs.exhaustedStudents.has(s + '_' + question.id));
    const studentId = studentPool[Math.floor(Math.random() * studentPool.length)];
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

    if (correct) {
        qs.answeredQuestions.push(question);
        if (attemptNumber === 1) {
            qs.correctFirstTry++;
        }
        qs.currentQuestion = null;
        qs.currentStudent = null;
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
        } else {
            // Don't consume current question — pick a new student for the same question
            qs.remainingQuestions.unshift(question); // Put it back
        }
    }

    return getQuizProgress(classId);
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
    const studentGuilds = {};
    const correctStudents = [];
    const allParticipating = new Set();

    for (const attempt of qs.attempts) {
        allParticipating.add(attempt.studentId);
        if (attempt.correct) {
            correctStudents.push(attempt.studentId);
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
        studentGuilds
    };

    try {
        const rewardResult = await distributeQuizRewards(classId, results);
    return { ...results, rewards: rewardResult };
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

// formatDateKey helper not built into utils.js — patch it
if (!utils.formatDateKey) {
    utils.formatDateKey = function (date) {
        const d = new Date(date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };
}
