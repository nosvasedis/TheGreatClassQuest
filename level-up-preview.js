// Dev-only preview of the hero level-up moment (ui/modals/heroLevelUp.js), no Firebase.
// Open /level-up-preview.html under `npm run dev`;
// ?play=Artificer:2 plays one on load, ?play=queue three at once; &tier=lite|still|full forces a tier; &shot=1 hides the toolbar.
import { showHeroLevelUpCelebration } from './ui/modals/heroLevelUp.js';
import { ensureAudioReady } from './audio.js';

const params = new URLSearchParams(location.search);
if (params.get('shot') === '1') document.body.classList.add('pv-shot');
const previewTier = params.get('tier') || undefined;

const NAMES = { Artificer: 'Maria Papadopoulou', Sage: 'Nikos', Guardian: 'Eleni Dimitriou', Paladin: 'Giorgos', Scholar: 'Sofia', Nomad: 'Petros' };

function play(spec) {
    if (spec === 'queue') {
        ['Sage:2', 'Scholar:1', 'Artificer:4'].forEach(play);
        return;
    }
    const [heroClass, level] = spec.split(':');
    showHeroLevelUpCelebration({ studentId: `pv-${heroClass}-${level}-${Math.random()}`, studentName: NAMES[heroClass] || 'Hero', heroClass, newHeroLevel: Number(level) || 1, previewTier });
}

document.querySelectorAll('[data-pv]').forEach((btn) => {
    btn.onclick = async () => { await ensureAudioReady().catch(() => false); play(btn.dataset.pv); };
});
if (params.get('play')) play(params.get('play'));
