// Hero Duels preview: the real arena with a sample class, no Firebase writes (rewards are not paid here).
// /hero-duels-preview.html?teams=0|2|3|4[&size=2][&lite=1][&shot=1]  (pick heroes and play as on the projector)
import * as state from './state.js';
import { openHeroDuels } from './ui/modals/heroDuels.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');
try { if (!params.has('keep')) localStorage.removeItem('gcq.heroDuels.v1'); } catch { /* fine */ }
try { localStorage.setItem('gcq.heroDuels.prefs', JSON.stringify({ teamCount: Number(params.get('teams') ?? 2), source: 'guild', rules: { size: Number(params.get('size') || 2) } })); } catch { /* fine */ }

const names = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Kostas Ioannou', 'Sofia Nikolaou', 'Giorgos Pappas', 'Anna Vlachou', 'Dimitris Karras', 'Katerina Lazarou', 'Yannis Michail', 'Ioanna Christou', 'Petros Alexiou', 'Christina Raptis', 'Alexandros Doukas', 'Despina Kyriakou', 'Stavros Manos', 'Vasiliki Zervou', 'Panos Spyrou', 'Irini Koutsou', 'Thanos Rigas', 'Lena Petrou', 'Manos Sideris'];
const guilds = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
const cls = { id: 'c1', name: 'Junior B · Owls', logo: '🦉', questLevel: 'Junior B' };
state.setAllTeachersClasses([cls]);
state.setAllSchoolClasses([cls]);
state.setAllStudents(names.map((name, i) => ({ id: `s${i}`, name, classId: 'c1', guildId: guilds[i % 4] })));
state.set('globalSelectedClassId', 'c1');
document.getElementById('pv-toolbar').innerHTML = ['0', '2', '3', '4'].map((t) => `<a href="?teams=${t}">${t === '0' ? 'on their own' : `${t} teams`}</a>`).join('');

openHeroDuels('c1');

// ?wand=1: a phone-sized Wand beside the projector, wired like the real Quest Remote (panel sanitised,
// commands validated, the projector button pressed with a spark), minus Firestore.
if (params.has('wand')) (async () => {
    const [{ getHeroDuelsPanel, runHeroDuelsCommand }, { duelsWandHtml, showGamesHtml, duelsLauncherHtml }, core, { morphInto }, fx, view] = await Promise.all([
        import('./ui/modals/heroDuels.js'), import('./features/questRemote/duelsWandView.mjs'), import('./features/questRemote/remoteCore.mjs'),
        import('./features/questRemote/wandMorph.mjs'), import('./features/questRemote/remoteFx.js'), import('./features/questRemote/remoteWandView.mjs'),
        import('./styles/quest_remote_wand.css'), import('./styles/quest_remote_duels.css')
    ]);
    const style = document.createElement('style');
    style.textContent = `#hero-duels { right: 400px !important; width: auto !important; }
        .pv-wand.qw { left: auto; width: 400px; opacity: 1; transform: none; border-left: 2px solid #312e81; }
        .pv-wand .qw-main { overflow-y: auto; padding: 12px 14px 20px; }`;
    document.head.appendChild(style);
    const wand = document.createElement('div');
    wand.className = 'qw pv-wand is-in';
    wand.innerHTML = view.wandShellHtml({ lite: false });
    wand.querySelector('.qw-modes').remove();
    document.body.appendChild(wand);
    const main = wand.querySelector('[data-qw-main]');
    main.innerHTML = '<div class="qw-view qw-view--show"></div>';
    const pane = main.firstElementChild;
    let last = '';
    const draw = () => {
        const panel = core.buildStageSummary({ surface: 'duels', title: 'Hero Duels', panel: getHeroDuelsPanel() }).panel;
        const html = panel ? duelsWandHtml(panel) : showGamesHtml('duels') + duelsLauncherHtml({ className: 'Junior B · Owls' });
        if (html !== last) { last = html; morphInto(pane, html); }
    };
    let timer = 0;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(draw, 60); }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    draw();
    wand.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-qw-cmd]');
        if (!el || el.disabled) return;
        const d = el.dataset;
        const p = { action: d.action };
        if (d.student) p.studentId = d.student;
        if (d.delta) p.delta = Number(d.delta);
        if (d.scope) p.scope = d.scope;
        if (d.rule) { p.rule = d.rule; if (d.value != null) p.value = d.value; }
        const v = core.validateCommand({ type: d.qwCmd, payload: p, clientSeq: 1 });
        if (!v.ok) { console.error('wand command refused', v, p); return; }
        const res = await runHeroDuelsCommand(p, { sparkTo: fx.sparkTo });
        window.__wandLog = [...(window.__wandLog || []), { p, res }];
    });
})();
