// features/grandGuildCeremony.js — the Grand Guild Ceremony: the end-of-year
// "Midsummer Festival of the Guilds". A prelude and six chapters (Legends of the
// Day, the Quest Road, the Prodigy Road, Wonders of the Year, the Guild Crowning
// with the Story of the Year, the Hall of Heroes), each opened by a title card.
// Markup lives in grandCeremonyView.js, the year's maths in grandCeremonyCore.mjs;
// celebrations run on the shared canvas engine (ui/ceremonyFx.js); music and
// effects come from ceremonyAudio.js and only load when the ceremony opens.

import { db, doc, writeBatch } from '../firebase.js';
import * as state from '../state.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as utils from '../utils.js';
import { GUILDS, GUILD_IDS, getGuildById } from './guilds.js';
import { getFirstCrownChapter } from './guildScoring.js';
import { finalCrownStandings, wheelYearSummary, raidYearSummary } from './grandCeremonyCore.mjs';
import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';
import { getYearScopedHeroOfDayWinsFromAppState } from '../utils/yearLegend.js';
import { createCeremonyFx } from '../ui/ceremonyFx.js';
import {
    isCeremonyAudioMuted,
    toggleCeremonyAudioMute,
    prepareCeremonyAudio,
    playCeremonyTrack,
    stopCeremonyMusic,
    stopCeremonyOneShots,
    stopCeremonyAudio,
    startCeremonyDrumroll,
    stopCeremonyDrumroll,
    playCeremonySfx,
    playCeremonyTally
} from '../ceremonyAudio.js';
import {
    GRAND_CHAPTERS,
    grandBackdropHtml,
    grandOpeningHtml,
    grandGatherHtml,
    grandHeroesHtml,
    grandQuestYearHtml,
    grandProdigyRoadHtml,
    grandWondersHtml,
    grandGuildPillarsHtml,
    grandChampionHtml,
    grandHallHtml,
    grandFarewellHtml
} from './grandCeremonyView.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

const $ = (id) => document.getElementById(id);

/**
 * Everything the ceremony reads from outside the app state. The preview page
 * (grand-ceremony-preview.html) swaps these for pretend data; the app never does.
 */
export const grandCeremonyIo = {
    now: () => new Date(),
    fetchMonth: async (m, schoolYearKey) => {
        const { fetchMonthlyHistory } = await import('../state.js');
        const opts = schoolYearKey ? { schoolYearKey } : {};
        const [logs, archived] = await Promise.all([
            fetchLogsForMonth(m.year, m.month, opts).catch(() => []),
            fetchMonthlyHistory(m.monthKey, opts).catch(() => ({}))
        ]);
        return { logs: logs || [], archived: archived || {} };
    },
    /** The whole year's Fortune's Wheel log for these classes (state only keeps the latest 20 spins). */
    fetchWheelLog: async (classIds) => {
        const { getYearWheelLog } = await import('../db/actions/guilds.js');
        return getYearWheelLog(classIds);
    },
    save: null
};

let ceremony = freshCeremony();
let fx = null;
let timeline = null;
let anthem = null;
let anthemRaf = 0;
let frozenAnimations = [];
let cardTimer = 0;
let starting = false;

function freshCeremony() {
    return {
        active: false,
        phase: 'opening',
        participatingClasses: [],
        ceremonyDate: null,
        data: null,
        dataPromise: null,
        revealQueue: [],
        music: 'grand_theme',
        saved: false
    };
}

// ============================================================== SCHOOL YEAR

function getCeremonyYearKey() {
    return state.getActiveSchoolYearKey?.() || null;
}

function getYearLabel() {
    const key = getCeremonyYearKey();
    if (key) return String(key).replace(/-/g, '–');
    const now = grandCeremonyIo.now();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}–${startYear + 1}`;
}

/** Months of the active school year up to (and including) this month. */
function getYearMonthsSoFar() {
    const now = grandCeremonyIo.now();
    const years = state.get('allSchoolYears') || [];
    const yearData = years.find((item) => item.id === getCeremonyYearKey());
    let start = null;
    let end = new Date(now.getFullYear(), now.getMonth(), 1);
    if (yearData?.startsAt) {
        const parsed = new Date(`${yearData.startsAt}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) start = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
    if (yearData?.endsAt) {
        const parsed = new Date(`${yearData.endsAt}T12:00:00`);
        if (!Number.isNaN(parsed.getTime()) && parsed < end) end = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
    if (!start) start = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
    const months = [];
    for (let d = new Date(start); d <= end && months.length < 13; d.setMonth(d.getMonth() + 1)) {
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1, monthIndex: d.getMonth(), monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    }
    return months;
}

// ============================================================== DATA

/** One fetch per month of the year, shared by the Quest Road and the Prodigy Road. */
async function gatherYearLogs(months) {
    const schoolYearKey = getCeremonyYearKey();
    return Promise.all(months.map(async (m) => {
        const got = await grandCeremonyIo.fetchMonth(m, schoolYearKey).catch(() => ({}));
        return { ...m, logs: got?.logs || [], archived: got?.archived || {} };
    }));
}

function gatherHeroes(classIds) {
    const classSet = new Set(classIds);
    const classes = state.get('allSchoolClasses') || [];
    const scores = new Map((state.get('allStudentScores') || []).map((sc) => [sc.id, sc]));
    const heroes = (state.get('allStudents') || [])
        .filter((s) => classSet.has(s.classId))
        .map((s) => {
            const wins = getYearScopedHeroOfDayWinsFromAppState(scores.get(s.id) || {}, state);
            const cls = classes.find((c) => c.id === s.classId);
            return { id: s.id, name: s.name, avatar: s.avatar || null, wins, className: classIds.length > 1 ? cls?.name || '' : '' };
        })
        .filter((h) => h.wins > 0)
        .sort((a, b) => b.wins - a.wins || String(a.name).localeCompare(String(b.name)));
    return { top: heroes.slice(0, 7), totalWins: heroes.reduce((sum, h) => sum + h.wins, 0) };
}

