// Award Stars tab: one hero's star cloud.
// Pure markup, no app state: ui/tabs/award.js feeds it from the class, and the guidebook
// capture (docs/product/guidebook/capture/fill-classroom.js) draws the same cloud from fake data.
// Styles: styles/award_stars.css. Effects: ui/awardFx.js.
//
// Hooks other code relies on (keep them): .student-cloud-card[data-studentid], .reason-btn[data-reason],
// .star-award-btn[data-stars], .star-selector-container, .post-award-undo-btn, .boon-btn[data-receiver-id],
// .absence-controls [data-action], #today-stars-<id>, #monthly-stars-<id>, #total-stars-<id>,
// #student-gold-display-<id>, .enlargeable-avatar.

/** The four life skills a teacher can name on a cloud, in button order. */
export const AWARD_VIRTUES = [
    { key: 'teamwork', name: 'Teamwork', icon: 'fa-users', hint: 'Helping, pairing, listening' },
    { key: 'creativity', name: 'Creativity', icon: 'fa-lightbulb', hint: 'A new idea, playful English' },
    { key: 'respect', name: 'Respect', icon: 'fa-hands-helping', hint: 'Kindness and care for the room' },
    { key: 'focus', name: 'Focus', icon: 'fa-brain', hint: 'Effort and sticking with it' }
];

const VIRTUE_NAMES = Object.fromEntries(AWARD_VIRTUES.map((v) => [v.key, v.name]));

/** Star buttons, smallest to grandest. */
export const AWARD_STAR_TIERS = [
    { stars: 1, name: 'Spark', label: 'Award 1 star' },
    { stars: 2, name: 'Shine', label: 'Award 2 stars' },
    { stars: 3, name: 'Supernova', label: 'Award 3 stars' }
];

/**
 * Cloud silhouettes, drawn on a 400 x 440 board: one body plus puffs (cx, cy, r).
 * Every shape keeps a central dome near (200, 92) so the portrait always sits on cloud.
 */
export const AWARD_CLOUD_SHAPES = {
    a: {
        body: [26, 104, 348, 290, 86],
        puffs: [[112, 124, 66], [200, 94, 84], [292, 116, 68], [44, 218, 50], [48, 306, 46], [356, 208, 48], [352, 300, 44], [104, 384, 50], [186, 398, 48], [268, 394, 50], [334, 366, 42]],
        glints: [[64, 150], [338, 158], [300, 400]]
    },
    b: {
        body: [30, 108, 340, 288, 90],
        puffs: [[98, 132, 60], [200, 92, 86], [296, 108, 72], [352, 160, 40], [40, 236, 52], [360, 262, 48], [58, 330, 44], [120, 392, 46], [206, 402, 52], [290, 388, 48], [344, 346, 40]],
        glints: [[52, 176], [352, 212], [96, 404]]
    },
    c: {
        body: [24, 112, 352, 282, 80],
        puffs: [[120, 118, 72], [200, 92, 80], [284, 124, 62], [48, 190, 44], [38, 270, 48], [350, 196, 52], [362, 286, 42], [84, 372, 46], [164, 396, 52], [248, 400, 46], [322, 378, 50]],
        glints: [[74, 142], [330, 150], [206, 420]]
    },
    d: {
        body: [28, 100, 344, 294, 88],
        puffs: [[104, 118, 62], [200, 90, 86], [300, 124, 64], [36, 208, 42], [46, 290, 52], [364, 226, 46], [354, 318, 44], [94, 390, 44], [172, 400, 50], [254, 396, 52], [330, 380, 42]],
        glints: [[58, 158], [346, 178], [150, 414]]
    }
};

