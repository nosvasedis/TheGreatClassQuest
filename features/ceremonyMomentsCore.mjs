// features/ceremonyMomentsCore.mjs
// "The Chronicle of the Month" and "Honours of the Month" for the Ceremony of the Month.
// The ceremony reads what the watching class did in the month across the newer quests and
// tells it back on the projector:
//   - Moments (the whole class): realms stamped in the Map Journal, Training Grounds rounds,
//     Ember Oaths kept (a count only), Quiet Dragon calm minutes, bounties claimed, Starfall
//     stars, Quizzes of the Week played and Hero Seals pressed (a count).
//   - Honours (named heroes, Classic Arena only): Quiz Champions, Seal Bearers and new Legends.
// Same rules as the projector cards and the class diary: no marks, no absences, no academic
// seals, nothing a teacher would keep private. Pure: no DOM, no Firestore.
// Tests: tests/ceremony-moments.test.mjs.

import { REALM_STOPS, journalMonth } from './realmMomentsCore.mjs';
import { TRAINING_GAMES, ROUND_GAME_KEYS, TRAINING_REASONS, normalizeGameState } from './trainingGroundsCore.mjs';
import { SEALS, isAcademicSeal } from './heroSealsCore.mjs';

/** A Date from a Firestore Timestamp, {seconds}, a Date, an ISO string, a number or 'DD-MM-YYYY'. */
export function momentDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value?.toDate === 'function') {
        try { return value.toDate(); } catch { return null; }
    }
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return new Date(value);
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        if (text.length > 10 && text.includes('T')) {
            const parsed = new Date(text);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
    }
    const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when `value` falls inside the month `monthKey` ('YYYY-MM'). */
