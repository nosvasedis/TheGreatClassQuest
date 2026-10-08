import { getLeagueBand } from './languageScaffolds.mjs';
import { cleanCampfireText } from './heroCampfireCore.mjs';
import { buildOathSuggestions, pickDiverseOaths, pageLens } from './oathSuggestCore.mjs';
// Evidence and readiness live in a tiny module so always-loaded entry points can share them.
export { oathDate, dedupeEvidence, evaluateOathEvidence } from './emberOathEvidence.mjs';
import { oathDate } from './emberOathEvidence.mjs';
export const OATH_CATEGORIES = ['speak', 'words', 'write', 'read/listen', 'habit', 'virtue'];
const TEXT = {
    early: ['I try a little word.', 'I show a new word.', 'I draw my idea.', 'I listen to a story.', 'I get ready with a friend.', 'I help with kind hands.'],
    junior: ['I try an English sentence.', 'I use three new words.', 'I write a little sentence.', 'I share one thing from a story.', 'I bring what I need.', 'I help someone take a turn.'],
    mid: ['I share an idea in English.', 'I use five lesson words in context.', 'I improve one piece of writing.', 'I explain an idea I read or heard.', 'I practise a little between lessons.', 'I help our group listen to everyone.'],
    upper: ['I explain my opinion and give a reason.', 'I use new vocabulary in a short response.', 'I revise my writing after feedback.', 'I support an interpretation with evidence.', 'I use a practice strategy consistently.', 'I invite another perspective into our discussion.']
};
export function oathTemplates(league) {
    const band = getLeagueBand(league);
    return OATH_CATEGORIES.map((category, i) => ({
        id: band + '_' + category.replace('/', '_'), band, category,
        text: TEXT[band][i], projectorText: TEXT[band][i], weeks: 2,
        target: { kind: category === 'virtue' ? 'virtue' : 'manual', count: band === 'early' ? 1 : 2, ...(category === 'virtue' ? { reason: 'Teamwork' } : {}) },
        evidenceRule: category === 'virtue' ? 'virtue' : 'manual'
    }));
}
/** Look and feel per kind of promise (icons are emoji so they render in the app's 3D emoji style). */
export const CATEGORY_META = Object.freeze({
    speak: { icon: '🗣️', label: 'Speaking', hue: 'sky' },
    words: { icon: '🔤', label: 'New words', hue: 'violet' },
    write: { icon: '✍️', label: 'Writing', hue: 'rose' },
    'read/listen': { icon: '📖', label: 'Reading & listening', hue: 'teal' },
    habit: { icon: '🌱', label: 'Good habit', hue: 'emerald' },
    virtue: { icon: '💛', label: 'Hero virtue', hue: 'amber' }
});
/**
 * Three promises that fit this child (see oathSuggestCore.mjs for the signals), each with a one-line
 * reason for the teacher. `offset` shows the next ideas ("Other ideas"). The child chooses.
 */
export function suggestOaths(profile = {}, { offset = 0, count = 3, lens = '', all = null } = {}) {
    const bank = all || buildOathSuggestions(profile);
    const picks = lens ? pageLens(bank, lens, count, offset) : pickDiverseOaths(bank, count, offset % Math.max(1, bank.length));
    return picks.map(t => ({ ...t, icon: CATEGORY_META[t.category]?.icon || '✨' }));
}
export { buildOathSuggestions };

/** One-tap evidence moments per kind of promise (the teacher can still type their own). */
export const QUICK_MOMENTS = Object.freeze({
    speak: ['Spoke up in English', 'Asked a question in English', 'Answered in a full sentence'],
    words: ['Used a new word in class', 'Used a new word in writing', 'Explained a word to a friend'],
    write: ['Improved a sentence', 'Wrote a little extra', 'Checked their work'],
    'read/listen': ['Retold a story', 'Answered a reading question', 'Listened carefully'],
    habit: ['Came ready to learn', 'Practised at home', 'Remembered their homework'],
    virtue: ['Helped a classmate', 'Listened to a friend', 'Kept going when it was hard']
});

/** Early years: a shared class promise, chosen with one tap. */
export const CLASS_PROMISES = Object.freeze([
    { icon: '👂', text: 'We listen to each other.' },
    { icon: '🤝', text: 'We help our friends.' },
    { icon: '🗣️', text: 'We try to speak English.' },
    { icon: '💛', text: 'We are kind to everyone.' },
    { icon: '🧹', text: 'We tidy up together.' }
]);

/** Children in roster order who still need a promise, starting after the given child. */
export function nextChildWithoutOath(studentIds = [], oaths = [], afterId = null) {
    const busy = new Set(oaths.filter(o => o.status === 'active').map(o => o.studentId));
    const start = afterId ? studentIds.indexOf(afterId) + 1 : 0;
    const ordered = [...studentIds.slice(start), ...studentIds.slice(0, start)];
    return ordered.find(id => !busy.has(id) && id !== afterId) || null;
}

export function addOathCheckIn(oath, mood, date) {
    if (!['flame', 'candle', 'moon'].includes(mood) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid check-in.');
    if (oath.status !== 'active') throw new Error('This promise is no longer active.');
    return [...(oath.checkIns || []).filter(c => c.date !== date), { date, mood }].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
}
export function createOathDraft(template, { studentId, classId, teacherId, schoolYearKey, date, text }) {
    const due = new Date(date + 'T12:00:00'); due.setDate(due.getDate() + Math.min(8, template.weeks || 2) * 7);
    const body = cleanCampfireText(text || template.text, 240);
    if (!body || !studentId || !classId || !teacherId || !schoolYearKey || Number.isNaN(due.getTime())) throw new Error('Complete the promise before saving.');
    return { studentId, classId, teacherId, schoolYearKey, templateId: template.id || 'custom', text: body,
        projectorText: body, category: template.category || 'habit', band: template.band || 'mid',
        target: template.target || { kind: 'manual', count: 2 }, evidenceRule: template.evidenceRule || 'manual',
        startDate: date, dueDate: oathDate(due), status: 'active', private: false, // kept false for the stored shape; every promise is shown as written
        checkIns: [], evidence: [],
        reflection: { helped: '', next: '', emoji: '' }, legendLine: '', keptAt: null };
}
export function buildOathKeepsake(oath, date) {
    const art = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="#302c47"/><circle cx="60" cy="60" r="42" fill="none" stroke="#c4965c" stroke-width="1" opacity=".6"/><path d="M60 24l8 25 26 1-21 16 7 26-20-16-22 16 8-26-21-16 27-1Z" fill="#8d563d"/><path d="M61 32c-1 14 18 22 15 38-2 14-25 17-32 3-8-16 10-23 8-34l8 11c5-7 3-13 1-18Z" fill="#eda44e"/><path d="M59 54c-1 9 11 13 8 20-4 8-15 3-13-4 1-6 5-7 5-16Z" fill="#fff0b8"/><path d="M88 22l2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM28 80l1 4 4 1-4 1-1 4-1-4-4-1 4-1Z" fill="#ffe3a0"/></svg>';
    // An emoji icon renders safely on every surface; the painted Star-Ember travels as a data-URI image.
    return { id: 'ember_' + oath.id, name: 'Star-Ember', icon: '🌟', image: 'data:image/svg+xml,' + encodeURIComponent(art),
        description: oath.legendLine || 'A small promise, kept with care.', source: 'ember_oath', oathId: oath.id, acquiredAt: date };
}
