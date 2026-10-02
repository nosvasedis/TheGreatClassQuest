// /features/adventurePageCore.mjs — pure rules for the crown-first Adventure Log.
// Crowning Hero of the Day saves the diary page straight away as a blank page
// (`pageStatus: 'awaiting'`) that keeps the crown; the teacher then fills it with
// Auto (the AI Chronicler) or Manual (written by hand), now or later.
// No DOM, no Firestore: shared by db/actions/quests.js, ui/tabs/log.js,
// ui/modals/diaryChooser.js and features/adventurePageWriter.js.

export const PAGE_AWAITING = 'awaiting';
export const PAGE_WRITTEN = 'written';

const GROWTH_LEAGUES = new Set(['Nursery', 'Pre-Junior']);

/** A crowned page that has no story yet. Pages saved before this flow have no pageStatus and count as written. */
export function isAwaitingAdventurePage(log) {
    return String(log?.pageStatus || '').toLowerCase() === PAGE_AWAITING;
}

export function heroDisplayName(heroName) {
    return String(heroName || '').trim() || 'The Class Team';
}

export function heroFirstName(heroName) {
    const name = heroDisplayName(heroName);
    return name === 'The Class Team' ? name : name.split(/\s+/)[0];
}

/** Title / text / highlights stored on the blank page while it waits (other screens may show them). */
export function buildAwaitingPagePayload({ heroName } = {}) {
    const hero = heroDisplayName(heroName);
    return {
        title: 'A page waiting for its story',
        text: `Hero of the Day: ${hero}. Today's story has not been written yet.`,
        highlights: [],
        keywords: ['hero_of_the_day']
    };
}

/**
 * The Adventure Log's main button: Crown Today's Hero → Write Today's Page → Open Today's Page.
 * @param {{ classId?: string, hasStarsToday?: boolean, todayLog?: object|null, canWrite?: boolean }} input
 */
export function getCrownControlState({ classId = '', hasStarsToday = false, todayLog = null, canWrite = true } = {}) {
    const crown = { label: "Crown Today's Hero", icon: 'fa-crown' };
    if (!classId) {
        return { mode: 'no-class', ...crown, disabled: true, hint: 'Choose a class in the header to open its diary.' };
    }
    if (todayLog && isAwaitingAdventurePage(todayLog)) {
        const hero = heroDisplayName(todayLog.hero);
        return {
            mode: 'write',
            label: "Write Today's Page",
            icon: 'fa-feather-alt',
            disabled: !canWrite,
            hint: `${hero} wears today's crown. Today's page is still blank.`
        };
    }
    if (todayLog) {
        return {
            mode: 'written',
            label: "Open Today's Page",
            icon: 'fa-book-open',
            disabled: false,
            hint: `Today's page is written. Hero of the Day: ${heroDisplayName(todayLog.hero)}.`
        };
    }
    if (!hasStarsToday) {
        return { mode: 'needs-stars', ...crown, disabled: true, hint: "Award some stars first, then crown today's Hero." };
    }
    return {
        mode: 'crown',
        ...crown,
        disabled: false,
        hint: 'Ready! The crown goes to one of the heroes present; then you choose how to write the page.'
    };
}

/** Same line handling as the existing diary: the page always names its Hero of the Day once. */
export function syncHeroLine(text, heroName) {
    const storyText = String(text || '').trim();
    const heroLine = `Hero of the Day: ${heroDisplayName(heroName)}.`;
    const heroLinePattern = /(^|\n{1,2})Hero of the Day:\s*[^\n]+/im;
    if (!storyText) return heroLine;
    if (heroLinePattern.test(storyText)) {
        return storyText.replace(heroLinePattern, (match, prefix = '') => `${prefix}${heroLine}`);
    }
    return `${storyText}\n\n${heroLine}`;
}

export function buildPageKeywords(text) {
    return String(text || '')
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\p{L}\p{N}_-]/gu, ''))
        .filter(word => word.length > 3)
        .slice(0, 6);
}

export function splitHighlights(value) {
    return String(value || '').split(',').map(part => part.trim()).filter(Boolean).slice(0, 4);
}

