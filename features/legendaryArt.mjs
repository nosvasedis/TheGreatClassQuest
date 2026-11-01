// features/legendaryArt.mjs — hand-drawn SVG art for the Legendary Artifacts (pure, no DOM).
// One drawing per artifact on a 64×64 board; each relic family shares a halo colour so the
// variants of one relic read as siblings on the shelf, in the Trophy Room and in the parcel.

let seq = 0;
const uid = () => `lg${(seq += 1).toString(36)}`;

/** A soft four-point twinkle. */
function twinkle(x, y, r, fill = '#fff7d6', opacity = 0.95) {
    return `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${fill}" opacity="${opacity}"/>`;
}

/** Five-point star polygon. */
function star(cx, cy, R, r, rot = -90) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
        const rad = ((rot + i * 36) * Math.PI) / 180;
        const len = i % 2 === 0 ? R : r;
        pts.push(`${(cx + len * Math.cos(rad)).toFixed(1)},${(cy + len * Math.sin(rad)).toFixed(1)}`);
    }
    return pts.join(' ');
}

function heartPath(cx, top, w) {
    const s = w / 40;
    const p = (x, y) => `${(cx + x * s).toFixed(1)} ${(top + y * s).toFixed(1)}`;
    return `M${p(0, 30)}C${p(-20, 18)} ${p(-20, 2)} ${p(-10, -1)}C${p(-5, -2.5)} ${p(-1, 1)} ${p(0, 4)}C${p(1, 1)} ${p(5, -2.5)} ${p(10, -1)}C${p(20, 2)} ${p(20, 18)} ${p(0, 30)}Z`;
}

const HALO = {
    purse: ['#fcd34d', '#f59e0b'],
    guild: ['#fca5a5', '#dc2626'],
    wayfinder: ['#99f6e4', '#0d9488'],
    story: ['#ddd6fe', '#7c3aed'],
    heart: ['#fecdd3', '#e11d48'],
};

function halo(u, family) {
    const [inner, outer] = HALO[family] || HALO.purse;
    return `<defs><radialGradient id="${u}h" cx="50%" cy="46%" r="50%"><stop offset="0" stop-color="${inner}" stop-opacity=".75"/><stop offset=".55" stop-color="${outer}" stop-opacity=".22"/><stop offset="1" stop-color="${outer}" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="31" r="31" fill="url(#${u}h)"/>`;
}

const GOLD = (u, id = 'g') => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#f6c343"/><stop offset="1" stop-color="#b7791f"/></linearGradient>`;

