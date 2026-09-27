// ui/core/heroStageView.mjs — HTML for the Hero Stage (the card under an enlarged avatar).
// Pure: no state, no DOM. `ui/core/avatar.js` gathers the data and wires the clicks.

export function escStage(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** 12 → "12", 12.5 → "12.5", junk → "0". */
export function formatStageNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n * 10) / 10);
}

function artHtml(item) {
    if (item.image) return `<img src="${escStage(item.image)}" alt="" loading="lazy" draggable="false">`;
    return `<span class="hs-emoji" aria-hidden="true">${escStage(item.icon || '📦')}</span>`;
}

function relicHtml(relic) {
    const index = relic.indices[0];
    return `
        <li class="hs-relic">
            <button type="button" class="hs-relic-art" data-hs-zoom="${index}" aria-label="Look closer at ${escStage(relic.name)}">
                ${artHtml(relic)}
                ${relic.count > 1 ? `<span class="hs-stack">×${relic.count}</span>` : ''}
            </button>
            <span class="hs-relic-text">
                <b>${escStage(relic.name)}</b>
                <small>${escStage(relic.description || 'A relic with a single use.')}</small>
            </span>
            <button type="button" class="hs-use-btn" data-hs-use="${index}" aria-label="Use ${escStage(relic.name)}">
                <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>Use</span>
            </button>
        </li>`;
}

function treasureHtml(treasure) {
    const meta = [treasure.sourceLabel, treasure.acquiredLabel].filter(Boolean).join(' · ');
    return `
        <li>
            <button type="button" class="hs-treasure${treasure.kind === 'keepsake' ? ' is-keepsake' : ''}" data-hs-zoom="${treasure.index}"
                title="${escStage(treasure.name)}${meta ? ` · ${escStage(meta)}` : ''}" aria-label="Look closer at ${escStage(treasure.name)}">
                ${artHtml(treasure)}
            </button>
        </li>`;
}

/** Stats, effects and satchel: the part that re-renders after a relic is used. */
export function renderHeroStageBodyHtml({ stats, effects = [], preview, total = 0, firstName = 'This hero' }) {
    const statsHtml = `
        <div class="hs-stats" role="list" aria-label="Hero at a glance">
            <div class="hs-stat hs-stat--star" role="listitem"><i class="fas fa-star" aria-hidden="true"></i><b>${formatStageNumber(stats.monthlyStars)}</b><span>Stars this month</span></div>
            <div class="hs-stat hs-stat--medal" role="listitem"><i class="fas fa-medal" aria-hidden="true"></i><b>${formatStageNumber(stats.totalStars)}</b><span>Stars all year</span></div>
            <div class="hs-stat hs-stat--gold" role="listitem"><i class="fas fa-coins" aria-hidden="true"></i><b>${formatStageNumber(stats.gold)}</b><span>Gold</span></div>
        </div>`;

    const effectsHtml = effects.length ? `
        <section class="hs-effects" aria-label="Working now">
            <p class="hs-label"><i class="fas fa-hat-wizard" aria-hidden="true"></i>Working now</p>
            <ul>${effects.map((e) => `
                <li title="${escStage(e.body)}"><span aria-hidden="true">${escStage(e.icon)}</span><b>${escStage(e.title)}</b><small>${escStage(e.body)}</small></li>`).join('')}
            </ul>
        </section>` : '';

    let satchelHtml;
    if (total === 0) {
        satchelHtml = `
            <div class="hs-empty">
                <span class="hs-empty-art" aria-hidden="true">🎒</span>
                <b>The satchel is waiting</b>
                <p>${escStage(firstName)}'s relics, quiz prizes and kept oaths will sparkle here.</p>
            </div>`;
    } else {
        const { relics, treasures, moreTreasures } = preview;
        const relicsHtml = relics.length ? `
            <p class="hs-label"><i class="fas fa-bolt" aria-hidden="true"></i>Relics · ready to use</p>
            <ul class="hs-relics">${relics.map(relicHtml).join('')}</ul>` : '';
        const moreTile = moreTreasures > 0
            ? `<li><button type="button" class="hs-treasure hs-treasure--more" data-hs-action="vault" aria-label="${moreTreasures} more in the Treasure Vault">+${moreTreasures}</button></li>`
            : '';
        const treasuresHtml = treasures.length ? `
            <p class="hs-label"><i class="fas fa-gem" aria-hidden="true"></i>Treasures · kept for good</p>
            <ul class="hs-treasures">${treasures.map(treasureHtml).join('')}${moreTile}</ul>` : '';
        satchelHtml = relicsHtml + treasuresHtml;
    }

    return `
        ${statsHtml}
        ${effectsHtml}
        <section class="hs-satchel" aria-label="Satchel">
            <header class="hs-satchel-head">
                <h3 class="font-title"><i class="fas fa-bag-shopping" aria-hidden="true"></i> Satchel</h3>
                <span class="hs-count">${total} item${total === 1 ? '' : 's'}</span>
            </header>
            ${satchelHtml}
        </section>`;
}

