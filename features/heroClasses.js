// /features/heroClasses.js
import * as state from '../state.js';
import { calculateSkillBonus } from './heroSkillTree.js';

export const HERO_CLASSES = {
    'Guardian': { reason: 'respect', icon: '🛡️', bonus: 10, desc: '+10 Gold for Respect' },
    'Sage': { reason: 'creativity', icon: '🔮', bonus: 10, desc: '+10 Gold for Creativity' },
    'Paladin': { reason: 'teamwork', icon: '⚔️', bonus: 10, desc: '+10 Gold for Teamwork' },
    'Artificer': { reason: 'focus', icon: '⚙️', bonus: 10, desc: '+10 Gold for Focus' },
    'Scholar': { reason: 'scholar_s_bonus', icon: '📜', bonus: 10, desc: '+10 Gold for Trial Results' },
    'Weaver': { reason: 'story_weaver', icon: '✒️', bonus: 10, desc: '+10 Gold for Story Weaver' },
    'Nomad': { reason: 'welcome_back', icon: '👟', bonus: 10, desc: '+10 Gold for Coming Back' }
};

/**
 * Calculates total gold change for a star award.
 * Returns { goldChange, bonusStars } accounting for:
 *   1. The base +10 class bonus (existing)
 *   2. Any active skill tree bonuses (self_gold_on_reason, star_bonus_on_reason)
 * scoreData is optional; if provided, skill bonuses are also applied.
 */
export function calculateHeroGold(studentData, reason, starDifference, scoreData = null) {
    if (starDifference <= 0 || !reason) return { goldChange: starDifference, bonusStars: 0 };

    const heroClass = studentData.heroClass;
    let goldChange = starDifference;
    let bonusStars = 0;

    // 1. Base class bonus (+10 when reason matches)
    if (heroClass && HERO_CLASSES[heroClass]) {
        const classInfo = HERO_CLASSES[heroClass];
        if (classInfo.reason === reason || classInfo.reason === reason.trim()) {
            goldChange += classInfo.bonus;
        }
    }

    // 2. Skill tree personal bonuses (self_gold_on_reason + star_bonus_on_reason)
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
    if (!studentData.heroClass) return true;
    
    // If they are not changing the value, it's fine
    if (studentData.heroClass === newClassSelection) return true;

    // If they already have a class and it's locked, they cannot change it
    if (studentData.isHeroClassLocked) return false;

    return true;
}
