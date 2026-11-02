/**
 * Realm Raid party: each class marches as a little band of its students' hero classes, and the
 * formation places any number of classes on the left of the battlefield (classic side-view battle).
 * Pure string builders and maths; motion lives in styles/realm_raid.css (transform and opacity only).
 * Covered by tests/realm-raid-battle.test.mjs.
 */

const SKIN = '#ffdcc2';
const SKIN_SHADE = '#f2b493';
const INK = '#2a1d33';
const LINE = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const SHADE = 'fill="#1e1530" opacity=".16"';
const SHINE = 'fill="#ffffff" opacity=".3"';

/** A limb or a shaft with an ink outline: a thick ink stroke under a thinner colour stroke. */
const tube = (d, color, w, cls = '') => `<g${cls ? ` class="${cls}"` : ''} fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="${INK}" stroke-width="${w + 4.4}"/><path d="${d}" stroke="${color}" stroke-width="${w}"/></g>`;
const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${SKIN}" ${LINE}/>`;

/**
 * The body every hero shares, drawn like a little game sprite: ink outline, a shaded side, a shine.
 * Facing right (the boss). `back` is the far arm's colour; the near arm is drawn by each hero with its tool.
 */
function body(color, deep, { cape = true, hair = '#5b3a1e', back = deep, skirt = true } = {}) {
    return `
        ${cape ? `<g class="rr-u__cape"><path d="M38,60 C27,70 20,88 19,104 C25,101 29,104 34,101 C38,104 43,101 47,103 L52,62 Z" fill="${deep}" ${LINE}/>
            <path d="M33,74 C29,84 27,94 27,101 M42,72 C40,84 40,94 41,102" stroke="#1e1530" stroke-width="1.4" fill="none" opacity=".35"/></g>` : ''}
        ${tube('M41,66 C35,72 33,78 34,84', back, 6.5)}${hand(34, 86)}
        <g class="rr-u__legs">
            <path d="M39,90 L40,103 C36,104 34,106 34,108.5 C34,110 35,111 37,111 L48,111 C49.5,111 50,109.5 49.5,108 L49,90 Z" fill="${INK}"/>
            <path d="M52,90 L53,103 C53,105 53,108 54,109 C55,111 56,111 58,111 L67,111 C69,111 70,109.5 69,108 C68,106 65,104 62,103 L61,90 Z" fill="#3b2a4a" ${LINE}/>
            <path d="M55,104 L66,105" stroke="#ffffff" stroke-width="1.3" opacity=".25"/>
        </g>
        <path d="M37,63 C37,58 43,55.5 50,55.5 C57,55.5 63,58 63,63 L${skirt ? '67,93 C60,97 40,97 33,93' : '64,93 C58,96 42,96 36,93'} Z" fill="${color}" ${LINE}/>
        <path d="M37,63 C37,59 40,57 43,56.5 L40,95.5 C37.5,95 35,94 33,93 Z" ${SHADE}/>
        <path d="M58,58 C61,60 62,62 62.5,66 L63.5,78 C62,72 60,66 56.5,60 Z" ${SHINE}/>
        <path d="M44,56 L50,63 L56,56" fill="none" stroke="${deep}" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="35" y="80" width="30" height="5.5" rx="2" fill="${deep}" ${LINE}/>
        <rect x="46.5" y="79" width="7" height="7.5" rx="1.8" fill="#fcd34d" stroke="${INK}" stroke-width="1.6"/>
        <rect x="48.8" y="81.4" width="2.4" height="2.8" rx=".6" fill="#b45309"/>
        <path d="M45,52 L55,52 L55,57 C53,58.5 47,58.5 45,57 Z" fill="${SKIN_SHADE}" ${LINE}/>
        <path d="M50,13 C64.5,13 74,23 74,36.5 C74,50 64.5,58 51,58 C37.5,58 27.5,50 27.5,36.5 C27.5,23 36.5,13 50,13 Z" fill="${SKIN}" ${LINE}/>
        <path d="M30,42 C32,51 39,56 47,57.5 C40,58.5 31,54 28.5,45 Z" fill="${SKIN_SHADE}" opacity=".7"/>
        <ellipse cx="31.5" cy="40" rx="4.2" ry="5.6" fill="${SKIN}" ${LINE}/><path d="M31,37.5 C30,39.5 30.5,41.5 32,42.5" stroke="${SKIN_SHADE}" stroke-width="1.6" fill="none"/>
        <path d="M27.5,38 C25.5,20 37,11 51,11 C66,11 76.5,21 74.5,37 C72,31 68.5,27.5 64,26 C62,29.5 58,31 53.5,30.5 C52.5,27.5 50,26 47,26.5 C42,28 37,31.5 33,37 C31,36 29,36.5 27.5,38 Z" fill="${hair}" ${LINE}/>
        <path d="M38,18 C44,14 54,13.5 61,16" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".35"/>
        <ellipse cx="49" cy="47" rx="4.2" ry="2.4" fill="#fb7185" opacity=".38"/><ellipse cx="70.5" cy="46" rx="3" ry="2.1" fill="#fb7185" opacity=".38"/>
        <g class="rr-u__eyes">
            <ellipse cx="56" cy="40" rx="3.1" ry="4.3" fill="${INK}"/><ellipse cx="66.5" cy="40" rx="2.8" ry="4" fill="${INK}"/>
            <ellipse cx="56" cy="41.8" rx="2.2" ry="2" fill="#7c4a2d"/><ellipse cx="66.5" cy="41.8" rx="2" ry="1.9" fill="#7c4a2d"/>
            <circle cx="55" cy="38.3" r="1.35" fill="#fff"/><circle cx="65.6" cy="38.3" r="1.2" fill="#fff"/>
            <circle cx="57" cy="42.6" r=".6" fill="#fff"/><circle cx="67.4" cy="42.6" r=".55" fill="#fff"/>
        </g>
        <path d="M52.5,33.5 Q55.5,32 59,33 M63.5,33 Q66.5,32 69.5,33.5" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>
        <path d="M59,49 Q62,52.2 65,49" stroke="${INK}" stroke-width="1.7" fill="#c2410c" stroke-linecap="round"/>`;
}

