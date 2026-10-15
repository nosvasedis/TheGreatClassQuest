/**
 * Curated corrections to the Book Atlas, checked against the publishers' own contents pages
 * (October 2026). Used by build-book-atlas.mjs and, for the already-generated data, by
 * apply-book-atlas-corrections.mjs. Every change here is idempotent.
 *
 * Sources:
 * - Yeti and Friends! Primary 2 (Junior B), Hamilton House: Pupil's Book, Activity Book and
 *   Language Booster contents pages (pubhtml5.com/ulgj/clyz, /jrol, /uyyj).
 * - English with Bamboo 1 (Junior A), Hamilton House: Teacher's Book contents (it reprints the
 *   Pupil's Book contents) and Activity Book contents (pubhtml5.com/ulgj/rblg, /kaiw).
 * - New Close-Up B1 3e, National Geographic Learning: scope and sequence PDF.
 * - Cambridge Primary Path: every unit is 22 Student's Book pages from p6 and 10 Activity Book pages.
 */

const two = start => [start, start + 1];

// [title, vocabulary topic, grammar] per lesson, then the first printed page of the lesson in each part.
const YETI_LESSONS = [
    ['Grandpa George', 'family', 'to be: present simple affirmative and negative'],
    ['Is Yeti young?', 'adjectives', 'to be: present simple questions and short answers'],
    ['The snowman', 'clothes', "have/has; What's this/that? What are these/those?"],
    ['Favourite things', 'possessions', "possessive adjectives; Whose ...?; possessive 's"],
    ['Weather', 'weather', 'adjectives'],
    ["We're laughing!", 'verbs', 'present continuous: affirmative and negative'],
    ['Go-karts', 'races', 'present continuous: questions and short answers'],
    ["Let's dress up!", 'costumes', "imperative; Let's"],
    ['I can sail.', 'free time', "can, can't, Can ...?"],
    ['Music', 'musical instruments', 'object pronouns'],
    ["Yeti's town", 'places in town', "there is/are, there isn't/aren't; some, any, lots of"],
    ["You mustn't shout!", 'verbs', "must/mustn't"],
    ["Tina's day", 'daily routines', 'present simple: affirmative; adverbs of frequency'],
    ["We don't have any sandwiches.", 'daily routines', 'present simple: negative'],
    ["Kids' TV!", 'time', 'present simple: questions and short answers'],
    ['Chef school', 'food', 'countable and uncountable nouns; regular plurals -es, -ies'],
    ['Yeti goes to a party.', 'food', 'Is there ...? Are there ...?; How much? How many?'],
    ['The animal race', 'animals', 'comparatives'],
    ['The smallest animal', 'animals', 'superlatives'],
    ["Alice's homework", 'face and body', 'irregular plurals'],
    ['Hide and seek', 'numbers 20-100', 'to be: past simple affirmative'],
    ['The quiz', 'ordinal numbers', 'to be: past simple negative'],
    ['The rollercoaster', 'months', 'to be: past simple questions and short answers'],
    ["Yeti's holidays", 'seasons and nature', "there was/wasn't, there were/weren't"],
    ['Dinosaurs', 'nature', 'past simple: affirmative and negative, regular verbs'],
    ['A day at the beach', 'verbs', 'past simple: affirmative and negative, irregular verbs'],
    ["Tony's photos", 'free time', 'past simple: questions, regular and irregular verbs'],
    ["I'm going to fly a helicopter!", 'transport', 'be going to: affirmative and negative'],
    ['What are you going to be?', 'jobs', 'be going to: questions and short answers'],
    ['When I grow up', 'jobs', 'future simple (will): affirmative, negative and questions']
];
const YETI_PB = [8, 10, 12, 14, 16, 24, 26, 28, 30, 32, 40, 42, 44, 46, 48, 56, 58, 60, 62, 64, 72, 74, 76, 78, 80, 88, 90, 92, 94, 96];
const YETI_AB = [6, 8, 10, 12, 14, 18, 20, 22, 24, 26, 30, 32, 34, 36, 38, 42, 44, 46, 48, 50, 54, 56, 58, 60, 62, 66, 68, 70, 72, 74];
// Language Booster: four pages a lesson, a one-page review after every fifth lesson (not part of a lesson).
const YETI_LB = [8, 12, 16, 20, 24, 29, 33, 37, 41, 45, 50, 54, 58, 62, 66, 71, 75, 79, 83, 87, 92, 96, 100, 104, 108, 113, 117, 121, 125, 129];
const YETI_LB_END = 133;

