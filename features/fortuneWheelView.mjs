// features/fortuneWheelView.mjs — Fortune's Wheel markup that only takes data and returns HTML strings.
// Moved out of fortunesWheel.js unchanged. Anything that needs the roster, the guild list or the
// rarity palette gets it from the caller, so this file reads no state and touches no DOM.

import { tailwindGlyphSvg, tailwindPipsHtml } from './tailwindArt.js';
import { GOLD_COIN_HTML } from '../utils/goldCoin.js';
import { round2, fmtDelta, pctText, artifactDeltaText, uniqueArtifacts } from './fortuneWheelCore.mjs';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const GOLD_EMOJI = new Set(['🪙', '💰']);

/** A wedge's sign as HTML: Gold's coin for gold wedges, otherwise its emoji. */
export function signHtml(emoji) {
    return GOLD_EMOJI.has(emoji) ? '<i class="gq-gold gq-gold--xl" aria-hidden="true"></i>' : emoji;
}

export function avatarHtml(student, cls) {
    return student?.avatar
        ? `<img src="${esc(student.avatar)}" class="${cls}" alt="">`
        : `<span class="${cls} ${cls}--initial">${esc((student?.name || '?').charAt(0).toUpperCase())}</span>`;
}

/** A guild's crest as a tiny inline image (for stat tiles), or its emoji. */
export function crestIconHtml(url, emoji) {
    return url ? `<img src="${esc(url)}" alt="" class="fw-result-stat__crest">` : (emoji || '⚜️');
}

/** The Tailwind's sign beside the wheel, before the spin. */
export function windNoteHtml(wind, envoy) {
    if (envoy || !(wind?.pct > 0)) return '';
    return `<div class="fw-wind-card fw-wind--${wind.key || 'breeze'}">`
        + '<span class="fw-wind-card__streaks" aria-hidden="true"><i></i><i></i><i></i></span>'
        + `<span class="fw-wind-card__orb">${tailwindGlyphSvg()}</span>`
        + '<span class="fw-wind-card__body">'
        + `<span class="fw-wind-card__head"><b class="fw-wind-card__pct">${pctText(wind.pct)}</b><span class="fw-wind-card__name">Tailwind · ${wind.name || 'Breeze'}</span>${tailwindPipsHtml(wind.key, 'fw-wind-pips')}</span>`
        + `<span class="fw-wind-card__copy">Any Glory the wheel brings this guild grows by ${pctText(wind.pct)}.</span>`
        + '</span></div>';
}

/**
 * The legend's chips. `counts` is legendCounts(segments); `getPalette` is the rarity palette lookup
 * (getRarityPalette) so this file stays free of the app's constants.
 */
export function legendChipsHtml(counts, getPalette) {
    return counts
        .map(({ key: rarity, count }) => {
            const conf = rarity === 'toll' ? { ...getPalette('storm', 0), label: 'Mischief' } : getPalette(rarity, 0);
            return `<span class="fw-wheel-legend__chip" data-rarity="${rarity === 'toll' ? 'storm' : rarity}" style="--chip-color:${conf.color};--chip-bg:${conf.bg};">
                <span class="fw-wheel-legend__gem"></span>${conf.label}<b>×${count}</b>
            </span>`;
        }).join('');
}

export function legendHtml({ chips, envoy, hasOmen, windNote }) {
    return `
        <div class="fw-wheel-legend__header">${envoy ? 'The Envoy brings' : 'On this wheel'}</div>
        <div class="fw-wheel-legend__chips">${chips}</div>
        ${hasOmen ? '<div class="fw-wheel-legend__omen"><span aria-hidden="true">✦</span> An Omen hides on this wheel. Its fate is huge, for better or worse!</div>' : ''}
        ${windNote}`;
}

// ── The party at the wheel ────────────────────────────────────────────────────

