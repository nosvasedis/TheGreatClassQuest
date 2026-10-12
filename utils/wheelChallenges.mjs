// Fortune's Wheel challenges: the questions, dares and lightning rounds the Trials (and
// "Brave the storm") put to a guild. Short English tasks the teacher can judge at a glance.
// Four age bands, as in features/languageScaffolds.mjs: e = Pre-Junior (spoken only: point, say,
// sing), j = Junior A/B, m = A/B, u = C/D. The wheel can also pass `extra` questions from the
// Grammar Forge (the class's own book grammar), which then make up most of the riddles.

import { getLeagueBand } from '../features/languageScaffolds.mjs';

const RIDDLES = {
    e: [
        { q: 'Point to something red in the classroom and say "Red!"', a: 'Red! (anything red)' },
        { q: 'How many legs has a cat? Show it with your fingers!', a: 'Four' },
        { q: 'Which animal says "moo"?', a: 'A cow' },
        { q: 'What is the opposite of "big"? Show it with your hands!', a: 'Small / little' },
        { q: 'Touch your nose, then your ears. What are they?', a: 'Nose, ears' },
        { q: 'What colour is a banana?', a: 'Yellow' },
        { q: 'Count from 1 to 10 together!', a: '1, 2, 3 … 10' },
        { q: 'What do we say when we get a present?', a: 'Thank you!' },
        { q: 'Which animal says "woof"?', a: 'A dog' },
        { q: 'What colour is the grass?', a: 'Green' },
        { q: 'Show me "happy" and "sad" faces and say them!', a: 'Happy! Sad!' },
        { q: 'What do we say in the morning?', a: 'Good morning!' },
    ],
    j: [
        { q: 'What colour is the sky on a sunny day?', a: 'Blue' },
        { q: 'How many legs does a spider have?', a: 'Eight' },
        { q: 'What is the opposite of "hot"?', a: 'Cold' },
        { q: 'What do bees make?', a: 'Honey' },
        { q: 'What comes after Tuesday?', a: 'Wednesday' },
        { q: 'Spell the word "CAT".', a: 'C-A-T' },
        { q: 'How many days are there in a week?', a: 'Seven' },
        { q: 'What do you wear on your feet?', a: 'Shoes / socks' },
        { q: 'Which fruit is long and yellow?', a: 'A banana' },
        { q: 'What is the plural of "child"?', a: 'Children' },
        { q: 'Which month comes after June?', a: 'July' },
        { q: 'What colour do you get with blue and yellow?', a: 'Green' },
        { q: 'Where does a fish live?', a: 'In the water / the sea' },
        { q: 'Spell the word "DOG".', a: 'D-O-G' },
    ],
    m: [
        { q: 'What is the past tense of "go"?', a: 'Went' },
        { q: 'Spell the word "because".', a: 'B-E-C-A-U-S-E' },
        { q: 'Give the plural of "mouse".', a: 'Mice' },
        { q: 'Which word is the odd one out: apple, carrot, banana, cherry?', a: 'Carrot (not a fruit)' },
        { q: 'What is the comparative of "good"?', a: 'Better' },
        { q: 'Spell the word "Wednesday".', a: 'W-E-D-N-E-S-D-A-Y' },
        { q: 'What do we call a person who writes books?', a: 'An author / a writer' },
        { q: 'Give a synonym for "happy".', a: 'Glad, cheerful, joyful…' },
        { q: 'What is the superlative of "bad"?', a: 'The worst' },
        { q: 'What is the past tense of "bring"?', a: 'Brought' },
        { q: 'Make a question with "How often…?"', a: 'Any correct question' },
        { q: 'What is the opposite of "ancient"?', a: 'Modern / new' },
    ],
    u: [
        { q: 'What is the past participle of "write"?', a: 'Written' },
        { q: 'Say a sentence with "although".', a: 'Any correct sentence' },
        { q: 'Turn into the passive: "Someone stole my bike."', a: 'My bike was stolen.' },
        { q: 'Which is correct: "I have lived here since/for five years"?', a: 'For' },
        { q: 'Spell the word "necessary".', a: 'N-E-C-E-S-S-A-R-Y' },
        { q: 'Finish the sentence: "If I had wings, I…"', a: 'would fly… (any correct ending)' },
        { q: 'Give a word that means "very tired".', a: 'Exhausted' },
        { q: 'Report it: "I am hungry," said Nick.', a: 'Nick said (that) he was hungry.' },
        { q: 'Give the opposite of "generous".', a: 'Mean / selfish' },
        { q: 'Spell the word "environment".', a: 'E-N-V-I-R-O-N-M-E-N-T' },
        { q: 'Which phrasal verb means "to continue"?', a: 'Carry on / go on' },
        { q: 'Add the tag: "You\'ve met her before, …?"', a: 'haven\'t you?' },
    ],
};

