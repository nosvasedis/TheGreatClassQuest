// ui/core/heroStageView.mjs — HTML for the Hero Stage (the hero card under an enlarged avatar).
// Pure: no state, no DOM. `ui/core/avatar.js` gathers the data and wires the clicks.
// Every fact shows once: name + class/guild chips, three star/Gold medallions, the Hero Path
// road to the next level, spells working now, and a peek into the Satchel (the peek itself
// opens the Satchel; each tile opens the item close-up, where relics and charms are used).
import { legendaryArtSvg } from '../../features/legendaryArt.mjs';

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

export const STAGE_TILE_LIMIT = 7;

/** One of the three book-like doors at the foot of the Hero Stage. */
function stageActionHtml(action, tone, icon, title, hint) {
    return `<button type="button" class="hs-btn hs-btn--${tone}" data-hs-action="${action}">
                    <span class="hs-btn__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
                    <span class="hs-btn__text"><b>${escStage(title)}</b><small>${escStage(hint)}</small></span>
                </button>`;
}

/**
 * Tiles for the Satchel peek: every relic stack first (ready to use), then the newest treasures.
 * `readyCharms` holds inventory indices whose treasure charm is awake. Returns { tiles, more }.
 */
export function stageSatchelTiles(satchel, { limit = STAGE_TILE_LIMIT, readyCharms = [] } = {}) {
    const awake = new Set(readyCharms);
    const relics = (Array.isArray(satchel?.relics) ? satchel.relics : []).map((r) => ({
        index: r.indices?.[0] ?? 0, name: r.name, artId: r.artId, icon: r.icon, image: r.image,
        count: r.count || 1, kind: 'relic', ready: true,
    }));
    const treasures = (Array.isArray(satchel?.treasures) ? satchel.treasures : []).map((t) => ({
        index: t.index, name: t.name, icon: t.icon, image: t.image, artId: '', count: 1,
        kind: t.kind === 'keepsake' ? 'keepsake' : 'treasure', tier: t.tier || '',
        ready: awake.has(t.index),
    }));
    const all = [...relics, ...treasures];
    const cap = Math.max(0, Math.floor(Number(limit) || 0));
    // A lone extra tile is better shown than hidden behind "+1".
    const shown = all.length <= cap + 1 ? all : all.slice(0, cap);
    return { tiles: shown, more: all.length - shown.length };
}

function artHtml(item) {
    const art = item.artId ? legendaryArtSvg(item.artId, { className: 'lg-art lg-art--stage' }) : '';
    if (art) return art;
    if (item.image) return `<img src="${escStage(item.image)}" alt="" loading="lazy" draggable="false">`;
    return `<span class="hs-emoji" aria-hidden="true">${escStage(item.icon || '📦')}</span>`;
}

function tileHtml(tile, i) {
    const kindClass = tile.kind === 'relic' ? ' is-relic' : tile.kind === 'keepsake' ? ' is-keepsake' : '';
    const tierClass = tile.tier ? ` is-${escStage(tile.tier)}` : '';
    const readyWord = tile.ready ? (tile.kind === 'relic' ? ', ready to use' : ', charm awake') : '';
    return `
        <li style="--i:${i}">
            <button type="button" class="hs-tile${kindClass}${tierClass}${tile.ready ? ' is-ready' : ''}" data-hs-zoom="${tile.index}"
                title="${escStage(tile.name)}" aria-label="Look closer at ${escStage(tile.name)}${readyWord}">
                ${artHtml(tile)}
                ${tile.count > 1 ? `<span class="hs-stack">×${tile.count}</span>` : ''}
                ${tile.ready ? `<span class="hs-ready" aria-hidden="true"><i class="fas ${tile.kind === 'relic' ? 'fa-bolt' : 'fa-hand-sparkles'}"></i></span>` : ''}
            </button>
        </li>`;
}

function bagSvg() {
    return `<svg class="hs-bag" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
        <path class="hs-bag-strap" d="M18 22 C18 4 46 4 46 22" />
        <rect class="hs-bag-body" x="6" y="19" width="52" height="36" rx="9" />
        <path class="hs-bag-flap" d="M6 28 Q6 19 15 19 H49 Q58 19 58 28 V36 Q32 47 6 36 Z" />
        <path class="hs-bag-stitch" d="M11 28 Q11 23 16 23 H48 Q53 23 53 28 V34 Q32 43 11 34 Z" />
        <rect class="hs-bag-buckle" x="27" y="33" width="10" height="9" rx="2" />
    </svg>`;
}

