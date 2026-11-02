// features/familiarStations.mjs — the places in a familiar's habitat where it does things.
//
// Every species has its own snack (a food station with three bites it really eats), its own toy
// (a ball it kicks and chases) and its home (from features/familiarHabitat.mjs, where it goes in
// for a nap). It also has its own voice word and food words for its speech bubbles.
// Pure module: SVG text and words only.

const r1 = (n) => Math.round(n * 10) / 10;

// ─── Bites ────────────────────────────────────────────────────────────────────
const BITES = {
    pepper: (x, y) => `<path d="M${x - 4} ${y - 10}q10 -2 12 6q2 12 -12 20q6 -12 0 -26z" fill="#ef4444"/><path d="M${x - 3} ${y - 9}q5 0 6 5" stroke="#fecaca" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${x - 4} ${y - 10}l-3 -6" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>`,
    fish: (x, y, col = '#7dd3fc') => `<ellipse cx="${x}" cy="${y}" rx="11" ry="6" fill="${col}"/><path d="M${x + 9} ${y}l9 -7v14z" fill="${col}"/><circle cx="${x - 5}" cy="${y - 1}" r="1.8" fill="#0f172a"/><path d="M${x - 2} ${y - 4}q4 4 0 8" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.6" fill="none"/>`,
    berry: (x, y, col = '#7c3aed') => `<circle cx="${x}" cy="${y}" r="8" fill="${col}"/><circle cx="${x - 3}" cy="${y - 3}" r="2.4" fill="#ffffff" fill-opacity=".6"/><path d="M${x} ${y - 8}q4 -6 9 -4q-3 5 -9 4z" fill="#22c55e"/>`,
    cookie: (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#ede9fe"/><path d="M${x + 2} ${y - 8}a8 8 0 1 0 6 12a7 7 0 1 1 -6 -12z" fill="#c4b5fd"/><circle cx="${x - 3}" cy="${y + 1}" r="1.4" fill="#a78bfa"/><circle cx="${x + 2}" cy="${y + 4}" r="1.2" fill="#a78bfa"/>`,
    drop: (x, y) => `<path d="M${x} ${y - 11}q8 10 8 15a8 8 0 0 1 -16 0q0 -5 8 -15z" fill="#fbbf24"/><circle cx="${x - 3}" cy="${y + 2}" r="2" fill="#fffbeb" fill-opacity=".8"/>`,
    shrimp: (x, y) => `<path d="M${x - 9} ${y + 4}q-2 -14 12 -12q8 2 6 10" stroke="#fb7185" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M${x + 9} ${y + 2}l5 4l-6 2z" fill="#fb7185"/><circle cx="${x - 6}" cy="${y - 4}" r="1.4" fill="#0f172a"/>`,
    acorn: (x, y) => `<ellipse cx="${x}" cy="${y + 2}" rx="7" ry="9" fill="#b45309"/><path d="M${x - 9} ${y - 3}q9 -9 18 0z" fill="#78350f"/><path d="M${x} ${y - 8}v-4" stroke="#78350f" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="${x - 2}" cy="${y + 1}" rx="2" ry="3.5" fill="#fde68a" fill-opacity=".45"/>`,
    gem: (x, y, col = '#f0abfc') => `<path d="M${x} ${y - 10}l9 8l-9 12l-9 -12z" fill="${col}"/><path d="M${x} ${y - 10}l9 8h-18z" fill="#ffffff" fill-opacity=".5"/>`,
    star: (x, y) => `<path d="M${x} ${y - 10}l3 6.5l7 .8l-5.2 4.8l1.4 7l-6.2 -3.6l-6.2 3.6l1.4 -7l-5.2 -4.8l7 -.8z" fill="#fde68a" stroke="#f59e0b" stroke-width="1.2"/>`,
    carrot: (x, y) => `<path d="M${x - 5} ${y - 6}h10l-5 20z" fill="#f97316"/><path d="M${x - 3} ${y - 1}h4M${x - 2} ${y + 5}h3" stroke="#c2410c" stroke-width="1.2"/><path d="M${x} ${y - 6}q-6 -8 -4 -12M${x} ${y - 6}q0 -9 3 -12M${x} ${y - 6}q6 -7 6 -10" stroke="#22c55e" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
};

// ─── Bases ────────────────────────────────────────────────────────────────────
const BASES = {
    brazier: `<ellipse cx="70" cy="94" rx="46" ry="6" fill="#000" fill-opacity=".25"/><path d="M30 62h80l-10 30h-60z" fill="#57534e"/><path d="M30 62h80l-3 8h-74z" fill="#78716c"/><ellipse cx="70" cy="62" rx="40" ry="9" fill="#1c1917"/><ellipse cx="70" cy="61" rx="34" ry="6" fill="#f97316" class="fst-glow"/><circle cx="58" cy="60" r="4" fill="#fde047"/><circle cx="80" cy="61" r="3.4" fill="#fbbf24"/>`,
    icehole: `<ellipse cx="70" cy="86" rx="58" ry="14" fill="#e0f2fe"/><ellipse cx="70" cy="84" rx="40" ry="9" fill="#0c4a6e"/><ellipse cx="62" cy="82" rx="14" ry="2.5" fill="#7dd3fc" fill-opacity=".6" class="fst-glow"/><path d="M14 84l10 -10l8 8zM114 82l10 -8l4 10z" fill="#bae6fd"/>`,
    bush: `<ellipse cx="70" cy="94" rx="50" ry="6" fill="#000" fill-opacity=".22"/><circle cx="46" cy="72" r="24" fill="#15803d"/><circle cx="94" cy="72" r="24" fill="#15803d"/><circle cx="70" cy="58" r="28" fill="#16a34a"/><circle cx="60" cy="50" r="10" fill="#22c55e" fill-opacity=".7"/><rect x="26" y="78" width="88" height="16" rx="8" fill="#15803d"/>`,
    moonbowl: `<ellipse cx="70" cy="94" rx="44" ry="6" fill="#000" fill-opacity=".3"/><path d="M28 66h84q-4 28 -42 28t-42 -28z" fill="#4c1d95"/><path d="M28 66h84" stroke="#c4b5fd" stroke-width="4" stroke-linecap="round"/><path d="M58 78a10 10 0 1 0 12 10a8 8 0 1 1 -12 -10z" fill="#fde68a" fill-opacity=".8"/>`,
    flower: `<path d="M70 96v-26" stroke="#15803d" stroke-width="5"/><path d="M70 86q-18 -2 -24 -14q16 0 24 14z" fill="#22c55e"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<ellipse cx="${r1(70 + Math.cos(a) * 22)}" cy="${r1(56 + Math.sin(a) * 12)}" rx="16" ry="9" fill="${i % 2 ? '#f9a8d4' : '#fbcfe8'}" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(70 + Math.cos(a) * 22)} ${r1(56 + Math.sin(a) * 12)})"/>`; }).join('')}<ellipse cx="70" cy="56" rx="16" ry="10" fill="#f59e0b"/>`,
    clam: `<ellipse cx="70" cy="94" rx="46" ry="6" fill="#000" fill-opacity=".2"/><path d="M26 74q44 -50 88 0z" fill="#fda4af"/><path d="M40 72l30 -32M70 70v-34M100 72l-30 -32" stroke="#fb7185" stroke-width="2.5"/><path d="M24 74h92q-8 20 -46 20t-46 -20z" fill="#fecdd3"/><circle cx="70" cy="80" r="6" fill="#fff1f2"/>`,
    tray: `<rect x="66" y="74" width="8" height="22" fill="#78350f"/><path d="M24 62h92l-6 14h-80z" fill="#a16207"/><path d="M22 60h96v5h-96z" fill="#ca8a04"/><path d="M34 40l36 -14l36 14z" fill="#92400e"/><path d="M36 40v20M104 40v20" stroke="#78350f" stroke-width="3"/>`,
    rockplate: `<ellipse cx="70" cy="94" rx="50" ry="6" fill="#000" fill-opacity=".25"/><path d="M20 80q2 -14 22 -16h56q22 2 22 16q-4 14 -50 14t-50 -14z" fill="#64748b"/><path d="M28 72q20 -6 84 0" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M110 70l6 -18l6 18z" fill="#5eead4" class="fst-glow"/>`,
    cloud: `<ellipse cx="70" cy="94" rx="40" ry="5" fill="#000" fill-opacity=".18"/><g class="fst-float"><ellipse cx="70" cy="74" rx="46" ry="14" fill="#fbcfe8"/><circle cx="46" cy="66" r="16" fill="#fce7f3"/><circle cx="72" cy="60" r="20" fill="#fdf2f8"/><circle cx="96" cy="68" r="14" fill="#fce7f3"/></g>`,
    soil: `<ellipse cx="70" cy="94" rx="54" ry="7" fill="#000" fill-opacity=".2"/><path d="M16 94q10 -30 54 -30t54 30z" fill="#78350f"/><path d="M30 86q20 -12 40 -12M80 80q14 0 26 8" stroke="#92400e" stroke-width="3" fill="none" stroke-linecap="round"/>`
};

