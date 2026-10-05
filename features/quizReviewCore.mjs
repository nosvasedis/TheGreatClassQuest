/**
 * Pure helpers for Quiz of the Week review, item analysis, and carry-forward.
 * No Firestore or DOM here; covered by tests/quiz-review-core.test.mjs.
 */
import { hasAllPictures, pictureToListenQuestion, questionKind, reorderQuestionOptions } from './quizKindsCore.mjs';

export const QUIZ_MIN_QUESTIONS = 3;
export const QUIZ_OPTION_COUNT = 4;
/** A question counts as "missed" when fewer than this share of first tries were correct. */
export const QUIZ_MISSED_FIRST_TRY_RATE = 0.6;

function cleanText(value, max = 400) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Normalise one question (from the AI step, the review editor, or carried forward).
 * Keeps its kind (Listen and choose, Picture question, Fix the sentence) and what that kind needs.
 * Returns null when the question cannot be played (empty prompt, fewer than 2 answers).
 */
export function sanitizeQuizQuestion(raw = {}, fallbackId = 'q1') {
    let kind = questionKind(raw);
    const question = cleanText(raw.question, 300);
    let options = (Array.isArray(raw.options) ? raw.options : [])
        .map((option) => cleanText(option, 160))
        .slice(0, QUIZ_OPTION_COUNT);
    if (!question || options.filter(Boolean).length < 2) return null;

    let correctIndex = Number.isInteger(raw.correctIndex) ? raw.correctIndex : Number.parseInt(raw.correctIndex, 10);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length || !options[correctIndex]) {
        const byAnswer = options.findIndex((option) => option && option === cleanText(raw.correctAnswer, 160));
        correctIndex = byAnswer >= 0 ? byAnswer : options.findIndex(Boolean);
    }

    let images = Array.isArray(raw.optionImages) ? raw.optionImages.slice(0, QUIZ_OPTION_COUNT) : null;
    let prompts = Array.isArray(raw.picturePrompts) ? raw.picturePrompts.slice(0, QUIZ_OPTION_COUNT).map((p) => cleanText(p, 110)) : null;
    // An emptied answer leaves the stage (its picture with it), so no blank gem is ever shown.
    const keep = options.map((option, index) => index).filter((index) => options[index]);
    if (keep.length !== options.length) {
        correctIndex = keep.indexOf(correctIndex);
        options = keep.map((index) => options[index]);
        if (images) images = keep.map((index) => images[index] ?? null);
        if (prompts) prompts = keep.map((index) => prompts[index] ?? '');
    }

    let sanitized = {
        id: cleanText(raw.id, 40) || fallbackId,
        type: 'mcq',
        kind,
        question,
        options,
        correctIndex,
        correctAnswer: options[correctIndex],
        explanation: cleanText(raw.explanation, 200),
        imagePrompt: '',
        imageUrl: raw.imageUrl || null
    };
    if (kind === 'picture') {
        sanitized.optionImages = images;
        sanitized.picturePrompts = prompts || options.map((option) => `a ${option}`);
        // Without all its pictures the question would show its names and give itself away.
        if (!hasAllPictures(sanitized)) sanitized = pictureToListenQuestion(sanitized);
    } else if (kind === 'listen') {
        const spoken = cleanText(raw.listen, 280);
        if (spoken) sanitized.listen = spoken;
        else sanitized.kind = 'choice';
    } else if (kind === 'fix') {
        const broken = cleanText(raw.broken, 200);
        if (broken && broken.toLowerCase() !== sanitized.correctAnswer.toLowerCase()) sanitized.broken = broken;
    }
    if (raw.carriedFrom) {
        sanitized.carriedFrom = {
            weekKey: cleanText(raw.carriedFrom.weekKey, 20),
            questionId: cleanText(raw.carriedFrom.questionId, 40)
        };
    }
    return sanitized;
}

/** What a stats row keeps of a question's kind, so a missed question comes back the same way. */
function kindFields(question = {}) {
    const kind = questionKind(question);
    const fields = { kind };
    if (kind === 'listen' && question.listen) fields.listen = question.listen;
    if (kind === 'picture') {
        if (Array.isArray(question.optionImages)) fields.optionImages = question.optionImages;
        if (Array.isArray(question.picturePrompts)) fields.picturePrompts = question.picturePrompts;
    }
    if (kind === 'fix' && question.broken) fields.broken = question.broken;
    return fields;
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
            ...kindFields(question),
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
        ...kindFields(stat),
        carriedFrom: { weekKey, questionId: stat.questionId }
    }, `r${index + 1}`);
}

/** Shuffle the options of a question while keeping the right answer right (pictures move with their answers). */
export function shuffleQuestionOptions(question, random = Math.random) {
    const order = question.options.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return reorderQuestionOptions(question, order);
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
