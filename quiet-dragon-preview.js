// Quiet Dragon preview: the real stage with a sample class, no microphone and no Firebase writes.
// /quiet-dragon-preview.html?view=setup|asleep|stirring|peeking|awake|held|calibrating|ending|gift[&p=0.6][&lite=1][&shot=1]
import * as state from './state.js';
import { openQuietDragon, quietDragonTestHooks as hooks } from './ui/modals/quietDragon.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'setup';
if (params.has('shot')) document.body.classList.add('pv-shot');

const names = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Kostas Ioannou', 'Sofia Nikolaou', 'Giorgos Pappas', 'Anna Vlachou', 'Dimitris Karras', 'Katerina Lazarou', 'Yannis Michail', 'Ioanna Christou', 'Petros Alexiou', 'Christina Raptis', 'Alexandros Doukas', 'Despina Kyriakou', 'Stavros Manos', 'Vasiliki Zervou', 'Panos Spyrou', 'Irini Koutsou', 'Thanos Rigas', 'Lena Petrou', 'Manos Sideris', 'Rena Galani'];
const cls = { id: 'c1', name: 'Junior B · Owls', logo: '🦉', questLevel: 'Junior B' };
state.setAllTeachersClasses([cls]);
state.setAllSchoolClasses([cls]);
state.setAllStudents(names.map((name, i) => ({ id: `s${i}`, name, classId: 'c1' })));
state.set('globalSelectedClassId', 'c1');

const links = ['setup', 'calibrating', 'asleep', 'stirring', 'peeking', 'awake', 'held', 'ending', 'gift'];
document.getElementById('pv-toolbar').innerHTML = links.map((v) => `<a href="?view=${v}${params.has('lite') ? '&lite=1' : ''}">${v}</a>`).join('');

openQuietDragon({ from: 'wallpaper', lite: params.has('lite') });
const p = Number(params.get('p') ?? 0.55);
setTimeout(() => {
    if (view === 'calibrating') hooks.showCalibrating();
    else if (view === 'ending') { hooks.showMood('asleep'); hooks.showProgress(p); hooks.showEnding(); }
    else if (view === 'gift') hooks.showGift({ hoard: { key: params.get('hoard') || 'gold', amount: Number(params.get('amount') || 2) }, treat: params.get('treat') ?? 'A game at the end of the lesson' });
    else if (view === 'held') { hooks.showMood('asleep'); hooks.showProgress(p, 0.1); hooks.hold(true); }
    else if (view !== 'setup') {
        const ratio = { asleep: 0.25, stirring: 0.7, peeking: 1.05, awake: 1.4 }[view] ?? 0.3;
        hooks.showMood(view);
        hooks.showProgress(p, ratio);
    }
}, 300);
