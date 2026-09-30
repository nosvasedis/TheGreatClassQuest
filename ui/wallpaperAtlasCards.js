// /ui/wallpaperAtlasCards.js — Projector Mode (The Director): the Atlas cards.
// A second wave of Sky Cards: the class's own month drawn as star trails, constellations and
// virtue wheels; heroes close to a milestone or climbing fast; the week, the month and the
// English-speaking world's clocks; word games, puzzles, wonders, calm breaks and the night sky.
// Every builder returns null when it has nothing real to show, so the Director picks another.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import { GUILD_IDS, getGuildById } from '../features/guilds.js';
import { escapeCardText as esc, getSeasonInfo, pickForDay, pickRandom } from './wallpaperDeck.mjs';
import {
    acrostic,
    ANIMALS,
    CODE_WORDS,
    COMPOUNDS,
    CONSTELLATIONS,
    constellationLayout,
    constellationLinks,
    countingField,
    COUNTRIES,
    EMOJI_SENTENCES,
    findRisingStar,
    GRATITUDE_PROMPTS,
    hashString,
    HIDDEN_WORDS,
    IDIOMS,
    INVENTIONS,
    IRREGULAR_PLURALS,
    KINDNESS_QUESTS,
    monthGrid,
    nextMilestone,
    numberCode,
    OPPOSITES,
    PATTERNS,
    PLANETS,
    reasonLabel,
    RHYMES,
    SIMON_SAYS,
    SPACE_FACTS,
    STRETCHES,
    summariseClassMonth,
    tierBank,
    TWENTY_QUESTIONS,
    weekendCountdown,
    weekPath,
    WORLD_CITIES,
    worldClocks,
    whatTheyAreDoing
} from './wallpaperAtlas.mjs';

/** Cards that read the class's own awards, roster and timetable. */
const CLASS_ATLAS = [
    'hero_first_light', 'hero_rising_star', 'hero_milestone_near', 'hero_virtue_champions', 'hero_steady_flame',
    'hero_kindness_spotted', 'hero_birthdays_month', 'hero_name_acrostic',
    'class_star_trail', 'class_best_day', 'class_virtue_wheel', 'class_constellation', 'class_every_hero',
    'class_guild_colours', 'class_month_so_far',
    'time_week_path', 'time_month_calendar'
];

/** Cards for any view: the whole school, the world, words, puzzles, wonders, calm and sky. */
const SHARED_ATLAS = [
    'realm_stars_today', 'realm_class_league', 'realm_in_numbers', 'realm_guild_banners',
    'time_weekend_countdown', 'time_world_clocks',
    'word_opposites', 'word_rhyme_time', 'word_compound', 'word_plurals', 'word_idiom_picture',
    'word_emoji_sentence', 'word_hidden_words',
    'puzzle_what_next', 'puzzle_count_stars', 'puzzle_code_breaker', 'puzzle_who_am_i', 'puzzle_simon_says',
    'wonder_animal', 'wonder_country', 'wonder_space', 'wonder_invention',
    'heart_breathe', 'heart_gratitude', 'heart_kindness_quest', 'heart_stretch',
    'sky_constellation', 'sky_season_turn', 'sky_planet'
];

export const ATLAS_CARD_TYPES = Object.freeze([...CLASS_ATLAS, ...SHARED_ATLAS]);

/**
 * Deck entries the Atlas adds. The class cards all go in (they only show when there is real
 * data); a fresh sample of the shared ones keeps each deck varied without drowning the rest.
 */
export function getAtlasCardDeck(classId, { sample = 12 } = {}) {
    const shared = [...SHARED_ATLAS].sort(() => Math.random() - 0.5).slice(0, classId ? sample : sample + 6);
    return classId ? [...CLASS_ATLAS, ...shared] : shared;
}

// ─── Data helpers ───────────────────────────────────────────────────────────

function logTime(log) {
    if (typeof log?.createdAt?.toMillis === 'function') return log.createdAt.toMillis();
    if (log?.createdAt?.seconds) return log.createdAt.seconds * 1000;
    const parsed = utils.parseFlexibleDate?.(log?.date);
    return parsed ? parsed.getTime() : 0;
}

/** Award logs as { classId, studentId, reason, at, raw }, cached for a short while. */
let logCache = { source: null, rows: [] };
function awardRows() {
    const source = state.get('allAwardLogs') || [];
    if (logCache.source !== source) {
        logCache = {
            source,
            rows: source.map((log) => ({ classId: log.classId, studentId: log.studentId, reason: log.reason, at: logTime(log), raw: log }))
        };
    }
    return logCache.rows;
}

const credit = (row) => getAwardLogMonthlyStarCredit(row.raw);

function classMonth(classId, now = new Date()) {
    return summariseClassMonth(awardRows(), classId, now, credit);
}

function classStudents(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId);
}

function studentById(id) {
    return (state.get('allStudents') || []).find((s) => s.id === id) || null;
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || null;
}

function avatarHtml(student, size = 'md') {
    if (student?.avatar) return `<img src="${esc(student.avatar)}" alt="" class="sc-avatar sc-avatar--${size}">`;
    return `<span class="sc-avatar sc-avatar--${size} sc-avatar--letter">${esc((student?.name || '?').charAt(0))}</span>`;
}

function firstName(student) {
    return esc(String(student?.name || '').split(' ')[0]);
}

