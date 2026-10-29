// /features/dayTreasureSound.js
// The music of a Day Treasure reveal, played live with WebAudio (nothing to download, no
// waiting): a drum roll while the chest rattles, a fanfare and a crash when it opens, a rising
// plink per hero, a big motif for the Hoard and a closing chord. Each kind of chest has its own
// scale and voice. Silent when reduced motion is on or audio is unavailable.

const A4 = 440;
const freqOf = (semitonesFromA4) => A4 * 2 ** (semitonesFromA4 / 12);

// Scale (semitones from the root), root (from A4), voice, for each chest family.
const MOODS = {
    royal: { root: 3, scale: [0, 2, 4, 7, 9, 12, 14, 16], voice: 'triangle', brass: 'sawtooth' },
    spooky: { root: 0, scale: [0, 3, 5, 6, 7, 10, 12, 15], voice: 'square', brass: 'sawtooth' },
    harvest: { root: -2, scale: [0, 2, 4, 7, 9, 12, 14, 16], voice: 'triangle', brass: 'triangle' },
    winter: { root: 10, scale: [0, 4, 7, 11, 12, 14, 16, 19], voice: 'sine', brass: 'triangle', bells: true },
    hearts: { root: 7, scale: [0, 4, 7, 9, 12, 16, 19, 21], voice: 'sine', brass: 'triangle' },
    clover: { root: 5, scale: [0, 2, 4, 5, 7, 9, 10, 12], voice: 'square', brass: 'triangle' },
    egg: { root: 8, scale: [0, 2, 4, 7, 9, 12, 14, 16], voice: 'sine', brass: 'triangle' },
    laurel: { root: 5, scale: [0, 2, 4, 7, 9, 12, 14, 16], voice: 'sawtooth', brass: 'sawtooth' },
    book: { root: 3, scale: [0, 4, 7, 11, 12, 16, 19, 23], voice: 'triangle', brass: 'triangle', bells: true },
};

