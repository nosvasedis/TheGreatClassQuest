// features/grandCeremonyView.js — pure markup for the Grand Guild Ceremony
// ("Midsummer Festival of the Guilds"), the end-of-year celebration. No state
// and no DOM access: features/grandGuildCeremony.js and the guidebook capture
// stage both build their screens from these functions.

import { escapeCeremonyHtml as esc } from './ceremonyArenaView.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function grandMonthLabel(monthKey = '') {
    const month = Number(String(monthKey).slice(5, 7));
    return MONTH_SHORT[month - 1] || '';
}

export const GRAND_CHAPTERS = [
    { key: 'heroes', numeral: 'I', title: 'Legends of the Day', icon: 'fa-sun', line: 'The heroes who shone brightest, day after day' },
    { key: 'quest', numeral: 'II', title: 'The Quest Road', icon: 'fa-flag', line: 'Every class, every month, every star' },
    { key: 'prodigies', numeral: 'III', title: 'The Prodigy Road', icon: 'fa-medal', line: 'One Prodigy for every month of the year' },
    { key: 'wonders', numeral: 'IV', title: 'Wonders of the Year', icon: 'fa-dharmachakra', line: 'Fate, friends and battles won together' },
    { key: 'guilds', numeral: 'V', title: 'The Guild Crowning', icon: 'fa-shield-halved', line: 'Ten Chapters of the Crown Race. One crown.' },
    { key: 'hall', numeral: 'VI', title: 'The Hall of Heroes', icon: 'fa-star', line: 'Every name here wrote this year' }
];

const PLACE_LABEL = ['1st', '2nd', '3rd', '4th'];

function faceHtml(person, className) {
    if (person?.avatar) return `<img src="${esc(person.avatar)}" class="${className}" alt="" loading="lazy" decoding="async">`;
    return `<span class="${className} ${className}--initial">${esc(String(person?.name || '?').trim().charAt(0) || '?')}</span>`;
}

function guildVars(guild) {
    return `--g1:${esc(guild?.primary || '#7c3aed')};--g2:${esc(guild?.secondary || '#a78bfa')};--gg:${esc(guild?.glow || '#fde68a')}`;
}

function crestHtml(guild, className = 'grd-crest') {
    if (!guild) return '';
    return `<span class="${className}" style="${guildVars(guild)}">
        ${guild.emblem ? `<img src="${esc(guild.emblem)}" alt="" decoding="async">` : `<b>${esc(guild.emoji || '🛡️')}</b>`}
    </span>`;
}

// ---------------------------------------------------------------- backdrop

function starsSvg() {
    let s = 29;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const groups = [[], [], []];
    for (let i = 0; i < 90; i += 1) {
        groups[i % 3].push(`<circle cx="${(rnd() * 1600).toFixed(0)}" cy="${(rnd() * 520).toFixed(0)}" r="${(0.6 + rnd() * 1.6).toFixed(2)}"/>`);
    }
    return `<svg class="grd-stars" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${groups.map((g, i) => `<g class="grd-twinkle grd-twinkle--${i}">${g.join('')}</g>`).join('')}
    </svg>`;
}

function hillSvg() {
    return `<svg class="grd-hill" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path class="grd-hill__far" d="M0 760 C220 700 420 690 640 720 C860 680 1120 690 1320 716 C1440 706 1540 716 1600 730 V900 H0 Z"/>
        <g class="grd-tents">
            <path d="M40 790 L150 690 L260 790 Z"/><path d="M210 800 L300 720 L390 800 Z"/>
            <path d="M1340 790 L1450 690 L1560 790 Z"/><path d="M1210 800 L1300 720 L1390 800 Z"/>
        </g>
        <g class="grd-tent-flags">
            <path d="M150 690 V664 L172 671 L150 678"/><path d="M300 720 V698 L318 704 L300 710"/>
            <path d="M1450 690 V664 L1472 671 L1450 678"/><path d="M1300 720 V698 L1318 704 L1300 710"/>
        </g>
        <path class="grd-hill__ground" d="M0 790 C300 740 520 730 800 736 C1080 730 1300 740 1600 790 V900 H0 Z"/>
    </svg>`;
}

