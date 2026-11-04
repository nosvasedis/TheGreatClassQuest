// ui/modals/heroStats.js — "Hero stats": one hero's record of the school year (lazy).
// Opens from the Hero Stage (Hero stats button) and from a hero in the Home class roster.
// Look: an illuminated hero's ledger on warm vellum, inked in the hero's Path colour.
// Maths lives in features/heroStatsCore.mjs; styles in styles/hero_stats.css (loaded here).
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { HERO_SKILL_TREE, getActiveSkills } from '../../features/heroSkillTree.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { getYearScopedHeroOfDayWinsFromAppState } from '../../utils/yearLegend.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { buildClassRosterView, buildHeroMonthSummary, pickBestTest, resolveTeacherBoonStatus } from '../../features/classRosterCore.mjs';
import { monthStartOf, isMonthlyCounterStale } from '../../features/monthlyStarsCore.mjs';
import {
    AWARD_LOG_REASON_ICONS,
    getAwardLogMonthlyStarCredit,
    shouldShowInStarAwardLog,
    getAwardReasonLabel,
    isBonusOnlyAwardLog,
} from '../../features/awardLogReasonMeta.js';
import { getTeacherBoonForMonth } from '../../features/boons.js';
import {
    getAssessmentAverage,
    getAssessmentValueLabel,
    getClassAssessmentUsage,
    getNormalizedPercentForScore,
} from '../../features/assessmentConfig.js';
import { describeFamiliarForTip, familiarArtSvg } from '../../features/familiars.js';
import { buildTrophySatchel } from '../../features/trophyRoomCore.mjs';
import { currentArtifactFor, isItemUsable } from '../../features/powerUps.js';
import { buildPath } from '../core/avatar.js';
import {
    buildYearMonths,
    monthBarPercent,
    buildVirtueRose,
    buildAttendance,
    buildLegend,
    buildSparkline,
    withCarriedMonth,
} from '../../features/heroStatsCore.mjs';

const MODAL_ID = 'hero-stats-modal';
const ATTENDANCE_DAYS = 28; // the attendance listener keeps the last 30 days

const VIRTUES = {
    teamwork: { icon: 'fa-users', color: '#7c3aed', word: 'works well with others' },
    creativity: { icon: 'fa-lightbulb', color: '#db2777', word: 'brings new ideas' },
    respect: { icon: 'fa-handshake', color: '#059669', word: 'treats everyone kindly' },
    focus: { icon: 'fa-bullseye', color: '#d97706', word: 'keeps their mind on the quest' },
};
const VIRTUE_KEYS = Object.keys(VIRTUES);
const AVATAR_TONES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

const esc = escapeHtml;
const num = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('en-GB');
const plural = (n, one, many = `${one}s`) => `${num(n)} ${Math.abs(Number(n)) === 1 ? one : many}`;

let cssReady = null;
const loadStyles = () => {
    cssReady ||= import('../../styles/hero_stats.css').catch((err) => { cssReady = null; throw err; });
    return cssReady;
};

// Archived month counters, fetched once per hero per session (one small read per month).
const historyCache = new Map();

async function fetchYearHistory(studentId) {
    const yearKey = state.getActiveSchoolYearKey();
    const cacheKey = `${yearKey || 'legacy'}:${studentId}`;
    if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);
    const job = (async () => {
        const { db, collection, getDocs } = await import('../../firebase.js');
        const { PUBLIC_DATA_PATH } = await import('../../utils/tenant.mjs');
        const snap = await getDocs(collection(db, `${PUBLIC_DATA_PATH}/student_scores/${studentId}/monthly_history`));
        const history = {};
        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const month = String(data.month || docSnap.id);
            if (!/^\d{4}-\d{2}$/.test(month)) return;
            if (yearKey && data.schoolYearKey && data.schoolYearKey !== yearKey) return;
            history[month] = Number(data.stars) || 0;
        });
        return history;
    })();
    historyCache.set(cacheKey, job);
    job.catch(() => historyCache.delete(cacheKey));
    return job;
}

/** Seed a hero's archived months (preview page; also lets a caller that already read them skip the fetch). */
export function primeHeroStatsHistory(studentId, history) {
    historyCache.set(`${state.getActiveSchoolYearKey() || 'legacy'}:${studentId}`, Promise.resolve({ ...history }));
}

// ─── Gather ───────────────────────────────────────────────────────────────────
function findClass(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || null;
}

function lessonDatesFor(classData, today = new Date()) {
    const classes = state.get('allSchoolClasses') || [];
    const pool = classes.some((c) => c.id === classData.id) ? classes : [...classes, classData];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    const endDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const startMinutes = utils.parseClockToMinutes(classData.timeStart);
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    const dates = [];
    for (let back = ATTENDANCE_DAYS - 1; back >= 0; back -= 1) {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
        // Today's lesson counts once it has started.
        if (back === 0 && Number.isFinite(startMinutes) && nowMinutes < startMinutes) continue;
        if (utils.doesClassMeetOnDate(classData.id, day, pool, overrides, holidays, endDates)) dates.push(utils.getDDMMYYYY(day));
    }
    return dates;
}

