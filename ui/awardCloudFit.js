// Award Stars tab: reshapes each hero's cloud to the card's real size, so every button,
// chip and name sits on cloud on any screen. The cloud is redrawn only when the card's
// content box changes size (a desk opening, honours arriving, a narrower screen).
import { buildAwardCloudShapeHtml } from '../features/awardCloudShape.mjs';

const fittedSize = new WeakMap();
const pending = new Set();
let observer = null;
let frame = 0;

/** How far a cloud may reach past its content sideways without crossing the screen edge. */
function sideRoom(card, lift) {
    const rect = card.getBoundingClientRect();
    const scale = card.offsetWidth ? rect.width / card.offsetWidth : 1;
    const liftLeft = rect.left + lift.offsetLeft * scale;
    const liftRight = liftLeft + lift.offsetWidth * scale;
    const viewW = document.documentElement.clientWidth || window.innerWidth;
    const toScreen = Math.min(liftLeft, viewW - liftRight) / (scale || 1) - 14;
    // Desktop columns: half the column gap plus the card's own side padding.
    return Math.max(10, Math.min(30, toScreen - 8));
}

const BLOCKS = '.aw-card__corner .aw-boon, .aw-card__corner .aw-boon__tag, .aw-card__corner .aw-att, .aw-card__corner .aw-undo, '
    + '.aw-portrait, .aw-portrait__crown, .aw-portrait__laurel, .aw-portrait__guild, .aw-purse, .aw-familiar, '
    + '.aw-card__nameplate > *, .aw-tally, .aw-desk, .aw-virtues, .aw-card__finale > *';

/** Every visible piece of the card, as [x, y, w, h] in the content box's pixels. */
function contentBlocks(card, lift) {
    const base = lift.getBoundingClientRect();
    const scale = lift.offsetWidth ? base.width / lift.offsetWidth : 1;
    const blocks = [];
    card.querySelectorAll(BLOCKS).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        blocks.push([(r.left - base.left) / scale, (r.top - base.top) / scale, r.width / scale, r.height / scale].map(Math.round));
    });
    return blocks;
}

function measure(card) {
    const lift = card.querySelector('.aw-card__lift');
    if (!lift || !lift.offsetWidth) return null;
    const layout = { w: lift.offsetWidth, h: lift.offsetHeight, sideMax: sideRoom(card, lift), blocks: contentBlocks(card, lift) };
    const key = `${layout.w}|${layout.h}|${Math.round(layout.sideMax)}|${layout.blocks.join(';')}`;
    return fittedSize.get(card) === key ? null : { card, layout, key };
}

function draw({ card, layout, key }) {
    const holder = card.querySelector('.aw-cloud');
    const old = holder?.querySelector('.aw-cloud__shape');
    if (!holder) return;
    const first = !fittedSize.has(card);
    fittedSize.set(card, key);
    const id = card.dataset.studentid || 'hero';
    const tpl = document.createElement('template');
    tpl.innerHTML = buildAwardCloudShapeHtml(card.dataset.cloud, card.dataset.cloudSeed || id, layout, id);
    const fresh = tpl.content.firstElementChild;
    if (!fresh) return;
    // The first fit lands while the card is still rising in, so it simply swaps.
    if (!old || first) {
        if (old) old.replaceWith(fresh); else holder.append(fresh);
        return;
    }
    // Later changes (a desk opening, honours arriving) melt the old shape into the new one.
    fresh.classList.add('is-reshaping');
    old.classList.add('is-leaving');
    old.after(fresh);
    setTimeout(() => old.remove(), 520);
}

function flush() {
    frame = 0;
    const jobs = [];
    for (const card of pending) {
        if (!card.isConnected) continue;
        const job = measure(card);
        if (job) jobs.push(job);
    }
    pending.clear();
    jobs.forEach(draw);
}

function queue(card) {
    pending.add(card);
    if (!frame) frame = requestAnimationFrame(flush);
}

/** Keeps a hero's cloud fitted to the card for as long as the card is on the page. */
export function watchAwardCloud(card) {
    if (!card) return;
    if (typeof ResizeObserver === 'undefined') { queue(card); return; }
    if (!observer) {
        observer = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.target.isConnected) { observer.unobserve(entry.target); return; }
                const target = entry.target.closest('.aw-card');
                if (target) queue(target);
            });
        });
        // A narrower window can change how far clouds may reach, without any card resizing.
        window.addEventListener('resize', () => document.querySelectorAll('.aw-card').forEach(queue), { passive: true });
    }
    const lift = card.querySelector('.aw-card__lift');
    if (lift) observer.observe(lift);
    // Picking a virtue swaps the hint for the star buttons without resizing the card: look again.
    if (!card.dataset.cloudFit) {
        card.dataset.cloudFit = '1';
        card.addEventListener('click', () => setTimeout(() => queue(card), 420), { passive: true });
    }
}

/** Fits every cloud in a list. */
export function watchAwardClouds(root) {
    root?.querySelectorAll('.aw-card').forEach(watchAwardCloud);
}
