import { quietly } from './utils/runtimeMetrics.js';
import * as state from './state.js';
import { loadTone } from './utils/lazyLibraries.js';
import { VoicePool, guardMonoVoice, createVoiceBank, lazyVoices } from './utils/voiceBank.js';

// How the sound effects stay smooth during heavy animations (see utils/voiceBank.js):
// - chords and bells are VoicePools, which put every note straight on the audio clock
//   (Tone.PolySynth waited for the busy main thread and played notes late or not at all);
// - each family of voices is a VoiceBank: built on first use, disposed when it has been quiet,
//   so silent synths stop costing the audio thread anything;
// - no Tone.PluckSynth: each one ran a script on the audio thread nonstop (the old 15% idle load);
// - the context uses a bigger output buffer and a master limiter (utils/lazyLibraries.js).
// Always reach the context through Tone.getContext() / getTransport(), never Tone.context.

let Tone = null;
export let winnerFanfare = {};
export let heroFanfare = {};
let soundsReady = false;
let soundSetupPromise = null;
let audioStartPromise = null;
let lastSoundTime = 0; // Track the time of the last scheduled sound
let baseReverb = null;

function audioRunning() {
    return Boolean(Tone) && Tone.getContext().state === 'running';
}

/** A polyphonic voice (bells, chords) scheduled straight onto the audio clock. */
function pool(keep, Voice, options, maxPolyphony = 8) {
    return keep(new VoicePool(Tone, Voice, options, maxPolyphony));
}

/** A one-note-at-a-time voice that skips a clashing note instead of throwing. */
function mono(keep, node) {
    return keep(guardMonoVoice(node));
}

// The everyday sounds (stars, clicks, quiz chimes). Built when first needed, put to sleep when quiet.
const baseBank = createVoiceBank((keep) => {
    const reverb = baseReverb;
    const v = lazyVoices({
        click: () => mono(keep, new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05 }, volume: -25 }).toDestination()),
        confirm: () => mono(keep, new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.2 }, volume: -15 }).toDestination()),
        star_remove: () => mono(keep, new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.01, release: 0.3 }, volume: -10 }).toDestination()),
        writing: () => mono(keep, new Tone.NoiseSynth({ noise: { type: "white", playbackRate: 0.5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -20 }).toDestination()),
        cash: () => pool(keep, Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
            volume: -10
        }, 6).toDestination(),
        snare: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 },
            volume: -10
        }).toDestination()),
        familiar_hatch: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.15, sustain: 0.1, release: 0.4 },
            volume: -8
        }, 8).connect(reverb),
        familiar_levelup: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.6 },
            volume: -10
        }, 10).connect(reverb),
        // Plucked notes: one light triangle pluck shared by the star, chime and quiz plucks
        // (Tone.PluckSynth ran an audio-thread script all the time, even in silence).
        pluck: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 0.38, sustain: 0, release: 0.35 },
            volume: -9
        }, 8).connect(reverb),
        magic_chime: () => plucked(v, 0.55),
        star1: () => plucked(v, 0.75),
        star2: () => plucked(v, 0.9),
        // Quiz of the Week SFX
        quiz_open: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
            volume: -8
        }, 6).connect(reverb),
        quiz_question_in: () => plucked(v, 0.45),
        quiz_student_reveal: () => plucked(v, 0.75),
        quiz_correct: () => mono(keep, new Tone.FMSynth({
            harmonicity: 2.5,
            modulationIndex: 8,
            detune: 0,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 0.5 },
            modulation: { type: 'triangle' },
            modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 },
            volume: -6
        }).connect(reverb)),
        quiz_wrong: () => mono(keep, new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.2 },
            volume: -12
        }).toDestination()),
        quiz_tier_reveal: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 },
            volume: -6
        }, 8).connect(reverb),
        quiz_confetti_pop: () => plucked(v, 0.75),
        ceremony_gling: () => plucked(v, 0.12),
        star3: () => mono(keep, new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            detune: 0,
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
            modulation: { type: "square" },
            modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.4 },
            volume: -5
        }).connect(reverb)),
        // Award Stars: a bell choir that grows with the award (spark, shine, supernova),
        // a sparkle wash, a soft low swell for three stars, and one chime per virtue.
        award_bell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 7,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.9 },
            modulation: { type: 'sine' },
            modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 },
            volume: -15
        }, 12).connect(reverb),
        awardSparkleFilter: () => keep(new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(reverb)),
        award_sparkle: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.02, decay: 0.45, sustain: 0, release: 0.2 },
            volume: -24
        }).connect(v.awardSparkleFilter)),
        award_swell: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 4,
            envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
            volume: -13
        }).toDestination()),
        award_pad: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.04, decay: 0.5, sustain: 0.25, release: 1.1 },
            volume: -20
        }, 6).connect(reverb),
        // The Hero of the Day bonus: a soft brass for the royal call (FM at harmonicity 1).
        royal_brass: () => pool(keep, Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 3.2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.03, decay: 0.18, sustain: 0.55, release: 0.45 },
            modulation: { type: 'square' },
            modulationEnvelope: { attack: 0.06, decay: 0.25, sustain: 0.45, release: 0.35 },
            volume: -19
        }, 6).connect(reverb),
    });
    return v;
}, { idle: 6, span: 3 });

/** One of the plucked notes: the shared pluck at its own loudness. */
function plucked(v, velocity) {
    return { triggerAttackRelease: (note, duration, time) => v.pluck.triggerAttackRelease(note, duration, time, velocity) };
}

/** The everyday voices, kept awake for `seconds`. */
function getSounds(seconds = 3) {
    return baseBank.get(seconds);
}

