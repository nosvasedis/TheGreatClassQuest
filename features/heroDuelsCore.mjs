// features/heroDuelsCore.mjs — Hero Duels: every hero on the board on their own.
// The teacher picks 2 to 6 heroes, they duel (the teacher gives points), one is crowned, and the
// next few are picked straight away. Heroes keep the points they bank; with big teams switched on
// every finished duel also banks its points to the duellists' teams, until the game is finished.
// Pure: no DOM, no Firebase. Every function returns a new game, so the window can undo by keeping
// the old ones. The projector window lives in ui/modals/heroDuels.js.

export const MIN_DUEL = 2;
export const MAX_DUEL = 6;
export const MAX_BIG_TEAMS = 6;
export const WIN_BONUSES = Object.freeze([0, 1, 2, 3]);
export const DUEL_TARGETS = Object.freeze([0, 3, 5, 10]);
export const BANK_MODES = Object.freeze([
    { key: 'all', label: 'Every point counts', hint: 'Every duellist banks the points they won' },
    { key: 'winner', label: 'Winner takes all', hint: 'Only the crowned hero banks points' }
]);
export const DEFAULT_RULES = Object.freeze({ size: 2, winBonus: 2, target: 0, bank: 'all' });

const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
const n0 = (v) => Math.max(0, Math.round(Number(v) || 0));

export function normalizeRules(raw = {}) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        size: Math.max(MIN_DUEL, Math.min(MAX_DUEL, Math.round(Number(r.size) || DEFAULT_RULES.size))),
        winBonus: pick(WIN_BONUSES, Number(r.winBonus), DEFAULT_RULES.winBonus),
        target: pick(DUEL_TARGETS, Number(r.target), DEFAULT_RULES.target),
        bank: BANK_MODES.some((m) => m.key === r.bank) ? r.bank : DEFAULT_RULES.bank
    };
}

/**
 * A new game.
 * @param {object} o
 * @param {string} o.id
 * @param {string} o.classId
 * @param {string} o.dateKey the lesson day (a game belongs to one day)
 * @param {string[]} o.heroes the heroes who play
 * @param {string[][]|null} [o.teams] big teams (2–6) or null for everyone on their own
 * @param {object} [o.rules]
 */
export function createDuels({ id, classId, dateKey = '', heroes = [], teams = null, rules = {}, now = Date.now() }) {
    const ids = [...new Set((heroes || []).map(String))];
    const playing = new Set(ids);
    let big = Array.isArray(teams) ? teams.map((t) => (t || []).map(String).filter((x) => playing.has(x))).filter((t) => t.length) : null;
    if (big && big.length < 2) big = null;
    if (big) {
        // A hero left out of every team still plays, in the smallest team.
        const placed = new Set(big.flat());
        ids.filter((x) => !placed.has(x)).forEach((x) => {
            const smallest = big.reduce((best, t, i) => (t.length < big[best].length ? i : best), 0);
            big[smallest].push(x);
        });
    }
    return {
        v: 1,
        id: String(id || `duels-${now}`),
        classId: String(classId || ''),
        dateKey: String(dateKey || ''),
        createdAt: now,
        heroes: ids,
        teams: big ? big.slice(0, MAX_BIG_TEAMS) : null,
        rules: normalizeRules(rules),
        points: Object.fromEntries(ids.map((x) => [x, 0])),
        wins: Object.fromEntries(ids.map((x) => [x, 0])),
        played: Object.fromEntries(ids.map((x) => [x, 0])),
        duels: [],
        current: null,
        finished: false
    };
}

/** A game read back from storage; anything malformed becomes null. */
export function normalizeDuels(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1 || !Array.isArray(raw.heroes) || !raw.heroes.length) return null;
    const game = createDuels({ id: raw.id, classId: raw.classId, dateKey: raw.dateKey, heroes: raw.heroes, teams: raw.teams, rules: raw.rules, now: Number(raw.createdAt) || Date.now() });
    for (const x of game.heroes) {
        game.points[x] = n0(raw.points?.[x]);
        game.wins[x] = n0(raw.wins?.[x]);
        game.played[x] = n0(raw.played?.[x]);
    }
    const known = new Set(game.heroes);
    game.duels = (Array.isArray(raw.duels) ? raw.duels : []).filter((d) => d && Array.isArray(d.ids)).map((d) => ({
        n: n0(d.n),
        ids: d.ids.map(String).filter((x) => known.has(x)),
        scores: { ...(d.scores || {}) },
        winners: (d.winners || []).map(String).filter((x) => known.has(x)),
        gains: { ...(d.gains || {}) },
        at: Number(d.at) || 0
    }));
    const cur = raw.current;
    if (cur && Array.isArray(cur.ids)) {
        const ids = cur.ids.map(String).filter((x) => known.has(x));
        if (ids.length >= MIN_DUEL) game.current = { n: n0(cur.n) || game.duels.length + 1, ids, scores: Object.fromEntries(ids.map((x) => [x, n0(cur.scores?.[x])])) };
    }
    game.finished = Boolean(raw.finished);
    return game;
}

