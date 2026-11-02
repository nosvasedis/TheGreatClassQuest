// Quiz of the Week sounds, recorded once and then simply played back.
//
// Why: the live show used to build a small synth band (brass, bells, drums, a convolution reverb)
// and play every note in real time. On a weak school laptop the audio thread could not keep up
// while the stage animated, so the sound crackled, came out late and bunched up ("strange"), or
// cut out. Now each sound is rendered ahead of time in an OfflineAudioContext (off the real-time
// thread, faster than real time) while the curtain is up, and the show only starts a buffer:
// the cheapest thing Web Audio can do, the same on every laptop.
//
// Every node below is built with `context: ctx`, the offline context, and never through
// Tone.Offline (which swaps the app's global context for a moment and could catch a live sound).
// The rendered buffers are mono: one projector, one speaker.

const NOTE_LADDER = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];

/** The spotlight roulette's gaps (ms) between names: ui/modals/quizOfTheWeek.js spins with these. */
export const QUIZ_SPIN_GAPS = [55, 60, 65, 75, 90, 110, 135, 165, 205];
export const QUIZ_SPIN_LAST_GAP = 240;

/** A stable name for one recorded sound. */
export function quizShowKey(name, opts = {}) {
    switch (name) {
        case 'flick': {
            const steps = Math.max(1, Math.round(Number(opts.steps) || 1));
            const step = Math.max(0, Math.min(Math.round(Number(opts.step) || 0), steps - 1));
            const gap = Math.round(Math.max(0.04, Number(opts.gap) || 0.06) * 1000);
            return `flick:${step}:${steps}:${gap}`;
        }
        case 'land': return `land:${opts.passed ? 'pass' : 'first'}`;
        case 'cheer': return `cheer:${opts.firstTry ? 'first' : 'late'}`;
        case 'tally': return `tally:${Math.round(Math.max(0.4, Number(opts.seconds) || 1.4) * 10)}`;
        case 'count': return `count:${Math.round(Math.max(0.3, Number(opts.seconds) || 0.9) * 50)}`;
        case 'fanfare': return `fanfare:${opts.tier === 'legendary' || opts.tier === 'epic' ? 'big' : 'small'}`;
        default: return name;
    }
}

/** What the stage plays first, in the order it is needed: rendered as soon as the stage opens. */
export function quizShowWarmList() {
    const list = [
        ['open'], ['question'],
        ...QUIZ_SPIN_GAPS.map((_, i) => ['flick', { step: i, steps: QUIZ_SPIN_GAPS.length, gap: (QUIZ_SPIN_GAPS[i + 1] ?? QUIZ_SPIN_LAST_GAP) / 1000 }]),
        ['land', { passed: false }], ['cheer', { firstTry: true }], ['buzz'], ['pass'], ['land', { passed: true }],
        ['cheer', { firstTry: false }], ['missed'], ['skip'], ['pause'], ['resume'], ['trick'],
        ['tally', { seconds: 1.4 }],
        ['fanfare', { tier: 'rare' }], ['fanfare', { tier: 'epic' }], ['confetti'],
        ['count', { seconds: 1.02 }], ['count', { seconds: 1.14 }], ['count', { seconds: 1.26 }], ['count', { seconds: 1.38 }],
        ['curtain'], ['replay']
    ];
    return list.map(([name, opts = {}]) => ({ name, opts, key: quizShowKey(name, opts) }));
}

// ─── The recording kit ─────────────────────────────────────────────────────

const irCache = new Map();

/** A soft hall: decaying noise, a little darker as it fades (built in plain JS, no waiting). */
function hallImpulse(T, ctx, seconds = 1.5) {
    // The convolver insists on its own context's sample rate.
    const sampleRate = ctx.sampleRate;
    const key = `${sampleRate}:${seconds}`;
    if (irCache.has(key)) return irCache.get(key);
    const length = Math.max(1, Math.floor(sampleRate * seconds));
    const data = new Float32Array(length);
    const pre = Math.floor(sampleRate * 0.012);
    let lp = 0;
    let seed = 1234567;
    for (let i = pre; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        const t = (i - pre) / sampleRate;
        // The tail loses its highs as it decays, like a real room.
        const k = 0.55 + 0.4 * Math.exp(-t * 3);
        lp += k * (noise - lp);
        data[i] = lp * Math.exp((-6.9 * t) / seconds);
    }
    const audio = ctx.createBuffer(1, length, sampleRate);
    audio.copyToChannel(data, 0);
    const buffer = new T.ToneAudioBuffer(audio);
    irCache.set(key, buffer);
    return buffer;
}

