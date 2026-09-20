// features/worldMap.js
import * as state from '../state.js'; // Import state to get live scores
import * as utils from '../utils.js';

export const QUEST_MAP_ZONES = [
    {
        id: 'bronze',
        minPercent: 0,
        label: 'Bronze Meadows',
        icon: '🌿',
        desc: 'The first stretch of the adventure road.',
        glow: 'shadow-[0_0_10px_rgba(165,180,252,0.5)]',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'silver',
        minPercent: 30,
        label: 'Silver Peaks',
        icon: '🏔️',
        desc: 'Steady climbers reach the high passes.',
        glow: 'shadow-[0_0_10px_rgba(125,211,252,0.5)] border-sky-200',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'gold',
        minPercent: 60,
        label: 'Golden Citadel',
        icon: '🏰',
        desc: 'The citadel opens to classes on a streak.',
        glow: 'shadow-[0_0_12px_rgba(251,191,36,0.6)] border-amber-300',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'crystal',
        minPercent: 85,
        label: 'Crystal Realm',
        icon: '💎',
        desc: 'Top-tier champions sparkle at the summit.',
        glow: 'shadow-[0_0_15px_rgba(216,180,254,0.8)] border-purple-300',
        animationClass: 'animate-pulse'
    }
];

export function getQuestMapZoneForProgressPercent(progressPercent = 0) {
    const safePercent = Number.isFinite(progressPercent) ? progressPercent : 0;
    return QUEST_MAP_ZONES.reduce((current, zone) => (
        safePercent >= zone.minPercent ? zone : current
    ), QUEST_MAP_ZONES[0]);
}

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
    const goal = classroom.goals?.diamond || 18;
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

const MAP_VIEWBOX_WIDTH = 1200;
const MAP_VIEWBOX_HEIGHT = 675;
const QUEST_ROUTE_SEGMENTS = [
    {
        id: 'bronze', minProgress: 0, maxProgress: 30,
        d: 'M 60 612 C 82 580 108 544 157 522 C 210 496 253 543 302 534 C 337 527 306 478 262 445 C 219 412 214 373 252 346 C 306 307 346 272 360 221 C 371 181 397 151 421 136'
    },
    {
        id: 'silver', minProgress: 30, maxProgress: 60,
        d: 'M 421 136 C 445 177 414 224 442 256 C 469 286 442 326 471 345 C 504 366 519 343 548 356 C 592 377 649 381 691 396 C 734 412 762 420 790 398'
    },
    {
        id: 'gold', minProgress: 60, maxProgress: 85,
        d: 'M 790 398 C 824 362 851 340 876 330 C 901 316 896 282 920 268 C 944 253 937 238 951 224'
    },
    {
        id: 'crystal', minProgress: 85, maxProgress: 100,
        d: 'M 951 224 C 979 202 972 178 996 160 C 1018 143 1009 117 1035 102 C 1049 94 1055 85 1059 77'
    }
];
const MAP_LANE_GAP = 42;
const MAP_TOKEN_EDGE_MARGIN = 44;

const LIVING_MAP_ASSETS = {
    background: new URL('../assets/team-quest-map/living-atlas/map-background-v2.webp', import.meta.url).href,
    plaque: new URL('../assets/team-quest-map/living-atlas/parchment-plaque.webp', import.meta.url).href,
    cloudMist: new URL('../assets/team-quest-map/living-atlas/cloud-mist.webp', import.meta.url).href,
    crystalAura: new URL('../assets/team-quest-map/living-atlas/crystal-aura.webp', import.meta.url).href,
    badgeBronze: new URL('../assets/team-quest-map/living-atlas/badge-bronze.webp', import.meta.url).href,
    badgeSilver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    badgeGold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    badgeCrystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href,
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

let activeLivingMapController = null;

function escapeMapHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
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
        if (cluster.length && item.pct - cluster[0].pct > 2.5) flushCluster();
        cluster.push(item);
    });
    flushCluster();
    return items;
}

