/**
 * Hero class names that changed. The Training Grounds class was first called the Weaver;
 * student docs that still say "Weaver" read as the new name everywhere, and the teacher's
 * client rewrites them once (db/listeners.js), keeping level, skills and Gold.
 */

export const TRAINING_HERO = 'Vanguard';

export const LEGACY_HERO_CLASS_NAMES = Object.freeze({ Weaver: TRAINING_HERO });

export function isLegacyHeroClass(name) {
    return Object.prototype.hasOwnProperty.call(LEGACY_HERO_CLASS_NAMES, String(name || '').trim());
}

/** The current name for a stored hero class; anything else comes back unchanged. */
export function normalizeHeroClass(name) {
    return isLegacyHeroClass(name) ? LEGACY_HERO_CLASS_NAMES[String(name).trim()] : name;
}

/** Lets a map keyed by class name answer old names too, without listing them. */
export function withLegacyHeroAliases(map) {
    for (const [old, now] of Object.entries(LEGACY_HERO_CLASS_NAMES)) {
        if (map[now] !== undefined && !Object.prototype.hasOwnProperty.call(map, old)) {
            Object.defineProperty(map, old, { value: map[now], enumerable: false });
        }
    }
    return map;
}