// Each species: base, bite kind, three bite spots, food word, toy look, voice word.
const SPECIES = {
    emberfang: { base: 'brazier', bite: 'pepper', at: [[52, 52], [70, 48], [88, 52]], food: 'ember peppers', foodIcon: '🌶️', sound: 'Rawr!', toy: 'lava' },
    frostpaw: { base: 'icehole', bite: 'fish', at: [[34, 64], [104, 62], [70, 60]], food: 'fish', foodIcon: '🐟', sound: 'Yip yip!', toy: 'snow' },
    thornback: { base: 'bush', bite: 'berry', at: [[50, 52], [72, 38], [92, 54]], food: 'berries', foodIcon: '🫐', sound: 'Ribbit!', toy: 'pinecone' },
    veilshade: { base: 'moonbowl', bite: 'cookie', at: [[50, 60], [70, 56], [90, 60]], food: 'moon cookies', foodIcon: '🍪', sound: 'Purrr...', toy: 'yarn' },
    sparkling: { base: 'flower', bite: 'drop', at: [[48, 50], [70, 44], [92, 50]], food: 'sweet nectar', foodIcon: '🌼', sound: 'Tweet tweet!', toy: 'sun' },
    tidefin: { base: 'clam', bite: 'shrimp', at: [[50, 72], [72, 66], [94, 72]], food: 'shrimp', foodIcon: '🦐', sound: 'Splish splash!', toy: 'beach' },
    stormwing: { base: 'tray', bite: 'acorn', at: [[46, 52], [70, 50], [94, 52]], food: 'acorns', foodIcon: '🌰', sound: 'Hoo-hoo!', toy: 'bolt' },
    gemshell: { base: 'rockplate', bite: 'gem', at: [[48, 64], [70, 60], [92, 64]], food: 'crystal candy', foodIcon: '💎', sound: 'Clink clink!', toy: 'marble' },
    starfoal: { base: 'cloud', bite: 'star', at: [[50, 54], [72, 46], [94, 56]], food: 'star cookies', foodIcon: '⭐', sound: 'Neigh!', toy: 'star' },
    cloverhop: { base: 'soil', bite: 'carrot', at: [[46, 70], [70, 64], [94, 70]], food: 'carrots', foodIcon: '🥕', sound: 'Boing boing!', toy: 'clover' }
};

