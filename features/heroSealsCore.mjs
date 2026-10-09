// features/heroSealsCore.mjs — Hero Seals: quiet personal milestones.
//
// Every child has a Seal Book of 16 seals. Ten are shared by the whole school (the four
// virtues, the Four Winds, Steadfast, the Open Hand, Oathkeeper, Quiz Champion and
// Personal Best). Six branch out per child:
//   path    from the child's Hero Path (or the first step onto one)
//   quill   set to the child's own pace in trials (never says which pace)
//   hearth  shaped by the child's attendance (coming back, or being there all month)
//   guild   from the child's guild
//   wild ×2 drawn per child: a birthday or nameday seal when one is known, a familiar's
//           seal when the child carries an egg, otherwise drawn by the stars (a stable
//           hash of the child's id, so it never reshuffles).
// Seals give nothing in Gold or stars. Once pressed, a seal is never taken back.
//
// Pure: no DOM, no state, no Firebase. The runtime (features/heroSeals.js) turns the
// app's records into plain facts; everything else is worked out here.
//
// Stored on student_scores as `heroSeals`:
//   { v: 2, book: { path, quill, hearth, guild, wild1, wild2 }, since: first record date,
//     earned: { [sealId]: { date: 'YYYY-MM-DD', found: ms, note, late? } }, backfilledAt }
// `late` marks a seal found in the year's history when Hero Seals first arrived (or
// recognised later), so the diary never claims it happened today.

import { TRAINING_REASONS } from './trainingGroundsCore.mjs';

export const HERO_SEALS_VERSION = 2;
/** Seals that rest on attendance: only lessons the Quest actually kept count for them. */
export const ATTENDANCE_SEALS = Object.freeze(['steadfast', 'hearth_return', 'hearth_full_moon']);

export const VIRTUES = Object.freeze(['respect', 'creativity', 'teamwork', 'focus']);
const VIRTUE_LABEL = { respect: 'Respect', creativity: 'Creativity', teamwork: 'Teamwork', focus: 'Focus' };

export const PERSONAL_SLOTS = Object.freeze(['path', 'quill', 'hearth', 'guild', 'wild1', 'wild2']);

/** Seals that speak about marks: kept out of the class diary, which never mentions grades. */
const ACADEMIC = new Set(['personal_best', 'quill_rising', 'quill_bright', 'quill_golden']);
/** Kept out of the diary too: it would tell the class about an absence. */
const DIARY_QUIET = new Set([...ACADEMIC, 'hearth_return']);

const seal = (id, family, name, icon, tint, how, told, extra = {}) =>
    Object.freeze({ id, family, name, icon, tint, how, told, ...extra });

