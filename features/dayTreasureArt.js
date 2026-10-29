// /features/dayTreasureArt.js
// Hand-drawn chests for Day Treasures (features/dayTreasure.js), one per kind of special day.
// Each drawing has a base (.dt-art__base), a lid that opens (.dt-art__lid) and a light that
// shines out when it does (.dt-art__light). Plain SVG paths: crisp on the projector, no images.

/** Which chest a special day gets. */
export function chestFamilyFor(special = {}) {
    const key = special.key || '';
    if (key === 'halloween') return 'spooky';
    if (key === 'st-patricks') return 'clover';
    if (special.art === 'hearts') return 'hearts';
    if (special.art === 'leaves' || key === 'thanksgiving') return 'harvest';
    if (special.theme === 'winter') return 'winter';
    if (special.theme === 'spring' || key === 'western-easter') return 'egg';
    if (['national', 'remembrance', 'dove', 'local'].includes(special.theme)) return 'laurel';
    if (['world-book-day', 'childrens-book-day', 'poetry-day', 'languages-day', 'greek-language-day', 'mother-language-day', 'three-hierarchs', 'teachers-day'].includes(key)
        || special.theme === 'letters') return 'book';
    return 'royal';
}

/** What each chest lets loose when it opens, besides the coins. */
export const FAMILY_FX = {
    royal: { beam: '#fde68a', burst: ['✨', '⭐', '💎', '✨'], label: 'Royal chest' },
    spooky: { beam: '#a3e635', burst: ['🦇', '🦇', '👻', '✨', '🍬'], label: 'Pumpkin chest' },
    harvest: { beam: '#fdba74', burst: ['🍂', '🍁', '🍎', '🌾'], label: 'Harvest basket' },
    winter: { beam: '#bae6fd', burst: ['❄️', '✨', '⭐', '❄️'], label: 'Gift box' },
    hearts: { beam: '#f9a8d4', burst: ['💗', '💖', '✨', '💕'], label: 'Heart casket' },
    clover: { beam: '#86efac', burst: ['☘️', '🍀', '✨', '🌈'], label: 'Pot of gold' },
    egg: { beam: '#fef08a', burst: ['🌸', '🐣', '🌷', '✨'], label: 'Golden egg' },
    laurel: { beam: '#bfdbfe', burst: ['🕊️', '⭐', '✨', '🌿'], label: 'Laurel chest' },
    book: { beam: '#ddd6fe', burst: ['✦', 'A', 'Ω', '✧', 'Β', '★'], label: 'Book of treasures' },
};

