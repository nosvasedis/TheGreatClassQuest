// Starfall preview: the real markup and module with sample scholars, no Firebase.
// /starfall-preview.html?view=single|batch|many[&growth=1][&mobile=1][&catch=1][&delayed=1]
// /starfall-preview.html?call=ready|asleep   the Scholar's Scroll call; its button summons the window
import { miscModalsHTML } from './templates/modals/misc.js';
import { prepareStarfall } from './ui/modals/starfall.js';
import { starfallCallHtml, playStarfallSummon } from './ui/starfallCall.js';
import './styles/performance_chart.css';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'batch';
const call = params.get('call');
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
document.getElementById('starfall-cancel-btn').addEventListener('click', () => modal.classList.add('hidden'));

function openStarfall(delayed) {
    prepareStarfall({
        mode: view === 'single' ? 'single' : 'batch',
        students,
        delayed: delayed ? { markedDay: 'Monday', trialTypes: ['test', 'dictation'] } : null,
        laterLabel: delayed ? 'Later in the lesson' : '',
        onBestow: () => { window.__bestowed += 1; },
        close: () => { modal.classList.add('hidden'); },
    });
    content.classList.add('modal-origin-start');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => content.classList.remove('modal-origin-start'));
}

if (call) {
    document.querySelector('.pv-fake')?.remove();
    const host = document.createElement('div');
    host.className = 'ss-notices pv-scroll';
    host.style.cssText = 'max-width:64rem;margin:2rem auto;padding:0 1rem;';
    document.body.prepend(host);
    const queuedAt = Date.now() - 2 * 86400000;
    const entries = students.map((s) => ({ ...s, queuedAt }));
    const { state, html } = starfallCallHtml({
        entries,
        timing: { hasSchedule: true, inLesson: call === 'ready' },
        nextWhen: 'tomorrow at 10:15'
    });
    const card = document.createElement('article');
    card.className = `ss-notice ssf-call ssf-call--${state}`;
    card.innerHTML = html;
    host.appendChild(card);
    card.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-ssf="open"]');
        if (!btn) return;
        await playStarfallSummon(btn.querySelector('.ssf-call__btn-star') || btn);
        openStarfall(true);
    });
} else {
    openStarfall(params.has('delayed'));
}
