// Hero Campfire projector scene (lazy). Seven teacher-paced moments; nothing is spoken, everything is visual.
// Immersion first: no book codes, units, pages, timers or admin text ever appear on the projector.
import './campfire.css';
import starEmberUrl from '../../assets/campfire/star-ember.png?url';
import { CAMPFIRE_STAGES, campfireWordHint } from '../heroCampfireCore.mjs';
import { evaluateOathEvidence, CATEGORY_META } from '../emberOathCore.mjs';
import { campfireScenery, campfireMoon, constellationMarkup, constellationKinds, flameMark, telescopeMark, escapeCampfire as esc } from './campfireArt.js';
import { detectDevicePerformance } from '../../utils/devicePerformance.mjs';
import { SKY_ZOOM_REST, SKY_ZOOM_LOOK, zoomSky } from '../campfireSkyCamera.mjs';
import { createCampfireFire } from './campfireFire.js';
import { FIRE_H, FIRE_BASE } from './fireParticlesCore.mjs';
import { createCampfireAudio } from './campfireAudio.js';
import { checkInEmberOath, keepEmberOath, getOathFacts } from '../../db/actions/emberOaths.js';
import { getGuildById } from '../guilds.js';

const MOODS = [['flame', '🔥', 'I tried', 1.35], ['candle', '🕯️', 'Still growing', 0.85], ['moon', '🌙', 'A quiet day', 0.55]];
const EARLY_MOODS = [['flame', '😄', 'Happy', 1.35], ['candle', '🙂', 'Okay', 0.85], ['moon', '😴', 'Sleepy', 0.55]];
const STAGE_NAMES = { kindling: 'Kindling', words: 'Word Embers', question: 'The Question', glow: 'Class Glow', circle: 'Oath Circle', kept: 'Promises Kept', sleep: 'Embers Sleep' };
const SPARKLE = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 0C21.6 12 28 18.4 40 20C28 21.6 21.6 28 20 40C18.4 28 12 21.6 0 20C12 18.4 18.4 12 20 0Z" fill="#fff6d6"/><circle cx="20" cy="20" r="4" fill="#fff"/></svg>';
let activeClose = null;

