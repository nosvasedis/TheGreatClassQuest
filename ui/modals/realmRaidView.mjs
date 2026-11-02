// ui/modals/realmRaidView.mjs — Realm Raid markup: the Raid Hall (a JRPG boss battle), the victory
// moment, "How to play" and the projector card. Pure string builders from a raid view (features/realmRaid.js#buildRaidView);
// no state, no Firebase, so the preview page can use them as they are.
import { bossSvg, bossFrontSvg, arenaSvg, shieldSvg, raysSvg, crackSvg, peaksSvg } from '../../features/realmRaidArt.mjs';
import { RAID_REWARDS, LEGENDARY_AT, RAID_EFFORT, RAID_LENGTH_DAYS, guardianMood, raidCountdown, readDate, raidDays, dayKey, raidDayPlan } from '../../features/realmRaidCore.mjs';
import { HERO_ARTS, STAR_ART, heroArt, classArt, strikeArts, leagueRank, wordTier, battleMessages, battleTitle, bossLine, caption } from '../../features/realmRaidBattle.mjs';
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
// A side-view boss battle in a real place. The classes stand on the left, each dressed as the hero
// class most of its students chose; Eldhorn guards his gate on the right. Over the field: the
// round road (top left), the boss bar (top), three buttons (top right). Under it: one class card.
// Everything else (the year's raids, the guilds, the hero arts, how to play) is in the menu sheet.

const RAID_TURNS = RAID_LENGTH_DAYS;

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

const artStyle = (art) => `--art:${art.color};--art-deep:${art.deep}`;

/** The rounds of this raid (one per weekday, sized by that day's lessons). */
export function roundsFor(view) {
    return raidDayPlan(view.raid, view.rows.filter((r) => r.share > 0), view.tally?.byDay || {});
}

/** The classes in the raid, youngest league first, then by name. */
export function raidClasses(view) {
    return view.rows.filter((row) => row.share > 0 || row.stars > 0)
        .sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}

/** The boss bar: name, HP (the shield's stars still standing) marked where each round ends, the Victory chest at its end. */
function bossBarHtml(view, rounds) {
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
    const r = RAID_REWARDS;
    const legendTip = `Legendary at ${fmt(status.legendaryAt)} ★: +${r.legendaryGold} Gold more for every hero and another map step`;
    return `<div class="rr-boss ${state}">
        <p class="rr-boss__name"><b>${esc(name)}</b><span>${esc(rest.join(', '))}</span></p>
        <div class="rr-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${status.hp}" aria-valuenow="${left}" aria-label="Shield HP left">
            <span class="rr-hp__track">
                <span class="rr-hp__ghost" style="--p:${hpPct.toFixed(4)}"></span>
                <span class="rr-hp__fill" style="--p:${hpPct.toFixed(4)}"></span>
                ${marks}
            </span>
            <span class="rr-hp__num">${status.broken ? `<b class="rr-hp__won">${status.legendary ? 'LEGENDARY' : 'BROKEN'}</b>` : `<b>${fmt(left)}</b><small>/${fmt(status.hp)}</small>`}</span>
            <span class="rr-hp__goal${status.broken ? ' is-open' : ''}" title="Victory: +${r.victoryGold} Gold for every hero, a map step, a treasure for each Raid Hero" aria-hidden="true">🛡️</span>
        </div>
        ${status.broken ? `<div class="rr-crown${status.legendary ? ' is-full' : ''}" title="${esc(legendTip)}">
            <span class="rr-crown__track"><span style="--p:${legendPct.toFixed(4)}"></span></span>
            <span class="rr-crown__icon" aria-hidden="true">👑</span>
            <span class="rr-crown__num">${status.legendary ? `${fmt(status.dealt)} ★` : `${fmt(Math.max(0, status.legendaryAt - status.dealt))} ★`}</span>
        </div>` : ''}
    </div>`;
}

