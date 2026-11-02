/**
 * Realm Raid party: one little hero per class, dressed as the hero class most of its students chose,
 * and the formation that
 * places any number of classes on the left of the battlefield (classic side-view battle).
 * Pure string builders and maths; motion lives in styles/realm_raid.css (transform and opacity only).
 * Covered by tests/realm-raid-battle.test.mjs.
 */

const SKIN = '#ffd9b8';
const SKIN_SHADE = '#f4b998';
const INK = '#2b1d14';

/** The body every hero shares: cape, legs, tunic, arm, head and face, facing right (the boss). */
function body(color, deep, { cape = true, hair = '#5b3a1e' } = {}) {
    return `
        ${cape ? `<path class="rr-u__cape" d="M36,60 C26,74 22,92 24,106 L50,100 L52,62 Z" fill="${deep}"/>` : ''}
        <g class="rr-u__legs" fill="${INK}">
            <rect x="38" y="92" width="10" height="16" rx="4"/><rect x="53" y="92" width="10" height="16" rx="4"/>
            <rect x="36" y="104" width="14" height="7" rx="3.5"/><rect x="52" y="104" width="14" height="7" rx="3.5"/>
        </g>
        <path d="M34,64 C34,58 40,56 50,56 C60,56 66,58 66,64 L68,96 L32,96 Z" fill="${color}"/>
        <path d="M32,90 L68,90 L68,96 L32,96 Z" fill="${deep}"/>
        <rect x="46" y="88" width="9" height="9" rx="2" fill="#fde68a"/>
        <path d="M50,58 L50,90" stroke="${deep}" stroke-width="2" opacity=".5"/>
        <circle cx="50" cy="38" r="21" fill="${SKIN}"/>
        <path d="M30,36 C30,22 40,15 51,15 C62,15 71,22 71,34 C64,30 58,26 52,25 C46,30 38,33 30,36 Z" fill="${hair}"/>
        <ellipse cx="44" cy="44" rx="3.6" ry="2.2" fill="#fca5a5" opacity=".7"/>
        <ellipse cx="66" cy="44" rx="3" ry="2" fill="#fca5a5" opacity=".7"/>
        <g class="rr-u__eyes" fill="${INK}"><ellipse cx="54" cy="38" rx="2.6" ry="3.6"/><ellipse cx="64" cy="38" rx="2.4" ry="3.4"/></g>
        <g fill="#fff"><circle cx="55" cy="36.6" r="1"/><circle cx="65" cy="36.6" r="1"/></g>
        <path d="M57,47 Q60,50 63,47" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M29,40 C27,44 28,48 31,49" stroke="${SKIN_SHADE}" stroke-width="2" fill="none"/>`;
}

const arm = (color, x = 62, y = 66) => `<path class="rr-u__arm" d="M${x},${y} C${x + 8},${y + 4} ${x + 12},${y + 10} ${x + 12},${y + 16}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="${x + 12}" cy="${y + 17}" r="4.6" fill="${SKIN}"/>`;

