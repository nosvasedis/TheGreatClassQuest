// features/questRemote/showdown.js — Showdown Arena (Quest Remote, projector side, lazy).
// A Kahoot-style team race with no student devices: the teacher asks out loud, the Wand gives the
// point, the projector does the show (bars leap, streak flames, game-show stings, podium).
// Teams come from the Wand's Team Forge (fair on stars, guilds mixed, luck, the guilds as they are,
// today's Team Maker teams, or the whole class against the Dragon); an older Wand that sends no
// teams gets today's Team Maker teams, else the guilds, else two halves of the class.
// Teams last one show: nobody's guild ever changes. Rules (answer style, goal, clock, streak bonus,
// underdog boost, hot seat) travel with `open` and are applied by remoteCore.mjs.
// Nursery / Pre-Junior play the Growth Festival way: flowers grow, no numbers, everyone blooms.
// Rewards are ordinary Teamwork stars through the Award Stars cloud (one award per hero per day,
// exactly as with the mouse), so the Showdown never invents a new kind of star.
// Markup: remoteStageView.mjs.

import * as state from '../../state.js';
import { playSound, playQuizShowSfx } from '../../audio.js';
import { getTodayDateString } from '../../utils.js';
import {
    createShowdown, scoreShowdown, nextShowdownQuestion, passShowdownSeats, finishShowdown, undoShowdown, rematchShowdown,
    showdownWinners, showdownPanel, isGrowthLeague, showdownBarLevels, showdownAnswerer, showdownGoalText, showdownRewardIds,
    showdownTeamLooks, normalizeShowdownRules
} from './remoteCore.mjs';
import { showdownHtml, showdownFinaleHtml, growthFlower, seatHtml } from './remoteStageView.mjs';
import { burstOn, confettiRain, isLiteFx, isStillFx } from './remoteFx.js';

const ROOT_ID = 'qr-showdown';

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId) || null;
}
let sd = null;
let count = null; // { left, tick, id, total }
let countSeq = 0;
let names = new Map();
let goalTimer = 0;

const nameOf = (id) => names.get(id) || '';

function classRosterNow(classId) {
    const today = getTodayDateString();
    const away = new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today).map((r) => r.studentId));
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

/** The Team Forge's teams, checked against the class (a stale phone never smuggles in another class's heroes). */
async function forgedTeams(classId, p) {
    const cls = classById(classId);
    const inClass = new Set((state.get('allStudents') || []).filter((s) => s.classId === classId).map((s) => s.id));
    const packed = p.teams.map((t) => ({ ...t, ids: (t.ids || []).filter((id) => inClass.has(id)) }));
    const [{ getGuildById }, { teamBanner }] = await Promise.all([import('../guilds.js'), import('../teamMakerCore.mjs')]);
    const looks = showdownTeamLooks(p.split, packed, {
        guildOf: getGuildById, bannerOf: teamBanner, classLook: cls ? { name: cls.name, emoji: cls.logo } : null
    });
    return packed.map((t, i) => ({ ...looks[i], members: t.ids }));
}

function root() { return document.getElementById(ROOT_ID); }

function render({ finale = false } = {}) {
    const el = root();
    if (!el || !sd) return;
    el.dataset.growth = String(sd.growth);
    el.classList.toggle('is-blind', Boolean(sd.blind && !sd.growth && !finale));
    el.innerHTML = `${finale ? showdownFinaleHtml(sd, { nameOf }) : showdownHtml(sd, { secondsLeft: count?.left ?? null, nameOf })}
        <button type="button" class="qr-sd__close" data-qr-sd-close aria-label="Close the arena" title="Close the arena (Esc)"><i class="fas fa-xmark" aria-hidden="true"></i></button>`;
}

/** Moves the bars and numbers without rebuilding the stage (smooth, cheap). */
function update(scoredIndex = -1) {
    const el = root();
    if (!el || !sd) return;
    const levels = showdownBarLevels(sd);
    sd.teams.forEach((t, i) => {
        const lane = el.querySelector(`.qr-lane[data-team="${i}"]`);
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
                track?.appendChild(streak);
            }
            streak.innerHTML = `<i class="fas fa-fire"></i>${t.streak}`;
            streak.setAttribute('aria-label', `${t.streak} in a row`);
        } else streak?.remove();
        lane.classList.toggle('is-leading', !sd.blind && levels[i] >= 1 && t.score > 0 && sd.rules.goal !== 'points');
        lane.classList.toggle('is-got', sd.roundScorers.includes(i));
        syncSeat(lane, i);
        if (i === scoredIndex) restartAnim(lane, 'is-scored');
    });
    const round = el.querySelector('[data-qr-round]');
    if (round) round.textContent = String(sd.round);
    const goal = el.querySelector('[data-qr-goal]');
    if (goal) goal.textContent = showdownGoalText(sd);
    el.classList.toggle('is-blind', Boolean(sd.blind && !sd.growth));
    const blind = el.querySelector('[data-qr-blind]');
    if (blind) blind.hidden = !(sd.blind && !sd.growth);
    syncGolden();
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
    if (count) clearInterval(count.tick);
    count = null;
    root()?.querySelector('[data-qr-count]')?.remove();
}

