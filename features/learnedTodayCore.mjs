/**
 * "What we learned today": gathered automatically from what the class actually did,
 * so the teacher never has to type it. Pure logic; the Adventure Log collects the inputs
 * from state and Firestore and passes plain data in. Covered by tests/learned-today-core.test.mjs.
 */

import { splitKeywords, looksLikeVocabulary } from '../utils/vocabularyText.mjs';

export const LEARNED_TODAY_SOURCES = Object.freeze({
    quiz: { icon: '❓', label: 'Quiz of the Week' },
    story: { icon: '🪶', label: 'Story Weavers' },
    quest: { icon: '🗺️', label: 'Special Quest' },
    trial: { icon: '📜', label: "Scholar's Scroll" },
    homework: { icon: '🎒', label: 'Quest Assignment' },
    teacher: { icon: '✏️', label: 'Teacher' }
});

const MAX_ITEMS = 8;
const MAX_WORDS = 8;

function clean(value, max = 140) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * @param {object} input
 * @param {{ curriculum?: { type?: string, categories?: string[], keywords?: string }, playedToday?: boolean }} [input.quiz]
 * @param {{ word?: string, sentence?: string, updatedToday?: boolean }} [input.story]
 * @param {Array<{ label?: string, prompt?: string }>} [input.quests]
 * @param {Array<{ type?: string, title?: string }>} [input.trials]
 * @param {{ text?: string, createdToday?: boolean, testTitle?: string, testToday?: boolean }} [input.assignment]
 */
export function collectLearnedToday({ quiz = null, story = null, quests = [], trials = [], assignment = null } = {}) {
    const items = [];
    const words = [];
    const seen = new Set();
    const seenWords = new Set();

    const addItem = (source, label, detail = '') => {
        const text = clean(label);
        if (!text) return;
        const key = `${text.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ source, label: text, ...(detail ? { detail: clean(detail, 200) } : {}) });
    };
    const addWord = (word) => {
        const text = clean(word, 40);
        if (!text || !looksLikeVocabulary(text)) return;
        const key = text.toLowerCase();
        if (seenWords.has(key)) return;
        seenWords.add(key);
        words.push(text);
    };

    if (quiz?.playedToday && quiz.curriculum) {
        const { categories = [], keywords = '', type = '' } = quiz.curriculum;
        categories.forEach((category) => addItem('quiz', category, type ? `${type} review` : ''));
        splitKeywords(keywords).forEach((keyword) => {
            if (looksLikeVocabulary(keyword)) addWord(keyword);
            else addItem('quiz', keyword);
        });
    }

    if (story?.updatedToday && (story.word || story.sentence)) {
        if (story.word) {
            addWord(story.word);
            addItem('story', `Word of the Day: ${clean(story.word, 40)}`, story.sentence || '');
        } else {
            addItem('story', 'Wrote the next chapter of our story', story.sentence || '');
        }
    }

    quests.forEach((quest) => {
        const label = clean(quest?.label, 60);
        if (!label) return;
        const prompt = clean(quest?.prompt, 140);
        addItem('quest', prompt ? `${label}: ${prompt}` : label);
        if (prompt && /vocabulary|vault/i.test(label)) splitKeywords(prompt).forEach(addWord);
    });

    trials.forEach((trial) => {
        const title = clean(trial?.title, 80);
        const kind = trial?.type === 'dictation' ? 'Dictation' : 'Test';
        addItem('trial', title ? `${kind}: ${title}` : kind);
    });

    if (assignment?.testToday && assignment.testTitle) {
        addItem('trial', `Test: ${assignment.testTitle}`);
    }
    if (assignment?.createdToday && assignment.text) {
        addItem('homework', `Next quest: ${clean(assignment.text, 120)}`);
    }

    const finalItems = items.slice(0, MAX_ITEMS);
    const finalWords = words.slice(0, MAX_WORDS);
    return { items: finalItems, words: finalWords, summary: buildLearnedTodaySummary({ items: finalItems, words: finalWords }) };
}

/** One compact line for the AI Chronicler prompt and for plain-text displays. */
export function buildLearnedTodaySummary({ items = [], words = [] } = {}) {
    const parts = items.map((item) => item.label);
    if (words.length) parts.push(`Target words: ${words.join(', ')}`);
    return parts.join('; ').slice(0, 600);
}

export function hasLearnedToday(learned) {
    return Boolean(learned && ((learned.items || []).length || (learned.words || []).length));
}

/**
 * Apply the teacher's optional edits: remove items/words they unticked and add their own line.
 * Everything stays optional — an empty edit keeps the automatic result.
 */
export function applyLearnedTodayEdits(learned, { removeItems = [], removeWords = [], extraLine = '' } = {}) {
    const removedItems = new Set(removeItems.map((label) => clean(label).toLowerCase()));
    const removedWords = new Set(removeWords.map((word) => clean(word).toLowerCase()));
    const items = (learned?.items || []).filter((item) => !removedItems.has(clean(item.label).toLowerCase()));
    const words = (learned?.words || []).filter((word) => !removedWords.has(clean(word).toLowerCase()));
    const extra = clean(extraLine, 160);
    if (extra) items.push({ source: 'teacher', label: extra });
    return { items, words, summary: buildLearnedTodaySummary({ items, words }) };
}