async function gatherQuestYear(classIds, monthsWithLogs) {
    let ranks = null;
    try {
        const [core, crest] = await Promise.all([import('./questRanksCore.mjs'), import('./questRankCrest.mjs')]);
        ranks = { core, crest };
    } catch (_) { /* ranks are a nice extra */ }
    const classes = (state.get('allSchoolClasses') || []).filter((c) => classIds.includes(c.id));
    const students = state.get('allStudents') || [];
    const holidays = state.get('schoolHolidayRanges');
    const overrides = state.get('allScheduleOverrides');
    return classes.map((c) => {
        const ids = new Set(students.filter((s) => s.classId === c.id).map((s) => s.id));
        const studentCount = ids.size;
        const months = monthsWithLogs.map((m) => {
            const fromLogs = m.logs.filter((log) => log.classId === c.id).reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
            const fromArchive = Object.keys(m.archived).filter((id) => ids.has(id)).reduce((sum, id) => sum + (Number(m.archived[id]) || 0), 0);
            const bonus = Number(c.teamQuestBonuses?.[m.monthKey]) || 0;
            const stars = Math.round(Math.max(fromLogs, fromArchive) + bonus);
            let goal = 0;
            try {
                goal = studentCount ? utils.calculateMonthlyClassGoalForDate(c, studentCount, holidays, overrides, new Date(m.year, m.monthIndex, 15)) : 0;
            } catch (_) { goal = 0; }
            const crossed = Boolean(c.portalCrossings?.[m.monthKey]);
            return { monthKey: m.monthKey, stars, goalMet: crossed || (goal > 0 && stars >= goal) };
        });
        const totalStars = months.reduce((sum, m) => sum + m.stars, 0);
        const goalsMet = months.filter((m) => m.goalMet).length;
        let rank = null;
        let rankCrest = '';
        if (ranks) {
            try {
                const level = ranks.core.displayLevelOf(c.difficultyLevel);
                rank = ranks.core.rankForLevel(level);
                rankCrest = ranks.crest.rankCrestSvg(level, { className: 'grd-quest__crest' });
            } catch (_) { rank = null; }
        }
        const crossings = Object.keys(c.portalCrossings || {}).length;
        return { id: c.id, name: c.name, logo: c.logo || '📚', league: c.questLevel || '', months, totalStars, goalsMet, rank, rankCrest, crossings };
    });
}

async function gatherProdigyRoad(classIds, monthsWithLogs) {
    const { buildProdigyMonthOutcome } = await import('../ui/modals/rankings.js');
    const students = state.get('allStudents') || [];
    const written = state.get('allWrittenScores') || [];
    const now = grandCeremonyIo.now();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const completed = monthsWithLogs.filter((m) => m.monthKey < currentKey);
    const winCounts = new Map();
    const months = completed.map((m) => {
        const winners = [];
        classIds.forEach((classId) => {
            const classStudents = students.filter((s) => s.classId === classId);
            if (!classStudents.length) return;
            const classLogs = m.logs.filter((log) => log.classId === classId);
            const archived = Object.fromEntries(Object.entries(m.archived).filter(([id]) => classStudents.some((s) => s.id === id)));
            const outcome = buildProdigyMonthOutcome(classStudents, classLogs, written.filter((w) => w.classId === classId), m.year, m.monthIndex, archived);
            (outcome.winners || []).forEach((w) => {
                winners.push({ id: w.id, name: w.name, avatar: w.avatar || null });
                winCounts.set(w.id, (winCounts.get(w.id) || 0) + 1);
            });
        });
        return { monthKey: m.monthKey, winners };
    });
    const mostCount = Math.max(0, ...winCounts.values());
    const mostCrowned = [...winCounts.entries()]
        .filter(([, n]) => n === mostCount)
        .map(([id]) => students.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar || null }));
    return { months, mostCrowned, mostCount, totalCrowns: [...winCounts.values()].reduce((a, b) => a + b, 0) };
}

async function gatherWheel(classIds) {
    let entries = null;
    try {
        entries = await grandCeremonyIo.fetchWheelLog(classIds);
    } catch (error) {
        console.warn('Grand ceremony: full Wheel log unavailable, using the recent spins', error);
    }
    if (!Array.isArray(entries)) entries = state.get('fortuneWheelLog') || [];
    return wheelYearSummary(entries, classIds);
}

async function gatherFamiliars(classIds) {
    const classSet = new Set(classIds);
    const students = (state.get('allStudents') || []).filter((s) => classSet.has(s.classId));
    const scores = new Map((state.get('allStudentScores') || []).map((sc) => [sc.id, sc]));
    const result = { totalHatched: 0, totalEggs: 0, finalForm: 0, highestForm: 0, mostAdvanced: [] };
    let progression = null;
    try {
        progression = await import('./familiarProgression.mjs');
    } catch (_) { /* optional */ }
    const maxLevel = progression?.FAMILIAR_MAX_LEVEL || 5;
    students.forEach((s) => {
        const score = scores.get(s.id);
        const familiar = score?.familiar;
        if (!familiar) return;
        if (familiar.state === 'egg') {
            result.totalEggs += 1;
            return;
        }
        if (familiar.state !== 'alive') return;
        result.totalHatched += 1;
        let level = Number(familiar.level) || 1;
        try {
            if (progression) level = Math.max(level, progression.getUnlockedFamiliarLevel(familiar, Number(score?.totalStars) || 0));
        } catch (_) { /* keep the stored level */ }
        result.highestForm = Math.max(result.highestForm, Math.min(maxLevel, level));
        if (level >= maxLevel) {
            result.finalForm += 1;
            result.mostAdvanced.push({ id: s.id, name: s.name });
        }
    });
    return result;
}

function membersByGuild() {
    const byGuild = Object.fromEntries(GUILD_IDS.map((gid) => [gid, []]));
    (state.get('allStudents') || []).forEach((s) => { if (byGuild[s.guildId]) byGuild[s.guildId].push(s.id); });
    return byGuild;
}

/** The Crown Race as it ends tonight, plus each guild's brightest heroes from the classes on stage. */
function gatherGuilds(classIds) {
    const classSet = new Set(classIds);
    const allGuildScores = state.get('allGuildScores') || {};
    const schoolYearKey = getCeremonyYearKey();
    const students = (state.get('allStudents') || []).filter((s) => classSet.has(s.classId));
    const scores = new Map((state.get('allStudentScores') || []).map((sc) => [sc.id, sc]));
    const rows = finalCrownStandings({
        allGuildScores,
        membersByGuild: membersByGuild(),
        guildIds: GUILD_IDS,
        schoolYearKey,
        firstKey: getFirstCrownChapter(schoolYearKey),
        now: grandCeremonyIo.now()
    });
    return rows.map((row) => {
        const guild = getGuildById(row.guildId) || GUILDS[row.guildId] || {};
        const doc_ = allGuildScores[row.guildId] || {};
        const yearGlory = doc_.memberGloryYear && doc_.memberGloryYear === doc_.activeSchoolYearKey ? (doc_.memberGlory || {}) : null;
        const heroes = students
            .filter((s) => s.guildId === row.guildId)
            .map((s) => {
                const totalStars = Number(scores.get(s.id)?.totalStars) || 0;
                return { id: s.id, name: s.name, avatar: s.avatar || null, totalStars, glory: yearGlory ? Number(yearGlory[s.id]) || 0 : totalStars * 2 };
            })
            .sort((a, b) => b.glory - a.glory || b.totalStars - a.totalStars || String(a.name).localeCompare(String(b.name)))
            .slice(0, 4);
        return { ...row, guildName: guild.name || row.guildId, guild, heroes };
    });
}