/** One hero's medallion for the party card: the portrait (or initial underneath, if it fails to load) and first name. */
export function partyHeroHtml(student, i, ringColor, away = false) {
    const name = String(student.name || 'Hero');
    const first = name.split(/\s+/)[0];
    const initial = esc(name.charAt(0).toUpperCase() || '?');
    const portrait = student.avatar
        ? `<img src="${esc(student.avatar)}" alt="" class="fw-party__img" decoding="async">`
        : '';
    return `
        <li class="fw-party__hero${away ? ' is-away' : ''}" style="--i:${i};${ringColor ? `--ring:${ringColor};` : ''}" title="${esc(name)}${away ? ' · away today' : ''}">
            <span class="fw-party__medal"><span class="fw-party__initial">${initial}</span>${portrait}</span>${away ? '<span class="fw-party__cloud" aria-hidden="true"><i></i></span>' : ''}
            <span class="fw-party__name">${esc(first)}</span>
        </li>`;
}

/** The heroes who are away today: dimmed under a little cloud, so everyone can see why they sit this one out. */
export function awayRowHtml(away, startIndex, ringOf = () => null) {
    if (!away.length) return '';
    const names = away.length === 1 ? 'is away today' : 'are away today';
    return `
        <div class="fw-party__away">
            <div class="fw-party__away-label"><span class="fw-party__away-icon" aria-hidden="true"></span>${away.length} ${away.length === 1 ? 'hero' : 'heroes'} ${names} · no gain, no loss</div>
            <ul class="fw-party__list fw-party__list--away">${away.map((s, i) => partyHeroHtml(s, startIndex + i, ringOf(s), true)).join('')}</ul>
        </div>`;
}

/** The guild's crest at the head of the party card. */
export function partyCrestHtml(crestUrl, emoji) {
    return crestUrl
        ? `<img src="${esc(crestUrl)}" alt="" class="fw-party__crest">`
        : `<span class="fw-party__crest fw-party__crest--blank">${esc(emoji || '⚜️')}</span>`;
}

// ── Fate scenes ───────────────────────────────────────────────────────────────

const rand = (min, max) => min + Math.random() * (max - min);
const bits = (n, make) => Array.from({ length: n }, (_, i) => make(i)).join('');

