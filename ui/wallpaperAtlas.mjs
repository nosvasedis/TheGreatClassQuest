/**
 * Projector Mode (The Director): the Atlas cards' pure side.
 * Content banks for the quick games, wonders and calm cards, plus the maths that turns the
 * class's real award logs into star trails, constellations and milestones.
 * No DOM, no state: covered by tests/wallpaper-atlas.test.mjs.
 */

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Deterministic 0..1 random numbers from a seed (mulberry32). */
export function seededRandom(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashString(text) {
    let h = 2166136261;
    for (const ch of String(text || '')) {
        h ^= ch.codePointAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function tierBank(bank, tier) {
    return bank[tier] || bank.mid || [];
}

// ─── Class data ──────────────────────────────────────────────────────────────

/**
 * One month of a class's awards, from logs shaped { classId, studentId, reason, at }
 * where `credit(log)` gives the stars the log counts for.
 */
export function summariseClassMonth(logs, classId, now = new Date(), credit = (log) => Number(log.stars) || 0) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const byStudent = new Map();
    const byDay = new Map();
    const byReason = new Map();
    const daysByStudent = new Map();
    const firstByDay = new Map();
    let total = 0;
    for (const log of logs || []) {
        if (log.classId !== classId || !log.at) continue;
        const d = new Date(log.at);
        if (d.getFullYear() !== year || d.getMonth() !== month) continue;
        const stars = credit(log);
        if (!(stars > 0)) continue;
        const day = d.getDate();
        total += stars;
        byStudent.set(log.studentId, (byStudent.get(log.studentId) || 0) + stars);
        byDay.set(day, (byDay.get(day) || 0) + stars);
        if (log.reason) byReason.set(log.reason, (byReason.get(log.reason) || 0) + stars);
        if (!daysByStudent.has(log.studentId)) daysByStudent.set(log.studentId, new Set());
        daysByStudent.get(log.studentId).add(day);
        const first = firstByDay.get(day);
        if (!first || log.at < first.at) firstByDay.set(day, log);
    }
    return { total, byStudent, byDay, byReason, daysByStudent, firstByDay, lessonDays: byDay.size };
}

/** Stars per student over the last 7 days and the 7 before them; the biggest climb wins. */
export function findRisingStar(logs, classId, now = Date.now(), credit = (log) => Number(log.stars) || 0) {
    const week = 7 * 86400000;
    const recent = new Map();
    const before = new Map();
    for (const log of logs || []) {
        if (log.classId !== classId || !log.at) continue;
        const age = now - log.at;
        if (age < 0 || age >= 2 * week) continue;
        const stars = credit(log);
        if (!(stars > 0)) continue;
        const bucket = age < week ? recent : before;
        bucket.set(log.studentId, (bucket.get(log.studentId) || 0) + stars);
    }
    let best = null;
    for (const [studentId, stars] of recent) {
        const gain = stars - (before.get(studentId) || 0);
        if (gain >= 2 && (!best || gain > best.gain)) best = { studentId, gain, recent: stars, before: before.get(studentId) || 0 };
    }
    return best;
}

export const STAR_MILESTONES = Object.freeze([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300]);

/** The next milestone above `stars`, and how many stars it needs. */
export function nextMilestone(stars, steps = STAR_MILESTONES) {
    const n = Math.max(0, Math.floor(Number(stars) || 0));
    const target = steps.find((step) => step > n);
    return target ? { target, need: target - n } : null;
}

/**
 * Star positions for a constellation drawn in a 300×180 box. Bigger stars for bigger
 * totals; the layout is seeded so the same class draws the same sky all day.
 */
export function constellationLayout(values, seed = 1, { width = 300, height = 180, pad = 22 } = {}) {
    const random = seededRandom(seed);
    const max = Math.max(1, ...values.map((v) => v.value));
    const placed = [];
    for (const item of values) {
        let best = null;
        for (let attempt = 0; attempt < 24; attempt++) {
            const x = pad + random() * (width - pad * 2);
            const y = pad + random() * (height - pad * 2 - 16);
            const nearest = placed.reduce((min, p) => Math.min(min, Math.hypot(p.x - x, p.y - y)), Infinity);
            if (!best || nearest > best.nearest) best = { x, y, nearest };
            if (nearest > 46) break;
        }
        placed.push({ ...item, x: Math.round(best.x), y: Math.round(best.y), r: +(2.2 + 5.8 * Math.sqrt(item.value / max)).toFixed(1) });
    }
    return placed;
}

/** Lines joining each star to its nearest earlier neighbour: a constellation, not a web. */
export function constellationLinks(points) {
    const links = [];
    for (let i = 1; i < points.length; i++) {
        let nearest = 0;
        let bestDist = Infinity;
        for (let j = 0; j < i; j++) {
            const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
            if (dist < bestDist) { bestDist = dist; nearest = j; }
        }
        links.push([points[nearest], points[i]]);
    }
    return links;
}

/** Monday-first week with lesson days marked. `scheduleDays` holds getDay() numbers as strings. */
export function weekPath(scheduleDays, now = new Date()) {
    const lessonDays = new Set((scheduleDays || []).map(String));
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const isToday = date.toDateString() === now.toDateString();
        days.push({
            date,
            label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
            lesson: lessonDays.has(String(date.getDay())),
            past: date < new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            isToday
        });
    }
    const left = days.filter((d) => d.lesson && !d.past && !d.isToday).length;
    return { days, left, total: days.filter((d) => d.lesson).length };
}

/** Time to the weekend (Saturday 00:00), or null when it is already the weekend. */
export function weekendCountdown(now = new Date()) {
    const day = now.getDay();
    if (day === 0 || day === 6) return null;
    const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day));
    const ms = saturday - now;
    return { days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000), sleeps: 6 - day };
}