function tierOf(questLevel) {
    const tier = questLevel ? utils.getAgeTierForLeague(questLevel) : 'mid';
    return ['junior', 'mid', 'senior'].includes(tier) ? tier : 'mid';
}

function revealBlock(inner) {
    return `<div class="wallpaper-card-answer-blur sc-reveal">${inner}</div>`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const monthName = (now = new Date()) => now.toLocaleDateString('en-GB', { month: 'long' });

// ─── Hall of Heroes ─────────────────────────────────────────────────────────

/** The first hero to earn a star today. */
function heroFirstLight(classId, now = new Date()) {
    const first = classMonth(classId, now).firstByDay.get(now.getDate());
    if (!first) return null;
    const student = studentById(first.studentId);
    if (!student) return null;
    const [icon, label] = reasonLabel(first.reason);
    const time = new Date(first.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return {
        sigil: '🌅',
        title: 'First light',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">🌅</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <p class="sc-sub">earned today's very first star at ${time}</p>
            <div class="sc-chips"><span class="sc-chip">${icon} ${esc(label)}</span></div>`
    };
}

function heroRisingStar(classId) {
    const rising = findRisingStar(awardRows(), classId, Date.now(), credit);
    if (!rising) return null;
    const student = studentById(rising.studentId);
    if (!student) return null;
    const max = Math.max(rising.recent, rising.before, 1);
    return {
        sigil: '🚀',
        title: 'Rising star',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">🚀</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <div class="sc-compare">
                <span><i style="height:${Math.round((rising.before / max) * 100)}%"></i><b>${rising.before}</b><small>last week</small></span>
                <span class="is-now"><i style="height:${Math.round((rising.recent / max) * 100)}%"></i><b>${rising.recent}</b><small>this week</small></span>
            </div>
            <p class="sc-sub">+${rising.gain} more stars than the week before!</p>`
    };
}

/** A hero one to three stars from a round number this month. */
function heroMilestoneNear(classId) {
    const month = classMonth(classId);
    const close = [...month.byStudent.entries()]
        .map(([id, stars]) => ({ id, stars, next: nextMilestone(stars) }))
        .filter((row) => row.next && row.next.need <= 3 && row.stars >= 3)
        .sort((a, b) => a.next.need - b.next.need || b.stars - a.stars);
    if (!close.length) return null;
    const pick = pickRandom(close.slice(0, 3));
    const student = studentById(pick.id);
    if (!student) return null;
    const pct = Math.round((pick.stars / pick.next.target) * 100);
    return {
        sigil: '🎯',
        title: 'Almost there!',
        html: `<div class="sc-ring" style="--p:${pct}">${avatarHtml(student, 'md')}</div>
            <p class="sc-big sc-big--sm">${esc(student.name)}</p>
            <p class="sc-sub">${pick.stars} stars this month · just <b>${plural(pick.next.need, 'star')}</b> to ${pick.next.target}!</p>
            <p class="sc-text">Can we help ${firstName(student)} get there today?</p>`
    };
}

function heroVirtueChampions(classId) {
    const month = classMonth(classId);
    const perReason = new Map();
    awardRows().forEach((row) => {
        if (row.classId !== classId || !['teamwork', 'creativity', 'respect', 'focus'].includes(row.reason)) return;
        const d = new Date(row.at);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
        if (!perReason.has(row.reason)) perReason.set(row.reason, new Map());
        const tally = perReason.get(row.reason);
        tally.set(row.studentId, (tally.get(row.studentId) || 0) + credit(row));
    });
    const tiles = ['teamwork', 'creativity', 'respect', 'focus'].map((reason) => {
        const tally = perReason.get(reason);
        if (!tally) return null;
        const [id, stars] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
        const student = studentById(id);
        return student ? { reason, student, stars } : null;
    }).filter(Boolean);
    if (tiles.length < 2 || month.total === 0) return null;
    return {
        sigil: '🏅',
        title: `${monthName()}'s virtue champions`,
        html: `<div class="sc-tiles">
                ${tiles.map((t) => {
                    const [icon, label] = reasonLabel(t.reason);
                    return `<div class="sc-tile"><span class="sc-tile__icon">${icon}</span><small>${esc(label)}</small>${avatarHtml(t.student, 'sm')}<b>${firstName(t.student)}</b></div>`;
                }).join('')}
            </div>`
    };
}

/** The hero who earned stars on the most different days this month. */
function heroSteadyFlame(classId) {
    const month = classMonth(classId);
    const ranked = [...month.daysByStudent.entries()].map(([id, days]) => ({ id, days: days.size })).sort((a, b) => b.days - a.days);
    if (!ranked.length || ranked[0].days < 3) return null;
    const student = studentById(ranked[0].id);
    if (!student) return null;
    const flames = Math.min(ranked[0].days, 12);
    return {
        sigil: '🕯️',
        title: 'Steady flame',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">🔥</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <div class="sc-flames" aria-hidden="true">${'<i></i>'.repeat(flames)}</div>
            <p class="sc-sub">earned stars on ${plural(ranked[0].days, 'different day')} this month</p>
            <p class="sc-text">Not one big blaze: a flame that keeps on shining.</p>`
    };
}

function heroKindnessSpotted(classId) {
    const since = Date.now() - 14 * 86400000;
    const latest = awardRows()
        .filter((row) => row.classId === classId && ['respect', 'teamwork', 'peer_boon'].includes(row.reason) && row.at >= since)
        .sort((a, b) => b.at - a.at)[0];
    if (!latest) return null;
    const student = studentById(latest.studentId);
    if (!student) return null;
    const [icon, label] = reasonLabel(latest.reason);
    const note = String(latest.raw?.note || '').trim();
    return {
        sigil: '💞',
        title: 'Kindness spotted',
        html: `<div class="sc-hero">${avatarHtml(student, 'lg')}<span class="sc-hero__crown">💖</span></div>
            <p class="sc-big">${esc(student.name)}</p>
            <div class="sc-chips"><span class="sc-chip">${icon} ${esc(label)}</span></div>
            <p class="sc-text">${note ? `“${esc(note.slice(0, 120))}”` : 'Being kind makes the whole class stronger.'}</p>`
    };
}

function heroBirthdaysMonth(classId, now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const rows = classStudents(classId)
        .map((s) => ({ s, m: /(\d{2})-(\d{2})$/.exec(String(s.birthday || '')) }))
        .filter((row) => row.m && row.m[1] === month)
        .map((row) => ({ student: row.s, day: Number(row.m[2]) }))
        .sort((a, b) => a.day - b.day);
    if (!rows.length) return null;
    const today = now.getDate();
    return {
        sigil: '🎂',
        title: `${monthName(now)} birthdays`,
        html: `<div class="sc-list">
                ${rows.slice(0, 5).map((row) => `<div class="sc-list__row ${row.day === today ? 'is-now' : row.day < today ? 'is-done' : ''}">
                    <span class="sc-list__date">${row.day}</span>${avatarHtml(row.student, 'sm')}<b>${esc(row.student.name)}</b>
                    <span>${row.day === today ? '🎉 today!' : row.day < today ? '🎈' : '🎁'}</span></div>`).join('')}
            </div>
            <p class="sc-text">${plural(rows.length, 'birthday')} in our class this month.</p>`
    };
}

function heroNameAcrostic(classId) {
    const students = classStudents(classId).filter((s) => String(s.name || '').split(' ')[0].replace(/[^A-Za-z]/g, '').length >= 3);
    const student = pickForDay(students, new Date(), new Date().getHours());
    if (!student) return null;
    const rows = acrostic(String(student.name).split(' ')[0]);
    if (rows.length < 3) return null;
    return {
        sigil: '✒️',
        title: 'Name poem',
        html: `<div class="sc-acrostic">${rows.map((r) => `<p><b>${r.letter}</b>${esc(r.word.slice(1))}</p>`).join('')}</div>
            <p class="sc-text">A poem for ${firstName(student)}. Can you make one for your name?</p>`
    };
}

// ─── Class Quest ────────────────────────────────────────────────────────────

function classStarTrail(classId, now = new Date()) {
    const month = classMonth(classId, now);
    if (month.lessonDays < 2) return null;
    const days = [...month.byDay.entries()].sort((a, b) => a[0] - b[0]).slice(-12);
    const max = Math.max(...days.map(([, v]) => v));
    const w = 300;
    const h = 120;
    const bw = Math.min(28, (w - 20) / days.length - 6);
    const gap = (w - days.length * bw) / (days.length + 1);
    return {
        sigil: '📈',
        title: 'Our star trail',
        html: `<svg class="sc-trail" viewBox="0 -18 ${w} ${h + 40}" aria-hidden="true">
                ${days.map(([day, stars], i) => {
                    const bh = Math.max(6, Math.round((stars / max) * h));
                    const x = gap + i * (bw + gap);
                    const best = stars === max;
                    return `<g class="${best ? 'is-best' : ''}"><rect x="${x.toFixed(1)}" y="${h - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="6" style="--i:${i}"/>
                        <text x="${(x + bw / 2).toFixed(1)}" y="${h - bh - 5}" class="sc-trail__v">${stars}</text>
                        <text x="${(x + bw / 2).toFixed(1)}" y="${h + 17}" class="sc-trail__d">${day}</text></g>`;
                }).join('')}
            </svg>
            <p class="sc-sub">Stars on each lesson day in ${monthName(now)}</p>`
    };
}

function classBestDay(classId, now = new Date()) {
    const month = classMonth(classId, now);
    if (month.lessonDays < 2) return null;
    const [day, stars] = [...month.byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const heroes = new Set(awardRows().filter((r) => r.classId === classId && new Date(r.at).toDateString() === date.toDateString()).map((r) => r.studentId)).size;
    return {
        sigil: '🏆',
        title: 'Our best lesson this month',
        html: `<div class="sc-datecard"><small>${date.toLocaleDateString('en-GB', { weekday: 'long' })}</small><b>${day}</b><small>${monthName(now)}</small></div>
            <p class="sc-big"><span class="js-count-up" data-target="${stars}">0</span> stars</p>
            <p class="sc-sub">${plural(heroes, 'hero', 'heroes')} shone that day. Can we beat it today?</p>`
    };
}

function classVirtueWheel(classId) {
    const month = classMonth(classId);
    const entries = [...month.byReason.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length < 2) return null;
    const top = entries.slice(0, 5);
    const total = top.reduce((sum, [, v]) => sum + v, 0);
    const palette = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
    let acc = 0;
    const stops = top.map(([, v], i) => {
        const from = acc;
        acc += (v / total) * 100;
        return `${palette[i]} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
    }).join(', ');
    const [leadIcon, leadLabel] = reasonLabel(top[0][0]);
    return {
        sigil: '🎡',
        title: 'Where our stars came from',
        html: `<div class="sc-donut-wrap">
                <div class="sc-donut" style="background:conic-gradient(${stops})"><span>${leadIcon}</span></div>
                <div class="sc-legend">${top.map(([reason, v], i) => {
                    const [icon, label] = reasonLabel(reason);
                    return `<p><i style="background:${palette[i]}"></i>${icon} ${esc(label)}<b>${v}</b></p>`;
                }).join('')}</div>
            </div>
            <p class="sc-text">This month our superpower is <b>${esc(leadLabel)}</b>!</p>`
    };
}

function classConstellation(classId) {
    const month = classMonth(classId);
    const rows = [...month.byStudent.entries()].map(([id, value]) => ({ id, value, student: studentById(id) })).filter((r) => r.student);
    if (rows.length < 3) return null;
    rows.sort((a, b) => b.value - a.value);
    const points = constellationLayout(rows.slice(0, 14), hashString(classId + new Date().toDateString()));
    const links = constellationLinks(points);
    const brightest = points.slice(0, 3);
    return {
        sigil: '✨',
        title: 'Our class constellation',
        html: `<svg class="sc-constellation" viewBox="0 0 300 180" aria-hidden="true">
                ${links.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`).join('')}
                ${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" style="--i:${i}"/>`).join('')}
                ${brightest.map((p) => `<text x="${p.x}" y="${p.y + p.r + 13}">${firstName(p.student)}</text>`).join('')}
            </svg>
            <p class="sc-sub">Every star is a hero. The brighter the star, the more stars this month.</p>`
    };
}

function classEveryHero(classId) {
    const students = classStudents(classId);
    if (students.length < 3) return null;
    const month = classMonth(classId);
    const shining = students.filter((s) => (month.byStudent.get(s.id) || 0) > 0).length;
    if (shining === 0) return null;
    const all = shining === students.length;
    return {
        sigil: '🌠',
        title: 'Every hero counts',
        html: `<div class="sc-dots">${students.map((s) => `<i class="${(month.byStudent.get(s.id) || 0) > 0 ? 'is-on' : ''}"></i>`).join('')}</div>
            <p class="sc-big">${shining} of ${students.length}</p>
            <p class="sc-sub">heroes have earned stars in ${monthName()}</p>
            <p class="sc-text">${all ? 'Every single hero is shining. What a class!' : 'Let’s light up every star before the month ends!'}</p>`
    };
}

function classGuildColours(classId) {
    const students = classStudents(classId);
    const month = classMonth(classId);
    const guilds = GUILD_IDS.map((id) => {
        const members = students.filter((s) => s.guildId === id);
        return { guild: getGuildById(id), members: members.length, stars: members.reduce((sum, s) => sum + (month.byStudent.get(s.id) || 0), 0) };
    }).filter((g) => g.guild && g.members > 0);
    if (guilds.length < 2) return null;
    return {
        sigil: '🛡️',
        title: 'Our guilds this month',
        html: `<div class="sc-guilds">${guilds.map((g) => `<div class="sc-guild" style="--g1:${g.guild.primary};--g2:${g.guild.secondary}">
                <span class="sc-guild__flag">${g.guild.emoji}</span><b>${esc(g.guild.name)}</b>
                <small>${plural(g.members, 'hero', 'heroes')}</small><strong>${g.stars} ⭐</strong></div>`).join('')}</div>
            <p class="sc-text">Four guilds, one class, one quest.</p>`
    };
}

function classMonthSoFar(classId, now = new Date()) {
    const month = classMonth(classId, now);
    if (month.total === 0 || month.lessonDays === 0) return null;
    const avg = Math.round((month.total / month.lessonDays) * 10) / 10;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pct = Math.round((now.getDate() / daysInMonth) * 100);
    return {
        sigil: '🗓️',
        title: `${monthName(now)} so far`,
        html: `<div class="sc-split sc-split--big">
                <span><b><span class="js-count-up" data-target="${month.total}">0</span></b><small>stars</small></span>
                <span><b>${month.lessonDays}</b><small>lessons</small></span>
                <span><b>${avg}</b><small>per lesson</small></span>
            </div>
            <div class="sc-meter" aria-hidden="true"><i style="width:${pct}%"></i></div>
            <p class="sc-sub">${pct}% of the month travelled</p>`
    };
}

// ─── Time & Tides ───────────────────────────────────────────────────────────

function timeWeekPath(classId, now = new Date()) {
    const cls = classById(classId);
    if (!cls?.scheduleDays?.length) return null;
    const week = weekPath(cls.scheduleDays, now);
    if (!week.total) return null;
    return {
        sigil: '🥾',
        title: 'This week’s path',
        html: `<div class="sc-week">${week.days.map((d) => `<span class="${d.lesson ? 'is-lesson' : ''} ${d.isToday ? 'is-now' : ''} ${d.past ? 'is-done' : ''}">
                <small>${d.label}</small><b>${d.date.getDate()}</b><i>${d.lesson ? (d.past ? '✔' : '⭐') : '·'}</i></span>`).join('')}</div>
            <p class="sc-sub">${week.left === 0 ? 'This is our last lesson of the week!' : `${plural(week.left, 'more lesson')} after today this week`}</p>`
    };
}

function timeMonthCalendar(classId, now = new Date()) {
    const cls = classById(classId);
    const lessonDays = new Set((cls?.scheduleDays || []).map(String));
    const month = classMonth(classId, now);
    const holidays = (state.get('schoolHolidayRanges') || []).map((h) => [new Date(h.start), new Date(h.end)]);
    const isHoliday = (d) => holidays.some(([a, b]) => d >= new Date(a.getFullYear(), a.getMonth(), a.getDate()) && d <= b);
    const cells = monthGrid(now);
    return {
        sigil: '📅',
        title: `${monthName(now)} ${now.getFullYear()}`,
        html: `<div class="sc-cal">
                ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<small>${d}</small>`).join('')}
                ${cells.map((d) => {
                    if (!d) return '<span></span>';
                    const cls2 = [
                        d.getDate() === now.getDate() ? 'is-now' : '',
                        lessonDays.has(String(d.getDay())) ? 'is-lesson' : '',
                        month.byDay.has(d.getDate()) ? 'is-starred' : '',
                        isHoliday(d) ? 'is-holiday' : ''
                    ].join(' ');
                    return `<span class="${cls2}">${d.getDate()}</span>`;
                }).join('')}
            </div>
            <p class="sc-text">⭐ lesson days with stars · 🌴 holidays</p>`
    };
}