function renderMapToken(item) {
    const {
        c,
        pct,
        isLeader,
        pinTier,
        progressDisplay,
        starsDisplay,
        goal,
        displayLevel,
        classQuestBonus,
        tokenKey,
        lane
    } = item;
    const zone = getQuestMapZoneForProgressPercent(pct);
    const safeName = escapeMapHtml(c.name || 'Class');
    const safeLogo = escapeMapHtml(c.logo || '📚');
    const safeZone = escapeMapHtml(zone.label);
    const zoneBadge = ZONE_BADGE_BY_ID[zone.id];
    const tooltipPosition = [
        pct >= 78 ? 'tq-class-token--tooltip-below' : '',
        pct >= 90 ? 'tq-class-token--tooltip-left' : '',
        pct <= 8 ? 'tq-class-token--tooltip-right' : ''
    ].filter(Boolean).map((className) => ` ${className}`).join('');
    const ariaLabel = `${safeName}, ${progressDisplay}% complete, ${starsDisplay} of ${goal} stars, ${safeZone}, level ${displayLevel}`;

    return `
        <button type="button"
                class="tq-class-token tq-class-token--${zone.id} league-map-avatar${isLeader ? ' is-leader' : ''}${tooltipPosition}"
                data-map-token
                data-token-key="${tokenKey}"
                data-progress="${pct}"
                data-lane="${lane}"
                aria-label="${ariaLabel}"
                aria-expanded="false">
            <span class="tq-class-token__visual" aria-hidden="true">
                <span class="tq-class-token__shadow"></span>
                <span class="tq-class-token__core">
                    <span class="tq-class-token__logo">${safeLogo}</span>
                    <img class="tq-class-token__frame"
                         src="${TOKEN_FRAME_BY_TIER[pinTier]}"
                         alt=""
                         draggable="false">
                </span>
            </span>

            <span class="tq-map-tooltip tq-map-tooltip--${zone.id}${isLeader ? ' tq-map-tooltip--leader' : ''}" role="tooltip">
                <span class="tq-map-tooltip__header">
                    <span class="tq-map-tooltip__logo" aria-hidden="true">${safeLogo}</span>
                    <span class="tq-map-tooltip__identity">
                        <strong class="tq-map-tooltip__title">${safeName}</strong>
                        <span class="tq-map-tooltip__zone">
                            <img src="${zoneBadge}" alt="" draggable="false" aria-hidden="true">
                            <span>${safeZone}</span>
                        </span>
                    </span>
                    <span class="tq-map-tooltip__level">Lvl ${displayLevel}</span>
                </span>
                <span class="tq-map-tooltip__meter" aria-hidden="true">
                    <span class="tq-map-tooltip__meter-fill" style="width:${pct}%"></span>
                </span>
                <span class="tq-map-tooltip__stats">
                    <span>
                        <small>Progress</small>
                        <strong>${progressDisplay}%</strong>
                    </span>
                    <span class="tq-map-tooltip__collected">
                        <small>Collected</small>
                        <strong>${starsDisplay} <span aria-hidden="true">/</span> ${goal} <i class="fas fa-star" aria-hidden="true"></i></strong>
                    </span>
                </span>
                ${classQuestBonus > 0 ? `<span class="tq-map-tooltip__bonus"><i class="fas fa-compass" aria-hidden="true"></i> +${classQuestBonus} Pathfinder</span>` : ''}
            </span>
        </button>`;
}

function renderWaypoint({ id, label, icon, progress, className }) {
    return `
        <button type="button"
                class="tq-waypoint tq-waypoint--${className} zone-trigger"
                data-zone="${id}"
                data-route-progress="${progress}"
                aria-label="Open ${label} region overview">
            <img class="tq-waypoint__badge" src="${ZONE_BADGE_BY_ID[id]}" alt="" draggable="false" aria-hidden="true">
            <span class="tq-zone-label tq-zone-label--${className}">
                <img src="${LIVING_MAP_ASSETS.plaque}" alt="" draggable="false" aria-hidden="true">
                <span class="tq-zone-label__content">
                    <i class="fas ${icon}" aria-hidden="true"></i>
                    <span>${label}</span>
                </span>
            </span>
        </button>`;
}

