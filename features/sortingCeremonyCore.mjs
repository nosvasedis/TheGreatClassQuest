// features/sortingCeremonyCore.mjs — pure helpers for the Guild Sorting Ceremony
// (ui/modals/sortingQuiz.js). No DOM, no Firestore: affinity maths, the orb's
// colour blend, the reveal spin sequence, and the ceremony's words.

/** Ring order of the four houses (clockwise from the top-left seat). */
export const SORTING_RING_ORDER = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];

/** The orb's resting colours before any answer (Guild Hall violet). */
export const ORB_REST = { a: '#8b5cf6', b: '#22d3ee' };

/** One line per house for the reveal: why the stars chose it. */
export const GUILD_REVEAL_LINES = {
    dragon_flame: 'Your answers blazed with courage. You step forward when others wait.',
    grizzly_might: 'Again and again you chose your friends. Together, you are unstoppable.',
    owl_wisdom: 'Your curious mind lit the way. You ask why, and then you find out.',
    phoenix_rising: 'You never give up. Every time you fall, you rise brighter.',
};

/** Short welcome under the guild name. */
export const GUILD_WELCOME_LINES = {
    dragon_flame: 'The dragons roar your name!',
    grizzly_might: 'The bears make room beside the fire.',
    owl_wisdom: 'The owls open their great library to you.',
    phoenix_rising: 'The phoenix spreads its wings for you.',
};

/** First word of a display name ("Maria Papadopoulou" → "Maria"). */
export function firstName(name) {
    const clean = String(name || '').trim();
    if (!clean) return 'Hero';
    return clean.split(/\s+/)[0];
}

/**
 * Sum the guild weights of the answers given so far.
 * @param {Array<{options: Array<{guildWeights?: Record<string, number>}>}>} questions
 * @param {Array<number|undefined>} answers - option index per question (holes allowed)
 * @returns {{ scores: Record<string, number>, shares: Record<string, number>, total: number, answered: number }}
 */
export function computeGuildAffinity(questions, answers) {
    const scores = Object.fromEntries(SORTING_RING_ORDER.map((id) => [id, 0]));
    let answered = 0;
    (questions || []).forEach((q, i) => {
        const pick = answers?.[i];
        const option = Number.isInteger(pick) ? q?.options?.[pick] : null;
        if (!option) return;
        answered += 1;
        Object.entries(option.guildWeights || {}).forEach(([gid, w]) => {
            if (gid in scores && Number.isFinite(w)) scores[gid] += w;
        });
    });
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const shares = Object.fromEntries(
        SORTING_RING_ORDER.map((id) => [id, total > 0 ? scores[id] / total : 0])
    );
    return { scores, shares, total, answered };
}

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return [139, 92, 246];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two hex colours; t = 0 → a, t = 1 → b. */
export function mixHex(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const k = Math.max(0, Math.min(1, Number(t) || 0));
    return rgbToHex(x.map((v, i) => v + (y[i] - v) * k));
}

/**
 * The orb's two swirl colours for the answers so far. It leans toward the two
 * strongest houses but always keeps some Guild Hall violet in it, so it hints
 * without announcing the result.
 * @param {Record<string, number>} shares - from computeGuildAffinity
 * @param {Record<string, {glow?: string, primary?: string}>} guilds
 * @returns {{ a: string, b: string }}
 */
export function orbColorsForShares(shares, guilds) {
    const ranked = SORTING_RING_ORDER
        .map((id) => ({ id, share: Number(shares?.[id]) || 0 }))
        .filter((r) => r.share > 0)
        .sort((x, y) => y.share - x.share);
    if (!ranked.length) return { ...ORB_REST };
    const colorOf = (id) => guilds?.[id]?.glow || guilds?.[id]?.primary || ORB_REST.a;
    const lead = ranked[0];
    const second = ranked[1] || lead;
    // Strength grows with how clearly the lead house is ahead (0.35 … 0.8).
    const clarity = Math.min(1, lead.share * 1.4);
    const strength = 0.35 + 0.45 * clarity;
    return {
        a: mixHex(ORB_REST.a, colorOf(lead.id), strength),
        b: mixHex(ORB_REST.b, colorOf(second.id), strength * 0.8),
    };
}

/**
 * The spotlight's path around the ring before it settles on the chosen house.
 * It always ends exactly on `finalId`, slows down like a wheel, and visits
 * every house at least a few times so the ending feels earned.
 * @param {string} finalId
 * @param {{ baseSteps?: number, random?: () => number, fastMs?: number, slowMs?: number }} [opts]
 * @returns {Array<{ guildId: string, delay: number }>} delay = ms to hold this seat
 */
export function buildRevealSequence(finalId, opts = {}) {
    const ring = SORTING_RING_ORDER;
    const finalIndex = Math.max(0, ring.indexOf(finalId));
    const random = typeof opts.random === 'function' ? opts.random : Math.random;
    const baseSteps = Math.max(4, opts.baseSteps ?? 14);
    const fastMs = opts.fastMs ?? 80;
    const slowMs = opts.slowMs ?? 620;
    const steps = baseSteps + Math.floor(random() * ring.length);
    const start = (((finalIndex - (steps - 1)) % ring.length) + ring.length) % ring.length;
    return Array.from({ length: steps }, (_, i) => {
        const t = steps > 1 ? i / (steps - 1) : 1;
        return {
            guildId: ring[(start + i) % ring.length],
            delay: Math.round(fastMs + (slowMs - fastMs) * Math.pow(t, 2.6)),
        };
    });
}

/** Total length of a reveal sequence in ms. */
export function revealDuration(sequence) {
    return (sequence || []).reduce((sum, s) => sum + (Number(s.delay) || 0), 0);
}

/**
 * The "echo" of the answers for the result card: every house with its share
 * of the answer weight as whole percents (summing to 100), strongest first.
 * @returns {Array<{ guildId: string, share: number, percent: number }>}
 */
export function buildAffinityEcho(shares) {
    const rows = SORTING_RING_ORDER.map((id) => ({ guildId: id, share: Number(shares?.[id]) || 0 }));
    const total = rows.reduce((a, r) => a + r.share, 0) || 1;
    let used = 0;
    const withPct = rows.map((r) => {
        const percent = Math.floor((r.share / total) * 100);
        used += percent;
        return { ...r, percent };
    });
    // Hand the rounding remainder to the strongest house so the bar sums to 100.
    const lead = withPct.reduce((best, r) => (r.share > best.share ? r : best), withPct[0]);
    if (lead && lead.share > 0) lead.percent += 100 - used;
    return withPct.sort((x, y) => y.share - x.share);
}

const LEADING_GLYPH = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|⃣|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?|\p{Regional_Indicator})*)\s*/u;

/**
 * Split an answer like "🔥 Play a brave hero" into its picture and words so
 * the card can show the picture large. Falls back to the given letter.
 * @returns {{ glyph: string, text: string, isEmoji: boolean }}
 */
export function splitOptionGlyph(raw, fallback = '') {
    const value = String(raw ?? '').trim();
    const m = LEADING_GLYPH.exec(value);
    if (m && value.length > m[0].length) {
        return { glyph: m[1], text: value.slice(m[0].length).trim(), isEmoji: true };
    }
    return { glyph: fallback, text: value, isEmoji: false };
}

/** Label for the progress runes ("Question 3 of 7"). */
export function questionLabel(step, total) {
    const s = Math.max(1, Number(step) || 1);
    const t = Math.max(s, Number(total) || s);
    return `Question ${s} of ${t}`;
}
