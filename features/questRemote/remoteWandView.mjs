// features/questRemote/remoteWandView.mjs — Quest Remote, the Wand's phone screens (pure markup).
// No DOM, no state: remoteWand.js feeds plain data. Styles: styles/quest_remote_wand.css.

import { WAND_VIRTUES, CAST_TABS, TIMER_PRESETS, formatTimerClock } from './remoteCore.mjs';

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const safeIcon = (icon) => (/^fa-[a-z0-9-]+$/.test(icon || '') ? icon : '');

export const WAND_MODES = Object.freeze([
    { key: 'stars', label: 'Stars', icon: 'fa-star' },
    { key: 'stage', label: 'Stage', icon: 'fa-display' },
    { key: 'magic', label: 'Magic', icon: 'fa-wand-sparkles' },
    { key: 'show', label: 'Show', icon: 'fa-bolt' }
]);

export function wandShellHtml({ lite = false } = {}) {
    return `
    <div class="qw-sky" aria-hidden="true">${lite ? '' : '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>'}</div>
    <header class="qw-top">
        <button type="button" class="qw-iconbtn" data-qw="leave" aria-label="Put the Wand down"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
        <div class="qw-top__mid">
            <p class="qw-top__title"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Quest Remote</p>
            <p class="qw-link" data-qw-link data-state="connecting"><span class="qw-link__dot" aria-hidden="true"></span><span data-qw-link-text>Connecting…</span></p>
        </div>
        <button type="button" class="qw-classchip" data-qw="class" aria-label="Choose the class"><span data-qw-class>Class</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
    </header>
    <div class="qw-toast" data-qw-toast role="status" aria-live="polite"></div>
    <main class="qw-main" data-qw-main></main>
    <nav class="qw-modes" aria-label="Wand modes">
        ${WAND_MODES.map((m) => `<button type="button" class="qw-mode" data-qw-mode="${m.key}" aria-label="${m.label}"><i class="fas ${m.icon}" aria-hidden="true"></i><span>${m.label}</span></button>`).join('')}
    </nav>
    <div class="qw-sheet" data-qw-sheet aria-hidden="true"></div>`;
}

/** Before binding: choose one of your live projectors. */
export function chooserHtml(sessions, { loading = false, error = '' } = {}) {
    if (loading) return `<section class="qw-chooser"><div class="qw-orbit" aria-hidden="true"><i></i></div><p class="qw-chooser__lead">Looking for your projectors…</p></section>`;
    if (!sessions.length) {
        return `<section class="qw-chooser">
            <div class="qw-chooser__emblem" aria-hidden="true"><i class="fas fa-tv"></i></div>
            <h2 class="qw-h2">No projector is waiting</h2>
            <p class="qw-chooser__lead">${error ? esc(error) : 'On the classroom computer, press the <b>wand</b> button in the header (or in Projector Mode). Then scan the circle, or come back here.'}</p>
            <button type="button" class="qw-btn qw-btn--gold" data-qw="refresh"><i class="fas fa-rotate" aria-hidden="true"></i> Look again</button>
        </section>`;
    }
    return `<section class="qw-chooser">
        <h2 class="qw-h2">Choose your projector</h2>
        <p class="qw-chooser__lead">Match the four runes on the screen.</p>
        <ul class="qw-sessions">${sessions.map((s) => `<li><button type="button" class="qw-session" data-qw-session="${esc(s.id)}">
            <span class="qw-session__code">${esc(String(s.code || '').split('').join(' '))}</span>
            <span class="qw-session__sub">${s.wandId ? 'A Wand was here before' : 'Waiting for a Wand'}</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i></button></li>`).join('')}</ul>
    </section>`;
}

function face(hero, cls = 'qw-face') {
    const initial = esc(String(hero.first || '?').charAt(0).toUpperCase());
    return hero.avatar
        ? `<span class="${cls}"><img src="${esc(hero.avatar)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="${cls} ${cls}--initial">${initial}</span>`;
}