/** The whole catalogue. `how` is how to earn it; `told` finishes "Maria …" in summaries. */
export const SEALS = Object.freeze({
    // ── Shared by everyone ─────────────────────────────────────────────────
    virtue_respect: seal('virtue_respect', 'virtue', 'Seal of Respect', 'fa-handshake-angle', '#3563c9', 'A first star for Respect.', 'earned a first star for Respect'),
    virtue_creativity: seal('virtue_creativity', 'virtue', 'Seal of Creativity', 'fa-palette', '#b2368f', 'A first star for Creativity.', 'earned a first star for Creativity'),
    virtue_teamwork: seal('virtue_teamwork', 'virtue', 'Seal of Teamwork', 'fa-people-group', '#23895b', 'A first star for Teamwork.', 'earned a first star for Teamwork'),
    virtue_focus: seal('virtue_focus', 'virtue', 'Seal of Focus', 'fa-bullseye', '#c8711f', 'A first star for Focus.', 'earned a first star for Focus'),
    four_winds: seal('four_winds', 'milestone', 'The Four Winds', 'fa-wind', '#5b45b8', 'Stars for all four virtues in one month.', 'gathered all four virtues in one month', { rare: true }),
    steadfast: seal('steadfast', 'milestone', 'Steadfast', 'fa-calendar-check', '#9a6a26', 'Ten lessons present in a row.', 'came to ten lessons in a row'),
    open_hand: seal('open_hand', 'milestone', 'The Open Hand', 'fa-hand-holding-heart', '#c23f6f', "A first Hero's Boon given to a classmate.", "gave a first Hero's Boon"),
    oathkeeper: seal('oathkeeper', 'milestone', 'Oathkeeper', 'fa-fire', '#c94f22', 'A first Ember Oath kept.', 'kept a first Ember Oath'),
    quiz_champion: seal('quiz_champion', 'milestone', "Champion's Laurel", 'fa-trophy', '#b8901c', 'Named Quiz Champion of a Quiz of the Week.', 'was named Quiz Champion', { rare: true }),
    personal_best: seal('personal_best', 'milestone', 'Personal Best', 'fa-medal', '#22809a', 'A test or dictation better than every one before it.', 'set a personal best'),

    // ── Path: one per Hero Path ────────────────────────────────────────────
    path_choose: seal('path_choose', 'path', 'First Step', 'fa-signs-post', '#6b6f86', 'Choose a Hero Path.', 'chose a Hero Path'),
    path_guardian: seal('path_guardian', 'path', 'Unbroken Shield', 'fa-shield-halved', '#2f8f4e', 'Reach level 1 on the Guardian path.', 'reached level 1 as a Guardian'),
    path_sage: seal('path_sage', 'path', 'Lantern of Ideas', 'fa-hat-wizard', '#8a3fc4', 'Reach level 1 on the Sage path.', 'reached level 1 as a Sage'),
    path_paladin: seal('path_paladin', 'path', 'Shared Banner', 'fa-flag', '#2c5fc4', 'Reach level 1 on the Paladin path.', 'reached level 1 as a Paladin'),
    path_artificer: seal('path_artificer', 'path', 'Clockwork Heart', 'fa-gear', '#b8691a', 'Reach level 1 on the Artificer path.', 'reached level 1 as an Artificer'),
    path_scholar: seal('path_scholar', 'path', 'Inkwell Crest', 'fa-scroll', '#1b7f93', 'Reach level 1 on the Scholar path.', 'reached level 1 as a Scholar'),
    path_vanguard: seal('path_vanguard', 'path', 'Training Knot', 'fa-crosshairs', '#127c72', 'Reach level 1 on the Vanguard path.', 'reached level 1 as a Vanguard'),
    path_nomad: seal('path_nomad', 'path', "Wayfarer's Boot", 'fa-shoe-prints', '#6a48c2', 'Reach level 1 on the Nomad path.', 'reached level 1 as a Nomad'),
    path_patron: seal('path_patron', 'path', "Giver's Ribbon", 'fa-gift', '#c42d58', 'Reach level 1 on the Patron path.', 'reached level 1 as a Patron'),

    // ── Quill: set to the child's own pace in trials ───────────────────────
    quill_rising: seal('quill_rising', 'quill', 'Rising Quill', 'fa-feather', '#4a6fa8', 'Beat your own last result by 10 points or more.', 'beat their own last result by 10 points'),
    quill_bright: seal('quill_bright', 'quill', 'Bright Quill', 'fa-feather-pointed', '#2a8a7a', 'Score 85% or more on a test or dictation.', 'scored 85% or more on a trial'),
    quill_golden: seal('quill_golden', 'quill', 'Golden Quill', 'fa-pen-nib', '#b8901c', 'Three trials in a row at 90% or more.', 'wrote three trials in a row at 90% or more', { rare: true }),
    quill_star: seal('quill_star', 'quill', 'Star of Excellence', 'fa-star', '#b07a12', 'A first star for Excellence.', 'earned a first star for Excellence'),

    // ── Hearth: shaped by attendance ───────────────────────────────────────
    hearth_return: seal('hearth_return', 'hearth', 'Welcome Home', 'fa-house-chimney', '#b75a2e', 'Earn a star in the first lesson back after an absence.', 'came back after an absence and earned a star that same lesson'),
    hearth_full_moon: seal('hearth_full_moon', 'hearth', 'Full Moon', 'fa-moon', '#3f4f96', 'Present at every lesson of a whole month.', 'was there for every lesson of a whole month'),

    // ── Guild ──────────────────────────────────────────────────────────────
    guild_dragon_flame: seal('guild_dragon_flame', 'guild', "Dragon's Ember", 'fa-dragon', '#c4231f', 'Ten stars in one month for Dragon Flame.', 'earned ten stars in one month for Dragon Flame'),
    guild_grizzly_might: seal('guild_grizzly_might', 'guild', "Grizzly's Paw", 'fa-paw', '#8a4a1a', 'Ten stars in one month for Grizzly Might.', 'earned ten stars in one month for Grizzly Might'),
    guild_owl_wisdom: seal('guild_owl_wisdom', 'guild', "Owl's Wing", 'fa-crow', '#24479e', 'Ten stars in one month for Owl Wisdom.', 'earned ten stars in one month for Owl Wisdom'),
    guild_phoenix_rising: seal('guild_phoenix_rising', 'guild', 'Phoenix Plume', 'fa-fire-flame-curved', '#b5195a', 'Ten stars in one month for Phoenix Rising.', 'earned ten stars in one month for Phoenix Rising'),
    guild_sorted: seal('guild_sorted', 'guild', 'Under a Banner', 'fa-hat-wizard', '#55607a', 'Be sorted into a guild.', 'was sorted into a guild'),

    // ── Wild: drawn per child ──────────────────────────────────────────────
    wild_candle: seal('wild_candle', 'wild', 'Candle Star', 'fa-cake-candles', '#cc4f86', 'Earn a star in the lesson on or just after your birthday or nameday.', 'earned a star on their special day'),
    wild_familiar: seal('wild_familiar', 'wild', "Hatchling's Bond", 'fa-egg', '#3f9670', 'Your familiar hatches from its egg.', "saw their familiar hatch"),
    wild_early_light: seal('wild_early_light', 'wild', 'Early Light', 'fa-sun', '#d39417', 'Earn the very first star of a lesson.', 'earned the first star of a lesson'),
    wild_bright_day: seal('wild_bright_day', 'wild', 'Bright Day', 'fa-star', '#c78f12', 'Three stars or more in one lesson.', 'earned three stars in one lesson'),
    wild_story_hero: seal('wild_story_hero', 'wild', 'Hero of the Story', 'fa-book-open', '#6b43c4', 'Be the Hero of the Day in the class diary.', 'became Hero of the Day'),
    wild_generous: seal('wild_generous', 'wild', 'Generous Heart', 'fa-heart', '#c43450', "Give three Hero's Boons.", "gave three Hero's Boons"),
    wild_kindred: seal('wild_kindred', 'wild', 'Kindred Spirit', 'fa-handshake', '#3a87b8', "Receive a Hero's Boon from a classmate.", "received a Hero's Boon from a classmate"),
    wild_chain: seal('wild_chain', 'wild', 'Unbroken Chain', 'fa-link', '#5d6f8c', 'A star in five lessons in a row.', 'earned a star in five lessons in a row'),
    wild_training: seal('wild_training', 'wild', 'Yard Ribbon', 'fa-chess-knight', '#2b7f6e', 'A first star from the Training Grounds.', 'earned a first Training Grounds star'),
    wild_collector: seal('wild_collector', 'wild', "Magpie's Hoard", 'fa-gem', '#2a8eaa', 'Keep three things in your satchel.', 'filled their satchel with three keepsakes')
});

