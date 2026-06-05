import * as state from './state.js';

let sounds = {};
export let ceremonyMusic = {};
export let winnerFanfare = {};
export let showdownSting = {};
export let heroFanfare = {};
let soundsReady = false;
let soundSetupPromise = null;
let audioStartPromise = null;
let lastSoundTime = 0; // Track the time of the last scheduled sound

export async function setupSounds() {
    if (soundSetupPromise) return soundSetupPromise;

    soundSetupPromise = (async () => {
        try {
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

            ceremonyMusic = new Tone.Player({
                url: "assets/ceremony_reveal.mp3",
                loop: true,
                volume: -12,
                onload: () => console.log("Ceremony Music Loaded"),
                onerror: (e) => console.warn("Ceremony Music failed to load", e)
            }).toDestination();

            winnerFanfare = new Tone.Player({
                url: "assets/ceremony_winner.mp3",
                volume: -3,
                onload: () => console.log("Winner Fanfare Loaded"),
                onerror: (e) => console.warn("Winner Fanfare failed to load", e)
            }).toDestination();

            showdownSting = new Tone.Player({
                url: "assets/ceremony_showdown.mp3",
                volume: -6,
                onload: () => console.log("Showdown Sting Loaded"),
                onerror: (e) => console.warn("Showdown Sting failed to load", e)
            }).toDestination();

            heroFanfare = new Tone.Player({
                url: "assets/hero_fanfare.mp3",
                volume: -2,
                onload: () => console.log("Hero Fanfare Loaded"),
                onerror: (e) => console.warn("Hero Fanfare failed to load", e)
            }).toDestination();

            soundsReady = true;
            console.log("Audio SFX Ready");

            Tone.loaded()
                .then(() => console.log("Audio Player Buffers Ready"))
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
    if (!sounds[sound]) return;
    
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

export function activateAudioContext() {
    if (typeof Tone === 'undefined') return Promise.resolve(false);
    if (Tone.context.state === 'running') return Promise.resolve(true);
    if (audioStartPromise) return audioStartPromise;

    audioStartPromise = Tone.start()
        .then(() => {
            console.log("Audio Context Started");
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
    await activateAudioContext();
    await setupSounds();
    return soundsReady && Tone.context.state === 'running';
}

export function isAudioReady() {
    return soundsReady && typeof Tone !== 'undefined' && Tone.context.state === 'running';
}

export function stopAllCeremonyAudio() {
    if (soundsReady) {
        try {
            if (ceremonyMusic.state === "started") ceremonyMusic.stop();
            if (winnerFanfare.state === "started") winnerFanfare.stop();
            if (showdownSting.state === "started") showdownSting.stop();
        } catch(e) { console.log("Audio stop safe error"); }
    }
}

export function playCeremonyMusic() {
    if (soundsReady && ceremonyMusic.loaded) {
        // Reset volume just in case it was faded out previously
        ceremonyMusic.volume.value = -12; 
        ceremonyMusic.start();
    }
}

export function playWinnerFanfare() {
    if (soundsReady && winnerFanfare.loaded) {
        winnerFanfare.start();
    }
}

export function playShowdownSting() {
    if (soundsReady && showdownSting.loaded) {
        showdownSting.start();
    }
}

export function fadeCeremonyMusic(volume, duration) {
     if (soundsReady && ceremonyMusic.loaded) {
        ceremonyMusic.volume.rampTo(volume, duration);
    }
}

let drumRollLoop;
export function playDrumRoll() {
    if (!soundsReady) return;
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

let writingLoop;
export function playWritingLoop() {
    if (!soundsReady) return;
    // Play a gentle writing sound every quarter note
    writingLoop = new Tone.Loop(time => {
        // Randomize playback rate slightly for realism
        sounds.writing.noise.playbackRate = 0.5 + (Math.random() * 0.2); 
        sounds.writing.triggerAttackRelease("16n", time);
    }, "8n").start(0);
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

export function playHeroFanfare() {
    if (soundsReady && heroFanfare.loaded) {
        heroFanfare.start();
    }
}
