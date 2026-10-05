/**
 * Quiz of the Week question kinds: classic choice, Listen and choose, Picture question
 * and Fix the sentence. Every kind is still four answers played with A to D on the stage.
 * Pure: no DOM, no Firestore. Covered by tests/quiz-kinds-core.test.mjs.
 *
 * A stored question keeps `type: 'mcq'` (older quizzes and code read that) and adds `kind`.
 * A question without `kind` is a classic choice question.
 *   listen  → `listen`: the words the app speaks aloud (never shown until the question is over)
 *   picture → `optionImages`: four picture URLs in option order; `picturePrompts`: what each shows
 *   fix     → `broken` (optional): the sentence with the mistake, shown above the four versions
 */

export const QUIZ_KINDS = ['choice', 'listen', 'picture', 'fix'];

export const QUIZ_KIND_INFO = {
    choice: { label: 'Choose the answer', short: 'Choose', icon: 'fa-list-ul', emoji: '🔤' },
    listen: { label: 'Listen and choose', short: 'Listen', icon: 'fa-ear-listen', emoji: '🎧' },
    picture: { label: 'Picture question', short: 'Picture', icon: 'fa-image', emoji: '🖼️' },
    fix: { label: 'Fix the sentence', short: 'Fix it', icon: 'fa-screwdriver-wrench', emoji: '🔧' }
};

/** Four pictures each: the image service allows about 20 a minute, so a quiz keeps to four picture questions. */
export const QUIZ_MAX_PICTURE_QUESTIONS = 4;
/** Questions per AI request: the text service stops at about 1,200 tokens, so long sets are written in parts. */
export const QUIZ_BATCH_SIZE = 5;

export const QUIZ_LISTEN_DEFAULT_QUESTION = 'Listen. Which answer matches what you hear?';
export const QUIZ_LISTEN_WORD_QUESTION = 'Listen. Which word do you hear?';
export const QUIZ_FIX_DEFAULT_QUESTION = 'Which sentence is correct?';

/** Age bands follow the league's ageCategory (Pre-Junior is early; Junior A and B junior; A and B mid; C and D senior). */
export const QUIZ_AGE_BANDS = ['early', 'junior', 'mid', 'senior'];

/** Share of each kind by age band. Younger leagues hear and see more; older ones fix more sentences. */
export const QUIZ_KIND_WEIGHTS = {
    early: { choice: 0.2, listen: 0.4, picture: 0.4, fix: 0 },
    junior: { choice: 0.25, listen: 0.3, picture: 0.3, fix: 0.15 },
    mid: { choice: 0.35, listen: 0.25, picture: 0.15, fix: 0.25 },
    senior: { choice: 0.35, listen: 0.25, picture: 0.1, fix: 0.3 }
};

const BAND_LIMITS = {
    early: { question: 8, answer: 3, sentence: 6 },
    junior: { question: 12, answer: 4, sentence: 8 },
    mid: { question: 16, answer: 6, sentence: 12 },
    senior: { question: 20, answer: 8, sentence: 14 }
};

const KIND_ALIASES = {
    choice: 'choice', mcq: 'choice', 'multiple choice': 'choice', 'multiple-choice': 'choice', classic: 'choice',
    listen: 'listen', listening: 'listen', 'listen and choose': 'listen', audio: 'listen',
    picture: 'picture', image: 'picture', pictures: 'picture', 'picture question': 'picture',
    fix: 'fix', 'fix the sentence': 'fix', 'fix-the-sentence': 'fix', fix_sentence: 'fix', 'fix sentence': 'fix'
};

export function quizAgeBand(ageCategory) {
    return QUIZ_AGE_BANDS.includes(ageCategory) ? ageCategory : 'mid';
}

/** The kind a stored question plays as; anything unknown is a classic choice question. */
export function questionKind(question) {
    const kind = question?.kind;
    return QUIZ_KIND_INFO[kind] ? kind : 'choice';
}

export function normalizeKindName(value) {
    return KIND_ALIASES[String(value ?? '').trim().toLowerCase()] || '';
}

