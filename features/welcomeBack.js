// Welcome Back card: shown when a teacher welcomes back a student after an absence.
// The rain cloud the absent student wore on the Award tab clears, the sun climbs over the
// hills, a rainbow arcs, and the bonus stars drop in one by one.
// Every animation is transform/opacity only (no animated filters) so it stays smooth on
// classroom laptops. Loaded on demand, so none of this sits in the startup bundle.

import '../styles/welcome_back.css';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';

const MODAL_ID = 'welcome-back-modal';
const SHOW_MS = 5600;
const EXIT_MS = 380;

let closeTimer = null;
let removeTimer = null;
let activeClose = null;

function messageFor(stars) {
    if (stars >= 2) return 'The rain has cleared and the whole class is glad you are back.';
    if (stars >= 1.5) return 'The sky looks brighter with you here again.';
    return 'We are so glad you are back. The sun came out just for you!';
}

const STAR_PATH = 'M12 1.8l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.56l-6.18 3.25L7 13.93 2 9.06l6.91-1z';

function starToken(i, half) {
    const clip = half ? `<clipPath id="wb-half-${i}"><rect x="0" y="0" width="12" height="24"/></clipPath>` : '';
    return `<span class="wb-token${half ? ' wb-token--half' : ''}" style="--i:${i}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <defs>${clip}</defs>
            <path class="wb-token__ghost" d="${STAR_PATH}"/>
            <path class="wb-token__fill" d="${STAR_PATH}" ${half ? `clip-path="url(#wb-half-${i})"` : ''}/>
        </svg>
    </span>`;
}

function starTokens(stars) {
    const whole = Math.floor(stars);
    const half = stars - whole >= 0.5;
    const out = [];
    for (let i = 0; i < whole; i++) out.push(starToken(i, false));
    if (half) out.push(starToken(whole, true));
    return { html: out.join(''), count: out.length };
}

function rainDrops(n) {
    let html = '';
    for (let i = 0; i < n; i++) {
        const x = 30 + ((i * 37) % 40);
        const delay = ((i * 0.13) % 0.6).toFixed(2);
        html += `<i style="left:${x}%;animation-delay:-${delay}s"></i>`;
    }
    return html;
}

function cloudSvg(cls) {
    return `<svg class="wb-cloud ${cls}" viewBox="0 0 160 90" aria-hidden="true">
        <g class="wb-cloud__grey"><path d="M30 82a24 24 0 0 1 2-47.8A32 32 0 0 1 92 26a26 26 0 0 1 40 17 20 20 0 0 1-2 39z"/></g>
        <g class="wb-cloud__white"><path d="M30 82a24 24 0 0 1 2-47.8A32 32 0 0 1 92 26a26 26 0 0 1 40 17 20 20 0 0 1-2 39z"/>
        <path class="wb-cloud__shine" d="M38 44a22 22 0 0 1 30-14"/></g>
    </svg>`;
}

function markup(firstName, stars, low) {
    const tokens = starTokens(stars);
    const amount = Number.isInteger(stars) ? String(stars) : stars.toFixed(1);
    return `
    <div class="wb-card" role="dialog" aria-modal="true" aria-labelledby="wb-name" style="--tokens:${tokens.count}">
        <div class="wb-sky" aria-hidden="true">
            <div class="wb-sky__storm"></div>
            <div class="wb-sky__day"></div>
            <div class="wb-sun">
                <svg class="wb-sun__rays" viewBox="0 0 200 200">
                    ${Array.from({ length: 12 }, (_, i) => `<path d="M100 100 L93 6 L107 6 Z" transform="rotate(${i * 30} 100 100)"/>`).join('')}
                </svg>
                <span class="wb-sun__glow"></span>
                <span class="wb-sun__disc"></span>
            </div>
            <svg class="wb-rainbow" viewBox="0 0 300 150">
                <path d="M20 150a130 130 0 0 1 260 0" stroke="#f87171"/>
                <path d="M32 150a118 118 0 0 1 236 0" stroke="#fb923c"/>
                <path d="M44 150a106 106 0 0 1 212 0" stroke="#facc15"/>
                <path d="M56 150a94 94 0 0 1 188 0" stroke="#4ade80"/>
                <path d="M68 150a82 82 0 0 1 164 0" stroke="#60a5fa"/>
                <path d="M80 150a70 70 0 0 1 140 0" stroke="#a78bfa"/>
            </svg>
            <svg class="wb-hills" viewBox="0 0 400 80" preserveAspectRatio="none">
                <path class="wb-hills__back" d="M0 46C70 18 130 20 200 40s140 18 200-6v46H0z"/>
                <path class="wb-hills__front" d="M0 62c80-30 150-30 230-8s120 14 170-2v28H0z"/>
            </svg>
            <div class="wb-rain">${rainDrops(low ? 8 : 16)}</div>
            ${cloudSvg('wb-cloud--l')}
            ${cloudSvg('wb-cloud--r')}
            <span class="wb-bird wb-bird--1"><svg viewBox="0 0 24 10"><path d="M1 8q5-7 11 0q6-7 11 0"/></svg></span>
            <span class="wb-bird wb-bird--2"><svg viewBox="0 0 24 10"><path d="M1 8q5-7 11 0q6-7 11 0"/></svg></span>
            <span class="wb-twinkle wb-twinkle--1"></span>
            <span class="wb-twinkle wb-twinkle--2"></span>
            <span class="wb-twinkle wb-twinkle--3"></span>
        </div>
        <div class="wb-body">
            <p class="wb-kicker">Welcome back</p>
            <h2 id="wb-name" class="wb-name"><span class="wb-name__ink"></span></h2>
            <p class="wb-message"></p>
            <div class="wb-tokens">${tokens.html}</div>
            <p class="wb-amount"><span class="wb-amount__plus">+${amount}</span> bonus ${stars === 1 ? 'star' : 'stars'}</p>
            <p class="wb-hint">Tap anywhere to continue</p>
        </div>
        <span class="wb-timer" aria-hidden="true"></span>
    </div>`;
}

function close(modal) {
    if (!modal.isConnected || modal.classList.contains('is-leaving')) return;
    clearTimeout(closeTimer);
    modal.classList.add('is-leaving');
    document.removeEventListener('keydown', activeClose);
    activeClose = null;
    removeTimer = setTimeout(() => modal.remove(), EXIT_MS);
}

/**
 * Show the Welcome Back card for a returning student.
 * `hold: true` keeps it open (used by the preview harness for screenshots).
 */
export function showWelcomeBack(firstName, stars, { hold = false } = {}) {
    const amount = Math.max(0.5, Number(stars) || 0.5);
    clearTimeout(closeTimer);
    clearTimeout(removeTimer);
    if (activeClose) document.removeEventListener('keydown', activeClose);
    document.getElementById(MODAL_ID)?.remove();

    const low = detectLowPowerTier();
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = `wb-modal${low ? ' wb-modal--low' : ''}`;
    modal.innerHTML = markup(firstName, amount, low);
    modal.querySelector('.wb-name__ink').textContent = `${firstName}!`;
    modal.querySelector('.wb-message').textContent = messageFor(amount);
    modal.style.setProperty('--wb-show', `${SHOW_MS}ms`);
    document.body.appendChild(modal);

    modal.addEventListener('click', () => close(modal));
    activeClose = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(modal); };
    document.addEventListener('keydown', activeClose);
    if (hold) modal.classList.add('is-held');
    else closeTimer = setTimeout(() => close(modal), SHOW_MS);
    return modal;
}
