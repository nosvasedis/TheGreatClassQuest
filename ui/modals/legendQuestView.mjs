// ui/modals/legendQuestView.mjs — HTML for the Legend Quest crown at the top of the Ascension Path.
// Pure: state comes from features/legendQuestCore.mjs; ui/modals/skillTree.js wires the buttons.
// Styles: styles/legend_quest.css (loaded with the modal, not in the first paint).

import { escTree } from './skillTreeView.mjs';
import { formatLegendDay } from '../../features/legendQuestCore.mjs';

const CROWN_SVG = `
    <svg class="lq-crown-svg" viewBox="0 0 120 92" aria-hidden="true">
        <defs>
            <linearGradient id="lq-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fff7cc"/>
                <stop offset="0.45" stop-color="#facc15"/>
                <stop offset="1" stop-color="#b45309"/>
            </linearGradient>
            <linearGradient id="lq-band" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#92400e"/>
                <stop offset="0.5" stop-color="#fbbf24"/>
                <stop offset="1" stop-color="#92400e"/>
            </linearGradient>
        </defs>
        <path class="lq-crown-body" d="M10 70 L4 22 L32 46 L60 8 L88 46 L116 22 L110 70 Z" fill="url(#lq-gold)" stroke="#78350f" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="8" y="68" width="104" height="16" rx="5" fill="url(#lq-band)" stroke="#78350f" stroke-width="2.4"/>
        <circle cx="4" cy="20" r="5" fill="#fef3c7" stroke="#78350f" stroke-width="2"/>
        <circle cx="60" cy="7" r="6" fill="#fef3c7" stroke="#78350f" stroke-width="2"/>
        <circle cx="116" cy="20" r="5" fill="#fef3c7" stroke="#78350f" stroke-width="2"/>
        <circle class="lq-jewel" cx="34" cy="76" r="4" fill="var(--st-aura)"/>
        <circle class="lq-jewel lq-jewel--mid" cx="60" cy="76" r="5" fill="#ef4444"/>
        <circle class="lq-jewel" cx="86" cy="76" r="4" fill="var(--st-aura)"/>
        <path d="M60 30 L66 44 L60 58 L54 44 Z" fill="#fff" opacity="0.55"/>
    </svg>`;

function stepGemsHtml(legend) {
    return Array.from({ length: legend.stepsNeeded }, (_, i) => {
        const day = legend.steps[i];
        const lit = Boolean(day);
        return `<li class="lq-step${lit ? ' is-lit' : ''}">
                <span class="lq-step-gem" aria-hidden="true">${lit ? '<i class="fas fa-check"></i>' : i + 1}</span>
                <span class="lq-step-day">${lit ? escTree(formatLegendDay(day)) : 'A lesson'}</span>
            </li>`;
    }).join('');
}

function actionsHtml(legend) {
    if (legend.status !== 'open') return '';
    const mark = legend.canMark
        ? `<button type="button" class="lq-mark" data-legend="mark"><i class="fas fa-feather-pointed" aria-hidden="true"></i> ${escTree(legend.quest.stepLabel)} today</button>`
        : `<span class="lq-marked"><i class="fas fa-check" aria-hidden="true"></i> Today's step is marked. The next one waits for another lesson.</span>`;
    const undo = legend.steps.length
        ? `<button type="button" class="lq-undo" data-legend="undo">Undo the last step</button>`
        : '';
    return `<div class="lq-actions">${mark}${undo}</div>`;
}

/** The crown that sits above the highest seal. */
export function renderLegendCrownHtml(legend, model) {
    if (!legend || legend.status === 'hidden') return '';
    const q = legend.quest;
    const status = legend.status;
    const eyebrow = status === 'legend' ? 'Legend Quest fulfilled' : status === 'open' ? 'Legend Quest' : 'Legend Quest · sealed';
    const note = status === 'locked'
        ? `Break every seal and awaken every skill, and the ${escTree(model.heroClass)} Legend Quest opens here.`
        : status === 'legend'
            ? `${escTree(model.studentName)} is a <b>${escTree(q.legend)}</b>. The title shines gold on the Hero's Challenge and on the certificate.`
            : `${escTree(q.task)} Do it in <b>${legend.stepsNeeded} different lessons</b>; the teacher marks each one.`;
    return `
        <li class="lq st-legend is-${status}${status === 'locked' ? '' : ' is-focus'}" style="--st-i:0;--st-fill:${status === 'locked' ? 0 : 1}">
            <div class="lq-card">
                <div class="lq-crown${status === 'legend' ? ' is-won' : ''}" aria-hidden="true">
                    <span class="lq-crown-glow"></span>
                    ${CROWN_SVG}
                </div>
                <p class="lq-eyebrow"><span></span>${eyebrow}<span></span></p>
                <h3 class="lq-title">${escTree(status === 'legend' ? q.legend : q.quest)}</h3>
                <p class="lq-note">${note}</p>
                ${status === 'locked' ? '' : `<ol class="lq-steps" aria-label="${legend.steps.length} of ${legend.stepsNeeded} steps done">${stepGemsHtml(legend)}</ol>`}
                ${actionsHtml(legend)}
                <p class="lq-fine">No Gold or stars, only glory.</p>
            </div>
            <div class="st-climb lq-climb" aria-hidden="true"><span class="st-climb-fill"></span></div>
        </li>`;
}

/** The moment the quest is fulfilled. */
export function renderLegendBornHtml(legend, model) {
    const q = legend.quest;
    const sparks = Array.from({ length: 18 }, (_, i) => {
        const angle = Math.round((360 / 18) * i);
        const dist = 90 + ((i * 29) % 50);
        return `<span class="lq-born-spark" style="--a:${angle}deg;--d:${dist}px;--delay:${(i % 5) * 60}ms"></span>`;
    }).join('');
    return `
        <div class="st-rite-card lq-born-card" role="dialog" aria-modal="true" aria-labelledby="lq-born-title">
            <div class="lq-born-crown" aria-hidden="true">
                <span class="lq-born-rays"></span>
                ${sparks}
                ${CROWN_SVG}
            </div>
            <p class="st-rite-eyebrow">A legend is born</p>
            <h3 id="lq-born-title" class="st-rite-title lq-born-title">${escTree(q.legend)}</h3>
            <p class="st-rite-desc"><b>${escTree(model.studentName)}</b>, ${escTree(model.title)}, has fulfilled the Legend Quest: ${escTree(q.quest)}. From today the title shines gold.</p>
            <div class="st-rite-actions">
                <button type="button" class="st-rite-ok lq-born-ok" data-rite="ok"><i class="fas fa-crown"></i> Huzzah!</button>
            </div>
        </div>`;
}
