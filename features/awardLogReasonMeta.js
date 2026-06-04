/**
 * Single source of truth for award_log `reason` presentation and class-quest bonuses
 * tied to award records (so logbook, wallpaper, and power-ups stay aligned).
 */

/** Stars added to the Team Quest when Pathfinder’s Map is played (see award_log + class doc). */
export const PATHFINDER_CLASS_QUEST_BONUS_STARS = 10;

/** `award_log.reason` value written for Pathfinder’s Map. */
export const PATHFINDER_AWARD_REASON = 'pathfinder_map';

export function getClassQuestBonusStarsFromAwardLog(log) {
    return log?.reason === PATHFINDER_AWARD_REASON ? PATHFINDER_CLASS_QUEST_BONUS_STARS : 0;
}

/** Tailwind gradient classes for logbook / history cards */
export const AWARD_LOG_REASON_GRADIENTS = {
    teamwork: 'from-purple-500 to-indigo-600',
    creativity: 'from-pink-500 to-rose-600',
    respect: 'from-emerald-500 to-teal-600',
    focus: 'from-amber-400 to-orange-500',
    correction: 'from-slate-400 to-slate-600',
    welcome_back: 'from-cyan-400 to-blue-600',
    story_weaver: 'from-violet-400 to-purple-600',
    scholar_s_bonus: 'from-amber-600 to-orange-700',
    teacher_boon: 'from-fuchsia-500 to-pink-600',
    peer_boon: 'from-rose-400 to-red-500',
    pathfinder_map: 'from-indigo-500 to-blue-700',
    quiz_of_the_week: 'from-sky-500 to-indigo-600',
    wheel_fortune: 'from-yellow-400 to-amber-500',
    wheel_curse: 'from-red-700 to-purple-900',
    marked_present: 'from-teal-400 to-emerald-600',
    excellence: 'from-amber-300 to-yellow-500'
};

/** Font Awesome icon suffix (without `fa-` prefix sometimes passed as fa-x) — logbook uses `fas ${AWARD_LOG_REASON_ICONS[r]}` */
export const AWARD_LOG_REASON_ICONS = {
    teamwork: 'fa-users',
    creativity: 'fa-lightbulb',
    respect: 'fa-handshake',
    focus: 'fa-bullseye',
    correction: 'fa-wrench',
    welcome_back: 'fa-door-open',
    story_weaver: 'fa-book-open',
    scholar_s_bonus: 'fa-graduation-cap',
    teacher_boon: 'fa-gift',
    peer_boon: 'fa-heart',
    pathfinder_map: 'fa-map-marked-alt',
    quiz_of_the_week: 'fa-scroll',
    wheel_fortune: 'fa-wand-magic-sparkles',
    wheel_curse: 'fa-bolt',
    marked_present: 'fa-user-check',
    excellence: 'fa-star'
};

/** Wallpaper “float card” styling (icon + colours) */
export const AWARD_REASON_WALLPAPER_FLOAT = {
    teamwork: { icon: 'fa-users', color: 'text-purple-600', css: 'float-card-purple', bg: 'bg-purple-100' },
    creativity: { icon: 'fa-lightbulb', color: 'text-pink-600', css: 'float-card-pink', bg: 'bg-pink-100' },
    respect: { icon: 'fa-hands-helping', color: 'text-green-600', css: 'float-card-green', bg: 'bg-green-100' },
    focus: { icon: 'fa-brain', color: 'text-yellow-600', css: 'float-card-gold', bg: 'bg-yellow-100' },
    welcome_back: { icon: 'fa-door-open', color: 'text-cyan-600', css: 'float-card-cyan', bg: 'bg-cyan-100' },
    scholar_s_bonus: { icon: 'fa-scroll', color: 'text-amber-700', css: 'float-card-orange', bg: 'bg-amber-100' },
    correction: { icon: 'fa-wrench', color: 'text-gray-600', css: 'float-card-white', bg: 'bg-gray-100' },
    pathfinder_map: { icon: 'fa-map', color: 'text-indigo-600', css: 'float-card-indigo', bg: 'bg-indigo-100' },
    teacher_boon: { icon: 'fa-gift', color: 'text-fuchsia-700', css: 'float-card-pink', bg: 'bg-fuchsia-100' },
    peer_boon: { icon: 'fa-heart', color: 'text-rose-600', css: 'float-card-pink', bg: 'bg-rose-100' },
    quiz_of_the_week: { icon: 'fa-scroll', color: 'text-sky-700', css: 'float-card-cyan', bg: 'bg-sky-100' },
    wheel_fortune: { icon: 'fa-wand-magic-sparkles', color: 'text-amber-600', css: 'float-card-gold', bg: 'bg-amber-100' },
    wheel_curse: { icon: 'fa-bolt', color: 'text-red-700', css: 'float-card-purple', bg: 'bg-red-100' },
    story_weaver: { icon: 'fa-book-open', color: 'text-violet-700', css: 'float-card-purple', bg: 'bg-violet-100' },
    marked_present: { icon: 'fa-user-check', color: 'text-teal-600', css: 'float-card-green', bg: 'bg-teal-100' },
    excellence: { icon: 'fa-star', color: 'text-amber-500', css: 'float-card-gold', bg: 'bg-amber-100' }
};

