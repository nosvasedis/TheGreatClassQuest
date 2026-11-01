// features/realmRaidAudio.js — Realm Raid battle music and sound effects (loaded with the Raid Hall).
//
// All synthesised with Tone.js: nothing to download. Kept light for school laptops:
// - every note goes straight onto the audio clock (VoicePool / mono voices, never PolySynth), and the
//   music is scheduled a whole bar ahead by a slow timer, so a busy frame can't make it stutter;
// - no reverb, no PluckSynth; a handful of cheap voices in one VoiceBank that sleeps when quiet;
// - the lite tier drops the arpeggio and the hi-hats (fewer notes per second).
// The tunes are our own: one heroic loop per season, with a calm version for the week before
// (herald) and a bright one once the shield is broken.
import { loadTone } from '../utils/lazyLibraries.js';
import { isAudioReady, isCeremonyMuted, ensureAudioReady } from '../audio.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from '../utils/voiceBank.js';

let Tone = null;
const PREF_KEY = 'gcq.raid.music';

/** Music on? (sound effects follow the app's own sound settings) */
export function raidMusicOn() {
    try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

export function setRaidMusicOn(on) {
    try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* private mode: this visit only */ }
    if (!on) stopRaidMusic();
}

const bank = createVoiceBank((keep) => {
    const bus = keep(new Tone.Gain(0.75)).toDestination();
    const mono = (node) => keep(guardMonoVoice(node));
    const pool = (Voice, options, max) => keep(new VoicePool(Tone, Voice, options, max)).connect(bus);
    const v = lazyVoices({
        bus: () => bus,
        bass: () => mono(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.55, release: 0.08 }, volume: -8 }).connect(bus)),
        lead: () => mono(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0.5, release: 0.12 }, volume: -22 }).connect(bus)),
        arp: () => pool(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.05 }, volume: -30 }, 3),
        bell: () => pool(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.4 }, volume: -15 }, 6),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2400 }).connect(bus)),
        brass: () => keep(new VoicePool(Tone, Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3 }, volume: -21 }, 6)).connect(v.brassFilter),
        kick: () => mono(new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, volume: -9 }).connect(bus)),
        snareFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1800 }).connect(bus)),
        snare: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 }, volume: -19 }).connect(v.snareFilter)),
        hatFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 7500 }).connect(bus)),
        hat: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }, volume: -27 }).connect(v.hatFilter)),
        swishFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 800, Q: 1.2 }).connect(bus)),
        swish: () => mono(new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.05, decay: 0.5, sustain: 0, release: 0.1 }, volume: -14 }).connect(v.swishFilter)),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 5000 }).connect(bus)),
        cymbal: () => mono(new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.3 }, volume: -25 }).connect(v.cymbalFilter))
    });
    return v;
}, { idle: 10, span: 4 });

// ─── The tunes ───────────────────────────────────────────────────────────────
// Four bars each; the lead is written in eighth notes ('-' holds, '.' rests).

const SONGS = {
    winter: {
        bpm: 132,
        chords: [
            { bass: ['D2', 'A2'], arp: ['D4', 'F4', 'A4'] },
            { bass: ['A#1', 'F2'], arp: ['D4', 'F4', 'A#4'] },
            { bass: ['C2', 'G2'], arp: ['C4', 'E4', 'G4'] },
            { bass: ['A1', 'E2'], arp: ['C#4', 'E4', 'A4'] }
        ],
        lead: 'D5 - A4 D5 F5 - E5 D5 | F5 - D5 F5 A#5 - A5 F5 | G5 - E5 C5 E5 G5 C6 - | A5 - - - G5 - E5 C#5'
    },
    carnival: {
        bpm: 148,
        chords: [
            { bass: ['F2', 'C3'], arp: ['F4', 'A4', 'C5'] },
            { bass: ['D2', 'A2'], arp: ['D4', 'F4', 'A4'] },
            { bass: ['A#1', 'F2'], arp: ['D4', 'F4', 'A#4'] },
            { bass: ['C2', 'G2'], arp: ['C4', 'E4', 'G4'] }
        ],
        lead: 'C5 F5 A5 F5 C6 - A5 . | D5 F5 A5 F5 D6 - A5 . | A#4 D5 F5 A#5 A5 G5 F5 D5 | E5 - G5 - C6 - - .'
    },
    summer: {
        bpm: 128,
        chords: [
            { bass: ['A1', 'E2'], arp: ['A4', 'C#5', 'E5'] },
            { bass: ['F#1', 'C#2'], arp: ['F#4', 'A4', 'C#5'] },
            { bass: ['D2', 'A2'], arp: ['D4', 'F#4', 'A4'] },
            { bass: ['E2', 'B2'], arp: ['E4', 'G#4', 'B4'] }
        ],
        lead: 'E5 - A5 B5 C#6 - B5 A5 | F#5 - A5 . C#6 - B5 A5 | F#5 - D5 F#5 A5 - B5 . | G#5 - B5 . E6 - D6 B5'
    }
};

