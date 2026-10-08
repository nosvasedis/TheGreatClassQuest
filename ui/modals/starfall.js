// ui/modals/starfall.js
// Starfall: bonus stars fall into a jar for each scholar on a moonlit windowsill.
// No Firebase here; the caller passes what happens on "bestow" and how to close.
import { playStarfallSfx } from '../../audio.js';
import '../../styles/starfall.css';

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 0.5 -> "½", 1.5 -> "1½", 2 -> "2". */
export function formatStarAmount(amount) {
    const n = Math.round((Number(amount) || 0) * 2) / 2;
    const whole = Math.floor(n);
    const half = n - whole >= 0.5;
    if (!half) return String(whole);
    return whole ? `${whole}½` : '½';
}

const plural = (n) => (Math.round((Number(n) || 0) * 2) / 2 === 1 ? '' : 's');

function jarStarPoints(cx, cy, outer, inner) {
    return Array.from({ length: 10 }, (_, k) => {
        const a = (-90 + k * 36) * Math.PI / 180;
        const r = k % 2 === 0 ? outer : inner;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
}
const JAR_STAR = jarStarPoints(32, 56, 11.5, 4.8);

// "Maria Papadopoulou" -> first name large, surname small beneath (both fit the jar label).
function nameHtml(name) {
    const parts = String(name || '').trim().split(/\s+/);
    const first = parts.shift() || '';
    const rest = parts.join(' ');
    return `<span class="sfl-jar__name" title="${esc(name)}">${esc(first)}</span>`
        + (rest ? `<span class="sfl-jar__surname">${esc(rest)}</span>` : '');
}

function jarHtml(student, index) {
    const growth = student.kind === 'growth';
    const jump = Math.round(Number(student.jump) || 0);
    return `
        <figure class="sfl-jar" style="--i:${Math.min(index, 14)}" data-kind="${growth ? 'growth' : 'shine'}">
            <div class="sfl-jar__vessel">
                <span class="sfl-jar__flash" aria-hidden="true"></span>
                <svg class="sfl-jar__art" viewBox="0 -8 64 92" aria-hidden="true" focusable="false">
                    <ellipse cx="32" cy="81.5" rx="23" ry="3" fill="#050818" opacity="0.55"/>
                    <circle class="sfl-jar__glow" cx="32" cy="55" r="23" fill="url(#sfl-jar-glow)"/>
                    <path class="sfl-jar__glass" d="M20 18h24v5c0 2 2 3 5 5c5 3 7 7 7 13v28c0 7-5 11-12 11h-24c-7 0-12-4-12-11v-28c0-6 2-10 7-13c3-2 5-3 5-5z"/>
                    <polygon class="sfl-jar__slot" points="${JAR_STAR}"/>
                    <polygon class="sfl-jar__star" points="${JAR_STAR}"/>
                    <path class="sfl-jar__shine" d="M13.5 46c0-4.5 1.6-7.6 4.5-9.6v27.4c-2.9-1.8-4.5-4.6-4.5-8z"/>
                    <rect x="21" y="6" width="22" height="13" rx="3" fill="url(#sfl-jar-cork)"/>
                    <path d="M24 9.5h16M24 13.5h16" stroke="#8a5a2b" stroke-opacity="0.35" stroke-width="1"/>
                    <path d="M19 19.2h26" stroke="#e7eeff" stroke-opacity="0.75" stroke-width="2.4" stroke-linecap="round"/>
                    <path d="M20 22.6q12 3.2 24 0" stroke="#f1d39b" stroke-width="1.3" fill="none"/>
                    ${growth ? `<g class="sfl-jar__sprout">
                        <path d="M32 6V-1" stroke="#4ade80" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M32 1c-6 0-9-3-9-6c5 0 9 2 9 6z" fill="#86efac"/>
                        <path d="M32 -1c5 0 8-3 8-6c-5 0-8 2-8 6z" fill="#4ade80"/>
                    </g>` : ''}
                </svg>
            </div>
            <figcaption class="sfl-jar__label">
                ${nameHtml(student.name)}
                <span class="sfl-jar__tags">
                    <span class="sfl-coin${growth ? ' starfall-growth-chip' : ''}"${growth ? ` title="${esc(`Growth Starfall: about ${jump} points above their recent average`)}"` : ''}>${growth ? '<span aria-hidden="true">🌱</span>' : ''}+${formatStarAmount(student.bonusAmount)} <b aria-hidden="true">★</b><span class="sr-only">${growth ? ' growth' : ''} bonus star${plural(student.bonusAmount)}</span></span>
                </span>
            </figcaption>
        </figure>`;
}

const TRIAL_WORDS = { test: 'test', dictation: 'dictation' };

/**
 * Fills the Starfall window and wires its buttons. The caller then opens it (showAnimatedModal).
 * @param {{ mode: 'single'|'batch', students: Array<{studentId, name, bonusAmount, trialType?, kind?, jump?}>,
 *           onBestow: () => void, close: () => void }} opts
 */
export function prepareStarfall({ mode, students, onBestow, close }) {
    const shell = document.getElementById('starfall-modal-content');
    if (!shell) return;
    const list = Array.isArray(students) ? students : [];
    const single = mode === 'single';
    const total = list.reduce((sum, s) => sum + (Number(s.bonusAmount) || 0), 0);
    const hasGrowth = list.some((s) => s.kind === 'growth');

    shell.dataset.mode = single ? 'single' : 'batch';
    shell.dataset.count = String(Math.min(list.length, 9));
    shell.classList.remove('is-catching', 'is-caught');

    document.getElementById('starfall-single-view')?.classList.toggle('hidden', !single);
    document.getElementById('starfall-batch-view')?.classList.toggle('hidden', single);

    const title = document.getElementById('starfall-title');
    if (title) title.textContent = single ? 'A star is falling!' : 'Stars are falling!';

    if (single) {
        const s = list[0] || {};
        const trial = TRIAL_WORDS[s.trialType] || 'trial';
        const msg = document.getElementById('starfall-message');
        if (msg) {
            msg.innerHTML = s.kind === 'growth'
                ? `<b id="starfall-student-name" class="sfl-name">${esc(s.name)}</b> climbed far above their own recent best on this ${trial}, and a star slipped from the sky just for them.`
                : `The stars noticed <b id="starfall-student-name" class="sfl-name">${esc(s.name)}</b>'s brilliant ${trial}, and one slipped from the sky just for them.`;
        }
    } else {
        const msg = document.querySelector('#starfall-batch-view .starfall-message');
        if (msg) {
            msg.innerHTML = `${list.length} scholar${list.length === 1 ? '' : 's'} shone so brightly that stars slipped from the sky.`
                + (hasGrowth ? ' <span class="sfl-message__growth">🌱 Growth stars go to those who climbed far above their own recent best.</span>' : '');
        }
    }

    const jars = document.getElementById('starfall-batch-list');
    if (jars) {
        jars.innerHTML = list.map(jarHtml).join('');
        jars.scrollTop = 0;
    }

    const prompt = document.getElementById('starfall-prompt');
    if (prompt) prompt.textContent = single ? 'Shall we catch it and bestow the bonus?' : 'Shall we catch them and bestow the bonus?';

    // Fresh buttons each time, so an earlier Starfall's handler never fires again.
    const oldConfirm = document.getElementById('starfall-confirm-btn');
    const confirmBtn = oldConfirm.cloneNode(true);
    oldConfirm.parentNode.replaceChild(confirmBtn, oldConfirm);
    confirmBtn.disabled = false;
    const label = confirmBtn.querySelector('.sfl-catch__label');
    const bestowText = `Bestow ${formatStarAmount(total)} Bonus Star${plural(total)}`;
    if (label) label.textContent = bestowText;
    const cancelBtn = document.getElementById('starfall-cancel-btn');
    if (cancelBtn) cancelBtn.disabled = false;

    confirmBtn.addEventListener('click', () => {
        if (shell.classList.contains('is-catching')) return;
        confirmBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        shell.classList.add('is-catching');
        if (label) label.textContent = list.length === 1 ? 'Catching the star…' : 'Catching the stars…';
        catchStars(shell, () => {
            shell.classList.add('is-caught');
            if (label) label.textContent = list.length === 1 ? 'Caught! ✨' : 'All caught! ✨';
            playStarfallSfx('done');
            setTimeout(() => {
                onBestow?.();
                close?.();
            }, reducedMotion() ? 150 : 520);
        });
    });

    // Replay the arrival each time it opens (animations start once the modal is shown).
    shell.classList.remove('is-arriving');
    void shell.offsetWidth;
    if (!reducedMotion()) {
        shell.classList.add('is-arriving');
        clearTimeout(shell._sfArriveTimer);
        shell._sfArriveTimer = setTimeout(() => shell.classList.remove('is-arriving'), 3200);
    }
    playStarfallSfx('open');
}

/** One falling star per visible jar, staggered; jars out of view simply light up. */
function catchStars(shell, done) {
    const jars = [...shell.querySelectorAll('.sfl-jar')];
    if (!jars.length) { done(); return; }
    const rain = shell.querySelector('.sfl-rain');
    const shelf = shell.querySelector('.sfl-shelf');
    const canAnimate = !reducedMotion() && rain && typeof rain.animate === 'function';
    if (!canAnimate) {
        jars.forEach((jar) => jar.classList.add('is-caught'));
        setTimeout(done, 200);
        return;
    }

    const shellBox = shell.getBoundingClientRect();
    const shelfBox = shelf?.getBoundingClientRect() || shellBox;
    const visible = [];
    jars.forEach((jar) => {
        const art = jar.querySelector('.sfl-jar__vessel') || jar;
        const b = art.getBoundingClientRect();
        const midY = b.top + b.height * 0.6;
        if (midY > shelfBox.top && midY < shelfBox.bottom) visible.push({ jar, b });
        else jar.dataset.sfLate = '1';
    });

    const gap = Math.max(60, Math.min(170, 1100 / Math.max(1, visible.length)));
    const fall = visible.length > 8 ? 560 : 680;
    let landed = 0;
    let step = 0;
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        rain.replaceChildren();
        jars.forEach((jar) => { if (jar.dataset.sfLate) { delete jar.dataset.sfLate; jar.classList.add('is-caught'); } });
        setTimeout(done, 380);
    };
    if (!visible.length) { finish(); return; }
    // Safety net: a cancelled animation must never swallow the bonus.
    setTimeout(() => { jars.forEach((jar) => jar.classList.add('is-caught')); finish(); }, visible.length * gap + fall + 900);

    visible.forEach(({ jar, b }, i) => {
        const ex = b.left - shellBox.left + b.width / 2;
        const ey = b.top - shellBox.top + b.height * 0.58;
        const sx = ex - 70 - Math.random() * 90;
        const sy = -30 - Math.random() * 40;
        const angle = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
        const drop = document.createElement('span');
        drop.className = 'sfl-drop';
        drop.innerHTML = '<i></i>';
        rain.appendChild(drop);
        const anim = drop.animate([
            { transform: `translate(${sx}px, ${sy}px) rotate(${angle}deg)`, opacity: 0 },
            { opacity: 1, offset: 0.12 },
            { transform: `translate(${ex}px, ${ey}px) rotate(${angle}deg)`, opacity: 1 }
        ], { duration: fall, delay: i * gap, easing: 'cubic-bezier(0.45, 0, 0.85, 0.55)', fill: 'both' });
        anim.onfinish = () => {
            if (finished) return;
            drop.remove();
            jar.classList.add('is-caught');
            playStarfallSfx('catch', { step: step++ });
            landed += 1;
            if (landed === visible.length) finish();
        };
    });
}
