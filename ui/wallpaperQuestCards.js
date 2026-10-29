// /ui/wallpaperQuestCards.js — Projector Mode (The Director): cards for the newer quests.
// Training Grounds knots this week, the Quiz Champion of the week, Ember Oaths kept this month
// (a count only, never names), the class's Map Journal stamps, and the Mystic Market's festival
// stall, today's Team Maker teams, and the school's Realm Raid. Then the class's quest rank and
// Portal runes, Hero Seals pressed this week, today's Hero Duels, the Quiet Dragon's last gift,
// a Starfall waiting for the lesson, the class's Hero Paths, and the last Crown Race chronicle.
// Every builder returns null when it has nothing real to show, so the Director moves on.
// Everything here is seen by the whole class: no marks, no absences, no teacher-only notes.
import '../styles/wallpaper_quest_cards.css';
import '../styles/hero_seals.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { escapeCardText as esc } from './wallpaperDeck.mjs';
import { TRAINING_GAMES, TRAINING_GAME_KEYS, knotsTied, normalizeGameState } from '../features/trainingGroundsCore.mjs';
import { REALM_STOPS, journalMonth, realmMonthKey } from '../features/realmMomentsCore.mjs';
import { getActiveFestival, getFestivalWindow } from '../utils/shopCalendar.js';
import { teamsForDay, teamBanner } from '../features/teamMakerCore.mjs';
import { rankCrestSvg } from '../features/questRankCrest.mjs';
import { starsToReachPercent } from '../features/teamQuestRace.mjs';
import { portalStatusLine } from '../features/questRanksCore.mjs';
import { SEALS, isAcademicSeal, sealArtHtml } from '../features/heroSealsCore.mjs';
import { normalizeDuels, heroStandings, teamTotals } from '../features/heroDuelsCore.mjs';
import { normalizeHeroClass } from '../features/heroClassNames.mjs';
import { isLegendHero, getLegendQuest } from '../features/legendQuestCore.mjs';

const CLASS_QUEST_CARDS = [
    'tg_knots_week', 'quiz_champion_week', 'oaths_kept_month', 'realm_journal_month', 'class_teams_today',
    'quest_rank_portal', 'hero_seals_week', 'hero_duels_today', 'quiet_dragon_week', 'starfall_waiting', 'hero_paths_class'
];
const SHARED_QUEST_CARDS = ['market_festival', 'realm_raid', 'guild_chapter_chronicle'];

export const QUEST_CARD_TYPES = Object.freeze([...CLASS_QUEST_CARDS, ...SHARED_QUEST_CARDS]);

/** Tier gates (see CARD_FEATURE_REQUIREMENTS in wallpaper.js). */
export const QUEST_CARD_FEATURES = Object.freeze({
    tg_knots_week: 'storyWeavers',
    quiz_champion_week: 'quizOfTheWeek',
    oaths_kept_month: 'heroCampfire',
    starfall_waiting: 'scholarScroll',
    hero_paths_class: 'heroProgression',
    guild_chapter_chronicle: 'guilds'
});

export function getQuestCardDeck(classId) {
    return classId ? [...CLASS_QUEST_CARDS, ...SHARED_QUEST_CARDS] : [...SHARED_QUEST_CARDS];
}

const BADGES = {
    silver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

const FESTIVALS = [
    ['halloween', '🎃'], ['christmas', '🎄'], ['newyear', '🍀'], ['carnival', '🎭'],
    ['easter', '🐣'], ['mayday', '🌼'], ['endofyear', '🏆']
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const cache = new Map();
async function cached(key, ms, loader) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ms) return hit.value;
    const value = await loader();
    cache.set(key, { at: Date.now(), value });
    return value;
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || null;
}

function studentById(id) {
    return (state.get('allStudents') || []).find((s) => s.id === id) || null;
}

function firstName(student) {
    return esc(String(student?.name || '').split(' ')[0]);
}

