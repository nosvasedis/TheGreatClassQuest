import * as state from '../state.js';
import * as utils from '../utils.js';
import { DEFAULT_SCHOOL_NAME } from '../constants.js';
import { escapeHtml } from '../features/roles/shared.js';
import { normalizeChroniclerText } from '../features/adventurePageCore.mjs';
import { sumLiveMonthlyStarsFromStudentScores } from '../features/awardLogReasonMeta.js';
import { getUpcomingScheduledAssessment } from '../features/assessmentConfig.js';
import { playSound } from '../audio.js';
import { canUseFeature } from '../utils/subscription.js';
import { getHomeGlobalTools, getHomeClassActions, getClassToolCounts } from '../features/homeGlobalTools.mjs';
import {
    resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';
import { buildScheduleEmptySceneHtml } from '../utils/scheduleEmptyScene.js';
import { isSchoolYearAwaitingOpen } from '../utils/schoolYear.js';
import { sumLiveYearGoldFromAppState } from '../utils/yearGold.js';
import { getGreetingSkyHtml, getDayRingEmblemHtml, startDayRingClock, syncDayRing } from '../features/homeGreetingScene.js';
import { morphInto } from '../utils/domMorph.mjs';
import { getCuratedDailyQuote, isCuratedDailyQuote } from '../utils/dailyQuote.mjs';

const SCHEDULE_GRADIENTS = [
    'from-red-100 to-red-200', 'from-orange-100 to-orange-200', 'from-amber-100 to-amber-200',
    'from-green-100 to-green-200', 'from-emerald-100 to-emerald-200', 'from-teal-100 to-teal-200',
    'from-cyan-100 to-cyan-200', 'from-sky-100 to-sky-200', 'from-blue-100 to-blue-200',
    'from-indigo-100 to-indigo-200', 'from-violet-100 to-violet-200', 'from-purple-100 to-purple-200',
    'from-fuchsia-100 to-fuchsia-200', 'from-pink-100 to-pink-200', 'from-rose-100 to-rose-200'
];

const REASON_META = {
    teamwork: { icon: 'fa-users', name: 'Teamwork' },
    creativity: { icon: 'fa-lightbulb', name: 'Creativity' },
    respect: { icon: 'fa-hands-helping', name: 'Respect' },
    focus: { icon: 'fa-brain', name: 'Focus' },
    welcome_back: { icon: 'fa-hand-sparkles', name: 'Welcome' },
    story_weaver: { icon: 'fa-feather-alt', name: 'Story' },
    vanishing_hoard: { icon: 'fa-eye', name: 'Hoard' },
    torn_map: { icon: 'fa-compass', name: 'Map' },
    round_table: { icon: 'fa-shield-heart', name: 'Council' },
    scholar_s_bonus: { icon: 'fa-graduation-cap', name: 'Scholar' }
};

let subscribed = false;
let renderDebounce = null;
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
        if (from.hasAttribute('data-day-ring') && to.hasAttribute('data-day-ring')) return syncDayRing(from, to);
        return false;
    },
    keepClasses: ['m-home-quest--entered', 'm-home-chronicle--expanded', 'm-home-pop'],
};
let cachedQuote = '';
let cachedQuoteDay = null;

function getDailyQuoteCardHtml(staggerIndex = 1) {
    const todayKey = utils.getLocalIsoDateString();
    if (cachedQuoteDay && cachedQuoteDay !== todayKey) {
        cachedQuote = '';
        cachedQuoteDay = null;
    }
    const desktopQuote = document.getElementById('header-quote-text')?.textContent?.trim();
    const quote = cachedQuote
        || (desktopQuote && desktopQuote !== 'Loading wisdom...' ? desktopQuote : getCuratedDailyQuote(todayKey));
    return `
        <section class="m-home-card m-home-quote-card card-appear-m" style="--stagger:${staggerIndex}" id="m-daily-quote-card">
            <div class="m-home-quote-card__inner">
                <span class="m-home-quote-card__icon" aria-hidden="true"><i class="fas fa-quote-left"></i></span>
                <div class="m-home-quote-card__body">
                    <span class="m-home-quote-card__label">Daily Wisdom</span>
                    <p id="m-daily-quote-text" class="m-home-quote-card__text">"${escapeHtml(quote)}"</p>
                </div>
                <span class="m-home-quote-card__spark" aria-hidden="true">✨</span>
            </div>
        </section>`;
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
                cachedQuote = s.headerQuote;
                cachedQuoteDay = todayKey;
                const el = document.getElementById('m-daily-quote-text');
                if (el) el.textContent = `"${cachedQuote}"`;
            }
        }).catch(() => {});
    });
}

