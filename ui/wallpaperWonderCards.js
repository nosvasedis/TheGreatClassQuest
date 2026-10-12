// /ui/wallpaperWonderCards.js — Projector Mode (The Director): cards drawn from the Wonder Library
// (features/wonderLibrary), the checked, league-matched bank of facts, words, puzzles, myths,
// books and the real "on this day" calendar. The library loads only when one of these cards is
// first shown. Every plan gets these cards; on Elite, the daily AI cards still come first and the
// library fills in whenever the AI has nothing for today.

export const WONDER_CARD_TYPES = Object.freeze([
    'world_record', 'this_day_history', 'on_this_day_science', 'word_of_the_day', 'fun_english_phrase',
    'mythology_moment', 'book_recommendation', 'emoji_riddle', 'study_tip', 'thought_experiment',
    'historical_figure_spotlight', 'creative_prompt', 'eco_hero_tip', 'healthy_habit', 'language_origin',
    'science_demo'
]);

/** The AI cards, and the library shelf each one falls back on. */
export const WONDER_FOR_AI_CARD = Object.freeze({
    ai_fact_science: 'fact_science',
    ai_fact_history: 'fact_history',
    ai_fact_nature: 'fact_nature',
    ai_fact_geography: 'fact_geography',
    ai_fact_math: 'fact_math',
    ai_did_you_know: 'did_you_know',
    ai_joke: 'joke',
    ai_riddle: 'riddle',
    ai_brain_teaser: 'brain_teaser',
    ai_word: 'word',
    ai_idiom: 'idiom',
    ai_tongue_twister: 'tongue_twister'
});

const KIND_FOR_CARD = {
    world_record: 'world_record',
    word_of_the_day: 'word',
    fun_english_phrase: 'idiom',
    mythology_moment: 'myth',
    book_recommendation: 'book',
    emoji_riddle: 'emoji_riddle',
    study_tip: 'study_tip',
    thought_experiment: 'thought_experiment',
    historical_figure_spotlight: 'figure',
    creative_prompt: 'creative_prompt',
    eco_hero_tip: 'eco_tip',
    healthy_habit: 'healthy_habit',
    language_origin: 'language_origin',
    science_demo: 'science_demo',
    ...WONDER_FOR_AI_CARD
};

const RECENT_MAX = 40;
let libraryPromise = null;
const loadLibrary = () => (libraryPromise ||= import('../features/wonderLibrary/index.mjs'));

function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function readRecent(kind) {
    try { return JSON.parse(localStorage.getItem(`gcq_wonder_recent_${kind}`) || '[]'); } catch (_) { return []; }
}
function remember(kind, id) {
    try {
        const list = [id, ...readRecent(kind).filter((x) => x !== id)].slice(0, RECENT_MAX);
        localStorage.setItem(`gcq_wonder_recent_${kind}`, JSON.stringify(list));
    } catch (_) { /* private mode: repeats are fine */ }
}

const answerBlock = (answer, tone = 'white') => `
    <div class="wallpaper-card-answer-blur mt-5 pt-4 border-t ${tone === 'white' ? 'border-white/30' : `border-${tone}-200`}">
        <div class="text-xs font-bold ${tone === 'white' ? 'text-white/70' : `text-${tone}-400`} uppercase tracking-widest mb-1">Answer</div>
        <div class="text-2xl font-bold ${tone === 'white' ? 'text-white drop-shadow-md' : `text-${tone}-700`}">${esc(answer)}</div>
    </div>`;

const FACT_LOOK = {
    fact_science: ['Science Wonder', '🧪', 'float-card-blue', 'blue'],
    fact_history: ['History Wonder', '📜', 'float-card-orange', 'orange'],
    fact_nature: ['Nature Wonder', '🌿', 'float-card-green', 'green'],
    fact_geography: ['Around the World', '🌍', 'float-card-cyan', 'cyan'],
    fact_math: ['Number Wonder', '🔢', 'float-card-purple', 'purple'],
    did_you_know: ['Did You Know?', '💡', 'float-card-gold', 'yellow'],
    world_record: ['🏅 World Record', '🏅', 'float-card-orange', 'orange']
};

