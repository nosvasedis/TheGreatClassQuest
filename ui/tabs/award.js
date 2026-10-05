// /ui/tabs/award.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { renderFamiliarSprite } from '../../features/familiars.js';
import { resolveDailyModifier, MODIFIER_TYPES } from '../../features/specialQuestEngine.js';
import {
    AWARD_CLOUD_KEYS,
    buildAwardAttendanceHtml,
    buildAwardBoonButtonHtml,
    buildAwardCloudCardHtml,
    buildAwardFinaleHtml,
    buildAwardHonoursHtml,
    buildAwardSkySummaryHtml,
    buildAwardVirtuesHtml,
    formatAwardStars,
    resolveAwardAttendanceMode
} from '../../features/awardCloudCard.mjs';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { getClassDataById, getTeacherBoonForMonth } from '../../features/boons.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import {
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import { buildHeroTieStats, pickProdigyWinners, rankHeroes } from '../../features/heroRanking.js';
import { withPendingAwards } from '../../features/awardPending.mjs';

// --- REIGNING PRODIGY CACHE (previous month, with tie-breaker) ---
let _awardProdigyCacheKey = null;
let _awardProdigyCache = {}; // classId -> Set<studentId>
let awardVisualSessionId = 0;
let awardVisualClassId = null;
const awardVisualCache = new Map();
const awardStudentOrderCache = new Map();
// What each cloud was last drawn from (studentId -> card HTML without the live numbers),
// so a redraw only touches the clouds whose content actually changed.
const awardCardSignatures = new Map();
let awardSkySummaryHtml = null;

