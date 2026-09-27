// Hero Campfire sound: a warm, procedurally synthesised fire (plain Web Audio, no files, no Tone.js).
// Bed: low filtered noise with a slow breath. Crackles: tiny band-passed noise bursts, sometimes in
// clusters, now and then a deeper log pop. Plus a whoosh for ignition, a soft tink when a star lands,
// and a bell for a kept promise. Everything belongs to this instance and is torn down on dispose.
const PREF = 'gcq_campfire_sound';

export async function createCampfireAudio() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) throw new Error('No Web Audio');
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -18; out.ratio.value = 3;
    const master = ctx.createGain();
    master.connect(out); out.connect(ctx.destination);

    // One reusable second of white noise.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };

    // Bed: the low, breathing roar of the fire.
    const bed = noiseSource(), bedFilter = ctx.createBiquadFilter(), bedGain = ctx.createGain();
    bedFilter.type = 'lowpass'; bedFilter.frequency.value = 420; bedFilter.Q.value = 0.6;
    bed.connect(bedFilter).connect(bedGain).connect(master);
    const hiss = noiseSource(), hissFilter = ctx.createBiquadFilter(), hissGain = ctx.createGain();
    hissFilter.type = 'highpass'; hissFilter.frequency.value = 5200;
    hiss.connect(hissFilter).connect(hissGain).connect(master);
    // Start silent: GainNode defaults to 1, which sounded like a fire being put out as the bed ducked in.
    bedGain.gain.value = 0.0001; hissGain.gain.value = 0.0001;
    bed.start(); hiss.start(ctx.currentTime, 0.7);

    let muted = false, intensity = 0.15, disposed = false;
    try { muted = localStorage.getItem(PREF) === 'off'; } catch {}
    const level = () => (muted || document.hidden ? 0 : 0.9);
    master.gain.value = level();

    function applyBed() {
        const t = ctx.currentTime, breath = 0.75 + Math.random() * 0.5;
        bedGain.gain.setTargetAtTime((0.05 + 0.2 * intensity) * breath, t, 0.35);
        bedFilter.frequency.setTargetAtTime(260 + 520 * intensity * breath, t, 0.4);
        hissGain.gain.setTargetAtTime(0.004 + 0.014 * intensity, t, 0.5);
    }
    function crackle(peak, duration, freq, q) {
        const t = ctx.currentTime + 0.005;
        const src = ctx.createBufferSource(); src.buffer = noise;
        const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = freq; band.Q.value = q;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.0015);
        env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(band).connect(env).connect(master);
        src.start(t, Math.random() * 1.5, duration + 0.02);
        src.onended = () => { src.disconnect(); band.disconnect(); env.disconnect(); };
    }
    let tick = 0;
    const timer = setInterval(() => {
        if (disposed || muted || document.hidden) return;
        if (++tick % 5 === 0) applyBed();
        if (Math.random() < 0.08 + 0.35 * intensity) {
            const cluster = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 3) : 1;
            for (let i = 0; i < cluster; i++) setTimeout(() => {
                if (disposed) return;
                crackle(0.05 + Math.random() * 0.28 * (0.4 + intensity), 0.006 + Math.random() * 0.03, 1400 + Math.random() * 5200, 0.8 + Math.random() * 6);
            }, i * (12 + Math.random() * 40));
        }
        if (Math.random() < 0.012 * intensity) crackle(0.35, 0.12, 180 + Math.random() * 160, 1.2); // a log settles
    }, 70);

    function whoosh(duration = 1.2, from = 220, to = 1900, peak = 0.35) {
        if (muted || disposed) return;
        const t = ctx.currentTime;
        const src = noiseSource(), band = ctx.createBiquadFilter(), env = ctx.createGain();
        band.type = 'bandpass'; band.Q.value = 1.1;
        band.frequency.setValueAtTime(from, t); band.frequency.exponentialRampToValueAtTime(to, t + duration * 0.7);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + duration * 0.35);
        env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(band).connect(env).connect(master);
        src.start(t); src.stop(t + duration + 0.05);
        src.onended = () => { src.disconnect(); band.disconnect(); env.disconnect(); };
    }
    function tone(freq, start, duration, peak, type = 'sine') {
        const t = ctx.currentTime + start;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(env).connect(master); osc.start(t); osc.stop(t + duration + 0.05);
        osc.onended = () => { osc.disconnect(); env.disconnect(); };
    }
    const visibility = () => master.gain.setTargetAtTime(level(), ctx.currentTime, 0.2);
    document.addEventListener('visibilitychange', visibility);
    applyBed();

    return {
        get muted() { return muted; },
        toggle() {
            muted = !muted;
            try { localStorage.setItem(PREF, muted ? 'off' : 'on'); } catch {}
            if (!muted) ctx.resume?.();
            visibility();
            return muted;
        },
        setIntensity(value) { intensity = Math.max(0, Math.min(1.4, value)); applyBed(); },
        /** A star lands in the coals. */
        tink() { if (muted || disposed) return; tone(1600 + Math.random() * 900, 0, 0.35, 0.05); crackle(0.12, 0.02, 3000, 3); },
        /** The fire catches. */
        ignite() { whoosh(1.6, 160, 2200, 0.5); if (!muted) tone(55, 0, 1.6, 0.12); },
        whoosh() { whoosh(0.7, 400, 2600, 0.22); },
        /** A word lands in the fire: a roar and a handful of crackles. */
        feed() {
            if (muted || disposed) return;
            whoosh(1, 250, 2400, 0.38);
            for (let i = 0; i < 6; i++) setTimeout(() => !disposed && crackle(0.2 + Math.random() * 0.2, 0.01 + Math.random() * 0.03, 1500 + Math.random() * 4000, 2 + Math.random() * 4), 120 + i * 70);
        },
        /** A quiet 🌙 check-in: a soft, starry twinkle. */
        twinkle() { if (muted || disposed) return; [2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.08, 0.6, 0.025)); },
        /** A 🕯️ check-in: one warm note. */
        glow() { if (muted || disposed) return; tone(659.25, 0, 1.2, 0.05); tone(987.77, 0.05, 0.9, 0.02); },
        /** A promise kept: a warm bell with a rising sparkle. */
        chime() {
            if (muted || disposed) return;
            [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.3]].forEach(([f, s]) => { tone(f, s, 2.2, 0.08); tone(f * 2.01, s, 1.2, 0.02); });
            [1567.98, 2093, 2637].forEach((f, i) => tone(f, 0.55 + i * 0.12, 0.8, 0.025));
        },
        dispose() {
            disposed = true; clearInterval(timer);
            document.removeEventListener('visibilitychange', visibility);
            try { bed.stop(); hiss.stop(); } catch {}
            ctx.close().catch(() => {});
        }
    };
}
