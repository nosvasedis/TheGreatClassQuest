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

export function generateLeagueMapHtml(classes) {
    const W = 1000;
    const H = 562;
    
    // Path: Bronze -> Silver -> Gold -> Diamond
    const pathData = `M 50,520 C 100,510 120,480 180,450 C 240,420 280,250 350,150 C 400,80 480,80 550,200 C 620,320 680,450 780,420 C 860,390 880,150 950,50`;

    // 1. PRE-CALCULATE BASE POSITIONS & DATA
    // We calculate everyone's ideal position first so we can fix overlaps before rendering
    let mapItems = classes.map((c, leagueIndex) => {
        const {
            liveMonthlyStars,
            classQuestBonus,
            starsDisplay,
            goal,
            pct,
            progressDisplay
        } = resolveLeagueMapMetrics(c);

        // Get ideal position on the curve
        const pos = getComplexPathPoint(pct / 100);

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
            x: pos.x,
            y: pos.y,
            pinTier,
            isLeader: leagueIndex === 0,
            displayLevel: (c.difficulty || 0) + 1
        };
    });

    // 2. RESOLVE OVERLAPS (Smart "Sit Beside Each Other" Logic)
    const iterations = 10;
    const minDist = 45; // Minimum distance in pixels (based on 1000px width scale)

    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < mapItems.length; i++) {
            for (let j = i + 1; j < mapItems.length; j++) {
                const a = mapItems[i];
                const b = mapItems[j];
                
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distSq = dx*dx + dy*dy;
                const dist = Math.sqrt(distSq);

                if (dist < minDist) {
                    // They are too close! Push them apart.
                    const overlap = minDist - dist;
                    
                    // If exactly on top of each other, pick a random angle to separate
                    // Otherwise, push away along the angle connecting them
                    let angle = (dist === 0) ? (Math.random() * Math.PI * 2) : Math.atan2(dy, dx);
                    
                    // Nudge amount (split overlap between both items)
                    const moveX = Math.cos(angle) * overlap * 0.5;
                    const moveY = Math.sin(angle) * overlap * 0.5;

                    a.x -= moveX;
                    a.y -= moveY;
                    b.x += moveX;
                    b.y += moveY;
                }
            }
        }
    }

    // 3. RENDER AVATARS
    const avatarsHtml = mapItems.map((item) => {
        const { c, pct, x, y, isLeader, pinTier, progressDisplay, starsDisplay, goal, displayLevel, classQuestBonus } = item;

        // Determine Zone Styles
        const zone = getQuestMapZoneForProgressPercent(pct);

        // Smart Tooltip Positioning based on map location
        const topPct = (y / H) * 100;
        const leftPct = (x / W) * 100;
        let tooltipClass = "";
        if (topPct < 30) tooltipClass += " tooltip-pos-bottom";
        if (leftPct < 15) tooltipClass += " tooltip-pos-right";
        else if (leftPct > 85) tooltipClass += " tooltip-pos-left";

        return `
        <div class="league-map-avatar ${isLeader ? 'is-leader' : ''} ${tooltipClass} group ease-out"
             style="left: 5%; top: 92%; z-index: ${Math.floor(pct) + 10}; transition: left 2s ease-out, top 2s ease-out;"
             data-final-left="${(x / W) * 100}%"
             data-final-top="${(y / H) * 100}%">
            
            <div class="relative w-12 h-12 md:w-14 md:h-14 transition-all duration-500 group-hover:scale-125 group-hover:-translate-y-2">
                
                <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-sm transition-all group-hover:w-12 group-hover:opacity-40"></div>

                <div class="league-map-pin-ring league-map-pin-ring--${pinTier} w-full h-full rounded-full p-[2.5px] md:p-[3px] box-border">
                    <div class="pin-head pin-head--league-map w-full h-full rounded-full flex items-center justify-center text-2xl shadow-inner overflow-hidden relative">
                        <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/45 to-transparent pointer-events-none"></div>
                        <span class="filter drop-shadow-sm z-10 transform scale-110">${c.logo}</span>
                        
                        ${isLeader ? '<div class="absolute -top-1 -right-1 text-xs rotate-12 z-20">👑</div>' : ''}
                    </div>
                </div>
            </div>

            <div class="map-rich-tooltip${isLeader ? ' map-rich-tooltip--leader' : ''}">
                <div class="map-rich-tooltip__edge map-rich-tooltip__edge--top" aria-hidden="true"></div>
                <div class="map-rich-tooltip__body">
                    <div class="map-rich-tooltip__header">
                        <span class="map-rich-tooltip__logo">${c.logo}</span>
                        <h4 class="map-rich-tooltip__title">${c.name}</h4>
                    </div>
                    <div class="map-rich-tooltip__meta">
                        <span class="map-rich-tooltip__zone">${zone.label}</span>
                        <span class="map-rich-tooltip__lvl">Lvl ${displayLevel}</span>
                    </div>
                    <div class="map-rich-tooltip__meter" role="presentation">
                        <div class="map-rich-tooltip__meter-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="map-rich-tooltip__stats">
                        <div class="map-rich-tooltip__stat">
                            <span class="map-rich-tooltip__stat-label">Progress</span>
                            <span class="map-rich-tooltip__stat-value map-rich-tooltip__stat-value--progress">${progressDisplay}%</span>
                        </div>
                        <div class="map-rich-tooltip__stat map-rich-tooltip__stat--right">
                            <span class="map-rich-tooltip__stat-label">Collected</span>
                            <span class="map-rich-tooltip__stat-stars">
                                <span class="map-rich-tooltip__stars-num">${starsDisplay}</span>
                                <span class="map-rich-tooltip__stars-sep">/</span>
                                <span class="map-rich-tooltip__stars-goal">${goal}</span>
                                <span class="map-rich-tooltip__stars-icon" aria-hidden="true">⭐</span>
                            </span>
                            ${classQuestBonus > 0 ? `<span class="map-rich-tooltip__bonus">+${classQuestBonus} Pathfinder</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="map-rich-tooltip__edge map-rich-tooltip__edge--bottom" aria-hidden="true"></div>
            </div>
        </div>
        `;
    }).join('');

    return `
    <div class="team-quest-map-parchment" role="region" aria-label="League quest map">
        <div class="team-quest-map-parchment__roll team-quest-map-parchment__roll--top" aria-hidden="true"></div>
        <div class="team-quest-map-parchment__sheet">
            <div class="league-map-wrapper">
                <div class="league-map-bg"></div>
                <svg viewBox="0 0 ${W} ${H}" class="league-map-svg" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="roadGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#22c55e;stop-opacity:1" />
                            <stop offset="35%" style="stop-color:#e0f2fe;stop-opacity:1" />
                            <stop offset="65%" style="stop-color:#fbbf24;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#d8b4fe;stop-opacity:1" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <path d="${pathData}" class="map-path-line" 
                          style="stroke: url(#roadGradient); stroke-width: 8; stroke-dasharray: 15, 10; filter: url(#glow); opacity: 0.9; stroke-linecap: round; fill: none;" />
                </svg>

                <div class="map-zone-label zone-trigger map-zone-label--bronze" data-zone="bronze" style="left: 10%; top: 75%;">
                    <span class="map-zone-label__icon" aria-hidden="true">🌿</span>
                    <span class="map-zone-label__text">Bronze Meadows</span>
                </div>
                
                <div class="map-zone-label zone-trigger map-zone-label--silver" data-zone="silver" style="left: 32%; top: 15%;">
                    <span class="map-zone-label__icon" aria-hidden="true">🏔️</span>
                    <span class="map-zone-label__text">Silver Peaks</span>
                </div>
                
                <div class="map-zone-label zone-trigger map-zone-label--gold" data-zone="gold" style="left: 70%; top: 65%;">
                    <span class="map-zone-label__icon" aria-hidden="true">🏰</span>
                    <span class="map-zone-label__text">Golden Citadel</span>
                </div>
                
                <div class="map-zone-label zone-trigger map-zone-label--crystal" data-zone="diamond" style="left: 88%; top: 8%;">
                    <span class="map-zone-label__icon" aria-hidden="true">💎</span>
                    <span class="map-zone-label__text">Crystal Realm</span>
                </div>

                ${avatarsHtml}

                <button id="toggle-map-list-btn" class="map-toggle-roster-btn">
                    <i class="fas fa-list-ul mr-1"></i> Analysis
                </button>
            </div>
        </div>
        <div class="team-quest-map-parchment__roll team-quest-map-parchment__roll--bottom" aria-hidden="true"></div>
    </div>
    `;
}

// --- MATH HELPERS ---

function stringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

function getComplexPathPoint(t) {
    const segments = [
        { w: 0.25, p: [50,520, 100,510, 120,480, 180,450] },
        { w: 0.25, p: [180,450, 240,420, 280,250, 350,150] }, 
        { w: 0.25, p: [350,150, 480,80, 550,200, 780,420] }, 
        { w: 0.25, p: [780,420, 860,390, 880,150, 950,50] }
    ];

    let accumulatedT = 0;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (t <= accumulatedT + seg.w || i === segments.length - 1) {
            const segmentT = (t - accumulatedT) / seg.w;
            const safeT = Math.max(0, Math.min(1, segmentT));
            return getCubicBezierXY(safeT, ...seg.p);
        }
        accumulatedT += seg.w;
    }
    return { x: 950, y: 50 };
}

function getCubicBezierXY(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    const cx = 3 * (p1x - p0x);
    const bx = 3 * (p2x - p1x) - cx;
    const ax = p3x - p0x - cx - bx;
    const cy = 3 * (p1y - p0y);
    const by = 3 * (p2y - p1y) - cy;
    const ay = p3y - p0y - cy - by;
    const t2 = t * t;
    const t3 = t2 * t;
    const x = (ax * t3) + (bx * t2) + (cx * t) + p0x;
    const y = (ay * t3) + (by * t2) + (cy * t) + p0y;
    return { x, y };
}
