/**
 * Language scaffolds shared by Story Weavers and Projector Mode.
 * Pure data + helpers (no DOM, no Firestore); covered by tests/language-scaffolds.test.mjs.
 *
 * Bands follow the Quest Leagues:
 *   early  = Nursery, Pre-Junior        (pre-A1, mostly oral)
 *   junior = Junior A, Junior B          (pre-A1 → A1)
 *   mid    = A, B                        (A1 → A2)
 *   upper  = C, D, E                     (A2 → B1+)
 *   exam   = Lower, Proficiency          (B2 / C2 exam classes)
 */

const LEAGUE_BANDS = Object.freeze({
    'Nursery': 'early',
    'Pre-Junior': 'early',
    'Junior A': 'junior',
    'Junior B': 'junior',
    'A': 'mid',
    'B': 'mid',
    'C': 'upper',
    'D': 'upper',
    'E': 'upper',
    'Lower': 'exam',
    'Proficiency': 'exam'
});

export function getLeagueBand(league) {
    return LEAGUE_BANDS[String(league || '').trim()] || 'mid';
}

// ─── Story Weavers: sentence starters ────────────────────────────────────────
export const SENTENCE_STARTERS = Object.freeze({
    early: ['I see a…', 'It is…', 'The cat…', 'Look! A…', 'I like…', 'It can…', 'Hello,…', 'The big…'],
    junior: ['One day,…', 'Suddenly,…', 'Then the…', 'The little…', 'Look! There is…', 'At night,…', 'She can…', 'He has got…', 'They are happy because…'],
    mid: ['Once upon a time,…', 'Suddenly,…', 'After that,…', 'While they were…', 'The next morning,…', 'Luckily,…', 'Unfortunately,…', 'In the end,…', 'Everyone was surprised when…'],
    upper: ['Without warning,…', 'Meanwhile,…', 'Although they were scared,…', 'By the time they arrived,…', 'If only they had…', 'Just as the sun set,…', 'Little did they know that…', 'Despite the storm,…', 'It was the first time that…'],
    exam: ['No sooner had they…', 'Not until the lights went out did…', 'Had they known,…', 'Little did anyone suspect that…', 'Were it not for…', 'Only when…', 'What nobody expected was…', 'Hardly had the door closed when…', 'It was not until dawn that…']
});

