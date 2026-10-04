// ui/modals/teamMaker.js — Team Maker (Home › Class Actions and Global Tools).
// Splits the children who are here into 2 to 6 teams: mixed by guild, balanced on this month's
// stars, or pure luck, with "never the same pairs as last time". The teacher can move a child by
// tapping them and then another team. Saved teams live on the class (`teamMaker`) for today, so
// the projector card, the Fair Picker and the bounty poster can use them.
// Rules live in features/teamMakerCore.mjs.
import '../../styles/class_tools.css';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { getGuildById } from '../../features/guilds.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import {
    TEAM_MODES, MIN_TEAMS, MAX_TEAMS, clampTeamCount, suggestTeamCount, makeTeams,
    recordTeams, teamsForDay, pastTeamSets, describeTeams, moveHero, teamBanner
} from '../../features/teamMakerCore.mjs';
import { queueProjectorCard } from '../wallpaperQueue.mjs';
import { showAnimatedModal, hideModal } from './base.js';
import {
    esc, classById, classRoster, defaultToolClassId, faceHtml, classPickerHtml,
    readClassField, saveClassField, reducedMotion, enterFullscreen, leaveFullscreen
} from './classTools.js';

const MODAL_ID = 'team-maker-modal';
const STAGE_ID = 'team-maker-stage';
const PREF_KEY = 'gcq.teamMaker.prefs';
const MODE_ICONS = { guild: 'fa-shield-halved', stars: 'fa-scale-balanced', random: 'fa-dice' };

let ui = null;
let session = null;

function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ mode: ui.mode, avoid: ui.avoid, counts: ui.counts })); } catch { /* fine */ }
}

function hereHeroes() {
    return ui.roster.filter((h) => ui.here.has(h.id));
}

function heroesById() {
    return new Map(ui.roster.map((h) => [h.id, h]));
}

function loadClass(classId) {
    const prefs = readPrefs();
    const roster = classRoster(classId);
    const raw = readClassField(classId, 'teamMaker');
    const today = teamsForDay(raw, utils.getTodayDateString());
    const known = new Set(roster.map((h) => h.id));
    const savedTeams = today ? today.teams.map((t) => t.filter((id) => known.has(id))).filter((t) => t.length) : null;
    const here = new Set(roster.filter((h) => !h.away).map((h) => h.id));
    // Children placed in today's teams count as here, even if they arrived after roll call.
    savedTeams?.flat().forEach((id) => here.add(id));
    const counts = prefs.counts && typeof prefs.counts === 'object' ? prefs.counts : {};
    ui = {
        classId,
        roster,
        here,
        counts,
        count: savedTeams?.length || clampTeamCount(counts[classId] || suggestTeamCount(here.size), here.size),
        mode: TEAM_MODES.some((m) => m.key === (today?.mode || prefs.mode)) ? (today?.mode || prefs.mode) : 'guild',
        avoid: prefs.avoid !== false,
        past: pastTeamSets(raw),
        teams: savedTeams,
        saved: Boolean(savedTeams),
        repeats: 0,
        selected: null,
        rosterOpen: false,
        lite: detectLowPowerTier() || reducedMotion(),
        fresh: true
    };
}

// ─── Markup ───────────────────────────────────────────────────────────────────

function headerHtml() {
    const cls = classById(ui.classId);
    return `
        <header class="tm-head">
            <span class="tm-head__crest" aria-hidden="true"><i class="fas fa-people-group"></i></span>
            <span class="tm-head__text">
                <strong id="tm-title" class="font-title">Team Maker</strong>
                <span class="tm-head__sub">${esc(cls?.logo || '📚')} ${esc(cls?.name || 'Class')} · split the heroes who are here into teams</span>
            </span>
            ${classPickerHtml(ui.classId, 'data-tm-class')}
            <button type="button" class="ct-close" data-tm-close aria-label="Close Team Maker"><i class="fas fa-times"></i></button>
        </header>`;
}

