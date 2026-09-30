// /features/guildScoringCore.js — pure Guild Glory and Guild Power math

export function roundTo(value, places = 1) {
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
}

export function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

/** Local-calendar Monday of the week holding `d`, as "YYYY-MM-DD". */
export function weekMondayKey(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * The guild's week as it really stands at `now`.
 * guild_scores only rolls its weekly counters when that guild next earns Glory, so a guild
 * that has earned nothing since Monday still carries last week's numbers in the document.
 * Every reader goes through this so all guilds are compared on the same week.
 */
export function resolveGuildWeek(guildData = {}, now = Date.now()) {
    const currentMonday = weekMondayKey(new Date(now));
    const previousMonday = weekMondayKey(new Date(new Date(now).getTime() - 7 * 86400000));
    const lastReset = String(guildData?.lastWeeklyReset || '');
    const storedIds = Array.isArray(guildData?.weeklyActiveMemberIds) ? guildData.weeklyActiveMemberIds : null;
    if (lastReset && lastReset >= currentMonday) {
        return {
            weeklyGlory: Number(guildData.weeklyGlory) || 0,
            previousWeekGlory: Number(guildData.previousWeekGlory) || 0,
            weeklyActiveMemberIds: storedIds || [],
            weeklyActiveMembers: storedIds ? new Set(storedIds).size : (Number(guildData.weeklyActiveMembers) || 0),
            currentMonday,
        };
    }
    return {
        weeklyGlory: 0,
        previousWeekGlory: lastReset && lastReset >= previousMonday ? (Number(guildData.weeklyGlory) || 0) : 0,
        weeklyActiveMemberIds: [],
        weeklyActiveMembers: 0,
        currentMonday,
    };
}

export function getActiveGuildModifiers(guildData = {}, now = Date.now()) {
    return (Array.isArray(guildData.gloryModifiers) ? guildData.gloryModifiers : [])
        .filter((mod) => (Number(mod?.expiresAt) || 0) > now);
}

export function getMomentumArrow(pct) {
    const n = Number(pct) || 0;
    if (n >= 50) return '⬆️';
    if (n >= 15) return '↗️';
    if (n > -15) return '➡️';
    if (n > -50) return '↘️';
    return '⬇️';
}

/**
 * The year-long race: the guild whose members have earned the most Glory each, on average,
 * this school year leads. This week's numbers never change the order.
 */
export function compareGuildLeaderboardRows(a = {}, b = {}) {
    const exact = (row) => Number(row.seasonGloryPerMember ?? row.perCapitaGlory ?? row.guildPower) || 0;
    return exact(b) - exact(a) ||
        (Number(b.totalGlory) || 0) - (Number(a.totalGlory) || 0) ||
        String(a.guildName || a.name || '').localeCompare(String(b.guildName || b.name || ''));
}

/**
 * Glory a guild counts toward its standing: everything it earned this year, minus what
 * members who have since left earned (they no longer count as members, so their Glory
 * leaves with them). `memberGlory` is only trusted for the year it was built for.
 */
export function countedGuildGlory(guildData = {}, currentMemberIds = []) {
    const totalGlory = Number(guildData?.totalGlory) || 0;
    const map = guildData?.memberGlory;
    if (!map || typeof map !== 'object' || !guildData.memberGloryYear ||
        guildData.memberGloryYear !== guildData.activeSchoolYearKey) {
        return { countedGlory: totalGlory, leaversGlory: 0, memberGloryReady: false };
    }
    const current = new Set(currentMemberIds);
    let leaversGlory = 0;
    for (const [studentId, glory] of Object.entries(map)) {
        if (!current.has(studentId)) leaversGlory += Number(glory) || 0;
    }
    return { countedGlory: totalGlory - leaversGlory, leaversGlory, memberGloryReady: true };
}

/**
 * Wheel Glory is written for an average-sized guild; a bigger guild gets proportionally more
 * so every member of every guild gains (or loses) the same.
 */
export function guildSizeScale(memberCounts = {}, guildId) {
    const sizes = Object.values(memberCounts).map(Number).filter((n) => n > 0);
    const own = Number(memberCounts[guildId]) || 0;
    if (!sizes.length || own <= 0) return 1;
    return own / (sizes.reduce((sum, n) => sum + n, 0) / sizes.length);
}

export function consumeChargeModifiers(modifiers = [], starDelta = 0, now = Date.now()) {
    if (!(starDelta > 0)) return modifiers;
    let starsRemaining = Number(starDelta) || 0;
    return modifiers
        .map((mod) => {
            if (!mod || mod.type !== 'bonus_per_star') return mod;
            const charges = Number(mod.charges);
            if (!Number.isFinite(charges)) return mod;
            if (charges <= 0) return null;
            const used = Math.min(charges, starsRemaining);
            starsRemaining = Math.max(0, starsRemaining - used);
            const nextCharges = charges - used;
            return nextCharges > 0 ? { ...mod, charges: nextCharges } : null;
        })
        .filter((mod) => mod && ((Number(mod.expiresAt) || 0) > now || !mod.expiresAt || isChallengeAwaitingTally(mod, now)));
}

const CHALLENGE_TALLY_WINDOW_MS = 7 * 86400000;

/** A Glory Challenge stays on file for a week after it ends so its result can be tallied. */
export function isChallengeAwaitingTally(mod, now = Date.now()) {
    return mod?.type === 'challenge' && now < (Number(mod.expiresAt) || 0) + CHALLENGE_TALLY_WINDOW_MS;
}

/**
 * Glory Challenges whose week has ended and can be judged now: the challenge's week must be
 * last week, so every guild's last-week Glory is still known. The winner is the guild with the
 * most Glory per member that week (ties all win); a week with no Glory has no winner.
 * `members` maps guildId → current member count.
 */
export function findWonGuildChallenges(allGuildScores = {}, members = {}, now = Date.now()) {
    const currentMonday = weekMondayKey(new Date(now));
    const previousMonday = weekMondayKey(new Date(now - 7 * 86400000));
    const perMember = {};
    for (const [guildId, data] of Object.entries(allGuildScores || {})) {
        const count = Number(members[guildId]) || 0;
        perMember[guildId] = count > 0 ? resolveGuildWeek(data, now).previousWeekGlory / count : 0;
    }
    const best = Math.max(0, ...Object.values(perMember));
    const won = [];
    for (const [guildId, data] of Object.entries(allGuildScores || {})) {
        for (const mod of Array.isArray(data?.gloryModifiers) ? data.gloryModifiers : []) {
            if (mod?.type !== 'challenge' || !isChallengeAwaitingTally(mod, now)) continue;
            const challengeMonday = weekMondayKey(new Date(Number(mod.createdAt) || 0));
            if (challengeMonday >= currentMonday || challengeMonday !== previousMonday) continue;
            if (best > 0 && perMember[guildId] >= best - 1e-9) {
                won.push({ guildId, bonus: Number(mod.bonus) || 50, key: `challenge_${guildId}_${Number(mod.createdAt) || 0}` });
            }
        }
    }
    return won;
}

export function calculateGuildGloryDelta({
    starDelta = 0,
    directGlory = 0,
    scoreData = {},
    guildData = {},
    gloryPerStar = 2,
    now = Date.now(),
} = {}) {
    const safeStarDelta = Number(starDelta) || 0;
    const safeDirectGlory = Number(directGlory) || 0;
    const activeModifiers = getActiveGuildModifiers(guildData, now);
    const breakdown = [];

    let starGlory = safeStarDelta * gloryPerStar;
    if (safeStarDelta !== 0) {
        breakdown.push({ type: 'base_star_glory', amount: starGlory, detail: `${gloryPerStar} Glory per star` });
    }

    let perStarBonus = 0;
    if (safeStarDelta > 0 && Number(scoreData?.gloryBannerCharges) > 0) {
        const amount = Math.min(safeStarDelta, Number(scoreData.gloryBannerCharges) || 0);
        perStarBonus += amount;
        breakdown.push({ type: 'banner_of_glory', amount, detail: '+1 Glory per awarded star' });
    }

    if (safeStarDelta > 0 && guildData?.chaliceActive && Number(guildData?.chaliceExpiresAt) > now) {
        const amount = safeStarDelta;
        perStarBonus += amount;
        breakdown.push({ type: 'chalice_of_radiance', amount, detail: '+1 Glory per awarded star' });
    }

    for (const mod of activeModifiers) {
        if (mod.type !== 'bonus_per_star' || safeStarDelta <= 0) continue;
        const chargeLimit = Number.isFinite(Number(mod.charges)) ? Math.max(0, Number(mod.charges)) : safeStarDelta;
        const qualifyingStars = Math.min(safeStarDelta, chargeLimit);
        const amount = (Number(mod.amount) || 0) * qualifyingStars;
        if (!amount) continue;
        perStarBonus += amount;
        breakdown.push({ type: 'modifier_bonus_per_star', amount, label: mod.label || '', detail: `+${Number(mod.amount) || 0} Glory per star` });
    }

    const beforeMultiplier = starGlory + perStarBonus;
    let afterMultiplier = beforeMultiplier;
    let multiplierDelta = 0;
    // Multipliers grow earned Glory only. A star taken back (a correction) always
    // costs its plain Glory, so fixing a mistake during a 4x day never costs 4x.
    for (const mod of beforeMultiplier > 0 ? activeModifiers : []) {
        if (mod.type !== 'multiply') continue;
        const factor = Number(mod.factor);
        if (!Number.isFinite(factor) || factor === 1) continue;
        const next = Math.round(afterMultiplier * factor);
        const delta = next - afterMultiplier;
        multiplierDelta += delta;
        afterMultiplier = next;
        breakdown.push({ type: 'modifier_multiply', amount: delta, factor, label: mod.label || '', detail: `${factor}x Glory modifier` });
    }

    if (safeDirectGlory) {
        breakdown.push({ type: 'direct_glory', amount: safeDirectGlory, detail: 'Direct Guild Glory event' });
    }

    return {
        starDelta: safeStarDelta,
        baseGlory: roundTo(starGlory, 2),
        modifierGlory: roundTo(perStarBonus + multiplierDelta, 2),
        directGlory: roundTo(safeDirectGlory, 2),
        totalGloryDelta: roundTo(afterMultiplier + safeDirectGlory, 2),
        breakdown,
        consumedGloryModifiers: consumeChargeModifiers(guildData.gloryModifiers || [], safeStarDelta, now),
    };
}

export function calculateGuildPower(guildData, maxima = {}) {
    const memberCountRaw = Number(guildData?.memberCount) || 0;
    if (memberCountRaw <= 0) {
        return {
            guildPower: 0,
            seasonGloryScore: 0,
            weeklyGloryScore: 0,
            activityScore: 0,
            momentumScore: 50,
            momentumPct: 0,
            momentumArrow: getMomentumArrow(0),
            perCapitaGlory: 0,
            seasonGloryPerMember: 0,
            weeklyPerCapitaGlory: 0,
        };
    }

    const memberCount = Math.max(memberCountRaw, 1);
    const totalGlory = Number(guildData?.countedGlory ?? guildData?.totalGlory) || 0;
    const weeklyGlory = Number(guildData?.weeklyGlory) || 0;
    const previousWeekGlory = Number(guildData?.previousWeekGlory) || 0;
    const weeklyActiveMembers = Number(guildData?.weeklyActiveMembers) || 0;
    const activeModifiers = getActiveGuildModifiers(guildData);
    const hasMomentumLock = activeModifiers.some((m) => m.type === 'momentum_lock');

    const perCapitaGlory = totalGlory / memberCount;
    const weeklyPerCapitaGlory = weeklyGlory / memberCount;
    const maxPerCapitaGlory = Math.max(Number(maxima.maxPerCapitaGlory) || 0, 1);
    const maxWeeklyPerCapitaGlory = Math.max(Number(maxima.maxWeeklyPerCapitaGlory) || 0, 1);

    const seasonGloryScore = clamp((perCapitaGlory / maxPerCapitaGlory) * 100);
    const weeklyGloryScore = clamp((weeklyPerCapitaGlory / maxWeeklyPerCapitaGlory) * 100);
    const activityScore = clamp((weeklyActiveMembers / memberCount) * 100);

    let momentumPct = 0;
    if (previousWeekGlory > 0) {
        momentumPct = ((weeklyGlory - previousWeekGlory) / previousWeekGlory) * 100;
    } else if (weeklyGlory > 0) {
        momentumPct = 100;
    }
    if (hasMomentumLock) momentumPct = Math.max(0, momentumPct);
    momentumPct = clamp(momentumPct, -100, 100);
    const momentumScore = (momentumPct + 100) / 2;

    // Guild Power is the year's Glory per member: it only moves when this guild earns (or
    // loses) Glory. The weekly scores below are shown as "this week" badges only.
    const guildPower = roundTo(perCapitaGlory, 1);

    return {
        guildPower: Math.max(0, guildPower),
        seasonGloryPerMember: perCapitaGlory,
        seasonGloryScore: roundTo(seasonGloryScore),
        gloryScore: roundTo(seasonGloryScore),
        weeklyGloryScore: roundTo(weeklyGloryScore),
        activityScore: roundTo(activityScore),
        momentumScore: roundTo(momentumScore),
        momentumPct: Math.round(momentumPct),
        momentumArrow: getMomentumArrow(momentumPct),
        perCapitaGlory: roundTo(perCapitaGlory),
        weeklyPerCapitaGlory: roundTo(weeklyPerCapitaGlory),
    };
}