function medalHtml({ tone, icon, value, label, extra = '' }) {
    const n = formatStageNumber(value);
    return `
        <div class="hs-medal hs-medal--${tone}" role="listitem">
            <span class="hs-medal-icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <b data-hs-count="${n}">${n}</b>
            <span class="hs-medal-label">${label}</span>
            ${extra}
        </div>`;
}

function pathHtml(path) {
    if (!path) return '';
    const p = path.progress || {};
    const pct = Math.max(0, Math.min(1, Number(p.pct) || 0));
    const head = `<span class="hs-path-icon" aria-hidden="true">${escStage(path.icon)}</span>
        <span class="hs-path-name"><b>${escStage(path.name)} Path</b><small>${path.level > 0 ? `Level ${path.level} · ${escStage(path.title)}` : 'Starting out'}</small></span>`;
    let road;
    if (p.mastered) {
        road = `<p class="hs-path-note"><i class="fas fa-crown" aria-hidden="true"></i> Path mastered. Every level is won.</p>`;
    } else if (p.nextLevel) {
        const toNext = formatStageNumber(p.toNext);
        road = `
            <div class="hs-path-road" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}"
                aria-label="Progress to level ${p.nextLevel}">
                <span class="hs-path-fill" style="--pct:${pct.toFixed(3)}"></span>
                <span class="hs-path-goal" aria-hidden="true">${p.nextLevel}</span>
            </div>
            <p class="hs-path-note">${toNext} more ${escStage(p.reasonLabel || '')} star${toNext === '1' ? '' : 's'} to <b>${escStage(p.nextTitle || `Level ${p.nextLevel}`)}</b></p>`;
    } else {
        road = '';
    }
    return `<section class="hs-path" style="--hs-path:${escStage(path.color || '#a78bfa')}" aria-label="Hero Path">
            <div class="hs-path-head">${head}</div>
            ${road}
        </section>`;
}

/** Stars, Gold, spells working now and the Satchel peek: the part that re-renders after an item is used. */
export function renderHeroStageBodyHtml({ stats = {}, path = null, effects = [], satchel = { tiles: [], more: 0 }, total = 0, ready = 0, firstName = 'This hero' }) {
    const today = Number(stats.todayStars) || 0;
    const statsHtml = `
        <div class="hs-medals" role="list" aria-label="Stars and Gold">
            ${medalHtml({ tone: 'star', icon: 'fa-star', value: stats.monthlyStars, label: 'This month',
                extra: today > 0 ? `<span class="hs-today">+${formatStageNumber(today)} today</span>` : '' })}
            ${medalHtml({ tone: 'year', icon: 'fa-medal', value: stats.totalStars, label: 'This year' })}
            ${medalHtml({ tone: 'gold', icon: 'fa-coins', value: stats.gold, label: 'Gold' })}
        </div>`;

    const effectsHtml = effects.length ? `
        <section class="hs-spells" aria-label="Working now">
            <p class="hs-label"><i class="fas fa-hat-wizard" aria-hidden="true"></i>Working now</p>
            <ul>${effects.map((e, i) => `
                <li style="--i:${i}"><span class="hs-spell-art" aria-hidden="true">${(e.artId && legendaryArtSvg(e.artId)) || escStage(e.icon)}</span><span class="hs-spell-text"><b>${escStage(e.title)}</b><small>${escStage(e.body)}</small></span></li>`).join('')}
            </ul>
        </section>` : '';

    const name = `${escStage(firstName)}'s Satchel`;
    const sub = total === 0
        ? 'Empty for now'
        : `${total} item${total === 1 ? '' : 's'}${ready > 0 ? ` · <em><i class="fas fa-bolt" aria-hidden="true"></i> ${ready} ready to use</em>` : ''}`;
    const pocket = total === 0
        ? `<p class="hs-pocket-empty">Relics, quiz prizes and kept promises will sparkle here.</p>`
        : `<ul class="hs-pocket">${satchel.tiles.map(tileHtml).join('')}${satchel.more > 0
            ? `<li style="--i:${satchel.tiles.length}"><button type="button" class="hs-tile hs-tile--more" data-hs-action="vault" aria-label="${satchel.more} more in the Satchel">+${satchel.more}</button></li>`
            : ''}</ul>`;

    return `
        ${statsHtml}
        ${pathHtml(path)}
        ${effectsHtml}
        <section class="hs-satchel" aria-label="Satchel">
            <button type="button" class="hs-satchel-head" data-hs-action="vault">
                ${bagSvg()}
                <span class="hs-satchel-title"><b class="font-title">${name}</b><small>${sub}</small></span>
                <span class="hs-open">Open <i class="fas fa-chevron-right" aria-hidden="true"></i></span>
            </button>
            ${pocket}
        </section>`;
}

