/**
 * The Chronicle on Home (class view): the pages that join Homework and the Adventure Log.
 *   Top row:    Homework · Training Grounds · Adventure Log
 *   Bottom row: three "fresh pages", picked from what is really happening in the class:
 *               a Starfall waiting, Ember Oaths, Hero Seals this week, the Quiet Dragon,
 *               and the Mystic Market's festival stall.
 * Nothing here repeats Home's other cards (stars, goal, virtues, roll call, teams, duels).
 * Training Grounds bonus stars are only described as bonus stars, never as today's stars.
 * Every hero who earned a seal is named when the page is open: nobody hides behind "+N".
 *
 * Pure (no DOM, no state); the caller gathers the facts. Markup classes are `chx-*`
 * (styles/home_chronicle_pages.css), shared by desktop Home and phone Home.
 * Covered by tests/home-chronicle-pages.test.mjs.
 */

import { TRAINING_GAMES, TRAINING_GAME_KEYS, knotsTied, normalizeGameState } from './trainingGroundsCore.mjs';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const DAY_MS = 86400000;
const listOr = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

export const LOWER_PAGE_COUNT = 3;

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value === 'number') return new Date(value);
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return null;
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const shortDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function whenLabel(d, now) {
    const days = Math.round((dayStart(now) - dayStart(d)) / DAY_MS);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
    return shortDay(d);
}

function knotsHtml(tied) {
    return `<span class="chx-knots" aria-label="${tied} of 2 knots tied">${[0, 1].map((i) => `<i class="${i < tied ? 'is-tied' : ''}"></i>`).join('')}</span>`;
}

// ─── Training Grounds (top row, middle) ─────────────────────────────────────

/**
 * All four Training Grounds games: rounds won, the knots toward the next bonus star,
 * and the last day each was won. The Story Weavers word and sentence ride along.
 * @param {{ story?: object, games?: object, now?: Date }} facts
 *   story: the class's story_data doc; games: classData.trainingGrounds.
 */
export function buildTrainingPage({ story = null, games = {}, now = new Date() } = {}) {
    const tiles = TRAINING_GAME_KEYS.map((key) => {
        const game = TRAINING_GAMES[key];
        if (key === 'story') {
            const rounds = Math.max(0, Math.floor(Number(story?.storyAdditionsCount) || 0));
            const last = toDate(story?.updatedAt || story?.lastUpdated);
            return { game, rounds, last };
        }
        const saved = normalizeGameState(key, games?.[key]);
        const won = saved.log.filter((e) => e?.ok).map((e) => toDate(e.date)).filter(Boolean).sort((a, b) => b - a);
        return { game, rounds: saved.rounds, last: won[0] || toDate(saved.lastCountedDate) };
    });
    const played = tiles.filter((t) => t.rounds > 0);
    const nearStar = tiles.filter((t) => knotsTied(t.rounds) === 1).map((t) => t.game.short);
    const totalRounds = tiles.reduce((sum, t) => sum + t.rounds, 0);

    const grid = `<span class="chx-games">${tiles.map((t) => `
        <span class="chx-game chx-game--${t.game.key}${t.rounds ? '' : ' is-new'}" title="${esc(t.game.name)} · ${esc(t.game.skillLabel)}">
            <span class="chx-game__emoji" aria-hidden="true">${t.game.emoji}</span>
            <span class="chx-game__name">${esc(t.game.short)}</span>
            ${knotsHtml(knotsTied(t.rounds))}
        </span>`).join('')}</span>`;

    let line;
    if (nearStar.length) line = `One more win in <b>${esc(listOr(nearStar))}</b> earns a bonus star.`;
    else if (!played.length) line = 'Four games are ready to play. Two won rounds earn a bonus star.';
    else line = `${plural(totalRounds, 'round', 'rounds')} won so far. Two knots bring a bonus star.`;

    const rows = tiles.map((t) => `
        <li class="chx-row chx-row--${t.game.key}">
            <span class="chx-row__emoji" aria-hidden="true">${t.game.emoji}</span>
            <span class="chx-row__text"><b>${esc(t.game.name)}</b><small>${esc(t.game.skillLabel)} · ${t.rounds ? `${plural(t.rounds, 'round', 'rounds')} won${t.last ? `, last win ${esc(whenLabel(t.last, now))}` : ''}` : 'not played yet'}</small></span>
            ${knotsHtml(knotsTied(t.rounds))}
        </li>`).join('');
    const storyLine = story?.currentSentence
        ? `<p class="chx-story"><span>Story${story.currentWord ? ` · <em>${esc(story.currentWord)}</em>` : ''}</span>“…${esc(story.currentSentence)}…”</p>`
        : '';

    return {
        kind: 'training',
        icon: 'fa-bullseye',
        kicker: 'Training Grounds',
        empty: !played.length,
        summary: `${grid}<span class="chx-line">${line}</span>`,
        detail: `<ul class="chx-rows">${rows}</ul>${storyLine}`,
        open: { tab: 'reward-ideas-tab', label: 'Training Grounds' }
    };
}

