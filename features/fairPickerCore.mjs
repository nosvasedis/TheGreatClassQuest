// features/fairPickerCore.mjs — Fair Picker: who answers the next question.
// The same promise as the Quiz spotlight: nobody gets a second turn until everyone here has had one.
// The round is kept on the class document (`fairPicker`), so it carries on from lesson to lesson,
// and a child who is away still waits for their turn (and leans a little ahead once back).
// Pure: no DOM, no Firebase. The window lives in ui/modals/fairPicker.js.

const RECENT_KEEP = 6;

export function normalizeFairPicker(raw) {
    const ids = (list) => [...new Set((Array.isArray(list) ? list : []).map(String).filter(Boolean))];
    const counts = {};
    if (raw?.counts && typeof raw.counts === 'object') {
        Object.entries(raw.counts).forEach(([id, n]) => {
            const v = Math.floor(Number(n) || 0);
            if (id && v > 0) counts[id] = v;
        });
    }
    return {
        round: Math.max(1, Math.floor(Number(raw?.round) || 1)),
        taken: ids(raw?.taken),
        recent: (Array.isArray(raw?.recent) ? raw.recent : []).map(String).filter(Boolean).slice(0, RECENT_KEEP),
        counts
    };
}

/**
 * Who is still waiting this round, who has had a turn, and who is away but keeps their place.
 * @param {object} fair normalized state
 * @param {{ classIds: string[], presentIds: string[], poolIds?: string[]|null }} o
 *        poolIds narrows the picker to one team; null means everyone here.
 */
export function fairStatus(fair, { classIds = [], presentIds = [], poolIds = null } = {}) {
    const f = normalizeFairPicker(fair);
    const taken = new Set(f.taken);
    const present = new Set(presentIds.map(String));
    const pool = poolIds ? new Set(poolIds.map(String)) : null;
    const inScope = classIds.map(String).filter((id) => !pool || pool.has(id));
    return {
        round: f.round,
        waiting: inScope.filter((id) => present.has(id) && !taken.has(id)),
        had: inScope.filter((id) => taken.has(id)),
        away: inScope.filter((id) => !present.has(id) && !taken.has(id))
    };
}

/**
 * Pick the next child. When everyone in scope who is here has had a turn, their turns are
 * cleared first (a fresh round for the whole class when nobody is left owed a turn).
 * The last child picked is never picked straight again while someone else can go.
 * @returns {{ id: string, next: object, freshRound: boolean } | null}
 */
export function pickTurn(fair, { presentIds = [], poolIds = null, rng = Math.random } = {}) {
    const f = normalizeFairPicker(fair);
    const present = presentIds.map(String);
    const scope = poolIds ? present.filter((id) => poolIds.map(String).includes(id)) : present;
    if (!scope.length) return null;

    let taken = new Set(f.taken);
    let round = f.round;
    let freshRound = false;
    let waiting = scope.filter((id) => !taken.has(id));
    if (!waiting.length) {
        scope.forEach((id) => taken.delete(id));
        if (!taken.size) round += 1;
        freshRound = true;
        waiting = [...scope];
    }
    const last = f.recent[0];
    const choices = waiting.length > 1 ? waiting.filter((id) => id !== last) : waiting;
    // A gentle lean toward children with fewer turns overall (say, after being away), never a certainty.
    const most = Math.max(...choices.map((c) => f.counts[c] || 0));
    const weights = choices.map((c) => 1 + Math.min(2, most - (f.counts[c] || 0)));
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    let id = choices[choices.length - 1];
    for (let i = 0; i < choices.length; i++) {
        roll -= weights[i];
        if (roll < 0) { id = choices[i]; break; }
    }

    taken.add(id);
    const counts = { ...f.counts, [id]: (f.counts[id] || 0) + 1 };
    return {
        id,
        freshRound,
        next: { round, taken: [...taken], recent: [id, ...f.recent].slice(0, RECENT_KEEP), counts }
    };
}

/** "Not now": the child goes back to waiting and the turn is not counted. */
export function passTurn(fair, id) {
    const f = normalizeFairPicker(fair);
    const key = String(id);
    const counts = { ...f.counts };
    if (counts[key] > 1) counts[key] -= 1; else delete counts[key];
    const at = f.recent.indexOf(key);
    const recent = at >= 0 ? [...f.recent.slice(0, at), ...f.recent.slice(at + 1)] : f.recent;
    return { round: f.round, taken: f.taken.filter((x) => x !== key), recent, counts };
}

/** Teacher's "Start a fresh round": everyone waits again. Turn counts stay. */
export function freshRound(fair) {
    const f = normalizeFairPicker(fair);
    return { ...f, round: f.round + 1, taken: [] };
}