export const SHARED_SEALS = Object.freeze([
    'virtue_respect', 'virtue_creativity', 'virtue_teamwork', 'virtue_focus',
    'four_winds', 'steadfast', 'open_hand', 'oathkeeper', 'quiz_champion', 'personal_best'
]);

const PATH_SEAL = {
    Guardian: 'path_guardian', Sage: 'path_sage', Paladin: 'path_paladin', Artificer: 'path_artificer',
    Scholar: 'path_scholar', Vanguard: 'path_vanguard', Weaver: 'path_vanguard', Nomad: 'path_nomad', Patron: 'path_patron'
};
const GUILD_SEAL = {
    dragon_flame: 'guild_dragon_flame', grizzly_might: 'guild_grizzly_might',
    owl_wisdom: 'guild_owl_wisdom', phoenix_rising: 'guild_phoenix_rising'
};
const GUILD_NAME = { dragon_flame: 'Dragon Flame', grizzly_might: 'Grizzly Might', owl_wisdom: 'Owl Wisdom', phoenix_rising: 'Phoenix Rising' };
/** Drawn by the stars when nothing personal claims a wild slot. */
const STAR_DRAWN = ['wild_early_light', 'wild_bright_day', 'wild_story_hero', 'wild_generous', 'wild_kindred', 'wild_chain', 'wild_training', 'wild_collector'];

export const TRAINING_STAR_REASONS = TRAINING_REASONS;

// ─── Small helpers ───────────────────────────────────────────────────────────

