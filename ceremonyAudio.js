// ceremonyAudio.js — soundtrack and sound effects for the three ceremonies
// (Ceremony of the Month arena, Growth Festival garden, Grand Guild Ceremony).
// Nothing here loads at app start: a ceremony calls prepareCeremonyAudio(bank)
// when it opens, which builds a few Tone.js synths and starts fetching that
// bank's music files: small committed MP3s under assets/ceremony/music/
// (made once for the app; nothing is generated or paid for at runtime).

import { ensureAudioReady, setCeremonyMuted } from './audio.js';
import { loadTone } from './utils/lazyLibraries.js';

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
        grand_crowning: { url: 'assets/ceremony/music/grand-crowning.mp3', loop: false, volume: -6 }
    }
};

let Tone = null;
let fx = null;
let fxPromise = null;
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

async function buildFx() {
    Tone = Tone || await loadTone();
    const out = new Tone.Gain(0.9).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.28 }).connect(out);
    const dry = new Tone.Gain(1).connect(out);

    const boom = new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 5, envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.3 }, volume: -6 }).connect(reverb);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 }, volume: -18 });
    const snareFilter = new Tone.Filter({ type: 'bandpass', frequency: 2400, Q: 0.8 }).connect(dry);
    snare.connect(snareFilter);
    const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.9, sustain: 0 }, volume: -14 });
    const crashFilter = new Tone.Filter({ type: 'highpass', frequency: 4200 }).connect(reverb);
    crash.connect(crashFilter);
    const whooshNoise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.12, decay: 0.35, sustain: 0, release: 0.2 }, volume: -12 });
    const whooshFilter = new Tone.Filter({ type: 'bandpass', frequency: 500, Q: 1.4 }).connect(reverb);
    whooshNoise.connect(whooshFilter);
    const crackNoise = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -6 }).connect(dry);
    const bells = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 6,
        envelope: { attack: 0.005, decay: 0.9, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
        volume: -14
    }).connect(reverb);
    // A plain triangle pluck: Tone.PluckSynth builds IIR filters that stall slow laptops for a moment.
    const pluck = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.12 }, volume: -8 }).connect(reverb);
    const tick = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -12 }).connect(dry);
    const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.04, decay: 0.3, sustain: 0.55, release: 0.9 },
        volume: -20
    });
    const brassFilter = new Tone.Filter({ type: 'lowpass', frequency: 2200 }).connect(reverb);
    brass.connect(brassFilter);
    const gong = new Tone.FMSynth({ harmonicity: 1.41, modulationIndex: 18, envelope: { attack: 0.002, decay: 3.5, sustain: 0, release: 2 }, modulationEnvelope: { attack: 0.002, decay: 2.5, sustain: 0, release: 1 }, volume: -10 }).connect(reverb);
    const glide = new Tone.Synth({ oscillator: { type: 'sine' }, portamento: 0.35, envelope: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 0.4 }, volume: -16 }).connect(reverb);

    return { out, reverb, boom, snare, crash, whooshNoise, whooshFilter, crackNoise, bells, pluck, tick, brass, gong, glide };
}

/** Wake audio, build the effect synths once, and start loading a bank's music. */
export async function prepareCeremonyAudio(bank) {
    const ready = await ensureAudioReady().catch(() => false);
    if (!ready) return false;
    Tone = Tone || await loadTone();
    if (!fxPromise) fxPromise = buildFx().then((built) => { fx = built; return built; }).catch((error) => { console.warn('Ceremony sound effects unavailable', error); fxPromise = null; return null; });
    await fxPromise;
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
    if (muted || !fx || !Tone) return;
    stopCeremonyDrumroll({ crash: false });
    const t0 = Tone.now();
    fx.snare.volume.cancelScheduledValues(t0);
    fx.snare.volume.setValueAtTime(-30, t0);
    fx.snare.volume.linearRampToValueAtTime(-9, t0 + seconds);
    let t = t0 + 0.02;
    const end = t0 + seconds + 4;
    // Schedule ahead in small chunks so a stop can cancel quickly.
    const chunk = () => {
        const until = Math.min(end, Tone.now() + 0.4);
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
    if (!fx || !Tone) return;
    if (drumLoop) {
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

const NOTE_SETS = {
    reveal: ['C6', 'E6', 'G6', 'C7'],
    gold: ['G5', 'C6', 'E6', 'G6', 'C7'],
    chime: ['E6', 'B6'],
    bloom: ['C6', 'E6', 'G6', 'B6', 'E7']
};

/** One-shot effects. Unknown names are ignored. */
export function playCeremonySfx(name) {
    if (muted || !fx || !Tone) return;
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
            default:
                break;
        }
    } catch (_) { /* audio node busy */ }
}
