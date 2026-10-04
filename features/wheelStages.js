// features/wheelStages.js — Fortune's Wheel: the interactive moments after the wheel stops
// (brave a storm, answer the Sphinx, a hero's dare, double or nothing, three chests, a kindness
// gift, the Whirlwind and the Trickster's fake-out) and the stage effects (storm, shield, swirl,
// bursts). Every animation moves only transform and opacity, and the lite tier trims the extras.

import { drawChallenge } from '../utils/wheelChallenges.mjs';
import '../styles/fortunes_wheel_fates.css';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let _cleanups = [];
let _stageToken = 0;

/** Stops timers and listeners of the running stage (the modal closed or moved on). */
export function cancelStage() {
    _stageToken += 1;
    _cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) { /* already gone */ } });
}

function onCleanup(fn) {
    _cleanups.push(fn);
}

/** Resolves with the value of the first `[data-act]` button clicked inside `root`. */
function nextAction(root, acts = null) {
    const token = _stageToken;
    return new Promise((resolve) => {
        const handler = (e) => {
            const btn = e.target instanceof Element ? e.target.closest('[data-act]') : null;
            if (!btn || !root.contains(btn) || btn.disabled) return;
            const act = btn.dataset.act;
            if (acts && !acts.includes(act)) return;
            root.removeEventListener('click', handler);
            if (token === _stageToken) resolve({ act, btn });
        };
        root.addEventListener('click', handler);
        onCleanup(() => root.removeEventListener('click', handler));
    });
}

function crestHtml(guild, cls = 'fwx-crest') {
    return guild?.emblemUrl
        ? `<img class="${cls}" src="${esc(guild.emblemUrl)}" alt="">`
        : `<span class="${cls} ${cls}--blank">${esc((guild?.name || '?').charAt(0))}</span>`;
}

function headHtml({ family, kicker, emoji, title, guild }) {
    return `
        <div class="fwx-head">
            <span class="fwx-orb fwx-orb--${family}" aria-hidden="true"><span>${emoji}</span></span>
            <div class="fwx-kicker">${crestHtml(guild, 'fwx-kicker__crest')}${esc(kicker)}</div>
            <h3 class="fwx-title">${esc(title)}</h3>
        </div>`;
}

function avatarHtml(student, cls = 'fwx-avatar') {
    return student?.avatar
        ? `<img class="${cls}" src="${esc(student.avatar)}" alt="">`
        : `<span class="${cls} ${cls}--initial">${esc((student?.name || '?').charAt(0).toUpperCase())}</span>`;
}

// ─── Trial: a question, a dare or a lightning round, judged by the teacher ───────────────

/**
 * Shows a challenge with a clock and the teacher's ✓ / ✗.
 * @returns {Promise<boolean>} true when the guild (or the hero) succeeded
 */
