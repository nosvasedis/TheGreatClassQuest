// /features/heroClasses.js
import * as state from '../state.js';

export const HERO_CLASSES = {
    'Guardian': { reason: 'respect', icon: '🛡️', bonus: 10, desc: '+10 Gold for Respect' },
    'Sage': { reason: 'creativity', icon: '🔮', bonus: 10, desc: '+10 Gold for Creativity' },
    'Paladin': { reason: 'teamwork', icon: '⚔️', bonus: 10, desc: '+10 Gold for Teamwork' },
    'Artificer': { reason: 'focus', icon: '⚙️', bonus: 10, desc: '+10 Gold for Focus' },
    'Scholar': { reason: 'scholar_s_bonus', icon: '📜', bonus: 10, desc: '+10 Gold for Trial Results' },
    'Weaver': { reason: 'story_weaver', icon: '✒️', bonus: 10, desc: '+10 Gold for Story Weaver' },
    'Nomad': { reason: 'welcome_back', icon: '👟', bonus: 1, desc: '+10 Gold for Coming Back' }
};

/**
 * Calculates extra gold based on a student's Hero Class.
 */
export function calculateHeroGold(studentData, reason, starDifference) {
    if (starDifference <= 0 || !reason) return starDifference;

    const heroClass = studentData.heroClass;
    if (heroClass && HERO_CLASSES[heroClass]) {
        const classInfo = HERO_CLASSES[heroClass];
        if (classInfo.reason === reason) {
            return starDifference + classInfo.bonus;
        }
    }
    return starDifference;
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
