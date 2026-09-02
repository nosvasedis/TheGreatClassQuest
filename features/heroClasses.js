// /features/heroClasses.js
import { calculateSkillBonus, HERO_SKILL_TREE } from './heroSkillTree.js';

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
    'Nomad': { reason: 'welcome_back', icon: '👟', bonus: 10, desc: '+10 Gold for Coming Back', theme: themeFromAura('Nomad') }
};

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

/**
 * Checks if a student is allowed to change their class.
 * Logic: If they have a class AND it is marked as locked, they cannot change.
 */
export function canChangeHeroClass(studentData, newClassSelection) {
    // If they don't have a class yet, they can always choose one
    if (!studentData?.heroClass) return true;

    // If they are not changing the value, it's fine
    if (studentData.heroClass === newClassSelection) return true;

    // If they already have a class and it's locked, they cannot change it
    if (studentData.isHeroClassLocked) return false;

    return true;
}

/**
 * Pure lock decision for a Hero Class write.
 * First pick is free. Saving a different non-empty class after having one locks.
 * Saving No Class (empty string) does not lock.
 */
export function resolveHeroClassChange(studentData, newClassSelection) {
    const nextClass = newClassSelection ?? '';
    const currentClass = studentData?.heroClass || '';
    const alreadyLocked = Boolean(studentData?.isHeroClassLocked);

    if (!canChangeHeroClass(studentData || {}, nextClass)) {
        return { allowed: false, isNowLocked: alreadyLocked };
    }

    const isNowLocked = alreadyLocked || Boolean(currentClass && nextClass !== '' && currentClass !== nextClass);
    return { allowed: true, isNowLocked };
}