async function getReigningProdigyForClass(classId) {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cacheKey = `${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;

    // Re-use cached data if already fetched this session/month
    if (_awardProdigyCacheKey !== cacheKey) {
        try {
            const { fetchLogsForMonth } = await import('../../db/queries.js');
            const { fetchMonthlyHistory } = await import('../../state.js');
            const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            const logs = await fetchLogsForMonth(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
            const archived = await fetchMonthlyHistory(monthKey).catch(() => ({}));
            const allScores = state.get('allWrittenScores') || [];
            const vm = prevMonth.getMonth();
            const vy = prevMonth.getFullYear();

            const logsByClass = {};
            logs.forEach(l => {
                if (!l.classId) return;
                if (!logsByClass[l.classId]) logsByClass[l.classId] = [];
                logsByClass[l.classId].push(l);
            });

            const result = {};
            Object.entries(logsByClass).forEach(([cId, classLogs]) => {
                const students = state.get('allStudents').filter(s => s.classId === cId);
                const fromLogsTotals = sumMonthlyStarCreditsByStudentFromAwardLogs(classLogs);
                const mergedTotals = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogsTotals, archived || {});

                // Same rules as the Ceremony and the Hall of Prodigies (features/heroRanking.js).
                const ranked = rankHeroes(students.map(s => {
                    const sScores = allScores.filter(sc => {
                        const d = utils.parseFlexibleDate(sc.date);
                        return sc.studentId === s.id && d && d.getMonth() === vm && d.getFullYear() === vy;
                    });
                    return {
                        id: s.id,
                        name: s.name,
                        stars: Number(mergedTotals[s.id]) || 0,
                        stats: buildHeroTieStats(classLogs.filter(l => l.studentId === s.id), sScores, getNormalizedPercentForScore)
                    };
                }));
                const winners = pickProdigyWinners(ranked);
                if (!winners.length) return;
                result[cId] = new Set(winners.map(s => s.id));
            });

            _awardProdigyCacheKey = cacheKey;
            _awardProdigyCache = result;
        } catch (e) {
            console.warn('Award tab: could not load reigning prodigies:', e);
        }
    }

    return _awardProdigyCache[classId] || new Set();
}

/** The month the reigning Prodigy of the Month won ("August"). */
function getProdigyMonthName() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.toLocaleString('en-US', { month: 'long' });
}

/** The prodigies we already know this session, without waiting on the network. */
function getCachedProdigySet(classId) {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cacheKey = `${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;
    return _awardProdigyCacheKey === cacheKey ? (_awardProdigyCache[classId] || new Set()) : null;
}

export function resetAwardCardVisualSession() {
    awardVisualSessionId += 1;
    awardVisualClassId = null;
    awardVisualCache.clear();
}

function ensureAwardVisualSession(classId) {
    if (awardVisualClassId === classId) return;
    awardVisualSessionId += 1;
    awardVisualClassId = classId || null;
    awardVisualCache.clear();
}

/** Each hero keeps one cloud shape and float phase for the whole visit. */
function getAwardCardVisualState(classId, studentId) {
    ensureAwardVisualSession(classId);
    const cacheKey = `${classId}:${studentId}`;
    if (awardVisualCache.has(cacheKey)) return awardVisualCache.get(cacheKey);

    const hash = utils.simpleHashCode(`${awardVisualSessionId}:${cacheKey}`);
    const visualState = {
        cloud: AWARD_CLOUD_KEYS[hash % AWARD_CLOUD_KEYS.length],
        floatDelay: hash % 6000
    };
    awardVisualCache.set(cacheKey, visualState);
    return visualState;
}

function cacheAwardStudentOrder(classId, students) {
    if (!classId) return;
    awardStudentOrderCache.set(classId, students.map((student) => student.id));
}

function sortStudentsByAwardOrder(classId, students) {
    const cachedOrder = awardStudentOrderCache.get(classId);
    if (!cachedOrder?.length) {
        cacheAwardStudentOrder(classId, students);
        return students;
    }

    const orderIndex = new Map(cachedOrder.map((studentId, index) => [studentId, index]));
    return [...students].sort((a, b) => {
        const aIndex = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bIndex = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.name.localeCompare(b.name);
    });
}

function renderTeacherBoonLaunchState(selectedClassId) {
    const launchBtn = document.getElementById('open-teacher-boon-btn');
    if (!launchBtn) return;

    const classData = selectedClassId ? getClassDataById(selectedClassId) : null;
    const inWindow = Boolean(selectedClassId) && utils.isTeacherBoonWindow();
    if (!inWindow) {
        launchBtn.classList.add('hidden');
        return;
    }

    const existingBoon = classData ? getTeacherBoonForMonth(classData, utils.getLocalMonthKey()) : null;

    // Hide completely once the boon has been bestowed this month
    if (existingBoon) {
        launchBtn.classList.add('hidden');
        return;
    }

    launchBtn.classList.remove('hidden');
}

/** Today's Special Quest modifier for a class (2x Star Day or a virtue Bonus Day), if any. */
function getAwardDayModifier(classId) {
    const today = utils.getTodayDateString();
    const events = (state.get('allQuestEvents') || []).filter((event) =>
        utils.datesMatch(event.dateKey || event.date, today) &&
        (!event.classId || event.classId === classId)
    );
    const modifier = resolveDailyModifier(events);
    if (!modifier) return null;
    if (modifier.type === MODIFIER_TYPES.DOUBLE_STAR_DAY) return { type: 'double' };
    const reason = modifier.event?.details?.reason;
    return reason ? { type: 'reason', reason } : null;
}

/**
 * Class-wide facts every cloud needs, gathered once per render: scores, attendance,
 * boon eligibility, today's stars, the day's modifier.
 */
function buildAwardClassContext(classId, studentsInClass) {
    const allSchoolClasses = state.get('allSchoolClasses');
    const allScheduleOverrides = state.get('allScheduleOverrides');
    const schoolHolidayRanges = state.get('schoolHolidayRanges');
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const previousLessonDate = utils.getPreviousLessonDate(classId, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, classEndDates);
    const today = utils.getTodayDateString();
    const classHasLessonToday = utils.doesClassMeetOnDate(classId, today, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, classEndDates);
    const schoolClass = (allSchoolClasses || []).find((c) => c.id === classId);

    const scoreMap = new Map();
    for (const sc of state.get('allStudentScores') || []) scoreMap.set(sc.id, sc);

    // Hero's Boon: the bottom three this month, or anyone sharing a monthly total with a classmate.
    const leaderboard = studentsInClass.map((s) => ({ id: s.id, stars: Number(scoreMap.get(s.id)?.monthlyStars) || 0 }));
    leaderboard.sort((a, b) => a.stars - b.stars);
    const bottomThreeIds = new Set(leaderboard.slice(0, 3).map((x) => x.id));
    const scoreCounts = {};
    leaderboard.forEach((x) => { scoreCounts[x.stars] = (scoreCounts[x.stars] || 0) + 1; });
    const monthlyById = new Map(leaderboard.map((x) => [x.id, x.stars]));
    const classBoonsToday = (state.get('allAwardLogs') || []).filter((l) =>
        l.classId === classId && l.date === today && l.reason === 'peer_boon'
    ).length;
    const dailyLimitReached = classBoonsToday >= 4;

    const absentTodaySet = new Set();
    const absentPrevSet = new Set();
    for (const r of state.get('allAttendanceRecords') || []) {
        if (r.date === today) absentTodaySet.add(r.studentId);
        if (previousLessonDate && r.date === previousLessonDate) absentPrevSet.add(r.studentId);
    }

    return {
        classId,
        today,
        classHasLessonToday,
        scheduleDays: schoolClass?.scheduleDays || [],
        scoreMap,
        bottomThreeIds,
        scoreCounts,
        monthlyById,
        dailyLimitReached,
        absentTodaySet,
        absentPrevSet,
        todaysStars: getEffectiveTodaysStars(),
        reigningHero: state.get('reigningHero'),
        prodigySet: getCachedProdigySet(classId) || new Set(),
        prodigyMonth: getProdigyMonthName(),
        heroProgressionEnabled: canUseFeature('heroProgression'),
        familiarsEnabled: canUseFeature('familiars'),
        modifier: getAwardDayModifier(classId)
    };
}

function isBoonEligible(ctx, studentId) {
    if (ctx.dailyLimitReached) return false;
    const stars = ctx.monthlyById.get(studentId);
    return ctx.bottomThreeIds.has(studentId) || (stars != null && ctx.scoreCounts[stars] > 1);
}

function getHeroClassView(student, scoreData, ctx) {
    if (!ctx.heroProgressionEnabled || !student.heroClass) return null;
    const heroLevel = scoreData.heroLevel || 0;
    const tree = HERO_SKILL_TREE[student.heroClass];
    return {
        title: heroLevel > 0 ? getHeroTitle(student.heroClass, heroLevel) : student.heroClass,
        icon: HERO_CLASSES[student.heroClass]?.icon || '',
        aura: tree?.auraColor || '#7c3aed'
    };
}

function getGuildView(student) {
    if (!student.guildId) return null;
    const guild = getGuildById(student.guildId);
    if (!guild) return null;
    return { name: guild.name, emblemUrl: getGuildEmblemUrl(student.guildId), color: guild.primary };
}

function getOccasion(student, ctx) {
    if (utils.isSpecialOccasion(student.birthday, ctx.scheduleDays)) return 'birthday';
    if (utils.isSpecialOccasion(student.nameday, ctx.scheduleDays)) return 'nameday';
    return null;
}

/** Everything one cloud shows, as plain data for features/awardCloudCard.mjs. */
function buildStudentCloudView(student, ctx, index = 0) {
    const scoreData = ctx.scoreMap.get(student.id) || {};
    const todayEntry = ctx.todaysStars[student.id];
    const starsToday = Number(todayEntry?.stars) || 0;
    const reasonToday = todayEntry?.reason || null;
    const isMarkedAbsentToday = ctx.absentTodaySet.has(student.id);
    const wasAbsentLastTime = ctx.absentPrevSet.has(student.id);
    const isPresentToday = starsToday > 0 || reasonToday === 'marked_present' || reasonToday === 'welcome_back';
    const isVisuallyAbsent = isMarkedAbsentToday || (wasAbsentLastTime && !isPresentToday);
    const locked = starsToday > 0 && reasonToday !== 'welcome_back';
    const isHeroOfDay = Boolean(ctx.reigningHero && ctx.reigningHero.id === student.id);
    const visual = getAwardCardVisualState(ctx.classId, student.id);

    return {
        id: student.id,
        name: student.name,
        firstName: String(student.name || '').split(' ')[0],
        avatar: student.avatar || null,
        guild: getGuildView(student),
        heroClass: getHeroClassView(student, scoreData, ctx),
        levelUp: ctx.heroProgressionEnabled && Boolean(scoreData.pendingSkillChoice),
        gold: getLiveYearGoldFromAppState(scoreData, state),
        today: starsToday,
        month: scoreData.monthlyStars || 0,
        total: scoreData.totalStars || 0,
        todayReason: reasonToday,
        locked,
        isAbsent: isVisuallyAbsent,
        attendanceMode: resolveAwardAttendanceMode({
            isVisuallyAbsent,
            isMarkedAbsentToday,
            classHasLessonToday: ctx.classHasLessonToday,
            isCardLocked: locked
        }),
        boon: { eligible: isBoonEligible(ctx, student.id), dailyLimitReached: ctx.dailyLimitReached },
        honours: {
            heroOfDay: isHeroOfDay,
            heroBonusReady: isHeroOfDay && starsToday <= 0,
            prodigy: ctx.prodigySet.has(student.id),
            coProdigy: ctx.prodigySet.has(student.id) && ctx.prodigySet.size > 1,
            prodigyMonth: ctx.prodigyMonth,
            occasion: getOccasion(student, ctx),
            welcomedBack: reasonToday === 'welcome_back'
        },
        bonusReason: ctx.modifier?.type === 'reason' ? ctx.modifier.reason : null,
        familiarHtml: ctx.familiarsEnabled && scoreData.familiar ? renderFamiliarSprite(scoreData.familiar, 'small', student.id) : '',
        cloud: visual.cloud,
        floatDelay: visual.floatDelay,
        riseDelay: Math.min(index * 38, 620)
    };
}

/** Today's stars as this teacher sees them, awards still saving included. */
function getEffectiveTodaysStars() {
    return withPendingAwards(state.get('todaysStars') || {});
}

/** The stars a hero shows today (awards still saving included). */
export function getEffectiveTodayStarsFor(studentId) {
    return getEffectiveTodaysStars()[studentId] || null;
}

function getClassStudents(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId);
}

