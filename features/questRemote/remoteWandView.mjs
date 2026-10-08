// features/questRemote/remoteWandView.mjs — Quest Remote, the Wand's phone screens (pure markup).
// No DOM, no state: remoteWand.js feeds plain data. Styles: styles/quest_remote_wand.css.
// Built for one thumb on a 360–430px phone: 48px+ targets, one scroll column, the four modes at the
// bottom, and the projector's screens drawn as the same clouds the class sees in the dock.

import { WAND_VIRTUES, CAST_TABS, TIMER_PRESETS, CHARM_SOUNDS, CUSTOM_TIMER_MIN, CUSTOM_TIMER_MAX, formatTimerClock } from './remoteCore.mjs';

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const safeIcon = (icon) => (/^fa-[a-z0-9-]+$/.test(icon || '') ? icon : '');
const castOf = (tab) => CAST_TABS.find((t) => t.tab === tab) || null;

export const WAND_MODES = Object.freeze([
    { key: 'stars', label: 'Stars', icon: 'fa-star' },
    { key: 'stage', label: 'Screen', icon: 'fa-display' },
    { key: 'magic', label: 'Magic', icon: 'fa-wand-sparkles' },
    { key: 'lesson', label: 'Lesson', icon: 'fa-hourglass-half' },
    { key: 'show', label: 'Show', icon: 'fa-bolt' }
]);

/** How many Stage Pad buttons show before "Show all". */
export const PAD_PREVIEW = 12;

export function wandShellHtml({ lite = false } = {}) {
    return `
    <div class="qw-sky" aria-hidden="true">${lite ? '' : '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>'}</div>
    <header class="qw-top">
        <button type="button" class="qw-iconbtn" data-qw="leave" aria-label="Put the Wand down"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        <button type="button" class="qw-brand" data-qw="spells" aria-label="Recent spells">
            <span class="qw-brand__seal" aria-hidden="true"><span class="qw-brand__gem"><i class="fas fa-wand-magic-sparkles"></i><span class="qw-brand__glint"></span></span><i class="fas fa-clock-rotate-left qw-brand__log"></i></span>
            <span class="qw-brand__text">
                <b>Quest Remote</b>
                <span class="qw-link" data-qw-link data-state="connecting"><span class="qw-link__dot" aria-hidden="true"></span><span data-qw-link-text>Connecting…</span></span>
            </span>
        </button>
        <button type="button" class="qw-classchip" data-qw="class" aria-label="Choose the class"><span data-qw-class>Class</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
    </header>
    <button type="button" class="qw-now" data-qw="to-stage" data-qw-now aria-label="What is on the projector"></button>
    <div class="qw-toast" data-qw-toast role="status" aria-live="polite"></div>
    <main class="qw-main" data-qw-main></main>
    <nav class="qw-modes" aria-label="Wand modes" style="--n:${WAND_MODES.length}">
        <span class="qw-modes__tip" aria-hidden="true"></span>
        ${WAND_MODES.map((m) => `<button type="button" class="qw-mode" data-qw-mode="${m.key}" aria-label="${m.label}"><span class="qw-mode__pill" aria-hidden="true"><i class="fas ${m.icon}"></i></span><span class="qw-mode__label">${m.label}</span></button>`).join('')}
    </nav>
    <div class="qw-sheet" data-qw-sheet aria-hidden="true"></div>
    <div class="qw-sparks" data-qw-sparks aria-hidden="true"></div>`;
}

/** The strip under the header: what the class sees right now (tap → Screen mode). */
export function nowStripHtml(stage) {
    if (!stage) return '';
    const cast = castOf(stage.tab);
    const panelIcon = { quiz: 'fa-question', wheel: 'fa-dharmachakra', picker: 'fa-hand-sparkles', wall: 'fa-tv', dragon: 'fa-dragon', showdown: 'fa-bolt' }[stage.panel?.kind];
    const icon = panelIcon || (stage.covered ? 'fa-window-maximize' : cast?.icon || 'fa-display');
    const colour = !stage.covered && cast ? `--now-from:${cast.from};--now-to:${cast.to}` : '';
    return `<span class="qw-now__cloud" style="${colour}" aria-hidden="true"><i class="fas ${icon}"></i></span>
        <span class="qw-now__text"><small>On the projector</small><b>${esc(stage.title || cast?.label || '…')}</b></span>
        ${stage.blackout ? '<span class="qw-now__tag"><i class="fas fa-eye"></i> Curtain</span>' : ''}
        ${stage.spotlight ? '<span class="qw-now__tag"><i class="fas fa-lightbulb"></i> Spotlight</span>' : ''}
        ${stage.timer && !stage.timer.done ? `<span class="qw-now__tag qw-now__tag--timer" data-qw-timer-left>${formatTimerClock(stage.timer.remainingMs)}</span>` : ''}
        <i class="fas fa-chevron-right qw-now__go" aria-hidden="true"></i>`;
}

