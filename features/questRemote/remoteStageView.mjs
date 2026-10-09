// features/questRemote/remoteStageView.mjs — Quest Remote projector markup (pure strings, no DOM, no
// state): the binding rune circle, the star ribbon, the stage timer, the Blackout curtain and the
// Showdown Arena. Styles: styles/quest_remote.css. Driven by remoteHost.js and showdown.js.

import { runeForCodeChar, formatTimerClock, showdownBarLevels, showdownStandings, showdownWinners, showdownAnswerer, showdownGoalText, showdownStarPlayers } from './remoteCore.mjs';

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const RING_RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

function skyStars(count) {
    let html = '';
    for (let i = 0; i < count; i += 1) {
        // deterministic scatter (no Math.random, so the markup is testable and stable)
        const x = (i * 37.17) % 100;
        const y = (i * 61.31) % 100;
        const s = 1 + (i % 3);
        html += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--s:${s}px;--d:${(i % 7) * 0.6}s"></i>`;
    }
    return html;
}

/** The binding circle: QR in the middle, a slowly turning ring of runes, the 4-letter code. */
export function bindingHtml({ qrSvg = '', code = '', lite = false, bound = false } = {}) {
    const runes = Array.from({ length: 24 }, (_, i) => `<span class="qr-ring__rune" style="--i:${i}">${RING_RUNES[i % RING_RUNES.length]}</span>`).join('');
    const codeHtml = String(code).split('').map((ch, i) => `<span class="qr-code__cell" style="--i:${i}"><b>${esc(ch)}</b><small aria-hidden="true">${runeForCodeChar(ch)}</small></span>`).join('');
    return `
    <div class="qr-bind__sky" aria-hidden="true">${skyStars(lite ? 18 : 46)}</div>
    <div class="qr-bind__card">
        <button type="button" class="qr-bind__x" data-qr-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        <p class="qr-bind__eyebrow"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Quest Remote</p>
        <h2 id="qr-bind-title" class="qr-bind__title">${bound ? 'The Wand is awake' : 'Wake the Wand'}</h2>
        <p class="qr-bind__lead" data-qr-lead>${bound
        ? 'Your phone now commands this screen. Award stars, crown heroes, spin the wheel, run the show.'
        : 'Point your phone’s camera at the circle. Your phone becomes the Wand for this screen.'}</p>
        <div class="qr-circle${bound ? ' is-bound' : ''}">
            <div class="qr-ring" aria-hidden="true">${runes}</div>
            <div class="qr-circle__halo" aria-hidden="true"></div>
            <div class="qr-circle__qr" data-qr-target>${qrSvg || '<span class="qr-circle__loading" role="img" aria-label="Drawing the circle"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></span>'}</div>
            <div class="qr-circle__seal" aria-hidden="true"><i class="fas fa-wand-magic-sparkles"></i></div>
        </div>
        <div class="qr-code" role="img" aria-label="Wand code ${esc(String(code).split('').join(' '))}">${codeHtml}</div>
        <p class="qr-bind__status" data-qr-status role="status">${bound ? '<i class="fas fa-circle-check"></i> Bound to your phone' : '<span class="qr-dots" aria-hidden="true"><i></i><i></i><i></i></span> Waiting for your Wand…'}</p>
        <div class="qr-bind__actions">
            <button type="button" class="qr-btn qr-btn--ghost" data-qr-sleep><i class="fas fa-moon" aria-hidden="true"></i> Put the Wand to sleep</button>
            <button type="button" class="qr-btn qr-btn--gold" data-qr-close>${bound ? 'Begin' : 'Keep it waiting'}</button>
        </div>
        <p class="qr-bind__hint">No camera? On your phone, open <b>More › Quest Remote</b> and choose this screen.</p>
    </div>`;
}

const RIBBON_VIRTUES = {
    teamwork: { name: 'Teamwork', icon: 'fa-users', color: '#8b5cf6' },
    creativity: { name: 'Creativity', icon: 'fa-lightbulb', color: '#ec4899' },
    respect: { name: 'Respect', icon: 'fa-hands-helping', color: '#10b981' },
    focus: { name: 'Focus', icon: 'fa-brain', color: '#f59e0b' }
};

/**
 * The star ribbon: drops over a covering window (Projector Mode, a show) when the Wand gives a star,
 * because the hero's Award Stars cloud is hidden underneath. The comet lands on [data-qr-ribbon-target].
 */