export async function setupSounds() {
    if (soundSetupPromise) return soundSetupPromise;

    soundSetupPromise = (async () => {
        try {
            Tone = await loadTone();
            baseReverb = baseReverb || new Tone.Reverb({ decay: 0.8, wet: 0.3 }).toDestination();

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
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(sound === 'award_3' ? 3 : 2);
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

/**
 * The two big award moments (ui/awardMoments.js).
 * Hero's Boon, in A major: 'boon_launch' a lub-dub and a harp lifting the heart ·
 * 'boon_fly' a glide of bells across the sky · 'boon_land' a warm bloom of bells, pad and sparkle ·
 * 'boon_fizzle' a soft falling pair when the boon could not be given.
 * 'hero_bonus' the Hero of the Day: a brass call, the crown landing on a D-major chord, a cascade.
 */
export function playAwardMomentSfx(name) {
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(name === 'hero_bonus' ? 5 : 3);
    const t = Tone.now() + 0.03;
    const bell = (note, dur, at, vel) => sounds.award_bell.triggerAttackRelease(note, dur, t + at, vel);
    const harp = (note, at, vel = 0.6) => sounds.pluck.triggerAttackRelease(note, '16n', t + at, vel);
    try {
        if (name === 'boon_launch') {
            sounds.award_swell.triggerAttackRelease('A1', '16n', t, 0.55);
            sounds.award_swell.triggerAttackRelease('A1', '16n', t + 0.16, 0.38);
            ['A4', 'C#5', 'E5', 'A5', 'C#6', 'E6'].forEach((n, i) => harp(n, 0.42 + i * 0.07, 0.45 + i * 0.06));
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.8);
        } else if (name === 'boon_fly') {
            ['E6', 'F#6', 'A6', 'B6', 'C#7', 'E7'].forEach((n, i) => bell(n, '32n', i * 0.2, 0.18 + i * 0.04));
            sounds.award_sparkle.triggerAttackRelease('4n', t + 0.3);
        } else if (name === 'boon_land') {
            sounds.award_swell.triggerAttackRelease('A1', '8n', t, 0.6);
            bell(['A5', 'C#6', 'E6', 'G#6'], '4n', 0.02, 0.75);
            sounds.award_pad.triggerAttackRelease(['A4', 'E5', 'C#6'], '2n', t + 0.02);
            sounds.award_sparkle.triggerAttackRelease('4n', t + 0.04);
            ['A7', 'G#7', 'E7', 'C#7', 'A6'].forEach((n, i) => bell(n, '64n', 0.36 + i * 0.09, 0.32 - i * 0.03));
        } else if (name === 'boon_fizzle') {
            bell('E6', '32n', 0, 0.3);
            bell('B5', '16n', 0.14, 0.26);
        } else if (name === 'hero_bonus') {
            // A herald's call: ta-ta-taaa, rising.
            const brass = (notes, dur, at, vel = 0.7) => sounds.royal_brass.triggerAttackRelease(notes, dur, t + at, vel);
            brass('A4', 0.1, 0, 0.55);
            brass('A4', 0.1, 0.13, 0.55);
            brass('D5', 0.32, 0.26, 0.7);
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.1);
            ['D6', 'F#6', 'A6', 'D7'].forEach((n, i) => bell(n, '32n', 0.5 + i * 0.07, 0.3 + i * 0.08));
            // The crown lands.
            const land = 0.98;
            sounds.award_swell.triggerAttackRelease('D2', '8n', t + land, 0.85);
            brass(['D5', 'F#5', 'A5'], 0.7, land, 0.75);
            bell(['D6', 'F#6', 'A6', 'D7'], '4n', land + 0.02, 0.9);
            sounds.award_pad.triggerAttackRelease(['D5', 'A5', 'F#6'], '2n', t + land);
            sounds.award_sparkle.triggerAttackRelease('4n', t + land + 0.02);
            sounds.star3.triggerAttackRelease('D7', '32n', t + land + 0.2);
            // The bonus star flies into the tally.
            ['A7', 'F#7', 'D7', 'A6', 'F#6'].forEach((n, i) => bell(n, '64n', land + 0.55 + i * 0.1, 0.34 - i * 0.04));
            bell(['D7', 'A7'], '8n', land + 1.55, 0.5);
        }
    } catch (e) {
        console.warn('Award moment sound skipped:', e);
    }
}

/**
 * The hero level-up moment (ui/modals/heroLevelUp.js), in F major, on the everyday voices
 * (no file to download, so a weak laptop plays it as easily as a star):
 * 'rise' the medallion lifts on a harp run · 'step' one bell per rung already climbed ({ step }) ·
 * 'burst' the new rung lights: a brass "ta-da-da-DAAA", the full chord and a sparkle ({ max } adds
 * a higher bell crown for the highest rank) · 'ribbon' the title unfurls on a falling cascade.
 */
const LEVEL_UP_STEPS = ['C6', 'D6', 'F6', 'G6', 'A6', 'C7'];

export function playLevelUpSfx(name, opts = {}) {
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(name === 'burst' ? 5 : 3);
    const t = Tone.now() + 0.03;
    const bell = (note, dur, at, vel) => sounds.award_bell.triggerAttackRelease(note, dur, t + at, vel);
    const harp = (note, at, vel = 0.5) => sounds.pluck.triggerAttackRelease(note, '16n', t + at, vel);
    const brass = (notes, dur, at, vel = 0.7) => sounds.royal_brass.triggerAttackRelease(notes, dur, t + at, vel);
    try {
        if (name === 'rise') {
            sounds.award_swell.triggerAttackRelease('F1', '8n', t, 0.45);
            ['F4', 'A4', 'C5', 'F5', 'A5', 'C6'].forEach((n, i) => harp(n, 0.05 + i * 0.06, 0.35 + i * 0.05));
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.3);
        } else if (name === 'step') {
            const step = Math.max(0, Number(opts.step) || 0);
            bell(LEVEL_UP_STEPS[step % LEVEL_UP_STEPS.length], '32n', 0, 0.32 + Math.min(step, 4) * 0.05);
        } else if (name === 'burst') {
            brass('C5', 0.09, 0, 0.5);
            brass('F5', 0.09, 0.1, 0.55);
            brass('A5', 0.09, 0.2, 0.6);
            const land = 0.3;
            brass(['F4', 'C5', 'F5', 'A5', 'C6'], 0.9, land, 0.78);
            sounds.award_swell.triggerAttackRelease('F1', '4n', t + land, 0.9);
            sounds.award_pad.triggerAttackRelease(['F4', 'C5', 'A5'], '1n', t + land);
            bell(['F6', 'A6', 'C7', 'F7'], '4n', land + 0.02, 0.8);
            sounds.award_sparkle.triggerAttackRelease('4n', t + land + 0.02);
            sounds.star3.triggerAttackRelease('F7', '32n', t + land + 0.18);
            if (opts.max) {
                bell(['C7', 'F7', 'A7'], '8n', land + 0.5, 0.6);
                sounds.award_pad.triggerAttackRelease(['A4', 'F5', 'C6'], '1n', t + land + 0.5);
            }
        } else if (name === 'ribbon') {
            ['C8', 'A7', 'F7', 'C7', 'A6', 'F6'].forEach((n, i) => bell(n, '64n', i * 0.08, 0.34 - i * 0.04));
            bell(['F6', 'C7'], '8n', 0.62, opts.max ? 0.55 : 0.4);
        }
    } catch (e) {
        console.warn('Level-up sound skipped:', e);
    }
}

export async function activateAudioContext() {
    try {
        Tone = Tone || await loadTone();
    } catch (error) {
        console.error('Failed to load audio library:', error);
        return false;
    }
    if (audioRunning()) return Promise.resolve(true);
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
    return soundsReady && audioRunning();
}

export function isAudioReady() {
    return soundsReady && audioRunning();
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
    stopDrumRoll();
    const sounds = getSounds();
    baseBank.hold();
    // Play a snare hit every 16th note (fast)
    drumRollLoop = new Tone.Loop(time => {
        sounds.snare.triggerAttackRelease("8n", time);
    }, "16n").start(0);
    Tone.getTransport().start();
}

export function stopDrumRoll() {
    if (drumRollLoop) {
        drumRollLoop.dispose();
        drumRollLoop = null;
        baseBank.release(1);
        if (!writingLoop) Tone.getTransport().stop();
    }
}

// ── Hero of the Day ──────────────────────────────────────────────
// Every voice is synthesised (no files) and built once, on first use.
// The draw and the crowning each have their own bus, so a skipped draw or a
// closed reveal can fade out what is still scheduled without touching the rest.
let heroChassis = null;
function getHeroChassis() {
    if (!heroChassis && Tone) {
        const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.3 }).toDestination();
        heroChassis = { reverb, bus: new Tone.Gain(1).connect(reverb), drawBus: new Tone.Gain(1).connect(reverb) };
    }
    return heroChassis;
}

// The drawing of lots and the quill: small, built when the reveal opens.
const heroDrawBank = createVoiceBank((keep) => {
    const { bus, drawBus } = getHeroChassis();
    const v = lazyVoices({
        quillFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 1.4 }).connect(bus)),
        quill: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.03 },
            volume: -24
        }).connect(v.quillFilter)),
        harp: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 },
            volume: -13
        }, 10).connect(drawBus),
        roll: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 2.2,
            envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
            volume: -11
        }).connect(drawBus)),
        // The held breath before the crown: a dominant string swell and a rising hiss.
        tensionFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 1.2 }).connect(drawBus)),
        tension: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
            envelope: { attack: 1.2, decay: 0.1, sustain: 1, release: 0.25 },
            volume: -22
        }, 8).connect(v.tensionFilter),
        riserFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 0.9 }).connect(drawBus)),
        riser: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 1, decay: 0.05, sustain: 1, release: 0.06 },
            volume: -24
        }).connect(v.riserFilter)),
        heartbeat: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.06,
            octaves: 3,
            envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.2 },
            volume: -6
        }).connect(drawBus)),
    });
    return v;
}, { idle: 6 });

// The live band of the Hero's March: only built when the recording could not be played.
const heroAnthemBank = createVoiceBank((keep) => {
    const { bus } = getHeroChassis();
    const v = lazyVoices({
        timpani: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 2.2,
            envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.3 },
            volume: -9
        }).connect(bus)),
        sub: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.12,
            octaves: 4,
            envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.6 },
            volume: -4
        }).connect(bus)),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2300, Q: 0.8 }).connect(bus)),
        brass: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
            envelope: { attack: 0.03, decay: 0.2, sustain: 0.75, release: 0.6 },
            volume: -17
        }, 12).connect(v.brassFilter),
        // A choir-like "aah" under the fanfare: slow sawtooth pad through a vowel-ish band.
        choirFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.7 }).connect(bus)),
        choir: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
            envelope: { attack: 0.35, decay: 0.3, sustain: 0.85, release: 1.6 },
            volume: -21
        }, 12).connect(v.choirFilter),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 4200 }).connect(bus)),
        cymbal: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.003, decay: 3, sustain: 0, release: 0.5 },
            volume: -22
        }).connect(v.cymbalFilter)),
        bell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 6,
            envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 1.1 },
            modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
            volume: -19
        }, 16).connect(bus),
        // The anthem's band: a singing lead with a little vibrato, a round bass and a march snare.
        leadFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 0.6 }).connect(bus)),
        leadVibrato: () => keep(new Tone.Vibrato({ frequency: 5.2, depth: 0.08 }).connect(v.leadFilter)),
        lead: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 12 },
            envelope: { attack: 0.025, decay: 0.15, sustain: 0.8, release: 0.35 },
            volume: -15
        }, 6).connect(v.leadVibrato),
        bassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 650, Q: 1 }).connect(bus)),
        bass: () => mono(keep, new Tone.Synth({
            oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
            envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.2 },
            volume: -10
        }).connect(v.bassFilter)),
        snareFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1600 }).connect(bus)),
        snare: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.002, decay: 0.13, sustain: 0, release: 0.05 },
            volume: -19
        }).connect(v.snareFilter)),
    });
    return v;
}, { idle: 4, span: 18 });

/** Bring a hero bus back to full and hand out its voices (`kind` 'draw' or 'anthem'). */
function heroBusUp(busName = 'bus', kind = 'draw', seconds) {
    const chassis = getHeroChassis();
    if (!chassis) return null;
    if (busName === 'drawBus' && drawFadeTimer) {
        // A new draw right after a skipped one: start from fresh voices.
        clearTimeout(drawFadeTimer);
        drawFadeTimer = 0;
        heroDrawBank.dispose();
    }
    const voices = (kind === 'anthem' ? heroAnthemBank : heroDrawBank).get(seconds);
    const gain = chassis[busName].gain;
    gain.cancelScheduledValues(Tone.now());
    gain.setValueAtTime(1, Tone.now());
    return voices;
}

