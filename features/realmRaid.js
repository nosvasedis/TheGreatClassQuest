// /features/realmRaid.js — Realm Raid watcher: the school's shared raid, live.
// Works out which raid is near (herald, active, aftermath), builds every class's shard from the
// school's classes, rosters and schedules, and counts the raid week's stars from the award log.
// The shared record (`world_boss/realm_raid_<raidId>`) only locks the moments the shield broke
// and went legendary, so a late roster change can never un-break it.
// Each teacher's app pays its own classes, once, with a receipt on the class (`realmRaids.<raidId>`).
// Rules live in realmRaidCore.mjs; the hall is ui/modals/realmRaid.js.
import '../styles/realm_raid_card.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, getDocs, collection, query, where, onSnapshot, runTransaction, serverTimestamp } from '../firebase.js';
import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../utils/yearGold.js';
import { quizPrizeCandidates } from './quizRewardsCore.mjs';
import {
    RAID_REWARDS,
    addDays,
    computeShares,
    countRaidHeroWins,
    dayKey,
    findRaid,
    goldFor,
    nextRaid,
    owedRaidRewards,
    pickRaidHero,
    questStepStars,
    raidCountdown,
    raidStatus,
    raidsOfYear,
    readDate,
    startOfDay,
    tallyRaidStars
} from './realmRaidCore.mjs';

const DATA = 'artifacts/great-class-quest/public/data';
const RECORDS = 'world_boss';
const SETTLE_MS = 6000;
const DEBOUNCE_MS = 1500;
/** A raid that ended this many days ago or less is still checked for unpaid rewards. */
const CATCH_UP_DAYS = 75;
/** After the raid, an unrevealed Raid Hero is chosen quietly after this many days. */
const HERO_AUTO_DAYS = 3;

let started = false;
let startedAt = 0;
let timer = null;
let view = null;
const listeners = new Set();
const fetched = new Map(); // raidId → { status, logs }
const records = new Map(); // raidId → record data
let recordUnsub = null;
let recordFor = '';
const locking = new Set();
const paying = new Set();

// ─── Inputs ──────────────────────────────────────────────────────────────────

export function raidOptions() {
    return {
        holidays: state.get('schoolHolidayRanges') || [],
        closeDate: state.get('schoolYearState')?.closeDate || null
    };
}

/** The raid that matters today (herald, active or aftermath), or null. */
export function currentRaid(now = new Date()) {
    return findRaid(now, raidOptions());
}

/** The next raid to come, for "the Guardian returns" lines. */
export function upcomingRaid(now = new Date()) {
    return nextRaid(now, raidOptions());
}

function schoolClasses() {
    return (state.get('allSchoolClasses') || []).filter((c) => c?.id && c.status !== 'archived');
}

function heroCounts() {
    const counts = {};
    (state.get('allStudents') || []).forEach((s) => {
        if (s?.classId) counts[s.classId] = (counts[s.classId] || 0) + 1;
    });
    return counts;
}

function lessonCheck(classes) {
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    return (classId, date) => utils.doesClassMeetOnDate(classId, date, classes, overrides, holidays, {});
}

