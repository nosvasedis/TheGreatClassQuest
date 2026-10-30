// ceremonyAudio.js — soundtrack and sound effects for the three ceremonies
// (Ceremony of the Month arena, Growth Festival garden, Grand Guild Ceremony).
// Nothing here loads at app start: a ceremony calls prepareCeremonyAudio(bank)
// when it opens, which builds a few Tone.js synths and starts fetching that
// bank's music files: small committed MP3s under assets/ceremony/music/
// (made once for the app; nothing is generated or paid for at runtime).

import { ensureAudioReady, setCeremonyMuted } from './audio.js';
import { loadTone } from './utils/lazyLibraries.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from './utils/voiceBank.js';

export const CEREMONY_TRACKS = {
    arena: {
        arena_theme: { url: 'assets/ceremony/music/arena-theme.mp3', loop: true, volume: -11 },
        heroes_theme: { url: 'assets/ceremony/music/heroes-theme.mp3', loop: true, volume: -11 },
        duel: { url: 'assets/ceremony/music/duel-tension.mp3', loop: true, volume: -9 },
        victory: { url: 'assets/ceremony/music/victory-fanfare.mp3', loop: false, volume: -6 }
    },
    garden: {
        garden_theme: { url: 'assets/ceremony/music/garden-theme.mp3', loop: true, volume: -11 },
        golden_bloom: { url: 'assets/ceremony/music/golden-bloom.mp3', loop: false, volume: -7 }
    },
    grand: {
        grand_theme: { url: 'assets/ceremony/music/grand-festival.mp3', loop: true, volume: -11 },
        grand_suspense: { url: 'assets/ceremony/music/grand-suspense.mp3', loop: true, volume: -9 },
        grand_crowning: { url: 'assets/ceremony/music/grand-crowning.mp3', loop: false, volume: -6 },
        grand_story: { url: 'assets/ceremony/music/grand-story.mp3', loop: true, volume: -12 },
        grand_hall: { url: 'assets/ceremony/music/grand-hall.mp3', loop: true, volume: -11 }
    }
};

let Tone = null;
let fxReady = false;
const players = new Map();
const buffers = new Map();
let currentMusic = null;
let muted = false;
let drumLoop = null;
let drumTimer = null;

export function isCeremonyAudioMuted() {
    return muted;
}

export function toggleCeremonyAudioMute() {
    muted = !muted;
    setCeremonyMuted(muted);
    if (muted) stopCeremonyAudio({ fade: 0.2 });
    return muted;
}

// Effect voices are built when first played and put to sleep when quiet (see utils/voiceBank.js):
// silent synths kept costing the audio thread and made the music crackle on school laptops.
let fxChassis = null;
const fxBank = createVoiceBank((keep) => {
    if (!fxChassis) {
        const out = new Tone.Gain(0.9).toDestination();
        fxChassis = { out, reverb: new Tone.Reverb({ decay: 2.4, wet: 0.28 }).connect(out), dry: new Tone.Gain(1).connect(out) };
    }
    const { out, reverb, dry } = fxChassis;
    const mono = (node) => keep(guardMonoVoice(node));
    const pool = (Voice, options, max) => keep(new VoicePool(Tone, Voice, options, max));
    const v = lazyVoices({
        out: () => out,
        reverb: () => reverb,
        boom: () => mono(new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 5, envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.3 }, volume: -6 }).connect(reverb)),
        snareFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 2400, Q: 0.8 }).connect(dry)),
        snare: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 }, volume: -18 }).connect(v.snareFilter)),
        crashFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 4200 }).connect(reverb)),
        crash: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.9, sustain: 0 }, volume: -14 }).connect(v.crashFilter)),
        whooshFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 500, Q: 1.4 }).connect(reverb)),
        whooshNoise: () => mono(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.12, decay: 0.35, sustain: 0, release: 0.2 }, volume: -12 }).connect(v.whooshFilter)),
        crackNoise: () => mono(new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -6 }).connect(dry)),
        bells: () => pool(Tone.FMSynth, {
            harmonicity: 3.01, modulationIndex: 6,
            envelope: { attack: 0.005, decay: 0.9, sustain: 0, release: 1.2 },
            modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
            volume: -14
        }, 10).connect(reverb),
        // A plain triangle pluck: Tone.PluckSynth runs an audio-thread script that stalls slow laptops.
        pluck: () => mono(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.12 }, volume: -8 }).connect(reverb)),
        tick: () => mono(new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -12 }).connect(dry)),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2200 }).connect(reverb)),
        brass: () => pool(Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            envelope: { attack: 0.04, decay: 0.3, sustain: 0.55, release: 0.9 },
            volume: -20
        }, 8).connect(v.brassFilter),
        gong: () => mono(new Tone.FMSynth({ harmonicity: 1.41, modulationIndex: 18, envelope: { attack: 0.002, decay: 3.5, sustain: 0, release: 2 }, modulationEnvelope: { attack: 0.002, decay: 2.5, sustain: 0, release: 1 }, volume: -10 }).connect(reverb)),
        glide: () => mono(new Tone.Synth({ oscillator: { type: 'sine' }, portamento: 0.35, envelope: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 0.4 }, volume: -16 }).connect(reverb)),
        // The Portal Ascent: a rising swell under the charging crest.
        riser: () => mono(new Tone.Synth({ oscillator: { type: 'fattriangle', count: 2, spread: 14 }, envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.25 }, volume: -17 }).connect(reverb)),
    });
    return v;
}, { idle: 8, span: 4 });