let drawFadeTimer = 0;
function fadeHeroBus(busName) {
    const gain = heroChassis?.[busName]?.gain;
    if (!gain) return;
    const now = Tone.now();
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.2);
    if (busName === 'drawBus' && heroDrawBank.awake) {
        // Held voices would otherwise sustain under the next draw.
        const v = heroDrawBank.get(1);
        v.tension.releaseAll(now + 0.2);
        v.riser.triggerRelease(now + 0.2);
        // Drop everything the draw still has scheduled once it has faded, so none of it
        // sounds under the next draw.
        if (drawFadeTimer) clearTimeout(drawFadeTimer);
        drawFadeTimer = setTimeout(() => {
            drawFadeTimer = 0;
            if (!writingLoop) heroDrawBank.dispose();
        }, 400);
    }
}

/** Soft quill scratches while the Chronicler writes the page and picks the hero. */
let writingLoop;
export function playWritingLoop() {
    if (!soundsReady) return;
    const v = heroBusUp();
    if (!v) return;
    getHeroMarchPlayer(); // start fetching the crowning music while the page is written
    stopWritingLoop();
    heroDrawBank.hold();
    writingLoop = new Tone.Loop(time => {
        v.quillFilter.frequency.setValueAtTime(2600 + Math.random() * 1400, time);
        v.quill.triggerAttackRelease(0.03 + Math.random() * 0.05, time);
    }, '16n');
    writingLoop.probability = 0.55;
    writingLoop.humanize = 0.02;
    writingLoop.start(0);
    Tone.getTransport().start();
}

export function stopWritingLoop() {
    if (writingLoop) {
        writingLoop.dispose();
        writingLoop = null;
        heroDrawBank.release(1);
        if (!drumRollLoop) {
            Tone.getTransport().stop();
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
    const v = heroBusUp('drawBus', 'draw', hopTimes[hopTimes.length - 1] + Math.max(0, hushSeconds) + 1);
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
    if (soundsReady && Tone) {
        heroBusUp('drawBus', 'draw', 8);
        getHeroMarchPlayer();
    }
}

// The Hero's March is played from a recording of the anthem below (rendered offline
// once, committed as a small MP3). Synthesising all of it live, on top of the
// crowning's animations, fell behind real time and stuttered or went silent on
// school laptops; one recording plays smoothly anywhere. The live version stays
// as the fallback for when the file has not loaded.
const HERO_MARCH_URL = 'assets/hero/heros-march.mp3';
let heroMarch = null;
function getHeroMarchPlayer() {
    if (heroMarch || !Tone) return heroMarch;
    const gain = new Tone.Gain(1).toDestination();
    const player = new Tone.Player({
        url: HERO_MARCH_URL,
        volume: -3,
        fadeOut: 0.3,
        onerror: (e) => console.warn("Hero's March failed to load", e)
    }).connect(gain);
    heroMarch = { player, gain };
    return heroMarch;
}

function playHeroMarchRecording() {
    const march = getHeroMarchPlayer();
    if (!march?.player.loaded) return false;
    const now = Tone.now();
    march.gain.gain.cancelScheduledValues(now);
    march.gain.gain.setValueAtTime(1, now);
    if (march.player.state === 'started') march.player.stop(now);
    march.player.start(now + 0.02);
    return true;
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


export function playHeroCrowningSound() {
    if (ceremonyMuted) return;
    if (!isAudioReady()) {
        // The context can be asleep (for example after the tab was in the background).
        // Wake it and play straight away rather than crowning in silence.
        const askedAt = Date.now();
        ensureAudioReady().then((ready) => {
            if (ready && Date.now() - askedAt < 1500) playHeroCrowningSound();
        }).catch(quietly('audio.js'));
        return;
    }
    // The impact's boom is part of the recording too, so play one or the other.
    if (playHeroMarchRecording()) return;
    // A second crowning while the last anthem is still scheduled would collide on
    // the one-voice synths, so start from fresh voices in that rare case.
    if (heroAnthemBank.awake && Tone.now() < heroAnthemEndsAt) heroAnthemBank.dispose();
    const v = heroBusUp('bus', 'anthem', 18);
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
    if (!Tone) return;
    if (heroMarch?.player.state === 'started') {
        const now = Tone.now();
        heroMarch.gain.gain.cancelScheduledValues(now);
        heroMarch.gain.gain.setValueAtTime(heroMarch.gain.gain.value, now);
        heroMarch.gain.gain.linearRampToValueAtTime(0, now + 0.4);
        heroMarch.player.stop(now + 0.45);
    }
    if (!heroChassis) return;
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
let wheelChassis = null;
const wheelBank = createVoiceBank((keep) => {
    if (!wheelChassis) {
        const out = new Tone.Gain(0.9).toDestination();
        wheelChassis = { out, reverb: new Tone.Reverb({ decay: 2.4, wet: 0.28 }).connect(out) };
    }
    const { out, reverb } = wheelChassis;
    const v = lazyVoices({
        rumbleFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 260, Q: 0.7 }).connect(out)),
        rumble: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.03, decay: 1.6, sustain: 0, release: 0.8 }, volume: -2 }).connect(v.rumbleFilter)),
        crack: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }, volume: -12 }).connect(reverb)),
        whooshFilter: () => keep(new Tone.AutoFilter({ frequency: 2.2, baseFrequency: 300, octaves: 4 }).connect(reverb).start()),
        whoosh: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.25, decay: 0.6, sustain: 0.2, release: 0.6 }, volume: -10 }).connect(v.whooshFilter)),
        bell: () => pool(keep, Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.003, decay: 0.5, sustain: 0, release: 0.6 }, volume: -10 }, 8).connect(reverb),
        hornFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 1100 }).connect(out)),
        horn: () => mono(keep, new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.25 }, volume: -16 }).connect(v.hornFilter)),
        knock: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }, volume: -8 }).connect(out)),
    });
    return v;
}, { idle: 6, span: 4 });

function getWheelVoices() {
    return Tone ? wheelBank.get() : null;
}

/** Fortune's Wheel sound effects: 'thunder' | 'shield' | 'whoosh' | 'trickster' | 'coin' | 'chest' | 'tick_heavy' | 'buzzer'. */
/** Builds the Wheel's voices ahead of time (the reverb takes a moment), so the first thunder doesn't stall a frame. */
export function warmWheelAudio() {
    if (!soundsReady || !audioRunning()) return;
    getWheelVoices();
}

export function playWheelSfx(name) {
    if (!soundsReady || !audioRunning()) return;
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
let familiarChassis = null;
const familiarBank = createVoiceBank((keep) => {
    if (!familiarChassis) {
        const out = new Tone.Gain(0.8).toDestination();
        familiarChassis = { out, reverb: new Tone.Reverb({ decay: 1.6, wet: 0.25 }).connect(out) };
    }
    const { reverb } = familiarChassis;
    const v = lazyVoices({
        lead: () => mono(keep, new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0.5, release: 0.18 }, volume: -10 }).connect(reverb)),
        growlFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 1500, Q: 2 }).connect(reverb)),
        growl: () => mono(keep, new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.15 }, volume: -16 }).connect(v.growlFilter)),
        croakFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 4 }).connect(reverb)),
        croak: () => mono(keep, new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.05 }, volume: -16 }).connect(v.croakFilter)),
        puffFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.8 }).connect(reverb)),
        puff: () => mono(keep, new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.1 }, volume: -14 }).connect(v.puffFilter)),
        bell: () => pool(keep, Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 }, volume: -14 }, 8).connect(reverb),
        // Evolution Moment: a swelling pad, a deep thump for the flash and a glassy shimmer.
        swell: () => mono(keep, new Tone.Synth({ oscillator: { type: 'fattriangle', count: 3, spread: 24 }, envelope: { attack: 0.4, decay: 0.2, sustain: 0.8, release: 0.6 }, volume: -15 }).connect(reverb)),
        thump: () => mono(keep, new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.3 }, volume: -8 }).connect(familiarChassis.out)),
        shimmer: () => pool(keep, Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.6 }, volume: -16 }, 10).connect(reverb),
    });
    return v;
}, { idle: 6, span: 3 });

function getFamiliarVoices() {
    return Tone ? familiarBank.get() : null;
}

function glide(synth, t, points, end) {
    synth.triggerAttack(points[0][1], t);
    for (const [at, freq] of points.slice(1)) synth.frequency.exponentialRampToValueAtTime(freq, t + at);
    synth.triggerRelease(t + end);
}