function factCard(kind, item) {
    const [title, , css, tone] = FACT_LOOK[kind] || FACT_LOOK.did_you_know;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-${tone}-100 text-${tone}-800">${title}</div>
            <div class="text-8xl my-4">${item.icon}</div>
            <p class="font-serif text-2xl text-${tone}-900 italic leading-relaxed px-2">${esc(item.text)}</p>
        </div>`,
        css
    };
}

function renderKind(kind, item, band) {
    switch (kind) {
        case 'word': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-blue-100 text-blue-800">Word of the Day</div>
                <div class="text-7xl my-4">${item.icon}</div>
                <h3 class="font-title text-5xl text-blue-900 mb-2">${esc(item.word)}</h3>
                <p class="text-blue-700 text-lg font-bold mb-3">${esc(item.meaning)}</p>
                <p class="text-blue-600 italic font-serif text-xl">“${esc(item.example)}”</p></div>`,
            css: 'float-card-blue'
        };
        case 'idiom': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-green-100 text-green-800">Phrase of the Day</div>
                <div class="text-6xl my-3">💬</div>
                <h3 class="font-title text-4xl text-green-900 mb-3">${esc(item.phrase)}</h3>
                <p class="text-green-600 italic font-serif text-xl">“${esc(item.example)}”</p>
                ${answerBlock(item.meaning, 'green')}</div>`,
            css: 'float-card-green',
            timedBlurAnswer: true
        };
        case 'tongue_twister': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-pink-100 text-pink-800">Tongue Twister</div>
                <div class="text-7xl my-4">👅</div>
                <p class="font-title text-4xl text-pink-900 leading-snug px-2">${esc(item.text)}</p>
                <p class="text-pink-600 font-bold mt-4">Say it three times, faster and faster!</p></div>`,
            css: 'float-card-pink'
        };
        case 'language_origin': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-indigo-100 text-indigo-800">Where Words Come From</div>
                <div class="text-7xl my-3">${item.icon}</div>
                <h3 class="font-title text-5xl text-indigo-900 mb-3">${esc(item.word)}</h3>
                <p class="text-indigo-700 text-xl leading-relaxed px-2">${esc(item.story)}</p></div>`,
            css: 'float-card-indigo'
        };
        case 'riddle':
        case 'brain_teaser': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-purple-100 text-purple-800">${kind === 'riddle' ? 'Riddle Me This' : 'Brain Teaser'}</div>
                <div class="text-7xl my-4">${item.icon}</div>
                <p class="font-serif text-2xl text-purple-900 leading-relaxed px-2">${esc(item.question)}</p>
                ${answerBlock(item.answer, 'purple')}</div>`,
            css: 'float-card-purple',
            timedBlurAnswer: true
        };
        case 'emoji_riddle': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-pink-100 text-pink-800">Emoji Riddle</div>
                <div class="text-5xl my-6 tracking-widest">${esc(item.puzzle)} = ?</div>
                ${answerBlock(item.answer, 'pink')}</div>`,
            css: 'float-card-pink',
            timedBlurAnswer: true
        };
        case 'joke': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-orange-100 text-orange-800">Quest Joke</div>
                <div class="text-7xl my-4">🤣</div>
                <p class="font-serif text-2xl text-orange-900 leading-relaxed px-2">${esc(item.question)}</p>
                ${answerBlock(item.answer, 'orange')}</div>`,
            css: 'float-card-orange',
            timedBlurAnswer: true
        };
        case 'thought_experiment': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-indigo-100 text-indigo-800">Think About It</div>
                <div class="text-7xl my-4">${item.icon}</div>
                <p class="font-serif text-2xl text-indigo-900 leading-relaxed px-2">${esc(item.question)}</p>
                <p class="text-indigo-500 font-bold mt-4">Talk to your partner for one minute.</p></div>`,
            css: 'float-card-indigo'
        };
        case 'myth': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-amber-100 text-amber-800">Greek Myth</div>
                <div class="text-7xl my-3">${item.icon}</div>
                <h3 class="font-title text-4xl text-amber-900 mb-3">${esc(item.title)}</h3>
                <p class="text-amber-800 text-xl leading-relaxed px-2">${esc(item.story)}</p></div>`,
            css: 'float-card-gold'
        };
        case 'figure': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-red-100 text-red-800">Historical Hero</div>
                <div class="text-7xl my-3">${item.icon}</div>
                <h3 class="font-title text-4xl text-red-900 mb-1">${esc(item.name)}</h3>
                <p class="text-red-500 font-bold mb-3">${esc(item.years)}</p>
                <p class="text-red-700 text-lg leading-relaxed px-2">${esc(item.text)}</p></div>`,
            css: 'float-card-red'
        };
        case 'book': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-emerald-100 text-emerald-800">Book to Read</div>
                <div class="text-7xl my-3">${item.icon}</div>
                <h3 class="font-title text-4xl text-emerald-900 mb-1">${esc(item.title)}</h3>
                <p class="text-emerald-600 font-bold mb-3">${esc(item.author)}</p>
                <p class="text-emerald-700 text-lg leading-relaxed px-2">${esc(item.why)}</p></div>`,
            css: 'float-card-green'
        };
        case 'study_tip':
        case 'healthy_habit':
        case 'eco_tip':
        case 'creative_prompt': {
            const look = {
                study_tip: ['Study Tip', 'cyan'], healthy_habit: ['Healthy Habit', 'green'],
                eco_tip: ['Eco Hero Tip', 'emerald'], creative_prompt: ['Imagine This', 'purple']
            }[kind];
            return {
                html: `<div class="text-center w-full"><div class="badge-pill bg-${look[1]}-100 text-${look[1]}-800">${look[0]}</div>
                    <div class="text-8xl my-4">${item.icon}</div>
                    <p class="font-serif text-2xl text-${look[1]}-900 leading-relaxed px-2">${esc(item.text)}</p></div>`,
                css: kind === 'creative_prompt' ? 'float-card-purple' : kind === 'study_tip' ? 'float-card-cyan' : 'float-card-green'
            };
        }
        case 'science_demo': return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-cyan-100 text-cyan-800">Try It in Class</div>
                <div class="text-6xl my-3">${item.icon}</div>
                <h3 class="font-title text-3xl text-cyan-900 mb-3">${esc(item.title)}</h3>
                <p class="text-cyan-800 text-lg leading-relaxed px-2">${esc(item.how)}</p>
                ${answerBlock(item.why, 'cyan')}</div>`,
            css: 'float-card-cyan',
            timedBlurAnswer: true
        };
        default: return factCard(kind, item, band);
    }
}

function onThisDayCard(lib, side, band) {
    const events = lib.onThisDay(new Date(), { side, band });
    if (!events.length) return null;
    const recent = readRecent(`otd_${side}`);
    const event = events.find((e) => !recent.includes(e.id)) || events[0];
    remember(`otd_${side}`, event.id);
    const science = side === 'science';
    const tone = science ? 'blue' : 'rose';
    const when = event.worldDay ? 'Today' : `On this day in ${event.year}`;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-${tone}-100 text-${tone}-800">📅 ${science ? 'On This Day in Science' : 'On This Day'}</div>
            <div class="text-7xl my-3">${event.icon}</div>
            <p class="text-${tone}-500 font-bold text-lg mb-2">${when}</p>
            <p class="font-serif text-2xl text-${tone}-900 italic leading-relaxed px-2">${esc(event.text)}</p>
        </div>`,
        css: science ? 'float-card-blue' : 'float-card-red'
    };
}

/**
 * The card for a Wonder Library type (or an AI card type's library fallback), or null when the
 * library has nothing for it today (the projector then picks another card).
 */
export async function hydrateWonderCard(type, questLevel) {
    let lib;
    try { lib = await loadLibrary(); } catch (error) { console.warn('Wonder Library failed to load:', error); return null; }
    const band = lib.wonderBand(questLevel);
    if (type === 'this_day_history') return onThisDayCard(lib, 'history', band);
    if (type === 'on_this_day_science') return onThisDayCard(lib, 'science', band);
    const kind = KIND_FOR_CARD[type];
    if (!kind) return null;
    const item = lib.pickWonder(kind, band, { recent: readRecent(kind) });
    if (!item) return null;
    remember(kind, item.id);
    return renderKind(kind, item, band);
}