/** The festival castle, cropped to its own box so the banners line up with its towers. */
function fortressHtml(guilds) {
    const banners = guilds.slice(0, 4).map((g, i) => `<span class="grd-banner grd-banner--${i}" style="${guildVars(g)};--i:${i}">
        ${g.emblem ? `<img src="${esc(g.emblem)}" alt="" decoding="async">` : `<b>${esc(g.emoji)}</b>`}
    </span>`).join('');
    return `<div class="grd-fortress" aria-hidden="true">
        <svg class="grd-castle" viewBox="370 340 860 390" aria-hidden="true">
            <g class="grd-castle__keep">
                <path d="M560 730 V520 H600 V496 H630 V520 H660 V496 H690 V520 H720 V470 L800 380 L880 470 V520 H910 V496 H940 V520 H970 V496 H1000 V520 H1040 V730 Z"/>
                <path d="M470 730 V430 L515 360 L560 430 V730 Z"/>
                <path d="M1040 730 V430 L1085 360 L1130 430 V730 Z"/>
                <path d="M660 730 V410 L700 350 L740 410 V730 Z"/>
                <path d="M860 730 V410 L900 350 L940 410 V730 Z"/>
                <rect x="380" y="600" width="90" height="130"/><rect x="1130" y="600" width="90" height="130"/>
                <path d="M380 600 V585 H395 V600 H410 V585 H425 V600 H440 V585 H455 V600 H470 Z"/>
                <path d="M1130 600 V585 H1145 V600 H1160 V585 H1175 V600 H1190 V585 H1205 V600 H1220 Z"/>
            </g>
            <g class="grd-castle__rim">
                <path d="M470 430 L515 360 L560 430"/><path d="M1040 430 L1085 360 L1130 430"/>
                <path d="M660 410 L700 350 L740 410"/><path d="M860 410 L900 350 L940 410"/><path d="M720 470 L800 380 L880 470"/>
            </g>
            <g class="grd-castle__windows">
                <rect x="505" y="470" width="20" height="34" rx="10"/><rect x="1075" y="470" width="20" height="34" rx="10"/>
                <rect x="690" y="440" width="20" height="32" rx="10"/><rect x="890" y="440" width="20" height="32" rx="10"/>
                <rect x="780" y="470" width="40" height="60" rx="20"/>
                <rect x="620" y="580" width="18" height="28" rx="9"/><rect x="962" y="580" width="18" height="28" rx="9"/>
                <path d="M765 730 V660 C765 632 835 632 835 660 V730 Z"/>
            </g>
        </svg>
        <div class="grd-banners">${banners}</div>
    </div>`;
}

function stringLightsHtml() {
    const colors = ['#fde68a', '#f9a8d4', '#a5f3fc', '#fdba74', '#c4b5fd'];
    const bulbs = Array.from({ length: 26 }, (_, i) => {
        const t = i / 25;
        const x = t * 100;
        const y = 8 + Math.sin(t * Math.PI) * 9 + (i % 2) * 0.4;
        return `<span class="grd-bulb" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--i:${i % 5};--b:${colors[i % colors.length]}"></span>`;
    }).join('');
    return `<div class="grd-lights" aria-hidden="true">
        <svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 8 Q50 26 100 8" fill="none"/></svg>
        ${bulbs}
    </div>`;
}

function lanternsHtml() {
    return `<div class="grd-lanterns" aria-hidden="true">${Array.from({ length: 12 }, (_, i) =>
        `<span class="grd-lantern" style="--x:${(5 + ((i * 37) % 90)).toFixed(0)}%;--d:${(14 + (i % 5) * 3)}s;--delay:${(-i * 2.3).toFixed(1)}s;--s:${(0.6 + (i % 4) * 0.18).toFixed(2)}"></span>`).join('')}</div>`;
}

/** Scenery: twilight sky, moon, festival castle with the four guild banners, lanterns, stage lights. */
export function grandBackdropHtml(guilds = []) {
    return `
        <div class="grd-sky" aria-hidden="true"></div>
        <div class="grd-sky grd-sky--night" aria-hidden="true"></div>
        ${starsSvg()}
        <div class="grd-moon" aria-hidden="true"></div>
        <div class="grd-sunset" aria-hidden="true"></div>
        ${lanternsHtml()}
        ${fortressHtml(guilds)}
        ${hillSvg()}
        ${stringLightsHtml()}
        <div class="grd-dim" aria-hidden="true"></div>
        <div class="grd-beams" aria-hidden="true"><span class="grd-beam grd-beam--l"></span><span class="grd-beam grd-beam--r"></span></div>
        <div class="grd-spot" aria-hidden="true"></div>
        <div class="grd-flash" aria-hidden="true"></div>`;
}

// ---------------------------------------------------------------- scenes

