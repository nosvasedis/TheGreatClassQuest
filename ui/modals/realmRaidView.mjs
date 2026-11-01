// ui/modals/realmRaidView.mjs — Realm Raid markup: the Raid Hall, the victory moment, the
// "How it works" page. Pure string builders from a raid view (features/realmRaid.js#buildRaidView);
// no state, no Firebase, so the preview page can use them as they are.
import { guardianSvg, shieldSvg, ringSvg, gateSvg, raysSvg, crackSvg, peaksSvg } from '../../features/realmRaidArt.mjs';
import { RAID_REWARDS, LEGENDARY_AT, RAID_EFFORT, RAID_LENGTH_DAYS, guardianMood, raidCountdown, readDate, raidDays, dayKey } from '../../features/realmRaidCore.mjs';

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmt = (n) => {
    const v = Math.round((Number(n) || 0) * 2) / 2;
    return v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
};

function shortDate(date) {
    const d = readDate(date);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
}

const PARTICLES = { winter: 22, carnival: 26, summer: 18 };

/** The season's sky: northern lights in winter, fireworks at Carnival, a low sun in summer. */
function skyFeature(seasonId, { lite = false } = {}) {
    if (seasonId === 'winter') {
        return '<span class="rr-sky__aurora rr-sky__aurora--a"></span><span class="rr-sky__aurora rr-sky__aurora--b"></span>';
    }
    if (seasonId === 'carnival') {
        if (lite) return '';
        const spots = [[14, 16, '#f472b6'], [80, 12, '#fbbf24'], [62, 30, '#38bdf8'], [30, 34, '#a3e635']];
        return spots.map(([x, y, col], i) => `<span class="rr-sky__fw" style="--x:${x}%;--y:${y}%;--i:${i};--c:${col}">${fireworkSvg()}</span>`).join('');
    }
    return '<span class="rr-sky__sun"></span>';
}

function fireworkSvg() {
    const dots = Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return `<circle cx="${(50 + Math.cos(a) * 40).toFixed(1)}" cy="${(50 + Math.sin(a) * 40).toFixed(1)}" r="${i % 2 ? 2.6 : 3.6}"/>`;
    }).join('');
    const trails = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.2;
        return `<path d="M${(50 + Math.cos(a) * 12).toFixed(1)},${(50 + Math.sin(a) * 12).toFixed(1)} L${(50 + Math.cos(a) * 30).toFixed(1)},${(50 + Math.sin(a) * 30).toFixed(1)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 100 100"><g fill="var(--c)">${dots}</g><g stroke="var(--c)" stroke-width="2" stroke-linecap="round" opacity=".7">${trails}</g></svg>`;
}

/**
 * Eldhorn at his Gate: the arch, the beams of light, the Guardian and the shield, placed in one
 * box shaped like the Gate (1000 × 820) so every screen frames him the same way.
 */
export function stageHtml(season, { mood = 'proud', crown = false, rows = [], pct = 0, broken = false, focusId = '', prefix = 'rrh', lite = false, showLogos = true, coreBig = '', coreCap = '', extra = '', guardians = null } = {}) {
    const guardian = guardians || `<div class="rr-stage__guardian">${guardianSvg(season.id, { mood, crown, id: `${prefix}g`, title: season.title })}</div>`;
    return `<div class="rr-stage__gate">${gateSvg(season.id, { id: `${prefix}gate`, lit: broken })}</div>
        ${lite ? '' : `<div class="rr-stage__rays">${raysSvg(season.id, { id: `${prefix}rays` })}</div>`}
        ${guardian}
        <div class="rr-stage__shield">${shieldSvg(season.id, rows, { pct, broken, focusId, id: `${prefix}s`, showLogos, coreBig, coreCap })}</div>
        ${extra}`;
}