function controlsHtml() {
    const hereCount = ui.here.size;
    const awayCount = ui.roster.length - hereCount;
    const n = clampTeamCount(ui.count, hereCount);
    const per = n ? `${Math.floor(hereCount / n)}${hereCount % n ? `–${Math.ceil(hereCount / n)}` : ''}` : '0';
    const canAvoid = ui.past.length > 0;
    return `
        <section class="tm-controls" aria-label="How to make the teams">
            <div class="tm-ctl tm-ctl--count">
                <span class="tm-ctl__label">Teams</span>
                <div class="tm-stepper">
                    <button type="button" data-tm-step="-1" aria-label="Fewer teams" ${n <= MIN_TEAMS ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
                    <output aria-live="polite">${n || '–'}</output>
                    <button type="button" data-tm-step="1" aria-label="More teams" ${n >= Math.min(MAX_TEAMS, hereCount) ? 'disabled' : ''}><i class="fas fa-plus"></i></button>
                </div>
                <span class="tm-ctl__hint">${n ? `teams of ${per}` : 'need 2 heroes'}</span>
            </div>
            <div class="tm-ctl tm-ctl--mode">
                <span class="tm-ctl__label">Mix</span>
                <div class="tm-modes" role="radiogroup" aria-label="How to mix">
                    ${TEAM_MODES.map((m) => `<button type="button" role="radio" class="tm-mode${ui.mode === m.key ? ' is-on' : ''}" aria-checked="${ui.mode === m.key}" data-tm-mode="${m.key}" title="${esc(m.hint)}"><i class="fas ${MODE_ICONS[m.key]}" aria-hidden="true"></i><span>${esc(m.label)}</span></button>`).join('')}
                </div>
            </div>
            <div class="tm-ctl tm-ctl--opts">
                <button type="button" class="tm-toggle${ui.avoid && canAvoid ? ' is-on' : ''}" data-tm-avoid aria-pressed="${ui.avoid && canAvoid}" ${canAvoid ? '' : 'disabled'}>
                    <span class="tm-toggle__knob" aria-hidden="true"></span>
                    <span><b>Never the same pairs</b><small>${canAvoid ? 'as last time' : 'no earlier teams yet'}</small></span>
                </button>
                <button type="button" class="tm-here${ui.rosterOpen ? ' is-open' : ''}" data-tm-roster aria-expanded="${ui.rosterOpen}">
                    <i class="fas fa-user-check" aria-hidden="true"></i><span><b>${hereCount} here</b>${awayCount ? `<small>${awayCount} away</small>` : '<small>everyone</small>'}</span>
                </button>
            </div>
            ${ui.rosterOpen ? rosterHtml() : ''}
        </section>`;
}

function rosterHtml() {
    return `<div class="tm-roster" role="group" aria-label="Who is here">
        <p class="tm-roster__hint">Tap a hero to leave them out (or bring them back). Roll Call already left out the ones away today.</p>
        <div class="tm-roster__list">${ui.roster.map((h) => {
            const on = ui.here.has(h.id);
            return `<button type="button" class="tm-chip${on ? ' is-here' : ''}" data-tm-here="${esc(h.id)}" aria-pressed="${on}">${faceHtml(h, 'ct-face ct-face--sm')}<span>${esc(h.first)}</span>${h.away ? '<i class="fas fa-moon" title="Away today" aria-hidden="true"></i>' : ''}</button>`;
        }).join('')}</div>
    </div>`;
}

function guildDotsHtml(guilds) {
    return Object.entries(guilds).map(([id, count]) => {
        const g = getGuildById(id);
        return g ? `<span class="tm-gdot" style="--g:${g.primary}" title="${esc(g.name)}: ${count}">${g.emoji}<b>${count}</b></span>` : '';
    }).join('');
}

