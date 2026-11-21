// features/fortuneWheelCore.mjs — Fortune's Wheel rules that need no DOM, state, Firestore or audio.
// Moved out of fortunesWheel.js unchanged so they can be unit-tested (tests/fortune-wheel-core.test.mjs).
// The catalogue, the effects (they write through wheelIo) and the canvas stay in fortunesWheel.js.

export const TAU = Math.PI * 2;

/** The most Glory a single fate can move for one hero, up or down (losses only from this month's Glory). */
export const OMEN_MAX_SWING = 8;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Small words and numbers ───────────────────────────────────────────────────

export const ordinal = (n) => `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n] || 'th'}`;

export const pctText = (pct) => `+${Math.round((Number(pct) || 0) * 100)}%`;

export const heroWord = (n) => `hero${n === 1 ? '' : 'es'}`;

export const per = (n) => `${round2(n)}`;

export const fmtDelta = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 100) / 100)}`;

/** Fisher-Yates shuffle (in place, returns the same array). */
export function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Determine the winning segment index (cryptographic-quality random, animation-independent).
 * @param {number} segmentCount
 * @returns {number} winning index
 */
export function spinWheel(segmentCount) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % segmentCount;
}

// ── Colour ────────────────────────────────────────────────────────────────────

/** Compute relative luminance from a hex color for text contrast decisions */
export function luminance(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length < 6) return 0;
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function hexToRgb(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length < 6) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(c.substring(0, 2), 16), g: parseInt(c.substring(2, 4), 16), b: parseInt(c.substring(4, 6), 16) };
}

/** Mix two hex colors (t = 0 → a, t = 1 → b), returned as an rgb() string. */
export function mixHex(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const m = (p, q) => Math.round(p + (q - p) * t);
    return `rgb(${m(x.r, y.r)}, ${m(x.g, y.g)}, ${m(x.b, y.b)})`;
}

// ── Wedge look and wheel geometry ─────────────────────────────────────────────

/** How a wedge is painted: the Envoy's mischief wears the storm's colours, so the class sees the risk. */
export function wedgeLook(seg) {
    return seg?.rarity === 'envoy' && seg.harsh ? 'storm' : seg?.rarity;
}

/**
 * Generate a cache key from segments + guildDef + size to detect when re-render is needed.
 */
export function wheelCacheKey(segments, guildDef, size) {
    // Use segment labels+rarities + guild primary + size as the identity key
    let k = `${size}`;
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        k += `|${s.label}:${s.rarity}:${s.emoji}:${s.paletteIndex || 0}:${s.isPrismatic ? 1 : 0}`;
    }
    k += `#g:${guildDef?.primary || ''}:${guildDef?.secondary || ''}:${guildDef?.glow || ''}`;
    return k;
}

/** Wheel face radius for a canvas of `size` px — leaves room for the lacquered rim. */
export function wheelRadius(size) {
    return size / 2 - Math.max(10, size * 0.052);
}

/**
 * Where a spin must end: the winner's wedge under the pointer at the top (12 o'clock = -π/2).
 * `base` is the start angle folded into one turn; `normalizedTarget` the extra turn needed from there.
 */
export function spinTarget(winnerIndex, segCount, startAngle = 0) {
    const segAngle = TAU / segCount;
    const winnerCenterAngle = winnerIndex * segAngle + segAngle / 2;
    const base = ((startAngle % TAU) + TAU) % TAU;
    const targetAngle = -winnerCenterAngle - Math.PI / 2;
    const normalizedTarget = ((targetAngle - base) % TAU + TAU) % TAU;
    return { base, normalizedTarget };
}

/** The wheel's rotation (past its start) at time t (0..1) of a spin: wind-up, ease-out, then an optional roll-back. */
export function spinAngleAt(t, { segAngle, windUp, rollback, travel, overshoot }) {
    if (t < windUp) return -segAngle * 0.7 * Math.sin((t / windUp) * Math.PI);
    const mainEnd = 1 - rollback;
    if (t < mainEnd || rollback === 0) {
        const pt = Math.min(1, (t - windUp) / (mainEnd - windUp));
        return (travel + overshoot) * (1 - Math.pow(1 - pt, 5));
    }
    const rt = (t - mainEnd) / rollback;
    return travel + overshoot * (1 - (0.5 - 0.5 * Math.cos(Math.PI * rt)));
}

/** Which wedge is under the pointer (12 o'clock) when the wheel is turned by `angle`. */
export function pointerSegmentIndex(angle, segCount) {
    const segAngle = TAU / segCount;
    const pointerAt = ((((-Math.PI / 2 - angle) % TAU) + TAU) % TAU);
    return Math.floor(pointerAt / segAngle) % segCount;
}

