// Daily Wisdom quote: pure helpers shared by the Home header and tests.
// Each calendar day gets its own "recipe" (theme + voice + image), so the AI is
// asked a genuinely different question every day instead of the same prompt.

export const DAILY_QUOTE_THEMES = [
    'kindness', 'courage', 'teamwork', 'mistakes as teachers', 'patience',
    'the joy of reading', 'listening well', 'curiosity', 'gratitude', 'not giving up',
    'imagination', 'honesty', 'asking questions', 'practice', 'friendship',
    'focus', 'fresh starts', 'helping others', 'bouncing back', 'wonder at nature',
    'small steps', 'laughter and joy', 'respect', 'trying something new', 'staying calm',
    'creativity', 'responsibility', 'fairness', 'learning new words', 'dreaming big',
    'sharing', 'hope', 'being yourself', 'hard work', 'encouraging a classmate',
    'noticing little things', 'good habits', 'being brave enough to be wrong', 'kind words', 'finishing what you start',
    'learning together', 'a good question', 'saying thank you', 'slow and steady progress', 'looking after the world'
];

export const DAILY_QUOTE_VOICES = [
    'an old lighthouse keeper',
    'a wise tree in an ancient forest',
    'a cheerful ship captain',
    'a patient mountain guide',
    'a starlit night sky',
    'a village baker at dawn',
    'a travelling storyteller',
    'a friendly dragon who loves books',
    'a gardener in spring',
    'a map-maker explorer',
    'a clever owl',
    'the sea on a calm morning',
    'a kite-maker'
];

export const DAILY_QUOTE_IMAGES = [
    'a lantern', 'an acorn', 'a compass', 'a kite', 'a bridge', 'a seed', 'a river',
    'a candle', 'a key', 'a snail', 'a rainbow', 'a map', 'a boat', 'a mountain path',
    'a star', 'a feather', 'a garden', 'a bell', 'a sunrise', 'a honeybee', 'a pencil',
    'a paper plane', 'a footprint', 'a window', 'a treasure chest', 'a spark', 'a bird\'s nest'
];

// Original lines, used when AI is not on the plan or is unavailable. They rotate
// by day, so even without AI the header shows a new quote every day.
export const CURATED_DAILY_QUOTES = [
    'Small steps every day build the tallest towers.',
    'A mistake is just a lesson wearing a funny hat.',
    'Kind words are seeds; watch what grows from them.',
    'Every question you ask opens a new door.',
    'Brave hearts try, even when the path is foggy.',
    'The best teams lift each other higher.',
    'Read a page, and a whole world opens.',
    'Patience turns tiny acorns into mighty oaks.',
    'Curious minds never run out of adventures.',
    'Today is a blank map. Draw something wonderful.',
    'Listening is a superpower hiding in plain sight.',
    'Stars shine brightest when the night is darkest.',
    'Practice quietly; one day it will sing loudly.',
    'A friend who helps you learn is treasure.',
    'Fall seven times, stand up eight, smile nine.',
    'Your imagination is a key to every lock.',
    'Honesty is the lantern that never goes out.',
    'Share your light; it will not grow dimmer.',
    'Slow rivers still reach the sea.',
    'The bravest word in class is often "why?"',
    'Try something new; your future self will thank you.',
    'Great ideas start as small, shy sparks.',
    'A grateful heart finds sunshine on cloudy days.',
    'Calm minds find the clearest answers.',
    'Every expert was once a curious beginner.',
    'Help one person today, and the world grows kinder.',
    'Good habits are quiet heroes.',
    'A new word learned is a new world visited.',
    'Finish the page, then turn to the next adventure.',
    'Be the reason someone smiles in class today.',
    'Mountains are climbed one careful step at a time.',
    'Wonder is the compass of every explorer.',
    'You grow the most when things feel hard.',
    'Respect is a bridge everyone can cross.',
    'Dream big, then take one small step.',
    'A focused minute beats a distracted hour.',
    'Laughter makes learning light as a feather.',
    'Your own voice is the one this class needs.',
    'Every sunrise is a fresh chance to shine.',
    'Teamwork turns heavy loads into light work.',
    'Kindness is the one language everyone understands.',
    'Ask, wonder, explore, repeat.',
    'The garden of the mind needs daily watering.',
    'Being wrong bravely is how we get it right.',
    'Little by little, a bird builds its nest.',
    'Your effort today is tomorrow\'s treasure.',
    'Notice the small things; they hold big wonders.',
    'Fair play makes every game worth playing.',
    'A thank-you costs nothing and gives a lot.',
    'Keep going; the view is better up ahead.',
    'Stories are ships that sail us anywhere.',
    'Hope is a kite that rises against the wind.',
    'Hard work plants seeds; patience brings the harvest.',
    'Cheer for a classmate, and two hearts grow.',
    'Look after the world; it looks after us.',
    'Every page you read makes your wings stronger.',
    'Mistakes are footprints on the way to success.',
    'Curiosity lights the lantern; courage carries it.',
    'Today, be a little braver than yesterday.',
    'Learning together makes the journey twice the fun.'
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since 1970-01-01 for a YYYY-MM-DD key (timezone-free). */
export function dayNumberFromKey(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
    if (!match) return 0;
    return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
}

function pickByDay(list, day, stride, offset = 0) {
    const n = list.length;
    return list[(((day * stride + offset) % n) + n) % n];
}

/**
 * The day's prompt ingredients. Strides are coprime with the list lengths, so
 * consecutive days land far apart in each list and a full cycle visits every
 * entry before repeating.
 */
export function getDailyQuoteRecipe(dateKey) {
    const day = dayNumberFromKey(dateKey);
    return {
        theme: pickByDay(DAILY_QUOTE_THEMES, day, 7, 3),
        voice: pickByDay(DAILY_QUOTE_VOICES, day, 5, 1),
        image: pickByDay(DAILY_QUOTE_IMAGES, day, 11, 4)
    };
}

export function getCuratedDailyQuote(dateKey) {
    return pickByDay(CURATED_DAILY_QUOTES, dayNumberFromKey(dateKey), 13, 0);
}

export function isCuratedDailyQuote(text) {
    const needle = normalizeQuoteWords(text).join(' ');
    return CURATED_DAILY_QUOTES.some((quote) => normalizeQuoteWords(quote).join(' ') === needle);
}

export function normalizeQuoteWords(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'are', 'and', 'of', 'to', 'in', 'on', 'it', 'its', 'your', 'you', 'every', 'each', 'with', 'for', 'be', 'one']);

