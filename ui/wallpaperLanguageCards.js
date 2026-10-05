// /ui/wallpaperLanguageCards.js — Projector Mode (The Director): English-learning cards.
// Built from the class's own lesson (what we learned today, last quiz, story words, homework)
// plus league-matched scaffolds. Every card returns null when it has nothing real to show.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { gatherLearnedToday } from '../features/learnedToday.js';
import { isGrowthStarfallNote } from '../features/growthStarfallCore.mjs';
import {
    getClassroomPhrase,
    getGrammarNugget,
    getLeagueBand,
    getMinimalPair,
    getSentenceStarters,
    getThinkPairShareQuestion,
    pickOne,
    scrambleWord
} from '../features/languageScaffolds.mjs';

export const LANGUAGE_CARD_TYPES = Object.freeze([
    'lang_learned_today',
    'lang_quiz_rewind',
    'lang_word_scramble',
    'lang_story_recall',
    'lang_sentence_starter',
    'lang_think_pair_share',
    'lang_grammar_nugget',
    'lang_minimal_pair',
    'lang_classroom_english',
    'lang_growth_star',
    'lang_next_quest'
]);

/** Plan flag each card needs (cards not listed work on every plan). */
export const LANGUAGE_CARD_FEATURES = Object.freeze({
    lang_quiz_rewind: 'quizOfTheWeek',
    lang_story_recall: 'storyWeavers',
    lang_growth_star: 'scholarScroll'
});

const CLASS_ONLY = new Set(['lang_learned_today', 'lang_quiz_rewind', 'lang_word_scramble', 'lang_story_recall', 'lang_growth_star', 'lang_next_quest']);
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

async function cached(key, loader) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await loader();
    cache.set(key, { at: Date.now(), value });
    return value;
}

