import { db, doc, runTransaction, increment, collection, serverTimestamp, arrayUnion } from '../firebase.js';
import { awardGloryToStudents } from './guildScoring.js';
import { chapterKeyFor } from './guildScoringCore.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { showModal } from '../ui/modals/base.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';
import { PATHFINDER_CLASS_QUEST_BONUS_STARS, PATHFINDER_AWARD_REASON } from './awardLogReasonMeta.js';

export const LEGENDARY_ARTIFACTS = [
    { id: 'leg_clarity', name: 'Crystal of Clarity', price: 15, description: 'Pulsing gem for a hint pass. Used on your card.', icon: '💎' },
    { id: 'leg_gilded', name: 'Scroll of the Gilded Star', price: 20, description: '3x Gold for the next star you earn.', icon: '✨' },
    { id: 'leg_hourglass', name: 'Time Warp Hourglass', price: 25, description: 'Adds +5m to any active class Bounty Timers.', icon: '⏳' },
    { id: 'leg_luck', name: 'Elixir of Luck', price: 30, description: '50% chance for +1 star during your NEXT lesson.', icon: '🍀' },
    { id: 'leg_glory_banner', name: 'Banner of Glory', price: 35, description: 'Your next 3 stars each write +1 bonus Guild Glory into the ledger.', icon: '⚜️' },
    { id: 'leg_banner', name: "The Herald's Banner", price: 40, description: 'Broadcasts a school-wide victory celebration!', icon: '📢' },
    { id: 'leg_catalyst', name: 'The Starfall Catalyst', price: 50, description: 'Double the stars for your next high test score.', icon: '📜' },
    { id: 'leg_glory_chalice', name: 'Chalice of Unity', price: 55, description: '+1 Glory right now for you and every guildmate in your class.', icon: '🏆' },
    { id: 'leg_pathfinder', name: 'The Pathfinder’s Map', price: 60, description: `Instant +${PATHFINDER_CLASS_QUEST_BONUS_STARS} Stars for the Team Quest. (Class Limit: 1/month)`, icon: '🗺️' },
    { id: 'leg_protagonist', name: 'The Mask of the Protagonist', price: 75, description: 'Guarantees you are the Hero in the next Story Log. (Limit: 1/month)', icon: '🎭' },
    { id: 'leg_glory_crown', name: 'Guild Standard', price: 75, description: "Your name flies on your guild's banner in the Guild Hall for the rest of this month's Chapter, plus +2 Glory.", icon: '🚩' },
    { id: 'leg_aurum', name: 'Aurum Satchel', price: 32, description: 'Grants 50% off your next Mystic Market purchase this month.', icon: '💰' },
    { id: 'leg_bulwark', name: "Fortune's Favor", price: 48, description: "Your guild's next Fortune's Wheel in your class is gilded: no storms, no Trickster and no common wedges.", icon: '🍀' },
    { id: 'leg_quill', name: "Archivist's Quill", price: 62, description: 'Your next Story Weaver class bonus awards you 1 star instead of 0.5.', icon: '✒️' },
    { id: 'leg_compassion', name: 'Compassion Token', price: 55, description: "Hero's Boon costs 0 Gold for the rest of this month.", icon: '💝' }
];

// Items renamed by the Crown Race keep working when a child already owns them.
const RENAMED_ITEMS = {
    'Chalice of Radiance': 'Chalice of Unity',
    'Crown of the Eternal': 'Guild Standard',
    'Bulwark Crest': "Fortune's Favor",
};

/** The catalog entry for an owned item (by id), so renamed items show today's name and power. */
export function currentArtifactFor(item = {}) {
    const current = LEGENDARY_ARTIFACTS.find((a) => a.id === item.id);
    if (current) return current;
    const renamed = RENAMED_ITEMS[item.name];
    return renamed ? LEGENDARY_ARTIFACTS.find((a) => a.name === renamed) || null : null;
}

function _effectFor(item = {}) {
    const current = currentArtifactFor(item);
    return (current && POWER_UP_EFFECTS[current.name]) || POWER_UP_EFFECTS[RENAMED_ITEMS[item.name]] || POWER_UP_EFFECTS[item.name] || null;
}

