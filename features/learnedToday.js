// /features/learnedToday.js — gathers "What we learned today" for the Adventure Log automatically.
// Reads what the class actually did today (Quiz of the Week, Story Weavers, Special Quests,
// Scholar's Scroll, Quest Assignment). The pure shaping lives in learnedTodayCore.mjs.
import { db, doc, getDoc } from '../firebase.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { canUseFeature } from '../utils/subscription.js';
import { applyLearnedTodayEdits, collectLearnedToday, LEARNED_TODAY_SOURCES } from './learnedTodayCore.mjs';
import { isSpecialQuestType, normalizeQuestType, QUEST_TYPE_LABELS } from './specialQuestEngine.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

export { applyLearnedTodayEdits, LEARNED_TODAY_SOURCES };

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameDay(date, reference = new Date()) {
    return Boolean(date)
        && date.getFullYear() === reference.getFullYear()
        && date.getMonth() === reference.getMonth()
        && date.getDate() === reference.getDate();
}

async function readQuizInput(classId, today) {
    if (!canUseFeature('quizOfTheWeek')) return null;
    try {
        const { getQuizForClass } = await import('../db/actions/quizOfTheWeek.js');
        const quiz = await getQuizForClass(classId);
        if (!quiz?.curriculum) return null;
        const playedToday = quiz.status === 'completed' && isSameDay(toDate(quiz.completedAt), today);
        return { curriculum: quiz.curriculum, playedToday };
    } catch (error) {
        console.warn('What we learned: quiz lookup skipped.', error);
        return null;
    }
}