/** The effect voices, kept awake for `seconds`. */
function getFx(seconds) {
    return fxReady && Tone ? fxBank.get(seconds) : null;
}

/** Wake audio, build the effect synths once, and start loading a bank's music. */
export async function prepareCeremonyAudio(bank) {
    const ready = await ensureAudioReady().catch(() => false);
    if (!ready) return false;
    Tone = Tone || await loadTone();
    fxReady = true;
    const tracks = CEREMONY_TRACKS[bank] || {};
    Object.entries(tracks).forEach(([key, def]) => {
        if (players.has(key)) return;
        // Tracks that share a file share one decoded buffer (saves memory on
        // low-spec laptops).
        let buffer = buffers.get(def.url);
        if (!buffer) {
            buffer = new Tone.ToneAudioBuffer(def.url, undefined, () => buffers.delete(def.url));
            buffers.set(def.url, buffer);
        }
        const player = new Tone.Player({ url: buffer, loop: def.loop, volume: def.volume, fadeIn: 0.05, fadeOut: 0.4 }).toDestination();
        player.__def = def;
        players.set(key, player);
    });
    return true;
}

function startPlayer(player, fade) {
    const def = player.__def || {};
    try {
        if (player.state === 'started') player.stop();
        player.volume.cancelScheduledValues(Tone.now());
        player.volume.value = fade > 0 ? -48 : def.volume;
        player.start();
        if (fade > 0) player.volume.rampTo(def.volume, fade);
    } catch (_) { /* buffer not ready */ }
}

/**
 * Play a track from a prepared bank. Looping tracks replace the current music
 * (crossfade); one-shots play over it. If the file is still loading it starts
 * as soon as it arrives, unless another track was requested meanwhile.
 */
export function playCeremonyTrack(key, { fade = 0.9 } = {}) {
    if (muted || !Tone) return;
    const player = players.get(key);
    if (!player) return;
    const isMusic = Boolean(player.__def?.loop);
    if (isMusic) {
        if (currentMusic === player && player.state === 'started') return;
        stopCeremonyMusic({ fade: 0.8, except: player });
        currentMusic = player;
    }
    if (player.loaded) {
        startPlayer(player, isMusic ? fade : 0);
    } else {
        Tone.loaded().then(() => {
            if (muted || (isMusic && currentMusic !== player)) return;
            if (player.loaded) startPlayer(player, isMusic ? fade : 0);
        }).catch(() => {});
    }
}

export function stopCeremonyMusic({ fade = 0.8, except = null } = {}) {
    if (!Tone) return;
    players.forEach((player) => {
        if (player === except || !player.__def?.loop || player.state !== 'started') return;
        try {
            player.volume.rampTo(-60, fade);
            player.stop(Tone.now() + fade + 0.05);
        } catch (_) { /* already stopped */ }
    });
    if (!except) currentMusic = null;
}

export function duckCeremonyMusic(on = true) {
    if (!currentMusic || !Tone) return;
    try {
        const target = (currentMusic.__def?.volume ?? -12) - (on ? 12 : 0);
        currentMusic.volume.rampTo(target, 0.5);
    } catch (_) { /* not playing */ }
}