function monthStart(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Award logs of the raid week: the live month listener, plus a one-time read of older days. */
function raidLogs(raid, now = new Date()) {
    const live = state.get('allAwardLogs') || [];
    const cached = fetched.get(raid.raidId);
    return cached?.logs?.length ? [...cached.logs, ...live] : live;
}

function needsFetch(raid, now = new Date()) {
    return startOfDay(raid.start) < monthStart(now);
}

/** Loads the raid days that the live month listener does not hold (once per session). */
export async function ensureRaidLogs(raid, now = new Date()) {
    if (!raid || !needsFetch(raid, now)) return;
    const hit = fetched.get(raid.raidId);
    if (hit?.status === 'ready' || hit?.status === 'loading') return hit.promise;
    const from = startOfDay(raid.start);
    const until = new Date(Math.min(monthStart(now).getTime(), addDays(raid.end, 4).getTime()));
    const entry = { status: 'loading', logs: [] };
    const read = async (withYear) => {
        const yearKey = state.getActiveSchoolYearKey?.();
        const clauses = withYear && yearKey ? [where('schoolYearKey', '==', yearKey)] : [];
        const snap = await getDocs(query(collection(db, `${DATA}/award_log`), ...clauses,
            where('createdAt', '>=', from), where('createdAt', '<', until)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    };
    entry.promise = read(true)
        .catch(() => read(false))
        .then((logs) => { entry.logs = logs; entry.status = 'ready'; })
        .catch((error) => { entry.status = 'failed'; console.warn('Realm Raid: could not read the raid week stars.', error?.code || error?.message); })
        .finally(() => schedule(50));
    fetched.set(raid.raidId, entry);
    return entry.promise;
}

function watchRecord(raid) {
    const id = raid ? `realm_raid_${raid.raidId}` : '';
    if (id === recordFor) return;
    recordUnsub?.();
    recordUnsub = null;
    recordFor = id;
    if (!id) return;
    try {
        recordUnsub = onSnapshot(doc(db, `${DATA}/${RECORDS}`, id), (snap) => {
            records.set(raid.raidId, snap.exists() ? snap.data() : {});
            schedule(50);
        }, (error) => console.warn('Realm Raid record unavailable:', error?.code || error?.message));
    } catch (error) {
        console.warn('Realm Raid record listener failed:', error);
    }
}

// ─── The view ────────────────────────────────────────────────────────────────

function toDateValue(value) {
    return readDate(value)?.getTime?.() || null;
}

/**
 * Everything the hall, the Home pill and the projector card show, for one raid.
 * Sync: it uses whatever stars are loaded (`loading` says when older days are still coming).
 */
export function buildRaidView(raid, now = new Date()) {
    if (!raid) return null;
    const classes = schoolClasses();
    const shares = computeShares({ raid, classes, heroCounts: heroCounts(), meets: lessonCheck(classes) });
    const tally = tallyRaidStars(raidLogs(raid, now), raid, { credit: getAwardLogMonthlyStarCredit });
    const record = records.get(raid.raidId) || {};
    const status = raidStatus({ shares, tally, locked: { brokenAt: record.brokenAt, legendaryAt: record.legendaryAt } });
    const uid = state.get('currentUserId');
    const byId = new Map(classes.map((c) => [c.id, c]));
    const today = dayKey(now);
    const rows = status.classes.map((row) => {
        const cls = byId.get(row.classId) || {};
        const nextLesson = (row.lessonDates || []).find((d) => d >= today) || null;
        return {
            ...row,
            name: cls.name || 'A class',
            logo: cls.logo || '📚',
            league: cls.questLevel || '',
            own: Boolean(uid && cls.createdBy?.uid === uid),
            receipt: cls.realmRaids?.[raid.raidId] || null,
            nextLesson,
            lessonsLeft: (row.lessonDates || []).filter((d) => d >= today).length
        };
    });
    const fetchState = needsFetch(raid, now) ? (fetched.get(raid.raidId)?.status || 'loading') : 'ready';
    return {
        raid,
        status,
        rows,
        tally,
        record,
        loading: fetchState === 'loading',
        brokenOn: toDateValue(record.brokenAt),
        next: upcomingRaid(addDays(raid.end, 1))
    };
}

export function getRaidView() {
    return view;
}

/** Words for the Home pill: { eyebrow, title, tag, won }, or null when no raid is near. */
export function raidPill(v = view) {
    if (!v) return null;
    const { raid, status } = v;
    const share = status.hp ? Math.floor((status.dealt / status.hp) * 100) : 0;
    if (raid.phase === 'herald') return { eyebrow: 'Realm Raid', title: `${raid.season.guardian} ${raidCountdown(raid)}`, tag: raid.season.emoji, won: false };
    if (raid.phase === 'active') {
        const title = status.legendary ? 'Legendary victory!' : status.broken ? 'Shield broken!' : `Shield ${share}% broken`;
        return { eyebrow: `Realm Raid · ${raidCountdown(raid)}`, title, tag: raid.season.emoji, won: status.broken };
    }
    return { eyebrow: 'Realm Raid', title: status.broken ? 'The school won!' : 'The shield held', tag: raid.season.emoji, won: status.broken };
}

/** Calls back with the latest view whenever it changes. Returns an unsubscribe. */
export function subscribeRaid(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function emit() {
    listeners.forEach((cb) => { try { cb(view); } catch (error) { console.warn('Realm Raid listener failed:', error); } });
}

// ─── Locking the moments ─────────────────────────────────────────────────────

async function lockMoment(v, field) {
    const key = `${v.raid.raidId}|${field}`;
    if (locking.has(key)) return;
    locking.add(key);
    const ref = doc(db, `${DATA}/${RECORDS}`, `realm_raid_${v.raid.raidId}`);
    try {
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(ref);
            if (snap.exists() && snap.data()?.[field]) return;
            const yearKey = state.getActiveSchoolYearKey?.() || null;
            transaction.set(ref, {
                raidId: v.raid.raidId,
                season: v.raid.season.id,
                ...(yearKey ? { schoolYearKey: yearKey } : {}),
                [field]: serverTimestamp(),
                [`${field.replace(/At$/, '')}Hp`]: v.status.hp,
                [`${field.replace(/At$/, '')}Stars`]: v.status.dealt,
                updatedAt: serverTimestamp()
            }, { merge: true });
        });
    } catch (error) {
        // Without the shared record the outcome still follows the stars.
        if (error?.code !== 'permission-denied') locking.delete(key);
        console.warn('Realm Raid: could not lock the moment.', error?.code || error?.message);
    }
}

// ─── Payouts (each teacher pays their own classes) ───────────────────────────

function studentsOf(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId);
}

async function payParts(v, row, parts) {
    const raidId = v.raid.raidId;
    const classRef = doc(db, `${DATA}/classes`, row.classId);
    const students = studentsOf(row.classId);
    const goldContext = getLiveYearGoldContextFromState(state);
    const monthKey = utils.getMonthKey(new Date());
    return runTransaction(db, async (transaction) => {
        const snap = await transaction.get(classRef);
        if (!snap.exists()) return null;
        const data = snap.data() || {};
        const receipt = data.realmRaids?.[raidId] || {};
        const todo = parts.filter((part) => !receipt[`${part}At`]);
        if (!todo.length) return null;
        const reads = await Promise.all(students.map(async (s) => {
            const ref = doc(db, `${DATA}/student_scores`, s.id);
            return { ref, snap: await transaction.get(ref) };
        }));
        const gold = todo.reduce((sum, part) => sum + goldFor(part), 0);
        reads.forEach(({ ref, snap: scoreSnap }) => {
            if (!scoreSnap.exists() || gold <= 0) return;
            transaction.update(ref, { gold: getLiveYearGold(scoreSnap.data(), goldContext) + gold });
        });
        const goal = utils.calculateMonthlyClassGoal({ id: row.classId, ...data }, students.length,
            state.get('schoolHolidayRanges'), state.get('allScheduleOverrides'));
        let questStars = 0;
        if (todo.includes('victory')) questStars += questStepStars(goal, RAID_REWARDS.victoryQuestStep);
        if (todo.includes('legendary')) questStars += questStepStars(goal, RAID_REWARDS.legendaryQuestStep);
        const base = `realmRaids.${raidId}`;
        const patch = {
            [`${base}.season`]: v.raid.season.id,
            [`${base}.stars`]: row.stars,
            [`${base}.share`]: row.share,
            [`${base}.gold`]: (Number(receipt.gold) || 0) + gold
        };
        todo.forEach((part) => { patch[`${base}.${part}At`] = serverTimestamp(); });
        if (questStars > 0) {
            patch[`teamQuestBonuses.${monthKey}`] = (Number(data.teamQuestBonuses?.[monthKey]) || 0) + questStars;
            patch[`${base}.questStars`] = (Number(receipt.questStars) || 0) + questStars;
        }
        transaction.update(classRef, patch);
        return { todo, gold, questStars, heroes: reads.filter((r) => r.snap.exists()).length };
    });
}

function announcePaid(row, paid) {
    if (!paid) return;
    const parts = paid.todo;
    const what = parts.includes('victory') ? 'Victory spoils'
        : parts.includes('legendary') ? 'Legendary spoils' : 'Valor';
    const quest = paid.questStars > 0 ? ` and +${paid.questStars} Team Quest stars` : '';
    const lead = parts.includes('valor') && !parts.includes('victory')
        ? `${row.logo} ${row.name} broke its own shard!`
        : `${row.logo} ${row.name}: ${what.toLowerCase()} are in.`;
    import('../ui/effects.js').then(({ notify }) => notify({
        type: 'praise',
        title: 'Realm Raid',
        icon: '🛡️',
        duration: 7000,
        message: `${lead} +${paid.gold} Gold for every hero${quest}.`,
        action: { label: 'Open the Raid', icon: 'fa-shield-halved', onClick: () => openRealmRaid() }
    })).catch(() => {});
}

/** Picks the class's Raid Hero once and gives one festival treasure (or Gold). */
export async function revealRaidHero(classId, v = view) {
    if (!v?.raid) return null;
    const raidId = v.raid.raidId;
    const classRef = doc(db, `${DATA}/classes`, classId);
    const roster = new Set(studentsOf(classId).map((s) => s.id));
    const heroes = Object.values(v.tally?.byHero || {}).filter((h) => h.classId === classId && roster.has(h.studentId));
    const claim = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(classRef);
        if (!snap.exists()) return null;
        const data = snap.data() || {};
        const receipt = data.realmRaids?.[raidId] || {};
        if (receipt.hero) return { existing: receipt.hero, data };
        const hero = pickRaidHero(heroes, { pastWins: countRaidHeroWins(data.realmRaids) });
        const entry = hero
            ? { studentId: hero.studentId, stars: hero.stars, days: hero.days.size, at: new Date().toISOString() }
            : { none: true, at: new Date().toISOString() };
        transaction.update(classRef, { [`realmRaids.${raidId}.hero`]: entry });
        return { entry, data };
    });
    if (!claim) return null;
    if (claim.existing) return claim.existing;
    const { entry, data } = claim;
    if (entry.none) return entry;
    let prize = null;
    try {
        const { loadLeagueStall, grantStallTreasure } = await import('../db/actions/stallTreasure.js');
        const league = data.questLevel || 'A';
        const candidates = quizPrizeCandidates(await loadLeagueStall(league), 'epic').slice(0, 5);
        prize = await grantStallTreasure(entry.studentId, candidates, { league, source: 'realm_raid_hero', fallbackGold: RAID_REWARDS.heroFallbackGold });
    } catch (error) {
        console.warn('Realm Raid: the hero prize could not be given.', error);
    }
    const saved = { ...entry, prize: prize ? (prize.kind === 'treasure' ? { kind: 'treasure', name: prize.item.name, image: prize.item.image || null, icon: prize.item.icon || null } : { kind: 'gold', gold: prize.gold }) : null };
    await runTransaction(db, async (transaction) => {
        transaction.update(classRef, { [`realmRaids.${raidId}.hero`]: saved });
    }).catch((error) => console.warn('Realm Raid: hero receipt not saved.', error));
    return saved;
}

