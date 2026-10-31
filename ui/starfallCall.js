// ui/starfallCall.js — the look of a Starfall that waited for the lesson: the Scholar's Scroll
// call and the summon that opens the Starfall window. No Firebase here (see features/pendingStarfall.js).
import { escapeHtml as esc } from '../utils/html.mjs';
import { playStarfallSfx } from '../audio.js';
import { formatMarkedDay } from '../features/pendingStarfallCore.mjs';
import '../styles/starfall_call.css';

const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'A scholar';

/** 0.5 -> "½", 1.5 -> "1½", 2 -> "2". */
export function formatStars(n) {
    const v = Math.round((Number(n) || 0) * 2) / 2;
    const whole = Math.floor(v);
    if (v - whole < 0.5) return String(whole);
    return whole ? `${whole}½` : '½';
}

function jarSvg() {
    return `<svg viewBox="0 0 40 52" aria-hidden="true" focusable="false"><path d="M13 9h14v3c0 1 1 2 3 3c3 2 5 4 5 8v17c0 4-3 7-7 7h-16c-4 0-7-3-7-7v-17c0-4 2-6 5-8c2-1 3-2 3-3z" class="ssf-jar__glass"/><rect x="13" y="3" width="14" height="7" rx="2" class="ssf-jar__cork"/><text x="20" y="36" text-anchor="middle" class="ssf-jar__q">?</text></svg>`;
}

/**
 * The Starfall call for the Scholar's Scroll.
 * @param {{ entries: Array, timing: {hasSchedule: boolean, inLesson: boolean}, nextWhen?: string, now?: Date }} opts
 * @returns {{ state: 'ready'|'asleep', html: string }}
 */
export function starfallCallHtml({ entries, timing, nextWhen = '', now = new Date() }) {
    const total = entries.reduce((sum, e) => sum + (Number(e.bonusAmount) || 0), 0);
    const count = entries.length;
    const scholars = `${count} scholar${count === 1 ? '' : 's'}`;
    const markedAt = Math.min(...entries.map((e) => Number(e.queuedAt) || Date.now()));
    const marked = formatMarkedDay(markedAt, now);
    const when = marked === 'today' ? 'today' : marked === 'yesterday' ? 'yesterday' : `on ${marked}`;

    if (timing.inLesson) {
        const jars = entries.slice(0, 7).map((_, i) => `<span class="ssf-jar" style="--i:${i}">${jarSvg()}</span>`).join('');
        return {
            state: 'ready',
            html: `
                <span class="ssf-call__sky" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                <div class="ssf-call__jars" aria-hidden="true">${jars}${count > 7 ? `<span class="ssf-jar__more">+${count - 7}</span>` : ''}</div>
                <div class="ssf-call__text">
                    <span class="ssf-call__kicker"><span aria-hidden="true">✦</span> Starfall <span aria-hidden="true">✦</span></span>
                    <strong class="ssf-call__title">Stars are waiting in the sky!</strong>
                    <span class="ssf-call__line">${esc(scholars)} shone in the marking ${esc(when)}. ${esc(formatStars(total))}&nbsp;★ waited for this lesson.</span>
                </div>
                <button type="button" class="ssf-call__btn" data-ssf="open">
                    <span class="ssf-call__btn-shine" aria-hidden="true"></span>
                    <span class="ssf-call__btn-star" aria-hidden="true">★</span>
                    <span>Call down the Starfall</span>
                </button>
                <button type="button" class="ssf-call__x" data-ssf="discard" aria-label="Let these stars go" title="Let these stars go"><i class="fas fa-times" aria-hidden="true"></i></button>`
        };
    }

    const names = entries.map((e) => firstName(e.name));
    const who = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
    const next = nextWhen;
    return {
        state: 'asleep',
        html: `
            <span class="ssf-call__moon" aria-hidden="true"><i class="fas fa-moon"></i></span>
            <div class="ssf-call__text">
                <strong class="ssf-call__title">A Starfall is waiting for the lesson</strong>
                <span class="ssf-call__line">${esc(formatStars(total))}&nbsp;★ for ${esc(who)}${next ? `. The Starfall button lights up ${esc(next)}.` : '.'}</span>
            </div>
            <button type="button" class="ssf-call__ghost" data-ssf="open"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>Bestow now</span></button>
            <button type="button" class="ssf-call__x" data-ssf="discard" aria-label="Let these stars go" title="Let these stars go"><i class="fas fa-times" aria-hidden="true"></i></button>`
    };
}

/** Night falls over the app, the star lifts off the button and a meteor shower opens the window. */
export function playStarfallSummon(origin) {
    playStarfallSfx('summon');
    if (reducedMotion()) return Promise.resolve();
    return new Promise((resolve) => {
        const layer = document.createElement('div');
        layer.className = 'ssf-summon';
        layer.setAttribute('aria-hidden', 'true');
        const meteors = Array.from({ length: 11 }, (_, i) => {
            const top = -10 + Math.random() * 55;
            const left = -25 + i * 9 + Math.random() * 6;
            return `<span class="ssf-summon__meteor" style="top:${top.toFixed(1)}%;left:${left.toFixed(1)}%;--d:${(i * 45 + Math.random() * 90).toFixed(0)}ms;--s:${(0.7 + Math.random() * 0.6).toFixed(2)}"></span>`;
        }).join('');
        layer.innerHTML = `<span class="ssf-summon__veil"></span>${meteors}<span class="ssf-summon__ring"></span><span class="ssf-summon__ring ssf-summon__ring--late"></span><span class="ssf-summon__star">★</span>`;
        document.body.appendChild(layer);

        const star = layer.querySelector('.ssf-summon__star');
        const box = origin?.getBoundingClientRect?.();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const sx = box && box.width ? box.left + box.width / 2 : cx;
        const sy = box && box.height ? box.top + box.height / 2 : window.innerHeight * 0.8;
        star.animate([
            { transform: `translate(${sx - cx}px, ${sy - cy}px) scale(0.6) rotate(0deg)`, opacity: 0 },
            { transform: `translate(${sx - cx}px, ${sy - cy - 30}px) scale(1) rotate(-20deg)`, opacity: 1, offset: 0.2, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
            { transform: 'translate(0px, 0px) scale(3.2) rotate(144deg)', opacity: 1, offset: 0.78, easing: 'ease-in' },
            { transform: 'translate(0px, 0px) scale(5) rotate(160deg)', opacity: 0 }
        ], { duration: 980, fill: 'both' });
        requestAnimationFrame(() => layer.classList.add('is-on'));

        setTimeout(resolve, 860);
        setTimeout(() => layer.classList.add('is-leaving'), 1050);
        setTimeout(() => layer.remove(), 1700);
    });
}
