// features/questRemote/showdown.js — Showdown Arena (Quest Remote, projector side, lazy).
// A Kahoot-style team race with no student devices: the teacher asks out loud, the Wand gives the
// point, the projector does the show (bars leap, streak flames, game-show stings, podium).
// Teams come from the Wand's Team Forge (fair on stars, guilds mixed, luck, the guilds as they are,
// today's Team Maker teams, or the whole class against the Dragon); an older Wand that sends no
// teams gets today's Team Maker teams, else the guilds, else two halves of the class.
// Teams last one show: nobody's guild ever changes. Rules (answer style, goal, clock, streak bonus,
// underdog boost, hot seat) travel with `open` and are applied by remoteCore.mjs.
// Every lane shows its heroes' faces (names as tooltips, a roll call as the arena opens), so the class
// sees who is in which team. The answer clock is optional (Off, or 5–30 s, starting by itself with each
// question if the teacher wants). A show can bring its own questions (showdownDeck.mjs): past Quiz of the
// Week questions, the ones the class missed first, and quick questions from the book atlas wordlists
// (the book, units and kinds of question the teacher picks in the Forge).
// Four games: Race (bars climb), Tug of War (two teams pull a rope; win by N), Survivor (hearts; a miss
// costs one; the last team standing wins) and Treasure (every point opens a chest: coins, a steal from
// the leader, or a double next point). Several teams can get a point in one tap (one step for Undo).
// Nursery / Pre-Junior play the Growth Festival way: flowers grow, no numbers, everyone blooms.
// Rewards are ordinary Teamwork stars through the Award Stars cloud (one award per hero per day,
// exactly as with the mouse), so the Showdown never invents a new kind of star.
// Markup: remoteStageView.mjs.

import * as state from '../../state.js';
import { playShowdownSfx } from '../../audio.js';
import { getTodayDateString } from '../../utils.js';
import {
    createShowdown, scoreShowdown, scoreShowdownTeams, missShowdownTeams, nextShowdownQuestion, passShowdownSeats, finishShowdown, undoShowdown, rematchShowdown,
    showdownWinners, showdownPanel, isGrowthLeague, showdownBarLevels, showdownAnswerer, showdownGoalText, showdownRewardIds,
    showdownTeamLooks, normalizeShowdownRules, removeShowdownMembers
} from './remoteCore.mjs';
import { showdownHtml, showdownFinaleHtml, growthFlower, seatHtml, deckCardHtml, clockHtml, heartsHtml, chestHtml } from './remoteStageView.mjs';
import { burstOn, confettiRain, isLiteFx, isStillFx, sparkTo, centreOf } from './remoteFx.js';

const ROOT_ID = 'qr-showdown';

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId) || null;
}
let sd = null;
let count = null; // { left, tick, id, total }
let countSeq = 0;
let names = new Map();
let faces = new Map();
let goalTimer = 0;
let autoTimer = 0;
let cardTimer = 0;
let rollTimer = 0;
let lastCtx = null;
let showClassId = '';
let unwatchAttendance = null;
// The deck of a show that brings its own questions: card i belongs to question i + 1.
let deck = [];
let shownRound = 0; // the question whose card is on screen
const revealed = new Set(); // questions whose answer has been shown

const nameOf = (id) => names.get(id) || '';
const faceOf = (id) => faces.get(id) || null;

/** Heroes marked absent today: they never play (not in a team, the hot seat, the roll call or the rewards). */
function awayToday(classId) {
    const today = getTodayDateString();
    return new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today).map((r) => r.studentId));
}

function classRosterNow(classId) {
    const away = awayToday(classId);
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && !away.has(s.id));
}

/** The old way (a Wand that sends no teams): today's Team Maker teams, the guilds, or two halves. */
async function buildTeams(classId) {
    const roster = classRosterNow(classId);
    const here = new Set(roster.map((s) => s.id));
    try {
        const cls = classById(classId);
        const { teamsForDay, teamBanner } = await import('../teamMakerCore.mjs');
        const today = teamsForDay(cls?.teamMaker, getTodayDateString());
        const sets = (today?.teams || []).map((t) => (Array.isArray(t) ? t : t?.ids || []).filter((id) => here.has(id))).filter((t) => t.length);
        if (sets.length >= 2) {
            return sets.map((ids, i) => {
                const b = teamBanner(i);
                return { name: b.short, color: b.primary, emoji: b.emoji, members: ids };
            });
        }
    } catch { /* fall through */ }
    try {
        const { getGuildById } = await import('../guilds.js');
        const byGuild = new Map();
        roster.forEach((s) => { if (s.guildId) byGuild.set(s.guildId, [...(byGuild.get(s.guildId) || []), s.id]); });
        if (byGuild.size >= 2) {
            return [...byGuild.entries()].map(([gid, ids]) => {
                const g = getGuildById(gid);
                return { name: g?.name || 'Guild', color: g?.primary || '', emoji: g?.emoji || '🛡️', members: ids };
            });
        }
    } catch { /* fall through */ }
    const ids = roster.map((s) => s.id);
    const half = Math.ceil(ids.length / 2);
    return [
        { name: 'Sun Team', color: '#f59e0b', emoji: '☀️', members: ids.slice(0, half) },
        { name: 'Moon Team', color: '#6366f1', emoji: '🌙', members: ids.slice(half) }
    ];
}