/** Fade out the one-shot clips still sounding (a long victory fanfare under the next scene). */
export function stopCeremonyOneShots({ fade = 0.8 } = {}) {
    if (!Tone) return;
    players.forEach((player) => {
        if (player.__def?.loop || player.state !== 'started') return;
        try {
            player.volume.rampTo(-60, fade);
            player.stop(Tone.now() + fade + 0.05);
        } catch (_) { /* already stopped */ }
    });
}

export function stopCeremonyAudio({ fade = 0.5 } = {}) {
    stopCeremonyDrumroll({ crash: false });
    stopCeremonyMusic({ fade });
    if (!Tone) return;
    players.forEach((player) => {
        if (player.__def?.loop || player.state !== 'started') return;
        try { player.stop(Tone.now() + 0.05); } catch (_) { /* already stopped */ }
    });
}

/** Rolling snare that swells for `seconds`, optional cymbal + boom at the end. */
export function startCeremonyDrumroll(seconds = 2.8) {
    if (muted || !fxReady || !Tone) return;
    stopCeremonyDrumroll({ crash: false });
    const fx = getFx(seconds + 4);
    fxBank.hold();
    const t0 = Tone.now();
    fx.snare.volume.cancelScheduledValues(t0);
    fx.snare.volume.setValueAtTime(-30, t0);
    fx.snare.volume.linearRampToValueAtTime(-9, t0 + seconds);
    let t = t0 + 0.02;
    const end = t0 + seconds + 4;
    // Schedule ahead in small chunks so a stop can cancel quickly.
    const chunk = () => {
        // Scheduled well ahead so a busy frame cannot open a gap; a stop silences it at once.
        const until = Math.min(end, Tone.now() + 0.8);
        while (t < until) {
            fx.snare.triggerAttackRelease('32n', t, 0.6 + Math.random() * 0.4);
            t += 0.045;
        }
        drumTimer = setTimeout(chunk, 250);
    };
    chunk();
    drumLoop = true;
}

export function stopCeremonyDrumroll({ crash = true } = {}) {
    if (drumTimer) clearTimeout(drumTimer);
    drumTimer = null;
    const fx = getFx(3);
    if (!fx) return;
    if (drumLoop) {
        fxBank.release(3);
        fx.snare.volume.cancelScheduledValues(Tone.now());
        fx.snare.volume.setValueAtTime(-60, Tone.now() + 0.05);
        setTimeout(() => { try { fx.snare.volume.value = -18; } catch (_) { /* disposed */ } }, 600);
    }
    drumLoop = null;
    if (crash && !muted) {
        const now = Tone.now() + 0.02;
        fx.crash.triggerAttackRelease('2n', now);
        fx.boom.triggerAttackRelease('C1', '4n', now);
    }
}

/**
 * Soft rising ticks while a number counts up (eased like the count, so the ticks slow down
 * with it). Every tick goes straight onto the audio clock.
 */
export function playCeremonyTally({ seconds = 0.9, steps = 10 } = {}) {
    if (muted || !fxReady || !Tone) return;
    const fx = getFx(seconds + 2);
    const n = Math.max(3, Math.min(16, Math.round(steps)));
    const scale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];
    const now = Tone.now() + 0.02;
    try {
        for (let i = 1; i <= n; i += 1) {
            const at = now + seconds * (1 - Math.cbrt(1 - i / n));
            const note = scale[Math.min(scale.length - 1, i - 1)];
            fx.tick.triggerAttackRelease(note, '64n', at, 0.55 + (i / n) * 0.45);
        }
        fx.bells.triggerAttackRelease(scale[Math.min(scale.length - 1, n)], '16n', now + seconds + 0.02, 0.7);
    } catch (_) { /* audio node busy */ }
}

const NOTE_SETS = {
    reveal: ['C6', 'E6', 'G6', 'C7'],
    gold: ['G5', 'C6', 'E6', 'G6', 'C7'],
    chime: ['E6', 'B6'],
    bloom: ['C6', 'E6', 'G6', 'B6', 'E7']
};

