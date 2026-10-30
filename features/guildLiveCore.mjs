// features/guildLiveCore.mjs — what changed in the guild race between two looks at it.
// The Guild Hall keeps the last standings it painted; when new Glory lands it asks this module
// which guilds gained or lost, who climbed past whom and who took the lead, and turns that into
// the herald's lines. Pure: no state, no DOM, so the rules are tested on their own.

const EPS = 0.0451; // under ~0.05 Glory per member is rounding, not news

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** Glory per member as the Hall writes it: one decimal below 100, whole numbers above. */
export function formatGlory(n) {
    const v = Math.abs(Number(n) || 0);
    return v >= 100 ? String(Math.round(v)) : String(round1(v));
}

export function ordinal(n) {
    return ['1st', '2nd', '3rd', '4th'][Number(n) - 1] || `#${n}`;
}

/**
 * The part of the standings the Hall animates, from getGuildLeaderboardData() rows.
 * place is this month's place (null with no Glory yet, or in a warm-up month).
 */
export function standingsSnapshot(rows = [], { counts = true } = {}) {
    const byId = {};
    for (const r of rows) {
        const live = r.live || {};
        byId[r.guildId] = {
            name: r.guildName || r.guildId,
            per: round1(live.perMember),
            place: counts && live.place ? Number(live.place) : null,
            crowns: Number(r.crowns) || 0,
            liveCrowns: counts ? Number(live.crowns) || 0 : 0,
            unity: Boolean(live.unity) && counts,
        };
    }
    const firsts = Object.keys(byId).filter((id) => byId[id].place === 1);
    return { byId, leader: firsts.length === 1 ? firsts[0] : null };
}

const rank = (p) => (p ? p : Infinity);

/**
 * One entry per guild that moved: { guildId, name, delta, fromPlace, toPlace, passed: [names],
 * newLeader, unitySealed }. Guilds with nothing to show are left out.
 */
export function diffStandings(prev, next) {
    if (!prev?.byId || !next?.byId) return { changes: [], newLeader: null };
    const ids = Object.keys(next.byId).filter((id) => prev.byId[id]);
    const changes = [];
    for (const id of ids) {
        const a = prev.byId[id];
        const b = next.byId[id];
        const delta = round1(b.per - a.per);
        const passed = ids
            .filter((o) => o !== id && rank(prev.byId[o].place) < rank(a.place) && rank(next.byId[o].place) > rank(b.place))
            .sort((x, y) => rank(next.byId[x].place) - rank(next.byId[y].place))
            .map((o) => next.byId[o].name);
        const moved = a.place !== b.place;
        const newLeader = next.leader === id && prev.leader !== id;
        const unitySealed = b.unity && !a.unity;
        if (Math.abs(b.per - a.per) < EPS && !moved && !unitySealed && b.crowns === a.crowns) continue;
        changes.push({
            guildId: id,
            name: b.name,
            delta: Math.abs(b.per - a.per) < EPS ? 0 : delta,
            fromPlace: a.place,
            toPlace: b.place,
            passed,
            newLeader,
            unitySealed,
            crownsGained: Math.max(0, b.crowns - a.crowns),
        });
    }
    return { changes, newLeader: next.leader && next.leader !== prev.leader ? next.leader : null };
}

function joinNames(names) {
    if (names.length > 2) return 'every other guild';
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The herald's lines for a diff, most exciting first: a new leader, climbs, Unity Seals,
 * then gains and losses. Each line is { guildId, tone, icon, text } with plain text (the Hall
 * escapes it). `month` names the running Chapter; `limit` keeps the ribbon short.
 */
export function heraldLines(diff, { month = 'this month', glory = 'Glory', limit = 3, unityCrowns = 1 } = {}) {
    const lines = [];
    const changes = diff?.changes || [];
    const used = new Set();
    for (const c of changes) {
        if (!c.newLeader) continue;
        const past = c.passed.length ? `, past ${joinNames(c.passed)}` : '';
        lines.push({ guildId: c.guildId, tone: 'lead', icon: '👑', text: `${c.name} take the lead of ${month}${past}!` });
        used.add(c.guildId);
    }
    for (const c of changes) {
        if (used.has(c.guildId) || !c.toPlace || rank(c.toPlace) >= rank(c.fromPlace)) continue;
        const past = c.passed.length ? `, past ${joinNames(c.passed)}` : '';
        lines.push({ guildId: c.guildId, tone: 'climb', icon: '⬆️', text: `${c.name} climb to ${ordinal(c.toPlace)}${past}!` });
        used.add(c.guildId);
    }
    for (const c of changes) {
        if (!c.unitySealed) continue;
        lines.push({ guildId: c.guildId, tone: 'unity', icon: '🤝', text: `${c.name} win the Unity Seal: +${unityCrowns} Crown${unityCrowns === 1 ? '' : 's'} this month!` });
        used.add(c.guildId);
    }
    const gains = changes.filter((c) => !used.has(c.guildId) && c.delta > 0).sort((a, b) => b.delta - a.delta);
    const losses = changes.filter((c) => !used.has(c.guildId) && c.delta < 0).sort((a, b) => a.delta - b.delta);
    for (const c of gains) lines.push({ guildId: c.guildId, tone: 'up', icon: '✨', text: `${c.name} +${formatGlory(c.delta)} ${glory} per member` });
    for (const c of losses) lines.push({ guildId: c.guildId, tone: 'down', icon: '🌩️', text: `${c.name} −${formatGlory(c.delta)} ${glory} per member` });
    for (const c of changes) {
        if (used.has(c.guildId) || c.delta || !c.fromPlace || !c.toPlace || rank(c.toPlace) <= rank(c.fromPlace)) continue;
        lines.push({ guildId: c.guildId, tone: 'down', icon: '⬇️', text: `${c.name} slip to ${ordinal(c.toPlace)}` });
    }
    return lines.slice(0, limit);
}

/**
 * Paces bursts of live updates: the first change waits `settle` ms for its neighbours (a Wheel
 * gift writes one hero at a time), then fires; a steady stream still fires every `maxWait` ms.
 * While `hold()` is true (something covers the screen) it looks again every `holdPoll` ms and
 * fires once the screen is clear; `release()` looks at once.
 */
export function createLivePacer(run, { settle = 240, maxWait = 1000, holdPoll = 500, hold = () => false, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let timer = 0;
    let firstAt = 0;
    let pending = false;
    let held = false;
    const arm = (wait) => {
        if (timer) clearTimer(timer);
        timer = setTimer(fire, wait);
    };
    function fire() {
        timer = 0;
        if (hold()) { held = true; arm(holdPoll); return; }
        held = false;
        pending = false;
        firstAt = 0;
        run();
    }
    return {
        request() {
            pending = true;
            if (held) return;
            const t = now();
            if (!firstAt) firstAt = t;
            arm(Math.max(0, Math.min(settle, firstAt + maxWait - t)));
        },
        release() {
            if (held && pending) arm(0);
        },
        cancel() {
            if (timer) clearTimer(timer);
            timer = 0;
            pending = false;
            held = false;
            firstAt = 0;
        },
        get held() { return held; },
        get pending() { return pending; },
    };
}
