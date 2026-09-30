// features/ceremonyGardenView.js — pure markup for the Growth Festival
// (Nursery and Pre-Junior Ceremony of the Month): a storybook garden where
// every child's flower is planted in the class bed. No ranks, no Stars, no
// numbers about children are ever drawn here.

import { escapeCeremonyHtml as esc } from './ceremonyArenaView.js';

export const GARDEN_BADGES = {
    respect: { label: 'Kind Heart Bloom', icon: '💖', tone: 'rose' },
    creativity: { label: 'Bright Idea Bloom', icon: '💡', tone: 'sun' },
    teamwork: { label: 'Teamwork Bloom', icon: '🤝', tone: 'mint' },
    focus: { label: 'Steady Star Bloom', icon: '✨', tone: 'sky' },
    teacher_special_bloom: { label: "Teacher's Special Bloom", icon: '🌟', tone: 'gold' },
    growing_stronger: { label: 'Growing Stronger', icon: '🌱', tone: 'mint' },
    rainbow_of_strengths: { label: 'Rainbow of Strengths', icon: '🌈', tone: 'lilac' },
    steady_little_light: { label: 'Steady Little Light', icon: '🕯️', tone: 'sky' },
    special_part: { label: 'A Special Part of Our Garden', icon: '🌸', tone: 'rose' }
};

export function gardenBadgeFor(key) {
    return GARDEN_BADGES[key] || { label: 'Special Garden Bloom', icon: '🌸', tone: 'rose' };
}

const VIRTUE_WORDS = { teamwork: 'Teamwork', creativity: 'Bright ideas', respect: 'Kindness', focus: 'Focus' };

/** Petal palettes; a child keeps the same colour every time (seeded by id). */
export const GARDEN_PALETTES = [
    { petal: '#f9a8d4', deep: '#ec4899', name: 'rose' },
    { petal: '#fde68a', deep: '#f59e0b', name: 'sun' },
    { petal: '#c4b5fd', deep: '#8b5cf6', name: 'lilac' },
    { petal: '#fdba74', deep: '#f97316', name: 'peach' },
    { petal: '#a5f3fc', deep: '#06b6d4', name: 'sky' },
    { petal: '#fecaca', deep: '#ef4444', name: 'poppy' },
    { petal: '#bbf7d0', deep: '#22c55e', name: 'mint' }
];

export function gardenPaletteFor(seed = '') {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return GARDEN_PALETTES[h % GARDEN_PALETTES.length];
}

function faceHtml(person, className) {
    if (person?.avatar) return `<img src="${esc(person.avatar)}" class="${className}" alt="" decoding="async">`;
    const initial = String(person?.name || '').trim().charAt(0) || '🌸';
    return `<span class="${className} ${className}--initial">${esc(initial)}</span>`;
}

/**
 * A flower head: petals (open or bud), a centre disc holding the face.
 * `size` is 'hero' | 'golden' | 'sprig' | 'pot'.
 */
export function gardenBloomHtml({ person = null, emblem = '', palette = GARDEN_PALETTES[0], petals = 10, size = 'hero', open = false } = {}) {
    const items = [];
    for (let i = 0; i < petals; i += 1) {
        const a = (360 / petals) * i;
        const bud = ((i % 2 ? 1 : -1) * (6 + (i % 3) * 5));
        items.push(`<span class="gdn-petal" style="--a:${a.toFixed(1)}deg;--bud:${bud}deg;--i:${i}"></span>`);
    }
    const centre = emblem
        ? `<span class="gdn-bloom__emblem">${esc(emblem)}</span>`
        : faceHtml(person, 'gdn-bloom__face');
    return `<div class="gdn-bloom gdn-bloom--${size}${open ? ' is-open' : ''}" style="--petal:${palette.petal};--deep:${palette.deep}">
        <div class="gdn-bloom__petals">${items.join('')}</div>
        <div class="gdn-bloom__disc">${centre}</div>
    </div>`;
}

function cloudSvg(cls) {
    return `<svg class="gdn-cloud ${cls}" viewBox="0 0 220 90" aria-hidden="true"><path d="M30 78 C8 78 4 52 26 48 C22 24 52 14 68 32 C76 8 118 4 128 30 C144 14 176 22 172 46 C200 44 212 76 186 78 Z"/></svg>`;
}