function timeWeekendCountdown(now = new Date()) {
    const left = weekendCountdown(now);
    if (!left) return null;
    const friday = now.getDay() === 5;
    return {
        sigil: '🎈',
        title: friday ? 'It’s Friday!' : 'Weekend watch',
        html: `<p class="sc-big sc-big--xl">${left.sleeps}</p>
            <p class="sc-sub">${left.sleeps === 1 ? 'sleep' : 'sleeps'} until the weekend</p>
            <div class="sc-week sc-week--mini">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<span class="${i + 1 < now.getDay() ? 'is-done' : i + 1 === now.getDay() ? 'is-now' : ''}"><small>${d}</small></span>`).join('')}</div>
            <p class="sc-text">${friday ? 'What are you doing this weekend? Tell your partner in English!' : 'Keep going, heroes: the weekend is on its way.'}</p>`
    };
}

function timeWorldClocks(now = new Date()) {
    const picks = [...WORLD_CITIES].sort((a, b) => hashString(a.city + now.getHours()) - hashString(b.city + now.getHours())).slice(0, 4);
    const clocks = worldClocks(picks, now);
    return {
        sigil: '🌐',
        title: 'Around the English-speaking world',
        html: `<div class="sc-clocks">${clocks.map((c) => `<div class="sc-clock ${c.hour >= 7 && c.hour < 19 ? 'is-day' : 'is-night'}">
                <span>${c.flag}</span><b>${c.time}</b><small>${esc(c.city)}</small><em>${whatTheyAreDoing(c.hour)}</em></div>`).join('')}</div>
            <p class="sc-text">What time is it in ${esc(clocks[0].city)}? “It’s ${clocks[0].time} in ${esc(clocks[0].city)}.”</p>`
    };
}

// ─── The Realm ──────────────────────────────────────────────────────────────

function realmStarsToday(now = new Date()) {
    const today = now.toDateString();
    const rows = awardRows().filter((r) => r.at && new Date(r.at).toDateString() === today);
    const total = rows.reduce((sum, r) => sum + Math.max(0, credit(r)), 0);
    if (total === 0) return null;
    const classes = new Set(rows.map((r) => r.classId)).size;
    const heroes = new Set(rows.map((r) => r.studentId)).size;
    return {
        sigil: '🌟',
        title: 'The school today',
        html: `<p class="sc-big sc-big--xl"><span class="js-count-up" data-target="${total}">0</span></p>
            <p class="sc-sub">stars across the whole school today</p>
            <div class="sc-split"><span><b>${heroes}</b><small>heroes</small></span><span><b>${classes}</b><small>${classes === 1 ? 'class' : 'classes'}</small></span></div>`
    };
}

function realmClassLeague(now = new Date()) {
    const classes = state.get('allSchoolClasses') || [];
    const rows = classes.map((c) => ({ c, stars: classMonth(c.id, now).total })).filter((r) => r.stars > 0).sort((a, b) => b.stars - a.stars).slice(0, 5);
    if (rows.length < 2) return null;
    const max = rows[0].stars;
    return {
        sigil: '🏰',
        title: `Brightest classes in ${monthName(now)}`,
        html: `<div class="sc-bars">${rows.map((r, i) => `<div class="sc-bars__row">
                <span class="sc-bars__logo">${esc(r.c.logo || '📚')}</span>
                <span class="sc-bars__name">${esc(r.c.name)}</span>
                <span class="sc-bars__track"><i style="width:${Math.max(8, Math.round((r.stars / max) * 100))}%;--i:${i}"></i></span>
                <b>${r.stars}</b></div>`).join('')}</div>
            <p class="sc-text">Stars earned this month, class by class.</p>`
    };
}

function realmInNumbers(now = new Date()) {
    const classes = (state.get('allSchoolClasses') || []).length;
    const heroes = (state.get('allStudents') || []).length;
    const stars = (state.get('allStudentScores') || []).reduce((sum, s) => sum + (Number(s.monthlyStars) || 0), 0);
    if (!classes || !heroes) return null;
    const name = state.get('schoolName');
    return {
        sigil: '🏰',
        title: name ? String(name) : 'Our realm in numbers',
        html: `<div class="sc-split sc-split--big">
                <span><b><span class="js-count-up" data-target="${classes}">0</span></b><small>classes</small></span>
                <span><b><span class="js-count-up" data-target="${heroes}">0</span></b><small>heroes</small></span>
                <span><b><span class="js-count-up" data-target="${stars}">0</span></b><small>stars in ${monthName(now)}</small></span>
            </div>
            <p class="sc-text">One school, many classes, one great quest.</p>`
    };
}

function realmGuildBanners() {
    const scores = new Map((state.get('allStudentScores') || []).map((s) => [s.id, Number(s.monthlyStars) || 0]));
    const banners = GUILD_IDS.map((id) => {
        const members = (state.get('allStudents') || []).filter((s) => s.guildId === id);
        return { guild: getGuildById(id), members: members.length, stars: members.reduce((sum, s) => sum + (scores.get(s.id) || 0), 0) };
    }).filter((b) => b.guild && b.members > 0);
    if (banners.length < 2) return null;
    const max = Math.max(1, ...banners.map((b) => b.stars));
    return {
        sigil: '🚩',
        title: 'Guild banners',
        html: `<div class="sc-banners">${banners.map((b) => `<div class="sc-banner" style="--g1:${b.guild.primary};--g2:${b.guild.secondary};--h:${Math.round(40 + (b.stars / max) * 60)}%">
                <span class="sc-banner__cloth"><em>${b.guild.emoji}</em><strong>${b.stars}</strong></span><small>${esc(b.guild.name)}</small></div>`).join('')}</div>
            <p class="sc-text">Stars this month for every guild across the school.</p>`
    };
}

// ─── Word Workshop ──────────────────────────────────────────────────────────

function wordOpposites(questLevel) {
    const pairs = [...tierBank(OPPOSITES, tierOf(questLevel))].sort(() => Math.random() - 0.5).slice(0, 3);
    return {
        sigil: '↔️',
        title: 'Opposites',
        html: `<div class="sc-pairs">${pairs.map(([a]) => `<p><b>${esc(a)}</b><span>↔</span><i>?</i></p>`).join('')}</div>
            <p class="sc-sub">What is the opposite?</p>
            ${revealBlock(`<p class="sc-answer">${pairs.map(([a, b]) => `${esc(a)} ↔ ${esc(b)}`).join(' · ')}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordRhymeTime(questLevel) {
    const [word, rhymes] = pickRandom(tierBank(RHYMES, tierOf(questLevel)));
    return {
        sigil: '🎵',
        title: 'Rhyme time',
        html: `<div class="sc-letter sc-letter--word">${esc(word)}</div>
            <p class="sc-big sc-big--sm">Find three words that rhyme!</p>
            ${revealBlock(`<p class="sc-answer">${esc(rhymes)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordCompound(questLevel) {
    const [a, b, word] = pickRandom(tierBank(COMPOUNDS, tierOf(questLevel)));
    return {
        sigil: '➕',
        title: 'Word maths',
        html: `<div class="sc-equation"><span>${esc(a)}</span><b>+</b><span>${esc(b)}</span><b>=</b><span>?</span></div>
            <p class="sc-sub">Put the two words together to make a new one.</p>
            ${revealBlock(`<p class="sc-answer">${esc(word)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordPlurals(questLevel) {
    const [one, many] = pickRandom(tierBank(IRREGULAR_PLURALS, tierOf(questLevel)));
    return {
        sigil: '👯',
        title: 'One… two…',
        html: `<p class="sc-quote">${esc(one)}</p>
            <p class="sc-big sc-big--sm">…and two…?</p>
            <p class="sc-sub">Careful: this word does not just add -s!</p>
            ${revealBlock(`<p class="sc-answer">${esc(many)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordIdiomPicture() {
    const item = pickForDay(IDIOMS, new Date(), new Date().getHours());
    return {
        sigil: '🎭',
        title: 'Say what?',
        html: `<div class="sc-emoji-line">${item.emoji}</div>
            <p class="sc-quote">“${esc(item.idiom)}”</p>
            <p class="sc-sub">What do you think it means?</p>
            ${revealBlock(`<p class="sc-answer sc-answer--sm">${esc(item.meaning)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordEmojiSentence(questLevel) {
    const [emoji, sentence] = pickRandom(tierBank(EMOJI_SENTENCES, tierOf(questLevel)));
    return {
        sigil: '💬',
        title: 'Emoji translator',
        html: `<div class="sc-emoji-line sc-emoji-line--big">${emoji}</div>
            <p class="sc-sub">Say it as a sentence in English.</p>
            ${revealBlock(`<p class="sc-answer sc-answer--sm">${esc(sentence)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function wordHiddenWords() {
    const item = pickRandom(HIDDEN_WORDS);
    return {
        sigil: '🔎',
        title: 'Words inside words',
        html: `<div class="sc-tiles-word">${item.word.split('').map((l) => `<span>${l}</span>`).join('')}</div>
            <p class="sc-big sc-big--sm">How many words can you make?</p>
            <p class="sc-sub">Use the letters. Five words is great, ten is legendary!</p>
            ${revealBlock(`<p class="sc-answer sc-answer--sm">${esc(item.examples)} …</p>`)}`,
        timedBlurAnswer: true
    };
}

// ─── Puzzle Nook ────────────────────────────────────────────────────────────

function puzzleWhatNext(questLevel) {
    const [pattern, answer] = pickRandom(tierBank(PATTERNS, tierOf(questLevel)));
    return {
        sigil: '🔮',
        title: 'What comes next?',
        html: `<p class="sc-pattern">${esc(pattern)}</p>
            <p class="sc-sub">Find the pattern!</p>
            ${revealBlock(`<p class="sc-answer">${esc(answer)}</p>`)}`,
        timedBlurAnswer: true
    };
}

function puzzleCountStars() {
    const seed = Math.floor(Date.now() / 60000);
    const field = countingField(seed);
    const icon = pickRandom(['⭐', '🌟', '🐞', '🍀', '🦋']);
    return {
        sigil: '🔢',
        title: 'Quick count',
        html: `<div class="sc-count">${field.map((p) => `<span style="left:${(p.x / 280) * 100}%;top:${(p.y / 150) * 100}%;--s:${p.s};--r:${p.r}deg">${icon}</span>`).join('')}</div>
            <p class="sc-sub">How many ${icon} can you count? No pointing!</p>
            ${revealBlock(`<p class="sc-answer">${field.length}</p>`)}`,
        timedBlurAnswer: true
    };
}

function puzzleCodeBreaker() {
    const word = pickRandom(CODE_WORDS);
    return {
        sigil: '🗝️',
        title: 'Code breaker',
        html: `<p class="sc-code">${numberCode(word)}</p>
            <p class="sc-sub">A = 1, B = 2, C = 3 … Crack the secret word!</p>
            ${revealBlock(`<p class="sc-answer">${word}</p>`)}`,
        timedBlurAnswer: true
    };
}

function puzzleWhoAmI() {
    const item = pickRandom(TWENTY_QUESTIONS);
    return {
        sigil: '🕵️',
        title: 'Who am I?',
        html: `<div class="sc-clues">${item.clues.map((c, i) => `<p style="--i:${i}"><b>${i + 1}</b>${esc(c)}</p>`).join('')}</div>
            ${revealBlock(`<p class="sc-answer">I am ${esc(item.answer)}!</p>`)}`,
        timedBlurAnswer: true
    };
}

function puzzleSimonSays() {
    const picks = [...SIMON_SAYS].sort(() => Math.random() - 0.5).slice(0, 4);
    return {
        sigil: '🙋',
        title: 'Simon says',
        html: `<div class="sc-clues">${picks.map((c, i) => `<p style="--i:${i}"><b>${i + 1}</b>${esc(c)}</p>`).join('')}</div>
            <p class="sc-text">Only move when Simon says so!</p>`
    };
}

// ─── Wonders ────────────────────────────────────────────────────────────────

function wonderAnimal() {
    const item = pickForDay(ANIMALS, new Date(), new Date().getHours());
    return {
        sigil: item.emoji,
        title: 'Animal wonder',
        html: `<div class="sc-emoji-hero">${item.emoji}</div>
            <p class="sc-big">${esc(item.name)}</p>
            <p class="sc-text">${esc(item.fact)}</p>`
    };
}

function wonderCountry() {
    const item = pickForDay(COUNTRIES, new Date(), new Date().getHours());
    return {
        sigil: '🗺️',
        title: 'Where English is spoken',
        html: `<div class="sc-emoji-hero">${item.flag}</div>
            <p class="sc-big sc-big--sm">${esc(item.name.replace(/^the /, 'The '))}</p>
            <div class="sc-chips"><span class="sc-chip">🏛️ Capital: ${esc(item.capital)}</span></div>
            <p class="sc-text">${esc(item.fact)}</p>`
    };
}

function wonderSpace() {
    const item = pickRandom(SPACE_FACTS);
    return {
        sigil: '🚀',
        title: 'Space wonder',
        html: `<div class="sc-emoji-hero sc-emoji-hero--space">${item.emoji}</div>
            <p class="sc-big sc-big--sm">${esc(item.title)}</p>
            <p class="sc-text">${esc(item.fact)}</p>`
    };
}

function wonderInvention() {
    const item = pickRandom(INVENTIONS);
    return {
        sigil: '⚙️',
        title: 'Who invented it?',
        html: `<div class="sc-emoji-hero">${item.emoji}</div>
            <p class="sc-big sc-big--sm">Who gave us ${esc(item.thing)}?</p>
            ${revealBlock(`<p class="sc-answer sc-answer--sm">${esc(item.who)}</p>`)}`,
        timedBlurAnswer: true
    };
}

// ─── Mind & Heart ───────────────────────────────────────────────────────────

function heartBreathe() {
    return {
        sigil: '🫧',
        title: 'Bubble breathing',
        html: `<div class="sc-breathe" aria-hidden="true"><i></i><span>breathe</span></div>
            <p class="sc-sub">Breathe in as the bubble grows… breathe out as it shrinks.</p>
            <p class="sc-text">Five slow breaths. Shoulders down, feet on the floor.</p>`
    };
}

function heartGratitude() {
    return {
        sigil: '🙏',
        title: 'Thankful moment',
        html: `<p class="sc-quote">${esc(pickForDay(GRATITUDE_PROMPTS, new Date(), new Date().getHours()))}</p>
            <p class="sc-text">Start with: “I’m thankful for… because…”</p>`
    };
}

function heartKindnessQuest() {
    return {
        sigil: '💝',
        title: 'Today’s kindness quest',
        html: `<p class="sc-quote">${esc(pickForDay(KINDNESS_QUESTS))}</p>
            <p class="sc-text">Secret mission: can the whole class complete it before home time?</p>`
    };
}

function heartStretch() {
    const moves = [...STRETCHES].sort(() => Math.random() - 0.5).slice(0, 3);
    return {
        sigil: '🤸',
        title: 'Stretch break',
        html: `<div class="sc-clues">${moves.map(([icon, text], i) => `<p style="--i:${i}"><b>${icon}</b>${esc(text)}</p>`).join('')}</div>
            <p class="sc-text">Stand up, heroes! Ten seconds for each one.</p>`
    };
}

// ─── Sky Watch ──────────────────────────────────────────────────────────────

function skyConstellation(now = new Date()) {
    const season = getSeasonInfo(now);
    const c = CONSTELLATIONS[season.key];
    if (!c) return null;
    return {
        sigil: '🌌',
        title: 'Tonight’s constellation',
        html: `<svg class="sc-constellation sc-constellation--sky" viewBox="0 0 300 180" aria-hidden="true">
                ${c.lines.map(([a, b]) => `<line x1="${c.stars[a][0]}" y1="${c.stars[a][1]}" x2="${c.stars[b][0]}" y2="${c.stars[b][1]}"/>`).join('')}
                ${c.stars.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 6 : 4.5}" style="--i:${i}"/>`).join('')}
            </svg>
            <p class="sc-big sc-big--sm">${esc(c.name)}</p>
            <p class="sc-text">${esc(c.note)} Look up tonight!</p>`
    };
}

function skySeasonTurn(now = new Date()) {
    const season = getSeasonInfo(now);
    return {
        sigil: season.emoji,
        title: 'The turning year',
        html: `<div class="sc-seasons">
                <span class="is-now">${season.emoji}<small>${esc(season.name)}</small></span>
                <i style="--p:${Math.round(season.progress * 100)}%"></i>
                <span>${season.next.emoji}<small>${esc(season.next.name)}</small></span>
            </div>
            <p class="sc-big">${season.daysToNext} days</p>
            <p class="sc-sub">until ${esc(season.next.name)} begins</p>`
    };
}

function skyPlanet(now = new Date()) {
    const week = Math.floor(now.getTime() / (7 * 86400000));
    const item = PLANETS[week % PLANETS.length];
    return {
        sigil: '🪐',
        title: 'Planet of the week',
        html: `<div class="sc-emoji-hero sc-emoji-hero--space"><span class="sc-planet${item.bands ? ' sc-planet--bands' : ''}${item.ring ? ' sc-planet--ring' : ''}${item.tilt ? ' sc-planet--tilt' : ''}" style="--c1:${item.c1};--c2:${item.c2}"></span></div>
            <p class="sc-big">${esc(item.name)}</p>
            <p class="sc-text">${esc(item.fact)}</p>`
    };
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

/** Builds one of the Atlas cards, or null. */
export function hydrateAtlasCard(baseType, classId, questLevel) {
    const needsClass = CLASS_ATLAS.includes(baseType);
    if (needsClass && !classId) return null;
    switch (baseType) {
        case 'hero_first_light': return heroFirstLight(classId);
        case 'hero_rising_star': return heroRisingStar(classId);
        case 'hero_milestone_near': return heroMilestoneNear(classId);
        case 'hero_virtue_champions': return heroVirtueChampions(classId);
        case 'hero_steady_flame': return heroSteadyFlame(classId);
        case 'hero_kindness_spotted': return heroKindnessSpotted(classId);
        case 'hero_birthdays_month': return heroBirthdaysMonth(classId);
        case 'hero_name_acrostic': return heroNameAcrostic(classId);
        case 'class_star_trail': return classStarTrail(classId);
        case 'class_best_day': return classBestDay(classId);
        case 'class_virtue_wheel': return classVirtueWheel(classId);
        case 'class_constellation': return classConstellation(classId);
        case 'class_every_hero': return classEveryHero(classId);
        case 'class_guild_colours': return classGuildColours(classId);
        case 'class_month_so_far': return classMonthSoFar(classId);
        case 'time_week_path': return timeWeekPath(classId);
        case 'time_month_calendar': return timeMonthCalendar(classId);
        case 'time_weekend_countdown': return timeWeekendCountdown();
        case 'time_world_clocks': return timeWorldClocks();
        case 'realm_stars_today': return realmStarsToday();
        case 'realm_class_league': return realmClassLeague();
        case 'realm_in_numbers': return realmInNumbers();
        case 'realm_guild_banners': return realmGuildBanners();
        case 'word_opposites': return wordOpposites(questLevel);
        case 'word_rhyme_time': return wordRhymeTime(questLevel);
        case 'word_compound': return wordCompound(questLevel);
        case 'word_plurals': return wordPlurals(questLevel);
        case 'word_idiom_picture': return wordIdiomPicture();
        case 'word_emoji_sentence': return wordEmojiSentence(questLevel);
        case 'word_hidden_words': return wordHiddenWords();
        case 'puzzle_what_next': return puzzleWhatNext(questLevel);
        case 'puzzle_count_stars': return puzzleCountStars();
        case 'puzzle_code_breaker': return puzzleCodeBreaker();
        case 'puzzle_who_am_i': return puzzleWhoAmI();
        case 'puzzle_simon_says': return puzzleSimonSays();
        case 'wonder_animal': return wonderAnimal();
        case 'wonder_country': return wonderCountry();
        case 'wonder_space': return wonderSpace();
        case 'wonder_invention': return wonderInvention();
        case 'heart_breathe': return heartBreathe();
        case 'heart_gratitude': return heartGratitude();
        case 'heart_kindness_quest': return heartKindnessQuest();
        case 'heart_stretch': return heartStretch();
        case 'sky_constellation': return skyConstellation();
        case 'sky_season_turn': return skySeasonTurn();
        case 'sky_planet': return skyPlanet();
        default: return null;
    }
}
