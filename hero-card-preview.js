// Hero card + item close-up preview: the real Hero Stage and close-up with sample heroes, no Firebase.
// /hero-card-preview.html?hero=helen|nikos|empty[&open=1][&item=N][&levelup=1][&shot=1]
import * as state from './state.js';
import { applySubscriptionPreview } from './utils/subscription.js';
import { handleAvatarClick, showInventoryItemDetail } from './ui/core/avatar.js';
import { buildOathKeepsake } from './features/emberOathCore.mjs';

applySubscriptionPreview({ tier: 'elite' });
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');

const face = (bg, fur) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="58" r="30" fill="${fur}"/><ellipse cx="26" cy="40" rx="10" ry="20" fill="${fur}"/><ellipse cx="74" cy="40" rx="10" ry="20" fill="${fur}"/><circle cx="40" cy="54" r="5" fill="#222"/><circle cx="60" cy="54" r="5" fill="#222"/><ellipse cx="50" cy="66" rx="6" ry="4" fill="#a33"/></svg>`);

const keepsake = buildOathKeepsake({ id: 'o1', legendLine: "Kept The Artist's Promise: I draw a four-picture comic with English speech bubbles." }, '2026-10-21');
const students = [
    { id: 'helen', name: 'Helen Oikonomopoulou', classId: 'c1', heroClass: 'Guardian', guildId: 'owl_wisdom', avatar: face('#7dd3fc', '#f9a28b') },
    { id: 'nikos', name: 'Nikos Georgiou', classId: 'c1', heroClass: 'Sage', guildId: 'dragon_flame', avatar: face('#fde68a', '#a16207') },
    { id: 'empty', name: 'Eleni Dimitriou', classId: 'c1', guildId: 'phoenix_rising', avatar: face('#c4b5fd', '#64748b') },
];
const scores = [
    {
        id: 'helen', monthlyStars: 4, totalStars: 28.5, gold: 121.5, heroLevel: 1, starsByReason: { respect: 26 },
        pendingSkillChoice: params.has('levelup'), hasGildedEffect: true, gloryBannerCharges: 2,
        familiar: params.has('familiar') ? { typeId: 'emberfang', state: 'alive', level: 2, name: 'Pip', look: { v: 2, seed: 7 } } : null,
        inventory: [
            { id: 'leg_aurum', name: 'Aurum Satchel', icon: '💰', description: '50% off.' },
            keepsake,
            { id: 'leg_aurum', name: 'Aurum Satchel', icon: '💰', description: '50% off.' },
            { id: 'stall_lantern', name: 'Moonlit Lantern', icon: '🏮', price: 40, tier: 'rare', acquiredAt: '2026-10-02' },
            { id: 'stall_acorn', name: 'Golden Acorn', icon: '🌰', price: 10, tier: 'common', acquiredAt: '2026-09-12' },
            { id: 'quiz_crown', name: 'Quiz Crown', icon: '👑', source: 'quiz_prize', acquiredAt: '2026-10-28', description: 'Won the Quiz of the Week.' },
            { id: 'leg_quill', name: "Archivist's Quill", icon: '✒️' },
            { id: 'stall_shell', name: 'Singing Shell', icon: '🐚', price: 12, tier: 'common', acquiredAt: '2026-10-11' },
            { id: 'stall_map', name: 'Sky Map', icon: '🗺️', price: 14, tier: 'common', acquiredAt: '2026-10-15' },
            { id: 'stall_bell', name: 'Bronze Bell', icon: '🔔', price: 9, tier: 'common', acquiredAt: '2026-10-19' },
        ],
    },
    { id: 'nikos', monthlyStars: 11.5, totalStars: 64, gold: 40, heroLevel: 5, starsByReason: { creativity: 140 }, inventory: [keepsake] },
    { id: 'empty', monthlyStars: 0, totalStars: 3, gold: 5, inventory: [] },
];
state.setAllStudents(students);
state.setAllStudentScores(scores);
state.setAllTeachersClasses([{ id: 'c1', name: 'The A Crowns', logo: '👑' }]);
state.setTodaysStars({ helen: { stars: 2 } });

const root = document.getElementById('pv-root');
root.innerHTML = students.map((s) => `<div data-studentid="${s.id}"><img class="enlargeable-avatar" src="${s.avatar}" alt=""></div>`).join('');
document.addEventListener('click', handleAvatarClick);

document.getElementById('pv-toolbar').innerHTML = [
    '?hero=helen&open=1', '?hero=helen&open=1&levelup=1&familiar=1', '?hero=nikos&open=1', '?hero=empty&open=1',
    '?hero=helen&item=1', '?hero=helen&item=0', '?hero=helen&item=3', '?hero=helen&item=4', '?hero=helen&item=5',
].map((q) => `<a href="${q}">${q.slice(1)}</a>`).join('');

const hero = params.get('hero') || 'helen';
if (params.has('open')) setTimeout(() => root.querySelector(`[data-studentid="${hero}"] img`).click(), 200);
if (params.has('item')) {
    const index = Number(params.get('item'));
    const item = scores.find((s) => s.id === hero).inventory[index];
    setTimeout(() => showInventoryItemDetail(item, { studentId: hero, index }), 200);
}
