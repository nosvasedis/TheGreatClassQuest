// features/worldMap.js
import * as state from '../state.js'; // Import state to get live scores
import * as utils from '../utils.js';

export { QUEST_MAP_ZONES, getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import { getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import {
    QUEST_ROAD_STOPS,
    describeQuestRaceGaps,
    describeQuestRaceLine,
    formatQuestStars,
    getQuestNextStop
} from './teamQuestRace.mjs';
import {
    PORTAL,
    REALM_PLACES,
    ROUTE_POINTS,
    SCENE_TIERS,
    TOKEN_EDGE_MARGIN,
    TOKEN_LANE_GAP,
    WORLD_H,
    WORLD_W,
    realmStates,
    resolveSceneTier,
    routeSegments
} from './questWorld/worldGeometry.mjs';
import { describePlace, placeTipHtml } from './questWorld/placeTips.mjs';
import { PAINTED_PROPS } from './questWorld/worldArt.mjs';

/** League map HTML path: use tab-precomputed stars/goal when present (avoids re-scanning students/scores). */
function resolveLeagueMapMetrics(c) {
    if (c && c.goals && 'currentMonthlyStars' in c) {
        const goal = Number(c.goals.diamond) || 18;
        const liveMonthlyStars = Number(c.currentMonthlyStars);
        const classQuestBonus = Number(c.classQuestBonus) || 0;
        const rawPct = goal > 0 ? (liveMonthlyStars / goal) * 100 : 0;
        const pct = Math.min(100, Math.max(0, rawPct));
        return {
            liveMonthlyStars,
            classQuestBonus,
            goal,
            pct,
            progressDisplay: pct.toFixed(1),
            starsDisplay: liveMonthlyStars % 1 !== 0 ? liveMonthlyStars.toFixed(1) : liveMonthlyStars.toFixed(0)
        };
    }
    const students = state.get('allStudents').filter(s => s.classId === c.id);
    const allScores = state.get('allStudentScores') || [];
    return getClassQuestProgressData(c, students, allScores);
}

export function getClassQuestProgressData(classroom, students = null, allScores = null) {
    if (!classroom) {
        return {
            liveMonthlyStars: 0,
            classQuestBonus: 0,
            goal: 18,
            pct: 0,
            progressDisplay: '0.0',
            starsDisplay: '0'
        };
    }

    const classStudents = Array.isArray(students)
        ? students
        : state.get('allStudents').filter((student) => student.classId === classroom.id);
    const scores = Array.isArray(allScores) ? allScores : (state.get('allStudentScores') || []);
    const fallbackTotals = utils.getClassMonthlyQuestStars(classroom, classStudents, scores);
    const liveMonthlyStars = Number.isFinite(classroom.currentMonthlyStars)
        ? Number(classroom.currentMonthlyStars)
        : fallbackTotals.totalStars;
    const classQuestBonus = Number.isFinite(classroom.classQuestBonus)
        ? Number(classroom.classQuestBonus)
        : fallbackTotals.classBonus;
    // Classes read straight from Firestore (diary, projector) carry no precomputed goals:
    // use the same monthly goal as the Team Quest tab and Home, never a bare 18.
    const goal = Number(classroom.goals?.diamond) || Math.max(18, utils.calculateMonthlyClassGoal(
        classroom,
        classStudents.length,
        state.get('schoolHolidayRanges'),
        state.get('allScheduleOverrides')
    ) || 0);
    const rawPct = goal > 0 ? (liveMonthlyStars / goal) * 100 : 0;
    const pct = Math.min(100, Math.max(0, rawPct));

    return {
        liveMonthlyStars,
        classQuestBonus,
        goal,
        pct,
        progressDisplay: pct.toFixed(1),
        starsDisplay: liveMonthlyStars % 1 !== 0 ? liveMonthlyStars.toFixed(1) : liveMonthlyStars.toFixed(0)
    };
}

// The road and the world share one geometry (features/questWorld/worldGeometry.mjs).
const MAP_VIEWBOX_WIDTH = WORLD_W;
const MAP_VIEWBOX_HEIGHT = WORLD_H;
const QUEST_ROUTE_SEGMENTS = routeSegments();
const MAP_LANE_GAP = TOKEN_LANE_GAP;
const MAP_TOKEN_EDGE_MARGIN = TOKEN_EDGE_MARGIN;
// Width of the parchment veil over the unexplored road, in screen pixels.
const ROAD_FOG_PX = 15;

const LIVING_MAP_ASSETS = {
    parchmentBacking: new URL('../assets/team-quest-map/living-atlas/map-parchment-backing.webp', import.meta.url).href,
    badgeBronze: new URL('../assets/team-quest-map/living-atlas/badge-bronze.webp', import.meta.url).href,
    badgeSilver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    badgeGold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    badgeCrystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href,
    scrollMap: new URL('../assets/team-quest-map/living-atlas/scroll-map-integrated.webp', import.meta.url).href,
    portalVortex: new URL('../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href,
    portalVortexVeiled: new URL('../assets/team-quest-map/living-atlas/portal-vortex-veiled.webp', import.meta.url).href,
    tokenGold: new URL('../assets/team-quest-map/living-atlas/token-gold.webp', import.meta.url).href,
    tokenSilver: new URL('../assets/team-quest-map/living-atlas/token-silver.webp', import.meta.url).href,
    tokenBronze: new URL('../assets/team-quest-map/living-atlas/token-bronze.webp', import.meta.url).href,
    tokenSlate: new URL('../assets/team-quest-map/living-atlas/token-slate.webp', import.meta.url).href
};

const TOKEN_FRAME_BY_TIER = {
    gold: LIVING_MAP_ASSETS.tokenGold,
    silver: LIVING_MAP_ASSETS.tokenSilver,
    bronze: LIVING_MAP_ASSETS.tokenBronze,
    slate: LIVING_MAP_ASSETS.tokenSlate
};

const ZONE_BADGE_BY_ID = {
    bronze: LIVING_MAP_ASSETS.badgeBronze,
    silver: LIVING_MAP_ASSETS.badgeSilver,
    gold: LIVING_MAP_ASSETS.badgeGold,
    crystal: LIVING_MAP_ASSETS.badgeCrystal,
    diamond: LIVING_MAP_ASSETS.badgeCrystal
};

/** Each place's colour of light (hover glow, click sparkle). */
const PLACE_GLOW = {
    bronze: '146, 232, 104',
    silver: '149, 224, 255',
    gold: '255, 211, 86',
    crystal: '218, 139, 255',
    portal: '190, 160, 255'
};


const ROAD_STOP_BADGE = {
    silver: LIVING_MAP_ASSETS.badgeSilver,
    gold: LIVING_MAP_ASSETS.badgeGold,
    crystal: LIVING_MAP_ASSETS.badgeCrystal,
    portal: LIVING_MAP_ASSETS.badgeCrystal
};

const TIER_BY_RANK = ['gold', 'silver', 'bronze'];
const RANK_WORDS = ['Quest leader', '2nd place', '3rd place'];
const LITE_FX_STORAGE_KEY = 'gcq-team-quest-map-fx'; // retired, cleared on load

let activeLivingMapController = null;
// How long the map takes to unroll, and to roll up before unrolling again.
const SCROLL_UNROLL_MS = 1300;
const SCROLL_FURL_MS = 380;
// Rolling up for good (the header left this league): slower, so the class sees it go.
const SCROLL_ROLL_UP_MS = 900;
// The wax seal cracks and the ribbon falls before the rods part; then the ink
// sketch on the paper blooms into the painted world.
const SEAL_BREAK_MS = 560;
const SEAL_BREAK_LITE_MS = 320;
const INK_BLOOM_MS = 1600;
const easeInCubic = (t) => t * t * t;
function cubicBezier(x1, y1, x2, y2) {
    const axis = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
    return (x) => {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 24; i += 1) {
            const mid = (lo + hi) / 2;
            if (axis(x1, x2, mid) < x) lo = mid;
            else hi = mid;
        }
        return axis(y1, y2, (lo + hi) / 2);
    };
}
// A quick flick off the rods that slows as the paper flattens out.
const easeUnroll = cubicBezier(0.3, 0.02, 0.16, 1);
// The parties' walk (the same curve as their travel animation), for the footsteps.
const easeTravel = cubicBezier(0.37, 0.08, 0.22, 1);
const easeFurl = cubicBezier(0.55, 0, 0.35, 1);
// Where each party was last drawn, so live updates walk tokens forward from
// there instead of replaying the whole journey from the start of the road.
const mapMemory = { leagueKey: null, tokens: new Map(), pinnedKey: null, mineKey: null };

function escapeMapHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// A tier forced for this tab (the preview page's Full / Lite buttons).
// (A new key: the old one also held the automatic step-downs, which stuck.)
const FX_CHOICE_STORAGE_KEY = 'gcq-team-quest-map-fx-choice';
try { sessionStorage.removeItem(LITE_FX_STORAGE_KEY); sessionStorage.removeItem('gcq-team-quest-map-calm'); } catch { /* private mode */ }

function readStoredFxPreference() {
    try { return sessionStorage.getItem(FX_CHOICE_STORAGE_KEY); } catch { return null; }
}

// What the frame-rate check decided on this page load only, so a reload
// (or a laptop plugged back in) tries the full world again.
const autoFx = { lite: false, calm: false };
function readCalmPreference() {
    return autoFx.calm && readStoredFxPreference() !== 'full';
}

/** Only genuinely weak machines start in lite; everything else starts full and lets the frame-rate check decide. */
function shouldUseLiteMapFx() {
    const stored = readStoredFxPreference();
    if (stored === 'lite') return true;
    if (stored === 'full') return false;
    if (autoFx.lite) return true;
    try {
        const nav = navigator;
        if (nav.connection?.saveData) return true;
        if (Number(nav.deviceMemory) > 0 && Number(nav.deviceMemory) <= 2) return true;
        if (Number(nav.hardwareConcurrency) > 0 && Number(nav.hardwareConcurrency) <= 2) return true;
    } catch { /* not available */ }
    return false;
}

function assignStableMapLanes(items) {
    const laneOrder = [0, -1, 1, -2, 2, -3, 3, -4, 4];
    const ordered = [...items].sort((a, b) => (
        a.pct - b.pct || a.tokenKey.localeCompare(b.tokenKey)
    ));
    let cluster = [];

    const flushCluster = () => {
        cluster
            .sort((a, b) => a.tokenKey.localeCompare(b.tokenKey))
            .forEach((item, index) => {
                item.lane = laneOrder[index] ?? (index % 2 === 0 ? index / 2 : -Math.ceil(index / 2));
            });
        cluster = [];
    };

    ordered.forEach((item) => {
        if (cluster.length && item.pct - cluster[0].pct > 4) flushCluster();
        cluster.push(item);
    });
    flushCluster();
    return items;
}

function buildMapItems(classes, { activeClassId = null } = {}) {
    const gaps = describeQuestRaceGaps(classes.map((c, index) => ({
        ...c,
        progress: Number.isFinite(Number(c.progress)) ? Number(c.progress) : resolveLeagueMapMetrics(c).pct,
        rank: c.rank || index + 1
    })));

    return assignStableMapLanes(classes.map((c, leagueIndex) => {
        const metrics = resolveLeagueMapMetrics(c);
        const rankPosition = Number(c.rank) || leagueIndex + 1;
        return {
            c,
            ...metrics,
            rankPosition,
            pinTier: TIER_BY_RANK[rankPosition - 1] || 'slate',
            isLeader: rankPosition === 1,
            isMine: Boolean(activeClassId) && c.id === activeClassId,
            displayLevel: (Number(c.difficulty) || 0) + 1,
            weeklyStars: Number(c.weeklyStars) || 0,
            topHeroes: Array.isArray(c.topHeroes) ? c.topHeroes : [],
            gap: gaps.get(c.id) || null,
            tokenKey: encodeURIComponent(String(c.id || c.name || leagueIndex)),
            lane: 0
        };
    }));
}

function renderMapToken(item) {
    const { c, pct, isLeader, isMine, pinTier, progressDisplay, starsDisplay, goal, rankPosition, tokenKey, lane, liveMonthlyStars } = item;
    const zone = getQuestMapZoneForProgressPercent(pct);
    const safeName = escapeMapHtml(c.name || 'Class');
    const safeLogo = escapeMapHtml(c.logo || '📚');
    const classes = [
        'tq-token',
        `tq-token--${zone.id}`,
        `tq-token--tier-${pinTier}`,
        isLeader ? 'is-leader' : '',
        isMine ? 'is-mine' : '',
        pct >= 100 ? 'is-complete' : ''
    ].filter(Boolean).join(' ');
    const ariaLabel = `${safeName}: league rank ${rankPosition}, ${Math.round(Number(progressDisplay))}% of the monthly quest, ${starsDisplay} of ${goal} stars, in ${escapeMapHtml(zone.label)}.`;

    return `
        <button type="button"
                class="${classes}"
                data-map-token
                data-token-key="${tokenKey}"
                data-class-id="${escapeMapHtml(c.id || '')}"
                data-progress="${pct}"
                data-stars="${Number(liveMonthlyStars) || 0}"
                data-goal="${Number(goal) || 0}"
                data-logo="${safeLogo}"
                data-name="${safeName}"
                data-lane="${lane}"
                aria-label="${ariaLabel}"
                aria-haspopup="dialog"
                aria-expanded="false">
            <span class="tq-token__shadow" aria-hidden="true"></span>
            <span class="tq-token__ring" aria-hidden="true"></span>
            <span class="tq-token__body" aria-hidden="true">
                <span class="tq-token__aura"></span>
                <span class="tq-token__disc">
                    <span class="tq-token__logo">${safeLogo}</span>
                    <img class="tq-token__frame" src="${TOKEN_FRAME_BY_TIER[pinTier]}" alt="" draggable="false" decoding="async">
                </span>
                <span class="tq-token__rank">${rankPosition}</span>
                ${isMine ? '<span class="tq-token__pennant"><i class="fas fa-flag"></i>Active</span>' : ''}
            </span>
        </button>`;
}

function renderRouteStrip(pct) {
    const stops = [{ id: 'bronze', progress: 0 }, ...QUEST_ROAD_STOPS];
    const dots = stops.map((stop) => `
        <span class="tq-card__stop tq-card__stop--${stop.id}${pct >= stop.progress ? ' is-reached' : ''}" style="left:${stop.progress}%"></span>
    `).join('');
    return `
        <span class="tq-card__route" aria-hidden="true">
            <span class="tq-card__route-track"></span>
            <span class="tq-card__route-fill" style="--p:${pct}%"></span>
            ${dots}
            <span class="tq-card__route-marker" style="left:${pct}%"></span>
        </span>`;
}

function renderTokenCard(item) {
    const { c, pct, isLeader, isMine, pinTier, starsDisplay, goal, liveMonthlyStars, rankPosition, displayLevel, classQuestBonus, weeklyStars, topHeroes, gap, tokenKey } = item;
    const zone = getQuestMapZoneForProgressPercent(pct);
    const next = getQuestNextStop(pct, liveMonthlyStars, goal);
    const safeName = escapeMapHtml(c.name || 'Class');
    const safeLogo = escapeMapHtml(c.logo || '📚');
    const rankWord = RANK_WORDS[rankPosition - 1] || `${rankPosition}th place`;
    const raceLine = describeQuestRaceLine(gap);
    const heroes = topHeroes.filter((hero) => (Number(hero.stars) || 0) > 0).slice(0, 3);
    const heroesHtml = heroes.length ? `
        <span class="tq-card__heroes">
            <small>Leading the way</small>
            <span class="tq-card__hero-row">
                ${heroes.map((hero) => `
                    <span class="tq-card__hero">
                        ${hero.avatar
                            ? `<img src="${escapeMapHtml(hero.avatar)}" alt="" loading="lazy" decoding="async">`
                            : `<span class="tq-card__hero-initial">${escapeMapHtml(String(hero.name || '?').charAt(0))}</span>`}
                        <span class="tq-card__hero-name">${escapeMapHtml(String(hero.name || '').split(' ')[0])}</span>
                        <span class="tq-card__hero-stars">${formatQuestStars(hero.stars)}★</span>
                    </span>`).join('')}
            </span>
        </span>` : '';

    return `
        <template data-card-for="${tokenKey}">
            <div class="tq-card tq-card--${zone.id}${isLeader ? ' tq-card--leader' : ''}">
                <span class="tq-card__ribbon">
                    <span class="tq-card__seal tq-card__seal--${pinTier}">${isLeader ? '<i class="fas fa-crown" aria-hidden="true"></i>' : rankPosition}</span>
                    <span class="tq-card__ribbon-text">${rankWord}${isMine ? ' · <b>Active class</b>' : ''}</span>
                    <span class="tq-card__lvl" title="Quest level: the monthly goal grows with each level"><i class="fas fa-shield-halved" aria-hidden="true"></i>Lvl ${displayLevel}</span>
                </span>
                <span class="tq-card__head">
                    <span class="tq-card__logo" aria-hidden="true">${safeLogo}</span>
                    <span class="tq-card__identity">
                        <strong class="tq-card__name">${safeName}</strong>
                        <span class="tq-card__zone"><img src="${ZONE_BADGE_BY_ID[zone.id]}" alt="" aria-hidden="true" draggable="false">${escapeMapHtml(zone.label)}</span>
                    </span>
                    <span class="tq-card__pct">${Math.floor(pct)}<small>%</small></span>
                </span>
                ${renderRouteStrip(pct)}
                <span class="tq-card__facts">
                    <span class="tq-card__fact tq-card__fact--stars"><i class="fas fa-star" aria-hidden="true"></i><strong>${starsDisplay}</strong><small>of ${formatQuestStars(goal)} stars</small></span>
                    <span class="tq-card__fact tq-card__fact--week"><i class="fas fa-fire" aria-hidden="true"></i><strong>+${formatQuestStars(weeklyStars)}</strong><small>this week</small></span>
                </span>
                <span class="tq-card__next${next.complete ? ' is-complete' : ''}">
                    <img src="${ROAD_STOP_BADGE[next.id] || LIVING_MAP_ASSETS.badgeCrystal}" alt="" aria-hidden="true" draggable="false">
                    <span>
                        <small>${next.complete ? 'The portal is open' : 'Next stop'}</small>
                        <strong>${next.complete ? 'Quest complete!' : escapeMapHtml(next.label)}</strong>
                    </span>
                    <em>${next.complete ? '<i class="fas fa-trophy" aria-hidden="true"></i>' : `${next.starsNeeded}★ to go`}</em>
                </span>
                ${raceLine ? `<span class="tq-card__race"><i class="fas fa-flag-checkered" aria-hidden="true"></i>${escapeMapHtml(raceLine)}</span>` : ''}
                ${heroesHtml}
                ${classQuestBonus > 0 ? `<span class="tq-card__bonus"><i class="fas fa-compass" aria-hidden="true"></i>+${formatQuestStars(classQuestBonus)} Pathfinder bonus</span>` : ''}
                <button type="button" class="tq-card__cta" data-open-chronicle="${escapeMapHtml(c.id || '')}">
                    <i class="fas fa-book-open" aria-hidden="true"></i><span>Open in Quest Chronicles</span><i class="fas fa-arrow-right" aria-hidden="true"></i>
                </button>
            </div>
        </template>`;
}

function buildLeagueMapParts(classes, options = {}) {
    const items = buildMapItems(classes, options);
    return {
        count: items.length,
        tokensHtml: items.map(renderMapToken).join(''),
        cardsHtml: items.map(renderTokenCard).join(''),
        connectorsHtml: items.map((item) => (
            `<line class="tq-route__connector" data-connector-key="${item.tokenKey}" x1="0" y1="0" x2="0" y2="0"></line>`
        )).join('')
    };
}

/**
 * A realm's landmark on the map (the village, the gate, the citadel, the isle):
 * an invisible, ellipse-shaped button over the painting that glows on hover,
 * shows the place card and opens the Realm Overview.
 */
function renderPlace(place) {
    const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;
    const style = `left:${pct(place.x - place.rx, MAP_VIEWBOX_WIDTH)};top:${pct(place.y - place.ry, MAP_VIEWBOX_HEIGHT)};`
        + `width:${pct(place.rx * 2, MAP_VIEWBOX_WIDTH)};height:${pct(place.ry * 2, MAP_VIEWBOX_HEIGHT)};--place-glow:${PLACE_GLOW[place.id]}`;
    return `
        <button type="button"
                class="tq-place tq-place--${place.id} zone-trigger"
                data-zone="${place.zone}"
                data-place="${place.id}"
                data-waypoint-progress="${place.progress}"
                style="${style}"
                aria-label="${escapeMapHtml(place.label)}: ${escapeMapHtml(place.kind)}. Open the realm overview">
            <span class="tq-place__glow" aria-hidden="true"></span>
            <span class="tq-place__ring" aria-hidden="true"></span>
            <span class="tq-place__burst" aria-hidden="true"></span>
        </button>`;
}

function renderChronicleButton(count) {
    return `
        <button id="toggle-map-list-btn" class="tq-chronicle-btn" type="button" aria-controls="league-standings-container" aria-expanded="false">
            <span class="tq-chronicle-btn__book" aria-hidden="true"><i class="fas fa-book-open"></i></span>
            <span class="tq-chronicle-btn__copy">
                <small>Field notes</small>
                <strong>Quest Chronicles</strong>
            </span>
            <span class="tq-chronicle-btn__count" data-chronicle-count aria-label="${count} parties">${count}</span>
        </button>`;
}

/** Map shell (art, road, waypoints) plus the parties on it. */
export function generateLeagueMapHtml(classes, options = {}) {
    const parts = buildLeagueMapParts(classes, options);

    const places = REALM_PLACES.map(renderPlace).join('');

    const routePaths = (className, extra = () => '') => QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="${className}" d="${segment.d}"${extra(segment)}></path>`
    )).join('');
    const fx = shouldUseLiteMapFx() ? 'lite' : 'full';
    const tilt = fx === 'full' ? SCENE_TIERS.full.tilt : 0;

    return `
    <div class="tq-living-map" role="region" aria-label="League quest map" data-living-quest-map data-fx="${fx}"${readCalmPreference() ? ' data-calm="1"' : ''} data-tilt="${tilt}" data-scroll="rolled">
        <img class="tq-living-map__parchment-backing" src="${LIVING_MAP_ASSETS.parchmentBacking}" alt="" draggable="false" decoding="async" aria-hidden="true">
        <div class="tq-living-map__frame">
            <div class="tq-stage" data-quest-stage>
                <div class="tq-world" data-quest-world aria-hidden="true"></div>

                <svg class="tq-route" viewBox="0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                    ${routePaths('tq-route__segment', (segment) => ` data-route-segment data-progress-min="${segment.minProgress}" data-progress-max="${segment.maxProgress}"`)}
                    ${routePaths('tq-route__fog', (segment) => ` data-fog-segment data-progress-min="${segment.minProgress}" data-progress-max="${segment.maxProgress}"`)}
                    <g class="tq-route__connectors">${parts.connectorsHtml}</g>
                </svg>

                ${places}
                <span class="tq-route-finish" data-route-progress="100" data-offset-x="${PORTAL.x - ROUTE_POINTS[ROUTE_POINTS.length - 1][0]}" data-offset-y="${PORTAL.y - ROUTE_POINTS[ROUTE_POINTS.length - 1][1]}">
                    <button type="button" class="tq-route-finish__button portal-trigger" data-place="portal" style="--place-glow:${PLACE_GLOW.portal}" aria-label="The Crystal Portal: open it">
                        <span class="tq-route-finish__glow" aria-hidden="true"></span>
                        <img class="tq-portal-vortex tq-portal-vortex--outer" src="${LIVING_MAP_ASSETS.portalVortex}" alt="" draggable="false" decoding="async" aria-hidden="true">
                        <img class="tq-portal-vortex tq-portal-vortex--inner" src="${LIVING_MAP_ASSETS.portalVortex}" alt="" draggable="false" decoding="async" aria-hidden="true">
                        <img class="tq-portal-vortex tq-portal-vortex--veiled" src="${LIVING_MAP_ASSETS.portalVortexVeiled}" alt="" draggable="false" decoding="async" aria-hidden="true">
                        <span class="tq-portal-veil" aria-hidden="true">${[1, 2, 0].map((cloud, i) => `<span class="tq-portal-veil__cloud" style="--i:${i}"><img src="${PAINTED_PROPS.clouds[cloud]}" alt="" draggable="false" decoding="async"></span>`).join('')}</span>
                        <span class="tq-portal-shine" aria-hidden="true"><span></span></span>
                    </button>
                </span>
                <div class="tq-world-front" data-quest-world-front aria-hidden="true"></div>
                <div class="tq-class-token-layer">${parts.tokensHtml}</div>
            </div>

            <div class="tq-living-map__ink" aria-hidden="true">
                <img src="${PAINTED_PROPS.sketch}" alt="" draggable="false" decoding="async">
            </div>
            <span class="tq-living-map__sweep" aria-hidden="true"></span>

            <div class="tq-map-title" aria-hidden="true">
                <img class="tq-map-title__scroll" src="${LIVING_MAP_ASSETS.scrollMap}" alt="" draggable="false" decoding="async">
            </div>

            <div class="tq-map-controls">
                <button type="button" class="tq-map-replay" data-map-replay title="Replay the journey" aria-label="Replay the journey">
                    <i class="fas fa-shoe-prints" aria-hidden="true"></i>
                </button>
                ${renderChronicleButton(parts.count)}
            </div>
        </div>
        <div class="tq-unroll" aria-hidden="true">
            <span class="tq-unroll__side tq-unroll__side--left">
                <img class="tq-unroll__roll" src="${LIVING_MAP_ASSETS.parchmentBacking}" alt="" draggable="false" decoding="async">
            </span>
            <span class="tq-unroll__side tq-unroll__side--right">
                <img class="tq-unroll__roll" src="${LIVING_MAP_ASSETS.parchmentBacking}" alt="" draggable="false" decoding="async">
            </span>
            <span class="tq-unroll__ribbon" style="--ribbon:url('${PAINTED_PROPS.ribbon}')">
                <span class="tq-unroll__ribbon-half tq-unroll__ribbon-half--l"></span>
                <span class="tq-unroll__ribbon-half tq-unroll__ribbon-half--r"></span>
            </span>
            <span class="tq-unroll__seal">
                <span class="tq-unroll__seal-flash"></span>
                <img class="tq-unroll__seal-half tq-unroll__seal-half--l" src="${PAINTED_PROPS.seal}" alt="" draggable="false" decoding="async">
                <img class="tq-unroll__seal-half tq-unroll__seal-half--r" src="${PAINTED_PROPS.seal}" alt="" draggable="false" decoding="async">
                <span class="tq-unroll__seal-sparks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
            </span>
        </div>
        <div class="tq-sparks" data-map-sparks aria-hidden="true"></div>
        <div class="tq-tip" data-map-tip role="tooltip" id="tq-place-tip" hidden>
            <div class="tq-tip__inner" data-map-tip-body></div>
            <span class="tq-tip__arrow" aria-hidden="true"></span>
        </div>
        <div class="tq-popover" data-map-popover role="dialog" aria-label="Quest party details" hidden>
            <div class="tq-popover__inner" data-map-popover-body></div>
            <span class="tq-popover__arrow" aria-hidden="true"></span>
        </div>
        <div class="tq-token-cards" data-token-cards hidden>${parts.cardsHtml}</div>
    </div>`;
}

/**
 * Draws the league map into `slot`. When the map shell is already there, only
 * the parties are swapped — the artwork stays decoded and nothing flashes.
 */
export function renderLeagueMapInto(slot, classes, options = {}) {
    if (!slot) return null;
    const root = slot.querySelector('[data-living-quest-map]');
    if (!root) {
        slot.innerHTML = generateLeagueMapHtml(classes, options);
        return arrive(slot.querySelector('[data-living-quest-map]'));
    }
    const parts = buildLeagueMapParts(classes, options);
    const tokenLayer = root.querySelector('.tq-class-token-layer');
    const cards = root.querySelector('[data-token-cards]');
    const connectors = root.querySelector('.tq-route__connectors');
    if (tokenLayer) tokenLayer.innerHTML = parts.tokensHtml;
    if (cards) cards.innerHTML = parts.cardsHtml;
    if (connectors) connectors.innerHTML = parts.connectorsHtml;
    const count = root.querySelector('[data-chronicle-count]');
    if (count) {
        count.textContent = String(parts.count);
        count.setAttribute('aria-label', `${parts.count} parties`);
    }
    return root;
}

/** A freshly drawn scroll floats down into place instead of popping in. */
function arrive(root) {
    if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return root;
    root.classList.add('is-arriving');
    setTimeout(() => root.classList.remove('is-arriving'), 900);
    return root;
}

/**
 * The general view with no map yet: the sealed scroll waits with its note, so
 * picking a class breaks this very seal and unrolls it (no map is started).
 */
export function renderSealedLeagueMapInto(slot, note = '') {
    if (!slot) return null;
    let root = slot.querySelector('[data-living-quest-map]');
    if (!root) {
        slot.innerHTML = generateLeagueMapHtml([], {});
        root = slot.querySelector('[data-living-quest-map]');
        // The scroll's own styles come with the world (worldScene.js); with no
        // map started yet, fetch them here and show the scroll once they apply.
        root.dataset.styling = 'pending';
        const shown = root;
        import('../styles/quest_world.css').catch(() => {}).then(() => {
            delete shown.dataset.styling;
            arrive(shown);
        });
    }
    root.classList.add('is-idle');
    setIdleNote(root, note);
    return root;
}

function getRoutePoint(routeSegments, progress) {
    const safeProgress = Math.min(100, Math.max(0, Number(progress) || 0));
    const segment = routeSegments.find((candidate, index) => (
        safeProgress >= candidate.minProgress
        && (safeProgress < candidate.maxProgress || index === routeSegments.length - 1)
    )) || routeSegments[routeSegments.length - 1];
    const segmentRange = segment.maxProgress - segment.minProgress || 1;
    const localProgress = Math.min(1, Math.max(0, (safeProgress - segment.minProgress) / segmentRange));
    const length = segment.totalLength * localProgress;
    const point = segment.path.getPointAtLength(length);
    const before = segment.path.getPointAtLength(Math.max(0, length - 1));
    const after = segment.path.getPointAtLength(Math.min(segment.totalLength, length + 1));
    const tangentX = after.x - before.x;
    const tangentY = after.y - before.y;
    const magnitude = Math.hypot(tangentX, tangentY) || 1;
    return {
        x: point.x,
        y: point.y,
        normalX: -tangentY / magnitude,
        normalY: tangentX / magnitude
    };
}

function constrainMapPoint(point) {
    point.x = Math.min(MAP_VIEWBOX_WIDTH - MAP_TOKEN_EDGE_MARGIN, Math.max(MAP_TOKEN_EDGE_MARGIN, point.x));
    point.y = Math.min(MAP_VIEWBOX_HEIGHT - MAP_TOKEN_EDGE_MARGIN, Math.max(MAP_TOKEN_EDGE_MARGIN, point.y));
    return point;
}

function getLanePoint(routeSegments, progress, lane) {
    const anchor = getRoutePoint(routeSegments, progress);
    const point = constrainMapPoint({
        x: anchor.x + anchor.normalX * lane * MAP_LANE_GAP,
        y: anchor.y + anchor.normalY * lane * MAP_LANE_GAP
    });
    return { anchor, point };
}

function mapTransform(point, rootRect) {
    const x = (point.x / MAP_VIEWBOX_WIDTH) * rootRect.width;
    const y = (point.y / MAP_VIEWBOX_HEIGHT) * rootRect.height;
    return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
}

function sampleTokenJourney(routeSegments, fromProgress, toProgress, fromLane, toLane, rootRect, fadeIn) {
    const distance = Math.abs(toProgress - fromProgress);
    const steps = Math.max(6, Math.ceil(distance / 3));
    const frames = [];
    for (let index = 0; index <= steps; index++) {
        const ratio = index / steps;
        const progress = fromProgress + (toProgress - fromProgress) * ratio;
        const lane = fromLane + (toLane - fromLane) * ratio;
        const { point } = getLanePoint(routeSegments, progress, lane);
        frames.push({
            transform: mapTransform(point, rootRect),
            opacity: fadeIn ? Math.min(1, ratio * 6) : 1,
            offset: ratio
        });
    }
    return frames;
}

/** The short line shown under a rolled-up map ("pick a class to unroll it"). */
function setIdleNote(root, note) {
    let el = root.querySelector('.tq-idle-note');
    if (!note) {
        el?.remove();
        return;
    }
    if (!el) {
        el = document.createElement('p');
        el.className = 'tq-idle-note';
        root.appendChild(el);
    }
    el.innerHTML = note;
}

/**
 * Rolls the map on screen up and seals it, then lets it go (no controller is
 * left to unroll it again). Resolves at once when there is no map.
 */
export function rollUpLivingQuestMap({ note = '' } = {}) {
    const controller = activeLivingMapController;
    if (!controller) return Promise.resolve(false);
    return controller.rollUp({ note }).then((sealed) => {
        // Only a scroll that finished rolling up is done with; one interrupted by
        // a newer request stays with whoever took it over.
        if (sealed && activeLivingMapController === controller) controller.destroy();
        return sealed;
    });
}

/** The living map controller for the map currently on screen (null when none). */
export function getActiveLivingQuestMap() {
    return activeLivingMapController;
}

export function initializeLivingQuestMap(scope, { leagueKey = '', replay = false } = {}) {
    activeLivingMapController?.destroy?.();
    activeLivingMapController = null;

    const root = scope?.querySelector?.('[data-living-quest-map]');
    const frame = root?.querySelector('.tq-living-map__frame');
    if (root) {
        setIdleNote(root, '');
        // A map that was rolling up when this one took over leaves no pose behind.
        root.classList.remove('is-idle', 'is-furling', 'is-resealing');
    }
    const toSegments = (selector) => [...(root?.querySelectorAll?.(selector) || [])].map((path) => ({
        path,
        minProgress: Number(path.dataset.progressMin) || 0,
        maxProgress: Number(path.dataset.progressMax) || 100,
        totalLength: path.getTotalLength()
    }));
    const routeSegments = toSegments('[data-route-segment]');
    if (!root || !frame || routeSegments.length === 0) return null;
    const fogSegments = toSegments('[data-fog-segment]');
    const portalFinish = root.querySelector('.tq-route-finish');

    const listeners = new AbortController();
    const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: listeners.signal });
    const timers = new Set();
    const later = (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
        return id;
    };

    const tokens = [...root.querySelectorAll('[data-map-token]')];
    const waypoints = [...root.querySelectorAll('[data-waypoint-progress]')];
    const routeAnchors = [...root.querySelectorAll('[data-route-progress]:not([data-map-token])')];
    const connectorsByKey = new Map(
        [...root.querySelectorAll('[data-connector-key]')].map((line) => [line.dataset.connectorKey, line])
    );
    const popover = root.querySelector('[data-map-popover]');
    const popoverBody = root.querySelector('[data-map-popover-body]');
    const replayButton = root.querySelector('[data-map-replay]');
    const activeAnimations = new Set();
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const continuing = !replay && Boolean(leagueKey) && mapMemory.leagueKey === leagueKey;
    const previous = continuing ? new Map(mapMemory.tokens) : new Map();
    const pinnedKeyToRestore = continuing ? mapMemory.pinnedKey : null;
    if (!continuing) mapMemory.pinnedKey = null;
    let offscreen = false;
    let pageHidden = document.hidden;
    let journeyPlayed = false;
    let destroyed = false;

    // --- The living world (features/questWorld/*), mounted lazily -------------
    // It outlives this controller: live updates re-create the controller but keep
    // the world, so its animations never restart under the teacher's eyes.
    const sceneTier = () => resolveSceneTier({ fx: root.dataset.fx, reducedMotion: reducedMotionQuery.matches });
    const syncTilt = () => {
        root.dataset.tilt = String(sceneTier() === 'full' ? SCENE_TIERS.full.tilt : 0);
    };
    syncTilt();
    let scene = null;
    let lastExplored = 0;
    const scenePromise = import('./questWorld/worldScene.js')
        .then(({ mountQuestWorld }) => {
            if (destroyed) return null;
            scene = mountQuestWorld(root, { tier: sceneTier() });
            if (scene) {
                scene.setLeague(leagueKey);
                scene.setExplored(lastExplored);
                syncLeader();
                updateMotionState();
                mountMagic();
            }
            return scene;
        })
        .catch((error) => {
            console.warn('Quest World could not load; the map keeps its road and parties.', error);
            root.classList.add('is-world-missing');
            return null;
        });

    // --- Map magic (features/questWorld/mapMagic.js): trails, pins, gates, the camera ---
    let magic = null;
    const partiesNow = () => tokens.map((token) => {
        const s = tokenState(token);
        return {
            key: s.key,
            el: token,
            progress: s.progress,
            stars: s.stars,
            goal: Number(token.dataset.goal) || 0,
            name: token.dataset.name,
            logo: token.dataset.logo,
            isMine: token.classList.contains('is-mine'),
            isLeader: token.classList.contains('is-leader')
        };
    });
    const mountMagic = () => {
        import('./questWorld/mapMagic.js').then(({ mountMapMagic }) => {
            if (destroyed || !scene) return;
            magic = mountMapMagic({ root, scene, parties: partiesNow, tier: sceneTier });
            if (!magic) return;
            magic.setExplored(lastExplored);
            magic.setPaused(root.classList.contains('is-motion-paused'));
            if (openToken) magic.focusParty(openToken.dataset.tokenKey);
        }).catch((error) => console.warn('Quest map magic could not load.', error));
    };

    const tokenState = (token) => ({
        key: token.dataset.tokenKey,
        progress: Math.min(100, Math.max(0, Number(token.dataset.progress) || 0)),
        stars: Number(token.dataset.stars) || 0,
        lane: Number(token.dataset.lane) || 0
    });

    // Remember where everyone ends up, whatever happens to this controller.
    const mineToken = tokens.find((token) => token.classList.contains('is-mine'));
    const mineChanged = continuing && Boolean(mineToken) && mapMemory.mineKey !== mineToken.dataset.tokenKey;
    mapMemory.mineKey = mineToken?.dataset.tokenKey || null;
    mapMemory.leagueKey = leagueKey || null;
    mapMemory.tokens = new Map(tokens.map((token) => {
        const s = tokenState(token);
        return [s.key, { progress: s.progress, stars: s.stars, lane: s.lane }];
    }));

    // --- The scroll: the map unrolls from its two rods whenever it is shown afresh ---
    // One custom property drives every moving part (see team_quest_map_living.css),
    // written once per frame so the rods and the map edge stay locked together.
    let scrollFrame = 0;
    let scrollMotion = Promise.resolve();
    let revealPromise = null;
    const scrollOpenness = () => {
        if (root.dataset.scroll === 'open') return 1;
        if (root.dataset.scroll === 'rolled') return 0;
        return Math.min(1, Math.max(0, Number.parseFloat(root.style.getPropertyValue('--tq-open')) || 0));
    };
    const setScrollPose = (pose) => {
        cancelAnimationFrame(scrollFrame);
        settleScroll?.(false);
        root.style.removeProperty('--tq-open');
        root.dataset.scroll = pose;
        if (pose === 'rolled') root.classList.remove('is-unsealing', 'is-blooming');
    };
    // The motion in flight. Ending it early (a newer motion, a pose, or destroy)
    // settles its promise with false, so whatever waited on it does not carry on.
    let settleScroll = null;
    let rollingUp = null;
    const moveScroll = (to, duration, ease) => {
        cancelAnimationFrame(scrollFrame);
        settleScroll?.(false);
        const from = scrollOpenness();
        return new Promise((done) => {
            const resolve = (finished = true) => {
                if (settleScroll !== resolve) return;
                settleScroll = null;
                done(finished && !destroyed);
            };
            settleScroll = resolve;
            if (Math.abs(to - from) < 0.001) { resolve(); return; }
            root.style.setProperty('--tq-open', from.toFixed(4));
            root.dataset.scroll = 'moving';
            const span = duration * Math.abs(to - from);
            let start = 0;
            const step = (now) => {
                if (destroyed) { resolve(false); return; }
                start ||= now;
                const t = Math.min(1, (now - start) / span);
                root.style.setProperty('--tq-open', (from + (to - from) * ease(t)).toFixed(4));
                if (t < 1) scrollFrame = requestAnimationFrame(step);
                else resolve();
            };
            scrollFrame = requestAnimationFrame(step);
        });
    };

    if (reducedMotionQuery.matches) setScrollPose('open');
    else if (replay && root.dataset.scroll === 'open') {
        // An open map in view rolls itself up first; one out of sight simply waits rolled.
        const rect = root.getBoundingClientRect();
        const inView = !document.hidden && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
        if (inView) scrollMotion = moveScroll(0, SCROLL_FURL_MS, easeInCubic).then((finished) => { if (finished) setScrollPose('rolled'); });
        else setScrollPose('rolled');
    }

    /** The ink sketch on the opened paper washes into the painted world. */
    const bloomInk = () => {
        root.classList.remove('is-blooming');
        void root.offsetWidth;
        root.classList.add('is-blooming');
        later(() => root.classList.remove('is-blooming'), INK_BLOOM_MS);
    };

    /**
     * Breaks the seal, unrolls the map and blooms the ink into colour; resolves
     * as the colour arrives, when the parties set off.
     */
    const unrollScroll = () => {
        revealPromise ||= scrollMotion.then(() => new Promise((resolve) => {
            if (destroyed || root.dataset.scroll === 'open') { resolve(); return; }
            if (reducedMotionQuery.matches) { setScrollPose('open'); resolve(); return; }
            root.classList.add('is-unsealing');
            later(() => {
                if (destroyed) { resolve(); return; }
                moveScroll(1, SCROLL_UNROLL_MS, easeUnroll).then((finished) => {
                    root.classList.remove('is-unsealing');
                    if (destroyed || !finished) { resolve(); return; }
                    setScrollPose('open');
                    bloomInk();
                    later(resolve, 260);
                });
            }, root.dataset.fx === 'lite' ? SEAL_BREAK_LITE_MS : SEAL_BREAK_MS);
        }));
        return revealPromise;
    };

    const leaderProgress = () => Math.max(0, ...tokens.map((token) => tokenState(token).progress));

    /** The leading party flies its banner over the furthest realm reached. */
    const syncLeader = () => {
        if (!scene) return;
        const lead = tokens.find((token) => token.classList.contains('is-leader'));
        const moving = lead && tokenState(lead).progress > 0;
        scene.setLeader(moving ? { logo: lead.dataset.logo, name: lead.dataset.name } : null);
    };

    const positionStaticElements = () => {
        routeAnchors.forEach((element) => {
            const point = getRoutePoint(routeSegments, element.dataset.routeProgress);
            point.x += Number(element.dataset.offsetX) || 0;
            point.y += Number(element.dataset.offsetY) || 0;
            element.style.left = `${(point.x / MAP_VIEWBOX_WIDTH) * 100}%`;
            element.style.top = `${(point.y / MAP_VIEWBOX_HEIGHT) * 100}%`;
        });
    };

    // The road beyond the furthest party is still unexplored: washed out under a veil of parchment.
    const updateExploration = (explored, { animate = false } = {}) => {
        lastExplored = explored;
        // The Portal hides behind the clouds, shining through, until a party reaches the Crystal Realm.
        if (portalFinish) portalFinish.dataset.veil = { asleep: 'deep', waking: 'thin' }[realmStates(explored).crystal] || 'clear';
        scene?.setExplored(explored, { animate });
        magic?.setExplored(explored, { animate });
        const rect = frame.getBoundingClientRect();
        const unitsPerPixel = rect.width ? MAP_VIEWBOX_WIDTH / rect.width : 1;
        fogSegments.forEach((segment) => {
            const range = segment.maxProgress - segment.minProgress || 1;
            const ratio = Math.min(1, Math.max(0, (explored - segment.minProgress) / range));
            const exploredLength = segment.totalLength * ratio;
            const rest = Math.max(0, segment.totalLength - exploredLength);
            segment.path.style.strokeWidth = (ROAD_FOG_PX * unitsPerPixel).toFixed(2);
            segment.path.style.transitionDelay = animate
                ? `${Math.round((segment.minProgress / Math.max(1, explored)) * 1200)}ms`
                : '0ms';
            segment.path.classList.toggle('is-animated', animate);
            segment.path.style.strokeDasharray = `${rest.toFixed(1)} ${(segment.totalLength + 40).toFixed(1)}`;
            segment.path.style.strokeDashoffset = (-exploredLength).toFixed(1);
        });
    };

    const updateWaypointStates = () => {
        const progressValues = tokens.map((token) => tokenState(token).progress);
        const leader = Math.max(0, ...progressValues);
        const checkpointStarts = [0, 0, 30, 60];

        waypoints.forEach((waypoint, index) => {
            const targetProgress = Number(waypoint.dataset.waypointProgress) || 0;
            const startProgress = checkpointStarts[index] ?? 0;
            const checkpointRange = Math.max(1, targetProgress - startProgress);
            const charge = targetProgress === 0
                ? 1
                : Math.min(1, Math.max(0, (leader - startProgress) / checkpointRange));
            const occupied = progressValues.some((progress) => Math.abs(progress - targetProgress) <= 3.5);
            const haloOpacity = 0.16 + charge * 0.42;
            const haloScale = 0.84 + charge * 0.22;

            waypoint.style.setProperty('--waypoint-halo-opacity', haloOpacity.toFixed(3));
            waypoint.style.setProperty('--waypoint-halo-scale', haloScale.toFixed(3));
            waypoint.style.setProperty('--waypoint-hover-opacity', Math.min(1, haloOpacity + 0.35).toFixed(3));
            waypoint.style.setProperty('--waypoint-hover-scale', (haloScale + 0.15).toFixed(3));
            waypoint.classList.toggle('is-occupied', occupied);
            waypoint.classList.toggle('is-reached', targetProgress === 0 || leader >= targetProgress);
        });
    };

    const celebrateWaypoint = (progress) => {
        const waypoint = waypoints.find((candidate) => Number(candidate.dataset.waypointProgress) === progress);
        if (!waypoint) return;
        waypoint.classList.remove('is-celebrating');
        void waypoint.offsetWidth;
        waypoint.classList.add('is-celebrating');
        later(() => waypoint.classList.remove('is-celebrating'), 1800);
        scene?.celebrateRealm(progress);
        magic?.flareGate(progress);
    };

    const placeToken = (token, rect) => {
        const { key, progress, lane } = tokenState(token);
        const { anchor, point } = getLanePoint(routeSegments, progress, lane);
        token.style.transform = mapTransform(point, rect);
        token.style.zIndex = String(60 + Math.round(progress) + Math.abs(lane) + (token.classList.contains('is-mine') ? 30 : 0));
        token.dataset.positioned = 'true';
        const connector = connectorsByKey.get(key);
        if (connector) {
            connector.setAttribute('x1', anchor.x.toFixed(1));
            connector.setAttribute('y1', anchor.y.toFixed(1));
            connector.setAttribute('x2', point.x.toFixed(1));
            connector.setAttribute('y2', point.y.toFixed(1));
            connector.classList.toggle('is-visible', lane !== 0);
        }
    };

    const positionTokens = () => {
        const rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        tokens.forEach((token) => placeToken(token, rect));
    };

    const showGain = (token, gain) => {
        if (!(gain > 0)) return;
        const chip = document.createElement('span');
        chip.className = 'tq-token__gain';
        chip.setAttribute('aria-hidden', 'true');
        chip.textContent = `+${formatQuestStars(Math.round(gain * 10) / 10)}★`;
        token.querySelector('.tq-token__body')?.appendChild(chip);
        later(() => chip.remove(), 2200);
    };

    const travel = (token, { from, to, fromLane, toLane, delay, fadeIn, gain }) => {
        const rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const distance = Math.abs(to - from);
        const duration = Math.min(3000, 650 + distance * 17);
        const animation = token.animate(
            sampleTokenJourney(routeSegments, from, to, fromLane, toLane, rect, fadeIn),
            { duration, delay, easing: 'cubic-bezier(0.37, 0.08, 0.22, 1)', fill: 'backwards' }
        );
        if (to > from) magic?.walk({ from, to, delay, duration, ease: easeTravel });
        activeAnimations.add(animation);
        later(() => token.classList.add('is-travelling'), delay);
        const settle = () => {
            activeAnimations.delete(animation);
            token.classList.remove('is-travelling');
        };
        animation.addEventListener('finish', () => {
            settle();
            if (destroyed) return;
            token.classList.add('is-arrived');
            later(() => token.classList.remove('is-arrived'), 1100);
            if (openToken === token) positionPopover();
            showGain(token, gain);
            QUEST_ROAD_STOPS.forEach((stop) => {
                if (stop.progress < 100 && from < stop.progress && to >= stop.progress) celebrateWaypoint(stop.progress);
            });
        }, { once: true });
        animation.addEventListener('cancel', settle, { once: true });
        if (offscreen || pageHidden) animation.pause();
    };

    const playJourney = ({ fromStart = false } = {}) => {
        const rect = frame.getBoundingClientRect();
        const reduced = reducedMotionQuery.matches;
        positionTokens();
        root.dataset.mapReady = 'true';
        if (!rect.width || reduced) {
            updateExploration(leaderProgress());
            return;
        }

        // Stagger from the back of the pack so the leader arrives last, to applause.
        const ordered = [...tokens].sort((a, b) => tokenState(a).progress - tokenState(b).progress);
        let delayIndex = 0;
        ordered.forEach((token) => {
            const current = tokenState(token);
            const before = fromStart ? null : previous.get(current.key);
            const from = before ? before.progress : 0;
            const moved = Math.abs(current.progress - from) > 0.05 || !before;
            if (!moved) return;
            travel(token, {
                from,
                to: current.progress,
                fromLane: before ? before.lane : 0,
                toLane: current.lane,
                delay: (before ? 120 : 220) + delayIndex * (before ? 90 : 140),
                fadeIn: !before,
                gain: before ? current.stars - before.stars : 0
            });
            delayIndex += 1;
        });

        const previousLeader = fromStart || !continuing
            ? 0
            : Math.max(0, ...[...previous.values()].map((value) => value.progress));
        updateExploration(previousLeader);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!destroyed) updateExploration(leaderProgress(), { animate: true });
        }));
    };

    const applyFx = (fx) => {
        if (root.dataset.fx === fx) return;
        root.dataset.fx = fx;
        syncTilt();
        scene?.setTier(sceneTier());
        magic?.setTier();
        positionTokens();
    };

    // Watch the frame rate once the parties have settled. Only a machine that
    // stays slow over two samples steps down: full to lite (no parallax, tilt or
    // lantern), then lite to calm (the small creatures rest; the world, the
    // windmills, the waterfall and the Portal still move). A battery saver that
    // holds the screen at 30 frames a second is smooth enough and never counts.
    let slowSamples = 0;
    const probeFrameRate = () => {
        if (destroyed || reducedMotionQuery.matches || root.dataset.calm === '1') return;
        if (readStoredFxPreference()) return; // a tier forced for this tab (the preview page)
        let frames = 0;
        let total = 0;
        let last = performance.now();
        const tick = (now) => {
            if (destroyed) return;
            // A single long pause (a save, a tab switch) is not the map being slow.
            total += Math.min(now - last, 120);
            last = now;
            frames += 1;
            if (frames < 90) { requestAnimationFrame(tick); return; }
            if (offscreen || pageHidden) { later(probeFrameRate, 3000); return; }
            const fps = 1000 / (total / frames);
            if (fps >= 22) { slowSamples = 0; return; }
            slowSamples += 1;
            if (slowSamples < 2) { later(probeFrameRate, 1200); return; }
            slowSamples = 0;
            if (root.dataset.fx !== 'lite') {
                autoFx.lite = true;
                applyFx('lite');
                later(probeFrameRate, 2500);
            } else {
                autoFx.calm = true;
                root.dataset.calm = '1';
            }
        };
        requestAnimationFrame(tick);
    };

    const startJourney = () => {
        if (journeyPlayed || destroyed) return;
        journeyPlayed = true;
        positionStaticElements();
        updateWaypointStates();
        playJourney();
        updateMotionState();
        if (!continuing) later(probeFrameRate, 2600);
    };

    const updateMotionState = () => {
        const reduced = reducedMotionQuery.matches;
        const suspended = reduced || offscreen || pageHidden;
        root.classList.toggle('is-motion-paused', suspended);
        root.classList.toggle('is-reduced-motion', reduced);
        scene?.setPaused(suspended);
        magic?.setPaused(suspended);
        activeAnimations.forEach((animation) => {
            if (suspended) animation.pause();
            else animation.play();
        });
    };

    // --- Party card (one shared popover) -------------------------------------
    let openToken = null;
    let pinned = false;
    let restoringFocus = false;
    let showTimer = 0;
    let hideTimer = 0;
    let collapseTimer = 0;

    const positionPopover = () => {
        if (!openToken || !popover || popover.hidden) return;
        const rootRect = root.getBoundingClientRect();
        const disc = (openToken.querySelector('.tq-token__disc') || openToken).getBoundingClientRect();
        const width = popover.offsetWidth;
        const height = popover.offsetHeight;
        const centerX = disc.left + disc.width / 2 - rootRect.left;
        const gapPx = 14;
        let placement = 'top';
        let top = disc.top - rootRect.top - height - gapPx;
        if (disc.top - height - gapPx < 8) {
            placement = 'bottom';
            top = disc.bottom - rootRect.top + gapPx;
        }
        const left = Math.min(Math.max(6, centerX - width / 2), Math.max(6, rootRect.width - width - 6));
        popover.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        popover.style.setProperty('--arrow-x', `${Math.round(Math.min(width - 22, Math.max(22, centerX - left)))}px`);
        popover.dataset.placement = placement;
    };

    const closePopover = ({ restoreFocus = false } = {}) => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        if (!openToken || !popover) return;
        const token = openToken;
        token.classList.remove('is-selected');
        token.setAttribute('aria-expanded', 'false');
        openToken = null;
        pinned = false;
        mapMemory.pinnedKey = null;
        popover.dataset.state = 'closed';
        popover.dataset.pinned = 'false';
        magic?.focusParty(null);
        scene?.release();
        // Its own timer: a later hover-out must not cancel the card actually going away.
        clearTimeout(collapseTimer);
        collapseTimer = later(() => {
            if (!openToken) popover.hidden = true;
        }, 180);
        if (restoreFocus) {
            restoringFocus = true;
            token.focus({ preventScroll: true });
            restoringFocus = false;
        }
    };

    const openPopover = (token, { pin = false } = {}) => {
        if (!popover || !popoverBody) return;
        if (typeof hideTip === 'function') hideTip({ now: true });
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        clearTimeout(collapseTimer);
        if (openToken !== token) {
            const template = root.querySelector(`template[data-card-for="${CSS.escape(token.dataset.tokenKey)}"]`);
            if (!template) return;
            openToken?.classList.remove('is-selected');
            openToken?.setAttribute('aria-expanded', 'false');
            popoverBody.replaceChildren(template.content.cloneNode(true));
            openToken = token;
            popover.dataset.state = 'closed';
        }
        pinned = pin || pinned;
        popover.dataset.pinned = pinned ? 'true' : 'false';
        if (pinned) mapMemory.pinnedKey = token.dataset.tokenKey;
        token.classList.add('is-selected');
        token.setAttribute('aria-expanded', 'true');
        magic?.focusParty(token.dataset.tokenKey);
        popover.hidden = false;
        positionPopover();
        requestAnimationFrame(() => {
            if (openToken === token) popover.dataset.state = 'open';
        });
    };

    const scheduleClose = () => {
        if (pinned || !openToken) return;
        clearTimeout(hideTimer);
        hideTimer = later(() => { if (!pinned) closePopover(); }, 170);
    };

    tokens.forEach((token) => {
        on(token, 'pointerenter', (event) => {
            if (event.pointerType !== 'mouse' || pinned) return;
            clearTimeout(hideTimer);
            clearTimeout(showTimer);
            showTimer = later(() => openPopover(token), openToken ? 0 : 70);
        });
        on(token, 'pointerleave', (event) => {
            if (event.pointerType !== 'mouse') return;
            clearTimeout(showTimer);
            scheduleClose();
        });
        on(token, 'click', (event) => {
            event.stopPropagation();
            if (openToken === token && pinned) {
                closePopover();
                return;
            }
            openPopover(token, { pin: true });
            // Keyboard activation (Enter/Space) moves focus into the card so its button is reachable.
            if (event.detail === 0) requestAnimationFrame(() => popover?.querySelector('[data-open-chronicle]')?.focus({ preventScroll: true }));
        });
        on(token, 'focus', () => {
            if (!restoringFocus && token.matches(':focus-visible') && !pinned) openPopover(token);
        });
        on(token, 'blur', (event) => {
            if (popover?.contains(event.relatedTarget)) return;
            scheduleClose();
        });
    });

    if (popover) {
        on(popover, 'pointerenter', () => clearTimeout(hideTimer));
        on(popover, 'pointerleave', () => scheduleClose());
        on(popover, 'focusout', (event) => {
            if (popover.contains(event.relatedTarget) || tokens.includes(event.relatedTarget)) return;
            scheduleClose();
        });
        on(popover, 'click', (event) => {
            const cta = event.target.closest('[data-open-chronicle]');
            if (!cta) return;
            const classId = cta.dataset.openChronicle;
            closePopover();
            root.dispatchEvent(new CustomEvent('tq:open-chronicle', { bubbles: true, detail: { classId } }));
        });
    }

    on(root, 'keydown', (event) => {
        if (event.key === 'Escape' && openToken) {
            event.stopPropagation();
            closePopover({ restoreFocus: true });
        }
    });
    on(document, 'pointerdown', (event) => {
        if (!openToken) return;
        if (popover?.contains(event.target) || event.target.closest?.('[data-map-token]')) return;
        closePopover();
    }, { capture: true });

    // --- Places: the realms' landmarks and the Portal answer a hover or a click ---
    const placeEls = [...root.querySelectorAll('[data-place]')];
    const tip = root.querySelector('[data-map-tip]');
    const tipBody = root.querySelector('[data-map-tip-body]');
    const sparks = root.querySelector('[data-map-sparks]');
    let tipFor = null;
    let tipShowTimer = 0;
    let tipHideTimer = 0;

    let hoveredPlace = null;
    let roadActive = false;
    const placeGeometry = (id) => (id === 'portal'
        ? { x: PORTAL.x, y: PORTAL.y, rx: 70, ry: 70 }
        : REALM_PLACES.find((place) => place.id === id) || null);

    const positionTip = () => {
        if (!tipFor || !tip || tip.hidden) return;
        const rootRect = root.getBoundingClientRect();
        const target = tipFor.getBoundingClientRect();
        const width = tip.offsetWidth;
        const height = tip.offsetHeight;
        const centerX = target.left + target.width / 2 - rootRect.left;
        // Over the place's upper part (big places) or just above it (small ones).
        const anchorTop = target.top - rootRect.top + Math.min(target.height * 0.22, 40);
        let top = anchorTop - height - 10;
        let placement = 'top';
        if (top < 6) {
            top = target.bottom - rootRect.top - Math.min(target.height * 0.22, 40) + 10;
            placement = 'bottom';
        }
        const left = Math.min(Math.max(6, centerX - width / 2), Math.max(6, rootRect.width - width - 6));
        tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        tip.style.setProperty('--arrow-x', `${Math.round(Math.min(width - 20, Math.max(20, centerX - left)))}px`);
        tip.dataset.placement = placement;
    };

    const showTip = (el) => {
        if (!tip || !tipBody) return;
        clearTimeout(tipHideTimer);
        const id = el.dataset.place;
        const info = describePlace(id, partiesNow());
        magic?.focusPlace(placeGeometry(id));
        tipBody.innerHTML = placeTipHtml(info, { badge: ZONE_BADGE_BY_ID[id === 'portal' ? 'crystal' : id] });
        tip.dataset.place = id;
        tip.style.setProperty('--place-glow', PLACE_GLOW[id] || PLACE_GLOW.gold);
        placeEls.forEach((other) => other.classList.toggle('is-hovered', other === el));
        el.setAttribute('aria-describedby', 'tq-place-tip');
        tipFor = el;
        tip.hidden = false;
        positionTip();
        requestAnimationFrame(() => { if (tipFor === el) tip.dataset.state = 'open'; });
    };

    const hideTip = ({ now = false } = {}) => {
        clearTimeout(tipShowTimer);
        clearTimeout(tipHideTimer);
        const finish = () => {
            if (!tip) return;
            tipFor?.classList.remove('is-hovered');
            tipFor?.removeAttribute('aria-describedby');
            tipFor = null;
            magic?.focusPlace(null);
            tip.dataset.state = 'closed';
            later(() => { if (!tipFor) tip.hidden = true; }, 160);
        };
        if (now) finish();
        else tipHideTimer = later(finish, 140);
    };

    /** A burst of sparkles where the class touched the map. */
    const sparkAt = (clientX, clientY, glow, { big = false } = {}) => {
        if (!sparks || reducedMotionQuery.matches) return;
        const rect = root.getBoundingClientRect();
        const spark = document.createElement('span');
        spark.className = `tq-spark${big ? ' is-big' : ''}`;
        spark.style.left = `${(clientX - rect.left).toFixed(1)}px`;
        spark.style.top = `${(clientY - rect.top).toFixed(1)}px`;
        spark.style.setProperty('--spark', glow);
        spark.innerHTML = '<i></i><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b>';
        sparks.appendChild(spark);
        later(() => spark.remove(), 1000);
    };

    placeEls.forEach((el) => {
        on(el, 'pointerenter', (event) => {
            if (event.pointerType !== 'mouse') return;
            hoveredPlace = el;
            if (roadActive) return;
            clearTimeout(tipHideTimer);
            clearTimeout(tipShowTimer);
            tipShowTimer = later(() => showTip(el), tipFor ? 0 : 90);
        });
        on(el, 'pointerleave', (event) => {
            if (event.pointerType !== 'mouse') return;
            if (hoveredPlace === el) hoveredPlace = null;
            clearTimeout(tipShowTimer);
            hideTip();
        });
        on(el, 'focus', () => { if (el.matches(':focus-visible')) showTip(el); });
        on(el, 'blur', () => hideTip());
        on(el, 'pointerdown', (event) => {
            el.classList.remove('is-pressed');
            void el.offsetWidth;
            el.classList.add('is-pressed');
            later(() => el.classList.remove('is-pressed'), 420);
            sparkAt(event.clientX, event.clientY, PLACE_GLOW[el.dataset.place] || PLACE_GLOW.gold, { big: true });
        });
        on(el, 'click', () => hideTip({ now: true }));
    });

    // Anywhere else on the land, a touch leaves a little magic dust.
    on(frame, 'pointerdown', (event) => {
        if (root.dataset.fx === 'lite') return;
        if (event.target.closest('[data-place], [data-map-token], .tq-map-controls, .tq-route-finish, button, a')) return;
        sparkAt(event.clientX, event.clientY, '255, 236, 170');
    });

    // The road pin and a realm's card never show at once: the road wins while the pointer is on it.
    on(root, 'tq:road', (event) => {
        roadActive = Boolean(event.detail?.active);
        if (roadActive) hideTip({ now: true });
        else if (hoveredPlace && !openToken) showTip(hoveredPlace);
    });
    // Cards fade while the camera moves and come back where their party now stands.
    on(root, 'tq:camera', (event) => {
        if (event.detail?.phase !== 'settled') return;
        positionPopover();
        positionTip();
    });

    if (replayButton) {
        on(replayButton, 'click', () => {
            closePopover();
            [...activeAnimations].forEach((animation) => animation.cancel());
            replayButton.classList.remove('is-spinning');
            void replayButton.offsetWidth;
            replayButton.classList.add('is-spinning');
            if (reducedMotionQuery.matches) return;
            positionTokens();
            playJourney({ fromStart: true });
        });
    }

    on(document, 'visibilitychange', () => {
        pageHidden = document.hidden;
        updateMotionState();
    });
    on(reducedMotionQuery, 'change', () => {
        syncTilt();
        scene?.setTier(sceneTier());
        positionTokens();
        updateMotionState();
    });

    // Art first, then the parties set off — never over a blank map.
    const markArtReady = () => root.classList.add('is-art-ready');
    const worldAlreadyReady = Boolean(root.querySelector('.tq-world.is-ready'));
    if (worldAlreadyReady) markArtReady();
    else root.classList.remove('is-art-ready');
    const artReady = worldAlreadyReady
        ? Promise.resolve()
        : Promise.race([
            scenePromise.then((mounted) => mounted?.ready),
            // The first visit on a device paints the world (a second or two on a slow
            // machine); after that it comes from the device cache at once.
            new Promise((done) => later(done, 6000))
        ]).then(() => { markArtReady(); });

    /**
     * The page glides down so the sealed scroll sits in the middle of the view
     * as it opens (or with its top in view, when the map is taller than the view).
     */
    const centreScrollInView = () => {
        const scroller = root.closest('main');
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
        const view = scroller.getBoundingClientRect();
        const rect = root.getBoundingClientRect();
        if (!rect.height || !view.height) return;
        const margin = 12;
        const offset = rect.height + margin * 2 <= view.height
            ? (rect.top - view.top) - (view.height - rect.height) / 2
            : (rect.top - view.top) - margin;
        const top = Math.min(scroller.scrollHeight - scroller.clientHeight, Math.max(0, scroller.scrollTop + offset));
        if (Math.abs(top - scroller.scrollTop) < 8) return;
        scroller.scrollTo({ top, behavior: reducedMotionQuery.matches ? 'auto' : 'smooth' });
    };

    const intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        offscreen = !entry?.isIntersecting;
        // Leaving the tab rolls the map back up, so the next visit opens it again.
        if (offscreen && entry && !entry.boundingClientRect.width && !reducedMotionQuery.matches) {
            closePopover();
            setScrollPose('rolled');
            scrollMotion = Promise.resolve();
            revealPromise = null;
        }
        updateMotionState();
        // A scroll about to open is brought to the middle of the page first.
        if (!offscreen && !revealPromise && root.dataset.scroll !== 'open') centreScrollInView();
        if (!offscreen) artReady.then(unrollScroll).then(startJourney);
    }, { threshold: 0.08 });
    intersectionObserver.observe(root);

    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            magic?.refresh();
            if (scene?.camera && scene.camera.state.zoom > 1.001) scene.camera.home('drag');
            positionStaticElements();
            positionTokens();
            updateExploration(leaderProgress());
            positionPopover();
        });
    });
    resizeObserver.observe(frame);

    positionStaticElements();
    updateWaypointStates();
    positionTokens();
    updateExploration(continuing ? leaderProgress() : 0);
    syncLeader();
    if (continuing) root.dataset.mapReady = 'true';
    else delete root.dataset.mapReady;
    // The header switched to another class of this league: its party lights up where it stands.
    if (mineChanged && !reducedMotionQuery.matches) {
        requestAnimationFrame(() => {
            if (destroyed) return;
            mineToken.classList.add('is-beacon');
            later(() => mineToken.classList.remove('is-beacon'), 2600);
        });
    }

    // A live update redraws the parties; keep the card the teacher pinned open.
    if (pinnedKeyToRestore) {
        const token = tokens.find((candidate) => candidate.dataset.tokenKey === pinnedKeyToRestore);
        if (token) requestAnimationFrame(() => { if (!destroyed) openPopover(token, { pin: true }); });
    }

    const controller = {
        root,
        /** Scrolls the map into view and opens the party card for `classId`. */
        focusClass(classId) {
            const token = tokens.find((candidate) => candidate.dataset.classId === String(classId));
            if (!token) return false;
            root.scrollIntoView({ behavior: reducedMotionQuery.matches ? 'auto' : 'smooth', block: 'center' });
            token.classList.remove('is-beacon');
            void token.offsetWidth;
            token.classList.add('is-beacon');
            later(() => token.classList.remove('is-beacon'), 2600);
            later(() => {
                openPopover(token, { pin: true });
                token.focus({ preventScroll: true });
                const { progress, lane } = tokenState(token);
                const { point } = getLanePoint(routeSegments, progress, lane);
                scene?.glideTo(point.x, point.y).then(() => {
                    if (!destroyed && openToken === token) positionPopover();
                });
            }, 520);
            return true;
        },
        /**
         * Rolls the map back up onto its rods and seals it (the header went to the
         * general view, or to another league). Resolves once it is sealed.
         */
        rollUp({ note = '' } = {}) {
            // Asked again while rolling up (the header moved on twice): the same motion carries on.
            if (rollingUp) {
                setIdleNote(root, note);
                return rollingUp;
            }
            closePopover();
            hideTip({ now: true });
            magic?.focusParty(null);
            [...activeAnimations].forEach((animation) => animation.cancel());
            if (scene?.camera && scene.camera.state.zoom > 1.001) scene.camera.home('drag');
            setIdleNote(root, note);
            const rect = root.getBoundingClientRect();
            const inView = !document.hidden && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
            if (reducedMotionQuery.matches || !inView || root.dataset.scroll === 'rolled') {
                setScrollPose('rolled');
                return Promise.resolve(true);
            }
            root.classList.add('is-furling');
            rollingUp = moveScroll(0, SCROLL_ROLL_UP_MS, easeFurl).then((finished) => new Promise((resolve) => {
                root.classList.remove('is-furling');
                // A newer map took over while this one rolled up: leave the scroll to it.
                if (destroyed || !finished) { rollingUp = null; resolve(false); return; }
                setScrollPose('rolled');
                // The seal is pressed back on.
                root.classList.add('is-resealing');
                setTimeout(() => {
                    root.classList.remove('is-resealing');
                    rollingUp = null;
                    resolve(true);
                }, 520);
            }));
            return rollingUp;
        },
        destroy() {
            destroyed = true;
            magic?.destroy();
            magic = null;
            [...activeAnimations].forEach((animation) => animation.cancel());
            timers.forEach((id) => clearTimeout(id));
            timers.clear();
            cancelAnimationFrame(resizeFrame);
            cancelAnimationFrame(scrollFrame);
            settleScroll?.(false);
            listeners.abort();
            intersectionObserver.disconnect();
            resizeObserver.disconnect();
            scene?.release();
            scene?.setPaused(true);
            if (popover) {
                popover.hidden = true;
                popover.dataset.state = 'closed';
            }
            if (activeLivingMapController === controller) activeLivingMapController = null;
        }
    };
    activeLivingMapController = controller;
    return controller;
}
