// features/questRemote/showdown.js — Showdown Arena (Quest Remote, projector side, lazy).
// A Kahoot-style team race with no student devices: the teacher asks out loud, the Wand gives the
// point, the projector does the show (bars leap, streak flames, game-show stings, podium).
// Teams: today's Team Maker teams, else the class's guilds, else two halves of the class.
// Nursery / Pre-Junior play the Growth Festival way: flowers grow, no numbers, everyone blooms.
// Rewards are ordinary Teamwork stars through the Award Stars cloud (one award per hero per day,
// exactly as with the mouse), so the Showdown never invents a new kind of star.
// Rules: remoteCore.mjs (createShowdown, scoreShowdown, …). Markup: remoteStageView.mjs.

import * as state from '../../state.js';
import { playSound, playQuizShowSfx } from '../../audio.js';
import { getTodayDateString } from '../../utils.js';
import { createShowdown, scoreShowdown, showdownWinners, showdownPanel, isGrowthLeague, showdownBarLevels } from './remoteCore.mjs';
import { showdownHtml, showdownFinaleHtml, growthFlower } from './remoteStageView.mjs';
import { burstOn, confettiRain, isLiteFx, isStillFx } from './remoteFx.js';

const ROOT_ID = 'qr-showdown';

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId) || null;
}
let sd = null;
let count = null; // { left, tick, id, total }
let countSeq = 0;

function classRosterNow(classId) {
    const today = getTodayDateString();
    const away = new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today).map((r) => r.studentId));
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && !away.has(s.id));
}

async function buildTeams(classId) {
    const roster = classRosterNow(classId);
    const here = new Set(roster.map((s) => s.id));
    // 1. today's Team Maker teams
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
    // 2. the guilds in the room
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
    // 3. two halves
    const ids = roster.map((s) => s.id);
    const half = Math.ceil(ids.length / 2);
    return [
        { name: 'Sun Team', color: '#f59e0b', emoji: '☀️', members: ids.slice(0, half) },
        { name: 'Moon Team', color: '#6366f1', emoji: '🌙', members: ids.slice(half) }
    ];
}

function root() { return document.getElementById(ROOT_ID); }

function render({ finale = false } = {}) {
    const el = root();
    if (!el || !sd) return;
    el.dataset.growth = String(sd.growth);
    el.innerHTML = `${finale ? showdownFinaleHtml(sd) : showdownHtml(sd, { secondsLeft: count?.left ?? null })}
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
        lane.classList.toggle('is-leading', levels[i] >= 1 && t.score > 0);
        if (i === scoredIndex) restartAnim(lane, 'is-scored');
    });
    const round = el.querySelector('[data-qr-round]');
    if (round) round.textContent = String(sd.round);
    syncGolden();
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
    const panel = showdownPanel(sd);
    // The clock's start, not every tick: the Wand counts down itself, so the session doc is not
    // rewritten each second (fewer Firestore writes, the free tier stays free).
    if (count && count.left > 0) { panel.clock = count.id; panel.clockFrom = count.total; }
    return panel;
}

export function closeShowdown({ silent = false } = {}) {
    stopCount();
    const el = root();
    sd = null;
    if (!el) return;
    if (!silent) playQuizShowSfx('curtain');
    el.classList.remove('is-in');
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), isStillFx() ? 0 : 520);
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
            const teams = await buildTeams(classId);
            if (teams.every((t) => !t.members.length)) return 'Nobody is here to play';
            sd = createShowdown(teams, { growth: isGrowthLeague(cls?.questLevel), title: `${cls?.logo || '⚔️'} ${cls?.name || 'Showdown'}` });
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
            playQuizShowSfx('curtain');
            ctx.scheduleStage(0);
            return 'Showdown!';
        }
        case 'point':
        case 'minus': {
            if (!sd) return 'No Showdown on screen';
            const team = sd.teams[p.team];
            if (!team) return '';
            const up = p.action === 'point';
            const lane = root()?.querySelector(`.qr-lane[data-team="${p.team}"]`);
            const target = lane?.querySelector('.qr-lane__bar, .qr-lane__flower') || lane;
            if (up && target) await ctx.sparkTo(target, { color: team.color, size: 24, duration: 520, burst: 16 });
            const golden = up && sd.golden;
            sd = scoreShowdown(sd, p.team, up ? 1 : -1);
            stopCount();
            update(up ? p.team : -1);
            const t = sd.teams[p.team];
            if (up) {
                if (!sd.growth && t.streak >= 3) playQuizShowSfx('fanfare', { tier: t.streak >= 5 ? 'epic' : 'rare' });
                else playQuizShowSfx('land');
                if (lane) burstOn(lane.querySelector('.qr-lane__name') || lane, { color: team.color, count: t.streak >= 3 ? 26 : 14 });
            } else playQuizShowSfx('missed');
            ctx.scheduleStage(0);
            if (golden) return sd.growth ? `${team.name}'s flower grows twice` : `+2 ${team.name} · golden!`;
            return up ? (sd.growth ? `${team.name}'s flower grows` : `+1 ${team.name}`) : `−1 ${team.name}`;
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
            if (!sd) return '';
            startCount(10);
            playQuizShowSfx('tally', { seconds: 0.4 });
            ctx.scheduleStage(0);
            return 'Ten seconds!';
        }
        case 'next': {
            if (!sd) return '';
            stopCount();
            playQuizShowSfx('skip');
            const head = root()?.querySelector('.qr-sd__head');
            if (head) restartAnim(head, 'is-next');
            return 'Next question';
        }
        case 'finish': {
            if (!sd) return '';
            stopCount();
            sd = { ...sd, finished: true };
            render({ finale: true });
            playQuizShowSfx('fanfare', { tier: 'epic' });
            confettiRain({ colors: sd.teams.map((t) => t.color) });
            ctx.scheduleStage(0);
            const winners = showdownWinners(sd).map((i) => sd.teams[i].name);
            return sd.growth ? 'The garden is in bloom!' : winners.length ? `${winners.join(' & ')} win!` : 'A draw!';
        }
        case 'reward': {
            if (!sd?.finished) return 'Finish the Showdown first';
            // Growth Festival: everyone helped the garden; otherwise the winning team(s).
            const teams = sd.growth ? sd.teams : showdownWinners(sd).map((i) => sd.teams[i]);
            const ids = [...new Set(teams.flatMap((t) => t.members))];
            if (!ids.length) return 'Nobody to reward';
            closeShowdown({ silent: true });
            let given = 0;
            let skipped = 0;
            for (const id of ids) {
                const res = await ctx.award(id, 'teamwork', 1);
                if (res?.ok) given += 1; else skipped += 1;
            }
            ctx.scheduleStage(0);
            return `Teamwork stars: ${given}${skipped ? ` (${skipped} already had today's stars)` : ''}`;
        }
        case 'close':
            closeShowdown();
            ctx.scheduleStage(0);
            return '';
        default:
            return '';
    }
}