function recentStars(studentId, limit = 6) {
    const value = (dateKey) => {
        const d = utils.parseDDMMYYYY(dateKey);
        return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    };
    return (state.get('allAwardLogs') || [])
        .filter((log) => log && log.studentId === studentId && shouldShowInStarAwardLog(log))
        .sort((a, b) => value(b.date) - value(a.date) || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, limit)
        .map((log) => ({
            date: log.date || '',
            reason: log.reason || 'other',
            stars: Math.round(getAwardLogMonthlyStarCredit(log) * 10) / 10,
            note: String(log.note || '').trim(),
            bonus: isBonusOnlyAwardLog(log),
        }));
}

function trialsFor(classData, studentId) {
    const usage = getClassAssessmentUsage(classData);
    if (!usage.any) return null;
    const scores = (state.get('allWrittenScores') || []).filter((sc) => sc.studentId === studentId
        && ((sc.type === 'test' && usage.tests) || (sc.type === 'dictation' && usage.dictations)));
    const percentFor = (sc) => {
        const raw = getNormalizedPercentForScore(sc, classData);
        return raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    };
    const time = (sc) => utils.parseFlexibleDate(sc.date)?.getTime?.() || 0;
    const sorted = scores.slice().sort((a, b) => time(a) - time(b));
    const tests = sorted.filter((sc) => sc.type === 'test');
    const best = pickBestTest(tests, percentFor);
    const average = tests.length ? getAssessmentAverage(tests, classData) : null;
    const latest = sorted[sorted.length - 1] || null;
    const spark = buildSparkline(sorted.map((sc) => ({
        percent: percentFor(sc),
        type: sc.type,
        title: sc.title || (sc.type === 'dictation' ? 'Dictation' : 'Test'),
        date: sc.date || '',
    })));
    return {
        usage,
        count: sorted.length,
        average,
        best,
        latest: latest ? {
            title: latest.title || (latest.type === 'dictation' ? 'Dictation' : 'Test'),
            value: getAssessmentValueLabel(latest, classData) || '',
            date: latest.date || '',
        } : null,
        spark,
    };
}

function gather(studentId) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    if (!student) return null;
    const classData = findClass(student.classId);
    if (!classData) return null;
    const scoreList = state.get('allStudentScores') || [];
    const score = scoreList.find((s) => s.id === studentId) || {};
    const isMine = (state.get('allTeachersClasses') || []).some((c) => c.id === classData.id);
    const league = getQuestLeagueDefinition(classData.questLevel);
    const gentle = league?.ageCategory === 'early';
    const today = new Date();

    const classmates = (state.get('allStudents') || []).filter((s) => s.classId === classData.id);
    const latestLog = (state.get('allAdventureLogs') || [])
        .filter((l) => l.classId === classData.id)
        .sort((a, b) => (utils.parseDDMMYYYY(b.date) || 0) - (utils.parseDDMMYYYY(a.date) || 0))[0] || null;
    let heroStudentId = latestLog?.heroStudentId || null;
    if (!heroStudentId && latestLog?.hero) heroStudentId = classmates.find((s) => s.name === latestLog.hero)?.id || null;
    const view = buildClassRosterView({
        students: classmates,
        scores: new Map(scoreList.map((s) => [s.id, s])),
        goldFor: (sc) => getLiveYearGoldFromAppState(sc, state),
        heroStudentId,
        gentle,
    });
    const hero = view.heroes.find((h) => h.id === studentId) || {
        id: studentId,
        name: student.name || 'Hero',
        firstName: String(student.name || 'Hero').split(/\s+/)[0],
        initials: String(student.name || '?').charAt(0).toUpperCase(),
        avatar: student.avatar || '',
        monthlyStars: Number(score.monthlyStars) || 0,
        totalStars: Number(score.totalStars) || 0,
        gold: getLiveYearGoldFromAppState(score, state),
        rank: null,
    };
    const stale = isMonthlyCounterStale(score, monthStartOf(today));
    const monthStars = stale ? 0 : hero.monthlyStars;
    const staleMonth = stale ? String(score.lastMonthlyResetDate || '').slice(0, 7) : '';

    const month = buildHeroMonthSummary({
        logs: state.get('allAwardLogs') || [],
        studentId,
        creditFor: getAwardLogMonthlyStarCredit,
        isVisible: shouldShowInStarAwardLog,
    });

    const showPath = canUseFeature('heroProgression');
    const path = showPath ? buildPath(student, score) : null;
    const tree = path ? HERO_SKILL_TREE[student.heroClass] : null;
    const skills = path ? getActiveSkills(student.heroClass, Array.isArray(score.heroSkills) ? score.heroSkills : []) : [];
    const guild = canUseFeature('guilds') && student.guildId ? getGuildById(student.guildId) : null;
    const satchel = buildTrophySatchel(score.inventory, { isUsable: isItemUsable, present: currentArtifactFor });
    const familiar = canUseFeature('familiars') ? describeFamiliarForTip(studentId) : null;

    let attendance = null;
    if (isMine) {
        const lessons = lessonDatesFor(classData, today);
        const away = (state.get('allAttendanceRecords') || [])
            .filter((r) => r.studentId === studentId && r.classId === classData.id)
            .map((r) => r.date);
        attendance = buildAttendance(lessons, away);
    }

    const boon = getTeacherBoonForMonth(classData, utils.getLocalMonthKey());
    const boonStatus = resolveTeacherBoonStatus({ boon, studentId, today });
    const boonWinner = boon?.studentId ? view.heroes.find((h) => h.id === boon.studentId) : null;

    return {
        student,
        score,
        classData,
        isMine,
        league,
        gentle,
        today,
        hero,
        classSize: view.totals.count,
        monthStars,
        staleMonth,
        todayStars: Number((state.get('todaysStars') || {})[studentId]?.stars) || 0,
        month,
        recent: recentStars(studentId),
        path,
        tree,
        skills,
        guild,
        satchel,
        familiar,
        legend: buildLegend(getYearScopedHeroOfDayWinsFromAppState(score, state)),
        attendance,
        boon: { status: boonStatus, reason: String(boon?.reasonText || boon?.presetLabel || '').trim(), winner: boonWinner?.firstName || '' },
        trials: isMine && canUseFeature('scholarScroll') ? trialsFor(classData, studentId) : null,
        accent: path?.color || guild?.primary || '#4f46e5',
    };
}