/** The near arm, reaching forward to hold the hero's tool at (x, y). */
const arm = (color, x = 76, y = 80) => `<g class="rr-u__arm">${tube(`M60,64 C66,67 ${x - 6},${y - 10} ${x - 1},${y - 3}`, color, 7)}${hand(x, y)}</g>`;

// One look per hero class of the app (features/heroClasses.js), in its aura colours.
const SPRITES = {
    // Guardian (Respect): a round helm with a crest, a big kite shield, a short sword.
    guardian: (c, d) => `
        ${body(c, d, { hair: '#4a2e17' })}
        <g class="rr-u__weapon">${tube('M84,92 L94,50', '#e2e8f0', 3.6)}<path d="M93,52 L95.5,44 L96,53 Z" fill="#fff" ${LINE}/>
            ${tube('M79,88 L90,92', '#a16207', 3)}</g>
        <path d="M26,40 C25,21 36,10.5 50.5,10.5 C65,10.5 76.5,21 76,40 L72.5,40 C72.5,33 70,29 66,28 L41,28 C37,30 35,34 35,40 Z" fill="#e2e8f0" ${LINE}/>
        <path d="M30,32 C33,20 42,14 51,14" stroke="#ffffff" stroke-width="2.6" fill="none" opacity=".7" stroke-linecap="round"/>
        <path d="M26,38 L35,38 L35,42 L26,42 Z" fill="#94a3b8" ${LINE}/>
        <path d="M43,10.8 C44,4 57,3 59,10.8 Z" fill="${c}" ${LINE}/>
        ${arm('#e2e8f0', 66, 78)}
        <path d="M67,59 C80,58.5 86,63 86,71 C86,87 77,96 67,102 C57,96 48,87 48,71 C48,63 54,58.5 67,59 Z" fill="${c}" ${LINE}/>
        <path d="M67,63 C77,63 82,66 82,72 C82,85 75,92 67,97 Z" fill="#1e1530" opacity=".14"/>
        <path d="M67,64 L67,94 M55,74.5 L79,74.5" stroke="#f0fdf4" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M53,66 C56,62.5 60,61.5 64,61.5" stroke="#ffffff" stroke-width="2.2" fill="none" opacity=".55" stroke-linecap="round"/>`,
    // Sage (Creativity): a tall star-pointed hat, a staff with a glowing orb.
    sage: (c, d) => `
        ${body(c, d, { hair: '#2e1065' })}
        <g class="rr-u__weapon">${tube('M78,108 L89,46', '#8b5a2b', 3.4)}
            <circle class="rr-u__orb" cx="90" cy="40" r="7.4" fill="${c}" ${LINE}/><circle cx="87.6" cy="37.6" r="2.4" fill="#fff"/>
            <circle cx="90" cy="40" r="11" fill="none" stroke="${c}" stroke-width="1.4" opacity=".5"/></g>
        <path d="M30,30.5 C34,20 44,4 66,-3 C60,8 63,19 70,30.5 Z" fill="${d}" ${LINE}/>
        <path d="M44,22 C49,12 56,5 63,1" stroke="#ffffff" stroke-width="2" fill="none" opacity=".3" stroke-linecap="round"/>
        <path d="M21,32 C36,26 64,26 79,32 C74,37.5 26,37.5 21,32 Z" fill="${d}" ${LINE}/>
        <path d="M30,31.5 C42,29 58,29 70,31.5" stroke="${c}" stroke-width="3" fill="none"/>
        <path d="M53,17 l1.2,2.6 2.8,.3 -2.1,1.9 .6,2.8 -2.5,-1.4 -2.5,1.4 .6,-2.8 -2.1,-1.9 2.8,-.3 Z" fill="#fde68a"/>
        <circle cx="61" cy="8" r="1.5" fill="#fde68a"/><circle cx="46" cy="25" r="1.2" fill="#fde68a"/>
        ${arm(d, 84, 74)}`,
    // Paladin (Teamwork): a plumed knight's helm with a visor slit, a raised sword.
    paladin: (c, d) => `
        ${body(c, d, { hair: '#4a2e17' })}
        <path d="M26,42 C25,22 36,10.5 50.5,10.5 C65,10.5 77,22 76.5,42 L76.5,47 L73,47 L73,33 L42,33 C39,35 38,40 38,47 L26,47 Z" fill="#cbd5e1" ${LINE}/>
        <path d="M42,33 L73,33" stroke="#64748b" stroke-width="2.4"/>
        <path d="M30,32 C33,20 42,14 51,14" stroke="#ffffff" stroke-width="2.6" fill="none" opacity=".7" stroke-linecap="round"/>
        <path d="M50.5,11 L50.5,33" stroke="#94a3b8" stroke-width="2"/>
        <path class="rr-u__plume" d="M48,11 C40,0 50,-7 64,-1 C70,1 72,6 70,10 C64,6 58,6 54,11 Z" fill="${c}" ${LINE}/>
        <path d="M52,4 C56,1 61,1 65,2" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".45"/>
        <g class="rr-u__weapon">${tube('M78,82 L97,40', '#f1f5f9', 4.4)}<path d="M93.5,44 L99,34 L98.5,46 Z" fill="#fff" ${LINE}/>
            ${tube('M72,78 L84,85', '#ca8a04', 3.4)}<path d="M80,80 L95,46" stroke="#94a3b8" stroke-width="1.1"/></g>
        ${arm('#94a3b8', 77, 81)}`,
    // Artificer (Focus): brass goggles, a hammer, a spinning gear.
    artificer: (c, d) => `
        ${body(c, d, { hair: '#9a3412' })}
        <path d="M29,27 C38,22.5 64,22.5 73,27 L73,31.5 C64,28 38,28 29,31.5 Z" fill="${d}" ${LINE}/>
        <circle cx="45" cy="26.5" r="6.8" fill="#b45309" ${LINE}/><circle cx="45" cy="26.5" r="4.4" fill="#bae6fd"/>
        <circle cx="59.5" cy="26.5" r="6.8" fill="#b45309" ${LINE}/><circle cx="59.5" cy="26.5" r="4.4" fill="#bae6fd"/>
        <path d="M42.5,25 L45,23.5 M57,25 L59.5,23.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
        <g class="rr-u__weapon">${tube('M77,86 L89,54', '#92400e', 3.4)}
            <g transform="rotate(22 91 47)"><rect x="80" y="40" width="22" height="13" rx="2.6" fill="#94a3b8" ${LINE}/><rect x="80" y="40" width="22" height="4" rx="2" fill="#ffffff" opacity=".4"/><rect x="88" y="40" width="5" height="13" fill="#64748b" opacity=".5"/></g>
            <g class="rr-u__orb" transform="translate(94 26)"><path d="M0,-8 L2,-5.5 5.5,-6 5.5,-2.5 8,0 5.5,2.5 5.5,6 2,5.5 0,8 -2,5.5 -5.5,6 -5.5,2.5 -8,0 -5.5,-2.5 -5.5,-6 -2,-5.5 Z" fill="${c}" ${LINE}/><circle r="2.4" fill="#fff7ed" stroke="${INK}" stroke-width="1.4"/></g></g>
        ${arm(c, 78, 82)}`,
    // Scholar (trial results): a square cap with a gold tassel, an open book and a quill.
    scholar: (c, d) => `
        ${body(c, d, { hair: '#44403c', skirt: true })}
        <path d="M35,30 C35,24 66,24 66,30 L66,33 C58,31 43,31 35,33 Z" fill="${d}" ${LINE}/>
        <path d="M21,22 L50.5,11 L80,22 L50.5,32 Z" fill="${d}" ${LINE}/>
        <path d="M30,21 L50.5,13.5 L58,16.5" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".35"/>
        <path d="M50.5,22 L74,25 L75,39" stroke="#fcd34d" stroke-width="2" fill="none"/><path d="M72.5,38 L77.5,38 L76.5,45 L73.5,45 Z" fill="#fcd34d" stroke="${INK}" stroke-width="1.3"/>
        <circle cx="50.5" cy="22" r="2.2" fill="#fcd34d" stroke="${INK}" stroke-width="1.2"/>
        <g class="rr-u__weapon">
            <path d="M68,73 C74,70 80,70 84,72 C88,70 94,70 99,73 L99,93 C94,90 88,90 84,92 C80,90 74,90 68,93 Z" fill="#fff7ed" ${LINE}/>
            <path d="M84,72 L84,92" stroke="${INK}" stroke-width="1.6"/>
            <path d="M71,78 L80,77 M71,82 L80,81 M71,86 L78,85 M88,77 L96,77 M88,81 L96,81" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>
            <path class="rr-u__plume" d="M97,70 C102,58 104,48 101,38 C95,46 92,58 94,70 Z" fill="${c}" ${LINE}/><path d="M95.5,70 L100,44" stroke="#fff" stroke-width="1" opacity=".6"/></g>
        ${arm(c, 74, 84)}`,
    // Vanguard (Training Grounds): a ranger's hood with a feather, a curved bow and an arrow.
    vanguard: (c, d) => `
        ${body(c, d, { hair: '#6b3f1d', cape: true })}
        <path d="M25.5,46 C21,22 34,8.5 51,8.5 C67,8.5 78,20 74.5,37 C70,29 63,24 55,23 C45,22.5 35,29 32.5,49 Z" fill="${d}" ${LINE}/>
        <path d="M33,24 C38,16 45,12.5 53,12" stroke="#ffffff" stroke-width="2.2" fill="none" opacity=".28" stroke-linecap="round"/>
        <path d="M60,10 C66,1 76,0 81,3 C76,6 70,9 63,14 Z" fill="${c}" ${LINE}/><path d="M64,10 L78,3" stroke="#fff" stroke-width="1" opacity=".5"/>
        <g class="rr-u__weapon">
            <path d="M83,46 C97,58 97,84 83,98" stroke="${INK}" stroke-width="6.6" fill="none" stroke-linecap="round"/>
            <path d="M83,46 C97,58 97,84 83,98" stroke="#b45309" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path d="M83,46 L83,98" stroke="#fef3c7" stroke-width="1.1"/>
            ${tube('M70,72 L95,72', '#78350f', 1.8)}<path d="M99,72 L93,68.5 L93,75.5 Z" fill="#e2e8f0" ${LINE}/>
            <path d="M70,72 L66,68.5 M70,72 L66,75.5" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/></g>
        ${arm(d, 79, 74)}`,
    // Nomad (coming back): a wide travel hat, a walking staff, a satchel.
    nomad: (c, d) => `
        <path d="M29,64 C22,70 22,84 28,89 L40,87 L40,66 Z" fill="#a16207" ${LINE}/><path d="M24,74 L39,72" stroke="#78350f" stroke-width="1.6"/>
        ${body(c, d, { cape: false, hair: '#78350f' })}
        <path d="M60,59 L37,88" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
        <path d="M33,22.5 C33,8.5 68,8.5 68,22.5 Z" fill="${d}" ${LINE}/>
        <ellipse cx="50.5" cy="24" rx="31.5" ry="6.6" fill="${d}" ${LINE}/>
        <path d="M33.5,19.5 L67.5,19.5" stroke="${c}" stroke-width="3.4"/><path d="M38,12.5 C44,9.5 52,9 58,10" stroke="#fff" stroke-width="1.8" fill="none" opacity=".3"/>
        <g class="rr-u__weapon">${tube('M79,110 L88,36', '#92400e', 3.4)}<path d="M88,36 C91,29 99,30 97.5,37" stroke="${INK}" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="M88,36 C91,29 99,30 97.5,37" stroke="#92400e" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M86,48 C82,50 82,54 86,55" stroke="${c}" stroke-width="2.4" fill="none"/></g>
        ${arm(c, 83, 76)}`,
    // Patron (Hero's Boons): a golden circlet, a lantern with a glowing heart.
    patron: (c, d) => `
        ${body(c, d, { hair: '#9a3412' })}
        <path d="M30,25 C40,17.5 61,17.5 71,25" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M30,25 C40,17.5 61,17.5 71,25" stroke="#fcd34d" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M50.5,13.5 L54.5,19 L50.5,24 L46.5,19 Z" fill="${c}" ${LINE}/>
        <g class="rr-u__weapon">${tube('M76,82 L85,62', '#a16207', 2.6)}
            <path d="M83,44 L91,44 L92,40 L82,40 Z" fill="#fcd34d" ${LINE}/>
            <rect x="77" y="44" width="20" height="20" rx="5" fill="#fff1f2" ${LINE}/>
            <circle cx="87" cy="54" r="12" fill="${c}" opacity=".22"/>
            <path class="rr-u__orb" d="M87,60 C79.5,55 79.5,49.5 83.5,48.5 C85.5,48 87,49.5 87,51 C87,49.5 88.5,48 90.5,48.5 C94.5,49.5 94.5,55 87,60 Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/>
            <path d="M80,47 L80,58" stroke="#fff" stroke-width="1.6" opacity=".7" stroke-linecap="round"/></g>
        ${arm(c, 77, 82)}`,
    // Anyone without a hero class yet: an Adventurer with a bandana and a short sword.
    adventurer: (c, d) => `
        ${body(c, d)}
        <path d="M27.5,31 C33,21.5 68,21.5 74,31 L74,35.5 C66,31 36,31 27.5,35.5 Z" fill="${c}" ${LINE}/>
        <path d="M28.5,33 C21,34 17.5,40 20.5,46 C23,42 25.5,38.5 30,36 Z" fill="${d}" ${LINE}/>
        <path d="M34,27.5 C44,25 58,25 68,27.5" stroke="#fff" stroke-width="1.6" fill="none" opacity=".4"/>
        <g class="rr-u__weapon">${tube('M78,82 L94,48', '#f1f5f9', 4)}<path d="M91,52 L96.5,43 L95.5,54 Z" fill="#fff" ${LINE}/>${tube('M72,78 L84,85', '#a16207', 3.2)}</g>
        ${arm(c, 77, 81)}`
};