export function grandOpeningHtml({ yearLabel = '', classes = [], guilds = [] } = {}) {
    const orbit = guilds.slice(0, 4).map((g, i) => `<span class="grd-orbit__slot" style="--i:${i}">${crestHtml(g, 'grd-crest grd-crest--orbit')}</span>`).join('');
    const chips = classes.slice(0, 8).map((c, i) => `<span class="grd-chip" style="--i:${i}"><span aria-hidden="true">${esc(c.logo || '📚')}</span>${esc(c.name)}</span>`).join('');
    const more = classes.length > 8 ? `<span class="grd-chip" style="--i:8">+${classes.length - 8}</span>` : '';
    const title = 'The Grand Guild Ceremony';
    const letters = [...title].map((ch, i) => (ch === ' ' ? ' ' : `<span style="--i:${i}">${esc(ch)}</span>`)).join('');
    return `<div class="grd-opening">
        <div class="grd-orbit">
            <div class="grd-orbit__ring" aria-hidden="true"></div>
            <div class="grd-orbit__spin">${orbit}</div>
            <div class="grd-orbit__heart" aria-hidden="true"><i class="fas fa-crown"></i></div>
        </div>
        <p class="grd-opening__kicker">Midsummer Festival of the Guilds · ${esc(yearLabel)}</p>
        <h1 class="grd-opening__title" aria-label="${title}">${letters}</h1>
        <div class="grd-opening__chips">${chips}${more}</div>
    </div>`;
}

export function grandGatherHtml() {
    return `<div class="grd-gather" role="status"><span class="grd-gather__lantern" aria-hidden="true"></span><p>Gathering the year's tales…</p></div>`;
}

/** Chapter I: the heroes who were Hero of the Day most often this year. */
export function grandHeroesHtml(heroes = [], { totalWins = 0 } = {}) {
    if (!heroes.length) {
        return `<div class="grd-empty"><i class="fas fa-sun" aria-hidden="true"></i><p>Every day had its hero. Here's to all of them!</p></div>`;
    }
    const top = heroes[0];
    const order = heroes.length > 1 ? [...heroes.slice(1).filter((_, i) => i % 2 === 0).reverse(), top, ...heroes.slice(1).filter((_, i) => i % 2 === 1)] : [top];
    const items = order.map((h) => {
        const isTop = h === top || h.wins === top.wins;
        return `<li class="grd-hero${isTop ? ' grd-hero--top' : ''}" style="--i:${heroes.indexOf(h)}">
            <span class="grd-hero__string" aria-hidden="true"></span>
            <div class="grd-hero__lantern">
                <span class="grd-hero__glow" aria-hidden="true"></span>
                ${isTop ? '<span class="grd-hero__sun" aria-hidden="true"><i class="fas fa-sun"></i></span>' : ''}
                ${faceHtml(h, 'grd-hero__face')}
            </div>
            <b class="grd-hero__name">${esc(h.name)}</b>
            <span class="grd-hero__wins"><i class="fas fa-sun" aria-hidden="true"></i><span class="grd-count" data-count="${Number(h.wins) || 0}">0</span> ${Number(h.wins) === 1 ? 'day' : 'days'}</span>
            ${h.className ? `<small class="grd-hero__class">${esc(h.className)}</small>` : ''}
        </li>`;
    }).join('');
    return `<div class="grd-heroes">
        <ol class="grd-heroes__row">${items}</ol>
        <p class="grd-heroes__total"><span class="grd-count" data-count="${Number(totalWins) || 0}">0</span> Hero of the Day crowns shone this year</p>
    </div>`;
}