export function starRibbonHtml({ name = 'Hero', avatar = '', stars = 0, reason = '', note = '' } = {}) {
    const v = RIBBON_VIRTUES[reason];
    const face = avatar
        ? `<img src="${esc(avatar)}" alt="" decoding="async">`
        : `<span>${esc(String(name).charAt(0).toUpperCase())}</span>`;
    const starRow = stars > 0
        ? `<span class="qr-ribbon__stars" data-qr-ribbon-target aria-label="${stars} star${stars === 1 ? '' : 's'}">${'<i class="fas fa-star"></i>'.repeat(Math.min(3, stars))}</span>`
        : `<span class="qr-ribbon__stars qr-ribbon__stars--note" data-qr-ribbon-target><i class="fas fa-wand-magic-sparkles"></i></span>`;
    return `
    <div class="qr-ribbon__band"${v ? ` style="--qr-virtue:${v.color}"` : ''}>
        <span class="qr-ribbon__face">${face}</span>
        <span class="qr-ribbon__text">
            <strong>${esc(name)}</strong>
            <small>${v ? `<i class="fas ${v.icon}" aria-hidden="true"></i> ${v.name}` : esc(note)}</small>
        </span>
        ${starRow}
    </div>`;
}

const RING_R = 54;
export const TIMER_CIRCUMFERENCE = Math.round(2 * Math.PI * RING_R * 100) / 100;

/** The stage timer: a large ember ring (CSS-animated, so no JavaScript runs per frame). */
export function timerHtml({ label = 'Timer', seconds = 30, remainingMs = seconds * 1000, paused = false } = {}) {
    const total = Math.max(1, seconds) * 1000;
    const done = Math.max(0, Math.min(1, 1 - remainingMs / total));
    return `
    <div class="qr-timer__ring${paused ? ' is-paused' : ''}" style="--qr-dur:${(remainingMs / 1000).toFixed(2)}s;--qr-c:${TIMER_CIRCUMFERENCE};--qr-from:${(done * TIMER_CIRCUMFERENCE).toFixed(2)}">
        <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="qr-timer__track" cx="60" cy="60" r="${RING_R}"/>
            <circle class="qr-timer__run" cx="60" cy="60" r="${RING_R}"/>
        </svg>
        <div class="qr-timer__face">
            <span class="qr-timer__label">${esc(label)}</span>
            <strong class="qr-timer__clock" data-qr-clock>${formatTimerClock(remainingMs)}</strong>
        </div>
    </div>`;
}

/** Blackout: velvet curtains with a calm "Eyes on me" seal. */
export function curtainHtml({ lite = false } = {}) {
    return `
    <div class="qr-curtain__half qr-curtain__half--l" aria-hidden="true"></div>
    <div class="qr-curtain__half qr-curtain__half--r" aria-hidden="true"></div>
    <div class="qr-curtain__seal">
        ${lite ? '' : '<span class="qr-curtain__glow" aria-hidden="true"></span>'}
        <i class="fas fa-eye" aria-hidden="true"></i>
        <strong>Eyes on me</strong>
        <small>The Wand has paused the screen</small>
    </div>`;
}

// ─── Showdown Arena ─────────────────────────────────────────────────────────

const FLOWER_STAGES = ['🌱', '🌿', '🌷', '🌸', '🌻', '🌺'];

/** The flower a Growth Festival team shows after `score` good answers (no number ever shown). */
export function growthFlower(score) {
    const n = Math.max(0, Math.floor(Number(score) || 0));
    return FLOWER_STAGES[Math.min(FLOWER_STAGES.length - 1, Math.floor(n / 2))];
}

/** The hot seat chip under a team: who answers this question ('' hides it). */
export function seatHtml(name) {
    return `<span class="qr-lane__seat" data-qr-seat${name ? '' : ' hidden'}><i class="fas fa-microphone" aria-hidden="true"></i><b>${esc(name)}</b></span>`;
}