/** A hero dressed as a hero art's class, in its colours (realmRaidBattle#heroArt / #classArt). */
export function heroSpriteSvg(job) {
    const draw = SPRITES[job?.sprite] || SPRITES.adventurer;
    return `<svg class="rr-u__svg" viewBox="0 -8 104 126" aria-hidden="true" focusable="false">
        <ellipse class="rr-u__shadow" cx="51" cy="111.5" rx="25" ry="4.6" fill="#0b0716" opacity=".3"/>
        <g class="rr-u__body">${draw(job?.color || '#fbbf24', job?.deep || '#92400e')}</g>
    </svg>`;
}

/**
 * Where each class stands on the left of the battlefield, for any number of classes: columns
 * (the front one nearest the boss) of a few heroes each, in the classic diagonal. Each spot is in
 * percent of the party's area: { x, y } is the hero's centre, `h` its height, `z` its layer.
 * `aspect` is the area's width / height, so heroes never overlap sideways; `band` leaves room for
 * the two heroes standing behind each class's front hero.
 */
export function partyFormation(count, { aspect = 1.2, band = false } = {}) {
    const n = Math.max(0, Math.floor(count));
    if (!n) return [];
    // Try every number of columns; keep the one that lets the heroes stand tallest.
    const sizeFor = (c) => {
        const r = Math.ceil(n / c);
        const byHeight = Math.min(54, (100 / r) * 0.96);
        // A band (the class's heroes standing together) needs about a third more room sideways.
        const byWidth = ((100 / c) * (band ? 0.66 : 0.86) * aspect) / (100 / 150);
        return Math.min(byHeight, byWidth);
    };
    let cols = 1;
    for (let c = 2; c <= Math.min(n, 8); c++) if (sizeFor(c) > sizeFor(cols) + 0.5) cols = c;
    const rows = Math.ceil(n / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const h = sizeFor(cols);
    // The slant of each column, kept small enough that no hero steps out of the box.
    const halfW = (h * (100 / 150) * (band ? 1.5 : 1.1)) / aspect / 2; // the flag (and the band) reach past the hero
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