/** Sky behind the Guardian: gradient, festival light, falling snow / confetti / fireflies. */
export function skyHtml(seasonId, { lite = false } = {}) {
    const count = lite ? 0 : PARTICLES[seasonId] || 18;
    const bits = Array.from({ length: count }, (_, i) => {
        const x = (i * 37 + 11) % 100;
        const delay = -((i * 1.7) % 12);
        const dur = 9 + ((i * 2.3) % 7);
        const size = 0.6 + ((i * 7) % 5) / 5;
        return `<i style="--x:${x}%;--d:${delay.toFixed(1)}s;--t:${dur.toFixed(1)}s;--s:${size.toFixed(2)};--h:${(i * 47) % 360}"></i>`;
    }).join('');
    return `<div class="rr-sky rr-sky--${seasonId}" aria-hidden="true">
        <span class="rr-sky__glow rr-sky__glow--a"></span>
        <span class="rr-sky__glow rr-sky__glow--b"></span>
        <span class="rr-sky__stars"></span>
        ${skyFeature(seasonId, { lite })}
        <div class="rr-sky__peaks">${peaksSvg(seasonId)}</div>
        <span class="rr-sky__hills"></span>
        <div class="rr-sky__bits">${bits}</div>
    </div>`;
}

/** The year's three raids, as medallions in the top bar. Each opens that raid. */
function yearHtml(year = [], currentId = '') {
    if (!year.length) return '';
    const label = { won: 'won', legendary: 'Legendary', held: 'the shield held', live: 'now', soon: '' };
    return `<nav class="rr-year" aria-label="This year's raids">${year.map((y) => {
        const state = y.raidId === currentId ? 'current' : y.state;
        const date = readDate(y.start)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) || '';
        const words = `${y.season.name}${label[y.state] ? `: ${label[y.state]}` : `, ${date}`}`;
        return `<button type="button" class="rr-year__dot is-${esc(y.state)}${state === 'current' ? ' is-current' : ''}" data-rr-raid="${esc(y.raidId)}" aria-label="${esc(words)}" title="${esc(words)}"${state === 'current' ? ' aria-current="true"' : ''}>
            <span aria-hidden="true">${esc(y.season.emoji)}</span>
            ${y.state === 'won' || y.state === 'legendary' ? `<i class="fas fa-${y.state === 'legendary' ? 'crown' : 'check'}" aria-hidden="true"></i>` : ''}
        </button>`;
    }).join('')}</nav>`;
}

/** Every hero of the focused class by name; the ones who struck the shield this week are lit. */
export function rosterHtml(roster = [], phase = 'active') {
    if (!roster.length) return '';
    const struck = roster.filter((h) => h.stars > 0).length;
    const lead = phase === 'herald'
        ? `${roster.length} heroes ready`
        : `${struck}/${roster.length} heroes struck`;
    return `<div class="rr-roster">
        <p class="rr-roster__lead"><i class="fas fa-bolt" aria-hidden="true"></i> ${esc(lead)}</p>
        <ul class="rr-roster__list">${roster.map((h) => `<li class="rr-roster__hero${h.stars > 0 ? ' is-lit' : ''}" title="${esc(h.fullName || h.name)}${h.stars > 0 ? `: ${fmt(h.stars)} ★` : ''}">${h.stars > 0 ? '<i class="fas fa-star" aria-hidden="true"></i>' : ''}${esc(h.name)}</li>`).join('')}</ul>
    </div>`;
}

function heroCardHtml(hero) {
    if (!hero) return '';
    if (hero.none) return '<p class="rr-hero__none">No hero struck the shield this time.</p>';
    const prize = hero.prize?.kind === 'treasure'
        ? `<span class="rr-hero__prize">${hero.prize.image ? `<img src="${esc(hero.prize.image)}" alt="">` : `<b>${esc(hero.prize.icon || '🎁')}</b>`}<span>${esc(hero.prize.name)}</span></span>`
        : hero.prize?.kind === 'gold' ? `<span class="rr-hero__prize"><b>🪙</b><span>+${hero.prize.gold} Gold (the stall was empty)</span></span>` : '';
    return `<div class="rr-hero">
        ${hero.faceHtml || ''}
        <span class="rr-hero__copy"><small>Raid Hero</small><b>${esc(hero.name || 'Our hero')}</b><em>Struck the shield in ${hero.days} ${hero.days === 1 ? 'lesson' : 'lessons'} (${fmt(hero.stars)} ★)</em></span>
        ${prize}
    </div>`;
}

// ─── The battle screen ───────────────────────────────────────────────────────
// The raid is a 7-turn boss fight: each raid day is a turn, each star a hit on Eldhorn's shield.

