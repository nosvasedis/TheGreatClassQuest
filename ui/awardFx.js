// Award Stars: the moment a star lands.
// One, two or three stars escalate: a spark, a shine, a supernova. Every piece is a small
// element in one fixed layer, animated with the Web Animations API on transform and opacity
// only (compositor work), then removed. Glows are pre-drawn gradients, never filters.
// Styles: styles/award_stars.css (.aw-fx-*).

import { playSound } from '../audio.js';

const TIERS = {
    1: {
        sound: 'award_1',
        sparks: 10,
        spread: [34, 70],
        colors: ['#e0f2fe', '#7dd3fc', '#38bdf8'],
        rings: ['rgba(56, 189, 248, 0.8)'],
        star: 'sky',
        lift: [1, 1.018, 1],
        flare: false,
        label: '+1'
    },
    2: {
        sound: 'award_2',
        sparks: 18,
        spread: [50, 110],
        colors: ['#fae8ff', '#e879f9', '#c084fc', '#a78bfa'],
        rings: ['rgba(192, 132, 252, 0.85)', 'rgba(244, 114, 182, 0.6)'],
        star: 'violet',
        lift: [1, 1.03, 0.995, 1],
        flare: true,
        label: '+2'
    },
    3: {
        sound: 'award_3',
        sparks: 28,
        spread: [80, 190],
        colors: ['#fffbeb', '#fde047', '#fbbf24', '#fb923c'],
        rings: ['rgba(253, 224, 71, 0.95)', 'rgba(251, 146, 60, 0.75)', 'rgba(254, 240, 138, 0.6)'],
        star: 'gold',
        lift: [1, 1.06, 0.985, 1.015, 1],
        flare: true,
        rays: true,
        rain: 14,
        glow: true,
        label: '+3',
        title: 'Supernova!'
    }
};

let fxLayer = null;

function getLayer() {
    if (fxLayer?.isConnected) return fxLayer;
    fxLayer = document.createElement('div');
    fxLayer.className = 'aw-fx-layer';
    fxLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fxLayer);
    return fxLayer;
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Weak machines still get the full sequence, with fewer particles. */
function isLitePower() {
    const cores = Number(navigator.hardwareConcurrency) || 4;
    const memory = Number(navigator.deviceMemory) || 4;
    return cores <= 2 || memory <= 2;
}

function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function spawn(layer, className, x, y, style = {}) {
    const el = document.createElement('span');
    el.className = className;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    Object.assign(el.style, style);
    layer.appendChild(el);
    return el;
}

function run(el, keyframes, options) {
    if (typeof el.animate !== 'function') {
        el.remove();
        return null;
    }
    const anim = el.animate(keyframes, { fill: 'both', ...options });
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
    return anim;
}

