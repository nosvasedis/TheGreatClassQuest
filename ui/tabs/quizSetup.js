/**
 * Teacher Settings → Quiz of the Week.
 * The page leads with where this week's quiz stands (Plan → Create → Check → Play)
 * and what to do next; the plan form below opens when there is something to plan.
 * Wording and pure models: ui/tabs/quizSetupView.mjs.
 */
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import { canUseFeature } from '../../utils/subscription.js';
import {
    applyWordSelection,
    buildQuizLessonFocus,
    canGenerateQuiz,
    completedQuizDate,
    curriculumFromFocus,
    hasUsableLessonFocus,
    lessonFocusSummary,
    quizReviewWindow,
    targetWeekMonday,
    unitDisplayLine
} from '../../features/quizCurriculumCore.mjs';
import {
    QUIZ_TYPES,
    describeQuizWeek,
    escapeQuizText,
    expectedQuestionCount,
    planSummaryText,
    quizFactsHtml,
    quizHistoryHtml,
    quizTrackHtml,
    weekRangeLabel
} from './quizSetupView.mjs';

// Categories organised by quest level so suggestions are age-appropriate.
const GRAMMAR_CATEGORIES = {
    'Pre-Junior': [
        'Hello / Goodbye',
        'My Name Is…',
        'Alphabet & Phonics',
        'I Am / You Are',
        'This Is / That Is',
        'Big / Small',
        'Have Got (basic)',
        'Can / Can\'t (basic)',
        'Singular & Plural (basic)',
        'What Is This?',
        'In / On / Under'
    ],
    'Junior A': [
        'Simple Present (I play / she plays)',
        'Is / Am / Are',
        'Singular & Plural',
        'Colors & Shapes',
        'Yes / No Questions',
        'Action Verbs (basic)',
        'Alphabet & Spelling'
    ],
    'Junior B': [
        'Simple Present',
        'Simple Past (basic — was/were/did)',
        'Can / Can\'t',
        'Have / Has',
        'Articles (a / an)',
        'Singular & Plural',
        'Yes / No Questions',
        'Prepositions (in / on / under)'
    ],
    'A': [
        'Simple Present',
        'Simple Past',
        'Present Continuous',
        'There is / There are',
        'Articles (a / an / the)',
        'Prepositions (in / on / at / under / next to)',
        'Comparatives (bigger, smaller, faster)',
        'Can / Could',
        'Wh- Questions (What, Where, Who, When)',
        'Imperatives',
        'Possessive Adjectives (my, your, his, her)'
    ],
    'B': [
        'Present Simple & Continuous',
        'Past Simple & Continuous',
        'Future (will / going to)',
        'Prepositions of Time & Place',
        'Articles',
        'Comparatives & Superlatives',
        'Question Formation',
        'Can / Should / Must',
        'Conjunctions (and / but / because / so)',
        'Countable & Uncountable Nouns',
        'Adverbs of Frequency (always, often, never)'
    ],
    'C': [
        'Present Perfect',
        'Past Simple vs Present Perfect',
        'Future Forms (will / going to / present continuous)',
        '1st Conditional (If … will)',
        'Modal Verbs (can / could / must / should / might)',
        'Passive Voice (basic)',
        'Relative Clauses (who / which / that)',
        'Prepositions',
        'Question Tags',
        'Reported Speech (basic)',
        'Gerunds vs Infinitives (intro)',
        'Conjunctions & Connectors'
    ],
    'D': [
        'All Tenses Review',
        '1st & 2nd Conditionals',
        'Modal Verbs (full range)',
        'Passive Voice',
        'Reported Speech',
        'Relative Clauses',
        'Gerunds & Infinitives',
        'Phrasal Verbs',
        'Question Formation',
        'Conjunctions & Discourse Markers',
        'Emphasis & Inversion'
    ]
};