export function generateLeagueMapHtml(classes) {
    const mapItems = assignStableMapLanes(classes.map((c, leagueIndex) => {
        const {
            liveMonthlyStars,
            classQuestBonus,
            starsDisplay,
            goal,
            pct,
            progressDisplay
        } = resolveLeagueMapMetrics(c);
        const pinTier = leagueIndex === 0 ? 'gold'
            : leagueIndex === 1 ? 'silver'
                : leagueIndex === 2 ? 'bronze'
                    : 'slate';

        return {
            c,
            pct,
            liveMonthlyStars,
            classQuestBonus,
            starsDisplay,
            goal,
            progressDisplay,
            pinTier,
            isLeader: leagueIndex === 0,
            displayLevel: (c.difficulty || 0) + 1,
            tokenKey: encodeURIComponent(String(c.id || c.name || leagueIndex)),
            lane: 0
        };
    }));

    const connectors = mapItems.map((item) => (
        `<line class="tq-route__connector" data-connector-key="${item.tokenKey}" x1="0" y1="0" x2="0" y2="0"></line>`
    )).join('');

    const waypoints = [
        { id: 'bronze', label: 'Bronze Meadows', icon: 'fa-seedling', progress: 0, className: 'bronze' },
        { id: 'silver', label: 'Silver Peaks', icon: 'fa-snowflake', progress: 30, className: 'silver' },
        { id: 'gold', label: 'Golden Citadel', icon: 'fa-crown', progress: 60, className: 'gold' },
        { id: 'diamond', label: 'Crystal Realm', icon: 'fa-wand-magic-sparkles', progress: 85, className: 'crystal' }
    ].map(renderWaypoint).join('');

    const routeShadows = QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="tq-route__shadow" d="${segment.d}"></path>`
    )).join('');
    const routeEdges = QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="tq-route__edge" d="${segment.d}"></path>`
    )).join('');
    const routeRoads = QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="tq-route__segment tq-route__segment--${segment.id}"
               d="${segment.d}"
               data-route-segment
               data-progress-min="${segment.minProgress}"
               data-progress-max="${segment.maxProgress}"></path>`
    )).join('');
    const routeGleams = QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="tq-route__gleam" d="${segment.d}"></path>`
    )).join('');

    return `
    <div class="team-quest-map-parchment tq-living-map" role="region" aria-label="League quest map" data-living-quest-map>
        <div class="tq-living-map__frame">
            <img class="tq-living-map__background" src="${LIVING_MAP_ASSETS.background}" alt="" draggable="false">
            <img class="tq-living-map__crystal-aura" src="${LIVING_MAP_ASSETS.crystalAura}" alt="" draggable="false" aria-hidden="true">
            <img class="tq-living-map__mist tq-living-map__mist--near" src="${LIVING_MAP_ASSETS.cloudMist}" alt="" draggable="false" aria-hidden="true">
            <img class="tq-living-map__mist tq-living-map__mist--far" src="${LIVING_MAP_ASSETS.cloudMist}" alt="" draggable="false" aria-hidden="true">

            <svg class="tq-route" viewBox="0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <defs>
                    <linearGradient id="tqBronzeRoad" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stop-color="#5fcf6a"></stop>
                        <stop offset="52%" stop-color="#f4c852"></stop>
                        <stop offset="100%" stop-color="#91d879"></stop>
                    </linearGradient>
                    <linearGradient id="tqSilverRoad" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stop-color="#8ad7ff"></stop>
                        <stop offset="50%" stop-color="#f4fbff"></stop>
                        <stop offset="100%" stop-color="#779de0"></stop>
                    </linearGradient>
                    <linearGradient id="tqGoldRoad" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stop-color="#ef9a2e"></stop>
                        <stop offset="52%" stop-color="#ffe375"></stop>
                        <stop offset="100%" stop-color="#e64f3c"></stop>
                    </linearGradient>
                    <linearGradient id="tqCrystalRoad" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stop-color="#ab6cff"></stop>
                        <stop offset="52%" stop-color="#65e8ff"></stop>
                        <stop offset="100%" stop-color="#f193ff"></stop>
                    </linearGradient>
                </defs>
                ${routeShadows}
                ${routeEdges}
                ${routeRoads}
                ${routeGleams}
                <g class="tq-route__connectors">${connectors}</g>
            </svg>

            <div class="tq-map-title" aria-hidden="true">
                <img src="${LIVING_MAP_ASSETS.plaque}" alt="" draggable="false">
                <span><i class="fas fa-map-location-dot"></i> Map</span>
            </div>

            <div class="tq-map-ambient" aria-hidden="true">
                <span class="tq-ambient tq-ambient--butterfly-one">🦋</span>
                <span class="tq-ambient tq-ambient--butterfly-two">🦋</span>
                <i class="fas fa-dove tq-ambient tq-ambient--bird-one"></i>
                <i class="fas fa-dove tq-ambient tq-ambient--bird-two"></i>
                <i class="fas fa-flag tq-ambient tq-ambient--silver-flag"></i>
                <i class="fas fa-flag tq-ambient tq-ambient--gold-flag"></i>
                <span class="tq-ambient tq-ambient--crystal-spark-one">✦</span>
                <span class="tq-ambient tq-ambient--crystal-spark-two">✧</span>
                <span class="tq-ambient tq-ambient--crystal-spark-three">✦</span>
            </div>

            ${waypoints}
            <span class="tq-route-finish" data-route-progress="100" aria-label="Quest finish at 100 percent">
                <i class="fas fa-flag-checkered" aria-hidden="true"></i>
            </span>
            <div class="tq-class-token-layer">${mapItems.map(renderMapToken).join('')}</div>

            <div class="tq-map-controls">
                <button id="toggle-map-list-btn" class="map-toggle-roster-btn tq-map-control tq-map-control--analysis" type="button">
                    <i class="fas fa-list-ul" aria-hidden="true"></i>
                    <span>Analysis</span>
                </button>
            </div>
        </div>
    </div>`;
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

