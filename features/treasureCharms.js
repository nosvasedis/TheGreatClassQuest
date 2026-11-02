// features/treasureCharms.js — calling on a treasure's Charm (a classroom privilege).
// The treasure stays in the satchel; only its charm is marked spent. Rules: treasureCharmsCore.mjs.
import { db, doc, runTransaction } from '../firebase.js';
import * as state from '../state.js';
import { playSound } from '../audio.js';
import { getLocalIsoDateString } from '../utils.js';
import { JUNIOR_LEAGUES } from '../constants.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import { charmFor, charmText, charmUseCheck, countCharmsUsedOn } from './treasureCharmsCore.mjs';

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

export async function handleUseCharm(studentId, itemIndex) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const scoreData = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
    const owned = scoreData?.inventory?.[itemIndex];
    if (!student || !owned) return { success: false, cancelled: true };

    const { openItemUseRite } = await import('../ui/core/itemUseRite.js');
    const today = getLocalIsoDateString();
    const charm = charmFor(owned);
    const riteItem = { id: owned.id, name: owned.name, icon: owned.icon, image: owned.image, tier: charm.tier };
    const check = charmUseCheck(scoreData.inventory, itemIndex, {
        today,
        classCharmsToday: classCharmsToday(student.classId, today)
    });
    if (!check.ok) {
        openItemUseRite({
            kind: 'charm', student, item: riteItem, charmIcon: charm.icon,
            blockedTitle: `${charm.title} is sleeping`,
            blocked: check.reason,
        });
        return { success: false, cancelled: true };
    }
    const words = charmText(charm, { young: isYoungClass(student.classId) });
    const firstName = String(student.name || 'Hero').trim().split(/\s+/)[0];

    return new Promise((resolve) => {
        openItemUseRite({
            kind: 'charm',
            student,
            item: riteItem,
            charmIcon: charm.icon,
            question: `Call on the ${charm.title} charm?`,
            effect: `${owned.name} lets ${firstName}: ${words}`,
            note: `This spends one woken ${charm.tier} charm. The treasure stays in the Satchel.`,
            confirmLabel: 'Use the charm',
            cancelLabel: 'Keep it for later',
            onCancel: () => resolve({ success: false, cancelled: true }),
            onConfirm: async () => {
                try {
                    const usedAt = new Date().toISOString();
                    const result = await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                        const snap = await transaction.get(scoreRef);
                        if (!snap.exists()) return { success: false, errorMessage: 'Student score data is missing.' };
                        const inventory = Array.isArray(snap.data().inventory) ? [...snap.data().inventory] : [];
                        const entry = inventory[itemIndex];
                        if (!entry || entry.id !== owned.id || entry.name !== owned.name) {
                            return { success: false, errorMessage: 'That treasure is no longer in the Satchel.' };
                        }
                        const fresh = charmUseCheck(inventory, itemIndex, { today });
                        if (!fresh.ok) return { success: false, errorMessage: fresh.reason };
                        // charmSet: this use spent a woken set (old one-off uses have no flag).
                        inventory[itemIndex] = { ...entry, charm: charm.id, charmUsedAt: usedAt, charmSet: true };
                        transaction.update(scoreRef, { inventory });
                        return { success: true, inventory };
                    });
                    if (!result.success) {
                        resolve(result);
                        return { ok: false, message: result.errorMessage || 'The charm fizzled out. Try again.' };
                    }
                    const scores = [...(state.get('allStudentScores') || [])];
                    const at = scores.findIndex((s) => s.id === studentId);
                    if (at !== -1) {
                        scores[at] = { ...scores[at], inventory: result.inventory };
                        state.setAllStudentScores(scores);
                    }
                    playSound('magic_chime');
                    resolve({ success: true, charm });
                    // The class sees it on the projector: the teacher honours it in the lesson.
                    return { ok: true, feedback: { icon: charm.icon, title: `${firstName}'s ${charm.title}!`, body: words } };
                } catch (error) {
                    console.error(error);
                    resolve({ success: false, error });
                    return { ok: false, message: 'The charm fizzled out. Try again.' };
                }
            }
        });
    });
}