function butterflyHtml(cls) {
    return `<div class="gdn-butterfly ${cls}" aria-hidden="true">
        <span class="gdn-butterfly__wing gdn-butterfly__wing--l"></span>
        <span class="gdn-butterfly__body"></span>
        <span class="gdn-butterfly__wing gdn-butterfly__wing--r"></span>
    </div>`;
}

function hillsSvg() {
    const trees = [[180, 520], [300, 548], [1280, 530], [1420, 556], [880, 486]].map(([x, y]) => `
        <g class="gdn-tree" transform="translate(${x} ${y})"><rect x="-5" y="0" width="10" height="44" rx="4" fill="#a16207"/><circle cx="0" cy="-8" r="30" fill="#4ade80"/><circle cx="-14" cy="4" r="20" fill="#22c55e"/><circle cx="16" cy="2" r="22" fill="#34d399"/></g>`).join('');
    return `<svg class="gdn-hills" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
            <linearGradient id="gdn-hill-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bbf7d0"/><stop offset="1" stop-color="#86efac"/></linearGradient>
            <linearGradient id="gdn-hill-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#4ade80"/></linearGradient>
            <linearGradient id="gdn-hill-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#34d399"/></linearGradient>
        </defs>
        <path d="M0 560 C220 470 420 500 620 540 C820 580 1000 460 1220 480 C1400 496 1500 540 1600 520 V900 H0 Z" fill="url(#gdn-hill-far)"/>
        ${trees}
        <path d="M0 640 C260 580 520 600 760 650 C980 696 1240 590 1600 620 V900 H0 Z" fill="url(#gdn-hill-mid)"/>
        <path d="M0 730 C300 690 620 700 900 740 C1180 780 1400 700 1600 720 V900 H0 Z" fill="url(#gdn-hill-near)"/>
    </svg>`;
}

function buntingHtml() {
    const colors = ['#f9a8d4', '#fde68a', '#a5f3fc', '#c4b5fd', '#bbf7d0', '#fdba74', '#f9a8d4', '#fde68a', '#a5f3fc', '#c4b5fd', '#bbf7d0', '#fdba74'];
    return `<div class="gdn-bunting" aria-hidden="true">
        <svg viewBox="0 0 1600 90" preserveAspectRatio="none"><path d="M0 10 Q800 70 1600 10" fill="none" stroke="#fff" stroke-width="3" opacity="0.8"/></svg>
        ${colors.map((c, i) => `<span class="gdn-flag" style="--c:${c};--i:${i}"></span>`).join('')}
    </div>`;
}

/** Scenery behind every Growth Festival scene. */
export function gardenBackdropHtml() {
    return `
        <div class="gdn-sky" aria-hidden="true"></div>
        <div class="gdn-sky gdn-sky--dusk" aria-hidden="true"></div>
        <div class="gdn-sun" aria-hidden="true"><span class="gdn-sun__rays"></span><span class="gdn-sun__disc"></span></div>
        ${cloudSvg('gdn-cloud--a')}${cloudSvg('gdn-cloud--b')}${cloudSvg('gdn-cloud--c')}
        ${buntingHtml()}
        ${hillsSvg()}
        ${butterflyHtml('gdn-butterfly--a')}${butterflyHtml('gdn-butterfly--b')}
        <div class="gdn-dusk-veil" aria-hidden="true"></div>
        <div class="gdn-bed" aria-hidden="false">
            <div class="gdn-bed__grass" aria-hidden="true"></div>
            <ol id="gdn-bed-row" class="gdn-bed__row" aria-label="Our class garden"></ol>
            <div class="gdn-bed__soil" aria-hidden="true"></div>
        </div>`;
}

/** A planted sprig for the class bed (one per child). */
export function gardenSprigHtml(person, index = 0) {
    const palette = gardenPaletteFor(person?.id || person?.name || index);
    const tall = [0.78, 1, 0.88, 0.95, 0.82, 1.05][index % 6];
    return `<li class="gdn-sprig" style="--tall:${tall}" title="${esc(person?.name || '')}">
        ${gardenBloomHtml({ person, palette, petals: 7, size: 'sprig', open: true })}
        <span class="gdn-sprig__stem" aria-hidden="true"></span>
        <span class="gdn-sprig__name">${esc(person?.name || '')}</span>
    </li>`;
}

