import * as state from './state.js';
import { loadTone } from './utils/lazyLibraries.js';

let Tone = null;
let sounds = {};
export let winnerFanfare = {};
export let heroFanfare = {};
let soundsReady = false;
let soundSetupPromise = null;
let audioStartPromise = null;
let lastSoundTime = 0; // Track the time of the last scheduled sound

export async function setupSounds() {
    if (soundSetupPromise) return soundSetupPromise;

    soundSetupPromise = (async () => {
        try {
            Tone = await loadTone();
            // SFX Synths
            const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.3 }).toDestination();
            sounds.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05 } }).toDestination();
            sounds.confirm = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.2 }, volume: -15 }).toDestination();
            sounds.star_remove = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.01, release: 0.3 }, volume: -10 }).toDestination();
            sounds.click.volume.value = -25;

            sounds.writing = new Tone.NoiseSynth({ noise: { type: "white", playbackRate: 0.5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -20 }).toDestination();
            sounds.magic_chime = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 2000, resonance: 0.9, volume: -12 }).connect(reverb);
            sounds.cash = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
            }).toDestination();
            sounds.cash.volume.value = -10;
            sounds.snare = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
            }).toDestination();
            sounds.snare.volume.value = -10;

            sounds.familiar_hatch = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.02, decay: 0.15, sustain: 0.1, release: 0.4 },
                volume: -8
            }).connect(reverb);
            sounds.familiar_levelup = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.6 },
                volume: -10
            }).connect(reverb);

            sounds.star1 = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.7, volume: -10 }).connect(reverb);
            sounds.star2 = new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.8, volume: -8 }).connect(reverb);

            // Quiz of the Week SFX
            sounds.quiz_open = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
                volume: -8
            }).connect(reverb);
            sounds.quiz_question_in = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 3000, resonance: 0.8, volume: -14 }).connect(reverb);
            sounds.quiz_student_reveal = new Tone.PluckSynth({ attackNoise: 0.8, dampening: 2500, resonance: 0.9, volume: -10 }).connect(reverb);
            sounds.quiz_correct = new Tone.FMSynth({
                harmonicity: 2.5,
                modulationIndex: 8,
                detune: 0,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 0.5 },
                modulation: { type: 'triangle' },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
                volume: -6
            }).connect(reverb);
            sounds.quiz_wrong = new Tone.Synth({
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.2 },
                volume: -12
            }).toDestination();
            sounds.quiz_tier_reveal = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 },
                volume: -6
            }).connect(reverb);
            sounds.quiz_confetti_pop = new Tone.PluckSynth({ attackNoise: 1, dampening: 3500, resonance: 0.75, volume: -10 }).connect(reverb);

            sounds.ceremony_gling = new Tone.PluckSynth({
                attackNoise: 0.15,
                dampening: 6200,
                resonance: 0.94,
                volume: -24
            }).connect(reverb);

            sounds.star3 = new Tone.FMSynth({
                harmonicity: 3,
                modulationIndex: 10,
                detune: 0,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.4 },
                volume: -5
            }).connect(reverb);

            // Award Stars: a bell choir that grows with the award (spark, shine, supernova),
            // a sparkle wash, a soft low swell for three stars, and one chime per virtue.
            sounds.award_bell = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3.01,
                modulationIndex: 7,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.9 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 },
                volume: -15
            }).connect(reverb);
            sounds.award_bell.maxPolyphony = 12;
            const awardSparkleFilter = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(reverb);
            sounds.award_sparkle = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.02, decay: 0.45, sustain: 0, release: 0.2 },
                volume: -24
            }).connect(awardSparkleFilter);
            sounds.award_swell = new Tone.MembraneSynth({
                pitchDecay: 0.08,
                octaves: 4,
                envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
                volume: -13
            }).toDestination();
            sounds.award_pad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.04, decay: 0.5, sustain: 0.25, release: 1.1 },
                volume: -20
            }).connect(reverb);

            winnerFanfare = new Tone.Player({
                url: "assets/ceremony_winner.mp3",
                volume: -3,
                onload: () => {},
                onerror: (e) => console.warn("Winner Fanfare failed to load", e)
            }).toDestination();

            heroFanfare = new Tone.Player({
                url: "assets/hero_fanfare.mp3",
                volume: -2,
                onload: () => {},
                onerror: (e) => console.warn("Hero Fanfare failed to load", e)
            }).toDestination();

            soundsReady = true;

            Tone.loaded()
                .then(() => {})
                .catch((e) => console.warn('Some audio buffers failed to load:', e));
        } catch (e) {
            console.error('Failed to initialize sounds:', e);
            soundsReady = false;
            soundSetupPromise = null;
        }
    })();

    return soundSetupPromise;
}

