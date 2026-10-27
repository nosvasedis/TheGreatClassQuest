// features/questRemote/duelsWandView.mjs — the Wand's Hero Duels console (pure markup).
// Every button is a `showdown` command with a `duel-…` action: the projector presses its own button
// (ui/modals/heroDuels.js runHeroDuelsCommand), so the phone and the big screen never disagree.
// Panels come from getHeroDuelsPanel(): setup, pick (the whole class), duel (the ring) and finale.
// Styles: styles/quest_remote_duels.css.

import { esc } from './remoteWandView.mjs';

const cmd = (action, extra = '') => `data-qw-cmd="showdown" data-action="${action}"${extra ? ` ${extra}` : ''}`;

function face(hero, avatarOf, cls = 'qwd-face') {
    const url = avatarOf?.(hero.id) || '';
    return url
        ? `<span class="${cls}"><img src="${esc(url)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="${cls} ${cls}--initial">${esc(String(hero.n || '?').charAt(0).toUpperCase())}</span>`;
}

function seg(rule, value, options) {
    return `<div class="qwd-seg" role="radiogroup">${options.map((o) => {
        const on = String(o.key) === String(value);
        return `<button type="button" class="qwd-seg__btn${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" ${cmd('duel-rule', `data-rule="${rule}" data-value="${esc(o.key)}"`)}${o.off ? ' disabled' : ''}>${esc(o.label)}</button>`;
    }).join('')}</div>`;
}

function headHtml(panel, title, sub = '') {
    return `<header class="qwd-head" data-qw-key="qwd-head">
        <span class="qwd-head__crest" aria-hidden="true">⚔️</span>
        <div><h2 class="qw-h2">${esc(title)}</h2><p>${esc(sub || panel.className || '')}</p></div>
        ${panel.undo && panel.view !== 'setup' ? `<button type="button" class="qw-roundbtn" ${cmd('duel-undo')} aria-label="Undo"><i class="fas fa-rotate-left"></i></button>` : ''}
    </header>`;
}

function teamsHtml(panel) {
    if (!panel.teams?.length) return '';
    const top = Math.max(1, ...panel.teams.map((t) => Number(t.pts) || 0));
    return `<div class="qwd-teams" style="--n:${panel.teams.length}" data-qw-key="qwd-teams">${panel.teams.map((t, i) => `
        <div class="qwd-team${t.lead ? ' is-lead' : ''}" style="--team:${esc(t.color)};--fill:${((Number(t.pts) || 0) / top).toFixed(3)}" data-qw-key="qwd-team-${i}">
            <span class="qwd-team__fill" aria-hidden="true"></span>
            <span class="qwd-team__emoji" aria-hidden="true">${esc(t.emoji)}</span><span class="qwd-team__name">${esc(t.name)}</span>
            ${t.lead ? '<i class="fas fa-crown qwd-team__crown" aria-label="In front"></i>' : ''}
            <b>${esc(t.pts)}</b>
        </div>`).join('')}</div>`;
}

/** Before Hero Duels is on the projector: what it is, and the button that opens it there. */
export function duelsLauncherHtml({ className = '' } = {}) {
    return `<section class="qw-show qwd">
        <div class="qwd-launch">
            <div class="qwd-launch__swords" aria-hidden="true"><span>⚔️</span></div>
            <h2 class="qw-h2">Hero Duels</h2>
            <p>Every hero on the big screen on their own. Pick a few, give the points, crown the winner, pick the next ones. Big teams can collect every duel's points.</p>
            <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" ${cmd('duel-open')}><i class="fas fa-bolt" aria-hidden="true"></i> Open Hero Duels${className ? ` for ${esc(className)}` : ''}</button>
            <p class="qw-hint qw-hint--center">It opens for the class selected on the projector (top right).</p>
        </div>
    </section>`;
}