// ─── Story Weavers: structure hints (one pattern per line, per league) ──────
export const STRUCTURE_HINTS = Object.freeze({
    'Nursery': [
        { label: 'Colours + things', pattern: 'a + colour + thing', example: 'a red apple' },
        { label: 'Big and small', pattern: 'It is big / It is small', example: 'The dragon is big!' }
    ],
    'Pre-Junior': [
        { label: 'This is…', pattern: 'This is + a/an + thing', example: 'This is a magic box.' },
        { label: 'Can / can\'t', pattern: 'It can + verb', example: 'The bird can fly.' },
        { label: 'In / on / under', pattern: 'in / on / under the + place', example: 'The key is under the bed.' }
    ],
    'Junior A': [
        { label: 'Am / is / are', pattern: 'I am / He is / They are', example: 'They are brave friends.' },
        { label: 'Present simple', pattern: 'she/he + verb-s', example: 'The fox runs to the river.' },
        { label: 'Have got', pattern: 'has got / have got', example: 'The wizard has got a blue hat.' }
    ],
    'Junior B': [
        { label: 'Was / were', pattern: 'was / were + adjective', example: 'The forest was dark and quiet.' },
        { label: 'Articles', pattern: 'a / an + noun', example: 'They found an old map.' },
        { label: 'Prepositions', pattern: 'in / on / under / next to', example: 'The treasure was next to the tree.' }
    ],
    'A': [
        { label: 'Past simple', pattern: 'verb-ed / irregular past', example: 'The knight opened the door and saw a dragon.' },
        { label: 'There was / were', pattern: 'There was a… / There were some…', example: 'There were three glowing stones.' },
        { label: 'Comparatives', pattern: 'bigger / faster / more … than', example: 'The river was wider than a road.' }
    ],
    'B': [
        { label: 'Past continuous', pattern: 'was/were + verb-ing, when + past', example: 'They were sleeping when the bell rang.' },
        { label: 'Future plans', pattern: 'going to + verb', example: 'We are going to find the lost city.' },
        { label: 'Linking words', pattern: 'and / but / because / so', example: 'It was late, so they lit a torch.' }
    ],
    'C': [
        { label: 'Present perfect', pattern: 'have/has + past participle', example: 'Nobody has ever opened this gate.' },
        { label: '1st conditional', pattern: 'If + present, … will + verb', example: 'If we cross the bridge, the troll will wake up.' },
        { label: 'Relative clauses', pattern: 'who / which / that', example: 'The girl who found the key smiled.' }
    ],
    'D': [
        { label: 'Past perfect', pattern: 'had + past participle', example: 'The ship had already left when they arrived.' },
        { label: '2nd conditional', pattern: 'If + past, … would + verb', example: 'If I had wings, I would fly over the wall.' },
        { label: 'Passive voice', pattern: 'was/were + past participle', example: 'The castle was built by giants.' }
    ],
    'E': [
        { label: '3rd conditional', pattern: 'If + had + p.p., … would have + p.p.', example: 'If they had listened, they would have escaped.' },
        { label: 'Wish / if only', pattern: 'wish + past / past perfect', example: 'She wished she had brought a lantern.' },
        { label: 'Reported speech', pattern: 'said (that) + backshift', example: 'The guard said that the gate was locked.' }
    ],
    'Lower': [
        { label: 'Participle clauses', pattern: 'Having + p.p., … / -ing, …', example: 'Having crossed the desert, they rested at last.' },
        { label: 'Modals of deduction', pattern: 'must / might / can\'t have + p.p.', example: 'Someone must have opened the vault.' },
        { label: 'Causative', pattern: 'have/get + object + p.p.', example: 'The queen had the map redrawn.' }
    ],
    'Proficiency': [
        { label: 'Inversion', pattern: 'Never / Rarely / Not only + auxiliary + subject', example: 'Never had the valley seemed so silent.' },
        { label: 'Cleft sentences', pattern: 'It was … that / What … was …', example: 'What frightened them most was the silence.' },
        { label: 'Mixed conditionals', pattern: 'If + past perfect, … would + verb', example: 'Had she kept the ring, she would be queen today.' }
    ]
});

// ─── Dialogic reading prompts (CROWD) for the Story Reveal ──────────────────
// Completion, Recall, Open-ended, Wh- questions, Distancing (Whitehurst's dialogic reading).
export const DIALOGIC_PROMPT_TYPES = Object.freeze({
    completion: { icon: '🧩', label: 'Finish it' },
    recall: { icon: '🔁', label: 'Remember' },
    open: { icon: '💭', label: 'Imagine' },
    wh: { icon: '❓', label: 'Wh- question' },
    distancing: { icon: '🪞', label: 'You and me' }
});

export const DIALOGIC_PROMPTS = Object.freeze({
    early: {
        completion: ['Say it with me: "The …"', 'Point and say: what colour is it?'],
        recall: ['Who is in our story?', 'What animal did we see?'],
        open: ['Show me with your hands: is it big or small?', 'Make the sound of our story!'],
        wh: ['What is this?', 'Where is it?'],
        distancing: ['Do you like it? Yes or no?', 'Have you got one at home?']
    },
    junior: {
        completion: ['Finish the sentence: "The … is …"', 'Can you say our word, "{word}", in a new sentence?'],
        recall: ['What happened first in our story?', 'Who can remember the word of the day?'],
        open: ['What can you see in the picture?', 'What happens next? Tell your partner.'],
        wh: ['Where are they now?', 'Why is the character happy or sad?'],
        distancing: ['Are you like this character? Why?', 'Have you ever been to a place like this?']
    },
    mid: {
        completion: ['Finish the sentence with "because…"', 'Use "{word}" in a sentence about the picture.'],
        recall: ['Tell the story so far in three sentences.', 'What problem does the hero have?'],
        open: ['What do you think happens next? Why?', 'Describe the picture with two adjectives.'],
        wh: ['Why did the character do that?', 'How do they feel now? How do you know?'],
        distancing: ['What would you do in this situation?', 'Does this remind you of a film or book?']
    },
    upper: {
        completion: ['Continue the story using "{word}" and a linking word.', 'Finish: "If I were the hero, I would…"'],
        recall: ['Summarise the story in one sentence.', 'Which moment changed the story most?'],
        open: ['Predict the ending. What clues support your idea?', 'Describe the scene for someone who cannot see it.'],
        wh: ['Why do you think the author chose this setting?', 'How has the main character changed?'],
        distancing: ['Would you trust this character? Why or why not?', 'Have you ever had to make a choice like this?']
    },
    exam: {
        completion: ['Rewrite the last line starting with "Never…" or "Hardly…".', 'Use "{word}" in a sentence with a conditional.'],
        recall: ['What is the turning point so far?', 'Which detail foreshadows the ending?'],
        open: ['Argue for two different endings. Which is more convincing?', 'What theme is the story exploring?'],
        wh: ['What is the tone, and which words create it?', 'Why might a reader sympathise with the antagonist?'],
        distancing: ['How would this story change if it were set today?', 'Which character\'s values are closest to yours?']
    }
});