export function inMonth(value, monthKey) {
    const d = momentDate(value);
    if (!d) return false;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthKey;
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

function credit(log) {
    if (log?.appliedStarCredit !== undefined && log?.appliedStarCredit !== null) return num(log.appliedStarCredit);
    return num(log?.stars);
}

/** Seals that may be named in front of the class (the same filter as the diary and projector). */
export function isCelebratedSeal(id, press) {
    return Boolean(SEALS[id]) && !press?.late && !isAcademicSeal(id) && id !== 'hearth_return';
}

function sealDate(press) {
    return momentDate(press?.date) || (press?.found ? momentDate(Number(press.found)) : null);
}

/**
 * The class's month, as tiles. Only tiles with something real in them are returned, in a
 * story order (the road, the games, the promises, the calm, the bounties, the sky, the quiz,
 * the seals). Each tile: { id, icon, value, unit, title, line, items? }.
 */
export function buildMonthMoments({
    monthKey,
    classData = null,
    studentIds = [],
    logs = [],
    oaths = [],
    bounties = [],
    quizzes = [],
    scores = [],
    young = false
} = {}) {
    if (!monthKey || !classData) return [];
    const ids = new Set(studentIds);
    const tiles = [];

    // 1. The road: realms stamped in the Map Journal that month.
    const page = journalMonth(classData, monthKey);
    const stamped = REALM_STOPS.filter((stop) => page[stop.id]);
    if (stamped.length) {
        const latest = stamped[stamped.length - 1];
        tiles.push({
            id: 'realms',
            icon: latest.icon,
            value: stamped.length,
            unit: stamped.length === 1 ? 'realm' : 'realms',
            title: young ? `We reached ${latest.named}!` : `Reached ${latest.named}`,
            line: latest.cheer,
            items: REALM_STOPS.map((stop) => ({ id: stop.id, label: stop.label, icon: stop.icon, done: Boolean(page[stop.id]) }))
        });
    }

    // 2. Training Grounds: rounds won that month (one per game per lesson day) + bonus stars.
    const games = ROUND_GAME_KEYS.map((key) => {
        const saved = normalizeGameState(key, classData.trainingGrounds?.[key]);
        const days = new Set(saved.log.filter((entry) => entry?.ok && inMonth(entry.date, monthKey)).map((entry) => momentDate(entry.date)?.toDateString()));
        return { key, emoji: TRAINING_GAMES[key].emoji, short: TRAINING_GAMES[key].short, won: days.size };
    });
    const won = games.reduce((sum, g) => sum + g.won, 0);
    const trainingStars = round1(logs.filter((l) => ids.has(l.studentId) && TRAINING_REASONS.includes(l.reason)).reduce((sum, l) => sum + Math.max(0, credit(l)), 0));
    if (won > 0 || trainingStars > 0) {
        tiles.push({
            id: 'training',
            icon: '🪢',
            value: won || trainingStars,
            unit: won ? (won === 1 ? 'round won' : 'rounds won') : 'bonus stars',
            title: 'Training Grounds',
            line: won && trainingStars ? `+${trainingStars} bonus ${trainingStars === 1 ? 'star' : 'stars'} for the class` : (young ? 'Practice makes heroes!' : 'Skill by skill, knot by knot'),
            items: games.filter((g) => g.won > 0).map((g) => ({ id: g.key, label: g.short, icon: g.emoji, value: g.won }))
        });
    }

    // 3. Ember Oaths kept: a count only, never who promised what.
    const kept = oaths.filter((o) => o?.classId === classData.id && o.status === 'kept' && inMonth(o.keptAt || o.updatedAt, monthKey)).length;
    if (kept > 0) {
        tiles.push({
            id: 'oaths',
            icon: '🔥',
            value: kept,
            unit: kept === 1 ? 'promise kept' : 'promises kept',
            title: 'Ember Oaths',
            line: young ? 'Promises kept, warm and bright!' : 'Words turned into deeds'
        });
    }

    // 4. The Quiet Dragon: calm minutes that month.
    const calm = bounties.filter((b) => b?.classId === classData.id && b.source === 'quiet_dragon' && b.quietDragon && inMonth(b.claimedAt || b.createdAt, monthKey));
    const minutes = calm.reduce((sum, b) => sum + num(b.quietDragon.minutes), 0);
    if (minutes > 0) {
        tiles.push({
            id: 'dragon',
            icon: '🐉',
            value: Math.round(minutes),
            unit: Math.round(minutes) === 1 ? 'calm minute' : 'calm minutes',
            title: 'The Quiet Dragon',
            line: calm.length === 1 ? 'The dragon slept soundly' : `The dragon slept ${calm.length} times`
        });
    }

    // 5. Bounties claimed (the Quiet Dragon's gifts are told above).
    const claimed = bounties.filter((b) => b?.classId === classData.id && b.source !== 'quiet_dragon' && b.status === 'completed' && inMonth(b.claimedAt, monthKey));
    if (claimed.length) {
        tiles.push({
            id: 'bounties',
            icon: '📜',
            value: claimed.length,
            unit: claimed.length === 1 ? 'bounty claimed' : 'bounties claimed',
            title: 'Quest Bounties',
            line: claimed.slice(0, 2).map((b) => String(b.title || '').trim()).filter(Boolean).join(' · ') || 'Every poster torn down'
        });
    }

    // 6. Starfall: stars that fell from the Scholar's Scroll (a class total, no names).
    const starfall = logs.filter((l) => ids.has(l.studentId) && l.reason === 'scholar_s_bonus' && credit(l) > 0);
    const fallen = round1(starfall.reduce((sum, l) => sum + credit(l), 0));
    if (fallen > 0) {
        const heroes = new Set(starfall.map((l) => l.studentId)).size;
        tiles.push({
            id: 'starfall',
            icon: '🌠',
            value: fallen,
            unit: fallen === 1 ? 'star fell' : 'stars fell',
            title: 'Starfall',
            line: `for ${heroes} ${heroes === 1 ? 'hero' : 'heroes'} from the Scholar's Scroll`
        });
    }

    // 7. Quiz of the Week.
    const played = quizzes.filter((q) => q?.classId === classData.id && inMonth(q.completedAt, monthKey));
    if (played.length) {
        tiles.push({
            id: 'quiz',
            icon: '🎯',
            value: played.length,
            unit: played.length === 1 ? 'quiz played' : 'quizzes played',
            title: 'Quiz of the Week',
            line: young ? 'Brave answers, every week' : 'Questions faced together'
        });
    }

    // 8. Hero Seals pressed (a count; the Honours name the heroes).
    let sealsPressed = 0;
    scores.forEach((score) => {
        if (!ids.has(score?.id)) return;
        Object.entries(score?.heroSeals?.earned || {}).forEach(([id, press]) => {
            if (isCelebratedSeal(id, press) && inMonth(sealDate(press), monthKey)) sealsPressed += 1;
        });
    });
    if (sealsPressed > 0) {
        tiles.push({
            id: 'seals',
            icon: '🔏',
            value: sealsPressed,
            unit: sealsPressed === 1 ? 'seal pressed' : 'seals pressed',
            title: 'Hero Seals',
            line: young ? 'New seals in our books!' : 'New wax in the Seal Books'
        });
    }

    return tiles;
}

/**
 * Named honours of the month (Classic Arena): Quiz Champions (top of a quiz that month),
 * Seal Bearers (heroes who pressed a celebrated seal) and Legends (a Legend Quest finished).
 * Returns { sections: [{ id, title, icon, heroes: [{ id, name, avatar, note, sealIds? }] }] },
 * sections only when they have heroes; each list is capped so it fits a projector.
 */
export function buildMonthHonours({ monthKey, students = [], scores = [], quizzes = [], classId = '' } = {}) {
    if (!monthKey) return { sections: [] };
    const byId = new Map(students.map((s) => [s.id, s]));
    const scoreById = new Map(scores.map((s) => [s?.id, s]));
    const person = (id, note, extra = {}) => {
        const s = byId.get(id);
        return s ? { id, name: s.name || '', avatar: s.avatar || null, note, ...extra } : null;
    };
    const sections = [];

    // Quiz Champions: everyone at the top of a quiz that month (a star each), most tops first.
    const tops = new Map();
    quizzes.filter((q) => (!classId || q?.classId === classId) && inMonth(q?.completedAt, monthKey)).forEach((quiz) => {
        const rewards = quiz?.results?.rewards || {};
        const top = new Set((rewards.studentRewards || []).filter((r) => r?.top).map((r) => r.studentId));
        if (rewards.prize?.studentId) top.add(rewards.prize.studentId);
        top.forEach((id) => tops.set(id, (tops.get(id) || 0) + 1));
    });
    const champions = [...tops.entries()]
        .filter(([id]) => byId.has(id))
        .sort((a, b) => b[1] - a[1] || String(byId.get(a[0])?.name).localeCompare(String(byId.get(b[0])?.name)))
        .map(([id, n]) => person(id, n > 1 ? `Top of ${n} quizzes` : 'Top of the quiz'))
        .filter(Boolean);
    if (champions.length) sections.push({ id: 'quiz', title: 'Quiz Champions', icon: 'fa-trophy', heroes: champions.slice(0, 6), more: Math.max(0, champions.length - 6) });

    // Seal Bearers: heroes who pressed a celebrated seal that month, with the seals.
    const bearers = students.map((s) => {
        const earned = scoreById.get(s.id)?.heroSeals?.earned || {};
        const sealIds = Object.entries(earned)
            .filter(([id, press]) => isCelebratedSeal(id, press) && inMonth(sealDate(press), monthKey))
            .sort((a, b) => (sealDate(a[1])?.getTime() || 0) - (sealDate(b[1])?.getTime() || 0))
            .map(([id]) => id);
        return sealIds.length ? person(s.id, sealIds.length === 1 ? SEALS[sealIds[0]].name : `${sealIds.length} seals`, { sealIds }) : null;
    }).filter(Boolean)
        .sort((a, b) => b.sealIds.length - a.sealIds.length || a.name.localeCompare(b.name));
    if (bearers.length) sections.push({ id: 'seals', title: 'Seal Bearers', icon: 'fa-stamp', heroes: bearers.slice(0, 8), more: Math.max(0, bearers.length - 8) });

    // Legends: a Legend Quest completed that month.
    const legends = students
        .filter((s) => inMonth(scoreById.get(s.id)?.legendQuest?.completedAt, monthKey))
        .map((s) => person(s.id, 'Became a Legend'))
        .filter(Boolean);
    if (legends.length) sections.push({ id: 'legends', title: 'New Legends', icon: 'fa-crown', heroes: legends.slice(0, 4), more: Math.max(0, legends.length - 4) });

    return { sections };
}