export function gardenIntroHtml({ monthName = '', className = '', classLogo = '🌱' } = {}) {
    return `<div class="gdn-gate">
        <div class="gdn-gate__arch" aria-hidden="true">
            <span class="gdn-gate__rose" style="--x:8%;--y:30%"></span><span class="gdn-gate__rose" style="--x:18%;--y:12%"></span>
            <span class="gdn-gate__rose" style="--x:36%;--y:3%"></span><span class="gdn-gate__rose" style="--x:62%;--y:3%"></span>
            <span class="gdn-gate__rose" style="--x:80%;--y:12%"></span><span class="gdn-gate__rose" style="--x:91%;--y:30%"></span>
            <span class="gdn-gate__rose gdn-gate__rose--sun" style="--x:27%;--y:6%"></span><span class="gdn-gate__rose gdn-gate__rose--sun" style="--x:72%;--y:6%"></span>
        </div>
        <div class="gdn-gate__garden" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="gdn-gate__doors" aria-hidden="true">
            <span class="gdn-gate__door gdn-gate__door--l"><i></i><i></i><i></i><i></i></span>
            <span class="gdn-gate__door gdn-gate__door--r"><i></i><i></i><i></i><i></i></span>
        </div>
        <div class="gdn-gate__sign">
            <span class="gdn-gate__emblem">${esc(classLogo)}</span>
            <span class="gdn-gate__kicker">Growth Festival</span>
            <strong class="gdn-gate__month">${esc(monthName)}</strong>
            <span class="gdn-gate__class">${esc(className)}</span>
        </div>
    </div>`;
}

/** Our League Garden: one planter per class, the Pathfinder last. No numbers. */
export function gardenLeagueHtml(classes = [], { pathfinderId = null, myClassId = null, soloClassName = 'Our class' } = {}) {
    const list = classes.length ? classes : [{ id: 'solo', className: soloClassName, logo: '🌱', progressLabel: 'Growing together' }];
    const pots = list.map((item, index) => {
        const isPathfinder = item.id === pathfinderId;
        const palette = gardenPaletteFor(item.id || index);
        const virtue = item.topSkill ? VIRTUE_WORDS[item.topSkill] || item.topSkill : '';
        return `<li class="gdn-planter${isPathfinder ? ' gdn-planter--pathfinder' : ''}${item.id === myClassId ? ' gdn-planter--mine' : ''}" style="--i:${index}">
            ${isPathfinder ? `<span class="gdn-planter__beam" aria-hidden="true"></span><span class="gdn-planter__ribbon">✨ ${list.length === 1 ? 'Our League Pathfinder' : 'League Pathfinder'}</span>` : ''}
            <div class="gdn-planter__plant" aria-hidden="true">
                ${gardenBloomHtml({ emblem: item.logo || '🌱', palette: isPathfinder ? { petal: '#fde68a', deep: '#f59e0b' } : palette, petals: 9, size: 'pot', open: true })}
                <span class="gdn-planter__stem"></span>
                <span class="gdn-planter__leaf gdn-planter__leaf--l"></span>
                <span class="gdn-planter__leaf gdn-planter__leaf--r"></span>
            </div>
            <div class="gdn-planter__pot" aria-hidden="true"><span></span></div>
            <div class="gdn-tag">
                <b>${esc(item.className || item.name || 'Our class')}</b>
                <span>${esc(item.progressLabel || 'Growing together')}</span>
                ${virtue ? `<em>${esc(virtue)} bloom</em>` : ''}
            </div>
        </li>`;
    }).join('');
    return `<div class="gdn-league"><ol class="gdn-league__row">${pots}</ol></div>`;
}

export function gardenTransitionHtml() {
    const drops = Array.from({ length: 9 }, (_, i) => `<span class="gdn-drop" style="--i:${i}"></span>`).join('');
    return `<div class="gdn-rain">
        <div class="gdn-rainbow" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="gdn-can" aria-hidden="true">
            <svg viewBox="0 0 200 140"><path d="M40 40 H130 V116 C130 126 122 132 112 132 H58 C48 132 40 126 40 116 Z" fill="#7dd3fc" stroke="#0369a1" stroke-width="5"/>
            <path d="M130 58 L186 30 L192 42 L136 80 Z" fill="#7dd3fc" stroke="#0369a1" stroke-width="5" stroke-linejoin="round"/>
            <ellipse cx="190" cy="36" rx="9" ry="13" fill="#bae6fd" stroke="#0369a1" stroke-width="4"/>
            <path d="M52 40 C52 10 118 10 118 40" fill="none" stroke="#0369a1" stroke-width="7" stroke-linecap="round"/>
            <circle cx="70" cy="82" r="9" fill="#fef3c7"/><circle cx="96" cy="96" r="7" fill="#fbcfe8"/></svg>
            <div class="gdn-can__drops">${drops}</div>
        </div>
        <h2 class="gdn-rain__title">Every Garden Grows Together</h2>
        <p class="gdn-rain__text">A little sunshine, a little rain and lots of kindness help every flower grow.</p>
    </div>`;
}

