// ui/modals/occasionCelebration.js
// Birthday and name-day bonus popups: a birthday cake whose candles the class blows out,
// and an Aegean name-day card with an olive wreath and "Χρόνια πολλά!".
// No Firebase here; the caller passes what happens on "gift" and how to close.
import { playOccasionSfx } from '../../audio.js';
import '../../styles/occasion_celebration.css';

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 1.5 -> "1½", 2.5 -> "2½", 2 -> "2". */
function starAmount(amount) {
    const n = Math.round((Number(amount) || 0) * 2) / 2;
    const whole = Math.floor(n);
    if (n - whole < 0.5) return String(whole);
    return whole ? `${whole}½` : '½';
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'our hero';

const BUNTING = ['#f472b6', '#facc15', '#38bdf8', '#a78bfa', '#4ade80', '#fb923c'];

function birthdayArt(name) {
    const piped = esc(firstName(name));
    const squeeze = firstName(name).length > 8 ? ' textLength="104" lengthAdjust="spacingAndGlyphs"' : '';
    const candles = [74, 100, 126].map((x, i) => `
        <g class="occ-candle" style="--i:${i}">
            <rect x="${x - 4}" y="34" width="8" height="30" rx="2.5" fill="url(#occ-candle-${i % 2 ? 'b' : 'a'})"/>
            <path d="M${x} 34v-5" stroke="#3b2a1a" stroke-width="1.4" stroke-linecap="round"/>
            <g class="occ-flame" transform="translate(${x} 27)">
                <ellipse class="occ-flame__halo" rx="13" ry="15" fill="url(#occ-flame-halo)"/>
                <path class="occ-flame__body" d="M0-13C4-7 6-3 6 1a6 6 0 0 1-12 0C-6-3-4-7 0-13z" fill="url(#occ-flame-fill)"/>
                <path d="M0-5c1.6 2.4 2.4 4 2.4 5.6a2.4 2.4 0 0 1-4.8 0C-2.4-1-1.6-2.6 0-5z" fill="#fff8d6"/>
            </g>
            <g class="occ-smoke" transform="translate(${x} 22)">
                <path d="M0 0c-4-5 4-8 0-13s4-8 0-13" fill="none" stroke="#e9d5ff" stroke-width="2.4" stroke-linecap="round"/>
            </g>
        </g>`).join('');
    const sprinkles = [[44, 118, '#facc15', 20], [62, 138, '#38bdf8', -30], [148, 122, '#4ade80', 40], [156, 140, '#fde68a', -10],
        [130, 142, '#a78bfa', 25], [70, 84, '#f472b6', -35], [128, 86, '#38bdf8', 15], [112, 96, '#facc15', -20], [86, 96, '#4ade80', 30]]
        .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="7" height="2.6" rx="1.3" fill="${c}" transform="rotate(${r} ${x + 3.5} ${y + 1.3})"/>`).join('');
    return `
    <svg class="occ-cake" viewBox="0 0 200 172" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="occ-tier-low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb7ab6"/><stop offset="1" stop-color="#db2777"/></linearGradient>
            <linearGradient id="occ-tier-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
            <linearGradient id="occ-candle-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fef3c7"/><stop offset="0.5" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
            <linearGradient id="occ-candle-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0f2fe"/><stop offset="0.5" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
            <radialGradient id="occ-flame-halo"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
            <linearGradient id="occ-flame-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff7a18"/></linearGradient>
            <radialGradient id="occ-cake-glow" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="#ffe7a8" stop-opacity="0.75"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>
        </defs>
        <ellipse class="occ-cake__glow" cx="100" cy="70" rx="96" ry="72" fill="url(#occ-cake-glow)"/>
        <ellipse cx="100" cy="160" rx="84" ry="9" fill="#2a0b33" opacity="0.35"/>
        <path d="M20 152h160l-10 9H30z" fill="#f5f0ff"/>
        <rect x="16" y="148" width="168" height="6" rx="3" fill="#ffffff"/>
        <rect x="30" y="100" width="140" height="50" rx="10" fill="url(#occ-tier-low)"/>
        <path d="M30 110c0-6 4-10 10-10h120c6 0 10 4 10 10v4c-5 0-6 8-11 8s-6-11-12-11-5 15-11 15-6-12-12-12-5 9-11 9-6-13-12-13-5 10-11 10-6-9-12-9-5 13-11 13-6-12-12-12-5 8-11 8-6-6-6-6z" fill="#fff5fb"/>
        <text class="occ-cake__name" x="100" y="141" text-anchor="middle"${squeeze}>${piped}</text>
        <rect x="56" y="62" width="88" height="40" rx="9" fill="url(#occ-tier-top)"/>
        <path d="M56 71c0-5 4-9 9-9h70c5 0 9 4 9 9v2c-4 0-5 7-9 7s-5-9-10-9-4 12-9 12-5-10-10-10-4 7-9 7-5-11-10-11-4 9-9 9-5-7-10-7-4 5-4 5z" fill="#fff5fb"/>
        ${sprinkles}
        ${candles}
    </svg>`;
}

/** Leaves along an arc from `from` to `to` degrees around (100,100), radius r. */
function oliveBranch(from, to, side) {
    const r = 78;
    const count = 9;
    let out = '';
    for (let k = 0; k < count; k += 1) {
        const a = (from + (to - from) * (k / (count - 1))) * Math.PI / 180;
        const x = 100 + r * Math.cos(a);
        const y = 100 + r * Math.sin(a);
        const tangent = (a * 180 / Math.PI) + 90 * side;
        [-1, 1].forEach((lr) => {
            const tilt = tangent + lr * 34;
            const fill = lr < 0 ? 'url(#occ-leaf-a)' : 'url(#occ-leaf-b)';
            out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)})"><ellipse class="occ-leaf" style="--k:${k}" cx="9" cy="0" rx="11" ry="4.2" fill="${fill}"/></g>`;
        });
        if (k % 3 === 1) {
            const ox = 100 + (r - 9) * Math.cos(a);
            const oy = 100 + (r - 9) * Math.sin(a);
            out += `<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) rotate(${tangent.toFixed(1)})"><ellipse class="occ-olive" style="--k:${k}" rx="4.4" ry="5.6" fill="url(#occ-olive)"/></g>`;
        }
    }
    return out;
}