/** The round road: one segment per weekday, as long as that day's share; it fills with the stars dealt. */
function roadHtml(view, rounds, now, tier) {
    const { raid } = view;
    const today = dayKey(now);
    const current = raid.phase === 'active' ? raid.dayNumber : 0;
    const playing = rounds.filter((r) => !r.rest);
    const lastN = playing.length ? playing[playing.length - 1].n : RAID_TURNS;
    let eyebrow;
    let big;
    if (raid.phase === 'herald') { eyebrow = 'STARTS IN'; big = `${raid.daysToStart} ${raid.daysToStart === 1 ? 'day' : 'days'}`; }
    else if (raid.phase === 'active') { eyebrow = current === lastN ? caption('lastRound', tier).toUpperCase() : 'ROUND'; big = current === lastN ? '' : `${current}`; }
    else { eyebrow = 'ROUNDS WON'; big = `${playing.filter((x) => x.cleared).length}/${playing.length}`; }
    const segs = rounds.map((r) => {
        const when = r.key < today ? 'past' : r.key === today ? 'now' : 'next';
        const fill = r.plan > 0 ? Math.min(1, r.dealt / r.plan) : 0;
        const words = `${r.date.toLocaleDateString('en-GB', { weekday: 'long' })}: ${r.rest ? 'no lessons' : `${fmt(r.dealt)} of ${fmt(r.plan)} stars, ${r.classes.length} ${r.classes.length === 1 ? 'class' : 'classes'}`}`;
        const grow = r.rest ? 0 : Math.max(0.7, r.weight * 10);
        return `<li class="rr-road__seg is-${when}${r.rest ? ' is-rest' : ''}${r.cleared ? ' is-cleared' : ''}" style="flex-grow:${grow.toFixed(2)}" title="${esc(words)}" aria-label="${esc(words)}">
            <span class="rr-road__bar"><span style="--p:${fill.toFixed(4)}"></span></span>
            <span class="rr-road__day">${r.rest ? '☾' : esc(r.date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2))}</span>
        </li>`;
    }).join('');
    return `<div class="rr-roadbox">
        <p class="rr-roadbox__head"><span>${esc(eyebrow)}</span>${big ? `<b>${esc(big)}</b>` : ''}${raid.phase === 'active' && big ? `<small>/${RAID_TURNS}</small>` : ''}</p>
        <ol class="rr-road">${segs}</ol>
    </div>`;
}

/** The three buttons over the field: menu, music, close. */
function toolsHtml({ musicOn = true } = {}) {
    return `<div class="rr-tools">
        <button type="button" class="rr-btn" data-rr-menu aria-label="Menu" title="Menu"><i class="fas fa-bars" aria-hidden="true"></i></button>
        <button type="button" class="rr-btn rr-music${musicOn ? '' : ' is-off'}" data-rr-music aria-pressed="${musicOn}" aria-label="Battle music" title="Battle music"><i class="fas fa-music" aria-hidden="true"></i></button>
        <button type="button" class="rr-btn" data-rr-close aria-label="Close" title="Close (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>
    </div>`;
}

/** Every hero of the featured class by name, with their hero class; the ones who struck are lit. */
export function rosterHtml(roster = [], phase = 'active', tier = 'mid') {
    if (!roster.length) return '';
    const struck = roster.filter((h) => h.stars > 0).length;
    const lead = phase === 'herald' ? `${roster.length} heroes ready`
        : tier === 'young' ? `${struck} of ${roster.length} heroes hit!` : `${struck} of ${roster.length} heroes struck`;
    return `<div class="rr-roster">
        <p class="rr-roster__lead">${esc(lead)}</p>
        <ul class="rr-roster__list${roster.length > 18 ? ' is-many' : ''}">${roster.map((h) => {
            const art = h.heroClass ? heroArt(h.heroClass) : null;
            const tip = `${h.fullName || h.name}${art && art !== STAR_ART ? `, ${art.heroClass}` : ''}${h.stars > 0 ? `: ${fmt(h.stars)} ★` : ''}`;
            return `<li class="rr-hero-pill${h.stars > 0 ? ' is-lit' : ''}" title="${esc(tip)}">${art && art !== STAR_ART ? `<span class="rr-hero-pill__art" aria-hidden="true">${art.icon}</span>` : ''}${esc(h.name)}${h.stars > 0 ? `<b>${fmt(h.stars)}</b>` : ''}</li>`;
        }).join('')}</ul>
    </div>`;
}