async function settleOwnClasses(v, now) {
    if (state.get('currentUserRole') !== 'teacher' || !v) return;
    for (const row of v.rows) {
        if (!row.own || !(row.share > 0 || row.stars > 0)) continue;
        const owed = owedRaidRewards({ status: v.status, classRow: row, receipt: row.receipt, today: now, raid: v.raid });
        const parts = ['valor', 'victory', 'legendary'].filter((p) => owed[p]);
        const key = `${v.raid.raidId}|${row.classId}|${parts.join(',')}`;
        if (parts.length && !paying.has(key)) {
            paying.add(key);
            payParts(v, row, parts).then((paid) => announcePaid(row, paid)).catch((error) => {
                if (error?.code !== 'permission-denied') paying.delete(key);
                console.warn('Realm Raid payout failed:', error?.code || error?.message);
            });
        }
        // An unrevealed Raid Hero is chosen quietly a few days after the raid.
        const heroKey = `${v.raid.raidId}|${row.classId}|hero`;
        if (owed.heroReady && startOfDay(now) > addDays(v.raid.end, HERO_AUTO_DAYS - 1) && !paying.has(heroKey)) {
            paying.add(heroKey);
            revealRaidHero(row.classId, v).catch((error) => console.warn('Realm Raid hero failed:', error));
        }
    }
}

