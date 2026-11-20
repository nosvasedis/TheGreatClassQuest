// utils/familyLang.js — the language families see, shared by the sign-in gate, the
// "keep this device fast" prompt, the loading screen and the Family Portal itself.
//
// Until a family chooses, the portal follows the phone's language: Greek on a Greek phone,
// English otherwise. They can pick Greek, English, or "both" (Greek with a small English line
// under headings and buttons); the choice is kept on the device.
// Kept tiny on purpose: the sign-in screen loads it at startup.

export const FAMILY_LANG_KEY = 'gcq_family_lang_v1';
export const FAMILY_LANGS = ['el', 'bi', 'en'];
const CHANGE_EVENT = 'gcq:family-lang';

let current = null;

/** 'el' when the phone or browser is set to Greek, else 'en'. */
export function deviceFamilyLang() {
    try {
        const langs = [...(navigator.languages || []), navigator.language || ''];
        return langs.some((tag) => /^el\b/i.test(String(tag))) ? 'el' : 'en';
    } catch {
        return 'el';
    }
}

/** The saved choice, or null when the family has not chosen. */
export function savedFamilyLang() {
    try {
        const saved = window.localStorage.getItem(FAMILY_LANG_KEY);
        if (FAMILY_LANGS.includes(saved)) return saved;
    } catch {
        /* storage blocked: the phone's language for this visit */
    }
    return null;
}

function read() {
    return savedFamilyLang() || deviceFamilyLang();
}

/** 'el' (Greek), 'bi' (Greek + small English) or 'en'. */
export function getFamilyLang() {
    if (!current) current = typeof window === 'undefined' ? 'el' : read();
    return current;
}

/** True when the language came from a family's own choice (not the phone's setting). */
export function familyLangChosen() {
    return savedFamilyLang() !== null;
}

/** True when the main words should be Greek ('el' and 'bi'). */
export function familySpeaksGreek() {
    return getFamilyLang() !== 'en';
}

export function setFamilyLang(lang) {
    current = FAMILY_LANGS.includes(lang) ? lang : 'el';
    try {
        window.localStorage.setItem(FAMILY_LANG_KEY, current);
    } catch {
        /* remembered for this visit only */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: current }));
    } catch {
        /* no listeners */
    }
    return current;
}

export function onFamilyLangChange(handler) {
    window.addEventListener(CHANGE_EVENT, (event) => handler(event.detail));
}

/** Plain words in the family's language (safe for text, titles and aria labels). */
export function familyWord(en, el) {
    return familySpeaksGreek() ? el : en;
}

/**
 * Words for headings and buttons (HTML only): in "both" mode the English sits
 * underneath, small, so a parent can match it to what the child says in class.
 */
export function familyLabel(en, el) {
    const lang = getFamilyLang();
    if (lang === 'en') return en;
    if (lang === 'bi' && en && en !== el) return `${el}<span class="fl-bi" lang="en">${en}</span>`;
    return el;
}
