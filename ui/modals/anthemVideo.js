// ui/modals/anthemVideo.js — the guild anthem music videos: a full-screen karaoke stage for the projector.
// One clock drives everything: the anthem's own playback time. Each frame reads it and asks the pure core
// (features/anthemVideo/anthemVideoCore.mjs) which line, word, cue and beat we are on; the scene (an
// animated SVG per guild, features/anthemVideo/scenes/*) only reacts to classes and attributes, so pause,
// seek and restart can never drift. Lazy: loaded from the anthem alcove's "Watch the music video" button.
import '../../styles/anthem_video.css';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { getAnthemTiming } from '../../features/anthemVideo/anthemWordTimings.js';
import { buildWordTimeline, frameAt, resolveCues, cuesReached, beatPhase } from '../../features/anthemVideo/anthemVideoCore.mjs';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { createFx } from '../../features/anthemVideo/fxCanvas.js';

const SCENES = {
    dragon_flame: () => import('../../features/anthemVideo/scenes/dragonFlame.js'),
    grizzly_might: () => import('../../features/anthemVideo/scenes/grizzlyMight.js'),
    owl_wisdom: () => import('../../features/anthemVideo/scenes/owlWisdom.js'),
    phoenix_rising: () => import('../../features/anthemVideo/scenes/phoenixRising.js'),
};

const VOLUME = 0.9;
const CONTROLS_IDLE_MS = 2600;
const SPARK_HOP_PX = 26;
const SEEK_JUMP_SECONDS = 0.6;
const OPEN_MS = 1250;
const CLOSE_MS = 640;
const NEXT_SCALE = 0.52; // the line waiting below is drawn at this size, then grows into place
const LINE_LEAVE_MS = 900;

let _session = null;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function prefersReducedMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
}

function isLite() {
    try { return detectLowPowerTier() || prefersReducedMotion(); } catch (_) { return false; }
}

const NOTE_GLYPHS = ['♪', '♫', '♩', '♬', '♪', '♫', '♬', '♩', '♪', '♫'];