function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function getClass(classId) {
    return classId ? (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || null : null;
}

/** Deck entries for the Director. School view gets the league-neutral cards only. */
export function getLanguageCardDeck(classId) {
    if (!classId) {
        return ['lang_sentence_starter', 'lang_think_pair_share', 'lang_grammar_nugget', 'lang_classroom_english'];
    }
    const deck = [...LANGUAGE_CARD_TYPES];
    // What the class learned today is the most useful thing to see again: give it two chances.
    deck.push('lang_learned_today', 'lang_word_scramble');
    return deck;
}

async function getClassWords(classId) {
    const learned = await cached(`learned:${classId}`, () => gatherLearnedToday(classId));
    const words = new Set((learned?.words || []).map((word) => word.trim()).filter(Boolean));
    const story = state.get('currentStoryData')?.[classId];
    if (story?.currentWord) words.add(String(story.currentWord).trim());
    (state.get('allAdventureLogs') || [])
        .filter((log) => log.classId === classId)
        .slice(0, 5)
        .forEach((log) => {
            (log.learnedToday?.words || []).forEach((word) => words.add(String(word).trim()));
        });
    return [...words].filter((word) => /^[A-Za-z][A-Za-z' -]{2,18}$/.test(word));
}

// ─── Card builders ───────────────────────────────────────────────────────────

async function learnedTodayCard(classId) {
    const learned = await cached(`learned:${classId}`, () => gatherLearnedToday(classId));
    const items = (learned?.items || []).slice(0, 4);
    const words = (learned?.words || []).slice(0, 6);
    if (!items.length && !words.length) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-teal-100 text-teal-800">Today we are learning</div>
            <div class="text-6xl my-3">🎓</div>
            <div class="flex flex-col gap-2 text-left">
                ${items.map((item) => `<p class="wall-lang-line">✦ ${esc(item.label)}</p>`).join('')}
            </div>
            ${words.length ? `<div class="wall-lang-words">${words.map((word) => `<span>${esc(word)}</span>`).join('')}</div>` : ''}
        </div>`,
        css: 'float-card-teal'
    };
}

async function quizRewindCard(classId) {
    const review = await cached(`quizReview:${classId}`, async () => {
        const { getPreviousQuizReview } = await import('../db/actions/quizOfTheWeek.js');
        return getPreviousQuizReview(classId).catch(() => null);
    });
    // Listen and choose needs the voice of the quiz show, so the wall card skips those.
    const candidate = pickOne((review?.carryCandidates || []).filter((c) => c?.question?.kind !== 'listen'));
    const question = candidate?.question;
    if (!question) return null;
    const letters = ['A', 'B', 'C', 'D'];
    const pictures = question.kind === 'picture' && Array.isArray(question.optionImages) ? question.optionImages : null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-amber-100 text-amber-800">Quiz rewind</div>
            <p class="wall-lang-kicker">Last quiz, this one was tricky. Can we get it now?</p>
            <h3 class="font-title text-3xl text-amber-900 my-3">${esc(question.question)}</h3>
            ${question.kind === 'fix' && question.broken ? `<p class="wall-lang-kicker">Fix it: <s>${esc(question.broken)}</s></p>` : ''}
            <div class="wall-lang-options${pictures ? ' wall-lang-options--pictures' : ''}">
                ${question.options.filter(Boolean).map((option, index) => (pictures?.[index]
                    ? `<span><b>${letters[index]}</b><img src="${esc(pictures[index])}" alt="" loading="lazy" decoding="async"></span>`
                    : `<span><b>${letters[index]}</b> ${esc(option)}</span>`)).join('')}
            </div>
            <div class="wallpaper-card-answer-blur mt-4 pt-3 border-t border-amber-200">
                <div class="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Answer</div>
                <p class="text-2xl font-bold text-amber-800">${esc(question.correctAnswer)}</p>
            </div>
        </div>`,
        css: 'float-card-gold',
        timedBlurAnswer: true
    };
}

async function wordScrambleCard(classId) {
    const words = await getClassWords(classId);
    const word = pickOne(words.filter((w) => !/\s/.test(w)));
    if (!word) return null;
    const scrambled = scrambleWord(word);
    if (!scrambled || scrambled.length < 3) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-indigo-100 text-indigo-800">Word scramble</div>
            <p class="wall-lang-kicker">One of our words got mixed up!</p>
            <div class="wall-lang-scramble">${scrambled.split('').map((letter) => `<span>${esc(letter)}</span>`).join('')}</div>
            <div class="wallpaper-card-answer-blur mt-4 pt-3 border-t border-indigo-200">
                <div class="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Answer</div>
                <p class="text-3xl font-bold text-indigo-800">${esc(word.toLowerCase())}</p>
            </div>
        </div>`,
        css: 'float-card-indigo',
        timedBlurAnswer: true
    };
}

function storyRecallCard(classId) {
    const story = state.get('currentStoryData')?.[classId];
    const sentence = String(story?.currentSentence || '').trim();
    const word = String(story?.currentWord || '').trim();
    if (!sentence || !word) return null;
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!pattern.test(sentence)) return null;
    const gapped = esc(sentence).replace(new RegExp(pattern.source, 'i'), '<span class="wall-lang-gap">_____</span>');
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-cyan-100 text-cyan-800">Story recall</div>
            <div class="text-5xl my-3">🪶</div>
            <p class="font-serif text-2xl text-cyan-900 leading-relaxed">${gapped}</p>
            <div class="wallpaper-card-answer-blur mt-4 pt-3 border-t border-cyan-200">
                <div class="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-1">Missing word</div>
                <p class="text-3xl font-bold text-cyan-800">${esc(word)}</p>
            </div>
        </div>`,
        css: 'float-card-cyan',
        timedBlurAnswer: true
    };
}

function sentenceStarterCard(questLevel) {
    const starter = pickOne(getSentenceStarters(questLevel));
    if (!starter) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-pink-100 text-pink-800">Finish the sentence</div>
            <div class="text-5xl my-3">💬</div>
            <p class="font-serif text-4xl text-pink-900 mb-3">${esc(starter)}</p>
            <p class="text-pink-700 font-bold">Tell your partner how it ends. Then swap!</p>
        </div>`,
        css: 'float-card-pink'
    };
}

function thinkPairShareCard(questLevel) {
    const question = getThinkPairShareQuestion(questLevel);
    if (!question) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-purple-100 text-purple-800">Think · Pair · Share</div>
            <h3 class="font-title text-3xl text-purple-900 my-4">${esc(question)}</h3>
            <div class="wall-lang-steps">
                <span>🤔 Think</span><span>👥 Pair</span><span>🙋 Share</span>
            </div>
        </div>`,
        css: 'float-card-purple'
    };
}

