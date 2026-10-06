// ui/modals/heroOfDayReveal.js
// The Hero of the Day reveal: the present classmates' shields hang in a ring,
// a glint hops between them, slows to a crawl and lands on the hero who was
// already chosen; the pavilion holds its breath for a moment under a spotlight,
// then a flash, a boom and the crowning. Purely theatrical: the choice itself is made (and saved)
// before this runs, by the fair rotation in db/actions/quests.js.

const MAX_SHIELDS = 14;
/** The held breath between the glint landing and the crown coming down (seconds). */
const HUSH_SECONDS = 1.9;
/** How many of the final hops count as "slowing down" (kicker changes, lights dim). */
const SLOW_HOPS = 11;
let runToken = 0;
let timers = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function faceHtml(student) {
    if (student?.avatar) return `<img src="${escapeHtml(student.avatar)}" alt="" decoding="async">`;
    return escapeHtml((student?.name || '?').trim().charAt(0).toUpperCase() || '?');
}

function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
}

function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** The ring: the hero plus up to MAX_SHIELDS - 1 classmates, in a random order. */
function pickContenders(hero, contenders) {
    const others = shuffle((contenders || []).filter(s => s && s.id !== hero.id)).slice(0, MAX_SHIELDS - 1);
    return shuffle([hero, ...others]);
}

/**
 * Hop delays for the glint: quick at first, then slowing down into the landing.
 * Returns cumulative times in seconds; the last entry is the landing on the hero.
 */
function buildHopSchedule(ringSize, startIndex, heroIndex) {
    const minHops = ringSize <= 2 ? 12 : 22;
    let hops = ((heroIndex - startIndex) % ringSize + ringSize) % ringSize;
    while (hops < minHops) hops += ringSize;
    const times = [];
    let t = 0.15;
    let gap = 0.07;
    const easeFrom = Math.max(0, hops - SLOW_HOPS);
    for (let i = 0; i <= hops; i++) {
        times.push(t);
        if (i >= easeFrom) gap *= 1.22;
        // The glint teeters on the hero's neighbour before the last step.
        t += i === hops - 1 ? gap * 1.35 : gap;
    }
    return times;
}

function formatToday() {
    try {
        return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
        return '';
    }
}

function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
}

function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
}

/**
 * Fill the modal and run the draw. The modal must already be in the DOM;
 * the caller opens it (showAnimatedModal) right after this returns.
 * @param {{ hero: object, contenders?: object[], reasonText?: string, audio?: object }} opts
 */
