// features/ceremonyAscent.js — "The Portal Ascent" moment of the Ceremony of the Month.
// After the Team Quest results, the watching class sees what its month meant for its quest
// rank: the old crest burns away into the new one when it stepped through the Crystal Portal,
// or the road it walked when it did not, and then next month's quest (goal, Portal runes,
// spoils). Loaded on demand with its stylesheet so the start-up bundle stays in budget.
// Pure markup: features/ceremony.js runs the timeline. Model: ceremonyAscentCore.mjs.

import '../styles/ceremony_ascent.css';
import { escapeCeremonyHtml as esc } from './ceremonyArenaView.js';
import { rankCrestSvg } from './questRankCrest.mjs';

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

function progressRingSvg(progress) {
    const p = Math.max(0, Math.min(100, Number(progress) || 0)) / 100;
    return `<svg class="cer-asc__meter" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="cer-asc__meter-track" cx="60" cy="60" r="${RING_R}"/>
        <circle class="cer-asc__meter-fill" cx="60" cy="60" r="${RING_R}" style="--len:${RING_C.toFixed(1)};--p:${p.toFixed(3)}"/>
    </svg>`;
}

function sparksHtml(count) {
    return Array.from({ length: count }, (_, i) => `<i style="--i:${i};--a:${Math.round((360 / count) * i)}deg"></i>`).join('');
}

/**
 * @param {object} ascent - buildQuestAscent() result
 * @param {object} options
 * @param {string} options.className
 * @param {string} options.classLogo
 * @param {boolean} [options.garden] - Growth Festival skin and simpler words
 */