async function trialStep(cardEl, opts) {
    const { family = 'trial', kicker, emoji, title, win, lose, kind = 'riddle', band, hero = null, sfx, sound, guild } = opts;
    let challenge = drawChallenge(kind, band);
    const R = 20;
    const C = 2 * Math.PI * R;

    const render = () => {
        cardEl.innerHTML = `
            <div class="fwx fwx--${family} fwx--challenge" data-step="trial">
                ${headHtml({ family, kicker, emoji, title, guild })}
                ${hero ? `<div class="fwx-hero">${avatarHtml(hero, 'fwx-hero__avatar')}<b>${esc(hero.name)}</b></div>` : ''}
                <div class="fwx-stakes">
                    <span class="fwx-stake fwx-stake--win"><i class="fa-solid fa-check" aria-hidden="true"></i>${esc(win)}</span>
                    <span class="fwx-stake fwx-stake--lose"><i class="fa-solid fa-xmark" aria-hidden="true"></i>${esc(lose)}</span>
                </div>
                <div class="fwx-question">
                    <p class="fwx-question__text">${esc(challenge.text)}</p>
                    ${challenge.answer ? `<button type="button" class="fwx-answer" data-act="answer" aria-expanded="false"><span class="fwx-answer__label">Answer (for the teacher)</span><b class="fwx-answer__value">${esc(challenge.answer)}</b></button>` : ''}
                </div>
                <div class="fwx-clockrow">
                    <div class="fwx-timer" style="--c:${C.toFixed(2)}">
                        <svg viewBox="0 0 48 48" aria-hidden="true"><circle class="fwx-timer__track" cx="24" cy="24" r="${R}"/><circle class="fwx-timer__bar" cx="24" cy="24" r="${R}"/></svg>
                        <b class="fwx-timer__num">${challenge.seconds}</b>
                    </div>
                    <button type="button" class="fwx-btn fwx-btn--clock" data-act="clock"><i class="fa-solid fa-play" aria-hidden="true"></i> Start the clock</button>
                    <button type="button" class="fwx-link" data-act="another"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Another one</button>
                </div>
                <div class="fwx-actions">
                    <button type="button" class="fwx-btn fwx-btn--pass" data-act="pass"><i class="fa-solid fa-check" aria-hidden="true"></i> Correct!</button>
                    <button type="button" class="fwx-btn fwx-btn--fail" data-act="fail"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Not this time</button>
                </div>
                <div class="fwx-stamp" aria-hidden="true"></div>
            </div>`;
    };

    let ticking = null;
    const stopClock = () => { if (ticking) { clearInterval(ticking); ticking = null; } };
    onCleanup(stopClock);

    render();
    for (;;) {
        const { act } = await nextAction(cardEl);
        const root = cardEl.querySelector('.fwx');
        if (act === 'answer') {
            const btn = root.querySelector('.fwx-answer');
            const open = btn.getAttribute('aria-expanded') !== 'true';
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            continue;
        }
        if (act === 'another') {
            stopClock();
            challenge = drawChallenge(kind, band, { previous: challenge });
            render();
            try { sound?.('quiz_question_in'); } catch (_) { /* optional */ }
            continue;
        }
        if (act === 'clock') {
            const timer = root.querySelector('.fwx-timer');
            const num = root.querySelector('.fwx-timer__num');
            root.querySelector('[data-act="clock"]')?.setAttribute('hidden', '');
            timer.style.setProperty('--secs', `${challenge.seconds}s`);
            timer.classList.add('is-running');
            const end = performance.now() + challenge.seconds * 1000;
            ticking = setInterval(() => {
                const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
                if (num.textContent !== String(left)) {
                    num.textContent = String(left);
                    if (left <= 5 && left > 0) { timer.classList.add('is-hurry'); try { sfx?.('tick_heavy'); } catch (_) { /* optional */ } }
                }
                if (left === 0) {
                    stopClock();
                    timer.classList.add('is-out');
                    try { sfx?.('buzzer'); } catch (_) { /* optional */ }
                }
            }, 200);
            continue;
        }
        stopClock();
        const passed = act === 'pass';
        root.classList.add(passed ? 'is-pass' : 'is-fail');
        root.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        try { sound?.(passed ? 'quiz_correct' : 'quiz_wrong'); } catch (_) { /* optional */ }
        await wait(950);
        return passed;
    }
}

// ─── Storm: brave it or let it rain ─────────────────────────────────────────────────────

async function stormStage(cardEl, opts) {
    const { segment, guild, band, sfx, sound } = opts;
    cardEl.innerHTML = `
        <div class="fwx fwx--storm" data-step="storm">
            <div class="fwx-rain" aria-hidden="true"></div>
            ${headHtml({ family: 'storm', kicker: 'A storm rolls in!', emoji: segment.emoji, title: segment.label, guild })}
            <p class="fwx-text">${esc(segment.description)}</p>
            ${segment.brave
                ? `<p class="fwx-hint"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Answer one question together and the guild's shield keeps the storm away.</p>
                   <div class="fwx-actions">
                       <button type="button" class="fwx-btn fwx-btn--brave" data-act="brave"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Brave the storm</button>
                       <button type="button" class="fwx-btn fwx-btn--quiet" data-act="accept">Let it rain</button>
                   </div>`
                : `<p class="fwx-hint fwx-hint--bare"><i class="fa-solid fa-bolt" aria-hidden="true"></i> No shelter from this one. Even heroes have stormy days.</p>
                   <div class="fwx-actions"><button type="button" class="fwx-btn fwx-btn--quiet" data-act="accept">Face the storm</button></div>`}
        </div>`;
    const { act } = await nextAction(cardEl);
    if (act !== 'brave') return { braved: false, attempted: false };
    const passed = await trialStep(cardEl, {
        family: 'storm', kicker: 'Brave the storm', emoji: '🛡️', title: segment.label,
        win: 'The storm passes you by', lose: 'The storm breaks through', kind: 'riddle', band, sfx, sound, guild,
    });
    return { braved: passed, attempted: true };
}