function avatarHtml(student) {
    if (student?.avatar) return `<img src="${esc(student.avatar)}" alt="" class="sc-avatar sc-avatar--lg">`;
    return `<span class="sc-avatar sc-avatar--lg sc-avatar--letter">${esc((student?.name || '?').charAt(0))}</span>`;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const parsed = utils.parseFlexibleDate?.(text);
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function startOfWeek(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
}

function dayLabel(date) {
    return date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function knotsHtml(tied) {
    return `<span class="qc-knots" aria-hidden="true">${[0, 1].map((i) => `<i class="${i < tied ? 'is-tied' : ''}"></i>`).join('')}</span>`;
}

// ─── Cards ──────────────────────────────────────────────────────────────────

/** Training Grounds: rounds won this week per game, and the knots tied toward the next bonus star. */
function trainingKnotsWeek(classId, now = new Date()) {
    const cls = classById(classId);
    if (!cls) return null;
    const weekStart = startOfWeek(now);
    const storyRounds = Number(state.get('currentStoryData')?.[classId]?.storyAdditionsCount) || 0;
    let weekTotal = 0;
    const tiles = TRAINING_GAME_KEYS.map((key) => {
        const game = TRAINING_GAMES[key];
        if (key === 'story') return { game, rounds: storyRounds, week: null };
        const saved = normalizeGameState(key, cls.trainingGrounds?.[key]);
        const days = new Set(saved.log.filter((entry) => entry?.ok).map((entry) => toDate(entry.date))
            .filter((d) => d && d >= weekStart && d <= now).map((d) => d.toDateString()));
        weekTotal += days.size;
        return { game, rounds: saved.rounds, week: days.size };
    });
    if (!weekTotal && !tiles.some((t) => t.rounds > 0)) return null;
    const nextStar = tiles.filter((t) => knotsTied(t.rounds) === 1).map((t) => t.game.short);
    return {
        sigil: '🪢',
        title: 'Training Grounds this week',
        html: `<p class="sc-big sc-big--sm">${weekTotal ? `<b>${weekTotal}</b> ${weekTotal === 1 ? 'knot' : 'knots'} tied` : 'A fresh week of training'}</p>
            <div class="qc-train">
                ${tiles.map((t) => `<div class="qc-train__tile">
                    <span class="qc-train__emoji">${t.game.emoji}</span>
                    <b>${esc(t.game.short)}</b>
                    <small>${esc(t.game.skillLabel)}</small>
                    ${knotsHtml(knotsTied(t.rounds))}
                    ${t.week !== null ? `<em>${t.week ? `${t.week} this week` : 'not yet'}</em>` : ''}
                </div>`).join('')}
            </div>
            <p class="sc-text">${nextStar.length ? `One more won round in <b>${esc(nextStar.join(', '))}</b> brings a bonus star!` : 'Two won rounds tie two knots, and two knots bring a bonus star.'}</p>`
    };
}

/** The Quiz Champion of this week's quiz, with the treasure they won. */
async function quizChampionWeek(classId, now = new Date()) {
    const history = await cached(`quiz:${classId}`, 5 * 60 * 1000, async () => {
        const { getQuizHistory } = await import('../db/actions/quizOfTheWeek.js');
        return getQuizHistory(classId, 1).catch(() => []);
    });
    const quiz = history?.[0];
    const prize = quiz?.results?.rewards?.prize;
    const done = toDate(quiz?.completedAt);
    if (!prize?.studentId || !done || now - done > 7 * 86400000) return null;
    const hero = studentById(prize.studentId);
    if (!hero) return null;
    const rewards = quiz.results.rewards.studentRewards || [];
    const firstTry = Number(rewards.find((r) => r.studentId === prize.studentId)?.firstTry) || 0;
    // Everyone level at the top of the show earned a star; the champion is one of them.
    const alsoTop = rewards.filter((r) => r.top && r.studentId !== prize.studentId).map((r) => studentById(r.studentId)).filter(Boolean);
    const item = prize.kind === 'treasure' ? prize.item : null;
    const art = item?.image
        ? `<img src="${esc(item.image)}" alt="" class="qc-prize__img">`
        : `<span class="qc-prize__icon">${esc(item?.icon || '🪙')}</span>`;
    return {
        sigil: '🎯',
        title: 'Quiz Champion of the week',
        html: `<div class="qc-champ">
                <span class="qc-champ__crown" aria-hidden="true">👑</span>
                ${avatarHtml(hero)}
                <p class="sc-big">${firstName(hero)}</p>
                ${firstTry ? `<p class="sc-sub">${firstTry} right on the first try</p>` : ''}
            </div>
            <div class="qc-prize">${art}<span><small>Won from the Mystic Market</small><b>${item ? esc(item.name) : `${Number(prize.gold) || 10} Gold`}</b></span></div>
            ${alsoTop.length ? `<p class="sc-text">Also at the top of the show, with a ⭐ each: <b>${alsoTop.slice(0, 5).map(firstName).join(', ')}</b></p>` : ''}`
    };
}

/** Ember Oaths kept this month: a count of embers only, never who made which promise. */
async function oathsKeptMonth(classId, now = new Date()) {
    let oaths = state.get('allEmberOaths') || [];
    if (!oaths.length) {
        oaths = await cached('oaths', 10 * 60 * 1000, async () => {
            const { loadEmberOaths } = await import('../db/actions/emberOaths.js');
            return loadEmberOaths().catch(() => []);
        });
    }
    const mine = oaths.filter((o) => o.classId === classId);
    const kept = mine.filter((o) => {
        if (o.status !== 'kept') return false;
        const d = toDate(o.keptAt || o.updatedAt);
        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const burning = mine.filter((o) => o.status === 'active').length;
    if (!kept && !burning) return null;
    const embers = Math.min(kept, 24);
    return {
        sigil: '🔥',
        title: 'Ember Oaths this month',
        html: `<div class="qc-embers" aria-hidden="true">${kept ? Array.from({ length: embers }, (_, i) => `<i style="--i:${i}"></i>`).join('') : '<span class="qc-embers__wait">🪵</span>'}</div>
            <p class="sc-big">${kept ? `<b>${kept}</b> ${kept === 1 ? 'promise' : 'promises'} kept` : 'The first ember is warming'}</p>
            <p class="sc-sub">${burning ? `${burning} ${burning === 1 ? 'promise is' : 'promises are'} still burning bright` : 'Every promise kept adds a Star-Ember'}</p>`
    };
}

/** This month's Map Journal: the realms the class reached, with the day each was stamped. */
function realmJournalMonth(classId, now = new Date()) {
    const cls = classById(classId);
    const page = journalMonth(cls, realmMonthKey(now));
    const stamped = REALM_STOPS.filter((stop) => page[stop.id]);
    if (!stamped.length) return null;
    const latest = stamped[stamped.length - 1];
    return {
        sigil: '📖',
        title: 'Our Map Journal',
        html: `<p class="sc-big sc-big--sm">We reached <b>${esc(latest.named)}</b>!</p>
            <div class="qc-stamps">
                ${REALM_STOPS.map((stop) => {
                    const stamp = page[stop.id];
                    const d = stamp ? toDate(stamp.date) : null;
                    return `<div class="qc-stamp${stamp ? ' is-stamped' : ''}">
                        <img src="${BADGES[stop.id]}" alt="">
                        <b>${esc(stop.label)}</b>
                        <small>${d ? esc(dayLabel(d)) : 'still ahead'}</small>
                    </div>`;
                }).join('')}
            </div>`
    };
}

/** Today's Team Maker teams, each in its colours. */
function teamsToday(classId) {
    const cls = classById(classId);
    const today = teamsForDay(cls?.teamMaker, utils.getTodayDateString());
    if (!today) return null;
    const many = today.teams.length > 4;
    return {
        sigil: '🚩',
        title: "Today's Teams",
        html: `<div class="qc-teams${many ? ' qc-teams--many' : ''}">
                ${today.teams.map((ids, i) => {
                    const b = teamBanner(i, cls?.teamLooks);
                    const names = ids.map(studentById).filter(Boolean).map(firstName);
                    return `<section class="qc-team" style="--c:${b.primary};--cd:${b.deep};--cs:${b.soft}">
                        <header><span aria-hidden="true">${b.emoji}</span>${esc(b.short)}</header>
                        <p>${names.join(' · ')}</p>
                    </section>`;
                }).join('')}
            </div>`
    };
}

/** The Mystic Market's festival stall: open now, or opening soon. */
function marketFestival(now = new Date()) {
    const active = getActiveFestival(now);
    const emojiFor = (id) => FESTIVALS.find(([key]) => key === id)?.[1] || '🎪';
    const daysUntil = (ymd) => Math.round((new Date(ymd.year, ymd.month - 1, ymd.day) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (active) {
        const toFeast = daysUntil(active.feast);
        return {
            sigil: emojiFor(active.id),
            title: 'Festival Stall is open',
            html: `<div class="qc-festival qc-festival--${esc(active.id)}"><span class="qc-festival__emoji">${emojiFor(active.id)}</span></div>
                <p class="sc-big">${esc(active.name)}</p>
                <p class="sc-sub">${toFeast > 0 ? `${toFeast} ${toFeast === 1 ? 'day' : 'days'} to the feast` : 'Feast day today!'}</p>
                <p class="sc-text">${esc(active.tagline)}. Visit the Mystic Market before it closes!</p>`
        };
    }
    const upcoming = FESTIVALS.flatMap(([id]) => [now.getFullYear(), now.getFullYear() + 1].map((year) => getFestivalWindow(id, year)))
        .filter(Boolean)
        .map((w) => ({ ...w, days: daysUntil(w.start) }))
        .filter((w) => w.days > 0 && w.days <= 21)
        .sort((a, b) => a.days - b.days)[0];
    if (!upcoming) return null;
    return {
        sigil: '🎪',
        title: 'A festival stall is coming',
        html: `<div class="qc-festival qc-festival--${esc(upcoming.id)}"><span class="qc-festival__emoji">${emojiFor(upcoming.id)}</span></div>
            <p class="sc-big">${esc(upcoming.name)}</p>
            <p class="sc-sub">opens in ${upcoming.days} ${upcoming.days === 1 ? 'day' : 'days'}</p>
            <p class="sc-text">Save a little Gold for ${esc(upcoming.tagline.charAt(0).toLowerCase() + upcoming.tagline.slice(1))}!</p>`
    };
}

/** The Realm Raid: the Guardian, the school's shield and this class's shard (herald to aftermath). */
async function realmRaidCard(classId) {
    const { getRaidView } = await import('../features/realmRaid.js');
    const view = getRaidView();
    if (!view || view.loading) return null;
    const { raidCardHtml } = await import('./modals/realmRaidView.mjs');
    return {
        sigil: '🛡️',
        title: view.raid.season.name,
        html: raidCardHtml(view, { focusId: classId || '' })
    };
}

function classStudents(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && s.enrollmentStatus !== 'inactive');
}

function scoreOf(studentId) {
    return (state.get('allStudentScores') || []).find((sc) => sc.id === studentId) || null;
}

const daysAgo = (date, now) => (now - date) / 86400000;

/** Team Quest: the class's quest rank and crest, and the Portal runes lit or still asleep. */
async function questRankPortal(classId, now = new Date()) {
    const cls = classById(classId);
    if (!cls || !classStudents(classId).length) return null;
    const { classPortalStatus } = await import('../features/questPortal.js');
    const status = classPortalStatus(cls, { now });
    if (!status || !status.goal) return null;
    const { rank } = status;
    const toGo = starsToReachPercent(status.totalStars, status.goal, 100);
    const runes = status.runes.map((r) => `<span class="qc-rune${r.met ? ' is-lit' : ''}" style="--rc:${rank.colors[1]}">
            <i class="fas ${esc(r.icon)}" aria-hidden="true"></i>
            <b>${esc(r.short)}</b>
            <small>${r.met ? 'lit' : r.id === 'guardian' ? 'waits at the gate' : r.id === 'virtues' ? `${r.have} of 4 virtues` : r.id === 'lanterns' ? `${r.have} of ${r.need} lanterns` : 'asleep'}</small>
        </span>`).join('');
    let line;
    if (status.open) line = status.completed ? 'We stepped through the Portal this month!' : 'The Portal is open for us!';
    else if (!status.starsMet) line = `<b>${toGo}</b> ${toGo === 1 ? 'star' : 'stars'} to the Portal`;
    else line = esc(portalStatusLine(status));
    return {
        sigil: '🔮',
        title: 'Our quest rank',
        html: `<div class="qc-rank">
                <span class="qc-rank__crest">${rankCrestSvg(status.level)}</span>
                <span class="qc-rank__name"><small>Level ${status.level}</small><b>${esc(rank.title)}</b><em>${esc(rank.motto)}</em></span>
            </div>
            <p class="sc-big sc-big--sm">${line}</p>
            ${runes ? `<div class="qc-runes">${runes}</div>` : '<p class="sc-text">From Level 2, Portal runes must wake too before the Portal opens.</p>'}
            <p class="sc-sub">Crossing the Portal brings <b>${status.spoils} Gold</b> to every hero</p>`
    };
}

/** Hero Seals pressed in the last week: quiet personal milestones (never marks or absences). */
function heroSealsWeek(classId, now = new Date()) {
    const found = [];
    classStudents(classId).forEach((student) => {
        const earned = scoreOf(student.id)?.heroSeals?.earned || {};
        Object.entries(earned).forEach(([id, press]) => {
            const seal = SEALS[id];
            // Same rule as the class diary: nothing that speaks about marks or an absence.
            if (!seal || press?.late || isAcademicSeal(id) || id === 'hearth_return') return;
            const when = toDate(press?.date) || (press?.found ? new Date(Number(press.found)) : null);
            if (!when || daysAgo(when, now) > 7 || when > now) return;
            found.push({ student, seal, at: Number(press?.found) || when.getTime() });
        });
    });
    if (!found.length) return null;
    found.sort((a, b) => b.at - a.at);
    const shown = found.slice(0, 6);
    return {
        sigil: '🔏',
        title: 'Hero Seals this week',
        html: `<p class="sc-big sc-big--sm"><b>${found.length}</b> ${found.length === 1 ? 'seal' : 'seals'} pressed</p>
            <div class="qc-seals${shown.length > 3 ? ' qc-seals--many' : ''}">
                ${shown.map(({ student, seal }) => `<div class="qc-seal">
                    ${sealArtHtml(seal, { size: shown.length > 3 ? 60 : 78 })}
                    <b>${firstName(student)}</b>
                    <small>${esc(seal.name)}</small>
                </div>`).join('')}
            </div>
            ${found.length > shown.length ? `<p class="sc-sub">and ${found.length - shown.length} more in our Seal Books</p>` : ''}`
    };
}

/** Today's Hero Duels on this computer: the leading heroes and, with big teams, the team race. */
function heroDuelsToday(classId) {
    let game = null;
    try { game = normalizeDuels(JSON.parse(localStorage.getItem('gcq.heroDuels.v1') || '{}')?.[classId]); } catch { game = null; }
    if (!game || game.dateKey !== utils.getTodayDateString() || !game.duels.length) return null;
    const nameOf = (id) => studentById(id)?.name || '';
    const top = heroStandings(game, nameOf).filter((r) => r.played > 0 && (r.points > 0 || r.wins > 0)).slice(0, 3);
    if (!top.length) return null;
    const cls = classById(classId);
    const teams = teamTotals(game).sort((a, b) => a.place - b.place || a.index - b.index);
    const medals = ['🥇', '🥈', '🥉'];
    return {
        sigil: '⚔️',
        title: "Today's Hero Duels",
        html: `<p class="sc-sub">${game.duels.length} ${game.duels.length === 1 ? 'duel' : 'duels'} fought so far</p>
            <div class="qc-duel-top">
                ${top.map((r, i) => {
                    const hero = studentById(r.id);
                    return `<div class="qc-duel-hero${i === 0 ? ' is-first' : ''}">
                        <span class="qc-duel-hero__medal" aria-hidden="true">${medals[i]}</span>
                        ${hero ? avatarHtml(hero).replace('sc-avatar--lg', i === 0 ? 'sc-avatar--md' : 'sc-avatar--sm') : ''}
                        <b>${firstName(hero)}</b>
                        <small>${r.points} ${r.points === 1 ? 'point' : 'points'} · 👑 ${r.wins}</small>
                    </div>`;
                }).join('')}
            </div>
            ${teams.length ? `<div class="sc-chips">${teams.map((t) => {
                const b = teamBanner(t.index, cls?.teamLooks);
                return `<span class="sc-chip" style="background:${b.soft};color:${b.deep}">${b.emoji} ${esc(b.short)} · ${t.points}</span>`;
            }).join('')}</div>` : ''}`
    };
}

/** The Quiet Dragon's last gift this week: the calm minutes and what the hoard gave. */
function quietDragonWeek(classId, now = new Date()) {
    const sessions = (state.get('allQuestBounties') || [])
        .filter((b) => b.classId === classId && b.source === 'quiet_dragon' && b.quietDragon)
        .map((b) => ({ b, at: toDate(b.claimedAt) || toDate(b.createdAt) || toDate(b.deadline) }))
        .filter(({ at }) => at && daysAgo(at, now) <= 7)
        .sort((a, b) => b.at - a.at);
    if (!sessions.length) return null;
    const { b, at } = sessions[0];
    const minutes = Number(b.quietDragon.minutes) || 0;
    const weekMinutes = sessions.reduce((sum, s) => sum + (Number(s.b.quietDragon.minutes) || 0), 0);
    const today = at.toDateString() === now.toDateString();
    return {
        sigil: '🐉',
        title: 'The Quiet Dragon',
        html: `<div class="qc-dragon" aria-hidden="true"><span>🐉</span><i>z</i><i>z</i><i>z</i></div>
            <p class="sc-big sc-big--sm">The dragon slept for <b>${minutes}</b> calm ${minutes === 1 ? 'minute' : 'minutes'}${today ? ' today' : ''}!</p>
            ${b.reward ? `<div class="qc-prize"><span class="qc-prize__icon">🎁</span><span><small>Gift from the hoard</small><b>${esc(b.reward)}</b></span></div>` : ''}
            ${sessions.length > 1 ? `<p class="sc-sub">${weekMinutes} calm minutes this week</p>` : ''}`
    };
}

/** Stars marked outside the lesson wait in the sky until the class is here to see them fall. */
function starfallWaiting(classId) {
    const waiting = classById(classId)?.pendingStarfalls;
    if (!Array.isArray(waiting) || !waiting.length) return null;
    const stars = waiting.reduce((sum, e) => sum + (Number(e?.bonusAmount) || 0.5), 0);
    const heroes = new Set(waiting.map((e) => e?.studentId).filter(Boolean)).size;
    const shown = Math.min(14, Math.max(3, Math.round(stars)));
    return {
        sigil: '🌠',
        title: 'A Starfall is waiting',
        html: `<div class="qc-starfall" aria-hidden="true">${Array.from({ length: shown }, (_, i) => `<i style="--i:${i};--y:${(i * 17) % 44}px">⭐</i>`).join('')}</div>
            <p class="sc-big sc-big--sm"><b>${stars % 1 ? stars.toFixed(1) : stars}</b> ${stars === 1 ? 'star is' : 'stars are'} waiting in the sky</p>
            <p class="sc-sub">for ${heroes} ${heroes === 1 ? 'hero' : 'heroes'}, from our last tests and dictations</p>
            <p class="sc-text">They fall in this lesson. Who will catch them?</p>`
    };
}

/** The Hero Paths the class has chosen, and the heroes who became Legends. */
async function heroPathsClass(classId) {
    const students = classStudents(classId).filter((s) => normalizeHeroClass(s.heroClass));
    if (students.length < 2) return null;
    const { HERO_CLASSES } = await import('../features/heroClasses.js');
    const paths = new Map();
    const legends = [];
    students.forEach((s) => {
        const path = normalizeHeroClass(s.heroClass);
        if (!paths.has(path)) paths.set(path, []);
        paths.get(path).push(s);
        if (isLegendHero(path, scoreOf(s.id)?.legendQuest)) legends.push({ s, path });
    });
    const rows = [...paths.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    return {
        sigil: '🧭',
        title: 'Our Hero Paths',
        html: `<div class="qc-paths">
                ${rows.slice(0, 8).map(([path, heroes]) => `<div class="qc-path">
                    <span class="qc-path__icon" aria-hidden="true">${HERO_CLASSES[path]?.icon || '⭐'}</span>
                    <b>${esc(path)}</b>
                    <small>${heroes.length} ${heroes.length === 1 ? 'hero' : 'heroes'}</small>
                </div>`).join('')}
            </div>
            ${legends.length
                ? `<p class="sc-text">🏆 ${legends.length === 1 ? 'Our Legend' : 'Our Legends'}: <b>${legends.slice(0, 5).map(({ s, path }) => `${firstName(s)} (${esc(getLegendQuest(path)?.legend || path)})`).join(', ')}</b></p>`
                : '<p class="sc-text">Finish a Hero Path and a Legend Quest waits at the top!</p>'}`
    };
}

/** The Crown Race: the chronicle of the last sealed Chapter, in four herald lines. */
async function guildChapterChronicle() {
    const { yearChronicles } = await import('../features/guildChronicleCore.js');
    const last = yearChronicles().at(-1);
    if (!last?.lines?.length) return null;
    return {
        sigil: '📜',
        title: `The Chronicle of ${last.month}`,
        html: `<ol class="qc-chronicle">${last.lines.slice(0, 4).map((line, i) => `<li style="--i:${i}">${esc(line)}</li>`).join('')}</ol>
            <p class="sc-sub">${last.by === 'chronicler' ? 'Written by the Chronicler' : 'The herald’s record'} · the Crown Race</p>`
    };
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

/** Builds one quest card (may be async), or null. */
export async function hydrateQuestCard(baseType, classId) {
    if (CLASS_QUEST_CARDS.includes(baseType) && !classId) return null;
    switch (baseType) {
        case 'tg_knots_week': return trainingKnotsWeek(classId);
        case 'quiz_champion_week': return quizChampionWeek(classId);
        case 'oaths_kept_month': return oathsKeptMonth(classId);
        case 'realm_journal_month': return realmJournalMonth(classId);
        case 'class_teams_today': return teamsToday(classId);
        case 'market_festival': return marketFestival();
        case 'realm_raid': return realmRaidCard(classId);
        case 'quest_rank_portal': return questRankPortal(classId);
        case 'hero_seals_week': return heroSealsWeek(classId);
        case 'hero_duels_today': return heroDuelsToday(classId);
        case 'quiet_dragon_week': return quietDragonWeek(classId);
        case 'starfall_waiting': return starfallWaiting(classId);
        case 'hero_paths_class': return heroPathsClass(classId);
        case 'guild_chapter_chronicle': return guildChapterChronicle();
        default: return null;
    }
}