/** FNV-1a, so a child's draw is the same on every device and every day. */
export function sealHash(text) {
    let h = 0x811c9dc5;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** 'YYYY-MM-DD' from 'DD-MM-YYYY', 'YYYY-MM-DD', a Date, ms or a Firestore Timestamp. */
export function sealDateKey(value) {
    if (value === null || value === undefined || value === '') return '';
    let d = null;
    if (typeof value === 'string') {
        const t = value.trim();
        let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        d = new Date(t);
    } else if (value instanceof Date) {
        d = value;
    } else if (typeof value === 'number') {
        d = new Date(value);
    } else if (typeof value?.toDate === 'function') {
        d = value.toDate();
    } else if (Number.isFinite(value?.seconds)) {
        d = new Date(value.seconds * 1000);
    }
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "4 Oct" (or "4 Oct 2026"). */
export function sealDateLabel(dateKey, withYear = false) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
    if (!m) return '';
    return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${withYear ? ` ${m[1]}` : ''}`;
}

export function firstNameOf(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'This hero';
}

export function getSeal(id) {
    return SEALS[id] || null;
}

export function isAcademicSeal(id) {
    return ACADEMIC.has(id);
}

// ─── The book ────────────────────────────────────────────────────────────────

function quillFor({ usesTrials = true, trials = [] } = {}) {
    if (!usesTrials) return 'quill_star';
    const pcts = trials.filter((t) => t.pct !== null && t.pct !== undefined && t.pct !== '').map((t) => Number(t.pct)).filter(Number.isFinite);
    if (!pcts.length) return 'quill_rising';
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    if (avg >= 85) return 'quill_golden';
    if (avg >= 60) return 'quill_bright';
    return 'quill_rising';
}

function hearthFor({ recentAbsences = 0 } = {}) {
    return recentAbsences >= 2 ? 'hearth_return' : 'hearth_full_moon';
}

function pathFor(heroClass) {
    return PATH_SEAL[String(heroClass || '').trim()] || 'path_choose';
}

function guildFor(guildId) {
    return GUILD_SEAL[guildId] || 'guild_sorted';
}

function wildFor(studentId, { hasOccasion = false, hasFamiliarEgg = false } = {}) {
    const picks = [];
    if (hasOccasion) picks.push('wild_candle');
    if (hasFamiliarEgg) picks.push('wild_familiar');
    const drawn = [...STAR_DRAWN].sort((a, b) => sealHash(`${studentId}|${a}`) - sealHash(`${studentId}|${b}`));
    for (const id of drawn) {
        if (picks.length >= 2) break;
        picks.push(id);
    }
    return picks.slice(0, 2);
}

/**
 * The child's personal slots. Identity slots (path, guild) follow the child while still
 * unearned; the other slots are kept once drawn, so a book never reshuffles under a child.
 * An earned seal always stays where it is.
 */
export function buildSealBook(profile = {}, stored = null) {
    const earned = profile.earned || {};
    const [wild1, wild2] = wildFor(profile.studentId, profile);
    const fresh = {
        path: pathFor(profile.heroClass),
        quill: quillFor(profile),
        hearth: hearthFor(profile),
        guild: guildFor(profile.guildId),
        wild1,
        wild2
    };
    const book = {};
    const old = stored && typeof stored === 'object' ? stored : {};
    PERSONAL_SLOTS.forEach((slot) => {
        const kept = SEALS[old[slot]] ? old[slot] : null;
        if (kept && earned[kept]) { book[slot] = kept; return; }
        if (slot === 'path' || slot === 'guild') { book[slot] = fresh[slot]; return; }
        book[slot] = kept || fresh[slot];
    });
    // A newly known birthday never pushes out a drawn seal, but two slots never hold the same seal.
    if (book.wild1 === book.wild2) book.wild2 = wildFor(`${profile.studentId}~`, {}).find((id) => id !== book.wild1);
    return book;
}

export function bookSealIds(book = {}) {
    return [...SHARED_SEALS, ...PERSONAL_SLOTS.map((slot) => book[slot]).filter((id) => SEALS[id])];
}

/** Why a personal seal belongs to this child, in a few kind words (never a level or a mark). */
export function sealReason(slot, sealId, { name = '', heroClass = '', guildId = '' } = {}) {
    const first = firstNameOf(name);
    switch (slot) {
        case 'path': return sealId === 'path_choose' ? `For ${first}'s first step onto a Hero Path` : `Because ${first} walks the ${heroClass === 'Weaver' ? 'Vanguard' : heroClass} path`;
        case 'quill': return sealId === 'quill_star' ? `For ${first}'s own kind of excellence` : `Set to ${first}'s own pace in trials`;
        case 'hearth': return sealId === 'hearth_return' ? `For every time ${first} comes back` : `For being there, lesson after lesson`;
        case 'guild': return GUILD_NAME[guildId] ? `For ${first}'s guild, ${GUILD_NAME[guildId]}` : `For the day ${first} joins a guild`;
        default:
            if (sealId === 'wild_candle') return `Because ${first}'s special day is in the calendar`;
            if (sealId === 'wild_familiar') return `Because ${first} carries a familiar's egg`;
            return `Drawn by the stars for ${first}`;
    }
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

function firstDate(dates) {
    return dates.filter(Boolean).sort()[0] || '';
}

function monthOf(dateKey) {
    return String(dateKey || '').slice(0, 7);
}

/**
 * Which seals of the book the facts prove, with the day each was first reached.
 *
 * facts = {
 *   today: 'YYYY-MM-DD',
 *   awards: [{ date, reason, stars }]       stars this child received (positive only)
 *   boonsGiven: [date], boonsReceived: [date]
 *   lessons: [date]                          the class's lesson days since the child joined, up to today
 *   trackedFrom: date                        the class's first record in the Quest; attendance counts from here
 *   openingDay: date                         the school year's opening day (a month opened late is not whole)
 *   absences: [date]                         lessons the child missed
 *   trials: [{ date, type, pct }]            the child's graded tests and dictations
 *   firstStarDates: [date]                   lessons where this child got the first star of the class
 *   oathKeptDates, championDates: [date]
 *   heroClass, heroLevel, guildId, heroOfDayWins, familiarAlive, inventoryCount
 *   occasions: ['MM-DD']                     birthday / nameday (no year)
 *   young: bool                              younger leagues need fewer stars for the guild seal
 * }
 * Returns { [sealId]: { date, note } } for every seal of `ids` the facts prove.
 */
export function evaluateSeals(ids = [], facts = {}) {
    const today = facts.today || '';
    const awards = (facts.awards || [])
        .filter((a) => a && a.date && (Number(a.stars) || 0) > 0 && (!today || a.date <= today))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const lessons = [...new Set(facts.lessons || [])].filter((d) => !today || d <= today).sort();
    // Before the class's first record nobody took attendance, so no absence proves nothing.
    const kept = facts.trackedFrom ? lessons.filter((d) => d >= facts.trackedFrom) : lessons;
    const absent = new Set(facts.absences || []);
    const starsOn = new Map();
    awards.forEach((a) => starsOn.set(a.date, (starsOn.get(a.date) || 0) + (Number(a.stars) || 0)));
    const trials = (facts.trials || [])
        .filter((t) => t && t.date && t.pct !== null && t.pct !== '' && Number.isFinite(Number(t.pct)))
        .map((t) => ({ ...t, pct: Number(t.pct) }))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const out = {};
    // `status` seals are proven by how things stand now (a level, a count), not by a dated record.
    const hit = (id, date, note = '', status = false) => { if (date) out[id] = status ? { date, note, status: true } : { date, note }; };

    for (const id of ids) {
        switch (id) {
            case 'virtue_respect':
            case 'virtue_creativity':
            case 'virtue_teamwork':
            case 'virtue_focus': {
                const reason = id.slice('virtue_'.length);
                hit(id, awards.find((a) => a.reason === reason)?.date, `First ${VIRTUE_LABEL[reason]} star`);
                break;
            }
            case 'four_winds': {
                const seen = new Map();
                for (const a of awards) {
                    if (!VIRTUES.includes(a.reason)) continue;
                    const m = monthOf(a.date);
                    if (!seen.has(m)) seen.set(m, new Set());
                    seen.get(m).add(a.reason);
                    if (seen.get(m).size === 4) { hit(id, a.date, 'Respect, Creativity, Teamwork and Focus in one month'); break; }
                }
                break;
            }
            case 'steadfast': {
                let run = 0;
                for (const d of kept) {
                    if (absent.has(d)) { run = 0; continue; }
                    // Today's lesson counts once a star proves the child was there.
                    if (d === today && !starsOn.has(d)) continue;
                    run += 1;
                    if (run === 10) { hit(id, d, 'Ten lessons in a row'); break; }
                }
                break;
            }
            case 'open_hand':
                hit(id, firstDate(facts.boonsGiven || []), "First Hero's Boon given");
                break;
            case 'oathkeeper':
                hit(id, firstDate(facts.oathKeptDates || []), 'First Ember Oath kept');
                break;
            case 'quiz_champion':
                hit(id, firstDate(facts.championDates || []), 'Quiz Champion');
                break;
            case 'personal_best': {
                const best = {};
                const count = {};
                for (const t of trials) {
                    const k = t.type === 'dictation' ? 'dictation' : 'test';
                    if ((count[k] || 0) >= 2 && t.pct > best[k]) { hit(id, t.date, `${k === 'dictation' ? 'Dictation' : 'Test'} personal best`); break; }
                    best[k] = Math.max(best[k] ?? -Infinity, t.pct);
                    count[k] = (count[k] || 0) + 1;
                }
                break;
            }
            case 'path_choose':
                if (facts.heroClass) hit(id, today, 'A Hero Path chosen', true);
                break;
            default:
                if (id.startsWith('path_')) {
                    if (pathFor(facts.heroClass) === id && (Number(facts.heroLevel) || 0) >= 1) hit(id, today, 'Hero Path level 1', true);
                    break;
                }
                evaluatePersonal(id, { facts, today, awards, lessons, kept, absent, starsOn, trials, hit });
        }
    }
    return out;
}

function evaluatePersonal(id, { facts, today, awards, lessons, kept, absent, starsOn, trials, hit }) {
    switch (id) {
        case 'quill_rising': {
            const last = {};
            for (const t of trials) {
                const k = t.type === 'dictation' ? 'dictation' : 'test';
                if (Number.isFinite(last[k]) && t.pct - last[k] >= 10) { hit(id, t.date, `Up ${Math.round(t.pct - last[k])} points on the last one`); return; }
                last[k] = t.pct;
            }
            return;
        }
        case 'quill_bright':
            hit(id, trials.find((t) => t.pct >= 85)?.date, '85% or more');
            return;
        case 'quill_golden': {
            let run = 0;
            for (const t of trials) {
                run = t.pct >= 90 ? run + 1 : 0;
                if (run === 3) { hit(id, t.date, 'Three trials in a row at 90%+'); return; }
            }
            return;
        }
        case 'quill_star':
            hit(id, awards.find((a) => a.reason === 'excellence')?.date, 'First Excellence star');
            return;
        case 'hearth_return': {
            for (let i = 0; i < kept.length; i += 1) {
                if (!absent.has(kept[i])) continue;
                const back = kept.slice(i + 1).find((d) => !absent.has(d));
                if (back && starsOn.has(back)) { hit(id, back, 'A star on the first lesson back'); return; }
            }
            return;
        }
        case 'hearth_full_moon': {
            const thisMonth = monthOf(today);
            const byMonth = new Map();
            lessons.forEach((d) => {
                const m = monthOf(d);
                if (m === thisMonth) return; // a month counts once it is over
                if (!byMonth.has(m)) byMonth.set(m, []);
                byMonth.get(m).push(d);
            });
            const joined = facts.joinedMonth || '';
            const opening = facts.openingDay || '';
            for (const [m, days] of [...byMonth.entries()].sort()) {
                if (joined && m <= joined) continue; // a month joined part-way is not a whole month
                // A month the Quest did not keep from its first lesson is not a whole month,
                // nor the opening month when the year opened after its first week.
                if (facts.trackedFrom && days[0] < facts.trackedFrom) continue;
                if (opening && monthOf(opening) === m && Number(opening.slice(8, 10)) > 7) continue;
                if (days.length >= 4 && days.every((d) => !absent.has(d))) { hit(id, days[days.length - 1], `Every lesson of ${MONTHS[Number(m.slice(5)) - 1]}`); return; }
            }
            return;
        }
        case 'guild_sorted':
            if (facts.guildId) hit(id, today, 'Sorted into a guild', true);
            return;
        case 'wild_candle': {
            const occasions = (facts.occasions || []).filter((o) => /^\d{2}-\d{2}$/.test(o));
            if (!occasions.length) return;
            for (const d of lessons) {
                if (!starsOn.has(d)) continue;
                const day = new Date(`${d}T12:00:00`);
                const near = occasions.some((o) => {
                    for (const y of [day.getFullYear() - 1, day.getFullYear()]) {
                        const occ = new Date(`${y}-${o}T12:00:00`);
                        const gap = Math.round((day - occ) / 86400000);
                        if (gap >= 0 && gap <= 7) {
                            // The first lesson on or after the special day, not any lesson that week.
                            const occKey = sealDateKey(occ);
                            return lessons.find((l) => l >= occKey && !absent.has(l)) === d;
                        }
                    }
                    return false;
                });
                if (near) { hit(id, d, 'A star on a special day'); return; }
            }
            return;
        }
        case 'wild_familiar':
            if (facts.familiarAlive) hit(id, today, 'Familiar hatched', true);
            return;
        case 'wild_early_light':
            hit(id, firstDate(facts.firstStarDates || []), 'First star of the lesson');
            return;
        case 'wild_bright_day':
            hit(id, [...starsOn.entries()].filter(([, n]) => n >= 3).map(([d]) => d).sort()[0], 'Three stars in one lesson');
            return;
        case 'wild_story_hero':
            if ((Number(facts.heroOfDayWins) || 0) >= 1) hit(id, today, 'Hero of the Day', true);
            return;
        case 'wild_generous': {
            const given = [...(facts.boonsGiven || [])].filter(Boolean).sort();
            hit(id, given[2], "Three Hero's Boons given");
            return;
        }
        case 'wild_kindred':
            hit(id, firstDate(facts.boonsReceived || []), "A Hero's Boon from a classmate");
            return;
        case 'wild_chain': {
            let run = 0;
            for (const d of lessons) {
                if (absent.has(d)) { run = 0; continue; }
                if (starsOn.has(d)) {
                    run += 1;
                    if (run === 5) { hit(id, d, 'Five lessons, five stars'); return; }
                } else if (d !== today) {
                    run = 0;
                }
            }
            return;
        }
        case 'wild_training':
            hit(id, awards.find((a) => TRAINING_STAR_REASONS.includes(a.reason))?.date, 'First Training Grounds star');
            return;
        case 'wild_collector':
            if ((Number(facts.inventoryCount) || 0) >= 3) hit(id, today, 'Three keepsakes', true);
            return;
        default:
            if (id.startsWith('guild_') && id === guildFor(facts.guildId)) {
                const need = facts.young ? 8 : 10;
                const byMonth = new Map();
                for (const a of awards) {
                    const m = monthOf(a.date);
                    byMonth.set(m, (byMonth.get(m) || 0) + (Number(a.stars) || 0));
                    if (byMonth.get(m) >= need) { hit(id, a.date, `${need} stars in one month`); return; }
                }
            }
    }
}

/**
 * New seals to press: proven now, in the book, and not pressed before.
 * While catching up (`catchingUp`), a seal dated before today or proven by status is marked `late`.
 */
export function newSealPresses(ids, proven, earned = {}, { today = '', found = Date.now(), catchingUp = false } = {}) {
    const out = {};
    ids.forEach((id) => {
        if (earned[id] || !proven[id]) return;
        const { date, note, status } = proven[id];
        // While catching up, anything already true (or dated before today) was not seen live.
        const late = Boolean(catchingUp && date && (status || (today && date < today)));
        out[id] = { date, found, note: String(note || '').slice(0, 120), ...(late ? { late: true } : {}) };
    });
    return out;
}

// ─── Views ───────────────────────────────────────────────────────────────────

/** Everything the Seal Book shows for one child. */
export function buildSealBookView({ student = {}, heroSeals = null } = {}) {
    const stored = heroSeals && typeof heroSeals === 'object' ? heroSeals : {};
    const earned = stored.earned && typeof stored.earned === 'object' ? stored.earned : {};
    const book = stored.book && typeof stored.book === 'object'
        ? buildSealBook({ studentId: student.id, heroClass: student.heroClass, guildId: student.guildId, earned }, stored.book)
        : null;
    const ids = book ? bookSealIds(book) : [...SHARED_SEALS];
    const personalSlot = new Map(book ? PERSONAL_SLOTS.map((slot) => [book[slot], slot]) : []);
    const entry = (id) => {
        const def = SEALS[id];
        const e = earned[id];
        const slot = personalSlot.get(id) || '';
        return {
            ...def,
            slot,
            personal: Boolean(slot),
            reason: slot ? sealReason(slot, id, student) : '',
            earned: Boolean(e),
            date: e?.date || '',
            dateLabel: sealDateLabel(e?.date),
            note: e?.note || '',
            found: Number(e?.found) || 0
        };
    };
    const all = ids.filter((id) => SEALS[id]).map(entry);
    // Seals pressed for a book slot that later moved on (a new Hero Path) stay in the book.
    Object.keys(earned).forEach((id) => { if (SEALS[id] && !ids.includes(id)) all.push({ ...entry(id), personal: true, reason: 'From an earlier page of the story' }); });
    const pressed = all.filter((s) => s.earned).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.found - a.found));
    return {
        ready: Boolean(book),
        shared: all.filter((s) => !s.personal),
        personal: all.filter((s) => s.personal),
        pressed,
        latest: pressed[0] || null,
        earnedCount: pressed.length,
        total: all.length
    };
}

