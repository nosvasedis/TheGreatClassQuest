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
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.26 }).toDestination();
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
    const timpani = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 2.2,
        envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.3 },
        volume: -9
    }).connect(bus);
    const brassFilter = new Tone.Filter({ type: 'lowpass', frequency: 1900, Q: 0.8 }).connect(bus);
    const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
        envelope: { attack: 0.035, decay: 0.2, sustain: 0.7, release: 0.55 },
        volume: -17
    }).connect(brassFilter);
    brass.maxPolyphony = 14;
    const cymbalFilter = new Tone.Filter({ type: 'highpass', frequency: 5200 }).connect(bus);
    const cymbal = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.004, decay: 2.2, sustain: 0, release: 0.4 },
        volume: -25
    }).connect(cymbalFilter);
    const bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 6,
        envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 1.1 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
        volume: -19
    }).connect(bus);
    bell.maxPolyphony = 10;
    heroVoices = { bus, drawBus, quill, quillFilter, harp, roll, timpani, brass, cymbal, bell };
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
 * @param {number[]} hopTimes seconds from now, one per hop; the last is the landing.
 */
export function playHeroDrawSound(hopTimes = []) {
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
    v.harp.triggerAttackRelease(['D5', 'A5', 'D6'], 0.5, now + end, 0.8);
}

/** Build the reveal voices ahead of time so the reverb is ready when the draw starts. */
export function primeHeroRevealSound() {
    if (soundsReady && Tone) getHeroVoices();
}

/** Cut the draw short (the teacher tapped to reveal now). */
export function stopHeroDrawSound() {
    fadeHeroBus('drawBus');
}

/** The crowning: timpani boom, herald trumpets, a cymbal wash and a bell sparkle as the crown lands. */
export function playHeroCrowningSound() {
    if (ceremonyMuted || !isAudioReady()) return;
    const v = heroBusUp();
    if (!v) return;
    const t0 = Tone.now() + 0.03;
    v.timpani.triggerAttackRelease('D2', 0.5, t0, 1);
    v.timpani.triggerAttackRelease('A1', 0.5, t0 + 0.72, 0.9);
    [[0, 'A3', 0.09], [0.12, 'A3', 0.09], [0.24, 'A3', 0.09], [0.36, 'D4', 0.3]].forEach(([dt, note, dur]) => {
        v.brass.triggerAttackRelease([note, Tone.Frequency(note).transpose(7).toNote()], dur, t0 + dt, 0.8);
    });
    v.brass.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 1.5, t0 + 0.72, 0.9);
    v.cymbal.triggerAttackRelease(1.8, t0 + 0.72, 0.9);
    ['D6', 'F#6', 'A6', 'D7'].forEach((note, i) => v.bell.triggerAttackRelease(note, 0.8, t0 + 0.78 + i * 0.09, 0.6));
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