const VOCABULARY_CATEGORIES = {
    'Pre-Junior': [
        'Colors & Shapes',
        'Numbers (1–20)',
        'Animals & Pets',
        'Family & Friends',
        'Body Parts',
        'Toys & Games',
        'Food & Drinks',
        'Clothes',
        'Classroom Objects',
        'Weather (basic)',
        'Happy / Sad / Tired'
    ],
    'Junior A': [
        'Animals',
        'Colors & Shapes',
        'Numbers (1–20)',
        'Body Parts',
        'Classroom Objects',
        'Toys & Games',
        'Food (basic)',
        'Family Members',
        'Action Verbs (basic)'
    ],
    'Junior B': [
        'Animals (farm, wild, pets)',
        'Food & Drinks',
        'Classroom Objects',
        'Body Parts',
        'Family & Friends',
        'Colors & Numbers',
        'Daily Actions (eat, sleep, play, run)',
        'Clothes',
        'Weather & Seasons (basic)'
    ],
    'A': [
        'Animals',
        'Food & Drinks',
        'Weather & Seasons',
        'Sports & Hobbies',
        'House & Rooms',
        'Means of Transport',
        'School Subjects',
        'Daily Routines',
        'Clothes & Accessories',
        'Feelings & Emotions (basic)',
        'Days, Months & Time'
    ],
    'B': [
        'Food & Nutrition',
        'Sports & Hobbies',
        'Transport & Travel',
        'Jobs & Professions',
        'Nature & Environment',
        'Health & Body',
        'Technology (basic — computer, phone, internet)',
        'Holidays & Celebrations',
        'Emotions & Personality',
        'Shopping & Money',
        'House & Furniture',
        'Daily Routines'
    ],
    'C': [
        'Environment & Nature',
        'Technology & Media',
        'Sports & Fitness',
        'Travel & Tourism',
        'Health & Medicine',
        'Jobs & Careers',
        'Food & Nutrition',
        'Emotions & Character Traits',
        'Culture & Traditions',
        'Clothes & Fashion',
        'Science & Discovery',
        'Social Media & Communication'
    ],
    'D': [
        'Environment & Climate Change',
        'Technology & Innovation',
        'Global Issues & Current Events',
        'Health & Medicine',
        'Media & Communication',
        'Arts & Culture',
        'Science & Discovery',
        'Society & Everyday Life',
        'Business & Economy (basic)',
        'Idioms & Everyday Expressions',
        'Academic & Formal Vocabulary',
        'Compound Words & Word Formation'
    ]
};

const MIX_CATEGORIES = {
    'Pre-Junior': [
        'Alphabet & Phonics',
        'Animals & Pets',
        'I Am / You Are',
        'Colors & Numbers',
        'Have Got',
        'Family & Friends',
        'Can / Can\'t',
        'Food & Drinks',
        'In / On / Under',
        'Hello / Goodbye',
        'Action Words'
    ],
    'Junior A': [
        'Animals',
        'Colors & Shapes',
        'Classroom Objects',
        'Is / Am / Are',
        'Family Members',
        'Body Parts',
        'Simple Present',
        'Food (basic)',
        'Singular & Plural'
    ],
    'Junior B': [
        'Animals',
        'Food & Drinks',
        'Simple Present',
        'Can / Can\'t',
        'Family & Friends',
        'Body Parts',
        'Daily Actions',
        'Clothes',
        'Have / Has',
        'Weather & Seasons (basic)'
    ],
    'A': [
        'Animals',
        'Food & Drinks',
        'Weather & Seasons',
        'Simple Past',
        'Present Continuous',
        'Sports & Hobbies',
        'Daily Routines',
        'Prepositions',
        'Means of Transport',
        'Comparatives'
    ],
    'B': [
        'Past Simple & Continuous',
        'Future Forms',
        'Food & Travel',
        'Sports & Hobbies',
        'Comparatives & Superlatives',
        'Jobs & Professions',
        'Modal Verbs (can / should / must)',
        'Health & Body',
        'Question Formation',
        'Nature & Environment'
    ],
    'C': [
        'All Tenses',
        'Environment & Nature',
        '1st Conditional',
        'Technology & Media',
        'Modal Verbs',
        'Travel & Tourism',
        'Passive Voice (basic)',
        'Health & Medicine',
        'Relative Clauses',
        'Sports & Fitness',
        'Emotions & Character Traits'
    ],
    'D': [
        'Modal Verbs',
        'Passive Voice',
        'Global Issues',
        'Reported Speech',
        'Idioms & Expressions',
        'Conditionals',
        'Technology & Innovation',
        'Phrasal Verbs',
        'Gerunds & Infinitives',
        'Media & Society',
        'Academic Vocabulary',
        'Arts & Culture'
    ]
};

function getCategoriesForType(type, level) {
    const lvl = level || 'A';
    if (type === 'grammar') return GRAMMAR_CATEGORIES[lvl] || GRAMMAR_CATEGORIES['A'];
    if (type === 'vocabulary') return VOCABULARY_CATEGORIES[lvl] || VOCABULARY_CATEGORIES['A'];
    return MIX_CATEGORIES[lvl] || MIX_CATEGORIES['A'];
}

// ── Page state (one page, re-rendered whenever the header class changes) ──
let listenersBound = false;
let renderToken = 0;
let lessonFocus = null;
let useOwnTopics = false;
let planOpen = true;
let currentQuiz = null;
let generatingClassId = null;
let lastError = { classId: null, text: '' };
let carryCandidates = [];
let carryClassId = null;

const $ = (id) => document.getElementById(id);
const show = (el, on) => el?.classList.toggle('hidden', !on);
const quizActions = () => import('../../db/actions/quizOfTheWeek.js');

