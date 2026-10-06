// ui/modals/classTools.js — shared bits for the two everyday class tools (Team Maker, Fair Picker):
// which class to open on, who is here today, faces, and saving a small field on the class document.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db, doc, updateDoc } from '../../firebase.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { dataPath } from '../../utils/tenant.mjs';

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

/** The class selected in the header, when it is one of yours (the tools follow it). */
export function selectedToolClassId() {
    const selected = state.get('globalSelectedClassId');
    return selected && myClasses().some((c) => c.id === selected) ? selected : null;
}

/** Calls back with the new class id (or null) whenever the header's class changes. Returns an unsubscribe. */
export function followSelectedClass(callback) {
    return state.subscribe('globalSelectedClassId', () => callback(selectedToolClassId()));
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
        await updateDoc(doc(db, dataPath('classes'), classId), { [field]: value });
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
