/**
 * The short sound that greets each place on the Team Quest map when its card
 * opens: farm animals in the Bronze Meadows, mountain wind and snow in the
 * Silver Peaks, the market crowd in the Golden Citadel, chimes in the Crystal
 * Realm and a deep shining swell at the Portal. Built by
 * tools/team-quest-map/build_place_sounds.py; quiet, and never more than one at a time.
 */
const sound = (name) => new URL(`../../assets/team-quest-map/sounds/${name}.mp3`, import.meta.url).href;

const PLACE_SOUNDS = Object.freeze({
    bronze: [sound('meadows-1'), sound('meadows-2')],
    silver: [sound('peaks')],
    gold: [sound('citadel')],
    crystal: [sound('crystal')],
    diamond: [sound('crystal')], // the Crystal Realm's zone key
    portal: [sound('portal')]
});

const VOLUME = 0.5;
let current = null;
const takes = new Map();

function fadeOut(audio) {
    const step = () => {
        audio.volume = Math.max(0, audio.volume - 0.06);
        if (audio.volume > 0.001) requestAnimationFrame(step);
        else audio.pause();
    };
    requestAnimationFrame(step);
}

/** Plays the place's sound (a map zone key: 'bronze' | 'silver' | 'gold' | 'diamond', or 'portal'). */
export function playPlaceSound(place) {
    const list = PLACE_SOUNDS[place];
    if (!list || typeof Audio === 'undefined') return;
    const take = takes.get(place) || 0;
    takes.set(place, take + 1);
    if (current && !current.paused) fadeOut(current);
    const audio = new Audio(list[take % list.length]);
    audio.volume = VOLUME;
    current = audio;
    audio.play().catch(() => { /* the browser wants a click first; stay quiet */ });
}

/** Lets the sound go quietly (the card closed early). */
export function hushPlaceSound() {
    if (current && !current.paused) fadeOut(current);
    current = null;
}
