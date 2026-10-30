// tools/ceremony-music/grandCeremonyScore.js — the score of the Grand Guild Ceremony's music.
// Rendered once, offline, with Tone.js (render.cjs runs it in headless Chromium and writes
// assets/ceremony/music/grand-*.mp3). Nothing here runs in the app: classroom laptops only
// play the small MP3s. Every track shares one motif, the "festival call" (D F# A | B A F# E D).
//
//   festival  grand_theme     lively D major march for the first chapters (loop)
//   story     grand_story     harp and celesta for the Story of the Year (loop)
//   suspense  grand_suspense  D minor ostinato and heartbeat timpani under the guild towers (loop)
//   crowning  grand_crowning  brass fanfare, choir and bells when the crown lands (one shot)
//   hall      grand_hall      warm, proud farewell theme for the Hall of Heroes (loop)

/* global Tone */

const CHORDS = {
    D: ['D', 'F#', 'A'], G: ['G', 'B', 'D'], A: ['A', 'C#', 'E'], A7: ['A', 'C#', 'G'], Bm: ['B', 'D', 'F#'],
    'F#m': ['F#', 'A', 'C#'], Em: ['E', 'G', 'B'], Dm: ['D', 'F', 'A'], Bb: ['Bb', 'D', 'F'], Gm: ['G', 'Bb', 'D'],
    'A/C#': ['A', 'C#', 'E'], 'D/F#': ['D', 'F#', 'A'], Asus: ['A', 'D', 'E']
};
const BASS_OF = { 'A/C#': 'C#', 'D/F#': 'F#' };

/** Close voicing of a chord from a starting octave, e.g. voice('D', 3) → D3 F#3 A3 D4. */
function voice(name, octave, { top = true } = {}) {
    const order = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
    const pc = (n) => order.indexOf(n === 'Db' ? 'C#' : n === 'A#' ? 'Bb' : n === 'D#' ? 'Eb' : n === 'Gb' ? 'F#' : n);
    const tones = CHORDS[name];
    let oct = octave;
    let last = -1;
    const out = tones.map((n) => {
        if (pc(n) <= last) oct += 1;
        last = pc(n);
        return `${n}${oct}`;
    });
    if (top) out.push(`${tones[0]}${octave + 1}`);
    return out;
}
function bassOf(name, octave = 2) {
    return `${BASS_OF[name] || CHORDS[name][0]}${octave}`;
}

/** Shared mixing desk: reverb + compressor + limiter, then the destination. */
async function desk({ decay = 2.8, wet = 0.3 } = {}) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }).connect(limiter);
    const reverb = new Tone.Reverb({ decay, preDelay: 0.02, wet: 1 });
    await reverb.generate();
    const verbSend = new Tone.Gain(wet).connect(reverb);
    reverb.connect(comp);
    const bus = (dry = 1, send = 1) => {
        const g = new Tone.Gain(dry).connect(comp);
        const s = new Tone.Gain(send).connect(verbSend);
        const input = new Tone.Gain(1);
        input.connect(g);
        input.connect(s);
        return input;
    };
    return { bus, comp };
}