/**
 * The Team Forge's teams, checked against the class and today's register: a stale phone never smuggles
 * in another class's heroes, and a hero marked absent here (on the projector) never plays.
 */
async function forgedTeams(classId, p) {
    const cls = classById(classId);
    const inClass = new Set(classRosterNow(classId).map((s) => s.id));
    const packed = p.teams.map((t) => ({ ...t, ids: (t.ids || []).filter((id) => inClass.has(id)) }));
    const [{ getGuildById }, { teamBanner }] = await Promise.all([import('../guilds.js'), import('../teamMakerCore.mjs')]);
    const looks = showdownTeamLooks(p.split, packed, {
        guildOf: getGuildById, bannerOf: teamBanner, classLook: cls ? { name: cls.name, emoji: cls.logo } : null
    });
    return packed.map((t, i) => ({ ...looks[i], members: t.ids }));
}

/**
 * The questions a show brings (deck 'quiz', 'words' or 'mix'): quizzes this class has already played,
 * missed questions first, and quick questions from the book units it has been practising. One Firestore
 * read for the quizzes, the wordlists ship with the app, nothing is written and no AI is asked.
 */
async function loadDeck(classId, cls, source, wordChoice = null) {
    if (!source || source === 'voice') return { cards: [], label: '' };
    const { quizDeckCards, wordDeckCards, buildShowdownDeck, deckUnitLabel, cleanWordChoice, defaultWordChoice, shortBookTitle } = await import('./showdownDeck.mjs');
    let quiz = [];
    let words = [];
    const labels = [];
    if (source === 'quiz' || source === 'mix') {
        try {
            const { getQuizHistory } = await import('../../db/actions/quizOfTheWeek.js');
            quiz = quizDeckCards(await getQuizHistory(classId, 4));
            if (quiz.length) labels.push(`${quiz.length} quiz question${quiz.length === 1 ? '' : 's'}`);
        } catch (error) { console.warn('Showdown deck: quizzes', error); }
    }
    if (source === 'words' || source === 'mix') {
        try {
            const [{ getClassBookPlan }, atlas] = await Promise.all([import('../bookProgress.js'), import('../bookAtlas.mjs')]);
            const ctx = { atlas: atlas.BOOK_ATLAS, wordBooks: atlas.WORDLIST_BOOK_IDS };
            // the teacher's choice from the Forge (book, units, kinds); an older Wand sends none: the class's own units
            const choice = cleanWordChoice(wordChoice, ctx)
                || defaultWordChoice({ ...ctx, bookPlan: getClassBookPlan(classId), league: cls?.questLevel });
            if (choice) {
                const young = ['Nursery', 'Pre-Junior', 'Junior A', 'Junior B'].includes(cls?.questLevel);
                const pool = [];
                for (const unit of choice.units) {
                    const src = deckUnitLabel({ bookId: choice.book, unit }, (x) => atlas.describeUnit(atlas.BOOK_ATLAS, x.bookId, x.unit));
                    const list = await atlas.getUnitWords(choice.book, unit, { component: 'sb' }).catch(() => []);
                    pool.push(...list.map((w) => ({ ...w, src })));
                }
                words = wordDeckCards(pool, { kinds: choice.kinds, young, max: 30 });
                if (words.length) {
                    const book = atlas.BOOK_ATLAS.find((b) => b.id === choice.book);
                    const u = choice.units;
                    const run = u[u.length - 1] - u[0] === u.length - 1;
                    const list = u.length === 1 ? `unit ${u[0]}` : run ? `units ${u[0]}–${u[u.length - 1]}` : `units ${u.slice(0, 4).join(', ')}${u.length > 4 ? '…' : ''}`;
                    labels.push(`${shortBookTitle(book)} · ${list}`);
                }
            }
        } catch (error) { console.warn('Showdown deck: book words', error); }
    }
    return { cards: buildShowdownDeck(source, { quiz, words }), label: labels.join(' · ') };
}

/** The card of question `round` as the projector draws it (null past the end of the deck). */
function cardFor(round) {
    const c = deck[round - 1];
    if (!c) return null;
    return { ...c, n: round, total: deck.length, revealed: revealed.has(round) };
}

function root() { return document.getElementById(ROOT_ID); }

/** A hero marked absent while the show runs leaves it at once (team, microphone, star players). */
function watchAttendance() {
    unwatchAttendance?.();
    unwatchAttendance = state.subscribe(['allAttendanceRecords'], () => {
        if (!sd || !showClassId) return;
        const next = removeShowdownMembers(sd, awayToday(showClassId));
        if (next === sd) return;
        sd = next;
        render({ finale: sd.finished });
        root()?.classList.remove('is-rollcall');
        lastCtx?.scheduleStage(0);
    });
}