// ─── Render ───────────────────────────────────────────────────────────────────
function formatDay(dateKey, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
    const d = dateKey ? utils.parseFlexibleDate(dateKey) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', opts) : '';
}

function portraitHtml(ctx) {
    const { hero, path } = ctx;
    const ring = path?.progress?.mastered ? 1 : Math.max(0, Math.min(1, Number(path?.progress?.pct) || 0));
    const face = hero.avatar
        ? `<img src="${esc(hero.avatar)}" alt="" decoding="async">`
        : `<span class="hx-portrait__initials" style="--hx-face:${AVATAR_TONES[utils.simpleHashCode(hero.id) % AVATAR_TONES.length]}">${esc(hero.initials || '?')}</span>`;
    const level = path && path.level > 0 ? `<span class="hx-portrait__level" title="Hero level">Lv ${path.level}</span>` : '';
    return `<div class="hx-portrait${path ? ' hx-portrait--path' : ''}" style="--hx-ring:${Math.round(ring * 360)}deg">${face}${level}</div>`;
}

function renderHead(ctx) {
    const { hero, classData, guild, path, gentle, today, staleMonth } = ctx;
    const monthName = today.toLocaleDateString('en-GB', { month: 'long' });
    const emblem = guild ? getGuildEmblemUrl(ctx.student.guildId) : '';
    const tag = (tone, coin, kicker, text, style = '') => `
                    <span class="hx-tag hx-tag--${tone}"${style ? ` style="${style}"` : ''}>
                        <span class="hx-tag__coin" aria-hidden="true">${coin}</span>
                        <span class="hx-tag__text"><small>${kicker}</small>${text}</span>
                    </span>`;
    const tags = [
        tag('class', esc(classData.logo || '📚'), 'Class', esc(classData.name || 'Class')),
        guild ? tag('guild', emblem ? `<img src="${esc(emblem)}" alt="">` : esc(guild.emoji || '🛡️'), 'Guild', esc(guild.name), `--hx-guild:${esc(guild.primary)}`) : '',
        hero.isHero ? tag('gold', '👑', 'Honour', 'Latest Hero of the Day') : '',
        hero.isBirthday ? tag('rose', '🎂', 'Today', 'Birthday') : '',
        hero.isNameday ? tag('rose', '🫒', 'Today', 'Name day') : '',
    ].join('');
    const pathLine = path
        ? `<p class="hx-pathline"><span aria-hidden="true">${esc(path.icon || '')}</span>${path.level > 0 ? `<b>${esc(path.title)}</b> · ` : ''}${esc(path.name)} path${path.level > 0 ? '' : ' · first level ahead'}</p>`
        : '';
    const seal = !gentle && hero.rank && !staleMonth
        ? `<div class="hx-seal" title="Place in the class this month"><small>No.</small><b>${hero.rank}</b><span>of ${ctx.classSize}<br>in ${esc(monthName)}</span></div>`
        : '';
    return `
        <header class="hx-head">
            <span class="hx-head__art" aria-hidden="true"></span>
            ${portraitHtml(ctx)}
            <div class="hx-head__text">
                <p class="hx-eyebrow"><i class="fas fa-feather-alt" aria-hidden="true"></i> Hero stats · ${esc(monthName)}</p>
                <h2 id="hx-title" class="hx-name">${esc(hero.name)}</h2>
                ${pathLine}
                <div class="hx-tags">${tags}</div>
            </div>
            ${seal}
            <button type="button" class="hx-close" data-hx-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        </header>`;
}