const RAID_TURNS = RAID_LENGTH_DAYS;

/** The seven turns (raid days): stars the school dealt, whether anyone had a lesson, past / now / next. */
export function raidTurns(view, now = new Date()) {
    const { raid, tally } = view;
    const byDay = tally?.byDay || {};
    const lessonDays = new Set(view.rows.flatMap((r) => r.lessonDates || []));
    const today = dayKey(now);
    return raidDays(raid).map((d, i) => {
        const key = dayKey(d);
        return { n: i + 1, key, d, stars: Number(byDay[key]) || 0, lessons: lessonDays.has(key), when: key < today ? 'past' : key === today ? 'now' : 'next' };
    });
}

/** The boss plate and its HP bar: the shield's stars still standing. */
function bossHtml(view) {
    const { raid, status } = view;
    const season = raid.season;
    const [name, ...rest] = String(season.title).split(', ');
    const left = Math.max(0, status.hp - status.dealt);
    const hpPct = status.hp ? left / status.hp : 1;
    const legendPct = status.hp ? Math.min(1, status.dealt / Math.max(1, status.legendaryAt)) : 0;
    const state = status.legendary ? 'is-legendary' : status.broken ? 'is-broken' : hpPct <= 0.25 ? 'is-low' : '';
    return `<div class="rr-boss ${state}">
        <div class="rr-boss__plate">
            <span class="rr-boss__tag">Boss</span>
            <b class="rr-boss__name">${esc(name)}</b>
            <small class="rr-boss__title">${esc(rest.join(', '))}</small>
        </div>
        <div class="rr-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${status.hp}" aria-valuenow="${left}" aria-label="Shield stars left">
            <span class="rr-hp__label">HP</span>
            <span class="rr-hp__track">
                <span class="rr-hp__fill" style="--p:${hpPct.toFixed(4)}"></span>
                ${status.broken ? `<span class="rr-hp__broken">${status.legendary ? '👑 Legendary!' : '💥 Shield broken!'}</span>` : ''}
            </span>
            <span class="rr-hp__num"><b>${fmt(left)}</b>/${fmt(status.hp)}</span>
        </div>
        ${status.broken ? `<div class="rr-crownbar${status.legendary ? ' is-full' : ''}" title="Legendary at ${fmt(status.legendaryAt)} stars">
            <i class="fas fa-crown" aria-hidden="true"></i>
            <span class="rr-crownbar__track"><span style="--p:${legendPct.toFixed(4)}"></span></span>
            <span class="rr-crownbar__num">${status.legendary ? `${fmt(status.dealt)} ★` : `${fmt(Math.max(0, status.legendaryAt - status.dealt))} ★ to Legendary`}</span>
        </div>` : ''}
    </div>`;
}

/** The turn tracker under the boss: one token per raid day, with the damage dealt. */
function turnsHtml(view, now) {
    const turns = raidTurns(view, now);
    return `<ol class="rr-turns" aria-label="Raid turns">${turns.map((t) => {
        const dmg = t.stars ? `<span class="rr-turn__dmg">⚔ ${fmt(t.stars)}</span>`
            : !t.lessons ? '<span class="rr-turn__dmg is-rest"><i class="fas fa-moon" aria-hidden="true"></i></span>'
                : t.when === 'next' ? '<span class="rr-turn__dmg is-wait">?</span>' : '<span class="rr-turn__dmg is-wait">0</span>';
        return `<li class="rr-turn is-${t.when}${t.lessons ? '' : ' is-rest'}" title="${esc(`Turn ${t.n}: ${t.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${t.lessons || t.stars ? `, ${fmt(t.stars)} stars` : ', no lessons'}`)}">
            <span class="rr-turn__n">${t.when === 'now' ? 'NOW' : t.n}</span>
            <span class="rr-turn__day">${esc(t.d.toLocaleDateString('en-GB', { weekday: 'short' }))}</span>
            ${dmg}
        </li>`;
    }).join('')}</ol>`;
}