function render({ finale = false } = {}) {
    const el = root();
    if (!el || !sd) return;
    el.dataset.growth = String(sd.growth);
    el.dataset.mode = sd.rules?.mode || 'race';
    el.classList.toggle('is-blind', Boolean(sd.blind && !sd.growth && !finale));
    if (!finale) shownRound = sd.round;
    el.innerHTML = `${finale ? showdownFinaleHtml(sd, { nameOf, faceOf })
        : showdownHtml(sd, { secondsLeft: count?.left ?? null, secondsTotal: count?.total || 0, nameOf, faceOf, card: cardFor(sd.round) })}
        <button type="button" class="qr-sd__close" data-qr-sd-close aria-label="Close the arena" title="Close the arena (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>`;
}

/** A team's lane (or its side of the rope in Tug of War). */
function laneOf(i) {
    return root()?.querySelector(`[data-team="${i}"]`) || null;
}

/** Moves the bars and numbers without rebuilding the stage (smooth, cheap). `scored`: the team(s) that just scored. */
function update(scored = []) {
    const el = root();
    if (!el || !sd) return;
    const levels = showdownBarLevels(sd);
    const hit = new Set([].concat(scored));
    sd.teams.forEach((t, i) => {
        const lane = el.querySelector(`[data-team="${i}"]`);
        if (!lane) return;
        lane.style.setProperty('--qr-level', levels[i].toFixed(3));
        const score = lane.querySelector('[data-qr-score]');
        if (score) countUp(score, t.score);
        const flower = lane.querySelector('[data-qr-flower]');
        if (flower) {
            const next = growthFlower(t.score);
            if (flower.textContent !== next) { flower.textContent = next; restartAnim(flower, 'is-bloom'); }
        }
        const track = lane.querySelector('.qr-lane__track');
        let streak = lane.querySelector('.qr-lane__streak');
        if (!sd.growth && t.streak >= 2) {
            if (!streak) {
                streak = document.createElement('span');
                streak.className = 'qr-lane__streak';
                (track || lane).appendChild(streak);
            }
            streak.innerHTML = `<i class="fas fa-fire"></i>${t.streak}`;
            streak.setAttribute('aria-label', `${t.streak} in a row`);
        } else streak?.remove();
        lane.classList.toggle('is-leading', !sd.blind && levels[i] >= 1 && t.score > 0 && sd.rules.goal !== 'points');
        lane.classList.toggle('is-got', sd.roundScorers.includes(i));
        syncSeat(lane, i);
        syncModeBits(lane, t);
        if (hit.has(i)) restartAnim(lane, 'is-scored');
    });
    syncTug(levels);
    const round = el.querySelector('[data-qr-round]');
    if (round) round.textContent = String(sd.round);
    const goal = el.querySelector('[data-qr-goal]');
    if (goal) goal.textContent = showdownGoalText(sd);
    el.classList.toggle('is-blind', Boolean(sd.blind && !sd.growth));
    const blind = el.querySelector('[data-qr-blind]');
    if (blind) blind.hidden = !(sd.blind && !sd.growth);
    syncGolden();
}

/** Survivor's hearts and Out stamp, Treasure's ×2 badge. */
function syncModeBits(lane, t) {
    const mode = sd.rules?.mode;
    if (mode === 'survivor') {
        const hearts = lane.querySelector('[data-qr-hearts]');
        const had = hearts ? hearts.querySelectorAll('.qr-heart:not(.is-lost)').length : -1;
        if (hearts && had !== t.lives) {
            hearts.outerHTML = heartsHtml(t.lives, sd.rules.lives);
            // the heart just lost cracks; one given back (Undo) glows in
            const now = lane.querySelector('[data-qr-hearts]');
            const k = had > t.lives ? t.lives : t.lives - 1;
            const one = now?.querySelectorAll('.qr-heart')[k];
            if (one && !isStillFx()) one.classList.add(had > t.lives ? 'is-break' : 'is-back');
        }
        lane.classList.toggle('is-out', Boolean(t.out));
        const stamp = lane.querySelector('[data-qr-stamp]');
        if (stamp) stamp.hidden = !t.out;
    }
    if (mode === 'treasure') {
        const dbl = lane.querySelector('[data-qr-dbl]');
        if (dbl) {
            const was = !dbl.hidden;
            dbl.hidden = !t.dbl;
            if (t.dbl && !was) restartAnim(dbl, 'is-in');
        }
    }
}

/** Tug of War: the knot slides to where the lead puts it; the team ahead leans back, a near win trembles. */
function syncTug(levels) {
    const box = root()?.querySelector('[data-qr-tug]');
    if (!box || sd.teams.length !== 2) return;
    box.style.setProperty('--pull', levels[0].toFixed(3));
    const diff = sd.teams[0].score - sd.teams[1].score;
    box.classList.toggle('is-near', !sd.blind && Math.abs(diff) === sd.rules.tugN - 1);
    box.classList.toggle('is-a', diff > 0);
    box.classList.toggle('is-b', diff < 0);
}

/** The hot seat chip of one lane: a new name slides in. */
function syncSeat(lane, i) {
    if (!sd.rules.hotseat || sd.teams[i].dragon) return;
    const name = nameOf(showdownAnswerer(sd, i));
    let chip = lane.querySelector('[data-qr-seat]');
    if (!chip) {
        lane.insertAdjacentHTML('beforeend', seatHtml(name));
        chip = lane.querySelector('[data-qr-seat]');
    }
    const b = chip.querySelector('b');
    chip.hidden = !name;
    if (b && b.textContent !== name) { b.textContent = name; restartAnim(chip, 'is-new'); }
    const seated = showdownAnswerer(sd, i);
    lane.querySelectorAll('[data-qr-face]').forEach((f) => f.classList.toggle('is-seat', f.dataset.qrFace === seated));
}

