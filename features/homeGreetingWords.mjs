/**
 * The Home greeting's words. Home is on the projector, so the greeting speaks to the students:
 * a class in view is greeted by its name, the general view greets the whole school. The line
 * beneath reads the live sky (the same scene the header and weather card paint from), the hour
 * and the day, and in a class a small badge says how the month's quest is going.
 *
 * No DOM here (tests/home-greeting-words.test.mjs). Lines are picked from the date, so a
 * re-render never swaps them mid-lesson; only a real change (weather, hour, stars) moves them.
 */

import { formatQuestStars, starsToReachPercent } from './teamQuestRace.mjs';

const HELLO = {
    morning: 'Good Morning',
    afternoon: 'Good Afternoon',
    evening: 'Good Evening',
    // Lessons run after an early winter sunset: "Good Night" would sound like goodbye.
    night: 'Good Evening'
};

/** What the sky is doing, in the order it matters to a class looking out of the window. */
export function skyMood(scene = {}, reading = {}) {
    const condition = scene.condition || 'partly';
    const temp = Number(reading?.temp);
    const wind = scene.wind?.level;
    if (condition === 'storm' || condition === 'hail') return 'storm';
    if (condition === 'snow') return 'snow';
    if (condition === 'freezing') return 'ice';
    if (scene.rainbow) return 'rainbow';
    if (['rain', 'drizzle', 'showers'].includes(condition) && scene.precip) return 'rain';
    if (condition === 'fog') return 'fog';
    if (wind === 'gale' || wind === 'windy') return 'windy';
    if (Number.isFinite(temp) && temp >= 32 && !scene.isNight) return 'hot';
    if (Number.isFinite(temp) && temp <= 3) return 'cold';
    if (condition === 'overcast') return 'grey';
    if (scene.isNight) return scene.stars ? 'stars' : 'night';
    if (scene.light === 'dawn') return 'dawn';
    if (scene.light === 'golden') return 'golden';
    return condition === 'clear' ? 'sunny' : 'fair';
}

const MOOD_ICONS = {
    storm: 'fa-bolt', snow: 'fa-snowflake', ice: 'fa-icicles', rainbow: 'fa-rainbow',
    rain: 'fa-cloud-rain', fog: 'fa-smog', windy: 'fa-wind', hot: 'fa-sun', cold: 'fa-mitten',
    grey: 'fa-cloud', stars: 'fa-star', night: 'fa-moon', dawn: 'fa-feather-alt',
    golden: 'fa-sun', sunny: 'fa-sun', fair: 'fa-cloud-sun'
};

/** A class's lines (`we`) and the whole school's (`all`). Young leagues get the short ones. */
const MOOD_LINES = {
    storm: {
        we: ['Thunder outside, brave hearts inside!', 'Let the storm roar. We have a quest to finish!'],
        young: ['Boom! Thunder outside, brave heroes inside!'],
        all: ['Thunder outside, brave hearts in every classroom.']
    },
    snow: {
        we: ['Snowflakes are falling. A magical day to learn!', 'The hills are white and our ideas are bright.'],
        young: ['Look, snow! A magic day to play and learn!'],
        all: ['Snow on the hills, warm lessons inside.']
    },
    ice: {
        we: ['Icy outside, cosy inside. Let’s warm up our minds!'],
        young: ['Brrr, icy! Let’s warm up with a game!'],
        all: ['Icy roads, warm classrooms. Take care out there!']
    },
    rainbow: {
        we: ['A rainbow after the rain. Something good is coming!', 'Rain and sun together. Look for the rainbow!'],
        young: ['Rain and sun make a rainbow. Can you see it?'],
        all: ['Rain and sun together: a rainbow kind of day.']
    },
    rain: {
        we: ['Rain on the windows, big ideas in the room.', 'A rainy day is perfect for great stories.', 'Let it rain! Our quest goes on.'],
        young: ['Pitter patter, rain! A cosy day to learn.', 'Rainy day, happy day! Let’s begin.'],
        all: ['Rain on the windows, stories in every room.', 'A rainy day is a cosy day to learn.']
    },
    fog: {
        we: ['The fog hides the hills, but not our quest.', 'A misty day for mystery and discovery.'],
        young: ['Foggy and grey! Where did the hills go?'],
        all: ['The fog hides the hills, but every quest goes on.']
    },
    windy: {
        we: ['The wind is blowing new adventures our way.', 'Hold on to your hats. It’s a windy one!'],
        young: ['Whoosh! The wind is here to play.'],
        all: ['The wind is carrying new adventures to every class.']
    },
    hot: {
        we: ['A hot day! Stay cool and think clearly.'],
        young: ['So hot! Drink some water and let us go!'],
        all: ['A hot day! Water bottles ready, heroes.']
    },
    cold: {
        we: ['Cold outside, warm hearts inside.'],
        young: ['Brrr, cold! Let’s warm up together.'],
        all: ['Cold outside, warm hearts in every classroom.']
    },
    grey: {
        we: ['Grey clouds above, bright minds below.', 'A cloudy sky is waiting for some sunshine. That’s you!'],
        young: ['Grey clouds, bright smiles!'],
        all: ['Grey clouds above, bright minds in every room.']
    },
    stars: {
        we: ['The stars are out to watch you shine.', 'Night has come, and the stars are listening.'],
        young: ['Look up! The stars came out to see you.'],
        all: ['The stars are out over the school tonight.']
    },
    night: {
        we: ['It’s dark outside, so let us light up the room.'],
        young: ['The moon is up. Time for evening heroes!'],
        all: ['Evening lessons, warm lights in every window.']
    },
    dawn: {
        we: ['The sun is waking up, and so are we!'],
        young: ['Good morning, sun! Good morning, heroes!'],
        all: ['A new day is rising over the school.']
    },
    golden: {
        we: ['Golden light outside, golden ideas inside.', 'The sun is low and the sky is gold. Let’s shine too!'],
        young: ['Look, the sky is gold! Let’s shine too!'],
        all: ['Golden hour over the school.']
    },
    sunny: {
        we: ['The sun is shining on our quest today.', 'Blue skies and bright minds. Let’s begin!'],
        young: ['Hello, sunshine! Ready to play and learn?', 'The sun is smiling at you today!'],
        all: ['Blue skies over the whole school today.', 'The sun is shining on every quest today.']
    },
    fair: {
        we: ['A few clouds, a lot of ideas. Let’s begin!', 'Sun and clouds, and a quest to continue.'],
        young: ['Clouds and sun, time for fun!'],
        all: ['Sun and clouds over every classroom today.']
    }
};