/** The scene's pieces: `back` sits behind the card, `front` in front of it (never catching clicks). */
export function fateSceneHtml(fate, lite) {
    const _rand = rand;
    const _bits = bits;
    const k = lite ? 0.4 : 1;
    const n = (count) => Math.max(2, Math.round(count * k));
    const fall = (cls, count, inner = '') => _bits(n(count), (i) => `<i class="${cls}" style="--x:${_rand(2, 98).toFixed(1)}%;--d:${_rand(0, 1.4).toFixed(2)}s;--t:${_rand(2.6, 4.6).toFixed(2)}s;--s:${_rand(0.7, 1.3).toFixed(2)};--r:${Math.round(_rand(-180, 180))}deg;--w:${Math.round(_rand(-40, 40))}px">${inner}</i>`);
    const burst = (cls, count, inner = '', dist = [160, 340]) => _bits(n(count), (i) => {
        const a = (i / n(count)) * 360 + _rand(-10, 10);
        return `<i class="${cls}" style="--a:${a.toFixed(0)}deg;--dist:${Math.round(_rand(dist[0], dist[1]))}px;--d:${_rand(0, 0.25).toFixed(2)}s;--s:${_rand(0.6, 1.2).toFixed(2)}">${inner}</i>`;
    });
    switch (fate) {
    case 'coins': return {
        back: '<i class="fs-glow"></i>',
        front: _bits(n(20), (i) => `<i class="fs-coin" style="--x:${_rand(-260, 260).toFixed(0)}px;--h:${_rand(200, 380).toFixed(0)}px;--d:${_rand(0, 0.5).toFixed(2)}s;--r:${Math.round(_rand(360, 1080))}deg;--s:${_rand(0.8, 1.4).toFixed(2)}"><i class="gq-gold"></i></i>`),
    };
    case 'starfall': return {
        back: '<i class="fs-glow"></i>' + _bits(n(9), (i) => `<i class="fs-shoot" style="--y:${_rand(-10, 70).toFixed(0)}%;--x:${_rand(10, 90).toFixed(0)}%;--d:${(i * 0.32 + _rand(0, 0.2)).toFixed(2)}s"></i>`),
        front: burst('fs-twinkle', 14, '✦', [180, 320]),
    };
    case 'blaze': return {
        back: '<i class="fs-firering"></i><i class="fs-firering fs-firering--late"></i><i class="fs-glow"></i>',
        front: _bits(n(26), (i) => `<i class="fs-ember" style="--x:${_rand(5, 95).toFixed(1)}%;--d:${_rand(0, 2).toFixed(2)}s;--t:${_rand(1.8, 3.2).toFixed(2)}s;--w:${Math.round(_rand(-50, 50))}px;--s:${_rand(0.5, 1.2).toFixed(2)}"></i>`),
    };
    case 'crown': return {
        back: '<i class="fs-sunburst"></i><i class="fs-halo"></i>',
        front: '<i class="fs-crown">👑</i>' + fall('fs-leaf', 22),
    };
    case 'prism': return {
        back: '<i class="fs-aurora"></i><i class="fs-aurora fs-aurora--b"></i><i class="fs-aurora fs-aurora--c"></i>',
        front: burst('fs-shard', 18, '', [200, 420]),
    };
    case 'twist': return {
        back: '<i class="fs-swirl"></i><i class="fs-swirl fs-swirl--rev"></i>',
        front: _bits(n(10), (i) => `<i class="fs-orbit" style="--a:${i * 36}deg;--d:${(i * 0.06).toFixed(2)}s">✦</i>`),
    };
    case 'trial': return {
        back: '<i class="fs-ripple"></i><i class="fs-ripple fs-ripple--2"></i><i class="fs-ripple fs-ripple--3"></i>',
        front: '<i class="fs-shock"></i>' + _bits(n(8), (i) => `<i class="fs-dust" style="--x:${(8 + i * 12).toFixed(0)}%;--w:${Math.round(_rand(-60, 60))}px;--s:${_rand(0.7, 1.3).toFixed(2)}"></i>`),
    };
    case 'storm': return {
        back: '<i class="fs-cloud fs-cloud--l"></i><i class="fs-cloud fs-cloud--r"></i>' + fall('fs-rain', 36),
        front: '<i class="fs-flash"></i><svg class="fs-bolt" viewBox="0 0 40 120" aria-hidden="true"><path d="M24 0 6 62h14L10 120 36 46H21L30 0z"/></svg>',
    };
    case 'shield': return {
        back: '<i class="fs-cloud fs-cloud--l fs-cloud--part"></i><i class="fs-cloud fs-cloud--r fs-cloud--part"></i><i class="fs-sunbeam"></i>',
        front: '<i class="fs-shieldring"></i><i class="fs-shieldring fs-shieldring--late"></i>',
    };
    case 'eclipse': return {
        back: '<i class="fs-dim"></i><i class="fs-sun"><i class="fs-moon"></i></i>',
        front: fall('fs-ash', 20),
    };
    case 'dawn': return {
        back: '<i class="fs-horizon"></i><i class="fs-sunburst fs-sunburst--dawn"></i>',
        front: burst('fs-twinkle', 16, '✦', [160, 360]),
    };
    case 'envoy': return {
        back: '<i class="fs-glow fs-glow--parchment"></i>',
        front: fall('fs-feather', 9, '🪶') + '<i class="fs-seal">📜</i>',
    };
    case 'mischief': return {
        back: '<i class="fs-fog"></i><i class="fs-fog fs-fog--b"></i>',
        front: burst('fs-trick', 10, '✧', [140, 300]),
    };
    default: return { back: '', front: '' };
    }
}

// ── The fate card ─────────────────────────────────────────────────────────────

