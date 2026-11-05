// Team Quest realm banner preview on a made-up class, no Firebase.
// /realm-moments-preview.html?realm=silver|gold|crystal[&lite=1 | &auto=1 (device check)][&name=...][&logo=...]
import { showRealmBanner } from "./features/realmBanner.js";

const params = new URLSearchParams(location.search);
const realm = ['silver', 'gold', 'crystal'].includes(params.get('realm')) ? params.get('realm') : '';
const classData = { id: 'c1', name: params.get('name') || 'Dragon Riders 5A', logo: params.get('logo') || '🐉' };
const lite = params.has('lite') ? true : (params.has('auto') ? undefined : false);
const PCT = { silver: 34, gold: 63, crystal: 88 };

function play(id) {
    return showRealmBanner(classData, id, { pct: PCT[id], lite });
}

document.querySelectorAll('[data-realm]').forEach((button) => button.addEventListener('click', () => play(button.dataset.realm)));
document.getElementById('pv-sound').addEventListener('click', async () => {
    const audio = await import('./audio.js');
    await audio.activateAudioContext?.();
    await audio.setupSounds?.();
});
if (realm) play(realm);