export function playSound(sound) {
    if (!soundsReady || Tone.context.state !== 'running') return;
    const composedAward = typeof sound === 'string' && (sound.startsWith('award_') || sound.startsWith('virtue_')) && sounds.award_bell;
    if (!sounds[sound] && !composedAward) return;
    
    // 1. Get current audio context time
    const now = Tone.now();
    
    // 2. Schedule strictly in the future
    // If the last sound is still playing (in the future), schedule this one 0.1s after it.
    // If the timeline is clear, schedule it "now + buffer".
    let playTime = Math.max(now + 0.05, lastSoundTime + 0.1);
    
    // 3. Update tracker
    const maxLead = sound === 'click' ? 0.12 : 0.35;
    playTime = Math.min(playTime, now + maxLead);
    lastSoundTime = playTime;

    try {
        if (sound === 'click') sounds.click.triggerAttackRelease('C5', '8n', playTime);
        else if (sound === 'star1') sounds.star1.triggerAttackRelease('C6', '16n', playTime);
        else if (sound === 'star2') {
            sounds.star2.triggerAttackRelease('E6', '16n', playTime);
            sounds.star2.triggerAttackRelease('G6', '16n', playTime + 0.05);
        } else if (sound === 'star3') {
            sounds.star3.triggerAttackRelease('C6', '16n', playTime);
            sounds.star3.triggerAttackRelease('E5', '16n', playTime + 0.05);
            sounds.star3.triggerAttackRelease('G5', '16n', playTime + 0.1);
            sounds.star3.triggerAttackRelease('C7', '16n', playTime + 0.15);
        } else if (sound === 'award_1') {
            sounds.award_bell.triggerAttackRelease('E6', '16n', playTime);
            sounds.award_bell.triggerAttackRelease('B6', '32n', playTime + 0.08, 0.5);
            sounds.award_sparkle.triggerAttackRelease('16n', playTime + 0.02);
            sounds.award_bell.triggerAttackRelease('E7', '32n', playTime + 0.8, 0.35);
        } else if (sound === 'award_2') {
            ['C6', 'E6', 'G6'].forEach((note, i) => sounds.award_bell.triggerAttackRelease(note, '16n', playTime + i * 0.075, 0.8));
            sounds.award_bell.triggerAttackRelease(['C7', 'E7'], '8n', playTime + 0.24, 0.6);
            sounds.award_sparkle.triggerAttackRelease('8n', playTime + 0.05);
            sounds.award_bell.triggerAttackRelease('G7', '32n', playTime + 0.8, 0.3);
            sounds.award_bell.triggerAttackRelease('C7', '32n', playTime + 0.92, 0.3);
        } else if (sound === 'award_3') {
            sounds.award_swell.triggerAttackRelease('C2', '8n', playTime);
            ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((note, i) => sounds.award_bell.triggerAttackRelease(note, '16n', playTime + 0.03 + i * 0.05, 0.75));
            sounds.award_pad.triggerAttackRelease(['C5', 'G5', 'E6'], '2n', playTime + 0.3);
            sounds.award_bell.triggerAttackRelease(['C6', 'E6', 'G6', 'C7'], '4n', playTime + 0.36, 0.9);
            sounds.award_sparkle.triggerAttackRelease('4n', playTime + 0.3);
            sounds.star3.triggerAttackRelease('C7', '32n', playTime + 0.55);
            ['G7', 'E7', 'C8'].forEach((note, i) => sounds.award_bell.triggerAttackRelease(note, '32n', playTime + 0.8 + i * 0.12, 0.3));
        } else if (sound === 'award_undo') {
            sounds.award_bell.triggerAttackRelease('G5', '32n', playTime, 0.45);
            sounds.award_bell.triggerAttackRelease('C5', '16n', playTime + 0.09, 0.4);
            sounds.star_remove.triggerAttackRelease('16n', playTime);
        } else if (sound.startsWith('virtue_')) {
            const note = { virtue_teamwork: 'G5', virtue_creativity: 'A5', virtue_respect: 'E5', virtue_focus: 'C6' }[sound] || 'D6';
            sounds.award_bell.triggerAttackRelease(note, '32n', playTime, 0.45);
        } else if (sound === 'star_remove') sounds.star_remove.triggerAttackRelease('8n', playTime);
        else if (sound === 'confirm') sounds.confirm.triggerAttackRelease('E4', '8n', playTime);
        else if (sound === 'writing') sounds.writing.triggerAttackRelease('4n', playTime);
        else if (sound === 'magic_chime') sounds.magic_chime.triggerAttackRelease('C7', '8n', playTime);
        else if (sound === 'cash') {
            sounds.cash.triggerAttackRelease(["B5", "E6"], "16n", playTime);
            sounds.cash.triggerAttackRelease(["C6", "G6"], "16n", playTime + 0.05);
        }
        else if (sound === 'familiar_hatch') {
            sounds.familiar_hatch.triggerAttackRelease(['C5', 'E5'], '8n', playTime);
            sounds.familiar_hatch.triggerAttackRelease(['G5', 'C6'], '8n', playTime + 0.12);
            sounds.familiar_hatch.triggerAttackRelease(['E6', 'G6', 'C7'], '4n', playTime + 0.25);
        }
        else if (sound === 'familiar_levelup') {
            sounds.familiar_levelup.triggerAttackRelease(['C5', 'E5', 'G5'], '8n', playTime);
            sounds.familiar_levelup.triggerAttackRelease(['F5', 'A5', 'C6'], '8n', playTime + 0.15);
            sounds.familiar_levelup.triggerAttackRelease(['G5', 'B5', 'D6', 'G6'], '4n', playTime + 0.3);
        }
        else if (sound === 'quiz_open') {
            sounds.quiz_open.triggerAttackRelease(['C5', 'E5'], '16n', playTime);
            sounds.quiz_open.triggerAttackRelease(['G5', 'C6'], '16n', playTime + 0.08);
            sounds.quiz_open.triggerAttackRelease(['E6', 'G6'], '8n', playTime + 0.18);
        }
        else if (sound === 'quiz_question_in') {
            sounds.quiz_question_in.triggerAttackRelease('G5', '16n', playTime);
        }
        else if (sound === 'quiz_student_reveal') {
            sounds.quiz_student_reveal.triggerAttackRelease('E6', '16n', playTime);
        }
        else if (sound === 'quiz_correct') {
            sounds.quiz_correct.triggerAttackRelease('C5', '16n', playTime);
            sounds.quiz_correct.triggerAttackRelease('E5', '16n', playTime + 0.05);
            sounds.quiz_correct.triggerAttackRelease('G5', '16n', playTime + 0.1);
            sounds.quiz_correct.triggerAttackRelease('C6', '8n', playTime + 0.18);
        }
        else if (sound === 'quiz_wrong') {
            sounds.quiz_wrong.triggerAttackRelease('G3', '16n', playTime);
        }
        else if (sound === 'quiz_tier_reveal') {
            sounds.quiz_tier_reveal.triggerAttackRelease(['C4', 'E4'], '16n', playTime);
            sounds.quiz_tier_reveal.triggerAttackRelease(['G4', 'C5'], '16n', playTime + 0.12);
            sounds.quiz_tier_reveal.triggerAttackRelease(['E5', 'G5', 'C6'], '4n', playTime + 0.28);
        }
        else if (sound === 'quiz_confetti_pop') {
            sounds.quiz_confetti_pop.triggerAttackRelease('C6', '32n', playTime);
            sounds.quiz_confetti_pop.triggerAttackRelease('E6', '32n', playTime + 0.04);
            sounds.quiz_confetti_pop.triggerAttackRelease('G6', '32n', playTime + 0.08);
        }
        else if (sound === 'ceremony_gling') {
            sounds.ceremony_gling.triggerAttackRelease('G6', '64n', playTime);
        }

        // Custom Fanfare Logic (if you added it previously)
        else if (sound === 'hero_fanfare' && sounds.star3) {
             // ... existing synth logic ...
             // Ensure you pass `playTime` instead of `Tone.now()` to the triggers here too
        }
        
    } catch (e) { 
        // Suppress overlapping errors silently now that we have a queue
        // console.error('Audio ignored:', e); 
    }
}