function getGreeting() {
    const { greeting, gradient, part } = utils.getCurrentDayPart();
    return { label: greeting, gradient, part: part || 'afternoon' };
}

/** The desktop greeting's painted hills and live day ring, sized for the phone hero card. */
function heroSceneHtml(greeting, logo) {
    return `
            ${getGreetingSkyHtml()}
            ${getDayRingEmblemHtml(escapeHtml(logo), { intro: false })}`;
}

function getTopSkill(classId) {
    const reasons = {};
    (state.get('allAwardLogs') || [])
        .filter((log) => log.classId === classId)
        .forEach((log) => {
            if (log.reason) reasons[log.reason] = (reasons[log.reason] || 0) + Number(log.stars || 0);
        });
    const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const meta = REASON_META[top[0]] || { icon: 'fa-star', name: top[0].replace(/_/g, ' ') };
    return { ...meta, stars: top[1] };
}

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
    return students
        .filter((s) => s.birthday && s.birthday.endsWith(suffix))
        .map((s) => `🎂 ${escapeHtml(s.name)} has a birthday today!`);
}

function getClassScheduleRows() {
    const today = utils.getTodayDateString();
    const classes = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const todaysClasses = utils.getClassesOnDay(today, classes, overrides, classEndDates);
    const myIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    const activeId = state.get('globalSelectedClassId');
    const schoolYearState = state.get('schoolYearState');

    if (isSchoolYearAwaitingOpen(schoolYearState) || !todaysClasses.length) {
        const emptyState = resolveScheduleEmptyState({
            date: utils.parseFlexibleDate(today) || new Date(),
            schoolYearState,
            allSchoolClasses: classes,
            allScheduleOverrides: overrides,
            schoolHolidayRanges: state.get('schoolHolidayRanges') || [],
            classEndDates
        });
        return buildScheduleEmptySceneHtml(emptyState, { compact: true });
    }

    return todaysClasses.map((c) => {
        const isMine = myIds.has(c.id);
        const isActive = c.id === activeId;
        const gradient = SCHEDULE_GRADIENTS[utils.simpleHashCode(c.id) % SCHEDULE_GRADIENTS.length];
        return `
            <button type="button"
                class="m-home-schedule-row m-pressable ${isMine ? 'm-home-schedule-row--mine' : ''} ${isActive ? 'm-home-schedule-row--active' : ''}"
                ${isMine ? `data-m-quick-class="${escapeHtml(c.id)}"` : `data-m-peek-class="${escapeHtml(c.id)}"`}
                aria-label="${isMine ? `Open ${escapeHtml(c.name)}` : `View roster for ${escapeHtml(c.name)} (view only)`}">
                <span class="m-home-schedule-row__time">${escapeHtml(c.timeStart || 'TBD')}</span>
                <span class="m-home-schedule-row__logo bg-gradient-to-br ${gradient}">${escapeHtml(c.logo || '📚')}</span>
                <span class="m-home-schedule-row__body">
                    <strong>${escapeHtml(c.name)}</strong>
                    <small>${escapeHtml(c.questLevel || 'Quest')}${isMine ? '' : ` • ${escapeHtml(c.createdBy?.name || 'Teacher')}`}</small>
                </span>
                ${isMine ? '<i class="fas fa-chevron-right m-home-schedule-row__chev" aria-hidden="true"></i>' : '<i class="fas fa-eye m-home-schedule-row__lock" aria-hidden="true"></i>'}
            </button>`;
    }).join('');
}

