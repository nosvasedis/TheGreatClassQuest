// features/teamMakerCore.mjs — Team Maker: split the children who are here into 2 to 6 teams.
// Pure: no DOM, no Firebase. The window lives in ui/modals/teamMaker.js and saves the result
// on the class document as `teamMaker` ({ current, history }), so the projector card,
// the Fair Picker and the bounty poster can all find today's teams.

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
const HISTORY_KEEP = 2;

/** Team banners. Colours and creatures stay clear of the four guilds so nobody mixes them up. */
export const TEAM_BANNERS = Object.freeze([
    { key: 'fox', name: 'Coral Foxes', short: 'Foxes', emoji: '🦊', primary: '#f97316', deep: '#c2410c', soft: '#ffedd5' },
    { key: 'dolphin', name: 'Azure Dolphins', short: 'Dolphins', emoji: '🐬', primary: '#0ea5e9', deep: '#0369a1', soft: '#e0f2fe' },
    { key: 'turtle', name: 'Jade Turtles', short: 'Turtles', emoji: '🐢', primary: '#10b981', deep: '#047857', soft: '#d1fae5' },
    { key: 'bee', name: 'Golden Bees', short: 'Bees', emoji: '🐝', primary: '#eab308', deep: '#a16207', soft: '#fef9c3' },
    { key: 'unicorn', name: 'Violet Unicorns', short: 'Unicorns', emoji: '🦄', primary: '#8b5cf6', deep: '#6d28d9', soft: '#ede9fe' },
    { key: 'ladybird', name: 'Ruby Ladybirds', short: 'Ladybirds', emoji: '🐞', primary: '#e11d48', deep: '#9f1239', soft: '#ffe4e6' }
]);

export const TEAM_MODES = Object.freeze([
    { key: 'guild', label: 'Mix the guilds', hint: 'Every team gets heroes from different guilds' },
    { key: 'stars', label: 'Balance by stars', hint: "Teams even out on this month's stars" },
    { key: 'random', label: 'Pure luck', hint: 'Anything can happen' }
]);
export const TEAM_MODE_KEYS = Object.freeze(TEAM_MODES.map((m) => m.key));

export function teamBanner(index) {
    return TEAM_BANNERS[((Number(index) || 0) % TEAM_BANNERS.length + TEAM_BANNERS.length) % TEAM_BANNERS.length];
}

/** The team count actually used: 2–6, and never more teams than children. */
export function clampTeamCount(count, heroCount) {
    const heroes = Math.max(0, Math.floor(Number(heroCount) || 0));
    if (heroes < MIN_TEAMS) return 0;
    const wanted = Math.round(Number(count) || MIN_TEAMS);
    return Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, heroes, wanted));
}

/** A sensible starting count: teams of about four. */
export function suggestTeamCount(heroCount) {
    const heroes = Math.floor(Number(heroCount) || 0);
    if (heroes < MIN_TEAMS) return 0;
    return clampTeamCount(Math.round(heroes / 4) || MIN_TEAMS, heroes);
}

export function pairKey(a, b) {
    const x = String(a);
    const y = String(b);
    return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** Pairs who shared a team in the given sets, weighted: last time counts double. */
export function pastPairWeights(pastSets = []) {
    const weights = new Map();
    (pastSets || []).slice(0, HISTORY_KEEP).forEach((teams, age) => {
        const w = age === 0 ? 2 : 1;
        (teams || []).forEach((team) => {
            const ids = (team || []).map(String);
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const key = pairKey(ids[i], ids[j]);
                    weights.set(key, Math.max(weights.get(key) || 0, w));
                }
            }
        });
    });
    return weights;
}

/** How many pairs in `teams` were together last time (weights ignored). */
export function countRepeatPairs(teams, lastTeams) {
    const last = pastPairWeights([lastTeams]);
    let repeats = 0;
    (teams || []).forEach((team) => {
        for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) if (last.has(pairKey(team[i], team[j]))) repeats += 1;
        }
    });
    return repeats;
}

function shuffle(list, rng) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function dealRoundRobin(order, count, rng) {
    const teams = Array.from({ length: count }, () => []);
    const seats = shuffle([...Array(count).keys()], rng); // who gets the extra child varies
    order.forEach((hero, i) => teams[seats[i % count]].push(hero));
    return teams;
}

