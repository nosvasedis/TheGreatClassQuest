/**
 * Realm Raid party: one little hero per class, dressed as its league's job, and the formation that
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

const SPRITES = {
    // Star Sprites: wings, a star clip, a star wand.
    sprite: (c, d) => `
        <g class="rr-u__wings" fill="#fdf2f8" stroke="${c}" stroke-width="1.5" opacity=".95">
            <path d="M38,62 C22,48 12,56 18,68 C22,76 32,74 38,68 Z"/><path d="M38,70 C24,72 20,84 28,88 C34,90 38,82 40,76 Z"/>
        </g>
        ${body(c, d, { cape: false, hair: '#f9a8d4' })}
        <circle cx="34" cy="22" r="7" fill="#f9a8d4"/>
        <path d="M60,16 l2.6,5.4 5.9,.8 -4.3,4.1 1,5.8 -5.2,-2.8 -5.2,2.8 1,-5.8 -4.3,-4.1 5.9,-.8 Z" fill="#fde047" stroke="#ca8a04" stroke-width="1"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M74,82 L86,52" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/>
        <path d="M86,40 l3,6.2 6.8,1 -4.9,4.8 1.2,6.8 -6.1,-3.2 -6.1,3.2 1.2,-6.8 -4.9,-4.8 6.8,-1 Z" fill="#fde047" stroke="#ca8a04" stroke-width="1.2"/></g>`,
    // Bubble Squires: a round helmet, a bubble wand.
    squire: (c, d) => `
        ${body(c, d, { hair: '#7c4a21' })}
        <path d="M28,36 C28,20 38,12 50,12 C62,12 72,20 72,36 Z" fill="#e0f2fe" stroke="${d}" stroke-width="2.5"/>
        <rect x="27" y="32" width="46" height="6" rx="3" fill="${c}" stroke="${d}" stroke-width="1.5"/>
        <circle cx="50" cy="13" r="4" fill="${c}"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M74,82 L84,58" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
        <circle cx="86" cy="52" r="7" fill="none" stroke="#e0f2fe" stroke-width="2.5"/>
        <circle class="rr-u__bubble" cx="93" cy="40" r="4" fill="#bae6fd" opacity=".85"/><circle class="rr-u__bubble" cx="84" cy="34" r="2.6" fill="#e0f2fe" opacity=".85"/></g>`,
    // Leaf Rangers: a leafy hood, a little bow.
    ranger: (c, d) => `
        ${body(c, d, { hair: '#6b3f1d' })}
        <path d="M27,42 C24,22 36,10 52,10 C66,10 76,22 72,36 C66,26 58,22 50,22 C40,22 32,30 31,46 Z" fill="${d}"/>
        <path d="M50,10 C56,2 66,2 70,6 C64,8 58,10 52,14 Z" fill="${c}"/>
        ${arm(d)}
        <g class="rr-u__weapon"><path d="M82,50 C94,62 94,82 82,94" stroke="#a16207" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M82,50 L82,94" stroke="#fef3c7" stroke-width="1"/><path d="M72,72 L94,72" stroke="#713f12" stroke-width="2"/><path d="M94,72 l-5,-3 0,6 Z" fill="${c}"/></g>`,
    // Comet Knights: a helmet with a plume, a sword.
    knight: (c, d) => `
        ${body(c, d, { hair: '#3f2a14' })}
        <path d="M28,40 C27,22 38,12 50,12 C62,12 73,22 72,40 L72,44 L60,44 L60,34 L40,34 L40,44 L28,44 Z" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
        <path class="rr-u__plume" d="M46,13 C40,2 52,-4 62,2 C56,4 52,8 52,13 Z" fill="${c}"/>
        ${arm('#94a3b8')}
        <g class="rr-u__weapon"><path d="M74,84 L94,44" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>
        <path d="M70,80 L80,86" stroke="#a16207" stroke-width="4" stroke-linecap="round"/><path d="M92,48 L96,40" stroke="#fff" stroke-width="2"/></g>`,
    // Storm Archers: a feathered cap, a bow with a lightning arrow.
    archer: (c, d) => `
        ${body(c, d, { hair: '#7c2d12' })}
        <path d="M28,30 C30,16 42,10 54,12 C64,14 72,20 72,30 C62,26 42,26 28,30 Z" fill="${d}"/>
        <path d="M66,18 C76,8 86,8 90,10 C84,14 78,20 70,24 Z" fill="${c}"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M82,48 C96,60 96,84 82,96" stroke="#78350f" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M82,48 L82,96" stroke="#fef3c7" stroke-width="1"/>
        <path d="M70,72 L84,70 L80,74 L96,72" stroke="#facc15" stroke-width="2.6" fill="none" stroke-linejoin="round"/></g>`,
    // Arcane Mages: a pointed hat with stars, a staff with an orb.
    mage: (c, d) => `
        ${body(c, d, { hair: '#1e1b4b' })}
        <path d="M24,32 C40,26 60,26 76,32 C70,36 30,36 24,32 Z" fill="${d}"/>
        <path d="M32,31 C40,20 46,4 64,-2 C58,10 62,20 68,31 Z" fill="${d}"/>
        <circle cx="52" cy="18" r="2.2" fill="#fde68a"/><circle cx="58" cy="8" r="1.6" fill="#fde68a"/>
        ${arm(d)}
        <g class="rr-u__weapon"><path d="M76,104 L88,44" stroke="#78350f" stroke-width="3.4" stroke-linecap="round"/>
        <circle class="rr-u__orb" cx="89" cy="40" r="7" fill="${c}" stroke="#ede9fe" stroke-width="2"/><circle cx="87" cy="38" r="2" fill="#fff"/></g>`,
    // Dragon Paladins: a horned helm, a shield with a dragon mark, a spear.
    paladin: (c, d) => `
        ${body(c, d, { hair: '#1c1917' })}
        <path d="M28,40 C27,22 38,12 50,12 C62,12 73,22 72,40 L60,40 L60,32 L40,32 L40,40 Z" fill="#fca5a5" stroke="${d}" stroke-width="2"/>
        <path d="M32,20 C24,14 22,6 26,2 C28,10 34,14 38,16 Z M68,20 C76,14 78,6 74,2 C72,10 66,14 62,16 Z" fill="#fef3c7" stroke="${d}" stroke-width="1.5"/>
        <g class="rr-u__weapon"><path d="M88,104 L88,30" stroke="#a8a29e" stroke-width="3.4" stroke-linecap="round"/><path d="M88,22 L93,34 L83,34 Z" fill="#e7e5e4" stroke="#57534e" stroke-width="1"/></g>
        ${arm('#fca5a5', 60, 66)}
        <path d="M66,62 C78,62 82,66 82,72 C82,86 74,94 66,98 C58,94 50,86 50,72 C50,66 54,62 66,62 Z" fill="${c}" stroke="#fef3c7" stroke-width="2.5"/>
        <path d="M60,74 C62,68 70,68 72,74 C68,72 66,76 66,80 C64,78 62,76 60,74 Z" fill="#fef3c7"/>`,
    // Anyone else: a bandana and a sword.
    adventurer: (c, d) => `
        ${body(c, d)}
        <path d="M29,30 C34,22 66,22 71,30 L71,34 L29,34 Z" fill="${c}"/><path d="M29,32 C22,34 20,40 24,44 C26,40 28,36 31,34 Z" fill="${d}"/>
        ${arm(c)}
        <g class="rr-u__weapon"><path d="M74,84 L92,48" stroke="#e2e8f0" stroke-width="4.6" stroke-linecap="round"/><path d="M70,80 L80,86" stroke="#a16207" stroke-width="4" stroke-linecap="round"/></g>`
};

/** A hero in the colours of a league's job (realmRaidBattle#leagueJob). */
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