function getChronicleHtml(classId) {
    const story = state.get('currentStoryData')?.[classId];
    const assignments = state.get('allQuestAssignments') || [];
    const lastAssignment = assignments
        .filter((a) => a.classId === classId)
        .sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0))[0];

    const logs = (state.get('allAdventureLogs') || [])
        .filter((l) => l.classId === classId)
        .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));
    const lastLog = logs[0];

    const scheduledTest = getUpcomingScheduledAssessment(classId);
    const testBadge = scheduledTest
        ? `<span class="m-home-test-chip"><i class="fas fa-${escapeHtml(scheduledTest.icon)}"></i> ${escapeHtml(scheduledTest.testData.title)} • ${escapeHtml(scheduledTest.statusLabel)}</span>`
        : '';

    return `
        <button type="button" class="m-home-chronicle m-pressable" data-m-expand-target>
            <span class="m-home-chronicle__icon m-home-chronicle__icon--indigo"><i class="fas fa-book"></i></span>
            <span class="m-home-chronicle__body">
                <strong>Homework</strong>
                <small>${escapeHtml(lastAssignment ? lastAssignment.text : 'No active homework.')}</small>
                ${testBadge}
            </span>
            <i class="fas fa-chevron-down m-home-chronicle__chev" aria-hidden="true"></i>
        </button>
        <button type="button" class="m-home-chronicle m-pressable" data-m-expand-target>
            <span class="m-home-chronicle__icon m-home-chronicle__icon--cyan"><i class="fas fa-feather-alt"></i></span>
            <span class="m-home-chronicle__body">
                <strong>Story${story?.currentWord ? `: ${escapeHtml(story.currentWord)}` : ''}</strong>
                <small>${story?.currentSentence ? `"${escapeHtml(story.currentSentence)}"` : 'The story awaits its first chapter...'}</small>
            </span>
            <i class="fas fa-chevron-down m-home-chronicle__chev" aria-hidden="true"></i>
        </button>
        <button type="button" class="m-home-chronicle m-pressable" data-m-expand-target>
            <span class="m-home-chronicle__icon m-home-chronicle__icon--emerald"><i class="fas fa-compass"></i></span>
            <span class="m-home-chronicle__body">
                <strong>${lastLog ? `${escapeHtml(new Date(utils.parseDDMMYYYY(lastLog.date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }))} log` : 'Adventure Log'}</strong>
                <small>${lastLog ? escapeHtml(normalizeChroniclerText(lastLog.text)) : 'No adventures chronicled yet.'}</small>
            </span>
            <i class="fas fa-chevron-down m-home-chronicle__chev" aria-hidden="true"></i>
        </button>`;
}

/** Same Global Tools as desktop Home: only what the dock does not reach in one tap. */
function getMobileGlobalTools() {
    const today = utils.getTodayDateString();
    const myClasses = state.get('allTeachersClasses') || [];
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const myTodaysClasses = isSchoolYearAwaitingOpen(state.get('schoolYearState'))
        ? []
        : utils.getClassesOnDay(
            today,
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        ).filter((c) => myClassIds.has(c.id));
    return getHomeGlobalTools({ canUseFeature, myLessonsToday: myTodaysClasses.length, myClassCount: myClasses.length });
}

function getMobileClassActions(classId) {
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || {};
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const today = utils.getTodayDateString();
    const absentIds = new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today)
        .map((r) => r.studentId));
    const absentToday = absentIds.size;
    const boon = classData.teacherBoons?.[utils.getLocalMonthKey()] || null;
    const boonHero = boon ? students.find((s) => s.id === boon.studentId) : null;
    return getHomeClassActions({
        classId,
        heroCount: students.length,
        absentToday,
        boonWindow: utils.isTeacherBoonWindow(),
        boonGivenTo: boonHero ? String(boonHero.name || '').split(/\s+/)[0] : '',
        ...getClassToolCounts({ classData, studentIds: students.map((s) => s.id), absentIds, dateKey: today }),
    });
}

function getQuickActionHtml(classId) {
    const tools = classId
        ? getMobileClassActions(classId)
        : getMobileGlobalTools();

    return tools.map((tool, i) => `
        <button type="button"
            class="m-home-action m-home-action--${tool.tone} m-pressable bubbly-button card-appear-m"
            ${tool.tab ? `data-m-quick-tab="${tool.tab}"` : `data-m-quick-action="${tool.action}"`}
            ${tool.subtab ? `data-m-quick-subtab="${tool.subtab}"` : ''}
            style="--stagger:${i + 2}"
            aria-label="${escapeHtml(tool.label)}">
            <i class="fas ${tool.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(tool.label)}</span>
        </button>`).join('');
}

