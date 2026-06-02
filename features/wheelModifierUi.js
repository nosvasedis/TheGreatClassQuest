// UI copy + icons for active guild Glory modifiers (wheel, relics, quiz rewards, …)

import { GLORY_EMOJI } from '../constants.js';

/** @param {string} raw */
export function escapeHtmlAttr(raw) {
    return String(raw || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** @param {number} expiresAt */
export function describeModifierExpiry(expiresAt) {
    const t = Number(expiresAt) || 0;
    if (!t) return '';
    const ms = Math.max(0, t - Date.now());
    if (ms <= 0) return 'Ends very soon.';
    const days = ms / (24 * 60 * 60 * 1000);
    if (days >= 6.75) return `About ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} remaining.`;
    if (days >= 2) return `Roughly ${Math.round(days)} days remaining.`;
    const hrs = Math.floor(ms / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    if (hrs > 0) return `${hrs}h ${mins}m remaining.`;
    return `${Math.max(mins, 1)} minute${mins === 1 ? '' : 's'} remaining.`;
}

/**
 * @param {{ type?: string, label?: string, factor?: number, amount?: number, bonus?: number, charges?: number, expiresAt?: number }} mod
 */
function _explain(mod) {
    const type = String(mod.type || '').toLowerCase();
    const factor = Number(mod.factor);
    const amount = Number(mod.amount);
    const bonus = Number(mod.bonus) || 50;
    const charges = Number(mod.charges);

    switch (type) {
        case 'multiply': {
            if (Number.isFinite(factor)) {
                if (factor >= 1) {
                    const pct = Math.round((factor - 1) * 100);
                    return `Raises Glory gained from starred work. Until this fades, Glory from heroes earning stars uses ×${factor} (${pct >= 0 ? '+' : ''}${pct}% vs baseline). Stacks with Fortune's Wheel rules on the Glory side.`;
                }
                return `Reduces Glory from stars until it expires (×${factor} applied to Glory from starred work). Negative wheel hits can still be blocked by a Glory Shield where the rules say so.`;
            }
            return `Temporarily scales how much ${GLORY_EMOJI} Glory your guild earns from starred work until this multiplier expires.`;
        }
        case 'bonus_per_star': {
            const bits = [`Adds +${Number.isFinite(amount) ? amount : '?'} bonus ${GLORY_EMOJI} Glory on top of the usual Glory earned each time qualifying stars land.`];
            if (Number.isFinite(charges) && charges > 0) {
                bits.push(`Applies only to the next ${charges} starring${charges === 1 ? '' : 's'}, then fades.`);
            } else {
                bits.push(`Lasts until this boon's expiry — each star earns the bonus while active.`);
            }
            return bits.join(' ');
        }
        case 'shield':
            return `Protects this guild from certain Fortune's Wheel penalties that steal or drain weekly Glory — for example Glory Heists or Glory Tax-style hits check for an active Shield first. Positive spins still apply as normal.`;
        case 'momentum_lock':
            return `Pins your guild's momentum reading so it can't show as negative while this is active — that cushions the Guild Power momentum ingredient when this week's Glory dips compared to last week. Glory numbers still update as usual; this only affects momentum scoring math.`;
        case 'challenge':
            return `If your guild holds the strongest weekly Glory run before this challenge expires (compared across guilds here), you'll bank a bonus +${Number.isFinite(mod.bonus) ? bonus : 50} ${GLORY_EMOJI} Glory when the tally resolves. Tie-breakers lean on Glory rules baked into the wheel and scoring.`;
        case 'shattered_mirror':
            return `A fractured reflection — the next positive Fortune's Wheel effect that lands on this guild will have its impact halved (rounded down). Negative effects apply at full strength. This curse fades after one positive effect is reduced, or after a week, whichever comes first.`;
        default:
            return `A Glory-related boon is active on your guild (${type || 'custom'}). Peek at Fortune's Wheel, Elite relics, or recent class events — those are usually the sources.`;
    }
}

/**
 * Presentation for the Guild Hall "Wheel boons" chips (and reusable elsewhere).
 * @param {{ type?: string, label?: string, factor?: number, amount?: number, bonus?: number, charges?: number, expiresAt?: number }} mod
 */
export function getGuildModifierChipPresentation(mod) {
    const type = String(mod.type || '').toLowerCase();
    const label = mod.label ? String(mod.label).trim() : '';
    let iconClass = 'fa-solid fa-wand-magic-sparkles';

    if (type === 'shield') iconClass = 'fa-solid fa-shield-halved';
    else if (type === 'momentum_lock') iconClass = 'fa-solid fa-anchor';
    else if (type === 'challenge') iconClass = 'fa-solid fa-flag-checkered';
    else if (type === 'bonus_per_star') iconClass = 'fa-solid fa-sparkles';
    else if (type === 'shattered_mirror') iconClass = 'fa-solid fa-burst';
    else if (type === 'multiply') {
        const f = Number(mod.factor);
        if (Number.isFinite(f) && f < 1) iconClass = 'fa-solid fa-arrow-trend-down';
        else iconClass = 'fa-solid fa-arrow-trend-up';
    }

    const expiry = describeModifierExpiry(mod.expiresAt);
    const explanation = _explain(mod).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
    const hoverExplainerAttr = escapeHtmlAttr([explanation, expiry].filter(Boolean).join(' '));

    const TYPE_HEADLINE_FALLBACK = {
        multiply: `${GLORY_EMOJI} multiplier`,
        bonus_per_star: `${GLORY_EMOJI} per-star bonus`,
        shield: `${GLORY_EMOJI} shield`,
        momentum_lock: 'Momentum lock',
        challenge: `${GLORY_EMOJI} challenge`,
        shattered_mirror: `${GLORY_EMOJI} shattered mirror`,
    };
    const headlinePlain = label || TYPE_HEADLINE_FALLBACK[type] || 'Guild Glory boon';

    return {
        iconClass,
        headlinePlain,
        headlineAttr: escapeHtmlAttr(headlinePlain.slice(0, 120)),
        hoverExplainerAttr,
    };
}
