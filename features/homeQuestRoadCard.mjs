// Home tab: Quest Progress as a little road through the four Team Quest realms to the
// Crystal Portal, and past it up the Starward Way through the Crystal Sky (the same places
// and rules as the Team Quest map, read through features/teamQuestStanding.mjs).
// Pure markup, no app state, so the guidebook capture renders the same card
// (docs/product/guidebook/capture/fill-surfaces.js). Styles: styles/home_quest_road.css.
import { escapeHtml as esc } from '../utils/html.mjs';
import { QUEST_MAP_ZONES, getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import { describeQuestStanding, BEYOND_MARKS } from './teamQuestStanding.mjs';

// The Team Quest map's own realm badges and Portal (the same art as the map and the realm banner).
const atlas = (file) => new URL(`../assets/team-quest-map/living-atlas/${file}`, import.meta.url).href;
const REALM_BADGES = {
    bronze: atlas('badge-bronze.webp'),
    silver: atlas('badge-silver.webp'),
    gold: atlas('badge-gold.webp'),
    crystal: atlas('badge-crystal.webp')
};
const PORTAL_ART = { open: atlas('portal-vortex.webp'), veiled: atlas('portal-vortex-veiled.webp') };

const ROAD_START = 60;   // viewBox x where 0% sits
const ROAD_END = 940;    // viewBox x where the goal flag sits

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

// The Starward Way on the card: from the Portal's light (bottom left) up to the Palace (top right).
const WAY_START = 110;
const WAY_END = 930;
function wayY(x) {
    const t = (x - WAY_START) / (WAY_END - WAY_START);
    return 80 - t * 52 + Math.sin(t * Math.PI * 2.1 + 0.4) * 6;
}
/** Where `reach`% of the goal (100 to 200) lands on the card's Starward Way. */
export function questWayPoint(reach) {
    const share = Math.min(1, Math.max(0, ((Number(reach) || 0) - 100) / 100));
    const x = WAY_START + (WAY_END - WAY_START) * share;
    return { x, y: wayY(x) };
}
function wayPath(toX = WAY_END) {
    const pts = [];
    for (let x = WAY_START; x < toX; x += 16) pts.push([x, wayY(x)]);
    pts.push([toX, wayY(toX)]);
    return `M ${pts.map(([x, y]) => `${x} ${y.toFixed(2)}`).join(' L ')}`;
}

function realmChip(st, zone) {
    const chip = (icon, small, label) => `<span class="qroad__realm qroad__realm--${esc(st.place)}"><small>${small}</small><span class="qroad__realm-icon" aria-hidden="true">${icon}</span>${esc(label)}</span>`;
    const art = (src) => `<img src="${src}" alt="" draggable="false" decoding="async">`;
    if (st.place === 'road') return chip(art(REALM_BADGES[zone.id]), 'Now in', zone.label);
    if (st.place === 'sealed') return chip('<i class="fas fa-lock"></i>', 'Waiting', 'At the sealed Portal');
    if (st.place === 'gate') return chip(art(PORTAL_ART.open), 'Ready', 'At the open Portal');
    if (st.place === 'inside') return chip(art(PORTAL_ART.open), 'Now', 'Inside the Portal');
    if (st.place === 'palace') return chip('<i class="fas fa-sun"></i>', 'Home at', 'The Celestial Palace');
    return chip(`<i class="fas ${esc(st.mark?.icon || 'fa-star')}"></i>`, 'Crystal Sky', st.mark ? st.mark.label : 'The Starward Way');
}

function nextLineHtml(st, road) {
    const n = st.next;
    if (st.place === 'road') {
        const target = road.next
            ? `<img class="qroad__next-badge" src="${REALM_BADGES[road.next.id]}" alt="" draggable="false" decoding="async">${esc(road.next.label)}`
            : `<img class="qroad__next-badge" src="${PORTAL_ART.veiled}" alt="" draggable="false" decoding="async">the Crystal Portal`;
        return `<span class="qroad__next"><b>${formatStars(road.toGo)} ★</b> to ${target}</span>`;
    }
    if (st.place === 'sealed') return `<span class="qroad__next qroad__next--sealed"><i class="fas fa-lock"></i>Goal reached! ${esc(n?.label || 'The Portal is sealed')}</span>`;
    if (st.place === 'gate') return '<span class="qroad__next qroad__next--done"><i class="fas fa-door-open"></i>Goal reached! Step through the Portal on the Team Quest map</span>';
    if (st.place === 'palace' || !n) return '<span class="qroad__next qroad__next--sky"><i class="fas fa-crown"></i>Home at the top of the Crystal Sky!</span>';
    const mark = BEYOND_MARKS.find((m) => m.at === n.at);
    return `<span class="qroad__next qroad__next--sky"><b>${formatStars(n.starsNeeded)} ★</b> to <i class="fas ${esc(mark?.icon || 'fa-star')}"></i>${esc(n.label)}</span>`;
}

function landSceneHtml(st, road, logo) {
    const here = questRoadPoint(road.percent);
    const waypoints = QUEST_MAP_ZONES.map((z) => {
        const pt = questRoadPoint(z.minPercent);
        const reached = road.percent >= z.minPercent;
        return `<span class="qroad__stop${reached ? ' is-reached' : ''}" data-zone="${esc(z.id)}" style="left:${pt.x / 10}%;top:${pt.y}%;--qs:${z.minPercent / 100}" title="${esc(z.label)} (from ${z.minPercent}%)"><img src="${REALM_BADGES[z.id]}" alt="" draggable="false" decoding="async" loading="lazy"></span>`;
    }).join('');
    const gate = questRoadPoint(100);
    const portalState = st.place === 'sealed' ? 'sealed' : st.place === 'gate' ? 'open' : 'ahead';
    const portalTitle = portalState === 'sealed' ? 'The Crystal Portal is sealed' : portalState === 'open' ? 'The Crystal Portal is open' : 'The Crystal Portal: this month’s goal';
    return `
            <div class="qroad__land" role="img" aria-label="${Math.min(100, Math.round(road.percent))}% of the way to the Crystal Portal">
                <span class="qroad__sky-hint" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
                <svg class="qroad__svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path class="qroad__hill qroad__hill--back" d="M0 46 C 120 22, 230 30, 330 40 C 450 52, 560 18, 700 22 C 820 26, 900 38, 1000 30 L1000 100 L0 100 Z"/>
                    <path class="qroad__hill qroad__hill--front" d="M0 70 C 140 58, 260 60, 400 66 C 560 74, 700 56, 860 58 C 930 59, 970 62, 1000 60 L1000 100 L0 100 Z"/>
                    <path class="qroad__road-edge" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    <path class="qroad__road" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    <path class="qroad__road-lines" d="${roadPath()}" vector-effect="non-scaling-stroke"/>
                    ${road.percent > 0 ? `<path class="qroad__trail" d="${roadPath(here.x)}" vector-effect="non-scaling-stroke"/>` : ''}
                </svg>
                ${waypoints}
                <span class="qroad__portal qroad__portal--${portalState}" style="left:${gate.x / 10}%;top:${gate.y}%" title="${portalTitle}" aria-hidden="true"><img class="qroad__vortex" src="${portalState === 'open' ? PORTAL_ART.open : PORTAL_ART.veiled}" alt="" draggable="false" decoding="async" loading="lazy">${portalState === 'sealed' ? '<span class="qroad__portal-lock"><i class="fas fa-lock"></i></span>' : ''}</span>
                <span class="qroad__token" style="left:${here.x / 10}%;top:${here.y}%" aria-hidden="true"><span class="qroad__token-pin">${esc(logo || '📚')}</span></span>
            </div>`;
}

function skySceneHtml(st, logo) {
    const reach = Math.min(200, st.reach);
    const here = questWayPoint(reach);
    const stones = [];
    for (let at = 105; at < 200; at += 5) {
        if (BEYOND_MARKS.some((m) => m.at === at)) continue;
        const pt = questWayPoint(at);
        stones.push(`<span class="qroad__stone${st.reach >= at ? ' is-reached' : ''}" style="left:${pt.x / 10}%;top:${pt.y}%"></span>`);
    }
    const marks = BEYOND_MARKS.map((m) => {
        const pt = questWayPoint(m.at);
        const reached = st.reach >= m.at;
        return `<span class="qroad__mark qroad__mark--${esc(m.id)}${reached ? ' is-reached' : ''}" style="left:${pt.x / 10}%;top:${pt.y}%;--qs:${(m.at - 100) / 100}" title="${esc(m.label)} (${m.at}%)"><i class="fas ${esc(m.icon)}" aria-hidden="true"></i></span>`;
    }).join('');
    const foot = questWayPoint(100);
    return `
            <div class="qroad__land qroad__land--sky" role="img" aria-label="${Math.floor(st.reach)}% of this month's goal, up the Starward Way in the Crystal Sky">
                <span class="qroad__stars-field" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
                <svg class="qroad__svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path class="qroad__cloudsea" d="M0 86 C 80 74, 150 80, 220 84 C 320 72, 420 80, 520 86 C 620 76, 720 82, 820 88 C 900 80, 960 84, 1000 82 L1000 100 L0 100 Z"/>
                    <path class="qroad__way-edge" d="${wayPath()}" vector-effect="non-scaling-stroke"/>
                    <path class="qroad__way" d="${wayPath()}" vector-effect="non-scaling-stroke"/>
                    ${st.reach > 100 ? `<path class="qroad__trail qroad__trail--sky" d="${wayPath(here.x)}" vector-effect="non-scaling-stroke"/>` : ''}
                </svg>
                ${stones.join('')}
                ${marks}
                <span class="qroad__portal qroad__portal--below" style="left:${foot.x / 10 - 4}%;top:${foot.y + 6}%" title="The Crystal Portal, crossed this month" aria-hidden="true"><img class="qroad__vortex" src="${PORTAL_ART.open}" alt="" draggable="false" decoding="async" loading="lazy"></span>
                <span class="qroad__token" style="left:${here.x / 10}%;top:${here.y}%" aria-hidden="true"><span class="qroad__token-pin">${esc(logo || '📚')}</span></span>
            </div>`;
}

/**
 * @param {object} p
 * @param {number} p.stars    this month's Team Quest stars (Pathfinder bonus included)
 * @param {number} p.goal     this month's goal in stars
 * @param {number} [p.bonus]  Pathfinder bonus stars inside `stars`
 * @param {string} [p.logo]   the class emblem, travelling along the road
 * @param {object} [p.portal] the class's Portal status (features/questPortal.js classPortalStatus);
 *   without it a full road counts as waiting at an open Portal
 */
export function buildHomeQuestRoadCardHtml({ stars = 0, goal = 18, bonus = 0, logo = '📚', portal = null } = {}) {
    const road = describeQuestRoad({ stars, goal });
    const reach = (Number(stars) || 0) / road.goal * 100;
    const st = describeQuestStanding({ progress: reach, currentMonthlyStars: Number(stars) || 0, goals: { diamond: road.goal }, portal });
    const sky = st.phase === 'sky';
    const pctLabel = road.done ? Math.max(100, Math.floor(reach)) : Math.min(99, Math.round(road.percent));
    const over = Math.max(0, (Number(stars) || 0) - road.goal);

    return `
        <div class="vibrant-card h-span-8 qroad${road.done ? ' is-done' : ''}${sky ? ' qroad--sky' : ''}" data-zone="${esc(road.zone.id)}" data-place="${esc(st.place)}">
            <div class="qroad__sky" aria-hidden="true">${sky
        ? '<span class="qroad__aurora"></span><span class="qroad__moon"></span>'
        : '<span class="qroad__sun"></span><span class="qroad__cloud qroad__cloud--a"></span><span class="qroad__cloud qroad__cloud--b"></span>'}</div>
            <div class="qroad__head">
                <h3 class="home-section-title"><span class="home-section-title__icon home-section-title__icon--quest"><i class="fas ${sky ? 'fa-meteor' : 'fa-route'}"></i></span>Quest Progress</h3>
                ${realmChip(st, road.zone)}
            </div>
            <div class="qroad__body">
                <div class="qroad__pct">
                    <span class="qroad__num font-title">${pctLabel}<small>%</small></span>
                    <span class="qroad__of">of this month's goal</span>
                    ${nextLineHtml(st, road)}
                </div>
                <div class="qroad__stars">
                    <span class="qroad__stars-num font-title">${formatStars(stars)}<i class="fas fa-star"></i></span>
                    <span class="qroad__stars-label">stars this month</span>
                    <span class="qroad__goal">Goal ${formatStars(road.goal)} ★${Number(bonus) > 0 ? ` · incl. +${formatStars(bonus)} Pathfinder` : ''}</span>
                    ${over > 0 ? `<span class="qroad__over"><i class="fas fa-arrow-up"></i>+${formatStars(over)} past the goal</span>` : ''}
                </div>
            </div>
            ${sky ? skySceneHtml(st, logo) : landSceneHtml(st, road, logo)}
        </div>`;
}