export function startHeroOfDayReveal({ hero, contenders = [], reasonText = 'The Class Hero!', audio = null }) {
    const modal = document.getElementById('hero-celebration-modal');
    if (!modal || !hero) return;
    const token = ++runToken;
    clearTimers();

    const nameEl = document.getElementById('hero-celebration-name');
    const reasonEl = document.getElementById('hero-celebration-reason');
    const dateEl = document.getElementById('hero-celebration-date');
    const kickerEl = document.getElementById('hero-celebration-kicker');
    const avatarEl = document.getElementById('hero-celebration-avatar');
    const drawEl = document.getElementById('hero-celebration-draw');
    const stage = modal.querySelector('.hod-stage');

    nameEl.textContent = hero.name || 'Our Hero';
    reasonEl.textContent = reasonText;
    if (dateEl) dateEl.textContent = formatToday();
    avatarEl.innerHTML = faceHtml(hero);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const crest = modal.querySelector('.hod-crest');
    modal.classList.remove('hod-finale');

    // The Hero's March plays from the moment of the reveal: the crest thumps on
    // every bar of the theme and confetti fires on the final chord.
    const keepTimeWithAnthem = () => {
        const bar = (audio?.HERO_ANTHEM_BAR || 1.905) * 1000;
        const finalBar = audio?.HERO_ANTHEM_FINAL_BAR || 5;
        for (let n = 1; n <= finalBar; n++) {
            later(() => {
                if (token !== runToken) return;
                if (crest) {
                    crest.classList.remove('is-beat');
                    void crest.offsetWidth;
                    crest.classList.add('is-beat');
                }
                if (n === finalBar) modal.classList.add('hod-finale');
            }, n * bar);
        }
    };

    const reveal = (skipped = false) => {
        if (token !== runToken || modal.dataset.phase === 'reveal') return;
        clearTimers();
        if (skipped) audio?.stopHeroDrawSound?.();
        if (kickerEl) kickerEl.textContent = 'Hear ye, hear ye!';
        modal.classList.remove('hod-tense');
        modal.dataset.phase = 'reveal';
        audio?.playHeroCrowningSound?.();
        if (stage) stage.onclick = null;
        if (!reduceMotion) keepTimeWithAnthem();
        later(() => document.getElementById('hero-celebration-close-btn')?.focus({ preventScroll: true }), 1200);
    };

    const ring = pickContenders(hero, contenders);
    if (ring.length < 2 || reduceMotion) {
        drawEl.innerHTML = '';
        modal.classList.remove('hod-tense');
        modal.dataset.phase = 'draw';
        // Let the banner unfurl before the crown comes down.
        later(() => reveal(false), reduceMotion ? 50 : 650);
        return;
    }

    // Build the ring of shields.
    const size = ring.length > 10 ? 38 : 44;
    const radius = 84;
    drawEl.style.setProperty('--hod-shield', `${size}px`);
    drawEl.innerHTML = ring.map((s, i) => {
        const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + (Math.cos(a) * radius / 216) * 100;
        const y = 50 + (Math.sin(a) * radius / 216) * 100;
        return `<span class="hod-shield" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"><span class="hod-shield__face">${faceHtml(s)}</span></span>`;
    }).join('') + `<span class="hod-draw__name"><svg class="hod-draw__horn" viewBox="0 0 48 24" aria-hidden="true"><path d="M2 9 H18 L40 2 V22 L18 15 H2 Z" fill="currentColor"/><rect x="40" y="0" width="5" height="24" rx="2" fill="currentColor"/></svg><span class="hod-draw__label"></span></span><span class="hod-draw__glow"></span>`;
    const shields = [...drawEl.querySelectorAll('.hod-shield')];
    const label = drawEl.querySelector('.hod-draw__label');

    if (kickerEl) kickerEl.textContent = 'Drawing lots';
    modal.classList.remove('hod-tense');
    modal.dataset.phase = 'draw';

    const heroIndex = ring.indexOf(hero);
    const startIndex = Math.floor(Math.random() * ring.length);
    const hopTimes = buildHopSchedule(ring.length, startIndex, heroIndex);
    const landing = hopTimes[hopTimes.length - 1];
    // Wait for the banner to unfurl, then start the draw and its sound together.
    const lead = 0.55;
    later(() => audio?.playHeroDrawSound?.(hopTimes, HUSH_SECONDS), lead * 1000);

    // The lots slow down: the lights dim, then the herald leans in.
    const slowAt = hopTimes[Math.max(0, hopTimes.length - 1 - SLOW_HOPS)];
    const leanAt = hopTimes[Math.max(0, hopTimes.length - 6)];
    later(() => modal.classList.add('hod-tense'), (lead + slowAt) * 1000);
    later(() => { if (kickerEl) kickerEl.textContent = 'The lots are slowing…'; }, (lead + leanAt) * 1000);

    let lit = null;
    hopTimes.forEach((t, i) => {
        later(() => {
            const shield = shields[(startIndex + i) % ring.length];
            lit?.classList.remove('is-lit');
            shield.classList.add('is-lit');
            lit = shield;
            if (label) label.textContent = firstName(ring[(startIndex + i) % ring.length].name);
        }, (lead + t) * 1000);
    });
    // Landing, then the hush: a spotlight on the chosen shield while everyone waits.
    later(() => {
        lit?.classList.remove('is-lit');
        const chosen = shields[heroIndex];
        chosen.classList.add('is-chosen');
        const glow = drawEl.querySelector('.hod-draw__glow');
        if (glow) {
            glow.style.left = chosen.style.left;
            glow.style.top = chosen.style.top;
        }
        if (label) label.textContent = '';
        if (kickerEl) kickerEl.textContent = 'And the Hero of the Day is…';
        drawEl.style.setProperty('--hod-hush', `${HUSH_SECONDS}s`);
        modal.dataset.phase = 'hush';
    }, (lead + landing) * 1000 + 10);
    later(() => reveal(false), (lead + landing + HUSH_SECONDS) * 1000);

    if (stage) stage.onclick = (e) => {
        if (e.target.closest('#hero-celebration-close-btn')) return;
        reveal(true);
    };
}

/** Called when the modal closes: stop timers and fade any sound still scheduled. */
export function stopHeroOfDayReveal(audio = null) {
    runToken++;
    clearTimers();
    const modal = document.getElementById('hero-celebration-modal');
    const stage = modal?.querySelector('.hod-stage');
    if (stage) stage.onclick = null;
    modal?.classList.remove('hod-tense', 'hod-finale');
    audio?.stopHeroRevealSound?.();
}
