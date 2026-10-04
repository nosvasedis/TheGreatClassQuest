// features/ceremonyRisingStar.js — the Rising Star moment of the Classic Arena ceremony.
// Loaded on demand (with its stylesheet) only when a class has a Rising Star, so the
// initial bundle stays inside its budget. Pure markup: features/ceremony.js runs it.

import '../styles/ceremony_rising_star.css';
import { escapeCeremonyHtml as esc } from './ceremonyArenaView.js';

function faceHtml(star) {
    return star.avatar
        ? `<img src="${esc(star.avatar)}" class="cer-rise__face" alt="" decoding="async">`
        : `<span class="cer-rise__face cer-rise__face--initial">${esc(String(star.name || '?').charAt(0))}</span>`;
}

function fmt(value) {
    const n = Number(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const STAR_PATH = 'M50 4 L61.8 36.2 L96 37.6 L69.1 58.8 L78.5 92 L50 72.8 L21.5 92 L30.9 58.8 L4 37.6 L38.2 36.2 Z';

export function risingStarHtml(star = {}, { monthName = '' } = {}) {
    const hasGain = (Number(star.gain) || 0) > 0;
    const starfalls = Number(star.starfalls) || 0;
    const sparks = Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    const proof = [
        hasGain && star.previousMonthName
            ? `<li><i class="fas fa-arrow-trend-up" aria-hidden="true"></i>${fmt(star.previous)} stars in ${esc(star.previousMonthName)}, ${fmt(star.current)} in ${esc(monthName)}</li>`
            : '',
        starfalls > 0
            ? `<li><i class="fas fa-seedling" aria-hidden="true"></i>${starfalls === 1 ? 'A Growth Starfall' : `${starfalls} Growth Starfalls`} on the Scholar's Scroll</li>`
            : '',
    ].filter(Boolean).join('');
    return `<div class="cer-rise" role="group" aria-label="Rising Star: ${esc(star.name)}">
        <div class="cer-rise__comet" aria-hidden="true"><span class="cer-rise__tail"></span><span class="cer-rise__head"></span></div>
        <div class="cer-rise__sparks" aria-hidden="true">${sparks}</div>
        <div class="cer-rise__card">
            <div class="cer-rise__emblem">
                <svg class="cer-rise__star" viewBox="0 0 100 100" aria-hidden="true">
                    <defs><linearGradient id="cer-rise-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbeb"/><stop offset=".55" stop-color="#fcd34d"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
                    <path d="${STAR_PATH}" fill="url(#cer-rise-g)" stroke="#fef3c7" stroke-width="2" stroke-linejoin="round"/>
                </svg>
                <span class="cer-rise__halo" aria-hidden="true"></span>
                ${faceHtml(star)}
            </div>
            <p class="cer-rise__kicker">Rising Star of ${esc(monthName)}</p>
            <h3 class="cer-rise__name">${esc(star.name)}</h3>
            ${hasGain
                ? `<p class="cer-rise__gain"><span class="cer-rise__plus">+<span class="cer-count" data-count="${fmt(star.gain)}">0</span></span><small>stars more than last month</small></p>`
                : `<p class="cer-rise__gain cer-rise__gain--soft"><small>Climbed far above their own best</small></p>`}
            ${proof ? `<ul class="cer-rise__proof">${proof}</ul>` : ''}
            <p class="cer-rise__line">Not the most stars. The biggest climb.</p>
        </div>
    </div>`;
}