/** Grid for a month calendar, Monday first: nulls pad the first week. */
export function monthGrid(now = new Date()) {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    const cells = Array.from({ length: pad }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(now.getFullYear(), now.getMonth(), d));
    return cells;
}

export const WORLD_CITIES = Object.freeze([
    { city: 'London', zone: 'Europe/London', flag: '🇬🇧' },
    { city: 'New York', zone: 'America/New_York', flag: '🇺🇸' },
    { city: 'Sydney', zone: 'Australia/Sydney', flag: '🇦🇺' },
    { city: 'Toronto', zone: 'America/Toronto', flag: '🇨🇦' },
    { city: 'Dublin', zone: 'Europe/Dublin', flag: '🇮🇪' },
    { city: 'Auckland', zone: 'Pacific/Auckland', flag: '🇳🇿' },
    { city: 'Cape Town', zone: 'Africa/Johannesburg', flag: '🇿🇦' },
    { city: 'Los Angeles', zone: 'America/Los_Angeles', flag: '🇺🇸' }
]);

/** Local time and hour in each city (hours drive the day/night icon). */
export function worldClocks(cities, now = new Date()) {
    return cities.map((c) => {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: c.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = parts.find((p) => p.type === 'minute')?.value || '00';
        return { ...c, time: `${String(hour).padStart(2, '0')}:${minute}`, hour };
    });
}

export function whatTheyAreDoing(hour) {
    if (hour < 6) return 'fast asleep';
    if (hour < 8) return 'eating breakfast';
    if (hour < 15) return 'at school';
    if (hour < 18) return 'playing after school';
    if (hour < 21) return 'having dinner';
    return 'getting ready for bed';
}

/** "HELLO" → "8 · 5 · 12 · 12 · 15" (A = 1). */
export function numberCode(word) {
    return String(word).toUpperCase().replace(/[^A-Z]/g, '').split('').map((ch) => ch.charCodeAt(0) - 64).join(' · ');
}