function setupHtml(panel) {
    const teamOpts = [{ key: '0', label: 'Solo' }, ...['2', '3', '4', '5', '6'].map((n) => ({ key: n, label: n }))];
    const sources = [
        { key: 'today', label: 'Today', off: !panel.canToday },
        { key: 'guild', label: 'Mix guilds' },
        { key: 'stars', label: 'By stars' },
        { key: 'random', label: 'Luck' }
    ];
    return `<section class="qw-show qwd">
        ${headHtml(panel, 'Hero Duels', `${panel.className} · ${panel.here} playing${panel.away ? ` · ${panel.away} away` : ''}`)}
        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><span>1</span> Big teams</h3>
            ${seg('teams', String(panel.teamCount), teamOpts)}
            ${panel.teamCount ? `${seg('source', panel.source, sources)}
            ${panel.source === 'today' ? '' : `<button type="button" class="qw-chip" ${cmd('duel-shuffle')}><i class="fas fa-dice" aria-hidden="true"></i> Shuffle the teams</button>`}
            <div class="qwd-preview">${(panel.teams || []).map((t, i) => `<div class="qwd-preview__team" style="--team:${esc(t.color)}"><b>${esc(t.emoji)} ${esc(t.name)} · ${esc(t.size)}</b>${teamLookButton(t.slot ?? i, t.name)}<small>${esc(t.names)}</small></div>`).join('')}</div>`
        : '<p class="qw-hint">Everyone plays for themselves.</p>'}
        </div>
        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><span>2</span> Duel rules</h3>
            <p class="qw-forge__label">Heroes per duel (Pick for me)</p>
            ${seg('size', String(panel.size), ['2', '3', '4', '5', '6'].map((n) => ({ key: n, label: n })))}
            <p class="qw-forge__label">Winner's bonus</p>
            ${seg('bonus', String(panel.bonus), [{ key: '0', label: 'None' }, { key: '1', label: '+1' }, { key: '2', label: '+2' }, { key: '3', label: '+3' }])}
            <p class="qw-forge__label">A duel ends</p>
            ${seg('target', String(panel.target), [{ key: '0', label: 'I crown' }, { key: '3', label: 'First to 3' }, { key: '5', label: 'to 5' }, { key: '10', label: 'to 10' }])}
            <p class="qw-forge__label">Points banked</p>
            ${seg('bank', panel.bank, [{ key: 'all', label: 'Every point' }, { key: 'winner', label: 'Winner takes all' }])}
        </div>
        <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" ${cmd('duel-arena')}${panel.here >= 2 ? '' : ' disabled'}><i class="fas fa-bolt" aria-hidden="true"></i> ${panel.resuming ? 'Back to the arena' : 'Open the arena'}</button>
        <div class="qw-showtools">
            ${panel.resuming ? `<button type="button" class="qw-chip" ${cmd('duel-fresh')}><i class="fas fa-rotate" aria-hidden="true"></i> New game</button>` : ''}
            <button type="button" class="qw-chip" ${cmd('duel-close')}><i class="fas fa-xmark" aria-hidden="true"></i> Close</button>
        </div>
        <p class="qw-hint qw-hint--center">Who plays: heroes away in Roll Call are left out. Tap names on the projector to change it.</p>
    </section>`;
}

function pickHtml(panel, avatarOf) {
    const ready = panel.picked >= 2;
    return `<section class="qw-show qwd${panel.rolling ? ' is-rolling' : ''}">
        ${headHtml(panel, `Duel ${panel.duelNo}`, panel.last || `${panel.className} · who duels next?`)}
        ${teamsHtml(panel)}
        <div class="qwd-pickbar" data-qw-key="qwd-pickbar">
            <button type="button" class="qw-btn qw-btn--ghost qwd-pickbar__dice" ${cmd('duel-suggest')}${panel.rolling ? ' disabled' : ''}><i class="fas fa-dice" aria-hidden="true"></i> Pick ${esc(panel.size)}</button>
            <button type="button" class="qw-btn qw-btn--gold qwd-pickbar__go" ${cmd('duel-start')}${ready ? '' : ' disabled'}><i class="fas fa-bolt" aria-hidden="true"></i> ${ready ? `Start: ${esc(panel.picked)} heroes` : 'Tap 2 to 6 heroes'}</button>
        </div>
        <p class="qw-hint qwd-hint">${panel.waiting ? `${esc(panel.waiting)} not duelled yet · ` : ''}tap a hero to pick or unpick${panel.picked ? ` · <button type="button" class="qwd-link" ${cmd('duel-clear')}>clear</button>` : ''}</p>
        <div class="qwd-heroes">${(panel.heroes || []).map((h) => `
            <button type="button" class="qwd-hero${h.k ? ' is-picked' : ''}${h.d ? '' : ' is-new'}" style="${h.c ? `--team:${esc(h.c)}` : ''}" ${cmd('duel-pick', `data-student="${esc(h.id)}"`)} data-qw-key="qwd-h-${esc(h.id)}" aria-pressed="${Boolean(h.k)}">
                ${h.k ? `<span class="qwd-hero__no">${esc(h.k)}</span>` : ''}
                ${h.w ? `<span class="qwd-hero__crowns"><i class="fas fa-crown" aria-hidden="true"></i>${h.w > 1 ? esc(h.w) : ''}</span>` : ''}
                ${face(h, avatarOf)}
                <span class="qwd-hero__name">${esc(h.n)}</span>
                <b class="qwd-hero__pts">${esc(h.p)}</b>
            </button>`).join('')}</div>
        <div class="qw-showctrl">
            <button type="button" class="qw-roundbtn qw-roundbtn--lg" ${cmd('duel-setup')} aria-label="Players, teams and rules"><i class="fas fa-sliders"></i><small>Rules</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg qw-roundbtn--gold" ${cmd('duel-finish')} aria-label="Finish the game"${panel.canFinish ? '' : ' disabled'}><i class="fas fa-trophy"></i><small>Finish</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg" ${cmd('duel-close')} aria-label="Close Hero Duels"><i class="fas fa-xmark"></i><small>Close</small></button>
        </div>
    </section>`;
}