export function isItemUsable(itemName) {
    return !!(POWER_UP_EFFECTS[itemName] || POWER_UP_EFFECTS[RENAMED_ITEMS[itemName]]);
}

function updateLocalStudentScore(studentId, patch = {}, removeInventoryIndex = null) {
    const allScores = [...(state.get('allStudentScores') || [])];
    const index = allScores.findIndex((score) => score.id === studentId);
    if (index === -1) return;

    const current = allScores[index];
    const nextInventory = Array.isArray(current.inventory) ? [...current.inventory] : [];
    if (Number.isInteger(removeInventoryIndex) && removeInventoryIndex >= 0 && removeInventoryIndex < nextInventory.length) {
        nextInventory.splice(removeInventoryIndex, 1);
    }

    allScores[index] = {
        ...current,
        ...patch,
        inventory: Object.prototype.hasOwnProperty.call(patch, 'inventory') ? patch.inventory : nextInventory
    };
    state.setAllStudentScores(allScores);
}

function updateLocalClassState(classId, patch = {}) {
    if (!classId || !patch || Object.keys(patch).length === 0) return;
    const applyPatch = (classes) => classes.map((item) => item.id === classId ? { ...item, ...patch } : item);
    state.setAllSchoolClasses(applyPatch(state.get('allSchoolClasses') || []));
    state.setAllTeachersClasses(applyPatch(state.get('allTeachersClasses') || []));
}