function laneHtml(sd, team, index, level, nameOf) {
    const style = `--qr-team:${esc(team.color)};--qr-level:${level.toFixed(3)};--i:${index}`;
    const badge = team.emoji ? esc(team.emoji) : esc(team.shape);
    const got = sd.roundScorers?.includes(index) ? ' is-got' : '';
    const dragon = team.dragon ? ' qr-lane--dragon' : '';
    // every lane keeps the chip's row (an empty one stays invisible), so the bars line up
    const seat = sd.rules?.hotseat ? seatHtml(team.dragon ? '' : nameOf(showdownAnswerer(sd, index))) : '';
    if (sd.growth) {
        return `<li class="qr-lane qr-lane--growth${got}${dragon}" data-team="${index}" style="${style}">
            <div class="qr-lane__pot" aria-hidden="true"><span class="qr-lane__flower" data-qr-flower>${growthFlower(team.score)}</span></div>
            <div class="qr-lane__name"><span class="qr-lane__badge">${badge}</span>${esc(team.name)}</div>
            ${seat}
        </li>`;
    }
    const finish = sd.rules?.goal === 'points' ? '<span class="qr-lane__finish" aria-hidden="true"></span>' : '';
    return `<li class="qr-lane${got}${dragon}" data-team="${index}" style="${style}">
        <div class="qr-lane__score" data-qr-score>${team.score}</div>
        <div class="qr-lane__track">${finish}<div class="qr-lane__bar"><span class="qr-lane__shine" aria-hidden="true"></span></div>
            ${team.streak >= 2 ? `<span class="qr-lane__streak" aria-label="${team.streak} in a row"><i class="fas fa-fire"></i>${team.streak}</span>` : ''}
            <span class="qr-lane__tick" aria-hidden="true"><i class="fas fa-check"></i></span>
        </div>
        <div class="qr-lane__name"><span class="qr-lane__badge">${badge}</span>${esc(team.name)}</div>
        ${seat}
    </li>`;
}

/** The arena. `nameOf(id)` gives a hero's first name (hot seat). */
export function showdownHtml(sd, { secondsLeft = null, nameOf = () => '' } = {}) {
    if (!sd) return '';
    const levels = showdownBarLevels(sd);
    const lanes = sd.teams.map((t, i) => laneHtml(sd, t, i, levels[i], nameOf)).join('');
    const everyone = sd.rules?.style === 'all';
    const foot = sd.rules?.hotseat ? 'The hero at the microphone answers for the team'
        : everyone ? 'Every team writes its answer: the Wand gives the points' : 'Answer out loud: the Wand gives the point';
    return `
    <div class="qr-sd__lights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <header class="qr-sd__head">
        <p class="qr-sd__eyebrow"><i class="fas fa-bolt" aria-hidden="true"></i> ${sd.growth ? 'Garden Showdown' : 'Showdown Arena'}</p>
        <h2 class="qr-sd__title">${esc(sd.title)}</h2>
        ${sd.growth ? `<p class="qr-sd__round">${sd.rules?.goal === 'questions' ? `<span data-qr-goal>${esc(showdownGoalText(sd))}</span> · ` : ''}Every good answer helps your flower grow</p>`
        : `<p class="qr-sd__round"><span data-qr-goal>${esc(showdownGoalText(sd))}</span>${sd.rules?.goal === 'points' ? ` · Question <b data-qr-round>${sd.round}</b>` : ''}</p>`}
        <p class="qr-sd__golden" data-qr-golden${sd.golden ? '' : ' hidden'}><i class="fas fa-coins" aria-hidden="true"></i> ${sd.growth ? 'Golden question · flowers grow twice' : 'Golden question · double points'}</p>
        <p class="qr-sd__blind" data-qr-blind${sd.blind && !sd.growth ? '' : ' hidden'}><i class="fas fa-eye-slash" aria-hidden="true"></i> Scores hidden · the big reveal comes at the end</p>
        ${secondsLeft != null ? `<div class="qr-sd__count" data-qr-count>${secondsLeft}</div>` : ''}
    </header>
    <ol class="qr-sd__lanes" style="--n:${sd.teams.length}">${lanes}</ol>
    <p class="qr-sd__foot">${foot}</p>`;
}