function makeKit(T, ctx) {
    const c = { context: ctx };
    const out = new T.Gain({ ...c, gain: 0.9 }).connect(ctx.destination);
    const reverb = new T.Convolver({ ...c, normalize: true });
    reverb.buffer = hallImpulse(T, ctx);
    const wet = new T.Gain({ ...c, gain: 0.32 }).connect(out);
    reverb.connect(wet);
    // `room` is the dry signal plus a share of hall; `dry` stays close and punchy.
    const room = new T.Gain(c);
    room.connect(out);
    room.connect(reverb);

    const synth = (Voice, options, dest = room) => new Voice({ ...options, ...c }).connect(dest);
    const filter = (options, dest = room) => new T.Filter({ ...options, ...c }).connect(dest);

    // Every note is known before the recording starts, so a few voices per instrument are reused
    // (a voice is free again once its note has rung out): far less to build and to render.
    const pools = new Map();
    const voice = (kind, make, at, ringsFor) => {
        if (!pools.has(kind)) pools.set(kind, []);
        const list = pools.get(kind);
        let v = list.find((entry) => entry.free <= at);
        if (!v) {
            v = { free: 0, ...make() };
            list.push(v);
        }
        v.free = at + ringsFor + 0.02;
        return v;
    };
    const play = (kind, Voice, options, dest, notes, dur, at, vel, release) => {
        [].concat(notes).forEach((n) => {
            voice(kind, () => ({ synth: synth(Voice, options, dest) }), at, dur + release)
                .synth.triggerAttackRelease(n, dur, at, vel);
        });
    };

    let brassBus = null;
    const kit = {
        T, ctx, out, room,
        /** Bright game-show brass: a detuned saw whose filter opens on every stab. */
        brass(notes, dur, at, vel = 1) {
            brassBus ||= filter({ type: 'lowpass', frequency: 2600, Q: 0.7 });
            play('brass', T.Synth, {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
                envelope: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.4 },
                volume: -19
            }, brassBus, notes, dur, at, vel, 0.45);
        },
        bell(notes, dur, at, vel = 1) {
            play('bell', T.FMSynth, {
                harmonicity: 3.01,
                modulationIndex: 4.5,
                envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.8 },
                modulationEnvelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.3 },
                volume: -15
            }, room, notes, Math.min(dur, 0.7), at, vel, 0.8);
        },
        /** A round marimba-like mallet. */
        mallet(notes, dur, at, vel = 1) {
            play('mallet', T.FMSynth, {
                harmonicity: 4,
                modulationIndex: 1.6,
                oscillator: { type: 'sine' },
                modulation: { type: 'sine' },
                envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.25 },
                modulationEnvelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.05 },
                volume: -10
            }, room, notes, dur, at, vel, 0.3);
        },
        /** A soft plucked triangle (the app's chime family). */
        pluck(notes, dur, at, vel = 1, volume = -9) {
            play(`pluck${volume}`, T.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.002, decay: 0.38, sustain: 0, release: 0.35 },
                volume
            }, room, notes, dur, at, vel, 0.4);
        },
        /** Warm triangle chord (the old quiz opening / tier chime). */
        chime(notes, dur, at, vel = 1, volume = -8) {
            play(`chime${volume}`, T.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.45 },
                volume
            }, room, notes, dur, at, vel, 0.5);
        },
        block(note, at, vel = 1) {
            play('block', T.MembraneSynth, {
                pitchDecay: 0.008, octaves: 1.4,
                envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
                volume: -12
            }, out, note, 0.05, at, vel, 0.05);
        },
        boom(note, dur, at, vel = 1) {
            play('boom', T.MembraneSynth, {
                pitchDecay: 0.06, octaves: 3,
                envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 },
                volume: -9
            }, room, note, dur, at, vel, 0.5);
        },
        snare(at, vel = 1) {
            voice('snare', () => ({
                synth: synth(T.NoiseSynth, {
                    noise: { type: 'white' },
                    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.03 },
                    volume: -20
                }, filter({ type: 'highpass', frequency: 1700 }, out))
            }), at, 0.1).synth.triggerAttackRelease(0.04, at, vel);
        },
        cymbal(dur, at, vel = 1) {
            voice('cymbal', () => ({
                synth: synth(T.NoiseSynth, {
                    noise: { type: 'white' },
                    envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.4 },
                    volume: -27
                }, filter({ type: 'highpass', frequency: 5200 }))
            }), at, dur + 0.4).synth.triggerAttackRelease(dur, at, vel);
        },
        whoosh(from, to, dur, at, vel = 1) {
            const v = voice('whoosh', () => {
                const f = filter({ type: 'bandpass', frequency: from, Q: 0.7 });
                return { f, synth: synth(T.NoiseSynth, { noise: { type: 'pink' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0, release: 0.1 }, volume: 0 }, f) };
            }, at, dur + 0.2);
            v.f.frequency.setValueAtTime(from, at);
            v.f.frequency.exponentialRampToValueAtTime(to, at + dur + 0.1);
            v.synth.envelope.attack = Math.min(0.12, dur / 3);
            v.synth.envelope.decay = dur * 0.75;
            v.synth.triggerAttackRelease(dur, at, vel);
        },
        buzz(note, dur, at, vel = 1) {
            play('buzz', T.Synth, {
                oscillator: { type: 'square' },
                envelope: { attack: 0.005, decay: 0.05, sustain: 0.8, release: 0.06 },
                volume: -17
            }, filter({ type: 'lowpass', frequency: 900, Q: 1 }, out), note, dur, at, vel, 0.08);
        },
        /** A muted horn whose filter opens and closes: the friendly "wah". */
        wah(note, dur, at, vel = 1) {
            const v = voice('wah', () => {
                const f = filter({ type: 'lowpass', frequency: 380, Q: 2.5 });
                return { f, synth: synth(T.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.2 }, volume: -13 }, f) };
            }, at, dur + 0.25);
            v.f.frequency.setValueAtTime(380, at);
            v.f.frequency.exponentialRampToValueAtTime(1300, at + 0.12);
            v.f.frequency.exponentialRampToValueAtTime(420, at + dur);
            v.synth.triggerAttackRelease(note, dur, at, vel);
        },
        /** The app's bright "correct" FM chime. */
        sparkle(note, dur, at, vel = 1) {
            play('sparkle', T.FMSynth, {
                harmonicity: 2.5,
                modulationIndex: 8,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 0.5 },
                modulation: { type: 'triangle' },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
                volume: -9
            }, room, note, dur, at, vel, 0.5);
        }
    };
    return kit;
}