/** Chapter II: each class's year of Team Quest stars, month by month, with its quest rank. No cross-league ranking. */
export function grandQuestYearHtml(classes = []) {
    const cards = classes.map((c, index) => {
        const max = Math.max(1, ...c.months.map((m) => m.stars));
        const bestIndex = c.months.reduce((best, m, i, arr) => (m.stars > arr[best].stars ? i : best), 0);
        const bars = c.months.map((m, i) => `<span class="grd-bar${i === bestIndex && m.stars > 0 ? ' grd-bar--best' : ''}${m.goalMet ? ' grd-bar--goal' : ''}" style="--h:${(m.stars / max).toFixed(3)};--i:${i}" title="${esc(grandMonthLabel(m.monthKey))}: ${m.stars} stars${m.goalMet ? ' (goal reached)' : ''}">
            <span class="grd-bar__fill"></span>${m.goalMet ? '<i class="grd-bar__star fas fa-star" aria-hidden="true"></i>' : ''}<small>${esc(grandMonthLabel(m.monthKey).charAt(0))}</small>
        </span>`).join('');
        const best = c.months[bestIndex];
        const rank = c.rank;
        return `<article class="grd-quest" style="--i:${index}${rank?.colors ? `;--r1:${esc(rank.colors[0])};--r2:${esc(rank.colors[1])};--r3:${esc(rank.colors[2])}` : ''}">
            <header class="grd-quest__head">
                <span class="grd-quest__logo" aria-hidden="true">${esc(c.logo || '📚')}</span>
                <span class="grd-quest__who"><b>${esc(c.name)}</b><small>${esc(c.league || '')}</small></span>
                ${rank ? `<span class="grd-quest__rank" title="${esc(rank.title)}">${c.rankCrest || ''}<small>${esc(rank.title)}</small></span>` : ''}
            </header>
            <div class="grd-quest__total"><i class="fas fa-star" aria-hidden="true"></i><span class="grd-count" data-count="${Number(c.totalStars) || 0}">0</span><small>stars this year</small></div>
            <div class="grd-quest__bars" aria-hidden="true">${bars}</div>
            <p class="grd-quest__foot">${best && best.stars > 0 ? `Brightest month: <b>${esc(grandMonthLabel(best.monthKey))}</b>` : 'A year of steady steps'}${c.goalsMet ? ` · <b>${c.goalsMet}</b> ${c.goalsMet === 1 ? 'goal' : 'goals'} reached` : ''}${c.crossings ? ` · Portal crossed <b>${c.crossings}×</b>` : ''}</p>
        </article>`;
    }).join('');
    const size = classes.length > 6 ? ' grd-questyear--crowd' : classes.length > 3 ? ' grd-questyear--many' : '';
    return `<div class="grd-questyear${size}">${cards}</div>`;
}

/** Chapter III: every month's Prodigy of the Month, along a road of medals. */
export function grandProdigyRoadHtml(months = [], { mostCrowned = [], mostCount = 0 } = {}) {
    if (!months.length) {
        return `<div class="grd-empty"><i class="fas fa-medal" aria-hidden="true"></i><p>The Prodigy Road begins next year.</p></div>`;
    }
    const tiles = months.map((m, i) => {
        const shown = m.winners.slice(0, 3);
        const extra = m.winners.length - shown.length;
        return `<li class="grd-month${m.winners.length > 1 ? ' grd-month--co' : ''}${m.winners.length ? '' : ' grd-month--none'}" style="--i:${i}">
            <span class="grd-month__label">${esc(grandMonthLabel(m.monthKey))}</span>
            <div class="grd-month__faces">${shown.map((w) => faceHtml(w, 'grd-month__face')).join('')}${extra > 0 ? `<span class="grd-month__more">+${extra}</span>` : ''}${m.winners.length ? '' : '<span class="grd-month__face grd-month__face--initial">·</span>'}</div>
            <span class="grd-month__names">${m.winners.length === 1 ? esc(m.winners[0].name) : m.winners.length ? esc(m.winners.map((w) => String(w.name).split(' ')[0]).slice(0, 2).join(' & ')) + (m.winners.length > 2 ? ` +${m.winners.length - 2}` : '') : '—'}</span>
        </li>`;
    }).join('');
    const plaque = mostCrowned.length && mostCount > 1
        ? `<div class="grd-crowned">
            <span class="grd-crowned__kicker"><i class="fas fa-medal" aria-hidden="true"></i>Prodigy most often this year</span>
            <div class="grd-crowned__faces">${mostCrowned.slice(0, 4).map((p) => `<span class="grd-crowned__who">${faceHtml(p, 'grd-crowned__face')}<b>${esc(p.name)}</b></span>`).join('')}</div>
            <span class="grd-crowned__count">${mostCount} × Prodigy of the Month</span>
        </div>`
        : '';
    return `<div class="grd-road">
        <ol class="grd-road__months" style="--cols:${months.length > 6 ? Math.ceil(months.length / 2) : months.length}">${tiles}</ol>
        ${plaque}
    </div>`;
}

/**
 * Chapter IV: the year's wonders as tiles. `tiles` is [{ tone, icon, value, label, note, crest }];
 * value may be a number (counted up) or text. Tiles without data are left out by the caller.
 * The old { wheel, familiars, luckyGuild } call still works.
 */
