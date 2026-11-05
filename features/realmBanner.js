// /features/realmBanner.js — the Team Quest "realm arrival" banner.
// Plays over whatever is on screen (the projector included) when a class reaches the Silver
// Peaks, the Golden Citadel or the Crystal Realm for the first time this month.
// A little scene of its own: the realm's landscape rises, the class medallion flies along the
// road into it, the realm badge bursts open, the name rises letter by letter, the four-realm road
// fills to the new stop and the Map Journal stamp lands. Each realm has its own sky, landmark and
// weather (snow on the Peaks, gold dust over the Citadel, prism shards in the Crystal Realm).
// Loaded lazily by realmMoments.js (and the preview page); its CSS loads with it.
// Weak laptops (detectLowPowerTier) and reduced motion get the same card with a plain fade.
import { quietly } from '../utils/runtimeMetrics.js';
import { escapeHtml as esc } from '../utils/html.mjs';
import '../styles/realm_banner.css';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { REALM_STOPS, getRealmStop } from './realmMomentsCore.mjs';

const BADGES = {
    silver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

/** How long each banner stays (hovering holds it). */
export const REALM_BANNER_MS = { silver: 7000, gold: 7500, crystal: 8500 };

const LOOK = {
    silver: { kicker: 'has climbed to', weather: 14 },
    gold: { kicker: 'has marched into', weather: 12 },
    crystal: { kicker: 'has risen to', weather: 12 }
};

// The road's four stops, Bronze Meadows first (where every month starts).
const SHORT = { silver: 'Peaks', gold: 'Citadel', crystal: 'Crystal' };
const ROAD = [{ id: 'bronze', label: 'Meadows', icon: '🌾' }, ...REALM_STOPS.map((s) => ({ id: s.id, label: SHORT[s.id] || s.label, icon: s.icon }))];

// Landscapes drawn on a 320×160 stage, anchored to the bottom.
const SCENES = {
    silver: `
        <path class="rb-far" d="M0 118 L34 82 L58 98 L92 58 L120 86 L150 64 L178 92 L214 52 L246 84 L272 70 L320 104 V160 H0Z"/>
        <path class="rb-near" d="M0 140 L40 104 L66 120 L104 76 L132 106 L160 92 L196 122 L236 96 L268 116 L320 98 V160 H0Z"/>
        <path class="rb-snow" d="M104 76 L94 90 L101 88 L106 94 L112 87 L118 92 Z M236 96 L228 105 L234 104 L239 108 L244 104 Z M40 104 L33 112 L39 111 L43 115 L47 110Z"/>
        <path class="rb-road" d="M8 160 C 60 150, 70 132, 108 126 S 150 118, 104 96"/>`,
    gold: `
        <path class="rb-far" d="M0 122 C 60 104, 110 112, 160 106 S 260 100, 320 116 V160 H0Z"/>
        <g transform="translate(84 34) scale(0.7)"><g class="rb-keep">
            <path d="M118 112 V70 h10 v-8 h6 v8 h8 v-8 h6 v8 h8 v-8 h6 v8 h10 v42Z"/>
            <path d="M96 112 V58 l12 -16 l12 16 V112Z M200 112 V58 l12 -16 l12 16 V112Z"/>
            <path d="M150 70 V40 l10 -14 l10 14 V70Z"/>
            <path class="rb-window" d="M106 66 h4 v8 h-4Z M210 66 h4 v8 h-4Z M158 46 h4 v8 h-4Z M134 80 h4 v7 h-4Z M182 80 h4 v7 h-4Z"/>
            <path class="rb-flag" d="M108 42 V28 l12 4 l-12 4Z M212 42 V28 l12 4 l-12 4Z M160 26 V10 l14 5 l-14 5Z"/>
        </g>
        <g class="rb-gate"><path class="rb-light" d="M150 112 V96 a10 10 0 0 1 20 0 V112Z"/><path class="rb-door rb-door--l" d="M150 112 V96 a10 10 0 0 1 10 -10 V112Z"/><path class="rb-door rb-door--r" d="M170 112 V96 a10 10 0 0 0 -10 -10 V112Z"/></g></g>
        <path class="rb-near" d="M0 146 C 70 126, 110 120, 160 118 S 250 126, 320 138 V160 H0Z"/>
        <path class="rb-road" d="M10 160 C 70 150, 140 140, 196 113"/>`,
    crystal: `
        <path class="rb-far" d="M0 124 L28 98 L46 112 L80 88 L110 108 L140 96 L180 112 L214 90 L250 108 L284 94 L320 112 V160 H0Z"/>
        <g class="rb-spires" transform="translate(44 0)">
            <path class="rb-spire" d="M150 116 L160 28 L172 116Z"/>
            <path class="rb-spire rb-spire--b" d="M130 116 L140 58 L150 116Z"/>
            <path class="rb-spire rb-spire--b" d="M170 116 L182 50 L194 116Z"/>
            <path class="rb-spire rb-spire--c" d="M112 116 L118 82 L126 116Z"/>
            <path class="rb-spire rb-spire--c" d="M196 116 L204 76 L212 116Z"/>
            <path class="rb-facet" d="M160 28 L164 116 L172 116Z M182 50 L186 116 L194 116Z M140 58 L144 116 L150 116Z"/>
        </g>
        <path class="rb-near" d="M0 146 L46 126 L90 134 L160 116 L230 132 L280 124 L320 136 V160 H0Z"/>
        <path class="rb-road" d="M10 160 C 70 150, 150 142, 204 116"/>`
};

function titleHtml(label, lite) {
    if (lite) return esc(label);
    let k = 0;
    return label.split(' ').map((word) => `<span class="rb-word">${[...word].map((ch) => `<span class="rb-ch" style="--k:${k++}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
}

function weatherHtml(realmId, count) {
    return Array.from({ length: count }, (_, i) => {
        // Spread evenly with a little jitter, so every laptop draws the same pattern.
        const x = ((i + 0.5) / count) * 100 + (((i * 37) % 11) - 5);
        const delay = ((i * 0.53) % 2.4).toFixed(2);
        const size = 4 + ((i * 7) % 5);
        const dur = (2.6 + ((i * 13) % 9) / 6).toFixed(2);
        return `<i class="rb-mote" style="--x:${x.toFixed(1)}%;--d:${delay}s;--s:${size}px;--t:${dur}s;--w:${((i % 2) ? 1 : -1) * (6 + (i % 4) * 4)}px"></i>`;
    }).join('');
}

function roadHtml(realmId) {
    const at = ROAD.findIndex((s) => s.id === realmId);
    const fill = (at / (ROAD.length - 1)) * 100;
    const from = ((Math.max(0, at - 1)) / (ROAD.length - 1)) * 100;
    const stops = ROAD.map((stop, i) => {
        const cls = i < at ? ' is-done' : i === at ? ' is-new' : '';
        return `<li class="rb-stop${cls}" style="--p:${(i / (ROAD.length - 1)) * 100}%"><b>${stop.icon}</b><span>${esc(stop.label)}</span></li>`;
    }).join('');
    return `
        <div class="rb-road-track" style="--from:${(from / 100).toFixed(3)};--to:${(fill / 100).toFixed(3)}">
            <span class="rb-road-line"><span class="rb-road-fill"></span></span>
            <ol>${stops}</ol>
        </div>`;
}

/** The banner's markup (also used by the preview page). `pct` is the class's monthly progress. */
export function realmBannerHtml(classData, realmId, { lite = false, pct = null } = {}) {
    const stop = getRealmStop(realmId);
    if (!stop) return '';
    const look = LOOK[stop.id];
    const sparks = lite ? '' : Array.from({ length: 12 }, (_, i) => `<i class="rb-spark" style="--i:${i}"></i>`).join('');
    const pctLine = Number.isFinite(Number(pct)) && pct !== null
        ? `<span class="rb-pct"><i class="fas fa-star" aria-hidden="true"></i>${Math.floor(Number(pct))}% of this month's goal</span>`
        : '';
    const name = classData?.name || 'Our class';
    return `
        <div class="rb-banner rb--${stop.id}${lite ? ' rb--lite' : ''}" role="status" aria-live="polite" tabindex="-1"
             aria-label="${esc(name)} ${esc(look.kicker)} ${esc(stop.named)}. ${esc(stop.cheer)}">
            <span class="rb-sky" aria-hidden="true"></span>
            <span class="rb-vista" aria-hidden="true">
                <span class="rb-glow"></span>
                ${lite ? '' : '<span class="rb-rays"></span>'}
                <svg class="rb-scene" viewBox="0 0 320 160" preserveAspectRatio="xMidYMax slice" focusable="false">${SCENES[stop.id]}</svg>
                <span class="rb-badge-wrap">
                    <span class="rb-ring"></span>
                    <img class="rb-badge" src="${BADGES[stop.id]}" alt="" draggable="false" decoding="async">
                    ${sparks}
                </span>
                <span class="rb-flyer"><span class="rb-medal"><b>${esc(classData?.logo || '📚')}</b></span></span>
                ${lite ? '' : `<span class="rb-weather">${weatherHtml(stop.id, look.weather)}</span>`}
            </span>
            <span class="rb-copy">
                <small class="rb-kicker"><span class="rb-logo" aria-hidden="true">${esc(classData?.logo || '📚')}</span><span class="rb-name">${esc(name)}</span> ${esc(look.kicker)}</small>
                <strong class="rb-title" aria-hidden="true">${titleHtml(stop.label, lite)}</strong>
                <em class="rb-cheer">${esc(stop.cheer)}</em>
                <span class="rb-foot">${roadHtml(stop.id)}${pctLine}</span>
            </span>
            <span class="rb-stamp" aria-hidden="true"><b>${stop.icon}</b><span>Map Journal</span></span>
            <button type="button" class="rb-close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <span class="rb-timer" aria-hidden="true"></span>
        </div>`;
}

/**
 * Shows one banner now. Resolves when it has gone. Hovering holds it; a tap or Esc closes it.
 * `opts.pct` adds the month's progress line; `opts.lite` overrides the device check (preview).
 */
export function showRealmBanner(classData, realmId, opts = {}) {
    return new Promise((resolve) => {
        const stop = getRealmStop(realmId);
        if (!stop) { resolve(); return; }
        const lite = typeof opts.lite === 'boolean' ? opts.lite : detectLowPowerTier();
        const ms = REALM_BANNER_MS[stop.id] || 7000;
        const host = document.createElement('div');
        host.className = 'rm-host rb-host';
        host.innerHTML = realmBannerHtml(classData, realmId, { lite, pct: opts.pct ?? null });
        const banner = host.firstElementChild;
        banner.style.setProperty('--rb-life', `${ms}ms`);
        let timer = null;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey);
            banner.classList.add('is-leaving');
            setTimeout(() => { host.remove(); resolve(); }, 450);
        };
        const arm = (wait) => { clearTimeout(timer); timer = setTimeout(finish, wait); };
        const onKey = (event) => { if (event.key === 'Escape') finish(); };
        banner.addEventListener('click', finish);
        banner.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'touch') return;
            clearTimeout(timer);
            banner.classList.add('is-held');
        });
        banner.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'touch' || done) return;
            banner.classList.remove('is-held');
            // The timer line runs again from full, for the last three seconds.
            const line = banner.querySelector('.rb-timer');
            if (line) {
                line.style.animation = 'none';
                void line.offsetWidth;
                line.style.animation = 'rb-timer 3000ms linear both';
            }
            arm(3000);
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(host);
        import('../audio.js')
            .then((audio) => (audio.playRealmSfx ? audio.playRealmSfx(stop.id) : audio.playSound(stop.id === 'crystal' ? 'hero_fanfare' : 'star3')))
            .catch(quietly('features/realmBanner.js'));
        arm(ms);
    });
}