const TOYS = {
    lava: '<circle r="18" fill="#57534e"/><path d="M-12 -6l8 4l4 -8l6 10l8 -2M-8 10l6 -6l8 6" stroke="#fdba74" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-6" cy="-8" r="4" fill="#ffffff" fill-opacity=".18"/>',
    snow: '<circle r="18" fill="#e0f2fe"/><path d="M-18 4a18 18 0 0 0 36 0a20 14 0 0 1 -36 0z" fill="#bfdbfe"/><circle cx="-6" cy="-7" r="5" fill="#ffffff"/><circle cx="5" cy="2" r="1.6" fill="#93c5fd"/><circle cx="-3" cy="8" r="1.4" fill="#93c5fd"/>',
    pinecone: '<ellipse rx="14" ry="18" fill="#92400e"/>' + [-10, -2, 6, 14].map((y) => `<path d="M-12 ${y}q12 -8 24 0" stroke="#fcd34d" stroke-opacity=".55" stroke-width="2.2" fill="none"/>`).join('') + '<path d="M0 -18l-4 -6M0 -18l5 -5" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>',
    yarn: '<circle r="18" fill="#a855f7"/>' + [-10, -3, 4, 11].map((y) => `<path d="M-16 ${y}q16 -10 32 4" stroke="#e9d5ff" stroke-width="2" fill="none"/>`).join('') + '<path d="M14 10q10 8 4 16" stroke="#a855f7" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    sun: '<circle r="18" fill="#fbbf24"/>' + Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M${r1(Math.cos(a) * 9)} ${r1(Math.sin(a) * 9)}L${r1(Math.cos(a) * 15)} ${r1(Math.sin(a) * 15)}" stroke="#fff7ed" stroke-width="3" stroke-linecap="round"/>`; }).join('') + '<circle r="6" fill="#fde68a"/>',
    beach: '<circle r="18" fill="#ffffff"/><path d="M0 -18a18 18 0 0 1 15.6 9l-15.6 9z" fill="#ef4444"/><path d="M15.6 9a18 18 0 0 1 -31.2 0l15.6 -9z" fill="#3b82f6"/><path d="M-15.6 -9a18 18 0 0 1 15.6 -9v18z" fill="#facc15"/><circle r="4" fill="#ffffff"/>',
    bolt: '<circle r="18" fill="#1e3a8a"/><path d="M3 -14l-10 15h7l-4 13l12 -17h-7l4 -11z" fill="#fde047"/>',
    marble: '<circle r="18" fill="#14b8a6"/><path d="M-18 0l18 -18l18 18l-18 18z" fill="#5eead4" fill-opacity=".55"/><path d="M-9 -9l9 -9l9 9z" fill="#ffffff" fill-opacity=".5"/><circle cx="-7" cy="-8" r="4" fill="#ffffff" fill-opacity=".6"/>',
    star: '<circle r="18" fill="#f472b6"/><path d="M0 -11l3.2 6.6l7.3 1l-5.3 5.1l1.3 7.3l-6.5 -3.5l-6.5 3.5l1.3 -7.3l-5.3 -5.1l7.3 -1z" fill="#fef9c3"/><circle cx="-8" cy="-9" r="3" fill="#ffffff" fill-opacity=".5"/>',
    clover: '<circle r="18" fill="#22c55e"/>' + [0, 90, 180, 270].map((a) => `<circle cx="${r1(Math.cos(((a + 45) * Math.PI) / 180) * 5)}" cy="${r1(Math.sin(((a + 45) * Math.PI) / 180) * 5)}" r="5" fill="#f0fdf4"/>`).join('') + '<circle cx="-8" cy="-9" r="3" fill="#ffffff" fill-opacity=".45"/>'
};