async function gatherAllData(classIds) {
    const months = getYearMonthsSoFar();
    const monthsWithLogs = await gatherYearLogs(months);
    const [prodigies, familiars, questYear, wheel] = await Promise.all([
        gatherProdigyRoad(classIds, monthsWithLogs).catch((error) => {
            console.warn('Grand ceremony: prodigy road unavailable', error);
            return { months: [], mostCrowned: [], mostCount: 0, totalCrowns: 0 };
        }),
        gatherFamiliars(classIds).catch(() => ({ totalHatched: 0, totalEggs: 0, finalForm: 0, highestForm: 0, mostAdvanced: [] })),
        gatherQuestYear(classIds, monthsWithLogs),
        gatherWheel(classIds).catch(() => wheelYearSummary([], classIds))
    ]);
    const classes = (state.get('allSchoolClasses') || []).filter((c) => classIds.includes(c.id));
    let guilds = [];
    try {
        guilds = gatherGuilds(classIds);
    } catch (error) {
        console.error('Grand ceremony: Crown Race standings failed', error);
    }
    return {
        heroes: gatherHeroes(classIds),
        questYear,
        prodigies,
        wheel,
        familiars,
        raids: raidYearSummary(classes),
        guilds,
        chronicles: await import('./guildChronicleCore.js').then((m) => m.yearChronicles()).catch(() => [])
    };
}

// ============================================================== SHELL

function screenEl() {
    return $('grand-guild-ceremony-screen');
}

function freezeAppBackdrop(screen) {
    if (frozenAnimations.length || typeof document.getAnimations !== 'function') return;
    frozenAnimations = document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        if (animation.effect?.getTiming?.().iterations !== Infinity) return false;
        const target = animation.effect?.target;
        return Boolean(target) && !screen.contains(target);
    });
    frozenAnimations.forEach((animation) => animation.pause());
}

function resumeAppBackdrop() {
    const frozen = frozenAnimations;
    frozenAnimations = [];
    frozen.forEach((animation) => { if (animation.playState === 'paused') animation.play(); });
}