/** A seeded field of little stars to count (8 to 17), placed without overlapping. */
export function countingField(seed, { width = 280, height = 150 } = {}) {
    const random = seededRandom(seed);
    const count = 8 + Math.floor(random() * 10);
    const points = [];
    let guard = 0;
    while (points.length < count && guard++ < 600) {
        const x = 16 + random() * (width - 32);
        const y = 16 + random() * (height - 32);
        if (points.every((p) => Math.hypot(p.x - x, p.y - y) > 30)) {
            points.push({ x: Math.round(x), y: Math.round(y), s: +(0.75 + random() * 0.6).toFixed(2), r: Math.round(random() * 60 - 30) });
        }
    }
    return points;
}

export function acrostic(name, words = ACROSTIC_WORDS) {
    const letters = String(name || '').toUpperCase().replace(/[^A-Z]/g, '').split('').slice(0, 8);
    return letters.map((letter, i) => {
        const options = words[letter] || [];
        return { letter, word: options.length ? options[i % options.length] : '' };
    });
}

// ─── Banks ───────────────────────────────────────────────────────────────────

export const ACROSTIC_WORDS = Object.freeze({
    A: ['amazing', 'adventurous', 'artistic'], B: ['brave', 'bright', 'bubbly'], C: ['clever', 'creative', 'cheerful'],
    D: ['daring', 'determined', 'delightful'], E: ['energetic', 'excellent', 'eager'], F: ['friendly', 'funny', 'fearless'],
    G: ['generous', 'gentle', 'great'], H: ['helpful', 'happy', 'honest'], I: ['imaginative', 'inventive', 'inspiring'],
    J: ['joyful', 'jolly', 'just'], K: ['kind', 'keen', 'knowledgeable'], L: ['lively', 'loyal', 'lovely'],
    M: ['magical', 'marvellous', 'musical'], N: ['nice', 'noble', 'neat'], O: ['outstanding', 'optimistic', 'original'],
    P: ['patient', 'polite', 'playful'], Q: ['quick', 'quiet', 'quirky'], R: ['respectful', 'radiant', 'reliable'],
    S: ['smart', 'super', 'sunny'], T: ['thoughtful', 'talented', 'terrific'], U: ['unique', 'upbeat', 'understanding'],
    V: ['vivid', 'valiant', 'very kind'], W: ['wise', 'wonderful', 'warm'], X: ['x-tra special', 'x-cellent', 'x-tra brave'],
    Y: ['youthful', 'yes-I-can', 'yummy-smiled'], Z: ['zesty', 'zippy', 'zany']
});

export const OPPOSITES = Object.freeze({
    junior: [['big', 'small'], ['hot', 'cold'], ['happy', 'sad'], ['up', 'down'], ['fast', 'slow'], ['day', 'night'], ['open', 'closed'], ['old', 'new'], ['tall', 'short'], ['wet', 'dry'], ['full', 'empty'], ['loud', 'quiet']],
    mid: [['early', 'late'], ['brave', 'scared'], ['heavy', 'light'], ['cheap', 'expensive'], ['remember', 'forget'], ['arrive', 'leave'], ['win', 'lose'], ['push', 'pull'], ['strong', 'weak'], ['noisy', 'silent'], ['tidy', 'messy'], ['always', 'never']],
    senior: [['ancient', 'modern'], ['generous', 'selfish'], ['accept', 'refuse'], ['temporary', 'permanent'], ['increase', 'decrease'], ['optimistic', 'pessimistic'], ['rare', 'common'], ['guilty', 'innocent'], ['victory', 'defeat'], ['shallow', 'deep'], ['expand', 'shrink'], ['visible', 'invisible']]
});