export function createTreasureMusic(family = 'royal') {
    const mood = MOODS[family] || MOODS.royal;
    let ctx = null;
    let master = null;
    const quiet = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function ready() {
        if (quiet()) return false;
        try {
            if (!ctx) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                const comp = ctx.createDynamicsCompressor();
                master = ctx.createGain();
                master.gain.value = 0.22;
                master.connect(comp).connect(ctx.destination);
            }
            if (ctx.state === 'suspended') ctx.resume();
            return true;
        } catch {
            return false;
        }
    }

    function tone(freq, at, dur, { type = mood.voice, gain = 0.25, attack = 0.01, detune = 0 } = {}) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        amp.gain.setValueAtTime(0.0001, at);
        amp.gain.exponentialRampToValueAtTime(gain, at + attack);
        amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(amp).connect(master);
        osc.start(at);
        osc.stop(at + dur + 0.05);
    }

    function bell(freq, at, dur = 1.2, gain = 0.18) {
        tone(freq, at, dur, { type: 'sine', gain });
        tone(freq * 2.76, at, dur * 0.5, { type: 'sine', gain: gain * 0.35 });
        tone(freq * 5.4, at, dur * 0.25, { type: 'sine', gain: gain * 0.15 });
    }

    let noiseBuffer = null;
    function noise(at, dur, { gain = 0.2, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
        if (!noiseBuffer) {
            noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        }
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(gain, at);
        amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        src.connect(filter).connect(amp).connect(master);
        src.start(at, Math.random() * 0.5);
        src.stop(at + dur + 0.05);
    }

    const note = (degree, octave = 0) => {
        const steps = mood.scale;
        const i = ((degree % steps.length) + steps.length) % steps.length;
        const extra = Math.floor(degree / steps.length) * 12;
        return freqOf(mood.root + steps[i] + extra + octave * 12);
    };

    return {
        /** A drum roll that speeds up for `seconds`, with a rising hum. */
        roll(seconds = 1) {
            if (!ready()) return;
            const now = ctx.currentTime;
            let t = 0;
            let gap = 0.11;
            while (t < seconds) {
                noise(now + t, 0.07, { gain: 0.12 + (t / seconds) * 0.2, freq: 220, q: 1.2 });
                t += gap;
                gap = Math.max(0.035, gap * 0.9);
            }
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(note(0, -1), now);
            osc.frequency.exponentialRampToValueAtTime(note(4, 0), now + seconds);
            amp.gain.setValueAtTime(0.0001, now);
            amp.gain.exponentialRampToValueAtTime(0.08, now + seconds);
            amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds + 0.1);
            osc.connect(amp).connect(master);
            osc.start(now);
            osc.stop(now + seconds + 0.15);
        },
        /** The chest opens: crash, fanfare and a held chord. */
        open() {
            if (!ready()) return;
            const now = ctx.currentTime;
            noise(now, 1.4, { gain: 0.25, freq: 6000, q: 0.4, type: 'highpass' });
            noise(now, 0.25, { gain: 0.35, freq: 90, q: 1 });
            [0, 2, 4, 5].forEach((d, i) => tone(note(d), now + i * 0.11, 0.22, { type: mood.brass, gain: 0.16 }));
            [0, 2, 4].forEach((d) => tone(note(d), now + 0.5, 1.6, { type: mood.brass, gain: 0.1, attack: 0.05, detune: d * 3 }));
            tone(note(0, -1), now + 0.5, 1.6, { type: 'triangle', gain: 0.14, attack: 0.05 });
            if (mood.bells) [5, 6, 7].forEach((d, i) => bell(note(d), now + 0.6 + i * 0.12));
        },
        /** One hero's Gold: a plink that climbs with each hero. */
        coin(index = 0, tier = 'handful') {
            if (!ready()) return;
            const now = ctx.currentTime;
            const f = note(2 + (index % 8), 1);
            if (mood.bells) bell(f, now, 0.5, 0.1);
            else tone(f, now, 0.18, { type: 'triangle', gain: 0.12 });
            tone(f * 1.5, now + 0.05, 0.12, { type: 'sine', gain: 0.06 });
            if (tier === 'pouch') tone(f * 2, now + 0.1, 0.15, { type: 'sine', gain: 0.07 });
            if (tier === 'chest') [0, 2, 4].forEach((d, i) => tone(note(d, 1), now + 0.08 + i * 0.06, 0.2, { gain: 0.1 }));
        },
        /** The suspense before the Hoard. */
        hush() {
            if (!ready()) return;
            const now = ctx.currentTime;
            noise(now, 0.9, { gain: 0.14, freq: 120, q: 2 });
            tone(note(0, -2), now, 0.9, { type: 'sine', gain: 0.18, attack: 0.3 });
        },
        /** The Hoard: a big motif with bells and a crash. */
        hoard() {
            if (!ready()) return;
            const now = ctx.currentTime;
            noise(now, 1.6, { gain: 0.28, freq: 6000, q: 0.4, type: 'highpass' });
            [0, 4, 7, 9, 12].forEach((d, i) => tone(note(d), now + i * 0.09, 0.3, { type: mood.brass, gain: 0.15 }));
            [0, 2, 4, 7].forEach((d) => tone(note(d), now + 0.5, 2, { type: mood.brass, gain: 0.09, attack: 0.04, detune: d * 4 }));
            [7, 9, 11, 12, 14].forEach((d, i) => bell(note(d), now + 0.5 + i * 0.1, 1, 0.12));
        },
        /** The closing chord. */
        finale() {
            if (!ready()) return;
            const now = ctx.currentTime;
            [4, 2, 0].forEach((d, i) => tone(note(d, 1), now + i * 0.12, 0.25, { gain: 0.12 }));
            [0, 2, 4, 7].forEach((d) => tone(note(d), now + 0.4, 2.2, { type: 'triangle', gain: 0.1, attack: 0.08 }));
            tone(note(0, -1), now + 0.4, 2.2, { type: 'sine', gain: 0.16, attack: 0.08 });
            noise(now + 0.4, 1.2, { gain: 0.12, freq: 7000, q: 0.4, type: 'highpass' });
        },
        close() {
            try { ctx?.close(); } catch { /* already closed */ }
            ctx = null;
        },
    };
}
