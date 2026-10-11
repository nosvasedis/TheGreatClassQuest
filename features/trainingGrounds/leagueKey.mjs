/**
 * Training Grounds league keys: one content shelf per Quest League.
 *   prejunior = Pre-Junior (5-7)   juniorA = Junior A (7-8)   juniorB = Junior B (8-9)
 *   a = A (9-10)   b = B (10-11)   c = C (11-12)   d = D (12-13)
 * An unknown league falls back through languageScaffolds#getLeagueBand.
 * Pure; covered by tests/training-grounds-content.test.mjs.
 */

import { getLeagueBand } from '../languageScaffolds.mjs';

export const LEAGUE_KEYS = Object.freeze(['prejunior', 'juniorA', 'juniorB', 'a', 'b', 'c', 'd']);

export const LEAGUE_LABELS = Object.freeze({
    prejunior: 'Pre-Junior', juniorA: 'Junior A', juniorB: 'Junior B', a: 'A', b: 'B', c: 'C', d: 'D'
});

const BY_NAME = Object.freeze({
    'Pre-Junior': 'prejunior', 'Junior A': 'juniorA', 'Junior B': 'juniorB', A: 'a', B: 'b', C: 'c', D: 'd'
});

const BAND_DEFAULT = Object.freeze({ early: 'prejunior', junior: 'juniorA', mid: 'a', upper: 'c' });

export function getLeagueKey(league) {
    const name = String(league || '').trim();
    if (LEAGUE_KEYS.includes(name)) return name;
    return BY_NAME[name] || BAND_DEFAULT[getLeagueBand(name)] || 'a';
}

/** 0 for Pre-Junior up to 6 for D. */
export function leagueIndex(key) {
    const i = LEAGUE_KEYS.indexOf(getLeagueKey(key));
    return i < 0 ? 3 : i;
}

/** Pre-Junior children mostly do not read yet: their games are picture-first. */
export function isPictureFirst(key) {
    return getLeagueKey(key) === 'prejunior';
}