function selectedClass() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) return null;
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function enrolledCount(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId).length;
}

/** The class's next lesson in the quiz's target week (today included while the lesson is still on). */
function nextLessonThisWeek(classData) {
    if (!classData) return null;
    const todayIso = utils.getLocalIsoDateString();
    const monday = targetWeekMonday(todayIso);
    const [y, m, d] = monday.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endMinutes = utils.parseClockToMinutes(classData.timeEnd);
    const classes = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    const endDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        if (day < today) continue;
        if (day.getTime() === today.getTime() && endMinutes != null && (now.getHours() * 60 + now.getMinutes()) > endMinutes) continue;
        if (utils.doesClassMeetOnDate(classData.id, day, classes, overrides, holidays, endDates)) {
            return { date: day, timeStart: classData.timeStart || '' };
        }
    }
    return null;
}

// ── Lesson focus: what the class practised since the last finished quiz ──
async function loadLessonFocus(classId) {
    if (!classId) return null;
    try {
        const { getClassBookPlan } = await import('../../features/bookProgress.js');
        const { BOOK_ATLAS, describeUnit, getUnitWords } = await import('../../features/bookAtlas.mjs');
        const { getQuizHistory } = await quizActions();
        const today = utils.getLocalIsoDateString();
        const monday = targetWeekMonday(today);
        const completed = await getQuizHistory(classId, 5);
        const previous = completed.find((quiz) => {
            const date = completedQuizDate(quiz);
            return date && date < monday;
        });
        const window = quizReviewWindow(getClassBookPlan(classId).history || [], {
            lastCompletedDate: previous ? completedQuizDate(previous) : '',
            targetWeekMonday: monday,
            lastWeekKey: previous?.weekKey || ''
        });
        const units = [];
        const atlasWords = [];
        const seen = new Set();
        for (const entry of window.entries) {
            if (entry.unconfirmed || !entry.bookId || entry.unit == null) continue;
            const loadKey = `${entry.bookId}:${Number(entry.unit)}:${entry.component || 'sb'}`;
            const pages = Array.isArray(entry.pages) && entry.pages.length ? entry.pages : (entry.page ? [entry.page] : []);
            if (!seen.has(loadKey)) {
                seen.add(loadKey);
                const loaded = await getUnitWords(entry.bookId, entry.unit, {
                    component: entry.component || 'sb',
                    pages,
                    lessonCode: entry.lessonCode || null,
                    limit: 24
                }).catch(() => []);
                atlasWords.push(...loaded);
            }
            if (seen.has(`unit:${entry.bookId}:${Number(entry.unit)}`)) continue;
            seen.add(`unit:${entry.bookId}:${Number(entry.unit)}`);
            const book = BOOK_ATLAS.find((item) => item.id === entry.bookId);
            const unit = describeUnit(BOOK_ATLAS, entry.bookId, entry.unit);
            units.push({
                bookId: entry.bookId,
                unit: Number(entry.unit),
                title: unit?.title || '',
                theme: unit?.theme || '',
                grammar: unit?.grammar || '',
                kind: book?.kind || 'coursebook',
                bookTitle: book?.title || ''
            });
        }
        const focus = buildQuizLessonFocus({ entries: window.entries, units, atlasWords, window });
        return hasUsableLessonFocus(focus) ? focus : null;
    } catch (error) {
        console.warn('Could not load quiz lesson focus:', error);
        return null;
    }
}

// ── Remembered per-class choices for the two switches ──
const QOW_PREF_PREFIX = 'gcq_qow_pref_';

function readQuizPref(classId, key) {
    try {
        return localStorage.getItem(`${QOW_PREF_PREFIX}${key}_${classId}`) === '1';
    } catch {
        return false;
    }
}

function writeQuizPref(classId, key, value) {
    try {
        localStorage.setItem(`${QOW_PREF_PREFIX}${key}_${classId}`, value ? '1' : '0');
    } catch {
        /* storage unavailable: the switch still works for this visit */
    }
}

// ── Plan form pieces ──
function selectedType() {
    return $('qwk-type')?.querySelector('[aria-checked="true"]')?.dataset.type || 'mix';
}

function renderTypePicker(type) {
    const wrap = $('qwk-type');
    if (!wrap) return;
    wrap.innerHTML = QUIZ_TYPES.map((t) => `
        <button type="button" role="radio" class="qwk-type__opt" data-type="${t.id}" aria-checked="${t.id === type}">
            <span class="qwk-type__icon" aria-hidden="true">${t.icon}</span>
            <span class="qwk-type__label">${t.label}</span>
            <span class="qwk-type__hint">${t.hint}</span>
        </button>`).join('');
}