// ─── Hero's Dare: the spotlight picks one guildmate ─────────────────────────────────────

async function dareStage(cardEl, opts) {
    const { segment, guild, band, students = [], sfx, sound, lite } = opts;
    if (!students.length) return { studentId: null, passed: false };
    cardEl.innerHTML = `
        <div class="fwx fwx--trial fwx--dare" data-step="roulette">
            ${headHtml({ family: 'trial', kicker: 'The spotlight searches…', emoji: segment.emoji, title: segment.label, guild })}
            <ul class="fwx-roster">${students.map((s, i) => `<li class="fwx-roster__seat" data-i="${i}">${avatarHtml(s)}<span>${esc(s.name)}</span></li>`).join('')}</ul>
        </div>`;
    const seats = [...cardEl.querySelectorAll('.fwx-roster__seat')];
    const winner = Math.floor(Math.random() * students.length);
    // The spotlight hops seat to seat, slowing down, and lands on the hero.
    const hops = Math.max(students.length * 2, 14) + ((winner - (Math.max(students.length * 2, 14) % students.length)) + students.length) % students.length;
    const token = _stageToken;
    for (let h = 0; h <= hops; h += 1) {
        if (token !== _stageToken) return { studentId: null, passed: false };
        seats.forEach((el) => el.classList.remove('is-lit'));
        seats[h % seats.length].classList.add('is-lit');
        try { sound?.('click'); } catch (_) { /* optional */ }
        const t = h / hops;
        await wait(lite ? 60 + t * t * 260 : 55 + t * t * 320);
    }
    seats[winner].classList.add('is-chosen');
    try { sound?.('quiz_student_reveal'); } catch (_) { /* optional */ }
    await wait(900);
    const hero = students[winner];
    const passed = await trialStep(cardEl, {
        family: 'trial', kicker: 'Hero’s Dare', emoji: segment.emoji, title: `${hero.name}, your dare!`,
        win: '+1 star and +10 gold', lose: '+5 gold for courage', kind: 'dare', band, hero, sfx, sound, guild,
    });
    return { studentId: hero.id, passed };
}

// ─── Double or Nothing: keep the small prize, or flip the coin ──────────────────────────

