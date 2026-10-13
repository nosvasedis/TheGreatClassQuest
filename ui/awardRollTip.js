// The star roll's own tooltip (Award Stars tab): a little sky card above a bead or chip,
// instead of the browser's title box. Reads data-tip-name / -note / -hint / -avatar.
// Styles: .aw-roll-tip in styles/award_stars.css.

let tipEl = null;
let tipFor = null;
let touchTimer = 0;

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

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
    if (!target?.dataset?.tipName) return;
    const tip = ensureTip();
    const { tipName, tipNote, tipHint, tipAvatar } = target.dataset;
    const status = [...target.classList].find((c) => c.startsWith('is-'))?.slice(3) || 'info';
    const face = tipAvatar
        ? `<img class="aw-roll-tip__face" src="${esc(tipAvatar)}" alt="">`
        : (target.classList.contains('aw-roll__bead') ? `<span class="aw-roll-tip__face aw-roll-tip__face--initial">${esc(tipName.charAt(0))}</span>` : '');
    tip.dataset.tone = status;
    tip.innerHTML = `${face}<span class="aw-roll-tip__text"><b>${esc(tipName)}</b>`
        + `${tipNote ? `<span class="aw-roll-tip__note">${esc(tipNote)}</span>` : ''}`
        + `${tipHint ? `<span class="aw-roll-tip__hint">${esc(tipHint)}</span>` : ''}</span>`;
    tipFor = target;
    // A portrait that fails to load falls back to the hero's initial.
    const img = tip.querySelector('img.aw-roll-tip__face');
    if (img) img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'aw-roll-tip__face aw-roll-tip__face--initial', textContent: tipName.charAt(0) }));

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

export function hideAwardRollTip(target) {
    if (!tipEl || (target && target !== tipFor)) return;
    tipEl.classList.remove('is-shown');
    tipFor = null;
}

/** Hover, keyboard focus and a touch all show the tip; leaving, blur or scrolling hide it. */
export function bindAwardRollTips(root) {
    const pick = (event) => event.target.closest?.('[data-tip-name]');
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
        touchTimer = setTimeout(() => hideAwardRollTip(target), 1800);
    });
    root.addEventListener('focusin', (event) => { const t = pick(event); if (t) showAwardRollTip(t); });
    root.addEventListener('focusout', (event) => { const t = pick(event); if (t) hideAwardRollTip(t); });
    window.addEventListener('scroll', () => hideAwardRollTip(), { passive: true, capture: true });
}