function renderCategories(savedCategories = null) {
    const wrap = $('quiz-categories-chips');
    if (!wrap) return;
    const keep = new Set(savedCategories || [...wrap.querySelectorAll('.quiz-category-checkbox:checked')].map((cb) => cb.value));
    const level = selectedClass()?.questLevel || 'A';
    const categories = getCategoriesForType(selectedType(), level);
    wrap.innerHTML = categories.map((cat) => `
        <label class="qwk-chip">
            <input type="checkbox" value="${escapeQuizText(cat)}" class="qwk-chip__input quiz-category-checkbox"${keep.has(cat) ? ' checked' : ''} />
            <span>${escapeQuizText(cat)}</span>
        </label>`).join('');
}

function renderLessonCard(focus, preselectedWords = null) {
    const units = $('qwk-lesson-units');
    const grammar = $('qwk-lesson-grammar');
    const words = $('qwk-lesson-words');
    if (!focus) {
        if (units) units.innerHTML = '';
        if (grammar) grammar.innerHTML = '';
        if (words) words.innerHTML = '';
        return;
    }
    const windowEl = $('qwk-lesson-window');
    if (windowEl) windowEl.textContent = lessonFocusSummary(focus);
    if (units) {
        units.innerHTML = (focus.units || []).map((unit) => (
            `<p class="qwk-lesson__unit"><i class="fas fa-bookmark" aria-hidden="true"></i> ${escapeQuizText(unitDisplayLine(unit))}</p>`
        )).join('');
    }
    if (grammar) {
        grammar.innerHTML = (focus.grammarPoints || []).map((point) => (
            `<span class="qwk-grammar"><i class="fas fa-spell-check" aria-hidden="true"></i> ${escapeQuizText(point)}</span>`
        )).join('');
        show(grammar, (focus.grammarPoints || []).length > 0);
    }
    const selected = new Set((preselectedWords || focus.words || []).map((word) => String(word).toLowerCase()));
    if (words) {
        words.innerHTML = (focus.words || []).map((word) => `
            <label class="qwk-chip">
                <input type="checkbox" value="${escapeQuizText(word)}" class="qwk-chip__input qwk-lesson-word"${selected.has(word.toLowerCase()) ? ' checked' : ''} />
                <span>${escapeQuizText(word)}</span>
            </label>`).join('');
    }
    show($('qwk-words-block'), (focus.words || []).length > 0);
}

function selectedLessonWords() {
    const boxes = document.querySelectorAll('#qwk-lesson-words .qwk-lesson-word');
    if (!boxes.length) return applyWordSelection(lessonFocus, null);
    return applyWordSelection(lessonFocus, [...boxes].filter((input) => input.checked).map((input) => input.value));
}

function selectedCategories() {
    return [...document.querySelectorAll('.quiz-category-checkbox:checked')].map((cb) => cb.value);
}

function renderSourceMode() {
    const hasFocus = hasUsableLessonFocus(lessonFocus);
    const own = useOwnTopics || !hasFocus;
    show($('qwk-lesson'), hasFocus && !own);
    show($('qwk-topics'), own);
    show($('qwk-back-to-lessons-btn'), hasFocus && own);
    const label = $('qwk-topics-label');
    if (label) label.textContent = hasFocus ? 'Your own topics' : 'Pick the topics you covered';
    const note = $('quiz-keywords');
    if (note) {
        note.placeholder = own
            ? 'e.g. ordinal numbers 1st–10th, was / were in past sentences'
            : 'e.g. keep sentences short, include was / were';
    }
}

// ── Last week's missed questions (optional) ──
function renderCarryList(preselectedIds = null) {
    const list = $('quiz-carry-list');
    const summary = $('quiz-carry-summary');
    if (!list || !summary) return;
    const hasAny = carryCandidates.length > 0;
    show(list.parentElement?.querySelector('.qwk-words__tools'), hasAny);
    if (!hasAny) {
        list.innerHTML = '';
        summary.textContent = carryClassId
            ? 'Every question last time was answered. Nothing to bring back.'
            : 'There is no finished quiz yet for this class.';
        return;
    }
    const preselected = preselectedIds ? new Set(preselectedIds) : null;
    summary.textContent = `${carryCandidates.length} question${carryCandidates.length === 1 ? '' : 's'} missed last time. Tick the ones to bring back.`;
    list.innerHTML = carryCandidates.map(({ stat, question }, index) => {
        const checked = preselected ? preselected.has(stat.questionId) : true;
        const wrong = stat.topWrongAnswer
            ? `<span class="qwk-carry__wrong">Most chose “${escapeQuizText(stat.topWrongAnswer)}”</span>`
            : `<span class="qwk-carry__wrong">${stat.asked ? 'Missed on the first try' : 'Skipped'}</span>`;
        return `
            <label class="qwk-carry__item">
                <input type="checkbox" class="qwk-carry__check" data-carry-index="${index}"${checked ? ' checked' : ''} />
                <span class="qwk-carry__copy">
                    <span class="qwk-carry__question">${escapeQuizText(question.question)}</span>
                    <span class="qwk-carry__meta"><span class="qwk-carry__answer"><i class="fas fa-check" aria-hidden="true"></i> ${escapeQuizText(question.correctAnswer)}</span>${wrong}</span>
                </span>
            </label>`;
    }).join('');
}