/** The strip above the clouds: how much of the class shines today, and the day's bonus. */
function renderAwardSkySummary(classId) {
    const el = document.getElementById('award-sky-summary');
    if (!el) return;
    const students = classId ? getClassStudents(classId) : [];
    if (!students.length) {
        el.classList.add('hidden');
        el.innerHTML = '';
        awardSkySummaryHtml = null;
        return;
    }
    const todaysStars = getEffectiveTodaysStars();
    const today = utils.getTodayDateString();
    const awayToday = new Set((state.get('allAttendanceRecords') || []).filter((r) => r.date === today).map((r) => r.studentId));
    let shining = 0;
    let starsToday = 0;
    let awaiting = 0;
    for (const s of students) {
        const n = Number(todaysStars[s.id]?.stars) || 0;
        if (n > 0) {
            shining += 1;
            starsToday += n;
        } else if (!awayToday.has(s.id)) {
            awaiting += 1;
        }
    }
    const html = buildAwardSkySummaryHtml({
        shining,
        heroes: students.length,
        starsToday,
        awaiting,
        modifier: getAwardDayModifier(classId)
    });
    if (html !== awardSkySummaryHtml || !el.firstChild) {
        el.innerHTML = html;
        awardSkySummaryHtml = html;
    }
    el.classList.remove('hidden');
}