export const RHYMES = Object.freeze({
    junior: [['cat', 'hat, bat, mat, rat'], ['sun', 'fun, run, bun'], ['dog', 'frog, log, fog'], ['bee', 'tree, sea, key'], ['cake', 'lake, snake, bake'], ['star', 'car, jar, far'], ['boat', 'coat, goat, note'], ['bed', 'red, head, bread']],
    mid: [['light', 'night, kite, bright, white'], ['rain', 'train, brain, chain'], ['play', 'day, grey, stay, way'], ['book', 'look, cook, hook'], ['ring', 'king, sing, wing, spring'], ['ball', 'tall, wall, fall, small'], ['sound', 'round, ground, found'], ['snow', 'grow, slow, throw']],
    senior: [['nation', 'station, creation, vacation'], ['delight', 'polite, excite, tonight'], ['fear', 'clear, near, year, appear'], ['stone', 'phone, alone, bone, known'], ['mind', 'kind, find, behind'], ['thought', 'caught, taught, bought'], ['school', 'rule, cool, pool, tool'], ['dream', 'team, stream, gleam, cream']]
});

export const COMPOUNDS = Object.freeze({
    junior: [['☀️ sun', '🌻 flower', 'sunflower'], ['⭐ star', '🐟 fish', 'starfish'], ['🌧️ rain', '🎀 bow', 'rainbow'], ['🦋 butter', '🪰 fly', 'butterfly'], ['⛄ snow', '👨 man', 'snowman'], ['👣 foot', '⚽ ball', 'football']],
    mid: [['🦷 tooth', '🖌️ brush', 'toothbrush'], ['🌙 moon', '💡 light', 'moonlight'], ['🏠 home', '📝 work', 'homework'], ['🍓 straw', '🫐 berry', 'strawberry'], ['🔥 fire', '🎆 work', 'firework'], ['🌊 water', '🍈 melon', 'watermelon']],
    senior: [['🌍 earth', '〰️ quake', 'earthquake'], ['🌧️ rain', '🧥 coat', 'raincoat'], ['🔦 flash', '💡 light', 'flashlight'], ['💔 break', '💨 fast', 'breakfast'], ['👣 foot', '🖨️ print', 'footprint'], ['🌙 night', '😱 mare', 'nightmare']]
});

export const IRREGULAR_PLURALS = Object.freeze({
    junior: [['one mouse 🐭', 'two mice'], ['one child 🧒', 'two children'], ['one foot 🦶', 'two feet'], ['one tooth 🦷', 'two teeth'], ['one sheep 🐑', 'two sheep'], ['one fish 🐟', 'two fish']],
    mid: [['one man 👨', 'two men'], ['one woman 👩', 'two women'], ['one goose 🪿', 'two geese'], ['one person 🧑', 'two people'], ['one knife 🔪', 'two knives'], ['one leaf 🍃', 'two leaves']],
    senior: [['one cactus 🌵', 'two cacti'], ['one wolf 🐺', 'two wolves'], ['one ox 🐂', 'two oxen'], ['one potato 🥔', 'two potatoes'], ['one deer 🦌', 'two deer'], ['one crisis', 'two crises']]
});

export const IDIOMS = Object.freeze([
    { idiom: "It's raining cats and dogs", emoji: '🌧️🐱🐶', meaning: 'It is raining very heavily.' },
    { idiom: 'A piece of cake', emoji: '🍰', meaning: 'Something very easy.' },
    { idiom: 'Break a leg!', emoji: '🎭', meaning: 'Good luck! (said before a show)' },
    { idiom: 'Under the weather', emoji: '🤒', meaning: 'Feeling a little ill.' },
    { idiom: 'Once in a blue moon', emoji: '🔵🌕', meaning: 'Very, very rarely.' },
    { idiom: 'Hit the books', emoji: '📚', meaning: 'Start studying hard.' },
    { idiom: 'Let the cat out of the bag', emoji: '🐈👜', meaning: 'Tell a secret by mistake.' },
    { idiom: 'Cool as a cucumber', emoji: '🥒😎', meaning: 'Very calm, not worried.' },
    { idiom: 'The ball is in your court', emoji: '🎾', meaning: 'Now it is your turn to decide.' },
    { idiom: 'Over the moon', emoji: '🌙🐄', meaning: 'Very, very happy.' },
    { idiom: 'Time flies', emoji: '⏰🕊️', meaning: 'Time passes very quickly.' },
    { idiom: 'Busy as a bee', emoji: '🐝', meaning: 'Very busy, working hard.' }
]);

