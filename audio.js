import * as state from './state.js';

let sounds = {};
export let ceremonyMusic = {};
export let winnerFanfare = {};
export let showdownSting = {};
export let heroFanfare = {};
let soundsReady = false;
let lastSoundTime = 0; // Track the time of the last scheduled sound

export async function setupSounds() {
    try {
        
        // SFX Synths
        const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.3 }).toDestination();
        sounds.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05 } }).toDestination();
        sounds.confirm = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.2 }, volume: -15 }).toDestination();
        sounds.star_remove = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.01, release: 0.3 }, volume: -10 }).toDestination();
        sounds.click.volume.value = -25;
        
        sounds.writing = new Tone.NoiseSynth({ noise: { type: "white", playbackRate: 0.5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -20 }).toDestination();
        sounds.magic_chime = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 2000, resonance: 0.9, volume: -12 }).connect(reverb);
        // NEW: Coin Sound
        sounds.cash = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
        sounds.cash.volume.value = -10;
        // Procedural Snare for Drumroll
        sounds.snare = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        sounds.snare.volume.value = -10;

        sounds.star1 = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.7, volume: -10 }).connect(reverb);
        sounds.star2 = new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.8, volume: -8 }).connect(reverb);
        
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
        
        // Music Players (Using relative paths - Ensure files are in root)
        ceremonyMusic = new Tone.Player({
            url: "ceremony_reveal.mp3",
            loop: true,
            volume: -12,
            onload: () => console.log("Ceremony Music Loaded"),
            onerror: (e) => console.warn("Ceremony Music failed to load", e)
        }).toDestination();

        winnerFanfare = new Tone.Player({
            url: "ceremony_winner.mp3",
            volume: -3,
            onload: () => console.log("Winner Fanfare Loaded"),
            onerror: (e) => console.warn("Winner Fanfare failed to load", e)
        }).toDestination();

        showdownSting = new Tone.Player({
            url: "ceremony_showdown.mp3",
            volume: -6,
            onload: () => console.log("Showdown Sting Loaded"),
            onerror: (e) => console.warn("Showdown Sting failed to load", e)
        }).toDestination();

        heroFanfare = new Tone.Player({
            url: "hero_fanfare.mp3", // Make sure your file is named exactly this!
            volume: -2, // Slightly louder for impact
            onload: () => console.log("Hero Fanfare Loaded"),
            onerror: (e) => console.warn("Hero Fanfare failed to load", e)
        }).toDestination();
        
        // Wait for buffers
        await Tone.loaded();
        soundsReady = true;
        console.log("Audio System Ready");

    } catch (e) {
        console.error('Failed to initialize sounds:', e);
        soundsReady = false;
    }
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
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        Tone.start().then(() => console.log("Audio Context Started")).catch(e => console.error('Failed to resume audio context:', e));
    }
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
        // Do not stop Transport here if drumRoll is also running, but usually they are exclusive.
        // Safer to just dispose the loop.
    }
}

export function playHeroFanfare() {
    if (soundsReady && heroFanfare.loaded) {
        heroFanfare.start();
    }
}