function vital(kind, icon, value, label, note = '') {
    return `
        <div class="hx-vital hx-vital--${kind}">
            <span class="hx-vital__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <strong>${value}</strong>
            <span class="hx-vital__label">${label}</span>
            ${note ? `<small>${note}</small>` : ''}
        </div>`;
}

function renderVitals(ctx) {
    const { monthStars, todayStars, hero, legend, satchel, today } = ctx;
    const monthName = today.toLocaleDateString('en-GB', { month: 'long' });
    const ready = satchel.relicCount + satchel.charms.length;
    return `
        <section class="hx-vitals" aria-label="At a glance">
            ${vital('month', 'fa-star', num(monthStars), `Stars in ${esc(monthName)}`, todayStars > 0 ? `<b>+${num(todayStars)}</b> today` : 'none yet today')}
            ${vital('year', 'fa-medal', num(hero.totalStars), 'Stars this year', '<span data-hx-best>Counting the months…</span>')}
            ${vital('gold', 'fa-coins', num(hero.gold), 'Gold', satchel.total ? `${plural(satchel.total, 'treasure')} in the Satchel${ready ? ` · ${ready} ready` : ''}` : 'Satchel is empty')}
            ${vital('crown', 'fa-crown', num(legend.wins), legend.wins === 1 ? 'Day as Hero of the Day' : 'Days as Hero of the Day', legend.tier ? esc(legend.tier.label) : `${legend.toNext} more to Rising Legend`)}
        </section>`;
}

/** @param {'loading'|'loaded'|'failed'} status past months: still being read, read, or unreadable */
function renderYear(ctx, history, status) {
    const loaded = status === 'loaded';
    const year = buildYearMonths({
        start: state.getActiveSchoolYearStartDate(),
        end: state.getActiveSchoolYearEndDate(),
        today: ctx.today,
        history,
        currentStars: ctx.monthStars,
        loaded,
    });
    const cols = year.months.map((m) => {
        const pct = monthBarPercent(m.stars, year.max);
        const value = m.stars === null ? (m.state === 'future' ? '' : '…') : num(m.stars);
        const label = m.state === 'future' ? `${m.long}: still ahead` : m.stars === null ? `${m.long}: loading` : `${m.long} ${m.year}: ${plural(m.stars, 'star')}`;
        return `
            <li class="hx-month hx-month--${m.state}${m.best ? ' hx-month--best' : ''}" title="${esc(label)}">
                <span class="hx-month__value">${m.best ? '<i class="fas fa-crown" aria-hidden="true"></i>' : ''}${value}</span>
                <span class="hx-month__track"><span class="hx-month__bar" style="height:${pct}%"></span></span>
                <span class="hx-month__name">${esc(m.short)}</span>
            </li>`;
    }).join('');
    const facts = [];
    if (year.best && year.best.stars > 0) facts.push(`<span><i class="fas fa-crown" aria-hidden="true"></i> Best month <b>${esc(year.best.long)}</b> · ${num(year.best.stars)}</span>`);
    if (year.average > 0) facts.push(`<span><i class="fas fa-wave-square" aria-hidden="true"></i> About <b>${num(year.average)}</b> a month</span>`);
    return {
        year,
        html: `
            <section class="hx-card hx-year" data-hx-year>
                <div class="hx-card__head">
                    <h3 class="hx-card__title"><i class="fas fa-calendar-alt" aria-hidden="true"></i> The year in stars</h3>
                    <div class="hx-year__facts">${loaded ? facts.join('') : `<span class="hx-muted">${status === 'failed' ? 'Earlier months could not be read just now.' : 'Opening the old pages…'}</span>`}</div>
                </div>
                <ol class="hx-months" style="--hx-cols:${year.months.length}">${cols}</ol>
            </section>`,
    };
}