async function loadCarryCandidates(classId, preselectedIds = null) {
    const panel = $('quiz-carry-panel');
    if (!panel) return;
    show(panel, true);
    const summary = $('quiz-carry-summary');
    if (summary) summary.textContent = 'Looking for last week\'s quiz…';
    const list = $('quiz-carry-list');
    if (list) list.innerHTML = '';
    try {
        const { getPreviousQuizReview } = await quizActions();
        const review = await getPreviousQuizReview(classId);
        if (state.get('globalSelectedClassId') !== classId) return;
        carryClassId = review ? classId : null;
        carryCandidates = review?.carryCandidates || [];
    } catch (error) {
        console.warn('Could not load last week\'s quiz review:', error);
        carryClassId = null;
        carryCandidates = [];
    }
    renderCarryList(preselectedIds);
    updateGoSummary();
}

function selectedCarryQuestions() {
    if (!$('quiz-carry-toggle')?.checked) return [];
    return [...document.querySelectorAll('#quiz-carry-list .qwk-carry__check:checked')]
        .map((input) => carryCandidates[Number(input.dataset.carryIndex)]?.question)
        .filter(Boolean);
}

// ── The "This week" card ──
function renderWeek() {
    const classData = selectedClass();
    if (!classData) return;
    const classId = classData.id;
    const generating = generatingClassId === classId;
    const error = lastError.classId === classId ? lastError.text : '';
    const model = describeQuizWeek({ quiz: currentQuiz, nextLesson: nextLessonThisWeek(classData), generating, error });

    const card = $('qwk-week');
    if (card) card.dataset.tone = model.tone;
    const icon = $('qwk-week-icon');
    if (icon) icon.textContent = model.icon;
    const todayIso = utils.getLocalIsoDateString();
    const monday = targetWeekMonday(todayIso);
    const eyebrow = $('qwk-week-eyebrow');
    if (eyebrow) eyebrow.textContent = `${monday > todayIso ? 'Next week' : 'This week'} · ${weekRangeLabel(monday)}`;
    const title = $('qwk-week-title');
    if (title) title.textContent = model.title;
    const sub = $('qwk-week-sub');
    if (sub) sub.textContent = model.sub;
    const track = $('qwk-track');
    if (track) track.innerHTML = quizTrackHtml(model.phase, { skippedCheck: currentQuiz ? !currentQuiz.reviewBeforeLive : false });
    const facts = $('qwk-week-facts');
    if (facts) facts.innerHTML = quizFactsHtml(model.facts);
    show(facts, model.facts.length > 0);
    show($('qwk-gen'), generating);

    const actions = new Set(model.actions);
    const reviewBtn = $('quiz-review-btn');
    show(reviewBtn, actions.has('review') || actions.has('edit'));
    reviewBtn?.classList.toggle('ts-btn--quiet', !actions.has('review'));
    const reviewLabel = $('quiz-review-btn-label');
    if (reviewLabel) reviewLabel.textContent = actions.has('review') ? 'Check & approve' : 'Read & edit the questions';
    reviewBtn?.querySelector('i')?.setAttribute('class', actions.has('review') ? 'fas fa-eye' : 'fas fa-pen-to-square');
    show($('qwk-results-btn'), actions.has('results'));
    show($('quiz-reset-btn'), actions.has('reset') && !generating);
    show($('qwk-play-btn'), false);
    if (actions.has('play')) {
        import('../../features/quizOfTheWeek.js')
            .then(({ shouldShowQuizButton }) => shouldShowQuizButton(classId))
            .then((verdict) => {
                if (state.get('globalSelectedClassId') === classId) show($('qwk-play-btn'), verdict === 'show');
            })
            .catch(() => {});
    }
}

