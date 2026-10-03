// features/guildQuiz.js — Quiz question pools (level-appropriate), randomisation, guild assignment
//
// Written for Greek children learning English. Every pool follows the same rules:
//   • Short, high-frequency English for the league's age; the emoji carries the meaning
//     for children who cannot read every word yet.
//   • Every question has exactly one answer per guild, and each answer is worth one point.
//   • No answer is "the nice one": friends, kindness and helping never belong to just one
//     guild, so no house collects the answers children think the teacher wants.
//   • No guild mascots or guild colours in the answers (no bears, dragons, owls, eagles,
//     fire), so children cannot steer toward the house their friends are in.
//   • Each pool's crowd favourites (pets, superpowers, summer…) rotate across the guilds.

import { GUILD_IDS } from './guilds.js';

export const QUIZ_QUESTION_COUNT = 7;

const DRAGON = 'dragon_flame';
const GRIZZLY = 'grizzly_might';
const OWL = 'owl_wisdom';
const PHOENIX = 'phoenix_rising';

/** Fisher-Yates shuffle — returns a new shuffled array. */
function shuffleArray(arr, random = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * One question. Answers are written in fixed guild order (Dragon, Grizzly, Owl, Phoenix)
 * and shuffled when the quiz runs; each one gives a single point to its guild.
 */
function q(id, emoji, question, [dragon, grizzly, owl, phoenix]) {
    return {
        id,
        emoji,
        question,
        options: [
            { text: dragon, guildWeights: { [DRAGON]: 1 } },
            { text: grizzly, guildWeights: { [GRIZZLY]: 1 } },
            { text: owl, guildWeights: { [OWL]: 1 } },
            { text: phoenix, guildWeights: { [PHOENIX]: 1 } },
        ],
    };
}

// ─── Pool 1: Pre-Junior (and classes still on the retired Nursery league) ────
// Ages 5–7 │ The teacher reads aloud │ 1–3 word answers, the picture does the work

const POOL_EARLY = [
    q('pj01', '🎠', 'What do you play?', ['⚽ Football', '🧱 Blocks', '🧩 Puzzles', '🎨 Painting']),
    q('pj02', '🐾', 'Pick a pet!', ['🦖 A dino', '🐶 A dog', '🐱 A cat', '🐰 A bunny']),
    q('pj03', '🌤️', 'I like…', ['🌪️ Wind', '❄️ Snow', '🌧️ Rain', '🌈 Rainbows']),
    q('pj04', '🚦', 'Let\'s go! Pick one.', ['🏎️ A fast car', '🚂 A train', '🚀 A rocket', '🎈 A balloon']),
    q('pj05', '🏡', 'My house is…', ['🏰 A castle', '🌳 A tree house', '🗼 A tall tower', '☁️ A cloud']),
    q('pj06', '🎵', 'Pick a sound!', ['🥁 Boom boom', '👏 Clap clap', '🤫 Shhh…', '🎶 La la la']),
    q('pj07', '🦸', 'My magic is…', ['💨 Super fast', '💪 Super strong', '👀 Super eyes', '🕊️ I can fly']),
    q('pj08', '🌳', 'In the park, I…', ['🏃 Run', '⛏️ Dig', '🐞 Find bugs', '🪁 Fly a kite']),
    q('pj09', '🎉', 'Party food!', ['🍿 Popcorn', '🌭 Hot dog', '🍕 Pizza', '🧁 Cupcake']),
    q('pj10', '🎁', 'Pick a present!', ['🛴 A scooter', '🎲 A game', '🔦 A torch', '🖍️ Crayons']),
    q('pj11', '🗺️', 'Let\'s go to…', ['🌋 A volcano', '🏔️ A mountain', '🐠 Under the sea', '🏖️ The beach']),
    q('pj12', '😀', 'I am…', ['🦁 Brave', '💪 Strong', '🤓 Clever', '😄 Happy']),
    q('pj13', '🌙', 'At night, I…', ['🎮 Play', '🤗 Hug', '⭐ See stars', '💭 Dream']),
    q('pj14', '🏆', 'Game time!', ['🏁 Race', '🪢 Pull', '🙈 Hide', '🫧 Bubbles']),
];

// ─── Pool 2: Junior A ────────────────────────────────────────────────────────
// Ages 7–8 │ Pre-A1 │ Questions up to 5 words, answers up to 3

const POOL_JUNIOR_A = [
    q('ja01', '🐾', 'Pick a magic pet!', ['🦖 A dino', '🐺 A wolf', '🐈‍⬛ A black cat', '🦄 A unicorn']),
    q('ja02', '🏠', 'My secret home is…', ['🌋 In a volcano', '🌳 In a tree', '🗼 In a tower', '☁️ On a cloud']),
    q('ja03', '🌤️', 'I like days with…', ['⛈️ Big storms', '❄️ Lots of snow', '🌧️ Soft rain', '☀️ Sunshine']),
    q('ja04', '🎮', 'My best game is…', ['🏁 A race', '⚽ A team game', '🧩 A puzzle', '🎨 Drawing']),
    q('ja05', '🦸', 'My superpower is…', ['⚡ Super speed', '💪 Super strength', '🔍 Super eyes', '🕊️ Flying']),
    q('ja06', '🎒', 'In my bag, I have…', ['⚽ A ball', '🪢 A long rope', '📒 A secret book', '🖍️ My crayons']),
    q('ja07', '🌙', 'At night, I like to…', ['👻 Tell scary stories', '⛺ Sleep in a tent', '⭐ Count the stars', '💭 Dream big']),
    q('ja08', '🚦', 'I want to ride…', ['🏍️ A motorbike', '🐎 A horse', '🚀 A rocket', '🎈 A big balloon']),
    q('ja09', '🏖️', 'At the beach, I…', ['🌊 Jump in waves', '🏰 Make sandcastles', '🐚 Find shells', '🪁 Fly a kite']),
    q('ja10', '🎂', 'My party has…', ['🎢 Fun rides', '🍕 Lots of pizza', '🪄 A magic show', '🎨 Face paint']),
    q('ja11', '😀', 'My friends say I am…', ['😎 Brave', '💪 Strong', '🤓 Clever', '😄 Funny']),
    q('ja12', '🖍️', 'I like to draw…', ['⚡ Lightning', '⛰️ Mountains', '🪐 Planets', '🌈 Rainbows']),
    q('ja13', '🌲', 'In the forest, I…', ['🏃 Run and jump', '🪵 Build a hut', '🦊 Look for animals', '🌸 Pick flowers']),
    q('ja14', '📅', 'Pick a season!', ['☀️ Summer', '🍂 Autumn', '❄️ Winter', '🌸 Spring']),
    q('ja15', '🎭', 'In the school play, I am…', ['⚔️ The knight', '🛡️ The guard', '🧙 The wizard', '🧚 The fairy']),
    q('ja16', '🎵', 'Pick a sound!', ['🥁 Drums', '🎸 Guitar', '🎹 Piano', '🎺 Trumpet']),
];

// ─── Pool 3: Junior B ────────────────────────────────────────────────────────
// Ages 8–9 │ Pre-A1 → A1 │ Questions up to 6 words, answers up to 4

const POOL_JUNIOR_B = [
    q('jb01', '🗺️', 'Pick a place for an adventure!', ['🌋 A volcano island', '🌲 A big forest', '🏛️ An old temple', '☁️ A city in the sky']),
    q('jb02', '🐾', 'My animal friend is…', ['🐆 A fast cheetah', '🐺 A wolf', '🐙 A clever octopus', '🦋 A butterfly']),
    q('jb03', '🪄', 'Pick a magic power!', ['⚡ Make lightning', '🪨 Lift a mountain', '🧠 Read minds', '✨ Change into animals']),
    q('jb04', '🚌', 'On a school trip, I…', ['🏃 Walk at the front', '🎒 Carry the big bag', '📸 Take lots of photos', '🎶 Sing on the bus']),
    q('jb05', '🎬', 'My favourite film has…', ['🏎️ Fast cars', '🏔️ A mountain adventure', '🕵️ A mystery', '🧚 Magic and fairies']),
    q('jb06', '🌧️', 'It\'s raining. I…', ['💦 Jump in puddles', '🛋️ Make a blanket fort', '📖 Read a book', '🖍️ Draw a rainbow']),
    q('jb07', '🏅', 'I want a prize for…', ['🏃 Running', '🧗 Climbing', '♟️ Chess', '🎤 Singing']),
    q('jb08', '🎒', 'My magic bag has…', ['🛹 A flying skateboard', '⛺ A giant tent', '🗝️ A secret key', '✏️ A magic pencil']),
    q('jb09', '🏫', 'After school, I like to…', ['⚽ Play sports', '🧱 Build things', '📚 Read comics', '🎨 Draw and paint']),
    q('jb10', '💭', 'In my dream, I…', ['🏎️ Drive a race car', '🏔️ Climb a mountain', '🛸 Meet an alien', '🕊️ Fly over the sea']),
    q('jb11', '📖', 'In a story, I am…', ['🏴‍☠️ A pirate', '🛡️ A knight', '🕵️ A detective', '🧝 An elf']),
    q('jb12', '📅', 'On Saturday, I…', ['🏊 Go swimming', '🥞 Make pancakes', '🧪 Do science', '💃 Dance']),
    q('jb13', '😀', 'I am…', ['⚡ Fast', '💪 Strong', '🤓 Clever', '😄 Happy']),
    q('jb14', '🏰', 'In the castle, I go to…', ['⚔️ The sword room', '🍗 The big kitchen', '📚 The secret library', '🗼 The top of the tower']),
    q('jb15', '🎵', 'Music makes me…', ['🤸 Jump around', '👏 Clap and stomp', '🎧 Close my eyes', '🎤 Sing out loud']),
    q('jb16', '🌊', 'Under the sea, I find…', ['🦈 A shark', '🐢 A big turtle', '🏛️ A lost city', '🐬 Dolphins']),
];

// ─── Pool 4: Level A ─────────────────────────────────────────────────────────
// Ages 9–10 │ A1 │ Questions up to 7 words, answers up to 5

const POOL_LEVEL_A = [
    q('la01', '🗺️', 'Choose your adventure!', ['🌋 Climb a volcano', '🏕️ Camp in the wild', '🗝️ Open a secret door', '🎈 Fly around the world']),
    q('la02', '🦸', 'Choose a superpower.', ['⚡ Super speed', '💪 Super strength', '🧠 Read minds', '✨ Change into any animal']),
    q('la03', '🎮', 'In a video game, I am…', ['⚔️ The fighter', '🛡️ The defender', '🧙 The wizard', '💚 The healer']),
    q('la04', '📚', 'My favourite subject is…', ['⚽ PE', '🌍 Geography', '🔬 Science', '🎨 Art']),
    q('la05', '🏆', 'I feel great when I…', ['🏁 Finish first', '🏗️ Build something big', '❓ Find the answer', '🎨 Make something new']),
    q('la06', '🏡', 'I want to live…', ['🏙️ In a big city', '🌲 Near a forest', '🏝️ On a quiet island', '🚀 On the Moon']),
    q('la07', '🎬', 'I like films with…', ['💥 Lots of action', '🦸 Superheroes', '🕵️ A big mystery', '🧚 Magic worlds']),
    q('la08', '🐾', 'Choose an animal helper!', ['🐆 A cheetah', '🦍 A gorilla', '🦊 A fox', '🦄 A unicorn']),
    q('la09', '🌧️', 'Something goes wrong. I…', ['⚡ Fix it fast', '🪨 Stay calm and strong', '🤔 Think of a plan', '🔁 Try a new way']),
    q('la10', '🚌', 'On a school trip, I want to…', ['🎢 Go to a theme park', '⛰️ Walk in the mountains', '🏛️ Visit a museum', '🐬 See dolphins']),
    q('la11', '🌙', 'At a sleepover, we…', ['👻 Tell scary stories', '🛋️ Build a pillow fort', '🔦 Play a mystery game', '💃 Have a dance party']),
    q('la12', '🎯', 'Pick a hobby!', ['🛹 Skateboarding', '🧗 Climbing', '♟️ Chess', '🎸 Music']),
    q('la13', '🏫', 'In class, I like to…', ['🙋 Answer first', '👥 Work in a team', '🧩 Solve problems', '🎭 Act and perform']),
    q('la14', '⏳', 'With a time machine, I visit…', ['🦖 The dinosaurs', '🏰 The time of knights', '🏛️ Ancient Greece', '🚀 The future']),
    q('la15', '😀', 'People say I am…', ['😎 Brave', '💪 Strong', '🤓 Clever', '😄 Fun']),
    q('la16', '🕒', 'My favourite time of day is…', ['⚡ Playtime', '🍽️ Lunchtime', '🌙 Night-time', '🌅 Sunrise']),
];

// ─── Pool 5: Level B ─────────────────────────────────────────────────────────
// Ages 10–11 │ A1+ │ Questions up to 7 words, answers up to 6

const POOL_LEVEL_B = [
    q('lb01', '🗺️', 'You find a magic map. You…', ['⚡ Go right now!', '🎒 Pack a big bag first', '🔍 Read every clue', '✏️ Draw your own map']),
    q('lb02', '🦸', 'Pick a superpower.', ['⚡ Control lightning', '🛡️ Nothing can hurt you', '🧠 Know every answer', '🕊️ Fly anywhere']),
    q('lb03', '🎮', 'In a game, your hero is…', ['⚔️ A warrior', '🛡️ A defender', '🧙 A wizard', '🏹 An archer']),
    q('lb04', '📵', 'No phone for a day! You…', ['⚽ Go out and play', '🚲 Ride your bike', '📚 Read a good book', '🎨 Draw or make music']),
    q('lb05', '🏝️', 'On a desert island, you take…', ['🏄 A surfboard', '⛺ A strong tent', '📚 A survival book', '🎸 A guitar']),
    q('lb06', '🎁', 'The best birthday present is…', ['🏆 A gold trophy', '⛺ A camping weekend', '🔭 A big telescope', '🎨 A box of art things']),
    q('lb07', '🌧️', 'When things go wrong, you…', ['⚡ Act fast', '🪨 Stay strong and calm', '🤔 Stop and think', '🌱 Start again']),
    q('lb08', '🎬', 'Your favourite kind of film is…', ['💥 Action', '🦸 Superheroes', '🕵️ Mystery', '🧚 Fantasy']),
    q('lb09', '🐾', 'Choose an animal partner.', ['🐆 A cheetah', '🐺 A wolf', '🐈‍⬛ A black cat', '🐬 A dolphin']),
    q('lb10', '🏫', 'In a group project, you…', ['📣 Present it to the class', '🧱 Build the model', '🔎 Find the information', '🎨 Make it look great']),
    q('lb11', '🏡', 'Where would you like to live?', ['🏙️ In New York', '🏔️ In the mountains', '🏝️ On a quiet island', '🚀 On Mars']),
    q('lb12', '🎵', 'Your favourite music is…', ['🎸 Rock', '🥁 Hip-hop', '🎹 Piano music', '🎤 Pop']),
    q('lb13', '🏰', 'In a fantasy world, you live…', ['🏯 In a castle on a cliff', '🌲 In a forest village', '🗼 In a tower of books', '☁️ In a city in the clouds']),
    q('lb14', '🏐', 'In a team game, you are…', ['🎯 The one who scores', '🧱 The strong defender', '🧠 The one with the plan', '🔁 The one who never stops']),
    q('lb15', '😀', 'Which word is most like you?', ['😎 Bold', '💪 Strong', '🔍 Curious', '🌈 Positive']),
    q('lb16', '☀️', 'On Sunday morning, you…', ['⚽ Play a match', '🥞 Make a big breakfast', '🛏️ Read in bed', '🎨 Start something new']),
];

// ─── Pool 6: Levels C & D (senior) ───────────────────────────────────────────
// Ages 11–13 │ A2 │ Teen topics in A2 words: questions up to 8 words, answers up to 6

const POOL_SENIOR = [
    q('cd01', '🎮', 'Pick your game character.', ['⚔️ The fighter', '🛡️ The tank', '🧙 The mage', '💚 The healer']),
    q('cd02', '📵', 'No phone for a weekend! You…', ['⚽ Play sports all day', '🏕️ Go camping', '📚 Read or learn something', '🎨 Make art or music']),
    q('cd03', '🦸', 'Choose one superpower.', ['⚡ Super speed', '💪 Super strength', '🧠 Read minds', '⏪ Go back in time']),
    q('cd04', '✈️', 'Your dream trip is…', ['🏎️ A road trip in the USA', '⛺ Camping in Canada', '🏯 Exploring Japan', '🌍 A trip around the world']),
    q('cd05', '🌧️', 'Bad day? What helps you most?', ['🏃 Sport', '🍕 Good food', '🎧 Music and quiet time', '😴 Sleep. Tomorrow is new!']),
    q('cd06', '📺', 'Pick a series for tonight.', ['💥 Action', '🏝️ Survival', '🕵️ Crime mystery', '🧙 Fantasy']),
    q('cd07', '🏅', 'What makes you proud?', ['🥇 Winning', '🏋️ Getting stronger', '💡 Learning something hard', '🌱 Changing for the better']),
    q('cd08', '🧩', 'A hard problem in class. You…', ['⚡ Try your first idea', '🪨 Keep going until it\'s done', '🤔 Look for a clever way', '🔄 Try something different']),
    q('cd09', '🐾', 'Your spirit animal is…', ['🐆 A panther', '🐺 A wolf', '🦊 A fox', '🐬 A dolphin']),
    q('cd10', '🏙️', 'In the future, you live…', ['🏙️ In a big, busy city', '🏔️ Near the mountains', '🌊 By a quiet sea', '🚀 On Mars. Why not?']),
    q('cd11', '🎉', 'At the school party, you…', ['💃 Dance first', '🍕 Stay near the food', '🎧 Choose the music', '🎤 Sing karaoke']),
    q('cd12', '📚', 'Your favourite subject is…', ['⚽ PE', '📜 History', '💻 Computers', '🎨 Art']),
    q('cd13', '⏳', 'You can visit any time. You choose…', ['🦖 Dinosaur times', '🏺 Ancient Egypt', '🏛️ Ancient Greece', '🚀 The year 3000']),
    q('cd14', '💬', 'Your friends come to you for…', ['😂 Fun', '🛡️ Help', '💡 Advice', '😊 Good vibes']),
    q('cd15', '🧗', 'Pick a challenge.', ['🏎️ Drive a race car', '🧗 Climb a mountain', '🔐 Solve an escape room', '🪂 Jump from a plane']),
    q('cd16', '🎒', 'Your bag always has…', ['🎧 Headphones', '🍫 Snacks', '📓 A notebook', '🖊️ Colourful pens']),
    q('cd17', '🎯', 'Your goal this year is…', ['🏆 To be the best', '💪 To get stronger', '📖 To learn more', '🌱 To try new things']),
    q('cd18', '🌟', 'One word for you?', ['😎 Fearless', '💪 Strong', '🧠 Smart', '🌈 Positive']),
];

// ─── Pools, scoring and assignment ───────────────────────────────────────────

/** Default quiz question set (Level A pool, used when questLevel is unknown). */
export const SORTING_QUIZ_QUESTIONS = POOL_LEVEL_A;

/** Every pool by league, for tests and tooling. */
export const SORTING_QUIZ_POOLS = {
    'Pre-Junior': POOL_EARLY,
    'Junior A': POOL_JUNIOR_A,
    'Junior B': POOL_JUNIOR_B,
    A: POOL_LEVEL_A,
    B: POOL_LEVEL_B,
    'C/D': POOL_SENIOR,
};

/**
 * Returns the full age/league-appropriate question pool for the sorting quiz.
 * @param {string} [questLevel] - a value from the ordered Quest League catalogue
 * @returns {Array}
 */
export function getQuestionsForLevel(questLevel) {
    if (!questLevel) return POOL_LEVEL_A;
    const level = String(questLevel).trim();
    if (level === 'Nursery' || level === 'Pre-Junior') return POOL_EARLY;
    if (level === 'Junior A') return POOL_JUNIOR_A;
    if (level === 'Junior B') return POOL_JUNIOR_B;
    if (level === 'A') return POOL_LEVEL_A;
    if (level === 'B') return POOL_LEVEL_B;
    if (['C', 'D'].includes(level)) return POOL_SENIOR;
    return POOL_LEVEL_A;
}

/**
 * Returns a randomly selected, option-shuffled set of questions for the given level.
 * Each call produces a unique, personalised quiz even within the same class.
 * @param {string} [questLevel]
 * @param {number} [count]
 * @param {() => number} [random]
 * @returns {Array}
 */
export function getRandomizedQuestionsForLevel(questLevel, count = QUIZ_QUESTION_COUNT, random = Math.random) {
    const pool = getQuestionsForLevel(questLevel);
    const shuffledPool = shuffleArray(pool, random);
    const selected = shuffledPool.slice(0, Math.min(count, shuffledPool.length));
    return selected.map(question => ({ ...question, options: shuffleArray(question.options, random) }));
}

/**
 * Points per guild for the answers given.
 * @param {Array<number>} selectedOptionIndices - Per-question selected option index (0-based)
 * @param {Array} questions - The exact question set shown
 * @returns {Record<string, number>}
 */
export function scoreQuizAnswers(selectedOptionIndices, questions = POOL_LEVEL_A) {
    const scores = Object.fromEntries(GUILD_IDS.map((gid) => [gid, 0]));
    (questions || POOL_LEVEL_A).forEach((question, qIndex) => {
        const option = question.options?.[selectedOptionIndices?.[qIndex]];
        if (!option?.guildWeights) return;
        Object.entries(option.guildWeights).forEach(([gid, w]) => {
            if (gid in scores && Number.isFinite(w)) scores[gid] += w;
        });
    });
    return scores;
}

/**
 * Assign a guild from quiz answers: the guild with the most points.
 * A tie never defaults to one fixed house (that used to favour Dragon Flame and
 * Grizzly Might): it goes to the tied guild with the fewest members in the
 * student's class, and if that is still level, to a random one of them.
 * @param {Array<number>} selectedOptionIndices - Per-question selected option index (0-based)
 * @param {Record<string, number>|null} [classGuildCounts] - guildId → classmates already in it
 * @param {Array} [questions] - The exact question set shown (defaults to POOL_LEVEL_A)
 * @param {() => number} [random]
 * @returns {string} guildId
 */
export function assignGuildFromQuizResults(selectedOptionIndices, classGuildCounts = null, questions = POOL_LEVEL_A, random = Math.random) {
    const scores = scoreQuizAnswers(selectedOptionIndices, questions);
    const best = Math.max(...GUILD_IDS.map((gid) => scores[gid]));
    let tied = GUILD_IDS.filter((gid) => scores[gid] === best);
    if (tied.length > 1 && classGuildCounts && typeof classGuildCounts === 'object') {
        const sizeOf = (gid) => Number(classGuildCounts[gid]) || 0;
        const smallest = Math.min(...tied.map(sizeOf));
        tied = tied.filter((gid) => sizeOf(gid) === smallest);
    }
    return tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
}