function clean(value, max = 200) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const comparable = (value) => clean(value, 400).toLowerCase().replace(/[“”"'’‘]/g, '').replace(/\s*([.!?,;:])\s*$/, '').trim();

// ─── How many of each kind ──────────────────────────────────────────────────

function kindWeights(band, type) {
    const base = { ...QUIZ_KIND_WEIGHTS[quizAgeBand(band)] };
    if (type === 'grammar') {
        base.picture *= 0.5;
        base.fix *= 1.4;
    } else if (type === 'vocabulary') {
        base.fix *= 0.5;
        base.picture *= 1.25;
    }
    const total = QUIZ_KINDS.reduce((sum, kind) => sum + base[kind], 0) || 1;
    return Object.fromEntries(QUIZ_KINDS.map((kind) => [kind, base[kind] / total]));
}

/**
 * How many questions of each kind a fresh quiz asks for.
 * Every kind with a real share gets at least one when there is room, pictures stay within
 * QUIZ_MAX_PICTURE_QUESTIONS, and Pre-Junior never gets Fix the sentence.
 */
export function quizKindMix({ count = 7, band = 'mid', type = 'mix' } = {}) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const mix = { choice: 0, listen: 0, picture: 0, fix: 0 };
    if (!total) return mix;
    const weights = kindWeights(band, type);
    const exact = QUIZ_KINDS.map((kind) => ({ kind, value: weights[kind] * total }));
    exact.forEach(({ kind, value }) => { mix[kind] = Math.floor(value); });
    let left = total - QUIZ_KINDS.reduce((sum, kind) => sum + mix[kind], 0);
    [...exact]
        .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)) || QUIZ_KINDS.indexOf(a.kind) - QUIZ_KINDS.indexOf(b.kind))
        .forEach(({ kind }) => {
            if (left > 0 && weights[kind] > 0) { mix[kind] += 1; left -= 1; }
        });
    if (left > 0) mix.choice += left;

    // Room for every format that belongs in this band: take from the biggest pile.
    const wanted = QUIZ_KINDS.filter((kind) => weights[kind] >= 0.1);
    if (total >= wanted.length) {
        for (const kind of wanted) {
            if (mix[kind] > 0) continue;
            const donor = QUIZ_KINDS.filter((k) => k !== kind && mix[k] > 1).sort((a, b) => mix[b] - mix[a])[0];
            if (!donor) break;
            mix[donor] -= 1;
            mix[kind] += 1;
        }
    }

    if (mix.picture > QUIZ_MAX_PICTURE_QUESTIONS) {
        const extra = mix.picture - QUIZ_MAX_PICTURE_QUESTIONS;
        mix.picture = QUIZ_MAX_PICTURE_QUESTIONS;
        // The youngest cannot read long answers yet, so their extra questions are heard instead.
        mix[quizAgeBand(band) === 'early' ? 'listen' : 'choice'] += extra;
    }
    return mix;
}

/**
 * Split a mix into requests of at most `size` questions, dealing the kinds out so every
 * request carries a little of each (the AI writes better when formats sit side by side).
 */
export function planQuizBatches(mix = {}, size = QUIZ_BATCH_SIZE) {
    const slots = ['picture', 'listen', 'fix', 'choice'].flatMap((kind) => Array(Math.max(0, Number(mix[kind]) || 0)).fill(kind));
    if (!slots.length) return [];
    const batchCount = Math.ceil(slots.length / Math.max(1, size));
    const batches = Array.from({ length: batchCount }, () => ({ choice: 0, listen: 0, picture: 0, fix: 0 }));
    slots.forEach((kind, i) => { batches[i % batchCount][kind] += 1; });
    return batches;
}

export function mixTotal(mix = {}) {
    return QUIZ_KINDS.reduce((sum, kind) => sum + (Number(mix[kind]) || 0), 0);
}

/** "3 Listen · 2 Picture · 1 Fix it · 2 Choose" */
export function describeKindMix(mix = {}, { emoji = false } = {}) {
    return ['listen', 'picture', 'fix', 'choice']
        .filter((kind) => (Number(mix[kind]) || 0) > 0)
        .map((kind) => `${emoji ? `${QUIZ_KIND_INFO[kind].emoji} ` : ''}${mix[kind]} ${QUIZ_KIND_INFO[kind].short}`)
        .join(' · ');
}

export function countKinds(questions = []) {
    const mix = { choice: 0, listen: 0, picture: 0, fix: 0 };
    (Array.isArray(questions) ? questions : []).forEach((question) => { mix[questionKind(question)] += 1; });
    return mix;
}

