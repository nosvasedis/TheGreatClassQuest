// features/ceremonyMonthTheme.js — every Ceremony of the Month gets its own stage.
// The month the ceremony celebrates picks the arena's sky, torch fire, moon, pennants, the
// weather that drifts across the stage, a horizon silhouette and the podium carpet, so an
// October ceremony (amber leaves under a harvest moon) never looks like a December one
// (snow and winter lights). Pure: markup strings and plain data, no DOM.
// Styles: styles/ceremony_months.css (loaded with features/ceremony.js).

/**
 * One theme per month (1-12). Colours are plain CSS colours; `drift` is the weather kind
 * (leaves, snow, blossom, rain, poppies, fireflies, lanterns, sparks, grapes), `horizon` the
 * silhouette behind the stands (pines, olives, hills, sea, vines, none).
 */
export const CEREMONY_MONTH_THEMES = {
    1: {
        id: 'jan', name: 'The Frost Crown Arena', motto: 'Under a silver winter moon',
        sky: ['#040b1c', '#0d2648', '#1b4a72', '#2f6f95'], glow: ['rgba(56, 189, 248, 0.5)', 'rgba(165, 243, 252, 0.28)'],
        flame: ['#0ea5e9', '#7dd3fc', '#f0f9ff'], torchGlow: 'rgba(56, 189, 248, 0.42)',
        moon: ['#ffffff', '#e0f2fe', '#a5c8e4'], pennants: [['#e0f2fe', '#7dd3fc'], ['#f8fafc', '#94a3b8'], ['#38bdf8', '#075985']],
        drift: 'snow', driftColors: ['#ffffff', '#e0f2fe', '#bae6fd'], horizon: 'pines', crowd: ['#0d1f3a', '#12284a', '#0a1830'],
        carpet: ['#1e3a8a', '#0c1d4d'], accent: '#7dd3fc'
    },
    2: {
        id: 'feb', name: 'The Almond Blossom Arena', motto: 'The first blossoms on the last snow',
        sky: ['#0c0718', '#2a1338', '#5b2150', '#8a3a60'], glow: ['rgba(244, 114, 182, 0.45)', 'rgba(251, 207, 232, 0.25)'],
        flame: ['#db2777', '#f9a8d4', '#fff1f7'], torchGlow: 'rgba(244, 114, 182, 0.4)',
        moon: ['#fffafd', '#fce7f3', '#e0b4cc'], pennants: [['#fbcfe8', '#db2777'], ['#ffffff', '#cbd5e1'], ['#a21caf', '#581c87']],
        drift: 'blossom', driftColors: ['#ffffff', '#fce7f3', '#fbcfe8'], horizon: 'olives', crowd: ['#2a1230', '#33173a', '#220e27'],
        carpet: ['#9d174d', '#500724'], accent: '#f9a8d4'
    },
    3: {
        id: 'mar', name: 'The Blue and White Arena', motto: 'Spring winds and brave hearts',
        sky: ['#04101f', '#0b2a4f', '#1d4f86', '#3b82c4'], glow: ['rgba(59, 130, 246, 0.5)', 'rgba(255, 255, 255, 0.22)'],
        flame: ['#2563eb', '#93c5fd', '#ffffff'], torchGlow: 'rgba(96, 165, 250, 0.42)',
        moon: ['#ffffff', '#eff6ff', '#bfd3ee'], pennants: [['#ffffff', '#cbd5e1'], ['#3b82f6', '#1e3a8a'], ['#ffffff', '#cbd5e1']],
        drift: 'leaves-green', driftColors: ['#86efac', '#4ade80', '#bbf7d0'], horizon: 'hills', crowd: ['#0b1d38', '#102749', '#081429'],
        carpet: ['#1d4ed8', '#172554'], accent: '#93c5fd'
    },
    4: {
        id: 'apr', name: 'The Rainbow Arena', motto: 'After the April rain, a rainbow',
        sky: ['#06121a', '#0f3340', '#1f5a5e', '#3d8a7a'], glow: ['rgba(45, 212, 191, 0.45)', 'rgba(250, 204, 21, 0.2)'],
        flame: ['#0d9488', '#5eead4', '#f0fdfa'], torchGlow: 'rgba(45, 212, 191, 0.4)',
        moon: ['#fffef5', '#ecfccb', '#bcd59a'], pennants: [['#f87171', '#b91c1c'], ['#facc15', '#a16207'], ['#34d399', '#047857']],
        drift: 'rain', driftColors: ['#cffafe', '#a5f3fc', '#e0f2fe'], horizon: 'hills', crowd: ['#0c2229', '#102c33', '#08191e'],
        carpet: ['#0f766e', '#042f2e'], accent: '#5eead4', rainbow: true
    },
    5: {
        id: 'may', name: 'The May Wreath Arena', motto: 'Poppies, daisies and a crown of flowers',
        sky: ['#140616', '#3d0f2a', '#7a1f36', '#b4443c'], glow: ['rgba(248, 113, 113, 0.5)', 'rgba(254, 240, 138, 0.25)'],
        flame: ['#dc2626', '#fb923c', '#fff7ed'], torchGlow: 'rgba(248, 113, 113, 0.42)',
        moon: ['#fffbeb', '#fef3c7', '#e6cf8a'], pennants: [['#ef4444', '#991b1b'], ['#fde047', '#a16207'], ['#4ade80', '#166534']],
        drift: 'poppies', driftColors: ['#ef4444', '#ffffff', '#fde047'], horizon: 'hills', crowd: ['#2c0d20', '#361128', '#230a19'],
        carpet: ['#b91c1c', '#450a0a'], accent: '#fca5a5'
    },
    6: {
        id: 'jun', name: 'The Midsummer Sea Arena', motto: 'Warm nights by the Aegean',
        sky: ['#020a1c', '#082a55', '#0e5a8a', '#f59e0b'], glow: ['rgba(251, 191, 36, 0.5)', 'rgba(14, 165, 233, 0.3)'],
        flame: ['#f59e0b', '#fde047', '#fffbeb'], torchGlow: 'rgba(251, 191, 36, 0.42)',
        moon: ['#fffbeb', '#fde68a', '#e3b85c'], pennants: [['#ffffff', '#cbd5e1'], ['#0ea5e9', '#075985'], ['#fbbf24', '#a16207']],
        drift: 'fireflies', driftColors: ['#fef08a', '#fde047', '#fff7ae'], horizon: 'sea', crowd: ['#071d36', '#0b2644', '#051528'],
        carpet: ['#0369a1', '#082f49'], accent: '#fde047'
    },
    7: {
        id: 'jul', name: 'The Shooting Star Arena', motto: 'A summer sky full of wishes',
        sky: ['#02030f', '#0b1035', '#1d1b5e', '#3b2a7a'], glow: ['rgba(129, 140, 248, 0.45)', 'rgba(244, 114, 182, 0.22)'],
        flame: ['#6366f1', '#a5b4fc', '#eef2ff'], torchGlow: 'rgba(129, 140, 248, 0.4)',
        moon: ['#ffffff', '#e0e7ff', '#b4bce8'], pennants: [['#a5b4fc', '#4338ca'], ['#f9a8d4', '#be185d'], ['#fde68a', '#a16207']],
        drift: 'sparks', driftColors: ['#ffffff', '#c7d2fe', '#fde68a'], horizon: 'sea', crowd: ['#0d0f2e', '#131538', '#090a22'],
        carpet: ['#3730a3', '#1e1b4b'], accent: '#a5b4fc'
    },
    8: {
        id: 'aug', name: 'The Golden Sun Arena', motto: 'Long golden evenings',
        sky: ['#140a04', '#4a1f0a', '#9a4a12', '#e09a3a'], glow: ['rgba(251, 146, 60, 0.55)', 'rgba(254, 240, 138, 0.3)'],
        flame: ['#ea580c', '#fbbf24', '#fffbeb'], torchGlow: 'rgba(251, 146, 60, 0.42)',
        moon: ['#fffbeb', '#fde68a', '#f0b850'], pennants: [['#fbbf24', '#a16207'], ['#fb923c', '#c2410c'], ['#ffffff', '#cbd5e1']],
        drift: 'fireflies', driftColors: ['#fde68a', '#fdba74', '#fff7ae'], horizon: 'olives', crowd: ['#2a1308', '#341a0b', '#200e05'],
        carpet: ['#c2410c', '#431407'], accent: '#fdba74'
    },
    9: {
        id: 'sep', name: 'The Grape Harvest Arena', motto: 'A new school year, a sweet harvest',
        sky: ['#0b0614', '#2a103a', '#4c1d5e', '#7a3b5a'], glow: ['rgba(192, 132, 252, 0.45)', 'rgba(250, 204, 21, 0.25)'],
        flame: ['#9333ea', '#e9a23b', '#fef3c7'], torchGlow: 'rgba(217, 160, 70, 0.42)',
        moon: ['#fffdf2', '#f5e6b8', '#d6c28a'], pennants: [['#a855f7', '#581c87'], ['#eab308', '#854d0e'], ['#65a30d', '#365314']],
        drift: 'grapes', driftColors: ['#a855f7', '#84cc16', '#facc15'], horizon: 'vines', crowd: ['#24102f', '#2d1439', '#1a0b22'],
        carpet: ['#6b21a8', '#2e1065'], accent: '#d8b4fe'
    },
    10: {
        id: 'oct', name: 'The Amber Leaf Arena', motto: 'Under the harvest moon',
        sky: ['#0d0620', '#2a0f33', '#5a1a1f', '#7c2d12'], glow: ['rgba(234, 88, 12, 0.55)', 'rgba(190, 18, 60, 0.35)'],
        flame: ['#ea580c', '#f59e0b', '#fef3c7'], torchGlow: 'rgba(251, 146, 60, 0.42)',
        moon: ['#fff1d6', '#fbbf5a', '#d97a1f'], pennants: [['#dc2626', '#7f1d1d'], ['#f5c542', '#a86b12'], ['#ea580c', '#7c2d12']],
        drift: 'leaves', driftColors: ['#f97316', '#dc2626', '#facc15'], horizon: 'olives', crowd: ['#2b1426', '#331730', '#24101f'],
        carpet: ['#9a3412', '#431407'], accent: '#fdba74', bigMoon: true
    },
    11: {
        id: 'nov', name: 'The Lantern Arena', motto: 'A thousand lanterns light the way',
        sky: ['#08050f', '#1f1225', '#3f1f22', '#6b3a1c'], glow: ['rgba(245, 158, 11, 0.5)', 'rgba(180, 83, 9, 0.32)'],
        flame: ['#d97706', '#fbbf24', '#fffbeb'], torchGlow: 'rgba(245, 158, 11, 0.42)',
        moon: ['#fffaf0', '#f3e3c3', '#c9ad7f'], pennants: [['#b45309', '#78350f'], ['#fde68a', '#a16207'], ['#7f1d1d', '#450a0a']],
        drift: 'lanterns', driftColors: ['#fbbf24', '#f59e0b', '#fde68a'], horizon: 'hills', crowd: ['#24140f', '#2d1912', '#1b0f0a'],
        carpet: ['#92400e', '#451a03'], accent: '#fcd34d'
    },
    12: {
        id: 'dec', name: 'The Winter Lights Arena', motto: 'Snow, songs and winter lights',
        sky: ['#03081a', '#0a1f3d', '#123a4e', '#1f5a52'], glow: ['rgba(34, 197, 94, 0.38)', 'rgba(239, 68, 68, 0.3)'],
        flame: ['#dc2626', '#fbbf24', '#fffbeb'], torchGlow: 'rgba(251, 191, 36, 0.4)',
        moon: ['#ffffff', '#f1f5f9', '#b8c4d4'], pennants: [['#dc2626', '#7f1d1d'], ['#16a34a', '#14532d'], ['#fbbf24', '#a16207']],
        drift: 'snow', driftColors: ['#ffffff', '#f1f5f9', '#e2e8f0'], horizon: 'pines', crowd: ['#0b1a2c', '#102236', '#081320'],
        carpet: ['#b91c1c', '#450a0a'], accent: '#fca5a5', lights: true
    }
};

