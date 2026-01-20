// features/worldMap.js
import * as state from '../state.js'; // Import state to get live scores

export function generateLeagueMapHtml(classes) {
    const W = 1000;
    const H = 562;
    
    // Path: Bronze -> Silver -> Gold -> Diamond
    const pathData = `M 50,520 C 100,510 120,480 180,450 C 240,420 280,250 350,150 C 400,80 480,80 550,200 C 620,320 680,450 780,420 C 860,390 880,150 950,50`;

    // 1. PRE-CALCULATE BASE POSITIONS & DATA
    // We calculate everyone's ideal position first so we can fix overlaps before rendering
    let mapItems = classes.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const allScores = state.get('allStudentScores') || [];
        
        const liveMonthlyStars = students.reduce((sum, s) => {
            const scoreData = allScores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (parseFloat(scoreData.monthlyStars) || 0) : 0);
        }, 0);

        const starsDisplay = liveMonthlyStars % 1 !== 0 ? liveMonthlyStars.toFixed(1) : liveMonthlyStars.toFixed(0);
        const goal = c.goals?.diamond || 18;
        const rawPct = goal > 0 ? (liveMonthlyStars / goal) * 100 : 0;
        const pct = Math.min(100, Math.max(0, rawPct));
        const progressDisplay = pct.toFixed(1);

        // Get ideal position on the curve
        const pos = getComplexPathPoint(pct / 100);
        
        return {
            c,
            pct,
            liveMonthlyStars,
            starsDisplay,
            goal,
            progressDisplay,
            x: pos.x,
            y: pos.y,
            isLeader: c.rank === 1,
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
    const avatarsHtml = mapItems.map((item, index) => {
        const { c, pct, x, y, isLeader, progressDisplay, starsDisplay, goal, displayLevel } = item;

        // Determine Zone Styles
        let currentZone = "Bronze Meadows";
        let zoneGlow = "shadow-[0_0_10px_rgba(165,180,252,0.5)]";
        let animationClass = "animate-bounce-slow";

        if (pct >= 85) {
            currentZone = "Crystal Realm";
            zoneGlow = "shadow-[0_0_15px_rgba(216,180,254,0.8)] border-purple-300";
            animationClass = "animate-pulse"; 
        } else if (pct >= 60) {
            currentZone = "Golden Citadel";
            zoneGlow = "shadow-[0_0_12px_rgba(251,191,36,0.6)] border-amber-300";
        } else if (pct >= 30) {
            currentZone = "Silver Peaks";
            zoneGlow = "shadow-[0_0_10px_rgba(125,211,252,0.5)] border-sky-200";
        }

        // Smart Tooltip Positioning based on map location
        const topPct = (y / H) * 100;
        const leftPct = (x / W) * 100;
        let tooltipClass = "";
        if (topPct < 30) tooltipClass += " tooltip-pos-bottom";
        if (leftPct < 15) tooltipClass += " tooltip-pos-right";
        else if (leftPct > 85) tooltipClass += " tooltip-pos-left";

        return `
        <div class="league-map-avatar ${isLeader ? 'is-leader' : ''} ${tooltipClass} group transition-all duration-[2000ms] ease-out" 
             style="left: 5%; top: 92%; z-index: ${Math.floor(pct) + 10};"
             data-final-left="${(x / W) * 100}%"
             data-final-top="${(y / H) * 100}%">
            
            <div class="relative w-12 h-12 md:w-14 md:h-14 transition-all duration-500 group-hover:scale-125 group-hover:-translate-y-2">
                
                <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-sm transition-all group-hover:w-12 group-hover:opacity-40"></div>

                <div class="pin-head w-full h-full rounded-full border-2 bg-white flex items-center justify-center text-2xl shadow-lg transition-all ${zoneGlow} ${animationClass} overflow-hidden relative">
                    <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none"></div>
                    <span class="filter drop-shadow-sm z-10 transform scale-110">${c.logo}</span>
                    
                    ${isLeader ? '<div class="absolute -top-1 -right-1 text-xs rotate-12 z-20">👑</div>' : ''}
                </div>
            </div>

            <div class="map-rich-tooltip">
                <div class="flex items-center gap-2 mb-2 border-b pb-2 border-gray-100">
                    <span class="text-xl">${c.logo}</span>
                    <h4 class="font-bold text-gray-800 text-lg leading-none">${c.name}</h4>
                </div>
                
                <div class="flex justify-between items-center mb-1 text-xs">
                    <span class="font-bold text-indigo-900 uppercase tracking-wide">${currentZone}</span>
                    <span class="bg-gray-100 text-gray-600 px-1.5 rounded font-bold">Lvl ${displayLevel}</span>
                </div>
                
                <div class="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-1 border border-gray-300 relative">
                    <div class="bg-gradient-to-r from-indigo-400 to-purple-500 h-full" style="width: ${pct}%"></div>
                </div>
                
                <div class="flex justify-between items-end">
                    <div class="flex flex-col">
                        <span class="text-[9px] text-gray-400 font-bold uppercase">Progress</span>
                        <span class="text-xs font-bold text-purple-600">${progressDisplay}%</span>
                    </div>
                    <div class="text-right">
                        <span class="text-[9px] text-gray-400 font-bold uppercase block">Collected</span>
                        <span class="text-sm font-bold text-gray-700">
                            <span class="text-indigo-600 text-base">${starsDisplay}</span> 
                            <span class="text-gray-400">/</span> ${goal} ⭐
                        </span>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    return `
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

        <div class="map-zone-label zone-trigger" data-zone="bronze" 
             style="left: 10%; top: 75%; font-family: 'Fredoka One', cursive; color: #dcfce7; text-shadow: 0 2px 4px rgba(22, 101, 52, 0.8); background: rgba(20, 83, 45, 0.85); border: 2px solid #86efac; border-radius: 12px; padding: 6px 12px;">
             <span class="text-xl mr-1">🌿</span> Bronze Meadows
        </div>
        
        <div class="map-zone-label zone-trigger" data-zone="silver" 
             style="left: 32%; top: 15%; font-family: 'Fredoka One', cursive; color: #f0f9ff; text-shadow: 0 2px 4px rgba(12, 74, 110, 0.8); background: rgba(12, 74, 110, 0.85); border: 2px solid #7dd3fc; border-radius: 12px; padding: 6px 12px;">
             <span class="text-xl mr-1">❄️</span> Silver Peaks
        </div>
        
        <div class="map-zone-label zone-trigger" data-zone="gold" 
             style="left: 70%; top: 65%; font-family: 'Fredoka One', cursive; color: #fef3c7; text-shadow: 0 2px 4px rgba(120, 53, 15, 0.8); background: rgba(120, 53, 15, 0.85); border: 2px solid #fcd34d; border-radius: 12px; padding: 6px 12px;">
             <span class="text-xl mr-1">🏰</span> Golden Citadel
        </div>
        
        <div class="map-zone-label zone-trigger" data-zone="diamond" 
             style="left: 88%; top: 8%; font-family: 'Fredoka One', cursive; color: #f3e8ff; text-shadow: 0 2px 4px rgba(88, 28, 135, 0.8); background: rgba(88, 28, 135, 0.85); border: 2px solid #d8b4fe; border-radius: 12px; padding: 6px 12px;">
             <span class="text-xl mr-1">💎</span> Crystal Realm
        </div>

        ${avatarsHtml}

        <button id="toggle-map-list-btn" class="map-toggle-roster-btn">
            <i class="fas fa-list-ul mr-1"></i> Analysis
        </button>
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