// ── The plan card: open, folded to a summary, or locked once played ──
function renderPlan() {
    const classData = selectedClass();
    if (!classData) return;
    const status = currentQuiz?.status || 'none';
    const hasQuestions = (currentQuiz?.questions || []).length > 0;
    const locked = status === 'completed' || status === 'active';
    const generating = generatingClassId === classData.id;
    const mode = locked ? 'locked' : (planOpen ? 'open' : 'closed');
    const plan = $('qwk-plan');
    if (plan) plan.dataset.mode = mode;

    show($('qwk-plan-form'), mode === 'open');
    show($('qwk-plan-locked'), mode === 'locked');
    const summary = $('qwk-plan-summary');
    const summaryText = currentQuiz?.curriculum ? planSummaryText(currentQuiz.curriculum) : '';
    if (summary) summary.textContent = summaryText;
    show(summary, mode !== 'open' && Boolean(summaryText));
    const title = $('qwk-plan-title');
    if (title) title.textContent = hasQuestions || locked ? 'This week\'s plan' : 'Plan the quiz';

    const toggle = $('qwk-plan-toggle');
    show(toggle, !locked && hasQuestions && !generating);
    const toggleLabel = toggle?.querySelector('span');
    if (toggleLabel) toggleLabel.textContent = planOpen ? 'Keep this quiz' : 'Change the plan';
    toggle?.querySelector('i')?.setAttribute('class', planOpen ? 'fas fa-chevron-up' : 'fas fa-sliders');

    const btn = $('quiz-generate-btn');
    const label = $('quiz-generate-btn-label');
    if (btn) {
        btn.disabled = generating;
        btn.querySelector('i')?.setAttribute('class', generating ? 'fas fa-spinner fa-spin' : hasQuestions ? 'fas fa-rotate-right' : 'fas fa-wand-magic-sparkles');
    }
    if (label) label.textContent = generating ? 'Creating…' : hasQuestions ? 'Make new questions' : 'Create the quiz';
    const replace = $('qwk-replace-note');
    show(replace, hasQuestions && !generating);
    const replaceText = replace?.querySelector('span');
    if (replaceText) replaceText.textContent = `This replaces the ${currentQuiz?.questions?.length || 0} questions you have now.`;
    updateGoSummary();
}

function updateGoSummary() {
    const el = $('qwk-go-summary');
    const classData = selectedClass();
    if (!el || !classData) return;
    const count = expectedQuestionCount(enrolledCount(classData.id));
    const own = useOwnTopics || !hasUsableLessonFocus(lessonFocus);
    const parts = [`About ${count} questions`, QUIZ_TYPES.find((t) => t.id === selectedType())?.label || ''];
    if (own) {
        const n = selectedCategories().length;
        if (n) parts.push(`${n} topic${n === 1 ? '' : 's'}`);
    } else {
        const n = selectedLessonWords().length;
        if (n) parts.push(`${n} word${n === 1 ? '' : 's'}`);
    }
    const carried = selectedCarryQuestions().length;
    if (carried) parts.push(`${carried} back from last time`);
    el.textContent = parts.filter(Boolean).join(' · ');
    const words = $('qwk-words-count');
    if (words && lessonFocus) words.textContent = `${selectedLessonWords().length} of ${(lessonFocus.words || []).length}`;
}

async function renderHistory(classId) {
    const area = $('quiz-history-area');
    const list = $('quiz-history-list');
    try {
        const { getQuizHistory } = await quizActions();
        const history = (await getQuizHistory(classId, 7))
            .filter((h) => !(currentQuiz?.status === 'completed' && h.weekKey === currentQuiz.weekKey))
            .slice(0, 6);
        if (state.get('globalSelectedClassId') !== classId) return;
        if (list) list.innerHTML = quizHistoryHtml(history);
        show(area, history.length > 0);
    } catch (error) {
        console.warn('Could not load quiz history:', error);
        show(area, false);
    }
}

async function refreshQuiz(classId) {
    try {
        const { getQuizForClass } = await quizActions();
        const quiz = await getQuizForClass(classId);
        if (state.get('globalSelectedClassId') !== classId) return;
        currentQuiz = quiz;
    } catch (error) {
        console.warn('Could not load this week\'s quiz:', error);
    }
    renderWeek();
    renderPlan();
}

