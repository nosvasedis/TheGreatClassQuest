// features/parent/i18n.js — the Family Portal speaks English or Greek, chosen per device
const STORE_KEY = 'gcq_family_lang_v1';
const LANGS = ['en', 'el'];

let current = null;

function detect() {
    try {
        const saved = localStorage.getItem(STORE_KEY);
        if (LANGS.includes(saved)) return saved;
    } catch {
        /* storage may be blocked; fall back to the phone's language */
    }
    const prefs = [...(navigator.languages || []), navigator.language].filter(Boolean);
    return prefs.some((code) => /^el\b/i.test(code)) ? 'el' : 'en';
}

export function getLang() {
    if (!current) current = detect();
    return current;
}

export function isGreek() {
    return getLang() === 'el';
}

export function setLang(lang) {
    current = LANGS.includes(lang) ? lang : 'en';
    try {
        localStorage.setItem(STORE_KEY, current);
    } catch {
        /* remembered for this visit only */
    }
    return current;
}

/** The same words in the chosen language: tr('Homework', 'Εργασίες'). */
export function tr(en, el) {
    return isGreek() ? el : en;
}

/** "1 star" / "3 stars" in either language. Forms: [en one, en many, el one, el many]. */
export function countWord(n, [enOne, enMany, elOne, elMany], format = String) {
    const one = Number(n) === 1;
    return `${format(n)} ${isGreek() ? (one ? elOne : elMany) : (one ? enOne : enMany)}`;
}

export const STAR_WORDS = ['star', 'stars', 'αστέρι', 'αστέρια'];
export const DAY_WORDS = ['day', 'days', 'ημέρα', 'ημέρες'];
export const LESSON_WORDS = ['lesson', 'lessons', 'μάθημα', 'μαθήματα'];