/**
 * Every hero this fate touched, grouped by guild (the spinning guild first), each with exactly
 * what they received or lost. A storm's spared heroes show a little shield.
 * `lookup`: { students: Map id → student, guildOrder: guild ids, getGuild(id), getCrest(id) }.
 */
export function heroLedgerHtml(result, { students, guildOrder, getGuild, getCrest }) {
    const rows = (result.ledger || []).filter((r) => r.glory || r.wind || r.gold || r.stars || r.artifacts?.length || r.spared);
    if (!rows.length) return '';
    const groups = new Map();
    for (const row of rows) groups.set(row.guildId, [...(groups.get(row.guildId) || []), row]);
    const order = [result.guildId, ...guildOrder.filter((g) => g !== result.guildId), null];
    let k = 0;
    const groupHtml = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((gid) => {
        const def = getGuild(gid);
        const list = groups.get(gid).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const glory = round2(list.reduce((sum, r) => sum + (r.glory || 0), 0));
        const crest = getCrest(gid);
        const chips = list.map((row) => {
            const st = students.get(row.id) || { name: row.name };
            const badges = [
                row.glory ? `<span class="fw-hero__b fw-hero__b--glory${row.glory < 0 ? ' is-neg' : ''}">${fmtDelta(row.glory)}<i aria-hidden="true">⚜️</i></span>` : '',
                row.stars ? `<span class="fw-hero__b fw-hero__b--star${row.stars < 0 ? ' is-neg' : ''}">${fmtDelta(row.stars)}<i aria-hidden="true">⭐</i></span>` : '',
                row.gold ? `<span class="fw-hero__b fw-hero__b--gold${row.gold < 0 ? ' is-neg' : ''}">${fmtDelta(row.gold)}${GOLD_COIN_HTML}</span>` : '',
                ...(row.artifacts || []).map((a) => `<span class="fw-hero__b fw-hero__b--artifact" title="${esc(a.name)}"><i aria-hidden="true">${esc(a.icon)}</i>${esc(a.name)}</span>`),
                row.wind ? `<span class="fw-hero__b fw-hero__b--wind" title="Tailwind">${tailwindGlyphSvg('fw-hero__wind-glyph')}${fmtDelta(row.wind)}</span>` : '',
            ].join('');
            const spared = !badges && row.spared;
            const neg = (row.glory || 0) < 0 || (row.gold || 0) < 0;
            return `
                <li class="fw-hero${spared ? ' is-spared' : ''}${neg ? ' is-hit' : ''}" style="--k:${k++}">
                    ${avatarHtml(st, 'fw-hero__avatar')}
                    <span class="fw-hero__name">${esc(st.name || 'Hero')}</span>
                    <span class="fw-hero__badges">${badges || (spared ? '<span class="fw-hero__b fw-hero__b--safe">🛡️ safe</span>' : '')}</span>
                </li>`;
        }).join('');
        return `
            <section class="fw-heroes__group${gid === result.guildId ? ' is-home' : ''}" style="--g:${def?.primary || '#e8c46a'}">
                <header class="fw-heroes__head">
                    ${crest ? `<img src="${esc(crest)}" alt="" class="fw-heroes__crest">` : `<span class="fw-heroes__crest fw-heroes__crest--blank">${esc(def?.emoji || '⚜️')}</span>`}
                    <span class="fw-heroes__guild">${esc(def?.name || 'Heroes')}</span>
                    <span class="fw-heroes__count">${list.length} hero${list.length === 1 ? '' : 'es'}</span>
                    ${glory ? `<span class="fw-heroes__glory${glory < 0 ? ' is-neg' : ''}">${fmtDelta(glory)} ⚜️</span>` : ''}
                </header>
                <ul class="fw-heroes__list">${chips}</ul>
            </section>`;
    }).join('');
    return `
        <div class="fw-result-divider"></div>
        <div class="fw-heroes" aria-label="Every hero touched by this fate">
            <div class="fw-heroes__title"><span aria-hidden="true">✦</span> Who the fate found <span aria-hidden="true">✦</span></div>
            ${groupHtml}
        </div>`;
}

