// ui/modals/realmRaidView.mjs — Realm Raid markup: the Raid Hall, the victory moment, the
// "How it works" page. Pure string builders from a raid view (features/realmRaid.js#buildRaidView);
// no state, no Firebase, so the preview page can use them as they are.
import { guardianSvg, shieldSvg, ringSvg, gateSvg, raysSvg, crackSvg, peaksSvg } from '../../features/realmRaidArt.mjs';
import { RAID_REWARDS, LEGENDARY_AT, RAID_EFFORT, guardianMood, raidCountdown, readDate } from '../../features/realmRaidCore.mjs';

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmt = (n) => {
    const v = Math.round((Number(n) || 0) * 2) / 2;
    return v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
};
const pct = (n) => `${Math.floor((Number(n) || 0) * 100)}%`;

function dayName(key) {
    const d = readDate(key);
    return d ? d.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
}

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

function meterHtml(view) {
    const { status, raid } = view;
    const fill = Math.min(1, status.hp ? status.dealt / status.hp : 0);
    const over = status.hp ? Math.min(LEGENDARY_AT - 1, Math.max(0, status.dealt / status.hp - 1)) / (LEGENDARY_AT - 1) : 0;
    const togo = Math.max(0, status.hp - status.dealt);
    const toLegend = Math.max(0, status.legendaryAt - status.dealt);
    let line;
    if (raid.phase === 'herald') line = `The shield will hold <b>${fmt(status.hp)}</b> stars. It takes the whole school to break it.`;
    else if (status.legendary) line = `<b>${fmt(status.dealt)}</b> stars! A <b>Legendary</b> victory for the whole school.`;
    else if (status.broken) line = raid.phase === 'active'
        ? `Shield broken! <b>${fmt(toLegend)}</b> more stars for a <b>Legendary</b> victory.`
        : `Shield broken with <b>${fmt(status.dealt)}</b> stars.`;
    else if (raid.phase === 'active') line = `<b>${fmt(status.dealt)}</b> of <b>${fmt(status.hp)}</b> stars. <b>${fmt(togo)}</b> to go!`;
    else line = `The school sent <b>${fmt(status.dealt)}</b> of <b>${fmt(status.hp)}</b> stars.`;
    return `<div class="rr-meter${status.broken ? ' is-broken' : ''}${status.legendary ? ' is-legendary' : ''}">
        <div class="rr-meter__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${status.hp}" aria-valuenow="${Math.min(status.dealt, status.hp)}" aria-label="Stars sent at the shield">
            <span class="rr-meter__fill" style="--p:${fill.toFixed(4)}"></span>
            <span class="rr-meter__over" style="--p:${over.toFixed(4)}"></span>
            <span class="rr-meter__mark" title="Shield breaks"><i class="fas fa-shield-halved" aria-hidden="true"></i></span>
            <span class="rr-meter__crown" title="Legendary at ${Math.round(LEGENDARY_AT * 100)}%"><i class="fas fa-crown" aria-hidden="true"></i></span>
        </div>
        <p class="rr-meter__line">${line}</p>
    </div>`;
}

function rewardRow(kind, icon, title, lines, state) {
    const label = state === 'earned' ? 'Earned' : '';
    return `<li class="rr-spoil rr-spoil--${kind} is-${state}">
        <span class="rr-spoil__icon" aria-hidden="true">${icon}</span>
        <span class="rr-spoil__body"><b>${title}</b>${lines.map((l) => `<small>${l}</small>`).join('')}</span>
        ${label ? `<span class="rr-spoil__tag">${state === 'earned' ? '<i class="fas fa-check" aria-hidden="true"></i> ' : ''}${label}</span>` : ''}
    </li>`;
}