function speciesOf(typeId) {
    return SPECIES[typeId] || SPECIES.cloverhop;
}

/** The snack station: base plus three bites (each a .fst-bite group the familiar eats). */
export function snackStationSvg(typeId) {
    const sp = speciesOf(typeId);
    const bites = sp.at.map(([x, y], i) => `<g class="fst-bite" data-bite="${i}" style="--i:${i}">${BITES[sp.bite](x, y)}</g>`).join('');
    // The bush and the clam hold their food in front; the rest on top.
    return `<svg class="fst-snack" viewBox="0 0 140 100" aria-hidden="true">${BASES[sp.base]}${bites}</svg>`;
}

/** The species' toy ball. */
export function toySvg(typeId) {
    // A white rim keeps every ball easy to spot on dark ground (a lava ball on ash, a snowball on snow).
    return `<svg class="fst-toy" viewBox="-22 -22 44 44" aria-hidden="true"><ellipse cx="0" cy="20" rx="15" ry="3.4" fill="#000" fill-opacity=".3"/><g class="fst-toy__ball"><circle r="19.6" fill="#ffffff" fill-opacity=".9"/>${TOYS[speciesOf(typeId).toy]}</g></svg>`;
}

/** Words a familiar uses: its voice word, its food and the food's icon. */
export function familiarWords(typeId) {
    const sp = speciesOf(typeId);
    return { sound: sp.sound, food: sp.food, foodIcon: sp.foodIcon };
}

export const STATION_BITES = 3;
