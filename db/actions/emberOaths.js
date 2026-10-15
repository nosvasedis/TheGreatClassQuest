import * as state from '../../state.js';
import { db, doc, collection, query, where, getDocs, getDoc, onSnapshot, runTransaction, serverTimestamp, addDoc, updateDoc, increment } from '../../firebase.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLocalIsoDateString as getTodayDateString, getMonthKey } from '../../utils.js';
import { createOathDraft, evaluateOathEvidence, addOathCheckIn, checkInDay, dedupeEvidence, buildOathKeepsake } from '../../features/emberOathCore.mjs';
import { cleanCampfireText } from '../../features/heroCampfireCore.mjs';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { dataPath } from '../../utils/tenant.mjs';
import { oathPerkFor, keptCountFromInventory, starPathNote } from '../../features/oathStarPath.mjs';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { monthlyStarsChange } from './monthlyStars.js';
import { EMBER_OATH_AWARD_REASON } from '../../features/awardLogReasonMeta.js';
import { FIGURE_TEAM_QUEST_BONUS } from '../../features/campfireConstellation.mjs';
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
    const q = query(collection(db, dataPath('ember_oaths')), where('teacherId', '==', context.teacherId), where('schoolYearKey', '==', context.schoolYearKey));
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
    const snapshot = await getDocs(query(collection(db, dataPath('ember_oaths')), where('teacherId', '==', c.teacherId), where('schoolYearKey', '==', c.schoolYearKey)));
    if (state.get('currentUserId') === c.teacherId && state.getActiveSchoolYearKey() === c.schoolYearKey) state.set('allEmberOaths', snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !classId || o.classId === classId);
}
export async function createEmberOath(template, options) {
    const c = oathContext(), student = state.get('allStudents').find(s => s.id === options.studentId && s.classId === options.classId && s.createdBy?.uid === c.teacherId);
    if (!student) throw new Error('Choose a student from your class.');
    const draft = createOathDraft(template, { ...options, ...c, date: getTodayDateString() });
    const ref = await addDoc(collection(db, dataPath('ember_oaths')), { ...draft, createdBy: { uid: c.teacherId }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...draft, id: ref.id };
}
/** A 🔥 check-in also counts as a "Tried it" moment (derived in emberOathEvidence.mjs, nothing extra stored). */
export async function checkInEmberOath(id, mood, { date = '' } = {}) {
    const c = oathContext(), ref = doc(db, dataPath('ember_oaths'), id);
    return runTransaction(db, async tx => {
        const snap = await tx.get(ref), oath = snap.data(); ownedOath(oath, c);
        const checkIns = addOathCheckIn(oath, mood, checkInDay(oath, date, getTodayDateString()));
        tx.update(ref, { checkIns, updatedAt: serverTimestamp() });
        return { id, ...oath, checkIns };
    });
}
export async function addEmberEvidence(id, label) {
    const c = oathContext(), ref = doc(db, dataPath('ember_oaths'), id), date = getTodayDateString();
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
        getDocs(query(collection(db, dataPath('award_log')), where('studentId', '==', oath.studentId), where('schoolYearKey', '==', c.schoolYearKey))),
        getDocs(query(collection(db, dataPath('written_scores')), where('studentId', '==', oath.studentId), where('schoolYearKey', '==', c.schoolYearKey))),
        canUseFeature('quizOfTheWeek') ? import('./quizOfTheWeek.js') : null
    ]);
    const quiz = quizModule ? await quizModule.getQuizForClass(oath.classId).catch(() => null) : null;
    return { awards: awards.docs.map(d => ({ id: d.id, ...d.data() })), writtenScores: scores.docs.map(d => ({ id: d.id, ...d.data() })),
        quizzes: quiz ? [quiz] : [], today: getTodayDateString() };
}
/** Only these rules read stars, trials or the quiz; every other promise's evidence lives on the oath itself. */
const FACT_RULES = new Set(['virtue', 'practice', 'quiz']);
/**
 * Keep a promise. One transaction writes the kept oath, the Star-Ember, the Hero's Chronicle note and
 * the Star Path gifts (bonus stars to monthly + total only, Gold, a keepsake at a milestone) with its
 * own logbook row. Pass the `oath` and its `facts` when the caller already holds them: then nothing
 * is read before the transaction, so the keep is a single round trip.
 * @returns the kept oath with `perk` (what the Star Path gave).
 */