function spoilsHtml(view, focusRow) {
    const { status, raid } = view;
    const over = raid.phase === 'aftermath' || raid.phase === 'over';
    const r = RAID_REWARDS;
    const valorState = focusRow?.valor ? 'earned' : (over ? 'missed' : 'open');
    const victoryState = status.broken ? 'earned' : (over ? 'missed' : 'open');
    const legendState = status.legendary ? 'earned' : (over ? 'missed' : 'open');
    return `<section class="rr-card rr-spoils" aria-label="Spoils">
        <h3 class="rr-card__title"><i class="fas fa-gift" aria-hidden="true"></i> The Guardian's spoils</h3>
        <ul>
            ${rewardRow('victory', '🛡️', 'Victory: the shield breaks', [`+${r.victoryGold} Gold for every hero in every class`, 'A step on every Team Quest map (5%)', 'A festival treasure for each class\'s Raid Hero'], victoryState)}
            ${rewardRow('legendary', '👑', `Legendary: ${Math.round(LEGENDARY_AT * 100)}% of the shield`, [`+${r.legendaryGold} Gold more for every hero`, 'Another half step on every map (2.5%)'], legendState)}
            ${rewardRow('valor', '✨', 'Valor: your class breaks its own shard', [`+${r.valorGold} Gold for every hero, whatever happens`], focusRow ? valorState : (over ? 'missed' : 'open'))}
        </ul>
        <p class="rr-spoils__foot"><i class="fas fa-heart" aria-hidden="true"></i> Nothing is ever taken away.</p>
    </section>`;
}

function lessonsLine(row, phase) {
    if (row.helper) return 'Helping on a free day';
    if (!row.share) return 'No lessons this week';
    if (row.valor) return 'Shard broken!';
    if (phase === 'herald') return `${row.lessonDates.length} raid ${row.lessonDates.length === 1 ? 'lesson' : 'lessons'}`;
    if (phase !== 'active') return `${pct(row.pct)} of the shard`;
    if (!row.lessonsLeft) return 'Lessons done';
    return row.nextLesson ? `Next: ${dayName(row.nextLesson)}` : 'Lessons done';
}

/** One class banner in the Alliance. */
export function bannerHtml(row, { focusId = '', phase = 'active' } = {}) {
    const fill = Math.min(1, row.pct || 0);
    return `<li class="rr-banner${row.own ? ' is-own' : ''}${row.classId === focusId ? ' is-focus' : ''}${row.valor ? ' is-full' : ''}${!row.share ? ' is-away' : ''}" data-banner="${esc(row.classId)}">
        <span class="rr-banner__ring">${ringSvg(fill, { size: 46, stroke: 5, color: row.valor ? '#fde68a' : '#fbbf24', full: row.valor })}<span class="rr-banner__logo">${esc(row.logo)}</span></span>
        <span class="rr-banner__name">${esc(row.name)}</span>
        <span class="rr-banner__stars">${row.share ? `${fmt(row.stars)} <small>/ ${fmt(row.share)}</small>` : `${fmt(row.stars)}`} <i class="fas fa-star" aria-hidden="true"></i></span>
        <span class="rr-banner__note">${esc(lessonsLine(row, phase))}</span>
    </li>`;
}