export const EMOJI_SENTENCES = Object.freeze({
    junior: [['👧 ❤️ 🐶', 'The girl loves the dog.'], ['👦 🍎 😋', 'The boy eats an apple.'], ['🐱 😴 🛏️', 'The cat is sleeping on the bed.'], ['☀️ 🏖️ 🏊', 'It is sunny, so we swim at the beach.'], ['👨‍👩‍👧 🚗 🏔️', 'My family drives to the mountains.']],
    mid: [['🌧️ ☂️ 🚶', 'It is raining, so I walk with an umbrella.'], ['🎂 🎉 👫', 'We have a birthday party with friends.'], ['📚 🌙 😴', 'I read a book at night and fall asleep.'], ['⚽ 🥅 🏆', 'We scored a goal and won the cup.'], ['🍕 👨‍🍳 🔥', 'The chef cooks pizza in a hot oven.']],
    senior: [['✈️ 🗺️ 🏛️', 'We flew abroad to visit ancient monuments.'], ['🔬 🧪 💡', 'The scientist did an experiment and had an idea.'], ['🌱 💧 🌳', 'With water, a small seed grows into a tree.'], ['📱 🔋 😩', 'My phone battery died at the worst moment.'], ['🎸 🎤 👏', 'The band played and the crowd applauded.']]
});

export const HIDDEN_WORDS = Object.freeze([
    { word: 'TEACHER', examples: 'tea, each, hat, heat, cheer, reach' },
    { word: 'ELEPHANT', examples: 'pen, ant, help, plant, leap, then' },
    { word: 'BIRTHDAY', examples: 'bird, day, dirt, bath, third, hat' },
    { word: 'STARLIGHT', examples: 'star, light, sight, rat, tail, girl' },
    { word: 'CLASSROOM', examples: 'class, room, moss, rose, cool, loss' },
    { word: 'ADVENTURE', examples: 'vent, tune, dent, near, read, ant' },
    { word: 'CHOCOLATE', examples: 'cat, hole, coat, late, cool, heat' },
    { word: 'SANDWICH', examples: 'sand, hand, wish, wind, chain, and' }
]);

export const PATTERNS = Object.freeze({
    junior: [['🍎 🍌 🍎 🍌 🍎 …', '🍌'], ['1, 2, 3, 4, …', '5'], ['🔴 🔵 🔵 🔴 🔵 🔵 …', '🔴'], ['2, 4, 6, 8, …', '10'], ['🐱 🐶 🐶 🐱 🐶 🐶 …', '🐱']],
    mid: [['5, 10, 15, 20, …', '25'], ['A, C, E, G, …', 'I'], ['1, 4, 9, 16, …', '25'], ['Mon, Wed, Fri, …', 'Sun'], ['🌑 🌓 🌕 🌗 …', '🌑']],
    senior: [['1, 1, 2, 3, 5, 8, …', '13'], ['2, 6, 18, 54, …', '162'], ['J, F, M, A, M, …', 'J (June)'], ['O, T, T, F, F, S, S, …', 'E (Eight)'], ['100, 81, 64, 49, …', '36']]
});

export const TWENTY_QUESTIONS = Object.freeze([
    { clues: ['I live in the sea.', 'I have eight arms.', 'I can squirt ink.'], answer: 'an octopus 🐙' },
    { clues: ['I am very tall.', 'I have a long neck.', 'I eat leaves from trees.'], answer: 'a giraffe 🦒' },
    { clues: ['I am cold.', 'Children make me in winter.', 'I have a carrot nose.'], answer: 'a snowman ⛄' },
    { clues: ['I have keys but no locks.', 'I can make music.', 'I am black and white.'], answer: 'a piano 🎹' },
    { clues: ['I fly at night.', 'I hang upside down.', 'I am not a bird.'], answer: 'a bat 🦇' },
    { clues: ['I am in the sky.', 'I have seven colours.', 'I come after the rain.'], answer: 'a rainbow 🌈' },
    { clues: ['I have pages.', 'I have a spine but no bones.', 'You read me.'], answer: 'a book 📖' },
    { clues: ['I am a planet.', 'I am red.', 'Robots have visited me.'], answer: 'Mars 🔴' }
]);