// One look per hero class of the app (features/heroClasses.js), in its aura colours.
const SPRITES = {
    // Guardian (Respect): a round helm, a big shield, a short sword.
    guardian: (c, d) => `
        ${body(c, d, { hair: '#3f2a14' })}
        <path d="M28,40 C27,22 38,12 50,12 C62,12 73,22 72,40 L60,40 L60,32 L40,32 L40,40 Z" fill="#e2e8f0" stroke="${d}" stroke-width="2"/>
        <rect x="47" y="8" width="6" height="8" rx="3" fill="${c}"/>
        <g class="rr-u__weapon"><path d="M86,96 L94,52" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/><path d="M82,90 L92,94" stroke="#a16207" stroke-width="4" stroke-linecap="round"/></g>
        ${arm('#e2e8f0', 60, 66)}
        <path d="M66,60 C80,60 84,65 84,72 C84,88 75,96 66,101 C57,96 48,88 48,72 C48,65 52,60 66,60 Z" fill="${c}" stroke="#f0fdf4" stroke-width="2.5"/>
        <path d="M66,66 L66,94 M54,76 L78,76" stroke="#f0fdf4" stroke-width="3" stroke-linecap="round"/>`,
    // Sage (Creativity): a pointed hat with stars, a staff with an orb.
    sage: (c, d) => `
        ${body(c, d, { hair: '#1e1b4b' })}
        <path d="M24,32 C40,26 60,26 76,32 C70,36 30,36 24,32 Z" fill="${d}"/>
        <path d="M32,31 C40,20 46,4 64,-2 C58,10 62,20 68,31 Z" fill="${d}"/>
        <circle cx="52" cy="18" r="2.2" fill="#fde68a"/><circle cx="58" cy="8" r="1.6" fill="#fde68a"/>
        ${arm(d)}
        <g class="rr-u__weapon"><path d="M76,104 L88,44" stroke="#78350f" stroke-width="3.4" stroke-linecap="round"/>
        <circle class="rr-u__orb" cx="89" cy="40" r="7" fill="${c}" stroke="#ede9fe" stroke-width="2"/><circle cx="87" cy="38" r="2" fill="#fff"/></g>`,
    // Paladin (Teamwork): a plumed helm, a raised sword.
    paladin: (c, d) => `
        ${body(c, d, { hair: '#3f2a14' })}
        <path d="M28,40 C27,22 38,12 50,12 C62,12 73,22 72,40 L72,44 L60,44 L60,34 L40,34 L40,44 L28,44 Z" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
        <path class="rr-u__plume" d="M46,13 C40,2 52,-4 62,2 C56,4 52,8 52,13 Z" fill="${c}"/>
        ${arm('#94a3b8')}
        <g class="rr-u__weapon"><path d="M74,84 L94,44" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>
        <path d="M70,80 L80,86" stroke="#a16207" stroke-width="4" stroke-linecap="round"/><path d="M92,48 L96,40" stroke="#fff" stroke-width="2"/></g>`,
    // Artificer (Focus): goggles on the forehead, a hammer, a gear.
    artificer: (c, d) => `
        ${body(c, d, { hair: '#7c2d12' })}
        <rect x="31" y="22" width="40" height="7" rx="3.5" fill="${d}"/>
        <circle cx="44" cy="25" r="6.5" fill="#bae6fd" stroke="${d}" stroke-width="2.5"/><circle cx="58" cy="25" r="6.5" fill="#bae6fd" stroke="${d}" stroke-width="2.5"/>
        <circle cx="42.5" cy="23.5" r="1.8" fill="#fff"/><circle cx="56.5" cy="23.5" r="1.8" fill="#fff"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M74,84 L88,52" stroke="#78350f" stroke-width="3.6" stroke-linecap="round"/>
        <rect x="80" y="40" width="20" height="12" rx="2.5" fill="#94a3b8" stroke="#475569" stroke-width="1.5" transform="rotate(24 90 46)"/>
        <g class="rr-u__orb" transform="translate(92 26)"><circle r="6" fill="none" stroke="${c}" stroke-width="3.5" stroke-dasharray="3 2.3"/><circle r="2.2" fill="${c}"/></g></g>`,
    // Scholar (trial results): a square cap with a tassel, a book and a quill.
    scholar: (c, d) => `
        ${body(c, d, { hair: '#44403c' })}
        <path d="M24,22 L50,12 L76,22 L50,32 Z" fill="${d}"/><rect x="36" y="24" width="28" height="8" fill="${d}"/>
        <path d="M70,24 L72,38" stroke="#fde68a" stroke-width="2"/><circle cx="72" cy="40" r="2.4" fill="#fde68a"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M70,74 L94,70 L94,90 L70,94 Z" fill="#fff7ed" stroke="${d}" stroke-width="2"/><path d="M82,72 L82,92" stroke="${d}" stroke-width="1.5"/>
        <path d="M74,78 L80,77 M74,83 L80,82 M85,77 L91,76" stroke="#94a3b8" stroke-width="1.2"/>
        <path class="rr-u__plume" d="M92,68 C98,56 100,48 98,40 C92,48 90,58 90,68 Z" fill="${c}"/></g>`,
    // Vanguard (Training Grounds): a hood, a little bow.
    vanguard: (c, d) => `
        ${body(c, d, { hair: '#6b3f1d' })}
        <path d="M27,42 C24,22 36,10 52,10 C66,10 76,22 72,36 C66,26 58,22 50,22 C40,22 32,30 31,46 Z" fill="${d}"/>
        <path d="M50,10 C56,2 66,2 70,6 C64,8 58,10 52,14 Z" fill="${c}"/>
        ${arm(d)}
        <g class="rr-u__weapon"><path d="M82,50 C94,62 94,82 82,94" stroke="#a16207" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M82,50 L82,94" stroke="#fef3c7" stroke-width="1"/><path d="M72,72 L94,72" stroke="#713f12" stroke-width="2"/><path d="M94,72 l-5,-3 0,6 Z" fill="${c}"/></g>`,
    // Nomad (coming back): a wide travel hat, a walking staff, a satchel.
    nomad: (c, d) => `
        <path d="M30,64 C24,70 24,84 30,88 L40,86 L40,66 Z" fill="#a16207"/>
        ${body(c, d, { cape: false, hair: '#78350f' })}
        <ellipse cx="50" cy="24" rx="30" ry="6" fill="${d}"/><path d="M36,23 C36,10 64,10 64,23 Z" fill="${d}"/><path d="M36,20 L64,20" stroke="${c}" stroke-width="3"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M78,108 L88,36" stroke="#92400e" stroke-width="3.6" stroke-linecap="round"/><path d="M88,36 C92,30 98,32 96,38" stroke="#92400e" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>`,
    // Patron (Hero's Boons): a little circlet, a lantern with a heart.
    patron: (c, d) => `
        ${body(c, d, { hair: '#9a3412' })}
        <path d="M32,24 C40,18 60,18 68,24" stroke="#fde68a" stroke-width="3.5" fill="none"/><circle cx="50" cy="19" r="3.4" fill="${c}" stroke="#fde68a" stroke-width="1.5"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M76,80 L86,58" stroke="#a16207" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="78" y="40" width="18" height="20" rx="5" fill="#fff1f2" stroke="#fde68a" stroke-width="2"/>
        <path class="rr-u__orb" d="M87,55 C80,50 80,45 84,44 C86,44 87,46 87,47 C87,46 88,44 90,44 C94,45 94,50 87,55 Z" fill="${c}"/></g>`,
    // Anyone without a hero class yet: a bandana and a sword.
    adventurer: (c, d) => `
        ${body(c, d)}
        <path d="M29,30 C34,22 66,22 71,30 L71,34 L29,34 Z" fill="${c}"/><path d="M29,32 C22,34 20,40 24,44 C26,40 28,36 31,34 Z" fill="${d}"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M74,84 L92,48" stroke="#e2e8f0" stroke-width="4.6" stroke-linecap="round"/><path d="M70,80 L80,86" stroke="#a16207" stroke-width="4" stroke-linecap="round"/></g>`
};

