// Home → Global Tools (school overview, no class selected).
// Only shortcuts the bottom nav bar and the header gear do not already reach in one click.
// Each tile carries a short live hint so it reads as more than an icon.

import { teamsForDay } from './teamMakerCore.mjs';
import { fairStatus, normalizeFairPicker } from './fairPickerCore.mjs';

export const HOME_GLOBAL_TOOL_LIMIT = 6;
/** Class Actions hold two more: Team Maker and Fair Picker live only here, for the selected class. */
export const HOME_CLASS_ACTION_LIMIT = 8;

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

/**
 * @param {object} ctx
 * @param {(flag: string) => boolean} ctx.canUseFeature
 * @param {number} [ctx.myLessonsToday] the teacher's own classes meeting today
 * @param {number} [ctx.myClassCount] classes the teacher runs
 * @returns {{ id: string, icon: string, label: string, hint: string, tone: string, action: string, subtab?: string, scoped?: boolean }[]}
 */
export function getHomeGlobalTools({ canUseFeature, myLessonsToday = 0, myClassCount = 0 }) {
    const can = (flag) => !flag || Boolean(canUseFeature?.(flag));
    const catalog = [
        {
            id: 'plan-today', flag: 'calendar', icon: 'fa-calendar-day', label: 'Plan Today', tone: 'sky',
            action: 'open-day-planner',
            hint: myLessonsToday > 0 ? `${plural(myLessonsToday, 'lesson', 'lessons')} today` : 'No lessons today',
        },
        {
            id: 'new-class', icon: 'fa-plus', label: 'New Class', tone: 'emerald',
            action: 'create-class', scoped: true,
            hint: myClassCount > 0 ? `You run ${plural(myClassCount, 'class', 'classes')}` : 'Start your first class',
        },
        {
            id: 'quiz', flag: 'quizOfTheWeek', icon: 'fa-circle-question', label: 'Quiz of the Week', tone: 'violet',
            action: 'open-options', subtab: 'quiz', hint: "This week's AI quiz",
        },
        {
            id: 'family', flag: 'parentAccess', icon: 'fa-user-shield', label: 'Family Access', tone: 'rose',
            action: 'open-options', subtab: 'access', hint: 'Parent logins',
        },
        {
            id: 'hero-archive', icon: 'fa-crown', label: 'Hero Archive', tone: 'amber',
            action: 'open-student-ranks', scoped: true, hint: 'Past top heroes',
        },
        {
            id: 'team-archive', icon: 'fa-flag-checkered', label: 'Team Archive', tone: 'teal',
            action: 'open-team-history', scoped: true, hint: 'Past league races',
        },
        {
            id: 'student-fixes', icon: 'fa-screwdriver-wrench', label: 'Student Fixes', tone: 'slate',
            action: 'open-options', subtab: 'manage', hint: 'Fix stars or gold',
        },
        {
            id: 'last-lessons', icon: 'fa-hourglass-end', label: 'Last Lessons', tone: 'indigo',
            action: 'open-options', subtab: 'planning', hint: 'End-of-year days',
        },
    ];
    return catalog
        .filter((tool) => can(tool.flag))
        .slice(0, HOME_GLOBAL_TOOL_LIMIT)
        .map(({ flag, ...tool }) => tool);
}

// Home → Class Actions (a class selected). Same launcher tiles as Global Tools.
// Award Stars, Scholar's Scroll, Story Weavers and the Adventure Log sit on the bottom nav, so they are not repeated.

/**
 * @param {object} ctx
 * @param {string} ctx.classId
 * @param {number} [ctx.heroCount] students in the class
 * @param {number} [ctx.absentToday] students marked away today
 * @param {boolean} [ctx.boonWindow] the Teacher Boon is open (last week of the month)
 * @param {string} [ctx.boonGivenTo] first name of this month's Teacher Boon hero, if given
 * @param {number} [ctx.teamsToday] teams the Team Maker saved for this class today
 * @param {number} [ctx.waitingTurns] heroes here who are still waiting for a Fair Picker turn this round
 * @param {boolean} [ctx.fairRoundStarted] at least one Fair Picker turn has been given this round
 * @returns {{ id: string, icon: string, label: string, hint: string, tone: string, action: string, classId: string }[]}
 */
export function getHomeClassActions({ classId, heroCount = 0, absentToday = 0, boonWindow = false, boonGivenTo = '', teamsToday = 0, waitingTurns = 0, fairRoundStarted = false }) {
    const here = Math.max(0, heroCount - absentToday);
    const catalog = [
        boonWindow && {
            id: 'teacher-boon', icon: 'fa-gift', label: 'Teacher Boon', tone: 'amber',
            action: 'open-teacher-boon',
            hint: boonGivenTo ? `Given to ${boonGivenTo}` : 'Open this week',
        },
        {
            id: 'roll-call', icon: 'fa-clipboard-check', label: 'Roll Call', tone: 'sky',
            action: 'open-attendance',
            hint: absentToday > 0 ? `${absentToday} away today` : 'Mark who is away',
        },
        {
            id: 'team-maker', icon: 'fa-people-group', label: 'Team Maker', tone: 'teal',
            action: 'open-team-maker',
            hint: teamsToday > 0 ? `${plural(teamsToday, 'team', 'teams')} today` : here >= 2 ? `Split ${here} into teams` : 'Split the class',
        },
        {
            id: 'fair-picker', icon: 'fa-hand-sparkles', label: 'Fair Picker', tone: 'indigo',
            action: 'open-fair-picker',
            hint: fairRoundStarted && waitingTurns > 0 ? `${waitingTurns} still waiting` : 'Everyone gets a turn',
        },
        {
            id: 'roster', icon: 'fa-users', label: 'Class Roster', tone: 'emerald',
            action: 'open-class-roster',
            hint: heroCount > 0 ? plural(heroCount, 'hero', 'heroes') : 'No heroes yet',
        },
        {
            id: 'report', icon: 'fa-wand-magic-sparkles', label: 'Class Report', tone: 'violet',
            action: 'open-report', hint: 'AI progress report',
        },
        {
            id: 'edit', icon: 'fa-pen', label: 'Edit Class', tone: 'slate',
            action: 'edit-class', hint: 'Days and details',
        },
        {
            id: 'prodigies', icon: 'fa-medal', label: 'Prodigies', tone: 'rose',
            action: 'open-prodigies', hint: 'Past Prodigies',
        },
    ];
    return catalog.filter(Boolean).slice(0, HOME_CLASS_ACTION_LIMIT).map((tool) => ({ ...tool, classId }));
}

/** Live hint numbers for the Team Maker and Fair Picker tiles of one class. */
export function getClassToolCounts({ classData, studentIds = [], absentIds = new Set(), dateKey = '' }) {
    const ids = studentIds.map(String);
    const present = ids.filter((id) => !absentIds.has(id));
    const today = teamsForDay(classData?.teamMaker, dateKey);
    const fair = normalizeFairPicker(classData?.fairPicker);
    const status = fairStatus(fair, { classIds: ids, presentIds: present });
    return {
        teamsToday: today ? today.teams.length : 0,
        waitingTurns: status.waiting.length,
        fairRoundStarted: status.had.length > 0,
    };
}
