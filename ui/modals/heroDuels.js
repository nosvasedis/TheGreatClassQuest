// ui/modals/heroDuels.js — Hero Duels (Home › Class Actions): every hero on the projector on their own.
// The teacher picks 2 to 6 heroes (or lets the arena pick the ones who have waited longest), they
// duel while the teacher gives points, one is crowned, and the next duellists are picked at once.
// Optional big teams (today's Team Maker teams, or new ones made here): every finished duel banks its
// points to the duellists' teams, so the team race grows duel by duel until the teacher finishes.
// The game is kept on this computer for the day (closing and reopening carries on); nothing is saved
// on the class. The optional reward at the finale pays Showdown stars (db/actions/showdownStars.js),
// once per game and hero. Rules live in features/heroDuelsCore.mjs.
import '../../styles/class_tools.css';
import '../../styles/hero_duels.css';
import * as utils from '../../utils.js';
import { playSound, playShowdownSfx } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { makeTeams, teamsForDay, teamBanner, TEAM_MODES, MAX_TEAMS } from '../../features/teamMakerCore.mjs';
import {
    MIN_DUEL, MAX_DUEL, WIN_BONUSES, DUEL_TARGETS, BANK_MODES, DEFAULT_RULES, normalizeRules,
    createDuels, normalizeDuels, startDuel, scoreDuel, crownDuel, cancelDuel, duelLeaders, duelGains,
    teamIndexOf, teamTotals, suggestDuel, duelsFinale, rewardIds, waitingHeroes
} from '../../features/heroDuelsCore.mjs';
import { esc, classById, classRoster, selectedToolClassId, followSelectedClass, faceHtml, readClassField, reducedMotion, enterFullscreen, leaveFullscreen } from './classTools.js';

const ROOT_ID = 'hero-duels';
const STORE_KEY = 'gcq.heroDuels.v1';
const PREF_KEY = 'gcq.heroDuels.prefs';
const UNDO_KEEP = 40;
const SOURCE_ICONS = { today: 'fa-calendar-check', guild: 'fa-shield-halved', stars: 'fa-scale-balanced', random: 'fa-dice' };
const PLACE_WORDS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

let ui = null;
let session = null;

// ─── Storage (this computer, today only) ────────────────────────────────────────

function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
}
function storedGame(classId) {
    const game = normalizeDuels(readStore()[classId]);
    return game && game.dateKey === utils.getTodayDateString() && !game.finished ? game : null;
}
function persist() {
    try {
        const all = readStore();
        const today = utils.getTodayDateString();
        // Yesterday's games are of no use: keep only today's.
        for (const [k, v] of Object.entries(all)) if (v?.dateKey !== today) delete all[k];
        if (ui?.game) all[ui.classId] = ui.game; else if (ui) delete all[ui.classId];
        localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch { /* private window: the game still runs */ }
}
function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ rules: ui.setup.rules, teamCount: ui.setup.teamCount, source: ui.setup.source })); } catch { /* fine */ }
}

// ─── Model helpers ──────────────────────────────────────────────────────────────

const hero = (id) => ui.byId.get(id) || { id, name: 'Hero', first: 'Hero' };
const firstOf = (id) => hero(id).first;
const teamOf = (id) => (ui.game ? teamIndexOf(ui.game, id) : -1);
const teamLook = (i) => (i >= 0 ? teamBanner(i) : null);
const lite = () => !ui || ui.lite;

function todaysTeams() {
    const today = teamsForDay(readClassField(ui.classId, 'teamMaker'), utils.getTodayDateString());
    if (!today) return null;
    const known = new Set(ui.roster.map((h) => h.id));
    const teams = today.teams.map((t) => t.filter((id) => known.has(id))).filter((t) => t.length);
    return teams.length >= 2 ? teams : null;
}

function setupHeroes() {
    return ui.roster.filter((h) => ui.setup.here.has(h.id));
}

/** (Re)build the setup's big teams from the chosen source and count. */
function buildSetupTeams() {
    const s = ui.setup;
    if (!s.teamCount) { s.teams = null; return; }
    const heroes = setupHeroes();
    if (s.source === 'today' && ui.today) {
        const here = new Set(heroes.map((h) => h.id));
        s.teams = ui.today.map((t) => t.filter((id) => here.has(id)));
        const placed = new Set(s.teams.flat());
        heroes.filter((h) => !placed.has(h.id)).forEach((h) => {
            const smallest = s.teams.reduce((b, t, i) => (t.length < s.teams[b].length ? i : b), 0);
            s.teams[smallest].push(h.id);
        });
        s.teamCount = s.teams.length;
        return;
    }
    if (s.source === 'today') s.source = 'guild';
    s.teams = makeTeams({ heroes, count: Math.min(s.teamCount, Math.max(2, heroes.length)), mode: s.source }).teams;
}

function loadClass(classId) {
    const prefs = readPrefs();
    const roster = classRoster(classId);
    const game = storedGame(classId);
    ui = {
        classId,
        roster,
        byId: new Map(roster.map((h) => [h.id, h])),
        game,
        undo: [],
        view: game ? 'arena' : 'setup',
        picked: [],
        finale: false,
        reward: { stars: 1, paid: new Set(), busy: false },
        lite: detectLowPowerTier() || reducedMotion(),
        today: null,
        setup: null
    };
    ui.today = todaysTeams();
    const here = new Set(roster.filter((h) => !h.away).map((h) => h.id));
    if (game) { here.clear(); game.heroes.forEach((id) => here.add(id)); }
    const source = ui.today ? 'today' : (TEAM_MODES.some((m) => m.key === prefs.source) ? prefs.source : 'guild');
    ui.setup = {
        here,
        teamCount: game ? (game.teams?.length || 0) : (ui.today ? ui.today.length : Math.max(0, Math.min(MAX_TEAMS, Number(prefs.teamCount) || 0))),
        source,
        teams: game?.teams ? game.teams.map((t) => [...t]) : null,
        rules: normalizeRules(game?.rules || prefs.rules || DEFAULT_RULES)
    };
    if (!game && ui.setup.teamCount) buildSetupTeams();
}

