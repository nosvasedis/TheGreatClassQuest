/**
 * Pure helpers for Quiz of the Week review, item analysis, and carry-forward.
 * No Firestore or DOM here; covered by tests/quiz-review-core.test.mjs.
 */

export const QUIZ_MIN_QUESTIONS = 3;
export const QUIZ_OPTION_COUNT = 4;
/** A question counts as "missed" when fewer than this share of first tries were correct. */
export const QUIZ_MISSED_FIRST_TRY_RATE = 0.6;

function cleanText(value, max = 400) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Normalise one MCQ question (from AI, from the review editor, or carried forward).
 * Returns null when the question cannot be played (empty prompt, fewer than 2 options).
 */
export function sanitizeQuizQuestion(raw = {}, fallbackId = 'q1') {
    const question = cleanText(raw.question, 300);
    const options = (Array.isArray(raw.options) ? raw.options : [])
        .map((option) => cleanText(option, 160))
        .slice(0, QUIZ_OPTION_COUNT);
    const filled = options.filter(Boolean);
    if (!question || filled.length < 2) return null;

    let correctIndex = Number.isInteger(raw.correctIndex) ? raw.correctIndex : Number.parseInt(raw.correctIndex, 10);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length || !options[correctIndex]) {
        const byAnswer = options.findIndex((option) => option && option === cleanText(raw.correctAnswer, 160));
        correctIndex = byAnswer >= 0 ? byAnswer : options.findIndex(Boolean);
    }

    const sanitized = {
        id: cleanText(raw.id, 40) || fallbackId,
        type: 'mcq',
        question,
        options,
        correctIndex,
        correctAnswer: options[correctIndex],
        explanation: cleanText(raw.explanation, 200),
        imagePrompt: '',
        imageUrl: raw.imageUrl || null
    };
    if (raw.carriedFrom) {
        sanitized.carriedFrom = {
            weekKey: cleanText(raw.carriedFrom.weekKey, 20),
            questionId: cleanText(raw.carriedFrom.questionId, 40)
        };
    }
    return sanitized;
}

/**
 * Per-question item analysis from the logged attempts.
 * attempts: [{ questionId, studentId, correct, attemptNumber, selectedAnswer }]
 */
export function computeQuestionStats(questions = [], attempts = []) {
    const byQuestion = new Map();
    for (const attempt of attempts) {
        if (!attempt?.questionId) continue;
        if (!byQuestion.has(attempt.questionId)) byQuestion.set(attempt.questionId, []);
        byQuestion.get(attempt.questionId).push(attempt);
    }

    return questions.map((question) => {
        const list = (byQuestion.get(question.id) || [])
            .slice()
            .sort((a, b) => (Number(a.attemptNumber) || 0) - (Number(b.attemptNumber) || 0));
        const first = list.find((attempt) => Number(attempt.attemptNumber) === 1) || list[0] || null;
        const wrongAnswers = {};
        list.filter((attempt) => !attempt.correct && attempt.selectedAnswer)
            .forEach((attempt) => {
                const key = cleanText(attempt.selectedAnswer, 160);
                wrongAnswers[key] = (wrongAnswers[key] || 0) + 1;
            });
        const topWrongAnswer = Object.entries(wrongAnswers).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const solved = list.some((attempt) => attempt.correct);
        return {
            questionId: question.id,
            question: question.question,
            options: question.options || [],
            correctIndex: question.correctIndex,
            correctAnswer: question.correctAnswer || (question.options || [])[question.correctIndex] || '',
            explanation: question.explanation || '',
            attemptCount: list.length,
            asked: list.length > 0,
            firstTryCorrect: Boolean(first?.correct),
            solved,
            topWrongAnswer,
            carriedFrom: question.carriedFrom || null
        };
    });
}

/** Questions the class struggled with: wrong on the first try, never solved, or skipped. */
export function selectMissedQuestions(stats = []) {
    return stats.filter((stat) => !stat.firstTryCorrect);
}

/** First-try accuracy for a set of stats (0–100), ignoring questions that were never asked. */
export function firstTryAccuracy(stats = []) {
    const asked = stats.filter((stat) => stat.asked);
    if (!asked.length) return 0;
    return Math.round((asked.filter((stat) => stat.firstTryCorrect).length / asked.length) * 100);
}

/** Turn a stat row back into a playable question for next week. */
export function statToCarriedQuestion(stat, weekKey, index = 0) {
    return sanitizeQuizQuestion({
        id: `r${index + 1}`,
        question: stat.question,
        options: stat.options,
        correctIndex: stat.correctIndex,
        correctAnswer: stat.correctAnswer,
        explanation: stat.explanation,
        carriedFrom: { weekKey, questionId: stat.questionId }
    }, `r${index + 1}`);
}

/** Shuffle the options of a question while keeping the right answer right. */
export function shuffleQuestionOptions(question, random = Math.random) {
    const options = question.options.map((text, index) => ({ text, isCorrect: index === question.correctIndex }));
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    const correctIndex = options.findIndex((option) => option.isCorrect);
    return { ...question, options: options.map((option) => option.text), correctIndex, correctAnswer: options[correctIndex].text };
}

/**
 * Combine carried-forward review questions with freshly generated ones.
 * Carried questions come first (they are the point of the review), the total never exceeds
 * `targetCount`, and every question gets a unique id.
 */
export function mergeCarriedQuestions(generated = [], carried = [], targetCount = generated.length + carried.length) {
    const limit = Math.max(0, Number(targetCount) || 0);
    const review = carried.slice(0, limit);
    const fresh = generated.slice(0, Math.max(0, limit - review.length));
    return [...review, ...fresh].map((question, index) => ({ ...question, id: `q${index + 1}` }));
}

/** How many new AI questions to request when some slots are taken by review questions. */
export function freshQuestionCount(targetCount, carriedCount) {
    return Math.max(0, (Number(targetCount) || 0) - (Number(carriedCount) || 0));
}
