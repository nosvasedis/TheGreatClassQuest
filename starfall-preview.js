// Starfall preview: the real markup and module with sample scholars, no Firebase.
// /starfall-preview.html?view=single|batch|many[&growth=1][&mobile=1][&catch=1]
import { miscModalsHTML } from './templates/modals/misc.js';
import { prepareStarfall } from './ui/modals/starfall.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'batch';
if (params.has('mobile')) document.body.classList.add('gcq-mobile');
document.getElementById('pv-root').innerHTML = miscModalsHTML;

const names = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Kostas Ioannou', 'Sofia Alexiou',
    'Giorgos Nikolaou', 'Katerina Vlachou', 'Dimitris Pappas', 'Anna Konstantinou', 'Yannis Christou',
    'Ioanna Makri', 'Petros Karras'];
const batch = names.slice(0, view === 'many' ? 12 : 5).map((name, i) => ({
    studentId: `s${i}`, name, bonusAmount: i % 3 === 1 ? 0.5 : 1, trialType: i % 2 ? 'dictation' : 'test',
    ...(i === 2 || i === 4 || i === 9 ? { kind: 'growth', jump: 18 + i, bonusAmount: 0.5 } : {}),
}));
const students = view === 'single'
    ? [{ studentId: 's0', name: names[0], bonusAmount: 1, trialType: 'test', ...(params.has('growth') ? { kind: 'growth', jump: 21 } : {}) }]
    : batch;

const modal = document.getElementById('starfall-modal');
const content = document.getElementById('starfall-modal-content');
window.__bestowed = 0;
prepareStarfall({
    mode: view === 'single' ? 'single' : 'batch',
    students,
    onBestow: () => { window.__bestowed += 1; },
    close: () => { modal.classList.add('hidden'); },
});
document.getElementById('starfall-cancel-btn').addEventListener('click', () => modal.classList.add('hidden'));
content.classList.add('modal-origin-start');
modal.classList.remove('hidden');
requestAnimationFrame(() => content.classList.remove('modal-origin-start'));
