// features/ceremonyMarksCore.mjs
// The milestones each hero reached in the ceremony month, shown as a ribbon of small
// medallions on the hero's reveal card and as gems on the final standings:
// Quiz Champion, Seal Bearer, new Legend (from the Honours of the Month), Rising Star,
// a Growth Starfall, and "Best month yet" (more stars than in any earlier month of the
// school year). Pure: no DOM, no Firestore. Tests: tests/ceremony-marks.test.mjs.

const MAX_MARKS = 4;

/**
 * @param {object} input
 * @param {{ sections: { id: string, heroes: { id: string, note?: string }[] }[] }|null} [input.honours]
 * @param {{ id: string, score: number }[]} [input.heroes] - the ceremony's heroes with their month's stars
 * @param {Record<string, number[]>} [input.earlierMonths] - per hero, stars in each earlier month of the year
 * @param {string|null} [input.risingStarId]
 * @param {Record<string, number>} [input.starfalls] - Growth Starfalls per hero that month
 * @returns {Map<string, { icon: string, label: string, tone: string, title?: string }[]>}
 */
export function buildHeroMarks({ honours = null, heroes = [], earlierMonths = {}, risingStarId = null, starfalls = {} } = {}) {
    const marks = new Map();
    const add = (id, mark) => {
        if (!id) return;
        const list = marks.get(id) || [];
        if (list.length < MAX_MARKS && !list.some((m) => m.label === mark.label)) list.push(mark);
        marks.set(id, list);
    };
    const section = (key) => (honours?.sections || []).find((s) => s.id === key)?.heroes || [];
    section('legends').forEach((h) => add(h.id, { icon: 'fa-crown', label: 'New Legend', tone: 'gold', title: h.note || 'Became a Legend this month' }));
    if (risingStarId) add(risingStarId, { icon: 'fa-meteor', label: 'Rising Star', tone: 'violet', title: 'The biggest climb of the month' });
    section('quiz').forEach((h) => add(h.id, { icon: 'fa-trophy', label: 'Quiz Champion', tone: 'sky', title: h.note || 'Top of the Quiz of the Week' }));
    section('seals').forEach((h) => add(h.id, { icon: 'fa-stamp', label: 'Seal Bearer', tone: 'rose', title: h.note || 'Pressed a Hero Seal' }));
    for (const hero of heroes || []) {
        const score = Number(hero?.score) || 0;
        const before = (earlierMonths?.[hero?.id] || []).map(Number).filter((n) => Number.isFinite(n));
        // A best month needs an earlier month to beat, and a real month of stars.
        if (score >= 5 && before.length && before.some((n) => n > 0) && score > Math.max(...before)) {
            add(hero.id, { icon: 'fa-arrow-up-right-dots', label: 'Best month yet', tone: 'green', title: `More stars than in any earlier month (before: ${Math.max(...before)})` });
        }
        const falls = Number(starfalls?.[hero?.id]) || 0;
        if (falls > 0) add(hero.id, { icon: 'fa-seedling', label: falls > 1 ? `${falls} Growth Starfalls` : 'Growth Starfall', tone: 'crystal', title: 'A big step up on the Scholar’s Scroll' });
    }
    return marks;
}

/** The school-year months before `monthKey` (September on), oldest first. */
export function earlierSchoolMonths(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month || month === 9) return [];
    const startYear = month >= 9 ? year : year - 1;
    const keys = [];
    let y = startYear;
    let m = 9;
    while (y < year || (y === year && m < month)) {
        if (m !== 8) keys.push(`${y}-${String(m).padStart(2, '0')}`);
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return keys;
}