/** A hero dressed as a hero art's class, in its colours (realmRaidBattle#heroArt / #classArt). */
export function heroSpriteSvg(job) {
    const draw = SPRITES[job?.sprite] || SPRITES.adventurer;
    return `<svg class="rr-u__svg" viewBox="0 -6 100 124" aria-hidden="true" focusable="false">
        <ellipse class="rr-u__shadow" cx="51" cy="111" rx="24" ry="5" fill="#000" opacity=".28"/>
        <g class="rr-u__body">${draw(job?.color || '#fbbf24', job?.deep || '#92400e')}</g>
    </svg>`;
}

/**
 * Where each class stands on the left of the battlefield, for any number of classes: columns
 * (the front one nearest the boss) of a few heroes each, in the classic diagonal. Each spot is in
 * percent of the party's area: { x, y } is the hero's centre, `h` its height, `z` its layer.
 * `aspect` is the area's width / height, so heroes never overlap sideways.
 */
export function partyFormation(count, { aspect = 1.2 } = {}) {
    const n = Math.max(0, Math.floor(count));
    if (!n) return [];
    // Try every number of columns; keep the one that lets the heroes stand tallest.
    const sizeFor = (c) => {
        const r = Math.ceil(n / c);
        const byHeight = Math.min(54, (100 / r) * 0.96);
        const byWidth = ((100 / c) * 0.86 * aspect) / (100 / 150);
        return Math.min(byHeight, byWidth);
    };
    let cols = 1;
    for (let c = 2; c <= Math.min(n, 8); c++) if (sizeFor(c) > sizeFor(cols) + 0.5) cols = c;
    const rows = Math.ceil(n / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const h = sizeFor(cols);
    // The slant of each column, kept small enough that no hero steps out of the box.
    const halfW = (h * (100 / 150) * 1.1) / aspect / 2; // the flag hangs a little past the hero
    const room = Math.max(0, cellW / 2 - halfW);
    const slant = rows > 1 ? Math.min(cellW * 0.32, (cellW * 0.4) / ((rows - 1) / 2), room / ((rows - 1) / 2)) : 0;
    const spots = [];
    for (let i = 0; i < n; i++) {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const inCol = Math.min(rows, n - col * rows);
        const mid = (inCol - 1) / 2;
        const top = (rows - inCol) * cellH / 2; // a short last column sits in the middle
        const x = 100 - (col + 0.5) * cellW + (row - mid) * slant;
        // One line of heroes stands on the ground, not in the middle of the field.
        const y = rows === 1 ? Math.max(50, 100 - h * 0.55) : top + (row + 0.5) * cellH;
        spots.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), h: Number(h.toFixed(2)), z: row + 1, col, row });
    }
    return spots;
}
