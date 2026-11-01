// ui/modals/realmRaidView.mjs — Realm Raid markup: the Raid Hall (a JRPG boss battle), the victory
// moment, "How to play" and the projector card. Pure string builders from a raid view (features/realmRaid.js#buildRaidView);
// no state, no Firebase, so the preview page can use them as they are.
import { bossSvg, bossFrontSvg, arenaSvg, shieldSvg, raysSvg, crackSvg, peaksSvg } from '../../features/realmRaidArt.mjs';
import { RAID_REWARDS, LEGENDARY_AT, RAID_EFFORT, RAID_LENGTH_DAYS, guardianMood, raidCountdown, readDate, raidDays, dayKey, raidDayPlan } from '../../features/realmRaidCore.mjs';
import { LEAGUE_JOBS, leagueJob, wordTier, battleMessages, battleTitle, bossLine, caption } from '../../features/realmRaidBattle.mjs';
import { sceneHtml } from '../../features/realmRaidScene.mjs';
import { heroSpriteSvg, partyFormation } from '../../features/realmRaidParty.mjs';

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmt = (n) => {
    const v = Math.round((Number(n) || 0) * 2) / 2;
    return v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
};

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
 * Eldhorn on his battlefield: the stage, the beam of light, the Guardian in armour, his shield and
 * his gauntlets on its rim, in one box (1000 × 820) so every screen frames him the same way.
 */