function teamsHtml() {
    if (!ui.teams) {
        const enough = ui.here.size >= MIN_TEAMS;
        return `<div class="tm-empty">
            <div class="tm-empty__banners" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<span style="--c:${teamBanner(i).primary}">${teamBanner(i).emoji}</span>`).join('')}</div>
            <p>${enough ? 'Choose how many teams and how to mix them, then make the teams.' : 'At least two heroes need to be here to make teams.'}</p>
            <button type="button" class="ct-btn ct-btn--hero" data-tm-make ${enough ? '' : 'disabled'}><i class="fas fa-wand-magic-sparkles"></i> Make teams</button>
        </div>`;
    }
    const byId = heroesById();
    const described = describeTeams(ui.teams, byId);
    const showStars = ui.mode === 'stars';
    return `<div class="tm-teams${ui.fresh && !ui.lite ? ' is-fresh' : ''}${ui.selected ? ' is-moving' : ''}" style="--tm-cols:${Math.min(3, ui.teams.length)}">
        ${described.map((t) => `
            <article class="tm-team" data-tm-team="${t.index}" style="--c:${t.banner.primary};--cd:${t.banner.deep};--cs:${t.banner.soft};--i:${t.index}">
                <header class="tm-team__banner">
                    <span class="tm-team__emoji" aria-hidden="true">${t.banner.emoji}</span>
                    <span class="tm-team__name font-title">${esc(t.banner.name)}</span>
                    <span class="tm-team__count">${t.size}</span>
                </header>
                <ul class="tm-team__heroes">
                    ${t.ids.map((id) => {
                        const h = byId.get(id);
                        if (!h) return '';
                        return `<li><button type="button" class="tm-hero${ui.selected === id ? ' is-picked' : ''}" data-tm-hero="${esc(id)}" aria-pressed="${ui.selected === id}" title="Tap, then tap another team to move ${esc(h.first)}">${faceHtml(h, 'ct-face')}<span>${esc(h.name)}</span></button></li>`;
                    }).join('')}
                </ul>
                <footer class="tm-team__foot">
                    <span class="tm-team__meta">${showStars ? `<span class="tm-team__stars"><i class="fas fa-star"></i>${t.stars}</span>` : ''}${guildDotsHtml(t.guilds)}</span>
                    <button type="button" class="tm-team__bounty" data-tm-bounty="${t.index}" title="Post a bounty for the ${esc(t.banner.short)}"><i class="fas fa-thumbtack"></i><span>Bounty</span></button>
                </footer>
            </article>`).join('')}
    </div>
    ${ui.selected ? `<p class="tm-moving-hint" role="status"><i class="fas fa-hand-pointer"></i> Now tap the team ${esc(byId.get(ui.selected)?.first || '')} should join.</p>` : ''}
    ${ui.avoid && ui.past.length && ui.repeats ? `<p class="tm-note"><i class="fas fa-circle-info"></i> ${ui.repeats} ${ui.repeats === 1 ? 'pair was' : 'pairs were'} together last time too; with this many teams it could not be avoided.</p>` : ''}`;
}

function footerHtml() {
    if (!ui.teams) return '';
    return `<footer class="tm-foot">
        <span class="tm-foot__state">${ui.saved ? '<i class="fas fa-circle-check"></i> Today\'s teams are saved' : '<i class="fas fa-pen"></i> Not saved yet'}</span>
        <button type="button" class="ct-btn ct-btn--ghost" data-tm-make><i class="fas fa-shuffle"></i> ${ui.saved ? 'New teams' : 'Shuffle again'}</button>
        <button type="button" class="ct-btn ct-btn--sky tm-foot__project" data-tm-project title="Show on projector"><i class="fas fa-tv"></i><span> Show on projector</span></button>
        ${ui.saved ? '' : '<button type="button" class="ct-btn ct-btn--hero" data-tm-save><i class="fas fa-check"></i> Use these teams</button>'}
    </footer>`;
}

function render() {
    const shell = document.querySelector(`#${MODAL_ID} .tm-shell`);
    if (!shell) return;
    const body = shell.querySelector('.tm-body');
    const keep = body?.scrollTop || 0;
    shell.innerHTML = `${headerHtml()}<div class="tm-body">${controlsHtml()}<div class="tm-board" aria-live="polite">${teamsHtml()}</div></div>${footerHtml()}`;
    shell.querySelector('.tm-body').scrollTop = keep;
    ui.fresh = false;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function make() {
    const heroes = hereHeroes();
    if (heroes.length < MIN_TEAMS) return;
    const result = makeTeams({
        heroes,
        count: clampTeamCount(ui.count, heroes.length),
        mode: ui.mode,
        avoidPairs: ui.avoid && ui.past.length > 0,
        pastSets: ui.past
    });
    ui.teams = result.teams;
    ui.repeats = result.repeats;
    ui.saved = false;
    ui.selected = null;
    ui.fresh = true;
    playSound('magic_chime');
    render();
}

async function save() {
    if (!ui?.teams) return false;
    const classId = ui.classId;
    const raw = readClassField(classId, 'teamMaker');
    const record = recordTeams(raw, { teams: ui.teams, mode: ui.mode, dateKey: utils.getTodayDateString(), madeAt: Date.now() });
    ui.saved = true;
    ui.past = pastTeamSets(record);
    render();
    playSound('confirm');
    const ok = await saveClassField(classId, 'teamMaker', record);
    if (ok) queueProjectorCard(`class_teams_today`, classId);
    else if (ui?.classId === classId) { ui.saved = false; render(); }
    return ok;
}