/** A face pops when its hero's answer scores (the hot seat), or the whole crew bounces when the team scores. */
function popFaces(lane, answerer) {
    if (!lane || isStillFx()) return;
    const one = answerer ? [...lane.querySelectorAll('[data-qr-face]')].find((f) => f.dataset.qrFace === answerer) : null;
    if (one) { restartAnim(one, 'is-scored'); return; }
    const crew = lane.querySelector('.qr-lane__crew');
    if (crew) restartAnim(crew, 'is-cheer');
}

/** The roll call: every team's faces pop in one after another with their names, then the names tuck away. */
function rollCall() {
    const el = root();
    if (!el) return;
    clearTimeout(rollTimer);
    el.classList.add('is-rollcall');
    if (!isStillFx() && !isLiteFx()) {
        const lanes = [...el.querySelectorAll('[data-team]')];
        let step = 0;
        lanes.forEach((lane, li) => {
            const n = lane.querySelectorAll('[data-qr-face]').length;
            for (let k = 0; k < Math.min(n, 6); k++) {
                const at = 700 + li * 260 + k * 70;
                const s = step++;
                setTimeout(() => { if (root() === el) playShowdownSfx('rollcall', { team: li, step: s }); }, at);
            }
        });
    }
    rollTimer = setTimeout(() => root()?.classList.remove('is-rollcall'), isStillFx() ? 2500 : 4200);
}

/** The deck card: a new question flips in; a revealed one lights the right answer. */
function syncCard({ flip = false } = {}) {
    const box = root()?.querySelector('[data-qr-card]');
    if (!box || !sd) return;
    const card = cardFor(shownRound);
    box.hidden = !card;
    if (!card) { box.innerHTML = ''; return; }
    box.innerHTML = deckCardHtml(card);
    if (flip) { restartAnim(box, 'is-flip'); playShowdownSfx('card'); }
}

/** The question moved on (a point in Buzz-in, Next, Undo): show the answer of the one just played first. */
function moveCard({ showAnswer = true } = {}) {
    clearTimeout(cardTimer);
    if (!sd || !deck.length) { shownRound = sd?.round || 0; armClock(); return; }
    const from = shownRound;
    if (from === sd.round) { syncCard(); return; }
    const goingOn = sd.round > from;
    if (goingOn && showAnswer && cardFor(from) && !revealed.has(from)) {
        revealed.add(from);
        syncCard();
        playShowdownSfx('reveal');
        cardTimer = setTimeout(() => {
            if (!sd || sd.finished) return;
            shownRound = sd.round;
            syncCard({ flip: true });
            lastCtx?.scheduleStage(0);
            armClock();
        }, isStillFx() ? 900 : 2200);
        return;
    }
    shownRound = sd.round;
    syncCard({ flip: goingOn });
    if (goingOn) armClock();
}

function revealCard() {
    if (!sd || !cardFor(shownRound) || revealed.has(shownRound)) return false;
    revealed.add(shownRound);
    syncCard();
    playShowdownSfx('reveal');
    return true;
}

/** The Golden Question banner under the title: shown while the next point counts double. */
function syncGolden() {
    const banner = root()?.querySelector('[data-qr-golden]');
    if (!banner || !sd) return;
    const was = !banner.hidden;
    banner.hidden = !sd.golden;
    root().classList.toggle('is-golden', Boolean(sd.golden));
    if (sd.golden && !was) restartAnim(banner, 'is-in');
}

function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

/** A word that floats up from a lane ("Streak +1", "Underdog +1"). */
function popOn(lane, text, tone = '') {
    if (!lane || isStillFx()) return;
    const pop = document.createElement('span');
    pop.className = `qr-lane__pop${tone ? ` qr-lane__pop--${tone}` : ''}`;
    pop.textContent = text;
    lane.appendChild(pop);
    setTimeout(() => pop.remove(), 1500);
}

