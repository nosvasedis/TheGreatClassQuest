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
                { text: 'Wings of fire, hearts so bold,',       time: 2.9  },
                { text: 'we\'re the dragons, brave and gold!',  time: 6.4  },
                { text: 'When the road is dark and long,',      time: 10.1 },
                { text: 'we light the way and sing our song!',  time: 13.5 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Dragon Flame! Dragon Flame!',          time: 17.4 },
                { text: 'Fear nothing, burn bright!',           time: 20.7 },
                { text: 'Raise your wings and shout our name,', time: 24.0 },
                { text: 'Dragon Flame, burn bright!',           time: 27.9 },
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
                { text: 'Paws on the ground and our heads held high,',       time: 2.8  },
                { text: 'one big family, side by side.',                     time: 6.5  },
                { text: 'When the wind blows cold and the mountain\'s tall,', time: 9.8  },
                { text: 'we hold on tight, we will never fall!',             time: 13.4 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Grizzly Might! Grizzly Might!',                     time: 17.0 },
                { text: 'Stand together, stand strong!',                     time: 20.5 },
                { text: 'Shoulder to shoulder, all day long,',               time: 23.9 },
                { text: 'Grizzly Might, stand strong!',                      time: 27.5 },
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
                { text: 'Under the moon with our eyes open wide,', time: 2.9  },
                { text: 'we ask the questions, we look inside.',   time: 6.4  },
                { text: 'Every book and every star',               time: 10.4 },
                { text: 'shows us who we really are!',             time: 13.4 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Owl Wisdom! Owl Wisdom!',                 time: 17.4 },
                { text: 'Knowledge is power!',                     time: 20.9 },
                { text: 'Think it through and find the way,',      time: 24.2 },
                { text: 'we grow wiser every day!',                time: 27.5 },
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
                { text: 'When we stumble, when we fall,',          time: 2.9  },
                { text: 'we get up and give our all.',             time: 6.4  },
                { text: 'From the ashes, burning bright,',         time: 10.0 },
                { text: 'we spread our wings and take to flight!', time: 13.1 },
            ]},
            { type: 'chorus', lines: [
                { text: 'Phoenix Rising! Phoenix Rising!',         time: 17.4 },
                { text: 'Fall down seven, rise up eight!',         time: 20.5 },
                { text: 'Hope will guide us, never too late,',     time: 24.0 },
                { text: 'Phoenix Rising, rise up eight!',          time: 27.8 },
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