// ─── The pieces ────────────────────────────────────────────────────────────
// Each returns the seconds it needs (tail included) and draws itself onto the kit at `t`.

const PIECES = {
    curtain: (k, t) => {
        k.whoosh(300, 2400, 0.45, t, 0.8);
        ['G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => k.bell(n, 0.6, t + 0.25 + i * 0.07, 0.4));
        return 2.4;
    },
    open: (k, t) => {
        k.chime(['C5', 'E5'], 0.12, t);
        k.chime(['G5', 'C6'], 0.12, t + 0.08);
        k.chime(['E6', 'G6'], 0.25, t + 0.18);
        k.cymbal(0.7, t + 0.18, 0.35);
        return 1.6;
    },
    question: (k, t) => {
        k.pluck('G5', 0.12, t, 0.45);
        k.pluck('D6', 0.12, t + 0.07, 0.3);
        return 1.2;
    },
    flick: (k, t, opts) => {
        const steps = Math.max(1, opts.steps || 1);
        const step = Math.max(0, Math.min(opts.step || 0, steps - 1));
        const x = step / steps;
        k.block(step % 2 ? 'G4' : 'C5', t, 0.7);
        k.mallet(NOTE_LADDER[step % NOTE_LADDER.length], 0.12, t, 0.45 + 0.4 * x);
        // A snare roll fills the wait for the next name, swelling as the wheel slows.
        const gap = Math.max(0.04, Number(opts.gap) || 0.06);
        for (let dt = 0.035; dt < gap - 0.01; dt += 0.035) k.snare(t + dt, 0.2 + 0.55 * x);
        return gap + 0.9;
    },
    land: (k, t, opts) => {
        // "Ta-daa": a short pickup, then the full chord with a boom, a crash and bells.
        const [pick, chord, bells] = opts.passed
            ? [['C4', 'F4', 'A4'], ['F3', 'C4', 'F4', 'A4', 'C5'], ['C6', 'F6', 'A6', 'C7']]
            : [['D4', 'G4', 'B4'], ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], ['E6', 'G6', 'C7', 'E7']];
        k.brass(pick, 0.1, t, 0.75);
        k.brass(chord, 0.7, t + 0.14, 0.95);
        k.boom(opts.passed ? 'F1' : 'C2', 0.4, t + 0.14, 0.9);
        k.cymbal(1.1, t + 0.14, 0.85);
        bells.forEach((n, i) => k.bell(n, 0.7, t + 0.2 + i * 0.06, 0.5));
        return 2.5;
    },
    cheer: (k, t, opts) => {
        // The bright "correct" chime, then the game-show "ding-ding".
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => k.sparkle(n, i === 3 ? 0.25 : 0.12, t + [0, 0.05, 0.1, 0.18][i], 0.8));
        k.bell(['C6', 'E6'], 0.5, t + 0.22, 0.6);
        k.bell(['G6', 'C7'], 0.8, t + 0.4, 0.65);
        if (opts.firstTry) {
            k.brass(['G4', 'C5', 'E5'], 0.12, t + 0.32, 0.6);
            k.brass(['C5', 'E5', 'G5'], 0.5, t + 0.46, 0.7);
            k.cymbal(0.9, t + 0.46, 0.6);
        }
        return 2.3;
    },
    buzz: (k, t) => {
        k.buzz('D#3', 0.16, t, 0.9);
        k.buzz('D#3', 0.32, t + 0.22, 0.9);
        return 0.9;
    },
    pass: (k, t) => {
        k.whoosh(1800, 350, 0.4, t, 0.9);
        k.mallet(['E5', 'C5'], 0.15, t + 0.1, 0.45);
        return 1.3;
    },
    missed: (k, t) => {
        // A friendly "wah, wah, wah, waaah", soft enough not to sting.
        [['G3', 0, 0.32], ['F#3', 0.38, 0.32], ['F3', 0.76, 0.32], ['E3', 1.14, 0.95]]
            .forEach(([note, at, len]) => k.wah(note, len, t + at, 0.8));
        return 3;
    },
    skip: (k, t) => {
        k.whoosh(500, 3000, 0.3, t, 0.7);
        return 1;
    },
    trick: (k, t) => {
        k.whoosh(2600, 700, 0.3, t, 0.6);
        ['C7', 'G6', 'E6', 'C6', 'G5'].forEach((n, i) => k.bell(n, 0.4, t + i * 0.05, 0.45));
        k.mallet('C4', 0.2, t + 0.3, 0.5);
        return 1.7;
    },
    pause: (k, t) => {
        k.mallet('G5', 0.2, t, 0.45);
        k.mallet('C5', 0.35, t + 0.12, 0.45);
        return 1;
    },
    resume: (k, t) => {
        k.mallet('C5', 0.2, t, 0.45);
        k.mallet('G5', 0.35, t + 0.12, 0.45);
        return 1;
    },
    tally: (k, t, opts) => {
        const seconds = Math.max(0.4, Number(opts.seconds) || 1.4);
        for (let dt = 0, i = 0; dt < seconds; dt += 0.045, i++) {
            const x = dt / seconds;
            k.snare(t + dt, 0.15 + 0.75 * x * x);
            if (i % 6 === 0) k.boom('G1', 0.15, t + dt, 0.2 + 0.4 * x);
        }
        return seconds + 0.6;
    },
    count: (k, t, opts) => {
        // Ticks that slow down with the eased count-up.
        const seconds = Math.max(0.3, Number(opts.seconds) || 0.9);
        for (let x = 0, i = 0; x < 1; x += 1 / 14, i++) {
            k.block(i % 2 ? 'E5' : 'A5', t + seconds * (1 - Math.cbrt(1 - x)), 0.6);
        }
        k.bell(['E6', 'B6'], 0.5, t + seconds, 0.45);
        return seconds + 1.4;
    },
    fanfare: (k, t, opts) => {
        const big = opts.tier === 'legendary' || opts.tier === 'epic';
        k.boom('C2', 0.5, t, 0.9);
        k.cymbal(big ? 1.8 : 1.1, t, big ? 1 : 0.7);
        k.brass(['G3', 'C4', 'E4'], 0.12, t, 0.7);
        k.brass(['G3', 'C4', 'E4'], 0.12, t + 0.16, 0.7);
        k.brass(['C4', 'E4', 'G4', 'C5'], big ? 1.1 : 0.7, t + 0.32, 0.95);
        if (big) {
            k.brass(['C4', 'F4', 'A4', 'C5'], 0.3, t + 0.9, 0.85);
            k.brass(['C4', 'E4', 'G4', 'C5', 'E5'], 1.3, t + 1.2, 1);
            k.boom('C2', 0.6, t + 1.2, 0.9);
            k.cymbal(2, t + 1.2, 0.8);
        }
        const sparkle = big ? ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'] : ['C6', 'E6', 'G6', 'C7'];
        sparkle.forEach((n, i) => k.bell(n, 0.8, t + 0.36 + i * 0.07, 0.45));
        return big ? 4.2 : 2.8;
    },
    confetti: (k, t) => {
        ['C6', 'E6', 'G6'].forEach((n, i) => k.pluck(n, 0.06, t + i * 0.04, 0.75));
        return 1.1;
    },
    /** Reopening a finished show: the gentle tier chime. */
    replay: (k, t) => {
        k.chime(['C4', 'E4'], 0.12, t, 1, -6);
        k.chime(['G4', 'C5'], 0.12, t + 0.12, 1, -6);
        k.chime(['E5', 'G5', 'C6'], 0.5, t + 0.28, 1, -6);
        return 1.8;
    }
};