/**
 * The whole Hero Stage card.
 * @param {{ student: {id:string,name:string}, classLabel?: string,
 *   path?: {icon:string,name:string,title:string,level:number,color?:string,progress?:object}|null,
 *   guild?: {name:string,emoji?:string,primary:string}|null,
 *   pendingSkillChoice?: boolean, hasFamiliar?: boolean, showSkillTree?: boolean, showFolio?: boolean,
 *   stats: {monthlyStars:number,totalStars:number,gold:number,todayStars?:number}, effects?: Array,
 *   satchel: {tiles:Array,more:number}, total: number, ready?: number }} view
 */
export function renderHeroStageHtml(view) {
    const { student, classLabel = '', path = null, guild = null, pendingSkillChoice = false, hasFamiliar = false, showSkillTree = true, showFolio = false } = view;
    const firstName = String(student.name || 'Hero').trim().split(/\s+/)[0] || 'Hero';
    const titleId = `hs-name-${escStage(student.id)}`;

    const chips = [
        classLabel ? `<span class="hs-chip">${escStage(classLabel)}</span>` : '',
        guild ? `<span class="hs-chip hs-chip--guild" style="--hs-guild:${escStage(guild.primary)}">${escStage(guild.emoji || '🛡️')} ${escStage(guild.name)}</span>` : '',
    ].join('');

    const pennants = guild
        ? `<span class="hs-pennant hs-pennant--l" aria-hidden="true"><i>${escStage(guild.emoji || '🛡️')}</i></span><span class="hs-pennant hs-pennant--r" aria-hidden="true"><i>${escStage(guild.emoji || '🛡️')}</i></span>`
        : '';

    const styleVars = [
        guild ? `--hs-accent:${escStage(guild.primary)}` : '',
        path?.color ? `--hs-aura:${escStage(path.color)}` : '',
    ].filter(Boolean).join(';');

    return `
        <div class="hs-card" role="dialog" aria-modal="true" aria-labelledby="${titleId}" data-student-id="${escStage(student.id)}"
            ${styleVars ? `style="${styleVars}"` : ''}>
            <div class="hs-sky" aria-hidden="true">
                <span class="hs-aurora"></span>
                <span class="hs-star"></span><span class="hs-star"></span><span class="hs-star"></span><span class="hs-star"></span><span class="hs-star"></span><span class="hs-star"></span>
                <span class="hs-shooting"></span>
                <span class="hs-hills"></span>
                ${pennants}
            </div>
            <button type="button" class="hs-close" data-hs-action="close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <div class="hs-portrait-slot" data-hs-portrait>
                <span class="hs-aura" aria-hidden="true"></span>
                <svg class="hs-runes" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
                    <circle cx="100" cy="100" r="96" class="hs-runes-dash" />
                    <circle cx="100" cy="100" r="90" class="hs-runes-line" />
                </svg>
                ${hasFamiliar ? `<button type="button" class="hs-familiar" data-hs-action="familiar" aria-label="Meet ${escStage(firstName)}'s Familiar" title="${escStage(firstName)}'s Familiar"></button>` : ''}
            </div>
            <div class="hs-id">
                <h2 id="${titleId}" class="hs-name font-title">${escStage(student.name)}</h2>
                ${chips ? `<div class="hs-chips">${chips}</div>` : ''}
            </div>
            <div class="hs-body" data-hs-body>
                ${renderHeroStageBodyHtml({ ...view, firstName })}
            </div>
            <footer class="hs-actions">
                ${stageActionHtml('stats', 'sky', 'fa-chart-line', 'Hero Stats', 'The year in stars')}
                ${showFolio ? stageActionHtml('folio', 'scroll', 'fa-book-open', 'Scholar\u2019s Folio', 'Trials and marks') : ''}
                ${showSkillTree ? stageActionHtml('skills', `violet${pendingSkillChoice ? ' is-levelup' : ''}`, pendingSkillChoice ? 'fa-arrow-up' : 'fa-sitemap',
                    'Skill Tree', pendingSkillChoice ? 'Level up! Pick a skill' : 'Path and skills') : ''}
            </footer>
        </div>`;
}