/** The side card for one class: its shard charge, its goal, its Raid Hero, every hero by name. */
function partyHtml(view, row, { heroCard = null, canReveal = false, roster = [] } = {}) {
    if (!row) return '';
    const fill = Math.min(1, row.pct || 0);
    const phase = view.raid.phase;
    const over = phase === 'aftermath' || phase === 'over';
    let goal;
    if (!row.share) goal = { icon: '🌙', text: 'No lessons this turn. Stars still hit!' };
    else if (row.valor) goal = { icon: '✨', text: row.stars > row.share ? `Shard broken! +${fmt(row.stars - row.share)} ★ for the school` : 'Shard broken!', done: true };
    else if (over) goal = { icon: '⚔️', text: `${fmt(row.stars)} ★ dealt` };
    else goal = { icon: '🎯', text: `${fmt(Math.max(0, row.share - row.stars))} ★ to break your shard` };
    const reveal = canReveal ? '<button type="button" class="rr-btn rr-btn--gold rr-btn--wide" data-rr-reveal><i class="fas fa-crown" aria-hidden="true"></i> Reveal our Raid Hero</button>' : '';
    return `<section class="rr-card rr-party${row.valor ? ' is-full' : ''}" aria-label="${esc(row.name)}">
        <div class="rr-party__top">
            <span class="rr-party__ring">${ringSvg(fill, { size: 64, stroke: 7, color: row.valor ? '#fde68a' : '#fbbf24', full: row.valor })}<span>${esc(row.logo)}</span></span>
            <span class="rr-party__copy">
                <small>${row.own ? 'Your party' : 'Party'}</small>
                <b>${esc(row.name)}</b>
                <span class="rr-charge" title="${row.share ? `${fmt(row.stars)} of ${fmt(row.share)} stars` : ''}"><span class="rr-charge__track"><span style="--p:${fill.toFixed(4)}"></span></span><em>⚔ ${fmt(row.stars)}${row.share ? `<small>/${fmt(row.share)}</small>` : ''}</em></span>
            </span>
        </div>
        <p class="rr-goal${goal.done ? ' is-done' : ''}"><span aria-hidden="true">${goal.icon}</span> ${esc(goal.text)}</p>
        ${heroCardHtml(heroCard)}
        ${reveal}
        ${rosterHtml(roster, phase)}
    </section>`;
}