function burstSparks(layer, origin, tier, count) {
    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const dist = tier.spread[0] + Math.random() * (tier.spread[1] - tier.spread[0]);
        const size = 4 + Math.random() * (tier === TIERS[3] ? 7 : 5);
        const color = tier.colors[i % tier.colors.length];
        const spark = spawn(layer, 'aw-fx-spark', origin.x, origin.y, {
            width: `${size}px`,
            height: `${size}px`,
            background: `radial-gradient(circle, #fff 0 20%, ${color} 45%, transparent 72%)`
        });
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        run(spark, [
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1.2)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 18}px)) scale(0.2)`, opacity: 0 }
        ], { duration: 620 + Math.random() * 380, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
    }
}

function pulseRings(layer, origin, tier) {
    tier.rings.forEach((color, i) => {
        const ring = spawn(layer, 'aw-fx-ring', origin.x, origin.y, { borderColor: color });
        run(ring, [
            { transform: 'translate(-50%, -50%) scale(0.15)', opacity: 0.95 },
            { transform: `translate(-50%, -50%) scale(${1.1 + i * 0.45})`, opacity: 0 }
        ], { duration: 700 + i * 160, delay: i * 120, easing: 'cubic-bezier(0.1, 0.6, 0.3, 1)' });
    });
}

function flyStars(layer, origin, target, tier, count, onLand) {
    for (let i = 0; i < count; i += 1) {
        const star = spawn(layer, `aw-fx-star aw-fx-star--${tier.star}`, origin.x, origin.y);
        const dx = target.x - origin.x + (i - (count - 1) / 2) * 6;
        const dy = target.y - origin.y;
        const lift = 70 + Math.min(140, Math.abs(dx) * 0.35) + i * 14;
        const side = (i - (count - 1) / 2) * 34;
        const anim = run(star, [
            { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 0 },
            { transform: `translate(calc(-50% + ${side}px), calc(-50% - 28px)) scale(1.35) rotate(90deg)`, opacity: 1, offset: 0.22 },
            { transform: `translate(calc(-50% + ${dx * 0.5 + side * 0.6}px), calc(-50% + ${dy * 0.5 - lift}px)) scale(1.1) rotate(220deg)`, opacity: 1, offset: 0.6 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45) rotate(360deg)`, opacity: 0.9 }
        ], { duration: 760, delay: i * 120, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
        if (anim) anim.finished.then(() => onLand?.(i)).catch(() => {});
    }
}

function landingTwinkle(layer, target, tier) {
    const ring = spawn(layer, 'aw-fx-ring aw-fx-ring--small', target.x, target.y, { borderColor: tier.rings[0] });
    run(ring, [
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0 }
    ], { duration: 420, easing: 'ease-out' });
}