// ─── Reading what the AI wrote ──────────────────────────────────────────────

function stripLetterPrefixes(options) {
    const prefixed = options.length && options.every((option) => /^[A-Da-d][).:]\s+\S/.test(option));
    return prefixed ? options.map((option) => option.replace(/^[A-Da-d][).:]\s+/, '')) : options;
}

function wordCount(text) {
    return clean(text, 400).split(' ').filter(Boolean).length;
}

/**
 * Turn one AI question into a stored question, or null when it cannot be played fairly:
 * four different answers, one of them right, and what each kind needs (spoken words,
 * four pictures to draw, four versions of one sentence).
 */
export function normalizeAiQuestion(raw = {}, { id = 'q1', fallbackKind = 'choice' } = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = normalizeKindName(raw.format ?? raw.kind ?? raw.style) || normalizeKindName(raw.type) || fallbackKind;

    let options = stripLetterPrefixes((Array.isArray(raw.options) ? raw.options : []).map((option) => clean(option, kind === 'fix' ? 160 : 120)));
    let pictures = (Array.isArray(raw.pictures) ? raw.pictures : Array.isArray(raw.picturePrompts) ? raw.picturePrompts : []).map((p) => clean(p, 110));
    // Keep only filled answers, with their pictures beside them.
    const kept = options.map((text, index) => ({ text, picture: pictures[index] || '' })).filter((option) => option.text);
    options = kept.map((option) => option.text);
    pictures = kept.map((option) => option.picture);

    const answerText = clean(raw.answer ?? raw.correctAnswer, 160);
    let correctIndex = answerText ? options.findIndex((option) => comparable(option) === comparable(answerText)) : -1;
    if (correctIndex < 0) {
        const index = Number.isInteger(raw.correctIndex) ? raw.correctIndex : Number.parseInt(raw.correctIndex, 10);
        if (Number.isInteger(index) && index >= 0 && index < options.length) correctIndex = index;
    }
    if (correctIndex < 0) return null;

    // Exactly four different answers, the right one among them.
    if (options.length > 4) {
        const others = options.map((_, i) => i).filter((i) => i !== correctIndex).slice(0, 3);
        const order = [correctIndex, ...others];
        options = order.map((i) => options[i]);
        pictures = order.map((i) => pictures[i] || '');
        correctIndex = 0;
    }
    if (options.length !== 4) return null;
    if (new Set(options.map(comparable)).size !== 4) return null;

    const question = {
        id,
        type: 'mcq',
        kind,
        question: clean(raw.question, 220),
        options,
        correctIndex,
        correctAnswer: options[correctIndex],
        explanation: clean(raw.explanation, 140),
        imagePrompt: '',
        imageUrl: null
    };

    if (kind === 'listen') {
        const spoken = clean(raw.listen ?? raw.spoken ?? raw.audio ?? raw.say, 280);
        if (!spoken) return null;
        if (!question.question) question.question = QUIZ_LISTEN_DEFAULT_QUESTION;
        // What is spoken stays off the screen: a question that prints it is not a listening question.
        if (spoken.length > 3 && comparable(question.question).includes(comparable(spoken))) return null;
        question.listen = spoken;
    } else if (kind === 'picture') {
        if (!question.question) return null;
        question.picturePrompts = options.map((option, i) => pictures[i] || `a ${option}`);
        question.optionImages = null;
    } else if (kind === 'fix') {
        if (options.some((option) => wordCount(option) < 2)) return null;
        if (!question.question) question.question = QUIZ_FIX_DEFAULT_QUESTION;
        const broken = clean(raw.broken ?? raw.mistake ?? raw.sentence, 200);
        if (broken && comparable(broken) !== comparable(question.correctAnswer)) question.broken = broken;
    } else if (!question.question) {
        return null;
    }
    return question;
}

/** A stable key so the same question asked twice (in two AI parts) is kept once. */
export function questionKey(question) {
    return `${questionKind(question)}|${comparable(question.listen || question.question)}|${comparable(question.correctAnswer)}`;
}

// ─── Answer order ───────────────────────────────────────────────────────────

