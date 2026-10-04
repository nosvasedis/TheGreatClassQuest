// Fortune's Wheel challenges: the questions, dares and lightning rounds the Trials (and
// "Brave the storm") put to a guild. Short English tasks the teacher can judge at a glance.
// Two age bands: young (Pre-Junior, Junior A and B) and older (A to D).

const RIDDLES = {
    young: [
        { q: 'What colour is the sky on a sunny day?', a: 'Blue' },
        { q: 'How many legs does a spider have?', a: 'Eight' },
        { q: 'What is the opposite of "big"?', a: 'Small / little' },
        { q: 'What do bees make?', a: 'Honey' },
        { q: 'Which animal says "moo"?', a: 'A cow' },
        { q: 'What comes after Tuesday?', a: 'Wednesday' },
        { q: 'Spell the word "CAT".', a: 'C-A-T' },
        { q: 'What is the opposite of "hot"?', a: 'Cold' },
        { q: 'How many days are there in a week?', a: 'Seven' },
        { q: 'What do you wear on your feet?', a: 'Shoes / socks' },
        { q: 'Which fruit is long and yellow?', a: 'A banana' },
        { q: 'What is the plural of "child"?', a: 'Children' },
        { q: 'Count from 10 down to 1, together!', a: '10, 9, 8 … 1' },
        { q: 'What do we say when we get a present?', a: 'Thank you' },
        { q: 'Which month comes after June?', a: 'July' },
        { q: 'Spell the word "DOG".', a: 'D-O-G' },
        { q: 'What colour do you get with blue and yellow?', a: 'Green' },
        { q: 'Where does a fish live?', a: 'In the water / the sea' },
    ],
    older: [
        { q: 'What is the past tense of "go"?', a: 'Went' },
        { q: 'Spell the word "because".', a: 'B-E-C-A-U-S-E' },
        { q: 'What is the opposite of "ancient"?', a: 'Modern / new' },
        { q: 'Give the plural of "mouse".', a: 'Mice' },
        { q: 'What is the past participle of "write"?', a: 'Written' },
        { q: 'Which word is the odd one out: apple, carrot, banana, cherry?', a: 'Carrot (not a fruit)' },
        { q: 'Make a question with "How often…?"', a: 'Any correct question' },
        { q: 'What is the comparative of "good"?', a: 'Better' },
        { q: 'Spell the word "Wednesday".', a: 'W-E-D-N-E-S-D-A-Y' },
        { q: 'Say a sentence with "although".', a: 'Any correct sentence' },
        { q: 'What do we call a person who writes books?', a: 'An author / a writer' },
        { q: 'Give a synonym for "happy".', a: 'Glad, cheerful, joyful…' },
        { q: 'What is the superlative of "bad"?', a: 'The worst' },
        { q: 'Turn into the passive: "Someone stole my bike."', a: 'My bike was stolen.' },
        { q: 'What is the past tense of "bring"?', a: 'Brought' },
        { q: 'Which is correct: "I have lived here since/for five years"?', a: 'For' },
        { q: 'Spell the word "necessary".', a: 'N-E-C-E-S-S-A-R-Y' },
        { q: 'Finish the sentence: "If I had wings, I…"', a: 'would fly… (any correct ending)' },
    ],
};

const DARES = {
    young: [
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
        'Say what you had for breakfast, in English.',
        'Make the sound of three animals and say their names.',
    ],
    older: [
        'Describe your perfect weekend in three sentences.',
        'Name five jobs in English in 15 seconds.',
        'Say the months of the year backwards from December.',
        'Tell the class one thing you did yesterday, in the past tense.',
        'Give three words that rhyme with "light".',
        'Explain the word "brave" without saying "brave".',
        'Say three things you are going to do this summer.',
        'Spell your full name and your street name.',
        'Give a compliment to the guild that spun before you, in English.',
        'Name five irregular verbs and their past tense.',
        'Describe the person next to you in three adjectives.',
        'Tell a 3-sentence story that starts with "Suddenly…".',
    ],
};

const LIGHTNING = {
    young: [
        { n: 5, what: 'animals' },
        { n: 5, what: 'colours' },
        { n: 4, what: 'fruits' },
        { n: 5, what: 'things in a classroom' },
        { n: 4, what: 'toys' },
        { n: 5, what: 'body parts' },
        { n: 4, what: 'family words (mum, dad…)' },
        { n: 4, what: 'things you can eat for breakfast' },
        { n: 5, what: 'numbers above twenty' },
        { n: 4, what: 'clothes' },
    ],
    older: [
        { n: 6, what: 'verbs in the past tense' },
        { n: 6, what: 'jobs' },
        { n: 5, what: 'countries and their languages' },
        { n: 6, what: 'adjectives that describe people' },
        { n: 6, what: 'words about the weather' },
        { n: 5, what: 'sports' },
        { n: 6, what: 'things you find in a kitchen' },
        { n: 5, what: 'words that start with "th"' },
        { n: 6, what: 'feelings' },
        { n: 5, what: 'phrasal verbs (get up, look for…)' },
    ],
};

export const CHALLENGE_SECONDS = { riddle: 20, dare: 30, lightning: 30 };

/** 'young' for the young-learner leagues, otherwise 'older'. */
export function challengeBand(leagueLevel, youngLeagues = []) {
    return youngLeagues.includes(leagueLevel) ? 'young' : 'older';
}

function pick(list, rng, avoid) {
    const choices = list.filter((item) => item !== avoid);
    return choices[Math.floor(rng() * choices.length)] || list[0];
}

/**
 * One challenge of a kind for a band, never the same as `previous` (for "another one").
 * @returns {{ kind: string, text: string, answer?: string, seconds: number }}
 */
export function drawChallenge(kind, band = 'older', { rng = Math.random, previous = null } = {}) {
    const b = band === 'young' ? 'young' : 'older';
    if (kind === 'dare') {
        const text = pick(DARES[b], rng, previous?.text);
        return { kind, text, seconds: CHALLENGE_SECONDS.dare };
    }
    if (kind === 'lightning') {
        const item = pick(LIGHTNING[b], rng, LIGHTNING[b].find((l) => previous?.text?.includes(l.what)));
        return { kind, text: `Name ${item.n} ${item.what} before the time runs out!`, seconds: CHALLENGE_SECONDS.lightning };
    }
    const item = pick(RIDDLES[b], rng, RIDDLES[b].find((r) => r.q === previous?.text));
    return { kind: 'riddle', text: item.q, answer: item.a, seconds: CHALLENGE_SECONDS.riddle };
}

/** The whole bank (for the guidebook and tests). */
export function challengeBank() {
    return { riddles: RIDDLES, dares: DARES, lightning: LIGHTNING };
}