function shellHtml(guild, timeline) {
    const name = escapeHtml(guild.name);
    const emblem = getGuildEmblemUrl(guild.id);
    const crest = emblem ? `<img class="av-crest-img" src="${emblem}" alt="">` : '';
    const notes = NOTE_GLYPHS.map((n, i) => `<span class="av-portal__note" style="--i:${i};--a:${(i * 36 + 8) % 360}deg">${n}</span>`).join('');
    let lineNo = 0;
    const sheet = timeline.lines.reduce((acc, line) => {
        if (!acc.length || acc[acc.length - 1].sectionIdx !== line.sectionIdx) acc.push({ sectionIdx: line.sectionIdx, section: line.section, lines: [] });
        acc[acc.length - 1].lines.push(line);
        return acc;
    }, []).map(group => `
        <div class="av-sheet__group av-sheet__group--${group.section}">
            <span class="av-sheet__label">${group.section === 'chorus' ? 'Chorus' : 'Verse'}</span>
            ${group.lines.map(line => `<button type="button" class="av-sheet__line" data-av-line="${lineNo++}">${escapeHtml(line.text)}</button>`).join('')}
        </div>`).join('');
    return `
        <div class="av-portal" aria-hidden="true">
            <span class="av-portal__ring"></span>
            <span class="av-portal__ring av-portal__ring--2"></span>
            ${notes}
        </div>
        <div class="av-stage" data-section="intro" data-phase="intro">
            <div class="av-scene" aria-hidden="true">
                <div class="av-shaker"><div class="av-layers"></div><canvas class="av-fx"></canvas></div>
                <div class="av-flash"></div>
            </div>
            <div class="av-curtain" aria-hidden="true"></div>
            <div class="av-vignette" aria-hidden="true"></div>
            <header class="av-top">
                <div class="av-title">
                    <span class="av-title__crest">${crest}</span>
                    <div class="av-title__words">
                        <p class="av-title__kicker">Guild Anthem</p>
                        <h2 class="av-title__name font-title" id="av-title">${name}</h2>
                    </div>
                </div>
                <div class="av-top__right">
                    <span class="av-section-chip" aria-hidden="true"><span class="av-eq"><i></i><i></i><i></i><i></i></span><span class="av-section-chip__text"></span></span>
                    <button type="button" class="av-btn av-btn--icon av-btn--close" data-av="close" aria-label="Close the music video"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                </div>
            </header>
            <div class="av-intro" aria-hidden="true">
                <div class="av-intro__arch">
                    <span class="av-torch av-torch--l"><span class="av-torch__flame"></span></span>
                    <span class="av-intro__crest">${crest}</span>
                    <span class="av-torch av-torch--r"><span class="av-torch__flame"></span></span>
                </div>
                <p class="av-intro__kicker">The ${name} Anthem</p>
                <p class="av-intro__motto font-title">${escapeHtml(guild.motto || '')}</p>
                <p class="av-intro__ready">Get ready to sing!</p>
                <span class="av-countdown"><svg class="av-countdown__ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/></svg><span class="av-countdown__num font-title"></span></span>
            </div>
            <div class="av-finale">
                <div class="av-finale__seat" aria-hidden="true"><span class="av-finale__rays"></span>${emblem ? `<img class="av-finale__crest" src="${emblem}" alt="">` : ''}</div>
                <div class="av-finale__text">
                    <p class="av-finale__bravo font-title">Bravo, ${name}!</p>
                    <p class="av-finale__motto">${escapeHtml(guild.motto || '')}</p>
                    <div class="av-finale__actions">
                        <button type="button" class="av-btn av-btn--big" data-av="restart"><i class="fas fa-rotate-left" aria-hidden="true"></i> Sing it again</button>
                        <button type="button" class="av-btn av-btn--big av-btn--ghost" data-av="close"><i class="fas fa-door-open" aria-hidden="true"></i> Back to the Guild Hall</button>
                    </div>
                </div>
            </div>
            <div class="av-karaoke" aria-hidden="true">
                <div class="av-reel"></div>
            </div>
            <aside class="av-sheet" aria-label="All the words">
                <p class="av-sheet__title">All the words</p>
                <div class="av-sheet__scroll">${sheet}</div>
            </aside>
            <div class="av-controls">
                <div class="av-progress" data-av="seek" role="slider" tabindex="0" aria-label="Song position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <span class="av-progress__track"><span class="av-progress__segs"></span><span class="av-progress__fill"></span></span>
                    <span class="av-progress__knob"></span>
                </div>
                <div class="av-controls__row">
                    <div class="av-dock">
                        <button type="button" class="av-btn av-btn--icon" data-av="restart" aria-label="Start again"><i class="fas fa-backward-step" aria-hidden="true"></i></button>
                        <button type="button" class="av-btn av-btn--play" data-av="toggle" aria-label="Pause"><i class="fas fa-pause" aria-hidden="true"></i></button>
                        <span class="av-time" aria-hidden="true"><b class="av-time__now">0:00</b><span class="av-time__sep">/</span><span class="av-time__dur">0:39</span></span>
                    </div>
                    <span class="av-keys" aria-hidden="true"><kbd>Space</kbd> pause <kbd>L</kbd> words <kbd>F</kbd> full screen <kbd>Esc</kbd> close</span>
                    <div class="av-dock av-dock--right">
                        <button type="button" class="av-btn av-btn--icon" data-av="sheet" aria-label="Show all the words" aria-pressed="false"><i class="fas fa-align-left" aria-hidden="true"></i></button>
                        <button type="button" class="av-btn av-btn--icon" data-av="fullscreen" aria-label="Full screen"><i class="fas fa-expand" aria-hidden="true"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
}

function lineHtml(line) {
    if (!line) return '';
    return line.words.map((w, i) => {
        const text = escapeHtml(w.text);
        return `<span class="av-word" data-w="${i}"><span class="av-word__base">${text}</span><span class="av-word__ink">${text}</span></span>`;
    }).join(' ');
}

/** Where the iris opens from and closes back to: the music note that was pressed (or the screen's centre). */
function setOrigin(root, opener) {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    try {
        const r = opener?.getBoundingClientRect?.();
        if (r && r.width && opener.isConnected) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    } catch (_) { /* opener gone: open from the centre */ }
    root.style.setProperty('--ox', `${Math.round(x)}px`);
    root.style.setProperty('--oy', `${Math.round(y)}px`);
    // the iris must reach the farthest corner
    const far = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty('--or', `${Math.ceil(far + 40)}px`);
}

function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Open the music video for one guild. Resolves once the stage is up (the song starts straight away). */
export async function openAnthemVideo(guildId, { opener = document.activeElement, lite: forceLite } = {}) {
    const guild = getGuildById(guildId);
    if (!guild?.anthem || !guild.anthemLyrics) return false;
    closeAnthemVideo({ immediate: true });

    const lite = typeof forceLite === 'boolean' ? forceLite : isLite();
    const still = prefersReducedMotion();
    const timing = getAnthemTiming(guildId) || {};
    const timeline = buildWordTimeline(guild.anthemLyrics, timing);

    const root = document.createElement('div');
    root.id = 'anthem-video';
    root.className = `av av--${guildId} av--opening${lite ? ' av--lite' : ''}${still ? ' av--still' : ''}`;
    setOrigin(root, opener);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'av-title');
    root.style.setProperty('--g1', guild.primary);
    root.style.setProperty('--g2', guild.secondary);
    root.style.setProperty('--glow', guild.glow || guild.primary);
    root.innerHTML = shellHtml(guild, timeline);
    document.body.appendChild(root);

    const $ = sel => root.querySelector(sel);
    const stage = $('.av-stage');
    const els = {
        scene: $('.av-scene'),
        reel: $('.av-reel'),
        layers: $('.av-layers'),
        shaker: $('.av-shaker'),
        fx: $('.av-fx'),
        flash: $('.av-flash'),
        chip: $('.av-section-chip__text'),
        countdown: $('.av-countdown'),
        countNum: $('.av-countdown__num'),
        fill: $('.av-progress__fill'),
        segs: $('.av-progress__segs'),
        progress: $('.av-progress'),
        time: $('.av-time__now'),
        dur: $('.av-time__dur'),
        toggle: $('[data-av="toggle"]'),
        sheetBtn: $('[data-av="sheet"]'),
        sheetScroll: $('.av-sheet__scroll'),
        sheetLines: Array.from(root.querySelectorAll('.av-sheet__line')),
    };
    const openTimer = setTimeout(() => root.classList.remove('av--opening'), still ? 0 : OPEN_MS);

    const audio = new Audio(guild.anthem);
    audio.preload = 'auto';
    audio.volume = VOLUME;

    const session = {
        guildId, root, stage, audio, opener, timeline, lite, still,
        cues: [], reached: new Set(), rafId: 0, lastT: -1, lineIdx: -2, wordIdx: -2, beat: -2, phase: '', countdown: -1,
        wordCenters: [], lastCT: -1, lastPerf: 0, idleTimer: 0, ended: false, cleanups: [() => clearTimeout(openTimer)],
        lineEls: new Map(), scene: null, layers: [], camera: [], camTarget: null, fx: null, lastPerfFrame: 0,
    };
    _session = session;

    // The scene is a separate chunk per guild; the karaoke runs even if it is still on its way.
    SCENES[guildId]?.().then(mod => {
        if (_session !== session) return;
        const scene = mod.default || mod.scene;
        els.layers.innerHTML = scene.render({ guild, lite });
        session.scene = scene;
        session.cues = resolveCues(scene.cues, timeline);
        // a 'finale' cue lets scenes move the camera and burst when the song's outro begins
        session.cues.push({ name: 'finale', at: timing.outroAt ?? timeline.end });
        session.cues.sort((a, b) => a.at - b.at);
        const cueAt = new Map(session.cues.map(c => [c.name, c.at]));
        // camera marks in song order; 'start' is where each video opens
        session.camera = (scene.camera || [])
            .map(c => ({ ...c, at: c.cue === 'start' ? -1 : (cueAt.get(c.cue) ?? Infinity) }))
            .filter(c => Number.isFinite(c.at)).sort((a, b) => a.at - b.at);
        session.layers = Array.from(els.layers.querySelectorAll('.avl')).map(el => ({ el, d: Number(el.dataset.d ?? 1), anim: null }));
        session.fx = createFx(els.fx, scene.fx || {}, { lite, still });
        session.fx.resize();
        session.reached = new Set();
        Array.from(stage.classList).filter(c => c.startsWith('cue-')).forEach(c => stage.classList.remove(c));
        session.camTarget = null;
        session.settleNext = true;
        stage.classList.add('av-stage--scene-ready');
    }).catch(err => console.warn('Anthem video scene failed to load:', err));

    function measureLine() {
        const cur = session.lineEls.get(session.lineIdx);
        const words = cur ? Array.from(cur.querySelectorAll('.av-word')) : [];
        const top = words[0]?.offsetTop || 0;
        session.wordCenters = words.map(w => ({ x: w.offsetLeft + w.offsetWidth / 2, y: w.offsetTop - top }));
        session.wordEls = words;
        const next = session.lineEls.get(session.lineIdx + 1);
        els.reel.style.setProperty('--nh', `${next ? Math.round(next.offsetHeight * NEXT_SCALE + 4) : 0}px`);
    }

    function lineEl(i) {
        const line = timeline.lines[i];
        if (!line) return null;
        let el = session.lineEls.get(i);
        if (!el) {
            el = document.createElement('div');
            el.className = 'av-line is-queued';
            el.dataset.section = line.section;
            el.innerHTML = lineHtml(line);
            els.reel.appendChild(el);
            session.lineEls.set(i, el);
            void el.offsetWidth; // start from the queued place so it can glide in
        }
        return el;
    }

    /**
     * The lyric reel: the sung line rises away while the line waiting below grows up into its place.
     * After a seek everything is simply put where it belongs.
     */
    function setLine(idx, smooth) {
        const prev = session.lineIdx;
        session.lineIdx = idx;
        els.reel.classList.toggle('av-reel--instant', !smooth);
        if (!smooth) {
            for (const [i, el] of session.lineEls) { if (i !== idx && i !== idx + 1) { el.remove(); session.lineEls.delete(i); } }
        }
        const cur = lineEl(idx);
        lineEl(idx + 1);
        for (const [i, el] of session.lineEls) {
            const state = i === idx ? 'is-current' : i === idx + 1 ? 'is-next' : i < idx ? 'is-leaving' : 'is-queued';
            if (!el.classList.contains(state)) {
                el.classList.remove('is-current', 'is-next', 'is-leaving', 'is-queued');
                el.classList.add(state);
            }
            if (state === 'is-leaving' && !el._leaving) {
                el._leaving = setTimeout(() => { el.remove(); if (session.lineEls.get(i) === el) session.lineEls.delete(i); }, smooth ? LINE_LEAVE_MS : 0);
            }
        }
        if (cur) {
            if (!session.spark) { session.spark = document.createElement('span'); session.spark.className = 'av-spark'; }
            cur.appendChild(session.spark);
        }
        if (!smooth) requestAnimationFrame(() => els.reel.classList.remove('av-reel--instant'));
        measureLine();
        els.sheetLines.forEach((el, i) => {
            el.classList.toggle('is-now', i === idx);
            el.classList.toggle('is-sung', i < idx);
        });
        if (stage.classList.contains('av--sheet')) centerSheetLine(true);
        return prev;
    }

    function centerSheetLine(smooth) {
        const el = els.sheetLines[session.lineIdx];
        const box = els.sheetScroll;
        if (!el || !box) return;
        const top = el.offsetTop - box.clientHeight * 0.4 + el.offsetHeight / 2;
        box.scrollTo({ top: Math.max(0, top), behavior: smooth && !session.still ? 'smooth' : 'auto' });
    }

    /** Verse and chorus bands on the song bar, so the class can see where the chorus comes. */
    function paintSegments() {
        const dur = songDuration();
        const groups = [];
        timeline.lines.forEach(line => {
            const last = groups[groups.length - 1];
            if (last && last.sectionIdx === line.sectionIdx) last.end = line.end;
            else groups.push({ sectionIdx: line.sectionIdx, section: line.section, start: line.start, end: line.end });
        });
        els.segs.innerHTML = groups.map(g => {
            const left = (g.start / dur) * 100;
            const width = Math.max(0.5, ((g.end - g.start) / dur) * 100);
            return `<span class="av-seg av-seg--${g.section}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span>`;
        }).join('');
        els.dur.textContent = formatTime(dur);
    }
    function songDuration() {
        return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Math.max(39, timeline.end + 2);
    }

    function setWord(idx) {
        (session.wordEls || []).forEach((w, i) => {
            w.classList.toggle('is-sung', i < idx);
            w.classList.toggle('is-active', i === idx);
            if (i !== idx) w.style.removeProperty('--p');
        });
    }

    function syncCues(t, jumped) {
        const now = new Set(cuesReached(session.cues, t));
        const fresh = [];
        for (const name of session.reached) if (!now.has(name)) stage.classList.remove(`cue-${name}`);
        for (const name of now) if (!session.reached.has(name)) { stage.classList.add(`cue-${name}`); fresh.push(name); }
        session.reached = now;
        if (!jumped && !session.settleNext && !audio.paused) fresh.forEach(fireMoment);
        syncCamera(jumped || session.settleNext);
        session.fx?.setState(now, session.phase);
    }

    /** One-shot moments on a cue: the camera shakes, light flashes, sparks burst. */
    function fireMoment(name) {
        const scene = session.scene;
        if (!scene || session.still) return;
        session.fx?.burst(name);
        const shake = scene.shakes?.[name];
        if (shake) {
            const k = shake;
            els.shaker.animate([
                { transform: 'none' }, { transform: `translate3d(${-k}px, ${k * 0.6}px, 0)` }, { transform: `translate3d(${k * 0.9}px, ${-k * 0.6}px, 0)` },
                { transform: `translate3d(${-k * 0.6}px, ${-k * 0.4}px, 0)` }, { transform: `translate3d(${k * 0.4}px, ${k * 0.4}px, 0)` }, { transform: 'none' },
            ], { duration: 620, easing: 'ease-out' });
        }
        const flash = scene.flashes?.[name];
        if (flash) {
            els.flash.style.background = flash;
            els.flash.animate([{ opacity: 0 }, { opacity: 0.75, offset: 0.08 }, { opacity: 0.15, offset: 0.25 }, { opacity: 0.5, offset: 0.36 }, { opacity: 0 }], { duration: 1000, easing: 'ease-out' });
        }
    }

    function camTransform(cam, d) {
        const z = 1 + ((cam.z ?? 1) - 1) * d;
        return `translate3d(${((cam.x || 0) * d).toFixed(3)}%, ${((cam.y || 0) * d).toFixed(3)}%, 0) scale(${z.toFixed(4)})`;
    }

    /** The camera: every layer moves by its depth (far hills barely, the foreground most), on the GPU. */
    function syncCamera(instant) {
        if (!session.camera.length) return;
        let target = session.camera[0];
        for (const c of session.camera) if (c.cue === 'start' || session.reached.has(c.cue)) target = c;
        if (target === session.camTarget && !instant) return;
        if (target === session.camTarget && instant && !session.camMoving) return;
        session.camTarget = target;
        session.camMoving = !instant;
        for (const layer of session.layers) {
            const to = camTransform(target, layer.d);
            if (instant || session.still) {
                layer.anim?.cancel();
                layer.anim = null;
                layer.el.style.transform = to;
                continue;
            }
            const from = getComputedStyle(layer.el).transform;
            layer.anim?.cancel();
            layer.el.style.transform = to;
            layer.anim = layer.el.animate([{ transform: from === 'none' ? 'translate3d(0,0,0)' : from }, { transform: to }], {
                duration: (target.dur ?? 2.4) * 1000,
                easing: target.ease || 'cubic-bezier(.45, 0, .2, 1)',
            });
            if (audio.paused) layer.anim.pause();
        }
    }

    function syncBeat(t) {
        const { beat } = beatPhase(timing.bpm, timing.beatOffset, t);
        if (beat === session.beat) return;
        const jumped = Math.abs(beat - session.beat) > 1;
        session.beat = beat;
        if (beat < 0 || session.still) return;
        if (jumped) return; // seeking: wait for the next real beat
        const flip = beat % 2 === 0;
        stage.classList.toggle('beat-a', flip);
        stage.classList.toggle('beat-b', !flip);
        if (beat % 4 === 0) {
            const bar = Math.floor(beat / 4) % 2 === 0;
            stage.classList.toggle('bar-a', bar);
            stage.classList.toggle('bar-b', !bar);
        }
    }

    /**
     * After a seek, every cue passed on the way would replay its one-shot at once (lightning, bursts…).
     * Jump finite animations and transitions to their end so the scene simply *is* where the song is.
     */
    function settleAfterJump() {
        try {
            stage.getAnimations({ subtree: true }).forEach(anim => {
                const timing = anim.effect?.getComputedTiming?.();
                if (timing && Number.isFinite(timing.endTime)) anim.finish();
            });
        } catch (_) { /* older browsers: the scene catches up on its own */ }
    }

    /** Song time, smoothed between the browser's coarse currentTime updates. */
    function songTime() {
        const ct = audio.currentTime || 0;
        const now = performance.now();
        if (audio.paused || ct !== session.lastCT) {
            session.lastCT = ct;
            session.lastPerf = now;
            return ct;
        }
        return ct + Math.min(0.25, (now - session.lastPerf) / 1000) * (audio.playbackRate || 1);
    }

    function frame() {
        if (_session !== session) return;
        const t = songTime();
        const f = frameAt(timeline, t);
        const phase = f.phase === 'sing' ? f.section : f.phase;
        if (phase !== session.phase) {
            session.phase = phase;
            stage.dataset.section = phase;
            stage.dataset.phase = f.phase;
            if (phase === 'verse' || phase === 'chorus') els.chip.textContent = phase === 'verse' ? 'Verse' : 'Chorus';
        }
        if (t >= (timing.outroAt ?? timeline.end)) stage.classList.add('is-finale');
        else stage.classList.remove('is-finale');

        if (f.countdown !== session.countdown) {
            session.countdown = f.countdown;
            els.countNum.textContent = f.countdown > 0 ? String(f.countdown) : '';
            els.countdown.classList.remove('is-tick');
            if (f.countdown > 0) { void els.countdown.offsetWidth; els.countdown.classList.add('is-tick'); }
        }

        const jumped = session.lastT >= 0 && Math.abs(t - session.lastT) > SEEK_JUMP_SECONDS;
        const lineIdx = Math.max(0, f.lineIdx);
        if (lineIdx !== session.lineIdx) {
            session.wordIdx = -2;
            setLine(lineIdx, !jumped && lineIdx === session.lineIdx + 1 && !session.still);
            stage.dataset.line = String(lineIdx);
        }
        const singing = f.phase !== 'intro';
        if (f.wordIdx !== session.wordIdx) {
            session.wordIdx = f.wordIdx;
            setWord(singing ? f.wordIdx : -1);
        }
        const active = session.wordEls?.[f.wordIdx];
        if (active && singing) active.style.setProperty('--p', f.wordProgress.toFixed(3));

        // The bouncing spark arcs from the word being sung to the next one.
        if (session.spark && session.wordCenters.length) {
            const wi = Math.max(0, f.wordIdx);
            const p = f.wordIdx < 0 ? 0 : f.wordProgress;
            const from = session.wordCenters[wi];
            const to = session.wordCenters[Math.min(wi + 1, session.wordCenters.length - 1)];
            // a wrapped line: drop to the next row at the end of the word, never slide across it
            const sameRow = from.y === to.y;
            const x = sameRow ? from.x + (to.x - from.x) * p : from.x;
            const hop = f.wordIdx < 0 || f.phase === 'outro' ? 0 : Math.sin(Math.PI * p) * SPARK_HOP_PX;
            const y = from.y - hop;
            session.spark.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }

        syncCues(t, jumped);
        syncBeat(t);
        if (jumped || (session.settleNext && t > SEEK_JUMP_SECONDS)) { settleAfterJump(); session.fx?.clear(); }
        const nowMs = performance.now();
        const dt = session.lastPerfFrame ? (nowMs - session.lastPerfFrame) / 1000 : 0;
        session.lastPerfFrame = nowMs;
        session.fx?.tick(dt, audio.paused);
        session.settleNext = false;
        session.lastT = t;

        const dur = songDuration();
        const frac = Math.max(0, Math.min(1, t / dur));
        els.fill.style.transform = `scaleX(${frac.toFixed(4)})`;
        els.progress.style.setProperty('--f', frac.toFixed(4));
        const pct = String(Math.round(frac * 100));
        if (els.progress.getAttribute('aria-valuenow') !== pct) els.progress.setAttribute('aria-valuenow', pct);
        const label = formatTime(t);
        if (els.time.textContent !== label) els.time.textContent = label;

        session.rafId = requestAnimationFrame(frame);
    }

    function setPausedUi(paused) {
        stage.classList.toggle('av--paused', paused);
        els.toggle.setAttribute('aria-label', paused ? 'Play' : 'Pause');
        els.toggle.innerHTML = `<i class="fas fa-${paused ? 'play' : 'pause'}" aria-hidden="true"></i>`;
        els.toggle.classList.toggle('is-paused', paused);
        session.layers.forEach(l => { if (l.anim && l.anim.playState !== 'finished') { if (paused) l.anim.pause(); else l.anim.play(); } });
        if (paused) showControls(true);
    }

    function play() {
        if (session.ended) restart();
        stage.classList.remove('is-ended');
        audio.play().then(() => setPausedUi(false)).catch(() => setPausedUi(true));
    }
    function pause() { audio.pause(); setPausedUi(true); }
    function toggle() { if (audio.paused) play(); else pause(); }
    function seek(t) {
        audio.currentTime = Math.max(0, Math.min(t, songDuration() - 0.05));
        session.ended = false;
        stage.classList.remove('is-ended');
        session.lastCT = -1;
    }
    function restart() {
        session.ended = false;
        stage.classList.remove('is-ended');
        audio.currentTime = 0;
        session.lastCT = -1;
        if (audio.paused) audio.play().then(() => setPausedUi(false)).catch(() => setPausedUi(true));
    }
    function toggleSheet() {
        const on = stage.classList.toggle('av--sheet');
        els.sheetBtn.setAttribute('aria-pressed', String(on));
        els.sheetBtn.setAttribute('aria-label', on ? 'Hide all the words' : 'Show all the words');
        if (on) requestAnimationFrame(() => centerSheetLine(false));
    }
    function fullscreen() {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else root.requestFullscreen?.().catch(() => {});
    }

    function showControls(stick = false) {
        stage.classList.remove('av--idle');
        clearTimeout(session.idleTimer);
        if (stick || audio.paused) return;
        session.idleTimer = setTimeout(() => {
            if (_session === session && !audio.paused) stage.classList.add('av--idle');
        }, CONTROLS_IDLE_MS);
    }

    const actions = { toggle, restart, fullscreen, sheet: toggleSheet, close: () => closeAnthemVideo() };
    function onClick(e) {
        const lineBtn = e.target.closest('[data-av-line]');
        if (lineBtn) {
            const line = timeline.lines[Number(lineBtn.dataset.avLine)];
            if (line) { seek(Math.max(0, line.start - 0.35)); if (audio.paused) play(); }
            return;
        }
        const btn = e.target.closest('[data-av]');
        if (!btn || btn.dataset.av === 'seek') return;
        actions[btn.dataset.av]?.();
        showControls();
    }
    // Scrub the song bar: press, drag, let go.
    function seekFromPointer(e) {
        const rect = els.progress.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(frac * songDuration());
    }
    function onSeekDown(e) {
        if (e.button > 0) return;
        els.progress.setPointerCapture?.(e.pointerId);
        stage.classList.add('av--scrubbing');
        seekFromPointer(e);
    }
    function onSeekMove(e) { if (stage.classList.contains('av--scrubbing')) seekFromPointer(e); }
    function onSeekUp() { stage.classList.remove('av--scrubbing'); }
    function onKey(e) {
        if (_session !== session) return;
        const k = e.key;
        let handled = true;
        if (k === ' ' || k === 'k' || k === 'K') { if (!e.target.closest?.('button')) toggle(); else handled = false; }
        else if (k === 'Escape') closeAnthemVideo();
        else if (k === 'r' || k === 'R') restart();
        else if (k === 'f' || k === 'F') fullscreen();
        else if (k === 'l' || k === 'L') toggleSheet();
        else if (k === 'ArrowLeft') seek((audio.currentTime || 0) - 5);
        else if (k === 'ArrowRight') seek((audio.currentTime || 0) + 5);
        else if (k === 'Tab') { trapFocus(e); handled = false; }
        else handled = false;
        if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
        showControls();
    }
    function trapFocus(e) {
        const focusables = Array.from(root.querySelectorAll('button, [tabindex="0"]')).filter(el => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    const onMove = () => showControls();
    const onResize = () => { measureLine(); session.fx?.resize(); };
    const onEnded = () => {
        session.ended = true;
        stage.classList.add('is-ended');
        setPausedUi(true);
        root.querySelector('.av-finale [data-av="restart"]')?.focus();
    };
    const onFsChange = () => {
        const fs = document.fullscreenElement === root;
        const btn = root.querySelector('[data-av="fullscreen"]');
        if (btn) btn.innerHTML = `<i class="fas fa-${fs ? 'compress' : 'expand'}" aria-hidden="true"></i>`;
        requestAnimationFrame(() => { measureLine(); session.fx?.resize(); });
    };

    root.addEventListener('click', onClick);
    els.progress.addEventListener('pointerdown', onSeekDown);
    els.progress.addEventListener('pointermove', onSeekMove);
    els.progress.addEventListener('pointerup', onSeekUp);
    els.progress.addEventListener('pointercancel', onSeekUp);
    audio.addEventListener('loadedmetadata', paintSegments);
    root.addEventListener('pointermove', onMove);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFsChange);
    audio.addEventListener('ended', onEnded);
    session.cleanups.push(() => {
        root.removeEventListener('click', onClick);
        audio.removeEventListener('loadedmetadata', paintSegments);
        root.removeEventListener('pointermove', onMove);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('fullscreenchange', onFsChange);
        audio.removeEventListener('ended', onEnded);
    });

    paintSegments();
    document.fonts?.ready?.then(() => { if (_session === session) measureLine(); });
    session.rafId = requestAnimationFrame(frame);
    root.querySelector('[data-av="toggle"]')?.focus({ preventScroll: true });
    play();
    showControls();
    return true;
}

/** Close the music video and stop its song. */
export function closeAnthemVideo({ immediate = false } = {}) {
    const session = _session;
    if (!session) return;
    _session = null;
    cancelAnimationFrame(session.rafId);
    session.fx?.destroy();
    clearTimeout(session.idleTimer);
    session.cleanups.forEach(fn => fn());
    if (document.fullscreenElement === session.root) document.exitFullscreen?.().catch(() => {});

    const { audio, root } = session;
    const startV = audio.volume;
    const steps = 12;
    let step = 0;
    const fade = setInterval(() => {
        step++;
        audio.volume = Math.max(0, startV * (1 - step / steps));
        if (step >= steps) { clearInterval(fade); audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }, immediate ? 1 : 40);

    if (immediate || session.still) root.remove();
    else {
        setOrigin(root, session.opener);
        root.classList.remove('av--opening');
        root.classList.add('av--closing');
        setTimeout(() => root.remove(), CLOSE_MS);
    }
    try { session.opener?.focus?.({ preventScroll: true }); } catch (_) { /* opener may be gone */ }
}

/** Test/guidebook hook: the live session's song time controls. */
export function getAnthemVideoSession() {
    return _session ? { guildId: _session.guildId, audio: _session.audio, stage: _session.stage } : null;
}