export async function activateAudioContext() {
    try {
        Tone = Tone || await loadTone();
    } catch (error) {
        console.error('Failed to load audio library:', error);
        return false;
    }
    if (Tone.context.state === 'running') return Promise.resolve(true);
    if (audioStartPromise) return audioStartPromise;

    audioStartPromise = Tone.start()
        .then(() => {
            audioStartPromise = null;
            return true;
        })
        .catch(e => {
            console.error('Failed to resume audio context:', e);
            audioStartPromise = null;
            return false;
        });

    return audioStartPromise;
}

export async function ensureAudioReady() {
    const started = await activateAudioContext();
    if (!started) return false;
    await setupSounds();
    return soundsReady && Tone?.context?.state === 'running';
}

export function isAudioReady() {
    return soundsReady && Tone?.context?.state === 'running';
}

let ceremonyMuted = false;

export function isCeremonyMuted() {
    return ceremonyMuted;
}

export function setCeremonyMuted(muted) {
    ceremonyMuted = Boolean(muted);
    if (ceremonyMuted) {
        stopAllCeremonyAudio();
    }
}

export function toggleCeremonyMute() {
    setCeremonyMuted(!ceremonyMuted);
    return ceremonyMuted;
}

export function stopAllCeremonyAudio() {
    if (soundsReady) {
        try {
            if (winnerFanfare.state === "started") winnerFanfare.stop();
        } catch (_) { /* Already stopped or not initialized. */ }
    }
}

export function playWinnerFanfare() {
    if (ceremonyMuted) return;
    if (soundsReady && winnerFanfare.loaded) {
        winnerFanfare.start();
    }
}

let drumRollLoop;
export function playDrumRoll() {
    if (ceremonyMuted || !soundsReady) return;
    // Play a snare hit every 16th note (fast)
    drumRollLoop = new Tone.Loop(time => {
        sounds.snare.triggerAttackRelease("8n", time);
    }, "16n").start(0);
    Tone.Transport.start();
}

export function stopDrumRoll() {
    if (drumRollLoop) {
        drumRollLoop.dispose();
        drumRollLoop = null;
        Tone.Transport.stop();
    }
}

// ── Hero of the Day ──────────────────────────────────────────────
// Every voice is synthesised (no files) and built once, on first use.
// The draw and the crowning each have their own bus, so a skipped draw or a
// closed reveal can fade out what is still scheduled without touching the rest.
let heroVoices = null;
function getHeroVoices() {
    if (heroVoices || !Tone) return heroVoices;
    const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.3 }).toDestination();
    const bus = new Tone.Gain(1).connect(reverb);
    const drawBus = new Tone.Gain(1).connect(reverb);
    const quillFilter = new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 1.4 }).connect(bus);
    const quill = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.03 },
        volume: -24
    }).connect(quillFilter);
    const harp = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 },
        volume: -13
    }).connect(drawBus);
    harp.maxPolyphony = 16;
    const roll = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 2.2,
        envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
        volume: -11
    }).connect(drawBus);
    // The held breath before the crown: a dominant string swell and a rising hiss.
    const tensionFilter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 1.2 }).connect(drawBus);
    const tension = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
        envelope: { attack: 1.2, decay: 0.1, sustain: 1, release: 0.25 },
        volume: -22
    }).connect(tensionFilter);
    tension.maxPolyphony = 8;
    const riserFilter = new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 0.9 }).connect(drawBus);
    const riser = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 1, decay: 0.05, sustain: 1, release: 0.06 },
        volume: -24
    }).connect(riserFilter);
    const heartbeat = new Tone.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 3,
        envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.2 },
        volume: -6
    }).connect(drawBus);
    const timpani = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 2.2,
        envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.3 },
        volume: -9
    }).connect(bus);
    const sub = new Tone.MembraneSynth({
        pitchDecay: 0.12,
        octaves: 4,
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.6 },
        volume: -4
    }).connect(bus);
    const brassFilter = new Tone.Filter({ type: 'lowpass', frequency: 2300, Q: 0.8 }).connect(bus);
    const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.75, release: 0.6 },
        volume: -17
    }).connect(brassFilter);
    brass.maxPolyphony = 28;
    // A choir-like "aah" under the fanfare: slow sawtooth pad through a vowel-ish band.
    const choirFilter = new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.7 }).connect(bus);
    const choir = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
        envelope: { attack: 0.35, decay: 0.3, sustain: 0.85, release: 1.6 },
        volume: -21
    }).connect(choirFilter);
    choir.maxPolyphony = 20;
    const cymbalFilter = new Tone.Filter({ type: 'highpass', frequency: 4200 }).connect(bus);
    const cymbal = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.003, decay: 3, sustain: 0, release: 0.5 },
        volume: -22
    }).connect(cymbalFilter);
    const bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 6,
        envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 1.1 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
        volume: -19
    }).connect(bus);
    bell.maxPolyphony = 32;
    // The anthem's band: a singing lead with a little vibrato, a round bass and a march snare.
    const leadFilter = new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 0.6 }).connect(bus);
    const leadVibrato = new Tone.Vibrato({ frequency: 5.2, depth: 0.08 }).connect(leadFilter);
    const lead = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 12 },
        envelope: { attack: 0.025, decay: 0.15, sustain: 0.8, release: 0.35 },
        volume: -15
    }).connect(leadVibrato);
    lead.maxPolyphony = 10;
    const bassFilter = new Tone.Filter({ type: 'lowpass', frequency: 650, Q: 1 }).connect(bus);
    const bass = new Tone.Synth({
        oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.2 },
        volume: -10
    }).connect(bassFilter);
    const snareFilter = new Tone.Filter({ type: 'highpass', frequency: 1600 }).connect(bus);
    const snare = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 0.13, sustain: 0, release: 0.05 },
        volume: -19
    }).connect(snareFilter);
    heroVoices = {
        bus, drawBus, quill, quillFilter, harp, roll, tension, tensionFilter, riser, riserFilter,
        heartbeat, timpani, sub, brass, choir, cymbal, bell, lead, bass, snare
    };
    return heroVoices;
}

