// features/treasureCharms.js — calling on a treasure's Charm (a classroom privilege).
// The treasure stays in the satchel; only its charm is marked spent. Rules: treasureCharmsCore.mjs.
import { db, doc, runTransaction } from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { showModal } from '../ui/modals/base.js';
import { playSound } from '../audio.js';
import { getLocalIsoDateString } from '../utils.js';
import { JUNIOR_LEAGUES } from '../constants.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import { charmFor, charmText, charmUseCheck, countCharmsUsedOn } from './treasureCharmsCore.mjs';

function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function classOf(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

/** Young leagues read the simpler wording of each charm. */
export function isYoungClass(classId) {
    return JUNIOR_LEAGUES.includes(classOf(classId)?.questLevel);
}

function classCharmsToday(classId, today) {
    const ids = new Set((state.get('allStudents') || []).filter((s) => s.classId === classId).map((s) => s.id));
    const inventories = (state.get('allStudentScores') || []).filter((sc) => ids.has(sc.id)).map((sc) => sc.inventory);
    return countCharmsUsedOn(inventories, today);
}

export function handleUseCharm(studentId, itemIndex) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const scoreData = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
    const owned = scoreData?.inventory?.[itemIndex];
    if (!student || !owned) return Promise.resolve({ success: false, cancelled: true });

    const today = getLocalIsoDateString();
    const check = charmUseCheck(scoreData.inventory, itemIndex, {
        today,
        classCharmsToday: classCharmsToday(student.classId, today)
    });
    if (!check.ok) {
        showToast(check.reason, 'info');
        return Promise.resolve({ success: false, cancelled: true });
    }
    const charm = charmFor(owned);
    const words = charmText(charm, { young: isYoungClass(student.classId) });
    const firstName = String(student.name || 'Hero').trim().split(/\s+/)[0];

    return new Promise((resolve) => {
        showModal(
            `Use the ${charm.title} charm?`,
            `<div class="text-center text-gray-600 mt-1">
                <div class="text-4xl mb-2" aria-hidden="true">${esc(charm.icon)}</div>
                <p><b>${esc(owned.name)}</b> lets ${esc(firstName)}: ${esc(words)}</p>
                <p class="text-sm mt-2">The treasure stays in the collection. Each charm works once.</p>
            </div>`,
            async () => {
                try {
                    const usedAt = new Date().toISOString();
                    const result = await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                        const snap = await transaction.get(scoreRef);
                        if (!snap.exists()) return { success: false, errorMessage: 'Student score data is missing.' };
                        const inventory = Array.isArray(snap.data().inventory) ? [...snap.data().inventory] : [];
                        const entry = inventory[itemIndex];
                        if (!entry || entry.id !== owned.id || entry.name !== owned.name) {
                            return { success: false, errorMessage: 'That treasure is no longer in the satchel.' };
                        }
                        const fresh = charmUseCheck(inventory, itemIndex, { today });
                        if (!fresh.ok) return { success: false, errorMessage: fresh.reason };
                        inventory[itemIndex] = { ...entry, charm: charm.id, charmUsedAt: usedAt };
                        transaction.update(scoreRef, { inventory });
                        return { success: true, inventory };
                    });
                    if (!result.success) {
                        if (result.errorMessage) showToast(result.errorMessage, 'error');
                        resolve(result);
                        return;
                    }
                    const scores = [...(state.get('allStudentScores') || [])];
                    const at = scores.findIndex((s) => s.id === studentId);
                    if (at !== -1) {
                        scores[at] = { ...scores[at], inventory: result.inventory };
                        state.setAllStudentScores(scores);
                    }
                    playSound('magic_chime');
                    // The class sees it on the projector: the teacher honours it in the lesson.
                    showPraiseToast(`${firstName}'s ${owned.name}: ${charm.title}! ${words}`, charm.icon);
                    resolve({ success: true, charm });
                } catch (error) {
                    console.error(error);
                    showToast('The charm fizzled out. Try again.', 'error');
                    resolve({ success: false, error });
                }
            },
            'Use the charm',
            'Keep it for later',
            () => resolve({ success: false, cancelled: true })
        );
    });
}
