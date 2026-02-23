// /features/guilds.js — Guild definitions, quiz content, assignment algorithm, visual helpers

/** Guild IDs (stable for Firestore and state) */
export const GUILD_IDS = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];

/** Guild definitions: id, name, colors, emblem, traits, emoji */
export const GUILDS = {
    dragon_flame: {
        id: 'dragon_flame',
        name: 'Dragon Flame',
        emoji: '🔥',
        primary: '#dc2626',
        secondary: '#f97316',
        glow: '#ef4444',
        textColor: '#fff',
        emblem: 'dragonflame.webp',
        sound: './dragon.mp3',
        traits: ['Courage', 'Fire', 'Bold'],
        motto: 'Fear nothing. Burn bright.',
    },
    grizzly_might: {
        id: 'grizzly_might',
        name: 'Grizzly Might',
        emoji: '🐻',
        primary: '#92400e',
        secondary: '#d97706',
        glow: '#f59e0b',
        textColor: '#fff',
        emblem: 'grizzlymight.webp',
        sound: './bear.mp3',
        traits: ['Strength', 'Teamwork', 'Steadfast'],
        motto: 'Stand together. Stand strong.',
    },
    owl_wisdom: {
        id: 'owl_wisdom',
        name: 'Owl Wisdom',
        emoji: '🦉',
        primary: '#1e40af',
        secondary: '#3b82f6',
        glow: '#60a5fa',
        textColor: '#fff',
        emblem: 'owlwisdom.webp',
        sound: './owl.mp3',
        traits: ['Wisdom', 'Curiosity', 'Calm'],
        motto: 'Knowledge is power.',
    },
    phoenix_rising: {
        id: 'phoenix_rising',
        name: 'Phoenix Rising',
        emoji: '🦅',
        primary: '#be185d',
        secondary: '#ec4899',
        glow: '#f472b6',
        textColor: '#fff',
        emblem: 'phoenixrising.webp',
        sound: './phoenix.mp3',
        traits: ['Resilience', 'Renewal', 'Hope'],
        motto: 'Fall down seven, rise up eight.',
    },
};