/** Seals pressed after `since` (ms) across many children, newest first, grouped per child. */
export function collectNewSeals(rows = [], since = 0) {
    const out = [];
    rows.forEach(({ student, heroSeals, classLabel = '' }) => {
        const earned = heroSeals?.earned || {};
        const seals = Object.entries(earned)
            .filter(([id, e]) => SEALS[id] && (Number(e?.found) || 0) > since)
            .map(([id, e]) => ({ ...SEALS[id], date: e.date || '', dateLabel: sealDateLabel(e.date), note: e.note || '', found: Number(e.found) || 0, late: Boolean(e.late) }))
            .sort((a, b) => b.found - a.found || (a.date < b.date ? 1 : -1));
        if (seals.length) out.push({ student, classLabel, seals, newest: seals[0].found, liveCount: seals.filter((s) => !s.late).length });
    });
    return out.sort((a, b) => b.newest - a.newest || String(a.student?.name).localeCompare(String(b.student?.name)));
}

/** Seals pressed live on `dateKey`, for the class diary. Marks and absences stay out of it. */
export function sealsPressedOn(rows = [], dateKey = '') {
    const out = [];
    rows.forEach(({ name, heroSeals }) => {
        Object.entries(heroSeals?.earned || {}).forEach(([id, e]) => {
            if (!SEALS[id] || e?.late || e?.date !== dateKey || DIARY_QUIET.has(id)) return;
            out.push({ hero: name, seal: SEALS[id].name, meaning: SEALS[id].told });
        });
    });
    return out;
}