/** Parade of Blooms: the growing flower + the seed-packet card for one child. */
export function gardenParadeHtml(card, { index = 0, total = 1, person = null } = {}) {
    const who = person || { id: card.studentId, name: card.studentName };
    const badge = gardenBadgeFor(card.key);
    const palette = gardenPaletteFor(who.id || who.name);
    const name = card.studentName || who.name || 'Learner';
    return `<div class="gdn-parade" data-student-id="${esc(card.studentId || '')}">
        <div class="gdn-grow" aria-hidden="true">
            <span class="gdn-grow__seed"></span>
            <span class="gdn-grow__mound"></span>
            <span class="gdn-grow__stem"></span>
            <span class="gdn-grow__leaf gdn-grow__leaf--l"></span>
            <span class="gdn-grow__leaf gdn-grow__leaf--r"></span>
            <div class="gdn-grow__head">${gardenBloomHtml({ person: who, palette, petals: 12, size: 'hero' })}</div>
            <span class="gdn-grow__whisper">Who's in this bud?</span>
        </div>
        <article class="gdn-packet gdn-tone--${badge.tone}">
            <span class="gdn-packet__count">Bloom ${index + 1} of ${total}</span>
            <h3 class="gdn-packet__name">${esc(name)}</h3>
            <span class="gdn-packet__badge"><span aria-hidden="true">${badge.icon}</span>${esc(badge.label)}</span>
            <p class="gdn-packet__text">${esc(card.publicText || 'Brought joy, curiosity and kindness to our garden.')}</p>
            <div class="gdn-packet__nav">
                <button type="button" class="gdn-navbtn" data-growth-nav="prev" ${index === 0 ? 'disabled' : ''} aria-label="Previous bloom"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                <span class="gdn-packet__dots" aria-hidden="true">${Array.from({ length: Math.min(total, 14) }, (_, i) => `<i class="${i === Math.min(index, 13) ? 'is-on' : i < index ? 'is-done' : ''}"></i>`).join('')}</span>
                <button type="button" class="gdn-navbtn" data-growth-nav="next" ${index + 1 >= total ? 'disabled' : ''} aria-label="Next bloom"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
            </div>
        </article>
    </div>`;
}

/** Golden Bloom finale (Prodigy of the Month, Co-Prodigies, or the Whole Class Garden). */
export function gardenFinaleHtml(winners = [], { classLogo = '🌿', className = '' } = {}) {
    const gold = { petal: '#fde047', deep: '#eab308' };
    const tie = winners.length > 1;
    const blooms = winners.length
        ? winners.map((w) => `<div class="gdn-golden">
                <div class="gdn-golden__glow" aria-hidden="true"></div>
                ${gardenBloomHtml({ person: w, palette: gold, petals: 16, size: 'golden' })}
                <span class="gdn-golden__stem" aria-hidden="true"></span>
                <div class="gdn-golden__plate"><span>${tie ? 'Co-Prodigy' : 'Prodigy of the Month'}</span><b>${esc(w.name || 'Prodigy')}</b></div>
            </div>`).join('')
        : `<div class="gdn-golden gdn-golden--class">
                <div class="gdn-golden__glow" aria-hidden="true"></div>
                ${gardenBloomHtml({ emblem: classLogo, palette: { petal: '#bbf7d0', deep: '#22c55e' }, petals: 16, size: 'golden' })}
                <span class="gdn-golden__stem" aria-hidden="true"></span>
                <div class="gdn-golden__plate"><span>Whole Class Garden</span><b>${esc(className || 'Our class')}</b></div>
            </div>`;
    return `<div class="gdn-finale${tie ? ' gdn-finale--tie' : ''}">
        <p class="gdn-finale__whisper">The biggest bud in the garden is waking up…</p>
        <div class="gdn-finale__blooms">${blooms}</div>
    </div>`;
}

export function gardenEndHtml({ className = '' } = {}) {
    return `<div class="gdn-end">
        <h2>Our garden will keep blooming!</h2>
        <p>Thank you, ${esc(className || 'friends')}, for a month full of kindness and wonder.</p>
    </div>`;
}