export async function keepEmberOath(id, { confirmed = false, reflection = {}, oath: known = null, facts: knownFacts = null, keptBefore = 0 } = {}) {
    if (!confirmed) throw new Error('The teacher must confirm the promise was kept.');
    const c = oathContext(), ref = doc(db, dataPath('ember_oaths'), id);
    let facts = knownFacts;
    if (!facts) {
        const oath = known && known.id === id ? known : { id, ...(await getDoc(ref)).data() };
        ownedOath(oath, c);
        facts = FACT_RULES.has(String(oath.evidenceRule || '')) ? await getOathFacts(oath) : { today: getTodayDateString() };
    }
    const { oathTitle } = await import('../../features/oathForge.mjs');
    const yearKey = c.schoolYearKey, today = getTodayDateString();
    const teacher = { uid: c.teacherId, name: state.get('currentTeacherName') || '' };
    const kept = await runTransaction(db, async tx => {
        const fresh = await tx.get(ref), current = { id, ...fresh.data() }; ownedOath(current, c);
        if (current.status === 'kept') return current; // deterministic note and inventory receipt
        const result = evaluateOathEvidence(current, { ...facts, today: facts.today || today });
        if (!result.ready) throw new Error('This promise needs all its embers lit before it can be kept.');
        const scoreRef = doc(db, dataPath('student_scores'), current.studentId);
        const logRef = doc(db, dataPath('award_log'), starPathLogId(id));
        const [score, log] = await Promise.all([tx.get(scoreRef), tx.get(logRef)]);
        if (!score.exists() || score.data().activeSchoolYearKey !== c.schoolYearKey) throw new Error('The active-year student record is unavailable.');
        const title = current.templateId && current.templateId !== 'custom' ? oathTitle({ templateId: current.templateId, category: current.category, text: current.text, target: current.target, seed: current.studentId }) : '';
        const legendLine = cleanCampfireText((title ? 'Kept ' + title + ': ' : 'Kept a promise: ') + current.text, 280);
        const done = { ...current, status: 'kept', evidence: result.evidence, legendLine,
            reflection: { helped: cleanCampfireText(reflection.helped, 240), next: cleanCampfireText(reflection.next, 240), emoji: cleanCampfireText(reflection.emoji, 12) } };
        const nowIso = new Date().toISOString();
        const keepsake = buildOathKeepsake(done, nowIso);
        const scoreData = score.data();
        // The n-th promise this child has kept: their satchel holds one Star-Ember per kept promise.
        const n = Math.max(keptCountFromInventory(scoreData.inventory, id), Math.floor(Number(keptBefore) || 0)) + 1;
        const perk = oathPerkFor(n, { studentId: current.studentId, date: nowIso });
        const extra = perk.keepsake ? [perk.keepsake] : [];
        const inventory = [...(scoreData.inventory || [])].filter(i => i.id !== keepsake.id && !extra.some(x => x.id === i.id));
        tx.update(ref, { status: 'kept', evidence: done.evidence, legendLine, reflection: done.reflection, keptAt: serverTimestamp(), updatedAt: serverTimestamp() });
        const paid = !log.exists();
        tx.update(scoreRef, {
            inventory: [...inventory, keepsake, ...extra],
            // Star Path bonus stars: monthly and total only (never today's stars), plus the Gold they bring.
            ...(paid ? { totalStars: increment(perk.stars), ...monthlyStarsChange(tx, current.studentId, scoreData, perk.stars),
                gold: getLiveYearGold(scoreData, getLiveYearGoldContextFromState(state)) + perk.goldTotal } : {})
        });
        if (paid) tx.set(logRef, withSchoolYear({
            studentId: current.studentId, classId: current.classId, teacherId: c.teacherId,
            stars: perk.stars, appliedStarCredit: perk.stars, reason: EMBER_OATH_AWARD_REASON,
            note: starPathNote(perk, title), oathId: id, starPathRank: perk.rank?.id || '', starPathCount: n, gold: perk.goldTotal,
            date: today, createdAt: serverTimestamp(), createdBy: teacher
        }, yearKey));
        // The oath, keepsake and Hero's Chronicle note share one atomic commit and one stable ID.
        tx.set(doc(db, dataPath('hero_chronicle_notes'), 'ember_' + id), withSchoolYear({
            studentId: current.studentId, teacherId: c.teacherId, noteText: legendLine, category: 'Goals',
            source: 'ember_oath', oathId: id, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }, c.schoolYearKey));
        return { ...done, keptAt: { seconds: Date.now() / 1000 }, perk: paid ? perk : null, perkPaid: paid };
    });
    // Glory follows the stars, the same as any other star (best effort, once per promise).
    if (kept.perkPaid && kept.perk?.stars) {
        import('../../features/guildScoring.js').then(m => m.updateGuildScores(kept.studentId, kept.perk.stars, EMBER_OATH_AWARD_REASON, { idempotencyKey: starPathLogId(id) }))
            .catch(error => console.warn('Star Path Glory failed:', error));
    }
    return kept;
}
/** The logbook row of one kept promise's Star Path gifts (one per promise, never paid twice). */
export function starPathLogId(oathId) { return 'ember_oath_' + String(oathId).replace(/[^\w-]/g, '').slice(0, 60); }