function instruments(d) {
    const strings = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
        envelope: { attack: 0.35, decay: 0.4, sustain: 0.75, release: 1.4 }, volume: -24
    });
    strings.connect(new Tone.Filter({ type: 'lowpass', frequency: 1700, Q: 0.4 }).connect(d.bus(0.8, 1.2)));
    const harp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.9, sustain: 0.04, release: 0.9 }, volume: -16
    }).connect(d.bus(0.9, 0.9));
    const flute = new Tone.Synth({
        oscillator: { type: 'sine' }, envelope: { attack: 0.06, decay: 0.2, sustain: 0.8, release: 0.25 }, volume: -12
    });
    const vib = new Tone.Vibrato({ frequency: 5.2, depth: 0.08 }).connect(d.bus(1, 0.9));
    const fluteAir = new Tone.Filter({ type: 'lowpass', frequency: 3600 }).connect(vib);
    flute.connect(fluteAir);
    const flute2 = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.25 }, volume: -22 }).connect(fluteAir);
    const bells = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 7,
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 }, volume: -22
    }).connect(d.bus(0.8, 1.3));
    const bass = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.5, sustain: 0.4, release: 0.4 }, volume: -10 }).connect(d.bus(1, 0.2));
    const timp = new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 2.5, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 }, volume: -8 }).connect(d.bus(1, 0.6));
    const tambF = new Tone.Filter({ type: 'highpass', frequency: 6500 }).connect(d.bus(0.8, 0.4));
    const tamb = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -32 }).connect(tambF);
    const drumF = new Tone.Filter({ type: 'lowpass', frequency: 420 }).connect(d.bus(1, 0.3));
    const drum = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 1.5, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }).connect(drumF);
    const brassF = new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.6 }).connect(d.bus(1, 0.9));
    const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 14 },
        envelope: { attack: 0.03, decay: 0.25, sustain: 0.7, release: 0.6 }, volume: -20
    }).connect(brassF);
    const choir = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2, oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
        envelope: { attack: 0.6, decay: 0.3, sustain: 0.9, release: 2.2 }, modulationEnvelope: { attack: 0.6, decay: 0.2, sustain: 1, release: 2 }, volume: -22
    }).connect(new Tone.Filter({ type: 'lowpass', frequency: 2200 }).connect(d.bus(0.7, 1.5)));
    const crashF = new Tone.Filter({ type: 'highpass', frequency: 3200 }).connect(d.bus(0.8, 1));
    const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.003, decay: 2.6, sustain: 0 }, volume: -20 }).connect(crashF);
    const piano = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2, modulationIndex: 2.2, oscillator: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.6, sustain: 0.1, release: 1.1 },
        modulationEnvelope: { attack: 0.004, decay: 0.5, sustain: 0, release: 0.5 }, volume: -17
    }).connect(d.bus(0.9, 1));
    const hornF = new Tone.Filter({ type: 'lowpass', frequency: 1300, Q: 0.5 }).connect(d.bus(1, 1.1));
    const horn = new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 10 }, envelope: { attack: 0.09, decay: 0.3, sustain: 0.8, release: 0.6 }, volume: -15 }).connect(hornF);
    const ostF = new Tone.Filter({ type: 'lowpass', frequency: 900, Q: 1 }).connect(d.bus(1, 0.5));
    const ostinato = new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 12 }, envelope: { attack: 0.005, decay: 0.16, sustain: 0.15, release: 0.12 }, volume: -14 }).connect(ostF);
    const tickF = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 2 }).connect(d.bus(1, 0.3));
    const tick = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 1, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -18 }).connect(tickF);
    return { strings, harp, flute, flute2, bells, bass, timp, tamb, drum, brass, choir, crash, piano, horn, ostinato, tick };
}

/** Plays `bars` of a piece `times` times in a row from t0. */
function repeat(times, barSeconds, bars, play) {
    for (let r = 0; r < times; r += 1) play(r * bars * barSeconds);
}

// ------------------------------------------------------------------ festival

