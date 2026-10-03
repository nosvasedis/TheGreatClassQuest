// /ui/modals/guildHeroes.js — the Guild Spotlight: one guild's month, heroes, Crown Road and Wheel finds

import { getGuildHeroAnalytics } from '../../features/guildHeroAnalytics.js';
import { getCrownRoadKeys } from '../../features/guildScoring.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { CHAPTER_CROWNS, UNITY_SEAL, chapterDaysLeft, chapterName, chapterShortName } from '../../features/guildScoringCore.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { hideModal, showAnimatedModal } from './base.js';
import * as state from '../../state.js';
import { GLORY_EMOJI } from '../../constants.js';

const VIEWS = [
    ['month', '🗓️', 'This month'],
    ['heroes', '⚔️', 'Heroes'],
    ['road', '👑', 'Crown Road'],
    ['wheel', '🎡', 'Wheel finds'],
];
const PLACE = ['gold', 'silver', 'bronze', 'iron'];
const RARITY = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic',
    legendary: 'Legendary', mythic: 'Mythic', cursed: 'Twist',
};
const RARITY_RANK = { cursed: 0, common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };

const _lite = (() => { try { return detectLowPowerTier(); } catch { return false; } })();

let _wired = false;
let _selectedGuildId = null;
/** @type {'month'|'heroes'|'road'|'wheel'} */
let _activeView = 'month';
let _unsubscribeRealtime = null;
let _cachedPayload = null;
let _rosterSearch = '';
/** @type {'month'|'year'|'name'|'class'} */
let _rosterSort = 'month';
const _htmlCache = new WeakMap();

// ─── Small helpers ───────────────────────────────────────────────────────────