function renderVirtues(ctx) {
    const { month, today } = ctx;
    const monthName = today.toLocaleDateString('en-GB', { month: 'long' });
    const rose = buildVirtueRose(month.virtues);
    const c = rose.center;
    const axes = rose.points.map((p) => `<line x1="${c}" y1="${c}" x2="${p.tipX}" y2="${p.tipY}" />`).join('');
    const tips = rose.points.map((p) => {
        const v = VIRTUES[p.key];
        return `
            <g class="hx-rose__tip${rose.strongest === p.key ? ' is-top' : ''}" style="--hx-v:${v.color}" transform="translate(${p.tipX} ${p.tipY})">
                <circle r="17" />
                <text class="hx-rose__num" y="5">${num(p.stars)}</text>
            </g>`;
    }).join('');
    const legend = VIRTUE_KEYS.map((key) => {
        const v = VIRTUES[key];
        const p = rose.points.find((pt) => pt.key === key);
        return `<li style="--hx-v:${v.color}"${rose.strongest === key ? ' class="is-top"' : ''}><i class="fas ${v.icon}" aria-hidden="true"></i><span>${esc(getAwardReasonLabel(key))}</span><b>${num(p?.stars)}</b></li>`;
    }).join('');
    const strongest = rose.strongest
        ? `<p class="hx-rose__caption">Strongest this month: <b style="color:${VIRTUES[rose.strongest].color}">${esc(getAwardReasonLabel(rose.strongest))}</b>, ${esc(ctx.hero.firstName)} ${esc(VIRTUES[rose.strongest].word)}.</p>`
        : rose.total > 0
            ? '<p class="hx-rose__caption">A balanced month: no single virtue leads.</p>'
            : `<p class="hx-rose__caption">No virtue stars yet in ${esc(monthName)}. The compass fills as stars arrive.</p>`;
    const extras = month.extras.length
        ? `<div class="hx-extras"><span class="hx-extras__label">Other stars this month</span>${month.extras.map((e) => `<span class="hx-extra"><i class="fas ${AWARD_LOG_REASON_ICONS[e.reason] || 'fa-star'}" aria-hidden="true"></i>${esc(getAwardReasonLabel(e.reason))} <b>${e.stars > 0 ? '+' : ''}${num(e.stars)}</b></span>`).join('')}</div>`
        : '';
    return `
        <section class="hx-card hx-virtues">
            <h3 class="hx-card__title"><i class="fas fa-compass" aria-hidden="true"></i> Virtue compass · ${esc(monthName)}</h3>
            <div class="hx-rose-wrap">
                <svg class="hx-rose" viewBox="-14 -14 ${rose.size + 28} ${rose.size + 28}" role="img" aria-label="${esc(VIRTUE_KEYS.map((k) => `${getAwardReasonLabel(k)} ${num(rose.points.find((p) => p.key === k)?.stars)}`).join(', '))}">
                    <g class="hx-rose__rings">${rose.rings.map((r) => `<polygon points="${r}" />`).join('')}</g>
                    <g class="hx-rose__axes">${axes}</g>
                    <polygon class="hx-rose__shape" points="${rose.polygon}" />
                    ${rose.points.filter((p) => p.petal).map((p) => `<path class="hx-rose__petal" d="${p.petal}" style="--hx-v:${VIRTUES[p.key].color}" />`).join('')}
                    <circle class="hx-rose__hub" cx="${c}" cy="${c}" r="6" />
                    ${tips}
                </svg>
                <ul class="hx-rose__legend">${legend}</ul>
            </div>
            ${strongest}
            ${extras}
        </section>`;
}

function renderLedger(ctx) {
    const items = ctx.recent.map((r) => `
        <li class="hx-entry${r.bonus ? ' hx-entry--bonus' : ''}" style="--hx-v:${VIRTUES[r.reason]?.color || 'var(--hx-accent)'}">
            <span class="hx-entry__icon" aria-hidden="true"><i class="fas ${AWARD_LOG_REASON_ICONS[r.reason] || 'fa-star'}"></i></span>
            <span class="hx-entry__body">
                <span class="hx-entry__line"><strong>${esc(getAwardReasonLabel(r.reason))}</strong>${r.bonus ? '<em title="Game bonus: counts for the month and the year, not for today">bonus</em>' : ''}</span>
                ${r.note ? `<span class="hx-entry__note">“${esc(r.note)}”</span>` : ''}
                <small>${esc(formatDay(r.date))}</small>
            </span>
            <b class="hx-entry__stars">${r.stars > 0 ? '+' : ''}${num(r.stars)}<i class="fas fa-star" aria-hidden="true"></i></b>
        </li>`).join('');
    return `
        <section class="hx-card hx-ledger">
            <h3 class="hx-card__title"><i class="fas fa-scroll" aria-hidden="true"></i> Latest stars</h3>
            ${items ? `<ol class="hx-entries">${items}</ol>` : `<div class="hx-empty"><span aria-hidden="true">🌙</span><p>No stars written down yet this month.</p></div>`}
        </section>`;
}

