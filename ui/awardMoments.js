// Award Stars: the two big moments after an award.
// - The Hero's Boon: a classmate's heart flies across the sky to the receiver and bursts into
//   hearts. It starts on the tap and waits over the receiver until the save answers, so a
//   refused boon fades instead of celebrating.
// - The Hero of the Day bonus: a golden crown drops onto the hero's cloud, a banner unfurls and
//   the bonus star flies into today's tally.
// Everything is transform and opacity on small elements in the shared award layer
// (ui/awardFx.js); glows are pre-drawn gradients. Reduced motion keeps only sound and the
// notification; weak laptops get fewer particles and no full-screen glow.
// Styles: styles/award_moments.css (.amx-*). Sounds: audio.js playAwardMomentSfx.

import { playAwardMomentSfx } from '../audio.js';
import { notify } from './effects.js';
import { formatBoonStars } from './boonSponsorPicker.js';
import { PEER_BOON_BASE_STARS } from '../features/heroClasses.js';
import { getLayer, prefersReducedMotion, isLitePower, centerOf, spawn, run, popElement, isOnScreen } from './awardFx.js';

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Hero';

/** An animation that stays on its element (the scene removes everything at the end). */
function hold(el, keyframes, options) {
    return el?.animate?.(keyframes, { fill: 'both', ...options }) || null;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One fixed scene inside the award layer; removing it removes every piece at once. */
function openScene(kind) {
    const scene = spawn(getLayer(), `amx-scene amx-scene--${kind}`, 0, 0);
    return scene;
}

function closeScene(scene, duration = 420) {
    if (!scene?.isConnected) return;
    const anim = scene.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' });
    if (anim) anim.finished.then(() => scene.remove()).catch(() => scene.remove());
    else scene.remove();
}

function medalHtml(person, extra = '') {
    const face = person?.avatar
        ? `<img src="${esc(person.avatar)}" alt="" decoding="async">`
        : `<b>${esc(String(person?.name || '?').charAt(0).toUpperCase())}</b>`;
    return `<span class="amx-medal__face">${face}</span>${extra}`;
}

function heartBurst(parent, at, count, { spread = [70, 170], rise = 120, kinds = ['rose', 'pink', 'white'], delay = 0 } = {}) {
    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const dist = spread[0] + Math.random() * (spread[1] - spread[0]);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist * 0.8;
        const size = 0.55 + Math.random() * 0.75;
        const tilt = (Math.random() - 0.5) * 50;
        const heart = spawn(parent, `amx-heart amx-heart--${kinds[i % kinds.length]}`, at.x, at.y);
        run(heart, [
            { transform: `translate(-50%, -50%) scale(0.2) rotate(0deg)`, opacity: 0 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${size * 1.15}) rotate(${tilt}deg)`, opacity: 1, offset: 0.35 },
            { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy - rise}px)) scale(${size * 0.7}) rotate(${-tilt}deg)`, opacity: 0 }
        ], { duration: 1300 + Math.random() * 700, delay: delay + Math.random() * 120, easing: 'cubic-bezier(0.15, 0.7, 0.35, 1)' });
    }
}

function twinkles(parent, at, count, radius, delay = 0) {
    for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = radius * (0.35 + Math.random() * 0.65);
        const t = spawn(parent, 'amx-twinkle', at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
        const s = 0.5 + Math.random() * 0.9;
        run(t, [
            { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 0 },
            { transform: `translate(-50%, -50%) scale(${s}) rotate(45deg)`, opacity: 1, offset: 0.4 },
            { transform: 'translate(-50%, -50%) scale(0) rotate(90deg)', opacity: 0 }
        ], { duration: 700 + Math.random() * 400, delay: delay + Math.random() * 600, easing: 'ease-in-out' });
    }
}

function ring(parent, at, className, scale, duration, delay = 0) {
    const el = spawn(parent, `amx-ring ${className}`, at.x, at.y);
    run(el, [
        { transform: 'translate(-50%, -50%) scale(0.15)', opacity: 1 },
        { transform: `translate(-50%, -50%) scale(${scale})`, opacity: 0 }
    ], { duration, delay, easing: 'cubic-bezier(0.1, 0.6, 0.3, 1)' });
}