function heroBusUp(busName = 'bus') {
    const v = getHeroVoices();
    if (!v) return null;
    const gain = v[busName].gain;
    gain.cancelScheduledValues(Tone.now());
    gain.setValueAtTime(1, Tone.now());
    return v;
}

function fadeHeroBus(busName) {
    const gain = heroVoices?.[busName]?.gain;
    if (!gain) return;
    const now = Tone.now();
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.2);
    if (busName === 'drawBus') {
        // Held voices would otherwise sustain under the next draw.
        heroVoices.tension.releaseAll(now + 0.2);
        heroVoices.riser.triggerRelease(now + 0.2);
    }
}

/** Soft quill scratches while the Chronicler writes the page and picks the hero. */
let writingLoop;
export function playWritingLoop() {
    if (!soundsReady) return;
    const v = heroBusUp();
    if (!v) return;
    stopWritingLoop();
    writingLoop = new Tone.Loop(time => {
        v.quillFilter.frequency.setValueAtTime(2600 + Math.random() * 1400, time);
        v.quill.triggerAttackRelease(0.03 + Math.random() * 0.05, time);
    }, '16n');
    writingLoop.probability = 0.55;
    writingLoop.humanize = 0.02;
    writingLoop.start(0);
    Tone.Transport.start();
}

export function stopWritingLoop() {
    if (writingLoop) {
        writingLoop.dispose();
        writingLoop = null;
        if (!drumRollLoop) {
            Tone.Transport.stop();
        }
    }
}

const HERO_DRAW_LADDER = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5'];

/**
 * The drawing of lots: a harp note for every hop of the glint (climbing a
 * D-major pentatonic ladder) over a timpani roll that swells to the landing.
 * Then the hush: the roll thins to a heartbeat while a dominant string chord
 * and a rising hiss climb until the crown comes down.
 * @param {number[]} hopTimes seconds from now, one per hop; the last is the landing.
 * @param {number} hushSeconds the held breath between the landing and the crowning.
 */
export function playHeroDrawSound(hopTimes = [], hushSeconds = 0) {
    if (ceremonyMuted || !isAudioReady() || !hopTimes.length) return;
    const v = heroBusUp('drawBus');
    if (!v) return;
    const now = Tone.now() + 0.02;
    const end = hopTimes[hopTimes.length - 1];
    hopTimes.forEach((t, i) => {
        const note = HERO_DRAW_LADDER[i % HERO_DRAW_LADDER.length];
        v.harp.triggerAttackRelease(note, 0.18, now + t, 0.55 + 0.4 * (t / (end || 1)));
    });
    // Timpani roll: quiet and sparse at first, then dense and loud before the landing.
    for (let t = 0, step = 0.11; t < end - 0.05; t += step) {
        const k = t / end;
        v.roll.triggerAttackRelease('D2', 0.08, now + t, 0.12 + 0.6 * k * k);
        step = Math.max(0.05, 0.11 - 0.07 * k);
    }
    // Low strings creep in under the last stretch of the draw.
    const swellAt = now + end * 0.55;
    v.tensionFilter.frequency.cancelScheduledValues(now);
    v.tensionFilter.frequency.setValueAtTime(380, now);
    v.tensionFilter.frequency.setValueAtTime(380, swellAt);
    v.tensionFilter.frequency.exponentialRampToValueAtTime(900, now + end);
    v.tension.triggerAttack(['D2', 'A2', 'D3'], swellAt, 0.5);

    // The landing: one bright strike, then everything holds its breath.
    v.harp.triggerAttackRelease(['D5', 'A5', 'D6'], 0.5, now + end, 0.85);
    v.roll.triggerAttackRelease('A1', 0.3, now + end, 0.9);
    if (hushSeconds <= 0) {
        v.tension.releaseAll(now + end + 0.3);
        return;
    }
    const hushEnd = now + end + hushSeconds;
    // Strings move to the dominant (A7) and open up: the chord that begs for the crown.
    v.tension.releaseAll(now + end + 0.02);
    v.tension.triggerAttack(['A1', 'E2', 'A2', 'C#3', 'G3'], now + end + 0.04, 0.75);
    v.tensionFilter.frequency.setValueAtTime(700, now + end + 0.04);
    v.tensionFilter.frequency.exponentialRampToValueAtTime(3600, hushEnd);
    v.tension.releaseAll(hushEnd);
    // Heartbeat: lub-dub, faster and louder as the hush runs out.
    for (let t = end + 0.3, gap = 0.5; t < end + hushSeconds - 0.2; t += gap) {
        const k = (t - end) / hushSeconds;
        v.heartbeat.triggerAttackRelease('D1', 0.2, now + t, 0.55 + 0.4 * k);
        v.heartbeat.triggerAttackRelease('D1', 0.15, now + t + 0.14, 0.35 + 0.3 * k);
        gap = Math.max(0.32, gap - 0.06);
    }
    // A snare-tight roll in the final stretch, piling into the crown.
    const rollFrom = end + hushSeconds * 0.45;
    for (let t = rollFrom; t < end + hushSeconds - 0.03; t += 0.045) {
        const k = (t - rollFrom) / (hushSeconds * 0.55);
        v.roll.triggerAttackRelease('A2', 0.05, now + t, 0.15 + 0.8 * k * k);
    }
    // Rising hiss (a reversed cymbal) that peaks exactly as the crown lands.
    v.riser.envelope.attack = Math.max(0.2, hushSeconds - 0.05);
    v.riserFilter.frequency.cancelScheduledValues(now);
    v.riserFilter.frequency.setValueAtTime(500, now + end);
    v.riserFilter.frequency.exponentialRampToValueAtTime(7000, hushEnd);
    v.riser.triggerAttack(now + end + 0.05, 0.9);
    v.riser.triggerRelease(hushEnd);
}

/** Build the reveal voices ahead of time so the reverb is ready when the draw starts. */
export function primeHeroRevealSound() {
    if (soundsReady && Tone) getHeroVoices();
}

/** Cut the draw short (the teacher tapped to reveal now). */
export function stopHeroDrawSound() {
    fadeHeroBus('drawBus');
}

/**
 * "The Hero's March": the music that bursts in the moment the hero is revealed.
 * One bar of impact and herald call, four bars of a singing D-major theme over a
 * march band (oom-pah brass, snare, timpani, choir, glockenspiel), then a final
 * chord that rings out. Bars are HERO_ANTHEM_BAR seconds long so the reveal's
 * visuals can pulse in time with it.
 */