export function grandWondersHtml(input = {}) {
    const tiles = Array.isArray(input) ? input : legacyWonderTiles(input);
    const html = tiles.map((t, i) => {
        const value = typeof t.value === 'number'
            ? `<span class="grd-count" data-count="${Number(t.value) || 0}">0</span>`
            : esc(t.value ?? '—');
        const icon = t.crest ? crestHtml(t.crest, 'grd-crest grd-crest--mini') : `<span aria-hidden="true">${esc(t.icon || '✨')}</span>`;
        return `<div class="grd-wonder grd-wonder--${esc(t.tone || 'gold')}${typeof t.value === 'number' ? '' : ' grd-wonder--text'}" style="--i:${i}">
            <span class="grd-wonder__icon">${icon}</span>
            <b class="grd-wonder__value">${value}</b>
            <span class="grd-wonder__label">${esc(t.label || '')}</span>
            ${t.note ? `<small class="grd-wonder__note">${esc(t.note)}</small>` : ''}
        </div>`;
    }).join('');
    return `<div class="grd-wonders${tiles.length > 6 ? ' grd-wonders--many' : ''}" style="--n:${tiles.length}">${html}</div>`;
}

function legacyWonderTiles({ wheel = {}, familiars = {}, luckyGuild = null } = {}) {
    return [
        { tone: 'wheel', icon: '🎡', value: Number(wheel.totalSpins) || 0, label: "Fortune's Wheel spins" },
        luckyGuild
            ? { tone: 'luck', crest: luckyGuild, value: luckyGuild.name, label: 'Luckiest guild at the wheel', note: `+${Number(wheel.luckiestGuild?.totalGlory) || 0} Glory` }
            : { tone: 'luck', icon: '🍀', value: '—', label: 'Luckiest guild at the wheel' },
        { tone: 'hatch', icon: '🥚', value: Number(familiars.totalHatched) || 0, label: 'Familiars hatched', note: familiars.totalEggs ? `${Number(familiars.totalEggs)} still in their eggs` : '' },
        { tone: 'legend', icon: '🐉', value: (familiars.mostAdvanced || []).length, label: 'Familiars at their final form' }
    ];
}

/** One guild's year of Chapters as small medals: place, Unity Seal, and tonight's Chapter ringed. */
function chapterMedalsHtml(chapters = []) {
    if (!chapters.length) return '';
    return `<ol class="grd-medals" aria-label="Chapters">${chapters.map((c, i) => {
        const place = Number(c.place) || 0;
        const tone = place >= 1 && place <= 4 ? `p${place}` : 'none';
        const label = `${c.month || ''}: ${place ? PLACE_LABEL[place - 1] : 'no place'}${c.unity ? ', Unity Seal' : ''}${c.provisional ? ' (as it stands tonight)' : ''}`;
        return `<li class="grd-medal grd-medal--${tone}${c.unity ? ' has-unity' : ''}${c.provisional ? ' is-tonight' : ''}" style="--i:${i}" title="${esc(label)}">
            <b>${place || '·'}</b><small>${esc(String(c.month || '').charAt(0))}</small>
        </li>`;
    }).join('')}</ol>`;
}