/** A familiar's call: { kind: 'chirr' | 'yip' | 'croak' | 'hum' | 'trill' | 'squeak' | 'hoot' | 'chime' | 'whinny' | 'boing', pitch, shiny, mythic }. */
export function playFamiliarVoice(voice = {}) {
    if (!soundsReady || !audioRunning()) return;
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
        } else if (voice.kind === 'squeak') {
            [0, 0.12, 0.22].forEach((dt, i) => glide(v.lead, t + dt, [[0, (900 + i * 120) * p], [0.06, (1400 + i * 160) * p]], 0.08));
            v.bell.triggerAttackRelease(1760 * p, 0.2, t + 0.34, 0.35);
        } else if (voice.kind === 'hoot') {
            glide(v.lead, t, [[0, 420 * p], [0.12, 470 * p], [0.3, 400 * p]], 0.32);
            glide(v.lead, t + 0.42, [[0, 400 * p], [0.18, 450 * p], [0.42, 360 * p]], 0.46);
        } else if (voice.kind === 'whinny') {
            glide(v.lead, t, [[0, 640 * p], [0.07, 1080 * p], [0.15, 900 * p], [0.22, 1040 * p], [0.3, 860 * p], [0.38, 980 * p], [0.56, 620 * p]], 0.58);
            [1568, 2093, 2637].forEach((freq, i) => v.bell.triggerAttackRelease(freq * p, 0.3, t + 0.5 + i * 0.08, 0.4));
        } else if (voice.kind === 'boing') {
            [0, 0.2].forEach((dt, i) => glide(v.lead, t + dt, [[0, (300 + i * 80) * p], [0.09, (980 + i * 140) * p], [0.13, (860 + i * 120) * p]], 0.14));
            v.bell.triggerAttackRelease([1319 * p, 1976 * p], 0.25, t + 0.4, 0.4);
        } else if (voice.kind === 'chime') {
            [523, 784, 1047, 1568].forEach((freq, i) => v.bell.triggerAttackRelease(freq * p, 0.5, t + i * 0.09, 0.55));
        } else {
            [1047, 1319, 1568, 2093, 1568, 2637].forEach((freq, i) => v.bell.triggerAttackRelease(freq * p, 0.12, t + i * 0.055, 0.6));
        }
        if (voice.shiny) [2093, 2637, 3136, 4186].forEach((freq, i) => v.bell.triggerAttackRelease(freq, 0.3, t + 0.45 + i * 0.07, 0.35));
        if (voice.mythic) [1568, 2093, 3136].forEach((freq, i) => v.shimmer.triggerAttackRelease(freq, 0.4, t + 0.6 + i * 0.08, 0.3));
    } catch (_) { /* overlapping triggers are harmless */ }
}

/**
 * The Evolution Moment's sound, in phases:
 * 'notice' (a little bell call), 'crack' / 'charge' (the glow builds), 'morph' (the shape flickers
 * faster and faster), 'burst' (the flash) and 'fanfare' (the new form appears).
 */
export function playFamiliarEvolutionSfx(phase) {
    if (!soundsReady || !audioRunning()) return;
    const v = getFamiliarVoices();
    if (!v) return;
    const t = Tone.now() + 0.03;
    try {
        if (phase === 'notice') {
            ['E6', 'G#6', 'B6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.35, t + i * 0.08, 0.45));
        } else if (phase === 'crack') {
            [0, 0.45, 0.8, 1.1, 1.35].forEach((dt, i) => {
                v.puff.triggerAttackRelease(0.06, t + dt);
                v.bell.triggerAttackRelease(1800 + i * 160, 0.08, t + dt, 0.4);
            });
            glide(v.swell, t + 0.2, [[0, 196], [1.4, 392]], 1.6);
        } else if (phase === 'charge') {
            glide(v.swell, t, [[0, 196], [1.6, 523]], 1.7);
            v.puff.triggerAttackRelease(1.2, t + 0.3);
        } else if (phase === 'morph') {
            let at = 0;
            let gap = 0.34;
            for (let i = 0; i < 14 && at < 2.5; i++) {
                v.shimmer.triggerAttackRelease(i % 2 ? 1319 : 988, 0.12, t + at, 0.5);
                at += gap;
                gap = Math.max(0.08, gap * 0.84);
            }
            glide(v.swell, t, [[0, 523], [2.5, 1047]], 2.6);
        } else if (phase === 'burst') {
            v.thump.triggerAttackRelease('C2', 0.6, t);
            v.puff.triggerAttackRelease(0.5, t);
            ['C6', 'E6', 'G6', 'C7'].forEach((n) => v.shimmer.triggerAttackRelease(n, 0.6, t + 0.02, 0.5));
        } else if (phase === 'fanfare') {
            [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.38]].forEach(([n, dt]) => v.bell.triggerAttackRelease(n, 0.4, t + dt, 0.7));
            ['E6', 'G6', 'C7'].forEach((n) => v.shimmer.triggerAttackRelease(n, 0.9, t + 0.56, 0.45));
            [2637, 3136, 3951, 4186].forEach((freq, i) => v.bell.triggerAttackRelease(freq, 0.25, t + 0.9 + i * 0.06, 0.3));
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}

// ─── Quiz of the Week show ────────────────────────────────────────────────────
// A small game-show band, synthesised on first use (no files): a wood-block tick
// and snare for the spotlight roulette, a "ta-daa" when it lands, a buzzer, a
// gentle "wah-wah" for a missed question, whooshes, and a drum roll before the
// curtain call. Everything runs through one bus so closing the stage can fade it.
let quizChassis = null;
const quizBank = createVoiceBank((keep) => {
    if (!quizChassis) {
        const bus = new Tone.Gain(0.9).toDestination();
        quizChassis = { bus, reverb: new Tone.Reverb({ decay: 1.8, wet: 0.24 }).connect(bus) };
    }
    const { bus, reverb } = quizChassis;
    const v = lazyVoices({
        block: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 1.4,
            envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
            volume: -12
        }).connect(bus)),
        mallet: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.2 },
            volume: -9
        }, 12).connect(reverb),
        snareFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 1700 }).connect(bus)),
        snare: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.03 },
            volume: -20
        }).connect(v.snareFilter)),
        boom: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.06,
            octaves: 3,
            envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 },
            volume: -8
        }).connect(bus)),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 }).connect(reverb)),
        brass: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            envelope: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.4 },
            volume: -19
        }, 12).connect(v.brassFilter),
        bell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 5,
            envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.8 },
            modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
            volume: -14
        }, 14).connect(reverb),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 5000 }).connect(reverb)),
        cymbal: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.4 },
            volume: -26
        }).connect(v.cymbalFilter)),
        whooshFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 0.7 }).connect(reverb)),
        whoosh: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.12, decay: 0.3, sustain: 0, release: 0.1 },
            volume: 1
        }).connect(v.whooshFilter)),
        buzzFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 900, Q: 1 }).connect(bus)),
        buzz: () => mono(keep, new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.005, decay: 0.05, sustain: 0.8, release: 0.06 },
            volume: -15
        }).connect(v.buzzFilter)),
        // The "wah": a muted horn whose filter opens and closes on every note.
        hornFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 2.5 }).connect(reverb)),
        horn: () => mono(keep, new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.2 },
            volume: -12
        }).connect(v.hornFilter)),
        bus: () => bus,
    });
    return v;
}, { idle: 10, span: 6 });

/** The quiz show's band (also the Showdown's), kept awake for `seconds`. */
function getQuizVoices(seconds = 6) {
    return Tone ? quizBank.get(seconds) : null;
}

// A C-major ladder the roulette climbs, one rung per name.
const QUIZ_SPIN_LADDER = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];

// Starfall: a falling glissando and a soft chord as the window opens, one rising plink per
// jar as its star lands, and a warm closing chord.
const STARFALL_LADDER = ['E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7', 'C8'];

export function playStarfallSfx(name, opts = {}) {
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(3);
    const t = Tone.now() + 0.03;
    try {
        if (name === 'open') {
            sounds.award_sparkle.triggerAttackRelease('4n', t);
            ['C8', 'G7', 'E7', 'C7', 'G6', 'E6'].forEach((note, i) => sounds.award_bell.triggerAttackRelease(note, '32n', t + i * 0.07, 0.22 + i * 0.06));
            sounds.award_bell.triggerAttackRelease(['C6', 'G6', 'E7'], '8n', t + 0.68, 0.55);
            sounds.award_pad.triggerAttackRelease(['C5', 'G5', 'E6'], '2n', t + 0.66);
        } else if (name === 'catch') {
            const step = Math.max(0, Number(opts.step) || 0);
            sounds.award_bell.triggerAttackRelease(STARFALL_LADDER[step % STARFALL_LADDER.length], '32n', t, 0.5);
            if (step % 3 === 0) sounds.award_sparkle.triggerAttackRelease('16n', t);
        } else if (name === 'done') {
            sounds.award_pad.triggerAttackRelease(['F5', 'A5', 'C6', 'E6'], '2n', t);
            sounds.award_bell.triggerAttackRelease(['C7', 'E7', 'G7'], '8n', t + 0.06, 0.45);
        } else if (name === 'summon') {
            // A Starfall that waited for the lesson: a rising call before the window opens.
            ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'].forEach((note, i) => sounds.award_bell.triggerAttackRelease(note, '32n', t + i * 0.08, 0.2 + i * 0.05));
            sounds.award_pad.triggerAttackRelease(['G4', 'D5', 'B5'], '2n', t + 0.1);
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.45);
        } else if (name === 'reveal') {
            // One soft twinkle per scholar's name as their jar appears.
            const step = Math.max(0, Number(opts.step) || 0);
            sounds.award_bell.triggerAttackRelease(STARFALL_LADDER[step % STARFALL_LADDER.length], '64n', t, 0.22);
        }
    } catch (e) {
        console.warn('Starfall sound skipped:', e);
    }
}