/** Apply a new game state, keeping the old one for Undo. */
function commit(next, { undoable = true } = {}) {
    if (!next || next === ui.game) return false;
    if (undoable && ui.game) {
        ui.undo.push(ui.game);
        if (ui.undo.length > UNDO_KEEP) ui.undo.shift();
    }
    ui.game = next;
    persist();
    return true;
}

// ─── Markup ─────────────────────────────────────────────────────────────────────

function headHtml() {
    const cls = classById(ui.classId);
    const g = ui.game;
    const arena = ui.view === 'arena' && g;
    const duelNo = g ? (g.current ? g.current.n : g.duels.length + 1) : 1;
    return `
        <header class="hd-head">
            <span class="hd-head__crest" aria-hidden="true">⚔️</span>
            <span class="hd-head__text">
                <strong class="font-title">Hero Duels</strong>
                <span class="hd-head__class">${esc(cls?.logo || '📚')} ${esc(cls?.name || '')}</span>
            </span>
            ${arena ? `<span class="hd-head__round" aria-live="polite"><span aria-hidden="true">⚔️</span> Duel ${duelNo}</span>` : ''}
            <span class="hd-head__tools">
                ${arena ? `
                <button type="button" class="hd-tool" data-hd-undo ${ui.undo.length ? '' : 'disabled'} title="Undo the last change"><i class="fas fa-rotate-left"></i><span>Undo</span></button>
                <button type="button" class="hd-tool" data-hd-setup title="Players, teams and rules"><i class="fas fa-sliders"></i><span>Rules</span></button>
                <button type="button" class="hd-tool hd-tool--gold" data-hd-finish ${g.duels.length ? '' : 'disabled'} title="End the game and crown the champions"><i class="fas fa-flag-checkered"></i><span>Finish</span></button>` : ''}
                <button type="button" class="hd-close" data-hd-close aria-label="Close Hero Duels" title="Close (the game waits for you today)"><i class="fas fa-times"></i></button>
            </span>
        </header>`;
}

function segHtml(attr, options, current, label) {
    return `<div class="hd-seg" role="radiogroup" aria-label="${esc(label)}">${options.map((o) => {
        const on = String(o.value) === String(current);
        return `<button type="button" role="radio" aria-checked="${on}" class="hd-seg__opt${on ? ' is-on' : ''}" ${attr}="${esc(o.value)}" ${o.disabled ? 'disabled' : ''} ${o.hint ? `title="${esc(o.hint)}"` : ''}>${o.icon ? `<i class="fas ${o.icon}" aria-hidden="true"></i>` : ''}<span>${esc(o.label)}</span></button>`;
    }).join('')}</div>`;
}