/** The battle log: newest turn first, every class that struck named with its damage. */
function logHtml(view, now) {
    const { raid, status, tally } = view;
    const byId = new Map(view.rows.map((r) => [r.classId, r]));
    const brokenDay = view.brokenOn ? dayKey(new Date(view.brokenOn)) : '';
    let items = '';
    if (raid.phase === 'herald') {
        items = `<li class="rr-log__event">⏳ The battle begins ${raid.daysToStart === 1 ? 'tomorrow' : `in ${raid.daysToStart} days`}!</li>
            <li class="rr-log__event is-quiet">🛡️ Shield: ${fmt(status.hp)} HP · ${view.rows.filter((r) => r.share > 0).length} classes in the party</li>`;
    } else {
        const turns = raidTurns(view, now).filter((t) => t.when !== 'next').reverse();
        items = turns.map((t) => {
            const hits = Object.entries(tally?.byDayClass?.[t.key] || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
            const lines = hits.map(([id, n]) => {
                const row = byId.get(id) || { logo: '📚', name: 'A class' };
                return `<li class="rr-log__hit${row.own ? ' is-own' : ''}"><span aria-hidden="true">${esc(row.logo)}</span><span class="rr-log__who">${esc(row.name)}</span><b>-${fmt(n)}</b></li>`;
            }).join('');
            const event = t.key === brokenDay ? `<li class="rr-log__event is-big">💥 The shield breaks!</li>` : '';
            const empty = !hits.length ? `<li class="rr-log__event is-quiet">${t.lessons ? (t.when === 'now' ? '⚔️ Waiting for the first hit…' : '· no hits') : '🌙 Rest day'}</li>` : '';
            return `<li class="rr-log__turn"><b>Turn ${t.n}</b> ${esc(t.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }))}${t.when === 'now' ? ' <em>now</em>' : ''}</li>${event}${lines}${empty}`;
        }).join('');
        if (!items) items = '<li class="rr-log__event is-quiet">⚔️ Waiting for the first hit…</li>';
    }
    return `<section class="rr-card rr-log" aria-label="Battle log">
        <h3 class="rr-card__title"><i class="fas fa-scroll" aria-hidden="true"></i> Battle log</h3>
        <ol class="rr-log__list">${items}</ol>
    </section>`;
}

/** Three loot chests: locked, open (earned) or missed. Words live in the tooltips. */
function lootHtml(view, focusRow) {
    const { status, raid } = view;
    const over = raid.phase === 'aftermath' || raid.phase === 'over';
    const r = RAID_REWARDS;
    const chest = (kind, icon, name, prize, earned, tip) => {
        const st = earned ? 'open' : over ? 'missed' : 'locked';
        return `<li class="rr-chest rr-chest--${kind} is-${st}" title="${esc(tip)}">
            <span class="rr-chest__box" aria-hidden="true"><span class="rr-chest__lid"></span><span class="rr-chest__icon">${icon}</span>${st === 'locked' ? '<i class="fas fa-lock rr-chest__lock"></i>' : st === 'open' ? '<i class="fas fa-check rr-chest__lock"></i>' : ''}</span>
            <b>${esc(name)}</b>
            <small>${esc(prize)}</small>
        </li>`;
    };
    return `<section class="rr-card rr-loot" aria-label="Loot">
        <h3 class="rr-card__title"><i class="fas fa-gem" aria-hidden="true"></i> Loot <small>never taken away</small></h3>
        <ul class="rr-loot__chests">
            ${chest('valor', '✨', 'Valor', `+${r.valorGold} 🪙`, Boolean(focusRow?.valor), `Valor: a class breaks its own shard. +${r.valorGold} Gold for every hero of that class, whatever happens.`)}
            ${chest('victory', '🛡️', 'Victory', `+${r.victoryGold} 🪙 🗺️ 🎁`, status.broken, `Victory: the school breaks the shield. +${r.victoryGold} Gold for every hero, a 5% step on every Team Quest map, and a festival treasure for each class's Raid Hero.`)}
            ${chest('legendary', '👑', 'Legendary', `+${r.legendaryGold} 🪙 🗺️`, status.legendary, `Legendary: ${Math.round(LEGENDARY_AT * 100)}% of the shield. +${r.legendaryGold} Gold more for every hero and another 2.5% step on every map.`)}
        </ul>
    </section>`;
}

/** One party member (a class) on the bottom row. */
export function memberHtml(row, { focusId = '', phase = 'active' } = {}) {
    const fill = Math.min(1, row.pct || 0);
    const badge = row.valor ? '<span class="rr-member__badge is-full">✨ Broken</span>'
        : !row.share ? '<span class="rr-member__badge">🌙 Rest</span>'
            : phase === 'active' && !row.lessonsLeft ? '<span class="rr-member__badge">✓ Done</span>' : '';
    return `<li class="rr-member${row.own ? ' is-own' : ''}${row.classId === focusId ? ' is-focus' : ''}${row.valor ? ' is-full' : ''}${!row.share ? ' is-away' : ''}" data-banner="${esc(row.classId)}" title="${esc(`${row.name}: ${fmt(row.stars)}${row.share ? ` of ${fmt(row.share)}` : ''} stars`)}">
        <span class="rr-member__ring">${ringSvg(fill, { size: 44, stroke: 5, color: row.valor ? '#fde68a' : '#fbbf24', full: row.valor })}<span class="rr-member__logo">${esc(row.logo)}</span></span>
        <span class="rr-member__name">${esc(row.name)}</span>
        <span class="rr-member__dmg">⚔ ${fmt(row.stars)}${row.share ? `<small>/${fmt(row.share)}</small>` : ''}</span>
        ${badge}
    </li>`;
}

function partyRowHtml(view, focusId) {
    const rows = [...view.rows]
        .filter((row) => row.share > 0 || row.stars > 0)
        .sort((a, b) => String(a.league).localeCompare(String(b.league)) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    const full = rows.filter((r) => r.valor).length;
    return `<section class="rr-alliance" aria-label="The party">
        <header class="rr-alliance__head">
            <h3><i class="fas fa-users" aria-hidden="true"></i> The party <small>${rows.length} ${rows.length === 1 ? 'class' : 'classes'}</small></h3>
            ${full ? `<span class="rr-alliance__count">✨ ${full}/${rows.length} shards broken</span>` : ''}
        </header>
        <ul class="rr-alliance__list${rows.length > 10 ? ' is-many' : ''}">${rows.map((row) => memberHtml(row, { focusId, phase: view.raid.phase })).join('')}</ul>
    </section>`;
}

function headline(view) {
    const { raid, status } = view;
    if (raid.phase === 'herald') return raid.daysToStart <= 7 ? 'Boss approaching!' : `${raid.season.guardian} is coming`;
    if (raid.phase === 'active') {
        if (status.legendary) return 'LEGENDARY!';
        if (status.broken) return 'Shield broken!';
        return `Turn ${raid.dayNumber} of ${RAID_TURNS}`;
    }
    if (status.legendary) return 'Legendary victory!';
    return status.broken ? 'Victory!' : 'The shield held';
}

function kickerFor(view) {
    const { raid } = view;
    if (raid.phase === 'herald') return `${raid.season.name} · ${raidCountdown(raid)}`;
    if (raid.phase === 'active') return `${raid.season.name} · ${raidCountdown(raid)}`;
    return `${raid.season.name} · ${raid.phase === 'aftermath' ? 'battle over' : 'past battle'}`;
}

/**
 * The Raid Hall: a boss battle. `focusId` is the class to feature (the header's class, or the
 * teacher's own); `heroCard` its resolved Raid Hero; `roster` every hero of it by name; `year` the
 * year's three raids for the top bar.
 */
export function hallHtml(view, { focusId = '', heroCard = null, canReveal = false, lite = false, roster = [], year = [], now = new Date() } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const mood = raid.phase === 'herald' ? 'proud' : (raid.phase !== 'active' && !status.broken ? 'bow' : guardianMood(status));
    const focusRow = view.rows.find((r) => r.classId === focusId) || null;
    const when = raid.phase === 'active' ? `Ends ${shortDate(raid.end)}` : `${shortDate(raid.start)} – ${shortDate(raid.end)}`;
    return `<div class="rr-hall rr-hall--${season.id} rr-phase--${raid.phase} rr-mood--${mood}${status.broken ? ' is-broken' : ''}${status.legendary ? ' is-legendary' : ''}${lite ? ' rr-lite' : ''}">
        ${skyHtml(season.id, { lite })}
        <header class="rr-top">
            <span class="rr-top__sigil" aria-hidden="true">${season.emoji}</span>
            <div class="rr-top__copy">
                <span class="rr-top__kicker">Realm Raid · ${esc(kickerFor(view))}</span>
                <h2 class="rr-top__title" id="rr-hall-title">${esc(headline(view))}</h2>
            </div>
            ${yearHtml(year, raid.raidId)}
            <span class="rr-top__when"><i class="fas fa-${raid.phase === 'active' ? 'hourglass-half' : 'calendar-days'}" aria-hidden="true"></i> ${esc(when)}</span>
            <button type="button" class="rr-icon-btn" data-rr-help aria-label="How to play" title="How to play"><i class="fas fa-question" aria-hidden="true"></i></button>
            <button type="button" class="rr-icon-btn" data-rr-close aria-label="Close" title="Close (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        </header>
        <main class="rr-main">
            ${bossHtml(view)}
            <div class="rr-arena rr-stage">
                ${stageHtml(season, {
                    mood,
                    crown: status.legendary,
                    rows: view.rows.map((r) => ({ ...r })),
                    pct: status.hp ? status.dealt / status.hp : 0,
                    broken: status.broken,
                    focusId,
                    prefix: 'rrh',
                    lite,
                    ...(raid.phase === 'herald' ? { coreBig: String(raid.daysToStart), coreCap: raid.daysToStart === 1 ? 'day' : 'days' } : {})
                })}
                <div class="rr-dmg-layer" aria-hidden="true"></div>
                ${view.loading ? '<span class="rr-arena__loading"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Counting the hits…</span>' : ''}
            </div>
            ${turnsHtml(view, now)}
        </main>
        <aside class="rr-side">
            ${partyHtml(view, focusRow, { heroCard, canReveal, roster })}
            ${logHtml(view, now)}
            ${lootHtml(view, focusRow)}
        </aside>
        ${partyRowHtml(view, focusId)}
    </div>`;
}

/** "How to play": three pictures and the loot, almost no words. */
export function howItWorksHtml(view) {
    const season = view?.raid?.season;
    const r = RAID_REWARDS;
    const step = (n, icon, big, small) => `<li class="rr-step"><span class="rr-step__n">${n}</span><span class="rr-step__icon" aria-hidden="true">${icon}</span><b>${big}</b><small>${small}</small></li>`;
    return `<div class="rr-help" role="dialog" aria-modal="true" aria-labelledby="rr-help-title">
        <div class="rr-help__card">
            <button type="button" class="rr-icon-btn rr-help__close" data-rr-help-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <h3 id="rr-help-title">How to play</h3>
            <ol class="rr-steps">
                ${step(1, '⭐', 'Earn stars', 'in any lesson, all raid week')}
                ${step(2, '⚔️', 'Every star hits', `${esc(season?.guardian || 'Eldhorn')}'s shield`)}
                ${step(3, '🛡️', 'Break it together', 'the whole school is one party')}
            </ol>
            <ul class="rr-help__loot">
                <li><span aria-hidden="true">✨</span><b>Valor</b><small>your class breaks its own shard: +${r.valorGold} 🪙 each</small></li>
                <li><span aria-hidden="true">🛡️</span><b>Victory</b><small>+${r.victoryGold} 🪙 each, a map step, a treasure for each Raid Hero</small></li>
                <li><span aria-hidden="true">👑</span><b>Legendary</b><small>${Math.round(LEGENDARY_AT * 100)}%: +${r.legendaryGold} 🪙 more, another map step</small></li>
            </ul>
            <p class="rr-help__foot">🗓️ 3 raids a year · 5 turns, Monday to Friday · your shard is sized for your class (${Math.round(RAID_EFFORT * 100)}% of a normal week) · nothing is ever taken away</p>
        </div>
    </div>`;
}

/** The victory moment: the shield shatters, the Guardian bows, the spoils rise. */
export function victoryHtml(view, { legendary = false, lite = false } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const r = RAID_REWARDS;
    const spoils = legendary
        ? [['🪙', `+${r.legendaryGold} Gold more`, 'for every hero'], ['🗺️', '+2.5% step', 'on every Team Quest map'], ['👑', 'Legendary', 'in every class\'s raid banner']]
        : [['🪙', `+${r.victoryGold} Gold`, 'for every hero'], ['🗺️', '+5% step', 'on every Team Quest map'], ['🎁', 'A festival treasure', 'for every class\'s Raid Hero']];
    const classes = view.rows.filter((row) => row.share > 0 || row.stars > 0).length;
    return `<div class="rr-victory rr-hall--${season.id}${legendary ? ' is-legendary' : ''}${lite ? ' rr-lite' : ''}" role="dialog" aria-modal="true" aria-labelledby="rr-victory-title">
        ${skyHtml(season.id, { lite })}
        <div class="rr-victory__stage rr-stage">
            ${stageHtml(season, {
                rows: view.rows,
                pct: status.hp ? status.dealt / status.hp : 1,
                broken: true,
                prefix: 'rrv',
                lite,
                showLogos: !lite,
                guardians: `<div class="rr-stage__guardian rr-victory__guardian--before">${guardianSvg(season.id, { mood: 'strain', id: 'rrv1', title: season.title })}</div>
                    <div class="rr-stage__guardian rr-victory__guardian--after">${guardianSvg(season.id, { mood: 'bow', crown: legendary, id: 'rrv2', title: season.title })}</div>`,
                extra: `<span class="rr-victory__glow" aria-hidden="true"></span>
                    <div class="rr-victory__cracks">${crackSvg()}</div>
                    <span class="rr-victory__flash" aria-hidden="true"></span>
                    <span class="rr-victory__wave" aria-hidden="true"></span>
                    ${lite ? '' : `<div class="rr-victory__burst" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--i:${i}"></i>`).join('')}</div>`}`
            })}
        </div>
        ${lite ? '' : `<div class="rr-victory__coins" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 53 + 7) % 100}%;--d:${(2.6 + (i % 6) * 0.35).toFixed(2)}s;--t:${(2.4 + (i % 4) * 0.5).toFixed(1)}s;--r:${(i % 2 ? 1 : -1) * (200 + i * 30)}deg"></i>`).join('')}</div>`}
        <div class="rr-victory__copy">
            <span class="rr-victory__kicker">⚔️ ${esc(season.name)} · ${classes} ${classes === 1 ? 'class' : 'classes'} · one party</span>
            <h2 id="rr-victory-title" class="rr-victory__title">${legendary ? 'LEGENDARY!' : 'VICTORY!'}</h2>
            <p class="rr-victory__sub">${legendary ? `${fmt(status.dealt)} ★ · ${esc(season.guardian)} has never seen a party like this!` : `Boss defeated · ${esc(season.guardian)} bows · every class wins loot!`}</p>
            <ul class="rr-victory__spoils">${spoils.map(([icon, big, small], i) => `<li style="--i:${i}"><span class="rr-chest__box rr-victory__chest" aria-hidden="true"><span class="rr-chest__lid"></span><span class="rr-chest__icon">${icon}</span></span><b>${esc(big)}</b><small>${esc(small)}</small></li>`).join('')}</ul>
            <div class="rr-victory__actions">
                <button type="button" class="rr-btn rr-btn--gold" data-rr-open-hall><i class="fas fa-shield-halved" aria-hidden="true"></i> See the battle</button>
                <button type="button" class="rr-btn" data-rr-victory-close>Close</button>
            </div>
        </div>
    </div>`;
}

