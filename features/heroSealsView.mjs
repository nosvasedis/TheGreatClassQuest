// features/heroSealsView.mjs — Hero Seals markup (no state, no DOM, no Firebase).
// The Seal Book panel (Scholar's Folio → Seals), the teacher's notice and the summary.
// Kept pure so the preview page and the guidebook capture can render the real markup.
// Styles: styles/hero_seals.css.

import { firstNameOf, sealArtHtml } from './heroSealsCore.mjs';

export function escSeal(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const esc = escSeal;

// ─── Seal Book ───────────────────────────────────────────────────────────────

function sealTileHtml(seal, i) {
    // A note only when it says more than the seal's own rule ("Up 12 points", "Every lesson of Sep").
    const extra = seal.earned && seal.note && !/^First /.test(seal.note) && !/^(Hero Path level 1|Quiz Champion|Hero of the Day)$/.test(seal.note) ? ` · ${esc(seal.note)}` : '';
    return `<article class="hs-tile${seal.earned ? ' is-pressed' : ''}" style="--i:${Math.min(i, 16)};--hs-tint:${seal.tint}">
        ${sealArtHtml(seal, { earned: seal.earned, size: 64 })}
        <div class="hs-tile__text">
            <b class="hs-tile__name">${esc(seal.name)}</b>
            <span class="hs-tile__line">${esc(seal.how)}</span>
            ${seal.earned ? `<span class="hs-tile__pressed"><i class="fas fa-check" aria-hidden="true"></i>Pressed ${esc(seal.dateLabel || 'this year')}${extra}</span>` : ''}
            ${seal.reason ? `<em class="hs-tile__why">${esc(seal.reason)}</em>` : ''}
        </div>
    </article>`;
}

/** The Seal Book. `seals` is buildSealBookView(); `student` needs a name; `reading` while the book is being read. */
export function sealBookPanelHtml(seals, student, { reading = false } = {}) {
    const first = firstNameOf(student?.name);
    const latest = seals.latest;
    const dots = [...seals.shared, ...seals.personal]
        .map((s) => `<i class="${s.earned ? 'is-on' : ''}" style="--hs-tint:${s.tint}"></i>`).join('');
    let n = 0;
    const sub = latest
        ? `Latest: <b>${esc(latest.name)}</b>${latest.dateLabel ? `, ${esc(latest.dateLabel)}` : ''}`
        : (reading && !seals.ready ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Reading this year’s story…' : 'No seals pressed yet. The first one is close.');
    return `
        <section class="hs-book">
            <header class="hs-book__head">
                <span class="hs-book__latest">${latest ? sealArtHtml(latest, { size: 84 }) : sealArtHtml('virtue_respect', { earned: false, size: 84 })}</span>
                <div class="hs-book__heading">
                    <p class="sf-sheet__kicker">Seal Book</p>
                    <h3 class="hs-book__title">${esc(first)}’s Hero Seals</h3>
                    <p class="hs-book__sub">${sub}</p>
                </div>
                <div class="hs-book__count" aria-label="${seals.earnedCount} of ${seals.total} seals pressed"><b>${seals.earnedCount}</b><span>of ${seals.total}</span></div>
            </header>
            <div class="hs-book__dots" aria-hidden="true">${dots}</div>
            <div class="hs-book__group">
                <h4 class="hs-book__group-title"><i class="fas fa-users" aria-hidden="true"></i>Shared seals <small>Every hero can press these</small></h4>
                <div class="hs-grid">${seals.shared.map((s) => sealTileHtml(s, n++)).join('')}</div>
            </div>
            ${seals.personal.length ? `
            <div class="hs-book__group hs-book__group--own">
                <h4 class="hs-book__group-title"><i class="fas fa-feather-pointed" aria-hidden="true"></i>${esc(first)}’s own seals <small>Chosen for ${esc(first)} alone</small></h4>
                <div class="hs-grid">${seals.personal.map((s) => sealTileHtml(s, n++)).join('')}</div>
            </div>` : ''}
            <p class="hs-book__foot"><i class="fas fa-circle-info" aria-hidden="true"></i>Seals give no Gold or stars. They are milestones of ${esc(first)}’s own story, and once pressed a seal stays.</p>
        </section>`;
}

// ─── The notice ──────────────────────────────────────────────────────────────

export function heroSealsNoticeCopy(groups) {
    const seals = groups.reduce((n, g) => n + g.seals.length, 0);
    const live = groups.reduce((n, g) => n + g.liveCount, 0);
    if (!live) {
        return { title: 'The Seal Book opens', sub: `${seals} seal${seals === 1 ? '' : 's'} already earned this year by ${groups.length} hero${groups.length === 1 ? '' : 'es'}` };
    }
    if (groups.length === 1) {
        const g = groups[0];
        return { title: `${firstNameOf(g.student.name)} pressed ${g.seals.length === 1 ? 'a Hero Seal' : `${g.seals.length} Hero Seals`}`, sub: g.seals.length === 1 ? g.seals[0].name : 'See which ones' };
    }
    return { title: `${groups.length} heroes pressed Hero Seals`, sub: `${seals} seal${seals === 1 ? '' : 's'} · see who got what` };
}

/** The notice's inner markup. `groups` is collectNewSeals(). */
export function heroSealsNoticeHtml(groups) {
    if (!groups?.length) return '';
    const { title, sub } = heroSealsNoticeCopy(groups);
    return `
        <button type="button" class="hs-notice__open" aria-label="${esc(title)}. Open the summary">
            <span class="hs-notice__art">${sealArtHtml(groups[0].seals[0], { size: 46 })}</span>
            <span class="hs-notice__text"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
            <span class="hs-notice__go" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
        </button>
        <button type="button" class="hs-notice__dismiss" aria-label="Dismiss" title="Dismiss"><i class="fas fa-xmark" aria-hidden="true"></i></button>`;
}

// ─── The summary ─────────────────────────────────────────────────────────────

function portraitHtml(student) {
    if (student?.avatar) return `<span class="hs-sum__portrait"><img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`;
    return `<span class="hs-sum__portrait is-initial" aria-hidden="true">${esc(String(student?.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
}

/** The summary dialog's markup. `groups` is collectNewSeals(). */
export function heroSealsSummaryHtml(groups, { lite = false } = {}) {
    const seals = groups.reduce((n, g) => n + g.seals.length, 0);
    const live = groups.reduce((n, g) => n + g.liveCount, 0);
    const byClass = new Map();
    groups.forEach((g) => {
        const k = g.classLabel || '';
        if (!byClass.has(k)) byClass.set(k, []);
        byClass.get(k).push(g);
    });
    let i = 0;
    const cards = [...byClass.entries()].map(([label, list]) => `
        ${byClass.size > 1 && label ? `<p class="hs-sum__class">${esc(label)}</p>` : ''}
        ${list.map((g) => `
            <article class="hs-sum__card" style="--i:${Math.min(i++, 14)}">
                <button type="button" class="hs-sum__who" data-hs-folio="${esc(g.student.id)}" title="Open ${esc(firstNameOf(g.student.name))}'s Seal Book">
                    ${portraitHtml(g.student)}
                    <span class="hs-sum__name"><b>${esc(g.student.name)}</b><small>${g.seals.length} seal${g.seals.length === 1 ? '' : 's'}${byClass.size > 1 || !g.classLabel ? '' : ` · ${esc(g.classLabel)}`}</small></span>
                    <i class="fas fa-book-open hs-sum__book" aria-hidden="true"></i>
                </button>
                <ul class="hs-sum__seals">
                    ${g.seals.map((s, n) => `
                        <li class="hs-sum__seal" style="--n:${Math.min(n, 8)}">
                            ${sealArtHtml(s, { size: 58 })}
                            <span class="hs-sum__seal-text">
                                <b>${esc(s.name)}</b>
                                <small>${esc(firstNameOf(g.student.name))} ${esc(s.told)}${s.dateLabel ? ` · ${esc(s.dateLabel)}` : ''}</small>
                            </span>
                        </li>`).join('')}
                </ul>
            </article>`).join('')}`).join('');
    const heroSeal = groups[0]?.seals[0];
    return `
        <div class="hs-sum__card-shell${lite ? ' hs--lite' : ''}" role="dialog" aria-modal="true" aria-labelledby="hs-sum-title">
            <header class="hs-sum__head">
                <span class="hs-sum__rays" aria-hidden="true"></span>
                <span class="hs-sum__hero-seal">${heroSeal ? sealArtHtml(heroSeal, { size: 96 }) : ''}</span>
                <div class="hs-sum__heading">
                    <p class="hs-sum__kicker">Hero Seals</p>
                    <h2 id="hs-sum-title" class="font-title">${live ? 'New seals pressed' : 'The Seal Book opens'}</h2>
                    <p class="hs-sum__sub">${groups.length} hero${groups.length === 1 ? '' : 'es'} · ${seals} seal${seals === 1 ? '' : 's'}${live ? '' : ' already earned this year'}</p>
                </div>
                <button type="button" class="hs-sum__close" data-hs-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </header>
            <p class="hs-sum__intro">Quiet milestones from each child's own story. They give no Gold or stars; they are simply theirs. Tap a name to open their Seal Book.</p>
            <div class="hs-sum__list custom-scrollbar">${cards}</div>
            <footer class="hs-sum__foot">
                <button type="button" class="hs-sum__done" data-hs-close><i class="fas fa-check" aria-hidden="true"></i>Lovely</button>
            </footer>
        </div>`;
}