/** The legend's chips for a wheel: [{ key, count }] in the legend's fixed order ("toll" = the Envoy's mischief). */
export function legendCounts(segments) {
    const order = ['omen', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'twist', 'trial', 'storm', 'envoy', 'toll'];
    const counts = new Map();
    const keyOf = (seg) => (seg.rarity === 'envoy' && seg.harsh ? 'toll' : seg.rarity);
    for (const seg of segments) counts.set(keyOf(seg), (counts.get(keyOf(seg)) || 0) + 1);
    return order.filter((key) => counts.get(key)).map((key) => ({ key, count: counts.get(key) }));
}

// ── The hero ledger (who a fate touched) ──────────────────────────────────────

/**
 * Notes what one hero received or lost in this fate. The card then shows every hero touched,
 * grouped by guild (`spared`: a storm found no Glory of theirs to take).
 */
export function markLedger(ctx, studentId, patch = {}) {
    if (!ctx?.ledger || !studentId) return;
    const row = ctx.ledger.get(studentId) || { id: studentId, glory: 0, gold: 0, stars: 0, artifacts: [] };
    for (const [key, value] of Object.entries(patch)) {
        if (key === 'artifact') row.artifacts.push(value);
        else if (key === 'spared') row.spared = true;
        else row[key] = round2((row[key] || 0) + (Number(value) || 0));
    }
    ctx.ledger.set(studentId, row);
}

/** A star's Glory from the Wheel: notes the Tailwind's share apart and returns the star's own Glory. */
export function noteStarWind(ctx, studentId, event) {
    const total = Number(event?.totalGloryDelta) || 0;
    const wind = Math.max(0, Number(event?.windGlory) || 0);
    if (wind && ctx?.windOut) ctx.windOut[studentId] = round2((ctx.windOut[studentId] || 0) + wind);
    return round2(total - wind);
}

/** The ledger as plain rows (saved with the spin), each with the hero's guild. `students` is the roster. */
export function buildLedgerRows(ledger, students) {
    const byId = new Map((students || []).map((s) => [s.id, s]));
    return [...(ledger?.values() || [])]
        .filter((row) => byId.has(row.id))
        .map((row) => ({ ...row, guildId: byId.get(row.id).guildId || null, name: byId.get(row.id).name || 'Hero' }));
}

/** Glory (own + Tailwind) each guild gained or lost in a fate, from the ledger rows. */
export function gloryByGuildOf(ledger) {
    const gloryByGuild = {};
    (ledger || []).forEach((row) => {
        const all = (row.glory || 0) + (row.wind || 0);
        if (all) gloryByGuild[row.guildId] = round2((gloryByGuild[row.guildId] || 0) + all);
    });
    return gloryByGuild;
}

/**
 * The Tailwind's badge for a finished fate, or null when it added nothing. `windRows` is
 * Object.entries(windOut) already filtered to positive shares; `ownIds` are the spinning
 * guild's heroes (the tile counts their own Tailwind; on an Envoy turn it counts everyone's).
 */
export function windSummary(windRows, ownIds, envoy, wind) {
    const own = new Set(ownIds);
    const mine = windRows.filter(([id]) => own.has(id));
    const total = round2((mine.length ? mine : envoy ? windRows : []).reduce((sum, [, w]) => sum + w, 0));
    if (!(total > 0)) return null;
    return { pct: mine.length ? Number(wind?.pct) || 0 : 0, name: wind?.name || 'Tailwind', key: mine.length ? wind?.key || 'breeze' : 'breeze', total };
}

/** What the Mirror of Fates copies from a fate: its own named echo, else the wedge itself when it can be replayed. */
export function echoFor(segment, result, envoy) {
    const replayable = !envoy && (!segment.stage || (segment.stage === 'storm' && !result.braved));
    return result.echo || (replayable ? { kind: 'segment', id: segment.id } : { kind: 'none' });
}

// ── Standings ─────────────────────────────────────────────────────────────────

/** From standings sorted lowest first ([{ gid, perMember }]): who leads, who is alone at the bottom. */
export function standingsShapeOf(st) {
    const top = st.length ? st[st.length - 1].perMember : 0;
    const leaders = st.filter((x) => x.perMember === top).map((x) => x.gid);
    const lastAlone = st.length > 1 && st[0].perMember < st[1].perMember ? st[0].gid : null;
    return { st, leaders, soleLeader: leaders.length === 1 && st.length > 1 ? leaders[0] : null, lastAlone };
}