function popLabel(parent, at, html, className, { duration = 1700, delay = 0, rise = 90 } = {}) {
    const label = spawn(parent, `amx-label ${className}`, at.x, at.y);
    label.innerHTML = html;
    run(label, [
        // Overshoot easing goes on the pop only: on the whole run it would reach into the fade.
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0, easing: 'cubic-bezier(0.22, 1.4, 0.36, 1)' },
        { transform: `translate(-50%, calc(-50% - ${rise * 0.4}px)) scale(1.2)`, opacity: 1, offset: 0.2, easing: 'ease-out' },
        { transform: `translate(-50%, calc(-50% - ${rise * 0.7}px)) scale(1)`, opacity: 1, offset: 0.75, easing: 'ease-in' },
        { transform: `translate(-50%, calc(-50% - ${rise}px)) scale(0.92)`, opacity: 0 }
    ], { duration, delay });
}

function glowVeil(parent, at, className) {
    const veil = spawn(parent, `amx-veil ${className}`, 0, 0, {
        background: className === 'amx-veil--gold'
            ? `radial-gradient(circle at ${at.x}px ${at.y}px, rgba(255, 247, 200, 0.92), rgba(251, 191, 36, 0.55) 16%, rgba(146, 64, 14, 0.62) 42%, rgba(41, 15, 4, 0.82) 85%)`
            : `radial-gradient(ellipse at ${at.x}px ${at.y}px, rgba(255, 228, 236, 0.85), rgba(244, 114, 182, 0.55) 26%, rgba(136, 19, 55, 0.66) 62%, rgba(46, 6, 24, 0.84))`
    });
    return veil;
}

/** A point on the quadratic arc from a to b that rises `lift` px. */
function arcPoint(a, b, lift, t) {
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) - lift;
    const u = 1 - t;
    return {
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y
    };
}

// ───────────── The Hero's Boon ─────────────

function boonStage() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const narrow = w < 640;
    const gap = Math.min(w * (narrow ? 0.3 : 0.24), 300);
    const y = h * (narrow ? 0.44 : 0.47);
    return {
        narrow,
        giver: { x: w / 2 - gap, y },
        receiver: { x: w / 2 + gap, y },
        mid: { x: w / 2, y }
    };
}

function cardFor(studentId) {
    if (!studentId) return null;
    return document.querySelector(`.student-cloud-card[data-studentid="${CSS.escape(studentId)}"]`);
}

/**
 * The boon leaves the giver the moment the teacher confirms.
 * @param {{ giver: {id, name, avatar}, receiver: {id, name, avatar}, origin?: {x, y} }} people
 * @returns {{ land: (result: {stars?: number}) => void, fizzle: () => void }}
 */
