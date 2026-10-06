// features/grandGuildCeremony.js — the Grand Guild Ceremony: the end-of-year
// "Midsummer Festival of the Guilds". Six chapters (Legends of the Day, the
// Quest Road, the Crown Road, Wonders of the Year, the Guild Crowning, the
// Hall of Heroes). Markup lives in grandCeremonyView.js; celebrations run on
// the shared canvas engine (ui/ceremonyFx.js); music and effects come from
// ceremonyAudio.js and only load when the ceremony opens.

import { db, doc, writeBatch } from '../firebase.js';
import * as state from '../state.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as utils from '../utils.js';
import { GUILDS, GUILD_IDS, getGuildById } from './guilds.js';
import { getGuildLeaderboardData } from './guildScoring.js';
import { compareFinalCrownRows } from './guildScoringCore.js';
import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';
import { getYearScopedHeroOfDayWinsFromAppState } from '../utils/yearLegend.js';
import { createCeremonyFx } from '../ui/ceremonyFx.js';
import {
    isCeremonyAudioMuted,
    toggleCeremonyAudioMute,
    prepareCeremonyAudio,
    playCeremonyTrack,
    stopCeremonyMusic,
    stopCeremonyAudio,
    startCeremonyDrumroll,
    stopCeremonyDrumroll,
    playCeremonySfx
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

let ceremony = freshCeremony();
let fx = null;
let timeline = null;
let anthem = null;
let anthemRaf = 0;
let frozenAnimations = [];

function freshCeremony() {
    return {
        active: false,
        phase: 'opening',
        participatingClasses: [],
        ceremonyDate: null,
        data: null,
        dataPromise: null,
        revealPointer: 0,
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
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}–${startYear + 1}`;
}

/** Months of the active school year up to (and including) this month. */
function getYearMonthsSoFar() {
    const now = new Date();
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

/** One fetch per month of the year, shared by the Quest Road and the Crown Road. */
async function gatherYearLogs(months) {
    const schoolYearKey = getCeremonyYearKey();
    const { fetchMonthlyHistory } = await import('../state.js');
    return Promise.all(months.map(async (m) => {
        const [logs, archived] = await Promise.all([
            fetchLogsForMonth(m.year, m.month, schoolYearKey ? { schoolYearKey } : {}).catch(() => []),
            fetchMonthlyHistory(m.monthKey, schoolYearKey ? { schoolYearKey } : {}).catch(() => ({}))
        ]);
        return { ...m, logs: logs || [], archived: archived || {} };
    }));
}

function gatherHeroes(classIds) {
    const classSet = new Set(classIds);
    const classes = state.get('allSchoolClasses') || [];
    const scores = state.get('allStudentScores') || [];
    const heroes = (state.get('allStudents') || [])
        .filter((s) => classSet.has(s.classId))
        .map((s) => {
            const score = scores.find((sc) => sc.id === s.id) || {};
            const wins = getYearScopedHeroOfDayWinsFromAppState(score, state);
            const cls = classes.find((c) => c.id === s.classId);
            return { id: s.id, name: s.name, avatar: s.avatar || null, wins, className: classIds.length > 1 ? cls?.name || '' : '' };
        })
        .filter((h) => h.wins > 0)
        .sort((a, b) => b.wins - a.wins || String(a.name).localeCompare(String(b.name)));
    return { top: heroes.slice(0, 7), totalWins: heroes.reduce((sum, h) => sum + h.wins, 0) };
}

function gatherQuestYear(classIds, monthsWithLogs) {
    const classes = (state.get('allSchoolClasses') || []).filter((c) => classIds.includes(c.id));
    const students = state.get('allStudents') || [];
    return classes.map((c) => {
        const ids = new Set(students.filter((s) => s.classId === c.id).map((s) => s.id));
        const studentCount = ids.size;
        const goal = studentCount ? utils.calculateMonthlyClassGoal(c, studentCount, state.get('schoolHolidayRanges'), state.get('allScheduleOverrides')) : 0;
        const months = monthsWithLogs.map((m) => {
            const fromLogs = m.logs.filter((log) => log.classId === c.id).reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
            const archivedIds = Object.keys(m.archived).filter((id) => ids.has(id));
            const fromArchive = archivedIds.reduce((sum, id) => sum + (Number(m.archived[id]) || 0), 0);
            const stars = Math.round(Math.max(fromLogs, fromArchive));
            return { monthKey: m.monthKey, stars };
        });
        const totalStars = months.reduce((sum, m) => sum + m.stars, 0);
        const goalsMet = goal > 0 ? months.filter((m) => m.stars >= goal).length : 0;
        return { id: c.id, name: c.name, logo: c.logo || '📚', league: c.questLevel || '', months, totalStars, goalsMet };
    });
}

async function gatherProdigyRoad(classIds, monthsWithLogs) {
    const { buildProdigyMonthOutcome } = await import('../ui/modals/rankings.js');
    const students = state.get('allStudents') || [];
    const written = state.get('allWrittenScores') || [];
    const now = new Date();
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

function gatherWheel(classIds) {
    const classSet = new Set(classIds);
    const entries = (state.get('fortuneWheelLog') || []).filter((entry) => classSet.has(entry.classId));
    const byGuild = {};
    entries.forEach((entry) => (entry.results || []).forEach((result) => {
        if (!result.guildId) return;
        byGuild[result.guildId] = (byGuild[result.guildId] || 0) + (Number(result.gloryDelta) || 0);
    }));
    const lucky = Object.entries(byGuild).sort(([, a], [, b]) => b - a)[0];
    return {
        totalSpins: entries.length,
        luckiestGuild: lucky && lucky[1] > 0 ? { guildId: lucky[0], totalGlory: lucky[1] } : null
    };
}

async function gatherFamiliars(classIds) {
    const classSet = new Set(classIds);
    const students = (state.get('allStudents') || []).filter((s) => classSet.has(s.classId));
    const scores = state.get('allStudentScores') || [];
    const result = { totalHatched: 0, totalEggs: 0, mostAdvanced: [] };
    let getLevel = null;
    try {
        ({ getUnlockedFamiliarLevel: getLevel } = await import('./familiarProgression.mjs'));
    } catch (_) { /* optional */ }
    students.forEach((s) => {
        const score = scores.find((sc) => sc.id === s.id);
        const familiar = score?.familiar;
        if (!familiar) return;
        if (familiar.state === 'egg') {
            result.totalEggs += 1;
            return;
        }
        if (familiar.state !== 'alive') return;
        result.totalHatched += 1;
        const level = getLevel ? getLevel(familiar, Number(score?.totalStars) || 0) : 0;
        if (level >= 3) result.mostAdvanced.push({ id: s.id, name: s.name });
    });
    return result;
}

function gatherGuilds(classIds) {
    const classSet = new Set(classIds);
    const students = (state.get('allStudents') || []).filter((s) => classSet.has(s.classId));
    const scores = state.get('allStudentScores') || [];
    // The June Chapter is sealed as it stands: its Crowns count tonight.
    const rows = getGuildLeaderboardData()
        .filter((row) => Number(row.memberCount) > 0)
        .sort(compareFinalCrownRows)
        .map((row, index) => {
            const guild = getGuildById(row.guildId) || GUILDS[row.guildId] || {};
            const heroes = students
                .filter((s) => s.guildId === row.guildId)
                .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar || null, totalStars: Number(scores.find((sc) => sc.id === s.id)?.totalStars) || 0 }))
                .sort((a, b) => b.totalStars - a.totalStars)
                .slice(0, 4);
            return {
                guildId: row.guildId,
                guildName: guild.name || row.guildName,
                guild,
                crowns: (Number(row.crowns) || 0) + (Number(row.liveCrowns) || 0),
                chapterWins: [...(row.chapterWins || []), ...(row.live?.counts && row.live?.place === 1 ? [row.live.key] : [])],
                yearGloryPerMember: Number(row.yearGloryPerMember) || 0,
                rank: index + 1,
                heroes,
            };
        });
    return rows;
}

async function gatherAllData(classIds) {
    const months = getYearMonthsSoFar();
    const monthsWithLogs = await gatherYearLogs(months);
    const [prodigies, familiars] = await Promise.all([
        gatherProdigyRoad(classIds, monthsWithLogs).catch((error) => {
            console.warn('Grand ceremony: prodigy road unavailable', error);
            return { months: [], mostCrowned: [], mostCount: 0, totalCrowns: 0 };
        }),
        gatherFamiliars(classIds)
    ]);
    return {
        heroes: gatherHeroes(classIds),
        questYear: gatherQuestYear(classIds, monthsWithLogs),
        prodigies,
        wheel: gatherWheel(classIds),
        familiars,
        guilds: gatherGuilds(classIds),
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

function setScene(scene, { realm } = {}) {
    const screen = screenEl();
    if (!screen) return;
    screen.dataset.scene = scene;
    if (realm) screen.dataset.realm = realm;
    screen.classList.remove('is-drumroll', 'is-revealed');
    const chapterKey = scene === 'champion' ? 'guilds' : scene;
    const chapterIndex = GRAND_CHAPTERS.findIndex((c) => c.key === chapterKey || chapterKey.startsWith(`${c.key}-`));
    document.querySelectorAll('#grd-chapters li').forEach((li, i) => {
        li.classList.toggle('is-done', chapterIndex > i);
        li.classList.toggle('is-on', chapterIndex === i);
    });
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
            step.run(false);
            settle();
        }, step.at));
    });
    if (!tl.steps.length) settle();
}

function finishTimeline() {
    const tl = timeline;
    if (!tl) return false;
    timeline = null;
    tl.timers.forEach(clearTimeout);
    const screen = screenEl();
    screen?.classList.add('is-skipping');
    tl.steps.filter((s) => !s.done).forEach((s) => { s.done = true; s.run(true); });
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

function handleKeys(e) {
    if (!ceremony.active) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        const btn = $('grd-action-btn');
        if (btn && !btn.disabled) btn.click();
        else finishTimeline();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCeremony();
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

    ceremony = freshCeremony();
    ceremony.active = true;
    ceremony.participatingClasses = participatingClasses;
    ceremony.ceremonyDate = utils.getTodayDateString();
    ceremony.dataPromise = gatherAllData(participatingClasses).then((data) => {
        ceremony.data = data;
        return data;
    }).catch((error) => {
        console.error('Grand ceremony data failed', error);
        return null;
    });

    const guilds = GUILD_IDS.map((id) => GUILDS[id]).filter(Boolean);
    const backdrop = $('grd-backdrop');
    if (backdrop && !backdrop.dataset.ready) {
        backdrop.innerHTML = grandBackdropHtml(guilds);
        backdrop.dataset.ready = '1';
    }
    const chapters = $('grd-chapters');
    if (chapters) chapters.innerHTML = GRAND_CHAPTERS.map((c) => `<li title="${c.title}"><i class="fas ${c.icon}" aria-hidden="true"></i><span>${c.numeral}</span></li>`).join('');

    screen.classList.remove('hidden');
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
        if (!ceremony.active) return;
        playCeremonyTrack('grand_theme');
        playCeremonySfx('gong');
    });

    const classes = (state.get('allSchoolClasses') || []).filter((c) => participatingClasses.includes(c.id));
    setScene('opening', { realm: 'dusk' });
    $('grd-stage').innerHTML = grandOpeningHtml({ yearLabel: getYearLabel(), classes, guilds });
    setHeading('', '');
    setHerald('The lanterns are lit. Welcome to the end-of-year festival!');
    setAction('Begin the Festival', advance);
    fx?.embers({ count: 30, duration: 4000, colors: ['#fde68a', '#fb923c', '#f9a8d4'] });
    herald('grand_opening', { classCount: participatingClasses.length });
}

function closeCeremony() {
    ceremony.active = false;
    cancelTimeline();
    stopAnthem();
    window.removeEventListener('keydown', handleKeys);
    stopCeremonyAudio({ fade: 0.6 });
    fx?.clear();
    const screen = screenEl();
    if (screen) {
        screen.classList.remove('is-open');
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
                ceremony.dataPromise = gatherAllData(ceremony.participatingClasses).then((d) => { ceremony.data = d; return d; }).catch(() => null);
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
        hall: renderFarewell,
        gather: renderHeroes
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
    setHerald(top[0] ? `${top[0].name} was Hero of the Day ${top[0].wins} ${top[0].wins === 1 ? 'time' : 'times'}!` : 'Every day had its hero!');
    playCeremonySfx('whoosh');
    const lanterns = [...stage.querySelectorAll('.grd-hero')].sort((a, b) => Number(b.style.getPropertyValue('--i')) - Number(a.style.getPropertyValue('--i')));
    const steps = lanterns.map((li, i) => ({ at: 200 + i * 380, run: (fast) => {
        li.classList.add('is-lit');
        countAll(li, fast);
        if (!fast) {
            playCeremonySfx(li.classList.contains('grd-hero--top') ? 'reveal' : 'chime');
            const p = fxPoint(li.querySelector('.grd-hero__lantern'));
            fx?.burst(p.x, p.y, { colors: ['#fde68a', '#fb923c', '#ffffff'], count: li.classList.contains('grd-hero--top') ? 70 : 26, speed: 180, gravity: 40 });
        }
    } }));
    steps.push({ at: 300 + lanterns.length * 380, run: (fast) => countAll(stage.querySelector('.grd-heroes__total'), fast) });
    runTimeline(steps);
    herald('hero_gallery', { top: top[0], totalWins });
    setAction('On to the Quest Road', advance);
}

function renderQuestYear() {
    ceremony.phase = 'quest';
    setScene('quest', { realm: 'dusk' });
    const stage = $('grd-stage');
    const classes = ceremony.data.questYear;
    stage.innerHTML = grandQuestYearHtml(classes);
    chapterHeading('quest', 'A Year of Team Quests');
    setHerald('Month by month, star by star, every class walked its own road.');
    playCeremonySfx('whoosh');
    const cards = [...stage.querySelectorAll('.grd-quest')];
    runTimeline(cards.map((card, i) => ({ at: 150 + i * 450, run: (fast) => {
        card.classList.add('is-raised');
        countAll(card, fast);
        if (!fast) playCeremonySfx('count');
    } })));
    herald('team_quest_journey', { classes });
    setAction('Walk the Crown Road', advance);
}

function renderProdigyRoad() {
    ceremony.phase = 'prodigies';
    setScene('prodigies', { realm: 'dusk' });
    const stage = $('grd-stage');
    const road = ceremony.data.prodigies;
    stage.innerHTML = grandProdigyRoadHtml(road.months, { mostCrowned: road.mostCrowned, mostCount: road.mostCount });
    chapterHeading('prodigies', 'Every Prodigy of the Month');
    setHerald(road.months.length ? 'One crown for every month of the year.' : '');
    const tiles = [...stage.querySelectorAll('.grd-month')];
    const steps = tiles.map((tile, i) => ({ at: 150 + i * 260, run: (fast) => {
        tile.classList.add('is-shown');
        if (!fast) playCeremonySfx('tick');
    } }));
    const plaque = stage.querySelector('.grd-crowned');
    if (plaque) {
        steps.push({ at: 500 + tiles.length * 260, run: (fast) => {
            plaque.classList.add('is-shown');
            if (!fast) {
                playCeremonySfx('gold');
                const p = fxPoint(plaque);
                fx?.burst(p.x, p.y, { colors: ['#fde68a', '#fbbf24', '#ffffff'], count: 90, speed: 260, ring: true });
            }
        } });
    }
    runTimeline(steps);
    herald('prodigy_timeline', { mostCrowned: road.mostCrowned, mostCount: road.mostCount, totalCrowns: road.totalCrowns });
    setAction(hasWonders() ? 'Wonders of the Year' : 'The Guild Crowning', advance);
}

function hasWonders() {
    const d = ceremony.data;
    return Boolean(d && (d.wheel.totalSpins > 0 || d.familiars.totalHatched > 0 || d.familiars.totalEggs > 0));
}

function renderWonders() {
    ceremony.phase = 'wonders';
    setScene('wonders', { realm: 'dusk' });
    const stage = $('grd-stage');
    const { wheel, familiars } = ceremony.data;
    const luckyGuild = wheel.luckiestGuild ? getGuildById(wheel.luckiestGuild.guildId) : null;
    stage.innerHTML = grandWondersHtml({ wheel, familiars, luckyGuild });
    chapterHeading('wonders', "The Wheel & the Familiars");
    setHerald('Fate spun, eggs cracked, and new friends were born.');
    const tiles = [...stage.querySelectorAll('.grd-wonder')];
    runTimeline(tiles.map((tile, i) => ({ at: 150 + i * 380, run: (fast) => {
        tile.classList.add('is-shown');
        countAll(tile, fast);
        if (!fast) playCeremonySfx('pop');
    } })));
    herald('wonders', { wheel, familiars });
    setAction('The Guild Crowning', advance);
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
    const stage = $('grd-stage');
    const chronicles = ceremony.data.chronicles;
    stage.innerHTML = view.grandStoryHtml(chronicles);
    chapterHeading('guilds', 'The Story of the Year');
    setHerald('Every Chapter has its tale. Listen to the Chronicle of the Crown Race.');
    playCeremonySfx('whoosh');
    const paper = stage.querySelector('.grd-story__paper');
    const stanzas = [...stage.querySelectorAll('.grd-story__stanza')];
    runTimeline(stanzas.map((el, i) => ({ at: 300 + i * 2600, run: (fast) => {
        el.classList.add('is-read');
        if (fast) return;
        playCeremonySfx('chime');
        if (paper) paper.scrollTop = Math.max(0, el.offsetTop - paper.clientHeight / 3);
        setHerald(`${chronicles[i].month}: ${chronicles[i].lines[0]}`);
    } })), () => setHerald('And so the year was written, Chapter by Chapter.'));
    setAction('The Guild Crowning', advance);
}

function renderGuildPillars() {
    ceremony.phase = 'guilds-reveal';
    setScene('guilds', { realm: 'night' });
    const rows = ceremony.data.guilds;
    const stage = $('grd-stage');
    if (!rows.length) {
        renderHall();
        return;
    }
    const maxCrowns = Math.max(1, ...rows.map((r) => r.crowns));
    const display = GUILD_IDS.map((id) => rows.find((r) => r.guildId === id)).filter(Boolean);
    stage.innerHTML = grandGuildPillarsHtml(display, { maxCrowns });
    chapterHeading('guilds', 'Which guild wears the crown?');
    setHerald('Four guilds. One crown. A year of Chapters decides.');
    ceremony.music = 'grand_suspense';
    playCeremonyTrack('grand_suspense');
    playCeremonySfx('gong');
    // Reveal order: last place first, champion last.
    ceremony.revealQueue = rows.slice(1).map((r) => r.guildId).reverse();
    const pillars = stage.querySelector('.grd-pillars');
    runTimeline([
        { at: 120, run: () => pillars?.classList.add('is-rising') }
    ]);
    if (ceremony.revealQueue.length) setAction(`Reveal #${rows.length}`, advance);
    else setAction('🥁 Crown the Champion', crownChampion);
}

function revealNextGuild() {
    const id = ceremony.revealQueue?.shift();
    const stage = $('grd-stage');
    const pillar = stage.querySelector(`.grd-pillar[data-guild="${id}"]`);
    if (pillar) {
        pillar.classList.add('is-revealed');
        countAll(pillar, false);
        playCeremonySfx('reveal');
        const guild = getGuildById(id);
        const p = fxPoint(pillar.querySelector('.grd-pillar__crest'));
        fx?.burst(p.x, p.y, { colors: guildColors(guild), count: 60, speed: 220 });
        setHerald(`${guild?.name || 'A guild'} takes place #${pillar.dataset.rank}!`);
    }
    if (ceremony.revealQueue.length) {
        const nextRank = ceremony.data.guilds.find((r) => r.guildId === ceremony.revealQueue[0])?.rank;
        setAction(`Reveal #${nextRank}`, advance);
    } else {
        setAction('🥁 Crown the Champion', crownChampion);
    }
}

function crownChampion() {
    const stage = $('grd-stage');
    const screen = screenEl();
    const champion = ceremony.data.guilds[0];
    const pillar = stage.querySelector(`.grd-pillar[data-guild="${champion.guildId}"]`);
    const others = [...stage.querySelectorAll('.grd-pillar:not(.is-revealed)')];
    setAction('Crowning…', null);
    screen.classList.add('is-drumroll');
    stopCeremonyMusic({ fade: 0.4 });
    startCeremonyDrumroll(3.2);
    setHerald('');
    const steps = [];
    [0, 420, 780, 1080, 1340, 1560, 1750, 1910, 2050, 2170, 2280, 2380, 2470, 2550, 2630, 2700, 2770, 2830, 2890, 2950, 3000, 3050].forEach((at, i) => {
        steps.push({ at, run: (fast) => {
            if (fast) return;
            others.forEach((el) => el.classList.remove('is-spot'));
            others[i % others.length]?.classList.add('is-spot');
            if (i % 3 === 0) playCeremonySfx('tick');
        } });
    });
    steps.push({ at: 3250, run: (fast) => {
        stopCeremonyDrumroll({ crash: !fast });
        others.forEach((el) => el.classList.remove('is-spot'));
        screen.classList.remove('is-drumroll');
        screen.classList.add('is-revealed');
        pillar?.classList.add('is-revealed', 'is-champion');
        countAll(pillar, fast);
        stage.querySelector('.grd-pillars')?.classList.add('is-crowned');
        setHeading('Guild Champions of the Year', champion.guild?.name || champion.guildName);
        if (!fast) {
            replay(screen, 'is-flashing');
            playCeremonyTrack('grand_crowning');
            playCeremonySfx('gold');
            const colors = guildColors(champion.guild);
            const p = fxPoint(pillar?.querySelector('.grd-pillar__crest'));
            fx?.burst(p.x, p.y, { colors, count: 160, speed: 420, ring: true });
            fx?.fireworks({ count: 9, colors, spread: 3200 });
            fx?.confetti({ count: 170, colors, duration: 1600 });
        }
        herald('guild_crowning', { guild: champion.guild });
    } });
    ceremony.phase = 'guilds-crown';
    runTimeline(steps, () => setAction(`Hear the ${champion.guild?.name || 'champion'} anthem`, advance));
}

function stopAnthem() {
    cancelAnimationFrame(anthemRaf);
    anthemRaf = 0;
    if (anthem) {
        try { anthem.pause(); } catch (_) { /* ignore */ }
        anthem.src = '';
        anthem = null;
    }
}

function playAnthem(guild, lyricsEl) {
    stopAnthem();
    if (!guild?.anthem || isCeremonyAudioMuted()) {
        lyricsEl?.querySelectorAll('li').forEach((li) => li.classList.add('is-sung'));
        return;
    }
    stopCeremonyMusic({ fade: 0.8 });
    anthem = new Audio(guild.anthem);
    anthem.volume = 0.9;
    const lines = [...(lyricsEl?.querySelectorAll('li') || [])];
    const tick = () => {
        if (!anthem) return;
        const t = anthem.currentTime;
        lines.forEach((li, i) => {
            const start = Number(li.dataset.time) || 0;
            const next = Number(lines[i + 1]?.dataset.time) || Infinity;
            li.classList.toggle('is-now', t >= start && t < next);
            if (t >= start) li.classList.add('is-sung');
        });
        if (!anthem.ended) anthemRaf = requestAnimationFrame(tick);
    };
    anthem.addEventListener('ended', () => {
        lines.forEach((li) => li.classList.remove('is-now'));
        if (ceremony.active) playCeremonyTrack('grand_theme', { fade: 2 });
    });
    anthem.play().then(tick).catch(() => lines.forEach((li) => li.classList.add('is-sung')));
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
    fx?.fireworks({ count: 6, colors, spread: 4000 });
    runTimeline([{ at: 700, run: () => playAnthem(champion.guild, stage.querySelector('.grd-lyrics')) }]);
    setAction('Enter the Hall of Heroes', advance);
}

function renderHall() {
    stopAnthem();
    ceremony.phase = 'hall';
    setScene('hall', { realm: 'night' });
    ceremony.music = 'grand_theme';
    playCeremonyTrack('grand_theme', { fade: 1.5 });
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
        { value: d.prodigies.totalCrowns, label: 'Prodigy crowns' }
    ];
    const stage = $('grd-stage');
    stage.innerHTML = grandHallHtml(students, { stats });
    chapterHeading('hall', 'Every hero, a star');
    setHerald('Every name here helped write this year. Congratulations, heroes!');
    runTimeline([
        { at: 100, run: () => stage.querySelector('.grd-hall')?.classList.add('is-lit') },
        { at: 900, run: (fast) => { countAll(stage, fast); if (!fast) playCeremonySfx('gold'); } },
        { at: 1300, run: (fast) => {
            if (fast) return;
            fx?.fireworks({ count: 10, spread: 5000 });
            fx?.confetti({ count: 150, duration: 1800 });
        } }
    ]);
    herald('hall_of_heroes', {});
    setAction('Finish Ceremony', advance);
}