// ─── Projector: grammar nuggets ──────────────────────────────────────────────
export const GRAMMAR_NUGGETS = Object.freeze({
    early: [
        { title: 'One and many', rule: 'one cat → two cats', example: 'I see three stars!' },
        { title: 'Colours come first', rule: 'a blue bird (not a bird blue)', example: 'a green frog' }
    ],
    junior: [
        { title: 'He / she + s', rule: 'I play → she plays', example: 'My brother likes pizza.' },
        { title: 'a or an?', rule: 'an before a, e, i, o, u sounds', example: 'an apple, a banana' },
        { title: 'Can + verb', rule: 'can + verb (no "to")', example: 'I can swim.' }
    ],
    mid: [
        { title: 'Past simple', rule: 'regular verbs + -ed', example: 'We played football yesterday.' },
        { title: 'Comparatives', rule: 'short: -er / long: more …', example: 'A cheetah is faster than a horse.' },
        { title: 'Some or any?', rule: 'some (+) / any (? and -)', example: 'Is there any milk? There is some.' }
    ],
    upper: [
        { title: 'Present perfect', rule: 'have/has + past participle for experience', example: 'I have never seen snow.' },
        { title: 'Used to', rule: 'past habits that stopped', example: 'I used to hate spinach.' },
        { title: 'Zero vs 1st conditional', rule: 'facts vs real future possibility', example: 'If it rains, we will stay in.' }
    ],
    exam: [
        { title: 'Inversion', rule: 'negative adverbial + auxiliary + subject', example: 'Rarely have I seen such courage.' },
        { title: 'Wish + would', rule: 'annoyance with someone else\'s habit', example: 'I wish you would stop tapping.' },
        { title: 'Mixed conditional', rule: 'past cause → present result', example: 'If I had studied, I would be ready now.' }
    ]
});

// ─── Projector: minimal pairs (typical Greek-L1 sound contrasts) ────────────
export const MINIMAL_PAIRS = Object.freeze({
    junior: [
        { a: 'ship', b: 'sheep', sound: '/ɪ/ vs /iː/' },
        { a: 'sit', b: 'seat', sound: '/ɪ/ vs /iː/' },
        { a: 'sip', b: 'ship', sound: '/s/ vs /ʃ/' },
        { a: 'hat', b: 'at', sound: '/h/ at the start' },
        { a: 'full', b: 'fool', sound: '/ʊ/ vs /uː/' }
    ],
    mid: [
        { a: 'live', b: 'leave', sound: '/ɪ/ vs /iː/' },
        { a: 'sea', b: 'she', sound: '/s/ vs /ʃ/' },
        { a: 'chip', b: 'ship', sound: '/tʃ/ vs /ʃ/' },
        { a: 'cheap', b: 'jeep', sound: '/tʃ/ vs /dʒ/' },
        { a: 'cat', b: 'cut', sound: '/æ/ vs /ʌ/' }
    ],
    upper: [
        { a: 'bit', b: 'beat', sound: '/ɪ/ vs /iː/' },
        { a: 'pull', b: 'pool', sound: '/ʊ/ vs /uː/' },
        { a: 'watch', b: 'wash', sound: '/tʃ/ vs /ʃ/' },
        { a: 'bag', b: 'back', sound: '/g/ vs /k/ at the end' },
        { a: 'bad', b: 'bed', sound: '/æ/ vs /e/' }
    ]
});

