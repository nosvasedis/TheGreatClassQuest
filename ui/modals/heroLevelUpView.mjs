// The hero level-up moment: the model and markup (no DOM, so it can be tested in node).
// The modal itself, its timeline and sparks live in ui/modals/heroLevelUp.js;
// styles in styles/hero_level_up.css (.hlu-*).
import { escapeHtml as esc } from '../../utils/html.mjs';

/** When each piece arrives, in ms from opening. The burst is the moment the new level lights. */
export const HLU_TIMELINE = Object.freeze({
    medal: 180,
    ladder: 620,
    burst: 1450,
    ribbon: 1800,
    details: 2150,
    actions: 2400,
    done: 2900
});

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '124, 58, 237';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Everything the moment shows, from the level-up info and the hero's skill tree.
 * `tree` is HERO_SKILL_TREE[heroClass] (titles, levels, auraColor).
 */
export function buildHeroLevelUpModel({ studentName, newHeroLevel, heroClass, avatar = '', classIcon = '', tree = null, waiting = 0 } = {}) {
    const name = String(studentName || 'Hero').trim() || 'Hero';
    const levels = Math.max(1, tree?.levels?.length || tree?.titles?.length || 1);
    const level = Math.min(levels, Math.max(1, Math.floor(Number(newHeroLevel) || 1)));
    const titles = tree?.titles || [];
    const title = titles[level - 1] || heroClass || 'Hero';
    const branches = tree?.levels?.[level - 1]?.branches || [];
    return {
        name,
        initial: name.charAt(0).toUpperCase(),
        avatar: String(avatar || ''),
        heroClass: String(heroClass || ''),
        icon: classIcon || '⚔️',
        aura: tree?.auraColor || '#7c3aed',
        auraRgb: hexToRgb(tree?.auraColor),
        level,
        levels,
        title,
        prevTitle: level > 1 ? (titles[level - 2] || '') : '',
        isMax: level >= levels,
        paths: branches.slice(0, 2).map((b) => ({ icon: b.icon || '✨', name: b.name || '' })),
        waiting: Math.max(0, Math.floor(Number(waiting) || 0))
    };
}

/** When each rung of the ladder lights: the old ones climb quickly, the new one lights at the burst. */
export function ladderDelays(level, t = HLU_TIMELINE) {
    const held = Math.max(0, level - 1);
    const span = t.burst - t.ladder - 260;
    const step = held > 0 ? Math.min(150, span / held) : 0;
    return Array.from({ length: level }, (_, i) => (i < held ? Math.round(t.ladder + 140 + i * step) : t.burst));
}

const KICKER = 'LEVEL UP!';

/** The line under the buttons when more heroes levelled up at the same time. */
export function waitingText(count) {
    return count === 1 ? 'One more hero levelled up too!' : `${count} more heroes levelled up too!`;
}

export function buildHeroLevelUpHtml(model, t = HLU_TIMELINE) {
    const m = model;
    const delays = ladderDelays(m.level, t);
    const face = m.avatar
        ? `<img src="${esc(m.avatar)}" alt="" class="hlu-medal__img" decoding="async">`
        : `<span class="hlu-medal__initial">${esc(m.initial)}</span>`;
    const kicker = [...KICKER].map((ch, i) =>
        `<span style="--d:${t.burst + 60 + i * 45}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    const ladder = Array.from({ length: m.levels }, (_, i) => {
        const n = i + 1;
        const cls = n < m.level ? 'is-held' : n === m.level ? 'is-new' : 'is-ahead';
        const d = n <= m.level ? ` style="--d:${delays[i]}ms"` : '';
        return `<li class="hlu-rung ${cls}"${d}><span class="hlu-rung__gem"></span></li>`;
    }).join('<li class="hlu-rung__link" aria-hidden="true"></li>');
    const sub = m.isMax
        ? `The highest rank a ${esc(m.heroClass)} can reach!`
        : `${esc(m.heroClass)} · Level ${m.level} of ${m.levels}`;
    const paths = m.paths.length
        ? `<div class="hlu-paths" style="--d:${t.details}ms">
                <p class="hlu-paths__lead">A new skill is waiting. Choose one path:</p>
                <div class="hlu-paths__row">
                    ${m.paths.map((p, i) => `${i ? '<span class="hlu-paths__or">or</span>' : ''}<span class="hlu-path"><span class="hlu-path__icon" aria-hidden="true">${esc(p.icon)}</span>${esc(p.name)}</span>`).join('')}
                </div>
            </div>`
        : `<p class="hlu-paths hlu-paths__lead" style="--d:${t.details}ms">A new skill is waiting in the Skill Tree!</p>`;
    const waiting = m.waiting
        ? `<p class="hlu-queue" style="--d:${t.actions}ms">${waitingText(m.waiting)}</p>`
        : '';
    const later = m.waiting ? 'Next hero' : 'Later';
    return `
        <div class="hlu-veil" data-hlu-backdrop></div>
        <div class="hlu-sky" aria-hidden="true"><span class="hlu-stars"></span><span class="hlu-stars hlu-stars--twinkle"></span></div>
        <div class="hlu-stage" data-hlu-backdrop>
            <div class="hlu-hero">
                <span class="hlu-rays" aria-hidden="true"></span>
                <p class="hlu-kicker" aria-hidden="true">${kicker}</p>
                <div class="hlu-medal" style="--d:${t.medal}ms">
                    <span class="hlu-medal__glow" aria-hidden="true"></span>
                    <span class="hlu-medal__wave" aria-hidden="true"></span>
                    <span class="hlu-medal__wave hlu-medal__wave--2" aria-hidden="true"></span>
                    <span class="hlu-medal__ring" aria-hidden="true"></span>
                    <span class="hlu-medal__face">${face}</span>
                    <span class="hlu-gem" aria-hidden="true"><span class="hlu-gem__old">${m.level - 1 || ''}</span><span class="hlu-gem__new">${m.level}</span></span>
                </div>
            </div>
            <h2 id="hlu-title" class="hlu-name" style="--d:${t.ladder}ms"><span class="hlu-sr">Level up! </span>${esc(m.name)}</h2>
            <ol class="hlu-ladder" style="--d:${t.ladder}ms" aria-label="Level ${m.level} of ${m.levels}">${ladder}</ol>
            <div class="hlu-ribbon${m.isMax ? ' hlu-ribbon--max' : ''}" style="--d:${t.ribbon}ms">
                <span class="hlu-ribbon__body"><span class="hlu-ribbon__icon" aria-hidden="true">${m.isMax ? '👑' : esc(m.icon)}</span><span class="hlu-ribbon__title">${esc(m.title)}</span></span>
            </div>
            <p class="hlu-sub" style="--d:${t.ribbon + 160}ms">${sub}</p>
            ${paths}
            <div class="hlu-actions" style="--d:${t.actions}ms">
                <button type="button" id="hero-level-up-skill-tree-btn" class="hlu-btn hlu-btn--gold" data-hlu="skills"><i class="fas fa-sitemap" aria-hidden="true"></i> Choose a skill</button>
                <button type="button" id="hero-level-up-close-btn" class="hlu-btn hlu-btn--ghost" data-hlu="later">${later}</button>
            </div>
            ${waiting}
        </div>
        <div class="hlu-fx" aria-hidden="true"></div>`;
}