function replay(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

/** Scene keys that belong to a chapter of the ribbon. */
const SCENE_CHAPTER = { champion: 'guilds', story: 'guilds', farewell: 'end' };

function setScene(scene, { realm } = {}) {
    const screen = screenEl();
    if (!screen) return;
    screen.dataset.scene = scene;
    if (realm) screen.dataset.realm = realm;
    screen.classList.remove('is-drumroll', 'is-revealed');
    const chapterKey = SCENE_CHAPTER[scene] || scene;
    const chapterIndex = chapterKey === 'end' ? GRAND_CHAPTERS.length : GRAND_CHAPTERS.findIndex((c) => c.key === chapterKey);
    document.querySelectorAll('#grd-chapters li').forEach((li, i) => {
        li.classList.toggle('is-done', chapterIndex > i);
        li.classList.toggle('is-on', chapterIndex === i);
    });
    const ribbon = $('grd-chapters');
    if (ribbon) ribbon.style.setProperty('--done', String(Math.max(0, Math.min(GRAND_CHAPTERS.length - 1, chapterIndex)) / (GRAND_CHAPTERS.length - 1)));
}

function setHeading(kicker = '', title = '') {
    const k = $('grd-kicker');
    const t = $('grd-title');
    if (k) k.textContent = kicker;
    if (t) t.textContent = title;
    const header = $('grd-header');
    if (header) {
        header.classList.toggle('is-empty', !kicker && !title);
        replay(header, 'is-fresh');
    }
}

function chapterHeading(key, title) {
    const chapter = GRAND_CHAPTERS.find((c) => c.key === key);
    setHeading(chapter ? `Chapter ${chapter.numeral} · ${chapter.title}` : '', title);
}

let heraldToken = 0;
function setHerald(text = '') {
    const box = $('grd-herald');
    const p = $('grd-herald-text');
    if (!box || !p) return;
    p.textContent = text;
    box.classList.toggle('is-on', Boolean(text));
    if (text) replay(box, 'is-fresh');
}

function setAction(label, handler, { disabled = false } = {}) {
    const btn = $('grd-action-btn');
    if (!btn) return;
    const labelEl = btn.querySelector('.grd-action__label');
    if (labelEl) labelEl.textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => {
        if (finishTimeline()) return;
        handler?.();
    };
    replay(btn, 'is-fresh');
}

/**
 * The chapter title card: a numeral, the chapter's name and its line sweep across the stage for
 * about 1.6s. Returns how long the scene below should wait before it starts revealing.
 */
function playChapterCard(key) {
    const chapter = GRAND_CHAPTERS.find((c) => c.key === key);
    const card = $('grd-card');
    if (!chapter || !card) return 0;
    $('grd-card-numeral').textContent = chapter.numeral;
    $('grd-card-kicker').textContent = `Chapter ${chapter.numeral}`;
    $('grd-card-title').textContent = chapter.title;
    $('grd-card-line').textContent = chapter.line || '';
    clearTimeout(cardTimer);
    replay(card, 'is-on');
    playCeremonySfx('grand_chapter');
    cardTimer = setTimeout(() => card.classList.remove('is-on'), 1750);
    return 1250;
}

function hideChapterCard() {
    clearTimeout(cardTimer);
    $('grd-card')?.classList.remove('is-on');
}

function runTimeline(steps, onDone) {
    cancelTimeline();
    const tl = { steps: steps.map((s) => ({ ...s, done: false })), timers: [], onDone };
    timeline = tl;
    const settle = () => {
        if (tl.steps.every((s) => s.done)) {
            if (timeline === tl) timeline = null;
            tl.onDone?.();
        }
    };
    tl.steps.forEach((step) => {
        tl.timers.push(setTimeout(() => {
            if (timeline !== tl || step.done) return;
            step.done = true;
            try { step.run(false); } catch (error) { console.warn('Grand ceremony step failed', error); }
            settle();
        }, step.at));
    });
    if (!tl.steps.length) settle();
}

/** Jumps the running sequence to its end. True when there was one to finish. */
function finishTimeline() {
    const tl = timeline;
    if (!tl) return false;
    timeline = null;
    tl.timers.forEach(clearTimeout);
    hideChapterCard();
    const screen = screenEl();
    screen?.classList.add('is-skipping');
    tl.steps.filter((s) => !s.done).forEach((s) => {
        s.done = true;
        try { s.run(true); } catch (error) { console.warn('Grand ceremony step failed', error); }
    });
    tl.onDone?.();
    requestAnimationFrame(() => requestAnimationFrame(() => screen?.classList.remove('is-skipping')));
    return true;
}

function cancelTimeline() {
    if (!timeline) return;
    timeline.timers.forEach(clearTimeout);
    timeline = null;
}

function countUp(el, { fast = false, duration = 1100 } = {}) {
    if (!el) return;
    const target = Number(el.dataset.count) || 0;
    if (fast || target <= 0 || typeof requestAnimationFrame !== 'function') {
        el.textContent = String(target);
        return;
    }
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function countAll(root, fast) {
    root?.querySelectorAll('.grd-count').forEach((el) => countUp(el, { fast }));
}

function fxPoint(el) {
    return fx?.pointOf(el) || { x: 0, y: 0 };
}

function guildColors(guild) {
    return [guild?.primary || '#fbbf24', guild?.secondary || '#f59e0b', guild?.glow || '#fde68a', '#ffffff'];
}

function music(key, opts) {
    ceremony.music = key;
    playCeremonyTrack(key, opts);
}

function handleKeys(e) {
    if (!ceremony.active) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (e.repeat) return;
        const btn = $('grd-action-btn');
        if (btn && !btn.disabled) btn.click();
        else finishTimeline();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCeremony();
    } else if (e.key === 'm' || e.key === 'M') {
        $('grd-sound-btn')?.click();
    }
}

// ============================================================== ACTIVATION

/** Class ids whose school year ends today (the teacher's own classes). */
export function checkCeremonyActivation() {
    const today = utils.getTodayDateString();
    const teacherSettings = state.get('teacherSettings') || {};
    const classEndDates = teacherSettings.schoolYearSettings?.classEndDates || {};
    const myClassIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    return Object.entries(classEndDates)
        .filter(([classId, endDate]) => myClassIds.has(classId) && utils.datesMatch(endDate, today))
        .map(([classId]) => classId);
}

/** Show the Home buttons on the last day of a class's school year. Pro+ only (guilds). */
export function updateCeremonyButtons() {
    const homeBtn = document.getElementById('grand-guild-ceremony-btn-home');
    const classBtn = document.getElementById('grand-guild-ceremony-btn-class');
    if (!canUseFeature('guilds')) {
        [homeBtn, classBtn].forEach((btn) => btn?.classList.add('hidden'));
        return;
    }
    const participating = checkCeremonyActivation();
    homeBtn?.classList.toggle('hidden', participating.length === 0);
    const currentClassId = state.get('globalSelectedClassId');
    classBtn?.classList.toggle('hidden', !(currentClassId && participating.includes(currentClassId)));
}

// ============================================================== START / CLOSE

export async function startGrandGuildCeremony(classIds = null) {
    if (ceremony.active) return;
    if (!canUseFeature('guilds')) {
        const { showUpgradePrompt } = await import('../utils/upgradePrompt.js');
        const { getUpgradeMessage } = await import('../config/tiers/features.js');
        showUpgradePrompt('Pro', { message: getUpgradeMessage('Pro', 'default') });
        return;
    }
    const participatingClasses = classIds || checkCeremonyActivation();
    if (!participatingClasses.length) return;
    const screen = screenEl();
    if (!screen) return;
    if (starting) return;
    starting = true;
    try {
        await import('../styles/ceremony_grand.css');
    } catch (error) {
        console.warn('Grand ceremony styles failed to load', error);
    } finally {
        starting = false;
    }
    if (ceremony.active) return;

    ceremony = freshCeremony();
    ceremony.active = true;
    ceremony.participatingClasses = participatingClasses;
    ceremony.ceremonyDate = utils.getTodayDateString();
    loadData();

    const guilds = GUILD_IDS.map((id) => GUILDS[id]).filter(Boolean);
    const backdrop = $('grd-backdrop');
    if (backdrop && !backdrop.dataset.ready) {
        backdrop.innerHTML = grandBackdropHtml(guilds);
        backdrop.dataset.ready = '1';
    }
    backdrop?.querySelectorAll('.grd-banner').forEach((b) => b.classList.remove('is-up'));
    const chapters = $('grd-chapters');
    if (chapters) chapters.innerHTML = GRAND_CHAPTERS.map((c) => `<li title="Chapter ${c.numeral} · ${c.title}"><i class="fas ${c.icon}" aria-hidden="true"></i><span>${c.numeral}</span></li>`).join('');

    screen.classList.remove('hidden', 'is-drumroll', 'is-revealed', 'is-flashing', 'is-raised');
    document.documentElement.classList.add('cer-open');
    const host = $('grd-fx-host');
    if (host && !fx) fx = createCeremonyFx(host, { className: 'grd-fx' });
    else fx?.resize();
    screen.dataset.tier = fx?.tier || 'lite';
    freezeAppBackdrop(screen);
    requestAnimationFrame(() => screen.classList.add('is-open'));

    const soundIcon = $('grd-sound-icon');
    const paintSound = () => {
        const off = isCeremonyAudioMuted();
        if (soundIcon) soundIcon.className = off ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
        $('grd-sound-btn')?.setAttribute('aria-pressed', off ? 'true' : 'false');
    };
    $('grd-sound-btn').onclick = () => {
        toggleCeremonyAudioMute();
        paintSound();
        if (isCeremonyAudioMuted()) stopAnthem();
        else playCeremonyTrack(ceremony.music || 'grand_theme');
    };
    paintSound();
    $('grd-close-btn').onclick = closeCeremony;
    window.removeEventListener('keydown', handleKeys);
    window.addEventListener('keydown', handleKeys);

    ceremony.music = 'grand_theme';
    prepareCeremonyAudio('grand').then(() => {
        if (!ceremony.active || ceremony.phase !== 'opening') return;
        playCeremonyTrack('grand_theme', { fade: 2.5 });
        playCeremonySfx('gong');
    });

    const classes = (state.get('allSchoolClasses') || []).filter((c) => participatingClasses.includes(c.id));
    setScene('opening', { realm: 'dusk' });
    $('grd-stage').innerHTML = grandOpeningHtml({ yearLabel: getYearLabel(), classes, guilds });
    setHeading('', '');
    setHerald('');
    setAction('Begin the Festival', advance);
    screen.classList.remove('is-raised');
    const opening = $('grd-stage').querySelector('.grd-opening');
    const banners = [...screen.querySelectorAll('.grd-banner')];
    runTimeline([
        { at: 150, run: () => screen.classList.add('is-raised') },
        { at: 500, run: () => opening?.classList.add('is-on') },
        ...banners.map((b, i) => ({ at: 900 + i * 260, run: (fast) => {
            b.classList.add('is-up');
            if (!fast) playCeremonySfx('chime');
        } })),
        { at: 2100, run: (fast) => {
            setHerald('The lanterns are lit. Welcome, heroes, to the end-of-year festival!');
            if (fast) return;
            const p = fxPoint(opening?.querySelector('.grd-orbit__heart'));
            fx?.burst(p.x, p.y, { colors: ['#fde68a', '#fb923c', '#f9a8d4', '#ffffff'], count: 60, speed: 220, ring: true });
            fx?.embers({ count: 30, duration: 4000, colors: ['#fde68a', '#fb923c', '#f9a8d4'] });
        } },
        { at: 2800, run: (fast) => { if (!fast) fx?.fireworks({ count: 3, spread: 1600, colors: ['#fde68a', '#f9a8d4', '#a5f3fc'] }); } }
    ]);
    herald('grand_opening', { classCount: participatingClasses.length });
}

function loadData() {
    ceremony.dataPromise = gatherAllData(ceremony.participatingClasses).then((data) => {
        ceremony.data = data;
        return data;
    }).catch((error) => {
        console.error('Grand ceremony data failed', error);
        return null;
    });
}

function closeCeremony() {
    if (!ceremony.active && screenEl()?.classList.contains('hidden')) return;
    ceremony.active = false;
    heraldToken += 1;
    cancelTimeline();
    hideChapterCard();
    stopAnthem();
    window.removeEventListener('keydown', handleKeys);
    stopCeremonyAudio({ fade: 0.6 });
    fx?.clear();
    const screen = screenEl();
    if (screen) {
        screen.classList.remove('is-open', 'is-drumroll', 'is-revealed', 'is-flashing', 'is-raised');
        screen.classList.add('hidden');
    }
    document.documentElement.classList.remove('cer-open');
    resumeAppBackdrop();
    updateCeremonyButtons();
}

// ============================================================== CHAPTERS

async function advance() {
    if (!ceremony.active) return;
    if (!ceremony.data) {
        setScene('gather');
        $('grd-stage').innerHTML = grandGatherHtml();
        setHeading('', '');
        setHerald('');
        setAction("Gathering the year's tales…", null, { disabled: true });
        await ceremony.dataPromise;
        if (!ceremony.active) return;
        if (!ceremony.data) {
            setHerald("The year's scrolls could not be read. Check the connection and try again.");
            setAction('Try again', () => {
                loadData();
                advance();
            });
            return;
        }
    }
    const next = {
        opening: renderHeroes,
        heroes: renderQuestYear,
        quest: renderProdigyRoad,
        prodigies: hasWonders() ? renderWonders : (hasStory() ? renderStory : renderGuildPillars),
        wonders: hasStory() ? renderStory : renderGuildPillars,
        story: renderGuildPillars,
        'guilds-reveal': revealNextGuild,
        'guilds-crown': renderChampion,
        champion: renderHall,
        hall: renderFarewell
    }[ceremony.phase];
    next?.();
}

function renderHeroes() {
    ceremony.phase = 'heroes';
    setScene('heroes', { realm: 'dusk' });
    const { top, totalWins } = ceremony.data.heroes;
    const stage = $('grd-stage');
    stage.innerHTML = grandHeroesHtml(top, { totalWins });
    chapterHeading('heroes', 'Heroes of the Day');
    setHerald('');
    const t0 = playChapterCard('heroes');
    const lanterns = [...stage.querySelectorAll('.grd-hero')].sort((a, b) => Number(b.style.getPropertyValue('--i')) - Number(a.style.getPropertyValue('--i')));
    const steps = lanterns.map((li, i) => ({ at: t0 + 200 + i * 420, run: (fast) => {
        li.classList.add('is-lit');
        countAll(li, fast);
        if (!fast) {
            const isTop = li.classList.contains('grd-hero--top');
            playCeremonySfx(isTop ? 'reveal' : 'chime');
            const p = fxPoint(li.querySelector('.grd-hero__lantern'));
            fx?.burst(p.x, p.y, { colors: ['#fde68a', '#fb923c', '#ffffff'], count: isTop ? 80 : 26, speed: isTop ? 240 : 180, gravity: 40, ring: isTop });
        }
    } }));
    steps.push({ at: t0 + 300 + lanterns.length * 420, run: (fast) => {
        countAll(stage.querySelector('.grd-heroes__total'), fast);
        setHerald(top[0] ? `${top[0].name} was Hero of the Day ${top[0].wins} ${top[0].wins === 1 ? 'time' : 'times'}!` : 'Every day had its hero!');
        if (!fast) herald('hero_gallery', { top: top[0], totalWins });
    } });
    runTimeline(steps);
    setAction('On to the Quest Road', advance);
}

function renderQuestYear() {
    ceremony.phase = 'quest';
    setScene('quest', { realm: 'dusk' });
    const stage = $('grd-stage');
    const classes = ceremony.data.questYear;
    stage.innerHTML = grandQuestYearHtml(classes);
    chapterHeading('quest', 'A Year of Team Quests');
    setHerald('');
    const t0 = playChapterCard('quest');
    const cards = [...stage.querySelectorAll('.grd-quest')];
    const gap = cards.length > 6 ? 220 : 420;
    runTimeline([
        ...cards.map((card, i) => ({ at: t0 + 150 + i * gap, run: (fast) => {
            card.classList.add('is-raised');
            countAll(card, fast);
            if (!fast) playCeremonyTally({ seconds: 0.9, steps: 8 });
        } })),
        { at: t0 + 300 + cards.length * gap, run: () => setHerald('Month by month, star by star, every class walked its own road.') }
    ]);
    setAction('Walk the Prodigy Road', advance);
}

function renderProdigyRoad() {
    ceremony.phase = 'prodigies';
    setScene('prodigies', { realm: 'dusk' });
    const stage = $('grd-stage');
    const road = ceremony.data.prodigies;
    stage.innerHTML = grandProdigyRoadHtml(road.months, { mostCrowned: road.mostCrowned, mostCount: road.mostCount });
    chapterHeading('prodigies', 'Every Prodigy of the Month');
    setHerald('');
    const t0 = playChapterCard('prodigies');
    const tiles = [...stage.querySelectorAll('.grd-month')];
    const steps = tiles.map((tile, i) => ({ at: t0 + 150 + i * 280, run: (fast) => {
        tile.classList.add('is-shown');
        if (!fast) playCeremonySfx('grand_medal');
    } }));
    const plaque = stage.querySelector('.grd-crowned');
    steps.push({ at: t0 + 500 + tiles.length * 280, run: (fast) => {
        setHerald(road.months.length ? 'One Prodigy for every month of the year.' : '');
        if (!plaque) return;
        plaque.classList.add('is-shown');
        if (!fast) {
            playCeremonySfx('gold');
            const p = fxPoint(plaque);
            fx?.burst(p.x, p.y, { colors: ['#fde68a', '#fbbf24', '#ffffff'], count: 90, speed: 260, ring: true });
            herald('prodigy_timeline', { mostCrowned: road.mostCrowned, mostCount: road.mostCount });
        }
    } });
    runTimeline(steps);
    setAction(hasWonders() ? 'Wonders of the Year' : 'The Guild Crowning', advance);
}

function wonderTiles() {
    const { wheel, familiars, raids } = ceremony.data;
    const tiles = [];
    if (wheel.totalSpins > 0) {
        tiles.push({ tone: 'wheel', icon: '🎡', value: wheel.totalSpins, label: "Fortune's Wheel spins" });
        if (wheel.omens > 0) tiles.push({ tone: 'omen', icon: '🌠', value: wheel.omens, label: wheel.omens === 1 ? 'Omen in the sky' : 'Omens in the sky', note: 'the rarest fates of all' });
        if (wheel.braved > 0) tiles.push({ tone: 'storm', icon: '⛈️', value: wheel.braved, label: wheel.braved === 1 ? 'Storm braved' : 'Storms braved' });
        const lucky = wheel.luckiestGuild ? getGuildById(wheel.luckiestGuild.guildId) : null;
        if (lucky) tiles.push({ tone: 'luck', crest: lucky, value: lucky.name, label: 'Luckiest guild at the Wheel', note: `+${Math.round(wheel.luckiestGuild.totalGlory)} Glory from Fortune` });
        if (wheel.rarestFind) {
            const finder = getGuildById(wheel.rarestFind.guildId);
            tiles.push({ tone: 'find', icon: String(wheel.rarestFind.label).split(' ')[0] || '✨', value: String(wheel.rarestFind.label).replace(/^\S+\s*/, '') || 'A rare find', label: 'Rarest find of the year', note: finder ? `found by ${finder.name}` : '' });
        }
    }
    if (familiars.totalHatched > 0 || familiars.totalEggs > 0) {
        tiles.push({ tone: 'hatch', icon: '🥚', value: familiars.totalHatched, label: 'Familiars hatched', note: familiars.totalEggs ? `${familiars.totalEggs} still in their eggs` : '' });
        if (familiars.finalForm > 0) tiles.push({ tone: 'legend', icon: '🐉', value: familiars.finalForm, label: 'Familiars at their final form' });
        else if (familiars.highestForm > 1) tiles.push({ tone: 'legend', icon: '🐉', value: `Form ${familiars.highestForm}`, label: 'Highest familiar form' });
    }
    if (raids.victories > 0) tiles.push({ tone: 'raid', icon: '🦌', value: raids.victories, label: raids.victories === 1 ? 'Realm Raid won' : 'Realm Raids won', note: raids.legendary ? `${raids.legendary} legendary` : 'Eldhorn bowed' });
    return tiles;
}

function hasWonders() {
    return Boolean(ceremony.data && wonderTiles().length);
}

function renderWonders() {
    ceremony.phase = 'wonders';
    setScene('wonders', { realm: 'dusk' });
    const stage = $('grd-stage');
    const { wheel, familiars } = ceremony.data;
    stage.innerHTML = grandWondersHtml(wonderTiles());
    chapterHeading('wonders', 'Fate, Friends and Battles');
    setHerald('');
    const t0 = playChapterCard('wonders');
    const tiles = [...stage.querySelectorAll('.grd-wonder')];
    runTimeline([
        ...tiles.map((tile, i) => ({ at: t0 + 150 + i * 360, run: (fast) => {
            tile.classList.add('is-shown');
            countAll(tile, fast);
            if (!fast) playCeremonySfx('pop');
        } })),
        { at: t0 + 300 + tiles.length * 360, run: (fast) => {
            setHerald('Fate spun, eggs cracked, and new friends were born.');
            if (!fast) herald('wonders', { wheel, familiars });
        } }
    ]);
    setAction(hasStory() ? 'The Story of the Year' : 'The Guild Crowning', advance);
}

function hasStory() {
    return Boolean(ceremony.data?.chronicles?.length);
}

/** The Story of the Year: each sealed Chapter's chronicle, read one stanza after another. */
async function renderStory() {
    ceremony.phase = 'story';
    let view;
    try { view = await import('./guildChronicleView.js'); } catch (error) { console.warn('Story of the Year unavailable:', error); renderGuildPillars(); return; }
    if (!ceremony.active) return;
    setScene('story', { realm: 'night' });
    music('grand_story', { fade: 1.6 });
    const stage = $('grd-stage');
    const chronicles = ceremony.data.chronicles;
    stage.innerHTML = view.grandStoryHtml(chronicles);
    chapterHeading('guilds', 'The Story of the Year');
    setHerald('');
    const t0 = playChapterCard('guilds');
    const paper = stage.querySelector('.grd-story__paper');
    const stanzas = [...stage.querySelectorAll('.grd-story__stanza')];
    const gap = stanzas.length > 6 ? 2000 : 2600;
    runTimeline(stanzas.map((el, i) => ({ at: t0 + 300 + i * gap, run: (fast) => {
        el.classList.add('is-read');
        if (fast) return;
        playCeremonySfx('chime');
        if (paper) paper.scrollTo?.({ top: Math.max(0, el.offsetTop - paper.clientHeight / 3), behavior: 'smooth' });
        setHerald(`${chronicles[i].month}: ${chronicles[i].lines[0]}`);
    } })), () => setHerald('And so the year was written, Chapter by Chapter.'));
    setAction('The Guild Crowning', advance);
}

function renderGuildPillars() {
    ceremony.phase = 'guilds-reveal';
    const rows = ceremony.data.guilds;
    if (!rows.length) {
        renderHall();
        return;
    }
    const fromStory = screenEl()?.dataset.scene === 'story';
    setScene('guilds', { realm: 'night' });
    const stage = $('grd-stage');
    const maxCrowns = Math.max(1, ...rows.map((r) => r.crowns));
    const display = GUILD_IDS.map((id) => rows.find((r) => r.guildId === id)).filter(Boolean);
    stage.innerHTML = grandGuildPillarsHtml(display, { maxCrowns });
    chapterHeading('guilds', 'Which guild wears the crown?');
    setHerald('');
    const t0 = fromStory ? 0 : playChapterCard('guilds');
    music('grand_suspense');
    // Reveal order: last place first, champion last.
    ceremony.revealQueue = rows.slice(1).map((r) => r.guildId).reverse();
    const pillars = stage.querySelector('.grd-pillars');
    runTimeline([
        { at: t0 + 120, run: (fast) => {
            pillars?.classList.add('is-rising');
            if (!fast) playCeremonySfx('gong');
        } },
        { at: t0 + 900, run: () => setHerald(`${rows.length} guilds. One crown. A whole year of Chapters decides.`) }
    ]);
    if (ceremony.revealQueue.length) setAction(`Reveal #${rows.length}`, advance);
    else setAction('Crown the Champions', crownChampion);
}

function revealPillar(pillar, { fast = false, champion = false } = {}) {
    if (!pillar) return;
    pillar.classList.add('is-revealed');
    if (champion) pillar.classList.add('is-champion');
    countAll(pillar.querySelector('.grd-pillar__value'), fast);
    const medals = [...pillar.querySelectorAll('.grd-medal')];
    if (fast) {
        medals.forEach((m) => m.classList.add('is-on'));
        return;
    }
    medals.forEach((m, i) => setTimeout(() => {
        if (!m.isConnected) return;
        m.classList.add('is-on');
        if (i % 2 === 0) playCeremonySfx('grand_medal');
    }, 350 + i * 90));
}

function revealNextGuild() {
    const id = ceremony.revealQueue?.shift();
    const stage = $('grd-stage');
    const pillar = stage.querySelector(`.grd-pillar[data-guild="${id}"]`);
    if (pillar) {
        revealPillar(pillar);
        playCeremonySfx('reveal');
        const guild = getGuildById(id);
        const row = ceremony.data.guilds.find((r) => r.guildId === id);
        const p = fxPoint(pillar.querySelector('.grd-pillar__crest'));
        fx?.burst(p.x, p.y, { colors: guildColors(guild), count: 60, speed: 220 });
        const place = ['', 'first', 'second', 'third', 'fourth'][Number(pillar.dataset.rank)] || `#${pillar.dataset.rank}`;
        setHerald(`${guild?.name || 'A guild'} takes ${place} place with ${row?.crowns ?? 0} Crowns!`);
    }
    if (ceremony.revealQueue.length) {
        const nextRank = ceremony.data.guilds.find((r) => r.guildId === ceremony.revealQueue[0])?.rank;
        setAction(`Reveal #${nextRank}`, advance);
    } else {
        setAction('Crown the Champions', crownChampion);
    }
}

function crownChampion() {
    const stage = $('grd-stage');
    const screen = screenEl();
    const champion = ceremony.data.guilds[0];
    const runnerUp = ceremony.data.guilds[1];
    const pillar = stage.querySelector(`.grd-pillar[data-guild="${champion.guildId}"]`);
    const others = [...stage.querySelectorAll('.grd-pillar:not(.is-revealed)')];
    setAction('Crowning…', null, { disabled: true });
    screen.classList.add('is-drumroll');
    stopCeremonyMusic({ fade: 0.4 });
    startCeremonyDrumroll(3.2);
    setHerald(others.length > 1 ? 'Which guild wears the crown…?' : 'The crown is ready…');
    const steps = [];
    [0, 420, 780, 1080, 1340, 1560, 1750, 1910, 2050, 2170, 2280, 2380, 2470, 2550, 2630, 2700, 2770, 2830, 2890, 2950, 3000, 3050].forEach((at, i) => {
        steps.push({ at, run: (fast) => {
            if (fast) return;
            others.forEach((el) => el.classList.remove('is-spot'));
            others[i % others.length]?.classList.add('is-spot');
        } });
    });
    steps.push({ at: 3250, run: (fast) => {
        stopCeremonyDrumroll({ crash: !fast });
        others.forEach((el) => el.classList.remove('is-spot'));
        screen.classList.remove('is-drumroll');
        screen.classList.add('is-revealed');
        revealPillar(pillar, { fast, champion: true });
        stage.querySelector('.grd-pillars')?.classList.add('is-crowned');
        setHeading('Guild Champions of the Year', champion.guild?.name || champion.guildName);
        setHerald(champion.tieBreak && runnerUp && runnerUp.crowns === champion.crowns
            ? `Level on ${champion.crowns} Crowns, and the year's Glory per hero crowns ${champion.guild?.name || 'them'}!`
            : `${champion.guild?.name || 'The champions'} wears the crown with ${champion.crowns} Crowns!`);
        if (!fast) {
            replay(screen, 'is-flashing');
            music('grand_crowning');
            playCeremonySfx('grand_crown');
            const colors = guildColors(champion.guild);
            const p = fxPoint(pillar?.querySelector('.grd-pillar__crest'));
            fx?.burst(p.x, p.y, { colors, count: 160, speed: 420, ring: true });
            fx?.fireworks({ count: 9, colors, spread: 3200 });
            fx?.confetti({ count: 170, colors, duration: 1600 });
            herald('guild_crowning', { guild: champion.guild });
        }
    } });
    ceremony.phase = 'guilds-crown';
    runTimeline(steps, () => setAction(champion.guild?.anthem ? `Hear the ${champion.guild?.name || 'champion'} anthem` : 'Raise the banner', advance));
}

function stopAnthem() {
    cancelAnimationFrame(anthemRaf);
    anthemRaf = 0;
    if (anthem) {
        try { anthem.pause(); } catch (_) { /* ignore */ }
        anthem.removeAttribute('src');
        anthem = null;
    }
}

function playAnthem(guild, lyricsEl) {
    stopAnthem();
    const lines = [...(lyricsEl?.querySelectorAll('li') || [])];
    if (!guild?.anthem || isCeremonyAudioMuted()) {
        lines.forEach((li) => li.classList.add('is-sung'));
        return;
    }
    stopCeremonyMusic({ fade: 0.8 });
    stopCeremonyOneShots({ fade: 1.2 });
    const audio = new Audio(guild.anthem);
    anthem = audio;
    audio.volume = 0.9;
    const tick = () => {
        if (anthem !== audio) return;
        const t = audio.currentTime;
        lines.forEach((li, i) => {
            const start = Number(li.dataset.time) || 0;
            const next = Number(lines[i + 1]?.dataset.time) || Infinity;
            const now = t >= start && t < next;
            if (now && !li.classList.contains('is-now')) li.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
            li.classList.toggle('is-now', now);
            if (t >= start) li.classList.add('is-sung');
        });
        if (!audio.ended) anthemRaf = requestAnimationFrame(tick);
    };
    audio.addEventListener('ended', () => {
        lines.forEach((li) => { li.classList.remove('is-now'); li.classList.add('is-sung'); });
        if (ceremony.active && anthem === audio && ceremony.phase === 'champion') music('grand_hall', { fade: 2 });
    });
    audio.play().then(tick).catch(() => lines.forEach((li) => li.classList.add('is-sung')));
}

function renderChampion() {
    ceremony.phase = 'champion';
    setScene('champion', { realm: 'night' });
    const champion = ceremony.data.guilds[0];
    const stage = $('grd-stage');
    stage.innerHTML = grandChampionHtml(champion, { heroes: champion.heroes });
    setHeading('', '');
    setHerald(champion.guild?.motto ? `“${champion.guild.motto}”` : '');
    const colors = guildColors(champion.guild);
    const scene = stage.querySelector('.grd-champion');
    runTimeline([
        { at: 60, run: (fast) => {
            scene?.classList.add('is-raised');
            if (!fast) playCeremonySfx('grand_unfurl');
        } },
        { at: 900, run: (fast) => {
            scene?.classList.add('is-crowned');
            if (fast) return;
            playCeremonySfx('grand_crown');
            const p = fxPoint(scene?.querySelector('.grd-champion__crest'));
            fx?.burst(p.x, p.y, { colors, count: 110, speed: 320, ring: true });
            fx?.fireworks({ count: 6, colors, spread: 4000 });
        } },
        { at: 1500, run: (fast) => { if (!fast) playAnthem(champion.guild, stage.querySelector('.grd-lyrics')); else stage.querySelectorAll('.grd-lyrics li').forEach((li) => li.classList.add('is-sung')); } }
    ]);
    setAction('Enter the Hall of Heroes', advance);
}

function renderHall() {
    stopAnthem();
    ceremony.phase = 'hall';
    setScene('hall', { realm: 'night' });
    music('grand_hall', { fade: 1.5 });
    const classSet = new Set(ceremony.participatingClasses);
    const students = (state.get('allStudents') || [])
        .filter((s) => classSet.has(s.classId))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar || null, guildColor: GUILDS[s.guildId]?.glow || '#fde68a' }));
    const d = ceremony.data;
    const stats = [
        { value: students.length, label: 'Heroes' },
        { value: d.questYear.reduce((sum, c) => sum + c.totalStars, 0), label: 'Stars this year' },
        { value: d.heroes.totalWins, label: 'Hero of the Day crowns' },
        { value: d.prodigies.totalCrowns, label: 'Prodigies of the Month' }
    ].filter((s, i) => i < 2 || s.value > 0);
    const stage = $('grd-stage');
    stage.innerHTML = grandHallHtml(students, { stats });
    chapterHeading('hall', 'Every hero, a star');
    setHerald('');
    const t0 = playChapterCard('hall');
    runTimeline([
        { at: t0 + 100, run: () => stage.querySelector('.grd-hall')?.classList.add('is-lit') },
        { at: t0 + 900, run: (fast) => { countAll(stage, fast); if (!fast) playCeremonySfx('gold'); } },
        { at: t0 + 1300, run: (fast) => {
            setHerald('Every name here helped write this year. Congratulations, heroes!');
            if (fast) return;
            fx?.fireworks({ count: 10, spread: 5000 });
            fx?.confetti({ count: 150, duration: 1800 });
            herald('hall_of_heroes', {});
        } }
    ]);
    setAction('Finish the Ceremony', advance);
}

