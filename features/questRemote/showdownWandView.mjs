// features/questRemote/showdownWandView.mjs — the Wand's Showdown screens (pure markup).
// The Team Forge (split the room, move heroes, set the rules and where the questions come from), the host
// console while the show runs (with the deck's question and its answer, for the teacher's eyes only), and
// the finale's rewards. remoteWand.js builds the plain data; styles: styles/quest_remote_wand.css.

import { SHOWDOWN_CLOCK_CHOICES, SHOWDOWN_GOAL_MIN, SHOWDOWN_GOAL_MAX } from './remoteCore.mjs';

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The six ways to split the room, in the order the Forge offers them. */
export const FORGE_SPLITS = Object.freeze([
    { key: 'fair', label: 'Fair', hint: 'Even on stars', icon: 'fa-scale-balanced' },
    { key: 'mixed', label: 'Mixed', hint: 'Guilds mixed', icon: 'fa-shuffle' },
    { key: 'random', label: 'Luck', hint: 'Pure luck', icon: 'fa-dice' },
    { key: 'guilds', label: 'Guilds', hint: 'As they are', icon: 'fa-shield-halved' },
    { key: 'today', label: 'Today', hint: 'Team Maker', icon: 'fa-people-group' },
    { key: 'dragon', label: 'Dragon', hint: 'Class vs Dragon', icon: 'fa-dragon' }
]);

const COUNTED = new Set(['fair', 'mixed', 'random']);

/** Where the questions come from. */
export const FORGE_DECKS = Object.freeze([
    { key: 'voice', label: 'I ask', icon: 'fa-comment-dots', hint: 'You ask out loud, as always. The arena keeps the score.' },
    { key: 'quiz', label: 'Past quizzes', icon: 'fa-scroll', hint: 'Questions from Quiz of the Week quizzes this class has already played, the ones it missed first. This week\'s quiz stays a secret until it is played.' },
    { key: 'words', label: 'Book words', icon: 'fa-book-open', hint: 'Quick questions from the words of the book units you have been teaching (from your homework notes): gap-fills, meanings in Greek and back.' },
    { key: 'mix', label: 'Both', icon: 'fa-layer-group', hint: 'Past quiz questions and book words take turns.' }
]);

function seg(rule, value, options) {
    return `<div class="qw-seg qw-seg--${options.length}" role="radiogroup">${options.map((o) => `
        <button type="button" class="qw-seg__btn${o.key === value ? ' is-on' : ''}" role="radio" aria-checked="${o.key === value}"
            data-qw-rule="${rule}" data-value="${esc(o.key)}">${esc(o.label)}</button>`).join('')}</div>`;
}

function toggle(rule, on, title, hint, icon) {
    return `<button type="button" class="qw-ftoggle${on ? ' is-on' : ''}" data-qw-rule="${rule}" role="switch" aria-checked="${on}">
        <span class="qw-ftoggle__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
        <span class="qw-ftoggle__text"><b>${esc(title)}</b><small>${esc(hint)}</small></span>
        <span class="qw-switch" aria-hidden="true"><i></i></span>
    </button>`;
}

function stepper(act, value, label, { min, max }) {
    return `<div class="qw-fstep" role="group" aria-label="${esc(label)}">
        <button type="button" class="qw-roundbtn" data-qw="${act}-down" aria-label="Fewer"${value <= min ? ' disabled' : ''}><i class="fas fa-minus"></i></button>
        <b class="qw-fstep__value">${esc(value)}</b>
        <button type="button" class="qw-roundbtn" data-qw="${act}-up" aria-label="More"${value >= max ? ' disabled' : ''}><i class="fas fa-plus"></i></button>
    </div>`;
}

/**
 * The Team Forge. model: { className, here, away, split, count, minCount, maxCount, canToday, canGuilds,
 * growth, teams: [{ name, color, emoji, dragon, stars, members: [{ id, first }] }], rules, note }.
 */
