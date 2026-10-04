// ui/modals/classTools.js — shared bits for the two everyday class tools (Team Maker, Fair Picker):
// which class to open on, who is here today, faces, and saving a small field on the class document.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db, doc, updateDoc } from '../../firebase.js';
import { escapeHtml } from '../../features/roles/shared.js';

const CLASSES_PATH = 'artifacts/great-class-quest/public/data/classes';
const AVATAR_TONES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export const esc = escapeHtml;

export function myClasses() {
    return [...(state.get('allTeachersClasses') || [])]
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId) || null;
}

/** The selected class, else the class of yours in a lesson right now, else your first class today, else your first class. */
export function defaultToolClassId() {
    const mine = myClasses();
    const selected = state.get('globalSelectedClassId');
    if (selected && mine.some((c) => c.id === selected)) return selected;
    try {
        const todays = utils.getClassesOnDay(
            utils.getTodayDateString(),
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        ).filter((c) => mine.some((m) => m.id === c.id));
        const live = utils.findLessonClassWithGrace(todays);
        if (live) return live.id;
        if (todays[0]) return todays[0].id;
    } catch { /* schedule not loaded yet */ }
    return mine[0]?.id || null;
}

/** Children of the class (sorted by name) with today's absences and this month's stars. */
export function classRoster(classId) {
    const today = utils.getTodayDateString();
    const away = new Set((state.get('allAttendanceRecords') || [])
        .filter((r) => r.classId === classId && r.date === today)
        .map((r) => r.studentId));
    const scores = new Map((state.get('allStudentScores') || []).map((s) => [s.id, s]));
    return (state.get('allStudents') || [])
        .filter((s) => s.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .map((s) => ({
            id: s.id,
            name: String(s.name || 'Hero'),
            first: String(s.name || 'Hero').split(/\s+/)[0],
            avatar: s.avatar || '',
            guildId: s.guildId || '',
            stars: Number(scores.get(s.id)?.monthlyStars) || 0,
            away: away.has(s.id)
        }));
}

export function faceHtml(hero, cls = 'ct-face') {
    if (hero?.avatar) return `<span class="${cls}"><img src="${esc(hero.avatar)}" alt="" loading="lazy" decoding="async"></span>`;
    const tone = AVATAR_TONES[utils.simpleHashCode(String(hero?.id || hero?.name || '')) % AVATAR_TONES.length];
    return `<span class="${cls} ct-face--letter" style="--ct-tone:${tone}">${esc((hero?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

export function classPickerHtml(classId, attr) {
    const mine = myClasses();
    if (mine.length < 2) return '';
    return `<label class="ct-class-pick"><span class="sr-only">Class</span>
        <select ${attr}>${mine.map((c) => `<option value="${esc(c.id)}"${c.id === classId ? ' selected' : ''}>${esc(c.logo || '📚')} ${esc(c.name || 'Class')}</option>`).join('')}</select>
        <i class="fas fa-chevron-down" aria-hidden="true"></i></label>`;
}

// Fresh values this session, so a reopened window never shows the copy from before the save landed.
const pending = new Map();

export function readClassField(classId, field) {
    const key = `${classId}|${field}`;
    if (pending.has(key)) return pending.get(key);
    return classById(classId)?.[field] ?? null;
}

export async function saveClassField(classId, field, value) {
    pending.set(`${classId}|${field}`, value);
    try {
        await updateDoc(doc(db, CLASSES_PATH, classId), { [field]: value });
        return true;
    } catch (error) {
        console.warn(`Could not save ${field} for class`, classId, error);
        return false;
    }
}

export function reducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Full screen for the projector; quietly does nothing where the browser refuses. */
export async function enterFullscreen(el) {
    try {
        if (!document.fullscreenElement && el?.requestFullscreen) await el.requestFullscreen();
    } catch { /* not allowed here: the big view still fills the window */ }
}

export async function leaveFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* already out */ }
}