export const AWARD_CLOUD_KEYS = Object.keys(AWARD_CLOUD_SHAPES);

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Stars can be fractional (Welcome Back, peer boons); show at most one decimal. */
export function formatAwardStars(value) {
    const n = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function safeIdPart(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'hero';
}

function cloudShapesSvg(shape) {
    const [x, y, w, h, rx] = shape.body;
    const puffs = shape.puffs.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>${puffs}`;
}

function sparkPath(cx, cy, s) {
    const k = s * 0.28;
    return `M${cx} ${cy - s}Q${cx + k} ${cy - k} ${cx + s} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + s}Q${cx - k} ${cy + k} ${cx - s} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - s}Z`;
}

/**
 * The cloud art: a soft shelf underneath, a rim, the body with a sky gradient, a virtue tint
 * that fades in when a reason is picked, a sheen along the top puffs and a few glints.
 * Drawn once and never animated from inside, so it rasterises once per card.
 */
export function buildAwardCloudSvg(cloudKey, uid) {
    const shape = AWARD_CLOUD_SHAPES[cloudKey] || AWARD_CLOUD_SHAPES.a;
    const id = `awc-${safeIdPart(uid)}`;
    const topPuffs = shape.puffs.filter(([, cy]) => cy < 140);
    const sheen = topPuffs.map(([cx, cy, r]) => {
        const a = r * 0.72;
        return `<path d="M${(cx - a).toFixed(1)} ${(cy - r * 0.16).toFixed(1)}A${a.toFixed(1)} ${a.toFixed(1)} 0 0 1 ${(cx + a * 0.18).toFixed(1)} ${(cy - r * 0.7).toFixed(1)}"/>`;
    }).join('');
    const glints = shape.glints.map(([cx, cy], i) => `<path d="${sparkPath(cx, cy, i === 1 ? 9 : 7)}"/>`).join('');
    return `<svg class="aw-cloud__art" viewBox="0 0 400 440" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
        + `<defs><g id="${id}-s">${cloudShapesSvg(shape)}</g>`
        + `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="440">`
        + `<stop offset="0" style="stop-color:var(--awc-top)"/><stop offset="0.55" style="stop-color:var(--awc-mid)"/><stop offset="1" style="stop-color:var(--awc-bot)"/></linearGradient></defs>`
        + `<use href="#${id}-s" class="aw-cloud__shelf" transform="translate(0 14)"/>`
        + `<use href="#${id}-s" class="aw-cloud__rim"/>`
        + `<use href="#${id}-s" fill="url(#${id}-g)"/>`
        + `<use href="#${id}-s" class="aw-cloud__tint"/>`
        + `<g class="aw-cloud__sheen">${sheen}</g>`
        + `<g class="aw-cloud__rain"><path d="M118 424l-6 14M168 430l-6 14M222 428l-6 14M276 424l-6 14"/></g>`
        + `<g class="aw-cloud__glints">${glints}</g>`
        + `</svg>`;
}

function portraitHtml(view) {
    const initial = esc((view.initial || view.name || '?').charAt(0));
    const face = view.avatar
        ? `<img src="${esc(view.avatar)}" alt="${esc(view.name)}" loading="lazy" decoding="async" class="aw-portrait__img enlargeable-avatar">`
        : `<div class="aw-portrait__img aw-portrait__img--initial enlargeable-avatar">${initial}</div>`;
    const guild = view.guild?.name
        ? (view.guild.emblemUrl
            ? `<img class="aw-portrait__guild" src="${esc(view.guild.emblemUrl)}" alt="${esc(view.guild.name)}" title="${esc(view.guild.name)}" style="--guild:${esc(view.guild.color || '#6366f1')}">`
            : `<span class="aw-portrait__guild aw-portrait__guild--initial" title="${esc(view.guild.name)}" style="--guild:${esc(view.guild.color || '#6366f1')}">${esc(view.guild.name.charAt(0))}</span>`)
        : '';
    const levelUp = view.levelUp
        ? `<span class="aw-portrait__levelup" title="Level up! Choose a skill in the Skill Tree" aria-label="Level up ready"><i class="fas fa-arrow-up" aria-hidden="true"></i></span>`
        : '';
    const crown = view.honours?.heroOfDay
        ? `<span class="aw-portrait__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>`
        : '';
    const laurel = view.honours?.prodigy
        ? `<span class="aw-portrait__laurel" aria-hidden="true"><i class="fas fa-leaf aw-portrait__leaf aw-portrait__leaf--l"></i><i class="fas fa-leaf aw-portrait__leaf aw-portrait__leaf--r"></i></span>`
        : '';
    const aura = view.heroClass?.aura ? ` style="--aura:${esc(view.heroClass.aura)}"` : '';
    return `<div class="aw-portrait"${aura}>${laurel}<span class="aw-portrait__ring" aria-hidden="true"></span>${face}${guild}${levelUp}${crown}</div>`;
}