function setupHtml() {
    const s = ui.setup;
    const heroes = setupHeroes();
    const away = ui.roster.filter((h) => h.away).length;
    const resuming = Boolean(ui.game);
    const teamOpts = [{ value: 0, label: 'On their own' }].concat([2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} teams`, disabled: heroes.length < n * 1 })));
    const sourceOpts = [
        ...(ui.today ? [{ value: 'today', label: "Today's teams", icon: SOURCE_ICONS.today, hint: 'The teams Team Maker saved today' }] : []),
        ...TEAM_MODES.map((m) => ({ value: m.key, label: m.label, icon: SOURCE_ICONS[m.key], hint: m.hint }))
    ];
    const r = s.rules;
    return `
    <div class="hd-setup">
        <section class="hd-card">
            <h3><span class="hd-step">1</span> Who plays <small>${heroes.length} ${heroes.length === 1 ? 'hero' : 'heroes'}${away ? ` · ${away} away today` : ''}</small></h3>
            <p class="hd-hint">Tap a hero to leave them out or bring them back.${resuming ? ' Heroes added now join with 0 points.' : ''}</p>
            <div class="hd-chips">${ui.roster.map((h) => {
                const on = s.here.has(h.id);
                return `<button type="button" class="hd-chip${on ? ' is-on' : ''}" data-hd-here="${esc(h.id)}" aria-pressed="${on}">${faceHtml(h, 'ct-face ct-face--sm')}<span>${esc(h.first)}</span>${h.away ? '<i class="fas fa-moon" title="Away today" aria-hidden="true"></i>' : ''}</button>`;
            }).join('')}</div>
        </section>
        <section class="hd-card">
            <h3><span class="hd-step">2</span> Big teams <small>${s.teamCount ? 'every duel banks points for the teams' : 'everyone plays for themselves'}</small></h3>
            ${segHtml('data-hd-teams', teamOpts, s.teamCount, 'Big teams')}
            ${s.teamCount ? `
            <div class="hd-row">${segHtml('data-hd-source', sourceOpts, s.source, 'How to make the teams')}
                ${s.source === 'today' ? '' : '<button type="button" class="hd-mini" data-hd-shuffle><i class="fas fa-shuffle"></i> Shuffle</button>'}</div>
            <p class="hd-hint">Tap a hero to move them to the next team.${resuming ? ' A hero who moves takes their points along.' : ''}</p>
            <div class="hd-teamprev" style="--cols:${Math.min(3, s.teams?.length || 2)}">${(s.teams || []).map((ids, i) => {
                const b = teamBanner(i);
                return `<div class="hd-teamprev__team" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft}">
                    <header><span aria-hidden="true">${b.emoji}</span> ${esc(b.name)} <b>${ids.length}</b></header>
                    <div>${ids.map((id) => `<button type="button" class="hd-chip is-on" data-hd-move="${esc(id)}">${faceHtml(hero(id), 'ct-face ct-face--sm')}<span>${esc(firstOf(id))}</span></button>`).join('')}</div>
                </div>`;
            }).join('')}</div>` : ''}
        </section>
        <section class="hd-card">
            <h3><span class="hd-step">3</span> Duel rules</h3>
            <div class="hd-rules">
                <div class="hd-rule"><span class="hd-rule__label"><i class="fas fa-user-group"></i> Heroes per duel <small>for “Pick for me”</small></span>
                    ${segHtml('data-hd-size', [2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })), r.size, 'Heroes per duel')}</div>
                <div class="hd-rule"><span class="hd-rule__label"><i class="fas fa-crown"></i> Winner's bonus</span>
                    ${segHtml('data-hd-bonus', WIN_BONUSES.map((n) => ({ value: n, label: n ? `+${n}` : 'None' })), r.winBonus, "Winner's bonus")}</div>
                <div class="hd-rule"><span class="hd-rule__label"><i class="fas fa-flag-checkered"></i> A duel ends</span>
                    ${segHtml('data-hd-target', DUEL_TARGETS.map((n) => ({ value: n, label: n ? `First to ${n}` : 'When I crown' })), r.target, 'When a duel ends')}</div>
                <div class="hd-rule"><span class="hd-rule__label"><i class="fas fa-coins"></i> Points banked</span>
                    ${segHtml('data-hd-bank', BANK_MODES.map((m) => ({ value: m.key, label: m.label, hint: m.hint })), r.bank, 'Points banked')}</div>
            </div>
        </section>
    </div>
    <footer class="hd-setup__foot">
        ${resuming ? '<button type="button" class="ct-btn ct-btn--ghost" data-hd-fresh><i class="fas fa-rotate"></i> Start a new game</button>' : ''}
        <button type="button" class="ct-btn ct-btn--hero hd-go" data-hd-open ${heroes.length >= MIN_DUEL ? '' : 'disabled'}><i class="fas fa-bolt"></i> ${resuming ? 'Back to the arena' : 'Open the arena'}</button>
    </footer>`;
}

function teamBarHtml() {
    const rows = teamTotals(ui.game);
    if (!rows.length) return '';
    const top = Math.max(1, ...rows.map((r) => r.points));
    return `<div class="hd-teams" style="--n:${rows.length}">${rows.map((r) => {
        const b = teamBanner(r.index);
        const lead = r.place === 1 && r.points > 0;
        return `<div class="hd-team${lead ? ' is-lead' : ''}" data-hd-team="${r.index}" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft};--fill:${(r.points / top).toFixed(3)}">
            <span class="hd-team__fill" aria-hidden="true"></span>
            <span class="hd-team__emoji" aria-hidden="true">${b.emoji}</span>
            <span class="hd-team__name">${esc(b.name)}</span>
            ${lead ? '<i class="fas fa-crown hd-team__crown" aria-label="In front"></i>' : ''}
            <b class="hd-team__pts" data-hd-team-pts>${r.points}</b>
        </div>`;
    }).join('')}</div>`;
}

function heroCardHtml(id, { compact = false } = {}) {
    const g = ui.game;
    const h = hero(id);
    const ti = teamOf(id);
    const b = teamLook(ti);
    const picked = ui.picked.includes(id);
    const inDuel = g.current?.ids.includes(id);
    const lastDuel = g.duels.at(-1);
    const crowned = lastDuel?.winners.includes(id);
    const wins = g.wins[id] || 0;
    const played = g.played[id] || 0;
    const cls = ['hd-hero', picked && 'is-picked', inDuel && 'is-in', !played && 'is-new', crowned && 'is-crowned'].filter(Boolean).join(' ');
    const style = b ? `--c:${b.primary};--cd:${b.deep};--cs:${b.soft}` : '';
    if (compact) {
        return `<button type="button" class="${cls} hd-hero--mini" data-hd-hero="${esc(id)}" style="${style}" title="${esc(h.name)}: ${g.points[id] || 0} points">
            ${faceHtml(h, 'ct-face')}<b>${g.points[id] || 0}</b></button>`;
    }
    const pickNo = picked ? ui.picked.indexOf(id) + 1 : 0;
    return `<button type="button" class="${cls}" data-hd-hero="${esc(id)}" style="${style}" aria-pressed="${picked}" title="${esc(h.name)}">
        ${pickNo ? `<span class="hd-hero__pick" aria-hidden="true">${pickNo}</span>` : ''}
        ${wins ? `<span class="hd-hero__crowns" title="${wins} ${wins === 1 ? 'crown' : 'crowns'}"><i class="fas fa-crown"></i>${wins > 1 ? `<b>${wins}</b>` : ''}</span>` : ''}
        ${faceHtml(h, 'ct-face ct-face--lg')}
        <span class="hd-hero__name">${esc(h.first)}</span>
        <span class="hd-hero__pts" data-hd-pts>${g.points[id] || 0}</span>
        <span class="hd-hero__duels" aria-hidden="true">${played ? `${'<i></i>'.repeat(Math.min(played, 5))}${played > 5 ? '+' : ''}` : '<em>new</em>'}</span>
    </button>`;
}

/** Heroes in name order, so the teacher finds a child at a glance. */
const byName = (ids) => [...ids].sort((a, b) => hero(a).name.localeCompare(hero(b).name));

function rosterHtml({ compact = false } = {}) {
    const g = ui.game;
    if (g.teams) {
        return `<div class="hd-roster hd-roster--teams${compact ? ' is-compact' : ''}" style="--n:${g.teams.length}">${g.teams.map((ids, i) => {
            const b = teamBanner(i);
            return `<div class="hd-rostercol" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft}">
                ${compact ? '' : `<header><span aria-hidden="true">${b.emoji}</span> ${esc(b.short)}</header>`}
                <div class="hd-rostergrid">${byName(ids).map((id) => heroCardHtml(id, { compact })).join('')}</div>
            </div>`;
        }).join('')}</div>`;
    }
    return `<div class="hd-roster${compact ? ' is-compact' : ''}"><div class="hd-rostergrid">${byName(g.heroes).map((id) => heroCardHtml(id, { compact })).join('')}</div></div>`;
}

function lastDuelHtml() {
    const d = ui.game.duels.at(-1);
    if (!d) return '';
    const names = d.winners.map(firstOf).join(' & ');
    const bank = {};
    if (ui.game.teams) d.ids.forEach((id) => { const ti = teamOf(id); if (ti >= 0 && d.gains[id]) bank[ti] = (bank[ti] || 0) + d.gains[id]; });
    const chips = Object.entries(bank).map(([ti, pts]) => { const b = teamBanner(Number(ti)); return `<span class="hd-bank" style="--c:${b.primary}">${b.emoji} +${pts}</span>`; }).join('');
    return `<p class="hd-lastduel"><i class="fas fa-crown"></i> Duel ${d.n}: <b>${esc(names)}</b> ${d.winners.length > 1 ? 'share the crown' : 'took the crown'} ${chips}</p>`;
}

function pickHtml() {
    const g = ui.game;
    const waiting = waitingHeroes(g).length;
    const size = g.rules.size;
    const ready = ui.picked.length >= MIN_DUEL;
    return `
    <section class="hd-pick">
        <div class="hd-pick__bar">
            <div class="hd-pick__title">
                <h2 class="font-title">Who duels next?</h2>
                <p>${waiting ? `${waiting} ${waiting === 1 ? 'hero has' : 'heroes have'} not duelled yet` : 'Every hero has duelled. Keep going or finish!'}</p>
                ${lastDuelHtml()}
            </div>
            <div class="hd-tray" aria-live="polite">
                ${ui.picked.length ? ui.picked.map((id, i) => `${i ? '<span class="hd-tray__vs">VS</span>' : ''}<button type="button" class="hd-tray__hero" data-hd-hero="${esc(id)}" title="Take ${esc(firstOf(id))} out">${faceHtml(hero(id), 'ct-face')}<span>${esc(firstOf(id))}</span></button>`).join('')
                    : `<span class="hd-tray__empty">Tap ${MIN_DUEL} to ${MAX_DUEL} heroes</span>`}
            </div>
            <div class="hd-pick__actions">
                <button type="button" class="ct-btn ct-btn--sky" data-hd-suggest title="The heroes who have waited longest${g.teams ? ', one from each team' : ''}"><i class="fas fa-dice"></i> Pick ${size} for me</button>
                ${ui.picked.length ? '<button type="button" class="ct-btn ct-btn--ghost" data-hd-clear><i class="fas fa-eraser"></i> Clear</button>' : ''}
                <button type="button" class="ct-btn ct-btn--hero hd-go" data-hd-start ${ready ? '' : 'disabled'}><i class="fas fa-bolt"></i> Start the duel</button>
            </div>
        </div>
    </section>
    ${rosterHtml()}`;
}

function duellistHtml(id, i) {
    const g = ui.game;
    const cur = g.current;
    const score = cur.scores[id] || 0;
    const leaders = duelLeaders(cur);
    const lead = leaders.includes(id);
    const ti = teamOf(id);
    const b = teamLook(ti);
    // On their own, each duellist still gets a colour of their own for the duel.
    const look = b || teamBanner(i);
    const target = g.rules.target;
    return `
        ${i ? '<span class="hd-vs" aria-hidden="true"><b>VS</b></span>' : ''}
        <article class="hd-duellist${lead ? ' is-lead' : ''}${lead && leaders.length > 1 ? ' is-tied' : ''}${b ? ' has-team' : ''}" data-hd-duellist="${esc(id)}" style="--i:${i};--c:${look.primary};--cd:${look.deep};--cs:${look.soft}">
            ${b ? `<span class="hd-duellist__team"><span aria-hidden="true">${b.emoji}</span> ${esc(b.short)}</span>` : ''}
            <span class="hd-duellist__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <span class="hd-duellist__face">${faceHtml(hero(id), 'ct-face ct-face--xl')}</span>
            <strong class="hd-duellist__name font-title">${esc(firstOf(id))}</strong>
            <span class="hd-duellist__score font-title" data-hd-score aria-live="polite">${score}</span>
            ${target ? `<span class="hd-pips" aria-label="${score} of ${target}">${Array.from({ length: target }, (_, k) => `<i class="${k < score ? 'is-on' : ''}"></i>`).join('')}</span>` : ''}
            <div class="hd-duellist__pad">
                <button type="button" class="hd-pt hd-pt--minus" data-hd-pt="-1" data-hd-who="${esc(id)}" aria-label="Take a point from ${esc(firstOf(id))}">−1</button>
                <button type="button" class="hd-pt" data-hd-pt="1" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 1 point">+1</button>
                <button type="button" class="hd-pt" data-hd-pt="2" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 2 points">+2</button>
                <button type="button" class="hd-pt" data-hd-pt="3" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 3 points">+3</button>
            </div>
            <button type="button" class="hd-crownbtn" data-hd-crown="${esc(id)}" title="Crown ${esc(firstOf(id))} the winner"><i class="fas fa-crown"></i> Crown</button>
        </article>`;
}

function ringFootHtml() {
    const cur = ui.game.current;
    const leaders = duelLeaders(cur);
    const g = ui.game;
    let main;
    if (leaders.length === 1) main = `<button type="button" class="ct-btn hd-crownall" data-hd-crown="${esc(leaders[0])}"><i class="fas fa-crown"></i> Crown ${esc(firstOf(leaders[0]))}</button>`;
    else if (leaders.length > 1) main = `<span class="hd-ringfoot__tie"><i class="fas fa-scale-balanced"></i> A tie! Tap <b>Crown</b> on the winner, or <button type="button" class="hd-mini" data-hd-crown-tie>share the crown</button></span>`;
    else main = '<span class="hd-ringfoot__tie"><i class="fas fa-hourglass-half"></i> Give the first point…</span>';
    const bonus = g.rules.winBonus ? `Winner +${g.rules.winBonus}` : '';
    const bank = g.rules.bank === 'winner' ? 'Winner takes all' : 'Every point counts';
    return `<footer class="hd-ringfoot">
        <button type="button" class="ct-btn ct-btn--ghost" data-hd-cancel title="Nobody banks anything"><i class="fas fa-ban"></i> Call it off</button>
        ${main}
        <span class="hd-ringfoot__rules">${[g.rules.target ? `First to ${g.rules.target}` : '', bonus, bank].filter(Boolean).join(' · ')}</span>
    </footer>`;
}

function ringHtml() {
    const cur = ui.game.current;
    return `
    <section class="hd-ring" style="--n:${cur.ids.length}">
        <div class="hd-ring__floor" aria-hidden="true"></div>
        <div class="hd-ring__fighters">${cur.ids.map((id, i) => duellistHtml(id, i)).join('')}</div>
        ${ringFootHtml()}
    </section>
    ${rosterHtml({ compact: true })}`;
}

function finaleHtml() {
    const g = ui.game;
    const f = duelsFinale(g, firstOf);
    const champs = f.winningTeams.map((i) => teamBanner(i));
    const top = Math.max(1, ...f.teams.map((t) => t.points));
    const r = ui.reward;
    const groups = [
        g.teams && f.winningTeams.length && { key: 'team', label: champs.length > 1 ? 'Winning teams' : `The ${champs[0]?.short || 'winners'}`, icon: 'fa-flag' },
        f.podium.length && { key: 'podium', label: 'The podium', icon: 'fa-medal' },
        { key: 'winners', label: 'Every crowned hero', icon: 'fa-crown' },
        { key: 'all', label: 'Everyone', icon: 'fa-users' }
    ].filter(Boolean);
    const podiumOrder = [2, 1, 3].map((p) => f.podium.filter((x) => x.place === p)).filter((x) => x.length);
    return `
    <div class="hd-finale" role="dialog" aria-modal="true" aria-label="The champions">
        <div class="hd-finale__rays" aria-hidden="true"></div>
        <div class="hd-finale__card">
            <p class="hd-finale__kicker">${f.duels} ${f.duels === 1 ? 'duel' : 'duels'} fought</p>
            ${champs.length ? `
            <div class="hd-finale__champ" style="--c:${champs[0].primary};--cd:${champs[0].deep}">
                <span class="hd-finale__emoji" aria-hidden="true">${champs.map((c) => c.emoji).join(' ')}</span>
                <h2 class="font-title">${champs.length > 1 ? `${champs.map((c) => esc(c.name)).join(' & ')} share the win!` : `The ${esc(champs[0].name)} win!`}</h2>
            </div>
            <div class="hd-finale__teams">${f.teams.map((t) => {
                const b = teamBanner(t.index);
                return `<div class="hd-finale__team" style="--c:${b.primary};--cd:${b.deep};--fill:${(t.points / top).toFixed(3)};--i:${t.index}">
                    <span class="hd-finale__place">${PLACE_WORDS[t.place] || ''}</span><span aria-hidden="true">${b.emoji}</span><span class="hd-finale__tname">${esc(b.name)}</span>
                    <span class="hd-finale__bar"><i></i></span><b>${t.points}</b></div>`;
            }).join('')}</div>` : '<h2 class="font-title hd-finale__title">The champions!</h2>'}
            ${podiumOrder.length ? `<div class="hd-podium">${podiumOrder.map((list) => `
                <div class="hd-podium__step hd-podium__step--${list[0].place}">
                    <div class="hd-podium__heroes">${list.map((x) => `<span class="hd-podium__hero">${faceHtml(hero(x.id), 'ct-face ct-face--lg')}<b>${esc(firstOf(x.id))}</b><small>${x.points} pts</small></span>`).join('')}</div>
                    <span class="hd-podium__block font-title">${list[0].place}</span>
                </div>`).join('')}</div>` : ''}
            ${f.crowns.length && f.crowns.length <= 3 ? `<p class="hd-finale__crowns"><i class="fas fa-crown"></i> Most crowns: <b>${f.crowns.map((id) => esc(firstOf(id))).join(', ')}</b> (${f.mostCrowns})</p>` : ''}
            <div class="hd-reward">
                <span class="hd-reward__label"><i class="fas fa-star"></i> Reward stars <small>optional · once per hero</small></span>
                ${segHtml('data-hd-stars', [1, 2, 3].map((n) => ({ value: n, label: '★'.repeat(n) })), r.stars, 'Stars')}
                <div class="hd-reward__groups">${groups.map((x) => {
                    const ids = rewardIds(g, x.key);
                    const owed = ids.filter((id) => !r.paid.has(id));
                    return `<button type="button" class="hd-mini" data-hd-pay="${x.key}" ${owed.length && !r.busy ? '' : 'disabled'}><i class="fas ${x.icon}"></i> ${esc(x.label)} <small>${owed.length ? owed.length : '✓'}</small></button>`;
                }).join('')}</div>
            </div>
            <div class="hd-finale__foot">
                <button type="button" class="ct-btn ct-btn--ghost" data-hd-back><i class="fas fa-arrow-left"></i> Back to the arena</button>
                <button type="button" class="ct-btn ct-btn--sky" data-hd-fresh><i class="fas fa-rotate"></i> New game</button>
                <button type="button" class="ct-btn ct-btn--hero" data-hd-close><i class="fas fa-check"></i> Done</button>
            </div>
        </div>
    </div>`;
}

function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root || !ui) return;
    const g = ui.game;
    const arena = ui.view === 'arena' && g;
    root.classList.toggle('is-setup', !arena);
    root.classList.toggle('is-duel', Boolean(arena && g.current));
    root.innerHTML = `
        <div class="hd-sky" aria-hidden="true"></div>
        ${headHtml()}
        ${arena ? teamBarHtml() : ''}
        <main class="hd-main">${arena ? (g.current ? ringHtml() : pickHtml()) : setupHtml()}</main>
        ${arena && ui.finale ? finaleHtml() : ''}`;
}

// ─── Effects ────────────────────────────────────────────────────────────────────

let fx = null;
async function effects() {
    if (!fx) fx = await import('../../features/questRemote/remoteFx.js').catch(() => ({}));
    return fx;
}

function restart(el, cls) {
    if (!el || lite()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

function floatText(target, text, tone = '') {
    if (!target || lite()) return;
    const tag = document.createElement('span');
    tag.className = `hd-float${tone ? ` hd-float--${tone}` : ''}`;
    tag.textContent = text;
    target.append(tag);
    setTimeout(() => tag.remove(), 900);
}

/** Points fly from where the duellists stood to their team's banner. */
function flyToTeams(from) {
    if (lite() || !ui.game?.teams) return;
    for (const { id, rect, gain } of from) {
        const ti = teamOf(id);
        const pill = document.querySelector(`#${ROOT_ID} [data-hd-team="${ti}"]`);
        if (!pill || !gain) continue;
        const to = pill.getBoundingClientRect();
        const b = teamBanner(ti);
        const chip = document.createElement('span');
        chip.className = 'hd-flychip';
        chip.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 3}px;--c:${b.primary};--dx:${to.left + to.width / 2 - (rect.left + rect.width / 2)}px;--dy:${to.top + to.height / 2 - (rect.top + rect.height / 3)}px`;
        chip.textContent = `+${gain}`;
        document.getElementById(ROOT_ID).append(chip);
        setTimeout(() => {
            chip.remove();
            restart(pill, 'is-bump');
        }, 980);
    }
}

function crowningHtml(duel) {
    const names = duel.winners.map(firstOf);
    const gains = duel.winners.map((id) => duel.gains[id] || 0);
    return `<div class="hd-crowning" aria-live="assertive">
        <div class="hd-crowning__burst" aria-hidden="true"></div>
        <div class="hd-crowning__faces">${duel.winners.map((id) => `<span class="hd-crowning__face"><i class="fas fa-crown hd-crowning__crown"></i>${faceHtml(hero(id), 'ct-face ct-face--xl')}</span>`).join('')}</div>
        <h2 class="font-title">${esc(names.join(' & '))} ${names.length > 1 ? 'share the crown!' : 'wins the duel!'}</h2>
        <p>${gains.some(Boolean) ? `+${Math.max(...gains)} points${ui.game.teams ? ' banked for the team' : ''}` : ''}</p>
    </div>`;
}

async function showCrowning(duel) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelector('.hd-crowning')?.remove();
    root.insertAdjacentHTML('beforeend', crowningHtml(duel));
    const el = root.querySelector('.hd-crowning');
    setTimeout(() => el?.remove(), lite() ? 1800 : 2600);
    const f = await effects();
    const colors = duel.winners.map((id) => teamLook(teamOf(id))?.primary).filter(Boolean);
    f.confettiRain?.({ colors: colors.length ? [...colors, '#fcd34d', '#ffffff'] : undefined, count: 70 });
    f.burstOn?.(el?.querySelector('.hd-crowning__face'), { color: '#fcd34d', count: 22 });
}

// ─── Actions ────────────────────────────────────────────────────────────────────

function openArena() {
    const s = ui.setup;
    const heroes = setupHeroes().map((h) => h.id);
    if (heroes.length < MIN_DUEL) return;
    const teams = s.teamCount && s.teams ? s.teams.map((t) => t.filter((id) => s.here.has(id))) : null;
    savePrefs();
    if (ui.game) {
        // Carry on: new rules, teams and players; every hero keeps the points they banked.
        const old = ui.game;
        const next = createDuels({ id: old.id, classId: ui.classId, dateKey: old.dateKey, heroes, teams, rules: s.rules, now: old.createdAt });
        for (const id of heroes) {
            next.points[id] = old.points[id] || 0;
            next.wins[id] = old.wins[id] || 0;
            next.played[id] = old.played[id] || 0;
        }
        next.duels = old.duels;
        next.current = old.current && old.current.ids.every((id) => heroes.includes(id)) ? old.current : null;
        commit(next);
        ui.view = 'arena';
        ui.picked = ui.picked.filter((id) => heroes.includes(id));
        playSound('confirm');
        render();
        return;
    }
    ui.game = createDuels({ id: `duels-${ui.classId}-${Date.now().toString(36)}`, classId: ui.classId, dateKey: utils.getTodayDateString(), heroes, teams, rules: s.rules });
    ui.undo = [];
    ui.view = 'arena';
    ui.picked = [];
    persist();
    render();
    playShowdownSfx('open', { teams: ui.game.teams?.length || 2 });
    if (!lite()) {
        document.querySelectorAll(`#${ROOT_ID} .hd-hero`).forEach((el, i) => { el.style.setProperty('--d', `${Math.min(i, 30) * 28}ms`); el.classList.add('is-arriving'); });
    }
}