/** Stars mode: every hero of the class as an orb. */
export function starsHtml(heroes, { className = '', empty = '' } = {}) {
    if (!heroes.length) {
        return `<section class="qw-empty"><i class="fas fa-users-slash" aria-hidden="true"></i><p>${esc(empty || 'Choose a class to see its heroes.')}</p></section>`;
    }
    const shining = heroes.filter((h) => h.stars > 0).length;
    return `<section class="qw-stars">
        <p class="qw-hint"><b>${esc(className)}</b> · ${shining} of ${heroes.length} shine today. Tap a hero to give a star.</p>
        <ul class="qw-orbs">${heroes.map((h, i) => `<li style="--i:${i % 24}">
            <button type="button" class="qw-orb${h.stars > 0 ? ' is-shining' : ''}${h.away ? ' is-away' : ''}${h.pending ? ' is-pending' : ''}" data-qw-hero="${esc(h.id)}" aria-label="${esc(h.first)}${h.stars ? `, ${h.stars} stars today` : ''}${h.away ? ', away' : ''}">
                ${face(h)}
                <span class="qw-orb__name">${esc(h.first)}</span>
                ${h.stars > 0 ? `<span class="qw-orb__stars" aria-hidden="true">${'★'.repeat(Math.min(3, Math.round(h.stars)))}</span>` : ''}
                ${h.away ? '<span class="qw-orb__away" aria-hidden="true"><i class="fas fa-moon"></i></span>' : ''}
            </button></li>`).join('')}</ul>
    </section>`;
}

/** The award sheet: virtue runes, star size, and the star to flick at the screen. */
export function awardSheetHtml(hero, { reason = '', size = 'auto' } = {}) {
    const sizes = [['auto', 'Flick'], ['1', '★'], ['2', '★★'], ['3', '★★★']];
    return `
    <div class="qw-sheet__panel qw-award" role="dialog" aria-label="Award ${esc(hero.first)}">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <div class="qw-award__who">${face(hero, 'qw-face qw-face--lg')}<div><h3 class="qw-h3">${esc(hero.first)}</h3>
            <p class="qw-award__sub">${hero.stars > 0 ? 'Already shining today' : 'Name the virtue, then flick the star'}</p></div></div>
        ${hero.stars > 0 ? `<button type="button" class="qw-btn qw-btn--ghost qw-btn--wide" data-qw="undo" data-id="${esc(hero.id)}"><i class="fas fa-rotate-left" aria-hidden="true"></i> Undo today's stars</button>` : `
        <div class="qw-virtues" role="radiogroup" aria-label="Virtue">
            ${WAND_VIRTUES.map((v) => `<button type="button" role="radio" aria-checked="${reason === v.key}" class="qw-virtue qw-virtue--${v.key}${reason === v.key ? ' is-on' : ''}" data-qw-virtue="${v.key}">
                <span class="qw-virtue__rune" aria-hidden="true">${v.rune}</span><i class="fas ${v.icon}" aria-hidden="true"></i><span>${v.name}</span></button>`).join('')}
        </div>
        <div class="qw-sizes" role="radiogroup" aria-label="How many stars">${sizes.map(([k, l]) => `<button type="button" role="radio" aria-checked="${size === k}" class="qw-size${size === k ? ' is-on' : ''}" data-qw-size="${k}">${l}</button>`).join('')}</div>
        <div class="qw-flick${reason ? ' is-ready' : ''}" data-qw-flick>
            <div class="qw-flick__trail" aria-hidden="true"></div>
            <button type="button" class="qw-flick__star" data-qw-star aria-label="Send the star"${reason ? '' : ' disabled'}><i class="fas fa-star" aria-hidden="true"></i></button>
            <p class="qw-flick__hint">${reason ? (size === 'auto' ? 'Flick up: faster = more stars' : 'Flick up (or tap) to send') : 'Choose a virtue first'}</p>
        </div>`}
        <div class="qw-award__more">
            ${hero.away
        ? `<button type="button" class="qw-chip" data-qw-att="welcome-back" data-id="${esc(hero.id)}"><i class="fas fa-door-open" aria-hidden="true"></i> Welcome back</button>
               <button type="button" class="qw-chip" data-qw-att="mark-present" data-id="${esc(hero.id)}"><i class="fas fa-user-check" aria-hidden="true"></i> Present</button>`
        : `<button type="button" class="qw-chip" data-qw-att="mark-absent" data-id="${esc(hero.id)}"><i class="fas fa-bed" aria-hidden="true"></i> Away today</button>`}
        </div>
    </div>`;
}