const FEST_CHORDS = ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'];
const FEST_MELODY = [
    [[0, 'D5', 1], [1, 'F#5', 0.5], [1.5, 'A5', 0.5], [2, 'D6', 1], [3, 'A5', 1]],
    [[0, 'B5', 0.5], [0.5, 'A5', 0.5], [1, 'F#5', 1], [2, 'E5', 1], [3, 'D5', 1]],
    [[0, 'G5', 1], [1, 'B5', 0.5], [1.5, 'A5', 0.5], [2, 'G5', 1], [3, 'F#5', 1]],
    [[0, 'E5', 0.5], [0.5, 'F#5', 0.5], [1, 'G5', 0.5], [1.5, 'E5', 0.5], [2, 'A5', 2]],
    [[0, 'F#5', 1], [1, 'D5', 0.5], [1.5, 'F#5', 0.5], [2, 'B5', 1.5], [3.5, 'A5', 0.5]],
    [[0, 'G5', 1], [1, 'B4', 0.5], [1.5, 'D5', 0.5], [2, 'G5', 1.5], [3.5, 'F#5', 0.5]],
    [[0, 'E5', 0.5], [0.5, 'F#5', 0.5], [1, 'G5', 0.5], [1.5, 'A5', 0.5], [2, 'B5', 0.5], [2.5, 'C#6', 0.5], [3, 'E6', 1]],
    [[0, 'D6', 2], [2, 'A5', 1], [3, 'F#5', 1]],
    [[0, 'B5', 1.5], [1.5, 'A5', 0.5], [2, 'G5', 1], [3, 'D5', 1]],
    [[0, 'C#5', 1], [1, 'E5', 1], [2, 'A5', 2]],
    [[0, 'F#5', 1], [1, 'A5', 1], [2, 'C#6', 1.5], [3.5, 'B5', 0.5]],
    [[0, 'B5', 2], [2, 'F#5', 1], [3, 'D5', 1]],
    [[0, 'G5', 0.5], [0.5, 'A5', 0.5], [1, 'B5', 1], [2, 'D6', 1], [3, 'B5', 1]],
    [[0, 'A5', 0.5], [0.5, 'B5', 0.5], [1, 'C#6', 1], [2, 'E6', 1], [3, 'C#6', 1]],
    [[0, 'D6', 1.5], [1.5, 'A5', 0.5], [2, 'F#5', 1], [3, 'A5', 1]],
    [[0, 'D5', 2]]
];

function festival(I, t0, beat) {
    const bar = beat * 4;
    FEST_CHORDS.forEach((ch, b) => {
        const t = t0 + b * bar;
        I.strings.triggerAttackRelease(voice(ch, 3), bar * 0.98, t, 0.55);
        I.bass.triggerAttackRelease(bassOf(ch), beat * 0.9, t, 0.9);
        I.bass.triggerAttackRelease(bassOf(ch), beat * 0.6, t + beat * 2, 0.7);
        I.bass.triggerAttackRelease(`${CHORDS[ch][2]}2`, beat * 0.4, t + beat * 3.5, 0.5);
        const arp = voice(ch, 4);
        const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
        pattern.forEach((p, i) => I.harp.triggerAttackRelease(arp[p], beat * 0.45, t + i * beat * 0.5, i % 2 ? 0.45 : 0.62));
        I.timp.triggerAttackRelease(`${CHORDS[ch][0]}2`, beat, t, b % 4 === 0 ? 0.95 : 0.65);
        I.drum.triggerAttackRelease('A1', '16n', t + beat * 1.5, 0.6);
        I.drum.triggerAttackRelease('A1', '16n', t + beat * 2, 0.75);
        for (let i = 0; i < 8; i += 1) I.tamb.triggerAttackRelease('32n', t + i * beat * 0.5, i % 2 ? 0.9 : 0.4);
        (FEST_MELODY[b] || []).forEach(([at, note, dur]) => {
            I.flute.triggerAttackRelease(note, dur * beat * 0.92, t + at * beat, 0.8);
            I.flute2.triggerAttackRelease(Tone.Frequency(note).transpose(-12).toNote(), dur * beat * 0.92, t + at * beat, 0.6);
            if ((b >= 4 && b < 8) || b >= 12) I.bells.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(), beat * 0.5, t + at * beat, 0.35);
        });
        if (b === 15) ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'].forEach((n, i) => I.harp.triggerAttackRelease(n, beat * 0.3, t + beat * 2 + i * beat * 0.25, 0.55));
    });
}

// ------------------------------------------------------------------ story