export function openCampfireScene({ session, students = [], oaths = [], onSave = async () => {}, onComplete = async () => {}, preview = false, performance = {} }) {
    activeClose?.();
    const previousFocus = document.activeElement, app = document.getElementById('app-screen'), oldInert = app?.inert;
    if (app) app.inert = true;
    const reducedMotion = performance.reducedMotion ?? Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const tier = performance.tier || detectDevicePerformance().tier, lite = tier === 'low';
    const moon = campfireMoon();
    const root = document.createElement('section');
    root.id = 'hero-campfire-scene'; root.className = 'cf-scene';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Hero Campfire');
    root.style.setProperty('--cf-moonlight', moon.light.toFixed(3));
    root.innerHTML = campfireScenery({ lite: lite || reducedMotion }) + '<div class="cf-sky-stars">' + constellationMarkup(oaths, { students }) + '</div><div class="cf-tint" aria-hidden="true"></div>' +
        '<header class="cf-top"><div class="cf-brand">' + flameMark + '<div><span>THE GREAT CLASS QUEST</span><h1>Hero Campfire</h1></div></div><nav class="cf-progress" aria-label="Moments of the campfire"></nav>' +
        '<div class="cf-tools"><button data-action="telescope" class="cf-telescope" aria-label="Look up at our sky" aria-pressed="false" title="Look up at our sky">' + telescopeMark + '</button><button data-action="audio" aria-label="Mute the fire" title="Sound">🔊</button><button data-action="fullscreen" aria-label="Toggle full screen" title="Full screen">⛶</button><button data-action="close" aria-label="Close campfire">✕</button></div></header>' +
        '<div class="cf-content" aria-live="polite"></div><p class="cf-star-plaque" hidden></p><div class="cf-seats" hidden></div><div class="cf-fx" aria-hidden="true"></div><div class="cf-moment" hidden></div>' +
        '<aside class="cf-star-peek" hidden><b></b><p></p></aside>' +
        '<div class="cf-gaze-hint" hidden inert><span>Our sky of promises</span><button type="button" data-action="zoom-out" aria-label="Draw back">−</button><button type="button" data-action="zoom-in" aria-label="Draw closer">+</button><button type="button" data-action="telescope" aria-label="Look back at the fire">Look down</button></div>' +
        '<div class="cf-error" role="alert" hidden></div>' +
        '<footer class="cf-footer"><button data-action="skip" class="cf-quiet">Not today</button>' +
        '<div class="cf-nav"><button data-action="back" class="cf-quiet">← Back</button><button data-action="next" class="cf-next">✦ Light our fire</button></div></footer>';
    document.body.append(root);
    if (reducedMotion) root.classList.add('cf-still');
    if (lite) root.classList.add('cf-lite');

    const hearth = root.querySelector('.cf-hearth');
    const fire = createCampfireFire(root.querySelector('canvas.cf-fire'), { ...performance, reducedMotion, startIntensity: 0, lightTarget: root });
    const fitHearth = () => root.style.setProperty('--cf-scale', Math.max(0.7, Math.min(1.5, innerHeight / 700, innerWidth / 900)).toFixed(3));
    fitHearth(); addEventListener('resize', fitHearth);

    let audio = null, step = 0, disposed = false, busy = false, moving = false, kindle = 'dark'; // dark → falling → lit
    const timeouts = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); if (!disposed) fn(); }, ms); timeouts.add(id); return id; };
    const wait = ms => new Promise(resolve => later(resolve, ms));
    const checkedInIds = new Set(session.checkedInIds || []), keptOathIds = new Set(session.keptOathIds || []);
    let selfCheck = session.selfCheck || null, localOaths = [...oaths], wordsBurnt = 0;
    const burntWords = new Set(); // stays burnt when the teacher steps back to Word Embers
    const early = session.band === 'early', script = session.script;
    const circle = (script.circle || []).map(id => students.find(s => s.id === id)).filter(Boolean).slice(0, 4);
    const starCount = Math.max(6, Math.min(30, Number(session.stars) || 18));
    const starsToday = Number(session.starsToday) || 0;
    const content = root.querySelector('.cf-content'), seats = root.querySelector('.cf-seats'), fx = root.querySelector('.cf-fx');
    const moment = root.querySelector('.cf-moment'), error = root.querySelector('.cf-error'), nextBtn = root.querySelector('[data-action="next"]');
    const plaque = root.querySelector('.cf-star-plaque');
    const skyEl = root.querySelector('.cf-sky-stars');
    const peek = root.querySelector('.cf-star-peek');
    const extras = Object.fromEntries((script.embellishments || []).map(e => [String(e.word).toLowerCase(), e]));
    let gazing = false, zoom = 1, panX = 0, panY = 0, dragging = null;
    // "Who speaks first?": a fair spark that visits everyone present before anyone is picked twice.
    const spokeIds = new Set();
    let lastSpeaker = null, picking = false;

    // Warm sound starts with the scene (the teacher's click allows it); the 🔊 button mutes it.
    createCampfireAudio().then(created => { if (disposed) { created.dispose(); return; } audio = created; audio.setIntensity(0.1); syncAudioButton(); }).catch(() => { root.querySelector('[data-action="audio"]').hidden = true; });
    function syncAudioButton() {
        const b = root.querySelector('[data-action="audio"]');
        b.textContent = audio?.muted ? '🔈' : '🔊'; b.setAttribute('aria-label', audio?.muted ? 'Turn the fire sound on' : 'Mute the fire');
    }
    const setFire = value => { fire.setIntensity(value); audio?.setIntensity(value); };

    function writePlaque({ counting = false, lit = false, landed = 0, resting = false } = {}) {
        const total = starsToday || starCount;
        const shown = lit ? total : counting ? landed : total;
        plaque.hidden = false;
        plaque.classList.toggle('is-counting', counting && !resting);
        plaque.classList.toggle('is-lit', lit && !resting);
        plaque.classList.toggle('is-resting', resting);
        plaque.style.setProperty('--cf-kindle', lit || resting ? '1' : counting ? String(Math.max(0.08, landed / Math.max(1, starCount))) : '0.12');
        plaque.innerHTML = '<i class="cf-star-plaque__burst" aria-hidden="true"></i><span class="cf-star-plaque__mark">✦</span>' +
            (lit || resting
                ? '<span class="cf-star-plaque__copy"><b>' + shown + '</b> ' + (shown === 1 ? 'star' : 'stars') + ' lit our fire tonight</span>'
                : counting
                    ? '<span class="cf-star-plaque__copy"><b>' + shown + '</b> of ' + total + ' stars in the fire</span>'
                    : '<span class="cf-star-plaque__copy">Today we earned <b>' + total + '</b> ' + (total === 1 ? 'star' : 'stars') + '</span>');
    }
    function skyKey() {
        const kinds = constellationKinds(localOaths);
        if (!kinds.length) return '';
        return '<ul class="cf-sky-key" aria-label="Each colour is a kind of promise">' + kinds.map(cat => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.virtue;
            return '<li class="cf-sky-key--' + cat.replace('/', '-') + '"><i aria-hidden="true"></i>' + esc(meta.label) + '</li>';
        }).join('') + '</ul>';
    }
    function paintSky(highlightId = '') {
        skyEl.innerHTML = constellationMarkup(localOaths, { highlightId, students: early ? [] : students });
    }
    function clampPan() {
        const w = skyEl.clientWidth || innerWidth;
        const h = skyEl.clientHeight || innerHeight;
        const maxX = Math.max(120, w * 0.46 * zoom);
        const maxY = Math.max(90, h * 0.4 * zoom);
        panX = Math.max(-maxX, Math.min(maxX, panX));
        panY = Math.max(-maxY, Math.min(maxY, panY));
    }
    function applyGazeTransform({ animate = false } = {}) {
        skyEl.classList.toggle('is-gaze-animate', !!animate);
        skyEl.style.setProperty('--cf-zoom', String(zoom));
        skyEl.style.setProperty('--cf-pan-x', panX + 'px');
        skyEl.style.setProperty('--cf-pan-y', panY + 'px');
        if (animate) later(() => { if (!disposed) skyEl.classList.remove('is-gaze-animate'); }, 900);
    }
    function hidePeek() { peek.hidden = true; }
    function showPeek(star, x, y) {
        if (!gazing || !star || dragging?.moved) return hidePeek();
        peek.querySelector('b').textContent = early ? '' : (star.getAttribute('data-name') || '');
        peek.querySelector('p').textContent = star.getAttribute('data-line') || 'A promise kept';
        peek.hidden = false;
        const box = peek.getBoundingClientRect();
        const w = box.width || 180, h = box.height || 72;
        const left = Math.min(innerWidth - w / 2 - 12, Math.max(w / 2 + 12, x));
        const flip = y < h + 28;
        peek.classList.toggle('is-below', flip);
        peek.style.left = left + 'px';
        peek.style.top = (flip ? y + 18 : y) + 'px';
    }
    function setGaze(on) {
        gazing = !!on;
        root.classList.toggle('is-sky-gaze', gazing);
        root.classList.remove('is-panning');
        fx.querySelectorAll('.cf-star-name').forEach(tag => tag.remove());
        fire.setIdle(gazing || !moment.hidden);
        root.querySelectorAll('[data-action="telescope"]').forEach(b => {
            b.setAttribute('aria-pressed', String(gazing));
            if (b.closest('.cf-tools')) b.setAttribute('aria-label', gazing ? 'Look back at the fire' : 'Look up at our sky');
        });
        const hint = root.querySelector('.cf-gaze-hint');
        hint.hidden = !gazing;
        hint.inert = !gazing;
        if (gazing) {
            zoom = SKY_ZOOM_LOOK; panX = 0; panY = 0; dragging = null;
            applyGazeTransform({ animate: !reducedMotion });
            audio?.twinkle();
        } else {
            zoom = SKY_ZOOM_REST; panX = 0; panY = 0; dragging = null; hidePeek();
            applyGazeTransform({ animate: !reducedMotion });
        }
    }
    function nudgeZoom(delta, clientX, clientY) {
        if (!gazing) return;
        const prev = zoom;
        zoom = zoomSky(zoom, delta);
        if (clientX != null && prev !== zoom) {
            const rect = skyEl.getBoundingClientRect();
            const ox = clientX - (rect.left + rect.width / 2);
            const oy = clientY - (rect.top + rect.height / 2);
            panX += ox * (1 - zoom / prev);
            panY += oy * (1 - zoom / prev);
        }
        clampPan();
        applyGazeTransform({ animate: clientX == null && !reducedMotion });
    }
    async function hydrateWordArt() {
        const chips = [...content.querySelectorAll('[data-word-art]')];
        if (!chips.length || !session.classId) return;
        try {
            const { getCampfireWordImage } = await import('./campfireWordArt.js');
            await Promise.all(chips.map(async img => {
                const url = await getCampfireWordImage(session.classId, img.dataset.wordArt);
                if (url && img.isConnected) {
                    img.src = url;
                    img.closest('.cf-ember-word')?.classList.add('has-art');
                }
            }));
        } catch { /* pictures are optional */ }
    }
    const heading = (eyebrow, text, body = '') => '<p class="cf-eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(text) + '</h2>' + (body ? '<p class="cf-subtitle">' + esc(body) + '</p>' : '');
    const avatar = student => student?.avatar ? '<img src="' + esc(student.avatar) + '" alt="" loading="lazy">' : '<span>' + esc((student?.name || '✦').charAt(0).toUpperCase()) + '</span>';
    function coalPoint() {
        const r = hearth.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * (FIRE_BASE / FIRE_H) - 10 };
    }
    /** Move a fixed element along a gentle arc (Web Animations; resolves when it lands). */
    function fly(el, from, to, duration, { arc = -80, endScale = 0.45, easing = 'cubic-bezier(.45,.05,.7,.4)', trail = false } = {}) {
        el.style.left = '0px'; el.style.top = '0px';
        fx.append(el);
        if (reducedMotion || !el.animate) { el.remove(); return Promise.resolve(); }
        const mid = { x: (from.x + to.x) / 2 + (to.x > from.x ? -arc / 2 : arc / 2) * 0.4, y: Math.min(from.y, to.y) + arc };
        const stops = [[0, from], [0.08, from], [0.55, mid], [1, to]];
        const anim = el.animate([
            { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(1)', opacity: 0 },
            { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(1)', opacity: 1, offset: 0.08 },
            { transform: 'translate(' + mid.x + 'px,' + mid.y + 'px) scale(' + ((1 + endScale) / 2) + ')', opacity: 1, offset: 0.55 },
            { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(' + endScale + ')', opacity: 0.85 }
        ], { duration, easing, fill: 'forwards' });
        let trailTimer = 0;
        if (trail) {
            // Where the traveller is comes from the animation's own progress: no layout reads per dot.
            const at = p => {
                for (let i = 1; i < stops.length; i++) {
                    const [o1, a] = stops[i - 1], [o2, b] = stops[i];
                    if (p <= o2) { const k = (p - o1) / Math.max(0.0001, o2 - o1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
                }
                return to;
            };
            trailTimer = setInterval(() => {
                const p = anim.effect?.getComputedTiming?.().progress;
                if (p == null || disposed) return;
                const point = at(p), dot = document.createElement('span');
                dot.className = 'cf-trail'; dot.style.left = point.x + 'px'; dot.style.top = point.y + 'px';
                fx.append(dot); later(() => dot.remove(), 900);
            }, lite ? 70 : 40);
        }
        return anim.finished.catch(() => {}).then(() => { clearInterval(trailTimer); el.remove(); });
    }

    // ─── 0 · Kindling: today's stars fall into the sleeping coals ──────────────────
    async function lightTheFire() {
        if (kindle !== 'dark') return;
        kindle = 'falling'; nextBtn.textContent = 'Gather →';
        const total = starsToday || starCount;
        writePlaque({ counting: true, landed: 0 });
        if (reducedMotion) { writePlaque({ lit: true }); return ignite(); }
        let landed = 0;
        const flights = [];
        for (let i = 0; i < starCount; i++) {
            flights.push(wait(i * Math.max(70, 2600 / starCount)).then(() => {
                if (kindle !== 'falling') return;
                const star = document.createElement('span'); star.className = 'cf-kindle-star'; star.innerHTML = SPARKLE;
                star.style.setProperty('--size', (18 + Math.random() * 16).toFixed(0) + 'px');
                const target = coalPoint();
                const from = { x: innerWidth * (0.08 + Math.random() * 0.84), y: innerHeight * (0.04 + Math.random() * 0.22) };
                return fly(star, from, { x: target.x + (Math.random() - 0.5) * 60, y: target.y }, 1200 + Math.random() * 500, { arc: -60 - Math.random() * 80, endScale: 0.35 }).then(() => {
                    if (kindle !== 'falling') return;
                    landed++;
                    writePlaque({ counting: true, landed: Math.round(landed / starCount * total) });
                    fire.flare('#ffe6a8', 0.22); setFire(0.08 + 0.5 * landed / starCount); audio?.tink();
                });
            }));
        }
        await Promise.all(flights);
        if (kindle === 'falling') { await wait(250); ignite(); }
    }
    function ignite() {
        if (kindle === 'lit') return;
        kindle = 'lit';
        fx.querySelectorAll('.cf-kindle-star').forEach(s => s.remove());
        fire.ignite(); audio?.ignite(); setFire(1);
        root.classList.add('is-ignited');
        if (step === 0) {
            content.querySelector('h2').textContent = early ? 'Our fire is shining!' : 'Our fire is lit.';
            writePlaque({ lit: true });
            later(() => { if (!disposed && kindle === 'lit') writePlaque({ lit: true, resting: true }); }, reducedMotion ? 0 : 1100);
        }
    }

    /** A word lands in the fire: the fire roars, sparks shoot up, the word rises as light, and the fire stays a little stronger. */
    function feedTheFire(word) {
        const total = (script.words || []).length || (script.pattern ? 1 : 0);
        wordsBurnt++;
        const hue = ['#ffd27a', '#ffb86b', '#ffe39a', '#ff9d5c', '#fff0b3', '#ffc36e'][wordsBurnt % 6];
        fire.feed(hue); audio?.feed(); audio?.setIntensity(Math.min(1.3, 1 + wordsBurnt * 0.05));
        const at = coalPoint();
        const ghost = document.createElement('span'); ghost.className = 'cf-word-ghost'; ghost.textContent = word;
        ghost.style.left = at.x + 'px'; ghost.style.top = (at.y - 60) + 'px';
        fx.append(ghost); later(() => ghost.remove(), 2600);
        const ring = document.createElement('span'); ring.className = 'cf-feed-ring'; ring.style.left = at.x + 'px'; ring.style.top = at.y + 'px';
        fx.append(ring); later(() => ring.remove(), 1200);
        const count = content.querySelector('.cf-word-count');
        if (count) {
            count.textContent = wordsBurnt >= total ? '✨ All our words are in the fire!' : '🔥 ' + wordsBurnt + ' of ' + total + ' words in the fire';
            count.classList.remove('is-bumping'); void count.offsetWidth; count.classList.add('is-bumping');
        }
        if (wordsBurnt >= total && total) later(() => { fire.feed('#fff6d6'); fire.flare('#fff6d6', 0.6); audio?.chime(); }, 700);
    }

    /** A check-in under a child: react in place (no re-render), with a mood-coloured burst around the avatar. */
    function reactSeat(button, mood) {
        const seatEl = button.closest('.cf-seat'); if (!seatEl) return;
        seatEl.classList.remove('is-flame', 'is-candle', 'is-moon', 'is-reacting');
        seatEl.classList.add('is-' + mood);
        seatEl.querySelectorAll('.cf-orb').forEach(o => o.setAttribute('aria-pressed', String(o === button)));
        const avatarEl = seatEl.querySelector('.cf-seat-avatar');
        let badge = avatarEl.querySelector('.cf-seat-mood');
        if (!badge) { badge = document.createElement('b'); badge.className = 'cf-seat-mood'; badge.setAttribute('aria-hidden', 'true'); avatarEl.append(badge); }
        badge.textContent = MOODS.find(m => m[0] === mood)[1];
        badge.classList.remove('is-new'); void badge.offsetWidth; badge.classList.add('is-new');
        void seatEl.offsetWidth; seatEl.classList.add('is-reacting');
        if (reducedMotion) return;
        const burstBox = document.createElement('span'); burstBox.className = 'cf-react cf-react--' + mood; burstBox.setAttribute('aria-hidden', 'true');
        const glyph = mood === 'moon' ? '✦' : mood === 'candle' ? '•' : '';
        burstBox.innerHTML = '<i class="cf-react-ring"></i>' + Array.from({ length: 12 }, (_, i) => '<i class="cf-react-dot" style="--a:' + (i * 30 + Math.random() * 14) + 'deg;--d:' + (46 + Math.random() * 30).toFixed(0) + 'px;--t:' + (0.7 + Math.random() * 0.5).toFixed(2) + 's">' + glyph + '</i>').join('');
        avatarEl.append(burstBox); later(() => burstBox.remove(), 1400);
    }

    // ─── Oath circle seats ───────────────────────────────────────────────────────
    function renderSeats() {
        const show = step === 4 && !early && circle.length;
        if (!show) {
            seats.classList.remove('is-open');
            if (reducedMotion || !seats.innerHTML) { seats.hidden = true; seats.innerHTML = ''; return; }
            later(() => { if (step !== 4) { seats.hidden = true; seats.innerHTML = ''; } }, 560);
            return;
        }
        const half = Math.ceil(circle.length / 2);
        const seat = (student, i) => {
            const oath = localOaths.find(o => o.studentId === student.id && o.status === 'active');
            const crowned = student.id === session.heroStudentId;
            const mood = oath?.checkIns?.find(c => c.date === session.date)?.mood || '';
            const guild = getGuildById(student.guildId);
            const text = oath ? oath.text || oath.projectorText : '✨ A promise is waiting to be chosen';
            return '<article class="cf-seat' + (crowned ? ' is-crowned' : '') + (mood ? ' is-' + mood : '') + (oath ? '' : ' is-empty') + '" style="--seat:' + i + (guild?.primary ? ';--guild:' + esc(guild.primary) : '') + '">' +
                '<div class="cf-seat-bubble"><p>' + esc(text) + '</p></div>' +
                '<div class="cf-seat-avatar">' + avatar(student) + (crowned ? '<i class="cf-crown" aria-label="Hero of the Day">👑</i>' : '') +
                (mood ? '<b class="cf-seat-mood" aria-hidden="true">' + MOODS.find(m => m[0] === mood)[1] + '</b>' : '') + '</div>' +
                '<h3 class="cf-seat-name">' + esc(student.name) + '</h3>' +
                (oath ? '<div class="cf-seat-orbs" role="group" aria-label="' + esc(student.name) + ' check-in">' + MOODS.map(([m, icon, label]) =>
                    '<button data-mood="' + m + '" data-oath="' + esc(oath.id) + '" class="cf-orb cf-orb--' + m + '" aria-pressed="' + (mood === m) + '" aria-label="' + label + '" title="' + label + '">' + icon + '</button>').join('') + '</div>' : '') +
                '</article>';
        };
        seats.hidden = false;
        seats.innerHTML = '<div class="cf-seat-side is-left">' + circle.slice(0, half).map((s, i) => seat(s, i)).join('') + '</div><div class="cf-seat-gap" aria-hidden="true"></div>' +
            '<div class="cf-seat-side is-right">' + circle.slice(half).map((s, i) => seat(s, half - 1 - i)).join('') + '</div>';
        requestAnimationFrame(() => { if (!disposed && step === 4) seats.classList.add('is-open'); });
    }

    // ─── 2 · Who speaks first? ──────────────────────────────────────────────────
    function speakerSlot(student, chosen = false) {
        if (!student) return '<div class="cf-pick-slot" hidden aria-live="polite"></div>';
        const guild = getGuildById(student.guildId);
        return '<div class="cf-pick-slot' + (chosen ? ' is-chosen' : '') + '" aria-live="polite"' + (guild?.primary ? ' style="--guild:' + esc(guild.primary) + '"' : '') + '>' +
            '<span class="cf-pick-face">' + avatar(student) + '</span><b>' + esc(student.name) + '</b></div>';
    }
    async function passTheSpark(btn) {
        if (picking || students.length < 2) return;
        picking = true; btn.disabled = true;
        let pool = students.filter(st => !spokeIds.has(st.id));
        if (!pool.length) { spokeIds.clear(); pool = students.filter(st => st.id !== lastSpeaker?.id); }
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const show = (student, final) => {
            const slot = content.querySelector('.cf-pick-slot');
            if (slot) slot.outerHTML = speakerSlot(student, final);
        };
        const hops = reducedMotion ? 0 : 11 + Math.floor(Math.random() * 5);
        let previous = lastSpeaker?.id;
        for (let i = 0; i < hops; i++) {
            let next = students[Math.floor(Math.random() * students.length)];
            if (next.id === previous) next = students[(students.indexOf(next) + 1) % students.length];
            previous = next.id;
            show(next, false); audio?.tink();
            await wait(50 + Math.pow(i / hops, 2.2) * 340);
            if (disposed || step !== 2) { picking = false; return; }
        }
        spokeIds.add(chosen.id); lastSpeaker = chosen;
        show(chosen, true);
        fire.flare(getGuildById(chosen.guildId)?.primary || '#ffe6a8', 0.45); audio?.glow(); audio?.twinkle();
        const button = content.querySelector('[data-pick]');
        if (button) { button.disabled = false; button.textContent = '✦ Pass the spark on'; }
        picking = false;
    }

    // ─── 5 · An ember kept ───────────────────────────────────────────────────────
    const readyOaths = () => early ? [] : localOaths.filter(o => o.status === 'active' && script.readyOathIds?.includes(o.id));
    const keptCount = () => localOaths.filter(o => o.status === 'kept').length;
    async function keptMoment(oath) {
        const student = students.find(s => s.id === oath.studentId);
        const keptNow = localOaths.find(o => o.id === oath.id);
        moment.hidden = false;
        moment.innerHTML = '<div class="cf-moment-stage"><div class="cf-moment-glow"></div><div class="cf-moment-rays" aria-hidden="true"></div>' +
            '<img class="cf-moment-star" src="' + starEmberUrl + '" alt="" aria-hidden="true">' +
            '<div class="cf-moment-burst" aria-hidden="true">' + Array.from({ length: 18 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</div></div>' +
            '<div class="cf-moment-text"><div class="cf-moment-avatar">' + avatar(student) + '</div>' +
            '<p class="cf-eyebrow">A PROMISE KEPT</p><h2>' + esc(student?.name || 'A hero') + ' kept a promise!</h2>' +
            '<p class="cf-moment-quote">' + esc('“' + (keptNow?.text || keptNow?.projectorText || '') + '”') + '</p>' +
            '<button class="cf-next cf-moment-continue" data-moment-continue>✦ Place it in our sky</button></div>';
        root.classList.add('has-moment', 'is-sky-featured');
        fire.setIdle(true);
        // The ember leaves the fire and climbs to the centre of the sky.
        const stage = moment.querySelector('.cf-moment-stage').getBoundingClientRect();
        const ember = document.createElement('span'); ember.className = 'cf-rising-ember';
        audio?.whoosh(); fire.flare('#fff0c2', 0.5);
        await fly(ember, coalPoint(), { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 }, reducedMotion ? 0 : 1500, { arc: -40, endScale: 1.6, easing: 'cubic-bezier(.3,.1,.3,1)' });
        if (disposed) return;
        moment.classList.add('is-bloomed'); audio?.chime();
        await new Promise(resolve => moment.querySelector('[data-moment-continue]').addEventListener('click', resolve, { once: true }));
        if (disposed) return;
        // The star flies to ITS place in the constellation (measured after the sky is laid out), leaving a trail.
        paintSky(oath.id);
        const target = skyEl.querySelector('.cf-star.is-new');
        target?.classList.add('is-waiting');
        const imgRect = moment.querySelector('.cf-moment-star').getBoundingClientRect();
        moment.classList.add('is-leaving');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = target?.getBoundingClientRect();
        if (r && !reducedMotion) {
            const to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const traveller = document.createElement('span'); traveller.className = 'cf-traveller'; traveller.innerHTML = SPARKLE;
            audio?.whoosh();
            await fly(traveller, { x: imgRect.left + imgRect.width / 2, y: imgRect.top + imgRect.height / 2 }, to, 1700, { arc: -140, endScale: 0.16, easing: 'cubic-bezier(.55,0,.25,1)', trail: true });
            if (disposed) return;
            const land = document.createElement('span'); land.className = 'cf-land'; land.style.left = to.x + 'px'; land.style.top = to.y + 'px';
            land.innerHTML = '<i></i><i></i>' + Array.from({ length: 8 }, (_, i) => '<b style="--a:' + (i * 45) + 'deg"></b>').join('');
            fx.append(land); later(() => land.remove(), 1600);
            const tag = document.createElement('span'); tag.className = 'cf-star-name'; tag.textContent = '✦ ' + (student?.name || '');
            tag.style.left = to.x + 'px'; tag.style.top = (to.y > 70 ? to.y - 44 : to.y + 18) + 'px';
            fx.append(tag); later(() => tag.remove(), 4200);
            audio?.twinkle();
        }
        target?.classList.remove('is-waiting'); target?.classList.add('is-landed');
        moment.hidden = true; moment.className = 'cf-moment'; root.classList.remove('has-moment');
        fire.setIdle(gazing);
        await showStage(step, { animate: true, force: true });
    }

    // ─── Render ──────────────────────────────────────────────────────────────────
    function paint() {
        root.dataset.stage = CAMPFIRE_STAGES[step]; root.dataset.early = String(early);
        root.querySelector('.cf-progress').innerHTML = CAMPFIRE_STAGES.map((name, i) => {
            const label = early && name === 'circle' ? 'Class Promise' : STAGE_NAMES[name] || name;
            return '<button type="button" data-stage-jump="' + i + '" class="' + (i < step ? 'is-past' : i === step ? 'is-lit' : '') + '"' + (i === step ? ' aria-current="step"' : '') +
                ' aria-label="' + esc(label) + (i === step ? ', now' : '') + '" title="' + esc(label) + '"><i aria-hidden="true"></i><span>' + esc(label) + '</span></button>';
        }).join('');
        root.querySelector('[data-action="back"]').disabled = step === 0 || busy;
        nextBtn.textContent = step === 6 ? 'Keep the embers · Finish' : step === 0 && kindle === 'dark' ? '✦ Light our fire' : step === 0 ? 'Gather →' : 'Continue →';
        root.dataset.glow = step === 3 ? selfCheck || '' : '';
        if (step === 0) {
            content.innerHTML = heading('A SMALL CIRCLE · A SHARED LIGHT', kindle === 'lit' ? (early ? 'Our fire is shining!' : 'Our fire is lit.') : 'Come closer.', script.fireTale);
            if (kindle === 'falling') writePlaque({ counting: true });
            else if (kindle === 'lit') writePlaque({ lit: true, resting: true });
            else writePlaque();
        } else {
            if (kindle === 'lit') writePlaque({ lit: true, resting: true });
            else { plaque.hidden = true; plaque.classList.remove('is-counting', 'is-lit', 'is-resting'); }
        if (step === 1) {
            if (kindle !== 'lit') ignite();
            setFire(1);
            const words = script.words || [];
            const pattern = script.pattern;
            const ember = (w, i, extra = {}) => {
                const [icon, label] = extra.pattern ? ['✨', early ? 'Say it' : 'An example'] : campfireWordHint(w, session.band, i);
                const meta = extras[String(w).toLowerCase()] || {};
                const example = extra.example || meta.example || '';
                const cameo = meta.depict ? '<span class="cf-ember-word__cameo"><img data-word-art="' + esc(w) + '" alt=""></span>' : '';
                const gone = burntWords.has(String(w).toLowerCase());
                return '<button class="cf-ember-word' + (example ? ' has-example' : '') + (extra.pattern ? ' is-pattern' : '') + (gone ? ' is-burnt' : '') + '" data-word' + (gone ? ' disabled' : '') + ' style="--i:' + i + ';--lift:' + (Math.abs(i - (Math.max(words.length, 1) - 1) / 2) * 14).toFixed(0) + 'px">' +
                    cameo + '<span class="cf-ember-word__text">' + esc(w) + '</span><small><span aria-hidden="true">' + icon + '</span> ' + label + '</small>' +
                    (example ? '<em class="cf-ember-word__ex">' + esc(example) + '</em>' : '') + '</button>';
            };
            const chips = words.length
                ? words.map((w, i) => ember(w, i)).join('')
                : (pattern?.label ? ember(pattern.label, 0, { example: pattern.example, pattern: true }) : '');
            content.innerHTML = heading('WORD EMBERS', early ? 'Can we say these words?' : (pattern && !words.length ? 'Tonight’s pattern' : 'Which words did we bring tonight?'),
                words.length || pattern ? (early ? 'Say it together, then throw it into the fire!' : 'Look, say it, act it out or use it in a sentence. Then it joins the fire.') : 'Share one new word from today.') +
                (chips ? '<div class="cf-word-arc">' + chips + '</div><p class="cf-word-count" aria-live="polite">' + (!wordsBurnt ? '' : wordsBurnt >= (words.length || 1) ? '✨ All our words are in the fire!' : '🔥 ' + wordsBurnt + ' of ' + (words.length || 1) + ' words in the fire') + '</p>' : '');
            hydrateWordArt();
        } else if (step === 2) {
            setFire(0.9);
            content.innerHTML = heading('THE QUESTION', script.question, script.followUp) +
                (script.pattern?.example ? '<p class="cf-grammar-ex">For example: “' + esc(script.pattern.example) + '”</p>' : '') +
                ((script.starters || []).length ? '<p class="cf-starter-label">Try starting with…</p><div class="cf-starters">' + script.starters.map((s, i) => '<span style="--i:' + i + '">' + esc(s) + '</span>').join('') + '</div>' : '') +
                (students.length > 1 ? '<div class="cf-pick">' + speakerSlot(lastSpeaker, true) +
                    '<button type="button" class="cf-pick-btn" data-pick>' + (lastSpeaker ? '✦ Pass the spark on' : '✦ Who speaks first?') + '</button></div>' : '');
        } else if (step === 3) {
            // Coming back from Embers Sleep must wake the fire again (it used to stay dimmed).
            setFire((early ? EARLY_MOODS : MOODS).find(m => m[0] === selfCheck)?.[3] || 1);
            content.innerHTML = heading('CLASS GLOW', early ? 'How does our circle feel?' : 'How brightly did we learn today?', 'Show it with your hands. Every answer is welcome.') +
                '<div class="cf-glow" role="group" aria-label="Class glow">' + (early ? EARLY_MOODS : MOODS).map(([m, icon, label]) =>
                    '<button data-mood="' + m + '" class="cf-glow-orb cf-glow-orb--' + m + '" aria-pressed="' + (selfCheck === m) + '"><span class="cf-glow-icon">' + icon + '</span><small>' + label + '</small></button>').join('') + '</div>';
        } else if (step === 4 && early) {
            setFire(1);
            content.innerHTML = heading('OUR CLASS PROMISE', script.classPromise || 'We listen, we help, and we try together.', 'Everyone, hands near the fire… and together!') +
                '<button class="cf-hands" data-hands>🤲 Warm our hands together</button>';
        } else if (step === 4) {
            setFire(1);
            content.innerHTML = heading('THE OATH CIRCLE', 'Small promises. Room to grow.', circle.length ? 'How did your promise go?' : 'Our class brings its light together.');
        } else if (step === 5) {
            setFire(1);
            const ready = readyOaths();
            const kept = keptCount();
            root.classList.toggle('is-sky-featured', !ready.length);
            content.innerHTML = ready.length
                ? heading('PROMISES KEPT', ready.length === 1 ? 'A promise is ready to rise.' : ready.length + ' promises are ready to rise.', 'When the teacher confirms, the ember climbs into our sky.') +
                  '<div class="cf-medallions">' + ready.map((o, i) => {
                      const student = students.find(s => s.id === o.studentId);
                      return '<article class="cf-medallion" style="--i:' + i + '"><div class="cf-medallion-avatar">' + avatar(student) + '</div><h3>' + esc(student?.name || '') + '</h3>' +
                          '<p>' + esc(o.text || o.projectorText) + '</p><button data-keep="' + esc(o.id) + '">✨ Let it rise</button></article>';
                  }).join('') + '</div>'
                : heading('OUR SKY OF PROMISES', kept ? (kept === 1 ? 'One promise shines in our sky.' : kept + ' promises shine in our sky.') : 'Our sky is waiting for its first star.',
                    kept ? 'Look up: every star was once a small promise. Each shape is a different kind.' : 'Keep a promise, and it will shine here.')
                  + (kept ? skyKey() : '');
        } else {
            fire.dim(); audio?.setIntensity(0.3);
            content.innerHTML = heading('EMBERS SLEEP', script.closingLine, script.tomorrowSpark) + '<div class="cf-sleep-mark">' + flameMark + '</div><p class="cf-whisper">Until our next adventure.</p>';
        }
        }
        if (step !== 5 && !gazing) root.classList.remove('is-sky-featured');
        renderSeats();
    }
    async function showStage(nextStep, { animate = true, force = false } = {}) {
        if (disposed || moving) return;
        const previous = step;
        step = nextStep;
        if (previous !== nextStep) fx.querySelectorAll('.cf-star-name').forEach(tag => tag.remove());
        const shouldAnimate = animate && !reducedMotion && (force || previous !== nextStep);
        if (!shouldAnimate) {
            content.classList.remove('is-leaving', 'is-entering');
            paint();
            return;
        }
        moving = true;
        try {
            content.classList.remove('is-entering');
            content.classList.add('is-leaving');
            await wait(320);
            if (disposed) return;
            paint();
            content.classList.remove('is-leaving');
            void content.offsetWidth;
            content.classList.add('is-entering');
        } finally { moving = false; }
    }

    function close() {
        if (disposed) return; disposed = true;
        timeouts.forEach(clearTimeout); fire.dispose(); audio?.dispose();
        document.removeEventListener('keydown', keydown, true);
        window.removeEventListener('gcq:campfire-close', close);
        window.removeEventListener('gcq:campfire-art', onArt);
        removeEventListener('resize', fitHearth);
        if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
        root.remove(); if (app) app.inert = oldInert;
        if (previousFocus?.isConnected) previousFocus.focus();
        if (activeClose === close) activeClose = null;
    }
    async function guard(work) {
        if (busy || disposed) return;
        busy = true; error.hidden = true; root.setAttribute('aria-busy', 'true');
        try { await work(); }
        catch (e) { if (!disposed) { error.textContent = e.message || 'That action could not be saved. Please try again.'; error.hidden = false; } }
        finally { busy = false; root.removeAttribute('aria-busy'); if (!disposed) root.querySelector('[data-action="back"]').disabled = step === 0; }
    }
    async function next() {
        if (moving || !moment.hidden) return;
        if (gazing) return setGaze(false);
        if (step === 0 && kindle === 'dark') return lightTheFire();
        if (step === 0 && kindle === 'falling') return ignite();
        if (step < 6) return showStage(step + 1);
        await guard(async () => { await Promise.all(checkInQueue.values()); await onComplete({ selfCheck, checkedInIds: [...checkedInIds], keptOathIds: [...keptOathIds] }); close(); });
    }

    root.addEventListener('click', async event => {
        const b = event.target.closest('button'); if (!b) return;
        const action = b.dataset.action;
        if (action === 'close') return close();
        if (action === 'telescope') return setGaze(!gazing);
        if (action === 'zoom-in') return nudgeZoom(0.22);
        if (action === 'zoom-out') return nudgeZoom(-0.22);
        if (action === 'moon') { const told = b.classList.toggle('is-told'); if (told) audio?.twinkle(); return; }
        if (busy) return;
        if (b.dataset.stageJump != null) { if (!moment.hidden || moving) return; if (gazing) setGaze(false); return goTo(Number(b.dataset.stageJump), { animate: true }); }
        if (action === 'next') return next();
        if (action === 'back') { if (!moment.hidden || moving || step === 0) return; return showStage(step - 1); }
        if (action === 'fullscreen') { try { if (document.fullscreenElement === root) await document.exitFullscreen(); else await root.requestFullscreen?.(); } catch {} return; }
        if (action === 'skip') return guard(async () => { await onSave({ status: 'skipped', selfCheck, checkedInIds: [...checkedInIds], keptOathIds: [...keptOathIds] }); close(); });
        if (action === 'audio') { if (audio) { audio.toggle(); syncAudioButton(); } return; }
        if (b.hasAttribute('data-word')) {
            b.disabled = true; b.classList.add('is-burnt');
            const r = b.getBoundingClientRect(), flying = document.createElement('span');
            flying.className = 'cf-flying-word'; flying.textContent = b.querySelector('.cf-ember-word__text')?.textContent || '';
            audio?.whoosh();
            const word = flying.textContent;
            if (burntWords.has(word.toLowerCase())) return;
            burntWords.add(word.toLowerCase());
            await fly(flying, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, coalPoint(), 900, { arc: -70, endScale: 0.3 });
            if (disposed) return;
            feedTheFire(word);
            return;
        }
        if (b.hasAttribute('data-pick')) return passTheSpark(b);
        if (b.hasAttribute('data-hands')) { b.disabled = true; setFire(1.4); fire.flare('#ffe6a8', 0.8); audio?.ignite(); later(() => { if (step === 4) setFire(1); }, 2500); return; }
        if (b.dataset.mood && b.dataset.oath) return checkIn(b);
        if (b.dataset.mood) return guard(async () => {
            const mood = b.dataset.mood;
            selfCheck = mood; root.dataset.glow = mood;
            setFire((early ? EARLY_MOODS : MOODS).find(m => m[0] === mood)?.[3] || 1);
            if (mood === 'flame') fire.flare('#ffe6a8', 0.5);
            content.querySelectorAll('.cf-glow-orb').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mood === mood)));
            if (!preview) await onSave({ selfCheck });
        });
        if (b.dataset.keep) return guard(async () => {
            const kept = preview ? { ...localOaths.find(o => o.id === b.dataset.keep), status: 'kept', keptAt: { seconds: Date.now() / 1000 } } : await keepEmberOath(b.dataset.keep, { confirmed: true });
            localOaths = localOaths.map(o => o.id === kept.id ? kept : o); keptOathIds.add(kept.id);
            if (!preview) await onSave({ keptOathIds: [...keptOathIds] });
            busy = false; // the moment has its own continue button
            await keptMoment(kept);
        });
    });
    // Oath circle check-ins never wait for each other: the teacher can go round all four seats at once.
    // Taps on the same seat queue, so the last mood tapped is the one saved.
    const checkInQueue = new Map(), latestTap = new Map();
    function checkIn(b) {
        const oathId = b.dataset.oath, mood = b.dataset.mood;
        const before = localOaths.find(o => o.id === oathId);
        const savedMood = before?.checkIns?.find(ci => ci.date === session.date)?.mood || '';
        const student = students.find(st => st.id === before?.studentId);
        // Feel instant: react first, then save. A failed save puts the seat back.
        reactSeat(b, mood);
        fire.flare(mood === 'flame' ? getGuildById(student?.guildId)?.primary || '#ffc777' : mood === 'moon' ? '#b9ccff' : '#ffe0a8', mood === 'flame' ? 0.45 : 0.18);
        if (mood === 'flame') audio?.whoosh(); else if (mood === 'moon') audio?.twinkle(); else audio?.glow();
        const tap = {}; latestTap.set(oathId, tap); error.hidden = true;
        const save = async () => {
            const current = localOaths.find(o => o.id === oathId);
            const oath = preview ? { ...current, checkIns: [{ date: session.date, mood }] } : await checkInEmberOath(oathId, mood);
            if (disposed) return;
            localOaths = localOaths.map(o => o.id === oath.id ? oath : o); checkedInIds.add(oath.studentId);
            if (preview) return;
            const wasReady = script.readyOathIds?.includes(oath.id);
            if (mood === 'flame' || wasReady) {
                const ready = evaluateOathEvidence(oath, await getOathFacts(oath)).ready;
                if (disposed) return;
                script.readyOathIds = ready ? [...new Set([...(script.readyOathIds || []), oath.id])] : (script.readyOathIds || []).filter(id => id !== oath.id);
                if (ready !== Boolean(wasReady) && step === 5 && moment.hidden && !moving) showStage(5, { animate: false });
            }
            await onSave({ checkedInIds: [...checkedInIds], script });
        };
        const run = (checkInQueue.get(oathId) || Promise.resolve()).then(save).catch(e => {
            if (disposed || latestTap.get(oathId) !== tap) return;
            const seatEl = root.querySelector('.cf-orb[data-oath="' + CSS.escape(oathId) + '"]')?.closest('.cf-seat');
            seatEl?.classList.remove('is-flame', 'is-candle', 'is-moon');
            if (savedMood) seatEl?.classList.add('is-' + savedMood);
            seatEl?.querySelectorAll('.cf-orb').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.mood === savedMood)));
            const badge = seatEl?.querySelector('.cf-seat-mood');
            if (badge && savedMood) badge.textContent = MOODS.find(m => m[0] === savedMood)[1]; else badge?.remove();
            error.textContent = e?.message || 'That check-in could not be saved. Please try again.'; error.hidden = false;
        });
        checkInQueue.set(oathId, run);
        run.finally(() => { if (checkInQueue.get(oathId) === run) checkInQueue.delete(oathId); });
    }
    function keydown(event) {
        if (disposed) return;
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopImmediatePropagation();
            if (gazing) { setGaze(false); return; }
            close(); return;
        }
        if (event.key === 'Tab') {
            const items = [...root.querySelectorAll('button:not(:disabled)')].filter(el => el.offsetParent !== null);
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest?.('input,textarea,select')) {
            const key = event.key.toLowerCase();
            if (key === 'm') { event.preventDefault(); root.querySelector('[data-action="audio"]')?.click(); return; }
            if (key === 'f') { event.preventDefault(); root.querySelector('[data-action="fullscreen"]')?.click(); return; }
            if (key === 'l' && moment.hidden) { event.preventDefault(); setGaze(!gazing); return; }
        }
        if (event.target.closest?.('button,input,textarea,select') || busy || moving || gazing) return;
        if ([' ', 'Enter', 'ArrowRight'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            if (!moment.hidden) { moment.querySelector('[data-moment-continue]')?.click(); return; }
            next();
        }
        if (event.key === 'ArrowLeft' && step > 0 && moment.hidden) { event.preventDefault(); showStage(step - 1); }
    }
    function onArt(event) {
        if (event.detail?.classId !== session.classId || step !== 1) return;
        hydrateWordArt();
    }
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('gcq:campfire-close', close);
    window.addEventListener('gcq:campfire-art', onArt);
    root.addEventListener('wheel', event => {
        if (!gazing) return;
        event.preventDefault();
        nudgeZoom(event.deltaY > 0 ? -0.16 : 0.16, event.clientX, event.clientY);
    }, { passive: false });
    skyEl.addEventListener('pointerdown', event => {
        if (!gazing || event.button) return;
        dragging = { x: event.clientX, y: event.clientY, panX, panY, id: event.pointerId, moved: false };
        skyEl.setPointerCapture?.(event.pointerId);
    });
    skyEl.addEventListener('pointermove', event => {
        if (dragging && event.pointerId === dragging.id) {
            const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
            if (!dragging.moved && dx * dx + dy * dy < 36) {
                const star = event.target.closest?.('.cf-star');
                if (star) showPeek(star, event.clientX, event.clientY);
                return;
            }
            dragging.moved = true;
            hidePeek();
            root.classList.add('is-panning');
            panX = dragging.panX + dx;
            panY = dragging.panY + dy;
            clampPan();
            applyGazeTransform();
            return;
        }
        const star = event.target.closest?.('.cf-star');
        if (star) showPeek(star, event.clientX, event.clientY);
        else hidePeek();
    });
    const endPan = () => { dragging = null; root.classList.remove('is-panning'); };
    skyEl.addEventListener('pointerup', endPan);
    skyEl.addEventListener('pointercancel', endPan);
    skyEl.addEventListener('pointerleave', hidePeek);
    activeClose = close; paint();
    if (!reducedMotion) content.classList.add('is-entering');
    root.tabIndex = -1; root.focus();
    /** Jump to a named stage (preview / guidebook capture). Lights the fire if we skip kindling. */
    function goTo(name, { animate = false } = {}) {
        const i = typeof name === 'number' ? name : CAMPFIRE_STAGES.indexOf(name);
        if (i < 0 || i > 6 || disposed || (animate && i === step)) return;
        if (i > 0 && kindle !== 'lit') ignite();
        return showStage(i, { animate });
    }
    return { close, element: root, goTo };
}