export function classSheetHtml(classes, currentId) {
    return `<div class="qw-sheet__panel" role="dialog" aria-label="Choose the class">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <h3 class="qw-h3">Which class is on screen?</h3>
        <ul class="qw-classlist">${classes.map((c) => `<li><button type="button" class="qw-classopt${c.id === currentId ? ' is-on' : ''}" data-qw-classid="${esc(c.id)}">
            <span class="qw-classopt__logo" aria-hidden="true">${esc(c.logo || '📚')}</span><span>${esc(c.name)}</span>${c.id === currentId ? '<i class="fas fa-check" aria-hidden="true"></i>' : ''}</button></li>`).join('')}</ul>
    </div>`;
}

function panelHtml(panel, secret) {
    if (!panel) return '';
    if (panel.kind === 'quiz') return quizHtml(panel, secret);
    if (panel.kind === 'wheel') {
        return `<section class="qw-panel qw-panel--wheel">
            <p class="qw-panel__title"><i class="fas fa-dharmachakra" aria-hidden="true"></i> Fortune's Wheel</p>
            ${panel.caption ? `<p class="qw-panel__line">${esc(panel.caption)}</p>` : ''}
            ${slingshotHtml(panel.ready)}
            ${panel.next ? `<button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="wheel" data-action="next">${esc(panel.next)} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : ''}
        </section>`;
    }
    if (panel.kind === 'picker') {
        return `<section class="qw-panel qw-panel--picker">
            <p class="qw-panel__title"><i class="fas fa-hand-sparkles" aria-hidden="true"></i> Fair Picker</p>
            <p class="qw-spot${panel.rolling ? ' is-rolling' : ''}">${esc(panel.rolling ? 'Choosing…' : panel.name || 'Who will it be?')}</p>
            ${panel.progress ? `<p class="qw-panel__line">${esc(panel.progress)}</p>` : ''}
            ${shakeHtml()}
            <div class="qw-row">
                ${panel.canPass ? '<button type="button" class="qw-chip" data-qw-cmd="picker" data-action="pass"><i class="fas fa-rotate-left" aria-hidden="true"></i> Not now</button>' : ''}
                ${panel.canPass ? [5, 10, 20].map((s) => `<button type="button" class="qw-chip" data-qw-cmd="picker" data-action="think${s}"><i class="fas fa-hourglass-half" aria-hidden="true"></i> ${s}s</button>`).join('') : ''}
                <button type="button" class="qw-chip" data-qw-cmd="picker" data-action="fresh"><i class="fas fa-arrows-rotate" aria-hidden="true"></i> Fresh round</button>
            </div>
        </section>`;
    }
    if (panel.kind === 'wall') {
        return `<section class="qw-panel qw-panel--wall">
            <p class="qw-panel__title"><i class="fas fa-tv" aria-hidden="true"></i> Projector Mode</p>
            <div class="qw-deck" data-qw-swipe="wall">
                <button type="button" class="qw-deck__btn" data-qw-cmd="wall" data-action="prev" aria-label="Previous card"><i class="fas fa-backward-step"></i></button>
                <button type="button" class="qw-deck__btn qw-deck__btn--main" data-qw-cmd="wall" data-action="pin" aria-label="${panel.pinned ? 'Unpin' : 'Pin'} this card"><i class="fas fa-thumbtack"></i><span>${panel.pinned ? 'Pinned' : 'Pin'}</span></button>
                <button type="button" class="qw-deck__btn" data-qw-cmd="wall" data-action="next" aria-label="Next card"><i class="fas fa-forward-step"></i></button>
            </div>
            <p class="qw-panel__line">Swipe here to change cards</p>
            <div class="qw-row">
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="reveal"><i class="fas fa-eye" aria-hidden="true"></i> Reveal answer</button>
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="deck"><i class="fas fa-layer-group" aria-hidden="true"></i> Card deck</button>
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="toggle"><i class="fas fa-power-off" aria-hidden="true"></i> Leave</button>
            </div>
        </section>`;
    }
    if (panel.kind === 'dragon') {
        return `<section class="qw-panel qw-panel--dragon"><p class="qw-panel__title"><i class="fas fa-dragon" aria-hidden="true"></i> The Quiet Dragon</p>
            <p class="qw-panel__line">Use the buttons below; Back ends the session.</p></section>`;
    }
    if (panel.kind === 'showdown') return '';
    return '';
}

export function slingshotHtml(ready) {
    return `<div class="qw-sling${ready ? '' : ' is-waiting'}" data-qw-sling>
        <div class="qw-sling__track" aria-hidden="true"><span class="qw-sling__fill" data-qw-sling-fill></span></div>
        <button type="button" class="qw-sling__knob" data-qw-sling-knob aria-label="Pull down and let go to spin"${ready ? '' : ' disabled'}><i class="fas fa-dharmachakra" aria-hidden="true"></i></button>
        <p class="qw-sling__hint">${ready ? 'Pull down, let go: harder pull, wilder spin' : 'The wheel is busy…'}</p>
    </div>`;
}

export function shakeHtml() {
    return `<button type="button" class="qw-shake" data-qw="shake-pick"><span class="qw-shake__icon" aria-hidden="true"><i class="fas fa-mobile-screen"></i></span>
        <span><b>Shake to summon</b><small>or tap here to pick a hero</small></span></button>`;
}

function quizHtml(panel, secret) {
    const correct = Number.isInteger(secret?.quizCorrect) ? secret.quizCorrect : -1;
    const letters = ['A', 'B', 'C', 'D'];
    if (panel.screen !== 'turn') {
        return `<section class="qw-panel qw-panel--quiz">
            <p class="qw-panel__title"><i class="fas fa-question" aria-hidden="true"></i> Quiz of the Week</p>
            <p class="qw-panel__line">${panel.screen === 'intro' ? 'The show is ready.' : panel.screen === 'results' ? 'The results are in!' : 'Between questions.'}</p>
            ${panel.canNext ? '<button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="quiz" data-action="next">Continue <i class="fas fa-arrow-right" aria-hidden="true"></i></button>' : ''}
        </section>`;
    }
    return `<section class="qw-panel qw-panel--quiz">
        <p class="qw-panel__title"><i class="fas fa-question" aria-hidden="true"></i> Host console <span class="qw-badge">${esc(panel.progress || '')}</span></p>
        ${panel.student ? `<p class="qw-quiz__who"><i class="fas fa-user" aria-hidden="true"></i> ${esc(panel.student)} answers</p>` : ''}
        <p class="qw-quiz__q">${esc(panel.question || '')}</p>
        <p class="qw-quiz__secret"><i class="fas fa-eye-slash" aria-hidden="true"></i> Only you can see the answer: tap what the hero says.</p>
        <div class="qw-quiz__answers">${(panel.options || []).map((o, i) => `<button type="button" class="qw-ans qw-ans--${i}${i === correct ? ' is-correct' : ''}" data-qw-cmd="quiz" data-action="answer" data-index="${i}"${o.closed ? ' disabled' : ''}>
            <span class="qw-ans__key">${letters[i]}</span><span class="qw-ans__text">${esc(o.text)}</span>${i === correct ? '<i class="fas fa-check qw-ans__tick" aria-label="correct"></i>' : ''}</button>`).join('')}</div>
        <div class="qw-row">
            <button type="button" class="qw-chip" data-qw-cmd="quiz" data-action="listen"><i class="fas fa-volume-high" aria-hidden="true"></i> Listen</button>
            ${panel.canSkip ? '<button type="button" class="qw-chip" data-qw-cmd="quiz" data-action="skip"><i class="fas fa-forward" aria-hidden="true"></i> Skip</button>' : ''}
            ${panel.canNext ? '<button type="button" class="qw-chip qw-chip--gold" data-qw-cmd="quiz" data-action="next"><i class="fas fa-arrow-right" aria-hidden="true"></i> Next</button>' : ''}
        </div>
    </section>`;
}

/** Stage mode: what is on the projector, its buttons, and where else to go. */
export function stageHtml(stage, { secret = null, castAllowed = () => true } = {}) {
    const pad = Array.isArray(stage?.pad) ? stage.pad : [];
    const groups = new Map();
    pad.forEach((a) => { const g = a.group || ''; groups.set(g, [...(groups.get(g) || []), a]); });
    const padHtml = [...groups.entries()].map(([g, list]) => `
        ${g ? `<p class="qw-pad__group">${esc(g)}</p>` : ''}
        <div class="qw-pad">${list.map((a) => `<button type="button" class="qw-padbtn${a.primary ? ' is-primary' : ''}${a.danger ? ' is-danger' : ''}" data-qw-pad="${esc(a.id)}">
            ${safeIcon(a.icon) ? `<i class="fas ${safeIcon(a.icon)}" aria-hidden="true"></i>` : ''}<span>${esc(a.label)}</span></button>`).join('')}</div>`).join('');
    const tab = stage?.tab || '';
    return `<section class="qw-stage">
        <div class="qw-now"><span class="qw-now__eyebrow">On the projector</span><strong class="qw-now__title">${esc(stage?.title || '…')}</strong></div>
        ${panelHtml(stage?.panel, secret)}
        <div class="qw-nav">
            <button type="button" class="qw-navbtn" data-qw-cmd="key" data-key="Escape"><i class="fas fa-arrow-left" aria-hidden="true"></i> Back</button>
            <button type="button" class="qw-navbtn" data-qw-cmd="scroll" data-dir="up" aria-label="Scroll up"${stage?.scrollable ? '' : ' disabled'}><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" class="qw-navbtn" data-qw-cmd="scroll" data-dir="down" aria-label="Scroll down"${stage?.scrollable ? '' : ' disabled'}><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
            <button type="button" class="qw-navbtn" data-qw-cmd="key" data-key="Enter" aria-label="Enter"><i class="fas fa-turn-down fa-rotate-90" aria-hidden="true"></i></button>
        </div>
        ${pad.length ? `<h3 class="qw-sub">On this screen</h3>${padHtml}` : '<p class="qw-hint">No buttons on this screen. Use Back, or cast another screen.</p>'}
        <h3 class="qw-sub">Cast a screen</h3>
        <div class="qw-cast">${CAST_TABS.filter((t) => castAllowed(t)).map((t) => `<button type="button" class="qw-castbtn${t.tab === tab && stage?.surface === 'tab' ? ' is-on' : ''}" data-qw-cmd="cast" data-tab="${t.tab}">
            <i class="fas ${t.icon}" aria-hidden="true"></i><span>${esc(t.label)}</span></button>`).join('')}</div>
    </section>`;
}

/** Magic mode: crown, wheel, picker, timers, blackout, dragon, projector mode. */
export function magicHtml(stage, { canCrown = true, canWheel = true } = {}) {
    const t = stage?.timer;
    return `<section class="qw-magic">
        ${canCrown ? `<div class="qw-tile qw-tile--crown">
            <button type="button" class="qw-hold" data-qw-hold="crown" aria-label="Hold to crown today's hero">
                <svg class="qw-hold__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><circle class="qw-hold__run" cx="50" cy="50" r="44"/></svg>
                <i class="fas fa-crown" aria-hidden="true"></i></button>
            <div><b>Crown Today's Hero</b><small>Hold the crown until the ring is full</small></div>
        </div>` : ''}
        <div class="qw-grid">
            ${canWheel ? '<button type="button" class="qw-tile qw-tile--wheel" data-qw-cmd="wheel" data-action="open"><i class="fas fa-dharmachakra" aria-hidden="true"></i><b>Fortune\'s Wheel</b><small>Open, then slingshot</small></button>' : ''}
            <button type="button" class="qw-tile qw-tile--picker" data-qw-cmd="picker" data-action="open"><i class="fas fa-hand-sparkles" aria-hidden="true"></i><b>Fair Picker</b><small>Shake to summon</small></button>
            <button type="button" class="qw-tile qw-tile--dragon" data-qw-cmd="dragon" data-action="open"><i class="fas fa-dragon" aria-hidden="true"></i><b>Quiet Dragon</b><small>Calm the room</small></button>
            <button type="button" class="qw-tile qw-tile--wall${stage?.wall ? ' is-on' : ''}" data-qw-cmd="wall" data-action="toggle"><i class="fas fa-tv" aria-hidden="true"></i><b>Projector Mode</b><small>${stage?.wall ? 'On: tap to leave' : 'The living wallpaper'}</small></button>
        </div>
        <div class="qw-timers">
            <p class="qw-sub"><i class="fas fa-hourglass-half" aria-hidden="true"></i> Timers ${t ? `<span class="qw-badge" data-qw-timer-left>${t.done ? 'Time!' : formatTimerClock(t.remainingMs)}</span>` : ''}</p>
            <div class="qw-row">${TIMER_PRESETS.map((p) => `<button type="button" class="qw-chip" data-qw-cmd="timer" data-action="start" data-seconds="${p.seconds}"><i class="fas ${p.icon}" aria-hidden="true"></i> ${esc(p.label)}</button>`).join('')}</div>
            ${t && !t.done ? `<div class="qw-row">
                <button type="button" class="qw-chip" data-qw-cmd="timer" data-action="${t.paused ? 'resume' : 'pause'}"><i class="fas ${t.paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i> ${t.paused ? 'Resume' : 'Pause'}</button>
                <button type="button" class="qw-chip" data-qw-cmd="timer" data-action="add"><i class="fas fa-plus" aria-hidden="true"></i> 30s</button>
                <button type="button" class="qw-chip" data-qw-cmd="timer" data-action="stop"><i class="fas fa-stop" aria-hidden="true"></i> Stop</button></div>` : ''}
        </div>
        <button type="button" class="qw-blackout${stage?.blackout ? ' is-on' : ''}" data-qw-cmd="blackout" data-on="${stage?.blackout ? 'false' : 'true'}">
            <i class="fas ${stage?.blackout ? 'fa-sun' : 'fa-eye'}" aria-hidden="true"></i>
            <span><b>${stage?.blackout ? 'Lift the curtain' : 'Eyes on me'}</b><small>${stage?.blackout ? 'Show the screen again' : 'Curtains close over the projector'}</small></span>
        </button>
    </section>`;
}

/** Show mode: the Showdown Arena console (and the quiz host console when a quiz is on). */
export function showHtml(stage, { secret = null } = {}) {
    const panel = stage?.panel;
    if (panel?.kind === 'quiz') return `<section class="qw-show">${quizHtml(panel, secret)}</section>`;
    if (panel?.kind !== 'showdown') {
        return `<section class="qw-show">
            <div class="qw-showintro">
                <div class="qw-showintro__lights" aria-hidden="true"><i></i><i></i><i></i></div>
                <h2 class="qw-h2">Showdown Arena</h2>
                <p>Teams race on the big screen. You ask out loud; your Wand gives the points. Today's Team Maker teams play, or the guilds.</p>
                <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="showdown" data-action="open"><i class="fas fa-bolt" aria-hidden="true"></i> Start a Showdown</button>
            </div>
        </section>`;
    }
    if (panel.finished) {
        return `<section class="qw-show">
            <h2 class="qw-h2">${panel.growth ? 'The garden is in bloom' : 'The champions are crowned'}</h2>
            <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="showdown" data-action="reward"><i class="fas fa-star" aria-hidden="true"></i> ${panel.growth ? 'Teamwork star for everyone' : 'Teamwork stars for the winners'}</button>
            <button type="button" class="qw-btn qw-btn--ghost qw-btn--wide" data-qw-cmd="showdown" data-action="close">Close the arena</button>
        </section>`;
    }
    return `<section class="qw-show">
        <p class="qw-sub">${panel.growth ? 'Tap the team that answered well' : `Question ${esc(panel.round)} · tap the team that got it`}</p>
        <div class="qw-teams" style="--n:${panel.teams.length}">${panel.teams.map((t, i) => `
            <div class="qw-team" style="--team:${esc(t.color)}">
                <button type="button" class="qw-team__hit" data-qw-cmd="showdown" data-action="point" data-team="${i}">
                    <span class="qw-team__badge" aria-hidden="true">${esc(t.emoji || t.shape)}</span>
                    <span class="qw-team__name">${esc(t.name)}</span>
                    ${panel.growth ? '' : `<span class="qw-team__score">${esc(t.score)}</span>`}
                    ${!panel.growth && t.streak >= 2 ? `<span class="qw-team__streak"><i class="fas fa-fire"></i>${esc(t.streak)}</span>` : ''}
                </button>
                ${panel.growth ? '' : `<button type="button" class="qw-team__minus" data-qw-cmd="showdown" data-action="minus" data-team="${i}" aria-label="Take a point from ${esc(t.name)}">−1</button>`}
            </div>`).join('')}</div>
        <div class="qw-row qw-row--center">
            <button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="timer"><i class="fas fa-stopwatch" aria-hidden="true"></i> 10s clock</button>
            <button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="next"><i class="fas fa-forward" aria-hidden="true"></i> Next question</button>
            <button type="button" class="qw-chip qw-chip--gold" data-qw-cmd="showdown" data-action="finish"><i class="fas fa-trophy" aria-hidden="true"></i> Finish</button>
        </div>
    </section>`;
}