function buildRandom(heroes, count, rng) {
    return dealRoundRobin(shuffle(heroes, rng), count, rng);
}

/** Guild by guild, dealt round the table, so every team holds a spread of guilds. */
function buildGuildMix(heroes, count, rng) {
    const byGuild = new Map();
    shuffle(heroes, rng).forEach((hero) => {
        const key = hero.guildId || '';
        if (!byGuild.has(key)) byGuild.set(key, []);
        byGuild.get(key).push(hero);
    });
    // Biggest guilds first keeps the spread even; equal sizes in random order.
    const guilds = shuffle([...byGuild.entries()], rng).sort((a, b) => b[1].length - a[1].length);
    return dealRoundRobin(guilds.flatMap(([, members]) => members), count, rng);
}

/** Strongest still-free hero joins the team with the fewest stars (ties broken by size, then luck). */
function buildStarBalance(heroes, count, rng) {
    const teams = Array.from({ length: count }, () => []);
    const totals = new Array(count).fill(0);
    const jittered = heroes
        .map((hero) => ({ hero, key: (Number(hero.stars) || 0) + rng() * 0.9 }))
        .sort((a, b) => b.key - a.key);
    const size = Math.ceil(heroes.length / count);
    jittered.forEach(({ hero }) => {
        let best = -1;
        let bestScore = Infinity;
        shuffle([...Array(count).keys()], rng).forEach((t) => {
            if (teams[t].length >= size) return;
            const score = totals[t] * 1000 + teams[t].length;
            if (score < bestScore) { bestScore = score; best = t; }
        });
        teams[best].push(hero);
        totals[best] += Number(hero.stars) || 0;
    });
    return teams;
}

const BUILDERS = { random: buildRandom, guild: buildGuildMix, stars: buildStarBalance };

/** How far a split strays from what its mode promises (0 = perfect). */
function modePenalty(mode, teams) {
    if (mode === 'stars') {
        const avgs = teams.map((t) => t.reduce((sum, h) => sum + (Number(h.stars) || 0), 0) / Math.max(1, t.length));
        const all = teams.flat().map((h) => Number(h.stars) || 0);
        const range = Math.max(1, Math.max(...all) - Math.min(...all));
        return ((Math.max(...avgs) - Math.min(...avgs)) / range) * 10;
    }
    if (mode === 'guild') {
        const guilds = new Set(teams.flat().map((h) => h.guildId || ''));
        let penalty = 0;
        guilds.forEach((g) => {
            const counts = teams.map((t) => t.filter((h) => (h.guildId || '') === g).length);
            penalty += Math.max(0, Math.max(...counts) - Math.min(...counts) - 1) * 3;
        });
        return penalty;
    }
    return 0;
}

function repeatScore(teams, weights) {
    if (!weights.size) return 0;
    let score = 0;
    teams.forEach((team) => {
        for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) score += weights.get(pairKey(team[i].id, team[j].id)) || 0;
        }
    });
    return score;
}

