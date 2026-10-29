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
import { playSound } from '../../audio.js';
import { playDuelSfx, setDuelMusic, stopDuelMusic, warmDuelAudio } from '../../features/heroDuelsAudio.js';
import { makeTeams, teamsForDay, teamBanner, TEAM_MODES, MAX_TEAMS } from '../../features/teamMakerCore.mjs';
import {
    MIN_DUEL, MAX_DUEL, WIN_BONUSES, DUEL_TARGETS, BANK_MODES, DEFAULT_RULES, normalizeRules,
    createDuels, normalizeDuels, startDuel, scoreDuel, crownDuel, cancelDuel, duelLeaders, duelGains,
    teamIndexOf, teamTotals, suggestDuel, duelsFinale, rewardIds, waitingHeroes
} from '../../features/heroDuelsCore.mjs';
import { esc, classById, classRoster, selectedToolClassId, followSelectedClass, faceHtml, readClassField, reducedMotion, enterFullscreen, leaveFullscreen } from './classTools.js';
// The Wand's tiny DOM morph: a live update changes only what differs, so running animations go on.
import { morphInto } from '../../features/questRemote/wandMorph.mjs';
import { openTeamLookEditor, TEAM_LOOKS_EVENT } from './teamLookEditor.js';
import { arenaWorldHtml, CREST_SVG, VS_SVG, CROWN_SVG, LAUREL_SVG, TROPHY_SVG, SLOT_SVG, shieldSvg, fireworkHtml } from './heroDuelsArt.mjs';

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
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ rules: ui.setup.rules, teamCount: ui.setup.teamCount, source: ui.setup.source, music: ui.music })); } catch { /* fine */ }
}

// ─── Model helpers ──────────────────────────────────────────────────────────────

const hero = (id) => ui.byId.get(id) || { id, name: 'Hero', first: 'Hero' };
const firstOf = (id) => hero(id).first;
const teamOf = (id) => (ui.game ? teamIndexOf(ui.game, id) : -1);
/** Team `i`'s banner, with the class's own names and icons. */
const banner = (i) => teamBanner(i, ui ? readClassField(ui.classId, 'teamLooks') : null);
const teamLook = (i) => (i >= 0 ? banner(i) : null);
const lite = () => !ui || ui.lite;
/** The arena's motion is transform/opacity only, so ordinary school laptops get the whole show;
 * only the weakest machines (2 cores or 2 GB) drop it, as Award Stars does. */
function veryWeakMachine() {
    const cores = Number(navigator.hardwareConcurrency) || 4;
    const memory = Number(navigator.deviceMemory) || 4;
    return cores <= 2 || memory <= 2;
}

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
        lite: veryWeakMachine() || reducedMotion(),
        // The arena tune: on unless the teacher turned it off (weak laptops start quiet).
        music: typeof prefs.music === 'boolean' ? prefs.music : !veryWeakMachine(),
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

const coin = (value, attr = '', cls = '') => `<b class="hd-coin${cls ? ` ${cls}` : ''}" ${attr}>${value}</b>`;
/** A banner ribbon with two notched tails (titles, the winner's name). `text` is already escaped. */
const ribbon = (text, { cls = '', color = null } = {}) => `<h2 class="hd-ribbon${cls ? ` ${cls}` : ''}"${color ? ` style="--rb:${color.primary};--rbd:${color.deep}"` : ''}>
    <span class="hd-ribbon__tail hd-ribbon__tail--l" aria-hidden="true"><i></i></span><span class="hd-ribbon__tail hd-ribbon__tail--r" aria-hidden="true"><i></i></span>
    <span class="hd-ribbon__text">${text}</span></h2>`;

function headHtml() {
    const cls = classById(ui.classId);
    const g = ui.game;
    const arena = ui.view === 'arena' && g;
    const duelNo = g ? (g.current ? g.current.n : g.duels.length + 1) : 1;
    return `
        <header class="hd-head">
            <span class="hd-head__crest" aria-hidden="true">${CREST_SVG}</span>
            <span class="hd-head__text">
                <strong class="hd-title">Hero Duels</strong>
                <span class="hd-head__class">${esc(cls?.logo || '📚')} ${esc(cls?.name || '')}</span>
            </span>
            ${arena ? `<span class="hd-medal" aria-live="polite" data-qw-key="medal-${duelNo}"><small>Duel</small><b>${duelNo}</b></span>` : ''}
            <span class="hd-head__tools">
                <button type="button" class="hd-btn hd-btn--paper hd-btn--sm hd-btn--icon${ui.music ? ' is-on' : ''}" data-hd-music aria-pressed="${ui.music}" title="${ui.music ? 'Turn the arena music off' : 'Turn the arena music on'}" aria-label="Arena music"><i class="fas ${ui.music ? 'fa-music' : 'fa-volume-xmark'}"></i></button>
                ${arena ? `
                <button type="button" class="hd-btn hd-btn--paper hd-btn--sm" data-hd-undo ${ui.undo.length ? '' : 'disabled'} title="Undo the last change"><i class="fas fa-rotate-left"></i><span>Undo</span></button>
                <button type="button" class="hd-btn hd-btn--paper hd-btn--sm" data-hd-setup title="Players, teams and rules"><i class="fas fa-sliders"></i><span>Rules</span></button>
                <button type="button" class="hd-btn hd-btn--gold hd-btn--sm" data-hd-finish ${g.duels.length ? '' : 'disabled'} title="End the game and crown the champions"><i class="fas fa-flag-checkered"></i><span>Finish</span></button>` : ''}
                <button type="button" class="hd-btn hd-btn--close hd-btn--sm hd-btn--icon" data-hd-close aria-label="Close Hero Duels" title="Close (the game waits for you today)"><i class="fas fa-times"></i></button>
            </span>
        </header>`;
}

function segHtml(attr, options, current, label) {
    return `<div class="hd-seg" role="radiogroup" aria-label="${esc(label)}">${options.map((o) => {
        const on = String(o.value) === String(current);
        return `<button type="button" role="radio" aria-checked="${on}" class="hd-seg__opt${on ? ' is-on' : ''}" ${attr}="${esc(o.value)}" ${o.disabled ? 'disabled' : ''} ${o.hint ? `title="${esc(o.hint)}"` : ''}>${o.icon ? `<i class="fas ${o.icon}" aria-hidden="true"></i>` : ''}<span>${esc(o.label)}</span></button>`;
    }).join('')}</div>`;
}