function startCount(seconds = 10) {
    stopCount();
    count = { left: seconds, id: (countSeq += 1), total: seconds };
    const head = root()?.querySelector('.qr-sd__head');
    if (head) {
        const badge = document.createElement('div');
        badge.className = 'qr-sd__count';
        badge.dataset.qrCount = '';
        badge.textContent = String(seconds);
        head.appendChild(badge);
    }
    count.tick = setInterval(() => {
        if (!count) return;
        count.left -= 1;
        const badge = root()?.querySelector('[data-qr-count]');
        if (badge) { badge.textContent = String(Math.max(0, count.left)); restartAnim(badge, 'is-tick'); }
        if (count.left <= 3 && count.left > 0) playSound('click');
        if (count.left <= 0) {
            playQuizShowSfx('buzz');
            badge?.classList.add('is-zero');
            clearInterval(count.tick);
            const id = count.id;
            setTimeout(() => { if (count?.id === id) stopCount(); }, 1400);
        }
    }, 1000);
}

export function getShowdownPanel() {
    if (!sd || !root()) return null;
    const panel = showdownPanel(sd, nameOf);
    // The clock's start, not every tick: the Wand counts down itself, so the session doc is not
    // rewritten each second (fewer Firestore writes, the free tier stays free).
    if (count && count.left > 0) { panel.clock = count.id; panel.clockFrom = count.total; }
    return panel;
}

export function closeShowdown({ silent = false } = {}) {
    stopCount();
    clearTimeout(goalTimer);
    const el = root();
    sd = null;
    if (!el) return;
    if (!silent) playQuizShowSfx('curtain');
    el.classList.remove('is-in');
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), isStillFx() ? 0 : 520);
}

function showFinale(ctx) {
    stopCount();
    clearTimeout(goalTimer);
    render({ finale: true });
    playQuizShowSfx('fanfare', { tier: 'epic' });
    confettiRain({ colors: sd.teams.map((t) => t.color) });
    ctx.scheduleStage(0);
    const winners = showdownWinners(sd).map((i) => sd.teams[i].name);
    return sd.growth ? 'The garden is in bloom!' : winners.length ? `${winners.join(' & ')} win!` : 'A draw!';
}