function purseHtml(view) {
    return `<div class="aw-purse" title="${esc(view.firstName || view.name)}'s Gold">`
        + `<span class="aw-purse__coin" aria-hidden="true"><i class="fas fa-star"></i></span>`
        + `<span class="aw-purse__value" id="student-gold-display-${esc(view.id)}">${esc(view.gold ?? 0)}</span>`
        + `<span class="sr-only"> Gold</span></div>`;
}

function familiarHtml(view) {
    return view.familiarHtml ? `<div class="aw-familiar" title="Familiar">${view.familiarHtml}</div>` : '';
}

function heroRibbonHtml(view) {
    if (!view.heroClass?.title) return '';
    return `<span class="aw-ribbon" style="--aura:${esc(view.heroClass.aura || '#7c3aed')}" title="Hero Path rank">`
        + `${view.heroClass.icon ? `<span class="aw-ribbon__icon" aria-hidden="true">${esc(view.heroClass.icon)}</span>` : ''}`
        + `<span class="aw-ribbon__text">${esc(view.heroClass.title)}</span></span>`;
}

/** Small honours under the name: Hero of the Day, last month's Prodigy, special days, a welcome back. */
export function buildAwardHonoursHtml(honours = {}) {
    const chips = [];
    if (honours.heroOfDay) {
        chips.push(`<span class="aw-honour aw-honour--hero" title="Hero of the Day: the first award today carries +1 bonus star"><i class="fas fa-crown" aria-hidden="true"></i>Hero of the Day${honours.heroBonusReady ? '<b class="aw-honour__bonus">+1</b>' : ''}</span>`);
    }
    if (honours.prodigy) {
        const epithet = honours.coProdigy ? 'Co-Prodigy' : 'Prodigy of the Month';
        chips.push(`<span class="aw-honour aw-honour--prodigy" title="${esc(honours.prodigyMonth ? `${honours.prodigyMonth}'s ${epithet}` : epithet)}"><i class="fas fa-medal" aria-hidden="true"></i>${epithet}</span>`);
    }
    if (honours.occasion === 'birthday') {
        chips.push('<span class="aw-honour aw-honour--party" title="Birthday today: the first star opens a +2.5 bonus"><i class="fas fa-cake-candles" aria-hidden="true"></i>Birthday!</span>');
    } else if (honours.occasion === 'nameday') {
        chips.push('<span class="aw-honour aw-honour--party" title="Name day today: the first star opens a +1.5 bonus"><i class="fas fa-gift" aria-hidden="true"></i>Name Day!</span>');
    }
    if (honours.welcomedBack) {
        chips.push('<span class="aw-honour aw-honour--welcome" title="Welcomed back today"><i class="fas fa-sun" aria-hidden="true"></i>Welcomed back</span>');
    }
    return chips.join('');
}

function tallyHtml(view) {
    const id = esc(view.id);
    const today = Number(view.today) || 0;
    const pips = [1, 2, 3].map((n) => `<i class="aw-tally__pip${today >= n ? ' is-lit' : ''}" aria-hidden="true"></i>`).join('');
    return `<div class="award-counters-row aw-tally" role="group" aria-label="Stars">`
        + `<div class="aw-tally__item aw-tally__item--today" title="Stars today">`
        + `<span class="aw-tally__sigil" aria-hidden="true"><i class="fas fa-sun"></i></span>`
        + `<span class="aw-tally__value font-title" id="today-stars-${id}">${esc(formatAwardStars(today))}</span>`
        + `<span class="aw-tally__label">Today</span><span class="aw-tally__pips">${pips}</span></div>`
        + `<div class="aw-tally__item aw-tally__item--month" title="Stars this month">`
        + `<span class="aw-tally__sigil" aria-hidden="true"><i class="fas fa-moon"></i></span>`
        + `<span class="aw-tally__value font-title" id="monthly-stars-${id}">${esc(formatAwardStars(view.month))}</span>`
        + `<span class="aw-tally__label">Month</span></div>`
        + `<div class="aw-tally__item aw-tally__item--total" title="Stars all year">`
        + `<span class="aw-tally__sigil" aria-hidden="true"><i class="fas fa-star"></i></span>`
        + `<span class="aw-tally__value font-title" id="total-stars-${id}">${esc(formatAwardStars(view.total))}</span>`
        + `<span class="aw-tally__label">Total</span></div>`
        + `</div>`;
}

export function buildAwardVirtuesHtml(view) {
    const locked = Boolean(view.locked);
    const bonusReason = view.bonusReason || null;
    const buttons = AWARD_VIRTUES.map((v) => {
        const awarded = locked && view.todayReason === v.key;
        const bonus = bonusReason === v.key ? '<b class="aw-virtue__bonus" title="Bonus Day: +1 star for this virtue">+1</b>' : '';
        const earned = awarded ? `<b class="aw-virtue__earned" aria-hidden="true">${'★'.repeat(Math.max(1, Math.min(3, Math.round(Number(view.today) || 1))))}</b>` : '';
        return `<button type="button" class="reason-btn aw-virtue aw-virtue--${v.key}${awarded ? ' is-awarded' : ''}" data-reason="${v.key}" title="${esc(v.name)}: ${esc(v.hint)}" aria-pressed="false"${locked ? ' tabindex="-1"' : ''}>`
            + `<span class="aw-virtue__gem" aria-hidden="true"><i class="fas ${v.icon}"></i></span>`
            + `<span class="aw-virtue__label">${esc(v.name)}</span>${bonus}${earned}</button>`;
    }).join('');
    return `<div class="reason-selector aw-virtues${locked ? ' is-locked' : ''}" role="group" aria-label="Choose a virtue">${buttons}</div>`;
}

function starsHtml() {
    const buttons = AWARD_STAR_TIERS.map((t) => {
        const icons = '<i class="fas fa-star"></i>'.repeat(t.stars);
        return `<button type="button" data-stars="${t.stars}" class="star-award-btn aw-star aw-star--${t.stars}" aria-label="${esc(t.label)}" title="${esc(t.name)}: ${t.stars} star${t.stars === 1 ? '' : 's'}">`
            + `<span class="aw-star__glow" aria-hidden="true"></span><span class="aw-star__face"><span class="aw-star__icons">${icons}</span>`
            + `<span class="aw-star__name">${esc(t.name)}</span></span></button>`;
    }).join('');
    return `<div class="aw-stage">`
        + `<p class="aw-stage__hint" aria-hidden="true"><i class="fas fa-hand-pointer"></i> Pick a virtue, then the stars</p>`
        + `<div class="star-selector-container aw-stars" role="group" aria-label="How many stars">${buttons}</div>`
        + `</div>`;
}

/** The star buttons, or today's award once the cloud is sealed. */
export function buildAwardFinaleHtml(view) {
    return view.locked ? sealHtml(view) : starsHtml();
}

/** Today's award, shown in place of the star buttons once the cloud is sealed. */
function sealHtml(view) {
    const name = VIRTUE_NAMES[view.todayReason] || 'today';
    const stars = formatAwardStars(view.today);
    return `<div class="aw-seal" aria-live="polite"><span class="aw-seal__stars">+${esc(stars)} <i class="fas fa-star" aria-hidden="true"></i></span>`
        + `<span class="aw-seal__text">for ${esc(name)}</span></div>`;
}

/**
 * The attendance corner (present cloud) or the welcome desk (absent cloud).
 * mode: 'absent-offer' (can be marked absent), 'returning' (was away last lesson),
 * 'away-today' (marked absent today), 'away-no-lesson' (absent, no lesson today), 'none'.
 */
export function buildAwardAttendanceHtml(mode, firstName = '') {
    const who = esc(firstName || 'this hero');
    if (mode === 'absent-offer') {
        return `<button type="button" class="aw-att aw-att--away" data-action="mark-absent" title="Mark ${who} absent today" aria-label="Mark ${who} absent today">`
            + `<i class="fas fa-user-slash" aria-hidden="true"></i><span class="aw-att__tip">Absent</span></button>`;
    }
    if (mode === 'returning') {
        return `<div class="aw-desk aw-desk--returning"><p class="aw-desk__title"><i class="fas fa-cloud-sun" aria-hidden="true"></i> Away last lesson</p>`
            + `<button type="button" class="aw-desk__welcome" data-action="welcome-back" title="Welcome Back Bonus: stars for coming back">`
            + `<span class="aw-desk__sun" aria-hidden="true"></span><span class="aw-desk__welcome-text">Welcome back!</span><span class="aw-desk__welcome-gift">+<i class="fas fa-star"></i></span></button>`
            + `<div class="aw-desk__row"><button type="button" class="aw-desk__btn aw-desk__btn--present" data-action="mark-present" title="Mark present without a bonus"><i class="fas fa-user-check" aria-hidden="true"></i> Present</button>`
            + `<button type="button" class="aw-desk__btn aw-desk__btn--away" data-action="mark-absent" title="Still away today"><i class="fas fa-bed" aria-hidden="true"></i> Away today</button></div></div>`;
    }
    if (mode === 'away-today') {
        return `<div class="aw-desk aw-desk--away"><p class="aw-desk__title"><i class="fas fa-bed" aria-hidden="true"></i> Away today</p>`
            + `<div class="aw-desk__row"><button type="button" class="aw-desk__btn aw-desk__btn--present" data-action="mark-present" title="Undo: mark present"><i class="fas fa-rotate-left" aria-hidden="true"></i> Mark present</button></div></div>`;
    }
    if (mode === 'away-no-lesson') {
        return `<div class="aw-desk aw-desk--quiet"><p class="aw-desk__title"><i class="fas fa-cloud" aria-hidden="true"></i> Away last lesson</p>`
            + `<p class="aw-desk__note">Welcome them back on their next lesson day.</p></div>`;
    }
    return '';
}

/** Which attendance controls a cloud shows. */
export function resolveAwardAttendanceMode({ isVisuallyAbsent, isMarkedAbsentToday, classHasLessonToday, isCardLocked }) {
    if (isVisuallyAbsent) {
        if (isMarkedAbsentToday) return 'away-today';
        return classHasLessonToday ? 'returning' : 'away-no-lesson';
    }
    return !isCardLocked && classHasLessonToday ? 'absent-offer' : 'none';
}

export function buildAwardBoonButtonHtml(receiverId, { eligible, dailyLimitReached = false } = {}) {
    const title = eligible
        ? "Hero's Boon: a classmate gifts +½ star"
        : (dailyLimitReached ? 'Daily boon limit reached (4 today)' : "Not eligible for a Hero's Boon right now");
    return `<button type="button" class="boon-btn aw-boon ${eligible ? 'aw-boon--ready' : 'aw-boon--resting'}" data-receiver-id="${esc(receiverId)}" title="${esc(title)}" aria-label="${esc(title)}"${eligible ? '' : ' aria-disabled="true"'}>`
        + `<span class="aw-boon__heart" aria-hidden="true"><i class="fas fa-heart"></i></span>`
        + `${eligible ? '<span class="aw-boon__tag" aria-hidden="true">+½</span>' : ''}</button>`;
}

/**
 * One hero's cloud.
 * view: { id, name, firstName, avatar, guild {name, emblemUrl, color}, heroClass {title, icon, aura},
 *   levelUp, gold, today, month, total, todayReason, locked, attendanceMode, isAbsent,
 *   boon {eligible, dailyLimitReached}, honours {...}, bonusReason, familiarHtml, cloud, floatDelay, riseDelay }
 */
export function buildAwardCloudCardHtml(view) {
    const id = String(view.id);
    const locked = Boolean(view.locked);
    const isAbsent = Boolean(view.isAbsent);
    const honours = view.honours || {};
    const mode = view.attendanceMode || 'none';
    const cardClasses = [
        'student-cloud-card', 'aw-card',
        isAbsent ? 'is-absent' : '',
        locked ? 'is-locked' : '',
        honours.heroOfDay ? 'aw-card--hero' : '',
        honours.prodigy ? 'aw-card--prodigy' : '',
        honours.occasion ? 'aw-card--party' : ''
    ].filter(Boolean).join(' ');
    const deskOpen = isAbsent && mode !== 'none';
    const cornerAttendance = mode === 'absent-offer' ? buildAwardAttendanceHtml(mode, view.firstName) : '';
    const desk = deskOpen ? buildAwardAttendanceHtml(mode, view.firstName) : '';
    const honoursHtml = buildAwardHonoursHtml(honours);
    const rise = Number.isFinite(view.riseDelay) ? view.riseDelay : 0;
    const float = Number.isFinite(view.floatDelay) ? view.floatDelay : 0;

    return `<div class="award-card-mount tab-mount-rise" style="--tab-rise-delay:${rise}ms">`
        + `<article class="${cardClasses}" data-studentid="${esc(id)}" data-cloud="${esc(view.cloud || 'a')}"${locked && view.todayReason ? ` data-awarded="${esc(view.todayReason)}"` : ''} style="--aw-float-delay:-${float}ms" aria-label="${esc(view.name)}">`
        + `<div class="aw-card__lift">`
        + `<div class="aw-cloud" aria-hidden="true"><span class="aw-cloud__halo"></span>${buildAwardCloudSvg(view.cloud, id)}</div>`
        + `<div class="aw-card__corner aw-card__corner--left">${buildAwardBoonButtonHtml(id, view.boon || {})}</div>`
        + `<div class="aw-card__corner aw-card__corner--right"><div class="absence-controls">${cornerAttendance}</div>`
        + `<button type="button" id="post-award-undo-${esc(id)}" class="post-award-undo-btn aw-undo${locked ? '' : ' hidden'}" title="Undo today's award" aria-label="Undo today's award"><i class="fas fa-rotate-left" aria-hidden="true"></i><span class="aw-undo__tip">Undo</span></button></div>`
        + `<header class="aw-card__head">${familiarHtml(view)}${portraitHtml(view)}${purseHtml(view)}</header>`
        + `<div class="card-content-wrapper aw-card__body">`
        + `<div class="aw-card__nameplate">${heroRibbonHtml(view)}<h3 class="aw-card__name font-title">${esc(view.name)}</h3>`
        + `<div class="aw-card__honours">${honoursHtml}</div></div>`
        + tallyHtml(view)
        + `<div class="aw-card__desk">${desk}</div>`
        + buildAwardVirtuesHtml(view)
        + `<div class="aw-card__finale">${buildAwardFinaleHtml(view)}</div>`
        + `</div></div></article></div>`;
}

/** Today's award summary above the clouds: how much of the class shines, and any day bonus. */
export function buildAwardSkySummaryHtml({ shining = 0, heroes = 0, starsToday = 0, awaiting = 0, modifier = null } = {}) {
    const pct = heroes > 0 ? Math.round((shining / heroes) * 100) : 0;
    const dots = heroes > 0 && heroes <= 40
        ? Array.from({ length: heroes }, (_, i) => `<i class="aw-sky-summary__dot${i < shining ? ' is-lit' : ''}"></i>`).join('')
        : '';
    const mod = modifier?.type === 'double'
        ? '<span class="aw-sky-summary__mod aw-sky-summary__mod--double" title="Every award counts twice today"><i class="fas fa-bolt" aria-hidden="true"></i>2× Star Day</span>'
        : modifier?.type === 'reason' && VIRTUE_NAMES[modifier.reason]
            ? `<span class="aw-sky-summary__mod" title="${esc(VIRTUE_NAMES[modifier.reason])} awards get +1 star today"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>${esc(VIRTUE_NAMES[modifier.reason])} Bonus Day</span>`
            : '';
    const waiting = awaiting > 0
        ? `<span class="aw-sky-summary__note">${awaiting} still waiting for a star</span>`
        : (heroes > 0 ? '<span class="aw-sky-summary__note aw-sky-summary__note--full">Every hero is shining!</span>' : '');
    return `<div class="aw-sky-summary__main"><span class="aw-sky-summary__sigil" aria-hidden="true"><i class="fas fa-star"></i></span>`
        + `<span class="aw-sky-summary__count"><b>${shining}</b> of ${heroes} heroes shining</span>`
        + `<span class="aw-sky-summary__stars"><b>${esc(formatAwardStars(starsToday))}</b> <i class="fas fa-star" aria-hidden="true"></i> today</span>${mod}</div>`
        + `<div class="aw-sky-summary__track" role="img" aria-label="${pct}% of the class has a star today">${dots || `<span class="aw-sky-summary__bar" style="--pct:${pct}%"></span>`}</div>`
        + waiting;
}