// ─── Bottom row candidates ──────────────────────────────────────────────────

/** Stars marked at home that fall in the next lesson. */
export function buildStarfallPage({ waiting = [], names = {} } = {}) {
    if (!Array.isArray(waiting) || !waiting.length) return null;
    const stars = waiting.reduce((sum, e) => sum + (Number(e?.bonusAmount) || 0.5), 0);
    const ids = [...new Set(waiting.map((e) => e?.studentId).filter(Boolean))];
    const heroes = ids.map((id) => firstName(names[id])).filter(Boolean);
    const shown = stars % 1 ? stars.toFixed(1) : String(stars);
    return {
        kind: 'starfall',
        icon: 'fa-meteor',
        kicker: 'Starfall waiting',
        real: true,
        summary: `<span class="chx-big"><b>${shown}</b> ${stars === 1 ? 'star' : 'stars'}</span><span class="chx-line">for ${plural(ids.length, 'hero', 'heroes')}. They fall in the lesson.</span>`,
        detail: heroes.length ? `<p class="chx-line">Marked at home from tests and dictations, they wait in the sky until the class is here to see them fall.</p><p class="chx-label">Who will catch them</p><p class="chx-names">${heroes.map((n) => `<span>${esc(n)}</span>`).join('')}</p>` : '',
        open: { tab: 'scholars-scroll-tab', label: "Scholar's Scroll" }
    };
}

/**
 * Ember Oaths of the class: promises still burning, ready to keep, and kept this month.
 * Counts only, never who promised what (the board is one tap away for the teacher).
 */