/** "D5 - A4 ." → per bar: [{ note, at, len }] in eighth notes. */
export function parseLead(text) {
    return String(text).split('|').map((bar) => {
        const notes = [];
        bar.trim().split(/\s+/).forEach((token, i) => {
            if (token === '-') { if (notes.length) notes[notes.length - 1].len += 1; return; }
            if (token === '.') return;
            notes.push({ note: token, at: i, len: 1 });
        });
        return notes;
    });
}

const LEADS = Object.fromEntries(Object.entries(SONGS).map(([id, song]) => [id, parseLead(song.lead)]));

const up = (note, octaves = 1) => note.replace(/(-?\d+)$/, (m) => String(Number(m) + octaves));

let music = null; // { season, mode, lite, bar, nextAt, timer, song }

function scheduleBar(m, t) {
    const v = bank.get(4);
    const song = m.song;
    const barLen = (60 / song.bpm) * 4;
    const s16 = barLen / 16;
    const chord = song.chords[m.bar % song.chords.length];
    const cycle = Math.floor(m.bar / song.chords.length);
    const mode = m.mode;
    try {
        if (mode === 'calm') {
            v.bass.triggerAttackRelease(chord.bass[0], barLen * 0.9, t, 0.5);
            const step = m.lite ? 4 : 2;
            for (let i = 0; i < 16; i += step) {
                const k = (i / step) % 4;
                v.bell.triggerAttackRelease(chord.arp[k === 3 ? 1 : k], s16 * step * 1.6, t + i * s16, 0.18);
            }
            if (m.bar % 2 === 0) v.bell.triggerAttackRelease(up(chord.arp[2]), barLen * 0.8, t, 0.12);
            return;
        }
        // Bass: driving eighths between the root and the fifth.
        for (let i = 0; i < 8; i++) {
            v.bass.triggerAttackRelease(i % 2 ? chord.bass[1] : chord.bass[0], s16 * 1.6, t + i * 2 * s16, i % 4 === 0 ? 0.8 : 0.6);
        }
        // Drums.
        const kicks = mode === 'triumph' ? [0, 4, 8, 12] : (m.bar % 2 ? [0, 8, 10] : [0, 8]);
        kicks.forEach((s) => v.kick.triggerAttackRelease('C1', 0.2, t + s * s16, 0.85));
        [4, 12].forEach((s) => v.snare.triggerAttackRelease(0.1, t + s * s16, 0.7));
        if (!m.lite) for (let s = 2; s < 16; s += 4) v.hat.triggerAttackRelease(0.03, t + s * s16, 0.5);
        if (m.bar === 0 && cycle === 0) v.cymbal.triggerAttackRelease(1, t, 0.6);
        // Arpeggio (not on the lite tier).
        if (!m.lite) {
            const shape = [0, 1, 2, 1];
            for (let s = 0; s < 16; s++) v.arp.triggerAttackRelease(up(chord.arp[shape[s % 4]]), s16 * 0.8, t + s * s16, 0.45);
        }
        // Lead: every other time round (the arpeggio carries the rest), always once the shield breaks.
        const withLead = mode === 'triumph' || cycle % 2 === 0;
        if (withLead) {
            const lead = LEADS[m.season][m.bar % song.chords.length] || [];
            lead.forEach(({ note, at, len }) => v.lead.triggerAttackRelease(note, s16 * 2 * len * 0.92, t + at * 2 * s16, 0.8));
        } else {
            [0, 8].forEach((s) => v.bell.triggerAttackRelease(up(chord.arp[s ? 1 : 2]), s16 * 6, t + s * s16, 0.2));
        }
        if (mode === 'triumph' && m.bar % 2 === 0) {
            chord.arp.forEach((n, i) => v.bell.triggerAttackRelease(up(n, 2), 0.4, t + i * s16, 0.18));
        }
    } catch (_) { /* a clashing note is skipped; the loop goes on */ }
}

