// /features/powerUps.js
import { db, doc, runTransaction, updateDoc, increment, collection, serverTimestamp } from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { showModal } from '../ui/modals/base.js';
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
    "Crystal of Clarity": (student, classData, context) => activateClarity(student, classData, context),
    "Scroll of the Gilded Star": (student, classData, context) => activateGildedScroll(student, classData, context),
    "Time Warp Hourglass": (student, classData, context) => extendBountyTimer(classData.id, context),
    "Elixir of Luck": (student, classData, context) => activateNextLessonLuck(student, classData, context),
    "The Herald's Banner": (student, classData, context) => broadcastBanner(student, classData, context),
    "The Starfall Catalyst": (student, classData, context) => activateStarfallCatalyst(student, classData, context),
    "The Pathfinder’s Map": (student, classData, context) => activatePathfinderMap(student, classData, context),
    "The Mask of the Protagonist": (student, classData, context) => activateProtagonistMask(student, classData, context)
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

    // Pre-check: Pathfinder Map — verify the class hasn’t already used it this month
    if (item.id === 'leg_pathfinder') {
        const classData = state.get('allTeachersClasses').find(c => c.id === student.classId);
        const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const existing = Number(classData?.teamQuestBonuses?.[monthKey]) || 0;
        if (existing >= 10) {
            showToast("🗺️ The class already used the Pathfinder’s Map this month. No bonus available.", "info");
            return;
        }
    }

    // Styled confirm modal (replaces native browser confirm())
    showModal(
        `Use ${item.icon || '✨'} ${item.name}?`,
        `<div class="text-center text-gray-600 mt-1">${item.description || 'Consume this item to activate its power.'}</div>`,
        async () => {
            if (item.name === "Crystal of Clarity") {
                document.dispatchEvent(new CustomEvent('clarity-glimmer', { detail: { studentId, itemIndex } }));
                showToast("Incoming hint", 'success');
            }

            try {
                const operationSucceeded = await runTransaction(db, async (transaction) => {
                    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", studentId);
                    const scoreDoc = await transaction.get(scoreRef);
                    const currentInventory = scoreDoc.data().inventory || [];
                    const classData = state.get('allTeachersClasses').find(c => c.id === student.classId);

                    const success = await POWER_UP_EFFECTS[item.name](student, classData, { transaction });
                    if (success) {
                        currentInventory.splice(itemIndex, 1);
                        transaction.update(scoreRef, { inventory: currentInventory });
                    }
                    return success; // surface result so outer code only runs on true success
                });

                if (operationSucceeded) {
                    playSound('magic_chime');
                    // Show toasts once here (not inside transaction) so they don’t run twice on retry
                    if (item.id === 'leg_gilded') {
                        showToast(`Next star for ${student.name} is worth triple Gold!`, 'success');
                    } else if (item.id === 'leg_pathfinder') {
                        showToast(`🗺️ The class quest advances! +10 Team Stars — thanks to ${student.name}'s discovery!`, 'success');
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
                }
            } catch (error) {
                console.error(error);
                showToast("The magic fizzled out!", "error");
            }
        },
        'Use Item',
        'Keep It'
    );
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

async function activatePathfinderMap(student, classData, context = {}) {
    if (!classData?.id || !context.transaction) {
        showToast("Could not apply Pathfinder bonus right now.", "error");
        return false;
    }
    const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classData.id);
    const classDoc = await context.transaction.get(classRef);
    if (!classDoc.exists()) {
        showToast("Class not found for Pathfinder bonus.", "error");
        return false;
    }

    const classFresh = classDoc.data();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existing = Number(classFresh.teamQuestBonuses?.[monthKey]) || 0;
    if (existing >= 10) {
        showToast("Pathfinder Map has already been used for this class this month.", "info");
        return false;
    }

    context.transaction.update(classRef, {
        [`teamQuestBonuses.${monthKey}`]: increment(10),
        lastPathfinderDate: utils.getTodayDateString(),
        lastPathfinderByStudentId: student.id,
        lastPathfinderByName: student.name
    });

    // Create award log entry for calendar
    const awardLogData = {
        studentId: student.id,
        classId: classData.id,
        teacherId: state.get('currentUserId'),
        stars: 0, // No individual stars for student
        reason: 'pathfinder_map',
        note: `${student.name} used The Pathfinder's Map to advance the class quest!`,
        date: utils.getTodayDateString(),
        createdAt: serverTimestamp(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    };
    context.transaction.set(doc(collection(db, "artifacts/great-class-quest/public/data/award_log")), awardLogData);

    return true;
}

async function activateProtagonistMask(student) {
    const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", student.id);
    await updateDoc(scoreRef, { pendingHeroStatus: true });
    showToast(`🎭 ${student.name} is the protagonist of the next story!`, 'success');
    return true;
}