// ─── The loop ────────────────────────────────────────────────────────────────

function celebrated(raidId, kind) {
    try { return localStorage.getItem(`gcq.realmRaid.${kind}.${raidId}`) === '1'; } catch { return true; }
}

function markCelebrated(raidId, kind) {
    try { localStorage.setItem(`gcq.realmRaid.${kind}.${raidId}`, '1'); } catch { /* fine */ }
}

function maybeCelebrate(v, now) {
    if (state.get('currentUserRole') !== 'teacher' || !v?.status?.broken) return;
    if (startOfDay(now) > addDays(v.raid.end, 4)) return;
    const kind = v.status.legendary ? 'legendary' : 'victory';
    if (celebrated(v.raid.raidId, kind)) return;
    if (kind === 'legendary' && !celebrated(v.raid.raidId, 'victory')) markCelebrated(v.raid.raidId, 'victory');
    markCelebrated(v.raid.raidId, kind);
    import('../ui/modals/realmRaid.js').then(({ playRaidVictory }) => playRaidVictory(v, { legendary: kind === 'legendary' }))
        .catch((error) => console.warn('Realm Raid celebration failed:', error));
}

/** Raids that ended recently, still checked for unpaid rewards. */
function catchUpRaids(now) {
    const today = startOfDay(now);
    const options = raidOptions();
    return [...raidsOfYear(addDays(today, -CATCH_UP_DAYS), options), ...raidsOfYear(today, options)]
        .filter((r, i, all) => all.findIndex((x) => x.raidId === r.raidId) === i)
        .filter((r) => r.aftermathUntil < today && addDays(r.end, CATCH_UP_DAYS) >= today);
}