// ── Whole page for the header class ──
async function syncToHeaderClass() {
    const token = ++renderToken;
    const classData = selectedClass();
    const chip = $('qwk-class-chip');
    show($('qwk-no-class'), !classData);
    show($('qwk-body'), Boolean(classData));
    show(chip, Boolean(classData));
    show($('quiz-validation-msg'), false);
    if (!classData) {
        currentQuiz = null;
        lessonFocus = null;
        return;
    }
    const classId = classData.id;
    const logo = $('qwk-class-logo');
    if (logo) logo.textContent = classData.logo || '📚';
    const name = $('qwk-class-name');
    if (name) name.textContent = classData.name || 'Class';
    const meta = $('qwk-class-meta');
    if (meta) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const schedule = (classData.scheduleDays || []).map((d) => days[d] || d).join(', ');
        const time = classData.timeStart ? `${classData.timeStart}${classData.timeEnd ? `–${classData.timeEnd}` : ''}` : '';
        meta.textContent = [classData.questLevel, schedule, time].filter(Boolean).join(' · ');
    }

    const [focus, quiz] = await Promise.all([
        loadLessonFocus(classId),
        quizActions().then(({ getQuizForClass }) => getQuizForClass(classId)).catch(() => null)
    ]);
    if (token !== renderToken) return;
    lessonFocus = focus;
    currentQuiz = quiz;

    const c = quiz?.curriculum || null;
    const hasFocus = hasUsableLessonFocus(focus);
    useOwnTopics = !hasFocus || Boolean(c && (!c.lessonFocus || c.lessonFocus.source === 'manual'));
    renderTypePicker(c?.type || focus?.type || 'mix');
    renderLessonCard(hasFocus ? focus : null, c?.lessonFocus?.source === 'book-atlas' ? c.lessonFocus.words : null);
    const note = $('quiz-keywords');
    if (note) note.value = c ? (c.lessonFocus ? (c.lessonFocus.note || '') : (c.keywords || '')) : '';
    renderCategories(c?.categories || []);
    renderSourceMode();

    // This week's saved choice wins, otherwise the teacher's last choice for this class.
    const savedCarry = Array.isArray(quiz?.carryForward) ? quiz.carryForward : null;
    const reviewToggle = $('quiz-review-toggle');
    if (reviewToggle) {
        reviewToggle.checked = typeof quiz?.reviewBeforeLive === 'boolean' ? quiz.reviewBeforeLive : readQuizPref(classId, 'review');
    }
    const carryToggle = $('quiz-carry-toggle');
    if (carryToggle) carryToggle.checked = savedCarry ? savedCarry.length > 0 : readQuizPref(classId, 'carry');
    carryCandidates = [];
    carryClassId = null;
    if (carryToggle?.checked) {
        const preselected = savedCarry?.length ? savedCarry.map((q) => q.carriedFrom?.questionId).filter(Boolean) : null;
        loadCarryCandidates(classId, preselected);
    } else {
        show($('quiz-carry-panel'), false);
    }

    const hasQuestions = (quiz?.questions || []).length > 0;
    planOpen = !hasQuestions || generatingClassId === classId;
    renderWeek();
    renderPlan();
    renderHistory(classId);
}

// ── Actions ──
async function generate() {
    const classData = selectedClass();
    if (!classData || generatingClassId) return;
    const classId = classData.id;
    const type = selectedType();
    const categories = selectedCategories();
    const note = $('quiz-keywords')?.value?.trim() || '';
    const carryForward = selectedCarryQuestions();
    const reviewBeforeLive = Boolean($('quiz-review-toggle')?.checked);
    const hasFocus = hasUsableLessonFocus(lessonFocus);
    const manualOverride = !hasFocus || useOwnTopics;
    const selectedWords = selectedLessonWords();
    const curriculum = hasFocus
        ? curriculumFromFocus(lessonFocus, { type, note, selectedWords, categories: manualOverride ? categories : [], manualOverride })
        : { type, categories, keywords: note, lessonFocus: null };

    const warn = $('quiz-validation-msg');
    if (!canGenerateQuiz({ focus: lessonFocus, selectedWords, categories, keywords: note, carryCount: carryForward.length, manualOverride })) {
        if (warn) {
            warn.textContent = manualOverride
                ? 'Tick at least one topic or write a note so the quiz has something to ask about.'
                : 'Keep at least one word or write a note so the quiz has something to ask about.';
        }
        show(warn, true);
        return;
    }
    show(warn, false);

    generatingClassId = classId;
    lastError = { classId: null, text: '' };
    renderWeek();
    renderPlan();
    setGenStep(1);
    const fill = document.querySelector('#qwk-gen .qwk-gen__fill');
    if (fill) { fill.style.animation = 'none'; void fill.offsetHeight; fill.style.animation = ''; }
    $('qwk-week')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

    let result = null;
    try {
        const { saveQuizCurriculum, generateQuizQuestions } = await quizActions();
        await saveQuizCurriculum(classId, {
            type: curriculum.type,
            categories: curriculum.categories,
            keywords: curriculum.keywords,
            lessonFocus: curriculum.lessonFocus,
            questLevel: classData.questLevel || 'A',
            reviewBeforeLive,
            carryForward
        });
        setGenStep(2);
        result = await generateQuizQuestions(classId);
        setGenStep(3);
        await new Promise((r) => setTimeout(r, 600));
    } catch (error) {
        console.error('Quiz generation failed:', error);
        lastError = { classId, text: String(error?.message || '').slice(0, 180) };
    }
    generatingClassId = null;
    if (state.get('globalSelectedClassId') !== classId) {
        if (result) showToast('This week\'s quiz is ready for the other class.', 'success');
        return;
    }
    planOpen = Boolean(lastError.text);
    await refreshQuiz(classId);
    renderHistory(classId);
    if (result?.status === 'review') openReview(classId);
    else if (result) showToast(`Quiz ready: ${result.questionCount} questions.`, 'success');
}