/** A ring that fills around a class's emblem. */
function ringHtml(fill, logo, art) {
    const r = 26;
    const c = 2 * Math.PI * r;
    return `<span class="rr-ring" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="rr-ring__track"/><circle cx="32" cy="32" r="${r}" class="rr-ring__fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - fill)).toFixed(1)}"/></svg>
        <span class="rr-ring__logo">${esc(logo)}</span>
        <span class="rr-ring__art">${art.icon}</span>
    </span>`;
}

/** The arts a class struck with this raid (from the reasons of its stars), biggest first. */
function classArtsHtml(row) {
    const arts = strikeArts(row.reasons || {}).slice(0, 4);
    if (!arts.length) return '';
    return `<ul class="rr-arts">${arts.map(({ art, stars }) => `<li style="${artStyle(art)}" title="${esc(`${art.art}: ${art.virtue} stars`)}"><span aria-hidden="true">${art.icon}</span>${esc(art.art)}<b>${fmt(stars)}</b></li>`).join('')}</ul>`;
}

/** The class card under the field: who they are, how they fight, their shard, their heroes. */
function classCardHtml(view, row, { heroCard = null, canReveal = false, roster = [], tier = 'mid', count = 1 } = {}) {
    if (!row) return '<section class="rr-dock"></section>';
    const art = classArt(row);
    const fill = Math.min(1, row.pct || 0);
    const phase = view.raid.phase;
    const over = phase === 'aftermath' || phase === 'over';
    let goal;
    if (phase === 'herald') goal = row.share ? `${fmt(row.share)} ★ shard` : caption('away', tier);
    else if (!row.share) goal = caption('away', tier);
    else if (row.valor) goal = row.stars > row.share ? `${caption('valor', tier)} +${fmt(row.stars - row.share)}` : caption('valor', tier);
    else if (over) goal = `${fmt(row.stars)} ★`;
    else goal = tier === 'young' ? `${fmt(Math.max(0, row.share - row.stars))} ★ to go!` : `${fmt(Math.max(0, row.share - row.stars))} ★ to break`;
    const reveal = canReveal ? '<button type="button" class="rr-action" data-rr-reveal><span aria-hidden="true">🏅</span> Reveal our Raid Hero</button>' : '';
    const nav = count > 1;
    return `<section class="rr-dock${row.valor ? ' is-full' : ''}" style="${artStyle(art)}" aria-label="${esc(row.name)}">
        ${nav ? '<button type="button" class="rr-dock__nav" data-rr-step="-1" aria-label="Previous class"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>' : ''}
        <div class="rr-card">
            <div class="rr-card__who">
                ${ringHtml(fill, row.logo, art)}
                <div class="rr-card__id">
                    <h3>${esc(row.name)}</h3>
                    <p><span class="rr-tag">${esc(row.league || 'Class')}</span><span class="rr-card__art" title="${esc(`Most of this class are ${art.heroClass || 'heroes'}`)}">${art.icon} ${esc(art.heroClass ? `${art.heroClass}s` : 'Heroes')}</span></p>
                </div>
            </div>
            <div class="rr-card__shard">
                <p class="rr-card__num"><b>${fmt(row.stars)}</b>${row.share ? `<small>/ ${fmt(row.share)} ★</small>` : '<small>★</small>'}</p>
                <span class="rr-card__bar"><span style="--p:${fill.toFixed(4)}"></span></span>
                <p class="rr-card__goal${row.valor ? ' is-done' : ''}">${row.valor ? '<span aria-hidden="true">✨</span> ' : ''}${esc(goal)}</p>
                ${classArtsHtml(row)}
            </div>
            <div class="rr-card__heroes">
                ${heroCardHtml(heroCard)}
                ${reveal}
                ${rosterHtml(roster, phase, tier)}
            </div>
        </div>
        ${nav ? '<button type="button" class="rr-dock__nav" data-rr-step="1" aria-label="Next class"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>' : ''}
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
    return `<div class="rr-fieldbanner is-round is-${raid.phase === 'herald' ? 'herald' : status.broken ? 'won' : 'held'}"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}

