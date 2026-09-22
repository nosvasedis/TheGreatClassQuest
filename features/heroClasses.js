// /features/heroClasses.js
import { calculateSkillBonus, computeHeroLevel, HERO_SKILL_TREE } from './heroSkillTree.js';

function hexToRgbChannels(hex) {
    const raw = String(hex || '').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return '124, 58, 237';
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function themeFromAura(heroClassName) {
    const accent = HERO_SKILL_TREE[heroClassName]?.auraColor || '#7c3aed';
    return { accent, rgb: hexToRgbChannels(accent) };
}

export const HERO_CLASSES = {
    'Guardian': { reason: 'respect', icon: '🛡️', bonus: 10, desc: '+10 Gold for Respect', theme: themeFromAura('Guardian') },
    'Sage': { reason: 'creativity', icon: '🔮', bonus: 10, desc: '+10 Gold for Creativity', theme: themeFromAura('Sage') },
    'Paladin': { reason: 'teamwork', icon: '⚔️', bonus: 10, desc: '+10 Gold for Teamwork', theme: themeFromAura('Paladin') },
    'Artificer': { reason: 'focus', icon: '⚙️', bonus: 10, desc: '+10 Gold for Focus', theme: themeFromAura('Artificer') },
    'Scholar': { reason: 'scholar_s_bonus', icon: '📜', bonus: 10, desc: '+10 Gold for Trial Results', theme: themeFromAura('Scholar') },
    'Weaver': { reason: 'story_weaver', icon: '✒️', bonus: 10, desc: '+10 Gold for Story Weaver', theme: themeFromAura('Weaver') },
    'Nomad': { reason: 'welcome_back', icon: '👟', bonus: 10, desc: '+10 Gold for Coming Back', theme: themeFromAura('Nomad') },
    'Patron': { reason: 'peer_boon', icon: '💝', bonus: 10, desc: "+10 Gold when you give a Hero's Boon", theme: themeFromAura('Patron') }
};

/**
 * Path points credited to a Patron for the first successful Hero's Boon
 * in a calendar week (Monday–Sunday, same ISO week as Fortune's Wheel).
 */
export const PATRON_PATH_CREDIT_PER_GIFT = 1;
export const PEER_BOON_COST = 15;
export const PEER_BOON_DAILY_CAP = 4;
export const PEER_BOON_BASE_STARS = 0.5;

const EMPTY_PATRON_GIFT = {
    applies: false,
    giverGoldBonus: 0,
    extraStarsForReceiver: 0,
    pathCredit: 0,
    skillEventCredit: 0,
    creditsPath: false,
    pathWeekKey: '',
    newReasonStars: 0,
    newHeroLevel: 0,
    leveledUp: false
};

/**
 * ISO week key YYYY-Www from a local calendar date. Matches getISOWeekKey
 * in guildScoring.js without importing that Firebase-backed module.
 */
export function getPatronPathWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getPatronPathWeekKeyFromDateString(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '').trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return getPatronPathWeekKey(new Date(year, month - 1, day));
}

/**
 * Unique ISO weeks that already have a Patron gift. Live path credit is
 * one point per week, not one point per log.
 */
export function summarizePatronPathFromLogDates(dateStrings, now = new Date()) {
    const weeks = new Set();
    for (const dateStr of dateStrings || []) {
        const key = getPatronPathWeekKeyFromDateString(dateStr);
        if (key) weeks.add(key);
    }
    const thisWeekKey = getPatronPathWeekKey(now);
    return {
        reasonStars: weeks.size,
        thisWeekKey,
        giftedThisWeek: weeks.has(thisWeekKey)
    };
}

/**
 * Patron levels from GIVING a Hero's Boon. Rank stars stay on the receiver.
 * Returns giver gold (class +10 plus self_gold skills), receiver star bonus,
 * and path progress. Extra gifts in the same week still pay gold and skills;
 * they do not add another path point. Does not include the 15 Gold spend.
 */