function pump() {
    const m = music;
    if (!m || !Tone) return;
    const now = Tone.now();
    const barLen = (60 / m.song.bpm) * 4;
    if (m.nextAt < now) m.nextAt = now + 0.1; // the tab slept: start again from now
    while (m.nextAt < now + 1.4) {
        scheduleBar(m, m.nextAt);
        m.nextAt += barLen;
        m.bar += 1;
    }
}

/**
 * Starts (or switches) the battle music. `mode` is calm (the week before, or the battle is over) |
 * battle | triumph (the shield is broken). Quietly does nothing while sound is off or not yet allowed.
 */
export async function startRaidMusic(seasonId = 'winter', mode = 'battle', { lite = false } = {}) {
    if (!raidMusicOn() || isCeremonyMuted()) return false;
    const season = SONGS[seasonId] ? seasonId : 'winter';
    if (music && music.season === season) {
        music.mode = mode;
        music.lite = lite;
        return true;
    }
    stopRaidMusic({ fade: 0 });
    const token = {};
    music = { token, season, mode, lite, bar: 0, nextAt: 0, timer: 0, song: SONGS[season] };
    try {
        // Sound can only start after a tap somewhere on the page (browsers block it before).
        if (!isAudioReady() && navigator.userActivation?.hasBeenActive !== false) await ensureAudioReady();
        if (!isAudioReady() || music?.token !== token) return false;
        Tone = Tone || await loadTone();
    } catch (_) {
        return false;
    }
    if (music?.token !== token) return false;
    const v = bank.get(4);
    bank.hold();
    const now = Tone.now();
    v.bus.gain.cancelScheduledValues(now);
    v.bus.gain.setValueAtTime(0.0001, now);
    v.bus.gain.linearRampToValueAtTime(0.75, now + 0.6);
    music.nextAt = now + 0.15;
    pump();
    music.timer = setInterval(pump, 400);
    return true;
}

export function setRaidMusicMode(mode) {
    if (music) music.mode = mode;
}

export function isRaidMusicPlaying() {
    return Boolean(music?.timer);
}

/** Fades the music out (the hall closed, the victory fanfare, or the music button). */
export function stopRaidMusic({ fade = 0.5 } = {}) {
    if (!music) return;
    clearInterval(music.timer);
    music = null;
    if (!Tone || !bank.awake) return;
    const v = bank.get(1);
    const now = Tone.now();
    try {
        v.bus.gain.cancelScheduledValues(now);
        v.bus.gain.setValueAtTime(v.bus.gain.value, now);
        v.bus.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fade));
        v.bus.gain.setValueAtTime(0.75, now + Math.max(0.02, fade) + 1.6);
    } catch (_) { /* gone */ }
    bank.release(2);
}

/**
 * Battle sound effects.
 * 'appear' the boss appears · 'cursor' a class is picked · 'turn' a new turn · 'hit' a class strikes
 * ({ big }) · 'chest' a chest opens ({ step }) · 'shatter' the shield breaks · 'fanfare' victory
 * ({ legendary }) · 'open' a window opens.
 */