/** One class on the battlefield: its hero (its students' hero class), its banner, its name and gauge. */
function unitHtml(row, spot, { focusId = '', phase = 'active', i = 0 } = {}) {
    const art = classArt(row);
    const fill = Math.min(1, row.pct || 0);
    const away = !row.share;
    const words = `${row.name}, ${art.heroClass ? `${art.heroClass}s` : 'heroes'}: ${fmt(row.stars)}${row.share ? ` of ${fmt(row.share)}` : ''} stars${row.valor ? ', shard broken' : ''}`;
    return `<button type="button" class="rr-unit${row.classId === focusId ? ' is-focus' : ''}${row.valor ? ' is-full' : ''}${away ? ' is-away' : ''}${row.own ? ' is-own' : ''}" data-banner="${esc(row.classId)}"
        style="left:${spot.x}%;top:${spot.y}%;--h:${spot.h};--d:${(spot.y / 100).toFixed(3)};z-index:${spot.z};--i:${i};${artStyle(art)}" aria-label="${esc(words)}" title="${esc(words)}">
        <span class="rr-unit__body">
            <span class="rr-unit__sprite">${heroSpriteSvg(art)}</span>
            <span class="rr-unit__flag" aria-hidden="true">${esc(row.logo)}</span>
            ${row.valor ? '<span class="rr-unit__badge" aria-hidden="true">✨</span>' : ''}
            ${away && phase === 'active' ? `<span class="rr-unit__zz" aria-hidden="true">${esc(caption('away', 'young'))}</span>` : ''}
        </span>
        <span class="rr-unit__name">${esc(row.name)}</span>
        <span class="rr-unit__bar" aria-hidden="true"><span style="--p:${fill.toFixed(4)}"></span></span>
        ${row.classId === focusId ? '<span class="rr-unit__cursor" aria-hidden="true">▼</span>' : ''}
    </button>`;
}

/** The party: every class in the raid, in formation on the left (older leagues in front, nearest Eldhorn). */
function partyHtml(view, focusId) {
    const rows = raidClasses(view).reverse();
    const spots = partyFormation(rows.length, { aspect: 1.5 });
    return `<div class="rr-party${rows.length > 15 ? ' is-many' : ''}${rows.length > 6 ? ' is-crowd' : ''}" aria-label="The party">${rows.map((row, i) => unitHtml(row, spots[i], { focusId, phase: view.raid.phase, i })).join('')}</div>`;
}

const GUILD_LOOK = Object.freeze({
    dragon_flame: { name: 'Dragon Flame', emoji: '🔥', color: '#ef4444' },
    grizzly_might: { name: 'Grizzly Might', emoji: '🐻', color: '#d97706' },
    owl_wisdom: { name: 'Owl Wisdom', emoji: '🦉', color: '#3b82f6' },
    phoenix_rising: { name: 'Phoenix Rising', emoji: '🦅', color: '#ec4899' }
});