/** The goal was reached: a beat for the class to see the last point land, then the finale (an undo in between cancels it). */
function onGoal(ctx) {
    clearTimeout(goalTimer);
    if (!sd?.reached || sd.finished) return;
    const head = root()?.querySelector('.qr-sd__head');
    if (head) restartAnim(head, 'is-next');
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

function pointMessage(team, gain) {
    if (sd.growth) return gain.golden ? `${team.name}'s flower grows twice` : `${team.name}'s flower grows`;
    if (gain.total < 0) return `${gain.total} ${team.name}`.replace('-', '−');
    const extras = [gain.golden && 'golden', gain.bonus.includes('streak') && 'streak bonus', gain.bonus.includes('underdog') && 'underdog boost'].filter(Boolean);
    const who = gain.answerer ? ` (${nameOf(gain.answerer) || 'hero'})` : '';
    if (team.dragon) return `+${gain.total} The Dragon${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
    return `+${gain.total} ${team.name}${who}${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
}

/**
 * Runs one Showdown command from the Wand. `ctx` comes from remoteHost.js:
 * { sparkTo, scheduleStage, award(studentId, reason, stars) → Promise<{ok, message}> }.
 */
export async function runShowdownCommand(p, ctx) {
    switch (p.action) {
        case 'open': {
            const classId = state.get('globalSelectedClassId');
            if (!classId) return 'Choose a class first';
            const cls = classById(classId);
            const teams = Array.isArray(p.teams) ? await forgedTeams(classId, p) : await buildTeams(classId);
            if (teams.filter((t) => !t.dragon).every((t) => !t.members.length)) return 'Nobody is here to play';
            names = new Map((state.get('allStudents') || []).filter((s) => s.classId === classId)
                .map((s) => [s.id, String(s.name || 'Hero').split(/\s+/)[0]]));
            clearTimeout(goalTimer);
            stopCount();
            sd = createShowdown(teams, {
                growth: isGrowthLeague(cls?.questLevel),
                title: `${cls?.logo || '⚔️'} ${cls?.name || 'Showdown'}`,
                rules: normalizeShowdownRules(p)
            });
            openArena();
            playQuizShowSfx('curtain');
            ctx.scheduleStage(0);
            return 'Showdown!';
        }
        case 'point':
        case 'minus': {
            if (!sd || sd.finished) return 'No Showdown on screen';
            const team = sd.teams[p.team];
            if (!team) return '';
            const up = p.action === 'point';
            const lane = root()?.querySelector(`.qr-lane[data-team="${p.team}"]`);
            const target = lane?.querySelector('.qr-lane__bar, .qr-lane__flower') || lane;
            if (up && target) await ctx.sparkTo(target, { color: team.color, size: 24, duration: 520, burst: 16 });
            if (!sd || sd.finished) return '';
            sd = scoreShowdown(sd, p.team, up ? (p.points || 1) : -1);
            stopCount();
            update(up ? p.team : -1);
            const t = sd.teams[p.team];
            const gain = sd.lastGain || { total: up ? 1 : -1, bonus: [] };
            if (up) {
                if (!sd.growth && (t.streak >= 3 || gain.bonus.length)) playQuizShowSfx('fanfare', { tier: t.streak >= 5 ? 'epic' : 'rare' });
                else playQuizShowSfx('land');
                if (lane) burstOn(lane.querySelector('.qr-lane__name') || lane, { color: team.color, count: t.streak >= 3 || gain.total > 1 ? 26 : 14 });
                if (!sd.growth && !sd.blind) {
                    if (gain.total > 1) popOn(lane, `+${gain.total}`);
                    if (gain.bonus.includes('streak')) setTimeout(() => popOn(lane, '🔥 Streak +1', 'fire'), 260);
                    if (gain.bonus.includes('underdog')) setTimeout(() => popOn(lane, '⚡ Underdog +1', 'bolt'), 520);
                }
            } else playQuizShowSfx('missed');
            ctx.scheduleStage(0);
            if (sd.reached) onGoal(ctx);
            return pointMessage(team, gain);
        }
        case 'next': {
            if (!sd || sd.finished) return '';
            stopCount();
            const nobody = !sd.roundScorers.length;
            sd = nextShowdownQuestion(sd);
            update();
            playQuizShowSfx(nobody && sd.rules.style === 'buzz' ? 'missed' : 'skip');
            const head = root()?.querySelector('.qr-sd__head');
            if (head) restartAnim(head, 'is-next');
            ctx.scheduleStage(0);
            if (sd.reached) { onGoal(ctx); return 'That was the last question!'; }
            return nobody && sd.rules.style === 'buzz' ? 'Nobody got it · next question' : 'Next question';
        }
        case 'pass': {
            if (!sd || sd.finished || !sd.rules.hotseat) return '';
            sd = passShowdownSeats(sd);
            update();
            playSound('click');
            ctx.scheduleStage(0);
            return 'The microphone passes on';
        }
        case 'undo': {
            if (!sd?.history?.length) return 'Nothing to undo';
            const wasFinished = sd.finished;
            clearTimeout(goalTimer);
            sd = undoShowdown(sd);
            if (wasFinished && !sd.finished) render(); else update();
            playQuizShowSfx('skip');
            ctx.scheduleStage(0);
            return 'Undone';
        }
        case 'blind': {
            if (!sd || sd.finished || sd.growth) return '';
            sd = { ...sd, blind: !sd.blind };
            update();
            playQuizShowSfx(sd.blind ? 'trick' : 'land');
            ctx.scheduleStage(0);
            return sd.blind ? 'Scores hidden until the finale' : 'Scores showing';
        }
        case 'golden': {
            if (!sd || sd.finished) return '';
            sd = { ...sd, golden: !sd.golden };
            syncGolden();
            if (sd.golden) {
                playQuizShowSfx('trick');
                const banner = root()?.querySelector('[data-qr-golden]');
                if (banner) burstOn(banner, { color: '#fcd34d', count: 18 });
            }
            ctx.scheduleStage(0);
            return sd.golden ? 'Golden question: the next point counts double' : 'Golden question off';
        }
        case 'timer': {
            if (!sd || sd.finished) return '';
            const seconds = p.seconds || sd.rules.clock;
            startCount(seconds);
            playQuizShowSfx('tally', { seconds: 0.4 });
            ctx.scheduleStage(0);
            return `${seconds} seconds!`;
        }
        case 'finish': {
            if (!sd || sd.finished) return '';
            sd = finishShowdown(sd);
            return showFinale(ctx);
        }
        case 'rematch': {
            if (!sd) return '';
            clearTimeout(goalTimer);
            stopCount();
            sd = rematchShowdown(sd);
            openArena();
            playQuizShowSfx('curtain');
            ctx.scheduleStage(0);
            return 'Rematch! Same teams, fresh scores';
        }
        case 'reward': {
            if (!sd?.finished) return 'Finish the Showdown first';
            const scope = p.scope || 'winners';
            const ids = showdownRewardIds(sd, scope);
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