function setClass(classId) {
    loadClass(classId);
    render();
}

async function openBountyForTeam(index) {
    if (!ui?.teams?.[index]) return;
    if (!ui.saved) await save();
    const banner = teamBanner(index);
    const classId = ui.classId;
    const team = { ids: [...ui.teams[index]], label: banner.name };
    close();
    const { prepareBountyPoster, focusBountyPoster } = await import('./bountyPoster.js');
    prepareBountyPoster(classId, { team });
    showAnimatedModal('create-bounty-modal');
    focusBountyPoster();
}

// ─── Projector stage ──────────────────────────────────────────────────────────

/** Today's teams, big and in their colours, over everything (the projector shows this). */
export function showTeamsStage(classId, teams) {
    const cls = classById(classId);
    const byId = new Map(classRoster(classId).map((h) => [h.id, h]));
    const described = describeTeams(teams, byId);
    document.getElementById(STAGE_ID)?.remove();
    const stage = document.createElement('div');
    stage.id = STAGE_ID;
    stage.className = `tm-stage${detectLowPowerTier() || reducedMotion() ? ' tm-stage--lite' : ''}`;
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', "Today's teams");
    const cols = described.length <= 4 ? described.length : 3;
    stage.innerHTML = `
        <div class="tm-stage__sky" aria-hidden="true"></div>
        <header class="tm-stage__head">
            <span class="tm-stage__logo" aria-hidden="true">${esc(cls?.logo || '📚')}</span>
            <h2 class="font-title">Today's Teams</h2>
            <span class="tm-stage__class">${esc(cls?.name || '')}</span>
        </header>
        <div class="tm-stage__grid" style="--tm-cols:${cols};--tm-grid-rows:${Math.ceil(described.length / cols)};--tm-rows:${Math.max(3, ...described.map((t) => t.size))}">
            ${described.map((t) => `
                <section class="tm-stage__team" style="--c:${t.banner.primary};--cd:${t.banner.deep};--cs:${t.banner.soft};--i:${t.index}">
                    <header><span class="tm-stage__emoji" aria-hidden="true">${t.banner.emoji}</span><span class="font-title">${esc(t.banner.name)}</span></header>
                    <ul>${t.ids.map((id) => {
                        const h = byId.get(id);
                        return h ? `<li>${faceHtml(h, 'ct-face ct-face--lg')}<span>${esc(h.first)}</span></li>` : '';
                    }).join('')}</ul>
                </section>`).join('')}
        </div>
        <button type="button" class="tm-stage__close" data-tm-stage-close aria-label="Close the big screen"><i class="fas fa-times"></i></button>`;
    document.body.append(stage);
    const shut = () => {
        document.removeEventListener('keydown', onKey, true);
        leaveFullscreen();
        stage.classList.add('is-leaving');
        setTimeout(() => stage.remove(), stage.classList.contains('tm-stage--lite') ? 0 : 220);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); shut(); }
    };
    stage.addEventListener('click', (e) => { if (e.target.closest('[data-tm-stage-close]')) shut(); });
    document.addEventListener('keydown', onKey, true);
    enterFullscreen(stage);
    playSound('quiz_tier_reveal');
    requestAnimationFrame(() => stage.querySelector('.tm-stage__close')?.focus({ preventScroll: true }));
}

// ─── Shell + wiring ───────────────────────────────────────────────────────────

function ensureShell() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'fixed inset-0 bg-black/55 z-[70] flex items-center justify-center p-2 sm:p-5 hidden';
    modal.innerHTML = '<div class="tm-shell ct-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="tm-title"></div>';
    document.body.append(modal);
    return modal;
}

function close() {
    session?.dispose();
    hideModal(MODAL_ID);
}

