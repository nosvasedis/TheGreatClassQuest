// Home tab: the class party card (class virtue + a class photo of the heroes on the meadow).
// Pure markup, no app state, so the guidebook capture renders the same card
// (docs/product/guidebook/capture/fill-surfaces.js). Styles: styles/home_party.css.

/** Every reason a star can carry, with the crest icon and colour family it shows on the card. */
const VIRTUES = {
    teamwork: { icon: 'fa-users', name: 'Teamwork', tone: 'violet' },
    creativity: { icon: 'fa-lightbulb', name: 'Creativity', tone: 'rose' },
    respect: { icon: 'fa-hands-helping', name: 'Respect', tone: 'emerald' },
    focus: { icon: 'fa-brain', name: 'Focus', tone: 'amber' },
    welcome_back: { icon: 'fa-hand-sparkles', name: 'Welcome', tone: 'sky' },
    story_weaver: { icon: 'fa-feather-alt', name: 'Story', tone: 'cyan' },
    scholar_s_bonus: { icon: 'fa-graduation-cap', name: 'Scholar', tone: 'orange' }
};

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function virtueInfo(key) {
    return VIRTUES[key] || { icon: 'fa-star', name: String(key || '').replace(/_/g, ' '), tone: 'slate' };
}

function formatStars(n) {
    const v = Math.round((Number(n) || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** How the photo stands the class: rows of heroes, back rows first, the front row the fullest. */
export function arrangePartyRows(count) {
    if (count <= 0) return [];
    const rows = count <= 7 ? 1 : count <= 16 ? 2 : 3;
    const base = Math.floor(count / rows);
    let extra = count % rows;
    // Front rows take the leftovers, so the back row is never wider than the front.
    const sizes = Array.from({ length: rows }, () => base);
    for (let i = rows - 1; extra > 0; i -= 1, extra -= 1) sizes[i] += 1;
    return sizes;
}

function heroHtml(s, index, { leadId, absent }) {
    const name = String(s.name || '');
    const first = name.split(' ')[0] || name;
    const stars = formatStars(s.monthlyStars);
    const isAbsent = absent.has(s.id);
    const label = isAbsent ? `${name} — away today` : `${name} (${stars} ⭐)`;
    const inner = s.avatar
        ? `<img src="${esc(s.avatar)}" alt="${esc(name)}" loading="lazy" decoding="async" class="home-party__avatar enlargeable-avatar" data-student-id="${esc(s.id)}" title="${esc(label)}">`
        : `<div class="home-party__avatar home-party__avatar--initial enlargeable-avatar" data-student-id="${esc(s.id)}" title="${esc(label)}">${esc(name.charAt(0))}</div>`;
    // Same markup as ui/core/avatar.js wrapAvatarWithLevelUpIndicator.
    const avatar = s.pendingSkillChoice
        ? `<div class="avatar-with-level-up-wrap"><span class="level-up-badge" aria-hidden="true" title="Level up! Assign skill in Skill Tree"><i class="fas fa-arrow-up"></i></span>${inner}</div>`
        : inner;
    const lead = s.id === leadId
        ? '<span class="home-party__lead" title="Most stars this month" aria-hidden="true"><i class="fas fa-star"></i></span>'
        : '';
    // Away today: a small grey cloud, the same language the Award Stars card uses.
    const away = isAbsent
        ? '<span class="home-party__away" title="Away today" aria-hidden="true"><i class="fas fa-cloud-rain"></i></span>'
        : '';
    const tag = isAbsent
        ? `<span class="home-party__tag home-party__tag--away" aria-hidden="true">${esc(first)} <b>away</b></span>`
        : `<span class="home-party__tag" aria-hidden="true">${esc(first)} <b>${stars}★</b></span>`;
    const classes = `home-party__hero${s.id === leadId ? ' is-lead' : ''}${isAbsent ? ' is-absent' : ''}`;
    return `<div class="${classes}" style="--i:${index}">${lead}${away}${avatar}${tag}</div>`;
}

function meadowSvg() {
    return `
        <svg class="home-party__meadow" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path class="home-party__hill home-party__hill--back" d="M0 46 C 60 30, 110 26, 170 38 C 230 50, 280 22, 340 24 C 370 25, 390 32, 400 36 L400 120 L0 120 Z"/>
            <path class="home-party__hill home-party__hill--front" d="M0 70 C 50 58, 120 52, 200 60 C 280 68, 340 54, 400 60 L400 120 L0 120 Z"/>
        </svg>`;
}

/**
 * @param {object} p
 * @param {{id:string,name:string,avatar?:string,monthlyStars?:number,pendingSkillChoice?:boolean}[]} p.students
 * @param {Record<string, number>} p.virtueStars stars per award reason for this class
 * @param {(string[]|Set<string>)} [p.absentIds] students away today, shown greyed out
 */
export function buildHomePartyCardHtml({ students = [], virtueStars = {}, absentIds = [] } = {}) {
    const absent = absentIds instanceof Set ? absentIds : new Set(absentIds);
    const heroes = [...students].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const ranked = Object.entries(virtueStars || {})
        .filter(([key, n]) => key && Number(n) > 0)
        .sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, [, n]) => sum + Number(n), 0);
    const [topKey, topStars] = ranked[0] || [];
    const top = topKey ? virtueInfo(topKey) : null;

    const crest = top
        ? `<div class="home-party__crest" aria-hidden="true"><i class="fas ${top.icon}"></i></div>
           <div class="home-party__virtue">
               <span class="home-party__eyebrow">Class virtue</span>
               <span class="home-party__name font-title">${esc(top.name)}</span>
               <span class="home-party__sub">${formatStars(topStars)} of ${formatStars(total)} stars</span>
           </div>`
        : `<div class="home-party__crest home-party__crest--compass" aria-hidden="true"><i class="fas fa-compass"></i></div>
           <div class="home-party__virtue">
               <span class="home-party__eyebrow">Class virtue</span>
               <span class="home-party__name font-title">Ready to Quest!</span>
               <span class="home-party__sub">The first stars pick it</span>
           </div>`;

    // Up to four named virtues on the ribbon; anything smaller joins a grey tail.
    const shown = ranked.slice(0, 4);
    const rest = ranked.slice(4).reduce((sum, [, n]) => sum + Number(n), 0);
    const ribbon = total > 0
        ? `<div class="home-party__ribbon" role="img" aria-label="${esc(shown.map(([k, n]) => `${virtueInfo(k).name} ${formatStars(n)} stars`).join(', '))}">
               ${shown.map(([k, n]) => `<span class="home-party__seg" data-tone="${virtueInfo(k).tone}" style="flex-grow:${Number(n)}" title="${esc(virtueInfo(k).name)}: ${formatStars(n)} ⭐"></span>`).join('')}
               ${rest > 0 ? `<span class="home-party__seg" data-tone="slate" style="flex-grow:${rest}" title="Other: ${formatStars(rest)} ⭐"></span>` : ''}
           </div>`
        : '<div class="home-party__ribbon home-party__ribbon--empty" aria-hidden="true"></div>';

    const leader = heroes.reduce((best, s) => ((Number(s.monthlyStars) || 0) > (Number(best?.monthlyStars) || 0) ? s : best), null);
    const leadId = leader && Number(leader.monthlyStars) > 0 ? leader.id : null;

    let photo;
    if (heroes.length) {
        const sizes = arrangePartyRows(heroes.length);
        const widest = Math.max(...sizes);
        let at = 0;
        const rows = sizes.map((n, r) => {
            const row = heroes.slice(at, at + n).map((s, k) => heroHtml(s, at + k, { leadId, absent })).join('');
            at += n;
            // Equal rows would hide the back row behind the front one: shift it half a portrait.
            const stagger = r < sizes.length - 1 && sizes[r + 1] === n ? ' is-staggered' : '';
            return `<div class="home-party__row${stagger}" style="--row:${r};--rows:${sizes.length}">${row}</div>`;
        }).join('');
        photo = `<div class="home-party__photo" style="--per-row:${widest};--rows:${sizes.length}">${rows}</div>`;
    } else {
        photo = '<div class="home-party__photo home-party__photo--empty"><span>No heroes on the roster yet</span></div>';
    }

    const count = heroes.length;
    const awayCount = heroes.filter(s => absent.has(s.id)).length;
    const awayPill = awayCount > 0
        ? `<span class="home-party__count home-party__count--away" title="${awayCount} away today"><i class="fas fa-cloud-rain"></i>${awayCount}<span class="home-party__count-label">away</span></span>`
        : '';
    return `
        <div class="vibrant-card h-span-4 home-party" data-virtue="${top ? top.tone : 'meadow'}">
            <div class="home-party__sky" aria-hidden="true"><span class="home-party__sun"></span></div>
            <div class="home-party__head">
                ${crest}
                <span class="home-party__count" title="Heroes on the roster"><i class="fas fa-user-friends"></i>${count}<span class="home-party__count-label">${count === 1 ? 'hero' : 'heroes'}</span></span>
                ${awayPill}
            </div>
            ${ribbon}
            <div class="home-party__stage">
                ${meadowSvg()}
                ${photo}
            </div>
        </div>`;
}