const stepHtml = (n) => `<span class="hd-step" style="--c:#fbbf24;--cd:#d97706">${shieldSvg()}<b>${n}</b></span>`;

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
        <div class="hd-setup__title">${ribbon(resuming ? 'Change the rules' : 'Prepare the tournament!')}</div>
        <section class="hd-card">
            <h3>${stepHtml(1)} Who plays <small>${heroes.length} ${heroes.length === 1 ? 'hero' : 'heroes'}${away ? ` · ${away} away today` : ''}</small></h3>
            <p class="hd-hint">Tap a hero to leave them out or bring them back.${resuming ? ' Heroes added now join with 0 points.' : ''}</p>
            <div class="hd-chips">${ui.roster.map((h) => {
                const on = s.here.has(h.id);
                return `<button type="button" class="hd-chip${on ? ' is-on' : ''}" data-hd-here="${esc(h.id)}" aria-pressed="${on}">${faceHtml(h, 'ct-face ct-face--sm')}<span>${esc(h.first)}</span>${h.away ? '<i class="fas fa-moon" title="Away today" aria-hidden="true"></i>' : ''}</button>`;
            }).join('')}</div>
        </section>
        <section class="hd-card">
            <h3>${stepHtml(2)} Big teams <small>${s.teamCount ? 'duels bank team points' : 'each hero for themselves'}</small></h3>
            ${segHtml('data-hd-teams', teamOpts, s.teamCount, 'Big teams')}
            ${s.teamCount ? `
            <div class="hd-row">${segHtml('data-hd-source', sourceOpts, s.source, 'How to make the teams')}
                ${s.source === 'today' ? '' : '<button type="button" class="hd-btn hd-btn--sky hd-btn--sm" data-hd-shuffle><i class="fas fa-shuffle"></i> Shuffle</button>'}</div>
            <p class="hd-hint">Tap a hero to move them to the next team.${resuming ? ' A hero who moves takes their points along.' : ''}</p>
            <div class="hd-teamprev">${(s.teams || []).map((ids, i) => {
                const b = banner(i);
                return `<div class="hd-teamprev__team" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft}">
                    <header><span class="hd-teamprev__crest">${shieldSvg()}<span>${b.emoji}</span></span><span class="hd-teamprev__name">${esc(b.name)}</span> <button type="button" class="hd-rename" data-hd-rename="${i}" title="Rename the ${esc(b.short)} or change the icon" aria-label="Rename this team"><i class="fas fa-pen"></i></button><b>${ids.length}</b></header>
                    <div>${ids.map((id) => `<button type="button" class="hd-chip is-on" data-hd-move="${esc(id)}">${faceHtml(hero(id), 'ct-face ct-face--sm')}<span>${esc(firstOf(id))}</span></button>`).join('')}</div>
                </div>`;
            }).join('')}</div>` : ''}
        </section>
        <section class="hd-card">
            <h3>${stepHtml(3)} Duel rules</h3>
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
        ${resuming ? '<button type="button" class="hd-btn hd-btn--paper" data-hd-fresh><i class="fas fa-rotate"></i> Start a new game</button>' : ''}
        <button type="button" class="hd-btn hd-btn--green hd-btn--lg hd-go" data-hd-open ${heroes.length >= MIN_DUEL ? '' : 'disabled'}><i class="fas fa-bolt"></i> ${resuming ? 'Back to the arena' : 'Open the arena!'}</button>
    </footer>`;
}

function teamBarHtml() {
    const rows = teamTotals(ui.game);
    if (!rows.length) return '';
    const top = Math.max(1, ...rows.map((r) => r.points));
    return `<div class="hd-teams" style="--n:${rows.length}">${rows.map((r) => {
        const b = banner(r.index);
        const lead = r.place === 1 && r.points > 0;
        return `<div class="hd-team${lead ? ' is-lead' : ''}" data-hd-team="${r.index}" data-qw-key="t-${r.index}" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft};--fill:${(r.points / top).toFixed(3)}">
            <span class="hd-team__crest" aria-hidden="true">${shieldSvg()}<span class="hd-team__emoji">${b.emoji}</span><span class="hd-team__crown">${CROWN_SVG}</span></span>
            <span class="hd-team__body">
                <span class="hd-team__top"><span class="hd-team__name">${esc(b.name)}</span>${lead ? '<span class="hd-sr">is in front</span>' : ''}
                <button type="button" class="hd-rename" data-hd-rename="${r.index}" title="Rename the ${esc(b.short)} or change the icon" aria-label="Rename this team"><i class="fas fa-pen"></i></button></span>
                <span class="hd-team__track" aria-hidden="true"><span class="hd-team__fill"></span><span class="hd-team__shine"></span></span>
            </span>
            ${coin(r.points, 'data-hd-team-pts', 'hd-team__pts')}
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
        return `<button type="button" class="${cls} hd-hero--mini" data-hd-hero="${esc(id)}" data-qw-key="h-${esc(id)}" style="${style}" title="${esc(h.name)}: ${g.points[id] || 0} points">
            ${faceHtml(h, 'ct-face')}<b>${g.points[id] || 0}</b></button>`;
    }
    const pickNo = picked ? ui.picked.indexOf(id) + 1 : 0;
    return `<button type="button" class="${cls}" data-hd-hero="${esc(id)}" data-qw-key="h-${esc(id)}" style="${style}" aria-pressed="${picked}" title="${esc(h.name)}">
        <span class="hd-hero__band" aria-hidden="true"></span>
        ${pickNo ? `<span class="hd-hero__pick" aria-hidden="true">${pickNo}</span>` : ''}
        ${wins ? `<span class="hd-hero__crowns" title="${wins} ${wins === 1 ? 'crown' : 'crowns'}">${CROWN_SVG}${wins > 1 ? `<b>${wins}</b>` : ''}</span>` : ''}
        <span class="hd-hero__face">${faceHtml(h, 'ct-face ct-face--lg')}</span>
        <span class="hd-hero__name">${esc(h.first)}</span>
        <span class="hd-hero__foot">
            <b class="hd-hero__pts" data-hd-pts>${g.points[id] || 0}</b>
            ${played ? `<span class="hd-hero__duels" aria-hidden="true">${'<i></i>'.repeat(Math.min(played, 5))}${played > 5 ? '<small>+</small>' : ''}</span>` : '<em class="hd-hero__new">New!</em>'}
        </span>
    </button>`;
}

/** Heroes in name order, so the teacher finds a child at a glance. */
const byName = (ids) => [...ids].sort((a, b) => hero(a).name.localeCompare(hero(b).name));

function rosterHtml({ compact = false } = {}) {
    const g = ui.game;
    if (g.teams) {
        return `<div class="hd-roster hd-roster--teams${compact ? ' is-compact' : ''}" style="--n:${g.teams.length}">${g.teams.map((ids, i) => {
            const b = banner(i);
            return `<div class="hd-rostercol" data-qw-key="col-${i}" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft}">
                ${compact ? '' : `<header class="hd-rostercol__head"><span aria-hidden="true">${b.emoji}</span> ${esc(b.short)}</header>`}
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
    const chips = Object.entries(bank).map(([ti, pts]) => { const b = banner(Number(ti)); return `<span class="hd-bank" style="--c:${b.primary}">${b.emoji} +${pts}</span>`; }).join('');
    const said = `Duel ${d.n}: ${names} ${d.winners.length > 1 ? 'share the crown' : 'took the crown'}`;
    return `<p class="hd-lastduel" data-qw-key="last-${d.n}" title="${esc(said)}" aria-label="${esc(said)}"><span class="hd-lastduel__crown" aria-hidden="true">${CROWN_SVG}</span><span>Duel ${d.n}:</span><b>${esc(names)}</b>${chips}</p>`;
}

function trayHtml() {
    const g = ui.game;
    const slots = Math.max(MIN_DUEL, g.rules.size, ui.picked.length);
    const out = [];
    for (let i = 0; i < slots; i++) {
        if (i) out.push(`<span class="hd-tray__vs" aria-hidden="true">VS</span>`);
        const id = ui.picked[i];
        if (id) {
            const look = teamLook(teamOf(id)) || banner(i);
            out.push(`<button type="button" class="hd-slot is-filled" data-hd-hero="${esc(id)}" data-qw-key="tr-${esc(id)}" style="--c:${look.primary};--cd:${look.deep}" title="Take ${esc(firstOf(id))} out">
                ${faceHtml(hero(id), 'ct-face')}<span>${esc(firstOf(id))}</span></button>`);
        } else {
            out.push(`<span class="hd-slot" data-qw-key="slot-${i}">${SLOT_SVG}</span>`);
        }
    }
    return out.join('');
}

function pickHtml() {
    const g = ui.game;
    const waiting = waitingHeroes(g).length;
    const size = g.rules.size;
    const ready = ui.picked.length >= MIN_DUEL;
    return `
    <section class="hd-pick">
        <div class="hd-board">
            <div class="hd-board__title">
                <h2 class="hd-title hd-title--md">Who duels next?</h2>
                ${lastDuelHtml() || `<p>${waiting ? `${waiting} ${waiting === 1 ? 'hero has' : 'heroes have'} not duelled yet` : 'Every hero has duelled. Keep going or finish!'}</p>`}
            </div>
            <div class="hd-tray" aria-live="polite" aria-label="${ui.picked.length ? `${ui.picked.length} picked` : `Tap ${MIN_DUEL} to ${MAX_DUEL} heroes`}">${trayHtml()}</div>
            <div class="hd-board__actions">
                <button type="button" class="hd-btn hd-btn--sky" data-hd-suggest title="The heroes who have waited longest${g.teams ? ', one from each team' : ''}"><i class="fas fa-dice"></i> Pick ${size} for me</button>
                <button type="button" class="hd-btn hd-btn--paper hd-btn--sm" data-hd-clear ${ui.picked.length ? '' : 'disabled'}><i class="fas fa-eraser"></i> Clear</button>
                <button type="button" class="hd-btn hd-btn--green hd-btn--lg hd-go${ready ? ' is-ready' : ''}" data-hd-start ${ready ? '' : 'disabled'}><i class="fas fa-bolt"></i> Start the duel!</button>
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
    const look = b || banner(i);
    const target = g.rules.target;
    return `
        ${i ? `<span class="hd-vs" data-qw-key="vs-${i}" aria-hidden="true">${VS_SVG}</span>` : ''}
        <article class="hd-duellist${lead ? ' is-lead' : ''}${lead && leaders.length > 1 ? ' is-tied' : ''}${b ? ' has-team' : ''}" data-hd-duellist="${esc(id)}" data-qw-key="f-${esc(id)}" style="--i:${i};--c:${look.primary};--cd:${look.deep};--cs:${look.soft}">
            <span class="hd-duellist__crown" aria-hidden="true">${CROWN_SVG}</span>
            <button type="button" class="hd-crownbtn" data-hd-crown="${esc(id)}" title="Crown ${esc(firstOf(id))} the winner" aria-label="Crown ${esc(firstOf(id))} the winner"><i class="fas fa-crown"></i></button>
            ${b ? `<span class="hd-duellist__team"><span aria-hidden="true">${b.emoji}</span> ${esc(b.short)}</span>` : ''}
            <span class="hd-duellist__face"><span class="hd-duellist__aura" aria-hidden="true"></span>${faceHtml(hero(id), 'ct-face ct-face--xl')}</span>
            <strong class="hd-duellist__name">${esc(firstOf(id))}</strong>
            <span class="hd-duellist__coin"><b data-hd-score aria-live="polite">${score}</b></span>
            ${target ? `<span class="hd-pips" aria-label="${score} of ${target}">${Array.from({ length: target }, (_, k) => `<i class="${k < score ? 'is-on' : ''}"></i>`).join('')}</span>` : ''}
            <div class="hd-duellist__pad">
                <button type="button" class="hd-pt hd-pt--minus" data-hd-pt="-1" data-hd-who="${esc(id)}" aria-label="Take a point from ${esc(firstOf(id))}">−1</button>
                <button type="button" class="hd-pt" data-hd-pt="1" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 1 point">+1</button>
                <button type="button" class="hd-pt" data-hd-pt="2" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 2 points">+2</button>
                <button type="button" class="hd-pt" data-hd-pt="3" data-hd-who="${esc(id)}" aria-label="Give ${esc(firstOf(id))} 3 points">+3</button>
            </div>
        </article>`;
}

/** The power bar: each duellist's share of the duel's points, in their colour. */
function powerHtml(cur) {
    const scores = cur.ids.map((id) => Math.max(0, cur.scores[id] || 0));
    const total = scores.reduce((a, b) => a + b, 0);
    let start = 0;
    return `<div class="hd-power" aria-hidden="true">${cur.ids.map((id, i) => {
        const share = total ? scores[i] / total : 1 / cur.ids.length;
        const look = teamLook(teamOf(id)) || banner(i);
        const seg = `<i data-qw-key="pw-${esc(id)}" style="--c:${look.primary};--cd:${look.deep};--start:${start.toFixed(4)};--share:${share.toFixed(4)}"></i>${i ? `<b data-qw-key="pwb-${i}" style="--at:${start.toFixed(4)}"></b>` : ''}`;
        start += share;
        return seg;
    }).join('')}<span class="hd-power__shine"></span></div>`;
}

function ringFootHtml() {
    const cur = ui.game.current;
    const leaders = duelLeaders(cur);
    const g = ui.game;
    let main;
    if (leaders.length === 1) main = `<button type="button" class="hd-btn hd-btn--gold hd-btn--lg hd-crownall" data-hd-crown="${esc(leaders[0])}"><i class="fas fa-crown"></i> Crown ${esc(firstOf(leaders[0]))}</button>`;
    else if (leaders.length > 1) main = `<span class="hd-ringfoot__tie"><i class="fas fa-scale-balanced"></i> A tie! Tap the <i class="fas fa-crown"></i> on the winner's card, or <button type="button" class="hd-btn hd-btn--gold hd-btn--sm" data-hd-crown-tie><i class="fas fa-crown"></i> share the crown</button></span>`;
    else main = '<span class="hd-ringfoot__tie"><i class="fas fa-hourglass-half"></i> Give the first point…</span>';
    const rules = [g.rules.target ? `First to ${g.rules.target}` : '', g.rules.winBonus ? `Winner +${g.rules.winBonus}` : '', g.rules.bank === 'winner' ? 'Winner takes all' : 'Every point counts'].filter(Boolean);
    return `<footer class="hd-ringfoot">
        <button type="button" class="hd-btn hd-btn--paper hd-btn--sm" data-hd-cancel title="Nobody banks anything"><i class="fas fa-ban"></i> Call it off</button>
        ${main}
        <span class="hd-ringfoot__rules">${rules.map((x) => `<span>${esc(x)}</span>`).join('')}</span>
    </footer>`;
}

function ringHtml() {
    const cur = ui.game.current;
    return `
    <section class="hd-ring" style="--n:${cur.ids.length}">
        <div class="hd-ring__fighters">${cur.ids.map((id, i) => duellistHtml(id, i)).join('')}</div>
        ${powerHtml(cur)}
        ${ringFootHtml()}
    </section>
    ${rosterHtml({ compact: true })}`;
}

const MEDALS = ['', '#fcd34d', '#e2e8f0', '#f0a35e'];

function finaleHtml() {
    const g = ui.game;
    const f = duelsFinale(g, firstOf);
    const champs = f.winningTeams.map((i) => banner(i));
    const top = Math.max(1, ...f.teams.map((t) => t.points));
    const r = ui.reward;
    const groups = [
        g.teams && f.winningTeams.length && { key: 'team', label: champs.length > 1 ? 'Winning teams' : `The ${champs[0]?.short || 'winners'}`, icon: 'fa-flag' },
        f.podium.length && { key: 'podium', label: 'The podium', icon: 'fa-medal' },
        { key: 'winners', label: 'Every crowned hero', icon: 'fa-crown' },
        { key: 'all', label: 'Everyone', icon: 'fa-users' }
    ].filter(Boolean);
    const podiumOrder = [2, 1, 3].map((p) => f.podium.filter((x) => x.place === p)).filter((x) => x.length);
    const title = champs.length
        ? (champs.length > 1 ? `${champs.map((c) => esc(c.name)).join(' & ')} share the win!` : `The ${esc(champs[0].name)} win!`)
        : 'The champions!';
    const teamsHtml = champs.length ? `<div class="hd-finale__teams">${f.teams.map((t) => {
        const b = banner(t.index);
        return `<div class="hd-finale__team${t.place === 1 ? ' is-first' : ''}" style="--c:${b.primary};--cd:${b.deep};--fill:${(t.points / top).toFixed(3)};--i:${t.index}">
            <span class="hd-medal-sm" style="--m:${MEDALS[t.place] || '#c4b5fd'}">${t.place}</span>
            <span class="hd-finale__crest">${shieldSvg()}<span>${b.emoji}</span></span>
            <span class="hd-finale__tname">${esc(b.name)}</span>
            <span class="hd-finale__bar"><i></i></span>${coin(t.points)}</div>`;
    }).join('')}</div>` : '';
    const podiumHtml = podiumOrder.length ? `<div class="hd-podium">${podiumOrder.map((list) => `
        <div class="hd-podium__step hd-podium__step--${list[0].place}" style="--i:${list[0].place}">
            <div class="hd-podium__heroes">${list.map((x) => `<span class="hd-podium__hero">${x.place === 1 ? `<span class="hd-podium__crown" aria-hidden="true">${CROWN_SVG}</span>` : ''}${faceHtml(hero(x.id), 'ct-face ct-face--lg')}<b>${esc(firstOf(x.id))}</b><small>${x.points} ${x.points === 1 ? 'pt' : 'pts'}</small></span>`).join('')}</div>
            <span class="hd-podium__block">${list[0].place}</span>
        </div>`).join('')}</div>` : '';
    return `
    <div class="hd-finale" role="dialog" aria-modal="true" aria-label="The champions">
        <div class="hd-finale__rays" aria-hidden="true"></div>
        ${lite() ? '' : `<div class="hd-finale__fireworks" aria-hidden="true">${['#fcd34d', '#f472b6', '#38bdf8', '#4ade80', '#fb923c'].map((c, i) => fireworkHtml(i, c)).join('')}</div>`}
        <div class="hd-finale__card">
            <div class="hd-finale__top">
                <span class="hd-finale__trophy" aria-hidden="true">${TROPHY_SVG}</span>
                <div class="hd-finale__heading">
                    <p class="hd-finale__kicker">Champions' Hall · ${f.duels} ${f.duels === 1 ? 'duel' : 'duels'} fought</p>
                    ${champs.length ? `<span class="hd-finale__emoji" aria-hidden="true">${champs.map((c) => c.emoji).join(' ')}</span>` : ''}
                    ${ribbon(title, { cls: 'hd-ribbon--big', color: champs[0] || null })}
                </div>
            </div>
            <div class="hd-finale__body${champs.length && podiumHtml ? ' is-split' : ''}">
                ${teamsHtml}
                ${podiumHtml}
            </div>
            ${f.crowns.length && f.crowns.length <= 3 ? `<p class="hd-finale__crowns"><span aria-hidden="true">${CROWN_SVG}</span> Most crowns: <b>${f.crowns.map((id) => esc(firstOf(id))).join(', ')}</b> (${f.mostCrowns})</p>` : ''}
            <div class="hd-reward">
                <span class="hd-reward__label"><i class="fas fa-star"></i> Reward stars <small>optional · once per hero</small></span>
                ${segHtml('data-hd-stars', [1, 2, 3].map((n) => ({ value: n, label: '★'.repeat(n) })), r.stars, 'Stars')}
                <div class="hd-reward__groups">${groups.map((x) => {
                    const ids = rewardIds(g, x.key);
                    const owed = ids.filter((id) => !r.paid.has(id));
                    return `<button type="button" class="hd-btn hd-btn--paper hd-btn--sm" data-hd-pay="${x.key}" ${owed.length && !r.busy ? '' : 'disabled'}><i class="fas ${x.icon}"></i> ${esc(x.label)} <small class="hd-count">${owed.length ? owed.length : '✓'}</small></button>`;
                }).join('')}</div>
            </div>
            <div class="hd-finale__foot">
                <button type="button" class="hd-btn hd-btn--paper" data-hd-back><i class="fas fa-arrow-left"></i> Back to the arena</button>
                <button type="button" class="hd-btn hd-btn--sky" data-hd-fresh><i class="fas fa-rotate"></i> New game</button>
                <button type="button" class="hd-btn hd-btn--green" data-hd-close><i class="fas fa-check"></i> Done</button>
            </div>
        </div>
    </div>`;
}

/** The banners the arena flies: the game's teams, the teams being set up, or four festive colours. */
function arenaBanners() {
    const count = ui.game?.teams?.length || (ui.view === 'setup' && ui.setup.teamCount) || 0;
    if (!count) return [0, 1, 2, 3].map((i) => banner(i));
    return Array.from({ length: count }, (_, i) => banner(i));
}

/** The storybook arena, painted once and repainted only when the team banners change. */
function paintWorld(root) {
    const banners = arenaBanners();
    const key = banners.map((b) => `${b.primary}${b.emoji}`).join('|');
    const old = root.querySelector(':scope > .hd-backdrop');
    if (old && old.dataset.key === key) return;
    const html = `<div class="hd-backdrop" data-key="${esc(key)}" aria-hidden="true">
        ${arenaWorldHtml(banners)}
        <div class="hd-embers">${Array.from({ length: 10 }, (_, i) => `<i style="--x:${(i * 61) % 100}%;--d:${(i * 0.73) % 6}s;--t:${6 + (i * 7) % 5}s;--s:${0.5 + ((i * 13) % 10) / 10}"></i>`).join('')}</div>
        <div class="hd-torch hd-torch--l"><i></i><i></i><i></i></div>
        <div class="hd-torch hd-torch--r"><i></i><i></i><i></i></div>
    </div>`;
    if (old) old.outerHTML = html;
    else root.insertAdjacentHTML('afterbegin', html);
}

function render() {
    const root = document.getElementById(ROOT_ID);
    const stage = root?.querySelector(':scope > .hd-stage');
    if (!root || !stage || !ui) return;
    const g = ui.game;
    const arena = ui.view === 'arena' && g;
    root.classList.toggle('is-setup', !arena);
    root.classList.toggle('is-duel', Boolean(arena && g.current));
    root.classList.toggle('is-finale', Boolean(arena && ui.finale));
    paintWorld(root);
    const viewKey = !arena ? 'setup' : g.current ? `duel-${g.current.n}` : 'pick';
    morphInto(stage, `
        ${headHtml()}
        ${arena ? teamBarHtml() : ''}
        <main class="hd-main" data-qw-key="main-${viewKey}">${arena ? (g.current ? ringHtml() : pickHtml()) : setupHtml()}</main>
        ${arena && ui.finale ? finaleHtml() : ''}`);
    syncMusic();
}

/** The arena tune follows the game: calm while picking, drums in a duel, quiet at the finale. */
function syncMusic() {
    if (!ui || !session) return;
    const g = ui.game;
    const arena = ui.view === 'arena' && g;
    setDuelMusic(!ui.music || (arena && ui.finale) ? 'off' : arena && g.current ? 'duel' : 'calm');
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

/** The crowd in the stands jumps: a little for a point, a big roar for a crown. */
function cheer(big = false) {
    const crowd = document.querySelector(`#${ROOT_ID} .hd-world__crowdwrap`);
    if (!crowd || lite()) return;
    crowd.classList.remove('is-cheer', 'is-roar');
    void crowd.offsetWidth;
    crowd.classList.add(big ? 'is-roar' : 'is-cheer');
}

function floatText(target, text, tone = '') {
    if (!target || lite()) return;
    const tag = document.createElement('span');
    tag.className = `hd-float${tone ? ` hd-float--${tone}` : ''}`;
    tag.dataset.qwTransient = '';
    tag.textContent = text;
    target.append(tag);
    setTimeout(() => tag.remove(), 950);
}

/** Points fly from where the duellists stood to their team's banner, as gold coins. */
function flyToTeams(from, before = []) {
    if (lite() || !ui.game?.teams) return;
    // The team numbers wait for their points to land, then count up.
    const waiting = new Map();
    for (const { id, gain } of from) { const ti = teamOf(id); if (gain && ti >= 0) waiting.set(ti, (waiting.get(ti) || 0) + gain); }
    waiting.forEach((gain, ti) => {
        const pts = document.querySelector(`#${ROOT_ID} [data-hd-team="${ti}"] [data-hd-team-pts]`);
        const was = before.find((r) => r.index === ti)?.points;
        if (pts && Number.isFinite(was)) {
            pts.textContent = String(was);
            setTimeout(() => countUp(pts, was, was + gain), 940);
        }
    });
    if (waiting.size) setTimeout(() => playDuelSfx('bank'), 900);
    for (const { id, rect, gain } of from) {
        const ti = teamOf(id);
        const pill = document.querySelector(`#${ROOT_ID} [data-hd-team="${ti}"]`);
        if (!pill || !gain) continue;
        const to = pill.querySelector('.hd-team__pts')?.getBoundingClientRect() || pill.getBoundingClientRect();
        const b = banner(ti);
        const chip = document.createElement('span');
        chip.className = 'hd-flychip';
        chip.dataset.qwTransient = '';
        chip.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 3}px;--c:${b.primary};--dx:${to.left + to.width / 2 - (rect.left + rect.width / 2)}px;--dy:${to.top + to.height / 2 - (rect.top + rect.height / 3)}px`;
        chip.innerHTML = `<i class="hd-coin" aria-hidden="true">★</i>+${gain}`;
        document.getElementById(ROOT_ID).append(chip);
        setTimeout(() => {
            chip.remove();
            restart(pill, 'is-bump');
        }, 980);
    }
}

/** A number ticking up to its new value (the team bar after a duel). */
function countUp(el, from, to) {
    if (!el?.isConnected) return;
    const steps = Math.min(12, Math.max(1, to - from));
    let k = 0;
    const tick = () => {
        if (!el.isConnected) return;
        k += 1;
        el.textContent = String(Math.round(from + ((to - from) * k) / steps));
        restart(el, 'is-tick');
        if (k < steps) setTimeout(tick, 55);
    };
    tick();
}

function crowningHtml(duel) {
    const names = duel.winners.map(firstOf);
    const gains = duel.winners.map((id) => duel.gains[id] || 0);
    const look = teamLook(teamOf(duel.winners[0])) || banner(ui.game.duels.at(-1)?.ids.indexOf(duel.winners[0]) ?? 0);
    const teamWord = ui.game.teams && teamLook(teamOf(duel.winners[0]));
    return `<div class="hd-crowning" data-qw-transient aria-live="assertive" style="--c:${look.primary};--cd:${look.deep}">
        <div class="hd-crowning__veil" aria-hidden="true"></div>
        <div class="hd-crowning__burst" aria-hidden="true"></div>
        <div class="hd-crowning__fireworks" aria-hidden="true">${['#fcd34d', look.primary, '#f472b6', '#38bdf8'].map((c, i) => fireworkHtml(i, c)).join('')}</div>
        <div class="hd-crowning__faces">${duel.winners.map((id) => `<span class="hd-crowning__face"><span class="hd-crowning__laurel" aria-hidden="true">${LAUREL_SVG}</span><span class="hd-crowning__crown" aria-hidden="true">${CROWN_SVG}</span>${faceHtml(hero(id), 'ct-face ct-face--xl')}</span>`).join('')}</div>
        ${ribbon(esc(names.join(' & ')), { cls: 'hd-ribbon--big hd-crowning__ribbon', color: look })}
        <p class="hd-crowning__line">${names.length > 1 ? 'share the crown of' : 'wins'} Duel ${duel.n}!</p>
        ${gains.some(Boolean) ? `<p class="hd-crowning__gain"><i class="hd-coin" aria-hidden="true">★</i> +${Math.max(...gains)} points${teamWord ? ` for the ${esc(teamWord.name)}` : ''}</p>` : ''}
    </div>`;
}

async function showCrowning(duel) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelector('.hd-crowning')?.remove();
    root.insertAdjacentHTML('beforeend', crowningHtml(duel));
    const el = root.querySelector('.hd-crowning');
    setTimeout(() => el?.remove(), lite() ? 1800 : 3000);
    const f = await effects();
    const colors = duel.winners.map((id) => teamLook(teamOf(id))?.primary).filter(Boolean);
    f.confettiRain?.({ colors: colors.length ? [...colors, '#fcd34d', '#ffffff'] : undefined, count: 80 });
    setTimeout(() => f.burstOn?.(el?.querySelector('.hd-crowning__face'), { color: '#fcd34d', count: 24 }), 520);
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
        playDuelSfx('chosen');
        render();
        return;
    }
    ui.game = createDuels({ id: `duels-${ui.classId}-${Date.now().toString(36)}`, classId: ui.classId, dateKey: utils.getTodayDateString(), heroes, teams, rules: s.rules });
    ui.undo = [];
    ui.view = 'arena';
    ui.picked = [];
    persist();
    render();
    playDuelSfx('open');
    cheer(true);
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
    playDuelSfx('undo');
    render();
}

function togglePick(id) {
    const g = ui.game;
    if (!g || g.current) return;
    const out = ui.picked.includes(id);
    if (out) ui.picked = ui.picked.filter((x) => x !== id);
    else if (ui.picked.length < MAX_DUEL) ui.picked = [...ui.picked, id];
    else return;
    playDuelSfx(out ? 'unpick' : 'pick', { step: ui.picked.length });
    render();
    if (!out) restart(document.querySelector(`#${ROOT_ID} .hd-tray [data-hd-hero="${CSS.escape(id)}"]`), 'is-chosen');
}

/** "Pick for me": a spotlight dances over the heroes, then lands on the ones who have waited longest. */
async function suggest() {
    const g = ui.game;
    if (!g || g.current || ui.rolling) return;
    const chosen = suggestDuel(g, g.rules.size);
    if (!lite()) {
        ui.rolling = true;
        ui.picked = [];
        render();
        const root = document.getElementById(ROOT_ID);
        root?.classList.add('is-rolling');
        const cards = [...(root?.querySelectorAll('.hd-roster .hd-hero') || [])];
        let lastLit = [];
        const steps = 13;
        for (let k = 0; k < steps && cards.length; k += 1) {
            lastLit.forEach((el) => el.classList.remove('is-scan'));
            lastLit = Array.from({ length: Math.min(chosen.length, cards.length) }, () => cards[Math.floor(Math.random() * cards.length)]);
            lastLit.forEach((el) => el.classList.add('is-scan'));
            playDuelSfx('roll', { k: k / steps });
            await new Promise((r) => setTimeout(r, 55 + k * k * 1.6));
            if (!ui || ui.game !== g) return;
        }
        lastLit.forEach((el) => el.classList.remove('is-scan'));
        root?.classList.remove('is-rolling');
        ui.rolling = false;
    }
    ui.picked = chosen;
    playDuelSfx('chosen');
    render();
    cheer();
    if (!lite()) {
        document.querySelectorAll(`#${ROOT_ID} .hd-hero.is-picked, #${ROOT_ID} .hd-tray .hd-slot.is-filled`).forEach((el) => restart(el, 'is-chosen'));
        effects().then((f) => document.querySelectorAll(`#${ROOT_ID} .hd-hero.is-picked`).forEach((el) => f.burstOn?.(el, { color: '#fcd34d', count: 10 })));
    }
}

/** The clash: "Duel N" drops in, the duellists slam together, the swords clang, then "Ready… GO!".
 * Timed with the 'clash' sound (clang at 0.45 s, GO at 1.25 s). */
function showClash(cur) {
    const root = document.getElementById(ROOT_ID);
    if (!root || lite()) return;
    root.querySelector('.hd-clash')?.remove();
    const n = cur.ids.length;
    root.insertAdjacentHTML('beforeend', `<div class="hd-clash" data-qw-transient aria-hidden="true" style="--n:${n}">
        <div class="hd-clash__veil"></div>
        <div class="hd-clash__rays"></div>
        ${ribbon(`Duel ${cur.n}`, { cls: 'hd-ribbon--big hd-clash__title' })}
        <div class="hd-clash__row">${cur.ids.map((id, i) => {
            const look = teamLook(teamOf(id)) || banner(i);
            const side = n === 1 ? 0 : (i < n / 2 ? -1 : 1);
            return `${i ? `<span class="hd-clash__vs">${VS_SVG}</span>` : ''}<span class="hd-clash__hero" style="--side:${side};--i:${i};--c:${look.primary}">${faceHtml(hero(id), 'ct-face ct-face--xl')}<b>${esc(firstOf(id))}</b></span>`;
        }).join('')}</div>
        <div class="hd-clash__flash"></div>
        <div class="hd-clash__ring"></div>
        <p class="hd-clash__ready">Ready…</p>
        <p class="hd-clash__go">GO!</p>
    </div>`);
    const el = root.querySelector('.hd-clash');
    setTimeout(() => cheer(), 450);
    setTimeout(() => cheer(true), 1250);
    setTimeout(() => el?.remove(), 2050);
}

function begin() {
    if (ui.picked.length < MIN_DUEL || ui.rolling) return;
    if (!commit(startDuel(ui.game, ui.picked))) return;
    ui.picked = [];
    playDuelSfx('clash');
    render();
    showClash(ui.game.current);
}

function givePoint(id, delta) {
    const before = duelLeaders(ui.game.current);
    const { game, reached } = scoreDuel(ui.game, id, delta);
    if (!commit(game)) return;
    const after = duelLeaders(game.current);
    const ti = teamOf(id);
    const color = (teamLook(ti) || banner(game.current.ids.indexOf(id))).primary;
    if (delta > 0) playDuelSfx('point', { key: ti >= 0 ? ti : game.current.ids.indexOf(id), delta });
    else playDuelSfx('minus');
    if (delta > 0 && after.length === 1 && after[0] === id && before[0] !== id && before.length) setTimeout(() => playDuelSfx('lead'), 420);
    else if (delta > 0 && after.length > 1 && after.includes(id) && before.length === 1) setTimeout(() => playDuelSfx('tie'), 420);
    render();
    if (delta > 0) cheer(delta > 2);
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
    const before = teamTotals(g);
    const { game, duel } = crownDuel(g, winners);
    if (!duel || !commit(game)) return;
    playDuelSfx('crown');
    render();
    cheer(true);
    flyToTeams(from, before);
    showCrowning(duel);
}

function undo() {
    const prev = ui.undo.pop();
    if (!prev) return;
    ui.game = prev;
    ui.picked = [];
    persist();
    playDuelSfx('undo');
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
            playDuelSfx('stars');
            showToast(`${paid.length} ${paid.length === 1 ? 'hero gets' : 'heroes get'} ${r.stars} ${r.stars === 1 ? 'star' : 'stars'} from Hero Duels!`, 'success');
        } else showToast('Those heroes already had their Hero Duels stars.', 'info');
    } catch (error) {
        console.warn('Hero Duels reward failed', error);
        showToast('The reward stars could not be saved. Please try again.', 'error');
    } finally {
        if (ui) { r.busy = false; render(); }
    }
}

function toggleMusic() {
    ui.music = !ui.music;
    savePrefs();
    playDuelSfx('tap', { on: ui.music });
    render();
}

// ─── Shell + wiring ─────────────────────────────────────────────────────────────

function close() {
    if (!session) return;
    const quick = lite();
    session.dispose();
    const root = document.getElementById(ROOT_ID);
    leaveFullscreen();
    playDuelSfx('close');
    stopDuelMusic();
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
        playDuelSfx('tap');
        return render();
    }
    const teams = t.closest('[data-hd-teams]');
    if (teams) {
        s.teamCount = Number(teams.dataset.hdTeams) || 0;
        if (s.source === 'today' && ui.today && s.teamCount !== ui.today.length) s.source = 'guild';
        buildSetupTeams();
        playDuelSfx('tap');
        return render();
    }
    const source = t.closest('[data-hd-source]');
    if (source) {
        s.source = source.dataset.hdSource;
        if (s.source === 'today' && ui.today) s.teamCount = ui.today.length;
        buildSetupTeams();
        playDuelSfx('chosen');
        return render();
    }
    if (t.closest('[data-hd-shuffle]')) { buildSetupTeams(); playDuelSfx('roll', { k: 0.8 }); return render(); }
    const move = t.closest('[data-hd-move]');
    if (move && s.teams) {
        const id = move.dataset.hdMove;
        const from = s.teams.findIndex((tm) => tm.includes(id));
        const to = (from + 1) % s.teams.length;
        s.teams = s.teams.map((tm) => tm.filter((x) => x !== id));
        s.teams[to].push(id);
        playDuelSfx('tap');
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
        playDuelSfx('tap');
        return render();
    }
    if (t.closest('[data-hd-open]')) return openArena();
    return undefined;
}

function onArenaClick(t) {
    const g = ui.game;
    if (ui.rolling) return undefined;
    const pt = t.closest('[data-hd-pt]');
    if (pt) return givePoint(pt.dataset.hdWho, Number(pt.dataset.hdPt));
    const crownBtn = t.closest('[data-hd-crown]');
    if (crownBtn) return crown([crownBtn.dataset.hdCrown]);
    if (t.closest('[data-hd-crown-tie]')) return crown(duelLeaders(g.current));
    if (t.closest('[data-hd-cancel]')) { commit(cancelDuel(g)); playDuelSfx('cancel'); return render(); }
    const h = t.closest('[data-hd-hero]');
    if (h) return togglePick(h.dataset.hdHero);
    if (t.closest('[data-hd-suggest]')) return suggest();
    if (t.closest('[data-hd-clear]')) { ui.picked = []; playDuelSfx('unpick'); return render(); }
    if (t.closest('[data-hd-start]')) return begin();
    if (t.closest('[data-hd-undo]')) return undo();
    if (t.closest('[data-hd-setup]')) {
        ui.view = 'setup';
        ui.setup.here = new Set(g.heroes);
        ui.setup.teams = g.teams ? g.teams.map((tm) => [...tm]) : null;
        ui.setup.teamCount = g.teams?.length || 0;
        ui.setup.rules = { ...g.rules };
        if (ui.setup.source === 'today') ui.setup.source = 'guild';
        playDuelSfx('tap');
        return render();
    }
    if (t.closest('[data-hd-finish]')) {
        if (g.current) { commit(cancelDuel(g)); }
        ui.finale = true;
        ui.picked = [];
        playDuelSfx('finale');
        render();
        cheer(true);
        effects().then((f) => {
            f.confettiRain?.({ count: 110 });
            setTimeout(() => { if (ui?.finale) f.confettiRain?.({ count: 90 }); }, 1700);
        });
        return undefined;
    }
    if (t.closest('[data-hd-back]')) { ui.finale = false; playDuelSfx('undo'); return render(); }
    const stars = t.closest('[data-hd-stars]');
    if (stars) { ui.reward.stars = Number(stars.dataset.hdStars) || 1; playDuelSfx('tap'); return render(); }
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
    root.innerHTML = '<div class="hd-stage"></div>';
    document.body.append(root);
    warmDuelAudio();

    const onClick = (e) => {
        if (!ui) return;
        const t = e.target;
        if (t.closest('[data-hd-close]')) return close();
        if (t.closest('[data-hd-fresh]')) return freshGame();
        if (t.closest('[data-hd-music]')) return toggleMusic();
        const rename = t.closest('[data-hd-rename]');
        if (rename && !ui.rolling) { openTeamLookEditor({ classId: ui.classId, index: Number(rename.dataset.hdRename) }); return undefined; }
        if (ui.view === 'setup' || !ui.game) return onSetupClick(t);
        return onArenaClick(t);
    };
    const onKey = (e) => {
        if (e.key !== 'Escape' || !document.getElementById(ROOT_ID)) return;
        e.stopPropagation();
        if (ui.finale) { ui.finale = false; render(); return; }
        if (ui.rolling) return;
        if (ui.picked.length) { ui.picked = []; render(); return; }
        if (ui.view === 'setup' && ui.game) { ui.view = 'arena'; render(); return; }
        close();
    };
    // Like Team Maker, Hero Duels follows the class selected in the header.
    const unfollow = followSelectedClass((next) => {
        if (!next) { close(); return; }
        if (next !== ui?.classId) { loadClass(next); render(); }
    });
    const onLooks = (e) => { if (ui && e.detail?.classId === ui.classId) render(); };
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener(TEAM_LOOKS_EVENT, onLooks);
    session = {
        dispose() {
            stopDuelMusic();
            root.removeEventListener('click', onClick);
            window.removeEventListener(TEAM_LOOKS_EVENT, onLooks);
            document.removeEventListener('keydown', onKey, true);
            unfollow();
            session = null;
            ui = null;
        }
    };
    render();
    // The whole page goes full screen (not just this window), so notifications still show on top.
    enterFullscreen(document.documentElement);
    playSound('quiz_tier_reveal');
    requestAnimationFrame(() => root.querySelector('.hd-go:not(:disabled), .hd-close')?.focus({ preventScroll: true }));
}

// ─── The Wand (Quest Remote) ────────────────────────────────────────────────────
// The phone sees the game as a small panel (getHeroDuelsPanel) and sends `duel-…` actions on the
// Showdown command type. Each one presses the same button the teacher would press on the projector,
// so the class sees the Wand's spark land on it and every rule stays in one place.

function lastDuelText() {
    const d = ui.game?.duels.at(-1);
    if (!d) return '';
    return `Duel ${d.n}: ${d.winners.map(firstOf).join(' & ')} ${d.winners.length > 1 ? 'shared the crown' : 'took the crown'}`;
}

/** What the Wand shows: null when Hero Duels is not on the projector. */
export function getHeroDuelsPanel() {
    if (!ui || !document.getElementById(ROOT_ID)) return null;
    const cls = classById(ui.classId);
    const g = ui.game;
    const base = { kind: 'duels', className: `${cls?.logo || ''} ${cls?.name || ''}`.trim(), undo: ui.undo.length > 0, music: ui.music };
    if (!g || ui.view === 'setup') {
        const s = ui.setup;
        return {
            ...base, view: 'setup', resuming: Boolean(g), here: s.here.size, away: ui.roster.filter((h) => h.away).length,
            teamCount: s.teamCount || 0, source: s.source, canToday: Boolean(ui.today), size: s.rules.size, bonus: s.rules.winBonus,
            target: s.rules.target, bank: s.rules.bank,
            teams: (s.teamCount && s.teams ? s.teams : []).map((ids, i) => {
                const b = banner(i);
                return { slot: i, name: b.name, emoji: b.emoji, color: b.primary, size: ids.length, names: byName(ids).map(firstOf).join(', ').slice(0, 78) };
            })
        };
    }
    const totals = teamTotals(g);
    const teams = totals.map((r) => {
        const b = banner(r.index);
        return { name: b.short, emoji: b.emoji, color: b.primary, pts: r.points, lead: r.place === 1 && r.points > 0 };
    });
    if (ui.finale) {
        const f = duelsFinale(g, firstOf);
        const champs = f.winningTeams.map((i) => banner(i));
        const groups = [
            g.teams && f.winningTeams.length && { key: 'team', label: champs.length > 1 ? 'Winning teams' : `The ${champs[0]?.short || 'winners'}` },
            f.podium.length && { key: 'podium', label: 'The podium' },
            { key: 'winners', label: 'Every crowned hero' },
            { key: 'all', label: 'Everyone' }
        ].filter(Boolean).map((x) => ({ ...x, owed: rewardIds(g, x.key).filter((id) => !ui.reward.paid.has(id)).length }));
        return {
            ...base, view: 'finale', duels: f.duels, teams, stars: ui.reward.stars, busy: ui.reward.busy, groups,
            champ: champs.length ? `${champs.map((c) => `${c.emoji} ${c.name}`).join(' & ')} ${champs.length > 1 ? 'share the win' : 'win'}` : '',
            podium: f.podium.slice(0, 6).map((x) => ({ n: firstOf(x.id), p: x.points, place: x.place }))
        };
    }
    if (g.current) {
        const cur = g.current;
        const leaders = duelLeaders(cur);
        return {
            ...base, view: 'duel', duelNo: cur.n, teams, target: g.rules.target, bonus: g.rules.winBonus, tie: leaders.length > 1,
            leader: leaders.length === 1 ? leaders[0] : '',
            fighters: cur.ids.map((id, i) => {
                const b = teamLook(teamOf(id));
                return { id, n: firstOf(id), s: cur.scores[id] || 0, color: (b || banner(i)).primary, team: b ? `${b.emoji} ${b.short}` : '', lead: leaders.includes(id) };
            })
        };
    }
    const lastDuel = g.duels.at(-1);
    const crownLook = lastDuel ? teamLook(teamOf(lastDuel.winners[0])) : null;
    return {
        ...base, view: 'pick', duelNo: g.duels.length + 1, teams, size: g.rules.size, picked: ui.picked.length, rolling: Boolean(ui.rolling),
        canFinish: g.duels.length > 0, last: lastDuelText(), waiting: waitingHeroes(g).length,
        // The last crowning, so the Wand can celebrate it too (once per duel).
        crownN: lastDuel?.n || 0, crownNames: lastDuel ? lastDuel.winners.map(firstOf).join(' & ') : '',
        crownGain: lastDuel ? Math.max(0, ...lastDuel.winners.map((id) => lastDuel.gains[id] || 0)) : 0,
        crownTeam: crownLook && g.teams ? `${crownLook.emoji} ${crownLook.short}` : '', crownColor: crownLook?.primary || '',
        heroes: (g.teams ? g.teams.flatMap((ids) => byName(ids)) : byName(g.heroes)).map((id) => ({
            id, n: firstOf(id), p: g.points[id] || 0, w: g.wins[id] || 0, d: g.played[id] || 0,
            c: teamLook(teamOf(id))?.primary || '', k: ui.picked.indexOf(id) + 1
        }))
    };
}

const DUEL_RULE_ATTR = { teams: 'data-hd-teams', source: 'data-hd-source', size: 'data-hd-size', bonus: 'data-hd-bonus', target: 'data-hd-target', bank: 'data-hd-bank', stars: 'data-hd-stars' };
const DUEL_BUTTONS = {
    'duel-shuffle': '[data-hd-shuffle]', 'duel-arena': '[data-hd-open]', 'duel-fresh': '[data-hd-fresh]', 'duel-setup': '[data-hd-setup]',
    'duel-suggest': '[data-hd-suggest]', 'duel-clear': '[data-hd-clear]', 'duel-start': '[data-hd-start]', 'duel-share': '[data-hd-crown-tie]',
    'duel-cancel': '[data-hd-cancel]', 'duel-undo': '[data-hd-undo]', 'duel-finish': '[data-hd-finish]', 'duel-back': '[data-hd-back]', 'duel-close': '[data-hd-close]',
    'duel-music': '[data-hd-music]'
};

/** The projector button a Wand action stands for ('' when there is none). */
function duelSelector(p) {
    const id = CSS.escape(String(p.studentId || ''));
    switch (p.action) {
        case 'duel-rule': return DUEL_RULE_ATTR[p.rule] ? `[${DUEL_RULE_ATTR[p.rule]}="${CSS.escape(String(p.value))}"]` : '';
        case 'duel-here': return `[data-hd-here="${id}"]`;
        case 'duel-move': return `[data-hd-move="${id}"]`;
        case 'duel-pick': return `.hd-roster [data-hd-hero="${id}"]`;
        case 'duel-point': return `[data-hd-pt="${Number(p.delta)}"][data-hd-who="${id}"]`;
        case 'duel-crown': return `.hd-duellist [data-hd-crown="${id}"]`;
        case 'duel-pay': return `[data-hd-pay="${CSS.escape(String(p.scope || ''))}"]`;
        default: return DUEL_BUTTONS[p.action] || '';
    }
}

/** Runs a Wand action on the projector. Returns { ok, message }. */
export async function runHeroDuelsCommand(p, { sparkTo = null } = {}) {
    if (p.action === 'duel-open') {
        if (document.getElementById(ROOT_ID)) return { ok: true, message: 'Hero Duels is open' };
        await openHeroDuels();
        return document.getElementById(ROOT_ID) ? { ok: true, message: 'Hero Duels opens on the projector' } : { ok: false, message: 'Choose one of your classes first' };
    }
    const root = document.getElementById(ROOT_ID);
    if (!root || !ui) return { ok: false, message: 'Hero Duels is not on the projector' };
    if (ui.rolling) return { ok: false, message: 'The spotlight is still choosing' };
    const sel = duelSelector(p);
    const btn = sel ? root.querySelector(sel) : null;
    if (!btn || btn.disabled) return { ok: false, message: 'That is not on the projector right now' };
    // Points and picks fly fast so a quick game keeps its pace; the rest take the full spark.
    const quick = p.action === 'duel-point' || p.action === 'duel-pick';
    if (sparkTo) await sparkTo(btn, quick ? { size: 18, duration: 360, burst: 8 } : { size: 22, duration: 520, burst: 12 });
    if (!btn.isConnected || btn.disabled) return { ok: false, message: 'That is not on the projector right now' };
    btn.click();
    if (p.action === 'duel-point') return { ok: true, message: `${Number(p.delta) > 0 ? '+' : ''}${Number(p.delta)} for ${firstOf(String(p.studentId))}` };
    if (p.action === 'duel-crown') return { ok: true, message: `${firstOf(String(p.studentId))} is crowned` };
    if (p.action === 'duel-music') return { ok: true, message: ui?.music ? 'The arena music plays' : 'The arena music is off' };
    return { ok: true, message: '' };
}