function renderPath(ctx) {
    const { path, tree, skills, hero } = ctx;
    if (!path) return '';
    const levels = tree?.levels || [];
    const stones = levels.map((lvl, i) => {
        const n = i + 1;
        const done = path.level >= n;
        const next = path.level + 1 === n;
        return `<li class="hx-stone${done ? ' is-done' : ''}${next ? ' is-next' : ''}" title="Level ${n}: ${esc(tree.titles?.[i] || '')} at ${lvl.threshold} ${esc(path.progress?.reasonLabel || '')} stars"><b>${n}</b><span>${esc(tree.titles?.[i] || `Level ${n}`)}</span></li>`;
    }).join('');
    const pct = path.progress?.mastered ? 100 : Math.round(Math.max(0, Math.min(1, Number(path.progress?.pct) || 0)) * 100);
    // The road runs from stone 1 to the last stone; level L sits at (L-1)/(n-1) along it.
    const span = Math.max(1, levels.length - 1);
    const along = path.level < 1 ? 0 : path.progress?.mastered ? span : Math.min(span, path.level - 1 + pct / 100);
    const filled = Math.round((along / span) * 100);
    const status = path.progress?.mastered
        ? `<p class="hx-path__status"><b>Path mastered.</b> ${esc(hero.firstName)} reached every level of the ${esc(path.name)} path.</p>`
        : path.progress
            ? `<p class="hx-path__status"><b>${plural(Math.ceil(path.progress.toNext * 10) / 10, `${path.progress.reasonLabel} star`)}</b> to Level ${path.progress.nextLevel}, ${esc(path.progress.nextTitle)}.</p>`
            : '';
    const learned = skills.length
        ? `<div class="hx-skills"><span class="hx-extras__label">Skills learned</span>${skills.map((s) => `<span class="hx-skill" title="${esc(s.desc || '')}"><span aria-hidden="true">${esc(s.icon || '✨')}</span>${esc(s.name)}</span>`).join('')}</div>`
        : '';
    return `
        <section class="hx-card hx-path" style="--hx-path:${esc(path.color || 'var(--hx-accent)')}">
            <h3 class="hx-card__title"><i class="fas fa-route" aria-hidden="true"></i> Hero Path · ${esc(path.icon || '')} ${esc(path.name)}</h3>
            <div class="hx-road" style="--hx-fill:${filled}%;--hx-cols:${Math.max(1, levels.length)}">
                <span class="hx-road__line" aria-hidden="true"><span></span></span>
                <ol class="hx-stones">${stones}</ol>
            </div>
            ${status}
            ${ctx.score.pendingSkillChoice ? `<p class="hx-path__pending"><i class="fas fa-arrow-up" aria-hidden="true"></i> Level up waiting: pick a skill in the Skill Tree.</p>` : ''}
            ${learned}
        </section>`;
}

/** How far the ladder line runs: rung 1 at 0, rung 2 at 0.5, rung 3 at 1. */
function ladderFill(legend) {
    const reached = legend.steps.filter((s) => s.reached).length;
    if (reached <= 0) return 0;
    if (reached >= legend.steps.length) return 1;
    return Math.round(((reached - 1) / (legend.steps.length - 1) + legend.pct / (legend.steps.length - 1)) * 100) / 100;
}

function renderLegend(ctx) {
    const { legend, hero } = ctx;
    const steps = legend.steps.map((s) => `
        <li class="hx-rung hx-rung--${s.key}${s.reached ? ' is-reached' : ''}">
            <span class="hx-rung__gem" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <b>${esc(s.label)}</b>
            <small>${s.wins} days</small>
        </li>`).join('');
    const line = legend.next
        ? `${esc(hero.firstName)} has been Hero of the Day <b>${plural(legend.wins, 'time')}</b> this year. <b>${legend.toNext} more</b> for ${esc(legend.next.label)}.`
        : `${esc(hero.firstName)} has been Hero of the Day <b>${plural(legend.wins, 'time')}</b> this year: a Mythic Legend.`;
    return `
        <section class="hx-card hx-legend">
            <h3 class="hx-card__title"><i class="fas fa-crown" aria-hidden="true"></i> Hero of the Day legend</h3>
            <ol class="hx-ladder" style="--hx-ladder-f:${ladderFill(legend)}">${steps}</ol>
            <p class="hx-legend__line">${line}</p>
        </section>`;
}

function renderAttendance(ctx) {
    const a = ctx.attendance;
    if (!a) return '';
    if (!a.lessons) {
        return `
            <section class="hx-card hx-mini">
                <h3 class="hx-card__title"><i class="fas fa-door-open" aria-hidden="true"></i> At lessons</h3>
                <p class="hx-muted">No lessons in the last four weeks.</p>
            </section>`;
    }
    const dots = a.dots.map((d) => `<li class="${d.absent ? 'is-away' : 'is-here'}" title="${esc(formatDay(d.date))}: ${d.absent ? 'away' : 'present'}"></li>`).join('');
    const line = a.absent === 0
        ? `Present at <b>every lesson</b> of the last four weeks.`
        : `Present at <b>${a.present} of ${a.lessons}</b> lessons in the last four weeks.`;
    return `
        <section class="hx-card hx-mini">
            <h3 class="hx-card__title"><i class="fas fa-door-open" aria-hidden="true"></i> At lessons</h3>
            <ol class="hx-dots" aria-hidden="true">${dots}</ol>
            <p class="hx-mini__line">${line}</p>
        </section>`;
}