function countUp(el, to) {
    const from = Number(el.textContent) || 0;
    if (from === to) return;
    if (isStillFx() || Math.abs(to - from) > 5) { el.textContent = String(to); return; }
    const start = performance.now();
    const dur = 420;
    const step = (now) => {
        const k = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function stopCount() {
    clearTimeout(autoTimer);
    if (count) clearInterval(count.tick);
    count = null;
    root()?.querySelector('[data-qr-count]')?.remove();
}

/** The clock starts by itself with each question when the teacher chose a clock and "starts by itself". */
function armClock(delay = 1100) {
    clearTimeout(autoTimer);
    if (!sd || sd.finished || sd.reached || !sd.rules.clock || !sd.rules.autoClock) return;
    autoTimer = setTimeout(() => {
        if (!sd || sd.finished || sd.reached || count) return;
        startCount(sd.rules.clock);
        lastCtx?.scheduleStage(0);
    }, isStillFx() ? 300 : delay);
}

function startCount(seconds = 10) {
    stopCount();
    count = { left: seconds, id: (countSeq += 1), total: seconds };
    root()?.querySelector('.qr-sd__head')?.insertAdjacentHTML('beforeend', clockHtml(seconds, seconds));
    root()?.classList.remove('is-timesup');
    playShowdownSfx('clockstart');
    count.tick = setInterval(() => {
        if (!count) return;
        count.left -= 1;
        const badge = root()?.querySelector('[data-qr-count]');
        if (badge) {
            badge.style.setProperty('--k', (Math.max(0, count.left) / count.total).toFixed(3));
            badge.classList.toggle('is-low', count.left <= 3);
            badge.setAttribute('aria-label', `${Math.max(0, count.left)} seconds left`);
            const n = badge.querySelector('[data-qr-count-n]');
            if (n) n.textContent = String(Math.max(0, count.left));
            if (count.left <= 5) restartAnim(badge, 'is-tick');
        }
        if (count.left > 0) playShowdownSfx('tick', { left: count.left });
        if (count.left <= 0) timesUp(badge);
    }, 1000);
}

/** Time's up: a gong, the arena flashes, and a deck question shows its answer. */
function timesUp(badge) {
    playShowdownSfx('timeup');
    badge?.classList.add('is-zero');
    const n = badge?.querySelector('[data-qr-count-n]');
    if (n) n.innerHTML = '<i class="fas fa-bell" aria-hidden="true"></i>';
    clearInterval(count.tick);
    const el = root();
    if (el) restartAnim(el, 'is-timesup');
    const id = count.id;
    if (revealCard()) lastCtx?.scheduleStage(0);
    setTimeout(() => { if (count?.id === id) { stopCount(); lastCtx?.scheduleStage(0); } }, 1800);
}

export function getShowdownPanel() {
    if (!sd || !root()) return null;
    const panel = showdownPanel(sd, nameOf);
    // The clock's start, not every tick: the Wand counts down itself, so the session doc is not
    // rewritten each second (fewer Firestore writes, the free tier stays free).
    if (count && count.left > 0) { panel.clock = count.id; panel.clockFrom = count.total; }
    const card = !sd.finished ? cardFor(shownRound) : null;
    if (deck.length) panel.deckLeft = Math.max(0, deck.length - sd.round + 1);
    if (card) {
        panel.q = card.q;
        panel.opts = card.opts.map((t) => ({ t }));
        panel.card = card.n;
        panel.cards = card.total;
        panel.cardSrc = card.src;
        panel.revealed = card.revealed;
    }
    return panel;
}

/** What only the teacher's phone may know: the right answer of the card on screen. */
export function getShowdownSecret() {
    const card = sd && !sd.finished ? cardFor(shownRound) : null;
    return card ? { sdCorrect: card.correct } : null;
}

export function closeShowdown({ silent = false } = {}) {
    stopCount();
    clearTimeout(goalTimer);
    clearTimeout(cardTimer);
    clearTimeout(rollTimer);
    const el = root();
    sd = null;
    deck = [];
    revealed.clear();
    unwatchAttendance?.();
    unwatchAttendance = null;
    showClassId = '';
    if (!el) return;
    if (!silent) playShowdownSfx('close');
    el.classList.remove('is-in');
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), isStillFx() ? 0 : 520);
}

function showFinale(ctx) {
    stopCount();
    clearTimeout(goalTimer);
    clearTimeout(cardTimer);
    render({ finale: true });
    const winners = showdownWinners(sd);
    playShowdownSfx('finale', { dragon: winners.length === 1 && sd.teams[winners[0]]?.dragon });
    confettiRain({ colors: sd.teams.map((t) => t.color) });
    ctx.scheduleStage(0);
    const names = winners.map((i) => sd.teams[i].name);
    return sd.growth ? 'The garden is in bloom!' : names.length ? `${names.join(' & ')} win!` : 'A draw!';
}

/** The goal was reached: a beat for the class to see the last point land, then the finale (an undo in between cancels it). */
function onGoal(ctx) {
    clearTimeout(goalTimer);
    if (!sd?.reached || sd.finished) return;
    stopCount();
    const head = root()?.querySelector('.qr-sd__head');
    if (head) restartAnim(head, 'is-next');
    playShowdownSfx('goal');
    goalTimer = setTimeout(() => {
        if (!sd?.reached || sd.finished) return;
        sd = finishShowdown(sd);
        showFinale(ctx);
    }, isStillFx() ? 300 : 1500);
}

function openArena() {
    let el = root();
    // an arena still fading out is about to be removed: open a fresh one
    if (el?.classList.contains('is-leaving')) { el.remove(); el = null; }
    if (!el) {
        el = document.createElement('div');
        el.id = ROOT_ID;
        el.className = `qr-sd${isLiteFx() ? ' qr-lite' : ''}`;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Showdown Arena');
        document.body.appendChild(el);
        el.tabIndex = -1;
        el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeShowdown(); } });
        // The PC can always end the show too (the phone may have gone quiet): a quiet close button.
        el.addEventListener('click', (e) => { if (e.target.closest('[data-qr-sd-close]')) closeShowdown(); });
    }
    el.classList.remove('is-leaving');
    render();
    requestAnimationFrame(() => el.classList.add('is-in'));
    el.focus({ preventScroll: true });
}