export function forgeHtml(model) {
    const m = model || {};
    const rules = m.rules || {};
    const teams = m.teams || [];
    const splits = FORGE_SPLITS.map((s) => {
        const off = (s.key === 'today' && !m.canToday) || (s.key === 'guilds' && !m.canGuilds);
        return `<button type="button" class="qw-split${s.key === m.split ? ' is-on' : ''}" data-qw-split="${s.key}" role="radio" aria-checked="${s.key === m.split}"${off ? ' disabled' : ''}>
            <span class="qw-split__icon" aria-hidden="true"><i class="fas ${s.icon}"></i></span><b>${s.label}</b><small>${off ? (s.key === 'today' ? 'None today' : 'No guilds') : s.hint}</small></button>`;
    }).join('');
    const movable = teams.filter((t) => !t.dragon).length > 1;
    const teamCards = teams.map((t, i) => `
        <div class="qw-fteam${t.dragon ? ' qw-fteam--dragon' : ''}" style="--team:${esc(t.color)};--i:${i}" data-qw-key="fteam-${i}">
            <div class="qw-fteam__head"><span class="qw-fteam__badge" aria-hidden="true">${esc(t.emoji || '★')}</span><b>${esc(t.name)}</b>
                <small>${t.dragon ? 'Scores when the class misses' : `${t.members.length}${m.split === 'fair' ? ` · <i class="fas fa-star" aria-hidden="true"></i> ${esc(t.stars)}` : ''}`}</small></div>
            ${t.dragon ? '<p class="qw-fteam__dragon" aria-hidden="true">🐉</p>' : `<div class="qw-fteam__members">${t.members.map((h) => movable
        ? `<button type="button" class="qw-fhero" data-qw-move="${esc(h.id)}" aria-label="Move ${esc(h.first)} to the next team">${esc(h.first)}</button>`
        : `<span class="qw-fhero">${esc(h.first)}</span>`).join('') || '<span class="qw-fteam__empty">Nobody yet</span>'}</div>`}
        </div>`).join('');
    const deck = FORGE_DECKS.find((d) => d.key === rules.deck) || FORGE_DECKS[0];
    const goalOptions = m.growth
        ? [{ key: 'open', label: 'Open' }, { key: 'questions', label: 'Questions' }]
        : [{ key: 'open', label: 'Open' }, { key: 'points', label: 'First to' }, { key: 'questions', label: 'Questions' }];
    return `<section class="qw-show qw-forge">
        <header class="qw-forge__head">
            <span class="qw-showintro__badge" aria-hidden="true"><i class="fas fa-bolt"></i></span>
            <div><h2 class="qw-h2">Showdown Arena</h2><p>${esc(m.className || 'Your class')} · ${esc(m.here || 0)} here${m.away ? ` · ${esc(m.away)} away` : ''}</p></div>
        </header>

        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><span>1</span> Teams for this show</h3>
            <div class="qw-splits" role="radiogroup" aria-label="How to split the class">${splits}</div>
            <div class="qw-forge__row">
                ${COUNTED.has(m.split) ? `<span class="qw-forge__label">Teams</span>${stepper('forge-count', m.count, 'Number of teams', { min: m.minCount || 2, max: m.maxCount || 6 })}` : `<span class="qw-forge__label">${esc(m.split === 'dragon' ? 'The whole class plays as one team' : m.split === 'guilds' ? 'Guilds stay as they are, this show only' : 'Today\'s Team Maker teams')}</span>`}
                ${COUNTED.has(m.split) ? '<button type="button" class="qw-chip" data-qw="forge-shuffle"><i class="fas fa-dice" aria-hidden="true"></i> Shuffle</button>' : ''}
            </div>
            ${m.awayNames?.length ? `<p class="qw-hint qw-forge__away"><i class="fas fa-cloud-rain" aria-hidden="true"></i> Away today, not playing: ${esc(m.awayNames.join(', '))}</p>` : ''}
            ${m.note ? `<p class="qw-hint">${esc(m.note)}</p>` : ''}
            <div class="qw-forge__teams" style="--n:${teams.length}">${teamCards}</div>
            ${movable ? '<p class="qw-hint qw-hint--center">Tap a name to move that hero to the next team.</p>' : ''}
        </div>

        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><span>2</span> How it plays</h3>
            <p class="qw-forge__label">Answers</p>
            ${m.split === 'dragon' ? '<p class="qw-hint">The class answers together: right, the class scores; wrong, the Dragon does.</p>' : `${seg('style', rules.style, [{ key: 'buzz', label: 'Buzz in' }, { key: 'all', label: 'Every team' }])}
            <p class="qw-hint">${rules.style === 'all' ? 'Every team writes an answer (whiteboards). Tap each team that got it, then Next.' : 'One team answers; their point ends the question.'}</p>`}
            <p class="qw-forge__label">Goal</p>
            <div class="qw-forge__row">${seg('goal', rules.goal, goalOptions)}
                ${rules.goal !== 'open' ? stepper('forge-goal', rules.goalN, rules.goal === 'points' ? 'Points to win' : 'Questions', { min: SHOWDOWN_GOAL_MIN, max: SHOWDOWN_GOAL_MAX }) : ''}</div>
            <p class="qw-forge__label">Answer clock</p>
            <div class="qw-forge__clocks">${SHOWDOWN_CLOCK_CHOICES.map((s) => `<button type="button" class="qw-chip${s === rules.clock ? ' qw-chip--gold' : ''}" data-qw-rule="clock" data-value="${s}" aria-pressed="${s === rules.clock}">${s ? `${s}s` : 'Off'}</button>`).join('')}</div>
            ${rules.clock ? '' : '<p class="qw-hint">No clock: take all the time you need.</p>'}
            <div class="qw-forge__toggles">
                ${rules.clock ? toggle('autoClock', rules.autoClock, 'Clock starts by itself', rules.autoClock ? 'With every new question (a gong when time is up)' : 'Only when you tap the stopwatch', 'fa-stopwatch') : ''}
                ${toggle('hotseat', rules.hotseat, 'Hot seat', 'Heroes take turns at the microphone; star players are crowned', 'fa-microphone')}
                ${m.growth ? '' : toggle('streak', rules.streak, 'Streak bonus', 'Three questions in a row: +1', 'fa-fire')}
                ${m.growth ? '' : toggle('underdog', rules.underdog, 'Underdog boost', 'A team 3 behind the leader earns +1', 'fa-bolt')}
            </div>
            ${m.growth ? '<p class="qw-hint">Garden Showdown: flowers grow, no numbers on the screen.</p>' : ''}
        </div>

        <div class="qw-forge__card">
            <h3 class="qw-forge__h"><span>3</span> Questions</h3>
            <div class="qw-decks" role="radiogroup" aria-label="Where the questions come from">${FORGE_DECKS.map((d) => `
                <button type="button" class="qw-split${d.key === deck.key ? ' is-on' : ''}" data-qw-rule="deck" data-value="${d.key}" role="radio" aria-checked="${d.key === deck.key}">
                    <span class="qw-split__icon" aria-hidden="true"><i class="fas ${d.icon}"></i></span><b>${esc(d.label)}</b></button>`).join('')}</div>
            <p class="qw-hint">${esc(deck.hint)}</p>
            ${deck.key !== 'voice' ? '<p class="qw-hint">The question shows on the big screen; your Wand shows the answer, for your eyes only.</p>' : ''}
        </div>

        <button type="button" class="qw-btn qw-btn--gold qw-btn--wide qw-forge__go" data-qw="forge-start"${teams.filter((t) => !t.dragon && t.members.length).length ? '' : ' disabled'}>
            <i class="fas fa-bolt" aria-hidden="true"></i> Start the Showdown</button>
        <p class="qw-hint qw-hint--center">With Quiz of the Week on screen (Elite), this becomes your private host console.</p>
    </section>`;
}

