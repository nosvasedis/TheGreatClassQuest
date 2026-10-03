import * as state from '../../state.js';
import { db, doc, collection, query, where, getDocs, getDoc, onSnapshot, runTransaction, serverTimestamp, addDoc, updateDoc } from '../../firebase.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLocalIsoDateString as getTodayDateString } from '../../utils.js';
import { createOathDraft, evaluateOathEvidence, addOathCheckIn, dedupeEvidence, buildOathKeepsake } from '../../features/emberOathCore.mjs';
import { cleanCampfireText } from '../../features/heroCampfireCore.mjs';
import { withSchoolYear } from '../../utils/schoolYear.js';
const ROOT = 'artifacts/great-class-quest/public/data/';
export function oathContext() {
    const teacherId = state.get('currentUserId'), schoolYearKey = state.getActiveSchoolYearKey();
    if (!teacherId || !schoolYearKey || state.get('currentUserRole') !== 'teacher' || !canUseFeature('heroCampfire')) throw new Error('Hero Campfire requires an active teacher and Pro plan.');
    return { teacherId, schoolYearKey };
}
function ownedOath(oath, context) {
    if (!oath || oath.teacherId !== context.teacherId || oath.schoolYearKey !== context.schoolYearKey) throw new Error('This promise belongs to another teacher or school year.');
}
export function ensureEmberOathsListener() {
    const context = oathContext();
    if (state.get('hasLoadedEmberOaths')) return;
    state.set('hasLoadedEmberOaths', true);
    const q = query(collection(db, ROOT + 'ember_oaths'), where('teacherId', '==', context.teacherId), where('schoolYearKey', '==', context.schoolYearKey));
    state.set('unsubscribeEmberOaths', onSnapshot(q, snapshot => {
        if (state.get('currentUserId') !== context.teacherId || state.getActiveSchoolYearKey() !== context.schoolYearKey) return;
        state.set('allEmberOaths', snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, error => {
        state.set('hasLoadedEmberOaths', false);
        window.dispatchEvent(new CustomEvent('gcq:campfire-error', { detail: error.message }));
    }));
}
export async function loadEmberOaths(classId) {
    const c = oathContext();
    const snapshot = await getDocs(query(collection(db, ROOT + 'ember_oaths'), where('teacherId', '==', c.teacherId), where('schoolYearKey', '==', c.schoolYearKey)));
    if (state.get('currentUserId') === c.teacherId && state.getActiveSchoolYearKey() === c.schoolYearKey) state.set('allEmberOaths', snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !classId || o.classId === classId);
}
export async function createEmberOath(template, options) {
    const c = oathContext(), student = state.get('allStudents').find(s => s.id === options.studentId && s.classId === options.classId && s.createdBy?.uid === c.teacherId);
    if (!student) throw new Error('Choose a student from your class.');
    const draft = createOathDraft(template, { ...options, ...c, date: getTodayDateString() });
    const ref = await addDoc(collection(db, ROOT + 'ember_oaths'), { ...draft, createdBy: { uid: c.teacherId }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...draft, id: ref.id };
}
export async function checkInEmberOath(id, mood) {
    const c = oathContext(), ref = doc(db, ROOT + 'ember_oaths', id);
    return runTransaction(db, async tx => {
        const snap = await tx.get(ref), oath = snap.data(); ownedOath(oath, c);
        const checkIns = addOathCheckIn(oath, mood, getTodayDateString());
        tx.update(ref, { checkIns, updatedAt: serverTimestamp() });
        return { id, ...oath, checkIns };
    });
}
export async function addEmberEvidence(id, label) {
    const c = oathContext(), ref = doc(db, ROOT + 'ember_oaths', id), date = getTodayDateString();
    const text = cleanCampfireText(label, 160); if (!text) throw new Error('Describe the observed action.');
    return runTransaction(db, async tx => {
        const snap = await tx.get(ref), oath = snap.data(); ownedOath(oath, c);
        if (oath.status !== 'active') throw new Error('This promise is no longer active.');
        const evidence = dedupeEvidence([...(oath.evidence || []), { kind: 'manual', label: text, date, refId: date + ':' + text }]);
        tx.update(ref, { evidence, updatedAt: serverTimestamp() });
    });
}
export async function getOathFacts(oath) {
    const c = oathContext(); ownedOath(oath, c);
    // A fresh window read is intentional: the main award listener only holds this month.
    const [awards, scores, quizModule] = await Promise.all([
        getDocs(query(collection(db, ROOT + 'award_log'), where('studentId', '==', oath.studentId), where('schoolYearKey', '==', c.schoolYearKey))),
        getDocs(query(collection(db, ROOT + 'written_scores'), where('studentId', '==', oath.studentId), where('schoolYearKey', '==', c.schoolYearKey))),
        canUseFeature('quizOfTheWeek') ? import('./quizOfTheWeek.js') : null
    ]);
    const quiz = quizModule ? await quizModule.getQuizForClass(oath.classId).catch(() => null) : null;
    return { awards: awards.docs.map(d => ({ id: d.id, ...d.data() })), writtenScores: scores.docs.map(d => ({ id: d.id, ...d.data() })),
        quizzes: quiz ? [quiz] : [], today: getTodayDateString() };
}
export async function keepEmberOath(id, { confirmed = false, reflection = {} } = {}) {
    if (!confirmed) throw new Error('The teacher must confirm the promise was kept.');
    const c = oathContext(), ref = doc(db, ROOT + 'ember_oaths', id);
    const initial = await getDoc(ref), oath = { id, ...initial.data() }; ownedOath(oath, c);
    const facts = await getOathFacts(oath);
    return runTransaction(db, async tx => {
        const fresh = await tx.get(ref), current = { id, ...fresh.data() }; ownedOath(current, c);
        if (current.status === 'kept') return current; // deterministic note and inventory receipt
        const result = evaluateOathEvidence(current, facts);
        if (!result.ready) throw new Error('This promise needs all its moments and one 🔥 check-in before it can be kept.');
        const scoreRef = doc(db, ROOT + 'student_scores', current.studentId);
        const score = await tx.get(scoreRef);
        if (!score.exists() || score.data().activeSchoolYearKey !== c.schoolYearKey) throw new Error('The active-year student record is unavailable.');
        const legendLine = current.private ? 'Kept a personal promise with care.' : 'Kept a promise: ' + current.text;
        const kept = { ...current, status: 'kept', evidence: result.evidence, legendLine,
            reflection: { helped: cleanCampfireText(reflection.helped, 240), next: cleanCampfireText(reflection.next, 240), emoji: cleanCampfireText(reflection.emoji, 12) } };
        const keepsake = buildOathKeepsake(kept, new Date().toISOString());
        const inventory = [...(score.data().inventory || [])].filter(i => i.id !== keepsake.id);
        tx.update(ref, { status: 'kept', evidence: kept.evidence, legendLine, reflection: kept.reflection, keptAt: serverTimestamp(), updatedAt: serverTimestamp() });
        tx.update(scoreRef, { inventory: [...inventory, keepsake] });
        // The oath, keepsake and Hero's Chronicle note share one atomic commit and one stable ID.
        tx.set(doc(db, ROOT + 'hero_chronicle_notes', 'ember_' + id), withSchoolYear({
            studentId: current.studentId, teacherId: c.teacherId, noteText: legendLine, category: 'Goals',
            source: 'ember_oath', oathId: id, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }, c.schoolYearKey));
        return kept;
    });
}
export async function releaseEmberOath(id) {
    const c = oathContext(), ref = doc(db, ROOT + 'ember_oaths', id);
    await runTransaction(db, async tx => {
        const s = await tx.get(ref), oath = s.data(); ownedOath(oath, c);
        if (oath.status !== 'active') throw new Error('Only a growing promise can be let go.');
        tx.update(ref, { status: 'released', updatedAt: serverTimestamp() });
    });
}
export async function setClassCampfireEnabled(classId, enabled) {
    oathContext();
    if (!state.get('allTeachersClasses').some(c => c.id === classId)) throw new Error('Choose your class.');
    await updateDoc(doc(db, ROOT + 'classes', classId), { campfireEnabled: !!enabled });
    state.setAllTeachersClasses(state.get('allTeachersClasses').map(c => c.id === classId ? { ...c, campfireEnabled: !!enabled } : c));
}