const INK = '#3b1d0a';
const stroke = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const ART = {
    royal: (icon) => `
        <g class="dt-art__base">
            <path d="M28 92 Q27 150 34 158 L166 158 Q173 150 172 92 Z" fill="url(#dtWood)" ${stroke()}/>
            <path d="M30 112 Q100 116 170 112 M31 134 Q100 138 169 134" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".35"/>
            <path d="M58 93 L58 158 M142 93 L142 158" fill="none" stroke="#f59e0b" stroke-width="9"/>
            <path d="M58 93 L58 158 M142 93 L142 158" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".5"/>
            <circle cx="58" cy="104" r="2.6" fill="${INK}"/><circle cx="58" cy="146" r="2.6" fill="${INK}"/><circle cx="142" cy="104" r="2.6" fill="${INK}"/><circle cx="142" cy="146" r="2.6" fill="${INK}"/>
            <path d="M84 96 h32 v26 q-16 10 -32 0 Z" fill="url(#dtGold)" ${stroke(2.5)}/>
            <path d="M100 104 v9" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="103" r="3.2" fill="${INK}"/>
        </g>
        <g class="dt-art__lid">
            <path d="M24 94 Q22 48 100 40 Q178 48 176 94 Z" fill="url(#dtWoodLight)" ${stroke()}/>
            <path d="M40 70 Q100 56 160 70" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/>
            <path d="M58 46 Q57 70 58 94 M142 46 Q143 70 142 94" fill="none" stroke="#f59e0b" stroke-width="9"/>
            <circle cx="100" cy="72" r="15" fill="url(#dtGold)" ${stroke(2.5)}/>
            <text x="100" y="79" text-anchor="middle" font-size="17">${icon}</text>
        </g>`,
    spooky: (icon) => `
        <g class="dt-art__base">
            <path d="M24 108 Q22 160 70 162 Q100 166 130 162 Q178 160 176 108 Q170 92 100 92 Q30 92 24 108 Z" fill="url(#dtPumpkin)" ${stroke()}/>
            <path d="M64 96 Q54 128 66 160 M100 94 Q98 128 100 164 M136 96 Q146 128 134 160" fill="none" stroke="${INK}" stroke-width="2" opacity=".45"/>
            <path class="dt-art__face" d="M58 118 l14 -10 l6 14 Z M142 118 l-14 -10 l-6 14 Z M66 138 q8 8 14 2 l6 6 l8 -6 l8 6 l8 -6 l6 4 q10 2 14 -8 q-34 14 -64 2 Z" fill="#fef08a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <g class="dt-art__lid">
            <path d="M30 98 Q34 66 100 62 Q166 66 170 98 Q100 108 30 98 Z" fill="url(#dtPumpkinTop)" ${stroke()}/>
            <path d="M94 64 Q92 44 100 34 Q108 30 110 38 Q104 46 106 64 Z" fill="#65a30d" ${stroke(2.5)}/>
            <path d="M108 50 Q128 36 142 48 Q126 58 108 52 Z" fill="#84cc16" ${stroke(2)}/>
            <path d="M112 44 q10 -14 20 -8" fill="none" stroke="${INK}" stroke-width="1.6"/>
            <text x="72" y="92" font-size="14" opacity=".9">${icon}</text>
        </g>`,
    harvest: (icon) => `
        <g class="dt-art__base">
            <path d="M26 96 L36 158 Q100 168 164 158 L174 96 Z" fill="url(#dtWicker)" ${stroke()}/>
            <path d="M32 112 L168 112 M34 128 L166 128 M36 144 L164 144" stroke="${INK}" stroke-width="1.6" opacity=".4"/>
            <path d="M50 98 l6 60 M76 98 l3 64 M100 98 v66 M124 98 l-3 64 M150 98 l-6 60" stroke="${INK}" stroke-width="1.3" opacity=".3"/>
            <path d="M20 96 Q100 104 180 96" fill="none" stroke="#a16207" stroke-width="7" stroke-linecap="round"/>
            <path d="M20 96 Q100 104 180 96" fill="none" ${stroke(2)}/>
        </g>
        <g class="dt-art__lid">
            <path d="M40 92 Q30 56 70 54 Q100 30 130 54 Q170 56 160 92 Z" fill="url(#dtWickerLight)" ${stroke()}/>
            <circle cx="70" cy="70" r="14" fill="#dc2626" ${stroke(2.5)}/><path d="M70 56 q2 -8 8 -10" fill="none" ${stroke(2)}/>
            <circle cx="128" cy="72" r="13" fill="#f59e0b" ${stroke(2.5)}/>
            <path d="M98 40 q-4 26 2 50 M98 46 l-10 -8 M99 56 l-11 -6 M100 66 l-10 -4 M98 46 l10 -8 M99 56 l11 -6 M100 66 l10 -4" fill="none" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>
            <text x="100" y="88" text-anchor="middle" font-size="14">${icon}</text>
        </g>`,
    winter: (icon) => `
        <g class="dt-art__base">
            <rect x="32" y="94" width="136" height="66" rx="6" fill="url(#dtRed)" ${stroke()}/>
            <path d="M92 94 h16 v66 h-16 Z" fill="url(#dtGold)" ${stroke(2.5)}/>
            <path d="M48 112 l4 4 m-4 0 l4 -4 M146 140 l4 4 m-4 0 l4 -4 M140 108 l3 3 m-3 0 l3 -3 M54 144 l3 3 m-3 0 l3 -3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
        </g>
        <g class="dt-art__lid">
            <rect x="24" y="76" width="152" height="22" rx="6" fill="url(#dtRedLight)" ${stroke()}/>
            <path d="M92 76 h16 v22 h-16 Z" fill="url(#dtGold)" ${stroke(2.5)}/>
            <path d="M100 76 Q70 44 60 60 Q56 76 100 76 Q130 44 140 60 Q144 76 100 76 Z" fill="url(#dtGold)" ${stroke(2.5)}/>
            <circle cx="100" cy="74" r="7" fill="#fde68a" ${stroke(2)}/>
            <text x="150" y="70" font-size="15">${icon}</text>
        </g>`,
    hearts: (icon) => `
        <g class="dt-art__base">
            <path d="M28 98 Q30 128 100 166 Q170 128 172 98 Z" fill="url(#dtPink)" ${stroke()}/>
            <path d="M40 110 Q60 136 100 156 Q140 136 160 110" fill="none" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/>
            <circle cx="100" cy="118" r="9" fill="url(#dtGold)" ${stroke(2)}/>
        </g>
        <g class="dt-art__lid">
            <path d="M28 98 Q20 52 62 50 Q90 50 100 72 Q110 50 138 50 Q180 52 172 98 Z" fill="url(#dtPinkLight)" ${stroke()}/>
            <path d="M44 74 Q50 60 64 60" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
            <text x="100" y="94" text-anchor="middle" font-size="16">${icon}</text>
        </g>`,
    clover: (icon) => `
        <g class="dt-art__rainbow" opacity="0">
            <path d="M10 150 Q100 -10 190 150" fill="none" stroke="#ef4444" stroke-width="7"/><path d="M20 150 Q100 6 180 150" fill="none" stroke="#f59e0b" stroke-width="7"/>
            <path d="M30 150 Q100 22 170 150" fill="none" stroke="#facc15" stroke-width="7"/><path d="M40 150 Q100 38 160 150" fill="none" stroke="#22c55e" stroke-width="7"/>
            <path d="M50 150 Q100 54 150 150" fill="none" stroke="#3b82f6" stroke-width="7"/>
        </g>
        <g class="dt-art__base">
            <path d="M34 102 Q24 160 70 164 L130 164 Q176 160 166 102 Z" fill="url(#dtIron)" ${stroke()}/>
            <path d="M28 100 Q100 112 172 100" fill="none" stroke="#475569" stroke-width="9" stroke-linecap="round"/>
            <path d="M28 100 Q100 112 172 100" fill="none" ${stroke(2)}/>
            <path d="M52 164 l-6 10 M148 164 l6 10" ${stroke(4)}/>
            <path d="M54 126 Q60 120 66 124" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>
        </g>
        <g class="dt-art__lid">
            <path d="M36 100 Q46 70 70 76 Q84 58 100 70 Q118 56 132 76 Q156 70 164 100 Z" fill="url(#dtGold)" ${stroke()}/>
            <circle cx="70" cy="88" r="7" fill="#fde68a" ${stroke(2)}/><circle cx="96" cy="80" r="7" fill="#fde68a" ${stroke(2)}/><circle cx="124" cy="88" r="7" fill="#fde68a" ${stroke(2)}/>
            <text x="100" y="70" text-anchor="middle" font-size="18">${icon}</text>
        </g>`,
    egg: (icon) => `
        <g class="dt-art__base">
            <path d="M36 106 Q34 166 100 166 Q166 166 164 106 L150 98 L136 110 L122 96 L108 110 L94 96 L80 110 L66 96 L52 110 Z" fill="url(#dtEgg)" ${stroke()}/>
            <path d="M44 132 Q100 146 156 132" fill="none" stroke="#be185d" stroke-width="5" stroke-linecap="round"/>
            <path d="M54 148 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g class="dt-art__lid">
            <path d="M36 106 Q40 34 100 30 Q160 34 164 106 L150 98 L136 110 L122 96 L108 110 L94 96 L80 110 L66 96 L52 110 Z" fill="url(#dtEggLight)" ${stroke()}/>
            <path d="M60 70 Q100 60 140 70" fill="none" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
            <path d="M66 52 Q74 42 86 40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
            <text x="100" y="94" text-anchor="middle" font-size="15">${icon}</text>
        </g>`,
    laurel: (icon) => `
        <g class="dt-art__base">
            <path d="M28 94 L32 160 L168 160 L172 94 Z" fill="url(#dtBlue)" ${stroke()}/>
            <path d="M32 118 h136 v14 h-136 Z" fill="#f8fafc" ${stroke(2)}/>
            <path d="M36 128 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6" fill="none" stroke="#1d4ed8" stroke-width="2"/>
            <rect x="88" y="96" width="24" height="18" rx="4" fill="url(#dtGold)" ${stroke(2)}/>
        </g>
        <g class="dt-art__lid">
            <path d="M24 96 Q24 60 100 54 Q176 60 176 96 Z" fill="url(#dtBlueLight)" ${stroke()}/>
            <path d="M74 82 Q76 62 98 58 M126 82 Q124 62 102 58" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
            <path d="M76 76 q-8 -2 -10 -8 q8 0 10 8 M80 66 q-8 -4 -8 -10 q8 2 8 10 M124 76 q8 -2 10 -8 q-8 0 -10 8 M120 66 q8 -4 8 -10 q-8 2 -8 10" fill="#22c55e" ${stroke(1.5)}/>
            <text x="100" y="86" text-anchor="middle" font-size="15">${icon}</text>
        </g>`,
    book: (icon) => `
        <g class="dt-art__base">
            <path d="M30 100 L100 112 L170 100 L170 160 L100 172 L30 160 Z" fill="#fef3c7" ${stroke()}/>
            <path d="M40 112 L92 120 M40 124 L92 132 M40 136 L92 144 M108 120 L160 112 M108 132 L160 124 M108 144 L160 136" stroke="#a16207" stroke-width="2" stroke-linecap="round" opacity=".55"/>
            <path d="M100 112 L100 172" ${stroke(2.5)}/>
        </g>
        <g class="dt-art__lid">
            <path d="M28 98 L100 110 L172 98 L172 152 L100 164 L28 152 Z" fill="url(#dtLeather)" ${stroke()}/>
            <path d="M40 106 L100 116 L160 106 L160 146 L100 156 L40 146 Z" fill="none" stroke="#fbbf24" stroke-width="3"/>
            <circle cx="100" cy="132" r="15" fill="url(#dtGold)" ${stroke(2.5)}/>
            <text x="100" y="138" text-anchor="middle" font-size="16">${icon}</text>
        </g>`,
};