/** Open Team Maker on a class (default: the selected class, or the one in a lesson now). */
export async function openTeamMaker(classId = null) {
    const id = classId || defaultToolClassId();
    if (!id) {
        const { showToast } = await import('../effects.js');
        showToast('Create a class first, then make teams for it.', 'info');
        return;
    }
    session?.dispose();
    const modal = ensureShell();
    loadClass(id);
    render();

    const onClick = async (e) => {
        if (e.target === modal) return close();
        const t = e.target;
        if (t.closest('[data-tm-close]')) return close();
        const step = t.closest('[data-tm-step]');
        if (step) {
            ui.count = clampTeamCount(clampTeamCount(ui.count, ui.here.size) + Number(step.dataset.tmStep), ui.here.size);
            ui.counts[ui.classId] = ui.count;
            savePrefs();
            playSound('click');
            if (ui.teams) make(); else render();
            return;
        }
        const mode = t.closest('[data-tm-mode]');
        if (mode) {
            ui.mode = mode.dataset.tmMode;
            savePrefs();
            playSound('click');
            if (ui.teams) make(); else render();
            return;
        }
        if (t.closest('[data-tm-avoid]')) { ui.avoid = !ui.avoid; savePrefs(); playSound('click'); if (ui.teams && !ui.saved) make(); else render(); return; }
        if (t.closest('[data-tm-roster]')) { ui.rosterOpen = !ui.rosterOpen; render(); return; }
        const here = t.closest('[data-tm-here]');
        if (here) {
            const hid = here.dataset.tmHere;
            if (ui.here.has(hid)) ui.here.delete(hid); else ui.here.add(hid);
            ui.count = clampTeamCount(ui.count, ui.here.size) || ui.count;
            if (ui.teams) {
                // Take the child out of (or drop them into the smallest of) the current teams.
                if (!ui.here.has(hid)) ui.teams = ui.teams.map((team) => team.filter((x) => x !== hid)).filter((team) => team.length);
                else {
                    const smallest = ui.teams.reduce((best, team, i) => (team.length < ui.teams[best].length ? i : best), 0);
                    ui.teams = moveHero(ui.teams, hid, smallest);
                }
                ui.saved = false;
            }
            render();
            return;
        }
        if (t.closest('[data-tm-make]')) return make();
        if (t.closest('[data-tm-save]')) return save();
        if (t.closest('[data-tm-project]')) {
            if (!ui.saved) await save();
            if (ui?.teams) showTeamsStage(ui.classId, ui.teams);
            return;
        }
        const bounty = t.closest('[data-tm-bounty]');
        if (bounty) return openBountyForTeam(Number(bounty.dataset.tmBounty));
        const hero = t.closest('[data-tm-hero]');
        if (hero) {
            const hid = hero.dataset.tmHero;
            const teamOf = (id) => ui.teams.findIndex((tm) => tm.includes(id));
            if (ui.selected && ui.selected !== hid && teamOf(ui.selected) !== teamOf(hid)) {
                // Tapping a child in another team moves the picked child there.
                ui.teams = moveHero(ui.teams, ui.selected, teamOf(hid)).filter((tm) => tm.length);
                ui.saved = false;
                ui.selected = null;
                playSound('click');
                render();
                return;
            }
            ui.selected = ui.selected === hid ? null : hid;
            playSound('click');
            render();
            return;
        }
        const team = t.closest('[data-tm-team]');
        if (team && ui.selected) {
            const to = Number(team.dataset.tmTeam);
            const from = ui.teams.findIndex((tm) => tm.includes(ui.selected));
            if (from !== to) {
                ui.teams = moveHero(ui.teams, ui.selected, to).filter((tm) => tm.length);
                ui.saved = false;
                playSound('click');
            }
            ui.selected = null;
            render();
        }
    };
    const onChange = (e) => {
        if (e.target.matches('[data-tm-class]')) setClass(e.target.value);
    };
    const onKey = (e) => {
        if (e.key !== 'Escape' || modal.classList.contains('hidden') || document.getElementById(STAGE_ID)) return;
        e.stopPropagation();
        if (ui?.selected) { ui.selected = null; render(); return; }
        close();
    };
    modal.addEventListener('click', onClick);
    modal.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey, true);
    session = {
        dispose() {
            modal.removeEventListener('click', onClick);
            modal.removeEventListener('change', onChange);
            document.removeEventListener('keydown', onKey, true);
            session = null;
        }
    };
    showAnimatedModal(MODAL_ID);
    playSound('click');
    requestAnimationFrame(() => (modal.querySelector('.tm-empty [data-tm-make]') || modal.querySelector('.ct-close'))?.focus({ preventScroll: true }));
}