function namedayArt(student) {
    const face = student?.avatar
        ? `<img src="${esc(student.avatar)}" alt="" decoding="async">`
        : `<span>${esc(firstName(student?.name).charAt(0).toUpperCase())}</span>`;
    return `
    <div class="occ-wreath" aria-hidden="true">
        <svg viewBox="0 0 200 200" focusable="false">
            <defs>
                <linearGradient id="occ-leaf-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a3b86c"/><stop offset="1" stop-color="#5f7a2e"/></linearGradient>
                <linearGradient id="occ-leaf-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3d39a"/><stop offset="1" stop-color="#7f9645"/></linearGradient>
                <radialGradient id="occ-olive" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#8a7bb0"/><stop offset="1" stop-color="#3b2f5c"/></radialGradient>
            </defs>
            <circle cx="100" cy="100" r="78" fill="none" stroke="#6b7f35" stroke-width="2.2" opacity="0.7"/>
            ${oliveBranch(112, 250, 1)}
            ${oliveBranch(68, -70, -1)}
            <g class="occ-bow" transform="translate(100 180)">
                <path d="M0 0c-14-12-28-10-26 0s16 8 26 0z" fill="#2563eb"/>
                <path d="M0 0c14-12 28-10 26 0s-16 8-26 0z" fill="#1d4ed8"/>
                <path d="M-3 2l-10 20 7-3 4 7zM3 2l10 20-7-3-4 7z" fill="#1e40af"/>
                <circle r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.6"/>
            </g>
        </svg>
        <div class="occ-wreath__face">${face}</div>
    </div>`;
}

function cardHtml(type, student, bonus) {
    const name = student?.name || 'Our hero';
    const first = firstName(name);
    const stars = starAmount(bonus);
    if (type === 'birthday') {
        const bunting = BUNTING.concat(BUNTING).map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join('');
        const lights = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
        return `
        <div class="occ-lights" aria-hidden="true">${lights}</div>
        <div class="occ-bunting" aria-hidden="true">${bunting}</div>
        <div class="occ-stage">
            ${birthdayArt(name)}
            <div class="occ-burst" aria-hidden="true"></div>
        </div>
        <p class="occ-eyebrow">🎂 It's a birthday!</p>
        <h2 id="occ-title" class="occ-title">Happy Birthday, <span class="occ-title__name">${esc(first)}!</span></h2>
        <p class="occ-line"><b>${esc(name)}</b> is a year older today. Sing together, make a wish, and send a gift from the whole class.</p>
        <div class="occ-actions">
            <button type="button" class="occ-gift" data-occ-gift>
                <span class="occ-gift__icon" aria-hidden="true">🎁</span>
                <span class="occ-gift__label">Blow out the candles</span>
                <span class="occ-gift__stars">+${stars} <b aria-hidden="true">★</b><span class="sr-only"> stars</span></span>
            </button>
            <button type="button" class="occ-later" data-occ-later>Not today</button>
        </div>`;
    }
    return `
        <div class="occ-sun" aria-hidden="true"></div>
        <div class="occ-sea" aria-hidden="true"></div>
        <div class="occ-stage">
            ${namedayArt(student)}
            <div class="occ-burst" aria-hidden="true"></div>
        </div>
        <div class="occ-meander" aria-hidden="true"></div>
        <p class="occ-eyebrow" lang="el">Χρόνια πολλά!</p>
        <h2 id="occ-title" class="occ-title">Happy Name Day, <span class="occ-title__name">${esc(first)}!</span></h2>
        <p class="occ-line">In Greece a name day is like a second birthday. Wish <b>${esc(name)}</b> “many happy years” and send a gift from the class.</p>
        <div class="occ-actions">
            <button type="button" class="occ-gift" data-occ-gift>
                <span class="occ-gift__icon" aria-hidden="true">🫒</span>
                <span class="occ-gift__label">Wish <span lang="el">Χρόνια πολλά</span></span>
                <span class="occ-gift__stars">+${stars} <b aria-hidden="true">★</b><span class="sr-only"> stars</span></span>
            </button>
            <button type="button" class="occ-later" data-occ-later>Not today</button>
        </div>`;
}

