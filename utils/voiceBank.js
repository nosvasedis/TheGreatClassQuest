// Voice pools and sleeping voice banks for the Tone.js sound effects.
//
// Why these exist (the "stuttering sound" fix):
// - Tone.PolySynth hands every note that starts in the future to a main-thread timer and only
//   gives it to the audio clock ~0.1s before it sounds. While an effect animates (confetti,
//   banners, the sky) the main thread stalls for longer than that, so notes arrived late, bunched
//   up or were dropped. A VoicePool schedules every note straight onto the audio clock the moment
//   it is asked for, so busy frames can no longer touch the timing.
// - A built synth keeps costing audio-thread CPU even when silent (its signals run forever), and
//   PolySynths kept piling up voices. On school laptops the audio thread ran out of time and the
//   sound crackled, cut out or went silent. A VoiceBank builds its voices on first use and disposes
//   them once they have been quiet for a while, so an idle app costs (almost) nothing.

/**
 * A polyphonic instrument made of mono Tone voices (Synth, FMSynth, MembraneSynth…), with the
 * PolySynth calls the sound code uses: triggerAttackRelease, triggerAttack, releaseAll.
 */
export class VoicePool {
    constructor(Tone, Voice, options = {}, maxPolyphony = 8) {
        this.Tone = Tone;
        this.Voice = Voice;
        this.options = options;
        this.maxPolyphony = maxPolyphony;
        this.voices = [];
        this.output = new Tone.Gain(1);
        const env = options.envelope || {};
        this.release = Math.max(0.05, Number(env.release ?? 1));
    }

    connect(node) { this.output.connect(node); return this; }

    toDestination() { this.output.toDestination(); return this; }

    /** Let go of voices that have been silent for a while: a silent voice still costs audio CPU. */
    _trim() {
        if (this.voices.length <= 1) return;
        const quietSince = this.Tone.getContext().currentTime - 1.5;
        this.voices = this.voices.filter((v) => {
            if (v.held || v.busyUntil > quietSince) return true;
            try { v.synth.dispose(); } catch (_) { /* gone */ }
            return false;
        });
    }

    /** A voice that is free at `time` and has nothing scheduled after it (that would be cut). */
    _voiceAt(time) {
        let free = null;
        let soonest = null;
        for (const v of this.voices) {
            if (v.lastStart >= time - 0.0005) continue;
            if (v.busyUntil <= time) {
                if (!free || v.busyUntil < free.busyUntil) free = v;
            } else if (!v.held && (!soonest || v.busyUntil < soonest.busyUntil)) {
                soonest = v;
            }
        }
        if (free) return free;
        if (this.voices.length < this.maxPolyphony) {
            const v = { synth: new this.Voice(this.options).connect(this.output), lastStart: -1, busyUntil: 0, held: false };
            this.voices.push(v);
            return v;
        }
        // Every voice is busy: take the one that finishes first.
        return soonest;
    }

    _time(time) {
        const now = this.Tone.now();
        const t = time === undefined ? now : this.Tone.Time(time).toSeconds();
        return Math.max(t, this.Tone.getContext().currentTime + 0.005);
    }

    triggerAttackRelease(notes, duration, time, velocity = 1) {
        const t = this._time(time);
        const d = Math.max(0.01, this.Tone.Time(duration).toSeconds());
        this._trim();
        for (const note of [].concat(notes)) {
            const v = this._voiceAt(t);
            if (!v) continue;
            try {
                v.synth.triggerAttackRelease(note, d, t, velocity);
                v.lastStart = t;
                v.busyUntil = t + d + this.release;
                v.held = false;
            } catch (_) { /* one note lost; the rest still play */ }
        }
        return this;
    }

    triggerAttack(notes, time, velocity = 1) {
        const t = this._time(time);
        this._trim();
        for (const note of [].concat(notes)) {
            const v = this._voiceAt(t);
            if (!v) continue;
            try {
                v.synth.triggerAttack(note, t, velocity);
                v.lastStart = t;
                v.busyUntil = Infinity;
                v.held = true;
            } catch (_) { /* one note lost; the rest still play */ }
        }
        return this;
    }

    releaseAll(time) {
        const t = this._time(time);
        for (const v of this.voices) {
            if (!v.held) continue;
            try { v.synth.triggerRelease(Math.max(t, v.lastStart + 0.001)); } catch (_) { /* already released */ }
            v.held = false;
            v.busyUntil = Math.max(t, v.lastStart) + this.release;
        }
        return this;
    }

    dispose() {
        this.voices.forEach((v) => { try { v.synth.dispose(); } catch (_) { /* gone */ } });
        this.voices = [];
        try { this.output.dispose(); } catch (_) { /* gone */ }
        return this;
    }
}

/**
 * Mono voices (one note at a time) cancel anything they have scheduled after a new note, and throw
 * when two notes land on the very same instant, which used to abort the rest of a sound. This makes
 * a mono voice skip a clashing note instead of throwing.
 */
export function guardMonoVoice(voice) {
    ['triggerAttackRelease', 'triggerAttack', 'triggerRelease'].forEach((name) => {
        const original = voice[name]?.bind(voice);
        if (!original) return;
        voice[name] = (...args) => {
            try { return original(...args); } catch (_) { return voice; }
        };
    });
    return voice;
}

/**
 * An object whose voices are only built when first used: { name: () => node }. A click then only
 * builds the click, not the whole band.
 */
export function lazyVoices(factories) {
    const voices = {};
    Object.entries(factories).forEach(([name, make]) => {
        let value;
        let made = false;
        Object.defineProperty(voices, name, {
            enumerable: true,
            get() {
                if (!made) {
                    value = make();
                    made = true;
                }
                return value;
            }
        });
    });
    return voices;
}

/**
 * Builds a set of voices on first use and disposes it after it has been quiet for `idle` seconds.
 * build(keep) creates the voices, passing every node it makes through keep() so it can be disposed,
 * and returns the object the sound code uses.
 */
export function createVoiceBank(build, { idle = 12, span = 6 } = {}) {
    let voices = null;
    let nodes = [];
    let until = 0;
    let held = false;
    let timer = 0;

    const keep = (node) => {
        nodes.push(node);
        return node;
    };

    function dispose() {
        if (timer) clearTimeout(timer);
        timer = 0;
        held = false;
        const old = nodes;
        voices = null;
        nodes = [];
        for (let i = old.length - 1; i >= 0; i--) {
            try { old[i].dispose(); } catch (_) { /* already disposed */ }
        }
    }

    function check() {
        timer = 0;
        if (!voices || held) return;
        const left = until - performance.now();
        if (left > 0) {
            timer = setTimeout(check, left + 50);
            return;
        }
        dispose();
    }

    function wake(seconds = span) {
        until = Math.max(until, performance.now() + (Math.max(0, seconds) + idle) * 1000);
        if (!timer && !held) timer = setTimeout(check, until - performance.now() + 50);
    }

    return {
        /** The voices, built if needed, kept awake for `seconds` (plus the idle time). */
        get(seconds = span) {
            if (!voices) voices = build(keep);
            wake(seconds);
            return voices;
        },
        wake,
        /** Keep the voices while something open-ended (a loop) plays. */
        hold() {
            held = true;
            if (timer) clearTimeout(timer);
            timer = 0;
        },
        /** The open-ended sound stopped; sleep `seconds` after it. */
        release(seconds = 1) {
            held = false;
            until = 0;
            wake(seconds);
        },
        get awake() { return Boolean(voices); },
        dispose,
    };
}