const DARES = {
    e: [
        'Sing "Hello, hello!" all together!',
        'Jump three times and count "One, two, three!"',
        'Clap and say your name, one by one.',
        'Show me a lion and roar like a lion!',
        'Touch your head, shoulders, knees and toes, and say them!',
        'Wave and say "Goodbye!" in a tiny voice, then a giant voice.',
        'Point to three colours and say them.',
        'Hop like a rabbit and say "I can hop!"',
        'Say "I\'m happy!" with your biggest smile.',
        'Show five fingers and count them in English.',
    ],
    j: [
        'Say three animals in English, as fast as you can!',
        'Count from 1 to 10 while jumping!',
        'Name three colours you can see in the classroom.',
        'Say "Hello, my name is…" in a robot voice.',
        'Name two fruits and two vegetables.',
        'Spell your first name out loud.',
        'Sing the first line of any English song.',
        'Point to and name three things on the teacher\'s desk.',
        'Say the days of the week from Monday.',
        'Name four body parts and touch each one.',
        'Make the sound of three animals and say their names.',
    ],
    m: [
        'Name five jobs in English in 15 seconds.',
        'Say the months of the year backwards from December.',
        'Tell the class one thing you did yesterday, in the past tense.',
        'Give three words that rhyme with "light".',
        'Say three things you are going to do this summer.',
        'Spell your full name and your street name.',
        'Give a compliment to the guild that spun before you, in English.',
        'Describe the person next to you in three adjectives.',
        'Name five irregular verbs and their past tense.',
        'Describe your perfect weekend in three sentences.',
    ],
    u: [
        'Tell a 3-sentence story that starts with "Suddenly…".',
        'Explain the word "brave" without saying "brave".',
        'Give the class a 20-second weather forecast for tomorrow.',
        'Persuade the teacher to give no homework, in three sentences.',
        'Say three things you have never done but would like to.',
        'Describe your favourite place without naming it. The class guesses.',
        'Give a compliment to the guild that spun before you, in English.',
        'Say three sentences with "If I were the teacher, I would…".',
        'Name five irregular verbs with their past and past participle.',
        'Retell a famous fairy tale in four sentences.',
    ],
};

const LIGHTNING = {
    e: [
        { n: 3, what: 'animals' },
        { n: 3, what: 'colours' },
        { n: 3, what: 'fruits' },
        { n: 3, what: 'toys' },
        { n: 3, what: 'body parts (touch them!)' },
        { n: 3, what: 'things in the classroom (point to them!)' },
        { n: 3, what: 'family words (mum, dad…)' },
        { n: 3, what: 'numbers' },
    ],
    j: [
        { n: 5, what: 'animals' },
        { n: 5, what: 'colours' },
        { n: 4, what: 'fruits' },
        { n: 5, what: 'things in a classroom' },
        { n: 5, what: 'body parts' },
        { n: 4, what: 'things you can eat for breakfast' },
        { n: 5, what: 'numbers above twenty' },
        { n: 4, what: 'clothes' },
    ],
    m: [
        { n: 6, what: 'verbs in the past tense' },
        { n: 6, what: 'jobs' },
        { n: 6, what: 'words about the weather' },
        { n: 5, what: 'sports' },
        { n: 6, what: 'things you find in a kitchen' },
        { n: 5, what: 'words that start with "th"' },
        { n: 6, what: 'adjectives that describe people' },
        { n: 5, what: 'countries and their languages' },
    ],
    u: [
        { n: 6, what: 'feelings' },
        { n: 5, what: 'phrasal verbs (get up, look for…)' },
        { n: 6, what: 'irregular past participles' },
        { n: 5, what: 'words about the environment' },
        { n: 6, what: 'adjectives ending in -ful or -less' },
        { n: 5, what: 'jobs that end in -er or -or' },
        { n: 5, what: 'words about technology' },
        { n: 6, what: 'adverbs ending in -ly' },
    ],
};

export const CHALLENGE_BANDS = Object.freeze(['e', 'j', 'm', 'u']);
export const CHALLENGE_SECONDS = { riddle: 20, dare: 30, lightning: 30 };

/** The band for a Quest League: 'e' | 'j' | 'm' | 'u' (no league: 'm'). */
export function challengeBand(leagueLevel) {
    if (!leagueLevel) return 'm';
    return { early: 'e', junior: 'j', mid: 'm', upper: 'u' }[getLeagueBand(leagueLevel)] || 'm';
}

/** Older callers said 'young' and 'older'. */
function normBand(band) {
    if (CHALLENGE_BANDS.includes(band)) return band;
    return band === 'young' ? 'j' : 'm';
}

function pick(list, rng, avoid) {
    const choices = list.filter((item) => item !== avoid);
    return choices[Math.floor(rng() * choices.length)] || list[0];
}

/**
 * One challenge of a kind for a band, never the same as `previous` (for "another one").
 * `extra`: questions { q, a } from the class's own grammar; when there are some, about two riddles
 * in three come from them.
 * @returns {{ kind: string, text: string, answer?: string, seconds: number, forge?: boolean }}
 */
export function drawChallenge(kind, band = 'm', { rng = Math.random, previous = null, extra = [] } = {}) {
    const b = normBand(band);
    if (kind === 'dare') {
        const text = pick(DARES[b], rng, previous?.text);
        return { kind, text, seconds: CHALLENGE_SECONDS.dare };
    }
    if (kind === 'lightning') {
        const item = pick(LIGHTNING[b], rng, LIGHTNING[b].find((l) => previous?.text?.includes(l.what)));
        return { kind, text: `Name ${item.n} ${item.what} before the time runs out!`, seconds: CHALLENGE_SECONDS.lightning };
    }
    const forge = (Array.isArray(extra) ? extra : []).filter((x) => x?.q && x?.a && x.q !== previous?.text);
    if (forge.length && rng() < 2 / 3) {
        const item = forge[Math.floor(rng() * forge.length)];
        return { kind: 'riddle', text: item.q, answer: item.a, seconds: CHALLENGE_SECONDS.riddle, forge: true };
    }
    const item = pick(RIDDLES[b], rng, RIDDLES[b].find((r) => r.q === previous?.text));
    return { kind: 'riddle', text: item.q, answer: item.a, seconds: CHALLENGE_SECONDS.riddle };
}

/** The whole bank (for the guidebook and tests). */
export function challengeBank() {
    return { riddles: RIDDLES, dares: DARES, lightning: LIGHTNING };
}