async function coinStage(cardEl, opts) {
    const { segment, guild, sfx, sound, drum, lite } = opts;
    cardEl.innerHTML = `
        <div class="fwx fwx--twist fwx--coin" data-step="choice">
            ${headHtml({ family: 'twist', kicker: 'Twist · the guild decides', emoji: segment.emoji, title: segment.label, guild })}
            <div class="fwx-coin" aria-hidden="true">
                <div class="fwx-coin__spin">
                    <div class="fwx-coin__face fwx-coin__face--heads">${crestHtml(guild, 'fwx-coin__crest')}</div>
                    <div class="fwx-coin__face fwx-coin__face--tails"><span>⚡</span></div>
                </div>
            </div>
            <div class="fwx-options">
                <button type="button" class="fwx-option" data-act="keep"><b>Keep it safe</b><span>+1 Glory for each guildmate here</span></button>
                <button type="button" class="fwx-option fwx-option--risk" data-act="flip"><b>Flip the coin!</b><span>Heads (the crest): +3 Glory each · Tails (the bolt): −1 Glory each</span></button>
            </div>
        </div>`;
    const { act } = await nextAction(cardEl);
    if (act === 'keep') return { choice: 'keep' };
    const root = cardEl.querySelector('.fwx');
    root.dataset.step = 'flip';
    root.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const heads = crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0;
    const spin = root.querySelector('.fwx-coin__spin');
    try { drum?.start?.(); } catch (_) { /* optional */ }
    const turns = lite ? 6 : 9;
    const end = turns * 360 + (heads ? 0 : 180);
    const anim = spin.animate?.([
        { transform: 'translateY(0) rotateY(0deg)' },
        { transform: `translateY(-38%) rotateY(${end * 0.55}deg)`, offset: 0.45 },
        { transform: `translateY(0) rotateY(${end}deg)` },
    ], { duration: 2100, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' });
    await (anim?.finished?.catch(() => {}) || wait(2100));
    try { drum?.stop?.(); } catch (_) { /* optional */ }
    try { sfx?.('coin'); sound?.(heads ? 'quiz_correct' : 'quiz_wrong'); } catch (_) { /* optional */ }
    root.classList.add(heads ? 'is-heads' : 'is-tails');
    root.insertAdjacentHTML('beforeend', `<div class="fwx-verdict fwx-verdict--${heads ? 'win' : 'lose'}">${heads ? 'HEADS! +3 Glory each' : 'TAILS! −1 Glory each'}</div>`);
    await wait(1300);
    return { choice: 'flip', heads };
}

// ─── Three Chests: pick one, see what the others held ───────────────────────────────────

const CHESTS = {
    gold: { icon: '👑', name: 'Golden chest', text: '+3 Glory each' },
    silver: { icon: '🪙', name: 'Silver chest', text: '+1 Glory each and gold for two' },
    bronze: { icon: '🎒', name: 'Bronze chest', text: '2 guildmates get +10 gold' },
    mimic: { icon: '👹', name: 'A Mimic!', text: '−1 Glory each' },
};

async function chestStage(cardEl, opts) {
    const { segment, guild, favored, sfx, sound } = opts;
    const prizes = ['gold', 'silver', favored ? 'bronze' : 'mimic'];
    for (let i = prizes.length - 1; i > 0; i -= 1) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
    }
    cardEl.innerHTML = `
        <div class="fwx fwx--twist fwx--chests" data-step="pick">
            ${headHtml({ family: 'twist', kicker: 'Twist · choose wisely', emoji: segment.emoji, title: segment.label, guild })}
            <p class="fwx-text">${favored ? 'Two hold Glory, one holds gold. Which one?' : 'Two hold treasure. One holds a Mimic. Which one?'}</p>
            <div class="fwx-chests">${prizes.map((p, i) => `
                <button type="button" class="fwx-chest" data-act="pick" data-i="${i}" style="--i:${i}" aria-label="Chest ${i + 1}">
                    <span class="fwx-chest__glow" aria-hidden="true"></span>
                    <span class="fwx-chest__lid" aria-hidden="true"></span>
                    <span class="fwx-chest__box" aria-hidden="true"><i>${i + 1}</i></span>
                    <span class="fwx-chest__prize" aria-hidden="true">${CHESTS[p].icon}</span>
                    <span class="fwx-chest__label">${esc(CHESTS[p].name)}<small>${esc(CHESTS[p].text)}</small></span>
                </button>`).join('')}</div>
        </div>`;
    const { btn } = await nextAction(cardEl, ['pick']);
    const root = cardEl.querySelector('.fwx');
    const chosen = Number(btn.dataset.i);
    root.dataset.step = 'open';
    root.querySelectorAll('.fwx-chest').forEach((b) => { b.disabled = true; });
    btn.classList.add('is-chosen');
    try { sfx?.('chest'); } catch (_) { /* optional */ }
    await wait(700);
    btn.classList.add('is-open', `is-${prizes[chosen]}`);
    try { sound?.(prizes[chosen] === 'mimic' ? 'quiz_wrong' : 'quiz_correct'); } catch (_) { /* optional */ }
    await wait(1100);
    root.querySelectorAll('.fwx-chest').forEach((b, i) => { if (i !== chosen) b.classList.add('is-open', 'is-other', `is-${prizes[i]}`); });
    await wait(1500);
    return { prize: prizes[chosen] };
}

// ─── Kindness Gift: share Glory with another guild ──────────────────────────────────────

async function kindnessStage(cardEl, opts) {
    const { segment, guild, otherGuilds = [], sound } = opts;
    if (!otherGuilds.length) return { guildId: null };
    cardEl.innerHTML = `
        <div class="fwx fwx--twist fwx--kind" data-step="pick">
            ${headHtml({ family: 'twist', kicker: 'Twist · a kind heart', emoji: segment.emoji, title: segment.label, guild })}
            <p class="fwx-text">Choose a guild to share with. You <b>both</b> earn +1 Glory for each guildmate here.</p>
            <div class="fwx-guilds">${otherGuilds.map((g) => `
                <button type="button" class="fwx-guild" data-act="give" data-guild="${esc(g.id)}" style="--g:${esc(g.primary || '#e8c46a')}">
                    ${crestHtml(g, 'fwx-guild__crest')}<b>${esc(g.name)}</b><small>${g.count} here</small>
                </button>`).join('')}</div>
        </div>`;
    const { btn } = await nextAction(cardEl, ['give']);
    btn.classList.add('is-chosen');
    cardEl.querySelectorAll('.fwx-guild').forEach((b) => { b.disabled = true; });
    try { sound?.('magic_chime'); } catch (_) { /* optional */ }
    await wait(800);
    return { guildId: btn.dataset.guild };
}

// ─── Whirlwind and Trickster: short scenes on the card ──────────────────────────────────

async function whirlwindStage(cardEl, opts) {
    const { segment, guild, sfx } = opts;
    cardEl.innerHTML = `
        <div class="fwx fwx--twist fwx--whirl" data-step="whirl">
            <div class="fwx-swirl" aria-hidden="true"><i></i><i></i><i></i></div>
            ${headHtml({ family: 'twist', kicker: 'Twist!', emoji: segment.emoji, title: segment.label, guild })}
            <p class="fwx-text">The wind grabs the wheel… it spins again!</p>
            <div class="fwx-actions"><button type="button" class="fwx-btn fwx-btn--twist" data-act="go"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Spin again!</button></div>
        </div>`;
    try { sfx?.('whoosh'); } catch (_) { /* optional */ }
    await Promise.race([nextAction(cardEl, ['go']), wait(2600)]);
    return { respin: true };
}

async function tricksterStage(cardEl, opts) {
    const { guild, sfx, sound } = opts;
    cardEl.innerHTML = `
        <div class="fwx fwx--trick" data-step="fake">
            <div class="fwx-trick__face fwx-trick__face--fake">
                ${headHtml({ family: 'legendary', kicker: 'Legendary!', emoji: '💰', title: 'Treasure Mountain', guild })}
                <p class="fwx-text">Every guildmate here gets <b>+100 gold</b>!</p>
            </div>
            <div class="fwx-trick__face fwx-trick__face--real">
                ${headHtml({ family: 'twist', kicker: 'Twist!', emoji: '🎭', title: 'Tricked!', guild })}
                <p class="fwx-text">The Trickster laughs. No treasure, and nothing lost either.</p>
            </div>
        </div>`;
    try { sound?.('star3'); } catch (_) { /* optional */ }
    await wait(1500);
    const root = cardEl.querySelector('.fwx');
    root.classList.add('is-cracking');
    await wait(450);
    root.classList.add('is-flipped');
    try { sfx?.('trickster'); } catch (_) { /* optional */ }
    await wait(1600);
    return { tricked: true };
}

/**
 * Runs the interactive moment for a wedge and resolves with the decision its effect needs.
 * @param {string} kind - 'storm' | 'trial' | 'dare' | 'coin' | 'chests' | 'kindness' | 'whirlwind' | 'trickster'
 */
export async function runStage(kind, opts) {
    const { cardEl } = opts;
    if (!cardEl) return {};
    if (kind === 'storm') return stormStage(cardEl, opts);
    if (kind === 'dare') return dareStage(cardEl, opts);
    if (kind === 'coin') return coinStage(cardEl, opts);
    if (kind === 'chests') return chestStage(cardEl, opts);
    if (kind === 'kindness') return kindnessStage(cardEl, opts);
    if (kind === 'whirlwind') return whirlwindStage(cardEl, opts);
    if (kind === 'trickster') return tricksterStage(cardEl, opts);
    if (kind === 'trial') {
        const { segment, guild, band, sfx, sound } = opts;
        const passed = await trialStep(cardEl, {
            family: 'trial', kicker: `Trial · ${segment.trial === 'lightning' ? 'Lightning Round' : 'answer together'}`,
            emoji: segment.emoji, title: segment.label, win: segment.win, lose: segment.lose,
            kind: segment.trial || 'riddle', band, sfx, sound, guild,
        });
        return { passed };
    }
    return {};
}

// ─── Stage effects ──────────────────────────────────────────────────────────────────────

function addTemp(parent, html, ms) {
    if (!parent) return null;
    const holder = document.createElement('div');
    holder.innerHTML = html.trim();
    const el = holder.firstElementChild;
    parent.appendChild(el);
    const t = setTimeout(() => el.remove(), ms);
    onCleanup(() => { clearTimeout(t); el.remove(); });
    return el;
}

/** Storm clouds roll over the wheel, rain falls, lightning flashes and the stage shudders. */
export function fxStorm(frameEl, { lite = false } = {}) {
    if (!frameEl) return wait(0);
    addTemp(frameEl, `
        <div class="fwx-storm${lite ? ' is-lite' : ''}" aria-hidden="true">
            <span class="fwx-storm__cloud fwx-storm__cloud--a"></span>
            <span class="fwx-storm__cloud fwx-storm__cloud--b"></span>
            ${lite ? '' : '<span class="fwx-storm__cloud fwx-storm__cloud--c"></span>'}
            <span class="fwx-storm__rain"></span>
            <span class="fwx-storm__flash"></span>
            <span class="fwx-storm__bolt"></span>
        </div>`, 2600);
    frameEl.classList.remove('is-quaking');
    void frameEl.offsetWidth;
    frameEl.classList.add('is-quaking');
    const t = setTimeout(() => frameEl.classList.remove('is-quaking'), 1200);
    onCleanup(() => clearTimeout(t));
    return wait(1500);
}

/** A golden shield dome rises over the wheel. */
export function fxShield(frameEl) {
    addTemp(frameEl, '<div class="fwx-shield" aria-hidden="true"><span></span><span></span></div>', 1900);
    return wait(900);
}

/** Wind rings swirl around the wheel (the Whirlwind). */
export function fxSwirl(frameEl) {
    addTemp(frameEl, '<div class="fwx-whirl" aria-hidden="true"><i></i><i></i><i></i></div>', 1800);
}

/** A twist's harlequin shimmer over the wheel. */
export function fxTwist(frameEl) {
    addTemp(frameEl, '<div class="fwx-twinkle" aria-hidden="true"></div>', 1400);
}

/** A trial's ring of light: the Sphinx is listening. */
export function fxTrial(frameEl) {
    addTemp(frameEl, '<div class="fwx-trialring" aria-hidden="true"></div>', 1500);
}

/**
 * A burst of particles (and emojis) from a point inside `layerEl`, transform/opacity only.
 * @param {HTMLElement} layerEl - positioned container covering the card
 */
export function fxBurst(layerEl, { x, y, colors = ['#fbbf24'], count = 16, emojis = [], emojiCount = 0, spread = 140, lite = false } = {}) {
    if (!layerEl) return;
    const n = lite ? Math.ceil(count / 3) : count;
    const ne = lite ? Math.min(6, Math.ceil(emojiCount / 3)) : emojiCount;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i += 1) {
        const p = document.createElement('span');
        p.className = 'fwx-spark';
        const a = Math.random() * Math.PI * 2;
        const d = spread * (0.35 + Math.random() * 0.75);
        p.style.cssText = `left:${x}px;top:${y}px;--c:${colors[i % colors.length]};--tx:${(Math.cos(a) * d).toFixed(1)}px;--ty:${(Math.sin(a) * d - 20).toFixed(1)}px;--s:${(0.6 + Math.random() * 0.9).toFixed(2)};--d:${(0.7 + Math.random() * 0.5).toFixed(2)}s;`;
        frag.appendChild(p);
    }
    for (let i = 0; i < ne; i += 1) {
        const e = document.createElement('span');
        e.className = 'fwx-emoji';
        e.textContent = emojis[i % emojis.length] || '✨';
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const d = spread * (0.6 + Math.random() * 0.9);
        e.style.cssText = `left:${x}px;top:${y}px;--tx:${(Math.cos(a) * d).toFixed(1)}px;--ty:${(Math.sin(a) * d).toFixed(1)}px;--fall:${(80 + Math.random() * 160).toFixed(0)}px;--r:${((Math.random() - 0.5) * 540).toFixed(0)}deg;--s:${(0.8 + Math.random() * 0.8).toFixed(2)};--d:${(1.2 + Math.random() * 0.7).toFixed(2)}s;--delay:${(Math.random() * 0.25).toFixed(2)}s;`;
        frag.appendChild(e);
    }
    const nodes = [...frag.childNodes];
    layerEl.appendChild(frag);
    const t = setTimeout(() => nodes.forEach((node) => node.remove()), 2400);
    onCleanup(() => { clearTimeout(t); nodes.forEach((node) => node.remove()); });
}

/** A soft full-card flash in a colour (opacity only). */
export function fxFlash(layerEl, color = 'rgba(251, 191, 36, 0.35)') {
    addTemp(layerEl, `<div class="fwx-flash" style="--c:${color}" aria-hidden="true"></div>`, 900);
}