function renderClassView(classData) {
    const teacherName = state.get('currentTeacherName') || 'Quest Master';
    const schoolName = state.get('schoolName') || DEFAULT_SCHOOL_NAME;
    const greeting = getGreeting();
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classData.id);
    const scores = state.get('allStudentScores') || [];
    const now = new Date();

    const { totalStars: monthlyStars } = utils.getClassMonthlyQuestStars(classData, students, scores, now);
    let goal = utils.calculateMonthlyClassGoal(
        classData,
        students.length,
        state.get('schoolHolidayRanges'),
        state.get('allScheduleOverrides')
    );
    if (goal < 18) goal = 18;
    const progress = Math.min(100, Math.round((monthlyStars / goal) * 100));

    const topSkill = getTopSkill(classData.id);
    const reminders = getTodayReminders(classData.id);

    return `
        <section class="m-home-hero m-home-card greeting-panel greeting-panel--${greeting.part} card-appear-m" style="--stagger:0">
            ${heroSceneHtml(greeting, classData.logo || '✨')}
            <p class="m-home-hero__greeting">
                <span class="text-transparent bg-clip-text bg-gradient-to-r ${greeting.gradient}">${greeting.label}</span>, ${escapeHtml(teacherName)}!
            </p>
            <p class="m-home-hero__school"><i class="fas fa-university" aria-hidden="true"></i> ${escapeHtml(schoolName)}</p>
            ${reminders.length ? `<div class="m-home-hero__reminders">${reminders.join('')}</div>` : ''}
        </section>

        ${getDailyQuoteCardHtml(1)}

        <section class="m-home-quest m-home-card card-appear-m" style="--stagger:2">
            <div class="m-home-quest__heading">
                <span class="m-home-quest__label"><i class="fas fa-route" aria-hidden="true"></i> Quest Progress</span>
                <span class="m-home-quest__stars"><strong>${monthlyStars}</strong> ⭐ this month</span>
            </div>
            <div class="m-home-quest__pct">${progress}<small>%</small></div>
            <div class="m-home-quest__track">
                <div class="m-home-quest__fill" style="--fill:${progress}%"><span class="m-home-quest__shine" aria-hidden="true"></span></div>
            </div>
            <div class="m-home-quest__foot">
                <span>Start</span>
                <span>Goal: ${goal} ⭐</span>
            </div>
        </section>

        <section class="m-home-stats">
            <div class="m-home-stat m-home-stat--sky card-appear-m" style="--stagger:2">
                <span class="m-home-stat__icon"><i class="fas fa-user-graduate" aria-hidden="true"></i></span>
                <div><span>Heroes</span><strong>${students.length}</strong><small>In this class</small></div>
            </div>
            <div class="m-home-stat m-home-stat--amber card-appear-m" style="--stagger:3">
                <span class="m-home-stat__icon"><i class="fas fa-bolt" aria-hidden="true"></i></span>
                <div><span>Top Skill</span><strong class="m-home-stat__skill">${topSkill ? escapeHtml(topSkill.name) : '—'}</strong><small>${topSkill ? `${topSkill.stars} stars` : 'No awards yet'}</small></div>
            </div>
            <div class="m-home-stat m-home-stat--emerald card-appear-m" style="--stagger:4">
                <span class="m-home-stat__icon"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>
                <div><span>Lessons</span><strong>${(state.get('allAttendanceRecords') || []).filter((r) => r.classId === classData.id && r.date === utils.getTodayDateString()).length}</strong><small>Recorded today</small></div>
            </div>
        </section>

        <section class="m-home-card m-home-actions-wrap card-appear-m" style="--stagger:5">
            <p class="m-home-section-title">Class actions</p>
            <div class="m-home-actions">${getQuickActionHtml(classData.id)}</div>
        </section>

        <section class="m-home-card m-home-chronicle-wrap card-appear-m" style="--stagger:6">
            <p class="m-home-section-title">The Chronicle</p>
            <div class="m-home-chronicle-list">${getChronicleHtml(classData.id)}</div>
        </section>

        <section class="m-home-card card-appear-m" style="--stagger:7">
            <p class="m-home-section-title">Today's schedule</p>
            <div class="m-home-schedule">${getClassScheduleRows()}</div>
        </section>`;
}