/** Swap heroes between teams while that lowers repeated pairs without breaking the mode's promise. */
function improve(teams, mode, weights) {
    const cost = () => repeatScore(teams, weights) * 6 + modePenalty(mode, teams);
    let current = cost();
    for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        for (let a = 0; a < teams.length; a++) {
            for (let b = a + 1; b < teams.length; b++) {
                for (let i = 0; i < teams[a].length; i++) {
                    for (let j = 0; j < teams[b].length; j++) {
                        [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                        const next = cost();
                        if (next < current - 1e-9) { current = next; changed = true; }
                        else [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
                    }
                }
            }
        }
        if (!changed) break;
    }
    return current;
}

/**
 * Split heroes into teams.
 * @param {object} o
 * @param {{ id: string, guildId?: string, stars?: number }[]} o.heroes the children who are here
 * @param {number} o.count teams wanted (clamped to 2–6 and to the number of heroes)
 * @param {'guild'|'stars'|'random'} [o.mode]
 * @param {boolean} [o.avoidPairs] keep apart children who were together last time
 * @param {string[][][]} [o.pastSets] earlier splits, newest first (ids only)
 * @param {() => number} [o.rng]
 * @returns {{ teams: string[][], repeats: number }} ids per team; repeats = pairs together again from last time
 */
export function makeTeams({ heroes = [], count = 2, mode = 'guild', avoidPairs = false, pastSets = [], rng = Math.random } = {}) {
    const list = (heroes || []).filter((h) => h && h.id != null).map((h) => ({ ...h, id: String(h.id) }));
    const n = clampTeamCount(count, list.length);
    if (!n) return { teams: list.length ? [list.map((h) => h.id)] : [], repeats: 0 };
    const build = BUILDERS[mode] || BUILDERS.random;
    const weights = avoidPairs ? pastPairWeights(pastSets) : new Map();

    let best = null;
    let bestCost = Infinity;
    const starts = weights.size ? 10 : 1;
    for (let s = 0; s < starts; s++) {
        const teams = build(list, n, rng);
        const cost = weights.size ? improve(teams, mode, weights) : 0;
        if (cost < bestCost) { bestCost = cost; best = teams; }
        if (cost === 0 && weights.size && repeatScore(teams, weights) === 0) break;
    }
    const ids = best.map((team) => team.map((h) => h.id));
    return { teams: ids, repeats: countRepeatPairs(ids, pastSets?.[0] || []) };
}

/** Reads `classData.teamMaker`; anything malformed becomes "no teams yet". */
export function normalizeTeamMaker(raw) {
    const cleanSet = (teams) => (Array.isArray(teams) ? teams : [])
        .map((t) => (Array.isArray(t?.ids) ? t.ids : Array.isArray(t) ? t : []).map(String).filter(Boolean))
        .filter((ids) => ids.length);
    const cur = raw?.current;
    const teams = cleanSet(cur?.teams);
    const current = teams.length ? {
        teams,
        mode: TEAM_MODE_KEYS.includes(cur.mode) ? cur.mode : 'random',
        dateKey: String(cur.dateKey || ''),
        madeAt: Number(cur.madeAt) || 0
    } : null;
    const history = (Array.isArray(raw?.history) ? raw.history : [])
        .map((entry) => cleanSet(entry?.teams ?? entry))
        .filter((set) => set.length)
        .slice(0, HISTORY_KEEP);
    return { current, history };
}

/** Earlier splits, newest first, for "never the same pairs as last time". */
export function pastTeamSets(raw) {
    const tm = normalizeTeamMaker(raw);
    return [tm.current?.teams, ...tm.history].filter(Boolean).slice(0, HISTORY_KEEP);
}

/** The record to save: the new teams become current, the old current moves into history. */
export function recordTeams(raw, { teams, mode = 'random', dateKey = '', madeAt = Date.now() }) {
    const tm = normalizeTeamMaker(raw);
    const history = [tm.current?.teams, ...tm.history].filter(Boolean).slice(0, HISTORY_KEEP)
        .map((set) => ({ teams: set.map((ids) => ({ ids })) }));
    return {
        current: {
            teams: (teams || []).map((ids) => ({ ids: ids.map(String) })),
            mode: TEAM_MODE_KEYS.includes(mode) ? mode : 'random',
            dateKey: String(dateKey),
            madeAt: Number(madeAt) || Date.now()
        },
        history
    };
}

/** Today's teams (ids per team), or null when the class has none from today. */
export function teamsForDay(raw, dateKey) {
    const tm = normalizeTeamMaker(raw);
    if (!tm.current || !dateKey || tm.current.dateKey !== String(dateKey)) return null;
    return tm.current;
}

/** Per-team numbers for the cards: size, stars and guild spread. */
export function describeTeams(teams, heroesById) {
    const lookup = (id) => (heroesById instanceof Map ? heroesById.get(id) : heroesById?.[id]) || null;
    return (teams || []).map((ids, index) => {
        const heroes = ids.map(lookup).filter(Boolean);
        const guilds = {};
        heroes.forEach((h) => { if (h.guildId) guilds[h.guildId] = (guilds[h.guildId] || 0) + 1; });
        return {
            index,
            banner: teamBanner(index),
            ids: [...ids],
            size: ids.length,
            stars: Math.round(heroes.reduce((sum, h) => sum + (Number(h.stars) || 0), 0) * 10) / 10,
            guilds
        };
    });
}

/** Move one hero to another team (manual touch-up). Returns new team arrays. */
export function moveHero(teams, heroId, toIndex) {
    const id = String(heroId);
    const next = (teams || []).map((t) => t.filter((x) => String(x) !== id));
    if (!next[toIndex]) return (teams || []).map((t) => [...t]);
    next[toIndex].push(id);
    return next;
}