/** "2026-10" → the October theme. Falls back to October for an unreadable key. */
export function ceremonyMonthTheme(monthKey) {
    const month = Number(String(monthKey || '').split('-')[1]);
    return CEREMONY_MONTH_THEMES[month] || CEREMONY_MONTH_THEMES[10];
}

/** Inline custom properties for the screen (read by ceremony_months.css). */
export function ceremonyMonthThemeStyle(theme) {
    const t = theme || CEREMONY_MONTH_THEMES[10];
    const vars = {
        '--mt-sky-0': t.sky[0], '--mt-sky-1': t.sky[1], '--mt-sky-2': t.sky[2], '--mt-sky-3': t.sky[3],
        '--mt-glow-a': t.glow[0], '--mt-glow-b': t.glow[1],
        '--mt-flame-o': t.flame[0], '--mt-flame-m': t.flame[1], '--mt-flame-c': t.flame[2], '--mt-torch-glow': t.torchGlow,
        '--mt-moon-a': t.moon[0], '--mt-moon-b': t.moon[1], '--mt-moon-c': t.moon[2],
        '--mt-pa1': t.pennants[0][0], '--mt-pa2': t.pennants[0][1],
        '--mt-pb1': t.pennants[1][0], '--mt-pb2': t.pennants[1][1],
        '--mt-pc1': t.pennants[2][0], '--mt-pc2': t.pennants[2][1],
        '--mt-crowd-0': t.crowd[0], '--mt-crowd-1': t.crowd[1], '--mt-crowd-2': t.crowd[2],
        '--mt-carpet-a': t.carpet[0], '--mt-carpet-b': t.carpet[1], '--mt-accent': t.accent
    };
    return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}

