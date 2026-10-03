// features/guilds.js — Guild definitions and visual helpers
// Quiz content, question pools, and guild assignment logic live in guildQuiz.js

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
        emblem: 'assets/dragonflame.webp',
        sound: './assets/dragon.mp3',
        anthem: './assets/dragon_anthem.mp3',
        traits: ['Courage', 'Fire', 'Bold'],
        motto: 'Fear nothing. Burn bright.',
        anthemLyrics: [
            { type: 'verse', lines: [
                { text: 'Out of the embers, a spark in the night,',               time: 2.2  },
                { text: 'we carry the fire that teaches us flight.',              time: 6.4  },
                { text: 'Where shadows are deepest, we\'re first to stand tall,', time: 10.4 },
                { text: 'one heart full of thunder, one roar for us all.',        time: 14.4 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Fear nothing, burn bright,',                             time: 18.6 },
                { text: 'we are the flame in the dark of the night!',             time: 22.4 },
                { text: 'Dragon Flame, rise and ignite,',                         time: 26.6 },
                { text: 'fear nothing, burn bright!',                             time: 30.5 },
            ]},
        ],
    },
    grizzly_might: {
        id: 'grizzly_might',
        name: 'Grizzly Might',
        emoji: '🐻',
        primary: '#92400e',
        secondary: '#d97706',
        glow: '#f59e0b',
        textColor: '#fff',
        emblem: 'assets/grizzlymight.webp',
        sound: './assets/bear.mp3',
        anthem: './assets/bear_anthem.mp3',
        traits: ['Strength', 'Teamwork', 'Steadfast'],
        motto: 'Stand together. Stand strong.',
        anthemLyrics: [
            { type: 'verse', lines: [
                { text: 'From the roots of the mountain the old forest sings',      time: 2.3  },
                { text: 'of the strength that is found in the smallest of things.', time: 6.3  },
                { text: 'When the river runs wild and the winter is long,',         time: 10.3 },
                { text: 'we hold to each other, we carry the song.',                time: 14.5 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Stand together, stand strong,',                            time: 19.2 },
                { text: 'shoulder to shoulder, where we belong!',                   time: 23.0 },
                { text: 'Grizzly Might, steady and true,',                          time: 27.0 },
                { text: 'stand together, we\'ll see it through!',                   time: 31.1 },
            ]},
        ],
    },
    owl_wisdom: {
        id: 'owl_wisdom',
        name: 'Owl Wisdom',
        emoji: '🦉',
        primary: '#1e40af',
        secondary: '#3b82f6',
        glow: '#60a5fa',
        textColor: '#fff',
        emblem: 'assets/owlwisdom.webp',
        sound: './assets/owl.mp3',
        anthem: './assets/owl_anthem.mp3',
        traits: ['Wisdom', 'Curiosity', 'Calm'],
        motto: 'Knowledge is power.',
        anthemLyrics: [
            { type: 'verse', lines: [
                { text: 'In the hush of the moonlight the quiet ones see', time: 2.4  },
                { text: 'the stars are a map and the night is a key.',     time: 6.7  },
                { text: 'We follow the questions wherever they lead;',     time: 10.6 },
                { text: 'a page and a candle are all that we need.',       time: 14.7 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Knowledge is power, our wings in the night,',     time: 19.0 },
                { text: 'Owl Wisdom, guided by light!',                    time: 23.4 },
                { text: 'Ask what the darkness won\'t say,',               time: 27.0 },
                { text: 'knowledge will show us the way!',                 time: 31.2 },
            ]},
        ],
    },
    phoenix_rising: {
        id: 'phoenix_rising',
        name: 'Phoenix Rising',
        emoji: '🦅',
        primary: '#be185d',
        secondary: '#ec4899',
        glow: '#f472b6',
        textColor: '#fff',
        emblem: 'assets/phoenixrising.webp',
        sound: './assets/phoenix.mp3',
        anthem: './assets/phoenix_anthem.mp3',
        traits: ['Resilience', 'Renewal', 'Hope'],
        motto: 'Fall down seven, rise up eight.',
        anthemLyrics: [
            { type: 'verse', lines: [
                { text: 'When the sky falls in pieces and the fire burns low,',   time: 2.3  },
                { text: 'there\'s an ember inside that the storm doesn\'t know.', time: 6.3  },
                { text: 'From the ash of the evening the morning will climb;',    time: 10.3 },
                { text: 'we were made to begin again, time after time.',          time: 14.2 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Fall down seven, rise up eight,',                        time: 18.8 },
                { text: 'hope is a flame that no storm can break!',               time: 22.8 },
                { text: 'Phoenix Rising, golden we soar,',                        time: 27.1 },
                { text: 'fall down seven, rise up once more!',                    time: 30.7 },
            ]},
        ],
    },
};

/**
 * Get guild by id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getGuildById(id) {
    return id ? GUILDS[id] : undefined;
}

/**
 * Secretary/teacher copy for a student's permanent guild house.
 * @param {string|null|undefined} guildId
 * @returns {{ assigned: boolean, name: string, emoji: string, label: string, description: string }}
 */
export function getGuildHouseDisplay(guildId) {
    const guild = getGuildById(guildId);
    if (!guild) {
        return {
            assigned: false,
            name: '',
            emoji: '',
            label: 'Unassigned',
            description: 'No guild assigned yet',
        };
    }
    const emoji = guild.emoji || '🛡️';
    return {
        assigned: true,
        name: guild.name,
        emoji,
        label: `${emoji} ${guild.name}`,
        description: 'Active House Member',
    };
}

/**
 * Get CSS color variables for a guild.
 * @param {string} guildId
 * @returns {{ primary: string, secondary: string }}
 */
export function getGuildColors(guildId) {
    const g = getGuildById(guildId);
    return g ? { primary: g.primary, secondary: g.secondary } : { primary: '#6b7280', secondary: '#9ca3af' };
}

/**
 * Get emblem image URL.
 * @param {string} guildId
 * @returns {string}
 */
export function getGuildEmblemUrl(guildId) {
    const g = getGuildById(guildId);
    if (!g) return '';
    return g.emblem ? `./${g.emblem}` : '';
}

/**
 * Build a small guild badge HTML (emblem img or initial fallback).
 * @param {string} guildId
 * @param {string} [sizeClass]
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