function freshGame() {
    ui.game = null;
    ui.undo = [];
    ui.picked = [];
    ui.finale = false;
    ui.reward = { stars: ui.reward.stars, paid: new Set(), busy: false };
    ui.view = 'setup';
    ui.setup.here = new Set(ui.roster.filter((h) => !h.away).map((h) => h.id));
    ui.today = todaysTeams();
    if (ui.today && ui.setup.source === 'today') ui.setup.teamCount = ui.today.length;
    buildSetupTeams();
    persist();
    playSound('click');
    render();
}

function togglePick(id) {
    const g = ui.game;
    if (!g || g.current) return;
    if (ui.picked.includes(id)) ui.picked = ui.picked.filter((x) => x !== id);
    else if (ui.picked.length < MAX_DUEL) ui.picked = [...ui.picked, id];
    else return;
    playShowdownSfx('rollcall', { team: Math.max(0, teamOf(id)), step: ui.picked.length });
    render();
}

function suggest() {
    const g = ui.game;
    if (!g || g.current) return;
    ui.picked = suggestDuel(g, g.rules.size);
    playShowdownSfx('card');
    render();
    if (!lite()) document.querySelectorAll(`#${ROOT_ID} .hd-hero.is-picked, #${ROOT_ID} .hd-tray__hero`).forEach((el) => restart(el, 'is-chosen'));
}