export async function playRaidSfx(name, opts = {}) {
    if (isCeremonyMuted() || !isAudioReady()) return;
    try { Tone = Tone || await loadTone(); } catch (_) { return; }
    const v = bank.get(name === 'fanfare' ? 8 : 3);
    const t = Tone.now() + 0.03;
    if (!music) {
        v.bus.gain.cancelScheduledValues(t - 0.03);
        v.bus.gain.setValueAtTime(0.75, t - 0.03);
    }
    try {
        if (name === 'appear') {
            v.swishFilter.frequency.cancelScheduledValues(t);
            v.swishFilter.frequency.setValueAtTime(300, t);
            v.swishFilter.frequency.exponentialRampToValueAtTime(3200, t + 0.5);
            v.swish.triggerAttackRelease(0.5, t, 0.8);
            ['A5', 'F5', 'D5', 'A4', 'F4'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.3, t + i * 0.06, 0.5));
            v.kick.triggerAttackRelease('G1', 0.4, t + 0.42, 1);
            v.brass.triggerAttackRelease(['D3', 'A3', 'D4'], 0.7, t + 0.42, 0.8);
            v.cymbal.triggerAttackRelease(1, t + 0.42, 0.6);
        } else if (name === 'cursor') {
            v.arp.triggerAttackRelease('E6', 0.04, t, 0.6);
        } else if (name === 'open') {
            v.arp.triggerAttackRelease('A5', 0.04, t, 0.5);
            v.arp.triggerAttackRelease('E6', 0.06, t + 0.05, 0.6);
        } else if (name === 'turn') {
            v.snare.triggerAttackRelease(0.1, t, 0.8);
            v.brass.triggerAttackRelease(['D4', 'A4'], 0.16, t, 0.7);
            v.brass.triggerAttackRelease(['E4', 'B4'], 0.3, t + 0.18, 0.8);
        } else if (name === 'hit') {
            v.snare.triggerAttackRelease(0.08, t, 0.95);
            v.kick.triggerAttackRelease('D2', 0.15, t, 0.8);
            v.arp.triggerAttackRelease('A6', 0.03, t, 0.7);
            v.arp.triggerAttackRelease('E6', 0.03, t + 0.035, 0.6);
            v.arp.triggerAttackRelease('A5', 0.05, t + 0.07, 0.5);
            if (opts.big) {
                v.brass.triggerAttackRelease(['A4', 'E5'], 0.18, t + 0.08, 0.8);
                v.bell.triggerAttackRelease(['E6', 'A6'], 0.5, t + 0.1, 0.5);
                v.cymbal.triggerAttackRelease(0.6, t + 0.08, 0.5);
            }
        } else if (name === 'chest') {
            const k = Number(opts.step) || 0;
            ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => v.bell.triggerAttackRelease(up(n, k > 1 ? 1 : 0), 0.35, t + i * 0.055, 0.45));
        } else if (name === 'shatter') {
            v.swishFilter.frequency.cancelScheduledValues(t);
            v.swishFilter.frequency.setValueAtTime(4000, t);
            v.swishFilter.frequency.exponentialRampToValueAtTime(400, t + 0.6);
            v.swish.triggerAttackRelease(0.6, t, 1);
            v.kick.triggerAttackRelease('C1', 0.5, t, 1);
            v.cymbal.triggerAttackRelease(1.4, t, 0.9);
            ['C7', 'G6', 'E6', 'C6', 'G5', 'E5', 'C5'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.4, t + 0.04 + i * 0.05, 0.55));
        } else if (name === 'fanfare') {
            stopRaidMusic({ fade: 0.2 });
            const s = 0.24;
            const phrase = [['G4', 0, 0.2], ['C5', 1, 0.2], ['E5', 2, 0.2], ['G5', 3, 0.42], ['E5', 5, 0.2], ['G5', 6, 0.2], ['C6', 7, 1.3]];
            phrase.forEach(([n, at, len]) => v.lead.triggerAttackRelease(n, len, t + at * s, 0.9));
            phrase.forEach(([n, at, len]) => v.brass.triggerAttackRelease(n, len, t + at * s, 0.7));
            [0, 3, 7].forEach((at) => v.kick.triggerAttackRelease('C1', 0.3, t + at * s, 0.9));
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4'], 1.4, t + 7 * s, 0.8);
            v.cymbal.triggerAttackRelease(1.4, t + 7 * s, 0.7);
            ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + 7 * s + 0.1 + i * 0.07, 0.4));
            if (opts.legendary) {
                const at = t + 7 * s + 1.4;
                v.brass.triggerAttackRelease(['F4', 'A4', 'C5'], 0.4, at, 0.8);
                v.brass.triggerAttackRelease(['G4', 'B4', 'D5'], 0.4, at + 0.45, 0.85);
                v.brass.triggerAttackRelease(['C5', 'E5', 'G5'], 1.6, at + 0.9, 0.9);
                v.lead.triggerAttackRelease('E6', 1.4, at + 0.9, 0.9);
                v.kick.triggerAttackRelease('C1', 0.3, at + 0.9, 1);
                v.cymbal.triggerAttackRelease(1.6, at + 0.9, 0.8);
                ['G6', 'C7', 'E7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, at + 1 + i * 0.08, 0.35));
            }
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}