function renderFarewell() {
    ceremony.phase = 'end';
    setScene('farewell', { realm: 'night' });
    $('grd-stage').innerHTML = grandFarewellHtml({ yearLabel: getYearLabel() });
    setHeading('Ceremony Complete', 'Until next year');
    setHerald('');
    fx?.fireworks({ count: 6, spread: 3000 });
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
        guildRanking: (d.guilds || []).map((g) => ({ guildId: g.guildId, rank: g.rank, crowns: g.crowns, chapterWins: g.chapterWins || [] })),
        wheelSpins: d.wheel?.totalSpins || 0,
        familiarsHatched: d.familiars?.totalHatched || 0
    };
}

async function saveCeremonyCompletion() {
    if (ceremony.saved) return;
    ceremony.saved = true;
    try {
        const teacherId = state.get('currentUserId');
        if (!teacherId) return;
        const record = {
            ceremonyDate: ceremony.ceremonyDate,
            participatingClasses: [...ceremony.participatingClasses],
            summary: buildSummary(),
            completedAt: new Date(),
            ceremonyVersion: 'midsummer-2026'
        };
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
    team_quest_journey: 'Every class walked its own road, and every road led forward.',
    prodigy_timeline: 'One crown for every month. Every one of them earned.',
    wonders: 'Luck and friendship made this year magical.',
    guild_crowning: 'The crown has found its guild!',
    hall_of_heroes: 'Every name here helped write this year. Congratulations, heroes!'
};

async function herald(phase, data = {}) {
    const token = ++heraldToken;
    if (!canUseFeature('eliteAI')) return;
    const prompts = {
        grand_opening: `Write one short, joyful sentence (max 20 words) opening an end-of-year school ceremony for ${data.classCount} class(es). Festive, for children learning English.`,
        hero_gallery: data.top ? `Write one short sentence (max 20 words) celebrating ${data.top.name}, who was Hero of the Day ${data.top.wins} times this school year.` : '',
        guild_crowning: data.guild ? `Write one short, epic sentence (max 20 words) crowning the ${data.guild.name} guild as champions of the school year. Their motto: "${data.guild.motto}".` : '',
        hall_of_heroes: 'Write one short, warm sentence (max 22 words) thanking every student for a wonderful school year.'
    };
    const prompt = prompts[phase];
    if (!prompt) return;
    try {
        const text = await callGeminiApi(prompt);
        if (token === heraldToken && ceremony.active && text) setHerald(String(text).trim().replace(/^"|"$/g, ''));
    } catch (_) {
        if (token === heraldToken && ceremony.active && HERALD_FALLBACK[phase]) setHerald(HERALD_FALLBACK[phase]);
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