const VIRTUE_TITLES = {
    teamwork: 'Stronger Together',
    creativity: 'Sparks of Imagination',
    respect: 'Kindness Wins the Day',
    focus: 'Eyes on the Quest'
};

/** The four virtues awarded in a lesson, most-awarded first, as display labels ("Teamwork"). */
export function rankVirtueReasons(awards = []) {
    const counts = new Map();
    for (const award of awards || []) {
        const key = String(award?.reason || '').toLowerCase();
        if (!VIRTUE_TITLES[key]) continue;
        counts.set(key, (counts.get(key) || 0) + (Number(award?.stars) || 1));
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));
}

/** Up to three title ideas for the Manual page, led by today's strongest virtues. */
export function suggestPageTitles(reasons = []) {
    const ideas = [];
    for (const reason of reasons) {
        const key = String(reason || '').toLowerCase().replace(/[\s-]+/g, '_');
        if (VIRTUE_TITLES[key] && !ideas.includes(VIRTUE_TITLES[key])) ideas.push(VIRTUE_TITLES[key]);
    }
    for (const fallback of ['A Day to Remember', 'Our Quest Continues', 'Small Steps, Big Adventure']) {
        if (!ideas.includes(fallback)) ideas.push(fallback);
    }
    return ideas.slice(0, 3);
}

/** Sentence starters for the Manual page. They only start a line; the teacher finishes it. */
export function getStoryStarters({ heroName = '', words = [] } = {}) {
    const hero = heroFirstName(heroName);
    const starters = ['Today our quest began with', 'The bravest moment was when'];
    starters.push(hero === 'The Class Team' ? 'Everyone shared the crown today because' : `${hero} wore the crown today because`);
    if ((words || []).length) starters.push('We learned new words like');
    starters.push('We laughed when', 'Next time, we will');
    return starters;
}

/** Adds a starter on a fresh line (or after the text) and returns the new text. */
export function insertStoryStarter(text, starter) {
    const current = String(text || '').replace(/\s+$/, '');
    const line = `${String(starter || '').trim()} `;
    if (!current) return line;
    return `${current}\n${line}`;
}

/** Lets a picture be painted only once there is something to paint from. */
export function hasEnoughStoryForPicture({ title = '', text = '' } = {}) {
    return `${title} ${text}`.replace(/\s+/g, ' ').trim().length >= 24;
}

/**
 * The chooser that follows Huzzah!: who is crowned, what today holds, which paths are open.
 * Growth Festival leagues never show star numbers.
 */
export function buildDiaryChooserModel({
    heroName = '',
    heroAvatar = '',
    className = '',
    dateLabel = '',
    league = '',
    totalStars = 0,
    reasons = [],
    learned = null,
    canAuto = false,
    isToday = true
} = {}) {
    const hero = heroDisplayName(heroName);
    const ink = [];
    const stars = Number(totalStars) || 0;
    if (stars > 0 && !GROWTH_LEAGUES.has(league)) {
        ink.push({ icon: 'fa-star', label: `${stars} ${stars === 1 ? 'star' : 'stars'} earned` });
    }
    const virtues = [...new Set((reasons || []).map(r => String(r || '').trim()).filter(Boolean))].slice(0, 3);
    if (virtues.length) ink.push({ icon: 'fa-heart', label: virtues.join(' · ') });
    const words = Array.isArray(learned?.words) ? learned.words.length : 0;
    if (words) ink.push({ icon: 'fa-spell-check', label: `${words} new ${words === 1 ? 'word' : 'words'}` });
    const moments = Array.isArray(learned?.items) ? learned.items.length : 0;
    if (moments) ink.push({ icon: 'fa-graduation-cap', label: `${moments} learning ${moments === 1 ? 'moment' : 'moments'}` });
    return {
        hero,
        heroFirst: heroFirstName(hero),
        heroAvatar: String(heroAvatar || ''),
        heroInitial: hero === 'The Class Team' ? '' : hero.charAt(0).toUpperCase(),
        className: String(className || '').trim() || 'Your class',
        dateLabel: String(dateLabel || ''),
        heading: isToday ? "Shall we write today's page?" : 'Shall we write this page?',
        ink,
        canAuto: Boolean(canAuto)
    };
}