function setGenStep(n) {
    document.querySelectorAll('#qwk-gen [data-gen-step]').forEach((el) => {
        const step = Number(el.dataset.genStep);
        el.classList.toggle('is-done', step < n);
        el.classList.toggle('is-now', step === n);
    });
}

async function openReview(classId) {
    const { openQuizReviewEditor } = await import('../modals/quizReview.js');
    openQuizReviewEditor(classId, { onSaved: () => refreshQuiz(classId) });
}

async function resetQuiz() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) return;
    if (!confirm('Delete this week\'s quiz for this class? Its questions are removed and you can plan a new one.')) return;
    const btn = $('quiz-reset-btn');
    if (btn) btn.disabled = true;
    try {
        const { deleteQuizForClass } = await quizActions();
        await deleteQuizForClass(classId);
        lastError = { classId: null, text: '' };
        await syncToHeaderClass();
    } catch (error) {
        console.error('Failed to delete quiz:', error);
        showToast('Could not delete the quiz: ' + (error.message || 'unknown error'), 'error');
    }
    if (btn) btn.disabled = false;
}

function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    const form = $('qwk-plan-form');

    $('qwk-type')?.addEventListener('click', (e) => {
        const opt = e.target.closest('.qwk-type__opt');
        if (!opt) return;
        $('qwk-type').querySelectorAll('.qwk-type__opt').forEach((b) => b.setAttribute('aria-checked', String(b === opt)));
        renderCategories();
        updateGoSummary();
    });
    $('qwk-type')?.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const opts = [...$('qwk-type').querySelectorAll('.qwk-type__opt')];
        const i = opts.findIndex((b) => b.getAttribute('aria-checked') === 'true');
        const next = opts[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? opts.length - 1 : 1)) % opts.length];
        e.preventDefault();
        next?.click();
        next?.focus();
    });
    form?.addEventListener('change', (e) => {
        if (e.target.matches('.qwk-lesson-word, .quiz-category-checkbox, .qwk-carry__check')) updateGoSummary();
    });
    form?.addEventListener('click', (e) => {
        const bulk = e.target.closest('[data-words]');
        if (!bulk) return;
        document.querySelectorAll('#qwk-lesson-words .qwk-lesson-word').forEach((input) => { input.checked = bulk.dataset.words === 'all'; });
        updateGoSummary();
    });
    $('qwk-own-topics-btn')?.addEventListener('click', () => { useOwnTopics = true; renderSourceMode(); updateGoSummary(); });
    $('qwk-back-to-lessons-btn')?.addEventListener('click', () => { useOwnTopics = false; renderSourceMode(); updateGoSummary(); });

    $('quiz-review-toggle')?.addEventListener('change', (e) => {
        const classId = state.get('globalSelectedClassId');
        if (classId) writeQuizPref(classId, 'review', e.target.checked);
    });
    $('quiz-carry-toggle')?.addEventListener('change', (e) => {
        const classId = state.get('globalSelectedClassId');
        if (!classId) return;
        writeQuizPref(classId, 'carry', e.target.checked);
        if (e.target.checked) loadCarryCandidates(classId);
        else show($('quiz-carry-panel'), false);
        updateGoSummary();
    });
    $('quiz-carry-all-btn')?.addEventListener('click', () => {
        document.querySelectorAll('#quiz-carry-list .qwk-carry__check').forEach((input) => { input.checked = true; });
        updateGoSummary();
    });
    $('quiz-carry-none-btn')?.addEventListener('click', () => {
        document.querySelectorAll('#quiz-carry-list .qwk-carry__check').forEach((input) => { input.checked = false; });
        updateGoSummary();
    });

    $('qwk-plan-toggle')?.addEventListener('click', () => {
        planOpen = !planOpen;
        renderPlan();
        if (planOpen) $('qwk-plan')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    });
    $('quiz-generate-btn')?.addEventListener('click', generate);
    $('quiz-reset-btn')?.addEventListener('click', resetQuiz);
    $('quiz-review-btn')?.addEventListener('click', () => {
        const classId = state.get('globalSelectedClassId');
        if (classId) openReview(classId);
    });
    const openStage = async () => {
        const classId = state.get('globalSelectedClassId');
        if (!classId) return;
        const { openQuizModal } = await import('../modals/quizOfTheWeek.js');
        openQuizModal(classId);
    };
    $('qwk-play-btn')?.addEventListener('click', openStage);
    $('qwk-results-btn')?.addEventListener('click', openStage);
}

export async function renderQuizOptionsUi() {
    const content = $('options-quiz-content');
    const hasQuiz = canUseFeature('quizOfTheWeek');
    show($('options-quiz-locked'), !hasQuiz);
    show(content, hasQuiz);
    if (!hasQuiz || !content) return;
    bindListeners();
    await syncToHeaderClass();
}
