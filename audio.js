import * as state from './state.js';

let sounds = {};
export let ceremonyMusic = {};
export let winnerFanfare = {};
export let showdownSting = {};
let soundsReady = false;

export async function setupSounds() {
    try {
        await Tone.start();
        
        // SFX Synths
        const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.3 }).toDestination();
        sounds.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05 } }).toDestination();
        sounds.confirm = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.2 }, volume: -15 }).toDestination();
        sounds.star_remove = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.01, release: 0.3 }, volume: -10 }).toDestination();
        sounds.click.volume.value = -25;
        
        sounds.writing = new Tone.NoiseSynth({ noise: { type: "white", playbackRate: 0.5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -20 }).toDestination();
        sounds.magic_chime = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 2000, resonance: 0.9, volume: -12 }).connect(reverb);
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
    try {
        if (sound === 'click') sounds.click.triggerAttackRelease('C5', '8n');
        else if (sound === 'star1') sounds.star1.triggerAttackRelease('C6', '16n');
        else if (sound === 'star2') {
            sounds.star2.triggerAttackRelease('E6', '16n', Tone.now());
            sounds.star2.triggerAttackRelease('G6', '16n', Tone.now() + 0.05);
        } else if (sound === 'star3') {
            sounds.star3.triggerAttackRelease('C6', '16n', Tone.now());
            sounds.star3.triggerAttackRelease('E6', '16n', Tone.now() + 0.05);
            sounds.star3.triggerAttackRelease('G6', '16n', Tone.now() + 0.1);
            sounds.star3.triggerAttackRelease('C7', '16n', Tone.now() + 0.15);
        } else if (sound === 'star_remove') sounds.star_remove.triggerAttackRelease('8n');
        else if (sound === 'confirm') sounds.confirm.triggerAttackRelease('E4', '8n');
        else if (sound === 'writing') sounds.writing.triggerAttackRelease('4n');
        else if (sound === 'magic_chime') sounds.magic_chime.triggerAttackRelease('C7', '8n');
    } catch (e) { console.error('Sound play error:', e); }
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