// Clouds drift only while on screen, so a long class never keeps dozens of layers busy.
let awardFloatObserver = null;
function observeAwardFloat(listContainer) {
    if (typeof IntersectionObserver === 'undefined') {
        listContainer.querySelectorAll('.aw-card').forEach((card) => card.classList.add('is-afloat'));
        return;
    }
    if (!awardFloatObserver) {
        awardFloatObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => entry.target.classList.toggle('is-afloat', entry.isIntersecting));
        }, { rootMargin: '80px 0px' });
    }
    awardFloatObserver.disconnect();
    listContainer.querySelectorAll('.aw-card').forEach((card) => awardFloatObserver.observe(card));
}

function renderAwardEmptyState(listContainer, message) {
    awardCardSignatures.clear();
    listContainer.innerHTML = `<p class="aw-empty col-span-full"><i class="fas fa-cloud" aria-hidden="true"></i> ${message}</p>`;
}

/**
 * A cloud's content without the numbers the score listener updates in place (Gold,
 * month and year stars) or the entrance timing, so those never force a redraw.
 */
function awardCardSignature(view) {
    return buildAwardCloudCardHtml({ ...view, gold: 0, month: 0, total: 0, riseDelay: 0, boon: null });
}

/** Which virtue each open (not yet sealed) cloud has picked, by student. */
function captureAwardOpenClouds(root) {
    const open = new Map();
    root.querySelectorAll('.student-cloud-card').forEach((card) => {
        const active = card.querySelector('.reason-btn.active');
        if (active && !card.classList.contains('is-locked')) open.set(card.dataset.studentid, active.dataset.reason);
    });
    return open;
}