/** The finale: a podium and the star players (or, for Growth Festival, the whole garden in bloom: everyone wins). */
export function showdownFinaleHtml(sd, { nameOf = () => '' } = {}) {
    if (!sd) return '';
    if (sd.growth) {
        return `
        <div class="qr-sd__finale qr-sd__finale--growth">
            <h2 class="qr-sd__title">What a garden!</h2>
            <ul class="qr-garden">${sd.teams.map((t, i) => `<li style="--qr-team:${esc(t.color)};--i:${i}"><span class="qr-garden__flower">${growthFlower(t.score + 4)}</span><b>${esc(t.name)}</b></li>`).join('')}</ul>
            <p class="qr-sd__foot">Every team helped the garden grow.</p>
        </div>`;
    }
    const standings = showdownStandings(sd);
    const winners = new Set(showdownWinners(sd));
    const top = standings.slice(0, 3);
    // podium order: 2nd, 1st, 3rd
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const step = (t) => `<li class="qr-podium__step qr-podium__step--${t.place}" style="--qr-team:${esc(t.color)}">
        <span class="qr-podium__badge">${t.emoji ? esc(t.emoji) : esc(t.shape)}</span>
        <b class="qr-podium__name">${esc(t.name)}</b>
        <span class="qr-podium__score">${t.score}</span>
        <span class="qr-podium__block">${t.place === 1 ? '<i class="fas fa-crown"></i>' : t.place}</span>
    </li>`;
    const champion = standings.filter((t) => winners.has(t.index)).map((t) => esc(t.name)).join(' & ');
    const dragonWon = standings.some((t) => t.dragon && winners.has(t.index)) && winners.size === 1;
    const stars = showdownStarPlayers(sd).slice(0, 3);
    return `
    <div class="qr-sd__finale">
        <p class="qr-sd__eyebrow"><i class="fas fa-trophy" aria-hidden="true"></i> ${dragonWon ? 'The Dragon wins this time' : 'Showdown champions'}</p>
        <h2 class="qr-sd__title">${champion || 'A draw!'}</h2>
        <ol class="qr-podium">${order.map(step).join('')}</ol>
        ${stars.length ? `<div class="qr-stars"><p class="qr-stars__title"><i class="fas fa-microphone" aria-hidden="true"></i> Star players</p>
            <ul>${stars.map((p, i) => `<li style="--i:${i}"><b>${esc(nameOf(p.id) || 'Hero')}</b><span>${p.pts}</span></li>`).join('')}</ul></div>` : ''}
    </div>`;
}

// ─── Charms (Sound Charms, Look here, Spotlight) ────────────────────────────

/** The comic word a Sound Charm bursts onto the projector ("TA-DAA!"), with a ring of rays. */
export function charmBurstHtml({ word = '', icon = 'fa-wand-magic-sparkles', from = '#f59e0b', to = '#fde047' } = {}) {
    const rays = Array.from({ length: 12 }, (_, i) => `<i style="--r:${i * 30}deg"></i>`).join('');
    return `<div class="qr-charm__burst" style="--qr-from:${esc(from)};--qr-to:${esc(to)}">
        <span class="qr-charm__rays" aria-hidden="true">${rays}</span>
        <span class="qr-charm__word"><i class="fas ${esc(icon)}" aria-hidden="true"></i> ${esc(word)}</span>
    </div>`;
}

/** "Look here": a pulsing beacon of rings where the teacher pointed on the Wand's map. */
export function beaconHtml() {
    return `<span class="qr-beacon__ring" aria-hidden="true"></span>
        <span class="qr-beacon__ring qr-beacon__ring--2" aria-hidden="true"></span>
        <span class="qr-beacon__core" aria-hidden="true"><i class="fas fa-wand-magic-sparkles"></i></span>
        <span class="qr-beacon__label">Look here!</span>`;
}

/** Hero Spotlight: the room dims, a beam falls on one hero ("your turn"). */
export function spotlightHtml({ name = 'Hero', avatar = '', line = 'Your turn!' } = {}) {
    const face = avatar
        ? `<img src="${esc(avatar)}" alt="" decoding="async">`
        : `<span>${esc(String(name).charAt(0).toUpperCase())}</span>`;
    return `<div class="qr-spot__beam" aria-hidden="true"></div>
    <div class="qr-spot__stage">
        <span class="qr-spot__face">${face}</span>
        <strong class="qr-spot__name">${esc(name)}</strong>
        <span class="qr-spot__line"><i class="fas fa-star" aria-hidden="true"></i> ${esc(line)} <i class="fas fa-star" aria-hidden="true"></i></span>
    </div>
    <p class="qr-spot__hint">Click anywhere to close</p>`;
}
