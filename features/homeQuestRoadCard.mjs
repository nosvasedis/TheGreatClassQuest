// Home tab: Quest Progress as a little road through the four Team Quest realms.
// Pure markup, no app state, so the guidebook capture renders the same card
// (docs/product/guidebook/capture/fill-surfaces.js). Styles: styles/home_quest_road.css.
import { QUEST_MAP_ZONES, getQuestMapZoneForProgressPercent } from './questMapZones.mjs';

const ROAD_START = 60;   // viewBox x where 0% sits
const ROAD_END = 940;    // viewBox x where the goal flag sits

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatStars(n) {
    const v = Math.round((Number(n) || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The road's height (viewBox units, 0 to 100) at a given x: a gentle S that climbs to the goal. */
function roadY(x) {
    const t = (x - ROAD_START) / (ROAD_END - ROAD_START);
    return 70 - t * 26 + Math.sin(t * Math.PI * 2.2 + 0.3) * 11;
}

/** Where a progress share (0 to 100) lands on the road, in viewBox units. */
export function questRoadPoint(percent) {
    const p = Math.min(100, Math.max(0, Number(percent) || 0));
    const x = ROAD_START + (ROAD_END - ROAD_START) * (p / 100);
    return { x, y: roadY(x) };
}

function roadPath(toX = ROAD_END) {
    const pts = [];
    for (let x = ROAD_START; x < toX; x += 20) pts.push([x, roadY(x)]);
    pts.push([toX, roadY(toX)]);
    return `M ${pts.map(([x, y]) => `${x} ${y.toFixed(2)}`).join(' L ')}`;
}

/** Tells the class where it stands and what comes next, in stars. */
export function describeQuestRoad({ stars = 0, goal = 18 } = {}) {
    const safeGoal = Number(goal) > 0 ? Number(goal) : 18;
    const percent = Math.min(100, Math.max(0, (Number(stars) || 0) / safeGoal * 100));
    const zone = getQuestMapZoneForProgressPercent(percent);
    const next = QUEST_MAP_ZONES.find((z) => z.minPercent > percent);
    const done = percent >= 100;
    const target = next ? safeGoal * next.minPercent / 100 : safeGoal;
    const toGo = Math.max(0, Math.ceil(target - (Number(stars) || 0) - 1e-9));
    return { percent, zone, next, done, toGo, goal: safeGoal };
}

/**
 * @param {object} p
 * @param {number} p.stars   this month's Team Quest stars (Pathfinder bonus included)
 * @param {number} p.goal    this month's goal in stars
 * @param {number} [p.bonus] Pathfinder bonus stars inside `stars`
 * @param {string} [p.logo]  the class emblem, travelling along the road
 */
export function buildHomeQuestRoadCardHtml({ stars = 0, goal = 18, bonus = 0, logo = '📚' } = {}) {
    const road = describeQuestRoad({ stars, goal });
    const pctLabel = road.done ? 100 : Math.min(99, Math.round(road.percent));
    const here = questRoadPoint(road.percent);

    const nextLine = road.done
        ? '<span class="qroad__next qroad__next--done"><i class="fas fa-flag-checkered"></i>Goal reached this month!</span>'
        : `<span class="qroad__next"><b>${formatStars(road.toGo)} ★</b> to ${road.next ? `${road.next.icon} ${esc(road.next.label)}` : '<i class="fas fa-flag-checkered"></i> the goal'}</span>`;

    const waypoints = QUEST_MAP_ZONES.map((z) => {
        const pt = questRoadPoint(z.minPercent);
        const reached = road.percent >= z.minPercent;
        return `<span class="qroad__stop${reached ? ' is-reached' : ''}" data-zone="${esc(z.id)}" style="left:${pt.x / 10}%;top:${pt.y}%;--qs:${z.minPercent / 100}" title="${esc(z.label)} (from ${z.minPercent}%)"><span aria-hidden="true">${z.icon}</span></span>`;
    }).join('');
    const flag = questRoadPoint(100);

    return `
        <div class="vibrant-card h-span-8 qroad${road.done ? ' is-done' : ''}" data-zone="${esc(road.zone.id)}">
            <div class="qroad__sky" aria-hidden="true"><span class="qroad__sun"></span><span class="qroad__cloud qroad__cloud--a"></span><span class="qroad__cloud qroad__cloud--b"></span></div>
            <div class="qroad__head">
                <h3 class="home-section-title"><span class="home-section-title__icon home-section-title__icon--quest"><i class="fas fa-route"></i></span>Quest Progress</h3>
                <span class="qroad__realm"><small>Now in</small><span aria-hidden="true">${road.zone.icon}</span>${esc(road.zone.label)}</span>
            </div>
            <div class="qroad__body">
                <div class="qroad__pct">
                    <span class="qroad__num font-title">${pctLabel}<small>%</small></span>
                    <span class="qroad__of">of this month's goal</span>
                    ${nextLine}
                </div>
                <div class="qroad__stars">
                    <span class="qroad__stars-num font-title">${formatStars(stars)}<i class="fas fa-star"></i></span>
                    <span class="qroad__stars-label">stars this month</span>
                    <span class="qroad__goal">Goal ${formatStars(road.goal)} ★${Number(bonus) > 0 ? ` · incl. +${formatStars(bonus)} Pathfinder` : ''}</span>
                </div>
            </div>
            <div class="qroad__land" role="img" aria-label="${pctLabel}% of the way to this month's goal">
                <svg class="qroad__svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path class="qroad__hill qroad__hill--back" d="M0 46 C 120 22, 230 30, 330 40 C 450 52, 560 18, 700 22 C 820 26, 900 38, 1000 30 L1000 100 L0 100 Z"/>
                    <path class="qroad__hill qroad__hill--front" d="M0 70 C 140 58, 260 60, 400 66 C 560 74, 700 56, 860 58 C 930 59, 970 62, 1000 60 L1000 100 L0 100 Z"/>
                    <path class="qroad__road-edge" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    <path class="qroad__road" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    <path class="qroad__road-lines" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    ${road.percent > 0 ? `<path class="qroad__trail" d="${roadPath(here.x)}" vector-effect="non-scaling-stroke"/>` : ''}
                </svg>
                ${waypoints}
                <span class="qroad__flag" style="left:${flag.x / 10}%;top:${flag.y}%" title="This month's goal: ${formatStars(road.goal)} stars" aria-hidden="true"><i class="fas fa-flag"></i></span>
                <span class="qroad__token" style="left:${here.x / 10}%;top:${here.y}%" aria-hidden="true"><span class="qroad__token-pin">${esc(logo || '📚')}</span></span>
            </div>
        </div>`;
}