/** Reopens a redrawn cloud on the virtue the teacher had picked, quietly (no sound, no burst). */
function restoreAwardOpenCloud(card, reason) {
    if (!card || !reason || card.classList.contains('is-locked')) return;
    const reasonBtn = [...card.querySelectorAll('.reason-btn')].find((btn) => btn.dataset.reason === reason);
    const starSelector = card.querySelector('.star-selector-container');
    if (!reasonBtn || !starSelector) return;
    reasonBtn.classList.add('active');
    reasonBtn.setAttribute('aria-pressed', 'true');
    starSelector.classList.add('visible');
    starSelector.setAttribute('data-aura', reason);
    card.dataset.aura = reason;
}

function mountFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
}

/**
 * Brings the cloud list up to date without wiping it: clouds whose content is unchanged
 * stay exactly as they are (open virtue, float, effects), changed ones are swapped one
 * by one and keep an open virtue, and the order follows `views`.
 */
function patchAwardCloudList(listContainer, views) {
    const existing = new Map();
    listContainer.querySelectorAll('.award-card-mount').forEach((mount) => {
        const id = mount.querySelector('.student-cloud-card')?.dataset.studentid;
        if (id) existing.set(id, mount);
    });
    if (!existing.size) listContainer.innerHTML = '';
    const openClouds = captureAwardOpenClouds(listContainer);
    const keep = new Set();
    let previous = null;

    for (const view of views) {
        const id = String(view.id);
        const signature = awardCardSignature(view);
        let mount = existing.get(id);
        if (!mount || awardCardSignatures.get(id) !== signature) {
            const fresh = mountFromHtml(buildAwardCloudCardHtml(view));
            if (!fresh) continue;
            fresh.classList.remove('tab-mount-rise');
            const oldCard = mount?.querySelector('.student-cloud-card');
            const newCard = fresh.querySelector('.student-cloud-card');
            if (oldCard?.classList.contains('is-afloat')) newCard?.classList.add('is-afloat');
            if (mount) mount.replaceWith(fresh);
            mount = fresh;
            restoreAwardOpenCloud(newCard, openClouds.get(id));
            if (newCard) awardFloatObserver?.observe(newCard);
        }
        awardCardSignatures.set(id, signature);
        keep.add(mount);
        const expected = previous ? previous.nextSibling : listContainer.firstChild;
        if (expected !== mount) listContainer.insertBefore(mount, expected);
        previous = mount;
    }

    [...listContainer.children].forEach((child) => {
        if (keep.has(child)) return;
        const id = child.querySelector?.('.student-cloud-card')?.dataset.studentid;
        if (id) awardCardSignatures.delete(id);
        child.remove();
    });
}