export const HERO_ANTHEM_BPM = 126;
export const HERO_ANTHEM_BAR = (60 / HERO_ANTHEM_BPM) * 4;
export const HERO_ANTHEM_FINAL_BAR = 5;

// [beat within the piece, note, length in beats]; bar 1 starts at beat 4.
const HERO_ANTHEM_MELODY = [
    [3, 'A4', 0.3], [3.333, 'A4', 0.3], [3.667, 'A4', 0.3],
    [4, 'D5', 1.5], [5.5, 'A4', 0.5], [6, 'D5', 0.5], [6.5, 'E5', 0.5], [7, 'F#5', 1],
    [8, 'G5', 1.5], [9.5, 'F#5', 0.5], [10, 'E5', 1], [11, 'A4', 1],
    [12, 'F#5', 1.5], [13.5, 'E5', 0.5], [14, 'D5', 1], [15, 'B4', 1],
    [16, 'E5', 1], [17, 'F#5', 0.5], [17.5, 'G5', 0.5], [18, 'A5', 1], [19, 'C#6', 1],
    [20, 'D6', 3.5]
];
// One chord per half bar through the theme: [chord tones, bass root].
const HERO_ANTHEM_CHORDS = [
    [['D4', 'F#4', 'A4'], 'D2'], [['D4', 'F#4', 'A4'], 'A1'],
    [['D4', 'G4', 'B4'], 'G1'], [['C#4', 'E4', 'A4'], 'A1'],
    [['D4', 'F#4', 'B4'], 'B1'], [['D4', 'G4', 'B4'], 'G1'],
    [['E4', 'G4', 'B4'], 'E2'], [['C#4', 'E4', 'G4', 'A4'], 'A1']
];

let heroAnthemEndsAt = 0;

/** Rebuild the reveal voices, dropping anything still scheduled on them. */
function resetHeroVoices() {
    if (!heroVoices) return;
    Object.values(heroVoices).forEach(node => {
        try { node.dispose?.(); } catch (_) { /* already disposed */ }
    });
    heroVoices = null;
}

export function playHeroCrowningSound() {
    if (ceremonyMuted || !isAudioReady()) return;
    // A second crowning while the last anthem is still scheduled would collide on
    // the one-voice synths, so start from fresh voices in that rare case.
    if (heroVoices && Tone.now() < heroAnthemEndsAt) resetHeroVoices();
    const v = heroBusUp();
    if (!v) return;
    try {
        scheduleHeroAnthem(v);
    } catch (error) {
        console.warn('Hero anthem could not be scheduled:', error);
    }
}

function scheduleHeroAnthem(v) {
    const t0 = Tone.now() + 0.03;
    const beat = 60 / HERO_ANTHEM_BPM;
    const at = b => t0 + b * beat;
    const up = (note, n) => Tone.Frequency(note).transpose(n).toNote();

    // Bar 0, the moment of the reveal: a ground-shaking boom, a blazing chord and bells.
    v.sub.triggerAttackRelease('D1', 1.2, t0, 1);
    v.timpani.triggerAttackRelease('D2', 0.6, t0, 1);
    v.cymbal.triggerAttackRelease(2.6, t0, 1);
    v.brass.triggerAttackRelease(['D3', 'A3', 'D4', 'F#4', 'A4'], beat * 2.5, t0, 0.95);
    v.choir.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], beat * 3, t0, 0.7);
    ['A5', 'D6', 'F#6', 'A6', 'D7'].forEach((note, i) => v.bell.triggerAttackRelease(note, 0.9, t0 + 0.05 + i * 0.06, 0.55));
    // A snare build under the herald's pickup.
    for (let b = 2, i = 0; b < 4; b += 0.25, i++) v.snare.triggerAttackRelease(0.05, at(b), 0.25 + i * 0.07);

    // The theme: lead brass with a glockenspiel an octave above.
    HERO_ANTHEM_MELODY.forEach(([b, note, len]) => {
        const dur = Math.max(0.12, len * beat * 0.92);
        v.lead.triggerAttackRelease(b < 4 ? [note, up(note, 7)] : [note, up(note, -12)], dur, at(b), b >= 20 ? 1 : 0.85);
        if (b >= 4) v.bell.triggerAttackRelease(up(note, 12), Math.min(dur, 0.6), at(b), 0.32);
    });

    // The march band, bars 1 to 4.
    HERO_ANTHEM_CHORDS.forEach(([chord, root], half) => {
        const hb = 4 + half * 2;
        // Oom on the strong beat, pah on the off beat.
        v.bass.triggerAttackRelease(root, beat * 0.8, at(hb), 0.9);
        v.brass.triggerAttackRelease(chord, beat * 0.35, at(hb + 1), 0.45);
        v.choir.triggerAttackRelease(chord, beat * 1.9, at(hb), 0.5);
        v.timpani.triggerAttackRelease(root, 0.3, at(hb), 0.6);
        // (The last half bar's snare is the roll below; one-voice synths must be scheduled in order.)
        if (half < HERO_ANTHEM_CHORDS.length - 1) {
            v.snare.triggerAttackRelease(0.06, at(hb + 1), 0.55);
            v.snare.triggerAttackRelease(0.04, at(hb + 1.5), 0.25);
        }
        // Glockenspiel sparkle: the chord broken upwards in eighths.
        chord.slice(0, 4).forEach((n, i) => v.bell.triggerAttackRelease(up(n, 24), 0.3, at(hb + i * 0.5), 0.14));
    });
    v.cymbal.triggerAttackRelease(1.8, at(4), 0.7);
    v.cymbal.triggerAttackRelease(1.4, at(12), 0.55);
    // A snare and timpani roll that pours into the last chord.
    for (let b = 18, i = 0; b < 20; b += 0.125, i++) {
        v.snare.triggerAttackRelease(0.04, at(b), 0.2 + i * 0.045);
        if (i > 0 && i % 2 === 0) v.timpani.triggerAttackRelease(i % 4 ? 'A1' : 'D2', 0.12, at(b), 0.3 + i * 0.035);
    }

    // The final chord (bar 5): everything at once, then the bells cascade down.
    const fin = at(HERO_ANTHEM_FINAL_BAR * 4);
    heroAnthemEndsAt = fin + 3.5;
    v.sub.triggerAttackRelease('D1', 1.6, fin, 0.95);
    v.timpani.triggerAttackRelease('D2', 0.9, fin, 1);
    v.cymbal.triggerAttackRelease(3.2, fin, 1);
    v.bass.triggerAttackRelease('D2', 2.4, fin, 1);
    v.brass.triggerAttackRelease(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 2.6, fin, 0.95);
    v.choir.triggerAttackRelease(['A3', 'D4', 'F#4', 'A4', 'D5', 'F#5'], 3.4, fin, 0.8);
    ['D7', 'A6', 'F#6', 'D6', 'A5', 'F#6', 'A6', 'D7'].forEach((note, i) =>
        v.bell.triggerAttackRelease(note, 1.1, fin + 0.1 + i * 0.09, 0.55 - i * 0.03));
}

