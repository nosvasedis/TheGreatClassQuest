// features/ceremonyArenaView.js — pure markup for the Ceremony of the Month
// "Torchlit Arena" (Classic Arena mode). No state, no DOM access: the live
// ceremony (features/ceremony.js) and the guidebook capture stage both build
// their screens from these functions.

export function escapeCeremonyHtml(value) {
    return String(value ?? '').replace(/[<&>"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const esc = escapeCeremonyHtml;

export const ARENA_REASON_INFO = {
    teamwork: { icon: 'fa-users', tone: 'teamwork', name: 'Teamwork' },
    creativity: { icon: 'fa-lightbulb', tone: 'creativity', name: 'Creativity' },
    respect: { icon: 'fa-hands-helping', tone: 'respect', name: 'Respect' },
    focus: { icon: 'fa-brain', tone: 'focus', name: 'Focus' },
    welcome_back: { icon: 'fa-hand-sparkles', tone: 'welcome', name: 'Welcome back' },
    story_weaver: { icon: 'fa-feather-alt', tone: 'story', name: 'Story' },
    scholar_s_bonus: { icon: 'fa-graduation-cap', tone: 'scholar', name: 'Scholar' },
    teacher_boon: { icon: 'fa-wand-magic-sparkles', tone: 'boon', name: 'Teacher Boon' },
    pathfinder_map: { icon: 'fa-map', tone: 'pathfinder', name: 'Pathfinder' }
};

const LEVEL_ICONS = { 1: '🌱', 2: '💧', 3: '🛡️', 4: '🔮', 5: '🔥', 6: '🐉' };

export function arenaMetalForRank(rank) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'steel';
}

const METAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', steel: 'Honour', mystery: 'Finalist' };

// ---------------------------------------------------------------- SVG parts

const METAL_STOPS = {
    gold: ['#fff7cc', '#f5c542', '#a86b12'],
    silver: ['#ffffff', '#cbd5e1', '#64748b'],
    bronze: ['#ffe2c2', '#d08a4c', '#7c3f12'],
    steel: ['#e0e7ff', '#8b93c9', '#3b3f75'],
    mystery: ['#e9d5ff', '#7c6aa8', '#2e2350']
};

function linear(id, stops, x2 = 1, y2 = 1) {
    const n = stops.length - 1;
    return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / n).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

/** Shared gradients for every arena SVG (kept in the always-visible backdrop). */
export function arenaDefsSvg() {
    return `<svg class="cer-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
        ${Object.entries(METAL_STOPS).map(([metal, stops]) => linear(`cer-g-${metal}`, stops)).join('')}
        ${linear('cer-g-crown', ['#fff4c2', '#f7c948', '#b7791f'], 0, 1)}
        ${linear('cer-g-blade', ['#f8fafc', '#cbd5e1', '#94a3b8'], 1, 0)}
        ${linear('cer-g-bowl', ['#57534e', '#a8a29e', '#44403c'], 1, 0)}
    </defs></svg>`;
}

export function arenaShieldSvg(metal = 'gold') {
    return `<svg class="cer-shield" viewBox="0 0 100 112" aria-hidden="true">
        <path class="cer-shield__rim" d="M50 3 L94 16 V54 C94 82 74 100 50 109 C26 100 6 82 6 54 V16 Z" fill="url(#cer-g-${metal})"/>
        <path class="cer-shield__field" d="M50 12 L85 22 V54 C85 76 69 91 50 99 C31 91 15 76 15 54 V22 Z"/>
        <path class="cer-shield__shine" d="M50 12 L85 22 V38 C66 30 36 34 15 46 V22 Z"/>
    </svg>`;
}

/** A laurel wreath made of leaves along two arcs (left + mirrored right). */
export function arenaLaurelSvg(className = 'cer-laurel') {
    const leaves = [];
    for (let i = 0; i < 9; i += 1) {
        const t = i / 8;
        const angle = 112 + t * 128; // degrees along the left arc (bottom → top)
        const rad = (angle * Math.PI) / 180;
        const x = 100 + Math.cos(rad) * 84;
        const y = 100 + Math.sin(rad) * 84;
        const rot = angle + 30;
        leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.2" ry="15" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
        const ix = 100 + Math.cos(rad) * 76;
        const iy = 100 + Math.sin(rad) * 76;
        leaves.push(`<ellipse cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" rx="5" ry="12" transform="rotate(${(rot - 56).toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)})"/>`);
    }
    const side = leaves.join('');
    return `<svg class="${className}" viewBox="0 0 200 200" aria-hidden="true">
        <g class="cer-laurel__side">${side}</g>
        <g class="cer-laurel__side" transform="translate(200 0) scale(-1 1)">${side}</g>
    </svg>`;
}

export function arenaCrownSvg() {
    return `<svg class="cer-crown" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M10 66 L6 20 L34 42 L60 8 L86 42 L114 20 L110 66 Z" fill="url(#cer-g-crown)" stroke="#7c4a03" stroke-width="3" stroke-linejoin="round"/>
        <rect x="10" y="62" width="100" height="13" rx="4" fill="url(#cer-g-crown)" stroke="#7c4a03" stroke-width="3"/>
        <circle cx="60" cy="8" r="6" fill="#fde68a" stroke="#7c4a03" stroke-width="2.5"/>
        <circle cx="6" cy="20" r="5" fill="#fde68a" stroke="#7c4a03" stroke-width="2.5"/>
        <circle cx="114" cy="20" r="5" fill="#fde68a" stroke="#7c4a03" stroke-width="2.5"/>
        <circle cx="60" cy="47" r="7" fill="#dc2626" stroke="#7c4a03" stroke-width="2.5"/>
        <circle cx="34" cy="54" r="4.5" fill="#2563eb" stroke="#7c4a03" stroke-width="2"/>
        <circle cx="86" cy="54" r="4.5" fill="#059669" stroke="#7c4a03" stroke-width="2"/>
    </svg>`;
}

function crossedSwordsSvg() {
    const blade = `<g><path d="M60 8 L66 14 L66 78 L60 86 L54 78 L54 14 Z" fill="url(#cer-g-blade)" stroke="#334155" stroke-width="2"/>
        <rect x="42" y="84" width="36" height="7" rx="3" fill="#d4a017" stroke="#7c4a03" stroke-width="2"/>
        <rect x="56" y="91" width="8" height="20" rx="3" fill="#7c2d12"/>
        <circle cx="60" cy="115" r="6" fill="#d4a017" stroke="#7c4a03" stroke-width="2"/></g>`;
    return `<svg class="cer-swords" viewBox="0 0 120 124" aria-hidden="true">
        <g transform="rotate(-38 60 62)">${blade}</g>
        <g transform="rotate(38 60 62)">${blade}</g>
    </svg>`;
}

function waxSealSvg() {
    return `<svg class="cer-seal" viewBox="0 0 100 100" aria-hidden="true">
        <g class="cer-seal__half cer-seal__half--l">
            <path d="M50 6 C26 4 6 22 7 48 C8 74 26 94 50 94 Z" class="cer-seal__wax"/>
            <path d="M50 18 C33 18 20 32 20 50 C20 68 33 82 50 82 Z" class="cer-seal__ring"/>
        </g>
        <g class="cer-seal__half cer-seal__half--r">
            <path d="M50 6 C74 4 94 22 93 48 C92 74 74 94 50 94 Z" class="cer-seal__wax"/>
            <path d="M50 18 C67 18 80 32 80 50 C80 68 67 82 50 82 Z" class="cer-seal__ring"/>
        </g>
        <text x="50" y="62" text-anchor="middle" class="cer-seal__mark">?</text>
    </svg>`;
}

function torchHtml(side) {
    return `<div class="cer-torch cer-torch--${side}" aria-hidden="true">
        <div class="cer-torch__glow"></div>
        <svg class="cer-torch__flame" viewBox="0 0 80 120">
            <path class="cer-flame cer-flame--outer" d="M40 118 C12 112 6 84 20 60 C26 70 30 72 32 64 C30 44 38 22 52 6 C50 30 66 42 70 66 C74 90 64 112 40 118 Z"/>
            <path class="cer-flame cer-flame--mid" d="M40 116 C22 110 18 90 28 74 C32 82 36 82 38 76 C38 62 44 50 52 40 C52 58 62 68 62 84 C62 102 54 112 40 116 Z"/>
            <path class="cer-flame cer-flame--core" d="M40 114 C30 110 28 98 34 90 C36 94 40 94 42 90 C44 84 46 78 50 74 C52 86 56 92 54 100 C52 108 48 112 40 114 Z"/>
        </svg>
        <svg class="cer-torch__bowl" viewBox="0 0 120 150">
            <path d="M8 10 H112 L96 50 H24 Z" fill="url(#cer-g-bowl)" stroke="#1c1917" stroke-width="3"/>
            <path d="M24 50 H96 L84 60 H36 Z" fill="#44403c"/>
            <rect x="52" y="60" width="16" height="78" fill="#57534e" stroke="#1c1917" stroke-width="3"/>
            <path d="M30 148 H90 L80 132 H40 Z" fill="#44403c" stroke="#1c1917" stroke-width="3"/>
        </svg>
    </div>`;
}

function starsFieldSvg() {
    // Deterministic scatter so screenshots stay stable.
    let s = 17;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const groups = [[], [], []];
    for (let i = 0; i < 66; i += 1) {
        const x = (rnd() * 1600).toFixed(0);
        const y = (rnd() * 520).toFixed(0);
        const r = (0.6 + rnd() * 1.8).toFixed(2);
        groups[i % 3].push(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
    }
    return `<svg class="cer-starsfield" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${groups.map((g, i) => `<g class="cer-twinkle cer-twinkle--${i}">${g.join('')}</g>`).join('')}
    </svg>`;
}

function arenaStandsSvg() {
    const arches = [];
    for (let i = 0; i < 16; i += 1) {
        const x = 20 + i * 100;
        arches.push(`<path d="M${x} 900 V812 C${x} 780 ${x + 64} 780 ${x + 64} 812 V900 Z"/>`);
    }
    const crowd = [[], [], []];
    let s = 5;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let row = 0; row < 3; row += 1) {
        const y = 690 + row * 34;
        for (let x = 10 + row * 12; x < 1600; x += 22 + rnd() * 10) {
            const r = 9 + rnd() * 3;
            crowd[(Math.floor(x / 22) + row) % 3].push(`<circle cx="${x.toFixed(0)}" cy="${(y - rnd() * 6).toFixed(0)}" r="${r.toFixed(1)}"/><rect x="${(x - r).toFixed(0)}" y="${(y + 4).toFixed(0)}" width="${(r * 2).toFixed(0)}" height="18" rx="7"/>`);
        }
    }
    return `<svg class="cer-stands" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path class="cer-stands__tier cer-stands__tier--back" d="M0 640 C400 600 1200 600 1600 640 V900 H0 Z"/>
        ${crowd.map((c, i) => `<g class="cer-crowd cer-crowd--${i}">${c.join('')}</g>`).join('')}
        <path class="cer-stands__tier cer-stands__tier--front" d="M0 770 C420 744 1180 744 1600 770 V900 H0 Z"/>
        <g class="cer-stands__arches">${arches.join('')}</g>
        <path class="cer-stands__rail" d="M0 770 C420 744 1180 744 1600 770" fill="none"/>
    </svg>`;
}

function pennantsHtml() {
    const colors = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    return `<div class="cer-pennants" aria-hidden="true">
        <svg class="cer-pennants__rope" viewBox="0 0 1600 120" preserveAspectRatio="none"><path d="M0 18 Q400 70 800 40 T1600 18" fill="none"/></svg>
        ${colors.map((c, i) => `<span class="cer-pennant cer-pennant--${c}" style="--i:${i}"></span>`).join('')}
    </div>`;
}

/** Scenery behind every Classic Arena scene (sky, stars, stands, torches, lights). */
export function arenaBackdropHtml() {
    return `
        ${arenaDefsSvg()}
        <div class="cer-sky cer-sky--ember" aria-hidden="true"></div>
        <div class="cer-sky cer-sky--violet" aria-hidden="true"></div>
        ${starsFieldSvg()}
        <div class="cer-moon" aria-hidden="true"></div>
        ${pennantsHtml()}
        <div class="cer-beams" aria-hidden="true">
            <span class="cer-beam cer-beam--l"></span>
            <span class="cer-beam cer-beam--r"></span>
        </div>
        ${arenaStandsSvg()}
        ${torchHtml('l')}
        ${torchHtml('r')}
        <div class="cer-dim" aria-hidden="true"></div>
        <div class="cer-spots" aria-hidden="true">
            <span class="cer-spot cer-spot--l"></span>
            <span class="cer-spot cer-spot--r"></span>
        </div>
        <div class="cer-flash" aria-hidden="true"></div>`;
}

// ---------------------------------------------------------------- scenes

export function arenaIntroHtml({ monthName = '', league = '', className = '', classLogo = '📚' } = {}) {
    return `
        <div class="cer-intro">
            <div class="cer-intro__crest">
                <div class="cer-intro__halo" aria-hidden="true"></div>
                ${arenaLaurelSvg('cer-laurel cer-intro__laurel')}
                <div class="cer-intro__shield">${arenaShieldSvg('gold')}<span class="cer-intro__emblem">${esc(classLogo)}</span></div>
            </div>
            <p class="cer-intro__kicker">Ceremony of the Month</p>
            <h1 class="cer-intro__month">${esc(monthName)}</h1>
            <div class="cer-intro__chips">
                <span class="cer-tag cer-tag--ember"><i class="fas fa-route" aria-hidden="true"></i>League ${esc(league)}</span>
                <span class="cer-tag cer-tag--violet"><i class="fas fa-school" aria-hidden="true"></i>${esc(className)}</span>
            </div>
            <div class="cer-intro__route" aria-label="Team Quest, then Hero's Challenge">
                <span class="cer-route-stop cer-route-stop--ember"><i class="fas fa-flag" aria-hidden="true"></i><b>Team Quest</b><small>League champions</small></span>
                <span class="cer-route-path" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="cer-route-stop cer-route-stop--violet"><i class="fas fa-crown" aria-hidden="true"></i><b>Hero's Challenge</b><small>Prodigy of the Month</small></span>
            </div>
        </div>`;
}

export function arenaSummonHtml() {
    return `<div class="cer-summon" role="status">
        <div class="cer-summon__sigil" aria-hidden="true">${arenaLaurelSvg('cer-laurel cer-summon__laurel')}<i class="fas fa-scroll"></i></div>
        <p>Unrolling the month's scrolls…</p>
    </div>`;
}

function chip(tone, content, title = '') {
    const titleAttr = title ? ` title="${esc(title)}"` : '';
    return `<span class="cer-chip cer-chip--${tone}"${titleAttr}>${content}</span>`;
}

export function arenaClassChipsHtml(entry, { compact = false } = {}) {
    const chips = [];
    const lvl = Math.min(6, Math.max(1, Number(entry.level) || 1));
    chips.push(chip(`lvl-${lvl}`, `${LEVEL_ICONS[lvl]} ${compact ? `Lv ${lvl}` : `Level ${lvl}`}`, `Quest difficulty level ${lvl}`));
    if (entry.zone) chips.push(chip(`zone-${esc(entry.zone.id || 'bronze')}`, compact ? esc(entry.zone.icon || '') : `${esc(entry.zone.icon || '')} ${esc(entry.zone.label || '')}`, entry.zone.desc || ''));
    if (!compact && Number(entry.avgPerHero) > 0) chips.push(chip('avg', `<i class="fas fa-user-group" aria-hidden="true"></i>${Number(entry.avgPerHero).toFixed(1)} per hero`, 'Average stars per hero'));
    if (Number(entry.teamBonus) > 0) {
        const pathfinder = Number(entry.teamBonus) >= 10;
        chips.push(chip(pathfinder ? 'pathfinder' : 'bonus', `<i class="fas ${pathfinder ? 'fa-map' : 'fa-people-group'}" aria-hidden="true"></i>${pathfinder && !compact ? 'Pathfinder ' : ''}+${Number(entry.teamBonus)}`, 'Team Quest bonus stars'));
    }
    if (entry.topSkill) {
        const info = ARENA_REASON_INFO[entry.topSkill] || { icon: 'fa-star', tone: 'neutral', name: 'Strength' };
        chips.push(chip(info.tone, `<i class="fas ${info.icon}" aria-hidden="true"></i>${compact ? '' : 'Top: '}${info.name}`, 'Top class strength this month'));
    }
    return `<div class="cer-chips">${chips.join('')}</div>`;
}

export function arenaHeroChipsHtml(entry, { compact = false } = {}) {
    const stats = entry.stats || {};
    const chips = [];
    if (stats.count3 > 0) chips.push(chip('epic', `<i class="fas fa-bolt" aria-hidden="true"></i>${stats.count3}${compact ? '' : ' × 3★'}`, 'Epic lessons (3-star)'));
    if (stats.count2 > 0 && !compact) chips.push(chip('strong', `<i class="fas fa-star-half-alt" aria-hidden="true"></i>${stats.count2} × 2★`, 'Strong lessons (2-star)'));
    if (stats.topSkill) {
        const info = ARENA_REASON_INFO[stats.topSkill] || { icon: 'fa-star', tone: 'neutral', name: 'Star' };
        chips.push(chip(info.tone, `<i class="fas ${info.icon}" aria-hidden="true"></i>${info.name}`, 'Top strength this month'));
    }
    if (stats.uniqueReasons > 0 && !compact) chips.push(chip('variety', `<i class="fas fa-shapes" aria-hidden="true"></i>${stats.uniqueReasons} strengths`, 'Different award reasons (tie-breaker)'));
    if (stats.academicAvg > 0) chips.push(chip('scholar', `<i class="fas fa-graduation-cap" aria-hidden="true"></i>${Math.round(stats.academicAvg)}%`, 'Average written score this month'));
    if (!chips.length) chips.push(chip('neutral', `<i class="fas fa-star" aria-hidden="true"></i>${Number(entry.score) || 0} this month`, 'Monthly stars'));
    return `<div class="cer-chips">${chips.join('')}</div>`;
}

export function arenaQuestTrailHtml(entry) {
    const p = Math.min(100, Math.max(0, Number(entry.progress) || 0));
    const zone = entry.zone || {};
    return `<div class="cer-trail" aria-label="Quest goal ${Math.round(p)} percent">
        <div class="cer-trail__row"><span>${esc(zone.icon || '🌿')} ${esc(zone.label || 'Quest Path')}</span><b>${Math.round(p)}%</b></div>
        <div class="cer-trail__track">
            <span class="cer-trail__fill" style="--p:${(p / 100).toFixed(3)}"></span>
            <i style="left:30%"></i><i style="left:60%"></i><i style="left:85%"></i>
        </div>
        <div class="cer-trail__goal">${Number(entry.score) || 0} / ${Number(entry.goal) || 0} goal</div>
    </div>`;
}

export function arenaBoonRibbonHtml(teacherBoon) {
    if (!teacherBoon) return '';
    const stars = Math.max(1, Number(teacherBoon.stars) || 0);
    return `<div class="cer-boon"><span class="cer-boon__kicker"><i class="fas fa-gift" aria-hidden="true"></i>Teacher Boon ${'★'.repeat(stars)}</span><span class="cer-boon__reason">${esc(teacherBoon.reasonText || '')}</span></div>`;
}

function avatarHtml(entry, className) {
    return entry.avatar
        ? `<img src="${esc(entry.avatar)}" class="${className}" alt="" loading="eager" decoding="async">`
        : `<span class="${className} ${className}--initial">${esc(String(entry.name || '?').charAt(0))}</span>`;
}

/**
 * Front face of a reveal card. `type` is 'class' or 'student'.
 * `hideScore` keeps the numbers veiled (duel finalists).
 */
export function arenaCardFaceHtml(entry, type, { isMyClass = false, compact = false, hideScore = false, metal = arenaMetalForRank(entry.rank) } = {}) {
    const isHero = type === 'student';
    const score = Number(entry.score) || 0;
    const emblem = isHero
        ? `<div class="cer-medallion">
                ${arenaLaurelSvg('cer-laurel cer-medallion__laurel')}
                <span class="cer-medallion__ring"></span>
                ${avatarHtml(entry, 'cer-medallion__face')}
                <span class="cer-medallion__crown">${arenaCrownSvg()}</span>
           </div>`
        : `<div class="cer-crest">${arenaShieldSvg(metal)}<span class="cer-crest__emblem">${esc(entry.logo || '📚')}</span><span class="cer-crest__crown">${arenaCrownSvg()}</span></div>`;
    const classStrip = isHero && entry.className
        ? `<div class="cer-card__class"><span aria-hidden="true">${esc(entry.classLogo || '📚')}</span>${esc(entry.className)}</div>`
        : '';
    const meta = isHero
        ? ''
        : `<div class="cer-card__meta"><i class="fas fa-users" aria-hidden="true"></i>${Number(entry.studentCount) || 0} heroes</div>`;
    const details = compact
        ? ''
        : `<div class="cer-card__details">
                ${isHero ? arenaHeroChipsHtml(entry) : `${arenaQuestTrailHtml(entry)}${arenaClassChipsHtml(entry)}`}
                ${isHero ? arenaBoonRibbonHtml(entry.teacherBoon) : ''}
           </div>`;
    return `<article class="cer-card cer-card--${isHero ? 'hero' : 'class'} cer-metal--${metal}${compact ? ' cer-card--compact' : ''}" data-rank="${Number(entry.rank) || 0}">
        <div class="cer-card__frame">
            ${isMyClass ? '<span class="cer-card__you">Your class</span>' : ''}
            <div class="cer-card__plate"><span>${METAL_LABEL[metal]}</span><b>#${Number(entry.rank) || '?'}</b></div>
            ${classStrip}
            ${emblem}
            <h3 class="cer-card__name">${esc(entry.name)}</h3>
            <div class="cer-card__score${hideScore ? ' is-veiled' : ''}">
                <span class="cer-card__stars"><i class="fas fa-star" aria-hidden="true"></i><span class="cer-count" data-count="${score}">${hideScore ? '?' : score}</span></span>
                <small>${isHero ? 'stars this month' : 'stars collected'}</small>
            </div>
            ${meta}
            ${details}
        </div>
    </article>`;
}

/** The sealed card + herald banner used for every rank below the final duel. */
export function arenaRevealHtml(entry, type, options = {}) {
    const isHero = type === 'student';
    const metal = arenaMetalForRank(entry.rank);
    return `<div class="cer-reveal is-sealed" data-metal="${metal}">
        <div class="cer-herald-banner cer-metal--${metal}">
            <span class="cer-herald-banner__kicker">${isHero ? "Hero's Challenge" : 'Team Quest'}</span>
            <span class="cer-herald-banner__rank">#${Number(entry.rank) || '?'}</span>
            <span class="cer-herald-banner__label">${metal === 'steel' ? 'Place' : `${METAL_LABEL[metal]} place`}</span>
        </div>
        <div class="cer-flip">
            <div class="cer-flip__inner">
                <div class="cer-flip__back cer-metal--${metal}">
                    <div class="cer-flip__pattern" aria-hidden="true"></div>
                    ${waxSealSvg()}
                    <p class="cer-flip__whisper">${isHero ? 'Which hero?' : 'Which class?'}</p>
                </div>
                <div class="cer-flip__front">${arenaCardFaceHtml(entry, type, options)}</div>
            </div>
        </div>
    </div>`;
}

/** Two finalists, veiled scores, crossed swords between them. */
export function arenaDuelHtml(left, right, type, { myClassId = null } = {}) {
    const side = (entry, pos) => `<div class="cer-duelist cer-duelist--${pos}" data-rank="${Number(entry.rank)}" data-id="${esc(entry.id)}">
        <div class="cer-pedestal" aria-hidden="true"><span></span></div>
        ${arenaCardFaceHtml(entry, type, { hideScore: true, metal: 'mystery', isMyClass: type === 'class' && entry.id === myClassId })}
    </div>`;
    return `<div class="cer-duel" data-type="${type}">
        ${side(left, 'left')}
        <div class="cer-vs" aria-live="polite">
            <span class="cer-vs__ring" aria-hidden="true"></span>
            ${crossedSwordsSvg()}
            <span class="cer-vs__count">VS</span>
            <span class="cer-vs__label">${type === 'student' ? 'Hero Duel' : 'League Duel'}</span>
        </div>
        ${side(right, 'right')}
        <div class="cer-steps" aria-hidden="true">
            <span class="cer-step cer-step--2"><b>2</b></span>
            <span class="cer-step cer-step--1"><b>1</b></span>
            <span class="cer-step cer-step--3"><b>3</b></span>
        </div>
    </div>`;
}

export function arenaTransitionHtml() {
    return `<div class="cer-gate">
        <div class="cer-gate__sigil" aria-hidden="true">
            <span class="cer-gate__ring cer-gate__ring--a"></span>
            <span class="cer-gate__ring cer-gate__ring--b"></span>
            ${arenaLaurelSvg('cer-laurel cer-gate__laurel')}
            <i class="fas fa-crown"></i>
        </div>
        <p class="cer-gate__kicker">The torches turn violet</p>
        <h2 class="cer-gate__title">Hero's Challenge</h2>
        <p class="cer-gate__text">The league has its champion. Now the heroes of this class step into the light.</p>
    </div>`;
}

export function arenaLadderTokenHtml(entry, type) {
    const metal = arenaMetalForRank(entry.rank);
    const face = type === 'student'
        ? avatarHtml(entry, 'cer-token__face')
        : `<span class="cer-token__face cer-token__face--emoji">${esc(entry.logo || '📚')}</span>`;
    return `<li class="cer-token cer-metal--${metal}"><b>#${Number(entry.rank)}</b>${face}<span class="cer-token__name">${esc(entry.name)}</span></li>`;
}

export function arenaStandingsHtml(queueBestFirst = [], { monthName = '' } = {}) {
    const rows = queueBestFirst.map((s, index) => {
        const metal = arenaMetalForRank(s.rank);
        const title = s.rank === 1 ? (queueBestFirst.filter((x) => x.rank === 1).length > 1 ? 'Co-Prodigy' : 'Prodigy of the Month') : '';
        return `<li class="cer-roll__row cer-metal--${metal}" style="--i:${index}">
            <span class="cer-roll__rank">${s.rank <= 3 ? `<i class="fas fa-medal" aria-hidden="true"></i>` : ''}#${Number(s.rank)}</span>
            ${avatarHtml(s, 'cer-roll__face')}
            <span class="cer-roll__who"><b>${esc(s.name)}</b>${title ? `<small>${title}</small>` : ''}</span>
            <span class="cer-roll__chips">${arenaHeroChipsHtml(s, { compact: true })}</span>
            <span class="cer-roll__stars"><i class="fas fa-star" aria-hidden="true"></i>${Number(s.score) || 0}</span>
            ${s.teacherBoon && s.rank <= 2 ? `<span class="cer-roll__boon" title="Teacher Boon"><i class="fas fa-gift" aria-hidden="true"></i></span>` : ''}
        </li>`;
    }).join('');
    return `<div class="cer-roll">
        <div class="cer-roll__head">
            <span class="cer-roll__kicker">${esc(monthName)} · Roll of Honour</span>
            <h2>Final Standings</h2>
        </div>
        <ol class="cer-roll__list">${rows}</ol>
    </div>`;
}

export function arenaCollectiveHtml() {
    return `<div class="cer-collective">
        ${arenaLaurelSvg('cer-laurel cer-collective__laurel')}
        <h2>Our Whole Class Quest</h2>
        <p>Every hero helped the class move forward this month.</p>
    </div>`;
}

export function arenaOutroHtml({ className = '', classLogo = '📚', monthName = '', champions = [] } = {}) {
    return `<div class="cer-outro">
        <div class="cer-intro__crest">
            <div class="cer-intro__halo" aria-hidden="true"></div>
            ${arenaLaurelSvg('cer-laurel cer-intro__laurel')}
            <div class="cer-intro__shield">${arenaShieldSvg('gold')}<span class="cer-intro__emblem">${esc(classLogo)}</span></div>
        </div>
        <h2 class="cer-outro__title">Well fought, ${esc(className)}!</h2>
        <p class="cer-outro__text">${esc(monthName)} is written into the Hall. A new moon, a new quest.</p>
        ${champions.length ? `<p class="cer-outro__crowns"><i class="fas fa-crown" aria-hidden="true"></i>${champions.map(esc).join(' &amp; ')}</p>` : ''}
    </div>`;
}