/**
 * The whole Hero Stage card.
 * @param {{ student: {id:string,name:string}, classLabel?: string,
 *   path?: {icon:string,title:string,level:number}|null, guild?: {name:string,emoji?:string,primary:string}|null,
 *   pendingSkillChoice?: boolean, hasFamiliar?: boolean, showSkillTree?: boolean,
 *   stats: {monthlyStars:number,totalStars:number,gold:number}, effects?: Array, preview: object, total: number }} view
 */
export function renderHeroStageHtml(view) {
    const { student, classLabel = '', path = null, guild = null, pendingSkillChoice = false, hasFamiliar = false, showSkillTree = true } = view;
    const firstName = String(student.name || 'Hero').trim().split(/\s+/)[0] || 'Hero';
    const titleId = `hs-name-${escStage(student.id)}`;

    const chips = [
        classLabel ? `<span class="hs-chip">${escStage(classLabel)}</span>` : '',
        path ? `<span class="hs-chip hs-chip--path">${escStage(path.icon)} ${escStage(path.title)}${path.level > 0 ? ` · Lv ${path.level}` : ''}</span>` : '',
        guild ? `<span class="hs-chip hs-chip--guild" style="--hs-guild:${escStage(guild.primary)}">${escStage(guild.emoji || '🛡️')} ${escStage(guild.name)}</span>` : '',
    ].join('');

    const levelUp = pendingSkillChoice
        ? `<button type="button" class="hs-levelup" data-hs-action="skills"><i class="fas fa-arrow-up" aria-hidden="true"></i> Level up! Choose a new skill</button>`
        : '';

    return `
        <div class="hs-card" role="dialog" aria-modal="true" aria-labelledby="${titleId}" data-student-id="${escStage(student.id)}"
            ${guild ? `style="--hs-accent:${escStage(guild.primary)}"` : ''}>
            <div class="hs-banner" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
            <button type="button" class="hs-close" data-hs-action="close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <div class="hs-portrait-slot" data-hs-portrait>
                <span class="hs-aura" aria-hidden="true"></span>
                ${hasFamiliar ? `<button type="button" class="hs-familiar" data-hs-action="familiar" aria-label="Meet ${escStage(firstName)}'s Familiar" title="Familiar"></button>` : ''}
            </div>
            <div class="hs-id">
                <h2 id="${titleId}" class="hs-name font-title">${escStage(student.name)}</h2>
                ${chips ? `<div class="hs-chips">${chips}</div>` : ''}
                ${levelUp}
            </div>
            <div class="hs-body" data-hs-body>
                ${renderHeroStageBodyHtml({ ...view, firstName })}
            </div>
            <footer class="hs-actions">
                <button type="button" class="hs-btn hs-btn--gold" data-hs-action="vault"><i class="fas fa-gem" aria-hidden="true"></i><span>Treasure Vault</span></button>
                <button type="button" class="hs-btn hs-btn--sky" data-hs-action="stats"><i class="fas fa-chart-line" aria-hidden="true"></i><span>Hero stats</span></button>
                ${showSkillTree ? `<button type="button" class="hs-btn hs-btn--violet" data-hs-action="skills"><i class="fas fa-sitemap" aria-hidden="true"></i><span>Skill Tree</span></button>` : ''}
            </footer>
        </div>`;
}