/** Fade out whatever the Hero of the Day reveal still has scheduled. */
export function stopHeroRevealSound() {
    if (!heroVoices || !Tone) return;
    fadeHeroBus('drawBus');
    fadeHeroBus('bus');
}

export function playHeroFanfare() {
    if (ceremonyMuted) return;
    if (soundsReady && heroFanfare.loaded) {
        heroFanfare.start();
    }
}

// ── Fortune's Wheel moments ──────────────────────────────────────
// Synthesised on first use: thunder for storms, a shield chime, a whoosh for the
// Whirlwind, the Trickster's "wah-wah", a coin ring and a creaking chest.
let wheelVoices = null;
function getWheelVoices() {
    if (wheelVoices || !Tone) return wheelVoices;
    const out = new Tone.Gain(0.9).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.28 }).connect(out);
    const rumbleFilter = new Tone.Filter({ type: 'lowpass', frequency: 260, Q: 0.7 }).connect(out);
    const rumble = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.03, decay: 1.6, sustain: 0, release: 0.8 }, volume: -2 }).connect(rumbleFilter);
    const crack = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }, volume: -12 }).connect(reverb);
    const whooshFilter = new Tone.AutoFilter({ frequency: 2.2, baseFrequency: 300, octaves: 4 }).connect(reverb).start();
    const whoosh = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.25, decay: 0.6, sustain: 0.2, release: 0.6 }, volume: -10 }).connect(whooshFilter);
    const bell = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.003, decay: 0.5, sustain: 0, release: 0.6 }, volume: -10 }).connect(reverb);
    const horn = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.25 }, volume: -16 });
    const hornFilter = new Tone.Filter({ type: 'lowpass', frequency: 1100 }).connect(out);
    horn.connect(hornFilter);
    const knock = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }, volume: -8 }).connect(out);
    wheelVoices = { rumble, crack, whoosh, bell, horn, knock };
    return wheelVoices;
}

/** Fortune's Wheel sound effects: 'thunder' | 'shield' | 'whoosh' | 'trickster' | 'coin' | 'chest' | 'tick_heavy' | 'buzzer'. */
/** Builds the Wheel's voices ahead of time (the reverb takes a moment), so the first thunder doesn't stall a frame. */
export function warmWheelAudio() {
    if (!soundsReady || !Tone || Tone.context.state !== 'running') return;
    getWheelVoices();
}

export function playWheelSfx(name) {
    if (!soundsReady || !Tone || Tone.context.state !== 'running') return;
    const v = getWheelVoices();
    if (!v) return;
    const t = Tone.now() + 0.03;
    try {
        if (name === 'thunder') {
            v.crack.triggerAttackRelease(0.15, t);
            v.rumble.triggerAttackRelease(1.8, t + 0.05);
        } else if (name === 'shield') {
            ['C5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + i * 0.06, 0.7));
        } else if (name === 'whoosh') {
            v.whoosh.triggerAttackRelease(1.2, t);
        } else if (name === 'trickster') {
            ['G3', 'F#3', 'F3'].forEach((n, i) => v.horn.triggerAttackRelease(n, 0.32, t + i * 0.36));
            v.horn.triggerAttackRelease('E3', 0.9, t + 1.08);
        } else if (name === 'coin') {
            v.bell.triggerAttackRelease(['E6', 'B6'], 0.4, t, 0.6);
        } else if (name === 'chest') {
            v.knock.triggerAttackRelease('G2', 0.2, t);
            v.bell.triggerAttackRelease(['C6', 'E6', 'G6', 'C7'], 0.8, t + 0.15, 0.55);
        } else if (name === 'tick_heavy') {
            v.knock.triggerAttackRelease('C3', 0.1, t);
        } else if (name === 'buzzer') {
            v.horn.triggerAttackRelease('C3', 0.5, t);
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}

// ─── Familiar voices ──────────────────────────────────────────────────────────
// One voice per class (see familiarVoice() in features/familiarForge.mjs), pitched per familiar.
let familiarVoices = null;

function getFamiliarVoices() {
    if (familiarVoices || !Tone) return familiarVoices;
    const out = new Tone.Gain(0.8).toDestination();
    const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.25 }).connect(out);
    const lead = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0.5, release: 0.18 }, volume: -10 }).connect(reverb);
    const growlFilter = new Tone.Filter({ type: 'lowpass', frequency: 1500, Q: 2 }).connect(reverb);
    const growl = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.15 }, volume: -16 }).connect(growlFilter);
    const croakFilter = new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 4 }).connect(reverb);
    const croak = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.05 }, volume: -16 }).connect(croakFilter);
    const puffFilter = new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.8 }).connect(reverb);
    const puff = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.1 }, volume: -14 }).connect(puffFilter);
    const bell = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 }, volume: -14 }).connect(reverb);
    familiarVoices = { lead, growl, croak, puff, bell };
    return familiarVoices;
}

function glide(synth, t, points, end) {
    synth.triggerAttack(points[0][1], t);
    for (const [at, freq] of points.slice(1)) synth.frequency.exponentialRampToValueAtTime(freq, t + at);
    synth.triggerRelease(t + end);
}

