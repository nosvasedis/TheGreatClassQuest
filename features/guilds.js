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
            { type: 'chorus', lines: [
                { text: 'Who\'s brave and bold?',    time: 1.6  },
                { text: '— Dragon Flame!',            time: 4.9  },
                { text: 'Who burns so bright?',       time: 8.6  },
                { text: '— Dragon Flame!',            time: 13.4 },
            ]},
            { type: 'verse', lines: [
                { text: 'Through the dark we fly,',  time: 17.3 },
                { text: 'heads up, fire high.',       time: 21.2 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Fear nothing. Burn bright.', time: 23.9 },
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
                { text: 'One bear is strong.',            time: 0.0  },
                { text: 'Two bears are stronger.',        time: 4.7  },
                { text: 'All of us together—',            time: 9.7  },
                { text: 'we go farther.',                  time: 14.5 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Side by side, we stand.',        time: 19.3 },
                { text: 'Stand together. Stand strong.',  time: 23.9 },
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
                { text: 'When the moon is in the sky,',           time: 0.0  },
                { text: 'we open our eyes and ask why.',          time: 3.8  },
            ]},
            { type: 'verse', lines: [
                { text: 'Every book, every star—',                time: 7.7  },
                { text: 'Knowledge is power.',                    time: 11.6 },
            ]},
            { type: 'chorus', lines: [
                { text: 'We learn and grow, we wonder and know.', time: 14.9 },
                { text: 'Knowledge is power.',                    time: 18.9 },
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
                { text: 'From the ashes we rise up high.',     time: 2.2  },
                { text: 'Fall down seven, rise up eight.',     time: 6.2  },
            ]},
            { type: 'verse', lines: [
                { text: 'Spread our wings and touch the sky.', time: 9.0  },
                { text: 'Fall down seven, rise up eight.',     time: 12.9 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Phoenix Rising, we shine so bright—', time: 16.1 },
                { text: 'fall down seven, rise up eight.',     time: 20.0 },
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