const BAMBOO_LESSONS = [
    ["I'm Bamboo.", "What's this? It's a/an ..."], ['The red apple', 'a/an, the'], ['Toys', 'regular plurals'],
    ["Max's bag", 'this / that'], ["Maria's garden", 'these / those'],
    ['Mum is happy.', 'to be (affirmative): I, you, he, she, it'], ["Miranda's family", 'to be (affirmative): we, you, they'],
    ['Funny aliens', 'to be (negative)'], ['Is it a hat?', 'to be (questions): I, you, he, she, it'], ['Wild animals', 'to be (questions): we, you, they'],
    ['Bamboo has got an idea.', 'have got (affirmative)'], ['Who am I?', 'have got (negative)'], ["Mum's birthday", 'have got (questions)'],
    ['Big feet and teeth', 'plurals -es, -ies; irregular plurals'], ['There is a panda.', 'there is, there are'],
    ["I'm reading.", 'present continuous (affirmative): I, you, he, she, it'], ["We're flying.", 'present continuous (affirmative): we, you, they'],
    ['Panda school', 'present continuous (negative)'], ['Snow!', 'present continuous (questions)'], ['Jigsaws', "Where's ...?; prepositions of place"],
    ["Mum's pyjamas", 'possessives: my, your, his, her, its'], ["Let's watch TV!", 'possessives: our, your, their'], ['Sports', "can, can't"],
    ['Can Max dance?', 'Can ...?'], ["Let's draw a cat.", "Let's; imperative"],
    ['I like flowers.', 'present simple (affirmative): I, you, we, they'], ['Well done, Miranda!', 'present simple (affirmative): he, she, it'],
    ['Clive the crab', 'present simple (negative)'], ["Bamboo's farm", 'present simple (questions): I, you, we, they'],
    ['Favourite snacks', 'present simple (questions): he, she, it']
];
const BAMBOO_PB = [6, 8, 10, 12, 14, 20, 22, 24, 26, 28, 34, 36, 38, 40, 42, 48, 50, 52, 54, 56, 62, 64, 66, 68, 70, 76, 78, 80, 82, 84];
const BAMBOO_AB = [6, 8, 10, 12, 14, 18, 20, 22, 24, 26, 30, 32, 34, 36, 38, 42, 44, 46, 48, 50, 54, 56, 58, 60, 62, 66, 68, 70, 72, 74];

/** Lesson titles, topics, grammar (Yeti) and page maps for the two Hamilton House junior books. */
export function juniorUnits(bookId) {
    if (bookId === 'yeti-2') return YETI_LESSONS.map(([title, theme, grammar], i) => ({
        n: i + 1, title, theme, grammar,
        pages: { sb: two(YETI_PB[i]), wb: two(YETI_AB[i]), companion: [YETI_LB[i], (YETI_LB[i + 1] || YETI_LB_END + 1) - 1 - ((i + 1) % 5 === 0 && i < 29 ? 1 : 0)] }
    }));
    // Bamboo keeps its fuller OCR grammar notes (they agree with the contents); only titles and pages change.
    if (bookId === 'bamboo') return BAMBOO_LESSONS.map(([title], i) => ({
        n: i + 1, title, theme: title, pages: { sb: two(BAMBOO_PB[i]), wb: two(BAMBOO_AB[i]) }
    }));
    return null;
}

/**
 * The Language Booster's new words are printed lesson by lesson. The school's list grouped them by topic and
 * numbered the groups 1-23, so group N is not lesson N. Rebuild it per lesson: the lesson's own Pupil's Book
 * words that the Language Booster teaches. A lesson whose words are not in it gets no companion list
 * (getUnitWords then reads the lesson's Pupil's Book words).
 */
export function companionByLesson(units, companion) {
    const taught = new Set(Object.values(companion || {}).flat().map(w => String(w.w).toLowerCase()));
    if (!taught.size) return companion || {};
    const out = {};
    for (const [lesson, words] of Object.entries(units)) {
        const own = words.filter(w => taught.has(String(w.w).toLowerCase())).map(w => ({ w: w.w, pos: w.pos || '', component: 'companion' }));
        if (own.length) out[lesson] = own;
    }
    return out;
}

/** Cambridge Primary Path: 22 Student's Book pages a unit from p6, 10 Activity Book pages a unit. */
export function cppUnitPages(index, firstWbPage) {
    const sb = [6 + index * 22, 27 + index * 22];
    const wb = index === 0 ? [firstWbPage || 3, 12] : [3 + index * 10, 12 + index * 10];
    return { sb, wb };
}

// Greek capitals the school's spreadsheet sometimes typed for Latin lesson codes ("1Β").
const GREEK_LATIN = { Α: 'A', Β: 'B', Ε: 'E' };

/** Word-level fixes to the school's Primary Path wordlists (wrong unit, impossible page, Greek letter codes). */
export function correctCppWords(level, units) {
    for (const words of Object.values(units)) for (const w of words) {
        if (w.location) w.location = w.location.replace(/[ΑΒΕ]/g, c => GREEK_LATIN[c]);
    }
    if (level === 1 && units['4']) {
        // "petal" is lesson 3B (living things, p.69) but was filed under unit 4.
        const moved = units['4'].filter(w => w.w === 'petal' && w.location === '3B');
        if (moved.length) {
            units['4'] = units['4'].filter(w => !moved.includes(w));
            units['3'] = [...(units['3'] || []).filter(w => w.w !== 'petal'), ...moved];
        }
    }
    if (level === 2) for (const w of units['7'] || []) {
        // An Activity Book page 159 does not exist (unit 7 is pp. 63-72); keep the word, drop the page.
        if (w.component === 'wb' && w.page > 100) w.page = null;
    }
    return units;
}

/** Close-Up B1 grammar, word for word from the publisher's scope (unit 12 has no so/such). */
export const CLOSE_UP_B1_GRAMMAR_12 = 'adjectives; adverbs; comparison of adjectives and adverbs';