/** Chapter V: four guild towers, in the fixed guild order so position gives nothing away. */
export function grandGuildPillarsHtml(rows = [], { maxCrowns = 1 } = {}) {
    const pillars = rows.map((row) => {
        const g = row.guild || {};
        const crowns = Number(row.crowns) || 0;
        const h = Math.max(0.14, Math.min(1, crowns / (maxCrowns || 1)));
        const wins = (row.chapterWins || []).length;
        const seals = Number(row.unitySeals) || 0;
        const facts = [wins ? `${wins} Chapter${wins === 1 ? '' : 's'} won` : '', seals ? `${seals} Unity Seal${seals === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
        return `<li class="grd-pillar" data-guild="${esc(row.guildId)}" data-rank="${Number(row.rank)}" style="${guildVars(g)};--h:${h.toFixed(3)}">
            <div class="grd-pillar__track">
                <span class="grd-pillar__bar"><span class="grd-pillar__bricks"></span></span>
                <span class="grd-pillar__value"><span class="grd-count" data-count="${crowns}">?</span><small>Crowns</small></span>
                <div class="grd-pillar__rider">
                    <div class="grd-pillar__head">
                        <div class="grd-pillar__crown" aria-hidden="true"><i class="fas fa-crown"></i></div>
                        ${crestHtml(g, 'grd-crest grd-pillar__crest')}
                        <b class="grd-pillar__name">${esc(g.name || row.guildName)}</b>
                    </div>
                </div>
            </div>
            <div class="grd-pillar__base">
                ${chapterMedalsHtml(row.chapters)}
                <span class="grd-pillar__facts">${esc(facts) || '&nbsp;'}</span>
                <span class="grd-pillar__rank">${Number(row.rank) === 1 ? '<i class="fas fa-crown" aria-hidden="true"></i> Champions' : `#${Number(row.rank)}`}</span>
            </div>
        </li>`;
    }).join('');
    return `<div class="grd-pillars"><ol class="grd-pillars__row">${pillars}</ol></div>`;
}

/** After the crowning: the champion guild's banner, motto, anthem lyrics and its heroes. */
export function grandChampionHtml(row, { heroes = [] } = {}) {
    const g = row?.guild || {};
    const lyrics = (g.anthemLyrics || []).flatMap((part) => part.lines || []);
    const wins = (row?.chapterWins || []).length;
    const seals = Number(row?.unitySeals) || 0;
    const facts = [
        `<span><b>${Number(row?.crowns) || 0}</b> Crowns</span>`,
        wins ? `<span><b>${wins}</b> Chapter${wins === 1 ? '' : 's'} won</span>` : '',
        seals ? `<span><b>${seals}</b> Unity Seal${seals === 1 ? '' : 's'}</span>` : ''
    ].filter(Boolean).join('');
    return `<div class="grd-champion" style="${guildVars(g)}">
        <div class="grd-champion__flag">
            <span class="grd-champion__pole" aria-hidden="true"></span>
            <div class="grd-champion__cloth">
                <span class="grd-champion__rays" aria-hidden="true"></span>
                <div class="grd-champion__crest">
                    ${crestHtml(g, 'grd-crest grd-crest--hero')}
                    <span class="grd-champion__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>
                </div>
                <span class="grd-champion__year">Champions of the Year</span>
            </div>
        </div>
        <div class="grd-champion__text">
            <p class="grd-champion__kicker">Guild Champions of the Year</p>
            <h2 class="grd-champion__name">${esc(g.name || row?.guildName || '')}</h2>
            <p class="grd-champion__motto">“${esc(g.motto || '')}”</p>
            <div class="grd-champion__facts">${facts}</div>
            ${lyrics.length ? `<ol class="grd-lyrics" aria-label="Guild anthem">${lyrics.map((line, i) => `<li data-time="${Number(line.time) || 0}" style="--i:${i}">${esc(line.text)}</li>`).join('')}</ol>` : ''}
            ${heroes.length ? `<div class="grd-champion__heroes"><span>Brightest in the guild here</span><div>${heroes.slice(0, 4).map((h, i) => `<span class="grd-champion__hero" style="--i:${i}">${faceHtml(h, 'grd-champion__face')}<b>${esc(h.name)}</b></span>`).join('')}</div></div>` : ''}
        </div>
    </div>`;
}

/** Chapter VI: every hero of the participating classes as a star in the year's sky. */
export function grandHallHtml(students = [], { stats = [] } = {}) {
    const stars = students.map((s, i) => `<li class="grd-sky-hero" style="--i:${i % 48};--gc:${esc(s.guildColor || '#fde68a')}" title="${esc(s.name)}">${faceHtml(s, 'grd-sky-hero__face')}<span>${esc(s.name)}</span></li>`).join('');
    const tiles = stats.map((t, i) => `<div class="grd-stat" style="--i:${i}"><b><span class="grd-count" data-count="${Number(t.value) || 0}">0</span></b><span>${esc(t.label)}</span></div>`).join('');
    const density = students.length > 70 ? ' grd-hall__sky--crowd' : students.length > 36 ? ' grd-hall__sky--dense' : '';
    return `<div class="grd-hall">
        <ol class="grd-hall__sky${density}">${stars}</ol>
        <div class="grd-hall__stats">${tiles}</div>
    </div>`;
}

export function grandFarewellHtml({ yearLabel = '', champion = null } = {}) {
    return `<div class="grd-farewell">
        <span class="grd-farewell__icon" aria-hidden="true"><i class="fas fa-graduation-cap"></i></span>
        <h2>Thank you for an amazing year!</h2>
        <p>${esc(yearLabel)} is written in the stars. Rest well, heroes, and come back ready for a new quest.</p>
        ${champion ? `<p class="grd-farewell__champ" style="${guildVars(champion)}">${crestHtml(champion, 'grd-crest grd-crest--mini')}<span>Champions of the Year: <b>${esc(champion.name)}</b></span></p>` : ''}
    </div>`;
}