export function calculatePatronGiftEffects(studentData, scoreData = null, options = {}) {
    const heroClass = studentData?.heroClass;
    if (!heroClass || !HERO_CLASSES[heroClass]) return { ...EMPTY_PATRON_GIFT };
    const classInfo = HERO_CLASSES[heroClass];
    if (classInfo.reason !== 'peer_boon') return { ...EMPTY_PATRON_GIFT };

    const weekKey = options.weekKey || getPatronPathWeekKey(options.now);
    const alreadyCreditedThisWeek = String(scoreData?.lastPatronPathCreditWeekKey || '') === weekKey;
    const pathCredit = alreadyCreditedThisWeek ? 0 : PATRON_PATH_CREDIT_PER_GIFT;
    const skillEventCredit = PATRON_PATH_CREDIT_PER_GIFT;

    const { extraGold, extraStars } = calculateSkillBonus(
        heroClass,
        scoreData?.heroSkills,
        'peer_boon',
        skillEventCredit
    );
    const currentReasonStars = Number(scoreData?.starsByReason?.peer_boon) || 0;
    const newReasonStars = currentReasonStars + pathCredit;
    const currentHeroLevel = Number(scoreData?.heroLevel) || 0;
    const newHeroLevel = computeHeroLevel(heroClass, newReasonStars);
    return {
        applies: true,
        giverGoldBonus: classInfo.bonus + extraGold,
        extraStarsForReceiver: extraStars,
        pathCredit,
        skillEventCredit,
        creditsPath: pathCredit > 0,
        pathWeekKey: weekKey,
        newReasonStars,
        newHeroLevel,
        leveledUp: pathCredit > 0 && newHeroLevel > currentHeroLevel
    };
}

/**
 * Pure settlement for a Hero's Boon attempt: spend, Patron path credit, receiver stars.
 * Failures (self, daily cap, consecutive recipient, not enough Gold) return ok: false
 * and must not credit the path.
 */
export function computePeerBoonSettlement({
    senderId,
    receiverId,
    dailyCount = 0,
    currentGold = 0,
    freeBoonUses = 0,
    isMonthFree = false,
    lastPeerBoonRecipientId = null,
    senderStudent = null,
    senderScoreData = null,
    heroProgressionEnabled = false,
    weekKey = null,
    now = null
} = {}) {
    if (senderId === receiverId) {
        return { ok: false, error: "An adventurer cannot bestow a boon on themselves!" };
    }
    if (Number(dailyCount) >= PEER_BOON_DAILY_CAP) {
        return { ok: false, error: 'Daily boon limit reached — max 4 per class per day!' };
    }
    if (lastPeerBoonRecipientId === receiverId) {
        return { ok: false, error: "You cannot bestow a boon on the same companion twice consecutively!" };
    }

    const usesFreeUse = !isMonthFree && (Number(freeBoonUses) || 0) > 0;
    let goldAfterSpend = Number(currentGold) || 0;
    let goldSpend = 0;
    if (!isMonthFree && !usesFreeUse) {
        if (goldAfterSpend < PEER_BOON_COST) {
            return { ok: false, error: "Not enough Gold!" };
        }
        goldSpend = PEER_BOON_COST;
        goldAfterSpend = Math.max(0, goldAfterSpend - PEER_BOON_COST);
    }

    const patronGift = heroProgressionEnabled
        ? calculatePatronGiftEffects(senderStudent, senderScoreData, {
            weekKey: weekKey || undefined,
            now: now || undefined
        })
        : { ...EMPTY_PATRON_GIFT };

    return {
        ok: true,
        usesFreeUse,
        isMonthFree: Boolean(isMonthFree),
        goldSpend,
        goldAfterSpend,
        giverGoldAfter: patronGift.applies
            ? Math.max(0, goldAfterSpend + patronGift.giverGoldBonus)
            : goldAfterSpend,
        patronGift,
        receiverStarDelta: PEER_BOON_BASE_STARS + (patronGift.applies ? patronGift.extraStarsForReceiver : 0)
    };
}

/**
 * Calculates total gold change for a star award.
 * Returns { goldChange, bonusStars } accounting for:
 *   1. The base +10 class bonus (existing)
 *   2. Any active skill tree bonuses (self_gold_on_reason, star_bonus_on_reason)
 * scoreData is optional; if provided, skill bonuses are also applied.
 */
