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