const STORY_CHORDS = ['D', 'A/C#', 'Bm', 'F#m', 'G', 'D/F#', 'Em', 'A', 'D', 'Bm', 'G', 'Asus'];
const STORY_MELODY = [
    [[0, 'D6', 2], [2, 'F#6', 1], [3, 'A6', 1]], [[0, 'E6', 3], [3, 'C#6', 1]], [[0, 'D6', 2], [2, 'B5', 2]], [[0, 'C#6', 4]],
    [[0, 'B5', 1], [1, 'D6', 1], [2, 'G6', 2]], [[0, 'F#6', 3], [3, 'D6', 1]], [[0, 'E6', 2], [2, 'G6', 1], [3, 'B5', 1]], [[0, 'A5', 4]],
    [[0, 'F#6', 2], [2, 'A6', 2]], [[0, 'D6', 2], [2, 'F#6', 1], [3, 'B5', 1]], [[0, 'G6', 2], [2, 'E6', 2]], [[0, 'E6', 2], [2, 'A5', 2]]
];

function story(I, t0, beat) {
    const bar = beat * 4;
    STORY_CHORDS.forEach((ch, b) => {
        const t = t0 + b * bar;
        I.strings.triggerAttackRelease(voice(ch, 3, { top: false }), bar * 0.99, t, 0.32);
        I.bass.triggerAttackRelease(bassOf(ch, 2), bar * 0.9, t, 0.5);
        const arp = [...voice(ch, 3), ...voice(ch, 4, { top: false })];
        const up = [0, 1, 2, 3, 4, 5, 6, 5];
        up.forEach((p, i) => I.harp.triggerAttackRelease(arp[Math.min(p, arp.length - 1)], beat * 1.2, t + i * beat * 0.5, 0.42 + (i === 0 ? 0.15 : 0)));
        STORY_MELODY[b].forEach(([at, note, dur]) => I.bells.triggerAttackRelease(note, dur * beat, t + at * beat, 0.55));
        if (b % 4 === 0) I.choir.triggerAttackRelease(voice(ch, 4, { top: false }), bar * 1.9, t, 0.25);
    });
}

// ------------------------------------------------------------------ suspense

const SUS_CHORDS = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A7'];

function suspense(I, t0, beat) {
    const bar = beat * 4;
    SUS_CHORDS.forEach((ch, b) => {
        const t = t0 + b * bar;
        const [r, third, fifth] = CHORDS[ch];
        const seq = [`${r}2`, `${r}3`, `${fifth}2`, `${r}3`, `${third}3`, `${r}3`, `${fifth}2`, `${r}3`];
        seq.forEach((n, i) => I.ostinato.triggerAttackRelease(n, beat * 0.32, t + i * beat * 0.5, i % 2 ? 0.55 : 0.85));
        I.strings.triggerAttackRelease(voice(ch, 2, { top: false }), bar * 0.99, t, 0.4);
        const hi = voice(ch, 4, { top: false });
        for (let i = 0; i < 16; i += 1) I.harp.triggerAttackRelease(hi[i % 2 ? 2 : 1], beat * 0.2, t + i * beat * 0.25, 0.12 + (b / 8) * 0.12);
        const grow = 0.55 + b * 0.05;
        I.timp.triggerAttackRelease('D2', beat, t, grow);
        I.timp.triggerAttackRelease('D2', beat * 0.6, t + beat * 0.5, grow * 0.7);
        I.timp.triggerAttackRelease('D2', beat, t + beat * 2, grow * 0.8);
        I.timp.triggerAttackRelease('D2', beat * 0.6, t + beat * 2.5, grow * 0.55);
        for (let i = 0; i < 4; i += 1) I.tick.triggerAttackRelease('G5', '64n', t + i * beat, 0.5);
        if (b === 7) for (let i = 0; i < 8; i += 1) I.drum.triggerAttackRelease('A1', '32n', t + beat * 2 + i * beat * 0.25, 0.3 + i * 0.08);
        if (b === 0 || b === 4) I.choir.triggerAttackRelease(voice(ch, 3, { top: false }), bar * 2, t, 0.18);
    });
}

// ------------------------------------------------------------------ crowning