/**
 * Birthday and name-day popups. 'open' a greeting chime · 'gift' birthday: a breath, then the
 * "Happy Birthday" opening phrase on bells · name day: a bouzouki-style tremolo climbing to a D-major chord.
 */
export function playOccasionSfx(type, phase) {
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(4);
    const t = Tone.now() + 0.03;
    const bell = (note, dur, at, vel) => sounds.award_bell.triggerAttackRelease(note, dur, t + at, vel);
    try {
        if (phase === 'open') {
            sounds.award_sparkle.triggerAttackRelease('8n', t);
            const notes = type === 'nameday' ? ['D6', 'F#6', 'A6', 'D7'] : ['G6', 'B6', 'D7', 'G7'];
            notes.forEach((n, i) => bell(n, '32n', i * 0.08, 0.3 + i * 0.08));
        } else if (type === 'birthday') {
            sounds.award_sparkle.triggerAttackRelease('4n', t);
            const beat = 0.27;
            [['G5', 0, 0.75], ['G5', 0.75, 0.25], ['A5', 1, 1], ['G5', 2, 1], ['C6', 3, 1], ['B5', 4, 2]]
                .forEach(([n, at, len]) => bell(n, len * beat * 0.9, 0.35 + at * beat, 0.7));
            sounds.award_pad.triggerAttackRelease(['C5', 'E5', 'G5'], 0.9, t + 0.35 + 3 * beat);
            sounds.award_pad.triggerAttackRelease(['G4', 'D5', 'B5'], 1.1, t + 0.35 + 4 * beat);
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.35 + 6 * beat);
        } else {
            ['A5', 'D6', 'F#6'].forEach((n, step) => {
                for (let k = 0; k < 4; k += 1) bell(n, '64n', step * 0.3 + k * 0.065, 0.35 + k * 0.08);
            });
            bell(['D6', 'F#6', 'A6', 'D7'], '4n', 0.95, 0.75);
            sounds.award_pad.triggerAttackRelease(['D5', 'F#5', 'A5'], 1.2, t + 0.95);
            sounds.award_sparkle.triggerAttackRelease('8n', t + 0.95);
        }
    } catch (e) {
        console.warn('Occasion sound skipped:', e);
    }
}

/**
 * The Portal story (features/portalMoments.js, ui/modals/portalStory.js), all in D major.
 * 'banner' bells climb and, as the class reaches the Portal, a chord blooms ({ gate } holds it
 * unresolved) · 'rune' one bell per rune ({ step, lit }) · 'open' the Portal swells open ·
 * 'step' one hero steps through ({ step }) · 'flash' · 'crest' a I-IV-V-I fanfare for the new
 * rank · 'gold' coins · 'sealed' a hopeful suspended chord · 'guardian' a low call at the gate.
 */
const PORTAL_STEPS = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7', 'F#7', 'A7'];

export function playPortalSfx(name, opts = {}) {
    if (!soundsReady || !audioRunning()) return;
    const sounds = getSounds(name === 'crest' || name === 'banner' ? 5 : 3);
    const t = Tone.now() + 0.03;
    const bell = (note, dur, at, vel) => sounds.award_bell.triggerAttackRelease(note, dur, t + at, vel);
    const pad = (notes, dur, at) => sounds.award_pad.triggerAttackRelease(notes, dur, t + at);
    try {
        if (name === 'banner') {
            sounds.award_sparkle.triggerAttackRelease('8n', t);
            ['A5', 'D6', 'F#6', 'A6'].forEach((n, i) => bell(n, '32n', i * 0.09, 0.3 + i * 0.08));
            const at = Number(opts.arriveAt) || 2.1;
            sounds.award_swell.triggerAttackRelease('D2', '4n', t + at);
            if (opts.gate) {
                pad(['D5', 'G5', 'A5'], 1.4, at);
                bell(['G6', 'A6'], '8n', at + 0.05, 0.5);
            } else {
                pad(['D5', 'F#5', 'A5', 'D6'], 1.6, at);
                bell(['D7', 'F#7', 'A7'], '8n', at + 0.05, 0.6);
                sounds.award_sparkle.triggerAttackRelease('4n', t + at);
            }
        } else if (name === 'rune') {
            const step = Math.max(0, Number(opts.step) || 0);
            if (opts.lit === false) bell('A5', '16n', 0, 0.22);
            else bell(PORTAL_STEPS[(step * 2) % PORTAL_STEPS.length], '16n', 0, 0.55);
        } else if (name === 'open') {
            sounds.award_swell.triggerAttackRelease('D2', '2n', t);
            pad(['D4', 'A4', 'F#5'], 2.2, 0);
            sounds.award_sparkle.triggerAttackRelease('2n', t + 0.1);
            ['A7', 'F#7', 'D7', 'A6', 'F#6', 'D6'].forEach((n, i) => bell(n, '32n', 0.25 + i * 0.07, 0.18 + i * 0.05));
        } else if (name === 'step') {
            const step = Math.max(0, Number(opts.step) || 0);
            bell(PORTAL_STEPS[step % PORTAL_STEPS.length], '32n', 0, 0.32);
        } else if (name === 'flash') {
            sounds.award_swell.triggerAttackRelease('A1', '2n', t);
            sounds.award_sparkle.triggerAttackRelease('2n', t);
            bell(['D6', 'A6', 'D7'], '8n', 0.02, 0.6);
        } else if (name === 'crest') {
            ['D6', 'F#6', 'A6', 'D7'].forEach((n, i) => bell(n, '32n', i * 0.11, 0.45 + i * 0.08));
            pad(['D4', 'F#4', 'A4'], 0.6, 0);
            pad(['G4', 'B4', 'D5'], 0.55, 0.62);
            bell(['G6', 'B6'], '16n', 0.62, 0.5);
            pad(['A4', 'C#5', 'E5'], 0.55, 1.12);
            bell(['A6', 'C#7'], '16n', 1.12, 0.55);
            pad(['D5', 'F#5', 'A5', 'D6'], 2.4, 1.62);
            bell(['D7', 'F#7', 'A7'], '4n', 1.62, 0.75);
            sounds.award_swell.triggerAttackRelease('D2', '2n', t + 1.62);
            sounds.award_sparkle.triggerAttackRelease('2n', t + 1.62);
        } else if (name === 'gold') {
            [['B6', 'E7'], ['C7', 'G7'], ['D7', 'A7']].forEach((pair, i) => sounds.cash.triggerAttackRelease(pair, '16n', t + i * 0.09));
        } else if (name === 'sealed') {
            pad(['D4', 'G4', 'A4'], 2, 0);
            ['A6', 'G6', 'E6', 'D6'].forEach((n, i) => bell(n, '16n', i * 0.16, 0.42 - i * 0.05));
            bell(['D6', 'G6', 'A6'], '4n', 0.75, 0.35);
        } else if (name === 'guardian') {
            sounds.award_swell.triggerAttackRelease('D2', '2n', t);
            pad(['D4', 'F4', 'A4'], 1.8, 0);
            ['A5', 'F5', 'D5'].forEach((n, i) => bell(n, '8n', 0.2 + i * 0.22, 0.45));
        }
    } catch (e) {
        console.warn('Portal sound skipped:', e);
    }
}

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
    const gain = quizChassis?.bus?.gain;
    if (!gain || !Tone) return;
    const now = Tone.now();
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.25);
}

// ─── Sorting Ceremony (guild placement reveal) ──────────────────────────────
// "The stars are deciding": a held drone opens as the spotlight starts racing round the four guild
// seats. Every guild has its own chord, so the racing spotlight plays a real progression
// (Dragon Dm · Grizzly B♭ · Owl F · Phoenix A, the old i–VI–III–V of film scores): a bell climbs
// that guild's chord on each flash, the bass names its root, and a shaker fills the gap to the next
// seat. As the spotlight slows, a heartbeat drum joins and the last gap swells into the landing,
// where the chosen guild gets its own fanfare in its own key. Everything is on one bus, so closing
// the ceremony fades it, and every note goes straight on the audio clock (no Transport, no PolySynth).
const SORTING_HARMONY = {
    dragon_flame: {
        flash: ['D4', 'F4', 'A4', 'D5', 'F5', 'A5', 'D6'],
        root: 'D2',
        land: ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'],
        boom: 'D1',
        // Fierce rising fourths, then the brass hits the chord twice like a dragon's wingbeat.
        motif: [['A4', 0, 0.14], ['D5', 0.16, 0.14], ['A5', 0.32, 0.5]],
        sparkle: ['D6', 'F#6', 'A6', 'D7'],
    },
    grizzly_might: {
        flash: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'F5', 'Bb5'],
        root: 'Bb1',
        land: ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'Bb4'],
        boom: 'Bb0',
        // Heavy, low and steady: three stomps up the chord.
        motif: [['F3', 0, 0.22], ['Bb3', 0.26, 0.22], ['D4', 0.52, 0.6]],
        sparkle: ['Bb5', 'D6', 'F6', 'Bb6'],
    },
    owl_wisdom: {
        flash: ['F4', 'A4', 'C5', 'F5', 'A5', 'C6', 'F6'],
        root: 'F2',
        land: ['F3', 'C4', 'F4', 'A4', 'C5', 'F5'],
        boom: 'F1',
        // A gentle "hoo-hoo" on the bells (a falling third, twice), then home.
        motif: [['C6', 0, 0.2], ['A5', 0.22, 0.3], ['C6', 0.6, 0.2], ['A5', 0.82, 0.3], ['F6', 1.18, 0.7]],
        sparkle: ['F6', 'A6', 'C7', 'F7'],
        bells: true,
    },
    phoenix_rising: {
        flash: ['A3', 'C#4', 'E4', 'A4', 'C#5', 'E5', 'A5'],
        root: 'A1',
        land: ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4'],
        boom: 'A0',
        // A harp sweeps up two octaves like a bird taking off, then the brass soars.
        motif: [['E5', 0.34, 0.16], ['A5', 0.5, 0.7]],
        sparkle: ['A6', 'C#7', 'E7', 'A7'],
        rise: ['A4', 'C#5', 'E5', 'A5', 'C#6', 'E6', 'A6'],
    },
};