function begin() {
    if (ui.picked.length < MIN_DUEL) return;
    if (!commit(startDuel(ui.game, ui.picked))) return;
    ui.picked = [];
    playShowdownSfx('question');
    render();
}

function givePoint(id, delta) {
    const before = duelLeaders(ui.game.current);
    const { game, reached } = scoreDuel(ui.game, id, delta);
    if (!commit(game)) return;
    const after = duelLeaders(game.current);
    const ti = teamOf(id);
    const color = (teamLook(ti) || teamBanner(game.current.ids.indexOf(id))).primary;
    if (delta > 0) playShowdownSfx('score', { team: ti >= 0 ? ti : game.current.ids.indexOf(id), points: delta });
    else playShowdownSfx('minus');
    if (delta > 0 && after.length === 1 && after[0] === id && before[0] !== id && before.length) setTimeout(() => playShowdownSfx('lead'), 380);
    render();
    const card = document.querySelector(`#${ROOT_ID} [data-hd-duellist="${CSS.escape(id)}"]`);
    restart(card?.querySelector('[data-hd-score]'), delta > 0 ? 'is-up' : 'is-down');
    floatText(card, delta > 0 ? `+${delta}` : `${delta}`, delta > 0 ? '' : 'minus');
    if (delta > 0) effects().then((f) => f.burstOn?.(card?.querySelector('[data-hd-score]'), { color, count: 8 + delta * 4 }));
    if (reached) setTimeout(() => { if (ui?.game?.current?.ids.includes(reached)) crown([reached]); }, lite() ? 300 : 650);
}