function renderBoons(ctx) {
    const { boon, month, today } = ctx;
    const st = boon.status;
    const opens = st.opensOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    let teacher = '';
    if (st.state === 'received') teacher = `<b>Teacher Boon received</b> · +2 ⭐${boon.reason ? ` · ${esc(boon.reason)}` : ''}`;
    else if (st.state === 'given_to_other') teacher = `This month’s Teacher Boon went to ${esc(boon.winner || 'a classmate')}.`;
    else if (st.state === 'open') teacher = '<b>Teacher Boon is open</b> this week: +2 ⭐ for one hero.';
    else teacher = `Teacher Boon opens ${esc(opens)} (one hero, +2 ⭐).`;
    const peers = month.peerBoons > 0
        ? `<li class="is-warm"><i class="fas fa-heart" aria-hidden="true"></i><span><b>${plural(month.peerBoons, 'Hero’s Boon')}</b> from classmates this month.</span></li>`
        : `<li><i class="far fa-heart" aria-hidden="true"></i><span>No Hero’s Boons from classmates yet in ${esc(today.toLocaleDateString('en-GB', { month: 'long' }))}.</span></li>`;
    return `
        <section class="hx-card hx-mini">
            <h3 class="hx-card__title"><i class="fas fa-gift" aria-hidden="true"></i> Boons</h3>
            <ul class="hx-boons">
                <li class="${st.state === 'received' ? 'is-gold' : ''}"><i class="fas fa-gift" aria-hidden="true"></i><span>${teacher}</span></li>
                ${peers}
            </ul>
        </section>`;
}

function renderCompanion(ctx) {
    const f = ctx.familiar;
    if (!f) return '';
    let art = '';
    try { art = familiarArtSvg(f.familiar, ctx.student.id, { mode: 'chip' }); } catch { art = ''; }
    const pct = Math.round(Math.max(0, Math.min(100, Number(f.percent) || 0)));
    const growth = f.level === 0
        ? `Still an egg · ${pct}% warm`
        : f.nextName ? `${esc(f.stageName)} · ${pct}% to ${esc(f.nextName)}` : `${esc(f.stageName)} · fully grown`;
    return `
        <section class="hx-card hx-mini hx-companion" style="--hx-fam:${esc(f.accent || f.color || 'var(--hx-accent)')}">
            <h3 class="hx-card__title"><i class="fas fa-paw" aria-hidden="true"></i> Familiar</h3>
            <div class="hx-companion__row">
                <span class="hx-companion__art" aria-hidden="true">${art}</span>
                <span><strong>${esc(f.name)}</strong><small>${esc(f.kind)}${f.shiny ? ' · ✨ shiny' : ''}</small></span>
            </div>
            <p class="hx-mini__line">${growth}</p>
            <span class="hx-meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
        </section>`;
}

function renderTrials(ctx) {
    const t = ctx.trials;
    if (!t) return '';
    const head = '<h3 class="hx-card__title"><i class="fas fa-feather" aria-hidden="true"></i> Scholar’s Scroll · last 3 months</h3>';
    if (!t.count) return `<section class="hx-card hx-trials">${head}<p class="hx-muted">No trials logged for ${esc(ctx.hero.firstName)} in the last 3 months.</p></section>`;
    const s = t.spark;
    const chart = s.dots.length > 1
        ? `<svg class="hx-spark" viewBox="0 0 ${s.width} ${s.height}" preserveAspectRatio="none" role="img" aria-label="Trial results over time">
                ${s.guides.map((g) => `<line class="hx-spark__guide" x1="0" x2="${s.width}" y1="${g.y}" y2="${g.y}" />`).join('')}
                ${Object.entries(s.lines).map(([type, pts]) => `<polyline class="hx-spark__line hx-spark__line--${type}" points="${pts}" />`).join('')}
            </svg>
            <div class="hx-spark__dots">${s.dots.map((d) => `<span class="hx-spark__dot hx-spark__dot--${d.type}" style="left:${(d.x / s.width) * 100}%;top:${(d.y / s.height) * 100}%" title="${esc(`${d.title} · ${d.percent}%${d.date ? ` · ${formatDay(d.date, { day: 'numeric', month: 'short' })}` : ''}`)}"></span>`).join('')}</div>`
        : '';
    const facts = [
        `<div><strong>${t.count}</strong><span>${t.count === 1 ? 'Trial' : 'Trials'}</span></div>`,
        t.average !== null ? `<div><strong>${Math.round(t.average)}%</strong><span>Test average</span></div>` : '',
        t.best ? `<div class="is-wide"><strong>${t.best.percent}% · ${esc(t.best.score.title || 'Test')}</strong><span>Best test</span></div>` : '',
        t.latest ? `<div class="is-wide"><strong>${esc(t.latest.title)}${t.latest.value ? ` · ${esc(t.latest.value)}` : ''}</strong><span>Latest${t.latest.date ? ` · ${esc(formatDay(t.latest.date, { day: 'numeric', month: 'short' }))}` : ''}</span></div>` : '',
    ].join('');
    const kinds = new Set(s.dots.map((d) => d.type));
    const legend = s.dots.length > 1 && kinds.size > 1
        ? '<p class="hx-spark__legend"><span class="is-test">Tests</span><span class="is-dictation">Dictations</span></p>'
        : '';
    return `
        <section class="hx-card hx-trials">
            ${head}
            <div class="hx-trials__body">
                <div class="hx-facts">${facts}</div>
                ${chart ? `<div class="hx-spark-wrap">${chart}${legend}</div>` : '<p class="hx-muted">One more trial and a progress line appears here.</p>'}
            </div>
        </section>`;
}