function mapTransform(point, rootRect) {
    const x = (point.x / MAP_VIEWBOX_WIDTH) * rootRect.width;
    const y = (point.y / MAP_VIEWBOX_HEIGHT) * rootRect.height;
    return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}

function constrainMapPoint(point) {
    point.x = Math.min(MAP_VIEWBOX_WIDTH - MAP_TOKEN_EDGE_MARGIN, Math.max(MAP_TOKEN_EDGE_MARGIN, point.x));
    point.y = Math.min(MAP_VIEWBOX_HEIGHT - MAP_TOKEN_EDGE_MARGIN, Math.max(MAP_TOKEN_EDGE_MARGIN, point.y));
    return point;
}

function sampleTokenJourney(routeSegments, targetProgress, lane, rootRect) {
    const steps = Math.max(8, Math.ceil(targetProgress / 6));
    const frames = [];
    for (let index = 0; index <= steps; index++) {
        const ratio = index / steps;
        const easedProgress = targetProgress * ratio;
        const point = getRoutePoint(routeSegments, easedProgress);
        const laneStrength = lane * MAP_LANE_GAP * ratio;
        point.x += point.normalX * laneStrength;
        point.y += point.normalY * laneStrength;
        frames.push({
            transform: mapTransform(constrainMapPoint(point), rootRect),
            opacity: index === 0 ? 0 : 1,
            offset: ratio
        });
    }
    return frames;
}