function crown(winners) {
    const g = ui.game;
    if (!g?.current) return;
    const from = g.current.ids.map((id) => {
        const el = document.querySelector(`#${ROOT_ID} [data-hd-duellist="${CSS.escape(id)}"]`);
        return { id, rect: el?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }, gain: duelGains(g, winners)[id] || 0 };
    });
    const { game, duel } = crownDuel(g, winners);
    if (!duel || !commit(game)) return;
    playShowdownSfx('goal');
    render();
    flyToTeams(from);
    showCrowning(duel);
}

function undo() {
    const prev = ui.undo.pop();
    if (!prev) return;
    ui.game = prev;
    ui.picked = [];
    persist();
    playShowdownSfx('undo');
    render();
}

async function pay(scope) {
    const g = ui.game;
    const r = ui.reward;
    if (!g || r.busy) return;
    const awayIds = new Set(classRoster(ui.classId).filter((h) => h.away).map((h) => h.id));
    const ids = rewardIds(g, scope).filter((id) => !r.paid.has(id) && !awayIds.has(id));
    const { showToast } = await import('../effects.js');
    if (!ids.length) { showToast('Everyone in that group already has their reward.', 'info'); return; }
    r.busy = true;
    render();
    try {
        const { payShowdownStars } = await import('../../db/actions/showdownStars.js');
        const { paid, already } = await payShowdownStars({
            classId: ui.classId, showId: g.id, heroIds: ids, stars: r.stars,
            noteOf: (id) => `Hero Duels: ${g.wins[id] ? `${g.wins[id]} ${g.wins[id] === 1 ? 'crown' : 'crowns'}, ` : ''}${g.points[id] || 0} points`
        });
        [...paid, ...already].forEach((id) => r.paid.add(id));
        if (paid.length) {
            playSound('magic_chime');
            showToast(`${paid.length} ${paid.length === 1 ? 'hero gets' : 'heroes get'} ${r.stars} ${r.stars === 1 ? 'star' : 'stars'} from Hero Duels!`, 'success');
        } else showToast('Those heroes already had their Hero Duels stars.', 'info');
    } catch (error) {
        console.warn('Hero Duels reward failed', error);
        showToast('The reward stars could not be saved. Please try again.', 'error');
    } finally {
        if (ui) { r.busy = false; render(); }
    }
}