// Deterministic scatter so every ceremony of a month looks the same and screenshots stay stable.
function scatter(seed) {
    let s = seed;
    return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

const DRIFT_COUNT = { snow: 34, rain: 40, fireflies: 22, lanterns: 20, sparks: 10 };

/** The weather that drifts across the stage this month. */
export function ceremonyDriftHtml(theme) {
    const t = theme || CEREMONY_MONTH_THEMES[10];
    const rnd = scatter(t.id.charCodeAt(0) * 31 + t.id.charCodeAt(2));
    const count = DRIFT_COUNT[t.drift] || 20;
    const bits = [];
    for (let i = 0; i < count; i += 1) {
        const x = (rnd() * 100).toFixed(1);
        const dur = (t.drift === 'rain' ? 0.9 + rnd() * 0.7 : t.drift === 'fireflies' ? 6 + rnd() * 6 : t.drift === 'lanterns' ? 16 + rnd() * 12 : t.drift === 'sparks' ? 5 + rnd() * 7 : 9 + rnd() * 9).toFixed(2);
        const delay = (-rnd() * Number(dur)).toFixed(2);
        const size = (0.6 + rnd() * 0.8).toFixed(2);
        const sway = ((rnd() - 0.5) * 24).toFixed(1);
        const y = (8 + rnd() * 62).toFixed(1);
        const color = t.driftColors[i % t.driftColors.length];
        bits.push(`<i style="--x:${x}%;--y:${y}%;--d:${dur}s;--w:${delay}s;--s:${size};--sw:${sway}vw;--c:${color}"></i>`);
    }
    return `<div class="cer-drift cer-drift--${t.drift}" aria-hidden="true">${bits.join('')}</div>`;
}

const HORIZONS = {
    pines: () => {
        const rnd = scatter(11);
        const trees = [];
        for (let x = -20; x < 1640; x += 46 + rnd() * 40) {
            const h = 70 + rnd() * 80;
            const w = h * 0.42;
            const base = 640 - rnd() * 10;
            trees.push(`<path d="M${x.toFixed(0)} ${(base - h).toFixed(0)} L${(x + w).toFixed(0)} ${base.toFixed(0)} H${(x - w).toFixed(0)} Z"/>`);
        }
        return trees.join('');
    },
    olives: () => {
        const rnd = scatter(23);
        const trees = [];
        for (let x = 30; x < 1600; x += 120 + rnd() * 120) {
            const r = 26 + rnd() * 22;
            const top = 600 - r - rnd() * 16;
            trees.push(`<rect x="${(x - 3).toFixed(0)}" y="${(top + r * 0.6).toFixed(0)}" width="6" height="${(640 - top).toFixed(0)}"/><ellipse cx="${x.toFixed(0)}" cy="${top.toFixed(0)}" rx="${(r * 1.4).toFixed(0)}" ry="${r.toFixed(0)}"/><ellipse cx="${(x + r * 0.9).toFixed(0)}" cy="${(top + 8).toFixed(0)}" rx="${(r * 0.9).toFixed(0)}" ry="${(r * 0.7).toFixed(0)}"/>`);
        }
        return trees.join('');
    },
    hills: () => '<path d="M0 640 C160 560 300 590 420 600 C560 612 640 540 800 548 C960 556 1040 600 1180 590 C1320 580 1420 540 1600 570 V660 H0 Z"/>',
    sea: () => '<path class="cer-horizon__sea" d="M0 600 H1600 V660 H0 Z"/><path class="cer-horizon__glint" d="M700 606 H900 M740 618 H860 M770 630 H830" fill="none"/>',
    vines: () => {
        const rows = [];
        for (let x = 0; x < 1600; x += 64) rows.push(`<rect x="${x + 28}" y="560" width="5" height="90"/><circle cx="${x + 30}" cy="566" r="16"/><circle cx="${x + 16}" cy="578" r="11"/><circle cx="${x + 44}" cy="578" r="11"/>`);
        return `<path d="M0 572 H1600" stroke-width="3" fill="none" class="cer-horizon__wire"/>${rows.join('')}`;
    }
};

/** A silhouette behind the stands (pines in winter, olive trees in autumn, the sea in summer). */
export function ceremonyHorizonHtml(theme) {
    const t = theme || CEREMONY_MONTH_THEMES[10];
    const draw = HORIZONS[t.horizon];
    if (!draw) return '';
    const bands = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'];
    const rainbow = t.rainbow
        ? `<g class="cer-horizon__rainbow" fill="none" stroke-width="16">${bands.map((c, i) => `<path stroke="${c}" d="M${280 + i * 16} 640 A${520 - i * 16} ${400 - i * 14} 0 0 1 ${1320 - i * 16} 640"/>`).join('')}</g>`
        : '';
    return `<svg class="cer-horizon cer-horizon--${t.horizon}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${rainbow}<g class="cer-horizon__shape">${draw()}</g></svg>`;
}

/** Winter lights strung along the pennant rope (December). */
export function ceremonyLightsHtml(theme) {
    if (!theme?.lights) return '';
    const colors = ['#fde047', '#f87171', '#4ade80', '#60a5fa'];
    return `<div class="cer-lights" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<span style="--i:${i};--c:${colors[i % colors.length]}"></span>`).join('')}</div>`;
}