export const CODE_WORDS = Object.freeze(['HELLO', 'STAR', 'QUEST', 'SMILE', 'HERO', 'MAGIC', 'FRIEND', 'DRAGON', 'CASTLE', 'BRAVE', 'SUNNY', 'PIZZA']);

export const SIMON_SAYS = Object.freeze([
    'Simon says: touch your nose 👃', 'Simon says: stand on one leg 🦩', 'Clap three times 👏 (did Simon say?)',
    'Simon says: wave to a friend 👋', 'Simon says: pretend to be a tree 🌳', 'Simon says: jump once 🦘',
    'Sit down 🪑 (did Simon say?)', 'Simon says: make a funny face 🤪', 'Simon says: point to the window 🪟',
    'Simon says: whisper your name 🤫', 'Touch your toes 🦶 (did Simon say?)', 'Simon says: fly like a bird 🕊️'
]);

export const ANIMALS = Object.freeze([
    { emoji: '🐙', name: 'Octopus', fact: 'An octopus has three hearts and blue blood.' },
    { emoji: '🦒', name: 'Giraffe', fact: 'A giraffe’s tongue can be about 50 centimetres long.' },
    { emoji: '🐧', name: 'Emperor penguin', fact: 'Emperor penguin dads keep the egg warm on their feet all winter.' },
    { emoji: '🦉', name: 'Owl', fact: 'An owl can turn its head about three quarters of the way round.' },
    { emoji: '🐘', name: 'Elephant', fact: 'Elephants can recognise themselves in a mirror.' },
    { emoji: '🐝', name: 'Honeybee', fact: 'Bees dance to tell their friends where the flowers are.' },
    { emoji: '🦈', name: 'Shark', fact: 'Sharks were swimming in the sea before there were trees on land.' },
    { emoji: '🐢', name: 'Sea turtle', fact: 'Sea turtles swim thousands of kilometres and come back to the beach where they hatched.' },
    { emoji: '🦩', name: 'Flamingo', fact: 'Flamingos are pink because of the food they eat.' },
    { emoji: '🐨', name: 'Koala', fact: 'Koalas sleep up to 20 hours a day.' },
    { emoji: '🦔', name: 'Hedgehog', fact: 'A hedgehog has about 5,000 spines.' },
    { emoji: '🐬', name: 'Dolphin', fact: 'Dolphins call each other with special whistles, like names.' },
    { emoji: '🦋', name: 'Butterfly', fact: 'Butterflies taste with their feet.' },
    { emoji: '🐌', name: 'Snail', fact: 'Some snails can sleep for a very long time when the weather is too dry.' }
]);

export const COUNTRIES = Object.freeze([
    { flag: '🇬🇧', name: 'the United Kingdom', capital: 'London', fact: 'Big Ben is the name of the great bell, not the tower.' },
    { flag: '🇮🇪', name: 'Ireland', capital: 'Dublin', fact: 'Ireland is called the Emerald Isle because it is so green.' },
    { flag: '🇺🇸', name: 'the United States', capital: 'Washington, D.C.', fact: 'The USA has 50 states: that is why there are 50 stars on the flag.' },
    { flag: '🇨🇦', name: 'Canada', capital: 'Ottawa', fact: 'Canada has more lakes than any other country in the world.' },
    { flag: '🇦🇺', name: 'Australia', capital: 'Canberra', fact: 'Australia is a country and a continent at the same time.' },
    { flag: '🇳🇿', name: 'New Zealand', capital: 'Wellington', fact: 'There are more sheep than people in New Zealand.' },
    { flag: '🇿🇦', name: 'South Africa', capital: 'Pretoria', fact: 'South Africa has 12 official languages, and English is one of them.' },
    { flag: '🇯🇲', name: 'Jamaica', capital: 'Kingston', fact: 'Jamaica is the home of reggae music.' },
    { flag: '🇮🇳', name: 'India', capital: 'New Delhi', fact: 'English is one of the languages used by India’s government.' },
    { flag: '🇸🇬', name: 'Singapore', capital: 'Singapore', fact: 'Singapore is a city, an island and a country all at once.' }
]);