function crowning(I, t0, beat) {
    const at = (b) => t0 + b * beat;
    const hit = (b, ch, dur, oct = 4, vel = 0.9) => {
        I.brass.triggerAttackRelease(voice(ch, oct), dur * beat, at(b), vel);
        I.brass.triggerAttackRelease(voice(ch, 3, { top: false }), dur * beat, at(b), vel * 0.7);
    };
    I.crash.triggerAttackRelease('1n', at(0), 0.9);
    I.timp.triggerAttackRelease('D2', beat * 2, at(0), 1);
    hit(0, 'D', 0.5);
    [0.67, 1, 1.33].forEach((b) => I.brass.triggerAttackRelease(['D5', 'A4'], beat * 0.28, at(b), 0.85));
    hit(2, 'G', 0.9);
    hit(3, 'A', 0.9);
    I.timp.triggerAttackRelease('A1', beat, at(3), 0.85);
    hit(4, 'D', 2, 4, 1);
    I.crash.triggerAttackRelease('1n', at(4), 0.8);
    I.timp.triggerAttackRelease('D2', beat, at(4), 1);
    I.choir.triggerAttackRelease(voice('D', 4), beat * 6, at(4), 0.6);
    I.strings.triggerAttackRelease(voice('D', 3), beat * 6, at(4), 0.8);
    [['F#5', 0.5], ['E5', 0.5], ['D5', 0.5]].forEach(([n, d], i) => I.brass.triggerAttackRelease(n, d * beat, at(6 + i * 0.5), 0.8));
    hit(7.5, 'G', 1.4);
    I.choir.triggerAttackRelease(voice('G', 4), beat * 1.5, at(7.5), 0.5);
    hit(9, 'A', 1);
    I.choir.triggerAttackRelease(voice('A', 4), beat, at(9), 0.5);
    ['A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G5', 'A5'].forEach((n, i) => I.harp.triggerAttackRelease(n, beat * 0.4, at(9 + i * 0.12), 0.6));
    for (let i = 0; i < 12; i += 1) I.timp.triggerAttackRelease('A1', beat * 0.2, at(9 + i / 12), 0.35 + i * 0.04);
    // The crown lands.
    hit(10, 'D', 6, 4, 1);
    I.brass.triggerAttackRelease(['D3', 'A3'], beat * 6, at(10), 0.8);
    I.crash.triggerAttackRelease('1n', at(10), 1);
    I.timp.triggerAttackRelease('D2', beat * 2, at(10), 1);
    I.choir.triggerAttackRelease([...voice('D', 4), 'F#5', 'A5'], beat * 6, at(10), 0.65);
    I.strings.triggerAttackRelease([...voice('D', 3), 'A4', 'D5'], beat * 6, at(10), 0.9);
    I.bass.triggerAttackRelease('D2', beat * 6, at(10), 1);
    ['D6', 'A5', 'F#6', 'D6', 'A6', 'F#6', 'D7'].forEach((n, i) => I.bells.triggerAttackRelease(n, beat, at(10.25 + i * 0.25), 0.7));
}

// ------------------------------------------------------------------ hall

const HALL_CHORDS = ['D', 'A/C#', 'Bm', 'G', 'D/F#', 'G', 'A', 'D', 'G', 'A', 'Bm', 'G'];
const HALL_MELODY = [
    [[0, 'D5', 1.5], [1.5, 'F#5', 0.5], [2, 'A5', 2]], [[0, 'A5', 1], [1, 'G5', 1], [2, 'E5', 2]],
    [[0, 'F#5', 1.5], [1.5, 'D5', 0.5], [2, 'B4', 2]], [[0, 'D5', 1], [1, 'E5', 1], [2, 'G5', 1], [3, 'B5', 1]],
    [[0, 'A5', 3], [3, 'F#5', 1]], [[0, 'G5', 1], [1, 'B5', 1], [2, 'D6', 2]],
    [[0, 'C#6', 1], [1, 'B5', 1], [2, 'A5', 1], [3, 'E5', 1]], [[0, 'F#5', 4]],
    [[0, 'G5', 1], [1, 'B5', 1], [2, 'D6', 1.5], [3.5, 'C#6', 0.5]], [[0, 'E6', 2], [2, 'C#6', 2]],
    [[0, 'D6', 2], [2, 'B5', 1], [3, 'A5', 1]], [[0, 'G5', 1], [1, 'A5', 1], [2, 'D5', 2]]
];