export function renderAwardStarsTab(options = {}) {
    const { preserveStudentOrder = false } = typeof options === 'boolean'
        ? { preserveStudentOrder: options }
        : options;
    const studentListContainer = document.getElementById('award-stars-student-list');
    if (!studentListContainer) return;

    const selectedClassId = state.get('globalSelectedClassId');
    const allTeachersClasses = state.get('allTeachersClasses');

    if (allTeachersClasses.length === 0) {
        renderAwardEmptyState(studentListContainer, 'You must create a class first.');
        renderTeacherBoonLaunchState(null);
        renderAwardSkySummary(null);
        return;
    }

    const selectedClass = selectedClassId ? allTeachersClasses.find(c => c.id === selectedClassId) : null;
    if (selectedClass) {
        renderTeacherBoonLaunchState(selectedClassId);
        renderAwardStarsStudentList(selectedClassId, !preserveStudentOrder);
    } else {
        renderAwardEmptyState(studentListContainer, 'Choose a class from the header to award stars.');
        renderTeacherBoonLaunchState(null);
        renderAwardSkySummary(null);
    }
}

export function renderAwardStarsStudentList(selectedClassId, fullRender = true) {
    const listContainer = document.getElementById('award-stars-student-list');
    if (!listContainer) return;

    const renderContent = () => {
        if (!selectedClassId) {
            renderAwardEmptyState(listContainer, 'Choose a class from the header to award stars.');
            renderAwardSkySummary(null);
            return;
        }

        ensureAwardVisualSession(selectedClassId);

        let studentsInClass = getClassStudents(selectedClassId);

        if (fullRender) {
            for (let i = studentsInClass.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [studentsInClass[i], studentsInClass[j]] = [studentsInClass[j], studentsInClass[i]];
            }
            cacheAwardStudentOrder(selectedClassId, studentsInClass);
        } else {
            studentsInClass = sortStudentsByAwardOrder(selectedClassId, studentsInClass);
        }

        renderAwardSkySummary(selectedClassId);

        if (studentsInClass.length === 0) {
            renderAwardEmptyState(listContainer, 'No students in this class yet. Add some in "My Classes"!');
            return;
        }

        const ctx = buildAwardClassContext(selectedClassId, studentsInClass);
        const views = studentsInClass.map((s, index) => buildStudentCloudView(s, ctx, fullRender ? index : 0));
        if (fullRender) {
            listContainer.innerHTML = views.map((view) => buildAwardCloudCardHtml(view)).join('');
            awardCardSignatures.clear();
            views.forEach((view) => awardCardSignatures.set(String(view.id), awardCardSignature(view)));
            observeAwardFloat(listContainer);
        } else {
            // Live updates (often another teacher's change) patch only the clouds that
            // changed, so an open cloud never snaps shut or flashes under the teacher.
            const hadCards = Boolean(listContainer.querySelector('.award-card-mount'));
            patchAwardCloudList(listContainer, views);
            syncAwardBoonButtons(ctx);
            if (!hadCards) observeAwardFloat(listContainer);
        }

        // Last month's Prodigy comes from the network on the first visit of a month:
        // paint the clouds now, crown the prodigy when the answer lands.
        const known = ctx.prodigySet;
        void getReigningProdigyForClass(selectedClassId).then((prodigies) => {
            if (state.get('globalSelectedClassId') !== selectedClassId) return;
            const changed = [...prodigies].filter((id) => !known.has(id)).concat([...known].filter((id) => !prodigies.has(id)));
            // A tie turns every winner into a Co-Prodigy, so a size change repaints them all.
            if (prodigies.size !== known.size) changed.push(...prodigies);
            new Set(changed).forEach((id) => refreshAwardCloud(id));
        }).catch(() => {});
    };

    if (fullRender) {
        listContainer.classList.remove('fade-in');
        listContainer.classList.add('fade-out');
        setTimeout(() => {
            try {
                renderContent();
            } catch (e) {
                console.warn('Award tab: failed to render student list', e);
            } finally {
                listContainer.classList.remove('fade-out');
                listContainer.classList.add('fade-in');
            }
        }, 120);
    } else {
        try {
            renderContent();
        } catch (e) {
            console.warn('Award tab: failed to render student list', e);
        }
    }
}

