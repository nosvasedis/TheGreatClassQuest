// Birthday / name-day popup preview: the real markup and module with a sample student, no Firebase.
// /occasion-preview.html?type=birthday|nameday[&name=…][&avatar=url][&mobile=1]
import { miscModalsHTML } from './templates/modals/misc.js';
import { prepareOccasionCelebration } from './ui/modals/occasionCelebration.js';

const params = new URLSearchParams(location.search);
const type = params.get('type') === 'nameday' ? 'nameday' : 'birthday';
if (params.has('mobile')) document.body.classList.add('gcq-mobile');
document.getElementById('pv-root').innerHTML = miscModalsHTML;

const modal = document.getElementById('celebration-bonus-modal');
const content = document.getElementById('celebration-bonus-content');
window.__gifted = 0;
prepareOccasionCelebration({
    type,
    student: { name: params.get('name') || 'Maria Papadopoulou', avatar: params.get('avatar') || '' },
    bonus: type === 'birthday' ? 2.5 : 1.5,
    onGift: () => { window.__gifted += 1; },
    close: () => modal.classList.add('hidden'),
});
content.classList.add('modal-origin-start');
modal.classList.remove('hidden');
requestAnimationFrame(() => content.classList.remove('modal-origin-start'));