function allianceHtml(view, focusId) {
    const rows = [...view.rows]
        .filter((row) => row.share > 0 || row.stars > 0)
        .sort((a, b) => String(a.league).localeCompare(String(b.league)) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    const full = rows.filter((r) => r.valor).length;
    return `<section class="rr-alliance" aria-label="The Alliance">
        <header class="rr-alliance__head">
            <h3><i class="fas fa-flag" aria-hidden="true"></i> The Alliance <small>${rows.length} ${rows.length === 1 ? 'class' : 'classes'}, one shield</small></h3>
            ${full ? `<span class="rr-alliance__count">${full} ${full === 1 ? 'shard' : 'shards'} broken</span>` : ''}
        </header>
        <ul class="rr-alliance__list${rows.length > 10 ? ' is-many' : ''}">${rows.map((row) => bannerHtml(row, { focusId, phase: view.raid.phase })).join('')}</ul>
    </section>`;
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

function focusHtml(view, row, { heroCard = null, canReveal = false } = {}) {
    if (!row) return '';
    const fill = Math.min(1, row.pct || 0);
    const phase = view.raid.phase;
    let say;
    if (!row.share) say = 'No raid lessons this week. Any stars still help the school!';
    else if (row.valor) say = row.stars > row.share ? `Shard broken, and <b>${fmt(row.stars - row.share)}</b> extra ${row.stars - row.share === 1 ? 'star' : 'stars'} sent to help the others!` : 'Shard broken! Every star now helps the other classes.';
    else if (phase === 'herald') say = `Your shard: <b>${fmt(row.share)}</b> stars in ${row.lessonDates.length} ${row.lessonDates.length === 1 ? 'lesson' : 'lessons'}. A normal, good week breaks it.`;
    else {
        const left = Math.max(0, row.share - row.stars);
        say = `<b>${fmt(left)}</b> more ${left === 1 ? 'star breaks' : 'stars break'} your shard.`;
    }
    const reveal = canReveal ? '<button type="button" class="rr-btn rr-btn--gold" data-rr-reveal><i class="fas fa-crown" aria-hidden="true"></i> Reveal our Raid Hero</button>' : '';
    return `<section class="rr-card rr-focus${row.valor ? ' is-full' : ''}" aria-label="Your class">
        <div class="rr-focus__top">
            <span class="rr-focus__ring">${ringSvg(fill, { size: 74, stroke: 8, color: row.valor ? '#fde68a' : '#fbbf24', full: row.valor })}<span>${esc(row.logo)}</span></span>
            <span class="rr-focus__copy"><small>${row.own ? 'Your class' : 'Selected class'}</small><b>${esc(row.name)}</b><em>${row.share ? `${fmt(row.stars)} / ${fmt(row.share)} ★ · ${pct(row.pct)}` : `${fmt(row.stars)} ★`}</em></span>
        </div>
        <p class="rr-focus__say">${say}</p>
        ${heroCardHtml(heroCard)}
        ${reveal}
    </section>`;
}

function headline(view) {
    const { raid, status } = view;
    const season = raid.season;
    if (raid.phase === 'herald') return { kicker: `${season.name} · ${raidCountdown(raid)}`, title: `${season.guardian} ${season.arrives}` };
    if (raid.phase === 'active') return { kicker: `${season.name} · day ${raid.dayNumber} of 7 · ${raidCountdown(raid)}`, title: status.broken ? 'The shield is broken!' : 'Every star breaks the shield' };
    if (status.broken) return { kicker: `${season.name} · won`, title: status.legendary ? 'A Legendary victory!' : 'The school won the raid!' };
    return { kicker: `${season.name} · over`, title: `The shield held. ${season.guardian} bows to your courage` };
}

/**
 * The Raid Hall. `focusId` is the class to feature (the header's class, or the teacher's own).
 * `heroCard` is a resolved Raid Hero ({ name, faceHtml, days, stars, prize }) for that class.
 */
export function hallHtml(view, { focusId = '', heroCard = null, canReveal = false, lite = false } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const mood = raid.phase === 'herald' ? 'proud' : (raid.phase !== 'active' && !status.broken ? 'bow' : guardianMood(status));
    const focusRow = view.rows.find((r) => r.classId === focusId) || null;
    const head = headline(view);
    const shieldRows = view.rows.map((r) => ({ ...r }));
    const ends = raid.phase === 'herald' ? `Raid week: ${shortDate(raid.start)} to ${shortDate(raid.end)}` : `Ends ${shortDate(raid.end)}`;
    const nextLine = raid.phase !== 'active' && raid.phase !== 'herald' && view.next
        ? `<p class="rr-next">${esc(season.guardian)} returns ${esc(season.returns)}: ${shortDate(view.next.start)}.</p>` : '';
    return `<div class="rr-hall rr-hall--${season.id} rr-phase--${raid.phase} rr-mood--${mood}${status.broken ? ' is-broken' : ''}${status.legendary ? ' is-legendary' : ''}${lite ? ' rr-lite' : ''}">
        ${skyHtml(season.id, { lite })}
        <header class="rr-top">
            <span class="rr-top__sigil" aria-hidden="true">${season.emoji}</span>
            <div class="rr-top__copy">
                <span class="rr-top__kicker">Realm Raid · ${esc(head.kicker)}</span>
                <h2 class="rr-top__title" id="rr-hall-title">${esc(head.title)}</h2>
            </div>
            <span class="rr-top__when"><i class="fas fa-hourglass-half" aria-hidden="true"></i> ${esc(ends)}</span>
            <button type="button" class="rr-icon-btn" data-rr-help aria-label="How the Realm Raid works" title="How it works"><i class="fas fa-question" aria-hidden="true"></i></button>
            <button type="button" class="rr-icon-btn" data-rr-close aria-label="Close" title="Close (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        </header>
        <main class="rr-main">
            <div class="rr-arena rr-stage">
                ${stageHtml(season, {
                    mood,
                    crown: status.legendary,
                    rows: shieldRows,
                    pct: status.hp ? status.dealt / status.hp : 0,
                    broken: status.broken,
                    focusId,
                    prefix: 'rrh',
                    lite,
                    ...(raid.phase === 'herald' ? { coreBig: String(raid.daysToStart), coreCap: raid.daysToStart === 1 ? 'day' : 'days' } : {})
                })}
                ${view.loading ? '<span class="rr-arena__loading"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Counting the stars…</span>' : ''}
            </div>
            ${meterHtml(view)}
            <p class="rr-name">${esc(season.title)} <span>· ${esc(season.coat)}</span></p>
        </main>
        <aside class="rr-side">
            ${focusHtml(view, focusRow, { heroCard, canReveal })}
            ${spoilsHtml(view, focusRow)}
            ${nextLine}
        </aside>
        ${allianceHtml(view, focusId)}
    </div>`;
}

/** "How it works": the rules in words a class understands. */
export function howItWorksHtml(view) {
    const season = view?.raid?.season;
    const r = RAID_REWARDS;
    return `<div class="rr-help" role="dialog" aria-modal="true" aria-labelledby="rr-help-title">
        <div class="rr-help__card">
            <button type="button" class="rr-icon-btn rr-help__close" data-rr-help-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <h3 id="rr-help-title"><span aria-hidden="true">🛡️</span> How the Realm Raid works</h3>
            <ol>
                <li><b>Three times a year</b>, ${esc(season?.guardian || 'Eldhorn')} the Realm Guardian visits the whole school for one week: before the Christmas holiday, before Clean Monday, and in the last school week.</li>
                <li><b>One shard for every class.</b> Its size is what your own Team Quest map expects from your class in its raid lessons (${Math.round(RAID_EFFORT * 100)}% of it). A small class or a big class, one lesson or two: the same good week breaks it.</li>
                <li><b>Every star counts.</b> Each star any class earns that week sends light into its shard. Stars past your shard help the other classes.</li>
                <li><b>Together.</b> When the whole school's stars fill the whole shield, it breaks for everyone.</li>
            </ol>
            <h4>Spoils</h4>
            <ul>
                <li>🛡️ <b>Victory</b>: +${r.victoryGold} Gold for every hero, a 5% step on every class's Team Quest map, and a festival treasure for each class's <b>Raid Hero</b> (the hero who struck in the most raid lessons).</li>
                <li>👑 <b>Legendary</b> (${Math.round(LEGENDARY_AT * 100)}%): +${r.legendaryGold} Gold more for every hero and another 2.5% step.</li>
                <li>✨ <b>Valor</b>: a class that breaks its own shard gets +${r.valorGold} Gold for every hero, even if the shield holds.</li>
            </ul>
            <p class="rr-help__foot"><i class="fas fa-heart" aria-hidden="true"></i> Nothing is ever taken away. If the shield holds, the Guardian bows and comes back next term.</p>
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
            <span class="rr-victory__kicker">${esc(season.name)} · ${classes} ${classes === 1 ? 'class' : 'classes'} together</span>
            <h2 id="rr-victory-title" class="rr-victory__title">${legendary ? 'Legendary victory!' : 'The shield is broken!'}</h2>
            <p class="rr-victory__sub">${legendary ? `${fmt(status.dealt)} stars: the Guardian has never seen a school like this.` : `${esc(season.guardian)} bows to the whole school. Every class wins.`}</p>
            <ul class="rr-victory__spoils">${spoils.map(([icon, big, small], i) => `<li style="--i:${i}"><span aria-hidden="true">${icon}</span><b>${esc(big)}</b><small>${esc(small)}</small></li>`).join('')}</ul>
            <div class="rr-victory__actions">
                <button type="button" class="rr-btn rr-btn--gold" data-rr-open-hall><i class="fas fa-shield-halved" aria-hidden="true"></i> Open the Raid Hall</button>
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
        : status.broken ? (status.legendary ? 'Legendary victory!' : 'The shield is broken!')
            : raid.phase === 'active' ? `${fmt(Math.max(0, status.hp - status.dealt))} stars to go` : 'The shield held';
    const sub = raid.phase === 'active'
        ? `${pct(p)} of the shield · ${raidCountdown(raid)}`
        : raid.phase === 'herald' ? `The whole school against one shield` : `${fmt(status.dealt)} stars from ${view.rows.filter((r) => r.stars > 0).length} classes`;
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
            ${row && row.share ? `<p class="rr-qc__mine">${esc(row.logo)} <b>${esc(row.name)}</b>: ${row.valor ? 'shard broken!' : `${fmt(row.stars)} / ${fmt(row.share)} ★`}</p>` : ''}
        </div>
    </div>`;
}
