// features/heroDuelsAudio.js — Hero Duels' own sound: an arena band (drums, a sword clang, a cheering
// crowd, heraldic trumpets, marimba and bells) and a light arena tune with two moods: "calm" while the
// next duellists are picked, "duel" (drums, a driving bass) while a duel runs. All synthesised, no files.
//
// Loaded only with Hero Duels (not in the app's first download). Like audio.js it schedules every note
// straight onto the audio clock (utils/voiceBank.js VoicePool), and the tune is planned about a second
// ahead from a plain timer, so a busy frame on a weak laptop never makes it stutter. The voices are
// built on first use and disposed after they have been quiet.
import { isAudioReady } from '../audio.js';
import { loadTone } from '../utils/lazyLibraries.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from '../utils/voiceBank.js';

let Tone = null;
let chassis = null;
const MUSIC_LEVEL = 0.38;

const pool = (keep, Voice, options, max = 8) => keep(new VoicePool(Tone, Voice, options, max));
const mono = (keep, node) => keep(guardMonoVoice(node));

const bank = createVoiceBank((keep) => {
    if (!chassis) {
        const bus = new Tone.Gain(0.9).toDestination();
        const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.24 }).connect(bus);
        const musicBus = new Tone.Gain(0).connect(bus);
        chassis = { bus, reverb, musicBus };
    }
    const { bus, reverb, musicBus } = chassis;
    const v = lazyVoices({
        // ── The arena band (sound effects) ──
        kick: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 }, volume: -6 }).connect(bus)),
        tom: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 }, volume: -10 }).connect(reverb)),
        snareFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1500 }).connect(bus)),
        snare: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.03 }, volume: -18 }).connect(v.snareFilter)),
        clang: () => mono(keep, new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 30, resonance: 3600, octaves: 1.4, envelope: { attack: 0.001, decay: 0.7, release: 0.3 }, volume: -16 }).connect(reverb)),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 6000 }).connect(reverb)),
        cymbal: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.5, sustain: 0, release: 0.4 }, volume: -24 }).connect(v.cymbalFilter)),
        // The crowd: pink noise through a "voice" band. A slow swell sounds like a roar, a low one like "ooh".
        crowdFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 1100, Q: 0.8 }).connect(reverb)),
        crowd: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.18, decay: 1.2, sustain: 0, release: 0.4 }, volume: -8 }).connect(v.crowdFilter)),
        whooshFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 0.7 }).connect(reverb)),
        whoosh: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0, release: 0.1 }, volume: -2 }).connect(v.whooshFilter)),
        mallet: () => pool(keep, Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 }, volume: -8 }, 12).connect(reverb),
        bell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 3.01, modulationIndex: 5,
            envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.8 },
            modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 }, volume: -15
        }, 12).connect(reverb),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.7 }).connect(reverb)),
        brass: () => pool(keep, Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 2, spread: 16 }, envelope: { attack: 0.025, decay: 0.15, sustain: 0.7, release: 0.35 }, volume: -18 }, 10).connect(v.brassFilter),
        // ── The arena tune (its own voices on the music bus, so an effect never cuts a note) ──
        mKick: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3.5, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, volume: -6 }).connect(musicBus)),
        mTom: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 1.8, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 }, volume: -11 }).connect(musicBus)),
        mHatFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 7000 }).connect(musicBus)),
        mHat: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 }, volume: -26 }).connect(v.mHatFilter)),
        mBass: () => mono(keep, new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.2, release: 0.15 }, volume: -7 }).connect(musicBus)),
        mMallet: () => pool(keep, Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.25 }, volume: -11 }, 8).connect(musicBus),
        mBell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 2.01, modulationIndex: 3,
            envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.6 },
            modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }, volume: -19
        }, 6).connect(musicBus),
        bus: () => bus,
        musicBus: () => musicBus
    });
    return v;
}, { idle: 10, span: 6 });

/** Start fetching the sound engine (Hero Duels opening). */
export function warmDuelAudio() {
    if (Tone) return Promise.resolve(true);
    return loadTone().then((t) => { Tone = t; return true; }).catch(() => false);
}

function voices(seconds = 6) {
    if (!Tone || !isAudioReady()) return null;
    try { return bank.get(seconds); } catch { return null; }
}

// ─── Notes ──────────────────────────────────────────────────────────────────────

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PENTA = [0, 2, 4, 7, 9];
/** One key per duellist (or team), so the class hears whose point it was. */
const KEYS = ['C', 'E', 'G', 'A', 'D', 'F'];