/** The host console while the show runs. `points` is the value the next tap gives (1–3). */
/** The deck's question on the phone: the right answer ticked (only the teacher sees this), and Reveal. */
function cardHtml(panel, secret) {
    if (!panel.q) return '';
    const right = Number.isInteger(secret?.sdCorrect) ? secret.sdCorrect : -1;
    const opts = (panel.opts || []).map((o, i) => `<li class="qw-qcard__opt${i === right ? ' is-right' : ''}"><b>${String.fromCharCode(65 + i)}</b><span>${esc(o.t)}</span>${i === right ? '<i class="fas fa-check" aria-label="right answer"></i>' : ''}</li>`).join('');
    return `<div class="qw-qcard${panel.revealed ? ' is-revealed' : ''}" data-qw-key="qcard-${esc(panel.card)}">
        <p class="qw-qcard__src">${esc(panel.cardSrc || 'Question')} · ${esc(panel.card)} of ${esc(panel.cards)}</p>
        <p class="qw-qcard__q">${esc(panel.q)}</p>
        <ol class="qw-qcard__opts">${opts}</ol>
        ${panel.revealed ? '<p class="qw-qcard__shown"><i class="fas fa-eye" aria-hidden="true"></i> The answer is on the big screen</p>'
        : '<button type="button" class="qw-chip qw-chip--gold" data-qw-cmd="showdown" data-action="reveal"><i class="fas fa-eye" aria-hidden="true"></i> Reveal the answer</button>'}
    </div>`;
}