/** The menu sheet: this year's raids, the guilds' stars, the hero arts that powered the raid, music, how to play. */
export function menuSheetHtml(view, { year = [], musicOn = true } = {}) {
    const label = { won: 'Won', legendary: 'Legendary', held: 'The shield held', live: 'Now', soon: '' };
    const raids = year.map((y) => {
        const current = y.raidId === view.raid.raidId;
        const date = readDate(y.start)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) || '';
        return `<li><button type="button" class="rr-raidcard is-${esc(y.state)}${current ? ' is-current' : ''}" data-rr-raid="${esc(y.raidId)}"${current ? ' aria-current="true"' : ''}>
            <span class="rr-raidcard__icon" aria-hidden="true">${esc(y.season.emoji)}</span>
            <span class="rr-raidcard__text"><b>${esc(y.season.name)}</b><small>${esc(label[y.state] || date)}</small></span>
            ${y.state === 'won' || y.state === 'legendary' ? `<i class="fas fa-${y.state === 'legendary' ? 'crown' : 'check'}" aria-hidden="true"></i>` : ''}
        </button></li>`;
    }).join('');
    const guildStars = view.guilds || {};
    const gMax = Math.max(1, ...Object.values(guildStars));
    const guilds = Object.entries(GUILD_LOOK).map(([id, g]) => `<li style="--g:${g.color}"><span aria-hidden="true">${g.emoji}</span><b>${esc(g.name)}</b><span class="rr-meter"><span style="--p:${((guildStars[id] || 0) / gMax).toFixed(4)}"></span></span><em>${fmt(guildStars[id] || 0)} ★</em></li>`).join('');
    const school = {};
    view.rows.forEach((row) => Object.entries(row.reasons || {}).forEach(([reason, n]) => { school[reason] = (school[reason] || 0) + n; }));
    const arts = strikeArts(school);
    const aMax = Math.max(1, ...arts.map((a) => a.stars));
    const artRows = arts.length
        ? arts.map(({ art, stars }) => `<li style="${artStyle(art)}"><span aria-hidden="true">${art.icon}</span><b>${esc(art.art)}</b><small>${esc(art.virtue)}</small><span class="rr-meter"><span style="--p:${(stars / aMax).toFixed(4)}"></span></span><em>${fmt(stars)} ★</em></li>`).join('')
        : '<li class="is-empty">No strikes yet.</li>';
    return `<aside class="rr-sheet" role="dialog" aria-modal="true" aria-label="Raid menu">
        <div class="rr-sheet__panel">
            <header class="rr-sheet__head"><h3>${esc(view.raid.season.name)}</h3><button type="button" class="rr-btn" data-rr-menu-close aria-label="Close menu"><i class="fas fa-xmark" aria-hidden="true"></i></button></header>
            ${raids ? `<section><h4>This year</h4><ul class="rr-raidcards">${raids}</ul></section>` : ''}
            <section><h4>Hero arts in this raid</h4><ul class="rr-bars">${artRows}</ul></section>
            <section><h4>Guild banners</h4><ul class="rr-bars rr-bars--guilds">${guilds}</ul></section>
            <section class="rr-sheet__actions">
                <button type="button" class="rr-action rr-action--ghost" data-rr-help><i class="fas fa-circle-question" aria-hidden="true"></i> How the raid works</button>
                <button type="button" class="rr-action rr-action--ghost rr-music${musicOn ? '' : ' is-off'}" data-rr-music aria-pressed="${musicOn}"><i class="fas fa-music" aria-hidden="true"></i> Music</button>
            </section>
        </div>
    </aside>`;
}

/**
 * The Raid Hall. `focusId` is the class on the card (its league sets the words); `heroCard` its
 * Raid Hero; `roster` every hero of it by name; `year` the year's three raids; `intro` plays the
 * opening; `menu` opens the menu sheet.
 */
export function hallHtml(view, { focusId = '', heroCard = null, canReveal = false, lite = false, roster = [], year = [], now = new Date(), intro = false, musicOn = true, menu = false } = {}) {
    const { raid, status } = view;
    const season = raid.season;
    const mood = moodFor(view);
    const focusRow = view.rows.find((r) => r.classId === focusId) || null;
    const tier = wordTier(focusRow?.league);
    const rounds = roundsFor(view);
    const said = bossLine({ phase: raid.phase, mood, broken: status.broken, legendary: status.legendary, guardian: season.guardian, tier }).replace(/^[^:]+: /, '');
    const story = battleMessages({ raid, status, turns: raidTurns(view, now), byDayClass: view.tally?.byDayClass || {}, rows: view.rows, mood, tier, limit: 3 });
    const count = raidClasses(view).length;
    return `<div class="rr-hall rr-hall--${season.id} rr-phase--${raid.phase} rr-mood--${mood} rr-tier--${tier}${status.broken ? ' is-broken' : ''}${status.legendary ? ' is-legendary' : ''}${lite ? ' rr-lite' : ''}${intro ? ' is-intro' : ''}">
        ${skyHtml(season.id, { lite })}
        <h2 class="rr-sr" id="rr-hall-title">Realm Raid: ${esc(season.name)}. ${esc(battleTitle({ raid, status, tier }))}</h2>
        <div class="rr-field">
            ${sceneHtml(season.id, { id: 'rrscene', lite })}
            ${partyHtml(view, focusId)}
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
            <header class="rr-hud">
                ${roadHtml(view, rounds, now, tier)}
                ${bossBarHtml(view, rounds)}
                ${toolsHtml({ musicOn })}
            </header>
        </div>
        ${classCardHtml(view, focusRow, { heroCard, canReveal, roster, tier, count })}
        ${menu ? menuSheetHtml(view, { year, musicOn }) : ''}
        <ol class="rr-sr" aria-live="polite">${story.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>
        ${intro ? `<div class="rr-intro" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<b>${esc(raid.phase === 'herald' ? battleTitle({ raid, status, tier }) : `${season.guardian}!`)}</b></div>` : ''}
    </div>`;
}