const DEFS = `
    <defs>
        <linearGradient id="dtWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b45309"/><stop offset="1" stop-color="#78350f"/></linearGradient>
        <linearGradient id="dtWoodLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#92400e"/></linearGradient>
        <linearGradient id="dtGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset=".45" stop-color="#fcd34d"/><stop offset="1" stop-color="#d97706"/></linearGradient>
        <radialGradient id="dtPumpkin" cx=".45" cy=".35"><stop offset="0" stop-color="#fdba74"/><stop offset="1" stop-color="#c2410c"/></radialGradient>
        <linearGradient id="dtPumpkinTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#ea580c"/></linearGradient>
        <linearGradient id="dtWicker" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6a35a"/><stop offset="1" stop-color="#8a5a1f"/></linearGradient>
        <linearGradient id="dtWickerLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d39a"/><stop offset="1" stop-color="#b98238"/></linearGradient>
        <linearGradient id="dtRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/></linearGradient>
        <linearGradient id="dtRedLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>
        <linearGradient id="dtPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#9d174d"/></linearGradient>
        <linearGradient id="dtPinkLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#db2777"/></linearGradient>
        <radialGradient id="dtIron" cx=".4" cy=".3"><stop offset="0" stop-color="#64748b"/><stop offset="1" stop-color="#0f172a"/></radialGradient>
        <linearGradient id="dtEgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef9c3"/><stop offset=".5" stop-color="#fcd34d"/><stop offset="1" stop-color="#d97706"/></linearGradient>
        <linearGradient id="dtEggLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbeb"/><stop offset=".6" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
        <linearGradient id="dtBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
        <linearGradient id="dtBlueLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient id="dtLeather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#3b0764"/></linearGradient>
    </defs>`;

/** The chest drawing for a family, with the day's icon set in it. */
export function chestSvg(family, icon = '') {
    const draw = ART[family] || ART.royal;
    return `<svg class="dt-art dt-art--${family}" viewBox="0 0 200 180" aria-hidden="true">${DEFS}${draw(icon)}</svg>`;
}