const POWER_UP_EFFECTS = {
    'Crystal of Clarity': async (student, classData, context) => ({
        success: true,
        scorePatch: {},
        feedback: {
            icon: '💎',
            title: 'Clarity unlocked',
            body: `${student.name} now has a visible hint-ready glow.`
        },
        localAfterCommit: () => {
            document.dispatchEvent(new CustomEvent('clarity-glimmer', { detail: { studentId: student.id, itemIndex: context.itemIndex } }));
        }
    }),
    'Scroll of the Gilded Star': async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { hasGildedEffect: true });
        return {
            success: true,
            scorePatch: { hasGildedEffect: true },
            feedback: {
                icon: '✨',
                title: 'Gilded effect armed',
                body: `The next star ${student.name} earns now pays triple Gold.`
            }
        };
    },
    'Time Warp Hourglass': async (student, classData, context) => {
        const activeTimers = (state.get('allQuestBounties') || []).filter((bounty) => bounty.classId === classData?.id && bounty.type === 'timer' && bounty.status === 'active');
        if (activeTimers.length === 0) {
            return {
                success: false,
                errorMessage: 'No active timer found for this class right now.'
            };
        }

        const updatedDeadlines = {};
        activeTimers.forEach((bounty) => {
            const newDeadline = new Date(bounty.deadline);
            newDeadline.setMinutes(newDeadline.getMinutes() + 5);
            updatedDeadlines[bounty.id] = newDeadline.toISOString();
            context.transaction.update(doc(db, 'artifacts/great-class-quest/public/data/quest_bounties', bounty.id), {
                deadline: updatedDeadlines[bounty.id]
            });
        });

        return {
            success: true,
            feedback: {
                icon: '⏳',
                title: 'Timers extended',
                body: `${activeTimers.length} active ${activeTimers.length === 1 ? 'timer was' : 'timers were'} stretched by 5 minutes.`
            },
            localAfterCommit: () => {
                const nextBounties = (state.get('allQuestBounties') || []).map((bounty) => (
                    updatedDeadlines[bounty.id]
                        ? { ...bounty, deadline: updatedDeadlines[bounty.id] }
                        : bounty
                ));
                state.set('allQuestBounties', nextBounties);
            }
        };
    },
    'Elixir of Luck': async (student, classData, context) => {
        const nextLessonDate = utils.getNextLessonDate(
            classData?.id,
            state.get('allSchoolClasses'),
            state.get('allScheduleOverrides'),
            state.get('schoolHolidayRanges'),
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        );
        if (!nextLessonDate) {
            return {
                success: false,
                errorMessage: 'Could not find the next lesson date for this class.'
            };
        }

        context.transaction.update(context.scoreRef, { luckDate: nextLessonDate });
        return {
            success: true,
            scorePatch: { luckDate: nextLessonDate },
            feedback: {
                icon: '🍀',
                title: 'Luck bottled for the next lesson',
                body: `${student.name} will carry this luck on ${nextLessonDate}.`
            }
        };
    },
    "The Herald's Banner": async (student) => ({
        success: true,
        feedback: {
            icon: '📢',
            title: 'The banner was raised',
            body: `${student.name} triggered a school-wide celebration.`
        },
        localAfterCommit: () => {
            showPraiseToast(`${student.name} raised the Herald's Banner! Celebration begins!`, '📢');
        }
    }),
    'The Starfall Catalyst': async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { starfallCatalystActive: true });
        return {
            success: true,
            scorePatch: { starfallCatalystActive: true },
            feedback: {
                icon: '📜',
                title: 'Starfall catalyst armed',
                body: `${student.name}'s next high-score bonus will be doubled.`
            }
        };
    },
    'The Pathfinder’s Map': async (student, classData, context) => {
        if (!classData?.id) {
            return { success: false, errorMessage: 'This student is not attached to a valid class.' };
        }

        const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classData.id);
        const classDoc = await context.transaction.get(classRef);
        if (!classDoc.exists()) {
            return { success: false, errorMessage: 'Class not found for Pathfinder bonus.' };
        }

        const classFresh = classDoc.data();
        const monthKey = utils.getMonthKey(new Date());
        const existing = Number(classFresh.teamQuestBonuses?.[monthKey]) || 0;
        if (existing >= PATHFINDER_CLASS_QUEST_BONUS_STARS) {
            return { success: false, errorMessage: 'This class already used the Pathfinder’s Map this month.' };
        }

        const nextBonuses = {
            ...(classFresh.teamQuestBonuses || {}),
            [monthKey]: existing + PATHFINDER_CLASS_QUEST_BONUS_STARS
        };

        context.transaction.update(classRef, {
            [`teamQuestBonuses.${monthKey}`]: increment(PATHFINDER_CLASS_QUEST_BONUS_STARS),
            lastPathfinderDate: utils.getTodayDateString(),
            lastPathfinderByStudentId: student.id,
            lastPathfinderByName: student.name
        });

        context.transaction.set(doc(collection(db, 'artifacts/great-class-quest/public/data/award_log')), {
            studentId: student.id,
            classId: classData.id,
            teacherId: state.get('currentUserId'),
            stars: 0,
            reason: PATHFINDER_AWARD_REASON,
            note: `${student.name} used The Pathfinder's Map to advance the class quest!`,
            date: utils.getTodayDateString(),
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        });

        return {
            success: true,
            classPatch: {
                teamQuestBonuses: nextBonuses,
                lastPathfinderDate: utils.getTodayDateString(),
                lastPathfinderByStudentId: student.id,
                lastPathfinderByName: student.name
            },
            feedback: {
                icon: '🗺️',
                title: 'Class quest boosted',
                body: `${classData.name} just gained +${PATHFINDER_CLASS_QUEST_BONUS_STARS} Team Quest Stars.`
            }
        };
    },
    'The Mask of the Protagonist': async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { pendingHeroStatus: true });
        return {
            success: true,
            scorePatch: { pendingHeroStatus: true },
            feedback: {
                icon: '🎭',
                title: 'Next story hero locked in',
                body: `${student.name} will be the guaranteed protagonist of the next story log.`
            }
        };
    },
    'Banner of Glory': async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { gloryBannerCharges: 3 });
        return {
            success: true,
            scorePatch: { gloryBannerCharges: 3 },
            feedback: {
                icon: '⚜️',
                title: 'Banner raised!',
        body: `${student.name}'s next 3 stars will each write +1 bonus Glory to the guild ledger.`
            }
        };
    },
    'Chalice of Unity': async (student, classData) => {
        if (!student.guildId) {
            return { success: false, errorMessage: 'This student is not in a guild.' };
        }
        const guildmates = (state.get('allStudents') || [])
            .filter((s) => s.guildId === student.guildId && s.classId === student.classId)
            .map((s) => s.id);
        const useKey = `chalice_${student.id}_${Date.now()}`;
        return {
            success: true,
            feedback: {
                icon: '🏆',
                title: 'Chalice of Unity raised!',
                body: `+1 Glory for ${student.name} and every guildmate in ${classData?.name || 'the class'}.`
            },
            localAfterCommit: () => {
                awardGloryToStudents(guildmates, 1, 'market_chalice_of_unity', {
                    classId: student.classId, note: `Chalice of Unity raised by ${student.name}`, idempotencyPrefix: useKey,
                }).catch((e) => console.warn('Chalice of Unity Glory failed:', e));
                showPraiseToast(`${student.name} raised the Chalice of Unity! 🏆 +1 Glory for ${guildmates.length} guildmate${guildmates.length === 1 ? '' : 's'}!`, '🏆');
            }
        };
    },
    'Guild Standard': async (student, classData, context) => {
        const guildId = student.guildId;
        if (!guildId) {
            return { success: false, errorMessage: 'This student is not in a guild.' };
        }
        const chapterKey = chapterKeyFor(new Date());
        const guildRef = doc(db, 'artifacts/great-class-quest/public/data/guild_scores', guildId);
        context.transaction.update(guildRef, {
            [`chapters.${chapterKey}.standards`]: arrayUnion({ studentId: student.id, name: student.name, at: Date.now() }),
        });
        return {
            success: true,
            feedback: {
                icon: '🚩',
                title: 'Guild Standard raised!',
                body: `${student.name}'s name now flies on the guild's banner in the Guild Hall until the Chapter ends.`
            },
            localAfterCommit: () => {
                awardGloryToStudents([student.id], 2, 'market_guild_standard', {
                    classId: student.classId, note: 'Guild Standard', idempotencyPrefix: `standard_${chapterKey}_${Date.now()}`,
                }).catch((e) => console.warn('Guild Standard Glory failed:', e));
                showPraiseToast(`${student.name} raised the Guild Standard! 🚩`, '🚩');
            }
        };
    },
    'Aurum Satchel': async (student, classData, context) => {
        const monthKey = utils.getMonthKey(new Date());
        const voucherPercent = 50;
        context.transaction.update(context.scoreRef, {
            aurumVoucherPercent: voucherPercent,
            aurumVoucherMonth: monthKey
        });
        return {
            success: true,
            scorePatch: {
                aurumVoucherPercent: voucherPercent,
                aurumVoucherMonth: monthKey
            },
            feedback: {
                icon: '💰',
                title: 'Voucher activated',
                body: `${student.name} now has 50% off their next Mystic Market purchase this month.`
            }
        };
    },
    "Fortune's Favor": async (student, classData, context) => {
        if (!student.guildId) {
            return { success: false, errorMessage: 'This student is not in a guild.' };
        }
        context.transaction.update(context.scoreRef, { fortuneFavorArmed: true });
        return {
            success: true,
            scorePatch: { fortuneFavorArmed: true },
            feedback: {
                icon: '🍀',
                title: "Fortune's Favor stored",
                body: `${student.name}'s guild will spin a gilded wheel at this class's next Fortune's Wheel.`
            }
        };
    },
    "Archivist's Quill": async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { storyWeaverDoubleNext: true });
        return {
            success: true,
            scorePatch: { storyWeaverDoubleNext: true },
            feedback: {
                icon: '✒️',
                title: 'Quill charged',
                body: `${student.name}'s next Story Weaver bonus will be worth double stars.`
            }
        };
    },
    'Compassion Token': async (student, classData, context) => {
        const monthKey = utils.getLocalMonthKey();
        context.transaction.update(context.scoreRef, { peerBoonFreeMonthKey: monthKey });
        return {
            success: true,
            scorePatch: { peerBoonFreeMonthKey: monthKey },
            feedback: {
                icon: '💝',
                title: 'Compassion ready',
                body: `${student.name} can bestow Hero's Boons for free for the rest of this month.`
            }
        };
    }
};

