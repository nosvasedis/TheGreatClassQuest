// features/wheelSounds.js — the Fortune's Wheel's own sound (loaded with the wheel).
//
// All synthesised with Tone.js, all in D major (the Lydian G# for the rarest fates), so every
// moment of the ceremony sounds like one piece: a harp and glass bells, a warm pad, a little
// brass band, a soft drum and a cymbal.
// Kept light for school laptops (see utils/voiceBank.js): every note goes straight onto the audio
// clock (VoicePool / mono voices, never PolySynth or PluckSynth), the voices are built on first
// use and put to sleep when quiet, and the one reverb lives in a persistent chassis.

import { loadTone } from '../utils/lazyLibraries.js';
import { isAudioReady } from '../audio.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from '../utils/voiceBank.js';

let Tone = null;
let chassis = null;

const bank = createVoiceBank((keep) => {
    if (!chassis) {
        const out = new Tone.Gain(0.85).toDestination();
        chassis = { out, reverb: new Tone.Reverb({ decay: 2.8, wet: 0.32 }).connect(out) };
    }
    const { out, reverb } = chassis;
    const mono = (node) => keep(guardMonoVoice(node));
    const pool = (Voice, options, max, dest = reverb) => keep(new VoicePool(Tone, Voice, options, max)).connect(dest);
    const v = lazyVoices({
        // the harp: glissandi and arpeggios
        harp: () => pool(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.8 }, volume: -15 }, 12),
        // glass bells: the sparkle on top
        glass: () => pool(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 1.3, sustain: 0, release: 1.2 }, volume: -17 }, 8),
        // a warm pad that swells under the big moments
        pad: () => pool(Tone.Synth, { oscillator: { type: 'fattriangle', count: 3, spread: 22 }, envelope: { attack: 0.35, decay: 0.3, sustain: 0.7, release: 1.1 }, volume: -22 }, 5),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 1900, Q: 0.6 }).connect(reverb)),
        brass: () => pool(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.2, sustain: 0.65, release: 0.35 }, volume: -21 }, 6, v.brassFilter),
        boom: () => mono(new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 4, envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.4 }, volume: -9 }).connect(out)),
        // the pegs: a wooden tock
        peg: () => pool(Tone.MembraneSynth, { pitchDecay: 0.006, octaves: 1.6, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }, volume: -16 }, 3, out),
        pegTingFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1800 }).connect(out)),
        pegTing: () => pool(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, volume: -26 }, 3, v.pegTingFilter),
        swooshFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 1.1 }).connect(reverb)),
        swoosh: () => mono(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.18, decay: 0.5, sustain: 0.1, release: 0.4 }, volume: -12 }).connect(v.swooshFilter)),
        snareFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1600 }).connect(out)),
        snare: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, volume: -20 }).connect(v.snareFilter)),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 6000 }).connect(reverb)),
        cymbal: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.003, decay: 1.5, sustain: 0, release: 0.4 }, volume: -24 }).connect(v.cymbalFilter)),
        wobble: () => mono(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 }, volume: -16 }).connect(reverb)),
    });
    return v;
}, { idle: 8, span: 4 });

// D major, a pentatonic ladder for the harp's runs (no clashes however fast it goes)
const LADDER = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];

function run(v, t, notes, span, vel = 0.5, voice = 'harp') {
    const step = span / Math.max(1, notes.length - 1);
    notes.forEach((n, i) => v[voice].triggerAttackRelease(n, 0.5, t + i * step, vel * (0.75 + 0.25 * (i / notes.length))));
}

function sweep(v, t, from, to, dur) {
    try {
        v.swooshFilter.frequency.cancelScheduledValues(t);
        v.swooshFilter.frequency.setValueAtTime(from, t);
        v.swooshFilter.frequency.exponentialRampToValueAtTime(to, t + dur);
    } catch (_) { /* the filter is optional colour */ }
    v.swoosh.triggerAttackRelease(dur, t);
}