/** True when a candidate mostly repeats one of the recent quotes. */
export function isTooSimilarQuote(candidate, recentQuotes = [], threshold = 0.55) {
    const words = new Set(normalizeQuoteWords(candidate).filter((w) => !STOP_WORDS.has(w)));
    if (words.size === 0) return true;
    return recentQuotes.some((recent) => {
        const other = new Set(normalizeQuoteWords(recent).filter((w) => !STOP_WORDS.has(w)));
        if (other.size === 0) return false;
        let shared = 0;
        words.forEach((w) => { if (other.has(w)) shared += 1; });
        return shared / Math.min(words.size, other.size) >= threshold;
    });
}

/** Strips wrapping quotes, labels, markdown and attributions from model output. */
export function cleanGeneratedQuote(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';
    text = text.split(/\n+/).map((line) => line.trim()).find(Boolean) || '';
    text = text
        .replace(/[*_`#]/g, '')
        .replace(/^\s*(?:quote|daily wisdom|wisdom)\s*[:\-–]\s*/i, '')
        .replace(/\s+[—–-]\s*[A-Z][\w .']{0,40}$/, '')
        .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text;
}

export function isUsableQuote(text) {
    const words = normalizeQuoteWords(text);
    return words.length >= 3 && words.length <= 16 && String(text).length <= 110;
}

export const DAILY_QUOTE_SYSTEM_PROMPT = [
    'You are a wise sage for a classroom of young English learners.',
    'Write one short, inspiring quote of 6 to 12 words in simple, vivid English.',
    'It must be original: never quote famous people or well-known sayings, and avoid cliches like',
    '"journey of a thousand miles", "every great journey begins", "believe in yourself" or "reach for the stars".',
    'No markdown, no quotation marks, no author. Reply with the quote only.'
].join(' ');

export function buildDailyQuoteUserPrompt(dateKey, recentQuotes = []) {
    const { theme, voice, image } = getDailyQuoteRecipe(dateKey);
    const lines = [
        `Today (${dateKey}) the theme is ${theme}.`,
        `Speak as ${voice}, and build the line around the image of ${image}.`
    ];
    const avoid = recentQuotes.filter(Boolean).slice(0, 8);
    if (avoid.length) {
        lines.push(`Recent quotes were: ${avoid.map((q) => `"${q}"`).join('; ')}. Use different words and a different idea.`);
    }
    return lines.join(' ');
}