export async function handleUseItem(studentId, itemIndex) {
    const student = state.get('allStudents').find((entry) => entry.id === studentId);
    const scoreData = state.get('allStudentScores').find((entry) => entry.id === studentId);
    if (!student || !scoreData?.inventory?.[itemIndex]) return { success: false, cancelled: true };

    const ownedItem = scoreData.inventory[itemIndex];
    const current = currentArtifactFor(ownedItem);
    const item = current ? { ...ownedItem, name: current.name, icon: current.icon, description: current.description } : ownedItem;
    const runEffect = _effectFor(ownedItem);
    if (!runEffect) {
        showToast('This item is a collectible and has no active power.', 'info');
        return { success: false, cancelled: true };
    }

    if (item.id === 'leg_pathfinder') {
        const classData = state.get('allTeachersClasses').find((entry) => entry.id === student.classId);
        const monthKey = utils.getMonthKey(new Date());
        const existing = Number(classData?.teamQuestBonuses?.[monthKey]) || 0;
        if (existing >= 10) {
            showToast("🗺️ The class already used the Pathfinder’s Map this month. No bonus available.", 'info');
            return { success: false, cancelled: true };
        }
    }

    return new Promise((resolve) => {
        showModal(
            `Use ${item.icon || '✨'} ${item.name}?`,
            `<div class="text-center text-gray-600 mt-1">${item.description || 'Consume this item to activate its power.'}</div>`,
            async () => {
                try {
                    const classData = state.get('allTeachersClasses').find((entry) => entry.id === student.classId)
                        || state.get('allSchoolClasses').find((entry) => entry.id === student.classId);

                    const result = await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, 'artifacts/great-class-quest/public/data/student_scores', studentId);
                        const scoreDoc = await transaction.get(scoreRef);
                        if (!scoreDoc.exists()) {
                            return { success: false, errorMessage: 'Student score data is missing.' };
                        }

                        const currentData = scoreDoc.data();
                        const currentInventory = Array.isArray(currentData.inventory) ? [...currentData.inventory] : [];
                        const inventoryItem = currentInventory[itemIndex];
                        if (!inventoryItem || inventoryItem.id !== ownedItem.id || inventoryItem.name !== ownedItem.name) {
                            return { success: false, errorMessage: 'That item is no longer in the inventory.' };
                        }

                        const effectResult = await runEffect(student, classData, {
                            transaction,
                            scoreRef,
                            scoreData: currentData,
                            itemIndex
                        });
                        if (!effectResult?.success) {
                            return effectResult || { success: false, errorMessage: 'The magic fizzled out.' };
                        }

                        currentInventory.splice(itemIndex, 1);
                        transaction.update(scoreRef, { inventory: currentInventory });

                        return {
                            ...effectResult,
                            success: true,
                            inventory: currentInventory
                        };
                    });

                    if (!result?.success) {
                        if (result?.errorMessage) showToast(result.errorMessage, 'error');
                        resolve(result || { success: false });
                        return;
                    }

                    updateLocalStudentScore(studentId, {
                        ...(result.scorePatch || {}),
                        inventory: result.inventory
                    }, null);
                    if (result.classPatch) {
                        updateLocalClassState(student.classId, result.classPatch);
                    }

                    if (typeof result.localAfterCommit === 'function') {
                        result.localAfterCommit();
                    }

                    playSound('magic_chime');
                    if (item.id === 'leg_gilded') {
                        showToast(`Next star for ${student.name} is worth triple Gold!`, 'success');
                    } else if (item.id === 'leg_pathfinder') {
                        showToast(`🗺️ ${classData?.name || 'The class'} advances +10 Team Quest Stars.`, 'success');
                    } else if (item.id === 'leg_luck') {
                        showToast(`🍀 Luck stored for ${student.name}'s next lesson.`, 'success');
                    } else if (result.feedback?.title) {
                        showToast(result.feedback.title, 'success');
                    }

                    resolve(result);
                } catch (error) {
                    console.error(error);
                    showToast('The magic fizzled out!', 'error');
                    resolve({ success: false, error });
                }
            },
            'Use Item',
            'Keep It',
            () => resolve({ success: false, cancelled: true })
        );
    });
}
