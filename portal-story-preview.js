// Portal banner + story preview on a made-up class, no Firebase.
// /portal-story-preview.html?moment=open|sealed|guardian&view=banner|story[&level=2][&heroes=14][&lite=1][&gold=0]
import { buildPortalStory, normalizeCrossing } from './features/portalStoryCore.mjs';
import { evaluatePortal } from './features/questRanksCore.mjs';
import { showPortalBanner, sleepingRuneLine } from './features/portalMoments.js';
import { openPortalStory } from './ui/modals/portalStory.js';

const params = new URLSearchParams(location.search);
const moment = ['open', 'sealed', 'guardian'].includes(params.get('moment')) ? params.get('moment') : 'open';
const level = Math.max(1, Number(params.get('level')) || 2);
const heroCount = Math.max(1, Number(params.get('heroes')) || 14);
const lite = params.has('lite');
const NAMES = ['Maria Papadopoulou', 'Giorgos K.', 'Eleni', 'Nikos', 'Sofia', 'Dimitris', 'Katerina', 'Yannis', 'Anna', 'Petros', 'Ioanna', 'Christos', 'Despina', 'Alexandros', 'Zoe', 'Stavros', 'Irini', 'Manolis'];
const roster = Array.from({ length: heroCount }, (_, i) => ({ id: `s${i}`, name: NAMES[i % NAMES.length], classId: 'c1' }));
const classData = { id: 'c1', name: params.get('name') || 'Dragon Riders 5A', logo: '🐉', questLevel: 'A', difficultyLevel: level - 1 };

function makeStory() {
    if (moment === 'open') {
        const gold = params.get('gold') === '0' ? 0 : Math.min(10, 4 + level);
        const crossing = normalizeCrossing({
            crossing: { fromLevel: level, toLevel: level + 1, gold, heroes: gold ? heroCount : 0 },
            status: { totalStars: 286.5, goal: 280, runes: level >= 2 ? [{ id: 'virtues' }, ...(level >= 3 ? [{ id: 'lanterns' }] : []), ...(level >= 4 ? [{ id: 'guardian' }] : []), ...(level >= 5 ? [{ id: 'ownLight' }] : [])] : [] }
        });
        return buildPortalStory({ kind: 'crossing', classData, roster, crossing, lite });
    }
    const gate = Math.max(level, moment === 'guardian' ? 4 : 3);
    const status = evaluatePortal({
        level: gate,
        goal: 280,
        heroStars: roster.map((_, i) => (i < heroCount - 4 ? 24 : 3)),
        classBonus: 40,
        virtueStars: { teamwork: 30, creativity: 25, respect: 20, focus: moment === 'guardian' ? 20 : 12 },
        guardian: { passed: false, triedToday: false }
    });
    if (moment === 'guardian') status.runes.forEach((r) => { if (r.id !== 'guardian') r.met = true; });
    if (moment === 'guardian') status.state = 'guardian';
    return buildPortalStory({ kind: 'gate', classData, roster, status, sleepingLine: sleepingRuneLine(status), lite });
}

const story = makeStory();
window.__story = story;
const banner = () => showPortalBanner(story, classData).then((how) => { window.__bannerDone = how; });
const open = () => openPortalStory(story, { onPortal: () => console.log('portal'), onGuardian: () => console.log('guardian') });
document.getElementById('pv-banner').onclick = banner;
document.getElementById('pv-story').onclick = open;
document.getElementById('pv-sound').onclick = async () => {
    const audio = await import('./audio.js');
    await audio.setupSounds();
    await audio.activateAudioContext?.();
};
if ((params.get('view') || 'banner') === 'story') open(); else banner();