/** One team's point lands: its sound (a team's motif), sparks, faces, bonus words and, in Treasure, its chest. */
function celebrate(gain) {
    if (!sd || !gain) return;
    const i = gain.team;
    const t = sd.teams[i];
    const lane = laneOf(i);
    if (!t) return;
    playShowdownSfx('score', { team: i, points: gain.total, golden: gain.golden, growth: sd.growth });
    if (sd.rules?.mode === 'tug') {
        setTimeout(() => playShowdownSfx('tug', { team: i }), 160);
        const box = root()?.querySelector('[data-qr-tug]');
        if (box && !isStillFx()) restartAnim(box, i ? 'is-yank-b' : 'is-yank-a');
    }
    if (!sd.growth && gain.bonus.includes('streak')) setTimeout(() => playShowdownSfx('streak', { n: t.streak }), 650);
    if (!sd.growth && gain.bonus.includes('underdog')) setTimeout(() => playShowdownSfx('underdog'), 900);
    if (lane) burstOn(lane.querySelector('.qr-lane__name') || lane, { color: t.color, count: t.streak >= 3 || gain.total > 1 ? 26 : 14 });
    popFaces(lane, gain.answerer);
    if (!sd.growth && !sd.blind) {
        if (gain.total > 1 && !gain.chest) popOn(lane, `+${gain.total}`);
        if (gain.bonus.includes('double')) popOn(lane, '💎 Double!', 'gem');
        if (gain.bonus.includes('streak')) setTimeout(() => popOn(lane, '🔥 Streak +1', 'fire'), 260);
        if (gain.bonus.includes('underdog')) setTimeout(() => popOn(lane, '⚡ Underdog +1', 'bolt'), 520);
    }
    if (gain.chest) openChest(lane, gain.chest);
}

/** Treasure: the chest pops open over the lane; a steal flies a coin over from the team it robbed. */
function openChest(lane, chest) {
    if (!lane) return;
    const from = chest.kind === 'steal' ? sd.teams[chest.from] : null;
    setTimeout(() => {
        if (!lane.isConnected) return;
        playShowdownSfx('chest', { kind: chest.kind });
        lane.querySelector('.qr-chest')?.remove();
        lane.insertAdjacentHTML('beforeend', chestHtml(chest, { from: from?.name || '' }));
        const box = lane.querySelector('.qr-chest');
        setTimeout(() => box?.remove(), isStillFx() ? 2000 : 2800);
        if (from) {
            const victim = laneOf(chest.from);
            setTimeout(() => {
                if (!victim?.isConnected) return;
                playShowdownSfx('steal');
                popOn(victim, '−1 stolen!', 'steal');
                restartAnim(victim, 'is-robbed');
                const fromEl = victim.querySelector('[data-qr-score]') || victim;
                sparkTo(lane.querySelector('[data-qr-score]') || lane, { color: '#fcd34d', size: 16, duration: 560, burst: 10, from: centreOf(fromEl) });
            }, 520);
        }
    }, 420);
}

