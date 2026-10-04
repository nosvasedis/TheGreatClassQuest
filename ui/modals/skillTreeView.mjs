// ui/modals/skillTreeView.mjs — HTML for the Ascension Path (Skill Tree) modal.
// Pure: no state, no DOM. The model comes from `features/skillTreeCore.mjs`;
// `ui/modals/skillTree.js` injects the markup and wires the choices. Also used by the guidebook capture.

import { formatPathStars } from '../../features/skillTreeCore.mjs';

export function escTree(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

/** CSS custom properties that theme the whole panel from the Hero Class aura. */
export function skillTreeThemeStyle(model) {
    return `--st-aura:${model.aura};--st-aura-rgb:${model.auraRgb};`;
}

function crestHtml(model) {
    return `
        <div class="st-crest" aria-hidden="true">
            <span class="st-crest-glow"></span>
            <svg class="st-crest-ring" viewBox="0 0 120 120">
                <defs><path id="st-rune-circle" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0"/></defs>
                <circle cx="60" cy="60" r="56" class="st-crest-line"/>
                <circle cx="60" cy="60" r="38" class="st-crest-line st-crest-line--inner"/>
                <text class="st-crest-runes"><textPath href="#st-rune-circle">${RUNES}${RUNES.slice(0, 6)}</textPath></text>
            </svg>
            <span class="st-crest-core">${escTree(model.icon)}</span>
        </div>`;
}

function headerHtml(model, legend) {
    const isLegend = legend?.status === 'legend';
    const rank = model.hasPath
        ? `<span class="st-rank${isLegend ? ' is-legend' : ''}"><i class="fas fa-crown"></i> ${escTree(model.title)}${isLegend ? ' <span class="st-rank-legend">Legend</span>' : ''}</span>`
        : '';
    return `
        <header class="st-head">
            ${crestHtml(model)}
            <div class="st-head-text">
                <p class="st-eyebrow"><span></span>Ascension Path<span></span></p>
                <h2 id="skill-tree-modal-title" class="st-title">${escTree(model.hasPath ? model.heroClass : 'No Path Chosen')}</h2>
                <p id="skill-tree-student-name" class="st-hero">
                    <span class="student-name-text">${escTree(model.studentName)}</span>
                    ${rank}
                </p>
            </div>
        </header>`;
}

function meterHtml(model, legend) {
    if (!model.hasPath) return '';
    const seals = model.tiers.map((tier) => `
        <span class="st-meter-seal${tier.state === 'sealed' ? '' : ' is-lit'}" style="left:${tier.meterPos}%"
              title="${escTree(`${tier.title} · ${tier.threshold} stars`)}">
            <span class="st-meter-seal-gem"></span>
            <span class="st-meter-seal-num">${tier.level}</span>
        </span>`).join('');
    const caption = model.isMax
        ? legend?.status === 'legend'
            ? `<i class="fas fa-crown"></i> A living legend. Every seal is broken and the Legend Quest is fulfilled.`
            : legend?.status === 'open'
                ? `<i class="fas fa-crown"></i> Every seal is broken. One Legend Quest remains.`
                : `<i class="fas fa-crown"></i> The path is complete. Every seal is broken.`
        : model.level === 0
            ? `<b>${formatPathStars(model.toNext)}</b> more ${escTree(model.reasonLabel)} stars to break the first seal`
            : `<b>${formatPathStars(model.toNext)}</b> more ${escTree(model.reasonLabel)} stars to become <b>${escTree(model.nextTitle)}</b>`;
    return `
        <div class="st-meter">
            <div class="st-meter-top">
                <span class="st-meter-level">Level <b>${model.level}</b><small>/ ${model.maxLevel}</small></span>
                <span class="st-meter-stars"><i class="fas fa-star"></i> ${formatPathStars(model.stars)} <small>${escTree(model.reasonLabel)}</small></span>
            </div>
            <div class="st-meter-track" style="--st-pct:${model.overallPct}%">
                <span class="st-meter-fill"><span class="st-meter-spark"></span></span>
                ${seals}
            </div>
            <p class="st-meter-caption">${caption}</p>
        </div>`;
}

const BRANCH_TAGS = {
    chosen: '<i class="fas fa-sun"></i> Awakened',
    forsaken: 'Path not taken',
    choosable: '<i class="fas fa-hand-sparkles"></i> Choose',
    waiting: 'Choose the seal below first',
    sealed: '<i class="fas fa-lock"></i> Sealed'
};

function branchHtml(branch, tier) {
    const inner = `
        <span class="st-skill-link" aria-hidden="true"><span></span></span>
        <span class="st-skill-orb" aria-hidden="true">
            <span class="st-skill-halo"></span>
            <span class="st-skill-icon">${escTree(branch.icon)}</span>
            ${branch.state === 'chosen' ? '<span class="st-skill-check"><i class="fas fa-check"></i></span>' : ''}
        </span>
        <span class="st-skill-name">${escTree(branch.name)}</span>
        <span class="st-skill-desc">${escTree(branch.desc)}</span>
        <span class="st-skill-tag">${BRANCH_TAGS[branch.state] || ''}</span>`;
    const cls = `st-skill st-skill--${branch.side} is-${branch.state}`;
    const data = `data-branch-id="${escTree(branch.id)}" data-level-index="${tier.index}"`;
    if (branch.state === 'choosable') {
        return `<button type="button" class="${cls}" ${data} aria-label="${escTree(`Choose ${branch.name}: ${branch.desc}`)}">${inner}</button>`;
    }
    return `<div class="${cls}" ${data}>${inner}</div>`;
}

const SEAL_NOTES = {
    awakened: '<i class="fas fa-check"></i> Awakened',
    choosing: '<i class="fas fa-bolt"></i> Level up! Choose one',
    waiting: '<i class="fas fa-hourglass-half"></i> Unlocked',
    sealed: ''
};

function tierHtml(tier, model) {
    const note = tier.state === 'sealed'
        ? `<i class="fas fa-star"></i> ${tier.threshold} ${escTree(model.reasonLabel)}`
        : SEAL_NOTES[tier.state];
    const [left, right] = tier.branches;
    return `
        <li class="st-tier is-${tier.state}${tier.index === model.focusTier ? ' is-focus' : ''}" data-level="${tier.level}"
            style="--st-i:${tier.index + 1};--st-fill:${tier.fill}">
            <div class="st-tier-row">
                ${left ? branchHtml(left, tier) : '<span></span>'}
                <div class="st-seal">
                    <div class="st-seal-gem" aria-hidden="true">
                        <span class="st-seal-rays"></span>
                        <span class="st-seal-num">${tier.state === 'sealed' ? '<i class="fas fa-lock"></i>' : tier.level}</span>
                    </div>
                    <p class="st-seal-title">${escTree(tier.title)}</p>
                    <p class="st-seal-note">${note}</p>
                </div>
                ${right ? branchHtml(right, tier) : '<span></span>'}
            </div>
            <div class="st-climb" aria-hidden="true"><span class="st-climb-fill"></span></div>
        </li>`;
}

function originHtml(model) {
    return `
        <li class="st-origin" style="--st-i:0">
            <div class="st-origin-orb" aria-hidden="true">${escTree(model.icon)}</div>
            <p class="st-origin-title">The journey begins</p>
            <p class="st-origin-note">Every ${escTree(model.reasonLabel)} star climbs the path</p>
        </li>`;
}

function emptyHtml() {
    return `
        <div class="st-empty">
            <div class="st-empty-compass" aria-hidden="true">🧭</div>
            <p class="st-empty-title">Path Unchosen</p>
            <p class="st-empty-note">This hero hasn't stepped onto a Hero Path yet. Choose a Hero Class in their settings to begin the climb.</p>
        </div>`;
}

function footerHtml(model) {
    if (!model.hasPath) return '';
    const pips = model.tiers.map((t) => `<span class="st-pip${t.state === 'awakened' ? ' is-on' : ''}"></span>`).join('');
    return `
        <footer class="st-foot">
            <span class="st-foot-pips" aria-label="${model.awakenedCount} of ${model.maxLevel} skills awakened">${pips}</span>
            <span>${model.awakenedCount} / ${model.maxLevel} skills awakened</span>
            <span class="st-foot-dot" aria-hidden="true">✦</span>
            <span>One skill per seal · each choice is permanent</span>
        </footer>`;
}

/**
 * Everything inside the panel except the static sky and close button.
 * `legend` is the Legend Quest state and `legendHtml` its crown at the top of the path
 * (ui/modals/legendQuestView.mjs); while the quest is open or fulfilled it takes the focus.
 */
export function renderSkillTreeStage(model, { legend = null, legendHtml = '' } = {}) {
    const legendFocus = legend && (legend.status === 'open' || legend.status === 'legend');
    const tierModel = legendFocus ? { ...model, focusTier: -1 } : model;
    const body = model.hasPath
        ? `<ol class="st-path">${legendHtml}${[...model.tiers].reverse().map((t) => tierHtml(t, tierModel)).join('')}${originHtml(model)}</ol>`
        : emptyHtml();
    return `
        ${headerHtml(model, legend)}
        ${meterHtml(model, legend)}
        <div id="skill-tree-content" class="st-scroll custom-scrollbar">${body}</div>
        ${footerHtml(model)}`;
}

/** The "awaken this skill?" rite card. */
export function renderSkillRiteHtml(branch, tier) {
    return `
        <div class="st-rite-card" role="dialog" aria-modal="true" aria-labelledby="st-rite-title">
            <div class="st-rite-circle" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                    <defs><path id="st-rite-rune-path" d="M60,60 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0"/></defs>
                    <circle cx="60" cy="60" r="57"/>
                    <text><textPath href="#st-rite-rune-path">${RUNES}${RUNES}</textPath></text>
                </svg>
                <span class="st-rite-orb">${escTree(branch.icon)}</span>
            </div>
            <p class="st-rite-eyebrow">Seal ${tier.level} · ${escTree(tier.title)}</p>
            <h3 id="st-rite-title" class="st-rite-title">${escTree(branch.name)}</h3>
            <p class="st-rite-desc">${escTree(branch.desc)}</p>
            <p class="st-rite-warn">Choose wisely, hero. This skill becomes a permanent part of your legend.</p>
            <div class="st-rite-actions">
                <button type="button" class="st-rite-ok" data-rite="ok"><i class="fas fa-sun"></i> Awaken this skill</button>
                <button type="button" class="st-rite-cancel" data-rite="cancel">Reconsider</button>
            </div>
        </div>`;
}

/** Burst pieces for the awakening moment (positions are deterministic). */
export function renderAwakenBurstHtml(count = 14) {
    const sparks = Array.from({ length: count }, (_, i) => {
        const angle = Math.round((360 / count) * i);
        const dist = 70 + ((i * 37) % 40);
        return `<span class="st-burst-spark" style="--a:${angle}deg;--d:${dist}px;--delay:${(i % 4) * 40}ms"></span>`;
    }).join('');
    return `<span class="st-burst" aria-hidden="true"><span class="st-burst-ring"></span><span class="st-burst-ring st-burst-ring--2"></span>${sparks}</span>`;
}