let sortingChassis = null;
const sortingBank = createVoiceBank((keep) => {
    if (!sortingChassis) {
        const bus = new Tone.Gain(0.9).toDestination();
        sortingChassis = { bus, reverb: new Tone.Reverb({ decay: 3.2, wet: 0.34 }).connect(bus) };
    }
    const { bus, reverb } = sortingChassis;
    const v = lazyVoices({
        padFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 280, Q: 0.8 }).connect(reverb)),
        pad: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 26 },
            envelope: { attack: 1.1, decay: 0.4, sustain: 0.85, release: 1.4 },
            volume: -25
        }, 8).connect(v.padFilter),
        bell: () => pool(keep, Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 4,
            envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.9 },
            modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
            volume: -15
        }, 14).connect(reverb),
        harp: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.5 },
            volume: -15
        }, 12).connect(reverb),
        bass: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.005, decay: 0.35, sustain: 0.1, release: 0.3 },
            volume: -16
        }, 4).connect(bus),
        shakerFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 6500 }).connect(bus)),
        shaker: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.004, decay: 0.045, sustain: 0, release: 0.02 },
            volume: -24
        }).connect(v.shakerFilter)),
        heart: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2.5,
            envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 },
            volume: -17
        }).connect(bus)),
        swellFilter: () => keep(new Tone.Filter({ type: 'bandpass', frequency: 800, Q: 0.6 }).connect(reverb)),
        swell: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.6, decay: 0.1, sustain: 1, release: 0.15 },
            volume: -20
        }).connect(v.swellFilter)),
        brassFilter: () => keep(new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.7 }).connect(reverb)),
        brass: () => pool(keep, Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            envelope: { attack: 0.025, decay: 0.2, sustain: 0.7, release: 0.6 },
            volume: -19
        }, 12).connect(v.brassFilter),
        boom: () => mono(keep, new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 3,
            envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.4 },
            volume: -6
        }).connect(bus)),
        cymbalFilter: () => keep(new Tone.Filter({ type: 'highpass', frequency: 4800 }).connect(reverb)),
        cymbal: () => mono(keep, new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.002, decay: 2.2, sustain: 0, release: 0.5 },
            volume: -24
        }).connect(v.cymbalFilter)),
        bus: () => bus,
    });
    return v;
}, { idle: 8, span: 6 });

/** Builds the ceremony band ahead of time (the reverb takes a moment), so the reveal starts on time. */
export function warmSortingMusic() {
    if (!isAudioReady() || ceremonyMuted) return;
    sortingBank.get(20);
}

/**
 * The Sorting Ceremony reveal music.
 * 'gather' the spotlight is about to race ({ seconds } until the landing, roughly) · 'flash' a seat
 * lights up ({ guildId, step, steps, gap } with gap in seconds until the next seat) · 'land' the
 * chosen guild ({ guildId }).
 */
export function playSortingMusic(name, opts = {}) {
    if (ceremonyMuted || !isAudioReady()) return;
    const v = sortingBank.get(8);
    const now = Tone.now();
    const t = now + 0.03;
    try {
        if (name === 'gather') {
            sortingBank.hold();
            v.bus.gain.cancelScheduledValues(now);
            v.bus.gain.setValueAtTime(0.9, now);
            const seconds = Math.max(1.5, Number(opts.seconds) || 5);
            v.pad.releaseAll(t);
            v.padFilter.frequency.cancelScheduledValues(t);
            v.padFilter.frequency.setValueAtTime(260, t);
            v.padFilter.frequency.exponentialRampToValueAtTime(2000, t + seconds);
            v.pad.triggerAttack(['D2', 'A2', 'D3', 'A3'], t, 0.8);
            // A descending sparkle as the stars "wake", and a first soft heartbeat.
            ['A6', 'F6', 'D6', 'A5', 'F5', 'D5'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.5, t + i * 0.08, 0.25 + i * 0.05));
            v.heart.triggerAttackRelease('D2', 0.3, t + 0.55, 0.45);
        } else if (name === 'flash') {
            const h = SORTING_HARMONY[opts.guildId];
            if (!h) return;
            const steps = Math.max(1, Number(opts.steps) || 1);
            const step = Math.max(0, Math.min(Number(opts.step) || 0, steps - 1));
            const k = steps > 1 ? step / (steps - 1) : 1;
            const gap = Math.max(0.05, Number(opts.gap) || 0.08);
            const last = step === steps - 1;
            // The bell climbs the guild's chord as the spotlight slows; the bass names the chord.
            const rung = Math.min(h.flash.length - 1, Math.floor(k * (h.flash.length - 1) + (step % 2) * 0.5));
            v.bell.triggerAttackRelease(h.flash[rung], Math.min(0.6, gap + 0.2), t, 0.3 + 0.45 * k);
            v.bass.triggerAttackRelease(h.root, Math.min(0.5, gap * 0.9), t, 0.35 + 0.5 * k);
            if (gap >= 0.2) {
                // Slow enough to hear each guild: a harp plays its chord and the heart beats.
                v.harp.triggerAttackRelease(h.flash.slice(0, 3), Math.min(0.6, gap), t, 0.35 + 0.35 * k);
                v.heart.triggerAttackRelease(h.root.replace(/\d$/, '2'), 0.25, t, 0.4 + 0.5 * k);
            }
            if (last) {
                // Hold your breath: the swell and a quickening heartbeat carry straight into the landing.
                v.swellFilter.frequency.cancelScheduledValues(t);
                v.swellFilter.frequency.setValueAtTime(500, t);
                v.swellFilter.frequency.exponentialRampToValueAtTime(4200, t + gap);
                v.swell.triggerAttackRelease(gap, t, 0.9);
                [0.42, 0.66, 0.8, 0.9].forEach((x) => v.heart.triggerAttackRelease(h.root.replace(/\d$/, '2'), 0.15, t + gap * x, 0.5 + 0.4 * x));
            } else {
                for (let dt = 0.04; dt < gap - 0.015; dt += 0.04) {
                    v.shaker.triggerAttackRelease(0.03, t + dt, 0.25 + 0.5 * k);
                }
            }
        } else if (name === 'land') {
            const h = SORTING_HARMONY[opts.guildId] || SORTING_HARMONY.dragon_flame;
            v.bus.gain.cancelScheduledValues(now);
            v.bus.gain.setValueAtTime(0.9, now);
            // The drone resolves into the guild's own chord.
            v.pad.releaseAll(t);
            v.padFilter.frequency.cancelScheduledValues(t);
            v.padFilter.frequency.setValueAtTime(2200, t);
            v.padFilter.frequency.exponentialRampToValueAtTime(700, t + 3.5);
            v.pad.triggerAttackRelease(h.land.slice(0, 4), 2.6, t, 0.9);
            v.boom.triggerAttackRelease(h.boom, 0.9, t, 0.95);
            v.cymbal.triggerAttackRelease(2, t, 0.9);
            v.brass.triggerAttackRelease(h.land, 0.9, t, 0.95);
            (h.rise || []).forEach((n, i) => v.harp.triggerAttackRelease(n, 0.5, t + 0.04 + i * 0.045, 0.6));
            const motifStart = t + 0.5;
            h.motif.forEach(([note, at, len]) => {
                if (h.bells) v.bell.triggerAttackRelease(note, len + 0.3, motifStart + at, 0.7);
                else v.brass.triggerAttackRelease(note, len, motifStart + at, 0.85);
            });
            const endAt = motifStart + h.motif[h.motif.length - 1][1];
            v.brass.triggerAttackRelease(h.land.slice(1), 1.4, endAt + 0.02, 0.8);
            v.boom.triggerAttackRelease(h.boom, 0.9, endAt + 0.02, 0.7);
            h.sparkle.forEach((n, i) => v.bell.triggerAttackRelease(n, 0.9, t + 0.12 + i * 0.07, 0.45));
            h.sparkle.forEach((n, i) => v.bell.triggerAttackRelease(n, 1.2, endAt + 0.1 + i * 0.09, 0.35));
            sortingBank.release(6);
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}

/** Fade out the reveal music (the ceremony closed or the save failed). */
export function stopSortingMusic() {
    if (!Tone || !sortingChassis) return;
    const now = Tone.now();
    const gain = sortingChassis.bus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + 0.35);
    if (sortingBank.awake) {
        try { sortingBank.get(1).pad.releaseAll(now + 0.3); } catch (_) { /* gone */ }
    }
    sortingBank.release(2);
}