function renderGeneralView() {
    const teacherName = state.get('currentTeacherName') || 'Quest Master';
    const schoolName = state.get('schoolName') || DEFAULT_SCHOOL_NAME;
    const greeting = getGreeting();
    const allScores = state.get('allStudentScores') || [];
    const schoolStars = sumLiveMonthlyStarsFromStudentScores(allScores);
    const totalGold = sumLiveYearGoldFromAppState(allScores, state);
    const reminders = getTodayReminders(null);

    return `
        <section class="m-home-hero m-home-card greeting-panel greeting-panel--${greeting.part} card-appear-m" style="--stagger:0">
            ${heroSceneHtml(greeting, '🏫')}
            <p class="m-home-hero__greeting">
                <span class="text-transparent bg-clip-text bg-gradient-to-r ${greeting.gradient}">${greeting.label}</span>, ${escapeHtml(teacherName)}!
            </p>
            <p class="m-home-hero__school"><i class="fas fa-university" aria-hidden="true"></i> ${escapeHtml(schoolName)}</p>
            ${reminders.length ? `<div class="m-home-hero__reminders">${reminders.join('')}</div>` : ''}
        </section>

        ${getDailyQuoteCardHtml(1)}

        <section class="m-home-stats">
            <div class="m-home-stat m-home-stat--amber card-appear-m" style="--stagger:1">
                <span class="m-home-stat__icon"><i class="fas fa-star" aria-hidden="true"></i></span>
                <div><span>School Stars</span><strong>${schoolStars}</strong><small>This month</small></div>
            </div>
            <div class="m-home-stat m-home-stat--sky card-appear-m" style="--stagger:2">
                <span class="m-home-stat__icon"><i class="fas fa-users" aria-hidden="true"></i></span>
                <div><span>Heroes</span><strong>${(state.get('allStudents') || []).length}</strong><small>Active students</small></div>
            </div>
            <div class="m-home-stat m-home-stat--royal card-appear-m" style="--stagger:3">
                <span class="m-home-stat__icon"><i class="fas fa-coins" aria-hidden="true"></i></span>
                <div><span>Treasury</span><strong>${totalGold}</strong><small>Gold earned</small></div>
            </div>
        </section>

        <section class="m-home-card m-home-actions-wrap card-appear-m" style="--stagger:4">
            <p class="m-home-section-title">Global tools</p>
            <div class="m-home-actions">${getQuickActionHtml(null)}</div>
        </section>

        <section class="m-home-card card-appear-m" style="--stagger:5">
            <p class="m-home-section-title">School schedule</p>
            <div class="m-home-schedule">${getClassScheduleRows()}</div>
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
    }
    lastViewKey = viewKey;
    startDayRingClock(container);
    requestAnimationFrame(() => {
        const questCard = container.querySelector('.m-home-quest');
        if (questCard) questCard.classList.add('m-home-quest--entered');
    });
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
        const interactive = event.target.closest('.m-home-action, .m-home-schedule-row, .m-home-chronicle, .m-home-stat');
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
            import('../ui/tabs.js').then((tabs) => tabs.showTab(quickTab.dataset.mQuickTab));
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
            expandable.classList.toggle('m-home-chronicle--expanded');
        }
    });
}

async function handleQuickAction(action, subtab) {
    playSound('click');
    const classId = state.get('globalSelectedClassId');

    if (action === 'open-attendance') {
        const modals = await import('../ui/modals.js');
        if (classId) modals.openAttendanceChronicle(classId);
    } else if (action === 'open-report') {
        const modals = await import('../ui/modals.js');
        if (classId) modals.handleGenerateReport(classId);
    } else if (action === 'edit-class') {
        const modals = await import('../ui/modals.js');
        if (classId) modals.openEditClassModal(classId);
    } else if (action === 'open-class-roster') {
        const { openClassRosterModal } = await import('../ui/modals/classRoster.js');
        if (classId) openClassRosterModal(classId);
    } else if (action === 'open-prodigies') {
        const modals = await import('../ui/modals.js');
        modals.openProdigyModal();
    } else if (action === 'open-teacher-boon') {
        const modals = await import('../ui/modals.js');
        modals.openTeacherBoonModal();
    } else if (action === 'open-student-ranks') {
        const modals = await import('../ui/modals.js');
        modals.openStudentRankingsModal();
    } else if (action === 'create-class') {
        const modals = await import('../ui/modals.js');
        modals.openCreateClassModal();
    } else if (action === 'open-team-history') {
        const modals = await import('../ui/modals.js');
        modals.openHistoryModal('team', { league: null });
    } else if (action === 'open-options') {
        const tabs = await import('../ui/tabs.js');
        await tabs.showOptionsSubtab(subtab || 'classes');
    } else if (action === 'open-team-maker') {
        const { openTeamMaker } = await import('../ui/modals/teamMaker.js');
        openTeamMaker(classId || null);
    } else if (action === 'open-fair-picker') {
        const { openFairPicker } = await import('../ui/modals/fairPicker.js');
        openFairPicker(classId || null);
    } else if (action === 'open-day-planner') {
        const modals = await import('../ui/modals.js');
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
            'globalSelectedClassId', 'schoolYearState'
        ],
        () => renderMobileHome()
    );
    attachHomeListeners();
    renderMobileHome();
}