function clone(game) {
    return {
        ...game,
        teams: game.teams ? game.teams.map((t) => [...t]) : null,
        points: { ...game.points },
        wins: { ...game.wins },
        played: { ...game.played },
        duels: [...game.duels],
        current: game.current ? { ...game.current, ids: [...game.current.ids], scores: { ...game.current.scores } } : null
    };
}

/** Index of the hero's big team, or -1. */
export function teamIndexOf(game, heroId) {
    return game?.teams ? game.teams.findIndex((t) => t.includes(String(heroId))) : -1;
}

/** Start a duel between 2–6 heroes of the game. Returns the same game when it cannot start. */
export function startDuel(game, ids) {
    if (!game || game.current || game.finished) return game;
    const known = new Set(game.heroes);
    const pickIds = [...new Set((ids || []).map(String))].filter((x) => known.has(x)).slice(0, MAX_DUEL);
    if (pickIds.length < MIN_DUEL) return game;
    const next = clone(game);
    next.current = { n: game.duels.length + 1, ids: pickIds, scores: Object.fromEntries(pickIds.map((x) => [x, 0])) };
    return next;
}

/** The heroes in front in the duel now (several on a tie, none before a point). */
export function duelLeaders(current) {
    if (!current) return [];
    const top = Math.max(0, ...current.ids.map((x) => current.scores[x] || 0));
    if (top <= 0) return [];
    return current.ids.filter((x) => (current.scores[x] || 0) === top);
}

/**
 * Give (or take back) points in the duel. Scores never go below 0.
 * `reached` names the hero who just reached the "first to" target, so the window can crown them.
 */
export function scoreDuel(game, heroId, delta) {
    if (!game?.current) return { game, reached: null };
    const id = String(heroId);
    if (!game.current.ids.includes(id)) return { game, reached: null };
    const next = clone(game);
    const before = next.current.scores[id] || 0;
    next.current.scores[id] = Math.max(0, before + Math.round(Number(delta) || 0));
    const target = next.rules.target;
    const reached = target > 0 && before < target && next.current.scores[id] >= target ? id : null;
    return { game: next, reached };
}

/** What each duellist banks when the duel ends with these winners. */
export function duelGains(game, winners) {
    const cur = game?.current;
    if (!cur) return {};
    const won = new Set((winners || []).map(String));
    const gains = {};
    for (const x of cur.ids) {
        const own = cur.scores[x] || 0;
        const isWinner = won.has(x);
        gains[x] = game.rules.bank === 'winner' && !isWinner ? 0 : own + (isWinner ? game.rules.winBonus : 0);
    }
    return gains;
}

/**
 * Crown the duel. Without winners, the single leader wins; a tie (or no points) needs the teacher
 * to name the winner(s). Returns { game, duel } (duel null when nothing happened).
 */
export function crownDuel(game, winners = null, now = Date.now()) {
    const cur = game?.current;
    if (!cur) return { game, duel: null };
    let won = winners ? [...new Set(winners.map(String))].filter((x) => cur.ids.includes(x)) : duelLeaders(cur);
    if (!winners && won.length !== 1) return { game, duel: null };
    if (!won.length) return { game, duel: null };
    const gains = duelGains(game, won);
    const next = clone(game);
    for (const x of cur.ids) {
        next.points[x] = (next.points[x] || 0) + gains[x];
        next.played[x] = (next.played[x] || 0) + 1;
    }
    won.forEach((x) => { next.wins[x] = (next.wins[x] || 0) + 1; });
    const duel = { n: cur.n, ids: [...cur.ids], scores: { ...cur.scores }, winners: won, gains, at: now };
    next.duels.push(duel);
    next.current = null;
    return { game: next, duel };
}

/** Call the duel off: nobody banks anything. */
export function cancelDuel(game) {
    if (!game?.current) return game;
    const next = clone(game);
    next.current = null;
    return next;
}