// ─── Showdown Arena (Quest Remote) ──────────────────────────────────────────
// Its own game-show voice on the quiz bus: every team has a signature motif in its own key (so the class
// hears WHO scored without looking), a clock that ticks like a stage clock and beats like a heart at the
// end, a gong for time's up, a reveal sparkle, a lead-change sting, a drum roll into the champions'
// fanfare. All synthesised (no files to download), short, and a weak laptop plays them as easily as a click.

// One pentatonic root per team (red, blue, amber, green, purple, pink, teal, orange lanes).
const SHOWDOWN_TEAM_KEYS = ['C', 'E', 'G', 'A', 'D', 'F', 'B', 'D#'];
const SD_MAJOR_PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function sdNote(root, step, octave) {
    const base = NOTE_NAMES.indexOf(root);
    const semis = base + SD_MAJOR_PENTA[step % SD_MAJOR_PENTA.length] + 12 * Math.floor(step / SD_MAJOR_PENTA.length);
    return `${NOTE_NAMES[((semis % 12) + 12) % 12]}${octave + Math.floor(semis / 12)}`;
}

/**
 * Showdown sound effects.
 * 'open' the arena opens ({ teams }) · 'rollcall' one face pops in ({ team, step }) · 'score' a point
 * ({ team, points, golden, growth }) · 'streak' ({ n }) · 'underdog' · 'lead' a new leader · 'minus' ·
 * 'question' a new question ({ last }) · 'card' a deck card flips in · 'reveal' the answer is shown ·
 * 'clockstart' · 'tick' ({ left }) · 'timeup' · 'golden' · 'blind' ({ on }) · 'pass' the microphone moves ·
 * 'undo' · 'goal' the goal is reached · 'finale' ({ dragon }) the champions · 'close'.
 * The other games: 'chorus' several teams scored at once ({ n }) · 'tug' a heave on the rope ({ team }) ·
 * 'miss' a Survivor heart cracks ({ team }) · 'knockout' a team is out · 'chest' a Treasure chest opens
 * ({ kind: coins | double | steal }) · 'steal' a coin is snatched from another team.
 */
