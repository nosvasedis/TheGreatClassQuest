// The Star Path, drawn: a child's own constellation (their kept promises as stars) and the little
// rewards a kept promise brings. Shared by the Campfire's "A promise kept" moment and the Oath Board.
import './oathStarPath.css';
import { personalConstellation, oathPerkFor, STAR_RANKS } from '../oathStarPath.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const firstName = name => String(name || '').trim().split(/\s+/)[0] || '';

function sparkle(r) {
    const a = r * 0.22;
    return 'M0,' + (-r) + 'C' + a + ',' + (-a) + ' ' + a + ',' + (-a) + ' ' + r + ',0C' + a + ',' + a + ' ' + a + ',' + a + ' 0,' + r + 'C' + (-a) + ',' + a + ' ' + (-a) + ',' + a + ' ' + (-r) + ',0C' + (-a) + ',' + (-a) + ' ' + (-a) + ',' + (-a) + ' 0,' + (-r) + 'Z';
}

/**
 * The child's constellation as an SVG. `count` = promises kept (the newest is star count-1, drawn last,
 * so its lines draw in). `animate` plays the lighting in order (the moment), otherwise it simply shines.
 */
export function personalSkyMarkup(count, who = {}, { animate = true, label = true } = {}) {
    const sky = personalConstellation(count, who);
    const fresh = Math.min(sky.total, count) - 1;
    const order = new Map(sky.nodes.map(n => [n.i, n.i]));
    const lines = sky.edges.map(e => {
        const isNew = e.lit && (e.a === fresh || e.b === fresh) && count <= sky.total;
        return '<path class="sp-line' + (e.lit ? ' is-lit' : '') + (isNew ? ' is-new' : '') + '" pathLength="1" style="--d:' + Math.max(order.get(e.a), order.get(e.b)) + '" d="M' + e.x1 + ',' + e.y1 + 'L' + e.x2 + ',' + e.y2 + '"/>';
    }).join('');
    const stars = sky.nodes.map(n => {
        if (!n.lit) return '<circle class="sp-ghost" cx="' + n.x + '" cy="' + n.y + '" r="1.3"/>';
        const isNew = n.i === fresh && count <= sky.total;
        const big = isNew ? 5.2 : 4;
        // The place is on the outer group; the inner one is free to grow and spin (a CSS transform would replace the place).
        return '<g transform="translate(' + n.x + ' ' + n.y + ')"><g class="sp-star' + (isNew ? ' is-new' : '') + '" style="--d:' + n.i + '">' +
            '<circle class="sp-star-halo" r="' + (big * 2.2).toFixed(1) + '" fill="url(#sp-halo)"/><path class="sp-star-body" d="' + sparkle(big) + '"/><circle class="sp-star-core" r="' + (big * 0.32).toFixed(2) + '"/></g></g>';
    }).join('');
    const caption = label ? '<figcaption class="sp-sky-name"><b>' + esc(firstName(who.name) ? firstName(who.name) + '’s ' + sky.name.replace(/^The /, '') : sky.name) + '</b><span>' +
        (sky.whole ? 'Whole' + (sky.extra ? ' · +' + sky.extra + ' ✦' : '') : Math.min(count, sky.total) + ' of ' + sky.total + ' stars') + '</span></figcaption>' : '';
    const defs = '<defs><radialGradient id="sp-halo"><stop offset="0" stop-color="#fff1c4" stop-opacity=".8"/><stop offset=".4" stop-color="#ffd27a" stop-opacity=".25"/><stop offset="1" stop-color="#ffb45c" stop-opacity="0"/></radialGradient></defs>';
    return '<figure class="sp-sky' + (animate ? ' is-animated' : '') + (sky.whole ? ' is-whole' : '') + '" data-figure="' + sky.key + '">' +
        '<svg viewBox="-8 -8 116 92" role="img" aria-label="' + esc((who.name || 'Their') + ' constellation, ' + Math.min(count, sky.total) + ' stars') + '">' + defs + lines + stars + '</svg>' + caption + '</figure>';
}

/** The ladder of ranks as a row of little badges, the reached ones lit. */
export function rankLadderMarkup(count) {
    return '<ol class="sp-ladder" aria-label="Star Path ranks">' + STAR_RANKS.map(r =>
        '<li class="' + (count >= r.from ? 'is-reached' : '') + (count === r.from ? ' is-now' : '') + '"><i aria-hidden="true">' + r.icon + '</i><span>' + esc(r.name) + '</span><small>' + r.from + '</small></li>').join('') + '</ol>';
}

/** What this kept promise brought: bonus stars, Gold, a rank, a keepsake, and the next step. */
export function perkMarkup(perk, { name = '', pending = false } = {}) {
    const p = perk || oathPerkFor(1);
    const first = firstName(name) || 'They';
    const chips = [
        p.stars && '<li class="sp-gift sp-gift--stars" style="--g:0"><i aria-hidden="true">★</i><b data-count="' + p.stars + '">+' + p.stars + '</b><span>bonus ' + (p.stars === 1 ? 'star' : 'stars') + '</span></li>',
        '<li class="sp-gift sp-gift--gold" style="--g:1"><i aria-hidden="true">🪙</i><b data-count="' + p.goldTotal + '">+' + p.goldTotal + '</b><span>Gold</span></li>'
    ].filter(Boolean);
    if (p.keepsake) chips.push('<li class="sp-gift sp-gift--keepsake" style="--g:2"><i aria-hidden="true">' + esc(p.keepsake.icon) + '</i><b>' + esc(p.keepsake.name) + '</b><span>in the Trophy Room</span></li>');
    const rank = p.rank ? '<div class="sp-rank' + (p.milestone ? ' is-milestone' : '') + '"><span class="sp-rank-seal" aria-hidden="true">' + p.rank.icon + '</span><div><small>' + (p.milestone ? 'New rank on the Star Path' : 'Star Path · promise ' + p.n) + '</small><b>' + esc(p.rank.name) + '</b>' +
        (p.milestone ? '<em>' + esc(p.milestone.line) + '</em>' : '') + '</div></div>' : '';
    const next = p.next ? '<p class="sp-next"><span class="sp-next-bar" style="--p:' + Math.round(100 * p.n / p.next.from) + '%"><i></i></span>' +
        esc(p.next.left === 1 ? 'One more promise to ' + p.next.name : p.next.left + ' more promises to ' + p.next.name) + '</p>'
        : '<p class="sp-next is-top">' + esc(first) + ' walks the whole Star Path. Every promise still brings its gifts.</p>';
    return '<div class="sp-perks' + (pending ? ' is-pending' : '') + '">' + rank + '<ul class="sp-gifts" aria-label="Rewards for this promise">' + chips.join('') + '</ul>' + next + '</div>';
}

/** Count the gift numbers up from 0 once they show (a tiny flourish; instant without motion). */
export function countUpGifts(host, { reduced = false, delay = 650 } = {}) {
    const items = [...(host?.querySelectorAll('.sp-gift b[data-count]') || [])];
    if (reduced) return;
    items.forEach((b, i) => {
        const to = Number(b.dataset.count) || 0;
        if (to < 2) return;
        const start = performance.now() + delay + i * 260, dur = 700;
        b.textContent = '+0';
        const tick = now => {
            if (!b.isConnected) return;
            const t = Math.min(1, Math.max(0, (now - start) / dur));
            b.textContent = '+' + Math.round(to * (1 - Math.pow(1 - t, 3)));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}