export function hasQuizShowPiece(name) {
    return Object.prototype.hasOwnProperty.call(PIECES, name);
}

/** Peaks kept just under full scale (the master limiter then has nothing to squash) and a soft end. */
function finish(data, sampleRate) {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
    }
    if (peak > 0.85) {
        const scale = 0.85 / peak;
        for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
    const fade = Math.min(data.length, Math.floor(sampleRate * 0.08));
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
}

/**
 * Record one quiz sound. `T` is Tone.js (already loaded by audio.js). Resolves to a ToneAudioBuffer.
 */
export async function renderQuizShowSound(T, name, opts = {}, sampleRate = 48000) {
    const draw = PIECES[name];
    if (!draw) throw new Error(`Unknown quiz sound: ${name}`);
    // Each piece returns its own length: ask it first on a kit that plays nothing.
    const silent = new Proxy({}, { get: () => () => {} });
    const seconds = draw(silent, 0.03, opts);
    const ctx = new T.OfflineContext(1, seconds, sampleRate);
    try {
        const kit = makeKit(T, ctx);
        draw(kit, 0.03, opts);
        const buffer = await ctx.render(true);
        finish(buffer.getChannelData(0), sampleRate);
        return buffer;
    } finally {
        try { ctx.dispose(); } catch (_) { /* nothing left to free */ }
    }
}