/** Before binding: choose one of your live projectors. */
export function chooserHtml(sessions, { loading = false, error = '' } = {}) {
    if (loading) return `<section class="qw-chooser"><div class="qw-orbit" aria-hidden="true"><i></i></div><p class="qw-chooser__lead">Looking for your projectors…</p></section>`;
    if (!sessions.length) {
        return `<section class="qw-chooser">
            <div class="qw-chooser__emblem" aria-hidden="true"><i class="fas fa-tv"></i></div>
            <h2 class="qw-h2">No projector is waiting</h2>
            <p class="qw-chooser__lead">${error ? esc(error) : 'On the classroom computer, press the <b>wand</b> in the header (or W in Projector Mode). Then scan the circle, or look again here.'}</p>
            <button type="button" class="qw-btn qw-btn--gold" data-qw="refresh"><i class="fas fa-rotate" aria-hidden="true"></i> Look again</button>
        </section>`;
    }
    return `<section class="qw-chooser">
        <h2 class="qw-h2">Choose your projector</h2>
        <p class="qw-chooser__lead">Match the four runes under the circle.</p>
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

/**
 * Stars mode: the class as orbs. `multi` turns taps into a selection (several heroes, one virtue);
 * `note` is a one-line hint about where the stars will appear on the projector.
 */
export function starsHtml(allHeroes, { className = '', empty = '', multi = false, picked = [], note = '', waiting = false } = {}) {
    if (!allHeroes.length) {
        return `<section class="qw-empty"><span class="qw-empty__icon" aria-hidden="true"><i class="fas fa-users"></i></span><p>${esc(empty || 'Choose a class to see its heroes.')}</p></section>`;
    }
    const chosen = new Set(picked);
    const shining = allHeroes.filter((h) => h.stars > 0).length;
    const present = allHeroes.filter((h) => !h.away).length;
    const toShine = allHeroes.filter((h) => !(h.stars > 0) && !h.away);
    // "Still to shine": only the present heroes without a star today, so nobody is forgotten.
    const heroes = waiting ? toShine : allHeroes;
    const pct = present ? Math.round((Math.min(shining, present) / present) * 100) : 0;
    return `<section class="qw-stars${multi ? ' is-multi' : ''}">
        <div class="qw-bar">
            <div class="qw-seg" role="radiogroup" aria-label="Give stars to">
                <button type="button" role="radio" aria-checked="${!multi}" class="qw-seg__btn${multi ? '' : ' is-on'}" data-qw-pick="one">One hero</button>
                <button type="button" role="radio" aria-checked="${multi}" class="qw-seg__btn${multi ? ' is-on' : ''}" data-qw-pick="many">Several</button>
            </div>
            <span class="qw-shine" style="--pct:${pct}" aria-label="${shining} of ${allHeroes.length} shine today"><span class="qw-shine__ring" aria-hidden="true"><i class="fas fa-star"></i></span>${shining}<small>/${allHeroes.length}</small></span>
        </div>
        <button type="button" class="qw-waitchip${waiting ? ' is-on' : ''}" data-qw="waiting" aria-pressed="${waiting}">
            <i class="fas ${waiting ? 'fa-filter-circle-xmark' : 'fa-hourglass-half'}" aria-hidden="true"></i>
            ${waiting ? 'Showing who is still to shine' : 'Still to shine'} <b>${toShine.length}</b>
        </button>
        ${note ? `<p class="qw-note"><i class="fas fa-circle-info" aria-hidden="true"></i> ${esc(note)}</p>` : ''}
        <p class="qw-hint">${multi ? 'Tap the heroes who earned it together, then give the star.' : 'Tap a hero to give a star, or to call them into the spotlight.'}</p>
        ${waiting && !heroes.length ? '<p class="qw-allshine"><i class="fas fa-sun" aria-hidden="true"></i> Every hero in the room shines today!</p>' : ''}
        <ul class="qw-orbs">${heroes.map((h, i) => {
        const isPicked = chosen.has(h.id);
        const locked = h.stars > 0 || h.away;
        return `<li style="--i:${i % 24}">
            <button type="button" class="qw-orb${h.stars > 0 ? ' is-shining' : ''}${h.away ? ' is-away' : ''}${h.pending ? ' is-pending' : ''}${isPicked ? ' is-picked' : ''}${multi && locked ? ' is-muted' : ''}" data-qw-hero="${esc(h.id)}" aria-pressed="${multi ? isPicked : 'false'}" aria-label="${esc(h.first)}${h.stars ? `, ${h.stars} stars today` : ''}${h.away ? ', away' : ''}">
                ${face(h)}
                <span class="qw-orb__name">${esc(h.first)}</span>
                ${h.stars > 0 ? `<span class="qw-orb__stars" aria-hidden="true">${'★'.repeat(Math.min(3, Math.round(h.stars)))}</span>` : ''}
                ${h.away ? '<span class="qw-orb__away" aria-hidden="true"><i class="fas fa-moon"></i></span>' : ''}
                ${multi ? `<span class="qw-orb__check" aria-hidden="true"><i class="fas fa-check"></i></span>` : ''}
            </button></li>`;
    }).join('')}</ul>
        ${multi ? `<div class="qw-multibar${chosen.size ? ' is-ready' : ''}">
            <span class="qw-multibar__count"><b>${chosen.size}</b> chosen</span>
            ${chosen.size ? '<button type="button" class="qw-chip" data-qw="multi-clear">Clear</button>' : ''}
            <button type="button" class="qw-btn qw-btn--gold" data-qw="multi-go"${chosen.size ? '' : ' disabled'}><i class="fas fa-star" aria-hidden="true"></i> Give a star</button>
        </div>` : ''}
    </section>`;
}

/** The award sheet for one hero (or several): virtue, star size, and the star to flick at the screen. */
export function awardSheetHtml(heroOrHeroes, { reason = '', size = 'auto' } = {}) {
    const heroes = Array.isArray(heroOrHeroes) ? heroOrHeroes : [heroOrHeroes];
    const hero = heroes[0];
    const many = heroes.length > 1;
    const sizes = [['auto', 'Flick'], ['1', '★'], ['2', '★★'], ['3', '★★★']];
    const shining = !many && hero.stars > 0;
    const title = many ? `${heroes.length} heroes` : hero.first;
    const faces = many
        ? `<span class="qw-stack">${heroes.slice(0, 4).map((h) => face(h, 'qw-face')).join('')}${heroes.length > 4 ? `<span class="qw-face qw-face--more">+${heroes.length - 4}</span>` : ''}</span>`
        : face(hero, 'qw-face qw-face--lg');
    return `
    <div class="qw-sheet__panel qw-award" role="dialog" aria-label="Award ${esc(title)}">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <div class="qw-award__who">${faces}<div class="qw-award__title"><h3 class="qw-h3">${esc(title)}</h3>
            <p class="qw-award__sub">${shining ? 'Already shining today' : many ? 'One star each, for the same virtue' : 'Name the virtue, then flick the star'}</p></div>
            <button type="button" class="qw-iconbtn qw-iconbtn--sm" data-qw="sheet-close" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
        ${shining ? `<button type="button" class="qw-btn qw-btn--ghost qw-btn--wide" data-qw="undo" data-id="${esc(hero.id)}"><i class="fas fa-rotate-left" aria-hidden="true"></i> Undo today's stars</button>` : `
        <div class="qw-virtues" role="radiogroup" aria-label="Virtue">
            ${WAND_VIRTUES.map((v) => `<button type="button" role="radio" aria-checked="${reason === v.key}" class="qw-virtue qw-virtue--${v.key}${reason === v.key ? ' is-on' : ''}" data-qw-virtue="${v.key}">
                <span class="qw-virtue__icon" aria-hidden="true"><i class="fas ${v.icon}"></i></span><span class="qw-virtue__name">${v.name}</span></button>`).join('')}
        </div>
        <div class="qw-sizes" role="radiogroup" aria-label="How many stars">${sizes.map(([k, l]) => `<button type="button" role="radio" aria-checked="${size === k}" class="qw-size${size === k ? ' is-on' : ''}" data-qw-size="${k}">${l}</button>`).join('')}</div>
        <div class="qw-flick${reason ? ' is-ready' : ''}" data-qw-flick>
            <div class="qw-flick__trail" aria-hidden="true"></div>
            <span class="qw-flick__arrow" aria-hidden="true"><i class="fas fa-angles-up"></i></span>
            <button type="button" class="qw-flick__star" data-qw-star aria-label="Send the star"${reason ? '' : ' disabled'}><i class="fas fa-star" aria-hidden="true"></i></button>
            <p class="qw-flick__hint">${reason ? (size === 'auto' ? 'Flick up · faster flick, more stars' : 'Flick up or tap to send') : 'Choose a virtue first'}</p>
        </div>`}
        ${many ? '' : `<div class="qw-award__more">
            ${hero.away ? '' : `<button type="button" class="qw-chip qw-chip--spot" data-qw-cmd="charm" data-action="spotlight" data-student="${esc(hero.id)}"><i class="fas fa-lightbulb" aria-hidden="true"></i> Spotlight</button>`}
            ${hero.away
        ? `<button type="button" class="qw-chip" data-qw-att="welcome-back" data-id="${esc(hero.id)}"><i class="fas fa-door-open" aria-hidden="true"></i> Welcome back</button>
               <button type="button" class="qw-chip" data-qw-att="mark-present" data-id="${esc(hero.id)}"><i class="fas fa-user-check" aria-hidden="true"></i> Present</button>`
        : `<button type="button" class="qw-chip" data-qw-att="mark-absent" data-id="${esc(hero.id)}"><i class="fas fa-bed" aria-hidden="true"></i> Away today</button>`}
        </div>`}
    </div>`;
}

export function classSheetHtml(classes, currentId) {
    return `<div class="qw-sheet__panel" role="dialog" aria-label="Choose the class">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <h3 class="qw-h3">Which class is on the projector?</h3>
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
            <p class="qw-panel__line">Swipe across the cards to change them</p>
            <div class="qw-row">
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="reveal"><i class="fas fa-eye" aria-hidden="true"></i> Reveal</button>
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="deck"><i class="fas fa-layer-group" aria-hidden="true"></i> Card deck</button>
                <button type="button" class="qw-chip" data-qw-cmd="wall" data-action="toggle"><i class="fas fa-power-off" aria-hidden="true"></i> Leave</button>
            </div>
        </section>`;
    }
    if (panel.kind === 'dragon') {
        return `<section class="qw-panel qw-panel--dragon"><p class="qw-panel__title"><i class="fas fa-dragon" aria-hidden="true"></i> The Quiet Dragon</p>
            <p class="qw-panel__line">The dragon's own buttons are below. Back ends the session.</p></section>`;
    }
    return '';
}