function renderFarewell() {
    ceremony.phase = 'end';
    setScene('farewell', { realm: 'night' });
    const champion = ceremony.data?.guilds?.[0]?.guild || null;
    $('grd-stage').innerHTML = grandFarewellHtml({ yearLabel: getYearLabel(), champion });
    setHeading('Ceremony Complete', 'Until next year');
    setHerald('');
    fx?.fireworks({ count: 8, spread: 3600 });
    fx?.stars?.({ count: 50, duration: 3000 });
    playCeremonySfx('chime');
    saveCeremonyCompletion();
    setAction('Close', closeCeremony);
}

// ============================================================== SAVE

/** A small plain summary (no Sets, no student objects) so Firestore accepts it. */
function buildSummary() {
    const d = ceremony.data || {};
    return {
        heroesOfTheDay: (d.heroes?.top || []).slice(0, 3).map((h) => ({ studentId: h.id, wins: h.wins })),
        classStars: Object.fromEntries((d.questYear || []).map((c) => [c.id, c.totalStars])),
        prodigyCrowns: d.prodigies?.totalCrowns || 0,
        mostCrowned: (d.prodigies?.mostCrowned || []).map((p) => p.id),
        guildRanking: (d.guilds || []).map((g) => ({ guildId: g.guildId, rank: g.rank, crowns: g.crowns, chapterWins: g.chapterWins || [], unitySeals: g.unitySeals || 0 })),
        wheelSpins: d.wheel?.totalSpins || 0,
        wheelOmens: d.wheel?.omens || 0,
        familiarsHatched: d.familiars?.totalHatched || 0,
        realmRaidsWon: d.raids?.victories || 0
    };
}