// ─── Art ─────────────────────────────────────────────────────────────────────

function shade(hex, amount) {
    const raw = String(hex || '#888888').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0');
    const n = Number.parseInt(full, 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(v)));
    });
    return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** An organic wax outline: a circle with soft, uneven lobes that are the same for a seal everywhere. */
export function waxOutlinePath(id, { cx = 50, cy = 50, r = 40, lobes = 9 } = {}) {
    const seed = sealHash(id);
    const p1 = (seed % 628) / 100;
    const p2 = ((seed >>> 10) % 628) / 100;
    const p3 = ((seed >>> 20) % 628) / 100;
    const pts = [];
    const steps = 54;
    for (let i = 0; i < steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        // Soft lobes where the wax spread, plus a slow swell so no two seals share an edge.
        const rr = r
            + Math.sin(a * lobes + p1) * 1.7
            + Math.sin(a * 3 + p2) * 1.9
            + Math.sin(a * 5 + p3) * 0.9;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    // Smooth closed curve through the points (Catmull-Rom → cubic Bézier).
    const f = (n) => n.toFixed(2);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length; i += 1) {
        const p0 = pts[(i - 1 + pts.length) % pts.length];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const p3 = pts[(i + 2) % pts.length];
        d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return `${d}Z`;
}

function escAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * One seal as HTML: a pressed wax seal (SVG body + Font Awesome emblem), or a faint
 * unpressed impression. `size` is in px; the emblem scales with it.
 */
export function sealArtHtml(sealOrId, { earned = true, size = 72, className = '' } = {}) {
    const def = typeof sealOrId === 'string' ? SEALS[sealOrId] : sealOrId;
    if (!def) return '';
    const uid = `hs${sealHash(`${def.id}|${earned ? 1 : 0}`).toString(36)}`;
    const tint = def.tint;
    const ribbons = earned && def.rare
        ? `<path d="M34 70 L24 98 L33 92 L39 100 L45 74Z" fill="${shade(tint, -0.25)}"/><path d="M66 70 L76 98 L67 92 L61 100 L55 74Z" fill="${shade(tint, -0.15)}"/>`
        : '';
    const body = earned
        ? `<defs>
                <radialGradient id="${uid}w" cx="38%" cy="32%" r="75%">
                    <stop offset="0" stop-color="${shade(tint, 0.38)}"/>
                    <stop offset="0.55" stop-color="${tint}"/>
                    <stop offset="1" stop-color="${shade(tint, -0.38)}"/>
                </radialGradient>
            </defs>
            ${ribbons}
            <path d="${waxOutlinePath(def.id)}" fill="${shade(tint, -0.45)}" transform="translate(1.6 2.4)" opacity="0.55"/>
            <path d="${waxOutlinePath(def.id)}" fill="url(#${uid}w)"/>
            <circle cx="50" cy="50" r="29" fill="none" stroke="${shade(tint, -0.3)}" stroke-width="3.2" opacity="0.75"/>
            <circle cx="50" cy="50" r="29" fill="none" stroke="${shade(tint, 0.45)}" stroke-width="1.1" opacity="0.6" transform="translate(-0.8 -0.8)"/>
            <circle cx="50" cy="50" r="24.5" fill="${shade(tint, -0.12)}" opacity="0.55"/>
            <ellipse cx="37" cy="30" rx="11" ry="5.5" fill="#fff" opacity="0.22" transform="rotate(-28 37 30)"/>`
        : `<path d="${waxOutlinePath(def.id)}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.5 4" opacity="0.5"/>
            <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.32"/>`;
    return `<span class="hs-seal${earned ? ' is-pressed' : ' is-unpressed'}${def.rare ? ' is-rare' : ''}${className ? ` ${className}` : ''}"
        style="--hs-size:${size}px;--hs-tint:${tint};--hs-deep:${shade(tint, -0.55)};--hs-light:${shade(tint, 0.6)}" data-seal="${escAttr(def.id)}" aria-hidden="true">
        <svg viewBox="0 0 100 104" class="hs-seal__wax" focusable="false">${body}</svg>
        <i class="fas ${escAttr(def.icon)} hs-seal__emblem"></i>
    </span>`;
}