export function slingshotHtml(ready) {
    return `<div class="qw-sling${ready ? '' : ' is-waiting'}" data-qw-sling>
        <div class="qw-sling__track" aria-hidden="true"><span class="qw-sling__fill" data-qw-sling-fill></span></div>
        <button type="button" class="qw-sling__knob" data-qw-sling-knob aria-label="Pull down and let go to spin"${ready ? '' : ' disabled'}><i class="fas fa-dharmachakra" aria-hidden="true"></i></button>
        <p class="qw-sling__hint">${ready ? 'Pull down and let go · harder pull, wilder spin' : 'The wheel is busy…'}</p>
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
        <p class="qw-quiz__secret"><i class="fas fa-eye-slash" aria-hidden="true"></i> Only you see the answer. Tap what the hero says.</p>
        <div class="qw-quiz__answers">${(panel.options || []).map((o, i) => `<button type="button" class="qw-ans qw-ans--${i}${i === correct ? ' is-correct' : ''}" data-qw-cmd="quiz" data-action="answer" data-index="${i}"${o.closed ? ' disabled' : ''}>
            <span class="qw-ans__key">${letters[i]}</span><span class="qw-ans__text">${esc(o.text)}</span>${i === correct ? '<i class="fas fa-check qw-ans__tick" aria-label="correct"></i>' : ''}</button>`).join('')}</div>
        <div class="qw-row">
            <button type="button" class="qw-chip" data-qw-cmd="quiz" data-action="listen"><i class="fas fa-volume-high" aria-hidden="true"></i> Listen</button>
            ${panel.canSkip ? '<button type="button" class="qw-chip" data-qw-cmd="quiz" data-action="skip"><i class="fas fa-forward" aria-hidden="true"></i> Skip</button>' : ''}
            ${panel.canNext ? '<button type="button" class="qw-chip qw-chip--gold" data-qw-cmd="quiz" data-action="next"><i class="fas fa-arrow-right" aria-hidden="true"></i> Next</button>' : ''}
        </div>
    </section>`;
}