/** A familiar's call: { kind: 'chirr' | 'yip' | 'croak' | 'hum' | 'trill', pitch, shiny }. */
export function playFamiliarVoice(voice = {}) {
    if (!soundsReady || !Tone || Tone.context.state !== 'running') return;
    const v = getFamiliarVoices();
    if (!v) return;
    const p = Math.max(0.5, Math.min(1.6, Number(voice.pitch) || 1));
    const t = Tone.now() + 0.03;
    try {
        if (voice.kind === 'chirr') {
            glide(v.growl, t, [[0, 260 * p], [0.08, 420 * p], [0.32, 210 * p]], 0.34);
            v.puff.triggerAttackRelease(0.22, t + 0.3);
        } else if (voice.kind === 'yip') {
            glide(v.lead, t, [[0, 780 * p], [0.05, 1150 * p], [0.13, 820 * p]], 0.14);
            glide(v.lead, t + 0.2, [[0, 820 * p], [0.05, 1250 * p], [0.15, 880 * p]], 0.16);
            v.bell.triggerAttackRelease([2637 * p, 3136 * p], 0.3, t + 0.38, 0.4);
        } else if (voice.kind === 'croak') {
            [0, 0.1, 0.2].forEach((dt, i) => glide(v.croak, t + dt, [[0, (170 - i * 12) * p], [0.07, (120 - i * 8) * p]], 0.075));
        } else if (voice.kind === 'hum') {
            glide(v.lead, t, [[0, 330 * p], [0.25, 495 * p], [0.6, 392 * p]], 0.62);
            v.puff.triggerAttackRelease(0.5, t + 0.05);
        } else {
            [1047, 1319, 1568, 2093, 1568, 2637].forEach((freq, i) => v.bell.triggerAttackRelease(freq * p, 0.12, t + i * 0.055, 0.6));
        }
        if (voice.shiny) [2093, 2637, 3136, 4186].forEach((freq, i) => v.bell.triggerAttackRelease(freq, 0.3, t + 0.45 + i * 0.07, 0.35));
    } catch (_) { /* overlapping triggers are harmless */ }
}

// ─── Quiz of the Week show ────────────────────────────────────────────────────
// A small game-show band, synthesised on first use (no files): a wood-block tick
// and snare for the spotlight roulette, a "ta-daa" when it lands, a buzzer, a
// gentle "wah-wah" for a missed question, whooshes, and a drum roll before the
// curtain call. Everything runs through one bus so closing the stage can fade it.
let quizVoices = null;
function getQuizVoices() {
    if (quizVoices || !Tone) return quizVoices;
    const bus = new Tone.Gain(0.9).toDestination();
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.24 }).connect(bus);
    const block = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 1.4,
        envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
        volume: -12
    }).connect(bus);
    const mallet = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.2 },
        volume: -9
    }).connect(reverb);
    mallet.maxPolyphony = 12;
    const snareFilter = new Tone.Filter({ type: 'highpass', frequency: 1700 }).connect(bus);
    const snare = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.03 },
        volume: -20
    }).connect(snareFilter);
    const boom = new Tone.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 3,
        envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 },
        volume: -8
    }).connect(bus);
    const brassFilter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 }).connect(reverb);
    const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.4 },
        volume: -19
    }).connect(brassFilter);
    brass.maxPolyphony = 16;
    const bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 5,
        envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.8 },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
        volume: -14
    }).connect(reverb);
    bell.maxPolyphony = 20;
    const cymbalFilter = new Tone.Filter({ type: 'highpass', frequency: 5000 }).connect(reverb);
    const cymbal = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.4 },
        volume: -26
    }).connect(cymbalFilter);
    const whooshFilter = new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 0.7 }).connect(reverb);
    const whoosh = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.12, decay: 0.3, sustain: 0, release: 0.1 },
        volume: 1
    }).connect(whooshFilter);
    const buzzFilter = new Tone.Filter({ type: 'lowpass', frequency: 900, Q: 1 }).connect(bus);
    const buzz = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.05, sustain: 0.8, release: 0.06 },
        volume: -15
    }).connect(buzzFilter);
    // The "wah": a muted horn whose filter opens and closes on every note.
    const hornFilter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 2.5 }).connect(reverb);
    const horn = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.2 },
        volume: -12
    }).connect(hornFilter);
    quizVoices = { bus, block, mallet, snare, boom, brass, bell, cymbal, whoosh, whooshFilter, buzz, horn, hornFilter };
    return quizVoices;
}

// A C-major ladder the roulette climbs, one rung per name.
const QUIZ_SPIN_LADDER = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];

/** Builds the quiz voices ahead of time (the reverb takes a moment), so the first sound doesn't stall a frame. */
export function warmQuizShowAudio() {
    if (!isAudioReady()) return;
    getQuizVoices();
}

/**
 * Quiz of the Week sound effects.
 * 'curtain' the stage opens · 'flick' one name under the roulette ({ step, steps, gap } with gap in seconds
 * until the next name) · 'land' the spotlight lands ({ passed }) · 'buzz' a wrong answer · 'pass' the question
 * moves on · 'missed' nobody got it · 'cheer' a right answer ({ firstTry }) · 'skip' · 'trick' a Familiar's
 * trick · 'pause' / 'resume' · 'tally' drum roll ({ seconds }) · 'count' the curtain-call numbers ({ seconds })
 * · 'fanfare' the medal ({ tier }).
 */