/** Mondays and Fridays have their own feel when the sky is ordinary. */
const WEEKDAY_LINES = {
    1: { we: 'A new week, a new chapter. Let’s make it legendary!', young: 'Hooray, a new week! Let’s have fun!', all: 'A new week begins for every hero.' },
    5: { we: 'It’s Friday! Let’s finish the week strong.', young: 'Friday fun! Let’s make it great!', all: 'Friday! One more push for every class.' }
};
const PLAIN_MOODS = new Set(['sunny', 'fair', 'grey', 'night', 'dawn']);

function seedFor(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

function pick(list, seed) {
    return list[seed % list.length];
}

function dateKey(now) {
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * How the month's quest stands, as a badge (class view only). Stars can come in halves, so
 * the count left is the map's own (starsToReachPercent): 45.5 of 48 is 3 to go, never 2.
 */
export function questNudge({ monthStars, goal, now = new Date() } = {}) {
    const stars = Math.max(0, Number(monthStars) || 0);
    const target = Number(goal) || 0;
    if (!(target > 0)) return null;
    const left = starsToReachPercent(stars, target, 100);
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    if (left <= 0) return { tone: 'won', icon: 'fa-trophy', text: 'Monthly goal reached!' };
    if (left <= Math.max(3, Math.round(target * 0.12))) return { tone: 'close', icon: 'fa-flag-checkered', text: `Only ${left} ★ to the goal!` };
    if (stars === 0 && now.getDate() <= 7) return { tone: 'fresh', icon: 'fa-seedling', text: 'The first star is waiting' };
    if (daysLeft <= 3) return { tone: 'rush', icon: 'fa-hourglass-half', text: `${left} ★ to go, every star counts!` };
    return { tone: 'road', icon: 'fa-route', text: `${formatQuestStars(stars)} ★ of ${formatQuestStars(target)} this month` };
}

/**
 * The greeting. `mode` is 'class' (with `className`) or 'general'.
 * Returns { hello, name, line, icon, mood, key } where `key` changes only when the words do.
 */
export function composeHomeGreeting({
    mode = 'general', className = '', young = false, part = 'afternoon',
    scene = {}, reading = {}, now = new Date()
} = {}) {
    const inClass = mode === 'class' && String(className || '').trim();
    const hour = now.getHours();
    const hello = part === 'night' && hour < 5 ? 'Hello' : (HELLO[part] || HELLO.afternoon);
    const name = inClass ? String(className).trim() : 'Heroes';
    const mood = skyMood(scene, reading);
    const voice = inClass ? (young ? 'young' : 'we') : 'all';
    const seed = seedFor(`${dateKey(now)}:${mood}:${voice}:${name}`);

    const weekday = WEEKDAY_LINES[now.getDay()];
    let line;
    let icon = MOOD_ICONS[mood] || 'fa-cloud-sun';
    if (weekday && PLAIN_MOODS.has(mood) && hour < 17) {
        line = weekday[voice];
        icon = now.getDay() === 1 ? 'fa-book-open' : 'fa-flag-checkered';
    } else {
        const lines = MOOD_LINES[mood] || MOOD_LINES.fair;
        line = pick(lines[voice] || lines.we, seed);
    }
    return { hello, name, line, icon, mood, key: `${hello}|${name}|${line}` };
}

/** Titles a teacher's name may start with (English and Greek); the crest skips them. */
const NAME_TITLES = /^(mr|mrs|ms|miss|mx|mister|madam|madame|dr|sir|teacher|κ|κος|κα|κυρία|κύριος|κυρια|κυριος)\.?$/i;

/** The crest letter: the first letter of the teacher's own name, never of "Mr." or "Ms.". */
export function teacherInitial(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const own = words.find((w) => !NAME_TITLES.test(w)) || words[0] || '';
    const ch = own.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0);
    return ch ? ch.toLocaleUpperCase() : '★';
}