export function initializeLivingQuestMap(scope) {
    activeLivingMapController?.destroy?.();
    activeLivingMapController = null;

    const root = scope?.querySelector?.('[data-living-quest-map]');
    const frame = root?.querySelector('.tq-living-map__frame');
    const routeSegments = [...(root?.querySelectorAll?.('[data-route-segment]') || [])].map((path) => ({
        path,
        minProgress: Number(path.dataset.progressMin) || 0,
        maxProgress: Number(path.dataset.progressMax) || 100,
        totalLength: path.getTotalLength()
    }));
    if (!root || !frame || routeSegments.length === 0) return null;

    const tokens = [...root.querySelectorAll('[data-map-token]')];
    const routeAnchors = [...root.querySelectorAll('[data-route-progress]:not([data-map-token])')];
    const activeAnimations = [];
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let offscreen = false;
    let pageHidden = document.hidden;
    let initialJourneyPlayed = false;

    const positionStaticElements = () => {
        routeAnchors.forEach((element) => {
            const point = getRoutePoint(routeSegments, element.dataset.routeProgress);
            point.x += Number(element.dataset.offsetX) || 0;
            point.y += Number(element.dataset.offsetY) || 0;
            element.style.left = `${(point.x / MAP_VIEWBOX_WIDTH) * 100}%`;
            element.style.top = `${(point.y / MAP_VIEWBOX_HEIGHT) * 100}%`;
        });
    };

    const positionTokens = ({ animate = false } = {}) => {
        const rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        tokens.forEach((token, index) => {
            const progress = Math.min(100, Math.max(0, Number(token.dataset.progress) || 0));
            const lane = Number(token.dataset.lane) || 0;
            const anchor = getRoutePoint(routeSegments, progress);
            const point = {
                ...anchor,
                x: anchor.x + anchor.normalX * lane * MAP_LANE_GAP,
                y: anchor.y + anchor.normalY * lane * MAP_LANE_GAP
            };
            constrainMapPoint(point);
            const finalTransform = mapTransform(point, rect);
            token.style.transform = finalTransform;
            token.style.zIndex = String(60 + Math.round(progress) + Math.abs(lane));
            token.dataset.positioned = 'true';

            const connector = root.querySelector(`[data-connector-key="${token.dataset.tokenKey}"]`);
            if (connector) {
                connector.setAttribute('x1', String(anchor.x));
                connector.setAttribute('y1', String(anchor.y));
                connector.setAttribute('x2', String(point.x));
                connector.setAttribute('y2', String(point.y));
                connector.classList.toggle('is-visible', lane !== 0);
            }

            if (animate && !reducedMotionQuery.matches) {
                const animation = token.animate(
                    sampleTokenJourney(routeSegments, progress, lane, rect),
                    {
                        duration: 1050 + Math.round(progress * 10),
                        delay: index * 90,
                        easing: 'cubic-bezier(0.22, 0.74, 0.22, 1)',
                        fill: 'none'
                    }
                );
                activeAnimations.push(animation);
                const forgetAnimation = () => {
                    const animationIndex = activeAnimations.indexOf(animation);
                    if (animationIndex >= 0) activeAnimations.splice(animationIndex, 1);
                };
                animation.addEventListener('finish', forgetAnimation, { once: true });
                animation.addEventListener('cancel', forgetAnimation, { once: true });
            }
        });
    };

    const updateMotionState = () => {
        const reduced = reducedMotionQuery.matches;
        const suspended = reduced || offscreen || pageHidden;
        root.classList.toggle('is-motion-paused', suspended);
        root.classList.toggle('is-reduced-motion', reduced);
        activeAnimations.forEach((animation) => {
            if (suspended) animation.pause();
            else animation.play();
        });

    };

    const playInitialJourney = () => {
        if (initialJourneyPlayed) return;
        initialJourneyPlayed = true;
        positionStaticElements();
        positionTokens({ animate: true });
        root.dataset.mapReady = 'true';
        updateMotionState();
    };

    const tokenClickHandlers = new Map();
    tokens.forEach((token) => {
        const handler = (event) => {
            event.stopPropagation();
            const nextSelected = !token.classList.contains('is-selected');
            tokens.forEach((item) => {
                item.classList.remove('is-selected');
                item.setAttribute('aria-expanded', 'false');
            });
            token.classList.toggle('is-selected', nextSelected);
            token.setAttribute('aria-expanded', String(nextSelected));
        };
        token.addEventListener('click', handler);
        tokenClickHandlers.set(token, handler);
    });

    const closeSelectedToken = (event) => {
        if (event.type === 'keydown' && event.key !== 'Escape') return;
        tokens.forEach((token) => {
            token.classList.remove('is-selected');
            token.setAttribute('aria-expanded', 'false');
        });
    };
    frame.addEventListener('click', closeSelectedToken);
    frame.addEventListener('keydown', closeSelectedToken);

    const visibilityHandler = () => {
        pageHidden = document.hidden;
        updateMotionState();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const reducedMotionHandler = () => updateMotionState();
    reducedMotionQuery.addEventListener?.('change', reducedMotionHandler);

    const intersectionObserver = new IntersectionObserver((entries) => {
        offscreen = !entries[0]?.isIntersecting;
        updateMotionState();
        if (!offscreen) playInitialJourney();
    }, { threshold: 0.08 });
    intersectionObserver.observe(root);

    const resizeObserver = new ResizeObserver(() => {
        positionStaticElements();
        positionTokens({ animate: false });
    });
    resizeObserver.observe(frame);

    positionStaticElements();
    positionTokens({ animate: false });
    requestAnimationFrame(() => {
        const bounds = root.getBoundingClientRect();
        offscreen = bounds.bottom <= 0 || bounds.top >= window.innerHeight;
        if (offscreen) updateMotionState();
        else playInitialJourney();
    });

    const controller = {
        destroy() {
            [...activeAnimations].forEach((animation) => animation.cancel());
            intersectionObserver.disconnect();
            resizeObserver.disconnect();
            document.removeEventListener('visibilitychange', visibilityHandler);
            reducedMotionQuery.removeEventListener?.('change', reducedMotionHandler);
            frame.removeEventListener('click', closeSelectedToken);
            frame.removeEventListener('keydown', closeSelectedToken);
            tokenClickHandlers.forEach((handler, token) => token.removeEventListener('click', handler));
            if (activeLivingMapController === controller) activeLivingMapController = null;
        }
    };
    activeLivingMapController = controller;
    return controller;
}
