// features/ceremonyMoments.js — "The Chronicle of the Month" and "Honours of the Month"
// scenes of the Ceremony of the Month. Loaded on demand with its stylesheet (the start-up CSS
// budget is full). Pure markup: features/ceremony.js runs the timelines; the data comes from
// ceremonyMomentsCore.mjs.

import '../styles/ceremony_moments.css';
import '../styles/hero_seals.css';
import { escapeCeremonyHtml as esc } from './ceremonyArenaView.js';
import { sealArtHtml } from './heroSealsCore.mjs';

function fmt(value) {
    const n = Number(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function faceHtml(hero, className) {
    return hero.avatar
        ? `<img src="${esc(hero.avatar)}" class="${className}" alt="" decoding="async">`
        : `<span class="${className} ${className}--initial">${esc(String(hero.name || '?').charAt(0))}</span>`;
}

function tileItemsHtml(tile) {
    if (!tile.items?.length) return '';
    return `<span class="cer-mom__items">${tile.items.map((item) => `<span class="cer-mom__item${item.done === false ? ' is-ahead' : ''}">
            <span aria-hidden="true">${esc(item.icon)}</span>${esc(item.label)}${item.value ? ` <b>${fmt(item.value)}</b>` : ''}
        </span>`).join('')}</span>`;
}

/**
 * The class's month as stamped tiles. `garden` is the Growth Festival (storybook) skin.
 * Tiles start hidden (.is-pending); the ceremony stamps them in one by one.
 */
export function monthMomentsHtml(tiles = [], { monthName = '', className = '', garden = false } = {}) {
    const many = tiles.length > 4;
    const cols = tiles.length <= 4 ? Math.max(1, tiles.length) : (tiles.length <= 6 ? 3 : 4);
    return `<div class="cer-mom${garden ? ' cer-mom--garden' : ''}${many ? ' cer-mom--many' : ''}" data-count="${tiles.length}">
        <div class="cer-mom__scroll" aria-hidden="true">
            <span class="cer-mom__rod cer-mom__rod--l"></span>
            <span class="cer-mom__sheet"></span>
            <span class="cer-mom__rod cer-mom__rod--r"></span>
        </div>
        <header class="cer-mom__head">
            <p class="cer-mom__kicker">${esc(className)}</p>
            <h2 class="cer-mom__title">${garden ? `Our ${esc(monthName)} Story` : `The Chronicle of ${esc(monthName)}`}</h2>
        </header>
        <ol class="cer-mom__grid" style="--cols:${cols}">
            ${tiles.map((tile, i) => `<li class="cer-mom__tile is-pending" data-moment="${esc(tile.id)}" style="--i:${i}">
                <span class="cer-mom__seal" aria-hidden="true"><span class="cer-mom__ring"></span><span class="cer-mom__icon">${esc(tile.icon)}</span></span>
                <span class="cer-mom__body">
                    <small class="cer-mom__label">${esc(tile.title)}</small>
                    <b class="cer-mom__value"><span class="cer-count" data-count="${fmt(tile.value)}">${fmt(tile.value)}</span> <em>${esc(tile.unit)}</em></b>
                    <span class="cer-mom__line">${esc(tile.line || '')}</span>
                    ${tileItemsHtml(tile)}
                </span>
            </li>`).join('')}
        </ol>
    </div>`;
}

/** Named honours: one column per section (Quiz Champions, Seal Bearers, New Legends). */
export function monthHonoursHtml(honours = { sections: [] }, { monthName = '' } = {}) {
    const sections = honours.sections || [];
    const total = sections.reduce((sum, s) => sum + s.heroes.length, 0);
    let k = 0;
    return `<div class="cer-hon" data-sections="${sections.length}" style="--sections:${sections.length}">
        <header class="cer-hon__head">
            <p class="cer-mom__kicker">${esc(monthName)}</p>
            <h2 class="cer-mom__title">Honours of the Month</h2>
        </header>
        <div class="cer-hon__cols${total > 10 ? ' is-dense' : ''}">
            ${sections.map((section, si) => `<section class="cer-hon__col is-pending" data-honour="${esc(section.id)}" style="--si:${si}">
                <h3 class="cer-hon__banner"><i class="fas ${esc(section.icon)}" aria-hidden="true"></i>${esc(section.title)}</h3>
                <ul class="cer-hon__list">
                    ${section.heroes.map((hero) => `<li class="cer-hon__hero is-pending" style="--k:${k++}">
                        <span class="cer-hon__face-wrap">${faceHtml(hero, 'cer-hon__face')}</span>
                        <span class="cer-hon__who"><b>${esc(hero.name)}</b><small>${esc(hero.note || '')}</small></span>
                        ${hero.sealIds?.length ? `<span class="cer-hon__seals">${hero.sealIds.slice(0, 3).map((id) => sealArtHtml(id, { size: 34 })).join('')}</span>` : ''}
                    </li>`).join('')}
                </ul>
                ${section.more ? `<p class="cer-hon__more">and ${section.more} more</p>` : ''}
            </section>`).join('')}
        </div>
    </div>`;
}