const CONFETTI = {
    birthday: ['#f472b6', '#facc15', '#38bdf8', '#a78bfa', '#4ade80', '#fb923c', '#ffffff'],
    nameday: ['#1d4ed8', '#3b82f6', '#ffffff', '#facc15', '#93c5fd', '#7f9645'],
};

/** Confetti and a few gold stars burst out of the cake or the wreath. */
function burst(shell, type) {
    const host = shell.querySelector('.occ-burst');
    if (!host || reducedMotion() || typeof host.animate !== 'function') return;
    const colors = CONFETTI[type] || CONFETTI.birthday;
    const pieces = 44;
    for (let k = 0; k < pieces; k += 1) {
        const bit = document.createElement('i');
        const leaf = type === 'nameday' && k % 4 === 0;
        bit.className = leaf ? 'occ-bit occ-bit--leaf' : (k % 7 === 0 ? 'occ-bit occ-bit--star' : 'occ-bit');
        if (!leaf && k % 7 !== 0) bit.style.background = colors[k % colors.length];
        host.appendChild(bit);
        const angle = (-90 + (Math.random() - 0.5) * 150) * Math.PI / 180;
        const dist = 90 + Math.random() * 130;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const spin = (Math.random() - 0.5) * 900;
        const anim = bit.animate([
            { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 0 },
            { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${spin * 0.5}deg) scale(1)`, opacity: 1, offset: 0.35 },
            { transform: `translate(${dx}px, ${dy + 120}px) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
        ], { duration: 1500 + Math.random() * 700, delay: Math.random() * 160, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'both' });
        anim.onfinish = () => bit.remove();
    }
}

/**
 * Fills the celebration card and wires its buttons. The caller then opens it (showAnimatedModal).
 * @param {{ type: 'birthday'|'nameday', student: {name, avatar?}, bonus: number,
 *           onGift: () => (Promise|void), close: () => void }} opts
 */
export function prepareOccasionCelebration({ type, student, bonus, onGift, close }) {
    const modal = document.getElementById('celebration-bonus-modal');
    const shell = document.getElementById('celebration-bonus-content');
    if (!modal || !shell) return;
    const kind = type === 'nameday' ? 'nameday' : 'birthday';
    modal.dataset.occasion = kind;
    shell.className = `occ-card occ-card--${kind} pop-in`;
    shell.innerHTML = cardHtml(kind, student, bonus);

    const gift = shell.querySelector('[data-occ-gift]');
    const later = shell.querySelector('[data-occ-later]');
    const label = gift?.querySelector('.occ-gift__label');
    const labelHtml = label?.innerHTML || '';

    later?.addEventListener('click', () => close?.());
    gift?.addEventListener('click', () => {
        if (shell.classList.contains('is-giving')) return;
        shell.classList.add('is-giving');
        gift.disabled = true;
        if (later) later.disabled = true;
        if (label) label.innerHTML = kind === 'birthday' ? 'Make a wish… ✨' : '<span lang="el">Χρόνια πολλά!</span> ✨';
        playOccasionSfx(kind, 'gift');
        burst(shell, kind);
        // The gift is saved after the song; the save closes the card. If it fails, the card stays usable.
        setTimeout(() => {
            Promise.resolve(onGift?.()).catch(() => {}).finally(() => {
                setTimeout(() => {
                    if (modal.classList.contains('hidden')) return;
                    shell.classList.remove('is-giving');
                    gift.disabled = false;
                    if (later) later.disabled = false;
                    if (label) label.innerHTML = labelHtml;
                }, 4000);
            });
        }, reducedMotion() ? 200 : 1900);
    });

    shell.classList.remove('is-arriving');
    void shell.offsetWidth;
    if (!reducedMotion()) {
        shell.classList.add('is-arriving');
        clearTimeout(shell._occArriveTimer);
        shell._occArriveTimer = setTimeout(() => shell.classList.remove('is-arriving'), 2400);
    }
    playOccasionSfx(kind, 'open');
}