async function catchUp(now) {
    if (state.get('currentUserRole') !== 'teacher') return;
    const uid = state.get('currentUserId');
    for (const raid of catchUpRaids(now)) {
        // Only classes of this teacher that have no receipt yet need a look.
        const mine = schoolClasses().filter((c) => c.createdBy?.uid === uid);
        if (!mine.some((c) => !c.realmRaids?.[raid.raidId]?.victoryAt || !c.realmRaids?.[raid.raidId]?.hero)) continue;
        const key = `catchup|${raid.raidId}`;
        if (paying.has(key)) continue;
        paying.add(key);
        await ensureRaidLogs(raid, now);
        if (fetched.get(raid.raidId)?.status !== 'ready') continue;
        const ended = { ...raid, phase: 'over', dayNumber: 0, daysToStart: 0, daysLeft: 0 };
        const v = buildRaidView(ended, now);
        settleOwnClasses(v, now);
    }
}

function evaluate() {
    timer = null;
    const now = new Date();
    if (!state.get('currentUserId') || !(state.get('allSchoolClasses') || []).length) return;
    const raid = currentRaid(now);
    watchRecord(raid);
    if (raid) ensureRaidLogs(raid, now);
    view = raid ? buildRaidView(raid, now) : null;
    emit();
    if (Date.now() - startedAt < SETTLE_MS) { schedule(SETTLE_MS); return; }
    if (view && !view.loading && view.raid.phase !== 'herald') {
        if (view.status.broken && !view.record.brokenAt && view.status.hp > 0) lockMoment(view, 'brokenAt');
        if (view.status.legendary && !view.record.legendaryAt && view.status.hp > 0) lockMoment(view, 'legendaryAt');
        settleOwnClasses(view, now);
        maybeCelebrate(view, now);
    }
    catchUp(now).catch((error) => console.warn('Realm Raid catch-up failed:', error));
}

function schedule(ms = DEBOUNCE_MS) {
    clearTimeout(timer);
    timer = setTimeout(evaluate, ms);
}

/** Starts watching (once per page). Safe to call before sign-in. */
export function startRealmRaid() {
    if (started) return;
    started = true;
    startedAt = Date.now();
    state.subscribe(['allAwardLogs', 'allSchoolClasses', 'allStudents', 'schoolHolidayRanges', 'allScheduleOverrides', 'currentUserId'], () => schedule());
    // Phases change at midnight; a slow tick keeps a projector left on all week honest.
    setInterval(() => schedule(10), 10 * 60 * 1000);
    schedule();
}

/** Opens the Raid Hall (Home pill, projector remote, guide). */
export async function openRealmRaid(options = {}) {
    const { openRaidHall } = await import('../ui/modals/realmRaid.js');
    return openRaidHall(options);
}