export function stageHtml(season, { mood = 'proud', crown = false, rows = [], pct = 0, broken = false, focusId = '', prefix = 'rrh', lite = false, showLogos = true, coreBig = '', coreCap = '', extra = '', guardians = null, fronts = null, hands = true } = {}) {
    const guardian = guardians || `<div class="rr-stage__guardian">${bossSvg(season.id, { mood, crown, id: `${prefix}g`, title: season.title, hands })}</div>`;
    const front = fronts ?? (hands ? `<div class="rr-stage__front">${bossFrontSvg(season.id, { id: `${prefix}f`, mood })}</div>` : '');
    return `<div class="rr-stage__gate">${arenaSvg(season.id, { id: `${prefix}arena`, lit: broken })}</div>
        ${lite ? '' : `<div class="rr-stage__rays">${raysSvg(season.id, { id: `${prefix}rays` })}</div>`}
        ${guardian}
        <div class="rr-stage__shield">${shieldSvg(season.id, rows, { pct, broken, focusId, id: `${prefix}s`, showLogos, coreBig, coreCap })}</div>
        ${front}
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
// A JRPG boss fight. Eldhorn stands in the middle; windows round him: the boss and his HP, the five
// turns (Monday to Friday), the featured class (its league's job, its heroes by name), the treasure,
// the message window (the fight told turn by turn) and the alliance (every class, by league).

const RAID_TURNS = RAID_LENGTH_DAYS;
const LEAGUE_ORDER = Object.keys(LEAGUE_JOBS);

/** The five turns (raid days): stars the school dealt, whether anyone had a lesson, past / now / next. */
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

/** Eldhorn's mood on screen. */
export function moodFor(view) {
    const { raid, status } = view;
    if (raid.phase === 'herald') return 'proud';
    if (raid.phase !== 'active' && !status.broken) return 'bow';
    return guardianMood(status);
}

const jobStyle = (job) => `--job:${job.color};--job-deep:${job.deep}`;

/** The rounds of this raid (one per weekday, sized by that day's lessons). */
export function roundsFor(view) {
    return raidDayPlan(view.raid, view.rows.filter((r) => r.share > 0), view.tally?.byDay || {});
}

/** The boss bar: his name and HP (the shield's stars still standing), marked where each round ends. */
function bossWinHtml(view, rounds) {
    const { raid, status } = view;
    const season = raid.season;
    const [name, ...rest] = String(season.title).split(', ');
    const left = Math.max(0, status.hp - status.dealt);
    const hpPct = status.hp ? left / status.hp : 1;
    const legendPct = status.hp ? Math.min(1, status.dealt / Math.max(1, status.legendaryAt)) : 0;
    const state = status.legendary ? 'is-legendary' : status.broken ? 'is-broken' : hpPct <= 0.25 ? 'is-low' : hpPct <= 0.5 ? 'is-mid' : '';
    // Round marks, read right to left like the bar drains: Monday's damage comes off the right.
    let acc = 0;
    const marks = status.broken ? '' : rounds.filter((r) => !r.rest).slice(0, -1).map((r) => {
        acc += r.weight;
        return `<i class="rr-hp__mark" style="left:${((1 - acc) * 100).toFixed(2)}%"></i>`;
    }).join('');
    return `<section class="rr-win rr-bosswin ${state}" aria-label="Boss">
        <div class="rr-bosswin__name">
            <span class="rr-tag">BOSS</span>
            <b>${esc(name)}</b>
            <small>${esc(rest.join(', '))}</small>
        </div>
        <div class="rr-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${status.hp}" aria-valuenow="${left}" aria-label="Shield HP left">
            <span class="rr-hp__label">HP</span>
            <span class="rr-hp__track">
                <span class="rr-hp__ghost" style="--p:${hpPct.toFixed(4)}"></span>
                <span class="rr-hp__fill" style="--p:${hpPct.toFixed(4)}"></span>
                ${marks}
                ${status.broken ? `<span class="rr-hp__broken">${status.legendary ? '👑 LEGENDARY!' : '💥 BROKEN!'}</span>` : ''}
            </span>
            <span class="rr-hp__num"><b>${fmt(left)}</b>/${fmt(status.hp)}</span>
        </div>
        ${status.broken ? `<div class="rr-crownbar${status.legendary ? ' is-full' : ''}" title="Legendary at ${fmt(status.legendaryAt)} stars">
            <span class="rr-crownbar__label">👑</span>
            <span class="rr-crownbar__track"><span style="--p:${legendPct.toFixed(4)}"></span></span>
            <span class="rr-crownbar__num">${status.legendary ? `${fmt(status.dealt)} ★` : `${fmt(Math.max(0, status.legendaryAt - status.dealt))} ★`}</span>
        </div>` : ''}
    </section>`;
}

/**
 * The rounds window: one block per weekday, as wide as that day's share of the shield. Each fills
 * with the stars dealt that day; a block glows once its round is won. Rest days are small moons.
 */
function roundsWinHtml(view, rounds, now, tier) {
    const { raid } = view;
    const today = dayKey(now);
    const current = raid.phase === 'active' ? raid.dayNumber : 0;
    const playing = rounds.filter((r) => !r.rest);
    const lastN = playing.length ? playing[playing.length - 1].n : RAID_TURNS;
    const title = raid.phase === 'herald' ? `${raid.daysToStart} ${raid.daysToStart === 1 ? 'day' : 'days'}`
        : raid.phase === 'active' ? (current === lastN ? caption('lastRound', tier) : caption('round', tier, { n: current }))
            : `${playing.filter((r) => r.cleared).length}/${playing.length} ✓`;
    return `<section class="rr-win rr-roundwin" aria-label="Rounds">
        <h3 class="rr-win__title">${raid.phase === 'herald' ? 'STARTS IN' : 'ROUNDS'} <b>${esc(title)}</b></h3>
        <ol class="rr-rounds">${rounds.map((r) => {
            const when = r.key < today ? 'past' : r.key === today ? 'now' : 'next';
            const fill = r.plan > 0 ? Math.min(1, r.dealt / r.plan) : 0;
            const words = `${r.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}: ${r.rest ? 'no lessons' : `${fmt(r.dealt)} of ${fmt(r.plan)} stars, ${r.classes.length} ${r.classes.length === 1 ? 'class' : 'classes'}, ${r.heroes} heroes`}`;
            const grow = r.rest ? 0 : Math.max(0.6, r.weight * 10);
            return `<li class="rr-round is-${when}${r.rest ? ' is-rest' : ''}${r.cleared ? ' is-cleared' : ''}" style="flex-grow:${grow.toFixed(2)}" title="${esc(words)}">
                <span class="rr-round__bar"><span style="--p:${fill.toFixed(4)}"></span>${r.cleared ? '<i aria-hidden="true">✓</i>' : ''}</span>
                <b>${esc(r.date.toLocaleDateString('en-GB', { weekday: 'short' }))}</b>
                <small>${r.rest ? '☾' : `${fmt(r.dealt)}/${fmt(r.plan)}`}</small>
            </li>`;
        }).join('')}</ol>
    </section>`;
}

/** The three treasure chests, small, in the top bar. Words in the tooltips. */
function lootMiniHtml(view, focusRow) {
    const { status, raid } = view;
    const over = raid.phase === 'aftermath' || raid.phase === 'over';
    const r = RAID_REWARDS;
    const chest = (kind, icon, earned, tip) => {
        const st = earned ? 'open' : over ? 'missed' : 'locked';
        return `<li class="rr-chest rr-chest--${kind} is-${st}" title="${esc(tip)}" aria-label="${esc(tip)}">
            <span class="rr-chest__box" aria-hidden="true"><span class="rr-chest__lid"></span><span class="rr-chest__icon">${icon}</span>${st === 'locked' ? '<i class="fas fa-lock rr-chest__lock"></i>' : ''}</span>
        </li>`;
    };
    return `<ul class="rr-win rr-lootwin" aria-label="Treasure">
        ${chest('valor', '✨', Boolean(focusRow?.valor), `Valor: a class breaks its own shard. +${r.valorGold} Gold for each of its heroes. Never taken away.`)}
        ${chest('victory', '🛡️', status.broken, `Victory: the school breaks the shield. +${r.victoryGold} Gold for every hero, a 5% map step, a treasure for each Raid Hero.`)}
        ${chest('legendary', '👑', status.legendary, `Legendary: ${Math.round(LEGENDARY_AT * 100)}% of the shield. +${r.legendaryGold} Gold more for every hero and another map step.`)}
    </ul>`;
}

/** The year's three raids, as medallions. Each opens that raid. */
function yearNavHtml(year = [], currentId = '') {
    if (!year.length) return '';
    const label = { won: 'won', legendary: 'Legendary', held: 'the shield held', live: 'now', soon: '' };
    return `<nav class="rr-year" aria-label="This year's raids">${year.map((y) => {
        const current = y.raidId === currentId;
        const date = readDate(y.start)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) || '';
        const words = `${y.season.name}${label[y.state] ? `: ${label[y.state]}` : `, ${date}`}`;
        return `<button type="button" class="rr-year__dot is-${esc(y.state)}${current ? ' is-current' : ''}" data-rr-raid="${esc(y.raidId)}" aria-label="${esc(words)}" title="${esc(words)}"${current ? ' aria-current="true"' : ''}>
            <span aria-hidden="true">${esc(y.season.emoji)}</span>
            ${y.state === 'won' || y.state === 'legendary' ? `<i class="fas fa-${y.state === 'legendary' ? 'crown' : 'check'}" aria-hidden="true"></i>` : ''}
        </button>`;
    }).join('')}</nav>`;
}

/** Every hero of the featured class by name; the ones who struck the shield are lit. */
export function rosterHtml(roster = [], phase = 'active', tier = 'mid') {
    if (!roster.length) return '';
    const struck = roster.filter((h) => h.stars > 0).length;
    const lead = phase === 'herald'
        ? `${roster.length} heroes ready`
        : tier === 'young' ? `${struck} of ${roster.length} heroes hit!` : `${struck}/${roster.length} heroes struck`;
    return `<div class="rr-roster">
        <p class="rr-roster__lead"><span aria-hidden="true">⚔️</span> ${esc(lead)}</p>
        <ul class="rr-roster__list${roster.length > 18 ? ' is-many' : ''}">${roster.map((h) => `<li class="rr-roster__hero${h.stars > 0 ? ' is-lit' : ''}" title="${esc(h.fullName || h.name)}${h.stars > 0 ? `: ${fmt(h.stars)} ★` : ''}">${h.stars > 0 ? '<b aria-hidden="true">★</b>' : ''}${esc(h.name)}</li>`).join('')}</ul>
    </div>`;
}

/** The featured class's window: its league's job and skill, its shard gauge, its heroes by name. */
function statusWinHtml(view, row, { heroCard = null, canReveal = false, roster = [], tier = 'mid' } = {}) {
    if (!row) return '';
    const job = leagueJob(row.league);
    const fill = Math.min(1, row.pct || 0);
    const phase = view.raid.phase;
    const over = phase === 'aftermath' || phase === 'over';
    let goal;
    if (phase === 'herald') goal = { icon: '🛡️', text: row.share ? `${fmt(row.share)} ★` : caption('away', tier) };
    else if (!row.share) goal = { icon: '🌙', text: caption('away', tier) };
    else if (row.valor) goal = { icon: '✨', text: row.stars > row.share ? `${caption('valor', tier)} +${fmt(row.stars - row.share)} ★` : caption('valor', tier), done: true };
    else if (over) goal = { icon: '⚔️', text: `${fmt(row.stars)} ★` };
    else goal = { icon: '🎯', text: tier === 'young' ? `${fmt(Math.max(0, row.share - row.stars))} ★ to go!` : `${fmt(Math.max(0, row.share - row.stars))} ★ to break` };
    const reveal = canReveal ? '<button type="button" class="rr-cmd rr-cmd--gold" data-rr-reveal><span class="rr-cmd__cursor" aria-hidden="true">▶</span> Reveal our Raid Hero</button>' : '';
    return `<section class="rr-win rr-statwin${row.valor ? ' is-full' : ''}" style="${jobStyle(job)}" aria-label="${esc(row.name)}">
        <div class="rr-stat__head">
            <span class="rr-crest" aria-hidden="true"><span class="rr-crest__icon">${job.icon}</span><span class="rr-crest__logo">${esc(row.logo)}</span></span>
            <span class="rr-stat__who">
                <b>${esc(row.name)}</b>
                <em>${esc(job.job)} · ${esc(row.league || '')}</em>
                <span class="rr-stat__skill">${job.icon} ${esc(job.skill)}</span>
            </span>
        </div>
        <div class="rr-gauge" title="${row.share ? `${fmt(row.stars)} of ${fmt(row.share)} stars` : ''}">
            <span class="rr-gauge__label">SHARD</span>
            <span class="rr-gauge__track"><span style="--p:${fill.toFixed(4)}"></span></span>
            <span class="rr-gauge__num"><b>${fmt(row.stars)}</b>${row.share ? `/${fmt(row.share)}` : ''}</span>
            <span class="rr-stat__goal${goal.done ? ' is-done' : ''}"><span aria-hidden="true">${goal.icon}</span> ${esc(goal.text)}</span>
        </div>
        ${heroCardHtml(heroCard)}
        ${reveal}
        ${rosterHtml(roster, phase, tier)}
    </section>`;
}

/** One class in the alliance window. */
export function allyRowHtml(row, { focusId = '', phase = 'active' } = {}) {
    const job = leagueJob(row.league);
    const fill = Math.min(1, row.pct || 0);
    const badge = row.valor ? '<span class="rr-ally__badge is-full">✨</span>'
        : !row.share ? '<span class="rr-ally__badge">☾</span>'
            : phase === 'active' && !row.lessonsLeft ? '<span class="rr-ally__badge">✓</span>' : '';
    const words = `${row.name}: ${fmt(row.stars)}${row.share ? ` of ${fmt(row.share)}` : ''} stars${row.valor ? ', shard broken' : ''}`;
    return `<li class="rr-ally__row${row.own ? ' is-own' : ''}${row.classId === focusId ? ' is-focus' : ''}${row.valor ? ' is-full' : ''}${!row.share ? ' is-away' : ''}" data-banner="${esc(row.classId)}" style="${jobStyle(job)}" title="${esc(words)}" role="button" tabindex="0" aria-label="${esc(words)}">
        <span class="rr-ally__cursor" aria-hidden="true">▶</span>
        <span class="rr-ally__logo" aria-hidden="true">${esc(row.logo)}</span>
        <span class="rr-ally__name">${esc(row.name)}</span>
        <span class="rr-atb" aria-hidden="true"><span style="--p:${fill.toFixed(4)}"></span></span>
        <span class="rr-ally__dmg">${fmt(row.stars)}${row.share ? `<small>/${fmt(row.share)}</small>` : ''}</span>
        ${badge}
    </li>`;
}

/** The alliance window: every class in the raid, grouped by league (each league is a job). */
function allyWinHtml(view, focusId) {
    const rows = view.rows.filter((row) => row.share > 0 || row.stars > 0);
    const groups = new Map();
    rows.forEach((row) => {
        const known = LEAGUE_ORDER.find((name) => leagueJob(name) === leagueJob(row.league));
        const key = known || '~';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });
    const ordered = [...groups.entries()].sort((a, b) => (LEAGUE_ORDER.indexOf(a[0]) + 1 || 99) - (LEAGUE_ORDER.indexOf(b[0]) + 1 || 99));
    const full = rows.filter((r) => r.valor).length;
    const body = ordered.map(([league, list]) => {
        const job = leagueJob(league === '~' ? '' : league);
        list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
        return `<li class="rr-ally__group" style="${jobStyle(job)}">
            <p class="rr-ally__job"><span aria-hidden="true">${job.icon}</span> ${esc(job.job)}${league !== '~' ? ` <small>${esc(league)}</small>` : ''}</p>
            <ul class="rr-ally__rows">${list.map((row) => allyRowHtml(row, { focusId, phase: view.raid.phase })).join('')}</ul>
        </li>`;
    }).join('');
    return `<section class="rr-win rr-allywin" aria-label="Alliance">
        <h3 class="rr-win__title">PARTY <small>${rows.length} ${rows.length === 1 ? 'class' : 'classes'}${full ? ` · ✨ ${full} broken` : ''}</small></h3>
        <div class="rr-ally__scroll"><ul class="rr-ally__track">${body}</ul></div>
    </section>`;
}

/** The banner across the battlefield: the boss is coming, today's round, or the end. */
function fieldBannerHtml(view, tier, rounds) {
    const { raid, status } = view;
    if (raid.phase === 'active') {
        const playing = rounds.filter((r) => !r.rest);
        const last = playing.length && raid.dayNumber === playing[playing.length - 1].n;
        const today = rounds[raid.dayNumber - 1];
        const big = today?.rest ? caption('rest', tier) : last ? caption('lastRound', tier) : caption('round', tier, { n: raid.dayNumber });
        return `<div class="rr-fieldbanner is-round"><b>${esc(big)}</b></div>`;
    }
    const title = battleTitle({ raid, status, tier });
    const sub = raid.phase === 'herald' ? `${raid.daysToStart} ${raid.daysToStart === 1 ? 'day' : 'days'}` : '';
    return `<div class="rr-fieldbanner is-${raid.phase === 'herald' ? 'herald' : status.broken ? 'won' : 'held'}"><b>${esc(title)}</b>${sub ? `<small>⏳ ${esc(sub)}</small>` : ''}</div>`;
}

/** One class on the battlefield: its hero (its league's job), its banner, its name and gauge. */
function unitHtml(row, spot, { focusId = '', phase = 'active', tier = 'mid', i = 0 } = {}) {
    const job = leagueJob(row.league);
    const fill = Math.min(1, row.pct || 0);
    const away = !row.share;
    const words = `${row.name}, ${job.job}: ${fmt(row.stars)}${row.share ? ` of ${fmt(row.share)}` : ''} stars${row.valor ? ', shard broken' : ''}`;
    return `<button type="button" class="rr-unit${row.classId === focusId ? ' is-focus' : ''}${row.valor ? ' is-full' : ''}${away ? ' is-away' : ''}${row.own ? ' is-own' : ''}" data-banner="${esc(row.classId)}"
        style="left:${spot.x}%;top:${spot.y}%;--h:${spot.h};--d:${(spot.y / 100).toFixed(3)};z-index:${spot.z};--i:${i};${jobStyle(job)}" aria-label="${esc(words)}" title="${esc(words)}">
        <span class="rr-unit__body">
            <span class="rr-unit__sprite">${heroSpriteSvg(job)}</span>
            <span class="rr-unit__flag" aria-hidden="true">${esc(row.logo)}</span>
            ${row.valor ? `<span class="rr-unit__badge" aria-hidden="true">✨</span>` : ''}
            ${away && phase === 'active' ? `<span class="rr-unit__zz" aria-hidden="true">${esc(caption('away', 'young'))}</span>` : ''}
        </span>
        <span class="rr-unit__name">${esc(row.name)}</span>
        <span class="rr-unit__bar" aria-hidden="true"><span style="--p:${fill.toFixed(4)}"></span></span>
        ${row.classId === focusId ? '<span class="rr-unit__cursor" aria-hidden="true">▼</span>' : ''}
    </button>`;
}

/** The party: every class in the raid, in formation on the left (front column nearest the boss). */
function partyHtml(view, focusId, tier) {
    const rows = view.rows.filter((row) => row.share > 0 || row.stars > 0)
        .sort((a, b) => (LEAGUE_ORDER.indexOf(a.league) + 1 || 99) - (LEAGUE_ORDER.indexOf(b.league) + 1 || 99) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    // Older leagues stand in front, nearest Eldhorn; the youngest are safe at the back.
    rows.reverse();
    const spots = partyFormation(rows.length, { aspect: 1.5 });
    return `<div class="rr-party${rows.length > 15 ? ' is-many' : ''}${rows.length > 6 ? ' is-crowd' : ''}" aria-label="The party">${rows.map((row, i) => unitHtml(row, spots[i], { focusId, phase: view.raid.phase, tier, i })).join('')}</div>`;
}

/** The tools in the corner: the year's raids, music, how to play, close. */
function toolsHtml(view, { year = [], musicOn = true } = {}) {
    return `<div class="rr-tools">
        ${yearNavHtml(year, view.raid.raidId)}
        <button type="button" class="rr-icon-btn rr-music${musicOn ? '' : ' is-off'}" data-rr-music aria-pressed="${musicOn}" aria-label="Battle music" title="Battle music"><span aria-hidden="true">♪</span></button>
        <button type="button" class="rr-icon-btn" data-rr-help aria-label="How to play" title="How to play"><span aria-hidden="true">?</span></button>
        <button type="button" class="rr-icon-btn" data-rr-close aria-label="Close" title="Close (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>
    </div>`;
}

/**
 * The Raid Hall: a classic side-view boss battle. The classes stand on the left, Eldhorn on the
 * right; the windows below hold the rounds, the party list and the featured class. `focusId` is
 * the class to feature (its league sets the words); `heroCard` its Raid Hero; `roster` every hero
 * of it by name; `year` the year's three raids; `intro` plays the opening.
 */
export function hallHtml(view, { focusId = '', heroCard = null, canReveal = false, lite = false, roster = [], year = [], now = new Date(), intro = false, musicOn = true } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const mood = moodFor(view);
    const focusRow = view.rows.find((r) => r.classId === focusId) || null;
    const tier = wordTier(focusRow?.league);
    const rounds = roundsFor(view);
    const said = bossLine({ phase: raid.phase, mood, broken: status.broken, legendary: status.legendary, guardian: season.guardian, tier }).replace(/^[^:]+: /, '');
    const story = battleMessages({ raid, status, turns: raidTurns(view, now), byDayClass: view.tally?.byDayClass || {}, rows: view.rows, mood, tier, limit: 3 });
    return `<div class="rr-hall rr-hall--${season.id} rr-phase--${raid.phase} rr-mood--${mood} rr-tier--${tier}${status.broken ? ' is-broken' : ''}${status.legendary ? ' is-legendary' : ''}${lite ? ' rr-lite' : ''}${intro ? ' is-intro' : ''}">
        ${skyHtml(season.id, { lite })}
        <header class="rr-top">
            <h2 class="rr-sr" id="rr-hall-title">Realm Raid: ${esc(season.name)}. ${esc(battleTitle({ raid, status, tier }))}</h2>
            ${bossWinHtml(view, rounds)}
            ${lootMiniHtml(view, focusRow)}
            ${toolsHtml(view, { year, musicOn })}
        </header>
        <div class="rr-field">
            ${sceneHtml(season.id, { id: 'rrscene', lite })}
            ${partyHtml(view, focusId, tier)}
            <div class="rr-bossside">
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
                </div>
                <p class="rr-bubble">${esc(said)}</p>
            </div>
            ${fieldBannerHtml(view, tier, rounds)}
            <div class="rr-cast" aria-hidden="true"></div>
            <div class="rr-dmg-layer" aria-hidden="true"></div>
            <span class="rr-flash" aria-hidden="true"></span>
            ${view.loading ? '<span class="rr-field__loading"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i></span>' : ''}
        </div>
        ${roundsWinHtml(view, rounds, now, tier)}
        ${allyWinHtml(view, focusId)}
        ${statusWinHtml(view, focusRow, { heroCard, canReveal, roster, tier })}
        <ol class="rr-sr" aria-live="polite">${story.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>
        ${intro ? `<div class="rr-intro" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<b>${esc(raid.phase === 'herald' ? battleTitle({ raid, status, tier }) : `${season.guardian}!`)}</b></div>` : ''}
    </div>`;
}

/** "How to play": three steps, the treasure, and every league's job. */
export function howItWorksHtml(view) {
    const season = view?.raid?.season;
    const r = RAID_REWARDS;
    const step = (n, icon, big, small) => `<li class="rr-step"><span class="rr-step__n">${n}</span><span class="rr-step__icon" aria-hidden="true">${icon}</span><b>${big}</b><small>${small}</small></li>`;
    const jobs = Object.entries(LEAGUE_JOBS).map(([league, job]) => `<li style="${jobStyle(job)}"><span class="rr-help__jobicon" aria-hidden="true">${job.icon}</span><b>${esc(job.job)}</b><small>${esc(league)} · ${esc(job.skill)}</small></li>`).join('');
    return `<div class="rr-help" role="dialog" aria-modal="true" aria-labelledby="rr-help-title">
        <div class="rr-win rr-help__card">
            <button type="button" class="rr-icon-btn rr-help__close" data-rr-help-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <h3 id="rr-help-title" class="rr-win__title">HOW TO PLAY</h3>
            <ol class="rr-steps">
                ${step(1, '⭐', 'Earn stars', 'in any lesson, Monday to Friday')}
                ${step(2, '⚔️', 'Each star is a hit', `on ${esc(season?.guardian || 'Eldhorn')}'s shield`)}
                ${step(3, '🛡️', 'Break it together', 'the whole school is one party')}
            </ol>
            <ul class="rr-help__loot">
                <li><span aria-hidden="true">✨</span><b>Valor</b><small>your class breaks its own shard: +${r.valorGold} 🪙 each</small></li>
                <li><span aria-hidden="true">🛡️</span><b>Victory</b><small>+${r.victoryGold} 🪙 each, a map step, a treasure for each Raid Hero</small></li>
                <li><span aria-hidden="true">👑</span><b>Legendary</b><small>${Math.round(LEGENDARY_AT * 100)}%: +${r.legendaryGold} 🪙 more, another map step</small></li>
            </ul>
            <h4 class="rr-win__title">JOBS <small>every league fights its own way</small></h4>
            <ul class="rr-help__jobs">${jobs}</ul>
            <p class="rr-help__foot">3 raids a year · 5 rounds, Monday to Friday · each round fits that day's lessons · each shard fits its class (${Math.round(RAID_EFFORT * 100)}% of a normal week) · nothing is ever taken away</p>
        </div>
    </div>`;
}

/** The victory moment: the shield shatters, the Guardian bows, then the results window. */
export function victoryHtml(view, { legendary = false, lite = false } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const r = RAID_REWARDS;
    const classes = view.rows.filter((row) => row.share > 0 || row.stars > 0).length;
    const heroes = view.rows.reduce((sum, row) => sum + (Number(row.heroes) || 0), 0);
    const results = legendary
        ? [['👑', 'LEGENDARY VICTORY!', 'big'], ['🪙', `Every hero gets +${r.legendaryGold} Gold more!`], ['🗺️', 'Every Team Quest map moves 2.5% more!'], ['⭐', `${fmt(status.dealt)} stars from ${classes} classes!`]]
        : [['⚔️', `${season.guardian} bows to the party!`, 'big'], ['🪙', `Every hero gets +${r.victoryGold} Gold!`], ['🗺️', 'Every Team Quest map moves 5%!'], ['🎁', 'Each Raid Hero finds a festival treasure!']];
    const chests = legendary ? [['🪙', `+${r.legendaryGold}`], ['🗺️', '+2.5%'], ['👑', 'Crown']] : [['🪙', `+${r.victoryGold}`], ['🗺️', '+5%'], ['🎁', 'Treasure']];
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
                guardians: `<div class="rr-stage__guardian rr-victory__guardian--before">${bossSvg(season.id, { mood: 'strain', id: 'rrv1', title: season.title })}</div>
                    <div class="rr-stage__guardian rr-victory__guardian--after">${bossSvg(season.id, { mood: 'bow', crown: legendary, id: 'rrv2', title: season.title, hands: false })}</div>`,
                fronts: `<div class="rr-stage__front rr-victory__guardian--before">${bossFrontSvg(season.id, { id: 'rrv1f', mood: 'strain' })}</div>`,
                extra: `<span class="rr-victory__glow" aria-hidden="true"></span>
                    <div class="rr-victory__cracks">${crackSvg()}</div>
                    <span class="rr-victory__flash" aria-hidden="true"></span>
                    <span class="rr-victory__wave" aria-hidden="true"></span>
                    ${lite ? '' : `<div class="rr-victory__burst" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--i:${i}"></i>`).join('')}</div>`}`
            })}
        </div>
        ${lite ? '' : `<div class="rr-victory__coins" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 53 + 7) % 100}%;--d:${(2.6 + (i % 6) * 0.35).toFixed(2)}s;--t:${(2.4 + (i % 4) * 0.5).toFixed(1)}s;--r:${(i % 2 ? 1 : -1) * (200 + i * 30)}deg"></i>`).join('')}</div>`}
        <div class="rr-victory__copy">
            <h2 id="rr-victory-title" class="rr-victory__title">${legendary ? 'LEGENDARY!' : 'VICTORY!'}</h2>
            <section class="rr-win rr-results" aria-label="Results">
                <h3 class="rr-win__title">${esc(season.name.toUpperCase())} <small>${classes} ${classes === 1 ? 'class' : 'classes'}${heroes ? ` · ${heroes} heroes` : ''} · one party</small></h3>
                <ol class="rr-results__lines">${results.map(([icon, text, kind], i) => `<li class="${kind === 'big' ? 'is-big' : ''}" style="--i:${i}"><span aria-hidden="true">${icon}</span> ${esc(text)}</li>`).join('')}</ol>
                <ul class="rr-results__chests">${chests.map(([icon, word], i) => `<li style="--i:${i}"><span class="rr-chest__box rr-victory__chest" aria-hidden="true"><span class="rr-chest__lid"></span><span class="rr-chest__icon">${icon}</span></span><b>${esc(word)}</b></li>`).join('')}</ul>
                <div class="rr-victory__actions">
                    <button type="button" class="rr-cmd rr-cmd--gold" data-rr-open-hall><span class="rr-cmd__cursor" aria-hidden="true">▶</span> See the battle</button>
                    <button type="button" class="rr-cmd" data-rr-victory-close><span class="rr-cmd__cursor" aria-hidden="true">▶</span> Close</button>
                </div>
            </section>
            ${victoryPartyHtml(view)}
        </div>
    </div>`;
}