export function questAscentHtml(ascent, { className = '', classLogo = '📚', garden = false } = {}) {
    if (!ascent) return '';
    const up = ascent.crossed;
    const [light, mid, deep] = ascent.rank.colors;
    const who = esc(className || 'Our class');
    const kicker = up
        ? (garden ? `${who} grew up a step!` : `${who} stepped through the Portal`)
        : `${esc(ascent.monthName)} on the road`;
    const levels = up
        ? `<span class="cer-asc__lv">Level ${ascent.fromLevel}</span><i class="fas fa-angles-right" aria-hidden="true"></i><b class="cer-asc__lv cer-asc__lv--new">Level ${ascent.level}</b>`
        : `<span class="cer-asc__lv">Level ${ascent.level}</span><span class="cer-asc__lv cer-asc__lv--soft">${ascent.progress}% of the road</span>`;

    const emblem = up
        ? `<span class="cer-asc__crest cer-asc__crest--old">${rankCrestSvg(ascent.fromLevel)}</span>
           <span class="cer-asc__crest cer-asc__crest--new">${rankCrestSvg(ascent.level, { title: ascent.rank.title })}</span>`
        : `${progressRingSvg(ascent.progress)}
           <span class="cer-asc__crest cer-asc__crest--road">${rankCrestSvg(ascent.level, { title: ascent.rank.title })}</span>`;

    const goal = ascent.nextGoal > 0
        ? `<div class="cer-asc__goal">
                <small>${esc(ascent.nextMonthName)}'s quest</small>
                <b><i class="fas fa-star" aria-hidden="true"></i><span class="cer-count" data-count="${ascent.nextGoal}">${ascent.nextGoal}</span></b>
                <em>${up ? 'stars to the next Portal' : `stars to open the Portal`}</em>
                ${ascent.goalDelta > 0 ? `<span class="cer-asc__delta"><i class="fas fa-arrow-trend-up" aria-hidden="true"></i>${ascent.goalDelta} more than ${esc(ascent.monthName)}</span>` : ''}
           </div>`
        : `<div class="cer-asc__goal cer-asc__goal--soft">
                <small>The next quest</small>
                <em>${garden ? 'A new garden is waiting for us!' : 'A new road opens with the new school year.'}</em>
           </div>`;

    const rule = up && ascent.newRule
        ? `<div class="cer-asc__rule">
                <span class="cer-asc__rule-icon"><i class="fas ${esc(ascent.newRule.icon)}" aria-hidden="true"></i></span>
                <span><small>New at the Portal</small><b>${esc(ascent.newRule.name)}</b><em>${esc(ascent.newRule.text)}</em></span>
           </div>`
        : up
            ? `<div class="cer-asc__rule">
                <span class="cer-asc__rule-icon"><i class="fas fa-mountain-sun" aria-hidden="true"></i></span>
                <span><small>The road climbs</small><b>A bigger goal, the same brave heroes</b><em>Every level asks a little more of every hero.</em></span>
           </div>`
            : ascent.nextGoal > 0
                ? `<div class="cer-asc__rule cer-asc__rule--next">
                    <span class="cer-asc__rule-icon">${rankCrestSvg(ascent.level + 1)}</span>
                    <span><small>Step through and become</small><b>${esc(ascent.rankNext.title)}</b><em>${esc(ascent.rankNext.motto)}</em></span>
               </div>`
                : '';

    const runes = ascent.runes.length && ascent.nextGoal > 0
        ? `<ul class="cer-asc__runes" aria-label="Portal runes">${ascent.runes.map((r) => `<li class="${r.isNew ? 'is-new' : ''}"><i class="fas ${esc(r.icon)}" aria-hidden="true"></i>${esc(r.short)}${r.isNew ? '<b>New</b>' : ''}</li>`).join('')}</ul>`
        : '';

    const spoils = up && ascent.spoilsGold > 0
        ? `<p class="cer-asc__spoils"><i class="fas fa-coins" aria-hidden="true"></i>Portal spoils: +${ascent.spoilsGold} Gold for every hero</p>`
        : (!up && ascent.nextGoal > 0 ? `<p class="cer-asc__spoils cer-asc__spoils--ahead"><i class="fas fa-coins" aria-hidden="true"></i>Waiting at the Portal: ${ascent.nextSpoils} Gold for every hero</p>` : '');

    return `<div class="cer-asc cer-asc--${up ? 'up' : 'road'}${garden ? ' cer-asc--garden' : ''}" style="--asc-light:${light};--asc-mid:${mid};--asc-deep:${deep}" role="group" aria-label="${up ? `New quest rank: ${esc(ascent.rank.title)}` : `Quest rank: ${esc(ascent.rank.title)}`}">
        <div class="cer-asc__hero">
            <div class="cer-asc__emblem">
                <span class="cer-asc__portal" aria-hidden="true"><i class="cer-asc__swirl"></i><i class="cer-asc__glow"></i></span>
                <span class="cer-asc__rays" aria-hidden="true"></span>
                ${emblem}
                <span class="cer-asc__sparks" aria-hidden="true">${sparksHtml(12)}</span>
                <span class="cer-asc__logo" aria-hidden="true">${esc(classLogo)}</span>
            </div>
            <p class="cer-asc__kicker">${kicker}</p>
            <h3 class="cer-asc__rank">${esc(ascent.rank.title)}${up ? '!' : ''}</h3>
            <p class="cer-asc__levels">${levels}</p>
            <p class="cer-asc__motto">“${esc(ascent.rank.motto)}”</p>
        </div>
        <div class="cer-asc__quest">
            ${goal}
            ${rule}
            ${runes}
            ${spoils}
        </div>
    </div>`;
}

/** One line for the outro: the class's next quest in a ribbon. */
export function questAscentRibbonHtml(ascent) {
    if (!ascent || !(ascent.nextGoal > 0)) return '';
    return `<p class="cer-asc-ribbon">${rankCrestSvg(ascent.level, { className: 'cer-asc-ribbon__crest' })}<span>${esc(ascent.rank.title)}</span><i aria-hidden="true">·</i><span>${esc(ascent.nextMonthName)}: <b>${ascent.nextGoal}★</b> to the Portal</span></p>`;
}
