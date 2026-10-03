// Home → Global Tools (school overview, no class selected).
// Only shortcuts the bottom nav bar and the header gear do not already reach in one click.
// Each tile carries a short live hint so it reads as more than an icon.

export const HOME_GLOBAL_TOOL_LIMIT = 6;

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
 * @returns {{ id: string, icon: string, label: string, hint: string, tone: string, action: string, classId: string }[]}
 */
export function getHomeClassActions({ classId, heroCount = 0, absentToday = 0, boonWindow = false, boonGivenTo = '' }) {
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
            id: 'roster', icon: 'fa-users', label: 'Class Roster', tone: 'teal',
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
    return catalog.filter(Boolean).slice(0, HOME_GLOBAL_TOOL_LIMIT).map((tool) => ({ ...tool, classId }));
}