// ─── Shell + wiring ─────────────────────────────────────────────────────────────

function close() {
    if (!session) return;
    const quick = lite();
    session.dispose();
    const root = document.getElementById(ROOT_ID);
    leaveFullscreen();
    playShowdownSfx('close');
    if (!root) return;
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), quick ? 0 : 220);
}

function onSetupClick(t) {
    const s = ui.setup;
    const here = t.closest('[data-hd-here]');
    if (here) {
        const id = here.dataset.hdHere;
        if (s.here.has(id)) s.here.delete(id); else s.here.add(id);
        if (s.teams) {
            if (!s.here.has(id)) s.teams = s.teams.map((tm) => tm.filter((x) => x !== id));
            else if (!s.teams.flat().includes(id)) {
                const smallest = s.teams.reduce((b, tm, i) => (tm.length < s.teams[b].length ? i : b), 0);
                s.teams[smallest].push(id);
            }
        }
        playSound('click');
        return render();
    }
    const teams = t.closest('[data-hd-teams]');
    if (teams) {
        s.teamCount = Number(teams.dataset.hdTeams) || 0;
        if (s.source === 'today' && ui.today && s.teamCount !== ui.today.length) s.source = 'guild';
        buildSetupTeams();
        playSound('click');
        return render();
    }
    const source = t.closest('[data-hd-source]');
    if (source) {
        s.source = source.dataset.hdSource;
        if (s.source === 'today' && ui.today) s.teamCount = ui.today.length;
        buildSetupTeams();
        playSound('magic_chime');
        return render();
    }
    if (t.closest('[data-hd-shuffle]')) { buildSetupTeams(); playSound('magic_chime'); return render(); }
    const move = t.closest('[data-hd-move]');
    if (move && s.teams) {
        const id = move.dataset.hdMove;
        const from = s.teams.findIndex((tm) => tm.includes(id));
        const to = (from + 1) % s.teams.length;
        s.teams = s.teams.map((tm) => tm.filter((x) => x !== id));
        s.teams[to].push(id);
        playSound('click');
        return render();
    }
    const rule = t.closest('[data-hd-size], [data-hd-bonus], [data-hd-target], [data-hd-bank]');
    if (rule) {
        const d = rule.dataset;
        if (d.hdSize) s.rules.size = Number(d.hdSize);
        if (d.hdBonus != null) s.rules.winBonus = Number(d.hdBonus);
        if (d.hdTarget != null) s.rules.target = Number(d.hdTarget);
        if (d.hdBank) s.rules.bank = d.hdBank;
        s.rules = normalizeRules(s.rules);
        playSound('click');
        return render();
    }
    if (t.closest('[data-hd-open]')) return openArena();
    return undefined;
}