// ─── Projector: classroom English ────────────────────────────────────────────
export const CLASSROOM_LANGUAGE = Object.freeze({
    early: ['Hello, teacher!', 'Thank you!', 'Can I have…, please?', 'My turn!', 'Look!'],
    junior: ['Can you help me, please?', 'How do you say … in English?', 'Can I go to the toilet, please?', 'I don\'t understand.', 'Can you repeat, please?'],
    mid: ['Could you say that again, please?', 'What does … mean?', 'Can I work with…?', 'I think the answer is… because…', 'Sorry, I\'m late.'],
    upper: ['I\'m not sure, but I think…', 'Could you explain that in another way?', 'I agree with … because…', 'Can I add something?', 'How do you spell…?'],
    exam: ['Would you mind clarifying…?', 'To build on what … said,…', 'I see your point, but…', 'Could I just check that I\'ve understood?', 'What would be a more formal way to say…?']
});

// ─── Projector: think–pair–share questions ───────────────────────────────────
export const THINK_PAIR_SHARE = Object.freeze({
    early: ['What is your favourite colour?', 'Which animal can jump?', 'What do you eat for breakfast?'],
    junior: ['What is your favourite animal? Why?', 'What can you do after school?', 'Which is better: summer or winter?'],
    mid: ['What would you take to a desert island?', 'What makes a good friend?', 'Which superpower would you choose? Why?'],
    upper: ['Should homework be optional? Give two reasons.', 'What invention changed the world the most?', 'Is it better to live in a city or a village?'],
    exam: ['Does technology make us more or less creative?', 'Should voting be compulsory?', 'Is failure necessary for success?']
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fromBand(table, league, fallbackBand = 'mid') {
    const band = getLeagueBand(league);
    return table[band] || table[fallbackBand] || [];
}

export function getSentenceStarters(league) {
    return [...fromBand(SENTENCE_STARTERS, league)];
}

export function getStructureHints(league) {
    const hints = STRUCTURE_HINTS[String(league || '').trim()];
    return hints ? [...hints] : [...STRUCTURE_HINTS.A];
}

export function pickOne(list = [], random = Math.random) {
    if (!list.length) return null;
    return list[Math.floor(random() * list.length) % list.length];
}

/**
 * Three dialogic prompts for a reveal: one recall, one open or wh-, one distancing/completion.
 * `{word}` is replaced by the Word of the Day (or a neutral phrase when there is none).
 */
export function getDialogicPrompts(league, { word = '', random = Math.random } = {}) {
    const bank = fromBand(DIALOGIC_PROMPTS, league);
    const fill = (text) => String(text || '').replaceAll('{word}', word ? `"${word}"` : 'a new word');
    const picks = [
        ['recall'],
        [random() < 0.5 ? 'open' : 'wh'],
        [word ? 'completion' : (random() < 0.5 ? 'distancing' : 'completion')]
    ];
    return picks.map(([type]) => {
        const options = bank[type] || [];
        // With a Word of the Day, the completion prompt should put that word to work.
        const withWord = word && type === 'completion' ? options.filter((text) => text.includes('{word}')) : [];
        return {
            type,
            ...DIALOGIC_PROMPT_TYPES[type],
            text: fill(pickOne(withWord.length ? withWord : options, random))
        };
    }).filter((prompt) => prompt.text);
}

export function getGrammarNugget(league, random = Math.random) {
    return pickOne(fromBand(GRAMMAR_NUGGETS, league), random);
}

export function getMinimalPair(league, random = Math.random) {
    const band = getLeagueBand(league);
    if (band === 'early') return null; // sound games stay oral and teacher-led for the youngest
    const table = MINIMAL_PAIRS[band === 'exam' ? 'upper' : band] || MINIMAL_PAIRS.mid;
    return pickOne(table, random);
}

export function getClassroomPhrase(league, random = Math.random) {
    return pickOne(fromBand(CLASSROOM_LANGUAGE, league), random);
}

export function getThinkPairShareQuestion(league, random = Math.random) {
    return pickOne(fromBand(THINK_PAIR_SHARE, league), random);
}

/** Letter scramble for a word (never returns the word itself for words longer than 2 letters). */
export function scrambleWord(word, random = Math.random) {
    const letters = String(word || '').toUpperCase().replace(/[^A-Z]/g, '').split('');
    if (letters.length < 3) return letters.join('');
    const original = letters.join('');
    for (let tries = 0; tries < 12; tries++) {
        const shuffled = [...letters];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (shuffled.join('') !== original) return shuffled.join('');
    }
    return [...letters.slice(1), letters[0]].join('');
}