const DRAW = {
    // ── Fortune's Purse ───────────────────────────────────────────────
    leg_gilded: (u) => `${halo(u, 'purse')}
        <defs>${GOLD(u)}<linearGradient id="${u}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9d3a4"/><stop offset=".5" stop-color="#fbf0d4"/><stop offset="1" stop-color="#e3c58f"/></linearGradient></defs>
        <rect x="17" y="13" width="30" height="38" rx="1.5" fill="url(#${u}p)" stroke="#a0763a" stroke-width="1"/>
        <path d="M21 42h22M21 46h16" stroke="#c9a96b" stroke-width="1.4" stroke-linecap="round"/>
        <rect x="13" y="8" width="38" height="8" rx="4" fill="#c08a3e" stroke="#7c5221" stroke-width="1"/>
        <rect x="13" y="48" width="38" height="8" rx="4" fill="#c08a3e" stroke="#7c5221" stroke-width="1"/>
        <path d="M15 10.5h34M15 50.5h34" stroke="#e8b96a" stroke-width="1.2" stroke-linecap="round"/>
        <polygon points="${star(32, 29, 11, 4.6)}" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1" stroke-linejoin="round"/>
        <circle cx="49" cy="52" r="6" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1"/><circle cx="49" cy="52" r="3.4" fill="none" stroke="#b7791f" stroke-width=".9"/>
        <circle cx="42" cy="56" r="4.6" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1"/>
        ${twinkle(46, 18, 3.4)}${twinkle(19, 30, 2.4)}`,

    leg_aurum_silver: (u) => pouch(u, {
        body: ['#f1f5f9', '#94a3b8', '#475569'], cord: '#64748b', tag: '25%', coins: 1,
    }),

    leg_aurum: (u) => pouch(u, {
        body: ['#fde68a', '#d97706', '#78350f'], cord: '#7c2d12', tag: '50%', coins: 3,
    }),

    leg_bulwark: (u) => {
        let wedges = '';
        for (let i = 0; i < 8; i += 1) {
            const a1 = ((i * 45 - 90) * Math.PI) / 180;
            const a2 = (((i + 1) * 45 - 90) * Math.PI) / 180;
            const x1 = (32 + 17 * Math.cos(a1)).toFixed(1); const y1 = (30 + 17 * Math.sin(a1)).toFixed(1);
            const x2 = (32 + 17 * Math.cos(a2)).toFixed(1); const y2 = (30 + 17 * Math.sin(a2)).toFixed(1);
            wedges += `<path d="M32 30L${x1} ${y1}A17 17 0 0 1 ${x2} ${y2}Z" fill="${i % 2 ? '#fff4cf' : `url(#${u}g)`}"/>`;
        }
        const leaf = (dx, dy) => `<circle cx="${32 + dx}" cy="${30 + dy}" r="2.6" fill="#22c55e" stroke="#14532d" stroke-width=".7"/>`;
        return `${halo(u, 'purse')}<defs>${GOLD(u)}</defs>
            <path d="M24 56l8-10 8 10z" fill="#8b5a2b" stroke="#5b3714" stroke-width="1" stroke-linejoin="round"/>
            <rect x="20" y="54" width="24" height="5" rx="2" fill="#a16207" stroke="#5b3714" stroke-width="1"/>
            <circle cx="32" cy="30" r="20" fill="#b7791f" stroke="#7c4a0f" stroke-width="1.2"/>
            ${wedges}
            <circle cx="32" cy="30" r="17" fill="none" stroke="#9a6416" stroke-width="1"/>
            ${[0, 45, 90, 135, 180, 225, 270, 315].map((d) => { const a = (d * Math.PI) / 180; return `<circle cx="${(32 + 18.6 * Math.cos(a)).toFixed(1)}" cy="${(30 + 18.6 * Math.sin(a)).toFixed(1)}" r="1.1" fill="#fff7d6"/>`; }).join('')}
            <circle cx="32" cy="30" r="6.5" fill="#fef3c7" stroke="#9a6416" stroke-width="1"/>
            ${leaf(0, -2.6)}${leaf(2.6, 0)}${leaf(0, 2.6)}${leaf(-2.6, 0)}
            <path d="M32 30l2 5" stroke="#14532d" stroke-width=".9" stroke-linecap="round"/>
            <path d="M28 6h8l-4 7z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1" stroke-linejoin="round"/>
            ${twinkle(52, 12, 3.2)}${twinkle(11, 44, 2.4)}`;
    },

    // ── The Guild Standard ────────────────────────────────────────────
    leg_glory_banner: (u) => `${halo(u, 'guild')}
        <defs>${GOLD(u)}<linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#991b1b"/></linearGradient></defs>
        <rect x="18.5" y="9" width="3" height="50" rx="1.5" fill="#7c4a1e" stroke="#4a2a0c" stroke-width=".8"/>
        <circle cx="20" cy="8" r="3.4" fill="url(#${u}g)" stroke="#9a6416" stroke-width=".9"/>
        <path d="M21.5 13C32 14 42 17 54 23C42 27 32 31 21.5 34Z" fill="url(#${u}r)" stroke="#f6c343" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M24 18C32 19.5 38 21 44 23" stroke="#fecaca" stroke-width="1" stroke-linecap="round" opacity=".6"/>
        <polygon points="${star(31, 23.5, 4.6, 2)}" fill="#fff1a8" stroke="#b7791f" stroke-width=".6"/>
        <path d="M15 59h11" stroke="#4a2a0c" stroke-width="2.4" stroke-linecap="round"/>
        ${twinkle(52, 12, 3)}${twinkle(46, 40, 2.4)}`,

    leg_glory_chalice: (u) => `${halo(u, 'guild')}
        <defs>${GOLD(u)}<linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset="1" stop-color="#9f1239"/></linearGradient></defs>
        <path d="M24 11c3 -4 6 -2 8 -6c2 4 5 2 8 6" fill="none" stroke="#fde68a" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>
        <path d="M16 15H48Q48 36 32 38Q16 36 16 15Z" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1.2" stroke-linejoin="round"/>
        <ellipse cx="32" cy="15.5" rx="15.4" ry="3.6" fill="url(#${u}w)" stroke="#9a6416" stroke-width="1"/>
        <path d="M20 20Q21 31 29 34" fill="none" stroke="#fff7d6" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
        <circle cx="32" cy="26" r="3.6" fill="#dc2626" stroke="#7f1d1d" stroke-width=".9"/><circle cx="31" cy="25" r="1.1" fill="#fecaca"/>
        <circle cx="24.5" cy="25" r="1.6" fill="#60a5fa" stroke="#1e3a8a" stroke-width=".6"/><circle cx="39.5" cy="25" r="1.6" fill="#34d399" stroke="#065f46" stroke-width=".6"/>
        <rect x="29.5" y="37" width="5" height="11" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1"/>
        <ellipse cx="32" cy="42" rx="4.4" ry="1.8" fill="#f6c343" stroke="#9a6416" stroke-width=".8"/>
        <path d="M19 55Q32 46 45 55Z" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1.1" stroke-linejoin="round"/>
        <rect x="18" y="54" width="28" height="4" rx="2" fill="#d69e2e" stroke="#9a6416" stroke-width="1"/>
        ${twinkle(12, 14, 3)}${twinkle(53, 20, 2.6)}${twinkle(50, 44, 2)}`,

    leg_glory_crown: (u) => `${halo(u, 'guild')}
        <defs>${GOLD(u)}<linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>
        <rect x="16" y="10" width="3" height="50" rx="1.5" fill="#7c4a1e" stroke="#4a2a0c" stroke-width=".8"/>
        <rect x="14" y="13" width="36" height="3" rx="1.5" fill="url(#${u}g)" stroke="#9a6416" stroke-width=".8"/>
        <path d="M19 16H48V48L33.5 40L19 48Z" fill="url(#${u}r)" stroke="#f6c343" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M22 19H45V43.5L33.5 37.3L22 43.5Z" fill="none" stroke="#fbbf24" stroke-width=".8" opacity=".75"/>
        <path d="M26 22h15v8c0 5-3.5 7.5-7.5 9c-4-1.5-7.5-4-7.5-9z" fill="#1e3a8a" stroke="#f6c343" stroke-width="1.1"/>
        <polygon points="${star(33.5, 29.5, 4.4, 1.9)}" fill="#fff1a8"/>
        <path d="M11 9l2.5-5 3 3.5 2-4.5 2 4.5 3-3.5 2.5 5z" fill="url(#${u}g)" stroke="#9a6416" stroke-width=".9" stroke-linejoin="round"/>
        <circle cx="17.5" cy="6.6" r=".9" fill="#dc2626"/>
        <path d="M13 60h10" stroke="#4a2a0c" stroke-width="2.4" stroke-linecap="round"/>
        ${twinkle(54, 10, 3.2)}${twinkle(54, 52, 2.4)}`,

    // ── The Wayfinder's Kit ───────────────────────────────────────────
    leg_hourglass: (u) => `${halo(u, 'wayfinder')}
        <defs>${GOLD(u)}<linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs>
        <path d="M22 13H42Q42 26 33.5 32Q42 38 42 51H22Q22 38 30.5 32Q22 26 22 13Z" fill="#ccfbf1" fill-opacity=".55" stroke="#5eead4" stroke-width="1.2"/>
        <path d="M25 20H39Q37.5 26 32 29.5Q26.5 26 25 20Z" fill="url(#${u}s)"/>
        <path d="M32 29.5V48" stroke="#f59e0b" stroke-width="1.1" stroke-dasharray="1.6 1.4"/>
        <path d="M23.5 51Q32 40 40.5 51Z" fill="url(#${u}s)"/>
        <path d="M25 15Q25 24 30 29" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>
        <rect x="15" y="8" width="34" height="5.5" rx="2.2" fill="url(#${u}g)" stroke="#7c4a0f" stroke-width="1"/>
        <rect x="15" y="50.5" width="34" height="5.5" rx="2.2" fill="url(#${u}g)" stroke="#7c4a0f" stroke-width="1"/>
        <rect x="17" y="13.5" width="3" height="37" rx="1.2" fill="#0f766e" stroke="#134e4a" stroke-width=".7"/>
        <rect x="44" y="13.5" width="3" height="37" rx="1.2" fill="#0f766e" stroke="#134e4a" stroke-width=".7"/>
        <circle cx="18.5" cy="32" r="1.6" fill="#f6c343"/><circle cx="45.5" cy="32" r="1.6" fill="#f6c343"/>
        <rect x="48" y="17" width="13" height="9" rx="4.5" fill="#0f766e" stroke="#5eead4" stroke-width="1"/>
        <text x="54.5" y="23.8" text-anchor="middle" font-size="6.4" font-weight="800" font-family="system-ui,sans-serif" fill="#f0fdfa">+5</text>
        ${twinkle(9, 20, 2.6)}${twinkle(55, 44, 2.4)}`,

    leg_pathfinder: (u) => `${halo(u, 'wayfinder')}
        <path d="M9 17L23 13V51L9 55Z" fill="#f3e3bd" stroke="#8a6a3a" stroke-width="1" stroke-linejoin="round"/>
        <path d="M23 13L41 17V55L23 51Z" fill="#e7d2a2" stroke="#8a6a3a" stroke-width="1" stroke-linejoin="round"/>
        <path d="M41 17L55 13V51L41 55Z" fill="#f3e3bd" stroke="#8a6a3a" stroke-width="1" stroke-linejoin="round"/>
        <path d="M12 46l4-7 4 7zM16 46l3-5 3 5z" fill="#a8a29e" stroke="#57534e" stroke-width=".7" stroke-linejoin="round"/>
        <path d="M29 22c3 0 4 3 7 2" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="28" cy="40" r="3" fill="#4ade80" stroke="#166534" stroke-width=".7"/><circle cx="32" cy="43" r="2.4" fill="#4ade80" stroke="#166534" stroke-width=".7"/>
        <path d="M14 50C20 44 22 36 30 33S44 28 47 21" fill="none" stroke="#b91c1c" stroke-width="1.6" stroke-dasharray="2.4 2" stroke-linecap="round"/>
        <path d="M44.5 17.5l5 5M49.5 17.5l-5 5" stroke="#b91c1c" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="48" cy="44" r="5.5" fill="#fff8e7" stroke="#0f766e" stroke-width="1"/>
        <path d="M48 38.8l1.4 5.2L48 49.2l-1.4-5.2z" fill="#0f766e"/><path d="M48 38.8l1.4 5.2h-2.8z" fill="#dc2626"/>
        ${twinkle(56, 8, 3)}${twinkle(8, 10, 2.2)}`,

    // ── The Storyteller's Relics ──────────────────────────────────────
    leg_quill: (u) => `${halo(u, 'story')}
        <defs><linearGradient id="${u}f" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a78bfa"/><stop offset=".6" stop-color="#ede9fe"/><stop offset="1" stop-color="#fff"/></linearGradient><linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d28d9"/><stop offset="1" stop-color="#2e1065"/></linearGradient></defs>
        <path d="M29 43C31 30 40 15 55 6C53 18 45 33 33 45Z" fill="url(#${u}f)" stroke="#6d28d9" stroke-width="1" stroke-linejoin="round"/>
        <path d="M31 44C37 32 45 19 54 8" fill="none" stroke="#5b21b6" stroke-width="1" stroke-linecap="round"/>
        <path d="M35 34l-3.5-1.5M38.5 28l-3.5-1.5M42 22.5l-3-1.5M41 31l3 .5M45 25l3 .5M48.5 19l2.5 .5" stroke="#8b5cf6" stroke-width=".8" stroke-linecap="round"/>
        <path d="M15 40h20l2 3v13a2 2 0 0 1 -2 2H15a2 2 0 0 1 -2 -2V43z" fill="url(#${u}b)" stroke="#1e1b4b" stroke-width="1" stroke-linejoin="round"/>
        <rect x="17" y="36" width="16" height="5" rx="1.5" fill="#c4b5fd" stroke="#4c1d95" stroke-width=".9"/>
        <path d="M17 48h16" stroke="#f6c343" stroke-width="1.4"/>
        <path d="M18 44v10" stroke="#a78bfa" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
        <path d="M44 50q2 3 0 5q-2 -2 0 -5z" fill="#4c1d95"/>
        ${twinkle(12, 14, 3)}${twinkle(56, 30, 2.4)}`,

    leg_protagonist: (u) => `${halo(u, 'story')}
        <defs>${GOLD(u)}</defs>
        <path d="M13 26C9 30 7 38 10 44M51 26C55 30 57 38 54 44" fill="none" stroke="#7c3aed" stroke-width="3" stroke-linecap="round"/>
        <path d="M10 44l-3 6M10 44l3 6M54 44l-3 6M54 44l3 6" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>
        <path d="M13 20Q32 11 51 20Q54 40 32 53Q10 40 13 20Z" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M16 23Q32 15 48 23" fill="none" stroke="#fff7d6" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>
        <path d="M18 30Q23 25 28 30Q23 34 18 30Z" fill="#2e1065"/>
        <path d="M36 30Q41 25 46 30Q41 34 36 30Z" fill="#2e1065"/>
        <path d="M17 27.5Q23 23 29 27.5M35 27.5Q41 23 47 27.5" fill="none" stroke="#7c3aed" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M25 41Q32 47 39 41" fill="none" stroke="#7c4a0f" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M32 33v4" stroke="#b7791f" stroke-width="1.2" stroke-linecap="round"/>
        <polygon points="${star(32, 19.5, 4.4, 1.9)}" fill="#a855f7" stroke="#fff1a8" stroke-width=".8"/>
        ${twinkle(54, 10, 3.2)}${twinkle(9, 12, 2.4)}`,

    // ── The Hero's Heart ──────────────────────────────────────────────
    leg_kindness: (u) => `${halo(u, 'heart')}
        <defs>${GOLD(u)}<linearGradient id="${u}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fda4af"/><stop offset="1" stop-color="#be123c"/></linearGradient></defs>
        <path d="M14 5Q32 26 50 5" fill="none" stroke="#f6c343" stroke-width="1.6" stroke-dasharray="2.2 1.4" stroke-linecap="round"/>
        <circle cx="32" cy="17.5" r="3.2" fill="none" stroke="url(#${u}g)" stroke-width="2"/>
        <path d="${heartPath(32, 23, 40)}" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1.1"/>
        <path d="${heartPath(32, 26.5, 31)}" fill="url(#${u}k)"/>
        <path d="M22 31Q22 27 26 26.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>
        <path d="${heartPath(32, 33, 11)}" fill="#fff1f2" opacity=".9"/>
        ${twinkle(11, 30, 2.6)}${twinkle(53, 26, 3)}${twinkle(49, 52, 2.2)}`,

    leg_compassion: (u) => `${halo(u, 'heart')}
        <defs>${GOLD(u)}</defs>
        <path d="M16 27C10 21 4 20 1.5 22C5 24 5.5 26 3 28.5C7 29 8.5 31 6 34C10 34 12 36 11.5 39C14 38 15.5 37 16 35Z" fill="#fff1f2" stroke="#fb7185" stroke-width="1" stroke-linejoin="round"/>
        <path d="M48 27 C54 21 60 20 62.5 22 C59 24 58.5 26 61 28.5 C57 29 55.5 31 58 34 C54 34 52 36 52.5 39 C50 38 48.5 37 48 35 Z" fill="#fff1f2" stroke="#fb7185" stroke-width="1" stroke-linejoin="round"/>
        <path d="M14 27.5L6 25M14 31L8 31M14 34.5L10 36.5M50 27.5L58 25M50 31L56 31M50 34.5L54 36.5" stroke="#fda4af" stroke-width=".9" stroke-linecap="round"/>
        <circle cx="32" cy="34" r="19" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1.3"/>
        <circle cx="32" cy="34" r="15" fill="none" stroke="#b7791f" stroke-width="1" stroke-dasharray="1.5 1.8"/>
        <path d="${heartPath(32, 28, 20)}" fill="#e11d48" stroke="#881337" stroke-width=".9"/>
        <path d="M25.5 30.5Q26 28.5 28 28.3" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
        <path d="M18 26Q24 18 34 17" fill="none" stroke="#fff7d6" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
        ${twinkle(52, 50, 3)}${twinkle(11, 46, 2.4)}`,
};

/** Drawstring pouch shared by the Silver and Aurum Satchels. */
function pouch(u, { body, cord, tag, coins }) {
    const [hi, mid, lo] = body;
    const coin = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${u}g)" stroke="#9a6416" stroke-width=".9"/><circle cx="${x}" cy="${y}" r="${(r * 0.55).toFixed(1)}" fill="none" stroke="#b7791f" stroke-width=".7"/>`;
    const spill = [coin(50, 54, 5), coin(43, 58, 4), coin(55, 46, 3.6)].slice(0, coins).join('');
    return `${halo(u, 'purse')}
        <defs>${GOLD(u)}<radialGradient id="${u}m" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
        <path d="M23 23C13 30 11 45 17 52C23 58 41 58 47 52C53 45 51 30 41 23Z" fill="url(#${u}m)" stroke="${lo}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M21 17L16 9Q24 13 32 10Q40 13 48 9L43 17Z" fill="url(#${u}m)" stroke="${lo}" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M21 17Q32 14 43 17L41 23Q32 26 23 23Z" fill="${mid}" stroke="${lo}" stroke-width="1"/>
        <path d="M20 20Q32 25 44 20" fill="none" stroke="${cord}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M43 20.5Q47 26 45 31" fill="none" stroke="${cord}" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M40 31h10l3 3.5-3 3.5H40z" fill="#fbf0d4" stroke="#8a6a3a" stroke-width=".9" stroke-linejoin="round"/>
        <text x="45" y="36.3" text-anchor="middle" font-size="5.6" font-weight="800" font-family="system-ui,sans-serif" fill="#7c2d12">${tag}</text>
        <circle cx="29" cy="41" r="6.4" fill="url(#${u}g)" stroke="#9a6416" stroke-width="1"/>
        <polygon points="${star(29, 41.3, 4, 1.7)}" fill="#fff7d6" stroke="#9a6416" stroke-width=".6"/>
        <path d="M18 34Q17 44 22 50" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
        ${spill}${twinkle(12, 16, 3)}${twinkle(54, 14, 2.4)}`;
}

/** True when this artifact id has drawn art. */
export function hasLegendaryArt(id) {
    return Object.prototype.hasOwnProperty.call(DRAW, String(id || ''));
}

/** The artifact's SVG, or '' for retired artifacts (they keep their emoji). */
export function legendaryArtSvg(id, { className = 'lg-art', title = '' } = {}) {
    const draw = DRAW[String(id || '')];
    if (!draw) return '';
    const u = uid();
    const label = title ? `<title>${String(title).replace(/[<&>"]/g, '')}</title>` : '';
    return `<svg class="${className}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${label}${draw(u)}</svg>`;
}