export function resolveWallpaperFloatStyle(reason) {
    const key = String(reason || '').trim();
    return AWARD_REASON_WALLPAPER_FLOAT[key] || { icon: 'fa-star', color: 'text-indigo-600', css: 'float-card-indigo', bg: 'bg-indigo-100' };
}

/**
 * Credits applied to {@code student_scores.monthlyStars} / {@code totalStars} for this row.
 * Prefer {@code appliedStarCredit} when set (includes hero skill bonus stars that are not in {@code stars}).
 * Wheel fortune/curse: {@code appliedStarCredit} or {@code log.wheel.deltaStars} with {@code stars: 0}.
 * Legacy rows without {@code appliedStarCredit} fall back to {@code stars} / wheel delta.
 */
export function getAwardLogMonthlyStarCredit(log) {
    if (!log) return 0;
    if (log.appliedStarCredit !== undefined && log.appliedStarCredit !== null) {
        const credited = Number(log.appliedStarCredit);
        if (Number.isFinite(credited)) return credited;
    }
    const reason = log.reason || '';
    if (reason === 'wheel_fortune' || reason === 'wheel_curse') {
        const delta = Number(log.wheel?.deltaStars);
        return Number.isFinite(delta) ? delta : 0;
    }
    const n = Number(log.stars);
    return Number.isFinite(n) ? n : 0;
}

export function getAwardLogGoldCredit(log) {
    if (!log) return 0;
    const delta = Number(log.wheel?.deltaGold);
    return Number.isFinite(delta) ? delta : 0;
}

export function isWheelGoldOnlyAwardLog(log) {
    return (log?.reason === 'wheel_fortune' || log?.reason === 'wheel_curse')
        && getAwardLogMonthlyStarCredit(log) === 0
        && getAwardLogGoldCredit(log) !== 0;
}

export function shouldShowInStarAwardLog(log) {
    if (!log) return false;
    if (isWheelGoldOnlyAwardLog(log)) return false;
    if ((log.reason === 'wheel_fortune' || log.reason === 'wheel_curse') && getAwardLogMonthlyStarCredit(log) === 0) {
        return false;
    }
    return true;
}

/** Aggregate {@link getAwardLogMonthlyStarCredit} per student id. */
export function sumMonthlyStarCreditsByStudentFromAwardLogs(logs = []) {
    const totals = {};
    for (const log of logs) {
        const sid = log.studentId;
        if (!sid) continue;
        const c = getAwardLogMonthlyStarCredit(log);
        if (!Number.isFinite(c)) continue;
        totals[sid] = (totals[sid] || 0) + c;
    }
    return totals;
}

/**
 * Completed months: rollover snapshot under each student's `monthly_history` matches live monthlyStars.
 * Prefer that when present; otherwise fall back to summing corrected award logs.
 */
export function mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(logTotalsByStudent = {}, archivedByStudent = {}) {
    const merged = {};
    const ids = new Set([...Object.keys(logTotalsByStudent || {}), ...Object.keys(archivedByStudent || {})]);
    for (const id of ids) {
        if (Object.prototype.hasOwnProperty.call(archivedByStudent, id)) {
            merged[id] = Number(archivedByStudent[id]) || 0;
        } else {
            merged[id] = Number(logTotalsByStudent[id]) || 0;
        }
    }
    return merged;
}

/** Live school-wide total for the current month: sum of every student’s `monthlyStars` (Firestore truth). */
export function sumLiveMonthlyStarsFromStudentScores(allStudentScores = []) {
    return (allStudentScores || []).reduce((sum, doc) => sum + (Number(doc.monthlyStars) || 0), 0);
}
