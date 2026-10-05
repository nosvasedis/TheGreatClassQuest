/**
 * Quiz of the Week: writing fresh questions with the AI.
 * The text service stops at about 1,200 tokens, so a quiz is asked for in parts, each part
 * carrying a little of every kind; only questions that play fairly are kept, and one extra
 * request tops up whatever is missing. Pure apart from the injected `askAi`.
 * Covered by tests/quiz-writer-core.test.mjs.
 */
import { buildQuizGenerationUserPrompt } from './quizCurriculumCore.mjs';
import {
    QUIZ_MAX_PICTURE_QUESTIONS,
    balanceAnswerPositions,
    buildQuizSystemPrompt,
    countKinds,
    mixTotal,
    normalizeAiQuestion,
    pictureToListenQuestion,
    planQuizBatches,
    questionKey,
    questionKind,
    quizKindMix
} from './quizKindsCore.mjs';

const looksLikeQuestions = (list) => list.length > 0 && list.every((item) => item && typeof item === 'object' && (item.question || item.listen || item.format || item.type || item.broken));

/** The first array in a parsed reply whose items look like questions. */
function deepFindQuestions(obj, depth = 0) {
    if (depth > 4 || obj === null || typeof obj !== 'object') return [];
    if (Array.isArray(obj)) {
        if (looksLikeQuestions(obj)) return obj;
        for (const item of obj) {
            const found = deepFindQuestions(item, depth + 1);
            if (found.length) return found;
        }
        return [];
    }
    for (const value of Object.values(obj)) {
        if (Array.isArray(value) && looksLikeQuestions(value)) return value;
        if (value && typeof value === 'object') {
            const found = deepFindQuestions(value, depth + 1);
            if (found.length) return found;
        }
    }
    return [];
}

/**
 * Every complete {…} object in the text that looks like a question, at any depth,
 * so a reply cut off mid-way still gives back the questions it finished.
 */
export function extractPartialQuestions(rawText = '') {
    const text = String(rawText);
    const found = [];
    const starts = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') starts.push(i);
        else if (ch === '}' && starts.length) {
            const start = starts.pop();
            try {
                const obj = JSON.parse(text.slice(start, i + 1));
                if (obj && Array.isArray(obj.options) && (obj.question || obj.listen || obj.broken || obj.answer)) found.push(obj);
            } catch (_) { /* incomplete or invalid: skip */ }
        }
    }
    return found;
}

/** Every question object the AI managed to write, from clean JSON, fenced JSON, a wrapped reply or a cut-off one. */
export function readAiQuestions(aiText = '') {
    const text = String(aiText || '').replace(/```(?:json)?/gi, '').trim();
    try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : deepFindQuestions(parsed);
        if (list.length) return list;
    } catch (_) { /* recovered below */ }
    return extractPartialQuestions(text);
}

const isRateLimit = (error) => error?.isRateLimited || error?.status === 429 || /circuit|429/i.test(String(error?.message || ''));

/**
 * Write `freshCount` new questions.
 * @param {{ curriculum:object, freshCount:number, band:string, ageDesc:string, avoid?:string[],
 *           askAi:(systemPrompt:string, userPrompt:string) => Promise<string>, onProgress?:Function, random?:Function }} input
 * @returns {Promise<{ questions:object[], mix:object }>} questions with their right answers spread over A to D.
 */
export async function writeQuizQuestions({ curriculum = {}, freshCount = 7, band = 'mid', ageDesc = 'primary learners', avoid = [], askAi, onProgress, random = Math.random } = {}) {
    const mix = quizKindMix({ count: freshCount, band, type: curriculum?.type });
    const batches = planQuizBatches(mix);
    const systemPrompt = buildQuizSystemPrompt();
    const kept = [];
    const seen = new Set();
    const askedFor = [...avoid];
    const failures = [];

    const runPart = async (partMix) => {
        const userPrompt = buildQuizGenerationUserPrompt({ curriculum, ageDesc, band, mix: partMix, avoid: askedFor });
        const aiText = await askAi(systemPrompt, userPrompt);
        const wanted = mixTotal(partMix);
        // When the AI leaves out "format", read the questions in the order they were asked for.
        const askedKinds = ['picture', 'listen', 'fix', 'choice'].flatMap((kind) => Array(partMix[kind] || 0).fill(kind));
        let added = 0;
        readAiQuestions(aiText).forEach((raw, index) => {
            if (added >= wanted) return;
            const question = normalizeAiQuestion(raw, { id: `n${kept.length + 1}`, fallbackKind: askedKinds[index] || 'choice' });
            if (!question) return;
            const key = questionKey(question);
            if (seen.has(key)) return;
            seen.add(key);
            kept.push(question);
            askedFor.push(question.correctAnswer);
            added += 1;
        });
        if (!added) console.warn('Quiz: an AI part gave no usable questions. Raw reply:', aiText);
    };

    for (let i = 0; i < batches.length; i++) {
        onProgress?.({ stage: 'writing', done: i, total: batches.length });
        try {
            await runPart(batches[i]);
        } catch (error) {
            failures.push(error);
            console.warn('Quiz: an AI part failed:', error);
            // A rate limit or an open circuit fails every later part the same way.
            if (isRateLimit(error)) break;
        }
    }

    // One more request for what is still missing, kind by kind.
    let short = freshCount - kept.length;
    const lastFailure = failures[failures.length - 1];
    if (short > 0 && !(lastFailure && isRateLimit(lastFailure))) {
        const have = countKinds(kept);
        const topUp = { choice: 0, listen: 0, picture: 0, fix: 0 };
        ['listen', 'picture', 'fix', 'choice'].forEach((kind) => {
            const n = Math.min(Math.max(0, mix[kind] - have[kind]), short);
            topUp[kind] = n;
            short -= n;
        });
        // Any gap left (the AI wrote more of one kind than asked) is filled with classic questions.
        topUp.choice += Math.max(0, short);
        onProgress?.({ stage: 'writing', done: batches.length, total: batches.length + 1 });
        try {
            await runPart(topUp);
        } catch (error) {
            failures.push(error);
            console.warn('Quiz: the top-up AI request failed:', error);
        }
    }
    if (!kept.length && failures.length) throw failures[0];

    // Never more picture questions than the image service can draw in a minute.
    let pictures = 0;
    const capped = kept.slice(0, freshCount).map((question) => {
        if (questionKind(question) !== 'picture') return question;
        pictures += 1;
        return pictures > QUIZ_MAX_PICTURE_QUESTIONS ? pictureToListenQuestion(question) : question;
    });
    return { questions: balanceAnswerPositions(capped, random), mix };
}