function pointMessage(team, gain) {
    if (sd.growth) return gain.golden ? `${team.name}'s flower grows twice` : `${team.name}'s flower grows`;
    if (gain.total < 0) return `${gain.total} ${team.name}`.replace('-', '−');
    const extras = [gain.golden && 'golden', gain.bonus.includes('streak') && 'streak bonus', gain.bonus.includes('underdog') && 'underdog boost'].filter(Boolean);
    const who = gain.answerer ? ` (${nameOf(gain.answerer) || 'hero'})` : '';
    const c = gain.chest;
    if (c) extras.push(c.kind === 'double' ? 'chest: double next point' : c.kind === 'steal' ? `chest: steal from ${sd.teams[c.from]?.name || 'the leader'}` : `chest: +${c.amount}`);
    if (team.dragon) return `+${gain.total} The Dragon${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
    return `+${gain.total} ${team.name}${who}${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
}

/**
 * Runs one Showdown command from the Wand. `ctx` comes from remoteHost.js:
 * { sparkTo, scheduleStage, award(studentId, reason, stars) → Promise<{ok, message}> }.
 */
export async function runShowdownCommand(p, ctx) {
    lastCtx = ctx;
    switch (p.action) {
        case 'open': {
            const classId = state.get('globalSelectedClassId');
            if (!classId) return 'Choose a class first';
            const cls = classById(classId);
            const rules = normalizeShowdownRules(p.rules && typeof p.rules === 'object' ? p.rules : p);
            const [teams, loaded] = await Promise.all([
                Array.isArray(p.teams) ? forgedTeams(classId, p) : buildTeams(classId),
                loadDeck(classId, cls, rules.deck, p.words).catch(() => ({ cards: [], label: '' }))
            ]);
            if (teams.filter((t) => !t.dragon).every((t) => !t.members.length)) return 'Nobody is here to play';
            const roster = (state.get('allStudents') || []).filter((s) => s.classId === classId);
            names = new Map(roster.map((s) => [s.id, String(s.name || 'Hero').split(/\s+/)[0]]));
            faces = new Map(roster.map((s) => [s.id, { name: String(s.name || 'Hero').split(/\s+/)[0], avatar: s.avatar || '' }]));
            clearTimeout(goalTimer);
            clearTimeout(cardTimer);
            stopCount();
            deck = loaded.cards;
            revealed.clear();
            // a "N questions" show never runs past the end of its deck
            if (deck.length && rules.goal === 'questions' && deck.length < rules.goalN) rules.goalN = Math.max(Math.min(deck.length, rules.goalN), 1);
            sd = createShowdown(teams, {
                growth: isGrowthLeague(cls?.questLevel),
                title: `${cls?.logo || '⚔️'} ${cls?.name || 'Showdown'}`,
                rules
            });
            showClassId = classId;
            watchAttendance();
            openArena();
            playShowdownSfx('open', { teams: sd.teams.length });
            rollCall();
            armClock(deck.length ? 3600 : 3000);
            ctx.scheduleStage(0);
            const away = awayToday(classId).size;
            const awayNote = away ? ` · ${away} away, not playing` : '';
            if (rules.deck !== 'voice' && !deck.length) return `Showdown!${awayNote} · No questions found for this class yet: ask out loud`;
            return deck.length ? `Showdown!${awayNote} · ${deck.length} questions · ${loaded.label}` : `Showdown!${awayNote}`;
        }
        case 'point':
        case 'minus': {
            if (!sd || sd.finished) return 'No Showdown on screen';
            const up = p.action === 'point';
            // several teams can get it at once ("Foxes and Dolphins both got it"): one tap, one Undo
            const asked = up && Array.isArray(p.teams) ? p.teams : [p.team];
            const list = [...new Set(asked)].filter((i) => sd.teams[i] && !(up && sd.teams[i].out));
            if (!list.length) return sd.teams[p.team]?.out ? `${sd.teams[p.team].name} is out` : '';
            if (up) {
                // the sparks fly together, a beat apart, and the points land as the last one arrives
                await Promise.all(list.map((i, k) => {
                    const lane = laneOf(i);
                    const target = lane?.querySelector('.qr-lane__bar, .qr-lane__flower, [data-qr-score]') || lane;
                    if (!target) return null;
                    return new Promise((done) => setTimeout(() => sparkTo(target, { color: sd?.teams[i]?.color || '#fcd34d', size: 24, duration: 520, burst: 16 }).then(done), k * 110));
                }));
            }
            if (!sd || sd.finished) return '';
            const leaderBefore = showdownWinners(sd);
            sd = up ? scoreShowdownTeams(sd, list, p.points || 1) : scoreShowdown(sd, list[0], -1);
            // Buzz-in: the point ends the question, so the clock stops; Everyone: the other teams still write
            if (!up || sd.rules.style !== 'all') stopCount();
            update(up ? list : []);
            const gains = up ? (sd.lastGains?.length ? sd.lastGains : [sd.lastGain]).filter(Boolean) : [];
            if (up) {
                gains.forEach((gain, k) => setTimeout(() => { if (root()) celebrate(gain); }, k * 280));
                const leaderNow = showdownWinners(sd);
                if (!sd.growth && !sd.blind && leaderNow.length === 1 && leaderBefore.length && !leaderBefore.includes(leaderNow[0])) {
                    setTimeout(() => playShowdownSfx('lead'), 1150 + (gains.length - 1) * 280);
                }
                if (gains.length > 2 && !isStillFx()) setTimeout(() => playShowdownSfx('chorus', { n: gains.length }), gains.length * 280 + 200);
            } else playShowdownSfx('minus');
            if (sd.reached) onGoal(ctx);
            else if (up && sd.rules.style !== 'all') moveCard();
            ctx.scheduleStage(0);
            if (!up) return pointMessage(sd.teams[list[0]], sd.lastGain || { total: -1, bonus: [] });
            if (gains.length === 1) return pointMessage(sd.teams[gains[0].team], gains[0]);
            return gains.map((g) => (sd.growth ? sd.teams[g.team].name : `+${g.total} ${sd.teams[g.team].name}`)).join(' · ') + (sd.growth ? ': flowers grow' : '');
        }
        case 'miss': {
            if (!sd || sd.finished || sd.rules.mode !== 'survivor') return '';
            const list = [...new Set(Array.isArray(p.teams) ? p.teams : [p.team])].filter((i) => sd.teams[i] && !sd.teams[i].out);
            if (!list.length) return '';
            sd = missShowdownTeams(sd, list);
            const gains = sd.lastGains || [];
            update();
            gains.forEach((g, k) => setTimeout(() => {
                const lane = laneOf(g.team);
                if (lane && !isStillFx()) restartAnim(lane, g.out ? 'is-knocked' : 'is-hit');
                playShowdownSfx(g.out ? 'knockout' : 'miss', { team: g.team });
            }, k * 320));
            if (sd.reached) setTimeout(() => onGoal(ctx), gains.length * 320 + 400);
            ctx.scheduleStage(0);
            const names = gains.map((g) => sd.teams[g.team].name);
            const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} & ${xs[xs.length - 1]}` : xs[0] || '');
            if (gains[0]?.saved) return 'Every team missed: all keep their last heart';
            const outs = gains.filter((g) => g.out).map((g) => sd.teams[g.team].name);
            if (outs.length) return `${and(outs)} ${outs.length === 1 ? 'is' : 'are'} knocked out!`;
            return `${and(names)} lose${names.length === 1 ? 's' : ''} a heart`;
        }
        case 'next': {
            if (!sd || sd.finished) return '';
            stopCount();
            const nobody = !sd.roundScorers.length;
            sd = nextShowdownQuestion(sd);
            update();
            const head = root()?.querySelector('.qr-sd__head');
            if (head) restartAnim(head, 'is-next');
            if (sd.reached) { onGoal(ctx); ctx.scheduleStage(0); return 'That was the last question!'; }
            const last = sd.rules.goal === 'questions' && sd.round === sd.rules.goalN;
            if (!deck.length) playShowdownSfx('question', { last });
            else if (last) setTimeout(() => playShowdownSfx('question', { last }), 2300);
            moveCard();
            ctx.scheduleStage(0);
            if (last) return 'The last question!';
            return nobody && sd.rules.style === 'buzz' ? 'Nobody got it · next question' : 'Next question';
        }
        case 'reveal': {
            if (!sd || sd.finished) return '';
            stopCount();
            const done = revealCard();
            ctx.scheduleStage(0);
            return done ? 'The answer is on the screen' : '';
        }
        case 'pass': {
            if (!sd || sd.finished || !sd.rules.hotseat) return '';
            sd = passShowdownSeats(sd);
            update();
            playShowdownSfx('pass');
            ctx.scheduleStage(0);
            return 'The microphone passes on';
        }
        case 'undo': {
            if (!sd?.history?.length) return 'Nothing to undo';
            const wasFinished = sd.finished;
            clearTimeout(goalTimer);
            clearTimeout(cardTimer);
            stopCount();
            sd = undoShowdown(sd);
            if (wasFinished && !sd.finished) render();
            else { update(); if (shownRound !== sd.round) { revealed.delete(sd.round); shownRound = sd.round; syncCard(); } }
            playShowdownSfx('undo');
            ctx.scheduleStage(0);
            return 'Undone';
        }
        case 'blind': {
            if (!sd || sd.finished || sd.growth) return '';
            sd = { ...sd, blind: !sd.blind };
            update();
            playShowdownSfx('blind', { on: sd.blind });
            ctx.scheduleStage(0);
            return sd.blind ? 'Scores hidden until the finale' : 'Scores showing';
        }
        case 'golden': {
            if (!sd || sd.finished) return '';
            sd = { ...sd, golden: !sd.golden };
            syncGolden();
            if (sd.golden) {
                playShowdownSfx('golden');
                const banner = root()?.querySelector('[data-qr-golden]');
                if (banner) burstOn(banner, { color: '#fcd34d', count: 18 });
            }
            ctx.scheduleStage(0);
            return sd.golden ? 'Golden question: the next point counts double' : 'Golden question off';
        }
        case 'timer': {
            if (!sd || sd.finished) return '';
            const seconds = p.seconds || sd.rules.clock || 10;
            startCount(seconds);
            ctx.scheduleStage(0);
            return `${seconds} seconds!`;
        }
        case 'stopclock': {
            if (!count) return '';
            stopCount();
            ctx.scheduleStage(0);
            return 'Clock stopped';
        }
        case 'finish': {
            if (!sd || sd.finished) return '';
            sd = finishShowdown(sd);
            return showFinale(ctx);
        }
        case 'rematch': {
            if (!sd) return '';
            clearTimeout(goalTimer);
            clearTimeout(cardTimer);
            stopCount();
            // the same teams, minus anyone marked absent since
            sd = removeShowdownMembers(rematchShowdown(sd), awayToday(showClassId));
            revealed.clear();
            // a rematch with a deck asks the questions in a fresh order
            deck = [...deck].sort(() => Math.random() - 0.5);
            openArena();
            playShowdownSfx('open', { teams: sd.teams.length });
            armClock(3000);
            ctx.scheduleStage(0);
            return 'Rematch! Same teams, fresh scores';
        }
        case 'reward': {
            if (!sd?.finished) return 'Finish the Showdown first';
            const scope = p.scope || 'winners';
            // never a star for a hero marked absent (even one marked after the show began)
            const away = awayToday(showClassId);
            const ids = showdownRewardIds(sd, scope).filter((id) => !away.has(id));
            if (!ids.length) return scope === 'stars' ? 'No star players yet (turn on the hot seat)' : 'Nobody to reward';
            const stars = p.stars || 1;
            closeShowdown({ silent: true });
            let given = 0;
            let skipped = 0;
            for (const id of ids) {
                const res = await ctx.award(id, 'teamwork', stars);
                if (res?.ok) given += 1; else skipped += 1;
            }
            ctx.scheduleStage(0);
            return `Teamwork stars (${stars}) for ${given}${skipped ? ` · ${skipped} already had today's stars` : ''}`;
        }
        case 'close':
            closeShowdown();
            ctx.scheduleStage(0);
            return '';
        default:
            return '';
    }
}