function grammarNuggetCard(questLevel) {
    const nugget = getGrammarNugget(questLevel);
    if (!nugget) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-blue-100 text-blue-800">Grammar nugget</div>
            <div class="text-5xl my-3">🧩</div>
            <h3 class="font-title text-4xl text-blue-900 mb-2">${esc(nugget.title)}</h3>
            <p class="text-blue-700 text-lg font-bold mb-3">${esc(nugget.rule)}</p>
            <p class="text-blue-600 italic font-serif text-xl">“${esc(nugget.example)}”</p>
        </div>`,
        css: 'float-card-blue'
    };
}

function minimalPairCard(questLevel) {
    const pair = getMinimalPair(questLevel);
    if (!pair) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-orange-100 text-orange-800">Say it right</div>
            <div class="wall-lang-pair">
                <span>${esc(pair.a)}</span><em>vs</em><span>${esc(pair.b)}</span>
            </div>
            <p class="text-orange-700 font-bold">${esc(pair.sound)}</p>
            <p class="text-orange-600 mt-2">Say both words. Can your partner hear the difference?</p>
        </div>`,
        css: 'float-card-orange'
    };
}

function classroomEnglishCard(questLevel) {
    const phrase = getClassroomPhrase(questLevel);
    if (!phrase) return null;
    const young = ['early', 'junior'].includes(getLeagueBand(questLevel));
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-green-100 text-green-800">Classroom English</div>
            <div class="text-5xl my-3">🗣️</div>
            <p class="font-title text-4xl text-green-900 mb-3">“${esc(phrase)}”</p>
            <p class="text-green-700 font-bold">${young ? 'Can you use it today?' : 'Use it at least once this lesson!'}</p>
        </div>`,
        css: 'float-card-green'
    };
}

function growthStarCard(classId) {
    const classStudentIds = new Set((state.get('allStudents') || []).filter((s) => s.classId === classId).map((s) => s.id));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = (state.get('allAwardLogs') || []).filter((log) => {
        if (!classStudentIds.has(log.studentId) || log.reason !== 'scholar_s_bonus' || !isGrowthStarfallNote(log.note)) return false;
        const day = utils.parseFlexibleDate(log.date);
        return day && day.getTime() >= weekAgo;
    });
    const log = pickOne(recent);
    const student = log ? (state.get('allStudents') || []).find((s) => s.id === log.studentId) : null;
    if (!student) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-green-100 text-green-800">Growth Starfall</div>
            <div class="text-7xl my-3">🌱</div>
            <h3 class="font-title text-5xl text-green-900 mb-2">${esc(student.name)}</h3>
            <p class="text-green-700 text-xl font-bold">climbed higher than ever this week!</p>
            <p class="text-green-600 italic font-serif mt-2">Practice makes progress.</p>
        </div>`,
        css: 'float-card-green'
    };
}

function nextQuestCard(classId) {
    const latest = (state.get('allQuestAssignments') || [])
        .filter((assignment) => assignment.classId === classId && assignment.text)
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];
    if (!latest) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-amber-100 text-amber-800">Next quest</div>
            <div class="text-6xl mb-2">🎒</div>
            <div class="bg-white/80 p-5 rounded-xl border-l-4 border-amber-400 text-left shadow-sm">
                <p class="font-handwriting text-2xl text-amber-900">${esc(latest.text)}</p>
            </div>
        </div>`,
        css: 'float-card-gold'
    };
}

/** Build one language card, or null when there is nothing real to show. */
export async function hydrateLanguageCard(type, classId) {
    if (CLASS_ONLY.has(type) && !classId) return null;
    const questLevel = getClass(classId)?.questLevel || null;
    switch (type) {
        case 'lang_learned_today': return learnedTodayCard(classId);
        case 'lang_quiz_rewind': return quizRewindCard(classId);
        case 'lang_word_scramble': return wordScrambleCard(classId);
        case 'lang_story_recall': return storyRecallCard(classId);
        case 'lang_sentence_starter': return sentenceStarterCard(questLevel);
        case 'lang_think_pair_share': return thinkPairShareCard(questLevel);
        case 'lang_grammar_nugget': return grammarNuggetCard(questLevel);
        case 'lang_minimal_pair': return minimalPairCard(questLevel);
        case 'lang_classroom_english': return classroomEnglishCard(questLevel);
        case 'lang_growth_star': return growthStarCard(classId);
        case 'lang_next_quest': return nextQuestCard(classId);
        default: return null;
    }
}