async function saveCeremonyCompletion() {
    if (ceremony.saved) return;
    ceremony.saved = true;
    try {
        const record = {
            ceremonyDate: ceremony.ceremonyDate,
            participatingClasses: [...ceremony.participatingClasses],
            summary: buildSummary(),
            completedAt: new Date(),
            ceremonyVersion: 'midsummer-2027'
        };
        if (grandCeremonyIo.save) {
            await grandCeremonyIo.save(record);
            return;
        }
        const teacherId = state.get('currentUserId');
        if (!teacherId) return;
        const batch = writeBatch(db);
        batch.set(doc(db, `${PUBLIC_DATA_PATH}/teachers`, teacherId), {
            grandCeremonyHistory: { [ceremony.ceremonyDate]: record }
        }, { merge: true });
        ceremony.participatingClasses.forEach((classId) => {
            batch.set(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), {
                grandCeremonyHistory: { [ceremony.ceremonyDate]: { ...record, participatingClasses: [classId] } }
            }, { merge: true });
        });
        await batch.commit();
    } catch (error) {
        ceremony.saved = false;
        console.error('Error saving Grand Guild Ceremony:', error);
    }
}

// ============================================================== HERALD

const HERALD_FALLBACK = {
    grand_opening: 'Welcome, heroes, to the Grand Guild Ceremony!',
    hero_gallery: 'A hero every day. What a year!',
    prodigy_timeline: 'One Prodigy for every month. Every one of them earned.',
    wonders: 'Luck and friendship made this year magical.',
    guild_crowning: 'The crown has found its guild!',
    hall_of_heroes: 'Every name here helped write this year. Congratulations, heroes!'
};