/** One-shot effects. Unknown names are ignored. */
export function playCeremonySfx(name) {
    if (muted || !fxReady || !Tone) return;
    const fx = getFx(name === 'gong' ? 6 : 4);
    const now = Tone.now() + 0.02;
    try {
        switch (name) {
            case 'boom':
                fx.boom.triggerAttackRelease('C1', '8n', now);
                break;
            case 'drop':
                fx.boom.triggerAttackRelease('G1', '16n', now);
                fx.tick.triggerAttackRelease('C3', '32n', now + 0.02);
                break;
            case 'whoosh':
                fx.whooshFilter.frequency.cancelScheduledValues(now);
                fx.whooshFilter.frequency.setValueAtTime(380, now);
                fx.whooshFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.45);
                fx.whooshNoise.triggerAttackRelease(0.45, now);
                break;
            case 'crack':
                fx.crackNoise.triggerAttackRelease('32n', now);
                fx.pluck.triggerAttackRelease('A2', '16n', now + 0.01);
                break;
            case 'reveal':
                NOTE_SETS.reveal.forEach((note, i) => fx.bells.triggerAttackRelease(note, '8n', now + i * 0.07));
                break;
            case 'gold':
                NOTE_SETS.gold.forEach((note, i) => fx.bells.triggerAttackRelease(note, '4n', now + i * 0.06));
                fx.brass.triggerAttackRelease(['C4', 'G4', 'C5', 'E5'], 1.4, now);
                break;
            case 'tick':
                fx.tick.triggerAttackRelease('G4', '32n', now);
                break;
            case 'count':
                fx.boom.triggerAttackRelease('E1', '8n', now);
                fx.bells.triggerAttackRelease('C5', '16n', now);
                break;
            case 'heartbeat':
                fx.boom.triggerAttackRelease('A0', '16n', now);
                fx.boom.triggerAttackRelease('A0', '16n', now + 0.22);
                break;
            case 'fanfare':
                fx.brass.triggerAttackRelease(['G3', 'D4', 'G4'], 0.18, now);
                fx.brass.triggerAttackRelease(['G3', 'D4', 'G4'], 0.18, now + 0.22);
                fx.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 1.2, now + 0.44);
                break;
            case 'seed':
                fx.pluck.triggerAttackRelease('C4', '16n', now);
                break;
            case 'sprout':
                fx.glide.triggerAttack('C5', now);
                fx.glide.setNote('C6', now + 0.1);
                fx.glide.triggerRelease(now + 0.5);
                break;
            case 'pop':
                fx.pluck.triggerAttackRelease('G5', '16n', now);
                NOTE_SETS.bloom.forEach((note, i) => fx.bells.triggerAttackRelease(note, '16n', now + 0.05 + i * 0.05));
                break;
            case 'chime':
                NOTE_SETS.chime.forEach((note, i) => fx.bells.triggerAttackRelease(note, '8n', now + i * 0.09));
                break;
            case 'gong':
                fx.gong.triggerAttackRelease('C2', 3, now);
                fx.boom.triggerAttackRelease('C1', '4n', now);
                break;
            // ---- The Portal Ascent (a class's quest rank) ----
            case 'portal_open':
                fx.whooshFilter.frequency.cancelScheduledValues(now);
                fx.whooshFilter.frequency.setValueAtTime(220, now);
                fx.whooshFilter.frequency.exponentialRampToValueAtTime(1800, now + 0.7);
                fx.whooshNoise.triggerAttackRelease(0.7, now);
                fx.boom.triggerAttackRelease('F1', '8n', now + 0.05);
                ['C5', 'G5', 'D6', 'A6'].forEach((note, i) => fx.bells.triggerAttackRelease(note, '8n', now + 0.25 + i * 0.09, 0.6));
                break;
            case 'charge': {
                // A swell that climbs for ~1.1s with a sparkle ladder on top.
                fx.riser.triggerAttack('C3', now);
                fx.riser.frequency.exponentialRampToValueAtTime(Tone.Frequency('C6').toFrequency(), now + 1.1);
                fx.riser.triggerRelease(now + 1.12);
                ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((note, i) => fx.bells.triggerAttackRelease(note, '32n', now + 0.35 + i * 0.11, 0.35 + i * 0.09));
                fx.snare.triggerAttackRelease('32n', now + 0.9, 0.5);
                fx.snare.triggerAttackRelease('32n', now + 0.98, 0.7);
                fx.snare.triggerAttackRelease('32n', now + 1.05, 0.9);
                break;
            }
            case 'rankup':
                fx.boom.triggerAttackRelease('C1', '4n', now);
                fx.crash.triggerAttackRelease('2n', now);
                fx.gong.triggerAttackRelease('C2', 2.6, now + 0.02);
                fx.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.16, now);
                fx.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.16, now + 0.19);
                fx.brass.triggerAttackRelease(['A3', 'D4', 'F4'], 0.3, now + 0.38);
                fx.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 1.7, now + 0.72);
                NOTE_SETS.gold.forEach((note, i) => fx.bells.triggerAttackRelease(note, '4n', now + 0.72 + i * 0.06));
                break;
            case 'stamp':
                fx.boom.triggerAttackRelease('G1', '16n', now);
                fx.crackNoise.triggerAttackRelease('32n', now);
                fx.tick.triggerAttackRelease('C3', '32n', now + 0.01);
                break;
            case 'quest_horn':
                // "Next quest!": a rising horn call that ends on an open, hopeful chord.
                fx.brass.triggerAttackRelease('G3', 0.12, now);
                fx.brass.triggerAttackRelease('C4', 0.12, now + 0.15);
                fx.brass.triggerAttackRelease('E4', 0.12, now + 0.3);
                fx.brass.triggerAttackRelease(['C4', 'G4', 'D5'], 1.3, now + 0.45);
                fx.boom.triggerAttackRelease('C2', '8n', now + 0.45);
                ['G5', 'D6', 'G6'].forEach((note, i) => fx.bells.triggerAttackRelease(note, '8n', now + 0.5 + i * 0.08, 0.6));
                break;
            case 'road':
                // The road so far: two gentle low bells, open and unfinished.
                fx.bells.triggerAttackRelease('G4', '4n', now, 0.6);
                fx.bells.triggerAttackRelease('D5', '4n', now + 0.18, 0.6);
                fx.glide.triggerAttack('G4', now + 0.1);
                fx.glide.setNote('D5', now + 0.3);
                fx.glide.triggerRelease(now + 0.8);
                break;
            // ---- The Grand Guild Ceremony ----
            case 'grand_chapter':
                // A chapter title card: low gong, a harp run up and a bell on top.
                fx.boom.triggerAttackRelease('D1', '4n', now);
                fx.gong.triggerAttackRelease('D2', 1.6, now + 0.01);
                ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'].forEach((note, i) => fx.pluck.triggerAttackRelease(note, '16n', now + 0.12 + i * 0.06));
                fx.bells.triggerAttackRelease('D6', '4n', now + 0.5, 0.7);
                break;
            case 'grand_medal':
                fx.bells.triggerAttackRelease('A5', '32n', now, 0.45);
                fx.tick.triggerAttackRelease('E4', '64n', now);
                break;
            case 'grand_unfurl':
                fx.whooshFilter.frequency.cancelScheduledValues(now);
                fx.whooshFilter.frequency.setValueAtTime(260, now);
                fx.whooshFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.6);
                fx.whooshNoise.triggerAttackRelease(0.6, now);
                fx.brass.triggerAttackRelease(['D4', 'A4'], 0.5, now + 0.25);
                break;
            case 'grand_crown':
                // The crown lands: a bright clang, a brass chord and a bell cascade.
                fx.crash.triggerAttackRelease('2n', now);
                fx.boom.triggerAttackRelease('D1', '4n', now);
                fx.brass.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 1.6, now + 0.05);
                ['D6', 'A5', 'F#6', 'D7', 'A6'].forEach((note, i) => fx.bells.triggerAttackRelease(note, '8n', now + 0.1 + i * 0.07, 0.8));
                break;
            // ---- The Chronicle and the Honours of the Month ----
            case 'scroll':
                // A parchment unrolling: a soft low rush and a little run of wooden plucks.
                fx.whooshFilter.frequency.cancelScheduledValues(now);
                fx.whooshFilter.frequency.setValueAtTime(260, now);
                fx.whooshFilter.frequency.exponentialRampToValueAtTime(900, now + 0.6);
                fx.whooshNoise.triggerAttackRelease(0.6, now);
                ['C4', 'E4', 'G4', 'C5'].forEach((note, i) => fx.pluck.triggerAttackRelease(note, '32n', now + 0.12 + i * 0.09));
                break;
            case 'pling': {
                // One bright bell per hero, climbing a pentatonic ladder.
                const ladder = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'];
                plingStep = (plingStep + 1) % ladder.length;
                fx.bells.triggerAttackRelease(ladder[plingStep], '16n', now, 0.55);
                break;
            }
            default:
                break;
        }
    } catch (_) { /* audio node busy */ }
}

let plingStep = -1;