async function readStoryInput(classId, today) {
    if (!canUseFeature('storyWeavers')) return null;
    let story = state.get('currentStoryData')?.[classId] || null;
    if (!story) {
        // Story data is only live while Story Weavers is open; read it once otherwise.
        try {
            const snap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/story_data`, classId));
            story = snap.exists() ? snap.data() : null;
        } catch (error) {
            console.warn('What we learned: story lookup skipped.', error);
        }
    }
    if (!story) return null;
    return {
        word: story.currentWord || '',
        sentence: story.currentSentence || '',
        updatedToday: isSameDay(toDate(story.updatedAt), today)
    };
}

function readQuestInputs(classId, todayStr) {
    return (state.get('allQuestEvents') || [])
        .filter((event) => event.classId === classId
            && utils.datesMatch(event.dateKey || event.date, todayStr)
            && isSpecialQuestType(normalizeQuestType(event.type)))
        .map((event) => ({
            label: QUEST_TYPE_LABELS[normalizeQuestType(event.type)] || '',
            prompt: event.presentation?.prompt || event.prompt || ''
        }));
}

function readTrialInputs(classId, todayStr) {
    const seen = new Set();
    return (state.get('allWrittenScores') || [])
        .filter((score) => score.classId === classId && utils.datesMatch(score.date, todayStr))
        .map((score) => ({ type: score.type, title: score.title || '' }))
        .filter((trial) => {
            const key = `${trial.type}|${trial.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function readAssignmentInput(classId, todayStr) {
    const latest = (state.get('allQuestAssignments') || [])
        .filter((assignment) => assignment.classId === classId)
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))[0];
    if (!latest) return null;
    const created = toDate(latest.createdAt);
    return {
        text: latest.text || '',
        createdToday: Boolean(created && utils.datesMatch(utils.getDDMMYYYY(created), todayStr)),
        testTitle: latest.testData?.title || '',
        testToday: Boolean(latest.testData?.date && utils.datesMatch(latest.testData.date, todayStr))
    };
}

/**
 * Collect "What we learned today" for a class. Never throws: a missing source is simply skipped.
 * @returns {Promise<{ items: Array<{source: string, label: string, detail?: string}>, words: string[], summary: string }>}
 */
export async function gatherLearnedToday(classId) {
    const empty = { items: [], words: [], summary: '' };
    if (!classId) return empty;
    const today = new Date();
    const todayStr = utils.getTodayDateString();
    try {
        const [quiz, story] = await Promise.all([readQuizInput(classId, today), readStoryInput(classId, today)]);
        return collectLearnedToday({
            quiz,
            story,
            quests: readQuestInputs(classId, todayStr),
            trials: readTrialInputs(classId, todayStr),
            assignment: readAssignmentInput(classId, todayStr)
        });
    } catch (error) {
        console.warn('What we learned today could not be collected:', error);
        return empty;
    }
}

function escapeLearnedHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/**
 * Tickable chips (all ticked) for the manual log modal and the entry editor.
 * `prefix` keeps the data attributes unique per surface.
 */
export function renderLearnedTodayPicksHtml(learned, prefix = 'learned') {
    const items = learned?.items || [];
    const words = learned?.words || [];
    if (!items.length && !words.length) return '';
    const itemPicks = items.map((item, index) => {
        const meta = LEARNED_TODAY_SOURCES[item.source] || LEARNED_TODAY_SOURCES.teacher;
        return `<label class="learned-today-pick" title="${escapeLearnedHtml(meta.label)}"><input type="checkbox" checked data-${prefix}-item="${index}" /><span><span aria-hidden="true">${meta.icon}</span> ${escapeLearnedHtml(item.label)}</span></label>`;
    }).join('');
    const wordPicks = words.map((word, index) => `<label class="learned-today-pick learned-today-pick--word"><input type="checkbox" checked data-${prefix}-word="${index}" /><span>${escapeLearnedHtml(word)}</span></label>`).join('');
    return `<div class="learned-today-picks">${itemPicks}${wordPicks}</div>`;
}

/** Read the teacher's optional edits back from a pick list rendered with the same prefix. */
export function readLearnedTodayPicks(rootEl, learned, prefix = 'learned', extraInputSelector = '') {
    const base = learned || { items: [], words: [], summary: '' };
    const camel = prefix.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const removeItems = [...rootEl.querySelectorAll(`[data-${prefix}-item]`)]
        .filter((input) => !input.checked)
        .map((input) => base.items?.[Number(input.dataset[`${camel}Item`])]?.label)
        .filter(Boolean);
    const removeWords = [...rootEl.querySelectorAll(`[data-${prefix}-word]`)]
        .filter((input) => !input.checked)
        .map((input) => base.words?.[Number(input.dataset[`${camel}Word`])])
        .filter(Boolean);
    const extraLine = extraInputSelector ? rootEl.querySelector(extraInputSelector)?.value || '' : '';
    return applyLearnedTodayEdits(base, { removeItems, removeWords, extraLine });
}

/** Read-only chips for the Adventure Log timeline. Returns '' when there is nothing to show. */
export function renderLearnedTodayHtml(learned) {
    const items = learned?.items || [];
    const words = learned?.words || [];
    if (!items.length && !words.length) return '';
    const itemChips = items.map((item) => {
        const meta = LEARNED_TODAY_SOURCES[item.source] || LEARNED_TODAY_SOURCES.teacher;
        return `<span class="learned-today-chip" title="${escapeLearnedHtml(meta.label)}"><span aria-hidden="true">${meta.icon}</span>${escapeLearnedHtml(item.label)}</span>`;
    }).join('');
    const wordChips = words.map((word) => `<span class="learned-today-word">${escapeLearnedHtml(word)}</span>`).join('');
    return `
        <div class="learned-today" aria-label="What we learned today">
            <p class="learned-today-title"><i class="fas fa-graduation-cap" aria-hidden="true"></i> What we learned today</p>
            ${itemChips ? `<div class="learned-today-chips">${itemChips}</div>` : ''}
            ${wordChips ? `<div class="learned-today-words"><span class="learned-today-words-label">Words:</span>${wordChips}</div>` : ''}
        </div>`;
}