export function playShowdownSfx(name, opts = {}) {
    if (!isAudioReady()) return;
    const v = getQuizVoices();
    if (!v) return;
    const now = Tone.now();
    v.bus.gain.cancelScheduledValues(now);
    v.bus.gain.setValueAtTime(0.9, now);
    const t = now + 0.03;
    const key = SHOWDOWN_TEAM_KEYS[Math.abs(Number(opts.team) || 0) % SHOWDOWN_TEAM_KEYS.length];
    try {
        if (name === 'open') {
            v.whooshFilter.frequency.setValueAtTime(250, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(3000, t + 0.7);
            v.whoosh.triggerAttackRelease(0.6, t, 0.9);
            for (let dt = 0, i = 0; dt < 1.1; dt += 0.05, i++) {
                const k = dt / 1.1;
                v.snare.triggerAttackRelease(0.04, t + 0.2 + dt, 0.15 + 0.6 * k * k);
                if (i % 5 === 0) v.boom.triggerAttackRelease('G1', 0.15, t + 0.2 + dt, 0.25 + 0.4 * k);
            }
            const at = t + 1.35;
            v.boom.triggerAttackRelease('C2', 0.6, at, 1);
            v.cymbal.triggerAttackRelease(1.6, at, 0.9);
            v.brass.triggerAttackRelease(['G3', 'C4', 'E4', 'G4'], 0.14, at, 0.85);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 0.9, at + 0.18, 1);
            const teams = Math.max(2, Math.min(8, Number(opts.teams) || 2));
            for (let i = 0; i < teams; i++) {
                v.bell.triggerAttackRelease(sdNote(SHOWDOWN_TEAM_KEYS[i], 4, 5), 0.5, at + 0.45 + i * 0.12, 0.45);
            }
        } else if (name === 'rollcall') {
            const step = Math.max(0, Number(opts.step) || 0);
            v.mallet.triggerAttackRelease(sdNote(key, step % 6, 5), 0.1, t, 0.35);
            v.block.triggerAttackRelease(step % 2 ? 'A5' : 'E5', 0.03, t, 0.25);
        } else if (name === 'score') {
            const points = Math.max(1, Math.min(6, Number(opts.points) || 1));
            if (opts.growth) {
                // little ones: a soft marimba bloom, no brass
                [0, 2, 4].forEach((s, i) => v.mallet.triggerAttackRelease(sdNote(key, s, 5), 0.25, t + i * 0.09, 0.5));
                v.bell.triggerAttackRelease(sdNote(key, 5, 5), 0.8, t + 0.3, 0.4);
                return;
            }
            // the team's motif: a run up its pentatonic scale, one step longer per point
            const steps = Math.min(7, 2 + points);
            for (let i = 0; i < steps; i++) v.mallet.triggerAttackRelease(sdNote(key, i, 5), 0.14, t + i * 0.065, 0.45 + i * 0.06);
            const land = t + steps * 0.065;
            v.brass.triggerAttackRelease([sdNote(key, 0, 4), sdNote(key, 2, 4), sdNote(key, 4, 4)], points > 1 ? 0.6 : 0.35, land, 0.8);
            v.boom.triggerAttackRelease(points > 1 ? 'C2' : 'G2', 0.3, land, 0.7);
            v.bell.triggerAttackRelease([sdNote(key, 5, 5), sdNote(key, 7, 5)], 0.7, land + 0.05, 0.5);
            if (points > 1) v.cymbal.triggerAttackRelease(1, land, 0.7);
            if (opts.golden) ['C7', 'G6', 'E7', 'C7', 'G7', 'E7', 'C8'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.3, land + 0.15 + i * 0.045, 0.35));
        } else if (name === 'streak') {
            const n = Math.max(2, Number(opts.n) || 3);
            v.whooshFilter.frequency.setValueAtTime(400, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(4000, t + 0.4);
            v.whoosh.triggerAttackRelease(0.35, t, 0.8);
            const top = ['E4', 'G4', 'A4', 'C5'][Math.min(3, Math.floor(n / 3))];
            v.brass.triggerAttackRelease(['C4', top], 0.1, t + 0.32, 0.8);
            v.brass.triggerAttackRelease(['E4', 'G4', top.replace('4', '5')], 0.45, t + 0.46, 0.9);
        } else if (name === 'underdog') {
            ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.08, t + i * 0.03, 0.4));
            v.bell.triggerAttackRelease(['G6', 'C7'], 0.6, t + 0.24, 0.5);
        } else if (name === 'lead') {
            // "Oooh, a new leader!": dominant to tonic on the horns
            v.horn.triggerAttackRelease('G3', 0.18, t, 0.7);
            v.hornFilter.frequency.setValueAtTime(600, t);
            v.hornFilter.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4'], 0.4, t + 0.22, 0.7);
        } else if (name === 'minus') {
            v.mallet.triggerAttackRelease('E5', 0.12, t, 0.4);
            v.mallet.triggerAttackRelease('A4', 0.25, t + 0.12, 0.4);
        } else if (name === 'question') {
            v.whooshFilter.frequency.setValueAtTime(500, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
            v.whoosh.triggerAttackRelease(0.25, t, 0.6);
            if (opts.last) {
                // the last question: a low swell and a held breath
                v.boom.triggerAttackRelease('D2', 0.8, t + 0.15, 0.9);
                v.brass.triggerAttackRelease(['D3', 'A3', 'D4'], 0.9, t + 0.15, 0.6);
                for (let dt = 0; dt < 0.7; dt += 0.05) v.snare.triggerAttackRelease(0.04, t + 0.2 + dt, 0.1 + 0.5 * (dt / 0.7));
            } else {
                v.bell.triggerAttackRelease(['E6', 'B6'], 0.5, t + 0.2, 0.4);
            }
        } else if (name === 'card') {
            v.block.triggerAttackRelease('C6', 0.03, t, 0.4);
            v.whooshFilter.frequency.setValueAtTime(3000, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(900, t + 0.25);
            v.whoosh.triggerAttackRelease(0.2, t, 0.5);
            ['G5', 'C6', 'E6'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.12, t + 0.12 + i * 0.05, 0.35));
        } else if (name === 'reveal') {
            ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + i * 0.06, 0.45));
            v.brass.triggerAttackRelease(['F4', 'A4', 'C5'], 0.5, t + 0.2, 0.55);
        } else if (name === 'clockstart') {
            v.block.triggerAttackRelease('G5', 0.04, t, 0.6);
            v.block.triggerAttackRelease('C6', 0.05, t + 0.18, 0.75);
        } else if (name === 'tick') {
            const left = Math.max(0, Number(opts.left) || 0);
            if (left <= 3) {
                // the heart beats: lub-dub, and the tick climbs
                v.boom.triggerAttackRelease('A1', 0.12, t, 0.55);
                v.boom.triggerAttackRelease('A1', 0.1, t + 0.16, 0.4);
                v.block.triggerAttackRelease(['G5', 'A5', 'C6'][3 - Math.max(1, left)] || 'C6', 0.04, t, 0.7);
            } else {
                v.block.triggerAttackRelease(left % 2 ? 'E5' : 'A5', 0.03, t, left <= 5 ? 0.45 : 0.25);
            }
        } else if (name === 'timeup') {
            // a gong rather than a harsh buzzer: boom, wash and a falling horn
            v.boom.triggerAttackRelease('C2', 1.2, t, 1);
            v.cymbal.triggerAttackRelease(2.2, t, 1);
            v.bell.triggerAttackRelease(['C4', 'G4', 'C5'], 1.6, t, 0.6);
            v.horn.triggerAttackRelease('G3', 0.5, t + 0.1, 0.6);
            v.hornFilter.frequency.setValueAtTime(1400, t + 0.1);
            v.hornFilter.frequency.exponentialRampToValueAtTime(380, t + 0.6);
        } else if (name === 'golden') {
            ['C7', 'E7', 'G7', 'C8', 'G7', 'E7', 'C7', 'E7', 'G7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.3, t + i * 0.05, 0.35 + (i % 3) * 0.08));
            v.brass.triggerAttackRelease(['E4', 'G4', 'C5'], 0.5, t + 0.35, 0.6);
        } else if (name === 'blind') {
            const notes = opts.on ? ['E5', 'C5', 'A4', 'E4'] : ['E4', 'A4', 'C5', 'E5'];
            notes.forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.3, t + i * 0.09, 0.4));
            if (opts.on) v.boom.triggerAttackRelease('E1', 0.6, t + 0.3, 0.5);
        } else if (name === 'pass') {
            v.mallet.triggerAttackRelease('G5', 0.08, t, 0.4);
            v.mallet.triggerAttackRelease('D6', 0.12, t + 0.08, 0.45);
            v.block.triggerAttackRelease('C6', 0.03, t + 0.08, 0.3);
        } else if (name === 'undo') {
            v.whooshFilter.frequency.setValueAtTime(2600, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(300, t + 0.35);
            v.whoosh.triggerAttackRelease(0.3, t, 0.6);
            ['C6', 'A5', 'F5', 'D5'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.07, t + i * 0.04, 0.35));
        } else if (name === 'goal') {
            for (let dt = 0; dt < 1.2; dt += 0.04) {
                const k = dt / 1.2;
                v.snare.triggerAttackRelease(0.04, t + dt, 0.15 + 0.75 * k * k);
            }
            v.boom.triggerAttackRelease('G1', 1.2, t, 0.5);
        } else if (name === 'finale') {
            v.boom.triggerAttackRelease('C2', 0.6, t, 1);
            v.cymbal.triggerAttackRelease(2.2, t, 1);
            if (opts.dragon) {
                // the Dragon wins: a grand minor roar, then a hopeful turn ("next time!")
                v.brass.triggerAttackRelease(['C3', 'G3', 'C4', 'D#4'], 0.9, t, 0.95);
                v.horn.triggerAttackRelease('C3', 0.9, t, 0.8);
                v.brass.triggerAttackRelease(['F3', 'C4', 'F4', 'A4'], 1.2, t + 1, 0.8);
                return;
            }
            v.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.12, t, 0.75);
            v.brass.triggerAttackRelease(['G3', 'C4', 'E4'], 0.12, t + 0.16, 0.75);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 0.6, t + 0.32, 0.95);
            v.brass.triggerAttackRelease(['C4', 'F4', 'A4', 'C5'], 0.3, t + 0.95, 0.85);
            v.brass.triggerAttackRelease(['D4', 'G4', 'B4', 'D5'], 0.3, t + 1.25, 0.85);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5', 'E5'], 1.6, t + 1.55, 1);
            v.boom.triggerAttackRelease('C2', 0.6, t + 1.55, 0.95);
            v.cymbal.triggerAttackRelease(2.2, t + 1.55, 0.85);
            // the podium rises: third, second, first
            ['G5', 'C6', 'E6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.6, t + 2.3 + i * 0.3, 0.5));
            ['C7', 'E7', 'G7', 'C8'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.8, t + 3.2 + i * 0.07, 0.45));
        } else if (name === 'chorus') {
            // several teams at once: their motifs ring together and a big chord crowns them
            const n = Math.max(2, Math.min(8, Number(opts.n) || 3));
            v.cymbal.triggerAttackRelease(1.2, t, 0.6);
            v.brass.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 0.7, t, 0.8);
            for (let i = 0; i < n; i++) v.bell.triggerAttackRelease(sdNote(SHOWDOWN_TEAM_KEYS[i], 5, 5), 0.6, t + 0.08 + i * 0.05, 0.35);
        } else if (name === 'tug') {
            // a heave: a low thud, the rope creaks (a falling filtered rasp) and the team's two-note "hup!"
            v.boom.triggerAttackRelease('D2', 0.25, t, 0.8);
            v.whooshFilter.frequency.setValueAtTime(1400, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(350, t + 0.3);
            v.whoosh.triggerAttackRelease(0.22, t, 0.55);
            v.horn.triggerAttackRelease(sdNote(key, 0, 3), 0.12, t + 0.05, 0.55);
            v.hornFilter.frequency.setValueAtTime(500, t + 0.05);
            v.hornFilter.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
            v.horn.triggerAttackRelease(sdNote(key, 2, 3), 0.16, t + 0.2, 0.6);
        } else if (name === 'miss') {
            // a heart cracks: a glassy tink, a little fall, a soft thud
            v.bell.triggerAttackRelease('E7', 0.2, t, 0.4);
            v.bell.triggerAttackRelease('A#6', 0.25, t + 0.06, 0.35);
            ['E5', 'C5', 'G#4'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.14, t + 0.12 + i * 0.09, 0.4));
            v.boom.triggerAttackRelease('E1', 0.3, t + 0.3, 0.45);
        } else if (name === 'knockout') {
            // out: a buzzer, a falling horn (the "wah-wah") and a gong
            v.buzz.triggerAttackRelease('A2', 0.3, t, 0.5);
            [['G3', 0.3], ['F#3', 0.3], ['F3', 0.7]].forEach(([n, d], i) => {
                const at = t + 0.35 + i * 0.32;
                v.horn.triggerAttackRelease(n, d, at, 0.65);
                v.hornFilter.frequency.setValueAtTime(400, at);
                v.hornFilter.frequency.exponentialRampToValueAtTime(1500, at + 0.12);
                v.hornFilter.frequency.exponentialRampToValueAtTime(400, at + d);
            });
            v.boom.triggerAttackRelease('C2', 1, t + 1.3, 0.8);
            v.cymbal.triggerAttackRelease(1.4, t + 1.3, 0.6);
        } else if (name === 'chest') {
            // the lid creaks open (a wood block and a rising rasp), then what is inside sings out
            v.block.triggerAttackRelease('C5', 0.04, t, 0.5);
            v.whooshFilter.frequency.setValueAtTime(300, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
            v.whoosh.triggerAttackRelease(0.2, t, 0.5);
            const at = t + 0.28;
            if (opts.kind === 'double') {
                ['E6', 'B6', 'E7', 'G#7', 'B7'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.5, at + i * 0.06, 0.4));
                v.brass.triggerAttackRelease(['E4', 'G#4', 'B4'], 0.5, at + 0.2, 0.6);
            } else if (opts.kind === 'steal') {
                // sneaky: a pizzicato tiptoe in minor
                ['A4', 'C5', 'E5', 'D#5', 'E5'].forEach((n, i) => v.mallet.triggerAttackRelease(n, 0.08, at + i * 0.1, 0.45));
            } else {
                // coins: a shower of bright clinks
                for (let i = 0; i < 7; i++) v.bell.triggerAttackRelease(['C7', 'G7', 'E7', 'C8', 'A7', 'D8', 'G7'][i], 0.18, at + i * 0.045, 0.3);
                v.brass.triggerAttackRelease(['C5', 'E5', 'G5'], 0.35, at + 0.3, 0.55);
            }
        } else if (name === 'steal') {
            v.whooshFilter.frequency.setValueAtTime(3000, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(600, t + 0.3);
            v.whoosh.triggerAttackRelease(0.25, t, 0.5);
            v.bell.triggerAttackRelease(['E7', 'C7'], 0.2, t + 0.25, 0.35);
        } else if (name === 'close') {
            v.whooshFilter.frequency.setValueAtTime(2400, t);
            v.whooshFilter.frequency.exponentialRampToValueAtTime(300, t + 0.5);
            v.whoosh.triggerAttackRelease(0.45, t, 0.8);
            ['C7', 'G6', 'E6', 'C6'].forEach((n, i) => v.bell.triggerAttackRelease(n, 0.5, t + 0.1 + i * 0.07, 0.35));
        }
    } catch (_) { /* overlapping triggers are harmless */ }
}
