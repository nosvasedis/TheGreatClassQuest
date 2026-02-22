// /features/powerUps.js
import { db, doc, runTransaction, serverTimestamp, collection, addDoc, updateDoc, increment, setDoc } from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';

/**
 * FIXED LEGENDARY ARTIFACTS
 * These are always available and do not change.
 */
export const LEGENDARY_ARTIFACTS = [
    { id: 'leg_clarity', name: "Crystal of Clarity", price: 15, description: "Pulsing gem for a hint pass. Used on your card.", icon: "💎" },
    { id: 'leg_gilded', name: "Scroll of the Gilded Star", price: 20, description: "3x Gold for the next star you earn.", icon: "✨" },
    { id: 'leg_hourglass', name: "Time Warp Hourglass", price: 25, description: "Adds +5m to any active class Bounty Timers.", icon: "⏳" },
    { id: 'leg_luck', name: "Elixir of Luck", price: 30, description: "20% chance for +1 star during your NEXT lesson.", icon: "🍀" },
    { id: 'leg_banner', name: "The Herald's Banner", price: 40, description: "Broadcasts a school-wide victory celebration!", icon: "📢" },
    { id: 'leg_catalyst', name: "The Starfall Catalyst", price: 50, description: "Double the stars for your next high test score.", icon: "📜" },
    { id: 'leg_pathfinder', name: "The Pathfinder’s Map", price: 60, description: "Instant +10 Stars for the Team Quest. (Class Limit: 1/month)", icon: "🗺️" },
    { id: 'leg_protagonist', name: "The Mask of the Protagonist", price: 75, description: "Guarantees you are the Hero in the next Story Log.", icon: "🎭" }
];

/** Whether an item can be used (has an active power). Use for UI to show "Use" button. */
export function isItemUsable(itemName) {
    return !!POWER_UP_EFFECTS[itemName];
}

const POWER_UP_EFFECTS = {
    "Crystal of Clarity": (student) => activateClarity(student),
    "Scroll of the Gilded Star": (student) => activateGildedScroll(student),
    "Time Warp Hourglass": (student, classData) => extendBountyTimer(classData.id),
    "Elixir of Luck": (student, classData) => activateNextLessonLuck(student, classData),
    "The Herald's Banner": (student) => broadcastBanner(student),
    "The Starfall Catalyst": (student) => activateStarfallCatalyst(student),
    "The Pathfinder’s Map": (student, classData) => activatePathfinderMap(student, classData),
    "The Mask of the Protagonist": (student) => activateProtagonistMask(student)
};

export async function handleUseItem(studentId, itemIndex) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    if (!scoreData?.inventory?.[itemIndex]) return;
    
    const item = scoreData.inventory[itemIndex];
    if (!POWER_UP_EFFECTS[item.name]) {
        showToast("This item is a collectible and has no active power.", "info");
        return;
    }

    if (!confirm(`Consume ${item.name}?`)) return;

    if (item.name === "Crystal of Clarity") {
        document.dispatchEvent(new CustomEvent('clarity-glimmer', { detail: { studentId, itemIndex } }));
        showToast("Incoming hint", 'success');
    }

    try {
        await runTransaction(db, async (transaction) => {
            const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", studentId);
            const scoreDoc = await transaction.get(scoreRef);
            const currentInventory = scoreDoc.data().inventory || [];
            const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);

            const success = await POWER_UP_EFFECTS[item.name](student, classData);

            if (success) {
                currentInventory.splice(itemIndex, 1);
                transaction.update(scoreRef, { inventory: currentInventory });
            }
        });
        playSound('magic_chime');
        // Show toasts once here (not inside transaction) so they don't run twice on transaction retry
        if (item.name === "Scroll of the Gilded Star") {
            showToast(`Next star for ${student.name} is worth triple Gold!`, 'success');
        }
        // Update local state so UI (Trophy Room, avatar popover) reflects item removed immediately
        const allScores = state.get('allStudentScores');
        const idx = allScores.findIndex(s => s.id === studentId);
        if (idx !== -1 && allScores[idx].inventory) {
            const nextInv = [...allScores[idx].inventory];
            nextInv.splice(itemIndex, 1);
            allScores[idx] = { ...allScores[idx], inventory: nextInv };
            state.setAllStudentScores(allScores);
        }
    } catch (error) {
        console.error(error);
        showToast("The magic fizzled out!", "error");
    }
}

// --- EFFECT FUNCTIONS ---

async function activateClarity(student) {
    // Crystal of Clarity: no DB flag. Use = glimmer + "Incoming hint" + item consumed (handled in handleUseItem).
    return true;
}

async function activateGildedScroll(student) {
    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", student.id);
    await updateDoc(scoreRef, { hasGildedEffect: true });
    return true;
}

async function extendBountyTimer(classId) {
    const bounties = state.get('allQuestBounties').filter(b => b.classId === classId && b.type === 'timer' && b.status === 'active');
    if (bounties.length === 0) { showToast("No active timer found!", "error"); return false; }
    for (const b of bounties) {
        const newDeadline = new Date(b.deadline);
        newDeadline.setMinutes(newDeadline.getMinutes() + 5);
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/quest_bounties", b.id), { deadline: newDeadline.toISOString() });
    }
    showToast("⏳ Time Warp! +5 mins added to timers.", "success");
    return true;
}

async function activateNextLessonLuck(student, classData) {
    const nextLessonDate = utils.getNextLessonDate(classData.id, state.get('allSchoolClasses'));
    if (!nextLessonDate) { showToast("Could not find a future lesson date.", "error"); return false; }
    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", student.id);
    await updateDoc(scoreRef, { luckDate: nextLessonDate });
    showToast(`Luck Elixir set for ${student.name} on ${nextLessonDate}!`, 'success');
    return true;
}

async function broadcastBanner(student) {
    showPraiseToast(`${student.name} raised the Herald's Banner! Celebration begins!`, '📢');
    return true;
}

async function activateStarfallCatalyst(student) {
    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", student.id);
    await updateDoc(scoreRef, { starfallCatalystActive: true });
    showToast(`✨ ${student.name}'s next Starfall bonus will be DOUBLED!`, 'success');
    return true;
}

async function activatePathfinderMap(student, classData) {
    const logRef = doc(collection(db, "artifacts/great-class-quest/public/data/award_log"));
    await setDoc(logRef, {
        studentId: student.id,
        classId: classData.id,
        teacherId: state.get('currentUserId'),
        stars: 10,
        reason: "pathfinder_bonus",
        note: `Pathfinder Map used by ${student.name}!`,
        date: utils.getTodayDateString(),
        createdAt: serverTimestamp(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    });
    showToast(`🗺️ ${student.name} discovered a shortcut! +10 Stars for the Team Map!`, 'success');
    return true;
}

async function activateProtagonistMask(student) {
    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", student.id);
    await updateDoc(scoreRef, { pendingHeroStatus: true });
    showToast(`🎭 ${student.name} is the protagonist of the next story!`, 'success');
    return true;
}
