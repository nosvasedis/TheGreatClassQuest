// features/quietDragonSounds.js — the Quiet Dragon's own sound (loaded with its stage).
//
// Synthesised with Tone.js, all in E major (a lullaby key), so every moment sounds like one piece:
// a harp, a music box, glass bells, a warm pad, a soft drum, and the dragon itself: a low purr when
// it is pleased and a growl when it wakes. Nothing ever plays while the microphone listens (the
// dragon would hear itself); the stage only calls these before listening starts or after it stops.
// Kept light for school laptops (see utils/voiceBank.js): every note goes straight onto the audio
// clock through VoicePool / mono voices, built on first use and put to sleep when quiet.

import { loadTone } from '../utils/lazyLibraries.js';
import { isAudioReady } from '../audio.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from '../utils/voiceBank.js';

let Tone = null;
let chassis = null;

const bank = createVoiceBank((keep) => {
    if (!chassis) {
        const out = new Tone.Gain(0.85).toDestination();
        chassis = { out, reverb: new Tone.Reverb({ decay: 3.6, wet: 0.36 }).connect(out) };
    }
    const { out, reverb } = chassis;
    const mono = (node) => keep(guardMonoVoice(node));
    const pool = (Voice, options, max, dest = reverb) => keep(new VoicePool(Tone, Voice, options, max)).connect(dest);
    const v = lazyVoices({
        harp: () => pool(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.9 }, volume: -16 }, 12),
        // the music box: a bright sine with a quick fall, like a tine
        box: () => pool(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 }, volume: -12 }, 6),
        glass: () => pool(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 1.4 }, volume: -19 }, 8),
        pad: () => pool(Tone.Synth, { oscillator: { type: 'fattriangle', count: 3, spread: 24 }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.75, release: 1.6 }, volume: -22 }, 5),
        coinFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 2200 }).connect(reverb)),
        coin: () => pool(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 }, volume: -20 }, 4, v.coinFilter),
        boom: () => mono(new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3.5, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.5 }, volume: -11 }).connect(out)),
        // the dragon's purr: a low reed through a soft filter, trembling like a big cat
        purrTrem: () => keep(new Tone.Tremolo({ frequency: 13, depth: 0.75 }).connect(out).start()),
        purrFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 240, Q: 0.8 }).connect(v.purrTrem)),
        purr: () => mono(new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.35, decay: 0.6, sustain: 0.55, release: 1.1 }, volume: -12 }).connect(v.purrFilter)),
        // the growl: the same throat, angrier, its filter opening as it roars
        growlFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 300, Q: 2.5 }).connect(reverb)),
        growl: () => mono(new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 3, spread: 40 }, envelope: { attack: 0.08, decay: 0.4, sustain: 0.7, release: 0.9 }, volume: -10 }).connect(v.growlFilter)),
        breathFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 500, Q: 0.9 }).connect(reverb)),
        breath: () => mono(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.12, decay: 0.8, sustain: 0.2, release: 0.6 }, volume: -12 }).connect(v.breathFilter)),
        rumbleFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 200, Q: 0.7 }).connect(out)),
        rumble: () => mono(new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.05, decay: 1.8, sustain: 0, release: 0.8 }, volume: -6 }).connect(v.rumbleFilter)),
        shimmerFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 7000 }).connect(reverb)),
        shimmer: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.5, decay: 1.4, sustain: 0, release: 0.6 }, volume: -28 }).connect(v.shimmerFilter)),
    });
    return v;
}, { idle: 8, span: 6 });