export function playQuizShowSfx(name, opts = {}) {
    if (!isAudioReady()) return;
    const v = getQuizVoices();
    if (!v) return;
    const now = Tone.now();
    v.bus.gain.cancelScheduledValues(now);
    v.bus.gain.setValueAtTime(0.9, now);
    const t = now + 0.03;
    try {
        if (name === 'curtain') {
            v.whooshFilter.frequency.setValueAtTime(300, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
            v.whoosh.triggerAttackRelease(0.45, t, 0.8);
            ['G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + 0.25 + i * 0.07, 0.4));
        } else if (name === 'flick') {
            const steps = Math.max(1, opts.steps || 1);
            const step = Math.max(0, Math.min(opts.step || 0, steps - 1));
            const k = step / steps;
            v.block.triggerAttackRelease(step % 2 ? 'G4' : 'C5', 0.05, t, 0.7);
            v.mallet.triggerAttackRelease(QUIZ_SPIN_LADDER[step % QUIZ_SPIN_LADDER.length], 0.12, t, 0.45 + 0.4 * k);
            // A snare roll fills the gap to the next name, swelling as the wheel slows.
            const gap = Math.max(0.04, Number(opts.gap) || 0.06);
            for (let dt = 0.035; dt < gap - 0.01; dt += 0.035) {
                v.snare.triggerAttackRelease(0.04, t + dt, 0.2 + 0.55 * k);
            }
        } else if (name === 'land') {
            // "Ta-daa": a short pickup chord, then the full chord with a boom, a crash and bells.
            const [pick, chord, bells] = opts.passed
                ? [['C4', 'F4', 'A4'], ['F3', 'C4', 'F4', 'A4', 'C5'], ['C6', 'F6', 'A6', 'C7']]
                : [['D4', 'G4', 'B4'], ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], ['E6', 'G6', 'C7', 'E7']];
            v.brass.triggerAttackRelease(pick, 0.1, t, 0.75);
            v.brass.triggerAttackRelease(chord, 0.75, t + 0.14, 0.95);
            v.boom.triggerAttackRelease(opts.passed ? 'F1' : 'C2', 0.4, t + 0.14, 0.9);
            v.cymbal.triggerAttackRelease(1.2, t + 0.14, 0.9);
            bells.forEach((n, i) => v.bell.triggerAttackRelease(n, 0.7, t + 0.2 + i * 0.06, 0.5));
        } else if (name === 'buzz') {
            v.buzz.triggerAttackRelease('D#3', 0.16, t, 0.9);
            v.buzz.triggerAttackRelease('D#3', 0.32, t + 0.22, 0.9);
        } else if (name === 'pass') {
            v.whooshFilter.frequency.setValueAtTime(1800, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(350, t + 0.55);
            v.whoosh.triggerAttackRelease(0.4, t, 0.9);
            v.mallet.triggerAttackRelease(['E5', 'C5'], 0.15, t + 0.1, 0.45);
        } else if (name === 'missed') {
            // A friendly "wah, wah, wah, waaah", soft enough not to sting.
            const notes = [['G3', 0, 0.32], ['F#3', 0.38, 0.32], ['F3', 0.76, 0.32], ['E3', 1.14, 0.95]];
            notes.forEach(([note, at, len]) => {
                v.horn.triggerAttackRelease(note, len, t + at, 0.8);
                v.hornFilter.frequency.setValueAtTime(380, t + at);
                v.hornFilter.frequency.exponentialRampToValueAtTime(1300, t + at + 0.12);
                v.hornFilter.frequency.exponentialRampToValueAtTime(420, t + at + len);
            });
        } else if (name === 'cheer') {
            // The game-show "ding-ding" over the right-answer chime.
            v.bell.triggerAttackRelease(['C6', 'E6'], 0.5, t + 0.22, 0.6);
            v.bell.triggerAttackRelease(['G6', 'C7'], 0.8, t + 0.4, 0.65);
            if (opts.firstTry) {
                v.brass.triggerAttackRelease(['G4', 'C5', 'E5'], 0.12, t + 0.32, 0.6);
                v.brass.triggerAttackRelease(['C5', 'E5', 'G5'], 0.5, t + 0.46, 0.7);
                v.cymbal.triggerAttackRelease(0.9, t + 0.46, 0.6);
            }
        } else if (name === 'skip') {
            v.whooshFilter.frequency.setValueAtTime(500, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
            v.whoosh.triggerAttackRelease(0.3, t, 0.7);
        } else if (name === 'trick') {
            v.whooshFilter.frequency.setValueAtTime(2600, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(700, t + 0.4);
            v.whoosh.triggerAttackRelease(0.3, t, 0.6);
            ['C7', 'G6', 'E6', 'C6', 'G5'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.4, t + i * 0.05, 0.45));
            v.mallet.triggerAttackRelease('C4', 0.2, t + 0.3, 0.5);
        } else if (name === 'pause') {
            v.mallet.triggerAttackRelease('G5', 0.2, t, 0.45);
            v.mallet.triggerAttackRelease('C5', 0.35, t + 0.12, 0.45);
        } else if (name === 'resume') {
            v.mallet.triggerAttackRelease('C5', 0.2, t, 0.45);
            v.mallet.triggerAttackRelease('G5', 0.35, t + 0.12, 0.45);
        } else if (name === 'tally') {
            const seconds = Math.max(0.4, Number(opts.seconds) || 1.4);
            for (let dt = 0, i = 0; dt < seconds; dt += 0.045, i++) {
                const k = dt / seconds;
                v.snare.triggerAttackRelease(0.04, t + dt, 0.15 + 0.75 * k * k);
                if (i % 6 === 0) v.boom.triggerAttackRelease('G1', 0.15, t + dt, 0.2 + 0.4 * k);
            }
        } else if (name === 'count') {
            // Ticks that slow down with the eased count-up.
            const seconds = Math.max(0.3, Number(opts.seconds) || 0.9);
            for (let x = 0, i = 0; x < 1; x += 1 / 14, i++) {
                const at = seconds * (1 - Math.cbrt(1 - x));
                v.block.triggerAttackRelease(i % 2 ? 'E5' : 'A5', 0.04, t + at, 0.6);
            }
            v.bell.triggerAttackRelease(['E6', 'B6'], 0.5, t + seconds, 0.45);
        } else if (name === 'fanfare') {
            const big = opts.tier === 'legendary' || opts.tier === 'epic';
            v.boom.triggerAttackRelease('C2', 0.5, t, 0.9);
            v.cymbal.triggerAttackRelease(big ? 1.8 : 1.1, t, big ? 1 : 0.7);
            v.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.12, t, 0.7);
            v.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.12, t + 0.16, 0.7);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], big ? 1.1 : 0.7, t + 0.32, 0.95);
            if (big) {
                v.brass.triggerAttackRelease(['C4', 'F4', 'A4', 'C5'], 0.3, t + 0.9, 0.85);
                v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5', 'E5'], 1.3, t + 1.2, 1);
                v.boom.triggerAttackRelease('C2', 0.6, t + 1.2, 0.9);
                v.cymbal.triggerAttackRelease(2, t + 1.2, 0.8);
            }
            const sparkle = big ? ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'] : ['C6', 'E6', 'G6', 'C7'];
            sparkle.forEach((n, i) => v.bell.triggerAttackRelease(n, 0.8, t + 0.36 + i * 0.07, 0.45));
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}

/** Fade out whatever the quiz still has scheduled (the stage closed). */
export function stopQuizShowSound() {
    const gain = quizVoices?.bus?.gain;
    if (!gain || !Tone) return;
    const now = Tone.now();
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.25);
}