/** The whole party cheering under the results: every class, by name. */
function victoryPartyHtml(view) {
    const rows = view.rows.filter((row) => row.share > 0 || row.stars > 0)
        .sort((a, b) => (LEAGUE_ORDER.indexOf(a.league) + 1 || 99) - (LEAGUE_ORDER.indexOf(b.league) + 1 || 99) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    if (!rows.length) return '';
    return `<ul class="rr-vparty${rows.length > 12 ? ' is-many' : ''}" aria-label="The party">${rows.map((row, i) => {
        const job = leagueJob(row.league);
        return `<li style="--i:${i};${jobStyle(job)}"><span class="rr-vparty__sprite" aria-hidden="true">${heroSpriteSvg(job)}<i>${esc(row.logo)}</i></span><b>${esc(row.name)}</b></li>`;
    }).join('')}</ul>`;
}

/** The projector card body (The Director deck). */
export function raidCardHtml(view, { focusId = '' } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const row = view.rows.find((r) => r.classId === focusId);
    const p = status.hp ? status.dealt / status.hp : 0;
    const mood = moodFor(view);
    const tier = wordTier(row?.league);
    const big = raid.phase === 'herald' ? battleTitle({ raid, status, tier })
        : status.broken ? (status.legendary ? 'LEGENDARY!' : 'VICTORY!')
            : raid.phase === 'active' ? `BOSS BATTLE · Round ${raid.dayNumber}/${RAID_LENGTH_DAYS}` : 'The shield held';
    const sub = raid.phase === 'active'
        ? `${season.guardian} · ${raidCountdown(raid)}`
        : raid.phase === 'herald' ? `${season.guardian} ${raidCountdown(raid)} · the whole school is one party` : `${fmt(status.dealt)} ★ from ${view.rows.filter((r) => r.stars > 0).length} classes`;
    const left = Math.max(0, status.hp - status.dealt);
    const hp = `<div class="rr-qc__hp"><span class="rr-qc__hp-label">HP</span><span class="rr-qc__hp-track"><span style="--p:${(status.hp ? left / status.hp : 1).toFixed(4)}"></span></span><b>${fmt(left)}<small>/${fmt(status.hp)}</small></b></div>`;
    const job = row ? leagueJob(row.league) : null;
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
            ${row && row.share ? `<p class="rr-qc__mine">${esc(row.logo)} <b>${esc(row.name)}</b> · ${job.icon} ${esc(job.skill)} · ${row.valor ? 'shard broken!' : `${fmt(row.stars)} / ${fmt(row.share)} ★`}</p>` : ''}
        </div>
    </div>`;
}