function onArenaClick(t) {
    const g = ui.game;
    const pt = t.closest('[data-hd-pt]');
    if (pt) return givePoint(pt.dataset.hdWho, Number(pt.dataset.hdPt));
    const crownBtn = t.closest('[data-hd-crown]');
    if (crownBtn) return crown([crownBtn.dataset.hdCrown]);
    if (t.closest('[data-hd-crown-tie]')) return crown(duelLeaders(g.current));
    if (t.closest('[data-hd-cancel]')) { commit(cancelDuel(g)); playShowdownSfx('minus'); return render(); }
    const h = t.closest('[data-hd-hero]');
    if (h) return togglePick(h.dataset.hdHero);
    if (t.closest('[data-hd-suggest]')) return suggest();
    if (t.closest('[data-hd-clear]')) { ui.picked = []; playSound('click'); return render(); }
    if (t.closest('[data-hd-start]')) return begin();
    if (t.closest('[data-hd-undo]')) return undo();
    if (t.closest('[data-hd-setup]')) {
        ui.view = 'setup';
        ui.setup.here = new Set(g.heroes);
        ui.setup.teams = g.teams ? g.teams.map((tm) => [...tm]) : null;
        ui.setup.teamCount = g.teams?.length || 0;
        ui.setup.rules = { ...g.rules };
        if (ui.setup.source === 'today') ui.setup.source = 'guild';
        playSound('click');
        return render();
    }
    if (t.closest('[data-hd-finish]')) {
        if (g.current) { commit(cancelDuel(g)); }
        ui.finale = true;
        ui.picked = [];
        playShowdownSfx('finale');
        render();
        effects().then((f) => f.confettiRain?.({ count: 110 }));
        return undefined;
    }
    if (t.closest('[data-hd-back]')) { ui.finale = false; playSound('click'); return render(); }
    const stars = t.closest('[data-hd-stars]');
    if (stars) { ui.reward.stars = Number(stars.dataset.hdStars) || 1; playSound('click'); return render(); }
    const payBtn = t.closest('[data-hd-pay]');
    if (payBtn) return pay(payBtn.dataset.hdPay);
    return undefined;
}

/** Open Hero Duels for the class selected in the header (or the given one). */
export async function openHeroDuels(classId = null) {
    const id = selectedToolClassId() || classId;
    if (!id) {
        const { showToast } = await import('../effects.js');
        showToast('Select one of your classes first, then open Hero Duels.', 'info');
        return;
    }
    if (classRoster(id).length < MIN_DUEL) {
        const { showToast } = await import('../effects.js');
        showToast('Hero Duels needs at least two heroes in the class.', 'info');
        return;
    }
    session?.dispose();
    document.getElementById(ROOT_ID)?.remove();
    loadClass(id);
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = `hd${ui.lite ? ' hd--lite' : ''}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Hero Duels');
    document.body.append(root);
    render();

    const onClick = (e) => {
        if (!ui) return;
        const t = e.target;
        if (t.closest('[data-hd-close]')) return close();
        if (t.closest('[data-hd-fresh]')) return freshGame();
        if (ui.view === 'setup' || !ui.game) return onSetupClick(t);
        return onArenaClick(t);
    };
    const onKey = (e) => {
        if (e.key !== 'Escape' || !document.getElementById(ROOT_ID)) return;
        e.stopPropagation();
        if (ui.finale) { ui.finale = false; render(); return; }
        if (ui.picked.length) { ui.picked = []; render(); return; }
        if (ui.view === 'setup' && ui.game) { ui.view = 'arena'; render(); return; }
        close();
    };
    // Like Team Maker, Hero Duels follows the class selected in the header.
    const unfollow = followSelectedClass((next) => {
        if (!next) { close(); return; }
        if (next !== ui?.classId) { loadClass(next); render(); }
    });
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    session = {
        dispose() {
            root.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey, true);
            unfollow();
            session = null;
            ui = null;
        }
    };
    // The whole page goes full screen (not just this window), so notifications still show on top.
    enterFullscreen(document.documentElement);
    playSound('quiz_tier_reveal');
    requestAnimationFrame(() => root.querySelector('.hd-go:not(:disabled), .hd-close')?.focus({ preventScroll: true }));
}
