// The star roll's own tooltip (Award Stars tab): a little sky card above a bead or chip,
// instead of the browser's title box. Reads data-tip-name / -note / -hint / -avatar.
// Styles: .aw-roll-tip in styles/award_stars.css.
import { escapeHtml as esc } from '../utils/html.mjs';

let tipEl = null;
const builders = new Map();

/** Richer tips: a target with data-tip-build="<kind>" gets its card from the builder, built on demand. */
export function registerAwardTipBuilder(kind, build) {
    builders.set(kind, build);
}
let tipFor = null;
let touchTimer = 0;

function ensureTip() {
    if (tipEl?.isConnected) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'aw-roll-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tipEl);
    return tipEl;
}

export function showAwardRollTip(target) {
    const ds = target?.dataset;
    if (!ds || !(ds.tipName || ds.tipBuild)) return;
    const tip = ensureTip();
    if (ds.tipBuild) {
        const built = builders.get(ds.tipBuild)?.(target);
        if (!built) return;
        tip.dataset.tone = built.tone || 'info';
        tip.classList.add('is-rich');
        tip.innerHTML = built.html;
    } else {
        const { tipName, tipNote, tipHint, tipAvatar } = ds;
        const status = [...target.classList].find((c) => c.startsWith('is-'))?.slice(3) || 'info';
        const face = tipAvatar
            ? `<img class="aw-roll-tip__face" src="${esc(tipAvatar)}" alt="">`
            : (target.classList.contains('aw-roll__bead') ? `<span class="aw-roll-tip__face aw-roll-tip__face--initial">${esc(tipName.charAt(0))}</span>` : '');
        tip.dataset.tone = status;
        tip.classList.remove('is-rich');
        tip.innerHTML = `${face}<span class="aw-roll-tip__text"><b>${esc(tipName)}</b>`
            + `${tipNote ? `<span class="aw-roll-tip__note">${esc(tipNote)}</span>` : ''}`
            + `${tipHint ? `<span class="aw-roll-tip__hint">${esc(tipHint)}</span>` : ''}</span>`;
    }
    tipFor = target;
    // A portrait that fails to load falls back to the hero's initial.
    const img = tip.querySelector('img.aw-roll-tip__face');
    const initial = (ds.tipName || img?.closest('[data-initial]')?.dataset.initial || '?').charAt(0);
    if (img) img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'aw-roll-tip__face aw-roll-tip__face--initial', textContent: initial }));

    const r = target.getBoundingClientRect();
    tip.classList.remove('is-below');
    tip.style.left = '0px';
    tip.style.top = '0px';
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const margin = 8;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, margin), window.innerWidth - w - margin);
    let top = r.top - h - 10;
    if (top < margin) {
        top = r.bottom + 10;
        tip.classList.add('is-below');
    }
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.setProperty('--arrow-x', `${Math.round(r.left + r.width / 2 - left)}px`);
    tip.classList.add('is-shown');
}

/** Redraws the open tip when its card's data arrives late (a month's log loading). */
export function refreshAwardRollTip(target) {
    if (target && target === tipFor && tipEl?.classList.contains('is-shown')) showAwardRollTip(target);
}

export function hideAwardRollTip(target) {
    if (!tipEl || (target && target !== tipFor)) return;
    tipEl.classList.remove('is-shown');
    tipFor = null;
}

/** Hover, keyboard focus and a touch all show the tip; leaving, blur or scrolling hide it. */
export function bindAwardRollTips(root) {
    const pick = (event) => event.target.closest?.('[data-tip-name], [data-tip-build]');
    root.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch') return;
        const target = pick(event);
        if (target && target !== tipFor) showAwardRollTip(target);
    });
    root.addEventListener('pointerout', (event) => {
        const target = pick(event);
        if (target && !target.contains(event.relatedTarget)) hideAwardRollTip(target);
    });
    root.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch') return;
        const target = pick(event);
        if (!target) return;
        showAwardRollTip(target);
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => hideAwardRollTip(target), target.dataset.tipBuild ? 5000 : 1800);
    });
    root.addEventListener('focusin', (event) => { const t = pick(event); if (t) showAwardRollTip(t); });
    root.addEventListener('focusout', (event) => { const t = pick(event); if (t) hideAwardRollTip(t); });
    window.addEventListener('scroll', () => hideAwardRollTip(), { passive: true, capture: true });
}