/** The impact tiles' data: one entry per Glory, Tailwind, guild Glory, gold, stars, map and artifact change. */
export function resultStatDefs(result, { crestIconOf, guildNameOf }) {
    // Artifacts get their own showcase block below, so only show the generic
    // tile for removal events (no names available to show) or when no granted list.
    const showArtifactTile = (result.artifactsRemoved || 0) > 0 ||
        ((result.artifactsGranted || 0) > 0 && !(result.grantedArtifacts?.length));

    return [
        result.gloryDelta
            ? { icon: '⚜️', label: result.envoy ? 'Glory' : 'Guild Glory', displayStr: `${result.gloryDelta >= 0 ? '+' : ''}${result.gloryDelta}`, isNeg: result.gloryDelta < 0 }
            : null,
        result.wind
            ? { icon: tailwindGlyphSvg(), label: 'Tailwind', displayStr: `+${result.wind.total}`, isNeg: false, cls: `fw-result-stat--wind fw-wind--${result.wind.key || 'breeze'}` }
            : null,
        ...Object.entries(result.gloryByGuild || {})
            .filter(([gid, n]) => n && (result.envoy || gid !== result.guildId))
            .map(([gid, n]) => ({ icon: crestIconOf(gid), label: `${guildNameOf(gid) || 'Guild'} Glory`, displayStr: `${n >= 0 ? '+' : ''}${n}`, isNeg: n < 0 })),
        result.goldDelta
            ? { icon: GOLD_COIN_HTML, label: 'Gold',        displayStr: `${result.goldDelta >= 0 ? '+' : ''}${result.goldDelta}`,             isNeg: result.goldDelta < 0 }
            : null,
        result.starsDelta
            ? { icon: '⭐', label: 'Stars',       displayStr: `${result.starsDelta >= 0 ? '+' : ''}${result.starsDelta}`,           isNeg: result.starsDelta < 0 }
            : null,
        result.classQuestDelta
            ? { icon: '🗺️', label: 'Team Quest map', displayStr: `${result.classQuestDelta >= 0 ? '+' : ''}${result.classQuestDelta}`, isNeg: result.classQuestDelta < 0 }
            : null,
        showArtifactTile
            ? { icon: '🎒', label: 'Artifacts',
                displayStr: artifactDeltaText(result.artifactsGranted, result.artifactsRemoved),
                isNeg: (result.artifactsRemoved || 0) > (result.artifactsGranted || 0) }
            : null,
    ].filter(Boolean);
}

/** The impact grid (with its divider), or '' when the fate changed nothing to show. */
export function statsBlockHtml(statDefs) {
    const statsHtml = statDefs.map((s, i) => `
        <div class="fw-result-stat${s.cls ? ` ${s.cls}` : ''}" style="animation-delay:${(0.05 + i * 0.07).toFixed(2)}s">
            <div class="fw-result-stat__icon">${s.icon}</div>
            <div class="fw-result-stat__value ${s.isNeg ? 'fw-result-stat__value--negative' : ''}">${s.displayStr}</div>
            <div class="fw-result-stat__label">${s.label}</div>
        </div>`).join('');

    return statsHtml
        ? `<div class="fw-result-divider"></div>
           <div class="fw-result-impact-grid">${statsHtml}</div>`
        : '';
}

/** Artifact showcase (when specific artifacts were granted), each unique artifact once with a count. */
export function artifactShowcaseHtml(grantedArtifacts) {
    if (!(grantedArtifacts || []).length) return '';
    const unique = uniqueArtifacts(grantedArtifacts);
    const pills = unique.map(a => `
            <div class="fw-result-artifact-pill">
                <span class="fw-result-artifact-pill__icon">${a.icon}</span>
                <span class="fw-result-artifact-pill__name">${a.name}${a.count > 1 ? ` ×${a.count}` : ''}</span>
            </div>`).join('');
    return `
            <div class="fw-result-divider"></div>
            <div class="fw-result-artifacts-header">🎒 Artifacts Received</div>
            <div class="fw-result-artifacts-showcase">${pills}</div>`;
}