function note(root, step, octave) {
    const base = NAMES.indexOf(root);
    const s = Math.max(0, step);
    const semis = base + PENTA[s % 5] + 12 * Math.floor(s / 5);
    return `${NAMES[semis % 12]}${octave + Math.floor(semis / 12)}`;
}

function roar(v, t, { level = 0.8, freq = 1100, to = 1500, length = 1.2 } = {}) {
    v.crowdFilter.frequency.cancelScheduledValues(t);
    v.crowdFilter.frequency.setValueAtTime(freq, t);
    v.crowdFilter.frequency.exponentialRampToValueAtTime(to, t + length * 0.6);
    v.crowd.envelope.decay = length;
    v.crowd.triggerAttackRelease(length * 0.5, t, level);
}

function roll(v, t, seconds, from = 0.12, to = 0.6) {
    const steps = Math.max(2, Math.round(seconds / 0.055));
    for (let i = 0; i < steps; i++) {
        const k = i / steps;
        v.snare.triggerAttackRelease(0.04, t + i * (seconds / steps), from + (to - from) * k * k);
    }
}

/**
 * Hero Duels sound effects.
 * 'open' the arena opens · 'tap' a quiet setup tap · 'pick' ({ step }) a hero joins the duel · 'unpick' ·
 * 'roll' ({ step, k }) the spotlight hops · 'chosen' it lands · 'clash' the duel starts (a roll, the
 * swords clang at 0.45 s, "GO!" at 1.25 s) · 'point' ({ key, delta }) · 'minus' · 'lead' a new leader ·
 * 'tie' · 'crown' the winner · 'bank' points land on a team · 'cancel' · 'undo' · 'finale' the champions ·
 * 'stars' reward stars paid · 'close'.
 */
