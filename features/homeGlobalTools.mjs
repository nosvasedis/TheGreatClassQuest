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