/** Redraws one hero's cloud in place (attendance changes, the prodigy crown arriving). */
export function refreshAwardCloud(studentId) {
    const card = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    const classId = state.get('globalSelectedClassId');
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    if (!card || !student || student.classId !== classId) return;

    const ctx = buildAwardClassContext(classId, getClassStudents(classId));
    const view = buildStudentCloudView(student, ctx);
    const signature = awardCardSignature(view);
    if (awardCardSignatures.get(String(studentId)) === signature) return;
    const template = document.createElement('template');
    template.innerHTML = buildAwardCloudCardHtml(view);
    const fresh = template.content.querySelector('.student-cloud-card');
    if (!fresh) return;
    const openReason = card.classList.contains('is-locked') ? null : card.querySelector('.reason-btn.active')?.dataset.reason;
    if (card.classList.contains('is-afloat')) fresh.classList.add('is-afloat');
    card.replaceWith(fresh);
    restoreAwardOpenCloud(fresh, openReason);
    awardCardSignatures.set(String(studentId), signature);
    awardFloatObserver?.observe(fresh);
    renderAwardSkySummary(classId);
}

export function updateStudentCardAttendanceState(studentId) {
    const selectedClassId = state.get('globalSelectedClassId');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student || student.classId !== selectedClassId) return;
    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    if (activeTab && activeTab.id === 'award-stars-tab') refreshAwardCloud(studentId);
}

/**
 * After an award or an undo: seal or reopen the cloud without redrawing it (effects are
 * still flying). The cloud always shows today's stars as this teacher sees them, an award
 * still saving included, so a late or stale snapshot can't flip it back for a moment.
 */