export const SPACE_FACTS = Object.freeze([
    { emoji: '☀️', title: 'The Sun', fact: 'About one million Earths could fit inside the Sun.' },
    { emoji: '🌕', title: 'The Moon', fact: 'Footprints on the Moon can stay for millions of years: there is no wind to blow them away.' },
    { emoji: '🪐', title: 'Saturn', fact: 'Saturn is so light for its size that it would float in a giant bathtub.' },
    { emoji: '🔴', title: 'Mars', fact: 'Mars has the tallest volcano we know of: Olympus Mons.' },
    { emoji: '🟠', title: 'Jupiter', fact: 'Jupiter’s Great Red Spot is a storm bigger than the Earth.' },
    { emoji: '⭐', title: 'Stars', fact: 'The light from some stars left them before your great-grandparents were born.' },
    { emoji: '🧑‍🚀', title: 'Astronauts', fact: 'Astronauts grow a little taller in space, because there is less gravity pulling them down.' },
    { emoji: '🌍', title: 'Earth', fact: 'The Earth travels around the Sun at about 30 kilometres every second.' },
    { emoji: '☄️', title: 'Comets', fact: 'A comet’s tail always points away from the Sun.' },
    { emoji: '🌌', title: 'The Milky Way', fact: 'Our galaxy, the Milky Way, has more than 100 billion stars.' }
]);

export const INVENTIONS = Object.freeze([
    { emoji: '💡', thing: 'the light bulb', who: 'Many inventors; Thomas Edison made it practical (1879)' },
    { emoji: '📞', thing: 'the telephone', who: 'Alexander Graham Bell (1876)' },
    { emoji: '✈️', thing: 'the aeroplane', who: 'The Wright brothers (1903)' },
    { emoji: '🌐', thing: 'the World Wide Web', who: 'Tim Berners-Lee (1989)' },
    { emoji: '🖨️', thing: 'the printing press', who: 'Johannes Gutenberg (about 1440)' },
    { emoji: '💉', thing: 'the first vaccine', who: 'Edward Jenner (1796)' },
    { emoji: '🚲', thing: 'the bicycle', who: 'Karl Drais made the first “running machine” (1817)' },
    { emoji: '📺', thing: 'the television', who: 'John Logie Baird showed it first (1926)' }
]);

export const GRATITUDE_PROMPTS = Object.freeze([
    'Tell your partner one thing that made you smile this week.',
    'Who is someone you want to say thank you to today? Why?',
    'What is your favourite place in your home? Why do you like it?',
    'Name one thing your body helps you do every day.',
    'What is something you can do now that you could not do last year?',
    'Think of a friend. What is one kind thing they did for you?',
    'What is the best thing you ate this week?',
    'Which song makes you happy? Hum it to your partner!'
]);

export const KINDNESS_QUESTS = Object.freeze([
    'Give a real compliment to someone you do not usually talk to.',
    'Help someone tidy up before the lesson ends.',
    'Say “thank you” to three people today.',
    'Ask a classmate: “How are you today?” and really listen.',
    'Let someone else go first in the queue.',
    'Share your colouring pencils with a friend.',
    'Smile at everyone who comes through the door.',
    'Write a kind note for someone at home.'
]);