/** "How the raid works": three steps, the hero arts (every star belongs to a hero class), the treasure. */
export function howItWorksHtml(view) {
    const season = view?.raid?.season;
    const r = RAID_REWARDS;
    const step = (n, icon, big, small) => `<li class="rr-step"><span class="rr-step__n">${n}</span><span class="rr-step__icon" aria-hidden="true">${icon}</span><b>${big}</b><small>${small}</small></li>`;
    const arts = [...Object.values(HERO_ARTS), STAR_ART].map((art) => `<li style="${artStyle(art)}"><span class="rr-help__arti" aria-hidden="true">${art.icon}</span><b>${esc(art.art)}</b><small>${esc(art.heroClass ? `${art.heroClass} · ${art.virtue}` : art.virtue)}</small></li>`).join('');
    return `<div class="rr-help" role="dialog" aria-modal="true" aria-labelledby="rr-help-title">
        <div class="rr-help__card">
            <button type="button" class="rr-btn rr-help__close" data-rr-help-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <h3 id="rr-help-title">How the raid works</h3>
            <ol class="rr-steps">
                ${step(1, '⭐', 'Earn stars', 'in any lesson, Monday to Friday')}
                ${step(2, '⚔️', 'Every star strikes', `${esc(season?.guardian || 'Eldhorn')}'s shield`)}
                ${step(3, '🛡️', 'Break it together', 'the whole school is one party')}
            </ol>
            <h4>Every star is a hero art</h4>
            <ul class="rr-help__arts">${arts}</ul>
            <h4>Treasure</h4>
            <ul class="rr-help__loot">
                <li><span aria-hidden="true">✨</span><b>Valor</b><small>your class breaks its own shard: +${r.valorGold} Gold each</small></li>
                <li><span aria-hidden="true">🛡️</span><b>Victory</b><small>+${r.victoryGold} Gold each, a Team Quest map step, a festival treasure for each Raid Hero</small></li>
                <li><span aria-hidden="true">👑</span><b>Legendary</b><small>${Math.round(LEGENDARY_AT * 100)}% of the shield: +${r.legendaryGold} Gold more, another map step</small></li>
            </ul>
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
    const rows = raidClasses(view);
    if (!rows.length) return '';
    return `<ul class="rr-vparty${rows.length > 12 ? ' is-many' : ''}" aria-label="The party">${rows.map((row, i) => {
        const art = classArt(row);
        return `<li style="--i:${i};${artStyle(art)}"><span class="rr-vparty__sprite" aria-hidden="true">${heroSpriteSvg(art)}<i>${esc(row.logo)}</i></span><b>${esc(row.name)}</b></li>`;
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
    const art = row ? classArt(row) : null;
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
            ${row && row.share ? `<p class="rr-qc__mine">${esc(row.logo)} <b>${esc(row.name)}</b> · ${art.icon} ${esc(art.heroClass ? `${art.heroClass}s` : art.art)} · ${row.valor ? 'shard broken!' : `${fmt(row.stars)} / ${fmt(row.share)} ★`}</p>` : ''}
        </div>
    </div>`;
}