// E major pentatonic: runs never clash however fast they go
const LADDER = ['E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'F#5', 'G#5', 'B5', 'C#6', 'E6', 'F#6', 'G#6', 'B6', 'C#7', 'E7'];

function run(v, t, notes, span, vel = 0.5, voice = 'harp') {
    const step = span / Math.max(1, notes.length - 1);
    notes.forEach((n, i) => v[voice].triggerAttackRelease(n, 0.6, t + i * step, vel * (0.7 + 0.3 * (i / notes.length))));
}

function glide(param, t, from, to, dur) {
    try {
        param.cancelScheduledValues(t);
        param.setValueAtTime(from, t);
        param.exponentialRampToValueAtTime(to, t + dur);
    } catch (_) { /* colour only */ }
}

const MOMENTS = {
    // The lair appears: a soft harp falls like moonlight, a low hum, two glass bells.
    open(v, t) {
        run(v, t, LADDER.slice(4, 14).reverse(), 0.9, 0.32);
        v.pad.triggerAttackRelease(['E3', 'B3', 'G#4'], 2.2, t + 0.3, 0.6);
        v.glass.triggerAttackRelease('B6', 1.4, t + 1.0, 0.3);
        v.glass.triggerAttackRelease('E7', 1.4, t + 1.25, 0.25);
    },
    close(v, t) {
        run(v, t, LADDER.slice(5, 12).reverse(), 0.45, 0.28);
    },
    // The gift: the dragon purrs, the harp climbs, the hoard bursts with a soft boom and the pad
    // blooms, then the music box sings the dragon's little thank-you and glass bells shimmer out.
    gift(v, t) {
        glide(v.purrFilter.frequency, t, 160, 320, 1.6);
        v.purr.triggerAttackRelease('E1', 1.6, t, 0.8);
        run(v, t + 0.1, LADDER, 0.85, 0.45);
        v.boom.triggerAttackRelease('E2', 0.6, t + 0.95, 0.7);
        v.shimmer.triggerAttackRelease(1.6, t + 0.7);
        v.pad.triggerAttackRelease(['E4', 'B4', 'G#5'], 2.8, t + 0.95, 0.85);
        ['B6', 'E7', 'G#7'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1.4, t + 1.0 + i * 0.08, 0.4 - i * 0.07));
        // the thank-you: a little music-box tune that ends home
        const tune = [['G#5', 0], ['B5', 0.22], ['E6', 0.44], ['D#6', 0.78], ['B5', 1.0], ['C#6', 1.22], ['E6', 1.5]];
        tune.forEach(([n, at], i) => v.box.triggerAttackRelease(n, i === tune.length - 1 ? 1.6 : 0.5, t + 1.6 + at, i === tune.length - 1 ? 0.75 : 0.6));
        v.pad.triggerAttackRelease(['C#4', 'A4', 'E5'], 0.9, t + 2.35, 0.55);
        v.pad.triggerAttackRelease(['E4', 'B4', 'G#5', 'E6'], 2.6, t + 3.1, 0.7);
        ['E7', 'B6', 'G#6', 'E6'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1.6, t + 3.15 + i * 0.09, 0.32));
        v.purr.triggerAttackRelease('E1', 1.3, t + 3.2, 0.55);
    },
    // One coin lands in a hero's purse (opts.i keeps neighbours on different notes).
    coin(v, t, { i = 0 } = {}) {
        const top = LADDER.slice(8);
        v.coin.triggerAttackRelease(top[(i * 3) % top.length], 0.12, t, 0.5);
    },
    // Saved: two warm bells.
    saved(v, t) {
        v.glass.triggerAttackRelease('G#6', 1.2, t, 0.35);
        v.glass.triggerAttackRelease('E7', 1.4, t + 0.12, 0.3);
    },
    // It woke: a deep growl that rises into a roar, hot breath, the cave shakes, a minor chord.
    woke(v, t) {
        glide(v.growlFilter.frequency, t, 220, 1900, 0.75);
        try { v.growlFilter.frequency.exponentialRampToValueAtTime(260, t + 1.9); } catch (_) { /* colour only */ }
        v.growl.triggerAttack('A1', t, 0.9);
        try {
            v.growl.frequency.setValueAtTime(Tone.Frequency('A1').toFrequency(), t);
            v.growl.frequency.exponentialRampToValueAtTime(Tone.Frequency('E2').toFrequency(), t + 0.6);
            v.growl.frequency.exponentialRampToValueAtTime(Tone.Frequency('C2').toFrequency(), t + 1.7);
        } catch (_) { /* colour only */ }
        v.growl.triggerRelease(t + 1.6);
        glide(v.breathFilter.frequency, t + 0.1, 300, 1600, 0.8);
        v.breath.triggerAttackRelease(1.3, t + 0.1);
        v.boom.triggerAttackRelease('E1', 0.9, t + 0.55, 0.9);
        v.rumble.triggerAttackRelease(1.8, t + 0.55);
        v.pad.triggerAttackRelease(['E3', 'G3', 'B3', 'D#4'], 1.8, t + 0.7, 0.6);
    },
};

/** Builds the voices ahead of time (the reverb takes a moment), so the first sound doesn't stall a frame. */
export async function warmQuietDragonSounds() {
    if (!isAudioReady()) return;
    try {
        Tone = Tone || await loadTone();
        bank.get(6);
    } catch (_) { /* sound is optional */ }
}

/** Plays one moment: 'open' | 'close' | 'gift' | 'coin' ({ i }) | 'saved' | 'woke'. `at` delays it (seconds). */
export function quietDragonSound(name, { at = 0, ...opts } = {}) {
    if (!isAudioReady()) return;
    const moment = MOMENTS[name];
    if (!moment) return;
    if (!Tone) {
        loadTone().then((T) => { Tone = T; quietDragonSound(name, { at, ...opts }); }).catch(() => {});
        return;
    }
    const v = bank.get(name === 'coin' ? 2 + at : 6 + at);
    try { moment(v, Tone.now() + 0.03 + Math.max(0, at), opts); } catch (_) { /* overlapping triggers are harmless */ }
}