export function playDuelSfx(name, opts = {}) {
    const v = voices(name === 'finale' ? 8 : 6);
    if (!v) return;
    const t = Tone.now() + 0.03;
    const key = KEYS[Math.abs(Number(opts.key) || 0) % KEYS.length];
    try {
        switch (name) {
            case 'open': {
                duck(3.2);
                roll(v, t, 0.9, 0.1, 0.65);
                const at = t + 0.95;
                v.kick.triggerAttackRelease('C1', 0.5, at, 1);
                v.cymbal.triggerAttackRelease(1.5, at, 0.9);
                [[0, ['G3', 'C4', 'E4'], 0.13], [0.16, ['G3', 'C4', 'E4'], 0.13], [0.32, ['A3', 'C4', 'F4'], 0.13], [0.48, ['C4', 'E4', 'G4', 'C5'], 0.9]]
                    .forEach(([dt, chord, len]) => v.brass.triggerAttackRelease(chord, len, at + dt, 0.9));
                v.kick.triggerAttackRelease('C1', 0.4, at + 0.48, 0.9);
                roar(v, at + 0.3, { level: 0.75, length: 1.6 });
                ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, at + 0.6 + i * 0.07, 0.4));
                break;
            }
            case 'tap':
                v.mallet.triggerAttackRelease(opts.on === false ? 'G5' : 'C6', 0.06, t, 0.25);
                break;
            case 'pick': {
                const step = Math.max(0, Number(opts.step) || 0);
                v.mallet.triggerAttackRelease(note('C', step + 2, 5), 0.18, t, 0.55);
                v.mallet.triggerAttackRelease(note('C', step + 4, 5), 0.18, t + 0.06, 0.45);
                v.tom.triggerAttackRelease(step % 2 ? 'G3' : 'C4', 0.1, t, 0.4);
                break;
            }
            case 'unpick':
                v.mallet.triggerAttackRelease('E5', 0.12, t, 0.35);
                v.mallet.triggerAttackRelease('B4', 0.18, t + 0.08, 0.3);
                break;
            case 'roll': {
                const k = Math.max(0, Math.min(1, Number(opts.k) || 0));
                v.tom.triggerAttackRelease(k > 0.6 ? 'G3' : 'D4', 0.06, t, 0.25 + 0.3 * k);
                v.mallet.triggerAttackRelease(note('D', Math.round(k * 9), 5), 0.08, t, 0.3 + 0.3 * k);
                break;
            }
            case 'chosen':
                v.kick.triggerAttackRelease('C1', 0.3, t, 0.8);
                ['C6', 'E6', 'G6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.7, t + i * 0.05, 0.5));
                roar(v, t + 0.05, { level: 0.4, freq: 600, to: 900, length: 0.9 });
                break;
            case 'clash': {
                duck(2.4);
                roll(v, t, 0.42, 0.1, 0.55);
                const hit = t + 0.45;
                v.clang.triggerAttackRelease('C4', 0.5, hit, 0.9);
                v.clang.triggerAttackRelease('G4', 0.35, hit + 0.05, 0.5);
                v.kick.triggerAttackRelease('A0', 0.6, hit, 1);
                v.cymbal.triggerAttackRelease(1.2, hit, 0.8);
                roar(v, hit + 0.05, { level: 0.55, freq: 520, to: 700, length: 0.9 });
                const go = t + 1.25;
                v.brass.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 0.3, go, 1);
                v.kick.triggerAttackRelease('D1', 0.3, go, 0.9);
                v.snare.triggerAttackRelease(0.08, go, 0.7);
                roar(v, go + 0.05, { level: 0.6, length: 1.1 });
                break;
            }
            case 'point': {
                const delta = Math.max(1, Math.min(3, Number(opts.delta) || 1));
                const steps = 2 + delta;
                for (let i = 0; i < steps; i++) v.mallet.triggerAttackRelease(note(key, i, 5), 0.12, t + i * 0.06, 0.45 + i * 0.07);
                const land = t + steps * 0.06;
                v.bell.triggerAttackRelease([note(key, 5, 5), note(key, 7, 5)], 0.6, land, 0.45);
                v.kick.triggerAttackRelease(delta > 1 ? 'C1' : 'G1', 0.25, land, 0.6);
                if (delta > 2) v.cymbal.triggerAttackRelease(0.8, land, 0.6);
                roar(v, land, { level: 0.25 + delta * 0.14, length: 0.6 + delta * 0.25 });
                break;
            }
            case 'minus':
                v.mallet.triggerAttackRelease('E4', 0.14, t, 0.4);
                v.mallet.triggerAttackRelease('C4', 0.3, t + 0.14, 0.35);
                v.tom.triggerAttackRelease('C3', 0.2, t + 0.14, 0.3);
                roar(v, t + 0.1, { level: 0.3, freq: 700, to: 380, length: 0.7 });
                break;
            case 'lead':
                v.brass.triggerAttackRelease(['G3', 'D4'], 0.14, t, 0.7);
                v.brass.triggerAttackRelease(['C4', 'E4', 'G4'], 0.45, t + 0.18, 0.8);
                v.cymbal.triggerAttackRelease(0.6, t + 0.18, 0.4);
                break;
            case 'tie':
                ['E6', 'C6', 'E6', 'C6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.25, t + i * 0.12, 0.35));
                break;
            case 'crown': {
                duck(3.4);
                for (let i = 0; i < 6; i++) v.tom.triggerAttackRelease(['C4', 'A3', 'G3', 'E3', 'D3', 'C3'][i], 0.08, t + i * 0.055, 0.5 + i * 0.06);
                const at = t + 0.38;
                v.kick.triggerAttackRelease('C1', 0.6, at, 1);
                v.cymbal.triggerAttackRelease(1.8, at, 1);
                [[0, 'G4', 0.12], [0.13, 'C5', 0.12], [0.26, 'E5', 0.12], [0.39, 'G5', 0.34], [0.78, 'E5', 0.12], [0.91, 'G5', 0.8]]
                    .forEach(([dt, n, len]) => v.brass.triggerAttackRelease(n, len, at + dt, 0.95));
                v.brass.triggerAttackRelease(['C4', 'E4', 'G4'], 0.36, at + 0.39, 0.7);
                v.brass.triggerAttackRelease(['C4', 'F4', 'A4'], 0.12, at + 0.78, 0.7);
                v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 0.8, at + 0.91, 0.8);
                v.kick.triggerAttackRelease('C1', 0.5, at + 0.91, 0.9);
                roar(v, at + 0.1, { level: 0.95, length: 2.2 });
                ['C7', 'G6', 'E7', 'C7', 'G7', 'E7', 'C8'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.4, at + 1.0 + i * 0.05, 0.35));
                break;
            }
            case 'bank':
                for (let i = 0; i < 8; i++) v.bell.triggerAttackRelease(['C7', 'G7', 'E7', 'C8', 'A7', 'D8', 'G7', 'E8'][i], 0.18, t + i * 0.04, 0.28);
                v.mallet.triggerAttackRelease(['C5', 'E5', 'G5'], 0.3, t + 0.3, 0.5);
                break;
            case 'cancel':
                v.whooshFilter.frequency.setValueAtTime(1800, t);
                v.whooshFilter.frequency.exponentialRampToValueAtTime(300, t + 0.5);
                v.whoosh.triggerAttackRelease(0.4, t, 0.6);
                ['A4', 'F4', 'D4'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.18, t + 0.05 + i * 0.12, 0.4));
                break;
            case 'undo':
                v.whooshFilter.frequency.setValueAtTime(2400, t);
                v.whooshFilter.frequency.exponentialRampToValueAtTime(700, t + 0.2);
                v.whoosh.triggerAttackRelease(0.15, t, 0.45);
                v.mallet.triggerAttackRelease('G5', 0.08, t + 0.1, 0.35);
                v.mallet.triggerAttackRelease('C5', 0.15, t + 0.18, 0.35);
                break;
            case 'finale': {
                duck(6);
                roll(v, t, 1.3, 0.08, 0.7);
                const at = t + 1.35;
                v.kick.triggerAttackRelease('C1', 0.7, at, 1);
                v.cymbal.triggerAttackRelease(2.2, at, 1);
                // A little march: I IV V I, the melody on trumpets over the band.
                const beat = 0.3;
                const melody = [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1.5], ['A5', 3.5, 0.5], ['G5', 4, 1], ['F5', 5, 0.5], ['E5', 5.5, 0.5], ['D5', 6, 1], ['G4', 7, 1],
                    ['C5', 8, 0.75], ['D5', 8.75, 0.25], ['E5', 9, 1], ['G5', 10, 1], ['C6', 11, 2.5]];
                melody.forEach(([n, b, len]) => v.brass.triggerAttackRelease(n, len * beat * 0.92, at + b * beat, 0.95));
                [['C3', 0], ['F3', 4], ['G3', 6], ['C3', 8], ['G2', 10], ['C3', 11]].forEach(([n, b]) => {
                    v.brass.triggerAttackRelease([n, n.replace('3', '4').replace('2', '3')], beat * 1.6, at + b * beat, 0.55);
                    v.kick.triggerAttackRelease('C1', 0.3, at + b * beat, 0.8);
                });
                for (let b = 0; b < 13; b++) v.snare.triggerAttackRelease(0.05, at + (b + 0.5) * beat, 0.35);
                v.cymbal.triggerAttackRelease(2.4, at + 11 * beat, 1);
                roar(v, at + 0.2, { level: 0.9, length: 2.4 });
                roar(v, at + 11 * beat, { level: 1, length: 2.6 });
                ['C7', 'E7', 'G7', 'C8', 'G7', 'E7', 'C8'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.5, at + 11 * beat + 0.1 + i * 0.06, 0.35));
                break;
            }
            case 'stars':
                ['C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + i * 0.07, 0.45));
                break;
            case 'close':
                stopDuelMusic();
                v.whooshFilter.frequency.setValueAtTime(2400, t);
                v.whooshFilter.frequency.exponentialRampToValueAtTime(300, t + 0.5);
                v.whoosh.triggerAttackRelease(0.45, t, 0.7);
                ['C7', 'G6', 'E6', 'C6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.5, t + 0.1 + i * 0.07, 0.3));
                break;
            default:
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}

// ─── The arena tune ─────────────────────────────────────────────────────────────

const MOODS = {
    // A cheerful little march while the class picks the next duellists (C – Am – F – G).
    calm: {
        bpm: 108,
        bars: [
            { bass: ['C2', 'G2'], tones: ['C4', 'E4', 'G4', 'C5'] },
            { bass: ['A1', 'E2'], tones: ['A3', 'C4', 'E4', 'A4'] },
            { bass: ['F1', 'C2'], tones: ['F3', 'A3', 'C4', 'F4'] },
            { bass: ['G1', 'D2'], tones: ['G3', 'B3', 'D4', 'G4'] }
        ],
        // a bell tune over each 4 bars, in beats
        tune: [['E5', 0], ['G5', 1], ['C6', 2], ['A5', 4], ['G5', 5], ['E5', 6], ['F5', 8], ['A5', 9], ['C6', 10], ['B5', 12], ['G5', 13], ['D5', 14]]
    },
    // The duel: taiko drums, a driving bass and a minor ostinato (Dm – Bb – C – A).
    duel: {
        bpm: 126,
        bars: [
            { bass: ['D2', 'D2'], tones: ['D4', 'F4', 'A4', 'D5'] },
            { bass: ['A#1', 'A#1'], tones: ['A#3', 'D4', 'F4', 'A#4'] },
            { bass: ['C2', 'C2'], tones: ['C4', 'E4', 'G4', 'C5'] },
            { bass: ['A1', 'A1'], tones: ['A3', 'C#4', 'E4', 'A4'] }
        ],
        tune: []
    }
};

const music = { mood: 'off', timer: 0, nextBar: 0, bar: 0, level: MUSIC_LEVEL, duckUntil: 0 };

/** Plays one bar of the tune at audio time `t`. */
function scheduleBar(v, mood, index, t) {
    const m = MOODS[mood];
    const beat = 60 / m.bpm;
    const bar = m.bars[index % m.bars.length];
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    if (mood === 'calm') {
        v.mBass.triggerAttackRelease(bar.bass[0], beat * 0.9, t, 0.75);
        v.mBass.triggerAttackRelease(bar.bass[1], beat * 0.9, t + beat * 2, 0.6);
        arp.forEach((k, i) => v.mMallet.triggerAttackRelease(bar.tones[k], beat * 0.45, t + i * beat / 2, i % 2 ? 0.3 : 0.45));
        v.mKick.triggerAttackRelease('C2', 0.2, t, 0.5);
        v.mKick.triggerAttackRelease('C2', 0.2, t + beat * 2, 0.35);
        for (let i = 0; i < 4; i++) v.mHat.triggerAttackRelease(0.03, t + i * beat + beat / 2, 0.5);
        if (index % 2) v.mTom.triggerAttackRelease('G3', 0.1, t + beat * 3.5, 0.35);
        const phraseBar = index % 4;
        m.tune.filter(([, b]) => Math.floor(b / 4) === phraseBar)
            .forEach(([n, b]) => v.mBell.triggerAttackRelease(n, beat * 0.9, t + (b % 4) * beat, 0.4));
    } else {
        for (let i = 0; i < 8; i++) v.mBass.triggerAttackRelease(bar.bass[0], beat * 0.32, t + i * beat / 2, i % 2 ? 0.45 : 0.7);
        [0, 2.5, 3].forEach((b) => v.mKick.triggerAttackRelease('A1', 0.25, t + b * beat, b ? 0.55 : 0.85));
        [[1, 'E3'], [2, 'C3'], [3.5, 'E3']].forEach(([b, n]) => v.mTom.triggerAttackRelease(n, 0.12, t + b * beat, 0.55));
        for (let i = 0; i < 8; i++) v.mHat.triggerAttackRelease(0.025, t + i * beat / 2, i % 2 ? 0.35 : 0.6);
        [0, 2, 1, 3].forEach((k, i) => v.mMallet.triggerAttackRelease(bar.tones[k], beat * 0.35, t + (i * 2 + 1) * beat / 2, 0.32));
        if (index % 4 === 0) v.mBell.triggerAttackRelease(bar.tones.slice(1), beat * 1.2, t, 0.3);
    }
    return beat * 4;
}

function tick() {
    if (music.mood === 'off') return;
    const v = voices(3);
    if (!v) return; // the sound is still locked (no click yet): try again on the next tick
    const ctxNow = Tone.now();
    if (!music.nextBar || music.nextBar < ctxNow) {
        music.nextBar = ctxNow + 0.12;
        fadeMusicTo(music.level, 0.6);
    }
    while (music.nextBar < ctxNow + 1.4) {
        music.nextBar += scheduleBar(v, music.mood, music.bar, music.nextBar);
        music.bar += 1;
    }
}

function fadeMusicTo(level, seconds) {
    if (!chassis || !Tone) return;
    const g = chassis.musicBus.gain;
    const now = Tone.now();
    try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(level, now + seconds);
    } catch (_) { /* fine */ }
}