const MOMENTS = {
    // The portal opens: air rushes in, the harp climbs, a soft boom as it fills the screen and the
    // pad and glass bells bloom as the relic appears.
    open(v, t) {
        sweep(v, t, 260, 3200, 0.62);
        run(v, t + 0.02, LADDER, 0.54, 0.45);
        v.boom.triggerAttackRelease('D2', 0.5, t + 0.55, 0.55);
        v.pad.triggerAttackRelease(['D4', 'A4', 'F#5'], 1.4, t + 0.5);
        ['A6', 'D7', 'F#7', 'A7'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1, t + 0.6 + i * 0.07, 0.45 - i * 0.05));
    },
    // The portal winds back into the button: air drawn out, the harp falls, a soft catch.
    close(v, t) {
        sweep(v, t, 2600, 240, 0.8);
        run(v, t + 0.05, LADDER.slice(2, 14).reverse(), 0.62, 0.4);
        v.boom.triggerAttackRelease('A1', 0.3, t + 0.9, 0.4);
        v.glass.triggerAttackRelease(['D7', 'A7'], 0.6, t + 0.93, 0.35);
    },
    // The pull and release: a snare flam, a whoosh and a quick strum as the wheel is flung.
    launch(v, t) {
        v.snare.triggerAttackRelease(0.05, t);
        v.snare.triggerAttackRelease(0.08, t + 0.06);
        sweep(v, t + 0.04, 400, 2400, 0.5);
        run(v, t + 0.05, ['D4', 'F#4', 'A4', 'D5', 'F#5'], 0.16, 0.42);
    },
    // A peg passes the pointer: light ticks while it flies, a heavier tock and a ring as it slows.
    peg(v, t, { slow = 0, odd = false } = {}) {
        v.peg.triggerAttackRelease(odd ? 'A4' : 'G4', 0.05, t, 0.45 + slow * 0.5);
        if (slow > 0.25) v.pegTing.triggerAttackRelease(odd ? 'A6' : 'F#6', 0.05, t, slow * 0.8);
    },
    // Landings, from a small ting to a royal fanfare.
    common(v, t) {
        v.glass.triggerAttackRelease(['A6', 'D7'], 0.8, t, 0.5);
        run(v, t + 0.02, ['D5', 'F#5', 'A5'], 0.12, 0.45);
    },
    uncommon(v, t) {
        run(v, t, ['D5', 'F#5', 'A5', 'D6'], 0.2, 0.5);
        v.glass.triggerAttackRelease(['F#6', 'A6', 'D7'], 1, t + 0.22, 0.45);
    },
    rare(v, t) {
        run(v, t, ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'F#6'], 0.32, 0.55);
        v.pad.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 1.2, t + 0.1);
        ['A6', 'D7', 'F#7'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1, t + 0.34 + i * 0.08, 0.45));
    },
    epic(v, t) {
        v.boom.triggerAttackRelease('D2', 0.6, t, 0.8);
        v.brass.triggerAttackRelease(['D4', 'A4'], 0.18, t + 0.02, 0.7);
        v.brass.triggerAttackRelease(['F#4', 'D5'], 0.5, t + 0.22, 0.75);
        run(v, t + 0.22, LADDER.slice(5), 0.5, 0.5);
        v.pad.triggerAttackRelease(['D4', 'A4', 'D5', 'F#5'], 1.6, t + 0.2);
        v.cymbal.triggerAttackRelease(1.2, t + 0.22);
    },
    legendary(v, t) {
        v.boom.triggerAttackRelease('D2', 0.8, t, 0.9);
        v.snare.triggerAttackRelease(0.05, t);
        // ta-ta-ta TAAA
        [['A3', 'D4', 'F#4'], ['A3', 'D4', 'F#4'], ['A3', 'D4', 'F#4']].forEach((c, i) => v.brass.triggerAttackRelease(c, 0.1, t + 0.05 + i * 0.13, 0.65));
        v.brass.triggerAttackRelease(['D4', 'A4', 'D5', 'F#5'], 0.9, t + 0.44, 0.85);
        v.cymbal.triggerAttackRelease(1.5, t + 0.44);
        v.boom.triggerAttackRelease('D2', 0.6, t + 0.44, 0.8);
        run(v, t + 0.46, LADDER.slice(3), 0.6, 0.5);
        v.pad.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 2, t + 0.44);
        ['D7', 'F#7', 'A7', 'D8'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1.2, t + 1 + i * 0.09, 0.4));
    },
    mythic(v, t) {
        MOMENTS.legendary(v, t);
        // the rarest fates turn a little magical: the Lydian sharp fourth shimmers on top
        ['G#6', 'B6', 'D7', 'G#7', 'B7'].forEach((n, i) => v.glass.triggerAttackRelease(n, 1.4, t + 1.45 + i * 0.07, 0.35));
        v.pad.triggerAttackRelease(['E5', 'G#5', 'B5'], 1.4, t + 1.4);
    },
    // A twist: a cheeky wobble and a whole-tone shimmer.
    twist(v, t) {
        try {
            v.wobble.triggerAttack('A4', t);
            v.wobble.frequency.setValueAtTime(440, t);
            v.wobble.frequency.exponentialRampToValueAtTime(660, t + 0.18);
            v.wobble.frequency.exponentialRampToValueAtTime(392, t + 0.42);
            v.wobble.frequency.exponentialRampToValueAtTime(587, t + 0.62);
            v.wobble.triggerRelease(t + 0.66);
        } catch (_) { /* a clashing wobble is skipped */ }
        run(v, t + 0.1, ['D5', 'E5', 'F#5', 'G#5', 'A#5', 'C6', 'D6'], 0.42, 0.42);
    },
    // A trial: a horn call to the challenge.
    trial(v, t) {
        v.snare.triggerAttackRelease(0.05, t);
        v.brass.triggerAttackRelease(['A3', 'E4'], 0.22, t + 0.04, 0.7);
        v.brass.triggerAttackRelease(['D4', 'A4'], 0.7, t + 0.3, 0.8);
        v.boom.triggerAttackRelease('D2', 0.5, t + 0.3, 0.6);
        v.glass.triggerAttackRelease('A6', 0.8, t + 0.34, 0.35);
    },
    // A storm (the thunder itself is the app's own): a dark minor chord rolls in under it.
    storm(v, t) {
        v.pad.triggerAttackRelease(['D3', 'F3', 'A3', 'D4'], 1.6, t);
        v.boom.triggerAttackRelease('A1', 0.9, t + 0.05, 0.8);
        run(v, t + 0.1, ['A5', 'F5', 'D5', 'A4', 'F4', 'D4'], 0.5, 0.35);
    },
    // The rival's Envoy: a herald's trumpet, short-short-long.
    envoy(v, t) {
        v.snare.triggerAttackRelease(0.05, t);
        v.brass.triggerAttackRelease('D5', 0.1, t + 0.02, 0.6);
        v.brass.triggerAttackRelease('D5', 0.1, t + 0.16, 0.6);
        v.brass.triggerAttackRelease('A5', 0.5, t + 0.3, 0.7);
        v.glass.triggerAttackRelease('D7', 0.8, t + 0.32, 0.3);
    },
    envoyGift(v, t) {
        MOMENTS.envoy(v, t);
        run(v, t + 0.45, ['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.3, 0.45);
    },
    // A fate card is dealt: a soft brush of air and one bell.
    reveal(v, t) {
        sweep(v, t, 900, 2400, 0.35);
        v.glass.triggerAttackRelease('D7', 0.7, t + 0.18, 0.3);
    },
    // The next guild steps up to the wheel.
    turn(v, t) {
        v.boom.triggerAttackRelease('D2', 0.4, t, 0.6);
        v.snare.triggerAttackRelease(0.05, t + 0.12);
        run(v, t + 0.12, ['D4', 'A4', 'D5', 'F#5', 'A5'], 0.3, 0.45);
    },
    // The end of the ceremony: a little march to the finish.
    finale(v, t) {
        v.boom.triggerAttackRelease('D2', 0.6, t, 0.8);
        const chords = [['D4', 'F#4', 'A4'], ['G4', 'B4', 'D5'], ['A4', 'C#5', 'E5'], ['D5', 'F#5', 'A5', 'D6']];
        chords.forEach((c, i) => v.brass.triggerAttackRelease(c, i === 3 ? 1.1 : 0.24, t + i * 0.28, 0.7 + i * 0.05));
        v.pad.triggerAttackRelease(['D4', 'A4', 'D5', 'F#5'], 2, t + 0.84);
        v.cymbal.triggerAttackRelease(1.5, t + 0.84);
        v.boom.triggerAttackRelease('D2', 0.6, t + 0.84, 0.8);
        run(v, t + 0.86, LADDER.slice(4), 0.6, 0.45);
    },
};

/** Builds the wheel's voices ahead of time (the reverb takes a moment), so the first sound doesn't stall a frame. */
export async function warmWheelSounds() {
    if (!isAudioReady()) return;
    try {
        Tone = Tone || await loadTone();
        bank.get(4);
    } catch (_) { /* sound is optional */ }
}

let lastPeg = 0;

/**
 * Plays one moment of the wheel: 'open' | 'close' | 'launch' | 'peg' ({ slow 0..1, odd }) |
 * a landing ('common' … 'mythic', 'twist', 'trial', 'storm', 'envoy', 'envoyGift') |
 * 'reveal' | 'turn' | 'finale'. Silent until the app's audio is awake.
 */
export function wheelSound(name, opts = {}) {
    if (!isAudioReady()) return;
    const moment = MOMENTS[name];
    if (!moment) return;
    if (!Tone) {
        // Tone is already loaded once the audio is awake; this only waits a tick.
        loadTone().then((T) => { Tone = T; if (name !== 'peg') wheelSound(name, opts); }).catch(() => {});
        return;
    }
    const now = Tone.now();
    if (name === 'peg') {
        // pegs can pass faster than a tock can sound: keep them apart
        if (now - lastPeg < 0.035) return;
        lastPeg = now;
    }
    const v = bank.get(name === 'peg' ? 1 : 4);
    try { moment(v, now + 0.03, opts); } catch (_) { /* overlapping triggers are harmless */ }
}

/** A landing's sound for a wedge, by what kind of fate it is. */
export function landingSoundFor(seg) {
    if (!seg) return 'common';
    if (seg.rarity === 'envoy') return seg.harsh ? 'envoy' : 'envoyGift';
    if (seg.rarity === 'omen') return seg.harsh ? 'storm' : 'mythic';
    return MOMENTS[seg.rarity] ? seg.rarity : 'common';
}
