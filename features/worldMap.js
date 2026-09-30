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
        d: 'M 60 612 C 82 590 122 568 158 542 C 185 522 199 495 190 476 C 178 450 125 457 131 431 C 135 413 155 401 153 382 C 151 363 125 354 132 335 C 142 306 185 289 220 273 C 268 252 322 242 350 212 C 372 190 376 165 397 151 C 406 145 414 140 421 136'
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
        d: 'M 951 224 C 972 224 989 217 1000 209 C 1021 194 1032 176 1048 164 C 1062 154 1072 146 1079 136 C 1084 131 1087 127 1088 125'
    }
];
const MAP_LANE_GAP = 54;
const MAP_TOKEN_EDGE_MARGIN = 44;

const LIVING_MAP_ASSETS = {
    background: new URL('../assets/team-quest-map/living-atlas/map-background-v2.webp', import.meta.url).href,
    parchmentBacking: new URL('../assets/team-quest-map/living-atlas/map-parchment-backing.webp', import.meta.url).href,
    cloudMist: new URL('../assets/team-quest-map/living-atlas/cloud-mist.webp', import.meta.url).href,
    crystalAura: new URL('../assets/team-quest-map/living-atlas/crystal-aura.webp', import.meta.url).href,
    badgeBronze: new URL('../assets/team-quest-map/living-atlas/badge-bronze.webp', import.meta.url).href,
    badgeSilver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    badgeGold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    badgeCrystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href,
    scrollBronze: new URL('../assets/team-quest-map/living-atlas/scroll-bronze.webp', import.meta.url).href,
    scrollSilver: new URL('../assets/team-quest-map/living-atlas/scroll-silver.webp', import.meta.url).href,
    scrollGold: new URL('../assets/team-quest-map/living-atlas/scroll-gold.webp', import.meta.url).href,
    scrollCrystal: new URL('../assets/team-quest-map/living-atlas/scroll-crystal.webp', import.meta.url).href,
    scrollMap: new URL('../assets/team-quest-map/living-atlas/scroll-map-integrated.webp', import.meta.url).href,
    portalVortex: new URL('../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href,
    ambientWaterRipple: new URL('../assets/team-quest-map/living-atlas/ambient-water-ripple.webp', import.meta.url).href,
    ambientSnowFlurry: new URL('../assets/team-quest-map/living-atlas/ambient-snow-flurry.webp', import.meta.url).href,
    ambientMountainWind: new URL('../assets/team-quest-map/living-atlas/ambient-mountain-wind.webp', import.meta.url).href,
    ambientCitySparks: new URL('../assets/team-quest-map/living-atlas/ambient-city-sparks.webp', import.meta.url).href,
    ambientCrystalStardust: new URL('../assets/team-quest-map/living-atlas/ambient-crystal-stardust.webp', import.meta.url).href,
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

const ZONE_SCROLL_BY_ID = {
    bronze: LIVING_MAP_ASSETS.scrollBronze,
    silver: LIVING_MAP_ASSETS.scrollSilver,
    gold: LIVING_MAP_ASSETS.scrollGold,
    crystal: LIVING_MAP_ASSETS.scrollCrystal,
    diamond: LIVING_MAP_ASSETS.scrollCrystal
};


const ROAD_STOP_BADGE = {
    silver: LIVING_MAP_ASSETS.badgeSilver,
    gold: LIVING_MAP_ASSETS.badgeGold,
    crystal: LIVING_MAP_ASSETS.badgeCrystal,
    portal: LIVING_MAP_ASSETS.badgeCrystal
};

const TIER_BY_RANK = ['gold', 'silver', 'bronze'];
const RANK_WORDS = ['Quest leader', '2nd place', '3rd place'];
const LITE_FX_STORAGE_KEY = 'gcq-team-quest-map-fx';

let activeLivingMapController = null;
// Where each party was last drawn, so live updates walk tokens forward from
// there instead of replaying the whole journey from the start of the road.
const mapMemory = { leagueKey: null, tokens: new Map(), pinnedKey: null };

function escapeMapHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function readStoredFxPreference() {
    try { return sessionStorage.getItem(LITE_FX_STORAGE_KEY); } catch { return null; }
}

function storeFxPreference(value) {
    try { sessionStorage.setItem(LITE_FX_STORAGE_KEY, value); } catch { /* private mode */ }
}

/** Modest machines keep the map, the road and the parties, but drop the large drifting art layers. */
function shouldUseLiteMapFx() {
    if (readStoredFxPreference() === 'lite') return true;
    try {
        const nav = navigator;
        if (nav.connection?.saveData) return true;
        if (Number(nav.deviceMemory) > 0 && Number(nav.deviceMemory) <= 4) return true;
        if (Number(nav.hardwareConcurrency) > 0 && Number(nav.hardwareConcurrency) <= 4) return true;
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
                data-lane="${lane}"
                aria-label="${ariaLabel}"
                aria-haspopup="dialog"
                aria-expanded="false">
            <span class="tq-token__shadow" aria-hidden="true"></span>
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

function renderWaypoint({ id, label, progress, className }) {
    return `
        <span class="tq-waypoint tq-waypoint--${className}"
                data-route-progress="${progress}"
                data-waypoint-progress="${progress}">
            <img class="tq-waypoint__scroll"
                 src="${ZONE_SCROLL_BY_ID[id]}"
                 alt=""
                 draggable="false"
                 decoding="async"
                 aria-hidden="true">
            <button type="button"
                    class="tq-waypoint__button zone-trigger"
                    data-zone="${id}"
                    aria-label="Open ${label} region overview">
                <span class="tq-waypoint__halo" aria-hidden="true"></span>
                <span class="tq-waypoint__burst" aria-hidden="true"></span>
                <img class="tq-waypoint__badge" src="${ZONE_BADGE_BY_ID[id]}" alt="" draggable="false" decoding="async" aria-hidden="true">
            </button>
        </span>`;
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

    const waypoints = [
        { id: 'bronze', label: 'Bronze Meadows', progress: 0, className: 'bronze' },
        { id: 'silver', label: 'Silver Peaks', progress: 30, className: 'silver' },
        { id: 'gold', label: 'Golden Citadel', progress: 60, className: 'gold' },
        { id: 'diamond', label: 'Crystal Realm', progress: 85, className: 'crystal' }
    ].map(renderWaypoint).join('');

    const pathsFor = (className, extra = () => '') => QUEST_ROUTE_SEGMENTS.map((segment) => (
        `<path class="${className}${className === 'tq-route__segment' ? ` tq-route__segment--${segment.id}` : ''}" d="${segment.d}"${extra(segment)}></path>`
    )).join('');

    return `
    <div class="tq-living-map" role="region" aria-label="League quest map" data-living-quest-map data-fx="${shouldUseLiteMapFx() ? 'lite' : 'full'}">
        <img class="tq-living-map__parchment-backing" src="${LIVING_MAP_ASSETS.parchmentBacking}" alt="" draggable="false" decoding="async" aria-hidden="true">
        <div class="tq-living-map__frame">
            <img class="tq-living-map__background" src="${LIVING_MAP_ASSETS.background}" alt="" draggable="false" decoding="async" fetchpriority="high">
            <img class="tq-living-map__crystal-aura" src="${LIVING_MAP_ASSETS.crystalAura}" alt="" draggable="false" decoding="async" aria-hidden="true">
            <img class="tq-living-map__mist tq-living-map__mist--near tq-fx-heavy" src="${LIVING_MAP_ASSETS.cloudMist}" alt="" draggable="false" decoding="async" aria-hidden="true">
            <img class="tq-living-map__mist tq-living-map__mist--far tq-fx-heavy" src="${LIVING_MAP_ASSETS.cloudMist}" alt="" draggable="false" decoding="async" aria-hidden="true">

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
                ${pathsFor('tq-route__shadow')}
                ${pathsFor('tq-route__edge')}
                ${pathsFor('tq-route__segment', (segment) => ` data-route-segment data-progress-min="${segment.minProgress}" data-progress-max="${segment.maxProgress}"`)}
                ${pathsFor('tq-route__gleam')}
                ${pathsFor('tq-route__fog', (segment) => ` data-fog-segment data-progress-min="${segment.minProgress}" data-progress-max="${segment.maxProgress}"`)}
                <g class="tq-route__connectors">${parts.connectorsHtml}</g>
            </svg>

            <div class="tq-map-title" aria-hidden="true">
                <img class="tq-map-title__scroll" src="${LIVING_MAP_ASSETS.scrollMap}" alt="" draggable="false" decoding="async">
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
                <img class="tq-ambient tq-water-ripple tq-water-ripple--one" src="${LIVING_MAP_ASSETS.ambientWaterRipple}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-water-ripple tq-water-ripple--two" src="${LIVING_MAP_ASSETS.ambientWaterRipple}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-water-ripple tq-water-ripple--three tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientWaterRipple}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-snow-flurry tq-snow-flurry--one tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientSnowFlurry}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-snow-flurry tq-snow-flurry--two tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientSnowFlurry}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-mountain-wind tq-mountain-wind--one tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientMountainWind}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-mountain-wind tq-mountain-wind--two tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientMountainWind}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-city-sparks tq-city-sparks--one" src="${LIVING_MAP_ASSETS.ambientCitySparks}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-city-sparks tq-city-sparks--two tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientCitySparks}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-crystal-stardust tq-crystal-stardust--one tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientCrystalStardust}" alt="" draggable="false" decoding="async">
                <img class="tq-ambient tq-crystal-stardust tq-crystal-stardust--two tq-fx-heavy" src="${LIVING_MAP_ASSETS.ambientCrystalStardust}" alt="" draggable="false" decoding="async">
            </div>

            ${waypoints}
            <span class="tq-route-finish" data-route-progress="100" data-offset-x="9" data-offset-y="-46" aria-hidden="true">
                <span class="tq-route-finish__glow"></span>
                <img class="tq-portal-vortex tq-portal-vortex--outer" src="${LIVING_MAP_ASSETS.portalVortex}" alt="" draggable="false" decoding="async">
                <img class="tq-portal-vortex tq-portal-vortex--inner" src="${LIVING_MAP_ASSETS.portalVortex}" alt="" draggable="false" decoding="async">
            </span>
            <div class="tq-class-token-layer">${parts.tokensHtml}</div>

            <div class="tq-map-controls">
                <button type="button" class="tq-map-replay" data-map-replay title="Replay the journey" aria-label="Replay the journey">
                    <i class="fas fa-shoe-prints" aria-hidden="true"></i>
                </button>
                ${renderChronicleButton(parts.count)}
            </div>
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
        return slot.querySelector('[data-living-quest-map]');
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

/** The living map controller for the map currently on screen (null when none). */
export function getActiveLivingQuestMap() {
    return activeLivingMapController;
}

export function initializeLivingQuestMap(scope, { leagueKey = '', replay = false } = {}) {
    activeLivingMapController?.destroy?.();
    activeLivingMapController = null;

    const root = scope?.querySelector?.('[data-living-quest-map]');
    const frame = root?.querySelector('.tq-living-map__frame');
    const toSegments = (selector) => [...(root?.querySelectorAll?.(selector) || [])].map((path) => ({
        path,
        minProgress: Number(path.dataset.progressMin) || 0,
        maxProgress: Number(path.dataset.progressMax) || 100,
        totalLength: path.getTotalLength()
    }));
    const routeSegments = toSegments('[data-route-segment]');
    if (!root || !frame || routeSegments.length === 0) return null;
    const fogSegments = toSegments('[data-fog-segment]');

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

    const tokenState = (token) => ({
        key: token.dataset.tokenKey,
        progress: Math.min(100, Math.max(0, Number(token.dataset.progress) || 0)),
        stars: Number(token.dataset.stars) || 0,
        lane: Number(token.dataset.lane) || 0
    });

    // Remember where everyone ends up, whatever happens to this controller.
    mapMemory.leagueKey = leagueKey || null;
    mapMemory.tokens = new Map(tokens.map((token) => {
        const s = tokenState(token);
        return [s.key, { progress: s.progress, stars: s.stars, lane: s.lane }];
    }));

    const leaderProgress = () => Math.max(0, ...tokens.map((token) => tokenState(token).progress));

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
        const rect = frame.getBoundingClientRect();
        const unitsPerPixel = rect.width ? MAP_VIEWBOX_WIDTH / rect.width : 1;
        fogSegments.forEach((segment) => {
            const range = segment.maxProgress - segment.minProgress || 1;
            const ratio = Math.min(1, Math.max(0, (explored - segment.minProgress) / range));
            const exploredLength = segment.totalLength * ratio;
            const rest = Math.max(0, segment.totalLength - exploredLength);
            segment.path.style.strokeWidth = (17 * unitsPerPixel).toFixed(2);
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

    const probeFrameRate = () => {
        if (root.dataset.fx === 'lite' || reducedMotionQuery.matches) return;
        let frames = 0;
        let last = performance.now();
        let slow = 0;
        const tick = (now) => {
            if (destroyed) return;
            const delta = now - last;
            last = now;
            if (delta > 34) slow += 1;
            frames += 1;
            if (frames < 60) requestAnimationFrame(tick);
            else if (slow > 24) {
                root.dataset.fx = 'lite';
                storeFxPreference('lite');
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
        if (!continuing) probeFrameRate();
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

    // --- Party card (one shared popover) -------------------------------------
    let openToken = null;
    let pinned = false;
    let restoringFocus = false;
    let showTimer = 0;
    let hideTimer = 0;

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
        hideTimer = later(() => {
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
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
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
        popover.hidden = false;
        positionPopover();
        requestAnimationFrame(() => {
            if (openToken === token) popover.dataset.state = 'open';
        });
    };

    const scheduleClose = () => {
        if (pinned) return;
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
    on(reducedMotionQuery, 'change', () => updateMotionState());

    // Art first, then the parties set off — never over a blank map.
    const background = root.querySelector('.tq-living-map__background');
    const markArtReady = () => root.classList.add('is-art-ready');
    if (background?.complete && background.naturalWidth) markArtReady();
    else {
        root.classList.remove('is-art-ready');
        background?.addEventListener('load', markArtReady, { once: true, signal: listeners.signal });
        background?.addEventListener('error', markArtReady, { once: true, signal: listeners.signal });
    }
    const artReady = new Promise((resolve) => {
        if (root.classList.contains('is-art-ready')) { resolve(); return; }
        const decode = background?.decode ? background.decode().catch(() => {}) : Promise.resolve();
        Promise.race([decode, new Promise((done) => later(done, 1400))]).then(() => {
            markArtReady();
            resolve();
        });
    });

    const intersectionObserver = new IntersectionObserver((entries) => {
        offscreen = !entries[0]?.isIntersecting;
        updateMotionState();
        if (!offscreen) artReady.then(startJourney);
    }, { threshold: 0.08 });
    intersectionObserver.observe(root);

    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
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
    if (continuing) root.dataset.mapReady = 'true';
    else delete root.dataset.mapReady;

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
            }, 520);
            return true;
        },
        destroy() {
            destroyed = true;
            [...activeAnimations].forEach((animation) => animation.cancel());
            timers.forEach((id) => clearTimeout(id));
            timers.clear();
            cancelAnimationFrame(resizeFrame);
            listeners.abort();
            intersectionObserver.disconnect();
            resizeObserver.disconnect();
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
