import { quietly } from '../utils/runtimeMetrics.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { escapeHtml } from '../features/roles/shared.js';
import { normalizeChroniclerText } from '../features/adventurePageCore.mjs';
import { sumLiveMonthlyStarsFromStudentScores, getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import { getUpcomingScheduledAssessment } from '../features/assessmentConfig.js';
import { playSound } from '../audio.js';
import { canUseFeature } from '../utils/subscription.js';
import { getHomeGlobalTools, getHomeClassActions, getClassToolCounts } from '../features/homeGlobalTools.mjs';
import {
    resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';
import { buildScheduleEmptySceneHtml, buildScheduleDayNoteHtml } from '../utils/scheduleEmptyScene.js';
import { isSchoolYearAwaitingOpen } from '../utils/schoolYear.js';
import { sumLiveYearGoldFromAppState } from '../utils/yearGold.js';
import { getGreetingSkyHtml, getDayRingEmblemHtml, startDayRingClock, syncDayRing } from '../features/homeGreetingScene.js';
import { morphInto } from '../utils/domMorph.mjs';
import {
    currentHomeGreeting, greetingTitleInnerHtml, greetingLineInnerHtml, greetingGlintHtml, greetingBadgesHtml,
    classNudge, playGreetingIntro, followSkyWithGreeting, keepGreetingPart, GREETING_SCRIPT_CLASSES
} from '../features/homeGreeting.js';
import { getCuratedDailyQuote, isCuratedDailyQuote } from '../utils/dailyQuote.mjs';
import { buildHomeQuestRoadCardHtml } from '../features/homeQuestRoadCard.mjs';
import { buildHomePartyCardHtml } from '../features/homePartyCard.mjs';
import { describeLessonTimeline } from './homeTimeline.mjs';

const SCHEDULE_GRADIENTS = [
    'from-red-100 to-red-200', 'from-orange-100 to-orange-200', 'from-amber-100 to-amber-200',
    'from-green-100 to-green-200', 'from-emerald-100 to-emerald-200', 'from-teal-100 to-teal-200',
    'from-cyan-100 to-cyan-200', 'from-sky-100 to-sky-200', 'from-blue-100 to-blue-200',
    'from-indigo-100 to-indigo-200', 'from-violet-100 to-violet-200', 'from-purple-100 to-purple-200',
    'from-fuchsia-100 to-fuchsia-200', 'from-pink-100 to-pink-200', 'from-rose-100 to-rose-200'
];

let subscribed = false;
let renderDebounce = null;
let minuteTicker = null;
let lastHtml = '';
let lastViewKey = null;

/**
 * A live refresh of the same view (a colleague's stars, new attendance) patches the cards in
 * place instead of redrawing them, so they don't replay their entrance each time. The sky and
 * hills are painted by the sky stage and the day ring runs its own clock, so those stay put.
 */
const MOBILE_HOME_MORPH = {
    keep(from, to) {
        if (from.classList.contains('greeting-sky') && to.classList.contains('greeting-sky')) return true;
        if (keepGreetingPart(from, to)) return true;
        if (from.hasAttribute('data-day-ring') && to.hasAttribute('data-day-ring')) return syncDayRing(from, to);
        return false;
    },
    keepClasses: ['m-hpage--open', 'm-home-pop', ...GREETING_SCRIPT_CLASSES],
};
let cachedQuote = '';
let cachedQuoteDay = null;

/** A section's heading: a small coloured gem, the title and an optional note on the right. */
function sectionHead(icon, tone, title, aside = '') {
    return `
        <header class="m-hsec">
            <span class="m-hsec__gem" data-tone="${tone}" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <h2 class="m-hsec__title">${title}</h2>
            ${aside ? `<span class="m-hsec__aside">${aside}</span>` : ''}
        </header>`;
}

/** Daily Wisdom as a little ribbon resting on the greeting's hills. */
function dailyQuoteRibbonHtml() {
    const todayKey = utils.getLocalIsoDateString();
    if (cachedQuoteDay && cachedQuoteDay !== todayKey) {
        cachedQuote = '';
        cachedQuoteDay = null;
    }
    const desktopQuote = document.getElementById('header-quote-text')?.textContent?.trim().replace(/^["“]|["”]$/g, '');
    const quote = cachedQuote
        || (desktopQuote && desktopQuote !== 'Loading wisdom...' ? desktopQuote : getCuratedDailyQuote(todayKey));
    return `
        <figure class="m-hquote" id="m-daily-quote-card">
            <span class="m-hquote__mark" aria-hidden="true">“</span>
            <blockquote id="m-daily-quote-text" class="m-hquote__text">${escapeHtml(quote)}</blockquote>
            <figcaption class="m-hquote__label"><i class="fas fa-feather-pointed" aria-hidden="true"></i>Daily Wisdom</figcaption>
        </figure>`;
}

function ensureDailyQuoteFetched() {
    const todayKey = utils.getLocalIsoDateString();
    if (cachedQuoteDay && cachedQuoteDay !== todayKey) {
        cachedQuote = '';
        cachedQuoteDay = null;
    }
    // Keep refetching while we only have the day's curated line so a later AI
    // success can replace it within the same session.
    if (cachedQuote && !isCuratedDailyQuote(cachedQuote)) return;
    import('../features/home.js').then((homeModule) => {
        homeModule.fetchDailySpice?.().then((s) => {
            if (s?.headerQuote) {
                cachedQuote = String(s.headerQuote).replace(/^["“]|["”]$/g, '');
                cachedQuoteDay = todayKey;
                const el = document.getElementById('m-daily-quote-text');
                if (el) el.textContent = cachedQuote;
            }
        }).catch(quietly('mobile/home.js'));
    });
}

function getGreeting() {
    const { greeting, gradient, part } = utils.getCurrentDayPart();
    return { label: greeting, gradient, part: part || 'afternoon' };
}

/**
 * The phone hero: the desktop greeting's painted hills and live day ring, the same words
 * (greeting the class or the whole school), the school and teacher badges, today's
 * birthdays and name days, and the Daily Wisdom ribbon on the hills.
 */
function heroHtml(greeting, logo, badges, reminders) {
    const words = currentHomeGreeting();
    return `
        <section class="m-home-hero m-home-card greeting-panel greeting-panel--${greeting.part} card-appear-m" style="--stagger:0" data-greeting-key="${escapeHtml(words.key)}">
            ${getGreetingSkyHtml()}
            ${greetingGlintHtml()}
            ${getDayRingEmblemHtml(escapeHtml(logo), { intro: false })}
            <p class="m-home-hero__greeting" data-greeting-title data-text="${escapeHtml(`${words.hello}|${words.name}`)}">${greetingTitleInnerHtml(words)}</p>
            <p class="greeting-line m-home-hero__line" data-greeting-line data-text="${escapeHtml(words.line)}">${greetingLineInnerHtml(words)}</p>
            <div class="greeting-chips m-home-hero__badges">${badges}</div>
            ${reminders.length ? `<div class="m-home-hero__reminders">${reminders.join('')}</div>` : ''}
            ${dailyQuoteRibbonHtml()}
        </section>`;
}

/** Today's birthdays and name days, for one class or for all of the teacher's classes. */
function getTodayReminders(classId) {
    const now = new Date();
    const suffix = `-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let students = state.get('allStudents') || [];
    if (classId) {
        students = students.filter((s) => s.classId === classId);
    } else {
        const myIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
        students = students.filter((s) => myIds.has(s.classId));
    }
    const first = (s) => escapeHtml(String(s.name || '').split(/\s+/)[0] || s.name || '');
    const birthdays = students.filter((s) => s.birthday && String(s.birthday).endsWith(suffix))
        .map((s) => `<span class="m-hpill m-hpill--birthday"><span aria-hidden="true">🎂</span><span>Happy birthday, <b>${first(s)}</b>!</span></span>`);
    const namedays = students.filter((s) => s.nameday && String(s.nameday).endsWith(suffix))
        .map((s) => `<span class="m-hpill m-hpill--nameday"><span aria-hidden="true">🌿</span><span>Happy name day, <b>${first(s)}</b>!</span></span>`);
    return [...birthdays, ...namedays];
}

function todaysLessons() {
    if (isSchoolYearAwaitingOpen(state.get('schoolYearState'))) return [];
    return utils.getClassesOnDay(
        utils.getTodayDateString(),
        state.get('allSchoolClasses') || [],
        state.get('allScheduleOverrides') || [],
        state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
    );
}

/** The general view's "N classes today" badge, same words as the desktop greeting. */
function todayChipHtml() {
    const todays = todaysLessons();
    if (!todays.length) return '';
    const myIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    const mine = todays.filter((c) => myIds.has(c.id)).length;
    return `<span class="greeting-chip greeting-chip--today" style="--ci:2"><i class="fas fa-school"></i>${todays.length} ${todays.length === 1 ? 'class' : 'classes'} today${mine ? `<small>${mine} yours</small>` : ''}</span>`;
}

/**
 * Today's lessons as a timeline: the one on now glows with the minutes left, the next one
 * counts down, finished ones fade. Your classes open on tap; a colleague's opens view-only.
 */
function getTimelineHtml() {
    const today = utils.getTodayDateString();
    const classes = state.get('allSchoolClasses') || [];
    const lessons = todaysLessons();

    if (!lessons.length) {
        const emptyState = resolveScheduleEmptyState({
            date: utils.parseFlexibleDate(today) || new Date(),
            schoolYearState: state.get('schoolYearState'),
            allSchoolClasses: classes,
            allScheduleOverrides: state.get('allScheduleOverrides') || [],
            schoolHolidayRanges: state.get('schoolHolidayRanges') || [],
            classEndDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        });
        return buildScheduleEmptySceneHtml(emptyState, { compact: true });
    }

    const myIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    const activeId = state.get('globalSelectedClassId');
    const dayNote = buildScheduleDayNoteHtml(utils.parseFlexibleDate(today) || new Date(), { compact: true });
    const rows = describeLessonTimeline(lessons, new Date()).map(({ cls: c, status, next, label, progress }) => {
        const isMine = myIds.has(c.id);
        const gradient = SCHEDULE_GRADIENTS[utils.simpleHashCode(c.id) % SCHEDULE_GRADIENTS.length];
        const level = escapeHtml(c.questLevel || 'Quest');
        // Your own classes wear a little crown; a colleague's name their teacher.
        const meta = isMine ? level : `${level} · ${escapeHtml(c.createdBy?.name || 'Colleague')}`;
        let badge = '';
        if (status === 'now') badge = `<span class="m-tl__badge m-tl__badge--now"><i class="fas fa-circle" aria-hidden="true"></i>Now<small>${escapeHtml(label)}</small></span>`;
        else if (next) badge = `<span class="m-tl__badge m-tl__badge--next">Next<small>${escapeHtml(label)}</small></span>`;
        else if (status === 'past') badge = '<span class="m-tl__badge m-tl__badge--done"><i class="fas fa-check" aria-hidden="true"></i></span>';
        const tail = badge || (isMine
            ? '<i class="fas fa-chevron-right m-tl__chev" aria-hidden="true"></i>'
            : '<i class="fas fa-eye m-tl__chev" aria-hidden="true"></i>');
        return `
            <li class="m-tl__item is-${status}${next ? ' is-next' : ''}${isMine ? ' is-mine' : ''}${c.id === activeId ? ' is-active' : ''}">
                <span class="m-tl__time"><b>${escapeHtml(c.timeStart || '—')}</b>${c.timeEnd ? `<small>${escapeHtml(c.timeEnd)}</small>` : ''}</span>
                <span class="m-tl__rail" aria-hidden="true"><span class="m-tl__dot"></span></span>
                <button type="button" class="m-tl__card m-pressable"
                    ${isMine ? `data-m-quick-class="${escapeHtml(c.id)}"` : `data-m-peek-class="${escapeHtml(c.id)}"`}
                    aria-label="${isMine ? `Open ${escapeHtml(c.name)}` : `View roster for ${escapeHtml(c.name)} (view only)`}">
                    <span class="m-tl__logo bg-linear-to-br ${gradient}" aria-hidden="true">${escapeHtml(c.logo || '📚')}</span>
                    <span class="m-tl__body">
                        <strong>${escapeHtml(c.name)}</strong>
                        <small>${isMine ? '<i class="fas fa-crown" aria-hidden="true"></i>' : ''}${meta}</small>
                    </span>
                    ${tail}
                    ${status === 'now' ? `<span class="m-tl__bar" style="--p:${(progress * 100).toFixed(1)}%" aria-hidden="true"></span>` : ''}
                </button>
            </li>`;
    }).join('');
    return `${dayNote}<ol class="m-tl">${rows}</ol>`;
}

function timelineAside() {
    const n = todaysLessons().length;
    return n ? `${n} ${n === 1 ? 'lesson' : 'lessons'}` : '';
}

/** The Chronicle: homework, the class story and the last diary page, as pages to swipe. */
function getChronicleHtml(classId) {
    const story = state.get('currentStoryData')?.[classId];
    const lastAssignment = (state.get('allQuestAssignments') || [])
        .filter((a) => a.classId === classId)
        .sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0))[0];
    const lastLog = (state.get('allAdventureLogs') || [])
        .filter((l) => l.classId === classId)
        .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date))[0];

    const scheduledTest = getUpcomingScheduledAssessment(classId);
    const testChip = scheduledTest
        ? `<span class="m-hpage__chip"><i class="fas fa-${escapeHtml(scheduledTest.icon)}" aria-hidden="true"></i>${escapeHtml(scheduledTest.testData.title)} · ${escapeHtml(scheduledTest.statusLabel)}</span>`
        : '';
    const logDay = lastLog
        ? new Date(utils.parseDDMMYYYY(lastLog.date)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
        : '';

    const page = ({ kind, icon, kicker, text, empty, extra = '', tab, tabLabel }) => `
        <article class="m-hpage m-hpage--${kind}${empty ? ' is-empty' : ''}">
            <button type="button" class="m-hpage__main" data-m-expand-target aria-label="${escapeHtml(kicker)}: show all">
                <span class="m-hpage__kicker"><span class="m-hpage__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>${kicker}</span>
                <span class="m-hpage__text">${text}</span>
                ${extra}
            </button>
            <button type="button" class="m-hpage__open" data-m-quick-tab="${tab}">${tabLabel}<i class="fas fa-arrow-right" aria-hidden="true"></i></button>
        </article>`;

    return [
        page({
            kind: 'homework', icon: 'fa-book', kicker: 'Homework',
            text: escapeHtml(lastAssignment ? lastAssignment.text : 'No homework set yet.'),
            empty: !lastAssignment, extra: testChip, tab: 'adventure-log-tab', tabLabel: 'Adventure Log'
        }),
        page({
            kind: 'story', icon: 'fa-feather-alt', kicker: story?.currentWord ? `Story · <em>${escapeHtml(story.currentWord)}</em>` : 'Story',
            text: story?.currentSentence ? `“${escapeHtml(story.currentSentence)}”` : 'The story awaits its first chapter…',
            empty: !story?.currentSentence, tab: 'reward-ideas-tab', tabLabel: 'Story Weavers'
        }),
        page({
            kind: 'log', icon: 'fa-compass', kicker: lastLog ? escapeHtml(logDay) : 'Adventure Log',
            text: escapeHtml(lastLog ? normalizeChroniclerText(lastLog.text) : 'No adventures written yet.'),
            empty: !lastLog, tab: 'adventure-log-tab', tabLabel: 'Open diary'
        })
    ].join('');
}

/** Same Global Tools as desktop Home: only what the dock does not reach in one tap. */
function getMobileGlobalTools() {
    const myClasses = state.get('allTeachersClasses') || [];
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const myTodaysClasses = todaysLessons().filter((c) => myClassIds.has(c.id));
    return getHomeGlobalTools({ canUseFeature, myLessonsToday: myTodaysClasses.length, myClassCount: myClasses.length });
}

function getMobileClassActions(classId) {
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || {};
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const today = utils.getTodayDateString();
    const absentIds = absentTodayIds(classId);
    const boon = classData.teacherBoons?.[utils.getLocalMonthKey()] || null;
    const boonHero = boon ? students.find((s) => s.id === boon.studentId) : null;
    return getHomeClassActions({
        classId,
        heroCount: students.length,
        absentToday: absentIds.size,
        boonWindow: utils.isTeacherBoonWindow(),
        boonGivenTo: boonHero ? String(boonHero.name || '').split(/\s+/)[0] : '',
        ...getClassToolCounts({ classData, studentIds: students.map((s) => s.id), absentIds, dateKey: today }),
        projector: false,
    });
}

/** Each tool is a gem tile with its name and a live hint ("1 away today", "Split 5 into teams"). */
function getQuickActionHtml(classId) {
    const tools = classId ? getMobileClassActions(classId) : getMobileGlobalTools();
    return tools.map((tool) => `
        <button type="button"
            class="m-hact m-pressable" data-tone="${tool.tone}"
            ${tool.tab ? `data-m-quick-tab="${tool.tab}"` : `data-m-quick-action="${tool.action}"`}
            ${tool.subtab ? `data-m-quick-subtab="${tool.subtab}"` : ''}
            aria-label="${escapeHtml(tool.label)}${tool.hint ? `: ${escapeHtml(tool.hint)}` : ''}">
            <span class="m-hact__gem" aria-hidden="true"><i class="fas ${tool.icon}"></i></span>
            <span class="m-hact__text">
                <strong>${escapeHtml(tool.label)}</strong>
                ${tool.hint ? `<small>${escapeHtml(tool.hint)}</small>` : ''}
            </span>
        </button>`).join('');
}

function absentTodayIds(classId) {
    const today = utils.getTodayDateString();
    return new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today)
        .map((r) => r.studentId));
}

/** This month's stars per award reason for the class photo's virtue crest (same count as desktop Home). */
function monthVirtueStars(classId) {
    const monthKey = utils.getMonthKey(new Date());
    const logMonthKey = (l) => {
        const at = l?.createdAt;
        const d = at ? (typeof at.toDate === 'function' ? at.toDate() : new Date(at?.seconds ? at.seconds * 1000 : at)) : null;
        if (d && !Number.isNaN(d.getTime())) return utils.getMonthKey(d);
        return typeof l?.date === 'string' && l.date ? utils.getMonthKey(utils.parseDDMMYYYY(l.date)) : null;
    };
    const virtueStars = {};
    (state.get('allAwardLogs') || []).forEach((l) => {
        if (l.classId !== classId || !l.reason || logMonthKey(l) !== monthKey) return;
        virtueStars[l.reason] = (virtueStars[l.reason] || 0) + getAwardLogMonthlyStarCredit(l);
    });
    return virtueStars;
}

function renderClassView(classData) {
    const greeting = getGreeting();
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classData.id);
    const scores = state.get('allStudentScores') || [];

    const { totalStars: monthlyStars, classBonus } = utils.getClassMonthlyQuestStars(classData, students, scores, new Date());
    let goal = utils.calculateMonthlyClassGoal(
        classData,
        students.length,
        state.get('schoolHolidayRanges'),
        state.get('allScheduleOverrides')
    );
    if (goal < 18) goal = 18;

    const partyHeroes = students.map((s) => {
        const score = scores.find((sc) => sc.id === s.id);
        return { id: s.id, name: s.name, avatar: s.avatar, monthlyStars: score?.monthlyStars || 0, pendingSkillChoice: !!score?.pendingSkillChoice };
    });

    return `
        ${heroHtml(greeting, classData.logo || '✨', greetingBadgesHtml({ nudge: classNudge(monthlyStars, goal) }), getTodayReminders(classData.id))}

        <div class="m-home-slot m-home-slot--road card-appear-m" style="--stagger:1">
            ${buildHomeQuestRoadCardHtml({ stars: monthlyStars, goal, bonus: classBonus, logo: classData.logo || '📚' })}
        </div>

        <div class="m-home-slot m-home-slot--party card-appear-m" style="--stagger:2">
            ${buildHomePartyCardHtml({ students: partyHeroes, virtueStars: monthVirtueStars(classData.id), absentIds: absentTodayIds(classData.id) })}
        </div>

        <section class="m-home-card m-home-panel card-appear-m" style="--stagger:3">
            ${sectionHead('fa-wand-magic-sparkles', 'violet', 'Class actions')}
            <div class="m-hacts">${getQuickActionHtml(classData.id)}</div>
        </section>

        <section class="m-home-panel m-home-panel--bare card-appear-m" style="--stagger:4">
            ${sectionHead('fa-book-open', 'amber', 'The Chronicle', '<span class="m-hsec__swipe">Swipe <i class="fas fa-arrow-right-long" aria-hidden="true"></i></span>')}
            <div class="m-hpages">${getChronicleHtml(classData.id)}</div>
        </section>

        <section class="m-home-card m-home-panel card-appear-m" style="--stagger:5">
            ${sectionHead('fa-clock', 'sky', "Today's lessons", timelineAside())}
            ${getTimelineHtml()}
        </section>`;
}

function renderGeneralView() {
    const greeting = getGreeting();
    const allScores = state.get('allStudentScores') || [];
    const schoolStars = sumLiveMonthlyStarsFromStudentScores(allScores);
    const totalGold = sumLiveYearGoldFromAppState(allScores, state);
    const heroes = (state.get('allStudents') || []).filter((s) => s.classId).length;

    const stat = (tone, icon, num, label, sub) => `
        <div class="m-hstat" data-tone="${tone}">
            <i class="fas ${icon} m-hstat__mark" aria-hidden="true"></i>
            <span class="m-hstat__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <strong class="m-hstat__num">${num}</strong>
            <span class="m-hstat__label">${label}</span>
            <small>${sub}</small>
        </div>`;

    return `
        ${heroHtml(greeting, '🏫', greetingBadgesHtml({ todayChip: todayChipHtml() }), getTodayReminders(null))}

        <section class="m-home-card m-home-panel card-appear-m" style="--stagger:1">
            ${sectionHead('fa-clock', 'sky', "Today's lessons", timelineAside())}
            ${getTimelineHtml()}
        </section>

        <div class="m-hstats card-appear-m" style="--stagger:2">
            ${stat('sun', 'fa-star', schoolStars, 'School stars', 'this month')}
            ${stat('sky', 'fa-users', heroes, 'Heroes', 'on the rolls')}
            ${stat('royal', 'fa-coins', totalGold, 'Treasury', 'gold this year')}
        </div>

        <section class="m-home-card m-home-panel card-appear-m" style="--stagger:3">
            ${sectionHead('fa-toolbox', 'emerald', 'Global tools')}
            <div class="m-hacts">${getQuickActionHtml(null)}</div>
        </section>`;
}

function render() {
    const container = document.getElementById('home-dashboard-mobile');
    if (!container || !document.body.classList.contains('gcq-mobile')) return;

    if (!state.get('allSchoolClasses')) {
        lastHtml = '';
        lastViewKey = null;
        container.innerHTML = `
            <div class="m-home" aria-hidden="true">
                <div class="animate-pulse space-y-3">
                    <div class="h-28 bg-slate-200/70 rounded-3xl"></div>
                    <div class="h-24 bg-slate-200/70 rounded-3xl"></div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="h-24 bg-slate-200/70 rounded-3xl"></div>
                        <div class="h-24 bg-slate-200/70 rounded-3xl"></div>
                        <div class="h-24 bg-slate-200/70 rounded-3xl"></div>
                    </div>
                </div>
            </div>`;
        return;
    }

    const activeClassId = state.get('globalSelectedClassId');
    const classes = state.get('allSchoolClasses') || [];
    const classData = activeClassId ? classes.find((c) => c.id === activeClassId) : null;

    const html = `<div class="m-home">${classData ? renderClassView(classData) : renderGeneralView()}</div>`;
    // The hills get fresh gradient ids on every draw; they alone don't make it a change.
    const sameAsBefore = html.replace(/\bgh-\d+-/g, 'gh-');
    if (sameAsBefore === lastHtml) return;
    lastHtml = sameAsBefore;

    const viewKey = classData ? `class:${classData.id}` : 'general';
    if (viewKey === lastViewKey && container.firstElementChild?.classList.contains('m-home')) {
        morphInto(container, html, MOBILE_HOME_MORPH);
    } else {
        container.innerHTML = html;
        playGreetingIntro(container.querySelector('.m-home-hero'));
    }
    followSkyWithGreeting();
    lastViewKey = viewKey;
    startDayRingClock(container);
}

function attachHomeListeners() {
    const root = document.getElementById('home-dashboard-mobile');
    if (!root) return;

    const pop = (el) => {
        if (!el) return;
        el.classList.remove('m-home-pop');
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth;
        el.classList.add('m-home-pop');
        window.setTimeout(() => el.classList.remove('m-home-pop'), 450);
    };

    root.addEventListener('click', (event) => {
        const interactive = event.target.closest('.m-hact, .m-tl__card');
        if (interactive) pop(interactive);

        const quickClass = event.target.closest('[data-m-quick-class]');
        if (quickClass) {
            playSound('click');
            state.setGlobalSelectedClass(quickClass.dataset.mQuickClass, true);
            return;
        }

        const peekClass = event.target.closest('[data-m-peek-class]');
        if (peekClass) {
            playSound('click');
            import('../ui/modals/classRoster.js')
                .then((m) => m.openClassRosterModal(peekClass.dataset.mPeekClass))
                .catch((error) => console.error('Class roster unavailable:', error));
            return;
        }

        const quickTab = event.target.closest('[data-m-quick-tab]');
        if (quickTab) {
            playSound('click');
            import('../ui/tabs/index.js').then((tabs) => tabs.showTab(quickTab.dataset.mQuickTab));
            return;
        }

        const quickAction = event.target.closest('[data-m-quick-action]');
        if (quickAction) {
            handleQuickAction(quickAction.dataset.mQuickAction, quickAction.dataset.mQuickSubtab);
            return;
        }

        const expandable = event.target.closest('[data-m-expand-target]');
        if (expandable) {
            playSound('click');
            expandable.closest('.m-hpage')?.classList.toggle('m-hpage--open');
        }
    });
}

async function handleQuickAction(action, subtab) {
    playSound('click');
    const classId = state.get('globalSelectedClassId');

    if (action === 'open-attendance') {
        const modals = await import('../ui/modals/index.js');
        if (classId) modals.openAttendanceChronicle(classId);
    } else if (action === 'open-report') {
        const modals = await import('../ui/modals/index.js');
        if (classId) modals.handleGenerateReport(classId);
    } else if (action === 'edit-class') {
        const modals = await import('../ui/modals/index.js');
        if (classId) modals.openEditClassModal(classId);
    } else if (action === 'open-class-roster') {
        const { openClassRosterModal } = await import('../ui/modals/classRoster.js');
        if (classId) openClassRosterModal(classId);
    } else if (action === 'open-prodigies') {
        const modals = await import('../ui/modals/index.js');
        modals.openProdigyModal();
    } else if (action === 'open-teacher-boon') {
        const modals = await import('../ui/modals/index.js');
        modals.openTeacherBoonModal();
    } else if (action === 'open-student-ranks') {
        const modals = await import('../ui/modals/index.js');
        modals.openStudentRankingsModal();
    } else if (action === 'create-class') {
        const modals = await import('../ui/modals/index.js');
        modals.openCreateClassModal();
    } else if (action === 'open-team-history') {
        const modals = await import('../ui/modals/index.js');
        modals.openHistoryModal('team', { league: null });
    } else if (action === 'open-options') {
        const tabs = await import('../ui/tabs/index.js');
        await tabs.showOptionsSubtab(subtab || 'classes');
    } else if (action === 'open-team-maker') {
        const { openTeamMaker } = await import('../ui/modals/teamMaker.js');
        openTeamMaker(classId || null);
    } else if (action === 'open-fair-picker') {
        const { openFairPicker } = await import('../ui/modals/fairPicker.js');
        openFairPicker(classId || null);
    } else if (action === 'open-hero-duels') {
        const { openHeroDuels } = await import('../ui/modals/heroDuels.js');
        openHeroDuels(classId || null);
    } else if (action === 'open-day-planner') {
        const modals = await import('../ui/modals/index.js');
        modals.openDayPlannerModal(utils.getTodayDateString(), document.body);
    }
}

export function renderMobileHome() {
    // Only fetch once signed in and on the phone layout: before sign-in the
    // cache read is denied and the import pulls the whole teacher UI into the
    // login screen.
    if (state.get('currentUserId') && document.body.classList.contains('gcq-mobile')) {
        ensureDailyQuoteFetched();
    }
    if (renderDebounce) clearTimeout(renderDebounce);
    renderDebounce = setTimeout(() => {
        try {
            render();
        } catch (error) {
            console.warn('Mobile home render failed:', error);
        }
    }, 60);
}

export function initMobileHome() {
    if (subscribed) return;
    subscribed = true;
    state.subscribe(
        [
            'allSchoolClasses', 'allTeachersClasses', 'allStudents', 'allStudentScores',
            'allAwardLogs', 'allAdventureLogs', 'allQuestAssignments', 'currentStoryData',
            'schoolName', 'schoolHolidayRanges', 'allScheduleOverrides', 'teacherSettings',
            'globalSelectedClassId', 'schoolYearState', 'currentTeacherName'
        ],
        () => renderMobileHome()
    );
    attachHomeListeners();
    renderMobileHome();
    // The timeline's "35 min left" and "in 1 h 15" move with the clock. Once a minute is
    // plenty, and only while Home is on screen; an unchanged view costs one string compare.
    if (!minuteTicker) {
        minuteTicker = window.setInterval(() => {
            if (document.hidden || !document.body.classList.contains('gcq-mobile')) return;
            const tab = document.getElementById('about-tab');
            if (!tab || tab.classList.contains('hidden')) return;
            renderMobileHome();
        }, 60000);
    }
}
