// ui/modals/crystalPortalView.mjs
// Markup for the Crystal Portal modal (Team Quest map → tap the Portal at the end of
// the road). Pure: takes the view from features/crystalPortalCore.mjs and returns HTML,
// so the app (ui/modals/crystalPortal.js) and crystal-portal-preview.html share it.
// Styles: styles/crystal_portal.css. Motion is transform/opacity only.

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
                <p class="cp-hero__lore">Fill your monthly goal to the very last star and the Portal opens. Every class that steps through rises one Quest Level.</p>
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
    const pctText = `${Math.min(100, Math.round(mine.pct))}%`;
    let headline;
    let detail;
    if (mine.state === 'through') {
        headline = `${esc(mine.name)} stepped through the Portal!`;
        const when = mine.throughAt != null ? ` on ${dayLabel(mine.throughAt)}` : '';
        detail = mine.first
            ? `First class through this month${when}. Now Quest Level ${mine.level}.`
            : `${ordinal(mine.order)} through this month${when}. Now Quest Level ${mine.level}.`;
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
                <p class="cp-mine__eyebrow">Your class · ${pctText}</p>
                <h3 class="cp-mine__title">${headline}</h3>
                <p class="cp-mine__detail">${detail}</p>
            </div>
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
                    ${p.throughAt != null ? `<span class="cp-through__date"><i class="far fa-calendar" aria-hidden="true"></i> ${dayLabel(p.throughAt)}</span>` : ''}
                </span>
            </span>
            <span class="cp-tag">Now Lv ${p.level}</span>
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
        return `
            <li class="cp-near__row${p.id === activeClassId ? ' is-mine' : ''}">
                <span class="cp-through__seal" aria-hidden="true">${esc(p.logo)}</span>
                <span class="cp-near__body">
                    <span class="cp-near__name">${esc(p.name)}</span>
                    <span class="cp-near__bar" aria-hidden="true"><span style="width:${fill.toFixed(1)}%"></span></span>
                </span>
                <span class="cp-near__togo"><strong>${stars(p.starsToGo)} ★</strong><small>to go</small></span>
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

function beyondHtml() {
    const tiles = [
        ['fa-arrow-up', 'One Quest Level up', 'The class rises a level the moment it steps through.'],
        ['fa-route', 'A longer road next month', 'A higher level brings a bigger goal and a fair new challenge.'],
        ['fa-scroll', 'Remembered all year', 'Every opening is kept in the League Archive.']
    ];
    return `
        <section class="cp-beyond cp-rise" style="--rise:4" aria-label="Beyond the Portal">
            ${tiles.map(([icon, title, text], i) => `
                <div class="cp-beyond__tile" style="--i:${i}">
                    <span class="cp-beyond__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
                    <strong>${title}</strong>
                    <span>${text}</span>
                </div>`).join('')}
        </section>`;
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
                ${beyondHtml()}
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