/** Only from the class roster: a way back to it (the banner's × closes everywhere). */
function renderFoot({ fromRoster }) {
    if (!fromRoster) return '';
    return `
        <footer class="hx-foot">
            <button type="button" class="hx-btn hx-btn--ghost" data-hx-close><i class="fas fa-arrow-left" aria-hidden="true"></i> Back to roster</button>
        </footer>`;
}

function renderAll(ctx, opts) {
    const year = renderYear(ctx, {}, 'loading');
    const side = [renderAttendance(ctx), renderBoons(ctx), renderCompanion(ctx)].filter(Boolean);
    return `
        ${renderHead(ctx)}
        <div class="hx-body" data-hx-body>
            ${renderVitals(ctx)}
            ${year.html}
            <div class="hx-grid">
                ${renderVirtues(ctx)}
                ${renderLedger(ctx)}
            </div>
            <div class="hx-grid${ctx.path ? '' : ' hx-grid--one'}">
                ${renderPath(ctx)}
                ${renderLegend(ctx)}
            </div>
            ${side.length ? `<div class="hx-grid hx-grid--minis">${side.join('')}</div>` : ''}
            ${renderTrials(ctx)}
        </div>
        ${renderFoot(opts)}`;
}

// ─── Shell + wiring ───────────────────────────────────────────────────────────
function ensureShell() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'hx-overlay hidden';
    modal.innerHTML = '<div class="hx-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="hx-title"></div>';
    document.body.append(modal);
    return modal;
}

let session = null;

/** True while Hero stats is open (the class roster leaves Escape to it). */
export function isHeroStatsOpen() {
    const modal = document.getElementById(MODAL_ID);
    return !!modal && !modal.classList.contains('hidden');
}

/**
 * Open one hero's stats.
 * @param {string} studentId
 * @param {{ fromRoster?: boolean }} [opts]
 * @returns {Promise<boolean>} false when the hero or their class cannot be found
 */
export async function openHeroStatsModal(studentId, opts = {}) {
    const ctx = gather(studentId);
    if (!ctx) return false;
    await loadStyles();
    session?.dispose();

    const { showAnimatedModal, hideModal } = await import('./base.js');
    const modal = ensureShell();
    const shell = modal.querySelector('.hx-shell');
    shell.style.setProperty('--hx-accent', ctx.accent);
    shell.classList.toggle('hx-shell--gentle', ctx.gentle);
    shell.innerHTML = renderAll(ctx, opts);
    const body = shell.querySelector('[data-hx-body]');
    body.scrollTop = 0;

    let disposed = false;
    const fillYear = (history, status = 'loaded') => {
        if (disposed) return;
        const host = shell.querySelector('[data-hx-year]');
        if (!host) return;
        const { year, html } = renderYear(ctx, history, status);
        host.outerHTML = html;
        shell.querySelector('[data-hx-year]')?.classList.add('is-filled');
        const best = shell.querySelector('[data-hx-best]');
        if (best) {
            best.textContent = status !== 'loaded' ? 'This school year'
                : year.best && year.best.stars > 0 ? `Best month: ${year.best.long}`
                    : 'The first stars are still ahead';
        }
    };
    // No star yet this month: last month still sits in the live counter, not in the archive.
    fetchYearHistory(studentId).then((history) => fillYear(withCarriedMonth(history, ctx.staleMonth, ctx.score.monthlyStars))).catch((err) => {
        console.warn('Hero stats: month history unavailable:', err);
        // Without the archive the current month still shows; past months stay unknown, never 0.
        fillYear({}, 'failed');
    });

    const close = () => { session?.dispose(); hideModal(MODAL_ID); };
    const onClick = (event) => {
        if (event.target === modal || event.target.closest('[data-hx-close]')) close();
    };
    const onKey = (event) => {
        if (event.key !== 'Escape' || modal.classList.contains('hidden')) return;
        event.stopPropagation();
        close();
    };
    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    session = {
        dispose() {
            disposed = true;
            modal.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey, true);
            session = null;
        },
    };

    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => shell.querySelector('.hx-close')?.focus({ preventScroll: true }));
    return true;
}