function popElement(el, scale = 1.16) {
    el?.animate?.([
        { transform: 'scale(1)' },
        { transform: `scale(${scale}) translateY(-2px)`, offset: 0.4 },
        { transform: 'scale(1)' }
    ], { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

function floatLabel(layer, origin, tier) {
    const label = spawn(layer, `aw-fx-label aw-fx-label--${tier.star}`, origin.x, origin.y - 24);
    label.textContent = tier.label;
    if (tier.title) {
        const sub = document.createElement('small');
        sub.textContent = tier.title;
        label.appendChild(sub);
    }
    run(label, [
        { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
        { transform: 'translate(-50%, calc(-50% - 26px)) scale(1.15)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, calc(-50% - 52px)) scale(1)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%, calc(-50% - 72px)) scale(0.95)', opacity: 0 }
    ], { duration: tier.title ? 1500 : 1100, easing: 'ease-out' });
}

function sunburst(layer, origin) {
    const rays = spawn(layer, 'aw-fx-rays', origin.x, origin.y);
    run(rays, [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(40deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%, -50%) scale(1.35) rotate(95deg)', opacity: 0 }
    ], { duration: 1300, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
    const core = spawn(layer, 'aw-fx-core', origin.x, origin.y);
    run(core, [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0 }
    ], { duration: 900, easing: 'ease-out' });
}

function skyGlow(layer, origin) {
    const glow = spawn(layer, 'aw-fx-glow', 0, 0, {
        background: `radial-gradient(circle at ${origin.x}px ${origin.y}px, rgba(253, 224, 71, 0.34), rgba(251, 146, 60, 0.12) 32%, transparent 62%)`
    });
    run(glow, [
        { opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 0 }
    ], { duration: 1400, easing: 'ease-out' });
}

function starRain(layer, card, count) {
    const r = card.getBoundingClientRect();
    for (let i = 0; i < count; i += 1) {
        const x = r.left + r.width * (0.1 + Math.random() * 0.8);
        const y = r.top + r.height * (0.05 + Math.random() * 0.25);
        const star = spawn(layer, `aw-fx-star aw-fx-star--${i % 3 === 0 ? 'white' : 'gold'} aw-fx-star--rain`, x, y);
        const drift = (Math.random() - 0.5) * 90;
        const fall = 150 + Math.random() * 200;
        const spin = (Math.random() - 0.5) * 540;
        const scale = 0.6 + Math.random() * 0.8;
        run(star, [
            { transform: `translate(-50%, -50%) scale(0) rotate(0deg)`, opacity: 0 },
            { transform: `translate(calc(-50% + ${drift * 0.3}px), calc(-50% - 30px)) scale(${scale * 1.2}) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.2 },
            { transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${fall}px)) scale(${scale * 0.4}) rotate(${spin}deg)`, opacity: 0 }
        ], { duration: 1100 + Math.random() * 700, delay: 180 + Math.random() * 420, easing: 'cubic-bezier(0.3, 0, 0.7, 1)' });
    }
}

function liftCard(card, tier) {
    const lift = card.querySelector('.aw-card__lift');
    if (!lift?.animate) return;
    const n = tier.lift.length;
    lift.animate(tier.lift.map((s, i) => ({
        transform: `translateY(${i === 1 ? -7 * (s - 1) * 20 : 0}px) scale(${s})`,
        offset: i / (n - 1)
    })), { duration: tier === TIERS[3] ? 900 : 560, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
}

function flareCard(card, stars) {
    card.classList.remove('aw-flare', 'aw-flare--2', 'aw-flare--3');
    void card.offsetWidth;
    card.classList.add('aw-flare', `aw-flare--${stars}`);
    const halo = card.querySelector('.aw-cloud__halo');
    const clear = () => card.classList.remove('aw-flare', 'aw-flare--2', 'aw-flare--3');
    halo?.addEventListener('animationend', clear, { once: true });
    setTimeout(clear, 1600);
}

/**
 * The award moment. Call before the card seals (the star button is still in place).
 * @param {HTMLElement} button the pressed star button
 * @param {number} starCount 1, 2 or 3
 */
export function triggerAwardEffects(button, starCount) {
    const stars = Math.max(1, Math.min(3, Number(starCount) || 1));
    const tier = TIERS[stars];
    playSound(tier.sound);

    const card = button?.closest?.('.student-cloud-card');
    const origin = centerOf(button);
    const todayItem = card?.querySelector('.aw-tally__item--today');
    const sigil = todayItem?.querySelector('.aw-tally__sigil') || todayItem;

    if (prefersReducedMotion()) {
        popElement(todayItem, 1.08);
        return;
    }

    const lite = isLitePower();
    const layer = getLayer();
    const target = sigil ? centerOf(sigil) : { x: origin.x, y: origin.y - 120 };

    burstSparks(layer, origin, tier, lite ? Math.ceil(tier.sparks / 2) : tier.sparks);
    pulseRings(layer, origin, tier);
    floatLabel(layer, origin, tier);
    if (tier.rays) sunburst(layer, origin);
    if (tier.glow && !lite) skyGlow(layer, origin);
    if (card) {
        liftCard(card, tier);
        if (tier.flare) flareCard(card, stars);
        if (tier.rain) starRain(layer, card, lite ? Math.ceil(tier.rain / 2) : tier.rain);
    }
    flyStars(layer, origin, target, tier, stars, () => {
        landingTwinkle(layer, target, tier);
        popElement(todayItem);
    });
}

/** A soft chime and a ripple when a virtue is picked. */
export function playVirtuePick(button, reason) {
    playSound(`virtue_${reason}`);
    if (prefersReducedMotion() || !button) return;
    const layer = getLayer();
    const origin = centerOf(button.querySelector('.aw-virtue__gem') || button);
    const tone = { teamwork: '#a78bfa', creativity: '#f472b6', respect: '#34d399', focus: '#fbbf24' }[reason] || '#93c5fd';
    const ring = spawn(layer, 'aw-fx-ring aw-fx-ring--small', origin.x, origin.y, { borderColor: tone });
    run(ring, [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
        { transform: 'translate(-50%, -50%) scale(0.7)', opacity: 0 }
    ], { duration: 460, easing: 'ease-out' });
}