export function calculateHeroGold(studentData, reason, starDifference, scoreData = null) {
    if (starDifference === 0 || !reason) return { goldChange: starDifference, bonusStars: 0 };

    const heroClass = studentData.heroClass;
    let goldChange = starDifference;
    let bonusStars = 0;

    // 1. Base class bonus (+10 when reason matches) — positive awards only
    if (starDifference > 0 && heroClass && HERO_CLASSES[heroClass]) {
        const classInfo = HERO_CLASSES[heroClass];
        if (classInfo.reason === reason || classInfo.reason === reason.trim()) {
            goldChange += classInfo.bonus;
        }
    }

    // 2. Skill tree personal bonuses — negative difference correctly reverses bonus stars/gold
    if (heroClass && scoreData?.heroSkills?.length) {
        const { extraGold, extraStars } = calculateSkillBonus(heroClass, scoreData.heroSkills, reason, starDifference);
        goldChange += extraGold;
        bonusStars += extraStars;
    }

    return { goldChange, bonusStars };
}

/** How many times a student may switch Hero Class during one school year. The class they already wear is kept. */
export const HERO_CLASS_CHANGES_PER_YEAR = 2;

function changesUsedThisYear(studentData, activeYearKey = '') {
    const count = Math.max(0, Number(studentData?.heroClassChangeCount) || 0);
    const yearKey = String(activeYearKey || '').trim();
    if (!yearKey) return count;
    const stamp = String(studentData?.heroClassLockYearKey || '').trim();
    return stamp === yearKey ? count : 0;
}

/**
 * Locked only after both changes for this school year are used.
 * A lock from another year does not apply. With no school year in context, an older
 * boolean lock (no change count) still holds.
 */
export function heroClassLockApplies(studentData, activeYearKey = '') {
    const yearKey = String(activeYearKey || '').trim();
    const used = changesUsedThisYear(studentData, yearKey);
    if (used >= HERO_CLASS_CHANGES_PER_YEAR) return true;
    if (yearKey) return false;
    return Boolean(studentData?.isHeroClassLocked) && used === 0;
}

export function heroClassChangesRemaining(studentData, activeYearKey = '') {
    if (heroClassLockApplies(studentData, activeYearKey)) return 0;
    const used = changesUsedThisYear(studentData, activeYearKey);
    return Math.max(0, HERO_CLASS_CHANGES_PER_YEAR - used);
}

/**
 * Checks if a student is allowed to change their class.
 * They keep the class they have. Two switches are allowed each school year.
 */
export function canChangeHeroClass(studentData, newClassSelection, activeYearKey = '') {
    if (!studentData?.heroClass) return true;
    if (studentData.heroClass === newClassSelection) return true;
    if (heroClassLockApplies(studentData, activeYearKey)) return false;
    return true;
}

/**
 * Pure lock decision for a Hero Class write.
 * The current class is never cleared here. The first assignment is not a change.
 * Each different non-empty class after that uses one of two yearly changes.
 * The second change locks the path until the next school year.
 * Saving No Class (empty string) does not use a change and does not lock.
 */
export function resolveHeroClassChange(studentData, newClassSelection, activeYearKey = '') {
    const yearKey = String(activeYearKey || '').trim();
    const nextClass = newClassSelection ?? '';
    const currentClass = studentData?.heroClass || '';
    const alreadyLocked = heroClassLockApplies(studentData, yearKey);
    const used = changesUsedThisYear(studentData, yearKey);
    const stamp = yearKey || String(studentData?.heroClassLockYearKey || '');

    if (!canChangeHeroClass(studentData || {}, nextClass, yearKey)) {
        return {
            allowed: false,
            isNowLocked: true,
            heroClassChangeCount: Math.max(used, HERO_CLASS_CHANGES_PER_YEAR),
            heroClassLockYearKey: stamp
        };
    }

    const isChange = Boolean(currentClass && nextClass !== '' && currentClass !== nextClass);
    const heroClassChangeCount = isChange ? used + 1 : used;
    const isNowLocked = heroClassChangeCount >= HERO_CLASS_CHANGES_PER_YEAR || (alreadyLocked && !isChange);
    return {
        allowed: true,
        isNowLocked,
        heroClassChangeCount,
        heroClassLockYearKey: (isChange || isNowLocked || used > 0) ? stamp : String(studentData?.heroClassLockYearKey || '')
    };
}
