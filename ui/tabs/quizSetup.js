/**
 * Teacher Settings → Quiz of the Week.
 * The page leads with where this week's quiz stands (Plan → Create → Check → Play)
 * and what to do next; the plan form below opens when there is something to plan.
 * Wording and pure models: ui/tabs/quizSetupView.mjs.
 */
import { quietly } from '../../utils/runtimeMetrics.js';
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
import { describeKindMix, quizAgeBand, quizKindMix } from '../../features/quizKindsCore.mjs';
import {
    QUIZ_BOOK_PICK_CAP,
    bookPickLabel,
    bookPickTargets,
    cleanBookPick,
    defaultBookPick,
    quizBookOptions
} from '../../features/quizBookPicks.mjs';
import { BOOK_ATLAS, PART_LABELS, bookPartOptions, syncLessonRow } from '../../features/bookAtlas.mjs';
import {
    QUIZ_TYPES,
    describeQuizWeek,
    escapeQuizText,
    expectedQuestionCount,
    planSummaryText,
    quizFactsHtml,
    quizSourceTabsHtml,
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
// Where the questions come from: 'lessons' (since the last quiz), 'book' (chosen pages) or 'own' (described).
let source = 'own';
let bookRows = [];
let bookFocus = null;
let bookToken = 0;
let bookTimer = null;
let bookSavedWords = null;
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

/**
 * Words, units and grammar for a list of book places ({ bookId, unit, component, pages }).
 * Every wordlist is read at once, so the card fills in quickly.
 */
async function focusFromTargets(targets, windowMeta = null, { byUnit = false } = {}) {
    const { BOOK_ATLAS: atlas, describeUnit, getUnitWords, wordLessonTargets } = await import('../../features/bookAtlas.mjs');
    const loads = new Map();
    const units = [];
    const seenUnits = new Set();
    // The Student's Book carries the words; the same book's activity book or companion only adds words when
    // no Student's Book of it was chosen.
    const wordTargets = new Set(wordLessonTargets(targets, { byUnit }));
    for (const target of targets) {
        if (!target?.bookId || target.unit == null) continue;
        const pages = Array.isArray(target.pages) ? target.pages : [];
        const key = `${target.bookId}:${Number(target.unit)}:${target.component || 'sb'}:${pages.join(',')}:${target.lessonCode || ''}`;
        if (wordTargets.has(target) && !loads.has(key)) {
            loads.set(key, getUnitWords(target.bookId, target.unit, {
                component: target.component || 'sb',
                pages,
                lessonCode: target.lessonCode || null,
                limit: 24
            }).catch(() => []));
        }
        const unitKey = `${target.bookId}:${Number(target.unit)}`;
        if (seenUnits.has(unitKey)) continue;
        seenUnits.add(unitKey);
        const book = atlas.find((item) => item.id === target.bookId);
        const unit = describeUnit(atlas, target.bookId, target.unit);
        units.push({
            bookId: target.bookId,
            unit: Number(target.unit),
            title: unit?.title || '',
            theme: unit?.theme || '',
            grammar: unit?.grammar || '',
            kind: book?.kind || 'coursebook',
            bookTitle: book?.title || ''
        });
    }
    const atlasWords = (await Promise.all(loads.values())).flat();
    return { units, atlasWords, windowMeta };
}

// ── Lesson focus: what the class practised since the last finished quiz ──
async function loadLessonFocus(classId) {
    if (!classId) return null;
    try {
        const { getClassBookPlan } = await import('../../features/bookProgress.js');
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
        const targets = window.entries
            .filter((entry) => !entry.unconfirmed && entry.bookId && entry.unit != null)
            .map((entry) => ({
                bookId: entry.bookId,
                unit: entry.unit,
                component: entry.component || 'sb',
                pages: Array.isArray(entry.pages) && entry.pages.length ? entry.pages : (entry.page ? [entry.page] : []),
                lessonCode: entry.lessonCode || null
            }));
        const { units, atlasWords } = await focusFromTargets(targets, null, { byUnit: true });
        const focus = buildQuizLessonFocus({ entries: window.entries, units, atlasWords, window });
        return hasUsableLessonFocus(focus) ? focus : null;
    } catch (error) {
        console.warn('Could not load quiz lesson focus:', error);
        return null;
    }
}

// ── Book pages chosen by the teacher ──
function classBookContext() {
    const classData = selectedClass();
    return { bookPlan: classData?.bookPlan || {}, league: classData?.questLevel || '' };
}

function rowFromPick(pick) {
    const clean = cleanBookPick(pick || {});
    if (!clean) return null;
    return { bookId: clean.bookId, component: clean.component, unit: clean.unit ? String(clean.unit) : '', pageText: clean.pageText, unitAuto: false, pagesAuto: false };
}

function freshBookRow() {
    return rowFromPick(defaultBookPick(classBookContext())) || { bookId: BOOK_ATLAS[0]?.id || '', component: 'sb', unit: '', pageText: '', unitAuto: false, pagesAuto: false };
}

function bookRowHtml(row, index) {
    const options = quizBookOptions(classBookContext());
    const suggested = options.filter((o) => o.suggested);
    const others = options.filter((o) => !o.suggested);
    const opt = (o) => `<option value="${escapeQuizText(o.id)}"${o.id === row.bookId ? ' selected' : ''}>${escapeQuizText(o.title)}${o.kind === 'grammar' ? ' (grammar)' : ''}</option>`;
    const bookSelect = suggested.length && others.length
        ? `<optgroup label="This class's books">${suggested.map(opt).join('')}</optgroup><optgroup label="Other books">${others.map(opt).join('')}</optgroup>`
        : options.map(opt).join('');
    const book = BOOK_ATLAS.find((b) => b.id === row.bookId);
    const parts = bookPartOptions(book || null);
    const units = book?.units || [];
    const label = bookPickLabel(row);
    const complete = bookPickTargets(row).length > 0;
    return `
        <div class="qwk-bookrow" data-row="${index}">
            <label class="qwk-bookrow__field qwk-bookrow__field--book"><span>Book</span>
                <select class="ts-input" data-field="bookId" aria-label="Book">${bookSelect}</select></label>
            ${parts.length > 1 ? `<label class="qwk-bookrow__field qwk-bookrow__field--part"><span>Part</span>
                <select class="ts-input" data-field="component" aria-label="Part of the book">${parts.map((part) => `<option value="${part}"${part === row.component ? ' selected' : ''}>${escapeQuizText(PART_LABELS[part] || part)}</option>`).join('')}</select></label>` : ''}
            <label class="qwk-bookrow__field qwk-bookrow__field--unit"><span>Unit</span>
                <select class="ts-input" data-field="unit" aria-label="Unit"><option value="">Pages only</option>${units.map((unit) => `<option value="${unit.n}"${String(unit.n) === String(row.unit) ? ' selected' : ''}>${unit.n}${unit.title ? ` · ${escapeQuizText(unit.title)}` : ''}</option>`).join('')}</select></label>
            <label class="qwk-bookrow__field qwk-bookrow__field--pages"><span>Pages</span>
                <input class="ts-input" data-field="pageText" inputmode="numeric" autocomplete="off" placeholder="e.g. 30-35" value="${escapeQuizText(row.pageText)}" aria-label="Pages"></label>
            ${bookRows.length > 1 ? `<button type="button" class="qwk-bookrow__remove" data-remove-row="${index}" title="Remove this book" aria-label="Remove this book"><i class="fas fa-xmark"></i></button>` : ''}
            <p class="qwk-bookrow__hint${complete ? '' : ' is-empty'}"><i class="fas ${complete ? 'fa-bookmark' : 'fa-circle-info'}" aria-hidden="true"></i> ${complete ? escapeQuizText(label) : 'Choose a unit, or type the pages (for example 30-35).'}</p>
        </div>`;
}

function renderBookRows() {
    const wrap = $('qwk-book-rows');
    if (!wrap) return;
    wrap.innerHTML = bookRows.map(bookRowHtml).join('');
    show($('qwk-book-add'), bookRows.length < QUIZ_BOOK_PICK_CAP);
}

function bookPicks() {
    return bookRows
        .map((row) => cleanBookPick(row))
        .filter((pick) => pick && bookPickTargets(pick).length)
        .map((pick) => ({ ...pick, label: bookPickLabel(pick) }));
}

/** Read the chosen pages again (after a short pause in typing) and show their words and grammar. */
function queueBookFocus({ delay = 300 } = {}) {
    clearTimeout(bookTimer);
    bookTimer = setTimeout(refreshBookFocus, delay);
}

async function refreshBookFocus() {
    const token = ++bookToken;
    const picks = bookPicks();
    const status = $('qwk-book-status');
    if (!picks.length) {
        bookFocus = null;
        if (source === 'book') renderFocusCard(null);
        if (status) status.textContent = '';
        show(status, false);
        updateGoSummary();
        return;
    }
    if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Reading those pages…';
    show(status, true);
    const targets = picks.flatMap((pick) => bookPickTargets(pick));
    const { units, atlasWords } = await focusFromTargets(targets);
    if (token !== bookToken) return;
    const focus = buildQuizLessonFocus({
        entries: targets.map((target) => ({ bookId: target.bookId, unit: target.unit })),
        units,
        atlasWords,
        window: null
    });
    focus.source = 'book-pages';
    focus.picks = picks;
    bookFocus = focus;
    const usable = hasUsableLessonFocus(focus);
    if (status) {
        status.innerHTML = usable
            ? ''
            : '<i class="fas fa-circle-info" aria-hidden="true"></i> This book has no word list in the app. Write what to practise in the note below, and the quiz writer uses the pages and their grammar.';
    }
    show(status, !usable);
    if (source === 'book') {
        // A saved plan brings back its ticks; otherwise words the teacher unticked stay unticked.
        const unticked = new Set([...document.querySelectorAll('#qwk-lesson-words .qwk-lesson-word')]
            .filter((input) => !input.checked).map((input) => input.value.toLowerCase()));
        const keep = bookSavedWords || focus.words.filter((word) => !unticked.has(String(word).toLowerCase()));
        bookSavedWords = null;
        renderFocusCard(focus, keep);
    }
    updateGoSummary();
}

function onBookRowChange(event) {
    const field = event.target.closest('[data-field]');
    const rowEl = event.target.closest('.qwk-bookrow');
    if (!field || !rowEl) return;
    const index = Number(rowEl.dataset.row);
    const row = bookRows[index];
    if (!row) return;
    const key = field.dataset.field;
    row[key] = field.value;
    let change = key === 'pageText' ? 'pages' : key === 'component' ? 'part' : key;
    if (key === 'bookId') {
        const book = BOOK_ATLAS.find((b) => b.id === row.bookId);
        row.component = bookPartOptions(book || null)[0] || 'sb';
        row.unit = '';
        row.pageText = '';
        row.unitAuto = false;
        row.pagesAuto = false;
        change = 'book';
    }
    Object.assign(row, syncLessonRow(row, change));
    // Re-draw the row only once the teacher has finished with a field, never mid-typing.
    if (event.type === 'change') {
        renderBookRows();
        queueBookFocus({ delay: 0 });
    } else {
        queueBookFocus();
    }
}

// ── Remembered per-class choices// ── Remembered per-class choices for the two switches ──
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

/** The focus the plan uses now: the lessons since the last quiz, the chosen pages, or none (described). */
function activeFocus() {
    if (source === 'lessons') return lessonFocus;
    if (source === 'book') return bookFocus;
    return null;
}

/** Units, grammar and word chips of a focus (shared by "Since the last quiz" and "Choose book pages"). */
function renderFocusCard(focus, preselectedWords = null) {
    const units = $('qwk-lesson-units');
    const grammar = $('qwk-lesson-grammar');
    const words = $('qwk-lesson-words');
    show($('qwk-focus'), Boolean(focus) && (source === 'lessons' || source === 'book'));
    if (!focus) {
        if (units) units.innerHTML = '';
        if (grammar) grammar.innerHTML = '';
        if (words) words.innerHTML = '';
        return;
    }
    const windowEl = $('qwk-lesson-window');
    if (windowEl && source === 'lessons') windowEl.textContent = lessonFocusSummary(focus);
    if (units) {
        units.innerHTML = (focus.units || []).map((unit) => (
            `<p class="qwk-lesson__unit"><i class="fas fa-bookmark" aria-hidden="true"></i> ${escapeQuizText(unitDisplayLine(unit))}</p>`
        )).join('');
        show(units, source === 'lessons');
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
    updateGoSummary();
}

function selectedLessonWords() {
    const focus = activeFocus();
    const boxes = document.querySelectorAll('#qwk-lesson-words .qwk-lesson-word');
    if (!boxes.length) return applyWordSelection(focus, null);
    return applyWordSelection(focus, [...boxes].filter((input) => input.checked).map((input) => input.value));
}

function selectedCategories() {
    return [...document.querySelectorAll('.quiz-category-checkbox:checked')].map((cb) => cb.value);
}

function renderSourceMode({ preselectedWords = null } = {}) {
    const lessonsReady = hasUsableLessonFocus(lessonFocus);
    if (source === 'lessons' && !lessonsReady) source = 'book';
    const tabs = $('qwk-source');
    if (tabs) tabs.innerHTML = quizSourceTabsHtml(source, { lessonsReady });
    show($('qwk-lesson'), source === 'lessons');
    show($('qwk-book'), source === 'book');
    show($('qwk-topics'), source === 'own');
    if (source === 'book') {
        if (!bookRows.length) {
            const row = freshBookRow();
            if (row) bookRows = [row];
        }
        renderBookRows();
        if (bookFocus) renderFocusCard(bookFocus, preselectedWords);
        else {
            renderFocusCard(null);
            queueBookFocus({ delay: 0 });
        }
    } else if (source === 'lessons') {
        renderFocusCard(lessonFocus, preselectedWords);
    } else {
        renderFocusCard(null);
    }
    const note = $('quiz-keywords');
    if (note) {
        note.placeholder = source === 'own'
            ? 'e.g. keep sentences short, no spelling questions'
            : 'e.g. include was / were, keep the sentences short';
    }
    updateGoSummary();
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
                    <span class="qwk-carry__question">${question.kind === 'listen' && question.listen ? `<i class="fas fa-ear-listen" aria-hidden="true"></i> “${escapeQuizText(question.listen)}”` : escapeQuizText(question.question)}</span>
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
            .catch(quietly('ui/tabs/quizSetup.js'));
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
    const parts = [`About ${count} questions`, QUIZ_TYPES.find((t) => t.id === selectedType())?.label || ''];
    if (source === 'own') {
        const n = selectedCategories().length;
        if (n) parts.push(`${n} topic${n === 1 ? '' : 's'}`);
    } else {
        if (source === 'book') {
            const picks = bookPicks();
            if (picks.length) parts.push(picks.length === 1 ? picks[0].label : `${picks.length} books`);
        }
        const n = selectedLessonWords().length;
        if (n) parts.push(`${n} word${n === 1 ? '' : 's'}`);
    }
    const carried = selectedCarryQuestions().length;
    if (carried) parts.push(`${carried} back from last time`);
    // The formats the AI will write for this league (younger leagues hear and see more).
    const mix = quizKindMix({
        count: Math.max(0, count - carried),
        band: quizAgeBand(utils.getAgeCategoryForLeague(classData.questLevel)),
        type: selectedType()
    });
    const formats = describeKindMix(mix);
    if (formats) parts.push(formats);
    el.textContent = parts.filter(Boolean).join(' · ');
    const words = $('qwk-words-count');
    const focus = activeFocus();
    if (words && focus) words.textContent = `${selectedLessonWords().length} of ${(focus.words || []).length}`;
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
    const saved = c?.lessonFocus || null;
    const lessonsReady = hasUsableLessonFocus(focus);
    // A saved plan reopens as it was made; a new one starts from the lessons, then the class book.
    bookRows = [];
    bookFocus = null;
    bookSavedWords = null;
    let preselected = null;
    if (saved?.source === 'book-pages') {
        source = 'book';
        bookRows = (saved.picks || []).map(rowFromPick).filter(Boolean);
        bookSavedWords = saved.words || null;
    } else if (saved?.source === 'book-atlas' && lessonsReady) {
        source = 'lessons';
        preselected = saved.words || null;
    } else if (c) {
        source = 'own';
    } else {
        source = lessonsReady ? 'lessons' : (classData.bookPlan?.currentBookId ? 'book' : 'own');
    }
    renderTypePicker(c?.type || focus?.type || 'mix');
    const cover = $('quiz-cover');
    // Older described plans kept what to cover in `keywords`.
    if (cover) cover.value = c && !saved ? (c.cover ?? c.keywords ?? '') : (c?.cover || '');
    const note = $('quiz-keywords');
    if (note) note.value = c ? (saved ? (saved.note || '') : (c.cover != null ? (c.note || '') : '')) : '';
    renderCategories(c?.categories || []);
    renderSourceMode({ preselectedWords: preselected });

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
    const categories = source === 'own' ? selectedCategories() : [];
    const note = $('quiz-keywords')?.value?.trim() || '';
    const cover = $('quiz-cover')?.value?.trim() || '';
    const carryForward = selectedCarryQuestions();
    const reviewBeforeLive = Boolean($('quiz-review-toggle')?.checked);
    const manualOverride = source === 'own';
    const focus = activeFocus();
    const selectedWords = selectedLessonWords();
    if (source === 'book' && !focus) {
        const warnEl = $('quiz-validation-msg');
        if (warnEl) warnEl.textContent = bookPicks().length ? 'Still reading those pages. Try again in a moment.' : 'Choose a unit or type the pages the quiz should cover.';
        show(warnEl, true);
        return;
    }
    const curriculum = manualOverride
        ? { type, categories, keywords: cover, cover, note, lessonFocus: null }
        : curriculumFromFocus(focus, { type, note, selectedWords });

    const warn = $('quiz-validation-msg');
    if (!canGenerateQuiz({ focus, selectedWords, categories, keywords: note, cover, carryCount: carryForward.length, manualOverride })) {
        if (warn) {
            warn.textContent = manualOverride
                ? 'Write what the quiz should cover, or tap at least one topic.'
                : 'Keep at least one word or write a note so the quiz has something to ask about.';
        }
        show(warn, true);
        if (manualOverride) $('quiz-cover')?.focus();
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
            cover: manualOverride ? curriculum.cover : null,
            note: manualOverride ? curriculum.note : '',
            lessonFocus: curriculum.lessonFocus,
            questLevel: classData.questLevel || 'A',
            reviewBeforeLive,
            carryForward
        });
        result = await generateQuizQuestions(classId, { onProgress: showGenProgress });
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

const GEN_STEP_LABELS = { 1: 'Writing questions', 2: 'Drawing pictures', 3: 'Saving to the class' };

/** Live progress while the quiz is made: which part is being written, how many pictures are drawn. */
function showGenProgress({ stage, done = 0, total = 0 } = {}) {
    const step = stage === 'pictures' ? 2 : stage === 'saving' ? 3 : 1;
    setGenStep(step);
    const el = document.querySelector(`#qwk-gen [data-gen-step="${step}"]`);
    if (!el) return;
    if (stage === 'writing' && total > 1) el.textContent = `Writing questions (${Math.min(done, total)} of ${total} parts done)`;
    else if (stage === 'pictures' && total) el.textContent = `Drawing pictures ${done} of ${total}`;
}

function setGenStep(n) {
    if (n === 1) {
        document.querySelectorAll('#qwk-gen [data-gen-step]').forEach((el) => { el.textContent = GEN_STEP_LABELS[el.dataset.genStep] || el.textContent; });
    }
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
    $('qwk-source')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.qwk-source__tab');
        if (!tab || tab.disabled || tab.dataset.source === source) return;
        source = tab.dataset.source;
        show($('quiz-validation-msg'), false);
        renderSourceMode();
        if (source === 'own') $('quiz-cover')?.focus();
    });
    $('qwk-source')?.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const tabs = [...$('qwk-source').querySelectorAll('.qwk-source__tab:not([disabled])')];
        const i = tabs.findIndex((t) => t.dataset.source === source);
        const next = tabs[(i + (e.key === 'ArrowLeft' ? tabs.length - 1 : 1)) % tabs.length];
        e.preventDefault();
        next?.click();
        $('qwk-source')?.querySelector(`[data-source="${source}"]`)?.focus();
    });
    $('qwk-book-rows')?.addEventListener('change', onBookRowChange);
    $('qwk-book-rows')?.addEventListener('input', (e) => { if (e.target.matches('[data-field="pageText"]')) onBookRowChange(e); });
    $('qwk-book-rows')?.addEventListener('click', (e) => {
        const remove = e.target.closest('[data-remove-row]');
        if (!remove) return;
        bookRows.splice(Number(remove.dataset.removeRow), 1);
        renderBookRows();
        queueBookFocus({ delay: 0 });
    });
    $('qwk-book-add')?.addEventListener('click', () => {
        if (bookRows.length >= QUIZ_BOOK_PICK_CAP) return;
        // A second book is most often the class's grammar book.
        const used = new Set(bookRows.map((row) => row.bookId));
        const next = quizBookOptions(classBookContext()).find((o) => o.suggested && !used.has(o.id))
            || quizBookOptions(classBookContext()).find((o) => !used.has(o.id));
        bookRows.push(rowFromPick({ bookId: next?.id || BOOK_ATLAS[0].id }) || freshBookRow());
        renderBookRows();
        $('qwk-book-rows')?.querySelector(`[data-row="${bookRows.length - 1}"] [data-field="unit"]`)?.focus();
    });
    $('quiz-cover')?.addEventListener('input', () => show($('quiz-validation-msg'), false));

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