/** The chips of heroes the fate found, when the ledger has no rows (older results). */
export function studentChipsHtml(affectedStudents) {
    return affectedStudents.length
        ? `<div class="fw-result-student-row">${affectedStudents.map(s => `<div class="fw-result-student-chip">${avatarHtml(s, 'fw-result-student-avatar')}<span>${esc(s.name)}</span></div>`).join('')}</div>`
        : '';
}

/** The Tailwind's line on the result card ('' without one). */
export function resultWindHtml(result, guildDef) {
    return result.wind ? `<div class="fw-result-wind fw-wind--${result.wind.key || 'breeze'}"><span class="fw-result-wind__orb">${tailwindGlyphSvg()}</span><span>And the Tailwind: +${result.wind.total} Glory more${result.wind.pct > 0 ? `, because ${guildDef?.name || 'the guild'} is behind this year and earns ${pctText(result.wind.pct)} on every Glory` : ' for guilds that are behind this year'}.</span></div>` : '';
}

/** The card shown at once on landing, while the fate's Glory, gold and stars are written. */
export function pendingCardHtml({ segment, guildDef, emblemUrl, rarityConf, ribbon, family, braved }) {
    return `
        <div class="fw-result-card fw-result-card--v2 is-pending${segment.isPrismatic ? ' is-prismatic' : ''}"
             data-rarity="${segment.rarity}" data-family="${family}" data-outcome="${braved ? 'braved' : 'gain'}"
             style="--rarity-color:${rarityConf.color};--rarity-glow:${rarityConf.glow};--rarity-bg:${rarityConf.bg};border-color:${rarityConf.color};">
            <div class="fw-result-ribbon">${ribbon}</div>
            <div class="fw-result-emoji-orb">${braved ? '🛡️' : signHtml(segment.emoji)}</div>
            <div class="fw-result-guild-row">
                ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || ''}" class="fw-result-guild-row__image">` : ''}
                <span class="fw-result-guild-row__name">${guildDef?.name || ''}</span>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            <div class="fw-result-description">${segment.description}</div>
            <div class="fw-result-inking" aria-live="polite"><span></span><span></span><span></span></div>
        </div>`;
}

/** The finished fate card. `parts` are the pieces built above (hero ledger, stats, artifacts, chips). */
export function resultCardHtml({ segment, result, guildDef, emblemUrl, rarityConf, ribbon, family, outcome, settled, big, heroLedger, stats, artifactShowcase, studentChips }) {
    const decisionHtml = result.decision
        ? `<div class="fw-result-decision">${result.decision}</div>`
        : '';
    return `
        <div class="fw-result-card fw-result-card--v2${settled ? ' is-settled' : ''}${segment.isPrismatic ? ' is-prismatic' : ''}${heroLedger && big ? ' has-heroes' : ''}"
             data-rarity="${segment.rarity}" data-family="${family}" data-outcome="${outcome}"
             style="--rarity-color:${rarityConf.color};--rarity-glow:${rarityConf.glow};--rarity-bg:${rarityConf.bg};border-color:${rarityConf.color};">
            <div class="fw-result-ribbon">${ribbon}</div>
            <div class="fw-result-emoji-orb">${result.braved ? '🛡️' : signHtml(segment.emoji)}</div>
            <div class="fw-result-guild-row">
                ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || ''}" class="fw-result-guild-row__image">` : ''}
                <span class="fw-result-guild-row__name">${guildDef?.name || result.guildId}</span>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            ${decisionHtml}
            <div class="fw-result-description">${result.description || segment.description}</div>
            ${resultWindHtml(result, guildDef)}
            ${stats}
            ${artifactShowcase}
            ${heroLedger}
            ${studentChips}
        </div>`;
}

// ── The final ledger ──────────────────────────────────────────────────────────

const deltaChip = (value, icon, label, isNeg = value < 0) => `
        <span class="fw-summary-delta${isNeg ? ' fw-summary-delta--negative' : ''}" title="${label}">
            <span class="fw-summary-delta__icon">${icon}</span>${value}
        </span>`;

/** One guild's row of delta chips on the final ledger. */
export function summaryDeltasHtml(r, { crestIconOf, guildNameOf }) {
    const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
    return [
        r.gloryDelta ? deltaChip(signed(r.gloryDelta), '⚜️', 'Glory', r.gloryDelta < 0) : '',
        r.wind?.total ? deltaChip(signed(r.wind.total), tailwindGlyphSvg('fw-summary-delta__glyph'), 'Tailwind', false).replace('fw-summary-delta"', 'fw-summary-delta fw-summary-delta--wind"') : '',
        ...Object.entries(r.gloryByGuild || {}).filter(([gid, n]) => n && (r.envoy || gid !== r.guildId))
            .map(([gid, n]) => deltaChip(signed(n), crestIconOf(gid), `${guildNameOf(gid) || 'Guild'} Glory`, n < 0)),
        r.goldDelta ? deltaChip(signed(r.goldDelta), GOLD_COIN_HTML, 'Gold', r.goldDelta < 0) : '',
        r.starsDelta ? deltaChip(signed(r.starsDelta), '⭐', 'Stars', r.starsDelta < 0) : '',
        r.classQuestDelta ? deltaChip(signed(r.classQuestDelta), '🗺️', 'Team Quest map', r.classQuestDelta < 0) : '',
        (r.artifactsGranted || r.artifactsRemoved)
            ? deltaChip(artifactDeltaText(r.artifactsGranted, r.artifactsRemoved), '🎒', 'Artifacts', (r.artifactsRemoved || 0) > 0)
            : '',
    ].join('');
}

/** Every hero the fate touched, by first name (other guilds' heroes wear their guild's colour). */
export function summaryHeroesHtml(r, getGuild) {
    const heroes = (r.ledger || []).filter((row) => row.glory || row.gold || row.stars || row.artifacts?.length);
    return heroes.length
        ? `<ul class="fw-summary-heroes">${heroes.map((row) => {
            const g = getGuild(row.guildId);
            const neg = (row.glory || 0) < 0 || (row.gold || 0) < 0;
            return `<li class="${neg ? 'is-neg' : ''}${row.guildId !== r.guildId ? ' is-other' : ''}" style="--hg:${g?.primary || '#e8c46a'}">${esc(String(row.name || 'Hero').split(' ')[0])}</li>`;
        }).join('')}</ul>`
        : '';
}

/** The segment label with Gold's coin in place of the 🪙/💰 emoji. */
export function summaryResultLabel(segmentLabel) {
    return String(segmentLabel || '').replace(/🪙|💰/gu, GOLD_COIN_HTML);
}

/** One guild's pill in the progress strip. */
export function progressPillHtml({ guildId, guildDef, emblemUrl, index, stateName }) {
    return `
            <div class="fw-progress-pill" data-state="${stateName}" style="--guild-primary:${guildDef?.primary || '#999'};">
                <div class="fw-progress-pill__crest">
                    ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || guildId}" class="fw-progress-pill__image">` : `<span>${index + 1}</span>`}
                    ${stateName === 'complete' ? '<span class="fw-progress-pill__check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' : ''}
                </div>
                <div class="fw-progress-pill__copy">
                    <div class="fw-progress-pill__step">Guild ${index + 1}</div>
                    <div class="fw-progress-pill__name">${guildDef?.name || guildId}</div>
                </div>
            </div>`;
}

/** Which state a guild's pill is in. */
export function progressState({ allComplete, index, currentIndex, phase }) {
    return allComplete
        ? 'complete'
        : index < currentIndex
            ? 'complete'
            : index === currentIndex && phase !== 'summary'
                ? 'current'
                : 'upcoming';
}