function hall(I, t0, beat) {
    const bar = beat * 4;
    HALL_CHORDS.forEach((ch, b) => {
        const t = t0 + b * bar;
        const last = b === HALL_CHORDS.length - 1;
        I.strings.triggerAttackRelease(voice(ch, 3), bar * 0.99, t, 0.5);
        I.bass.triggerAttackRelease(bassOf(ch, 2), beat * 1.8, t, 0.8);
        I.bass.triggerAttackRelease(bassOf(ch, 2), beat * 1.5, t + beat * 2, 0.6);
        const arp = [...voice(ch, 3, { top: false }), ...voice(ch, 4, { top: false })];
        [0, 2, 3, 4, 5, 4, 3, 2].forEach((p, i) => I.piano.triggerAttackRelease(arp[Math.min(p, arp.length - 1)], beat * 0.9, t + i * beat * 0.5, i === 0 ? 0.7 : 0.5));
        HALL_MELODY[b].forEach(([at, note, dur]) => I.horn.triggerAttackRelease(note, dur * beat * 0.95, t + at * beat, 0.85));
        if (b >= 8) HALL_MELODY[b].forEach(([at, note, dur]) => I.flute.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(), dur * beat * 0.9, t + at * beat, 0.45));
        if (b === 8) { I.crash.triggerAttackRelease('1n', t, 0.35); I.timp.triggerAttackRelease('G1', beat, t, 0.8); }
        else if (b % 2 === 0) I.timp.triggerAttackRelease(`${CHORDS[ch][0]}2`, beat, t, 0.45);
        if (b >= 4) I.choir.triggerAttackRelease(voice(ch, 4, { top: false }), bar, t, 0.22);
        if (last) I.bells.triggerAttackRelease(['A5', 'D6', 'F#6'], beat * 2, t + beat * 2, 0.4);
    });
}

/** The tracks: bpm, bars per loop, and whether the file loops. */
export const GRAND_SCORE = {
    festival: { file: 'grand-festival', bpm: 116, bars: 16, loop: true, play: festival, desk: { decay: 2.4, wet: 0.24 } },
    story: { file: 'grand-story', bpm: 72, bars: 12, loop: true, play: story, desk: { decay: 4, wet: 0.42 } },
    suspense: { file: 'grand-suspense', bpm: 96, bars: 8, loop: true, play: suspense, desk: { decay: 3, wet: 0.3 } },
    crowning: { file: 'grand-crowning', bpm: 100, beats: 16, tail: 4.5, loop: false, play: crowning, desk: { decay: 3.4, wet: 0.36 } },
    hall: { file: 'grand-hall', bpm: 80, bars: 12, loop: true, play: hall, desk: { decay: 3.6, wet: 0.38 } }
};

/**
 * Renders one track. Loops are played twice and the second pass is kept, so the reverb tail
 * of the end already rings under the start and the loop seam is silent.
 * Returns { sampleRate, channels: [Float32Array, Float32Array] }.
 */
export async function renderGrandTrack(key, sampleRate = 44100) {
    const def = GRAND_SCORE[key];
    const beat = 60 / def.bpm;
    const loopSeconds = def.loop ? def.bars * 4 * beat : def.beats * beat + def.tail;
    const total = def.loop ? loopSeconds * 2 : loopSeconds;
    const buffer = await Tone.Offline(async () => {
        const d = await desk(def.desk);
        const I = instruments(d);
        if (def.loop) repeat(2, def.bars * 4 * beat, 1, (t) => def.play(I, 0.05 + t, beat));
        else def.play(I, 0.05, beat);
    }, total + 0.1, 2, sampleRate);
    const start = def.loop ? Math.round((0.05 + loopSeconds) * sampleRate) : 0;
    const length = Math.round(loopSeconds * sampleRate);
    const channels = [0, 1].map((c) => buffer.getChannelData(c).slice(start, start + length));
    return { sampleRate, channels };
}

export { repeat as _repeat, voice as _voice };