/** An Elite AI line for the herald ribbon. Silent if it comes back after the scene moved on. */
async function herald(phase, data = {}) {
    const token = ++heraldToken;
    const scene = ceremony.phase;
    if (!canUseFeature('eliteAI')) return;
    const prompts = {
        grand_opening: `Write one short, joyful sentence (max 20 words) opening an end-of-year school ceremony for ${data.classCount} class(es). Festive, for children learning English.`,
        hero_gallery: data.top ? `Write one short sentence (max 20 words) celebrating ${data.top.name}, who was Hero of the Day ${data.top.wins} times this school year. Simple English for children.` : '',
        guild_crowning: data.guild ? `Write one short, epic sentence (max 20 words) crowning the ${data.guild.name} guild as champions of the school year. Their motto: "${data.guild.motto}". Simple English for children.` : '',
        hall_of_heroes: 'Write one short, warm sentence (max 22 words) thanking every student for a wonderful school year. Simple English for children.'
    };
    const prompt = prompts[phase];
    if (!prompt) return;
    const fresh = () => token === heraldToken && ceremony.active && ceremony.phase === scene;
    try {
        const text = await callGeminiApi(prompt);
        if (fresh() && text) setHerald(String(text).trim().replace(/^"|"$/g, ''));
    } catch (_) {
        if (fresh() && HERALD_FALLBACK[phase]) setHerald(HERALD_FALLBACK[phase]);
    }
}

// ============================================================== INIT

export function initializeGrandGuildCeremony() {
    updateCeremonyButtons();
    setInterval(updateCeremonyButtons, 60000);
}

initializeGrandGuildCeremony();

// Home buttons call this from inline onclick handlers.
window.startGrandGuildCeremony = startGrandGuildCeremony;