/** Reorder a question's answers (and the pictures beside them). `order` lists old indexes in their new places. */
export function reorderQuestionOptions(question, order) {
    const pick = (list) => (Array.isArray(list) ? order.map((i) => list[i] ?? null) : list);
    const correctIndex = order.indexOf(question.correctIndex);
    const next = { ...question, options: order.map((i) => question.options[i]), correctIndex };
    next.correctAnswer = next.options[correctIndex];
    if (Array.isArray(question.optionImages)) next.optionImages = pick(question.optionImages);
    if (Array.isArray(question.picturePrompts)) next.picturePrompts = pick(question.picturePrompts);
    return next;
}

function shuffled(list, random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Shuffle every question's answers so the right ones are spread fairly over A, B, C and D
 * (the AI tends to put them first). Wrong answers land in random places.
 */
export function balanceAnswerPositions(questions = [], random = Math.random) {
    const slots = shuffled(questions.map((_, i) => i % 4), random);
    return questions.map((question, i) => {
        const count = question.options?.length || 0;
        if (count < 2) return question;
        const target = Math.min(slots[i], count - 1);
        const wrong = shuffled(question.options.map((_, j) => j).filter((j) => j !== question.correctIndex), random);
        const order = [];
        for (let pos = 0; pos < count; pos++) order.push(pos === target ? question.correctIndex : wrong.shift());
        return reorderQuestionOptions(question, order);
    });
}

// ─── Pictures ───────────────────────────────────────────────────────────────

export const QUIZ_PICTURE_NEGATIVE_PROMPT = 'text, letters, words, numbers, writing, label, caption, watermark, signature, logo, frame, border, collage, grid, multiple panels, split image, blurry, low quality, scary, violent';

/** One small picture for one answer. Every picture of a question shares the style, so none stands out. */
export function quizPicturePrompt(subject, visualStyle = '') {
    const what = clean(subject, 110) || 'a friendly object';
    return `${what}. A single clear subject, whole and centred, filling most of the square, on a plain soft pastel background with nothing else around it. ${clean(visualStyle, 200) || 'bright friendly illustration for children, no text'}`;
}

export function hasAllPictures(question) {
    return Array.isArray(question?.optionImages)
        && question.optionImages.length === (question.options?.length || 4)
        && question.optionImages.every((url) => typeof url === 'string' && /^(https:|data:image\/)/.test(url));
}

/**
 * A picture question whose pictures could not be drawn becomes Listen and choose:
 * the app says the right word and the class picks it from the four written names.
 */
export function pictureToListenQuestion(question) {
    const { optionImages: _images, picturePrompts: _prompts, ...rest } = question;
    return {
        ...rest,
        kind: 'listen',
        question: QUIZ_LISTEN_WORD_QUESTION,
        listen: question.correctAnswer
    };
}

// ─── The prompt ─────────────────────────────────────────────────────────────

export function buildQuizSystemPrompt() {
    return `You write questions for "Quiz of the Week", a live quiz show in an English lesson for learners of English.
The class plays together on a projector: for each question one child picks A, B, C or D in front of everyone, so every question must be fair, clear and have exactly one right answer.
Reply with ONLY one JSON object of the form {"questions":[...]}: no markdown, no code fences, no comments, no text before or after it.`;
}

const LISTEN_GUIDE = {
    early: 'The app says ONE word or a tiny sentence (at most 6 words) slowly. "question" is "Listen. Which word do you hear?" or "Listen and choose." Answers are single words the class knows, with clearly different sounds.',
    junior: 'The app says one short sentence or a two-line riddle (at most 14 words). "question" asks about one detail the class can only know by listening (who, what, where, what colour, how many). Answers are one to four words.',
    mid: 'The app says a short message, mini-story or two-line dialogue (at most 28 words). "question" asks about a detail or the main idea; all four answers must sound possible to someone who did not listen.',
    senior: 'The app says a short message, announcement or dialogue (at most 36 words). "question" asks about a detail, a reason or what someone means; all four answers must sound possible to someone who did not listen.'
};

const FORMAT_GUIDE = {
    choice: () => `"choice": a classic question with four written answers. Vary the style: fill the gap (write the gap as ___), meaning, opposite, odd one out, the word that fits a tiny situation, the right form of a word.`,
    listen: (band) => `"listen": the class HEARS the text in "listen" (the app reads it aloud) and does not see it. ${LISTEN_GUIDE[band]} "question" must never repeat the spoken text or give the answer away.`,
    picture: () => `"picture": "question" names one thing, for example "Which one is a ladder?" or "Who is swimming?". The app draws one small picture for each answer from "pictures": four short descriptions in the same order as "options". Every picture shows one concrete thing a child knows at a glance (an object, animal, food, place, or a person doing one clear action). Never pictures of text, numbers above five, positions (in, on, under), feelings that need a face to read, or abstract ideas. The four pictures must look clearly different from each other. "options" holds the four short names; the class sees them only after the answer.`,
    fix: () => `"fix": "broken" is one sentence with one typical learner mistake. "options" are four versions of that sentence: exactly one is completely correct, and each of the other three still has one typical mistake (verb form, missing or extra word, word order, wrong small word). All four keep the same words and meaning. "question" is "Which sentence is correct?".`
};

const FORMAT_EXAMPLES = {
    choice: '{"format":"choice","question":"She ___ to school every day.","answer":"goes","options":["goes","go","going","gone"],"explanation":"she + verb with -s"}',
    listen: '{"format":"listen","listen":"Tom has got a big brown dog.","question":"Listen. What has Tom got?","answer":"a dog","options":["a dog","a cat","a bike","a ball"],"explanation":"Tom has got a big brown dog."}',
    picture: '{"format":"picture","question":"Which one is a ladder?","answer":"ladder","options":["ladder","umbrella","bucket","kite"],"pictures":["a wooden ladder","an open red umbrella","a blue bucket","a kite with a long tail"],"explanation":"We climb up a ladder."}',
    fix: '{"format":"fix","broken":"He don\'t like milk.","question":"Which sentence is correct?","answer":"He doesn\'t like milk.","options":["He doesn\'t like milk.","He don\'t likes milk.","He not like milk.","He doesn\'t likes milk."],"explanation":"he + doesn\'t + like"}'
};

const FORMAT_LABEL = { choice: 'choice', listen: 'listen', picture: 'picture', fix: 'fix' };

/**
 * The user prompt for one AI request.
 * @param {{ subject:string, focusBlock:string, groundingRules:string, ageDesc:string, band:string, mix:object, avoid?:string[] }} input
 */
export function buildKindsPromptBody({ subject = 'English', focusBlock = '', groundingRules = '', ageDesc = 'primary learners', band = 'mid', mix = { choice: 1 }, avoid = [] } = {}) {
    const ageBand = quizAgeBand(band);
    const limits = BAND_LIMITS[ageBand];
    const total = mixTotal(mix);
    const order = ['choice', 'listen', 'picture', 'fix'].filter((kind) => (Number(mix[kind]) || 0) > 0);
    const counts = order.map((kind) => `- ${mix[kind]} × "${FORMAT_LABEL[kind]}"`).join('\n');
    const guide = order.map((kind) => `- ${FORMAT_GUIDE[kind](ageBand)}`).join('\n');
    const pictureWords = mix.picture > 0
        ? '\n- A "picture" question tests a word from the list that can be drawn. If no word in the list can be drawn, write a "listen" question in its place.'
        : '';
    const avoidLine = avoid.length
        ? `\n- Already in this quiz, so do not ask again: ${avoid.slice(0, 30).map((item) => clean(item, 60)).join('; ')}.`
        : '';
    const examples = order.map((kind) => FORMAT_EXAMPLES[kind]).join(',\n');

    return `Write ${total} quiz questions for ${ageDesc}.
Subject: ${subject}.
${focusBlock}

Formats in this set (write exactly this many of each):
${counts}

How each format works:
${guide}

Rules for every question:
- Exactly one answer is right. The three wrong answers are clearly wrong to a teacher, yet tempting to a learner (typical mistakes, near meanings, similar sounds).
- Put the right answer FIRST in "options" and copy it exactly into "answer". The app shuffles the order.
- Four different answers of the same sort and similar length. No "all of the above", "none of the above" or joke answers.
- Never give the answer away in the question.
- Keep it short: a question has at most ${limits.question} words, an answer at most ${limits.answer} words${order.includes('fix') ? `, a "fix" sentence at most ${limits.sentence} words` : ''}.
- "explanation": at most 10 words a child understands, saying why the answer is right.
- Language suits ${ageDesc}.
- No two questions test the same thing, and the right answers are different words.
${groundingRules}${pictureWords}${avoidLine}
- The examples below only show the JSON shape. Never copy their content.

JSON shape:
{"questions":[
${examples}
]}`;
}