function duelHtml(panel, avatarOf) {
    const fighters = panel.fighters || [];
    const leader = fighters.find((f) => f.id === panel.leader);
    return `<section class="qw-show qwd">
        ${headHtml(panel, `Duel ${panel.duelNo}`, `${panel.target ? `First to ${panel.target}` : 'You crown the winner'}${panel.bonus ? ` · winner +${panel.bonus}` : ''}`)}
        ${teamsHtml(panel)}
        <div class="qwd-fighters" style="--n:${fighters.length}">${fighters.map((f, i) => `
            ${i ? '<span class="qwd-vs" aria-hidden="true">VS</span>' : ''}
            <div class="qwd-fighter${f.lead ? ' is-lead' : ''}${f.lead && panel.tie ? ' is-tied' : ''}" style="--team:${esc(f.color)}" data-qw-key="qwd-f-${esc(f.id)}">
                <div class="qwd-fighter__who">
                    ${face(f, avatarOf, 'qwd-face qwd-face--lg')}
                    <span class="qwd-fighter__text"><b>${esc(f.n)}</b>${f.team ? `<small>${esc(f.team)}</small>` : ''}</span>
                    <span class="qwd-fighter__score">${esc(f.s)}</span>
                </div>
                <div class="qwd-fighter__pad">
                    <button type="button" class="qwd-pt qwd-pt--minus" ${cmd('duel-point', `data-student="${esc(f.id)}" data-delta="-1"`)} aria-label="Take a point from ${esc(f.n)}">−1</button>
                    ${[1, 2, 3].map((n) => `<button type="button" class="qwd-pt" ${cmd('duel-point', `data-student="${esc(f.id)}" data-delta="${n}"`)} aria-label="Give ${esc(f.n)} ${n}">+${n}</button>`).join('')}
                    <button type="button" class="qwd-pt qwd-pt--crown" ${cmd('duel-crown', `data-student="${esc(f.id)}"`)} aria-label="Crown ${esc(f.n)}"><i class="fas fa-crown"></i></button>
                </div>
            </div>`).join('')}</div>
        ${leader ? `<button type="button" class="qw-btn qw-btn--gold qw-btn--wide qwd-crown" ${cmd('duel-crown', `data-student="${esc(leader.id)}"`)}><i class="fas fa-crown" aria-hidden="true"></i> Crown ${esc(leader.n)}</button>`
        : panel.tie ? `<button type="button" class="qw-btn qw-btn--gold qw-btn--wide qwd-crown" ${cmd('duel-share')}><i class="fas fa-crown" aria-hidden="true"></i> A tie: share the crown</button>
            <p class="qw-hint qw-hint--center">Or tap the crown on one hero's row.</p>`
            : '<p class="qw-hint qw-hint--center">Give the first point…</p>'}
        <div class="qw-showtools">
            <button type="button" class="qw-chip" ${cmd('duel-cancel')}><i class="fas fa-ban" aria-hidden="true"></i> Call it off</button>
            <button type="button" class="qw-chip" ${cmd('duel-finish')}><i class="fas fa-trophy" aria-hidden="true"></i> Finish game</button>
        </div>
    </section>`;
}

function finaleHtml(panel) {
    const medal = ['', '🥇', '🥈', '🥉'];
    return `<section class="qw-show qwd">
        <div class="qw-showintro">
            <div class="qw-showintro__lights" aria-hidden="true"><i></i><i></i><i></i></div>
            <span class="qw-showintro__badge" aria-hidden="true"><i class="fas fa-trophy"></i></span>
            <h2 class="qw-h2">${esc(panel.champ || 'The champions are crowned')}</h2>
            <p>${esc(panel.duels)} ${panel.duels === 1 ? 'duel' : 'duels'} fought</p>
            ${teamsHtml(panel)}
            ${panel.podium?.length ? `<ol class="qwd-podium">${panel.podium.map((x) => `<li><span>${medal[x.place] || x.place}</span><b>${esc(x.n)}</b><small>${esc(x.p)} pts</small></li>`).join('')}</ol>` : ''}
        </div>
        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><i class="fas fa-star" aria-hidden="true"></i> Reward stars (optional)</h3>
            ${seg('stars', String(panel.stars), [{ key: '1', label: '1 star' }, { key: '2', label: '2 stars' }, { key: '3', label: '3 stars' }])}
            <div class="qwd-pay">${(panel.groups || []).map((g) => `<button type="button" class="qw-chip${g.owed ? '' : ' is-done'}" ${cmd('duel-pay', `data-scope="${esc(g.key)}"`)}${g.owed && !panel.busy ? '' : ' disabled'}>${esc(g.label)} <small>${g.owed ? esc(g.owed) : '✓'}</small></button>`).join('')}</div>
            <p class="qw-hint">Once per hero per game. Bonus stars on the month and the year; today's stars are untouched.</p>
        </div>
        <div class="qw-showtools">
            <button type="button" class="qw-chip" ${cmd('duel-back')}><i class="fas fa-arrow-left" aria-hidden="true"></i> Back to the arena</button>
            <button type="button" class="qw-chip" ${cmd('duel-fresh')}><i class="fas fa-rotate" aria-hidden="true"></i> New game</button>
            <button type="button" class="qw-chip" ${cmd('duel-close')}><i class="fas fa-check" aria-hidden="true"></i> Done</button>
        </div>
    </section>`;
}

/** The console for whatever Hero Duels shows on the projector. `avatarOf(id)` gives a hero's picture. */
export function duelsWandHtml(panel, { avatarOf = null } = {}) {
    if (panel.view === 'setup') return setupHtml(panel);
    if (panel.view === 'finale') return finaleHtml(panel);
    if (panel.view === 'duel') return duelHtml(panel, avatarOf);
    return pickHtml(panel, avatarOf);
}

/** The two games of Show mode, side by side. */
export function showGamesHtml(game = 'showdown') {
    return `<div class="qwd-games" role="tablist" aria-label="Which game">
        <button type="button" class="qwd-games__tab${game === 'showdown' ? ' is-on' : ''}" role="tab" aria-selected="${game === 'showdown'}" data-qw-game="showdown"><i class="fas fa-people-group" aria-hidden="true"></i> Showdown <small>teams</small></button>
        <button type="button" class="qwd-games__tab${game === 'duels' ? ' is-on' : ''}" role="tab" aria-selected="${game === 'duels'}" data-qw-game="duels"><span aria-hidden="true">⚔️</span> Hero Duels <small>everyone</small></button>
    </div>`;
}

/** The little pen that opens the team name & icon sheet (Hero Duels setup, the Showdown's Team Forge). */
export function teamLookButton(slot, name) {
    return `<button type="button" class="qwd-rename" data-qw-teamlook="${esc(slot)}" aria-label="Rename ${esc(name)} or change the icon"><i class="fas fa-pen" aria-hidden="true"></i></button>`;
}

/**
 * The sheet that renames a team and picks its icon. edit: { slot, name, emoji }; base: the banner's
 * defaults { name, emoji, primary, deep }; icons: the icons to offer. Saved on the class by the projector.
 */
export function teamLookSheetHtml(edit, base, icons) {
    const shown = String(edit.name || '').trim() || base.name;
    return `<div class="qw-sheet__panel qwd-tl" role="dialog" aria-label="Name this team" style="--team:${esc(base.primary)};--team-deep:${esc(base.deep)}">
        <button type="button" class="qw-sheet__grab" data-qw="sheet-close" aria-label="Close"></button>
        <div class="qwd-tl__banner"><span class="qwd-tl__emoji" data-qw-tl-emoji aria-hidden="true">${esc(edit.emoji || base.emoji)}</span><b class="qwd-tl__name" data-qw-tl-shown>${esc(shown)}</b></div>
        <label class="qw-forge__label" for="qwd-tl-name">Team name</label>
        <input id="qwd-tl-name" class="qwd-tl__input" data-qw-tlname type="text" maxlength="18" autocomplete="off" enterkeyhint="done" value="${esc(edit.name || '')}" placeholder="${esc(base.name)}" />
        <p class="qw-forge__label">Icon</p>
        <div class="qwd-tl__icons" role="radiogroup" aria-label="Team icon">${icons.map((ic) => {
        const on = ic === (edit.emoji || base.emoji);
        return `<button type="button" class="qwd-tl__icon${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-qw-tlicon="${esc(ic)}">${esc(ic)}</button>`;
    }).join('')}</div>
        <div class="qwd-tl__foot">
            <button type="button" class="qw-btn qw-btn--ghost" data-qw="tl-reset"><i class="fas fa-rotate-left" aria-hidden="true"></i> Default</button>
            <button type="button" class="qw-btn qw-btn--gold" data-qw="tl-save"><i class="fas fa-check" aria-hidden="true"></i> Save</button>
        </div>
        <p class="qw-hint qw-hint--center">The colours stay. The new name shows on the projector, in Team Maker, Hero Duels and the Showdown.</p>
    </div>`;
}