export function arenaHtml(panel, { clock = 0, points = 1, secret = null } = {}) {
    const scored = (t) => Number(t.score) || 0;
    const max = Math.max(1, ...panel.teams.map(scored));
    const top = Math.max(0, ...panel.teams.map(scored));
    const clockLeft = Number.isFinite(clock) && clock > 0 ? clock : 0;
    const everyone = panel.style === 'all';
    const dragon = panel.teams.some((t) => t.dragon);
    const hint = dragon ? 'Class when right, Dragon when wrong' : everyone ? 'Tap every team that got it' : `Tap the team that ${panel.growth ? 'answered well' : 'got it'}`;
    const level = (t) => (panel.goal === 'points' ? Math.min(1, scored(t) / Math.max(1, panel.goalN)) : scored(t) / max);
    return `<section class="qw-show${panel.golden ? ' is-golden' : ''}">
        <div class="qw-showhead">
            <span class="qw-showhead__round">${panel.growth ? '<i class="fas fa-seedling" aria-hidden="true"></i>' : '<i class="fas fa-bolt" aria-hidden="true"></i>'} <b>${esc(panel.goalText || `Question ${panel.round}`)}</b></span>
            <span class="qw-showhead__hint">${esc(hint)}</span>
        </div>
        ${cardHtml(panel, secret)}
        ${!panel.q && panel.deckLeft === 0 ? '<p class="qw-hint qw-hint--center"><i class="fas fa-layer-group" aria-hidden="true"></i> The deck is finished: ask out loud from here.</p>' : ''}
        ${panel.growth ? '' : `<div class="qw-pts" role="radiogroup" aria-label="Points for the next tap"><span>Next tap</span>${[1, 2, 3].map((n) => `
            <button type="button" class="qw-pts__btn${n === points ? ' is-on' : ''}" data-qw-points="${n}" role="radio" aria-checked="${n === points}">+${n}</button>`).join('')}
            ${panel.blind ? '<span class="qw-pts__blind"><i class="fas fa-eye-slash" aria-hidden="true"></i> hidden</span>' : ''}</div>`}
        <div class="qw-teams" style="--n:${panel.teams.length}">${panel.teams.map((t, i) => {
        const lead = !panel.growth && top > 0 && scored(t) === top;
        return `
            <div class="qw-team${lead ? ' is-leading' : ''}${t.got ? ' is-got' : ''}${t.dragon ? ' qw-team--dragon' : ''}" style="--team:${esc(t.color)};--lvl:${panel.growth ? 0 : level(t).toFixed(3)}" data-qw-key="team-${i}">
                <button type="button" class="qw-team__hit" data-qw-cmd="showdown" data-action="point" data-team="${i}" data-points="${panel.growth ? 1 : points}" aria-label="${t.dragon ? 'The Dragon scores' : `Point to ${esc(t.name)}`}">
                    <span class="qw-team__badge" aria-hidden="true">${esc(t.emoji || t.shape)}</span>
                    <span class="qw-team__name">${lead ? '<span class="qw-team__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>' : ''}${esc(t.name)}</span>
                    ${panel.growth ? '<span class="qw-team__grow" aria-hidden="true"><i class="fas fa-seedling"></i> grow</span>' : `<span class="qw-team__score">${esc(t.score)}</span>`}
                    ${t.hot ? `<span class="qw-team__hot"><i class="fas fa-microphone" aria-hidden="true"></i>${esc(t.hot)}</span>` : ''}
                    ${!panel.growth && t.streak >= 2 ? `<span class="qw-team__streak"><i class="fas fa-fire"></i>${esc(t.streak)}</span>` : ''}
                    ${t.got ? '<span class="qw-team__got" aria-label="Got it this question"><i class="fas fa-check"></i></span>' : ''}
                    ${panel.growth ? '' : '<span class="qw-team__bar" aria-hidden="true"></span>'}
                </button>
                ${panel.growth ? '' : `<button type="button" class="qw-team__minus" data-qw-cmd="showdown" data-action="minus" data-team="${i}" aria-label="Take a point from ${esc(t.name)}">−1</button>`}
            </div>`;
    }).join('')}</div>
        <button type="button" class="qw-golden${panel.golden ? ' is-on' : ''}" data-qw-cmd="showdown" data-action="golden" aria-pressed="${Boolean(panel.golden)}">
            <span class="qw-golden__coin" aria-hidden="true"><i class="fas fa-coins"></i></span>
            <span><b>${panel.golden ? 'Golden question is on' : 'Golden question'}</b><small>${panel.golden ? `${everyone ? 'Points this question count double' : 'The next point counts double'} · tap to cancel` : (panel.growth ? 'The next good answer grows the flower twice' : 'The next point counts double')}</small></span>
        </button>
        <div class="qw-showctrl">
            ${panel.clockSecs ? `<button type="button" class="qw-roundbtn qw-roundbtn--lg${clockLeft ? ' is-counting' : ''}" data-qw-cmd="showdown" data-action="${clockLeft ? 'stopclock' : 'timer'}" data-seconds="${esc(panel.clockSecs)}" aria-label="${clockLeft ? 'Stop the clock' : `Start the ${esc(panel.clockSecs)} second clock`}"><i class="fas ${clockLeft ? 'fa-stop' : 'fa-stopwatch'}"></i><small data-qw-clock>${clockLeft || panel.clockSecs}s</small></button>` : ''}
            <button type="button" class="qw-roundbtn qw-roundbtn--lg" data-qw-cmd="showdown" data-action="next" aria-label="${everyone ? 'Next question' : dragon ? 'Skip this question' : 'Nobody got it: next question'}"><i class="fas ${everyone || dragon ? 'fa-forward' : 'fa-forward-step'}"></i><small>${everyone ? 'Next' : dragon ? 'Skip' : 'No one'}</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg" data-qw-cmd="showdown" data-action="undo" aria-label="Undo the last step"${panel.undo ? '' : ' disabled'}><i class="fas fa-rotate-left"></i><small>Undo</small></button>
            <button type="button" class="qw-roundbtn qw-roundbtn--lg qw-roundbtn--gold" data-qw-cmd="showdown" data-action="finish" aria-label="Finish"><i class="fas fa-trophy"></i><small>Finish</small></button>
        </div>
        <div class="qw-showtools">
            ${panel.hotseat ? '<button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="pass"><i class="fas fa-microphone" aria-hidden="true"></i> Pass the mic</button>' : ''}
            ${panel.growth ? '' : `<button type="button" class="qw-chip${panel.blind ? ' qw-chip--gold' : ''}" data-qw-cmd="showdown" data-action="blind" aria-pressed="${Boolean(panel.blind)}"><i class="fas ${panel.blind ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i> ${panel.blind ? 'Show scores' : 'Hide scores'}</button>`}
        </div>
    </section>`;
}

/** After the finish: star players, the reward (who and how many stars), rematch, new teams. */
export function finaleHtml(panel, { scope = 'winners', stars = 1 } = {}) {
    const hasStars = Boolean(panel.stars?.length);
    const scopes = panel.growth
        ? [{ key: 'all', label: 'Everyone' }]
        : [{ key: 'winners', label: 'Winners' }, { key: 'all', label: 'Everyone' }, ...(hasStars ? [{ key: 'stars', label: 'Star players' }] : [])];
    const pick = scopes.some((s) => s.key === scope) ? scope : scopes[0].key;
    const dragonWon = panel.teams.some((t) => t.dragon) && (() => {
        const top = Math.max(...panel.teams.map((t) => Number(t.score) || 0));
        const leaders = panel.teams.filter((t) => (Number(t.score) || 0) === top);
        return top > 0 && leaders.length === 1 && leaders[0].dragon;
    })();
    return `<section class="qw-show">
        <div class="qw-showintro">
            <span class="qw-showintro__badge" aria-hidden="true"><i class="fas ${panel.growth ? 'fa-seedling' : dragonWon ? 'fa-dragon' : 'fa-trophy'}"></i></span>
            <h2 class="qw-h2">${panel.growth ? 'The garden is in bloom' : dragonWon ? 'The Dragon won this time' : 'The champions are crowned'}</h2>
            ${hasStars ? `<ol class="qw-starplayers">${panel.stars.map((p) => `<li><i class="fas fa-microphone" aria-hidden="true"></i><b>${esc(p.name)}</b><span>${esc(p.pts)}</span></li>`).join('')}</ol>` : ''}
        </div>
        <div class="qw-forge__card qw-reward">
            <h3 class="qw-forge__h"><i class="fas fa-star" aria-hidden="true"></i> Teamwork stars</h3>
            <p class="qw-forge__label">For</p>
            ${seg('reward-scope', pick, scopes)}
            <p class="qw-forge__label">Stars each</p>
            ${seg('reward-stars', String(stars), [{ key: '1', label: '1 star' }, { key: '2', label: '2 stars' }, { key: '3', label: '3 stars' }])}
            <button type="button" class="qw-btn qw-btn--gold qw-btn--wide" data-qw-cmd="showdown" data-action="reward" data-scope="${pick}" data-stars="${esc(stars)}">
                <i class="fas fa-star" aria-hidden="true"></i> Give the stars</button>
            <p class="qw-hint qw-hint--center">One award per hero a day, as always: anyone who already has today's stars is skipped.</p>
        </div>
        <div class="qw-showtools">
            <button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="rematch"><i class="fas fa-repeat" aria-hidden="true"></i> Rematch</button>
            <button type="button" class="qw-chip" data-qw="forge-new"><i class="fas fa-people-arrows" aria-hidden="true"></i> New teams</button>
            <button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="undo"${panel.undo ? '' : ' disabled'}><i class="fas fa-rotate-left" aria-hidden="true"></i> Undo finish</button>
            <button type="button" class="qw-chip" data-qw-cmd="showdown" data-action="close"><i class="fas fa-xmark" aria-hidden="true"></i> Close</button>
        </div>
    </section>`;
}
