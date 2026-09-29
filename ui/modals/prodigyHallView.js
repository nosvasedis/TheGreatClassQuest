// ui/modals/prodigyHallView.js — HTML for the Hall of Prodigies (no state, no DOM access).
// A sunlit marble hall: every completed month enshrines its Prodigy under the rose window.
// Kept pure so the guidebook capture can render the real markup from sample data.

export function escProdigy(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function initialOf(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

/* ── Artwork ─────────────────────────────────────────────────────────────── */

/** Gold crown. Gradients come from the shared <defs> in the modal template. */
export const PRODIGY_CROWN_SVG = `
<svg class="ph-crown-art" viewBox="0 0 64 46" aria-hidden="true" focusable="false">
    <path d="M7 37 L3 11 L18.5 23 L32 5 L45.5 23 L61 11 L57 37 Z" fill="url(#ph-gold)" stroke="#8a6420" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M10 33 L8 18 L19 27 L32 11 L45 27 L56 18 L54 33 Z" fill="#fff4cf" opacity="0.28"/>
    <rect x="6" y="35.5" width="52" height="8" rx="2.4" fill="url(#ph-gold-band)" stroke="#8a6420" stroke-width="1.6"/>
    <circle cx="3" cy="11" r="2.8" fill="#fff1c1" stroke="#8a6420" stroke-width="1.2"/>
    <circle cx="32" cy="5" r="3.2" fill="#fff1c1" stroke="#8a6420" stroke-width="1.2"/>
    <circle cx="61" cy="11" r="2.8" fill="#fff1c1" stroke="#8a6420" stroke-width="1.2"/>
    <path d="M32 21 l4.6 5.4 -4.6 5.4 -4.6 -5.4 Z" fill="#7c3aed" stroke="#fff1c1" stroke-width="1"/>
    <circle cx="19" cy="30" r="2.6" fill="#2563eb" stroke="#fff1c1" stroke-width="0.9"/>
    <circle cx="45" cy="30" r="2.6" fill="#e11d48" stroke="#fff1c1" stroke-width="0.9"/>
    <circle cx="16" cy="39.5" r="1.5" fill="#8a6420"/><circle cx="32" cy="39.5" r="1.5" fill="#8a6420"/><circle cx="48" cy="39.5" r="1.5" fill="#8a6420"/>
</svg>`;

/** Small flat crown for counts and coins. */
const MINI_CROWN_SVG = `<svg viewBox="0 0 24 18" aria-hidden="true" focusable="false"><path d="M3 15 L1.5 4 L7.5 9 L12 2 L16.5 9 L22.5 4 L21 15 Z" fill="currentColor"/><rect x="3" y="14.5" width="18" height="3" rx="1" fill="currentColor"/></svg>`;

/** One laurel branch, drawn for the left side; the right side is a mirrored copy
 *  (scale(-1 1) about the CSS transform-origin 100px 190px, i.e. across x = 100). */
const LAUREL_BRANCH = (() => {
    const leaves = [];
    const cx = 100;
    const cy = 100;
    const r = 88;
    for (let i = 0; i < 9; i++) {
        const deg = 112 + i * 17.5; // from the bottom round the left side toward the top
        const rad = (deg * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        const tilt = deg + 90 + 28;
        const shade = i % 2 ? 'url(#ph-leaf-b)' : 'url(#ph-leaf-a)';
        leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="11" ry="4.6" transform="rotate(${tilt.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${shade}"/>`);
        const ix = cx + (r - 9) * Math.cos(rad + 0.14);
        const iy = cy + (r - 9) * Math.sin(rad + 0.14);
        leaves.push(`<ellipse cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" rx="9" ry="3.8" transform="rotate(${(tilt - 52).toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)})" fill="${shade}" opacity="0.92"/>`);
    }
    return `<path d="M${(cx + r * Math.cos(1.95)).toFixed(1)} ${(cy + r * Math.sin(1.95)).toFixed(1)} A ${r} ${r} 0 0 1 ${(cx + r * Math.cos(4.55)).toFixed(1)} ${(cy + r * Math.sin(4.55)).toFixed(1)}" fill="none" stroke="#8a6420" stroke-width="2.2" stroke-linecap="round"/>${leaves.join('')}`;
})();

export const PRODIGY_LAUREL_SVG = `
<svg class="ph-laurel" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <g class="ph-laurel__branch ph-laurel__branch--l">${LAUREL_BRANCH}</g>
    <g class="ph-laurel__branch ph-laurel__branch--r" transform="scale(-1 1)">${LAUREL_BRANCH}</g>
    <path d="M86 186 q14 -10 28 0 l-6 10 -8 -5 -8 5 Z" fill="#6d28d9" stroke="#fff1c1" stroke-width="1.2"/>
</svg>`;

/** The rose window: twelve panes of amethyst, sapphire and gold glass in lead. */
export const PRODIGY_ROSE_WINDOW_SVG = (() => {
    const panes = [];
    const colours = ['#8b5cf6', '#3b82f6', '#f5c451', '#a78bfa', '#2563eb', '#fbbf24'];
    for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        const x = 100 + 58 * Math.cos(a);
        const y = 100 + 58 * Math.sin(a);
        panes.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" fill="${colours[i % colours.length]}" opacity="0.82"/>`);
        const ix = 100 + 33 * Math.cos(a + Math.PI / 12);
        const iy = 100 + 33 * Math.sin(a + Math.PI / 12);
        panes.push(`<circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="9" fill="${colours[(i + 3) % colours.length]}" opacity="0.9"/>`);
    }
    const spokes = [];
    for (let i = 0; i < 12; i++) {
        const a = ((i * 30 + 15) * Math.PI) / 180;
        spokes.push(`<line x1="${(100 + 22 * Math.cos(a)).toFixed(1)}" y1="${(100 + 22 * Math.sin(a)).toFixed(1)}" x2="${(100 + 86 * Math.cos(a)).toFixed(1)}" y2="${(100 + 86 * Math.sin(a)).toFixed(1)}"/>`);
    }
    return `
<svg class="ph-rose-art" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <circle cx="100" cy="100" r="96" fill="#e9dfcb" stroke="url(#ph-gold)" stroke-width="5"/>
    <circle cx="100" cy="100" r="88" fill="#3b2a6b"/>
    <g>${panes.join('')}</g>
    <g stroke="#2b1f45" stroke-width="3" fill="none">${spokes.join('')}
        <circle cx="100" cy="100" r="44"/><circle cx="100" cy="100" r="80"/>
    </g>
    <circle cx="100" cy="100" r="20" fill="url(#ph-gold)" stroke="#2b1f45" stroke-width="3"/>
    <path d="M100 86 l3.6 9.4 9.4 3.6 -9.4 3.6 -3.6 9.4 -3.6 -9.4 -9.4 -3.6 9.4 -3.6 Z" fill="#fffaf0"/>
</svg>`;
})();

/** Defs shared by every crown and wreath in the hall (lives once in the modal template). */
export const PRODIGY_HALL_DEFS_SVG = `
<svg class="ph-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
        <linearGradient id="ph-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff1c1"/><stop offset="0.45" stop-color="#e9c46a"/><stop offset="1" stop-color="#a4761f"/>
        </linearGradient>
        <linearGradient id="ph-gold-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#b8862b"/><stop offset="0.5" stop-color="#ffe7a3"/><stop offset="1" stop-color="#b8862b"/>
        </linearGradient>
        <linearGradient id="ph-leaf-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff1c1"/><stop offset="1" stop-color="#c99a3b"/>
        </linearGradient>
        <linearGradient id="ph-leaf-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f3d98b"/><stop offset="1" stop-color="#a4761f"/>
        </linearGradient>
    </defs>
</svg>`;

/* ── Pieces ──────────────────────────────────────────────────────────────── */

/** Honour title from this month's written-work average (same thresholds as before). */
export function getProdigyHonour(academicAvg) {
    const avg = Number(academicAvg) || 0;
    if (avg >= 90) return { tone: 'sage', icon: 'fa-hat-wizard', title: 'Ancient Sage', detail: `${avg.toFixed(0)}% in written work` };
    if (avg > 0) return { tone: 'learned', icon: 'fa-book-open', title: 'Learned Hero', detail: `${avg.toFixed(0)}% in written work` };
    return { tone: 'spirit', icon: 'fa-heart', title: 'Heroic Spirit', detail: 'Crowned for heart and effort' };
}

function portraitHtml(winner) {
    if (winner.avatar) return `<img src="${escProdigy(winner.avatar)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="ph-portrait__initial" aria-hidden="true">${escProdigy(initialOf(winner.name))}</span>`;
}

function crownTallyHtml(times) {
    const shown = Math.min(times, 8);
    const crowns = Array.from({ length: shown }, (_, i) => `<span class="ph-tally__crown" style="--ph-k:${i}">${MINI_CROWN_SVG}</span>`).join('');
    const more = times > shown ? `<span class="ph-tally__more">+${times - shown}</span>` : '';
    return `<span class="ph-tally" aria-hidden="true">${crowns}${more}</span>`;
}

function treasuresHtml(inventory, limit) {
    const items = (inventory || []).slice(0, limit);
    if (!items.length) return '<p class="ph-treasures__empty">No treasures from the Market yet.</p>';
    const extra = (inventory || []).length - items.length;
    return `<ul class="ph-treasures__row">${items.map((item, i) => {
        const art = item.image
            ? `<img src="${escProdigy(item.image)}" alt="" loading="lazy" decoding="async">`
            : `<span aria-hidden="true">${escProdigy(item.icon || '📦')}</span>`;
        return `<li class="ph-treasure" style="--ph-k:${i}" title="${escProdigy(item.name || 'Treasure')}">${art}<span class="sr-only">${escProdigy(item.name || 'Treasure')}</span></li>`;
    }).join('')}${extra > 0 ? `<li class="ph-treasure ph-treasure--more" style="--ph-k:${items.length}">+${extra}</li>` : ''}</ul>`;
}

function statHtml({ icon, value, label, title, extra = '' }, i) {
    return `
        <div class="ph-stat" style="--ph-k:${i}" title="${escProdigy(title)}">
            <span class="ph-stat__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <span class="ph-stat__value">${escProdigy(value)}</span>
            <span class="ph-stat__label">${escProdigy(label)}</span>
            ${extra}
        </div>`;
}

function shrineHtml(winner, { isTie, monthName, timesCrowned, inventory, index }) {
    const honour = getProdigyHonour(winner.stats?.academicAvg);
    const epithet = isTie ? 'Co-Prodigy' : 'Prodigy of the Month';
    const stats = [
        { icon: 'fa-star', value: winner.monthlyStars, label: 'Stars this month', title: 'Stars earned in this month' },
        {
            icon: 'fa-crown', value: `${timesCrowned}×`, label: 'Crowned this year', title: 'Months this school year where this student was Prodigy or Co-Prodigy',
            extra: crownTallyHtml(timesCrowned)
        },
        { icon: 'fa-comments', value: winner.stats?.uniqueReasons ?? 0, label: 'Praise reasons', title: 'How many different praise reasons were used when awarding stars' },
        { icon: 'fa-bolt', value: winner.stats?.count3 ?? 0, label: 'Awards of 3★ or more', title: 'Times this month a single award gave three or more stars' },
    ];
    return `
    <article class="ph-shrine${isTie ? ' ph-shrine--co' : ''}" style="--ph-i:${index}" aria-label="${escProdigy(`${winner.name}, ${epithet}, ${monthName}`)}">
        <div class="ph-shrine__statue">
            <div class="ph-halo" aria-hidden="true"><span class="ph-halo__rays"></span></div>
            <span class="ph-flash" aria-hidden="true"></span>
            <div class="ph-crown" aria-hidden="true"><div class="ph-crown__drop">${PRODIGY_CROWN_SVG}</div></div>
            <div class="ph-medallion">
                ${PRODIGY_LAUREL_SVG}
                <div class="ph-portrait">${portraitHtml(winner)}</div>
            </div>
            <span class="ph-glint ph-glint--1" aria-hidden="true"></span>
            <span class="ph-glint ph-glint--2" aria-hidden="true"></span>
            <span class="ph-glint ph-glint--3" aria-hidden="true"></span>
        </div>
        <div class="ph-plaque">
            <p class="ph-plaque__epithet"><span>${epithet}</span><span class="ph-plaque__dot" aria-hidden="true">◆</span><span>${escProdigy(monthName)}</span></p>
            <h3 class="ph-plaque__name">${escProdigy(winner.name)}</h3>
            <p class="ph-honour ph-honour--${honour.tone}"><i class="fas ${honour.icon}" aria-hidden="true"></i><span class="ph-honour__title">${honour.title}</span><span class="ph-honour__detail">${escProdigy(honour.detail)}</span></p>
        </div>
        <div class="ph-stats">${stats.map(statHtml).join('')}</div>
        <div class="ph-treasures">
            <p class="ph-treasures__title"><i class="fas fa-gem" aria-hidden="true"></i> Treasures from the Mystic Market</p>
            ${treasuresHtml(inventory, isTie ? 8 : 12)}
        </div>
    </article>`;
}

/* ── Public builders ─────────────────────────────────────────────────────── */

/** Month cartouche with the earlier/later arrows (ids are wired by rankings.js). */
export function buildProdigyNavHtml({ monthName, canGoBack, canGoForward }) {
    return `
        <div class="ph-cartouche">
            <button type="button" id="prodigy-prev-btn" class="ph-cartouche__arrow" title="Earlier month" aria-label="Earlier month" ${canGoBack ? '' : 'disabled'}>
                <i class="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <p class="ph-cartouche__month" aria-live="polite">${escProdigy(monthName)}</p>
            <button type="button" id="prodigy-next-btn" class="ph-cartouche__arrow" title="Later month" aria-label="Later month" ${canGoForward ? '' : 'disabled'}>
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
        </div>`;
}

/**
 * The enshrined winner(s) of one month.
 * winners: [{ id, name, avatar, monthlyStars, stats: { count3, uniqueReasons, academicAvg } }]
 * crownsById / inventoryById: plain objects or Maps keyed by student id.
 */
export function buildProdigyShrinesHtml({ winners, monthName, crownsById = {}, inventoryById = {}, direction = '' }) {
    const read = (source, id) => (source instanceof Map ? source.get(id) : source?.[id]);
    const isTie = winners.length > 1;
    const shrines = winners.map((winner, index) => shrineHtml(winner, {
        isTie,
        monthName,
        index,
        timesCrowned: Number(read(crownsById, winner.id)) || 1,
        inventory: read(inventoryById, winner.id) || [],
    })).join('');
    const layout = !isTie ? 'solo' : (winners.length === 2 ? 'duo' : 'many');
    const ribbon = isTie
        ? `<p class="ph-ribbon"><span class="ph-ribbon__text"><i class="fas fa-crown" aria-hidden="true"></i> ${winners.length} Co-Prodigies share the crown</span></p>`
        : '';
    return `<div class="ph-stage ph-stage--${layout}${direction ? ` ph-stage--from-${direction}` : ''}">${ribbon}<div class="ph-shrines">${shrines}</div></div>`;
}

/** An empty pedestal: a new year, a quiet month, or a month without stars. */
export function buildProdigyEmptyHtml({ variant = 'quiet', monthName = '' } = {}) {
    const copy = {
        'new-year': {
            icon: 'fa-seedling',
            title: 'A new year begins',
            text: "This year's Hall of Prodigies fills when the first school month closes. Last year's crowns stay in last year's archive.",
        },
        quiet: {
            icon: 'fa-feather-pointed',
            title: 'Quiet halls',
            text: `No star awards were logged in ${escProdigy(monthName)}. Pick another month.`,
        },
        'no-stars': {
            icon: 'fa-star-half-stroke',
            title: 'No crown this month',
            text: `No stars were earned in ${escProdigy(monthName)}, so no Prodigy was crowned.`,
        },
    }[variant] || {};
    return `
        <div class="ph-empty ph-empty--${variant}">
            <div class="ph-empty__pedestal" aria-hidden="true">
                <span class="ph-empty__cushion"></span>
                <span class="ph-empty__icon"><i class="fas ${copy.icon}"></i></span>
            </div>
            <h3 class="ph-empty__title">${copy.title}</h3>
            <p class="ph-empty__text">${copy.text}</p>
        </div>`;
}

export function buildProdigyLoadingHtml() {
    return `
        <div class="ph-loading" role="status">
            <div class="ph-loading__rose" aria-hidden="true">${PRODIGY_ROSE_WINDOW_SVG}</div>
            <p class="ph-loading__title">Lighting the hall…</p>
            <p class="ph-loading__text">Polishing the plaques and dusting the crowns</p>
        </div>`;
}

/**
 * The year's crowns as a row of gold coins, one per month.
 * months: [{ key, short, label, state: 'crowned' | 'empty' | 'live', isCurrent, winners: [{ name, avatar }] }]
 */
export function buildProdigyYearHtml(months = []) {
    if (!months.length) return '';
    const coins = months.map((m, i) => {
        const names = (m.winners || []).map((w) => w.name).join(' & ');
        let face = '';
        if (m.state === 'live') face = '<i class="fas fa-hourglass-half" aria-hidden="true"></i>';
        else if (m.state === 'empty') face = '<span class="ph-coin__none" aria-hidden="true">—</span>';
        else {
            const first = m.winners[0] || {};
            face = first.avatar
                ? `<img src="${escProdigy(first.avatar)}" alt="" loading="lazy" decoding="async">`
                : `<span class="ph-coin__initial" aria-hidden="true">${escProdigy(initialOf(first.name))}</span>`;
            if (m.winners.length > 1) face += `<span class="ph-coin__co" aria-hidden="true">${m.winners.length}</span>`;
        }
        const label = m.state === 'live'
            ? `${m.label}: still being earned`
            : (m.state === 'empty' ? `${m.label}: no Prodigy` : `${m.label}: ${names}`);
        const tag = m.state === 'live' ? 'span' : 'button';
        const attrs = m.state === 'live'
            ? 'aria-disabled="true"'
            : `type="button" data-prodigy-month="${escProdigy(m.key)}"${m.isCurrent ? ' aria-current="true"' : ''}`;
        return `
            <li class="ph-coin-slot" style="--ph-k:${i}">
                <${tag} class="ph-coin ph-coin--${m.state}${m.isCurrent ? ' is-current' : ''}" ${attrs} title="${escProdigy(label)}" aria-label="${escProdigy(label)}">
                    <span class="ph-coin__face">${face}</span>
                    <span class="ph-coin__month">${escProdigy(m.short)}</span>
                </${tag}>
            </li>`;
    }).join('');
    return `
        <p class="ph-year__title"><span class="ph-year__crown" aria-hidden="true">${MINI_CROWN_SVG}</span> This year's crowns</p>
        <ol class="ph-year__coins">${coins}</ol>`;
}