/** Default (mid/senior) quiz questions for Greek EFL. Each option maps to guild weight deltas. */
const SORTING_QUIZ_QUESTIONS_DEFAULT = [
    {
        id: 'q1',
        emoji: '💪',
        question: 'When something is hard, I usually…',
        options: [
            { text: 'Try again until I get it!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
            { text: 'Ask a friend to help me.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
            { text: 'Think carefully first.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
            { text: 'Jump in and try my best!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        ],
    },
    {
        id: 'q2',
        emoji: '📖',
        question: 'My favourite kind of story is…',
        options: [
            { text: 'Adventure and heroes!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
            { text: 'Animals and nature.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
            { text: 'Mysteries and learning new things.', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
            { text: 'Stories where someone never gives up.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
        ],
    },
    {
        id: 'q3',
        emoji: '🎓',
        question: 'In class I like to…',
        options: [
            { text: 'Be the first to answer!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
            { text: 'Work with my classmates.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
            { text: 'Read and discover new words.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
            { text: 'Keep trying even when it\'s difficult.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
        ],
    },
    {
        id: 'q4',
        emoji: '🐾',
        question: 'If I could be an animal, I would be…',
        options: [
            { text: 'A dragon — strong and brave!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
            { text: 'A bear — strong and kind to friends.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
            { text: 'An owl — wise and calm.', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
            { text: 'A phoenix — I always rise again!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
        ],
    },
    {
        id: 'q5',
        emoji: '🌟',
        question: 'The best thing about learning English is…',
        options: [
            { text: 'Showing I can do it!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
            { text: 'Doing activities with friends.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
            { text: 'Finding out new things.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
            { text: 'Getting better step by step.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
        ],
    },
];

/** Junior A/B: simpler wording, same structure and guildWeights so assignment logic is unchanged. */
const SORTING_QUIZ_QUESTIONS_JUNIOR = [
    { id: 'q1', emoji: '💪', question: 'When something is hard, I…', options: [
        { text: 'Try again and again!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
        { text: 'Ask a friend to help.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: 'Think first.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: 'Just try my best!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
    ]},
    { id: 'q2', emoji: '📖', question: 'I like stories about…', options: [
        { text: 'Adventures and heroes!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: 'Animals and nature.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: 'Mysteries and new things.', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: 'Someone who never gives up.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'q3', emoji: '🎓', question: 'In class I like to…', options: [
        { text: 'Answer first!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: 'Work with my friends.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: 'Read and learn new words.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: 'Keep trying when it\'s difficult.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'q4', emoji: '🐾', question: 'If I were an animal, I\'d be…', options: [
        { text: 'A dragon — strong and brave!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: 'A bear — strong and kind.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: 'An owl — wise and calm.', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: 'A phoenix — I rise again!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'q5', emoji: '🌟', question: 'The best thing about English is…', options: [
        { text: 'Showing I can do it!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: 'Doing things with friends.', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: 'Learning new things.', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: 'Getting better step by step.', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

/** For backward compatibility: default export is the default set. */
export const SORTING_QUIZ_QUESTIONS = SORTING_QUIZ_QUESTIONS_DEFAULT;

/**
 * Returns the age/league-appropriate question set for the sorting quiz.
 * Junior A/B get simpler wording; other leagues get the default set.
 * @param {string} [questLevel] - Class quest level (e.g. "Junior A", "A", "B")
 * @returns {Array} Question array with same structure (id, question, options with text + guildWeights)
 */
export function getQuestionsForLevel(questLevel) {
    if (!questLevel) return SORTING_QUIZ_QUESTIONS_DEFAULT;
    const level = String(questLevel).trim();
    if (level === 'Junior A' || level === 'Junior B') return SORTING_QUIZ_QUESTIONS_JUNIOR;
    return SORTING_QUIZ_QUESTIONS_DEFAULT;
}

/**
 * Get guild by id.
 * @param {string} id - Guild id
 * @returns {object|undefined}
 */
export function getGuildById(id) {
    return id ? GUILDS[id] : undefined;
}

/**
 * Get CSS color variables / inline styles for a guild.
 * @param {string} guildId
 * @returns {{ primary: string, secondary: string }}
 */
export function getGuildColors(guildId) {
    const g = getGuildById(guildId);
    return g ? { primary: g.primary, secondary: g.secondary } : { primary: '#6b7280', secondary: '#9ca3af' };
}

/**
 * Get emblem image URL (project root or assets path).
 * @param {string} guildId
 * @returns {string}
 */
export function getGuildEmblemUrl(guildId) {
    const g = getGuildById(guildId);
    if (!g) return '';
    return g.emblem ? `./${g.emblem}` : '';
}

/**
 * Build a small guild badge HTML (emblem img or initial).
 * @param {string} guildId
 * @param {string} [sizeClass] - e.g. 'w-8 h-8'
 * @returns {string}
 */
export function getGuildBadgeHtml(guildId, sizeClass = 'w-8 h-8') {
    const g = getGuildById(guildId);
    if (!g) return '';
    const url = getGuildEmblemUrl(guildId);
    const name = g.name;
    const cssClass = `guild-badge guild-${guildId} ${sizeClass} rounded-full object-cover border-2`;
    if (url) {
        return `<img src="${url}" alt="${name}" class="${cssClass}" title="${name}" style="border-color: ${g.primary}">`;
    }
    const initial = name.charAt(0);
    return `<div class="${cssClass} flex items-center justify-center font-bold text-sm" title="${name}" style="background-color: ${g.primary}20; border-color: ${g.primary}; color: ${g.primary}">${initial}</div>`;
}

/**
 * Assign guild from quiz answers. Returns guildId with highest weighted score.
 * Uses the same question set that was shown (so level-specific sets work).
 * @param {Array<number>} selectedOptionIndices - Per-question selected option index (0-based)
 * @param {string} [classId] - If provided, balance by current guild counts in this class (future use)
 * @param {Array} [questions] - Question set used for this quiz (must match what was shown; defaults to SORTING_QUIZ_QUESTIONS_DEFAULT)
 * @returns {string} guildId
 */
export function assignGuildFromQuizResults(selectedOptionIndices, classId = null, questions = SORTING_QUIZ_QUESTIONS_DEFAULT) {
    const scores = { dragon_flame: 0, grizzly_might: 0, owl_wisdom: 0, phoenix_rising: 0 };
    (questions || SORTING_QUIZ_QUESTIONS_DEFAULT).forEach((q, qIndex) => {
        const choice = selectedOptionIndices[qIndex];
        const option = q.options[choice];
        if (option && option.guildWeights) {
            Object.entries(option.guildWeights).forEach(([gid, w]) => {
                if (GUILD_IDS.includes(gid)) scores[gid] += w;
            });
        }
    });

    // Optional balance: if classId provided, we could add a small nudge toward less-populated guilds.
    // For now we just take the max score; tie-break by first in GUILD_IDS.
    let bestId = GUILD_IDS[0];
    let bestScore = scores[bestId];
    GUILD_IDS.forEach((gid) => {
        if (scores[gid] > bestScore) {
            bestScore = scores[gid];
            bestId = gid;
        }
    });
    return bestId;
}
