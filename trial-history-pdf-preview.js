// Dev-only preview for the Trial History PDF export (features/trialHistoryPdf.js) with mock data.
//   npx vite --port 3010, then open http://127.0.0.1:3010/trial-history-pdf-preview.html
import { openTrialHistoryExport, layoutPages } from './features/trialHistoryPdf.js';
import { buildPdfBlocks, buildTrialHistoryPdfModel, resolvePeriod } from './features/trialHistoryPdfCore.mjs';

const names = ['Αλέξανδρος Παπαδόπουλος', 'Μαρία Κωνσταντίνου', 'Γιώργος Νικολάου', 'Eleni Georgiou', 'Δημήτρης Ιωάννου',
    'Σοφία Αθανασίου', 'Νίκος Βασιλείου', 'Κατερίνα Μιχαηλίδου', 'Πέτρος Οικονόμου', 'Ζωή Χατζή', 'Άννα Λαμπράκη', 'Χρήστος Σταύρου'];
const classData = { id: 'c1', name: 'The B Ghosts', logo: '👻' };
const students = names.map((name, i) => ({ id: `s${i}`, name, classId: 'c1' }));
const QUAL = [['Great!!!', 100], ['Great!!', 75], ['Great!', 50], ['Nice Try!', 25]];
const scores = [];
let seq = 0;
let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const testTitles = ['Unit 1 Test', 'Unit 2 Test', 'Μάθημα 3 - Τεστ', 'Progress Test A', 'Unit 4 Test', 'Vocabulary Quiz', 'Unit 5 Test', 'Unit 6 Test', 'Grammar Check', 'Mid-term'];
testTitles.forEach((title, k) => {
    const d = new Date(2026, 8, 12 + k * 8);
    students.forEach((s) => {
        if (rnd() < 0.1) return;
        const n = Math.round(8 + rnd() * 12);
        scores.push({ id: `t${seq++}`, classId: 'c1', studentId: s.id, type: 'test', title, date: fmt(d), scoreNumeric: n, maxScore: 20, pct: n * 5 });
    });
});
for (let k = 0; k < 9; k += 1) {
    const d = new Date(2026, 8, 15 + k * 7);
    students.forEach((s, i) => {
        if (rnd() < 0.1) return;
        if (k === 3 && i === 2) { scores.push({ id: `d${seq++}`, classId: 'c1', studentId: s.id, type: 'dictation', title: '', date: fmt(d), unmarkable: true, pct: null }); return; }
        const q = QUAL[Math.floor(rnd() * 4)];
        scores.push({ id: `d${seq++}`, classId: 'c1', studentId: s.id, type: 'dictation', title: '', date: fmt(d), scoreQualitative: q[0], pct: q[1] });
    });
}
const timeOf = (s) => { const [d, m, y] = s.date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const ctxBase = {
    classData, students, pctOf: (s) => s.pct ?? null,
    labelOf: (s) => s.unmarkable ? '?' : s.scoreQualitative || `${s.scoreNumeric}/${s.maxScore}`,
    timeOf, isUnmarkable: (s) => s.unmarkable === true, teacherName: 'Nasos', schoolName: 'Prodigies Language School'
};
window.__pv = { scores, ctxBase };

document.getElementById('pv-bar').addEventListener('click', async (e) => {
    const pv = e.target.closest('[data-pv]')?.dataset.pv;
    if (!pv) return;
    if (pv === 'sheet') {
        openTrialHistoryExport({
            ...ctxBase, mount: document.getElementById('pv-book'), view: 'test', kindsAvailable: ['test', 'dictation'],
            loadedScores: () => scores, needsArchive: () => false, fetchArchive: async () => scores,
            toast: (m, t) => console.log('toast', t, m)
        });
        return;
    }
    const layout = pv.replace('pages-', '');
    const model = buildTrialHistoryPdfModel({ ...ctxBase, scores, kinds: layout === 'trial' ? ['test'] : ['test', 'dictation'], period: resolvePeriod('all'), now: new Date(2026, 10, 26) });
    const { host, pages } = await layoutPages(model, buildPdfBlocks(model, layout));
    host.className = '';
    document.getElementById('pv-pages').replaceChildren(...pages);
    host.remove();
    window.__pvPages = pages.length;
});