/** The projector card body (The Director deck). */
export function raidCardHtml(view, { focusId = '' } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const row = view.rows.find((r) => r.classId === focusId);
    const p = status.hp ? status.dealt / status.hp : 0;
    const mood = raid.phase === 'herald' ? 'proud' : guardianMood(status);
    const big = raid.phase === 'herald' ? `${season.guardian} ${raidCountdown(raid)}`
        : status.broken ? (status.legendary ? 'LEGENDARY!' : 'VICTORY!')
            : raid.phase === 'active' ? `Turn ${raid.dayNumber} of ${RAID_LENGTH_DAYS}` : 'The shield held';
    const sub = raid.phase === 'active'
        ? `Boss battle · ${raidCountdown(raid)}`
        : raid.phase === 'herald' ? `Boss battle · the whole school is one party` : `${fmt(status.dealt)} ★ from ${view.rows.filter((r) => r.stars > 0).length} classes`;
    const left = Math.max(0, status.hp - status.dealt);
    const hp = `<div class="rr-qc__hp"><span class="rr-qc__hp-label">HP</span><span class="rr-qc__hp-track"><span style="--p:${(status.hp ? left / status.hp : 1).toFixed(4)}"></span></span><b>${fmt(left)}<small>/${fmt(status.hp)}</small></b></div>`;
    return `<div class="rr-qc rr-hall--${season.id}">
        <div class="rr-qc__art">
            <div class="rr-qc__sky" aria-hidden="true"><div class="rr-sky__peaks">${peaksSvg(season.id)}</div></div>
            <div class="rr-stage rr-qc__stage">
                ${stageHtml(season, {
                    mood,
                    crown: status.legendary,
                    rows: view.rows,
                    pct: p,
                    broken: status.broken,
                    focusId,
                    prefix: 'rrqc',
                    lite: true,
                    showLogos: view.rows.length <= 12,
                    ...(raid.phase === 'herald' ? { coreBig: String(raid.daysToStart), coreCap: raid.daysToStart === 1 ? 'day' : 'days' } : {})
                })}
            </div>
        </div>
        <div class="rr-qc__copy">
            <p class="sc-big sc-big--sm">${esc(big)}</p>
            <p class="sc-sub">${esc(sub)}</p>
            ${hp}
            ${row && row.share ? `<p class="rr-qc__mine">${esc(row.logo)} <b>${esc(row.name)}</b> ⚔️ ${row.valor ? 'shard broken!' : `${fmt(row.stars)} / ${fmt(row.share)}`}</p>` : ''}
        </div>
    </div>`;
}