/** True when a storm (or any loss) hit this guild at its last spin in this class, before `weekKey`. */
export function stormHitInLog(log, weekKey, guildId, classId) {
    const last = (log || []).find((entry) => entry.classId === classId && entry.weekKey !== weekKey
        && (entry.results || []).some((r) => r?.guildId === guildId));
    const result = last?.results?.find((r) => r?.guildId === guildId);
    return Boolean(result && (result.stormHit || Number(result.gloryDelta) < 0 || Number(result.goldDelta) < 0));
}

// ── Reading a finished fate ───────────────────────────────────────────────────

/** The family a wedge's card is styled as. */
export function familyOf(rarity) {
    return ['storm', 'twist', 'trial', 'omen', 'envoy'].includes(rarity) ? rarity : 'treasure';
}

/** How a fate turned out for the card: 'braved', 'hit' (a loss) or 'gain'. */
export function outcomeOf(result) {
    return result.braved ? 'braved' : result.stormHit ? 'hit' : (result.gloryDelta || 0) < 0 ? 'hit' : (result.loss && !((result.gloryDelta || 0) > 0)) ? 'hit' : 'gain';
}

/** True when the fate gave the class something (decides whether treasure sparkles play). */
export function hasGainOf(result) {
    return (result.gloryDelta || 0) > 0 || (result.goldDelta || 0) > 0 || (result.starsDelta || 0) > 0
        || (result.artifactsGranted || 0) > 0 || (result.classQuestDelta || 0) > 0 || (result.classGlory || 0) > 0;
}

/** Which scene a wedge's card gets. */
export function fateOf(seg, { braved = false } = {}) {
    if (!seg) return 'coins';
    if (braved) return 'shield';
    if (seg.rarity === 'storm') return 'storm';
    if (seg.rarity === 'omen') return seg.harsh ? 'eclipse' : 'dawn';
    if (seg.rarity === 'envoy') return seg.harsh ? 'mischief' : 'envoy';
    if (seg.rarity === 'twist' || seg.rarity === 'trial') return seg.rarity;
    return ({ rare: 'starfall', epic: 'blaze', legendary: 'crown', mythic: 'prism' })[seg.rarity] || 'coins';
}

export function ribbonText(segment, rarityConf, guildDef, { braved = false, whirlwind = false, outcome = null } = {}) {
    if (braved) return segment.rarity === 'omen' ? 'Omen defied!' : 'Storm braved!';
    if (segment.rarity === 'envoy') return `${guildDef?.name || 'The'} Envoy`;
    if (segment.rarity === 'omen') return `✦ Omen · ${segment.harsh && outcome !== 'gain' ? 'fate shakes' : 'fate shines'} ✦`;
    return whirlwind ? `Whirlwind · ${rarityConf.label}` : rarityConf.label;
}

/** Many heroes, or heroes of more than one guild: the card spreads out beside the fortune. */
export function ledgerIsBig(result) {
    const rows = result.ledger || [];
    return rows.length > 4 || new Set(rows.map((r) => r.guildId)).size > 1;
}

/** The line under the wheel once a fate is shown. */
export function resultCaption({ envoy, outcome, braved, segment, guildName }) {
    return envoy
        ? (outcome === 'hit' ? `${guildName}'s Envoy brought trouble this time. Every class has stormy days. Advance when you are ready.` : `${guildName}'s Envoy has delivered its gift. Advance when you are ready.`)
        : braved
        ? `${guildName} braved the ${segment.rarity === 'omen' ? 'Omen' : 'storm'}! Advance when you are ready for the next guild.`
        : outcome === 'hit'
            ? `A stormy moment for ${guildName}. Every hero has one. Advance when you are ready.`
            : `${guildName} has received ${segment.label}. Advance when you are ready for the next reveal.`;
}

/** "+2 / -1" for the artifacts granted and removed ('' when neither). */
export function artifactDeltaText(granted, removed) {
    return `${granted ? `+${granted}` : ''}${granted && removed ? ' / ' : ''}${removed ? `-${removed}` : ''}`;
}

/** Each granted artifact once, with how many were given. */
export function uniqueArtifacts(grantedArtifacts) {
    const counts = new Map();
    for (const a of grantedArtifacts || []) {
        const key = a.id;
        if (counts.has(key)) {
            counts.get(key).count += 1;
        } else {
            counts.set(key, { ...a, count: 1 });
        }
    }
    return [...counts.values()];
}
