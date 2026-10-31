// features/portalGuardianView.mjs
// Markup for the Portal Guardian (features/portalGuardian.js): the Guardian drawn in code, a
// riddle card judged by the teacher, and the ending. Pure, so the preview page can use it.
// Styles: styles/quest_ranks.css (pg-).
import { escapeHtml as esc } from '../utils/html.mjs';
import { rankCrestSvg } from './questRankCrest.mjs';

/** The Guardian, drawn in code: a crystal-eyed stone sentinel behind a gate of light. */
export function guardianArtSvg() {
    return `
    <svg class="pg-art" viewBox="0 0 220 240" aria-hidden="true">
        <defs>
            <radialGradient id="pgGlow" cx="50%" cy="45%" r="55%">
                <stop offset="0" stop-color="#e9d5ff" stop-opacity=".95"/>
                <stop offset=".55" stop-color="#8b5cf6" stop-opacity=".35"/>
                <stop offset="1" stop-color="#1e1b4b" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="pgStone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#a5b4c8"/>
                <stop offset=".6" stop-color="#5b6b82"/>
                <stop offset="1" stop-color="#2d3748"/>
            </linearGradient>
            <linearGradient id="pgCloak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#4c1d95"/>
                <stop offset="1" stop-color="#1e1b4b"/>
            </linearGradient>
        </defs>
        <circle class="pg-art__halo" cx="110" cy="110" r="104" fill="url(#pgGlow)"/>
        <g class="pg-art__ring">
            <circle cx="110" cy="110" r="92" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-dasharray="3 9" opacity=".8"/>
        </g>
        <g class="pg-art__body">
            <path d="M58 236 C60 170 74 132 110 126 C146 132 160 170 162 236 Z" fill="url(#pgCloak)"/>
            <path d="M84 236 C88 186 96 150 110 142 C124 150 132 186 136 236 Z" fill="#312e81" opacity=".7"/>
            <path d="M74 128 C74 92 90 62 110 58 C130 62 146 92 146 128 C136 120 124 116 110 116 C96 116 84 120 74 128 Z" fill="url(#pgCloak)"/>
            <path d="M86 122 C86 98 96 80 110 78 C124 80 134 98 134 122 C126 118 118 116 110 116 C102 116 94 118 86 122 Z" fill="url(#pgStone)"/>
            <path d="M98 104 L106 101 L104 107 Z M122 104 L114 101 L116 107 Z" fill="#1e1b4b" opacity=".5"/>
            <g class="pg-art__eyes">
                <ellipse cx="101" cy="104" rx="4.2" ry="2.6" fill="#a5f3fc"/>
                <ellipse cx="119" cy="104" rx="4.2" ry="2.6" fill="#a5f3fc"/>
            </g>
            <path d="M110 58 L114 44 L110 30 L106 44 Z" fill="#c4b5fd"/>
            <path d="M166 236 V70" stroke="#cbd5e1" stroke-width="5" stroke-linecap="round"/>
            <path class="pg-art__gem" d="M166 46 L176 62 L166 78 L156 62 Z" fill="#a78bfa" stroke="#ede9fe" stroke-width="2"/>
            <path d="M150 150 C156 146 162 146 166 150" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round" fill="none"/>
        </g>
    </svg>`;
}

function shell(inner) {
    return `<div class="pg-overlay" role="dialog" aria-modal="true" aria-labelledby="pg-title">
        <div class="pg-backdrop" data-pg-close></div>
        <div class="pg-card">
            <button type="button" class="pg-close" data-pg-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            ${inner}
        </div>
    </div>`;
}

function pipsHtml(s) {
    return Array.from({ length: s.questions }, (_, i) => {
        const r = s.results[i];
        const cls = r === true ? ' is-right' : r === false ? ' is-wrong' : i === s.results.length ? ' is-now' : '';
        const icon = r === true ? 'fa-check' : r === false ? 'fa-xmark' : '';
        return `<span class="pg-pip${cls}">${icon ? `<i class="fas ${icon}" aria-hidden="true"></i>` : i + 1}</span>`;
    }).join('');
}

function headHtml(s) {
    return `
        <div class="pg-head">
            ${guardianArtSvg()}
            <div class="pg-head__copy">
                <p class="pg-kicker">${esc(s.classData.logo || '📚')} ${esc(s.classData.name || 'Our class')} · ${rankCrestSvg(s.status.level, { className: 'pg-kicker__crest' })} ${esc(s.status.rank.title)}</p>
                <h2 id="pg-title" class="pg-title font-title">The Guardian of the Portal</h2>
                <p class="pg-lore">“You filled your goal and woke every rune. Answer <b>${s.toPass}</b> of my <b>${s.questions}</b> riddles, and the Portal is yours.”</p>
                <div class="pg-pips" aria-label="Riddles">${pipsHtml(s)}</div>
            </div>
        </div>`;
}

export function riddleHtml(s) {
    const c = s.challenge;
    return shell(`
        ${headHtml(s)}
        <div class="pg-riddle" data-pg-riddle>
            <p class="pg-riddle__count">Riddle ${s.results.length + 1} of ${s.questions}</p>
            <p class="pg-riddle__text">${esc(c.text)}</p>
            ${c.answer ? `<button type="button" class="pg-answer" data-pg-act="answer" aria-expanded="false"><span>Answer (for the teacher)</span><b>${esc(c.answer)}</b></button>` : ''}
        </div>
        <div class="pg-actions">
            <button type="button" class="pg-btn pg-btn--right" data-pg-act="right"><i class="fas fa-check" aria-hidden="true"></i> Right!</button>
            <button type="button" class="pg-btn pg-btn--wrong" data-pg-act="wrong"><i class="fas fa-xmark" aria-hidden="true"></i> Not this time</button>
            <button type="button" class="pg-link" data-pg-act="another"><i class="fas fa-rotate" aria-hidden="true"></i> Another riddle</button>
        </div>`);
}

export function endHtml(s, passed) {
    const right = s.results.filter(Boolean).length;
    return shell(`
        ${headHtml(s)}
        <div class="pg-end pg-end--${passed ? 'pass' : 'fail'}">
            <span class="pg-end__icon" aria-hidden="true"><i class="fas ${passed ? 'fa-door-open' : 'fa-hourglass-half'}"></i></span>
            <h3 class="font-title">${passed ? 'The Guardian bows. The Portal opens!' : 'The Guardian waits for another day'}</h3>
            <p>${passed
                ? `${right} of ${s.questions} right. Step through, ${esc(s.classData.name || 'heroes')}!`
                : `${right} of ${s.questions} right, and ${s.toPass} are needed. The Guardian asks again next lesson. Every star and every rune stays lit.`}</p>
            <button type="button" class="pg-btn pg-btn--right" data-pg-close><i class="fas fa-check" aria-hidden="true"></i> ${passed ? 'Step through' : 'Until next lesson'}</button>
        </div>`);
}