/** The dock's clouds on the phone: tap one to cast that screen to the projector. */
export function screensHtml(stage, castAllowed = () => true) {
    const on = stage?.covered ? '' : stage?.tab || '';
    return `<div class="qw-screens" role="list" aria-label="Cast a screen">${CAST_TABS.filter((t) => castAllowed(t)).map((t) => `
        <button type="button" role="listitem" class="qw-cloud${t.tab === on ? ' is-on' : ''}" data-qw-cmd="cast" data-tab="${t.tab}" style="--cloud-from:${t.from};--cloud-to:${t.to}" aria-label="Show ${esc(t.label)} on the projector"${t.tab === on ? ' aria-current="true"' : ''}>
            <span class="qw-cloud__puff" aria-hidden="true"><i class="fas ${t.icon}"></i></span>
            <span class="qw-cloud__label">${esc(t.label)}</span>
        </button>`).join('')}</div>`;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

/** Relative luminance 0..1 of "#rrggbb" (for picking readable ink when the screen gives none). */
export function hexLuminance(hex) {
    if (!HEX6.test(hex || '')) return null;
    const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Inline style that paints a Wand button like its twin on the projector (or '' to keep the Wand look). */
export function padButtonStyle(a) {
    if (!HEX6.test(a?.bg || '')) return '';
    const fill = HEX6.test(a.bg2 || '') ? `linear-gradient(180deg, ${a.bg}, ${a.bg2})` : a.bg;
    const lum = hexLuminance(a.bg);
    const inkLum = hexLuminance(a.fg);
    // Keep the screen's own ink when it reads on that fill; otherwise pick white or deep navy.
    const readable = inkLum != null && Math.abs(inkLum - lum) > 0.28;
    const ink = readable ? a.fg : (lum > 0.45 ? '#1e1b4b' : '#ffffff');
    const border = HEX6.test(a.border || '') ? a.border : 'transparent';
    return `--pb-fill:${fill};--pb-ink:${ink};--pb-line:${border}`;
}

function padButtonHtml(a) {
    const style = padButtonStyle(a);
    const placed = Number.isFinite(a.x) && Number.isFinite(a.y);
    const where = !placed ? ''
        : a.inView
            ? `<span class="qw-padbtn__where" aria-hidden="true"><i style="left:${Math.round(Math.max(0, Math.min(1, a.x)) * 100)}%;top:${Math.round(Math.max(0, Math.min(1, a.y)) * 100)}%"></i></span>`
            : `<span class="qw-padbtn__off" title="${a.y < 0 ? 'Above' : 'Below'} the screen: the projector scrolls to it">${a.y < 0 ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'}</span>`;
    const cls = ['qw-padbtn', style ? 'is-real' : '', a.primary && !style ? 'is-primary' : '', a.danger ? 'is-danger' : '',
        a.round ? `is-${a.round}` : '', a.iconOnly ? 'is-icon' : '', placed && !a.inView ? 'is-off' : ''].filter(Boolean).join(' ');
    const toggle = a.kind === 'toggle';
    return `<button type="button" class="${cls}${toggle ? ' is-toggle' : ''}${toggle && a.on ? ' is-on' : ''}" data-qw-pad="${esc(a.id)}"${toggle ? ` role="switch" aria-checked="${Boolean(a.on)}"` : ''}${style ? ` style="${style}"` : ''}>
            ${safeIcon(a.icon) ? `<span class="qw-padbtn__icon" aria-hidden="true"><i class="fas ${safeIcon(a.icon)}"></i></span>` : ''}<span class="qw-padbtn__label">${esc(a.label)}</span>${toggle ? '<span class="qw-switch" aria-hidden="true"><i></i></span>' : where}</button>`;
}

/** A row of tabs (or a choice group) drawn like the screen's own: the chosen one lit. */
function tabRowHtml(items) {
    return `<div class="qw-tabrow" role="tablist">${items.map((a) => {
        const style = padButtonStyle(a);
        return `<button type="button" role="tab" aria-selected="${Boolean(a.on)}" class="qw-tabchip${a.on ? ' is-on' : ''}${style ? ' is-real' : ''}" data-qw-pad="${esc(a.id)}"${style ? ` style="${style}"` : ''}>
            ${safeIcon(a.icon) ? `<i class="fas ${safeIcon(a.icon)}" aria-hidden="true"></i>` : ''}<span>${esc(a.label)}</span></button>`;
    }).join('')}</div>`;
}

/** A dropdown with the same choices as the projector's (the phone's own picker opens). */
function selectHtml(a) {
    const options = (a.options || []).map((o) => `<option value="${esc(o.value)}"${o.value === a.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<label class="qw-field">
        <span class="qw-field__label">${esc(a.label)}</span>
        <span class="qw-field__select"><select data-qw-select="${esc(a.id)}">${options}</select><i class="fas fa-chevron-down" aria-hidden="true"></i></span>
    </label>`;
}

/** A text box: type on the phone's keyboard, Send puts it into the projector's field. */
function textFieldHtml(a) {
    const attrs = `name="v" placeholder="${esc(a.placeholder || '')}" autocomplete="off" enterkeyhint="send"`;
    const field = a.multiline
        ? `<textarea ${attrs} rows="2">${esc(a.value || '')}</textarea>`
        : `<input type="${a.inputType === 'number' ? 'number' : a.inputType === 'date' ? 'date' : a.inputType === 'time' ? 'time' : 'text'}" ${attrs} value="${esc(a.value || '')}">`;
    return `<form class="qw-field qw-field--text" data-qw-text="${esc(a.id)}">
        <span class="qw-field__label">${esc(a.label)}</span>
        <span class="qw-field__row">${field}<button type="submit" class="qw-field__send" aria-label="Send to the projector"><i class="fas fa-paper-plane" aria-hidden="true"></i></button></span>
    </form>`;
}

/** The screen's controls in its own order: group headings, tab rows, switches, dropdowns, text boxes. */
function padControlsHtml(items) {
    const out = [];
    let lastGroup = null;
    for (let i = 0; i < items.length; i += 1) {
        const a = items[i];
        const group = a.group || '';
        if (group !== lastGroup && group) out.push(`<p class="qw-pad__group">${esc(group)}</p>`);
        lastGroup = group;
        if (a.kind === 'tab') {
            const run = [a];
            while (items[i + 1]?.kind === 'tab' && (items[i + 1].group || '') === group) run.push(items[(i += 1)]);
            out.push(tabRowHtml(run));
        } else if (a.kind === 'select') out.push(selectHtml(a));
        else if (a.kind === 'text') out.push(textFieldHtml(a));
        else out.push(padButtonHtml(a));
    }
    return out.join('');
}

/** Screen mode: what is on the projector, its buttons (looking like the real ones), and the dock's screens. */
export function stageHtml(stage, { secret = null, castAllowed = () => true, padOpen = false } = {}) {
    const pad = Array.isArray(stage?.pad) ? stage.pad : [];
    const shown = padOpen ? pad : pad.slice(0, PAD_PREVIEW);
    const padHtml = padControlsHtml(shown);
    const scroll = stage?.scroll || { canUp: Boolean(stage?.scrollable), canDown: Boolean(stage?.scrollable), at: 0 };
    const scrolls = scroll.canUp || scroll.canDown;
    return `<section class="qw-stage">
        <h3 class="qw-sub"><i class="fas fa-cloud" aria-hidden="true"></i> Screens</h3>
        ${screensHtml(stage, castAllowed)}
        ${panelHtml(stage?.panel, secret)}
        <div class="qw-remote" role="group" aria-label="Move around the screen">
            <button type="button" class="qw-remote__btn qw-remote__btn--back" data-qw-cmd="key" data-key="Escape"><i class="fas fa-arrow-left" aria-hidden="true"></i><span>Back</span></button>
            <button type="button" class="qw-remote__btn" data-qw-cmd="scroll" data-dir="up" aria-label="Scroll up"${scroll.canUp ? '' : ' disabled'}><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" class="qw-remote__btn" data-qw-cmd="scroll" data-dir="down" aria-label="Scroll down"${scroll.canDown ? '' : ' disabled'}><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
            <button type="button" class="qw-remote__btn qw-remote__btn--ok" data-qw-cmd="key" data-key="Enter" aria-label="OK (Enter)"><span>OK</span></button>
        </div>
        ${scrolls ? `<div class="qw-scrollpos" aria-label="Scrolled ${Math.round((scroll.at || 0) * 100)}% down"><i style="--at:${(scroll.at || 0).toFixed(2)}"></i></div>` : ''}
        <h3 class="qw-sub"><i class="fas fa-hand-pointer" aria-hidden="true"></i> On this screen ${pad.length ? `<span class="qw-badge qw-badge--soft">${pad.length}</span>` : ''}</h3>
        ${pad.length ? `<div class="qw-pad">${padHtml}</div>
            ${pad.length > PAD_PREVIEW ? `<button type="button" class="qw-more" data-qw="pad-toggle">${padOpen ? 'Show fewer' : `Show all ${pad.length}`} <i class="fas fa-chevron-${padOpen ? 'up' : 'down'}" aria-hidden="true"></i></button>` : ''}`
        : '<p class="qw-hint">Nothing to press on this screen. Use Back, or tap a cloud above.</p>'}
    </section>`;
}

/** Sound Charms: classroom stings on the projector's speakers, each with its own colour. */
export function charmsHtml() {
    return `<div class="qw-charms">${CHARM_SOUNDS.map((c) => `<button type="button" class="qw-charm" data-qw-cmd="charm" data-action="sound" data-sound="${c.id}" style="--c-from:${c.from};--c-to:${c.to}">
        <span class="qw-charm__orb" aria-hidden="true"><i class="fas ${c.icon}"></i></span><span class="qw-charm__label">${esc(c.label)}</span></button>`).join('')}</div>`;
}

/**
 * "Look here": a small map of the projector (16:9). Tap a spot and a beacon pulses there on the
 * big screen. The screen's buttons in sight show as faint dots so the teacher can find their way.
 */
export function lookHereHtml(stage) {
    const pad = Array.isArray(stage?.pad) ? stage.pad : [];
    const dots = pad.filter((a) => a.inView && Number.isFinite(a.x) && Number.isFinite(a.y))
        .slice(0, 24)
        .map((a) => `<i style="left:${Math.round(Math.max(0, Math.min(1, a.x)) * 100)}%;top:${Math.round(Math.max(0, Math.min(1, a.y)) * 100)}%"></i>`).join('');
    const cast = castOf(stage?.tab);
    const title = stage?.title || cast?.label || 'The projector';
    return `<div class="qw-look">
        <button type="button" class="qw-look__map" data-qw-map aria-label="Tap where the class should look">
            <span class="qw-look__dots" aria-hidden="true">${dots}</span>
            <span class="qw-look__title" aria-hidden="true">${esc(title)}</span>
            <span class="qw-look__dock" aria-hidden="true"></span>
        </button>
        <p class="qw-look__hint"><i class="fas fa-hand-pointer" aria-hidden="true"></i> Tap the spot: a beacon pulses there on the big screen</p>
    </div>`;
}

/** Dial any timer from 1 to 30 minutes. */
export function customTimerHtml(minutes = 3) {
    return `<div class="qw-custom" role="group" aria-label="Your own timer">
        <button type="button" class="qw-roundbtn" data-qw="tmin-down" aria-label="One minute less"${minutes <= CUSTOM_TIMER_MIN ? ' disabled' : ''}><i class="fas fa-minus"></i></button>
        <span class="qw-custom__val"><b>${esc(minutes)}</b><small>min</small></span>
        <button type="button" class="qw-roundbtn" data-qw="tmin-up" aria-label="One minute more"${minutes >= CUSTOM_TIMER_MAX ? ' disabled' : ''}><i class="fas fa-plus"></i></button>
        <button type="button" class="qw-btn qw-btn--ember" data-qw-cmd="timer" data-action="start" data-seconds="${minutes * 60}"><i class="fas fa-play" aria-hidden="true"></i> Start</button>
    </div>`;
}

/** Magic mode: the class's big moments (crown, wheel, picker, dragon, Projector Mode) and Sound Charms. */
export function magicHtml(stage, { canCrown = true, canWheel = true } = {}) {
    return `<section class="qw-magic">
        ${canCrown ? `<div class="qw-crown">
            <button type="button" class="qw-hold" data-qw-hold="crown" aria-label="Hold to crown today's hero">
                <svg class="qw-hold__ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><circle class="qw-hold__run" cx="50" cy="50" r="44"/></svg>
                <i class="fas fa-crown" aria-hidden="true"></i></button>
            <div class="qw-crown__text"><b>Crown Today's Hero</b><small>Hold the crown until the ring is full</small></div>
        </div>` : ''}
        <div class="qw-grid">
            ${canWheel ? '<button type="button" class="qw-tile qw-tile--wheel" data-qw-cmd="wheel" data-action="open"><span class="qw-tile__icon" aria-hidden="true"><i class="fas fa-dharmachakra"></i></span><b>Fortune\'s Wheel</b><small>Open, then pull the lever</small></button>' : ''}
            <button type="button" class="qw-tile qw-tile--picker" data-qw-cmd="picker" data-action="open"><span class="qw-tile__icon" aria-hidden="true"><i class="fas fa-hand-sparkles"></i></span><b>Fair Picker</b><small>Shake to summon</small></button>
            <button type="button" class="qw-tile qw-tile--dragon" data-qw-cmd="dragon" data-action="open"><span class="qw-tile__icon" aria-hidden="true"><i class="fas fa-dragon"></i></span><b>Quiet Dragon</b><small>Calm the room</small></button>
            <button type="button" class="qw-tile qw-tile--wall${stage?.wall ? ' is-on' : ''}" data-qw-cmd="wall" data-action="toggle"><span class="qw-tile__icon" aria-hidden="true"><i class="fas fa-tv"></i></span><b>Projector Mode</b><small>${stage?.wall ? 'On · tap to leave' : 'The living wallpaper'}</small></button>
        </div>
        <h3 class="qw-sub"><i class="fas fa-music" aria-hidden="true"></i> Sound charms</h3>
        ${charmsHtml()}
    </section>`;
}

/** The running timer as a large ember ring (the phone counts it down itself between updates). */
export function timerCardHtml(t) {
    if (!t) return '';
    const pct = Math.max(0, Math.min(1, t.remainingMs / (t.total * 1000 || 1)));
    return `<div class="qw-timer${t.paused ? ' is-paused' : ''}" style="--p:${pct.toFixed(3)}" data-qw-timer-card>
        <span class="qw-timer__ring" aria-hidden="true"><span class="qw-timer__glow"></span></span>
        <span class="qw-timer__text"><small>${esc(t.label)}${t.paused ? ' · paused' : ''}</small><b data-qw-timer-left>${formatTimerClock(t.remainingMs)}</b></span>
        <span class="qw-timer__ctrl">
            <button type="button" class="qw-roundbtn" data-qw-cmd="timer" data-action="${t.paused ? 'resume' : 'pause'}" aria-label="${t.paused ? 'Resume' : 'Pause'}"><i class="fas ${t.paused ? 'fa-play' : 'fa-pause'}"></i></button>
            <button type="button" class="qw-roundbtn" data-qw-cmd="timer" data-action="add" aria-label="Add 30 seconds">+30</button>
            <button type="button" class="qw-roundbtn" data-qw-cmd="timer" data-action="stop" aria-label="Stop the timer"><i class="fas fa-stop"></i></button>
        </span>
    </div>`;
}

/** Lesson mode: the running of the room. Timers, attention (curtain, spotlight) and Look here. */
export function lessonHtml(stage, { customMinutes = 3 } = {}) {
    const t = stage?.timer && !stage.timer.done ? stage.timer : null;
    return `<section class="qw-lesson">
        <h3 class="qw-sub"><i class="fas fa-hourglass-half" aria-hidden="true"></i> Timers</h3>
        ${timerCardHtml(t)}
        <div class="qw-dials">${TIMER_PRESETS.map((p) => `<button type="button" class="qw-dial" data-qw-cmd="timer" data-action="start" data-seconds="${p.seconds}">
            <span class="qw-dial__face" aria-hidden="true"><i class="fas ${p.icon}"></i></span><b>${esc(p.label)}</b>${p.seconds < 120 ? `<small>${p.seconds}s</small>` : ''}</button>`).join('')}</div>
        ${customTimerHtml(customMinutes)}
        <h3 class="qw-sub"><i class="fas fa-eye" aria-hidden="true"></i> Attention</h3>
        <button type="button" class="qw-blackout${stage?.blackout ? ' is-on' : ''}" data-qw-cmd="blackout" data-on="${stage?.blackout ? 'false' : 'true'}">
            <span class="qw-blackout__icon" aria-hidden="true"><i class="fas ${stage?.blackout ? 'fa-sun' : 'fa-eye'}"></i></span>
            <span><b>${stage?.blackout ? 'Lift the curtain' : 'Eyes on me'}</b><small>${stage?.blackout ? 'Show the screen again' : 'Curtains close over the projector'}</small></span>
        </button>
        ${stage?.spotlight ? `<button type="button" class="qw-btn qw-btn--ghost qw-btn--wide" data-qw-cmd="charm" data-action="unspot"><i class="fas fa-lightbulb" aria-hidden="true"></i> Close the spotlight</button>` : ''}
        <h3 class="qw-sub"><i class="fas fa-location-crosshairs" aria-hidden="true"></i> Look here</h3>
        ${lookHereHtml(stage)}
    </section>`;
}

/** Show mode: the Showdown Arena console (and the quiz host console when a quiz is on). */
export function showHtml(stage, { secret = null, clock = 0 } = {}) {
    const panel = stage?.panel;
    if (panel?.kind === 'quiz') return `<section class="qw-show">${quizHtml(panel, secret)}</section>`;
    if (panel?.kind !== 'showdown') {
        return `<section class="qw-show">
            <div class="qw-showintro">
                <div class="qw-showintro__lights" aria-hidden="true"><i></i><i></i><i></i></div>
                <span class="qw-showintro__badge" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                <h2 class="qw-h2">Showdown Arena</h2>
                <p>Teams race on the big screen. You ask out loud; your Wand gives the points. Today's Team Maker teams play, or the guilds.</p>
                <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="showdown" data-action="open"><i class="fas fa-bolt" aria-hidden="true"></i> Start a Showdown</button>
            </div>
            <p class="qw-hint qw-hint--center">With Quiz of the Week on screen (Elite), this becomes your private host console.</p>
        </section>`;
    }
    if (panel.finished) {
        return `<section class="qw-show">
            <div class="qw-showintro">
                <span class="qw-showintro__badge" aria-hidden="true"><i class="fas ${panel.growth ? 'fa-seedling' : 'fa-trophy'}"></i></span>
                <h2 class="qw-h2">${panel.growth ? 'The garden is in bloom' : 'The champions are crowned'}</h2>
                <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="showdown" data-action="reward"><i class="fas fa-star" aria-hidden="true"></i> ${panel.growth ? 'Teamwork star for everyone' : 'Teamwork stars for the winners'}</button>
                <button type="button" class="qw-btn qw-btn--ghost qw-btn--wide" data-qw-cmd="showdown" data-action="close">Close the arena</button>
            </div>
        </section>`;
    }
    const max = Math.max(1, ...panel.teams.map((t) => Number(t.score) || 0));
    const top = Math.max(0, ...panel.teams.map((t) => Number(t.score) || 0));
    const clockLeft = Number.isFinite(clock) && clock > 0 ? clock : 0;
    return `<section class="qw-show${panel.golden ? ' is-golden' : ''}">
        <div class="qw-showhead">
            <span class="qw-showhead__round">${panel.growth ? '<i class="fas fa-seedling" aria-hidden="true"></i> Garden Showdown' : `<i class="fas fa-bolt" aria-hidden="true"></i> Question <b>${esc(panel.round)}</b>`}</span>
            <span class="qw-showhead__hint">Tap the team that ${panel.growth ? 'answered well' : 'got it'}</span>
        </div>
        <div class="qw-teams" style="--n:${panel.teams.length}">${panel.teams.map((t, i) => {
        const lead = !panel.growth && top > 0 && Number(t.score) === top;
        return `
            <div class="qw-team${lead ? ' is-leading' : ''}" style="--team:${esc(t.color)};--lvl:${panel.growth ? 0 : ((Number(t.score) || 0) / max).toFixed(3)}">
                <button type="button" class="qw-team__hit" data-qw-cmd="showdown" data-action="point" data-team="${i}" aria-label="Point to ${esc(t.name)}">
                    <span class="qw-team__badge" aria-hidden="true">${esc(t.emoji || t.shape)}</span>
                    <span class="qw-team__name">${esc(t.name)}</span>
                    ${panel.growth ? '<span class="qw-team__grow" aria-hidden="true"><i class="fas fa-seedling"></i> grow</span>' : `<span class="qw-team__score">${esc(t.score)}</span>`}
                    ${!panel.growth && t.streak >= 2 ? `<span class="qw-team__streak"><i class="fas fa-fire"></i>${esc(t.streak)}</span>` : ''}
                    ${lead ? '<span class="qw-team__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>' : ''}
                    ${panel.growth ? '' : '<span class="qw-team__bar" aria-hidden="true"></span>'}
                </button>
                ${panel.growth ? '' : `<button type="button" class="qw-team__minus" data-qw-cmd="showdown" data-action="minus" data-team="${i}" aria-label="Take a point from ${esc(t.name)}">−1</button>`}
            </div>`;
    }).join('')}</div>
        <button type="button" class="qw-golden${panel.golden ? ' is-on' : ''}" data-qw-cmd="showdown" data-action="golden" aria-pressed="${Boolean(panel.golden)}">
            <span class="qw-golden__coin" aria-hidden="true"><i class="fas fa-coins"></i></span>
            <span><b>${panel.golden ? 'Golden question is on' : 'Golden question'}</b><small>${panel.golden ? 'The next point counts double · tap to cancel' : (panel.growth ? 'The next good answer grows the flower twice' : 'The next point counts double')}</small></span>
        </button>
        <div class="qw-showctrl">
            <button type="button" class="qw-roundbtn qw-roundbtn--lg${clockLeft ? ' is-counting' : ''}" data-qw-cmd="showdown" data-action="timer" aria-label="Ten second clock"><i class="fas fa-stopwatch"></i><small data-qw-clock>${clockLeft ? `${clockLeft}s` : '10s'}</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg" data-qw-cmd="showdown" data-action="next" aria-label="Next question"><i class="fas fa-forward"></i><small>Next</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg qw-roundbtn--gold" data-qw-cmd="showdown" data-action="finish" aria-label="Finish"><i class="fas fa-trophy"></i><small>Finish</small></button>
        </div>
    </section>`;
}

/** Recent spells: what the projector did with the Wand's last commands (this phone only). */
export function spellsSheetHtml(log = [], nowMs = Date.now()) {
    const ago = (at) => {
        const s = Math.max(0, Math.round((nowMs - at) / 1000));
        if (s < 10) return 'just now';
        if (s < 60) return `${s}s ago`;
        const m = Math.round(s / 60);
        return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
    };
    return `<div class="qw-sheet__panel qw-spells" role="dialog" aria-label="Recent spells">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <div class="qw-spells__head"><h3 class="qw-h3"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> Recent spells</h3>
            <button type="button" class="qw-iconbtn qw-iconbtn--sm" data-qw="sheet-close" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
        ${log.length ? `<ol class="qw-spells__list">${log.map((e) => `<li class="qw-spell${e.ok ? '' : ' is-warn'}">
            <span class="qw-spell__icon" aria-hidden="true"><i class="fas ${e.ok ? 'fa-wand-magic-sparkles' : 'fa-triangle-exclamation'}"></i></span>
            <span class="qw-spell__text">${esc(e.text)}</span><small class="qw-spell__time">${ago(e.at)}</small></li>`).join('')}</ol>`
        : '<p class="qw-hint qw-hint--center">Nothing cast yet. Every star, spin and charm the projector performs shows here.</p>'}
    </div>`;
}