/** Dips the tune under a fanfare for `seconds`, then brings it back. */
function duck(seconds) {
    if (music.mood === 'off' || !chassis || !Tone) return;
    const g = chassis.musicBus.gain;
    const now = Tone.now();
    try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(music.level * 0.18, now + 0.12);
        g.setValueAtTime(music.level * 0.18, now + seconds);
        g.linearRampToValueAtTime(music.level, now + seconds + 1.2);
    } catch (_) { /* fine */ }
}

/** The arena tune: 'calm' (picking), 'duel' (a duel runs) or 'off'. A change lands on the next bar. */
export function setDuelMusic(mood) {
    const next = MOODS[mood] ? mood : 'off';
    if (next === 'off') { stopDuelMusic(); return; }
    if (music.mood === next) return;
    const was = music.mood;
    music.mood = next;
    music.bar = 0;
    if (was === 'off') {
        warmDuelAudio().then(() => {
            if (music.mood === 'off') return;
            bank.hold();
            if (!music.timer) music.timer = setInterval(tick, 300);
            tick();
        });
    }
}

export function stopDuelMusic() {
    if (music.mood === 'off' && !music.timer) return;
    music.mood = 'off';
    music.nextBar = 0;
    if (music.timer) { clearInterval(music.timer); music.timer = 0; }
    fadeMusicTo(0, 0.4);
    bank.release(2);
}