export function updateAwardCardState(studentId) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;

    const shownToday = getEffectiveTodaysStars()[studentId];
    const starsToday = shownToday?.stars ?? 0;
    const reason = shownToday?.reason ?? null;
    const stars = Number(starsToday) || 0;
    const locked = stars > 0 && reason !== 'welcome_back';
    const wasLocked = studentCard.classList.contains('is-locked');
    const wasAbsent = studentCard.classList.contains('is-absent');

    const todayStarsEl = studentCard.querySelector(`#today-stars-${studentId}`);
    const shown = formatAwardStars(stars);
    if (todayStarsEl && todayStarsEl.textContent !== shown) {
        todayStarsEl.textContent = shown;
        const item = todayStarsEl.closest('.aw-tally__item');
        item?.querySelectorAll('.aw-tally__pip').forEach((pip, i) => pip.classList.toggle('is-lit', stars >= i + 1));
        if (item) {
            item.classList.remove('counter-animate');
            void item.offsetWidth;
            item.classList.add('counter-animate');
            setTimeout(() => item.classList.remove('counter-animate'), 700);
        }
    }

    const classId = state.get('globalSelectedClassId');
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const ctx = student && student.classId === classId
        ? buildAwardClassContext(classId, getClassStudents(classId))
        : null;
    const view = ctx ? buildStudentCloudView(student, ctx) : null;

    // Attendance moved (a welcome back, a present mark): the whole cloud changes shape.
    if (view && view.isAbsent !== wasAbsent) {
        refreshAwardCloud(studentId);
        return;
    }

    if (locked !== wasLocked || (locked && studentCard.dataset.awarded !== reason)) {
        const sealView = { ...(view || {}), id: studentId, today: stars, todayReason: reason, locked };
        studentCard.classList.toggle('is-locked', locked);
        if (locked) studentCard.dataset.awarded = reason || '';
        else delete studentCard.dataset.awarded;
        const virtues = studentCard.querySelector('.aw-virtues');
        if (virtues) virtues.outerHTML = buildAwardVirtuesHtml(sealView);
        const finale = studentCard.querySelector('.aw-card__finale');
        if (finale) finale.innerHTML = buildAwardFinaleHtml(sealView);
        studentCard.querySelector('.post-award-undo-btn')?.classList.toggle('hidden', !locked);
        studentCard.removeAttribute('data-aura');
    } else if (locked) {
        // The saved award can be bigger than the tap (a 2x day, the Hero's Boon): keep the seal honest.
        const sealStars = studentCard.querySelector('.aw-seal__stars');
        if (sealStars && sealStars.textContent.trim() !== `+${shown}`) {
            const finale = studentCard.querySelector('.aw-card__finale');
            if (finale) finale.innerHTML = buildAwardFinaleHtml({ ...(view || {}), id: studentId, today: stars, todayReason: reason, locked });
        }
    }

    if (view) {
        const corner = studentCard.querySelector('.absence-controls');
        const cornerHtml = view.attendanceMode === 'absent-offer' ? buildAwardAttendanceHtml('absent-offer', view.firstName) : '';
        if (corner && corner.innerHTML !== cornerHtml) corner.innerHTML = cornerHtml;
        const honours = studentCard.querySelector('.aw-card__honours');
        const honoursHtml = buildAwardHonoursHtml(view.honours);
        if (honours && honours.innerHTML !== honoursHtml) honours.innerHTML = honoursHtml;
        // The cloud now matches this view, so the next live redraw leaves it (and its effects) alone.
        awardCardSignatures.set(String(studentId), awardCardSignature(view));
    }

    renderAwardSkySummary(classId);
}

/**
 * Re-calculates boon eligibility from current state and updates all .boon-btn elements
 * in the award tab in-place. Also refreshes the teacher boon launch button.
 * Safe to call whenever scores or award-logs change.
 */
export function updateAwardBoonButtons(selectedClassId) {
    if (!selectedClassId) return;

    const awardStarsTab = document.getElementById('award-stars-tab');
    if (!awardStarsTab || awardStarsTab.classList.contains('hidden')) return;

    const studentsInClass = getClassStudents(selectedClassId);
    if (!studentsInClass.length) return;

    const ctx = buildAwardClassContext(selectedClassId, studentsInClass);
    syncAwardBoonButtons(ctx);

    // Refresh teacher boon launch button
    renderTeacherBoonLaunchState(selectedClassId);
    renderAwardSkySummary(selectedClassId);
}

/** Hero's Boon buttons follow the class standings in place (they are not part of a cloud's redraw signature). */
function syncAwardBoonButtons(ctx) {
    document.querySelectorAll('#award-stars-student-list .boon-btn[data-receiver-id]').forEach((btn) => {
        const receiverId = btn.dataset.receiverId;
        const eligible = isBoonEligible(ctx, receiverId);
        if (btn.classList.contains('aw-boon--ready') === eligible && btn.dataset.limit === String(ctx.dailyLimitReached)) return;
        const template = document.createElement('template');
        template.innerHTML = buildAwardBoonButtonHtml(receiverId, { eligible, dailyLimitReached: ctx.dailyLimitReached });
        const fresh = template.content.firstElementChild;
        fresh.dataset.limit = String(ctx.dailyLimitReached);
        btn.replaceWith(fresh);
    });
}