export function startBoonMoment({ giver, receiver, origin } = {}) {
    playAwardMomentSfx('boon_launch');
    if (prefersReducedMotion()) {
        return {
            land: () => playAwardMomentSfx('boon_land'),
            fizzle: () => playAwardMomentSfx('boon_fizzle')
        };
    }

    const lite = isLitePower();
    const stage = boonStage();
    const scene = openScene('boon');
    let settled = false;

    const veil = glowVeil(scene, stage.mid, 'amx-veil--rose');
    hold(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });

    // The tap itself: a little puff of hearts from the button.
    if (origin) heartBurst(scene, origin, lite ? 5 : 9, { spread: [30, 80], rise: 60 });

    const banner = spawn(scene, 'amx-banner amx-banner--boon', stage.mid.x, stage.mid.y - (stage.narrow ? 150 : 190));
    banner.innerHTML = `<small>A gift between classmates</small><strong>Hero’s Boon</strong>`;
    hold(banner, [
        { transform: 'translate(-50%, -50%) scale(0.4, 0.2)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.06, 1.06)', opacity: 1, offset: 0.65 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 620, delay: 80, easing: 'cubic-bezier(0.22, 1.3, 0.36, 1)' });

    const medal = (person, at, role, delay) => {
        const el = spawn(scene, `amx-medal amx-medal--${role}`, at.x, at.y);
        el.innerHTML = medalHtml(person, `<span class="amx-medal__name">${esc(firstName(person?.name))}</span>`);
        hold(el, [
            { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 1, offset: 0.6 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
        ], { duration: 560, delay, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        return el;
    };
    const giverEl = medal(giver, stage.giver, 'giver', 60);
    const receiverEl = medal(receiver, stage.receiver, 'receiver', 200);

    // The giver's heart beats twice, then the boon heart rises out of it.
    hold(giverEl.querySelector('.amx-medal__face'), [
        { transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: 0.15 }, { transform: 'scale(1)', offset: 0.3 },
        { transform: 'scale(1.08)', offset: 0.45 }, { transform: 'scale(1)', offset: 0.65 }, { transform: 'scale(1)' }
    ], { duration: 900, delay: 420, easing: 'ease-in-out' });

    const lift = stage.narrow ? 90 : 150;
    const hover = { x: stage.receiver.x, y: stage.receiver.y - (stage.narrow ? 74 : 96) };
    const heart = spawn(scene, 'amx-bigheart', stage.giver.x, stage.giver.y);
    const path = [];
    const steps = 16;
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const p = arcPoint(stage.giver, hover, lift, t);
        const tilt = Math.sin(t * Math.PI) * (hover.x > stage.giver.x ? 16 : -16);
        path.push({
            transform: `translate(calc(-50% + ${p.x - stage.giver.x}px), calc(-50% + ${p.y - stage.giver.y}px)) scale(${1 + Math.sin(t * Math.PI) * 0.25}) rotate(${tilt}deg)`,
            offset: 0.3 + t * 0.7
        });
    }
    const flight = hold(heart, [
        { transform: 'translate(-50%, -50%) scale(0.1)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%, calc(-50% - 10px)) scale(1.25)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.24 },
        ...path.map((k) => ({ ...k, opacity: 1 }))
    ], { duration: 1900, delay: 900, easing: 'cubic-bezier(0.45, 0.05, 0.4, 1)' });

    // A trail of little hearts and sparkles that light up as the boon passes.
    const trailCount = lite ? 7 : 12;
    for (let i = 1; i <= trailCount; i += 1) {
        const t = i / (trailCount + 1);
        const p = arcPoint(stage.giver, hover, lift, t);
        const passAt = 900 + 1900 * (0.3 + t * 0.7 * 0.92);
        const bit = spawn(scene, i % 3 === 0 ? 'amx-twinkle' : `amx-heart amx-heart--${i % 2 ? 'pink' : 'white'} amx-heart--tiny`, p.x, p.y);
        run(bit, [
            { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.95, offset: 0.2 },
            { transform: 'translate(-50%, calc(-50% + 26px)) scale(0.5)', opacity: 0 }
        ], { duration: 1100, delay: passAt, easing: 'ease-out' });
    }
    setTimeout(() => { if (!settled) playAwardMomentSfx('boon_fly'); }, 1150);

    // Arrived and still saving: the heart hovers over the receiver and keeps beating.
    let beating = null;
    const arrived = flight ? flight.finished.catch(() => {}) : wait(2800);
    arrived.then(() => {
        if (settled || !heart.isConnected) return;
        beating = hold(heart, [
            { transform: `translate(calc(-50% + ${hover.x - stage.giver.x}px), calc(-50% + ${hover.y - stage.giver.y}px)) scale(1)` },
            { transform: `translate(calc(-50% + ${hover.x - stage.giver.x}px), calc(-50% + ${hover.y - stage.giver.y - 6}px)) scale(1.12)`, offset: 0.2 },
            { transform: `translate(calc(-50% + ${hover.x - stage.giver.x}px), calc(-50% + ${hover.y - stage.giver.y}px)) scale(1)`, offset: 0.4 },
            { transform: `translate(calc(-50% + ${hover.x - stage.giver.x}px), calc(-50% + ${hover.y - stage.giver.y}px)) scale(1)` }
        ], { duration: 820, iterations: Infinity, easing: 'ease-in-out' });
    });
    const safety = setTimeout(() => api.fizzle(), 12000);

    const finish = (delay) => setTimeout(() => closeScene(scene, 520), delay);

    const api = {
        land(result = {}) {
            if (settled) return;
            settled = true;
            clearTimeout(safety);
            arrived.then(() => {
                if (!scene.isConnected) return;
                beating?.cancel();
                const dx = stage.receiver.x - stage.giver.x;
                const dy = stage.receiver.y - stage.giver.y;
                const hx = hover.x - stage.giver.x;
                const hy = hover.y - stage.giver.y;
                const dive = hold(heart, [
                    { transform: `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px)) scale(1)`, opacity: 1 },
                    { transform: `translate(calc(-50% + ${hx}px), calc(-50% + ${hy - 18}px)) scale(1.35)`, opacity: 1, offset: 0.35 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)`, opacity: 0.9 }
                ], { duration: 420, easing: 'cubic-bezier(0.55, 0, 0.75, 0.4)' });
                const burst = () => {
                    heart.remove();
                    playAwardMomentSfx('boon_land');
                    const at = stage.receiver;
                    const flash = spawn(scene, 'amx-flash amx-flash--rose', at.x, at.y);
                    run(flash, [
                        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
                        { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1, offset: 0.2 },
                        { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 }
                    ], { duration: 900, easing: 'ease-out' });
                    ring(scene, at, 'amx-ring--rose', 2.1, 800);
                    ring(scene, at, 'amx-ring--gold', 2.8, 1000, 140);
                    heartBurst(scene, at, lite ? 12 : 26, { spread: [80, stage.narrow ? 150 : 220], rise: 140, kinds: ['rose', 'pink', 'white', 'gold'] });
                    if (!lite) twinkles(scene, at, 12, 160, 100);
                    receiverEl.classList.add('is-loved');
                    hold(receiverEl.querySelector('.amx-medal__face'), [
                        { transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.3 },
                        { transform: 'scale(0.94)', offset: 0.6 }, { transform: 'scale(1.04)', offset: 0.8 }, { transform: 'scale(1)' }
                    ], { duration: 760, easing: 'ease-out' });
                    const stars = Number(result.stars);
                    popLabel(scene, { x: at.x, y: at.y - 84 }, `${esc(formatBoonStars(stars > 0 ? stars : PEER_BOON_BASE_STARS))}<i aria-hidden="true">★</i>`, 'amx-label--boon', { duration: 2000, rise: 70 });
                    showLoveOnCard(receiver?.id, lite);
                    finish(2100);
                };
                if (dive) dive.finished.then(burst).catch(burst);
                else burst();
            });
        },
        fizzle() {
            if (settled) return;
            settled = true;
            clearTimeout(safety);
            arrived.then(() => {
                if (!scene.isConnected) return;
                beating?.cancel();
                playAwardMomentSfx('boon_fizzle');
                const hx = hover.x - stage.giver.x;
                const hy = hover.y - stage.giver.y;
                hold(heart, [
                    { transform: `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px)) scale(1) rotate(0deg)`, opacity: 1 },
                    { transform: `translate(calc(-50% + ${hx}px), calc(-50% + ${hy + 40}px)) scale(0.5) rotate(-18deg)`, opacity: 0 }
                ], { duration: 700, easing: 'ease-in' });
                finish(500);
            });
        }
    };
    return api;
}

/** After the boon lands: a soft shower of hearts over the receiver's cloud, if it is in view. */
function showLoveOnCard(studentId, lite) {
    const card = cardFor(studentId);
    if (!card || !isOnScreen(card)) return;
    const portrait = card.querySelector('.aw-portrait') || card;
    const at = centerOf(portrait);
    setTimeout(() => {
        const layer = getLayer();
        heartBurst(layer, at, lite ? 6 : 12, { spread: [40, 110], rise: 90, kinds: ['rose', 'pink', 'white'] });
        popElement(card.querySelector('.aw-tally__item--month'), 1.14);
        popElement(portrait, 1.08);
    }, 650);
}

/** The boon's notification in the app's normal notification stack. */
export function announceBoon({ giverName, receiverName, stars, patronGoldBack = 0 }) {
    const gift = `${esc(formatBoonStars(stars))} ★`;
    const patron = patronGoldBack > 0
        ? `<span class="amx-herald-sub"><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Patron’s thanks: ${esc(firstName(giverName))} gets ${esc(patronGoldBack)} Gold back</span>`
        : '';
    return notify({
        type: 'praise',
        className: 'herald--boon',
        title: 'Hero’s Boon',
        icon: '<span class="amx-herald-heart" aria-hidden="true"></span>',
        message: `<b>${esc(firstName(giverName))}</b> gave <b>${esc(firstName(receiverName))}</b> a gift of <b class="amx-herald-gift">${gift}</b>${patron}`,
        duration: 6500
    });
}

// ───────────── The Hero of the Day bonus ─────────────

/**
 * The reigning Hero of the Day has just earned their first stars today, and the +1 bonus with them.
 * @param {{ studentId: string, name: string, avatar?: string }} hero
 */
export function playHeroBonusMoment({ studentId, name, avatar } = {}) {
    playAwardMomentSfx('hero_bonus');
    announceHeroBonus(name);
    if (prefersReducedMotion()) {
        const card = cardFor(studentId);
        popElement(card?.querySelector('.aw-tally__item--today'), 1.08);
        return;
    }

    const lite = isLitePower();
    const card = cardFor(studentId);
    const onCard = Boolean(card && isOnScreen(card));
    const scene = openScene('hero');
    // The hero takes the stage mid-screen, where the whole class can see the crowning;
    // the bonus star then flies down into their cloud when it is in view.
    const narrow = window.innerWidth < 640;
    const anchor = { x: window.innerWidth / 2, y: window.innerHeight * (narrow ? 0.5 : 0.54) };
    const veil = glowVeil(scene, anchor, 'amx-veil--gold');
    hold(veil, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 4300, easing: 'ease-in-out' });
    // Slow royal rays behind the hero.
    const rays = spawn(scene, 'amx-rays', anchor.x, anchor.y);
    hold(rays, [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(30deg)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -50%) scale(1.08) rotate(80deg)', opacity: 0.85, offset: 0.75 },
        { transform: 'translate(-50%, -50%) scale(1.2) rotate(110deg)', opacity: 0 }
    ], { duration: 3600, easing: 'ease-out' });

    const medal = spawn(scene, 'amx-medal amx-medal--hero', anchor.x, anchor.y);
    medal.innerHTML = medalHtml({ name, avatar }, `<span class="amx-medal__name">${esc(firstName(name))}</span>`);
    hold(medal, [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.6 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    const headRadius = (medal.offsetHeight || 132) / 2;
    const crownAt = { x: anchor.x, y: anchor.y - headRadius - 22 };


    // The crown falls from the top of the screen, spinning a little, and lands with a bounce.
    const crown = spawn(scene, 'amx-crown', crownAt.x, crownAt.y);
    const fall = crownAt.y + 120;
    hold(crown, [
        { transform: `translate(-50%, calc(-50% - ${fall}px)) scale(1.5) rotate(-24deg)`, opacity: 0, offset: 0 },
        { transform: `translate(-50%, calc(-50% - ${fall * 0.75}px)) scale(1.45) rotate(-14deg)`, opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%, -50%) scale(1.05) rotate(4deg)', opacity: 1, offset: 0.55, easing: 'ease-out' },
        { transform: 'translate(-50%, calc(-50% + 6px)) scale(1.18, 0.86) rotate(0deg)', opacity: 1, offset: 0.64 },
        { transform: 'translate(-50%, calc(-50% - 14px)) scale(0.96, 1.06) rotate(-3deg)', opacity: 1, offset: 0.78 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 1 }
    ], { duration: 1500, delay: 150, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)' });
    // Then it rests, glints and melts into the cloud's own crown.
    hold(crown, [
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.9)' }
    ], { duration: 520, delay: 3550, easing: 'ease-in', fill: 'forwards' });

    const landAt = 150 + 1500 * 0.55;
    setTimeout(() => {
        if (!scene.isConnected) return;
        ring(scene, crownAt, 'amx-ring--gold', 2.4, 900);
        ring(scene, anchor, 'amx-ring--gold amx-ring--wide', 2.2, 1100, 120);
        const flash = spawn(scene, 'amx-flash amx-flash--gold', crownAt.x, crownAt.y);
        run(flash, [
            { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -50%) scale(1.8)', opacity: 0 }
        ], { duration: 900, easing: 'ease-out' });
        goldConfetti(scene, crownAt, lite ? 14 : 30);
        if (!lite) twinkles(scene, crownAt, 10, 110, 150);
        hold(medal.querySelector('.amx-medal__face'), [
            { transform: 'scale(1)' }, { transform: 'scale(0.92, 1.06)', offset: 0.25 },
            { transform: 'scale(1.08)', offset: 0.55 }, { transform: 'scale(1)' }
        ], { duration: 700, easing: 'ease-out' });
    }, landAt);

    // The banner unfurls over the hero.
    const banner = spawn(scene, 'amx-banner amx-banner--hero', anchor.x, Math.max(narrow ? 70 : 90, crownAt.y - (narrow ? 90 : 110)));
    banner.innerHTML = `<small>Hero’s Bonus</small><strong>Hero of the Day</strong><em>${esc(firstName(name))}</em>`;
    hold(banner, [
        { transform: 'translate(-50%, -50%) scale(0.05, 0.6)', opacity: 0, easing: 'cubic-bezier(0.22, 1.2, 0.36, 1)' },
        { transform: 'translate(-50%, -50%) scale(1.08, 1)', opacity: 1, offset: 0.12, easing: 'ease-out' },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.82, easing: 'ease-in' },
        { transform: 'translate(-50%, calc(-50% - 16px)) scale(0.96)', opacity: 0 }
    ], { duration: 3150, delay: landAt + 60 });

    // The bonus star rises from the crown and flies into today's tally.
    const tally = onCard ? card.querySelector('.aw-tally__item--today') : null;
    const sigil = tally?.querySelector('.aw-tally__sigil') || tally;
    const target = sigil ? centerOf(sigil) : { x: anchor.x, y: anchor.y + headRadius * 0.4 };
    const star = spawn(scene, 'amx-bonus-star', crownAt.x, crownAt.y);
    const sx = target.x - crownAt.x;
    const sy = target.y - crownAt.y;
    const starAnim = hold(star, [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(-50%, calc(-50% - 60px)) scale(1.5) rotate(180deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%, calc(-50% - 70px)) scale(1.35) rotate(250deg)', opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${sx * 0.6 + 50}px), calc(-50% + ${sy * 0.4 - 40}px)) scale(1.1) rotate(450deg)`, opacity: 1, offset: 0.75 },
        { transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(0.5) rotate(540deg)`, opacity: 0.9 }
    ], { duration: 1500, delay: landAt + 420, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' });
    popLabel(scene, { x: crownAt.x + (narrow ? 80 : 110), y: crownAt.y + 10 }, '+1<i aria-hidden="true">★</i>', 'amx-label--hero', { duration: 1500, delay: landAt + 500, rise: 70 });
    const landStar = () => {
        star.remove();
        if (!scene.isConnected) return;
        ring(scene, target, 'amx-ring--gold amx-ring--small', 1.2, 520);
        twinkles(scene, target, lite ? 3 : 6, 40);
        popElement(tally, 1.22);
        (onCard ? card : null)?.querySelector('.aw-card__lift')?.animate?.([
            { transform: 'none' },
            { transform: 'translateY(6px) scale(1.02, 0.98)', offset: 0.2 },
            { transform: 'translateY(-10px) scale(1.03)', offset: 0.5 },
            { transform: 'none' }
        ], { duration: 820, easing: 'ease-out' });
    };
    if (starAnim) starAnim.finished.then(landStar).catch(landStar);

    setTimeout(() => closeScene(scene, 520), 4250);
}

function goldConfetti(parent, at, count) {
    const kinds = ['amx-coin', 'amx-mini-star', 'amx-coin', 'amx-mini-star amx-mini-star--white'];
    for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const dist = 90 + Math.random() * 170;
        const dx = Math.cos(angle) * dist;
        const up = Math.sin(angle) * dist;
        const fall = 160 + Math.random() * 180;
        const spin = (Math.random() - 0.5) * 720;
        const scale = 0.6 + Math.random() * 0.7;
        const bit = spawn(parent, kinds[i % kinds.length], at.x, at.y);
        run(bit, [
            { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 0 },
            { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${up}px)) scale(${scale}) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.3 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${up + fall}px)) scale(${scale * 0.8}) rotate(${spin}deg)`, opacity: 0 }
        ], { duration: 1400 + Math.random() * 800, delay: Math.random() * 120, easing: 'cubic-bezier(0.2, 0.6, 0.6, 1)' });
    }
}

/** The Hero of the Day bonus in the app's normal notification stack. */
export function announceHeroBonus(name) {
    return notify({
        type: 'praise',
        className: 'herald--hero',
        title: 'Hero of the Day',
        icon: '<span class="amx-herald-crown" aria-hidden="true"></span>',
        message: `<b>${esc(firstName(name))}</b> claimed the Hero’s Bonus: <b class="amx-herald-gift">+1 ★</b> on top of today’s stars!`,
        duration: 6500
    });
}