function _esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const _num = (n) => Number(n || 0).toLocaleString();
const _one = (n) => {
    const v = Math.round((Number(n) || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const _ordinal = (n) => ['1st', '2nd', '3rd', '4th'][Number(n) - 1] || `${n}th`;
const _plural = (n, word, many = `${word}s`) => `${_num(n)} ${Number(n) === 1 ? word : many}`;
/** A small Glory gap, never shown as a bare "0". */
const _gap = (n) => (Number(n) < 0.1 ? 'under 0.1' : _one(n));
const _reduceMotion = () => _lite || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function _setHtml(el, html) {
    if (!el || _htmlCache.get(el) === html) return false;
    _htmlCache.set(el, html);
    el.innerHTML = html;
    return true;
}

function _face(hero, cls = 'gsp-face') {
    const name = hero?.name || '?';
    const initial = String(name).trim().charAt(0).toUpperCase() || '?';
    return hero?.avatar
        ? `<span class="${cls}"><img src="${_esc(hero.avatar)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="${cls} ${cls}--initial">${_esc(initial)}</span>`;
}

function _emblem(guildId, name, cls) {
    const url = getGuildEmblemUrl(guildId);
    const initial = String(name || guildId || '?').trim().charAt(0).toUpperCase();
    return url
        ? `<img src="${url}" alt="" class="${cls}" decoding="async">`
        : `<span class="${cls} ${cls}--initial">${_esc(initial)}</span>`;
}

function _guildVars(guild) {
    return `--g1:${guild.colors.primary};--g2:${guild.colors.secondary};--gg:${guild.colors.glow};`;
}

function _starsFor(glory) {
    return Math.max(1, Math.ceil((Number(glory) || 0) / 2 - 1e-9));
}

function _toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Guild picker and the guild's crest ──────────────────────────────────────

function _guildsHtml(payload) {
    return payload.guilds.map((g) => {
        const active = g.guildId === _selectedGuildId;
        return `
            <button type="button" class="gsp-pick${active ? ' is-active' : ''}" data-guild-switch="${g.guildId}"
                    aria-pressed="${active}" style="${_guildVars(g)}">
                ${_emblem(g.guildId, g.guildName, 'gsp-pick__emblem')}
                <span class="gsp-pick__name">${_esc(g.guildName)}</span>
                <span class="gsp-pick__crowns" title="Crowns this year"><i class="fas fa-crown" aria-hidden="true"></i>${_num(g.totals.crowns)}</span>
            </button>`;
    }).join('');
}

function _heroHtml(payload, guild) {
    const def = getGuildById(guild.guildId) || {};
    const t = guild.totals;
    const rank = guild.comparison.rankByCrowns;
    const anyCrowns = payload.guilds.some((g) => g.totals.crowns > 0);
    const leader = payload.guilds[0];
    let raceLine;
    if (!anyCrowns) raceLine = 'The first Crowns are paid when this month ends';
    else if (rank === 1 && guild.comparison.crownsBehindLeader === 0) {
        const second = payload.guilds[1];
        const lead = second ? t.crowns - second.totals.crowns : 0;
        raceLine = lead > 0 ? `Leading the Crown Race by ${_plural(lead, 'Crown')}` : 'Level at the top of the Crown Race';
    } else {
        const gap = guild.comparison.crownsBehindLeader;
        raceLine = gap > 0 ? `${_plural(gap, 'Crown')} behind ${_esc(leader.guildName)}` : `Level with ${_esc(leader.guildName)} on Crowns`;
    }
    const medal = anyCrowns ? PLACE[rank - 1] || 'iron' : 'none';
    return `
            <div class="gsp-crest" aria-hidden="true">
                <span class="gsp-crest__rays"></span>
                <span class="gsp-crest__ring"></span>
                ${_emblem(guild.guildId, guild.guildName, 'gsp-crest__emblem')}
            </div>
            <div class="gsp-id">
                <span class="gsp-kicker">Guild Spotlight</span>
                <h3 id="gsp-title" class="gsp-name font-title">${_esc(guild.guildName)}</h3>
                ${def.motto ? `<p class="gsp-motto">“${_esc(def.motto)}”</p>` : ''}
                <div class="gsp-chips">
                    <span class="gsp-chip"><i class="fas fa-users" aria-hidden="true"></i>${_plural(t.memberCount, 'member')}</span>
                    ${(def.traits || []).slice(0, 3).map((tr) => `<span class="gsp-chip gsp-chip--trait">${_esc(tr)}</span>`).join('')}
                </div>
            </div>
            <div class="gsp-medal gsp-medal--${medal}">
                <span class="gsp-medal__disc">
                    <small>Crown Race</small>
                    <b>${anyCrowns ? _ordinal(rank) : '—'}</b>
                </span>
                <span class="gsp-medal__crowns"><i class="fas fa-crown" aria-hidden="true"></i>${_num(t.crowns)}</span>
                <span class="gsp-medal__line">${raceLine}</span>
            </div>`;
}

function _tabsHtml() {
    return VIEWS.map(([id, icon, label]) => `
            <button type="button" role="tab" class="gsp-tab${_activeView === id ? ' is-active' : ''}" data-view-switch="${id}"
                    aria-selected="${_activeView === id}" tabindex="${_activeView === id ? 0 : -1}">
                <span class="gsp-tab__icon" aria-hidden="true">${icon}</span>${label}
            </button>`).join('');
}

// ─── This month ──────────────────────────────────────────────────────────────

function _coachLine(payload, guild) {
    const live = guild.race?.live || {};
    const per = Number(live.perMember) || 0;
    const members = guild.totals.memberCount || 0;
    const month = chapterName(live.key) || 'this month';
    if (!members) return 'No heroes in this guild yet.';
    if (per <= 0.0001) return `No Glory yet in ${month}. The very first star puts ${_esc(guild.guildName)} on the board.`;
    const ranked = payload.guilds
        .map((g) => ({ g, per: Number(g.race?.live?.perMember) || 0 }))
        .sort((a, b) => b.per - a.per);
    const i = ranked.findIndex((r) => r.g.guildId === guild.guildId);
    const above = ranked.slice(0, i).reverse().find((r) => r.per > per + 1e-6);
    if (!above) {
        const next = ranked.find((r) => r.g.guildId !== guild.guildId && r.per <= per);
        if (!next || next.per <= 0) return `Out in front for ${month}. Every star keeps the lead safe.`;
        const lead = per - next.per;
        if (lead < 1e-6) return `Level at the top with ${_esc(next.g.guildName)}. One more star breaks the tie!`;
        return `Leading ${month} by <b>${_gap(lead)} ${GLORY_EMOJI}</b> per member, about <b>${_plural(Math.max(1, Math.round((lead * members) / 2)), 'star')}</b> across the guild. Keep going!`;
    }
    const gap = above.per - per;
    const stars = Math.floor((gap * members) / 2 + 1e-9) + 1;
    return `To pass <b>${_esc(above.g.guildName)}</b>: about <b>${_plural(stars, 'more star')}</b> across the guild (${_gap(gap)} ${GLORY_EMOJI} per member).`;
}

function _raceBarsHtml(payload, guild) {
    const rows = payload.guilds
        .map((g) => ({ g, per: Number(g.race?.live?.perMember) || 0, place: g.race?.live?.place || null }))
        .sort((a, b) => b.per - a.per);
    const top = Math.max(0.001, ...rows.map((r) => r.per));
    return `<ol class="gsp-bars">${rows.map((r, i) => `
                <li class="gsp-bar${r.g.guildId === guild.guildId ? ' is-me' : ''}" style="${_guildVars(r.g)}--w:${(r.per / top).toFixed(3)};--i:${i};">
                    <span class="gsp-bar__who">${_emblem(r.g.guildId, r.g.guildName, 'gsp-bar__emblem')}<span>${_esc(r.g.guildName)}</span></span>
                    <span class="gsp-bar__track"><span class="gsp-bar__fill"></span></span>
                    <span class="gsp-bar__val">${_one(r.per)}</span>
                </li>`).join('')}</ol>`;
}

function _gaugeHtml(payload, guild) {
    const live = guild.race?.live || {};
    const per = Number(live.perMember) || 0;
    const top = Math.max(0.001, ...payload.guilds.map((g) => Number(g.race?.live?.perMember) || 0));
    const frac = per > 0 ? Math.max(0.04, Math.min(1, per / top)) : 0;
    const C = 2 * Math.PI * 52;
    const counts = live.counts !== false;
    const place = counts && live.place ? live.place : null;
    let prize;
    if (!counts) prize = '<b>Warm-up</b><small>no Crowns this month</small>';
    else if (!place) prize = '<b>—</b><small>no Glory yet this month</small>';
    else prize = `<b>+${_num(live.crowns)} <i class="fas fa-crown" aria-hidden="true"></i></b><small>if the month ended now</small>`;
    return `
                <div class="gsp-gauge" style="--dash:${(C * frac).toFixed(1)};--gap:${C.toFixed(1)};">
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                        <circle class="gsp-gauge__bg" cx="60" cy="60" r="52"></circle>
                        <circle class="gsp-gauge__arc" cx="60" cy="60" r="52"></circle>
                    </svg>
                    <span class="gsp-gauge__mid">
                        <b>${_one(per)}</b>
                        <small>${GLORY_EMOJI} per member</small>
                    </span>
                    ${place ? `<span class="gsp-gauge__place gsp-gauge__place--${PLACE[place - 1]}">${_ordinal(place)}</span>` : ''}
                </div>
                <div class="gsp-prize">${prize}</div>`;
}

function _unityHtml(guild) {
    const live = guild.race?.live || {};
    const heroes = guild.heroesAll;
    const need = Math.max(1, Number(live.unityNeeded) || Math.ceil(heroes.length * UNITY_SEAL.share));
    const have = heroes.filter((h) => h.chapterGlory >= UNITY_SEAL.minGlory - 1e-9).length;
    const sealed = Boolean(live.unity) && live.counts !== false;
    const dots = [...heroes]
        .sort((a, b) => b.chapterGlory - a.chapterGlory || a.name.localeCompare(b.name))
        .map((h, i) => {
            const ready = h.chapterGlory >= UNITY_SEAL.minGlory - 1e-9;
            const p = Math.min(1, h.chapterGlory / UNITY_SEAL.minGlory);
            return `<li class="gsp-dot${ready ? ' is-ready' : ''}" style="--p:${p.toFixed(2)};--i:${i};" title="${_esc(h.name)}: ${_one(h.chapterGlory)} ${GLORY_EMOJI} this month">${_face(h, 'gsp-dot__face')}</li>`;
        }).join('');
    const close = heroes
        .filter((h) => h.chapterGlory < UNITY_SEAL.minGlory - 1e-9)
        .sort((a, b) => b.chapterGlory - a.chapterGlory || a.name.localeCompare(b.name))
        .slice(0, 4);
    const missing = Math.max(0, need - have);
    const lede = sealed
        ? `Sealed! At least ${need} of ${heroes.length} heroes earned ${UNITY_SEAL.minGlory} ${GLORY_EMOJI} this month: <b>+${UNITY_SEAL.crowns} Crown</b>.`
        : missing
            ? `<b>${_plural(missing, 'more hero', 'more heroes')}</b> with ${UNITY_SEAL.minGlory} ${GLORY_EMOJI} (3 stars) this month ${missing === 1 ? 'seals' : 'seal'} <b>+${UNITY_SEAL.crowns} Crown</b>.`
            : `Ready to seal: ${have} of ${heroes.length} heroes have ${UNITY_SEAL.minGlory} ${GLORY_EMOJI}.`;
    return `
            <section class="gsp-panel gsp-unity${sealed ? ' is-sealed' : ''}" style="--i:1;">
                <header class="gsp-panel__head">
                    <h4 class="gsp-panel__title"><span class="gsp-unity__seal" aria-hidden="true">🤝</span>Unity Seal</h4>
                    <span class="gsp-count"><b>${Math.min(have, need)}</b> / ${need}</span>
                </header>
                <div class="gsp-meter"><span style="--w:${Math.min(1, have / need).toFixed(3)}"></span></div>
                <p class="gsp-panel__lede">${lede}</p>
                ${heroes.length ? `<ul class="gsp-dots" aria-label="Who has ${UNITY_SEAL.minGlory} Glory this month">${dots}</ul>` : ''}
                ${!sealed && close.length ? `
                <div class="gsp-almost">
                    <span class="gsp-almost__label">Almost there</span>
                    ${close.map((h) => `<span class="gsp-almost__who">${_face(h, 'gsp-face gsp-face--xs')}${_esc(h.name)}<small>+${_plural(_starsFor(UNITY_SEAL.minGlory - h.chapterGlory), 'star')}</small></span>`).join('')}
                </div>` : ''}
            </section>`;
}

function _podiumHtml(people, { label, value }) {
    if (!people.length) return '';
    const order = [1, 0, 2].filter((i) => people[i]);
    return `<ol class="gsp-podium">${order.map((i) => {
        const p = people[i];
        return `
                <li class="gsp-podium__step gsp-podium__step--${i + 1}" style="--i:${i};">
                    ${i === 0 ? '<span class="gsp-podium__crown" aria-hidden="true">👑</span>' : ''}
                    ${_face(p, 'gsp-face gsp-face--lg')}
                    <span class="gsp-podium__name">${_esc(p.name)}</span>
                    <span class="gsp-podium__val">${value(p)}</span>
                    <span class="gsp-podium__block" aria-label="${label} ${i + 1}"><b>${i + 1}</b></span>
                </li>`;
    }).join('')}</ol>`;
}

function _monthView(payload, guild) {
    const live = guild.race?.live || {};
    const month = chapterName(live.key) || 'This month';
    const days = chapterDaysLeft();
    const stars = [...guild.heroesAll]
        .filter((h) => h.chapterGlory > 0)
        .sort((a, b) => b.chapterGlory - a.chapterGlory || a.name.localeCompare(b.name))
        .slice(0, 3);
    const earning = guild.heroesAll.filter((h) => h.chapterGlory > 0).length;
    return `
        <div class="gsp-grid gsp-grid--month">
            <section class="gsp-panel gsp-race" style="--i:0;">
                <header class="gsp-panel__head">
                    <h4 class="gsp-panel__title">The ${_esc(month)} race</h4>
                    <span class="gsp-pill">${_plural(days, 'day')} left</span>
                </header>
                <div class="gsp-race__top">
                    <div class="gsp-race__gauge">${_gaugeHtml(payload, guild)}</div>
                    ${_raceBarsHtml(payload, guild)}
                </div>
                <p class="gsp-coach"><span aria-hidden="true">🧭</span><span>${_coachLine(payload, guild)}</span></p>
                <p class="gsp-foot">${earning} of ${guild.totals.memberCount} heroes have earned Glory this month · ${_num(Math.round(live.glory || 0))} ${GLORY_EMOJI} in all</p>
            </section>
            <div class="gsp-stack">
                ${_unityHtml(guild)}
                <section class="gsp-panel" style="--i:2;">
                    <header class="gsp-panel__head"><h4 class="gsp-panel__title">Stars of ${_esc(month)}</h4></header>
                    ${stars.length
                        ? _podiumHtml(stars, { label: 'Place', value: (p) => `${_one(p.chapterGlory)} ${GLORY_EMOJI}` })
                        : `<p class="gsp-empty">The first star this month takes the top step.</p>`}
                </section>
            </div>
        </div>`;
}

// ─── Heroes ──────────────────────────────────────────────────────────────────

function _rosterRowsHtml(guild) {
    const q = _rosterSearch.trim().toLowerCase();
    const list = guild.heroesAll.filter((h) => !q || `${h.name} ${h.heroClass} ${h.className}`.toLowerCase().includes(q));
    const sorters = {
        month: (a, b) => b.chapterGlory - a.chapterGlory || b.totalStars - a.totalStars || a.name.localeCompare(b.name),
        year: (a, b) => b.yearGlory - a.yearGlory || b.totalStars - a.totalStars || a.name.localeCompare(b.name),
        name: (a, b) => a.name.localeCompare(b.name),
        class: (a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name),
    };
    list.sort(sorters[_rosterSort] || sorters.month);
    if (!list.length) return `<p class="gsp-empty">${q ? 'No hero by that name.' : 'No heroes in this guild yet.'}</p>`;
    const topMonth = Math.max(UNITY_SEAL.minGlory, ...guild.heroesAll.map((h) => h.chapterGlory));
    const champ = [...guild.heroesAll].sort(sorters.month)[0];
    const legend = [...guild.heroesAll].sort(sorters.year)[0];
    return list.map((h, i) => {
        const badges = [];
        if (champ && champ.chapterGlory > 0 && champ.studentId === h.studentId) badges.push('<span class="gsp-badge gsp-badge--star">🌟 Star of the month</span>');
        if (legend && legend.yearGlory > 0 && legend.studentId === h.studentId) badges.push('<span class="gsp-badge gsp-badge--legend">🏅 Legend</span>');
        if (h.chapterGlory >= UNITY_SEAL.minGlory - 1e-9) badges.push('<span class="gsp-badge gsp-badge--unity">🤝 Seal-ready</span>');
        return `
                <li class="gsp-row" style="--i:${Math.min(i, 12)};">
                    <span class="gsp-row__n">${i + 1}</span>
                    ${_face(h)}
                    <span class="gsp-row__who">
                        <b>${_esc(h.name)}</b>
                        <small>${_esc(h.className)}${h.heroClass ? ` · ${_esc(h.heroClass)}` : ''}</small>
                        ${badges.length ? `<span class="gsp-row__badges">${badges.join('')}</span>` : ''}
                    </span>
                    <span class="gsp-row__month">
                        <span class="gsp-row__meter"><span style="--w:${Math.min(1, h.chapterGlory / topMonth).toFixed(3)}"></span>${h.chapterGlory >= UNITY_SEAL.minGlory - 1e-9 ? '' : `<i style="--at:${(UNITY_SEAL.minGlory / topMonth).toFixed(3)}" title="Unity Seal line"></i>`}</span>
                        <b>${_one(h.chapterGlory)} ${GLORY_EMOJI}</b><small>this month</small>
                    </span>
                    <span class="gsp-row__year"><b>${_num(h.totalStars)}</b><small>⭐ this year</small></span>
                </li>`;
    }).join('');
}

function _heroesView(guild) {
    const legends = [...guild.heroesAll]
        .filter((h) => h.yearGlory > 0 || h.totalStars > 0)
        .sort((a, b) => b.yearGlory - a.yearGlory || b.totalStars - a.totalStars || a.name.localeCompare(b.name))
        .slice(0, 3);
    const classes = guild.breakdown.classContributions.filter((c) => c.totalStars > 0).slice(0, 6);
    const classTop = Math.max(1, ...classes.map((c) => c.totalStars));
    const sorts = [['month', 'This month'], ['year', 'This year'], ['name', 'A–Z'], ['class', 'Class']];
    return `
        <div class="gsp-grid gsp-grid--heroes">
            <div class="gsp-stack">
                <section class="gsp-panel" style="--i:0;">
                    <header class="gsp-panel__head"><h4 class="gsp-panel__title">Legends of the year</h4></header>
                    ${legends.length
                        ? _podiumHtml(legends, { label: 'Legend', value: (p) => `${_num(Math.round(p.yearGlory))} ${GLORY_EMOJI}` })
                        : '<p class="gsp-empty">No Glory earned yet this year.</p>'}
                </section>
                <section class="gsp-panel" style="--i:1;">
                    <header class="gsp-panel__head"><h4 class="gsp-panel__title">Where the stars come from</h4></header>
                    ${classes.length ? `<ul class="gsp-classes">${classes.map((c, i) => `
                        <li style="--w:${(c.totalStars / classTop).toFixed(3)};--i:${i};">
                            <span class="gsp-classes__name">${_esc(c.className)}</span>
                            <span class="gsp-classes__track"><span></span></span>
                            <span class="gsp-classes__val">${_num(c.totalStars)} ⭐</span>
                        </li>`).join('')}</ul>` : '<p class="gsp-empty">Class shares appear once heroes earn stars.</p>'}
                </section>
            </div>
            <section class="gsp-panel gsp-roster" style="--i:2;">
                <header class="gsp-panel__head gsp-roster__head">
                    <h4 class="gsp-panel__title">Every hero <span class="gsp-count">${guild.heroesAll.length}</span></h4>
                    <label class="gsp-search"><i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                        <input type="search" value="${_esc(_rosterSearch)}" placeholder="Find a hero…" data-roster-search="true" aria-label="Find a hero">
                    </label>
                </header>
                <div class="gsp-sorts" role="group" aria-label="Sort heroes">
                    ${sorts.map(([id, label]) => `<button type="button" class="gsp-sort${_rosterSort === id ? ' is-active' : ''}" data-roster-sort="${id}" aria-pressed="${_rosterSort === id}">${label}</button>`).join('')}
                </div>
                <ol class="gsp-rows" id="gsp-roster-list">${_rosterRowsHtml(guild)}</ol>
            </section>
        </div>`;
}

// ─── Crown Road ──────────────────────────────────────────────────────────────

function _roadView(payload, guild) {
    const race = guild.race || {};
    const keys = getCrownRoadKeys();
    const sealed = new Map((race.chapters || []).map((c) => [c.key, c]));
    const liveKey = race.live?.key;
    const counts = race.live?.counts !== false;
    const stones = keys.map((k, i) => {
        const c = sealed.get(k);
        if (c) {
            const p = Number(c.place) || 0;
            return `
                <li class="gsp-stone is-sealed is-${p ? PLACE[p - 1] : 'empty'}${c.unity ? ' has-unity' : ''}" style="--i:${i};">
                    <span class="gsp-stone__gem">${p === 1 ? '<i class="fas fa-crown gsp-stone__crown" aria-hidden="true"></i>' : ''}<b>${c.crowns ? `+${c.crowns}` : '·'}</b></span>
                    <span class="gsp-stone__month">${chapterShortName(k)}</span>
                    <span class="gsp-stone__note">${p ? _ordinal(p) : 'no Glory'}${c.unity ? ' · 🤝' : ''}</span>
                </li>`;
        }
        if (k === liveKey) {
            const now = counts ? Number(race.live?.crowns) || 0 : 0;
            return `
                <li class="gsp-stone is-live" style="--i:${i};">
                    <span class="gsp-stone__gem"><b>${now ? `+${now}` : '…'}</b></span>
                    <span class="gsp-stone__month">${chapterShortName(k)}</span>
                    <span class="gsp-stone__note">${counts ? 'racing now' : 'warm-up'}</span>
                </li>`;
        }
        return `
                <li class="gsp-stone is-future" style="--i:${i};">
                    <span class="gsp-stone__gem"><b>?</b></span>
                    <span class="gsp-stone__month">${chapterShortName(k)}</span>
                    <span class="gsp-stone__note">&nbsp;</span>
                </li>`;
    }).join('');

    const wins = (race.chapterWins || []).map(chapterName);
    const seals = (race.chapters || []).filter((c) => c.unity).length;
    const top = Math.max(1, ...payload.guilds.map((g) => g.totals.crowns));
    const left = keys.filter((k) => !sealed.has(k)).length;
    const leader = payload.guilds[0];
    const gap = guild.comparison.crownsBehindLeader;
    const tip = !payload.guilds.some((g) => g.totals.crowns > 0)
        ? `No Crowns yet. The first ones are paid when ${_esc(chapterName(liveKey) || 'this month')} ends.`
        : gap > 0
            ? `${_plural(gap, 'Crown')} behind ${_esc(leader.guildName)}, with ${_plural(left, 'month')} still to race. A month win pays ${CHAPTER_CROWNS[0]}.`
            : `On top of the Crown Race with ${_plural(left, 'month')} still to race. Win months to stay there!`;

    return `
        <div class="gsp-road-wrap">
            <section class="gsp-panel gsp-road" style="--i:0;">
                <header class="gsp-panel__head">
                    <h4 class="gsp-panel__title">The Crown Road</h4>
                    <span class="gsp-pill">${CHAPTER_CROWNS.map((c, i) => `${['🥇', '🥈', '🥉', '4th'][i]} ${c}`).join(' · ')} · 🤝 +${UNITY_SEAL.crowns}</span>
                </header>
                <ol class="gsp-stones" style="--n:${Math.max(1, keys.length)};">${stones}</ol>
            </section>
            <div class="gsp-tiles">
                <div class="gsp-tile" style="--i:1;"><span class="gsp-tile__icon">👑</span><b>${_num(guild.totals.crowns)}</b><small>Crowns</small></div>
                <div class="gsp-tile" style="--i:2;"><span class="gsp-tile__icon">🏆</span><b>${wins.length}</b><small>${wins.length ? _esc(wins.join(', ')) : 'months won'}</small></div>
                <div class="gsp-tile" style="--i:3;"><span class="gsp-tile__icon">🤝</span><b>${seals}</b><small>Unity Seals</small></div>
                <div class="gsp-tile" style="--i:4;"><span class="gsp-tile__icon">${GLORY_EMOJI}</span><b>${_one(guild.totals.yearGloryPerMember)}</b><small>year Glory per member</small></div>
            </div>
            <section class="gsp-panel" style="--i:5;">
                <header class="gsp-panel__head"><h4 class="gsp-panel__title">The Crown Race</h4></header>
                <ol class="gsp-bars gsp-bars--crowns">${payload.guilds.map((g, i) => `
                    <li class="gsp-bar${g.guildId === guild.guildId ? ' is-me' : ''}" style="${_guildVars(g)}--w:${(g.totals.crowns / top).toFixed(3)};--i:${i};">
                        <span class="gsp-bar__who">${_emblem(g.guildId, g.guildName, 'gsp-bar__emblem')}<span>${_esc(g.guildName)}</span></span>
                        <span class="gsp-bar__track"><span class="gsp-bar__fill"></span></span>
                        <span class="gsp-bar__val"><i class="fas fa-crown" aria-hidden="true"></i> ${_num(g.totals.crowns)}</span>
                    </li>`).join('')}</ol>
                <p class="gsp-coach"><span aria-hidden="true">🧭</span><span>${tip}</span></p>
            </section>
        </div>`;
}

// ─── Wheel finds ─────────────────────────────────────────────────────────────

function _wheelView(guild) {
    const classNames = new Map((state.get('allSchoolClasses') || []).map((c) => [c.id, c.name]));
    const finds = (state.get('fortuneWheelLog') || []).flatMap((entry) => {
        const at = _toDate(entry.spunAt);
        return (Array.isArray(entry.results) ? entry.results : [])
            .filter((r) => r?.guildId === guild.guildId)
            .map((r) => ({ ...r, at, className: classNames.get(entry.classId) || '' }));
    });
    if (!finds.length) {
        return `
        <section class="gsp-panel gsp-wheel-empty" style="--i:0;">
            <span class="gsp-wheel-empty__icon" aria-hidden="true">🎡</span>
            <h4 class="gsp-panel__title">No Wheel finds yet</h4>
            <p class="gsp-panel__lede">When a class spins Fortune’s Wheel in its last lesson of the week, ${_esc(guild.guildName)}’s treasures land here.</p>
        </section>`;
    }
    const sum = (k) => finds.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const best = [...finds].sort((a, b) => (RARITY_RANK[b.rarity] ?? 1) - (RARITY_RANK[a.rarity] ?? 1) || (Number(b.gloryDelta) || 0) - (Number(a.gloryDelta) || 0))[0];
    const split = (label) => {
        const m = String(label || '').match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
        return m ? [m[1], m[2]] : ['✨', String(label || 'A spin')];
    };
    const chips = (r) => {
        const out = [];
        if (Number(r.gloryDelta) > 0) out.push(`<span class="gsp-gift gsp-gift--glory">+${_num(r.gloryDelta)} ${GLORY_EMOJI}</span>`);
        if (Number(r.starsDelta) > 0) out.push(`<span class="gsp-gift">+${_num(r.starsDelta)} ⭐</span>`);
        if (Number(r.goldDelta) > 0) out.push(`<span class="gsp-gift">+${_num(r.goldDelta)} 🪙</span>`);
        if (Number(r.artifactsGranted) > 0) out.push(`<span class="gsp-gift">${_plural(r.artifactsGranted, 'artifact')} 🎁</span>`);
        if (Number(r.classQuestDelta) > 0) out.push(`<span class="gsp-gift">+${_num(r.classQuestDelta)} Team Quest ⭐</span>`);
        if (!out.length) out.push(`<span class="gsp-gift gsp-gift--quiet">${r.rarity === 'cursed' ? 'A harmless trick' : 'A little magic'}</span>`);
        return out.join('');
    };
    const [bestIcon, bestName] = split(best.segmentLabel);
    return `
        <div class="gsp-wheel">
            <div class="gsp-tiles">
                <div class="gsp-tile" style="--i:0;"><span class="gsp-tile__icon">🎡</span><b>${finds.length}</b><small>recent spins</small></div>
                <div class="gsp-tile" style="--i:1;"><span class="gsp-tile__icon">${GLORY_EMOJI}</span><b>+${_num(sum('gloryDelta'))}</b><small>Glory found</small></div>
                <div class="gsp-tile" style="--i:2;"><span class="gsp-tile__icon">⭐</span><b>+${_num(sum('starsDelta'))}</b><small>stars</small></div>
                <div class="gsp-tile" style="--i:3;"><span class="gsp-tile__icon">🪙</span><b>+${_num(sum('goldDelta'))}</b><small>gold</small></div>
            </div>
            <section class="gsp-best gsp-rarity--${_esc(best.rarity || 'common')}" style="--i:4;">
                <span class="gsp-best__icon" aria-hidden="true">${bestIcon}</span>
                <span class="gsp-best__text">
                    <small>Best find</small>
                    <b>${_esc(bestName)}</b>
                    <span class="gsp-best__gifts">${chips(best)}</span>
                </span>
                <span class="gsp-rarity">${RARITY[best.rarity] || 'Find'}</span>
            </section>
            <ol class="gsp-finds">${finds.slice(0, 12).map((r, i) => {
                const [icon, name] = split(r.segmentLabel);
                const when = r.at ? r.at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
                return `
                <li class="gsp-find gsp-rarity--${_esc(r.rarity || 'common')}" style="--i:${Math.min(i + 5, 14)};">
                    <span class="gsp-find__icon" aria-hidden="true">${icon}</span>
                    <span class="gsp-find__text">
                        <b>${_esc(name)}${r.favored ? ' <span class="gsp-favor" title="Gilded by Fortune’s Favor">✨</span>' : ''}</b>
                        <small>${[when, r.className].filter(Boolean).map(_esc).join(' · ')}</small>
                    </span>
                    <span class="gsp-find__gifts">${chips(r)}</span>
                    <span class="gsp-rarity">${RARITY[r.rarity] || ''}</span>
                </li>`;
            }).join('')}</ol>
        </div>`;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function _renderAll(payload, { animate = false } = {}) {
    const card = document.getElementById('guild-heroes-card');
    if (!card || !payload?.guilds?.length) return;
    if (!payload.guilds.find((g) => g.guildId === _selectedGuildId)) _selectedGuildId = payload.guilds[0].guildId;
    const guild = payload.guilds.find((g) => g.guildId === _selectedGuildId);

    card.classList.toggle('gsp--lite', _lite);
    card.classList.toggle('gsp--still', !animate);
    card.setAttribute('style', _guildVars(guild));
    card.dataset.view = _activeView;

    _setHtml(document.getElementById('gsp-guilds'), _guildsHtml(payload));
    _setHtml(document.getElementById('gsp-hero'), _heroHtml(payload, guild));
    _setHtml(document.getElementById('gsp-tabs'), _tabsHtml());

    let body = '';
    if (_activeView === 'heroes') body = _heroesView(guild);
    else if (_activeView === 'road') body = _roadView(payload, guild);
    else if (_activeView === 'wheel') body = _wheelView(guild);
    else body = _monthView(payload, guild);
    const bodyEl = document.getElementById('gsp-body');
    if (animate && bodyEl) _htmlCache.delete(bodyEl);
    _setHtml(bodyEl, `<div class="gsp-view gsp-view--${_activeView}" data-guild="${guild.guildId}">${body}</div>`);

    if (animate && !_reduceMotion()) {
        card.classList.remove('is-switching');
        void card.offsetWidth;
        card.classList.add('is-switching');
    }
}

function _rerender(opts) {
    _renderAll(_cachedPayload || (_cachedPayload = getGuildHeroAnalytics()), opts);
}

function _startRealtime() {
    _stopRealtime();
    _unsubscribeRealtime = state.subscribe(
        ['allGuildScores', 'allStudents', 'allStudentScores', 'guildChampions', 'fortuneWheelLog', 'allSchoolClasses'],
        () => {
            const m = document.getElementById('guild-heroes-modal');
            if (!m || m.classList.contains('hidden')) return;
            // Keep a hero search box focused: only its list is patched while someone types.
            if (document.activeElement?.matches?.('[data-roster-search]')) {
                _cachedPayload = getGuildHeroAnalytics();
                const guild = _cachedPayload.guilds.find((g) => g.guildId === _selectedGuildId);
                if (guild) _setHtml(document.getElementById('gsp-roster-list'), _rosterRowsHtml(guild));
                return;
            }
            _cachedPayload = getGuildHeroAnalytics();
            _renderAll(_cachedPayload);
        }
    );
}

function _stopRealtime() {
    if (!_unsubscribeRealtime) return;
    try { _unsubscribeRealtime(); } catch (_) { }
    _unsubscribeRealtime = null;
}

function _wireListeners() {
    const modal = document.getElementById('guild-heroes-modal');
    if (!modal || _wired) return;
    _wired = true;

    document.getElementById('guild-heroes-close-btn')?.addEventListener('click', () => hideModal('guild-heroes-modal'));
    document.getElementById('guild-heroes-overlay-bg')?.addEventListener('click', () => hideModal('guild-heroes-modal'));

    modal.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const guildBtn = t.closest('[data-guild-switch]');
        if (guildBtn) {
            if (guildBtn.dataset.guildSwitch === _selectedGuildId) return;
            _selectedGuildId = guildBtn.dataset.guildSwitch;
            _rosterSearch = '';
            _rerender({ animate: true });
            return;
        }
        const viewBtn = t.closest('[data-view-switch]');
        if (viewBtn) {
            if (viewBtn.dataset.viewSwitch === _activeView) return;
            _activeView = /** @type {typeof _activeView} */ (viewBtn.dataset.viewSwitch || 'month');
            _rerender({ animate: true });
            return;
        }
        const sortBtn = t.closest('[data-roster-sort]');
        if (sortBtn) {
            _rosterSort = /** @type {typeof _rosterSort} */ (sortBtn.dataset.rosterSort || 'month');
            modal.querySelectorAll('[data-roster-sort]').forEach((b) => {
                const on = b === sortBtn;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-pressed', String(on));
            });
            const guild = (_cachedPayload || getGuildHeroAnalytics()).guilds.find((g) => g.guildId === _selectedGuildId);
            if (guild) _setHtml(document.getElementById('gsp-roster-list'), _rosterRowsHtml(guild));
        }
    });

    modal.addEventListener('input', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || t.dataset.rosterSearch !== 'true') return;
        _rosterSearch = t.value || '';
        const guild = (_cachedPayload || getGuildHeroAnalytics()).guilds.find((g) => g.guildId === _selectedGuildId);
        if (guild) _setHtml(document.getElementById('gsp-roster-list'), _rosterRowsHtml(guild));
    });

    modal.addEventListener('keydown', (e) => {
        const t = e.target;
        if (!(t instanceof Element) || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const tab = t.closest('[data-view-switch]');
        if (!tab) return;
        const i = VIEWS.findIndex(([id]) => id === _activeView);
        const next = VIEWS[(i + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length][0];
        _activeView = /** @type {typeof _activeView} */ (next);
        _rerender({ animate: true });
        modal.querySelector(`[data-view-switch="${next}"]`)?.focus();
        e.preventDefault();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || modal.classList.contains('hidden')) return;
        hideModal('guild-heroes-modal');
    });

    new MutationObserver(() => {
        if (modal.classList.contains('hidden')) _stopRealtime();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
}

export function openGuildHeroesModal(initialGuildId) {
    _wireListeners();
    _cachedPayload = getGuildHeroAnalytics();
    _selectedGuildId = initialGuildId || _cachedPayload.guilds[0]?.guildId || null;
    _activeView = 'month';
    _rosterSearch = '';
    _rosterSort = 'month';
    _renderAll(_cachedPayload, { animate: true });
    showAnimatedModal('guild-heroes-modal');
    _startRealtime();
}