/** Move a hero to another big team (before or during the game; their banked points move too). */
export function moveToTeam(game, heroId, toIndex) {
    if (!game?.teams || !game.teams[toIndex]) return game;
    const id = String(heroId);
    const next = clone(game);
    next.teams = next.teams.map((t) => t.filter((x) => x !== id));
    next.teams[toIndex].push(id);
    return next;
}

/** Big-team totals (banked points), in team order, with each team's place (1 = in front). */
export function teamTotals(game) {
    if (!game?.teams) return [];
    const rows = game.teams.map((ids, index) => ({
        index,
        ids: [...ids],
        points: ids.reduce((s, x) => s + (game.points[x] || 0), 0),
        wins: ids.reduce((s, x) => s + (game.wins[x] || 0), 0)
    }));
    const order = [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins);
    rows.forEach((r) => { r.place = order.findIndex((o) => o.points === r.points && o.wins === r.wins) + 1; });
    return rows;
}

/** Heroes best first: points, then crowns, then fewer duels played, then name. */
export function heroStandings(game, nameOf = (x) => x) {
    if (!game) return [];
    return game.heroes.map((id) => ({ id, points: game.points[id] || 0, wins: game.wins[id] || 0, played: game.played[id] || 0 }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.played - b.played || String(nameOf(a.id)).localeCompare(String(nameOf(b.id))));
}

/**
 * Who duels next: the heroes who have duelled least (and not in the last duel when possible),
 * one from each big team in turn so rival teams meet. Returns up to `size` ids.
 */
export function suggestDuel(game, size = 2, { rng = Math.random, exclude = [] } = {}) {
    if (!game) return [];
    const want = Math.max(MIN_DUEL, Math.min(MAX_DUEL, Math.round(Number(size) || 2)));
    const out = new Set((exclude || []).map(String));
    const last = new Set(game.duels.at(-1)?.ids || []);
    const pool = game.heroes.filter((x) => !out.has(x));
    // Lower is sooner: fewer duels first, the last duellists after everyone else on the same count.
    const rank = new Map(pool.map((x) => [x, (game.played[x] || 0) * 2 + (last.has(x) ? 1 : 0) + rng() * 0.9]));
    const byRank = (a, b) => rank.get(a) - rank.get(b);
    if (!game.teams) return pool.sort(byRank).slice(0, want);

    const queues = game.teams.map((t) => t.filter((x) => rank.has(x)).sort(byRank));
    // Teams whose best candidate is most overdue go first.
    const order = queues.map((q, i) => i).filter((i) => queues[i].length)
        .sort((a, b) => rank.get(queues[a][0]) - rank.get(queues[b][0]));
    const chosen = [];
    while (chosen.length < want && order.some((i) => queues[i].length)) {
        for (const i of order) {
            if (chosen.length >= want) break;
            const x = queues[i].shift();
            if (x) chosen.push(x);
        }
    }
    return chosen;
}

/** Heroes who have not duelled yet in this game. */
export function waitingHeroes(game) {
    return game ? game.heroes.filter((x) => !(game.played[x] > 0)) : [];
}

/** The finale: team order, hero podium (top 3 places, ties share), and the hero(es) with most crowns. */
export function duelsFinale(game, nameOf = (x) => x) {
    const teams = teamTotals(game).sort((a, b) => a.place - b.place || a.index - b.index);
    const standings = heroStandings(game, nameOf).filter((r) => r.played > 0);
    const podium = [];
    let place = 0;
    let prev = null;
    standings.forEach((r, i) => {
        if (!prev || r.points !== prev.points || r.wins !== prev.wins) place = i + 1;
        if (place <= 3 && r.points > 0) podium.push({ ...r, place });
        prev = r;
    });
    const most = Math.max(0, ...standings.map((r) => r.wins));
    const crowns = most > 0 ? standings.filter((r) => r.wins === most).map((r) => r.id) : [];
    return {
        duels: game?.duels.length || 0,
        teams,
        winningTeams: teams.length && teams[0].points > 0 ? teams.filter((t) => t.place === 1).map((t) => t.index) : [],
        podium,
        crowns,
        mostCrowns: most
    };
}

/** Who a finale reward goes to: 'team' (winning team), 'podium', 'winners' (crowned at least once) or 'all'. */
export function rewardIds(game, scope) {
    if (!game) return [];
    const f = duelsFinale(game);
    if (scope === 'team') return f.winningTeams.flatMap((i) => game.teams[i] || []);
    if (scope === 'podium') return f.podium.map((r) => r.id);
    if (scope === 'winners') return game.heroes.filter((x) => game.wins[x] > 0);
    if (scope === 'all') return [...game.heroes];
    return [];
}
