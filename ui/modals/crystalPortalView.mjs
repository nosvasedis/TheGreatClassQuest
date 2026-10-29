// ui/modals/crystalPortalView.mjs
// Markup for the Crystal Portal modal (Team Quest map → tap the Portal at the end of
// the road). Pure: takes the view from features/crystalPortalCore.mjs and returns HTML,
// so the app (ui/modals/crystalPortal.js) and crystal-portal-preview.html share it.
// Styles: styles/crystal_portal.css. Motion is transform/opacity only.

import { QUEST_RANKS, rankForLevel, newAtLevel, portalSpoilsGold, runesForLevel, guardianTestFor } from '../../features/questRanksCore.mjs';
import { rankCrestSvg, renderRuneMarks } from '../../features/questRankCrest.mjs';

const ASSETS = {
    vortex: new URL('../../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href,
    crest: new URL('../../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stars(value) {
    const n = Number(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

export function monthName(monthKey) {
    const m = Number(String(monthKey || '').slice(5, 7));
    return MONTH_NAMES[m - 1] || '';
}

function dayLabel(ms) {
    if (ms == null) return '';
    return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// —— Hero ————————————————————————————————————————————————

const RUNES = '✦ ONE STAR AT A TIME ✦ TOGETHER TO THE SUMMIT ✦ THE PORTAL OPENS FOR THOSE WHO FINISH ';

function portalHtml(view) {
    // Classes already through float in the Portal's light (up to eight).
    const visitors = view.through.slice(0, 8);
    const step = visitors.length ? 360 / visitors.length : 0;
    const visitorHtml = visitors.map((p, i) => `
        <span class="cp-visitor${p.first ? ' is-first' : ''}" style="--a:${(-90 + i * step).toFixed(1)}deg;--d:${(i * 0.35).toFixed(2)}s" title="${esc(p.name)}">
            <span class="cp-visitor__seal">${esc(p.logo)}</span>
        </span>`).join('');
    const shards = Array.from({ length: 6 }, (_, i) => `<span class="cp-shard cp-shard--${i + 1}"></span>`).join('');
    return `
        <div class="cp-portal${view.open ? ' is-open' : ' is-sealed'}" aria-hidden="true">
            <span class="cp-portal__aura"></span>
            <svg class="cp-portal__runes" viewBox="0 0 200 200">
                <defs><path id="cpRunePath" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"></path></defs>
                <circle cx="100" cy="100" r="96" class="cp-portal__rim"></circle>
                <circle cx="100" cy="100" r="80" class="cp-portal__rim cp-portal__rim--inner"></circle>
                <text><textPath href="#cpRunePath" textLength="548">${RUNES}</textPath></text>
            </svg>
            <span class="cp-portal__spin cp-portal__spin--outer"><img src="${ASSETS.vortex}" alt="" draggable="false" decoding="async"></span>
            <span class="cp-portal__spin cp-portal__spin--inner cp-fx-heavy"><img src="${ASSETS.vortex}" alt="" draggable="false" decoding="async"></span>
            <span class="cp-portal__core"></span>
            ${view.open ? '' : '<span class="cp-portal__lock"><i class="fas fa-lock"></i></span>'}
            <span class="cp-portal__flash"></span>
            <span class="cp-orbit">${shards}</span>
            ${visitorHtml}
        </div>`;
}

function heroHtml(view, { league, monthKey }) {
    const status = view.open
        ? `<span class="cp-chip cp-chip--open"><i class="fas fa-door-open" aria-hidden="true"></i> Open · ${view.through.length} of ${view.total} through</span>`
        : `<span class="cp-chip cp-chip--sealed"><i class="fas fa-lock" aria-hidden="true"></i> Sealed · who will be first?</span>`;
    const motes = Array.from({ length: 10 }, (_, i) => `<span class="cp-mote cp-mote--${i + 1}${i > 4 ? ' cp-fx-heavy' : ''}"></span>`).join('');
    return `
        <header class="cp-hero">
            <div class="cp-sky" aria-hidden="true">
                <span class="cp-sky__stars"></span>
                <span class="cp-sky__stars cp-sky__stars--twinkle cp-fx-heavy"></span>
                <span class="cp-sky__nebula"></span>
                ${motes}
            </div>
            ${portalHtml(view)}
            <div class="cp-hero__copy">
                <p class="cp-hero__eyebrow">The end of the road · ${esc(league)} League · ${esc(monthName(monthKey))}</p>
                <h2 class="cp-hero__title">The Crystal Portal</h2>
                <p class="cp-hero__lore">Fill your monthly goal to the very last star and light every rune of your rank, and the Portal opens. Every class that steps through rises one rank and brings home Gold for every hero.</p>
                <div class="cp-hero__chips">
                    <span class="cp-chip"><i class="fas fa-bullseye" aria-hidden="true"></i> 100% of each class's own goal</span>
                    ${status}
                </div>
            </div>
        </header>`;
}

// —— Your class ——————————————————————————————————————————

function ringHtml(pctValue) {
    const share = Math.min(1, Math.max(0, (Number(pctValue) || 0) / 100));
    const c = 2 * Math.PI * 42;
    return `
        <svg class="cp-ring" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
                <linearGradient id="cpRingGrad" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stop-color="#ab6cff"></stop>
                    <stop offset="55%" stop-color="#65e8ff"></stop>
                    <stop offset="100%" stop-color="#f193ff"></stop>
                </linearGradient>
            </defs>
            <circle class="cp-ring__track" cx="50" cy="50" r="42"></circle>
            <circle class="cp-ring__fill" cx="50" cy="50" r="42" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - share)).toFixed(2)}"></circle>
        </svg>`;
}

function mineHtml(mine) {
    if (!mine) return '';
    // The real share of the goal: a class past it says so (121%), the ring stays full.
    const pctText = `${Math.floor(Math.max(0, Number(mine.reach ?? mine.pct) || 0))}%`;
    let headline;
    let detail;
    if (mine.state === 'through') {
        headline = `${esc(mine.name)} stepped through the Portal!`;
        const when = mine.throughAt != null ? ` on ${dayLabel(mine.throughAt)}` : '';
        detail = mine.first
            ? `First class through this month${when}. Now Quest Level ${mine.level}.`
            : `${ordinal(mine.order)} through this month${when}. Now Quest Level ${mine.level}.`;
    } else if (mine.state === 'guardian') {
        headline = `${esc(mine.name)} faces the Portal Guardian`;
        detail = mine.portal?.guardian?.triedToday
            ? 'The Guardian has spoken today and asks again next lesson. Every star and rune stays lit.'
            : `Stars full and every rune lit. Answer <strong>${mine.portal.guardian.toPass} of ${mine.portal.guardian.questions}</strong> riddles to open the Portal.`;
    } else if (mine.state === 'sealed') {
        const sleeping = (mine.portal?.runes || []).filter((r) => !r.met && r.id !== 'guardian').length;
        headline = `${esc(mine.name)} filled the goal!`;
        detail = `The Portal is still sealed: <strong>${sleeping} ${sleeping === 1 ? 'rune sleeps' : 'runes sleep'}</strong>. Light ${sleeping === 1 ? 'it' : 'them'} to step through.`;
    } else if (mine.state === 'threshold') {
        headline = `${esc(mine.name)} stands at the threshold`;
        detail = `Only <strong>${stars(mine.starsToGo)} ★</strong> left to open the Portal.`;
    } else {
        headline = `${esc(mine.name)} is on the road`;
        detail = `<strong>${stars(mine.starsToGo)} ★</strong> to the Portal · ${stars(mine.stars)} of ${stars(mine.goal)} stars so far.`;
    }
    return `
        <section class="cp-mine cp-mine--${mine.state} cp-rise" style="--rise:1">
            <div class="cp-mine__ring">
                ${ringHtml(mine.pct)}
                <span class="cp-mine__seal" aria-hidden="true">${esc(mine.logo)}</span>
                ${mine.state === 'through' ? '<span class="cp-mine__crown" aria-hidden="true"><i class="fas fa-check"></i></span>' : ''}
            </div>
            <div class="cp-mine__copy">
                <p class="cp-mine__eyebrow">Your class · ${pctText}${mine.portal ? ` · <span class="cp-mine__rank">${rankCrestSvg(mine.portal.level, { className: 'cp-mine__crest' })}${esc(mine.portal.rank.title)}</span>` : ''}</p>
                <h3 class="cp-mine__title">${headline}</h3>
                <p class="cp-mine__detail">${detail}</p>
            </div>
        </section>
        ${runesHtml(mine)}`;
}

/** The runes the class's rank asks for this month, each with how far it has come. */
function runesHtml(mine) {
    const portal = mine?.portal;
    if (!portal) return '';
    const rank = portal.rank;
    if (!portal.runes.length) {
        return `
        <section class="cp-card cp-runes cp-rise" style="--rise:1">
            <h3 class="cp-card__title"><i class="fas fa-gem" aria-hidden="true"></i><span>Portal runes</span></h3>
            <p class="cp-card__note cp-card__note--solo">${esc(rank.title)} only need to fill the goal. From Level 2 the Portal asks for runes too.</p>
        </section>`;
    }
    const rows = portal.runes.map((rune) => {
        let body = '';
        if (rune.id === 'virtues') {
            body = `<span class="cp-rune__parts">${rune.parts.map((part) => `
                <span class="cp-rune__part${part.met ? ' is-lit' : ''}" style="--v:${part.color}">
                    <i class="fas ${part.icon}" aria-hidden="true"></i>
                    <b>${esc(part.label)}</b>
                    <small>${stars(Math.min(part.have, part.need))} / ${stars(part.need)}★</small>
                </span>`).join('')}</span>`;
        } else if (rune.id === 'lanterns') {
            const dots = Array.from({ length: portal.heroes }, (_, i) => `<span class="cp-lantern${i < rune.have ? ' is-lit' : ''}"></span>`).join('');
            body = `<span class="cp-rune__lanterns" aria-label="${rune.have} of ${portal.heroes} lanterns lit">${dots}</span>
                <small class="cp-rune__note">${rune.have} lit · ${rune.need} needed · a lantern needs ${rune.each}★ of a hero's own</small>`;
        } else if (rune.id === 'ownLight') {
            const share = Math.min(100, (rune.have / Math.max(1, rune.need)) * 100);
            body = `<span class="cp-rune__bar"><span style="width:${share.toFixed(1)}%"></span></span>
                <small class="cp-rune__note">${stars(rune.have)} / ${stars(rune.need)}★ from the heroes' own stars (bonuses don't count here)</small>`;
        } else if (rune.id === 'guardian') {
            const g = portal.guardian;
            const pips = Array.from({ length: g.questions }, (_, i) => `<span class="cp-riddle-pip${i < g.toPass ? ' is-needed' : ''}">?</span>`).join('');
            const state = g.passed ? 'The Guardian bowed this month.'
                : g.awake ? (g.triedToday ? 'The Guardian asks again next lesson.' : 'The Guardian is awake and waits at the gate.')
                    : 'Wakes once the stars fill the goal and every other rune is lit.';
            const button = g.canTry && mine.owned
                ? '<button type="button" class="cp-back cp-guardian-btn" data-portal-guardian><i class="fas fa-dungeon" aria-hidden="true"></i><span>Face the Guardian</span></button>'
                : '';
            body = `<span class="cp-rune__riddles">${pips}</span><small class="cp-rune__note">${state}</small>${button}`;
        }
        return `
            <li class="cp-rune${rune.met ? ' is-lit' : ''} cp-rune--${rune.id}">
                <span class="cp-rune__glyph" aria-hidden="true"><i class="fas ${rune.icon}"></i></span>
                <span class="cp-rune__body">
                    <span class="cp-rune__head"><strong>${esc(rune.name)}</strong><em>${rune.met ? '<i class="fas fa-check" aria-hidden="true"></i> Lit' : 'Asleep'}</em></span>
                    <span class="cp-rune__rule">${esc(rune.rule)}</span>
                    ${body}
                </span>
            </li>`;
    }).join('');
    return `
        <section class="cp-card cp-runes cp-rise" style="--rise:1">
            <h3 class="cp-card__title"><i class="fas fa-gem" aria-hidden="true"></i><span>Portal runes of the ${esc(rank.name)}</span><span class="cp-card__count">${portal.runesLit}/${portal.runes.length}</span></h3>
            <ol class="cp-runes__list">${rows}</ol>
            <p class="cp-card__note"><i class="fas fa-star" aria-hidden="true"></i><span>Stars always count for the race, whatever the runes say. Nothing is ever taken away.</span></p>
        </section>`;
}

// —— Through the Portal / At the threshold ——————————————————

function throughHtml(view, activeClassId) {
    const rows = view.through.map((p) => `
        <li class="cp-through__row${p.id === activeClassId ? ' is-mine' : ''}${p.first ? ' is-first' : ''}">
            <span class="cp-through__order" aria-label="${ordinal(p.order)} through">${p.first ? '<i class="fas fa-crown" aria-hidden="true"></i>' : ordinal(p.order)}</span>
            <span class="cp-through__seal" aria-hidden="true">${esc(p.logo)}</span>
            <span class="cp-through__body">
                <span class="cp-through__name">${esc(p.name)}</span>
                <span class="cp-through__meta">
                    ${p.first ? '<span class="cp-tag cp-tag--first">First through</span>' : ''}
                    ${Number(p.progress) >= 101 ? `<span class="cp-tag cp-tag--beyond" title="Still gathering stars beyond the Portal, on the Starward Way"><i class="fas fa-star" aria-hidden="true"></i> ${Math.floor(Number(p.progress))}%</span>` : ''}
                    ${p.throughAt != null ? `<span class="cp-through__date"><i class="far fa-calendar" aria-hidden="true"></i> ${dayLabel(p.throughAt)}</span>` : ''}
                </span>
            </span>
            <span class="cp-tag cp-tag--rank" title="Now Quest Level ${p.level}">${rankCrestSvg(p.level, { className: 'cp-tag__crest' })}${esc(rankForLevel(p.level).title)}</span>
        </li>`).join('');
    const body = rows
        ? `<ol class="cp-through">${rows}</ol>`
        : `<div class="cp-empty">
                <span class="cp-empty__icon" aria-hidden="true"><i class="fas fa-lock"></i></span>
                <p>The Portal is still sealed this month. The first class to fill its goal opens it.</p>
           </div>`;
    return `
        <section class="cp-card cp-rise" style="--rise:2">
            <h3 class="cp-card__title"><i class="fas fa-door-open" aria-hidden="true"></i><span>Stepped through this month</span><span class="cp-card__count">${view.through.length}</span></h3>
            ${body}
        </section>`;
}

function thresholdHtml(view, activeClassId) {
    const rows = view.threshold.map((p) => {
        // The bar shows the last stretch only: the Crystal Realm (85%) to the Portal (100%).
        const fill = Math.min(100, Math.max(0, ((p.progress - 85) / 15) * 100));
        const togo = p.sealed
            ? `<span class="cp-near__togo cp-near__togo--sealed"><strong><i class="fas fa-lock" aria-hidden="true"></i></strong><small>${p.portal?.state === 'guardian' ? 'Guardian' : 'runes'}</small></span>`
            : `<span class="cp-near__togo"><strong>${stars(p.starsToGo)} ★</strong><small>to go</small></span>`;
        return `
            <li class="cp-near__row${p.id === activeClassId ? ' is-mine' : ''}${p.sealed ? ' is-sealed' : ''}">
                <span class="cp-through__seal" aria-hidden="true">${esc(p.logo)}</span>
                <span class="cp-near__body">
                    <span class="cp-near__name">${esc(p.name)}${p.portal?.runes?.length ? renderRuneMarks(p.portal, { className: 'qr-marks cp-near__runes' }) : ''}</span>
                    <span class="cp-near__bar" aria-hidden="true"><span style="width:${fill.toFixed(1)}%"></span></span>
                </span>
                ${togo}
            </li>`;
    }).join('');
    const roadLine = view.road
        ? `<p class="cp-card__note"><i class="fas fa-person-hiking" aria-hidden="true"></i> ${view.road} ${view.road === 1 ? 'party is' : 'parties are'} still on the road to the Crystal Realm.</p>`
        : '';
    return `
        <section class="cp-card cp-rise" style="--rise:3">
            <h3 class="cp-card__title"><i class="fas fa-gem" aria-hidden="true"></i><span>At the threshold</span><span class="cp-card__count">${view.threshold.length}</span></h3>
            ${rows ? `<ol class="cp-near">${rows}</ol>` : '<p class="cp-card__note cp-card__note--solo">No class is in the Crystal Realm right now.</p>'}
            ${roadLine}
        </section>`;
}

function beyondHtml(mine) {
    // For your class: the rank it is walking for now and what the next one asks. Otherwise, in general.
    const level = mine?.portal ? (mine.state === 'through' ? Math.max(mine.portal.level, Number(mine.level) || 1) : mine.portal.level) : null;
    const nextLevel = level ? level + 1 : null;
    const nextRank = nextLevel ? rankForLevel(nextLevel) : null;
    const next = nextLevel ? newAtLevel(nextLevel) : null;
    const tiles = [
        [nextRank ? rankCrestSvg(nextLevel, { className: 'cp-beyond__crest' }) : '<i class="fas fa-arrow-up"></i>',
            nextRank ? `Rise to ${esc(nextRank.title)}` : 'One rank up',
            nextRank ? `Quest Level ${nextLevel}: a new crest the moment the class steps through.` : 'The class rises a rank and wears a new crest the moment it steps through.'],
        ['<i class="fas fa-coins"></i>', level ? `+${portalSpoilsGold(level)} Gold for every hero` : 'Portal spoils',
            level ? 'The Portal spoils, paid once when the class steps through.' : 'Gold for every hero when the class steps through: more at higher ranks.'],
        ['<i class="fas fa-route"></i>', 'A new challenge next month',
            next ? esc(next.text) : 'The goal grows a little, and the runes stay.']
    ];
    return `
        <section class="cp-beyond cp-rise" style="--rise:4" aria-label="Beyond the Portal">
            ${tiles.map(([icon, title, text], i) => `
                <div class="cp-beyond__tile" style="--i:${i}">
                    <span class="cp-beyond__icon" aria-hidden="true">${icon}</span>
                    <strong>${title}</strong>
                    <span>${text}</span>
                </div>`).join('')}
        </section>`;
}

/** What each rank asks to open the Portal, with the class's own rank marked. */
export function ranksLadderHtml(currentLevel = null) {
    const adds = (level) => {
        if (level === 1) return 'Fill the goal';
        if (level >= 7) return 'Every rune, every month';
        const n = newAtLevel(level);
        if (n?.kind === 'guardian') return `Guardian asks ${guardianTestFor(level).questions}`;
        if (n?.rune.id === 'guardian') return `+ Guardian (${guardianTestFor(level).toPass} of ${guardianTestFor(level).questions})`;
        return `+ ${n.rune.short}`;
    };
    const icons = (level) => runesForLevel(level).map((rune) => {
        const fresh = rune.from === level || (level === 6 && rune.id === 'guardian');
        return `<span class="qr-mark is-lit${fresh ? ' is-new' : ''}" title="${esc(rune.name)}"><i class="fas ${rune.icon}" aria-hidden="true"></i></span>`;
    }).join('');
    const current = currentLevel ? Math.min(7, currentLevel) : null;
    return `
        <ol class="cp-ladder">
            ${QUEST_RANKS.map((rank) => `
                <li class="cp-ladder__rank${current === rank.level ? ' is-current' : ''}${current && rank.level < current ? ' is-past' : ''}">
                    ${rankCrestSvg(rank.level, { className: 'cp-ladder__crest' })}
                    <strong>${esc(rank.name)}</strong>
                    <small>Level ${rank.level}${rank.level === 7 ? '+' : ''}</small>
                    <span>${esc(adds(rank.level))}</span>
                    <span class="qr-marks cp-ladder__runes">${icons(rank.level) || '<i class="fas fa-star" aria-hidden="true"></i>'}</span>
                    <em><i class="fas fa-coins" aria-hidden="true"></i> +${portalSpoilsGold(rank.level)} Gold</em>
                    ${current === rank.level ? '<b class="cp-ladder__here">You are here</b>' : ''}
                </li>`).join('')}
        </ol>`;
}

// —— Portal Keepers (loaded after the modal opens) ——————————————

export function keepersHtml(view, { activeClassId = null, failed = false } = {}) {
    if (failed) return '<p class="cp-card__note cp-card__note--solo">The year\'s record could not be read just now.</p>';
    if (!view.keepers) {
        return `<div class="cp-keepers__loading" aria-label="Loading the year's record">${'<span></span>'.repeat(3)}</div>`;
    }
    if (!view.keepers.length) return '<p class="cp-card__note cp-card__note--solo">No classes in this league yet.</p>';
    const months = view.keepers[0].months;
    const head = months.map((m) => `<span class="cp-keepers__month${m.current ? ' is-current' : ''}">${esc(monthName(m.monthKey).slice(0, 3))}</span>`).join('');
    const rows = view.keepers.map((k) => `
        <li class="cp-keepers__row${k.id === activeClassId ? ' is-mine' : ''}">
            <span class="cp-keepers__who"><span aria-hidden="true">${esc(k.logo)}</span><span class="cp-keepers__name">${esc(k.name)}</span></span>
            <span class="cp-keepers__cells">${k.months.map((m) => `<span class="cp-keepers__cell${m.done ? ' is-done' : ''}${m.current ? ' is-current' : ''}" title="${esc(monthName(m.monthKey))}: ${m.done ? 'Portal opened' : 'not yet'}"></span>`).join('')}</span>
            <span class="cp-keepers__count" aria-label="${k.count} times">${k.count}</span>
        </li>`).join('');
    const total = view.yearOpenings || 0;
    return `
        <p class="cp-card__note"><i class="fas fa-wand-sparkles" aria-hidden="true"></i><span>The Portal has opened <strong>${total} ${total === 1 ? 'time' : 'times'}</strong> in this league this school year.</span></p>
        <div class="cp-keepers" style="--months:${months.length}">
            <div class="cp-keepers__head"><span></span><span class="cp-keepers__cells">${head}</span><span></span></div>
            <ol class="cp-keepers__list">${rows}</ol>
        </div>`;
}

/** The whole modal body. */
export function portalModalHtml(view, { league = '', monthKey = '', activeClassId = null, lite = false } = {}) {
    const empty = !view.total
        ? `<div class="cp-card cp-rise" style="--rise:1"><div class="cp-empty"><span class="cp-empty__icon" aria-hidden="true">🧭</span><p>No classes are travelling in the <strong>${esc(league)}</strong> League yet.</p></div></div>`
        : '';
    return `
        <div class="cp${lite ? ' cp--lite' : ''}">
            ${heroHtml(view, { league, monthKey })}
            <div class="cp-body">
                ${empty || `
                ${mineHtml(view.mine)}
                <div class="cp-grid">
                    ${throughHtml(view, activeClassId)}
                    ${thresholdHtml(view, activeClassId)}
                </div>
                ${beyondHtml(view.mine)}
                <section class="cp-card cp-rise" style="--rise:5">
                    <h3 class="cp-card__title"><i class="fas fa-shield-halved" aria-hidden="true"></i><span>The ranks of the road</span></h3>
                    <p class="cp-card__note"><i class="fas fa-circle-info" aria-hidden="true"></i><span>Each time a class steps through, it rises one rank. Higher ranks ask a little more to open the Portal, and pay more Gold.</span></p>
                    ${ranksLadderHtml(view.mine?.portal?.level || null)}
                </section>
                <section class="cp-card cp-rise" style="--rise:5">
                    <h3 class="cp-card__title"><i class="fas fa-gem" aria-hidden="true"></i><span>Portal Keepers this school year</span></h3>
                    <div data-portal-keepers>${keepersHtml(view, { activeClassId })}</div>
                </section>`}
                <footer class="cp-foot cp-rise" style="--rise:6">
                    <button type="button" class="cp-back" data-portal-realm>
                        <img src="${ASSETS.crest}" alt="" aria-hidden="true" draggable="false">
                        <span>Back to the Crystal Realm</span>
                    </button>
                    <em>Progress is measured against each class's own goal, so every party races fairly.</em>
                </footer>
            </div>
        </div>`;
}