export const STRETCHES = Object.freeze([
    ['🙆', 'Reach up high and touch the sky'], ['🌬️', 'Take three big balloon breaths'], ['🔄', 'Roll your shoulders back five times'],
    ['🦩', 'Stand on one leg like a flamingo'], ['🌳', 'Sway like a tree in the wind'], ['🐱', 'Stretch like a lazy cat'],
    ['🤸', 'Star jump! Arms and legs out wide'], ['🐢', 'Look slowly left, then slowly right']
]);

/** Constellations by the season they shine best on autumn/winter/spring/summer evenings. */
export const CONSTELLATIONS = Object.freeze({
    winter: {
        name: 'Orion, the Hunter', note: 'Look for three bright stars in a row: Orion’s belt.',
        stars: [[70, 30], [150, 38], [98, 92], [114, 96], [130, 100], [72, 160], [156, 150]],
        lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]
    },
    spring: {
        name: 'The Big Dipper', note: 'Seven stars make a giant ladle. It helps you find the North Star.',
        stars: [[30, 60], [80, 58], [120, 72], [158, 88], [168, 136], [226, 142], [230, 96]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
    },
    summer: {
        name: 'Cygnus, the Swan', note: 'A big cross in the Milky Way: a swan flying south.',
        stars: [[150, 20], [150, 70], [150, 118], [150, 164], [80, 84], [220, 60]],
        lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]
    },
    autumn: {
        name: 'Cassiopeia, the Queen', note: 'Five stars that make a big W (or an M) in the northern sky.',
        stars: [[40, 70], [94, 118], [150, 76], [206, 116], [262, 62]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
    }
});

export const PLANETS = Object.freeze([
    { name: 'Mercury', c1: '#d6d3d1', c2: '#78716c', fact: 'The smallest planet and the closest to the Sun. A year there is only 88 days.' },
    { name: 'Venus', c1: '#fde68a', c2: '#d97706', fact: 'The hottest planet, even hotter than Mercury, because of its thick clouds.' },
    { name: 'Earth', c1: '#7dd3fc', c2: '#15803d', fact: 'The only planet we know with rivers, seas and life.' },
    { name: 'Mars', c1: '#fdba74', c2: '#b91c1c', fact: 'The red planet. Its red colour comes from rusty dust.' },
    { name: 'Jupiter', c1: '#fed7aa', c2: '#b45309', fact: 'The biggest planet. It has dozens of moons.', bands: true },
    { name: 'Saturn', c1: '#fef3c7', c2: '#ca8a04', fact: 'Its beautiful rings are made of ice and rock.', ring: true },
    { name: 'Uranus', c1: '#cffafe', c2: '#0891b2', fact: 'It spins on its side, like a rolling ball.', ring: true, tilt: true },
    { name: 'Neptune', c1: '#93c5fd', c2: '#1e3a8a', fact: 'The windiest planet, with the fastest winds we know of.' }
]);

export const REASON_LABELS = Object.freeze({
    teamwork: ['🤝', 'Teamwork'], creativity: ['💡', 'Creativity'], respect: ['🙏', 'Respect'], focus: ['🎯', 'Focus'],
    welcome_back: ['🚪', 'Welcome back'], story_weaver: ['📖', 'Story Weavers'], vanishing_hoard: ['🐉', 'Vanishing Hoard'], torn_map: ['🗺️', 'Torn Map'], round_table: ['🕯️', 'Round Table'], scholar_s_bonus: ['🎓', 'Scholar’s bonus'],
    teacher_boon: ['🎁', 'Teacher Boon'], peer_boon: ['💖', 'Hero’s Boon'], pathfinder_map: ['🗺️', 'Pathfinder'],
    quiz_of_the_week: ['📜', 'Quiz of the Week'], wheel_fortune: ['🎡', 'Wheel of Fortune'], marked_present: ['✅', 'Present'],
    excellence: ['🌟', 'Excellence'], special_quest: ['✨', 'Special quest']
});

export function reasonLabel(reason) {
    return REASON_LABELS[reason] || ['⭐', String(reason || 'Stars').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())];
}