/**
 * A class constellation (one kind of promise) is drawn whole: the class earns Team Quest bonus stars
 * this month. Once per figure per completion (stored on the class as `oathFigures`), so a second
 * laptop or a replayed moment never pays twice.
 * @returns {Promise<number>} the Team Quest stars added (0 if it was already counted).
 */
export async function completeClassFigure(classId, kind, completions, { bonus = FIGURE_TEAM_QUEST_BONUS, name = '' } = {}) {
    const c = oathContext();
    if (!classId || !kind || !(completions > 0)) return 0;
    const classRef = doc(db, dataPath('classes'), classId), monthKey = getMonthKey(new Date());
    const field = String(kind).replace(/[^\w]/g, '_');
    let added = 0;
    await runTransaction(db, async tx => {
        const snap = await tx.get(classRef); if (!snap.exists()) return;
        const data = snap.data() || {};
        const done = Number(data.oathFigures?.[c.schoolYearKey]?.[field]) || 0;
        if (done >= completions) return;
        const current = Number(data.teamQuestBonuses?.[monthKey]) || 0;
        added = bonus;
        tx.update(classRef, { ['oathFigures.' + c.schoolYearKey + '.' + field]: completions, ['teamQuestBonuses.' + monthKey]: current + bonus,
            lastWheelQuestBonusAt: serverTimestamp(), lastWheelQuestBonusNote: ('Constellation drawn: ' + (name || kind)).slice(0, 160) });
    });
    if (added) import('./stars.js').then(m => m.checkAndRecordQuestCompletion(classId)).catch(() => {});
    return added;
}
export async function releaseEmberOath(id) {
    const c = oathContext(), ref = doc(db, dataPath('ember_oaths'), id);
    await runTransaction(db, async tx => {
        const s = await tx.get(ref), oath = s.data(); ownedOath(oath, c);
        if (oath.status !== 'active') throw new Error('Only a growing promise can be let go.');
        tx.update(ref, { status: 'released', updatedAt: serverTimestamp() });
    });
}
export async function setClassCampfireEnabled(classId, enabled) {
    oathContext();
    if (!state.get('allTeachersClasses').some(c => c.id === classId)) throw new Error('Choose your class.');
    await updateDoc(doc(db, dataPath('classes'), classId), { campfireEnabled: !!enabled });
    state.setAllTeachersClasses(state.get('allTeachersClasses').map(c => c.id === classId ? { ...c, campfireEnabled: !!enabled } : c));
}