export function buildOathsPage({ oaths = null, readyIds = [], now = new Date() } = {}) {
    if (!Array.isArray(oaths)) return null;
    const burning = oaths.filter((o) => o.status === 'active').length;
    const ready = new Set(readyIds).size;
    const kept = oaths.filter((o) => {
        if (o.status !== 'kept') return false;
        const d = toDate(o.keptAt || o.updatedAt);
        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const real = burning > 0 || kept > 0;
    const embers = Math.min(kept, 12);
    let line;
    if (ready) line = `<b>${plural(ready, 'promise is', 'promises are')}</b> ready to keep. Open the Oath Board to celebrate ${ready === 1 ? 'it' : 'them'}.`;
    else if (burning) line = `${plural(burning, 'promise is', 'promises are')} still burning. ${kept ? `${kept} kept this month.` : 'Check in at the next Campfire.'}`;
    else if (kept) line = `Every promise this month is kept. A new one can be lit at the Campfire.`;
    else line = 'No promises burning yet. Light the first one at the Hero Campfire.';
    return {
        kind: 'oaths',
        icon: 'fa-fire-alt',
        kicker: 'Ember Oaths',
        real,
        empty: !real,
        summary: `<span class="chx-tallies">
                <span class="chx-tally chx-tally--burn"><b>${burning}</b><small>burning</small></span>
                <span class="chx-tally chx-tally--ready${ready ? ' is-lit' : ''}"><b>${ready}</b><small>ready</small></span>
                <span class="chx-tally chx-tally--kept"><b>${kept}</b><small>kept</small></span>
            </span><span class="chx-line">${line}</span>`,
        detail: kept ? `<p class="chx-embers" aria-hidden="true">${Array.from({ length: embers }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</p>` : '',
        open: { action: 'oaths', label: 'Oath Board' }
    };
}

/**
 * Hero Seals pressed in the last 7 days.
 * @param {{ presses: { name: string, seal: { name: string, icon: string, tint: string }, at: number }[] }} facts
 */
export function buildSealsPage({ presses = [], now = new Date() } = {}) {
    const list = (presses || []).filter((p) => p?.seal && p.at && now - p.at <= 7 * DAY_MS && p.at <= now.getTime() + DAY_MS)
        .sort((a, b) => b.at - a.at);
    const chips = list.slice(0, 4).map((p) => `<span class="chx-seal" style="--seal:${esc(p.seal.tint || p.seal.color || '#7c3aed')}" title="${esc(p.seal.name)}"><i class="fas ${esc(p.seal.icon || 'fa-stamp')}" aria-hidden="true"></i></span>`).join('');
    const heroes = [...new Set(list.map((p) => firstName(p.name)).filter(Boolean))];
    return {
        kind: 'seals',
        icon: 'fa-stamp',
        kicker: 'Hero Seals',
        real: list.length > 0,
        empty: !list.length,
        summary: list.length
            ? `<span class="chx-seals">${chips}</span><span class="chx-line"><b>${plural(list.length, 'seal', 'seals')}</b> this week, by ${heroes.length === 1 ? esc(heroes[0]) : plural(heroes.length, 'hero', 'heroes')}.</span>`
            : '<span class="chx-line">No seals pressed this week yet. They press themselves as heroes reach a milestone.</span>',
        detail: list.length
            ? `<ul class="chx-rows">${list.map((p) => `<li class="chx-row"><span class="chx-seal chx-seal--sm" style="--seal:${esc(p.seal.tint || p.seal.color || '#7c3aed')}"><i class="fas ${esc(p.seal.icon || 'fa-stamp')}" aria-hidden="true"></i></span><span class="chx-row__text"><b>${esc(firstName(p.name))}</b><small>${esc(p.seal.name)} · ${esc(whenLabel(new Date(p.at), now))}</small></span></li>`).join('')}</ul>`
            : '',
        open: { action: 'roster', label: 'Class Roster' }
    };
}

/** The Quiet Dragon this week: calm minutes and the last gift from the hoard. */
export function buildDragonPage({ sessions = [], now = new Date() } = {}) {
    const week = (sessions || []).map((s) => ({ ...s, at: toDate(s.at) })).filter((s) => s.at && now - s.at <= 7 * DAY_MS)
        .sort((a, b) => b.at - a.at);
    const minutes = week.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    const last = week[0];
    return {
        kind: 'dragon',
        icon: 'fa-dragon',
        kicker: 'The Quiet Dragon',
        real: week.length > 0,
        empty: !week.length,
        summary: week.length
            ? `<span class="chx-big"><b>${minutes}</b> calm ${minutes === 1 ? 'minute' : 'minutes'}</span><span class="chx-line">this week, last ${esc(whenLabel(last.at, now))}${last.reward ? `. The hoard gave <b>${esc(last.reward)}</b>` : ''}.</span>`
            : '<span class="chx-line">The dragon has not slept this week. Press Q any time the class needs a quiet moment.</span>',
        detail: week.length > 1
            ? `<ul class="chx-rows">${week.map((s) => `<li class="chx-row"><span class="chx-row__emoji" aria-hidden="true">🐉</span><span class="chx-row__text"><b>${plural(Number(s.minutes) || 0, 'minute', 'minutes')}</b><small>${esc(whenLabel(s.at, now))}${s.reward ? ` · ${esc(s.reward)}` : ''}</small></span></li>`).join('')}</ul>`
            : '',
        open: { action: 'quiet-dragon', label: 'Wake the dragon' }
    };
}

const FESTIVAL_EMOJI = { halloween: '🎃', christmas: '🎄', newyear: '🍀', carnival: '🎭', easter: '🐣', mayday: '🌼', endofyear: '🏆' };

/**
 * The Mystic Market's festival stall: open now, or the next one.
 * @param {{ active?: object, next?: { days: number, name: string, tagline: string, id: string } }} facts
 */
export function buildFestivalPage({ active = null, next = null, feastDays = null } = {}) {
    const f = active || next;
    if (!f) return null;
    const emoji = FESTIVAL_EMOJI[f.id] || '🎪';
    const soon = !active && next && next.days <= 30;
    return {
        kind: 'festival',
        icon: 'fa-store',
        kicker: 'Festival Stall',
        real: Boolean(active || soon),
        summary: `<span class="chx-fest"><span class="chx-fest__emoji" aria-hidden="true">${emoji}</span><span><b>${esc(f.name)}</b><small>${active
            ? (feastDays > 0 ? `open now · ${plural(feastDays, 'day', 'days')} to the feast` : 'open now · feast day today!')
            : `stall opens in ${plural(next.days, 'day', 'days')}`}</small></span></span>
            <span class="chx-line">${esc(f.tagline)}.</span>`,
        detail: `<p class="chx-line">${active ? 'Festival treasures sit in the Mystic Market until the feast. Heroes can spend their Gold there.' : 'Heroes who save a little Gold now can shop the festival treasures when the stall opens.'}</p>`,
        open: { tab: 'shop-tab', label: 'Mystic Market' }
    };
}

/**
 * Picks the three bottom pages: real news first (in this order), then the steady pages
 * so the row is always full. Each candidate may be null (feature off or nothing to say).
 */
export function pickLowerPages({ starfall = null, oaths = null, seals = null, dragon = null, festival = null } = {}) {
    const order = [starfall, oaths, seals, dragon, festival].filter(Boolean);
    const picked = order.filter((p) => p.real).slice(0, LOWER_PAGE_COUNT);
    for (const page of [oaths, seals, festival, dragon]) {
        if (picked.length >= LOWER_PAGE_COUNT) break;
        if (page && !picked.includes(page)) picked.push(page);
    }
    // Keep a stable reading order: the same kinds sit in the same places day to day.
    const rank = ['starfall', 'oaths', 'seals', 'dragon', 'festival'];
    return picked.sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind));
}
