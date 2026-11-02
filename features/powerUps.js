import { db, doc, runTransaction, increment, collection, serverTimestamp, arrayUnion } from '../firebase.js';
import { awardGloryToStudents } from './guildScoring.js';
import { chapterKeyFor } from './guildScoringCore.js';
import * as state from '../state.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';
import { PATHFINDER_CLASS_QUEST_BONUS_STARS, PATHFINDER_AWARD_REASON } from './awardLogReasonMeta.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import { legendaryArtSvg } from './legendaryArt.mjs';
import '../styles/legendary_relics.css';

import { LEGENDARY_FAMILIES, LEGENDARY_ARTIFACTS, RETIRED_ARTIFACTS, legendaryFamilyVariants } from './legendaryCatalog.mjs';

export { LEGENDARY_FAMILIES, LEGENDARY_ARTIFACTS, RETIRED_ARTIFACTS, legendaryFamilyVariants };

const ALL_ARTIFACTS = [...LEGENDARY_ARTIFACTS, ...RETIRED_ARTIFACTS];

// Items renamed over time keep working when a child already owns them (old name -> id).
const RENAMED_ITEMS = {
    'Chalice of Radiance': 'leg_glory_chalice',
    'Crown of the Eternal': 'leg_glory_crown',
    'Bulwark Crest': 'leg_bulwark',
    'Banner of Glory': 'leg_glory_banner',
};

function artifactIdFor(itemOrName) {
    if (!itemOrName) return '';
    if (typeof itemOrName === 'object') {
        if (itemOrName.id && ALL_ARTIFACTS.some((a) => a.id === itemOrName.id)) return itemOrName.id;
        return artifactIdFor(itemOrName.name || '');
    }
    const name = String(itemOrName);
    return ALL_ARTIFACTS.find((a) => a.name === name)?.id || RENAMED_ITEMS[name] || '';
}

/** The catalog entry for an owned item (by id), so renamed items show today's name and power. */
export function currentArtifactFor(item = {}) {
    const id = artifactIdFor(item);
    return id ? ALL_ARTIFACTS.find((a) => a.id === id) || null : null;
}

function _effectFor(item = {}) {
    return POWER_UP_EFFECTS[artifactIdFor(item)] || null;
}

export function isItemUsable(itemOrName) {
    return !!POWER_UP_EFFECTS[artifactIdFor(itemOrName)];
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

/** The Pathfinder's Map is one per class each month (other gifts also fill teamQuestBonuses). */
export function pathfinderUsedThisMonth(classData, monthKey) {
    if (!classData || !monthKey) return false;
    return classData.lastPathfinderMonth === monthKey || String(classData.lastPathfinderDate || '').startsWith(monthKey);
}

function armVoucher(student, context, voucherPercent) {
    const monthKey = utils.getMonthKey(new Date());
    const data = context.scoreData || {};
    const active = data.aurumVoucherMonth === monthKey ? Number(data.aurumVoucherPercent) || 0 : 0;
    if (active >= voucherPercent) {
        return { success: false, errorMessage: `${student.name} already has ${active}% off the next Market buy. Spend that first.` };
    }
    context.transaction.update(context.scoreRef, { aurumVoucherPercent: voucherPercent, aurumVoucherMonth: monthKey });
    return {
        success: true,
        scorePatch: { aurumVoucherPercent: voucherPercent, aurumVoucherMonth: monthKey },
        feedback: {
            icon: voucherPercent >= 50 ? '💰' : '👝',
            title: 'Voucher activated',
            body: `${student.name} now has ${voucherPercent}% off their next Mystic Market purchase this month.`
        }
    };
}

const POWER_UP_EFFECTS = {
    leg_clarity: async (student, classData, context) => ({
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
    leg_gilded: async (student, classData, context) => {
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
    leg_hourglass: async (student, classData, context) => {
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
            context.transaction.update(doc(db, `${PUBLIC_DATA_PATH}/quest_bounties`, bounty.id), {
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
    leg_luck: async (student, classData, context) => {
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
    leg_banner: async (student) => ({
        success: true,
        feedback: {
            icon: '📢',
            title: 'The banner was raised',
            body: `${student.name} triggered a school-wide celebration.`
        },
        // the use card's reveal is the celebration now
    }),
    leg_catalyst: async (student, classData, context) => {
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
    leg_pathfinder: async (student, classData, context) => {
        if (!classData?.id) {
            return { success: false, errorMessage: 'This student is not attached to a valid class.' };
        }

        const classRef = doc(db, `${PUBLIC_DATA_PATH}/classes`, classData.id);
        const classDoc = await context.transaction.get(classRef);
        if (!classDoc.exists()) {
            return { success: false, errorMessage: 'Class not found for Pathfinder bonus.' };
        }

        const classFresh = classDoc.data();
        const monthKey = utils.getMonthKey(new Date());
        const existing = Number(classFresh.teamQuestBonuses?.[monthKey]) || 0;
        if (pathfinderUsedThisMonth(classFresh, monthKey)) {
            return { success: false, errorMessage: 'This class already used the Pathfinder’s Map this month.' };
        }

        const nextBonuses = {
            ...(classFresh.teamQuestBonuses || {}),
            [monthKey]: existing + PATHFINDER_CLASS_QUEST_BONUS_STARS
        };

        context.transaction.update(classRef, {
            [`teamQuestBonuses.${monthKey}`]: increment(PATHFINDER_CLASS_QUEST_BONUS_STARS),
            lastPathfinderDate: utils.getTodayDateString(),
            lastPathfinderMonth: monthKey,
            lastPathfinderByStudentId: student.id,
            lastPathfinderByName: student.name
        });

        context.transaction.set(doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`)), {
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
                lastPathfinderMonth: monthKey,
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
    leg_protagonist: async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { pendingHeroStatus: true });
        return {
            success: true,
            scorePatch: { pendingHeroStatus: true },
            feedback: {
                icon: '🎭',
                title: 'Next Hero of the Day locked in',
                body: `${student.name} will be the next Hero of the Day in ${classData?.name || 'the class'}.`
            }
        };
    },
    leg_glory_banner: async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { gloryBannerCharges: 3 });
        return {
            success: true,
            scorePatch: { gloryBannerCharges: 3 },
            feedback: {
                icon: '⚜️',
                title: 'Pennant raised!',
        body: `${student.name}'s next 3 stars will each write +1 bonus Glory to the guild ledger.`
            }
        };
    },
    leg_glory_chalice: async (student, classData) => {
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
                body: `+1 Glory for ${student.name} and ${guildmates.length > 1 ? `${guildmates.length - 1} guildmate${guildmates.length === 2 ? '' : 's'}` : 'the guild'} in ${classData?.name || 'the class'}.`
            },
            localAfterCommit: () => {
                awardGloryToStudents(guildmates, 1, 'market_chalice_of_unity', {
                    classId: student.classId, note: `Chalice of Unity raised by ${student.name}`, idempotencyPrefix: useKey,
                }).catch((e) => console.warn('Chalice of Unity Glory failed:', e));
            }
        };
    },
    leg_glory_crown: async (student, classData, context) => {
        const guildId = student.guildId;
        if (!guildId) {
            return { success: false, errorMessage: 'This student is not in a guild.' };
        }
        const chapterKey = chapterKeyFor(new Date());
        const guildRef = doc(db, `${PUBLIC_DATA_PATH}/guild_scores`, guildId);
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
            }
        };
    },
    leg_aurum_silver: (student, classData, context) => armVoucher(student, context, 25),
    leg_aurum: (student, classData, context) => armVoucher(student, context, 50),
    leg_bulwark: async (student, classData, context) => {
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
    leg_quill: async (student, classData, context) => {
        context.transaction.update(context.scoreRef, { storyWeaverDoubleNext: true });
        return {
            success: true,
            scorePatch: { storyWeaverDoubleNext: true },
            feedback: {
                icon: '✒️',
                title: 'Quill charged',
                body: `${student.name}'s next Training Grounds bonus will be a full star.`
            }
        };
    },
    leg_kindness: async (student, classData, context) => {
        const uses = (Number(context.scoreData?.peerBoonFreeUses) || 0) + 3;
        context.transaction.update(context.scoreRef, { peerBoonFreeUses: uses });
        return {
            success: true,
            scorePatch: { peerBoonFreeUses: uses },
            feedback: {
                icon: '💗',
                title: 'Kindness Locket opened',
                body: `${student.name}'s next ${uses} Hero's Boons cost 0 Gold.`
            }
        };
    },
    leg_compassion: async (student, classData, context) => {
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
    const item = current ? { ...ownedItem, id: current.id, name: current.name, icon: current.icon, description: current.description } : ownedItem;
    const runEffect = _effectFor(ownedItem);
    const { openItemUseRite } = await import('../ui/core/itemUseRite.js');
    const riteItem = {
        id: item.id, name: item.name, icon: item.icon, image: item.image,
        artId: legendaryArtSvg(item.id) ? item.id : '',
    };
    if (!runEffect) {
        // Market treasures carry a Charm instead of a power.
        const { isStallTreasure } = await import('./treasureCharmsCore.mjs');
        if (isStallTreasure(ownedItem)) {
            const { handleUseCharm } = await import('./treasureCharms.js');
            return handleUseCharm(studentId, itemIndex);
        }
        openItemUseRite({
            kind: 'keepsake', student, item: riteItem,
            blockedTitle: `${item.name} is a keepsake`,
            blocked: 'It has no power to use. It stays in the Satchel for good, a memory of the quest.',
        });
        return { success: false, cancelled: true };
    }

    if (item.id === 'leg_pathfinder') {
        const classData = state.get('allTeachersClasses').find((entry) => entry.id === student.classId);
        const monthKey = utils.getMonthKey(new Date());
        if (pathfinderUsedThisMonth(classData, monthKey)) {
            openItemUseRite({
                kind: 'relic', student, item: riteItem,
                blockedTitle: 'The map is resting',
                blocked: 'The class already used the Pathfinder’s Map this month. Keep it for next month’s quest.',
            });
            return { success: false, cancelled: true };
        }
    }

    return new Promise((resolve) => {
        openItemUseRite({
            kind: 'relic',
            student,
            item: riteItem,
            question: `Use the ${item.name.replace(/^The\s+/i, '')}?`,
            effect: item.description || 'Use this relic to wake its power.',
            note: 'A relic is spent when it is used.',
            confirmLabel: 'Use it',
            cancelLabel: 'Keep it',
            onCancel: () => resolve({ success: false, cancelled: true }),
            onConfirm: async () => {
                try {
                    const classData = state.get('allTeachersClasses').find((entry) => entry.id === student.classId)
                        || state.get('allSchoolClasses').find((entry) => entry.id === student.classId);

                    const result = await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                        const scoreDoc = await transaction.get(scoreRef);
                        if (!scoreDoc.exists()) {
                            return { success: false, errorMessage: 'Student score data is missing.' };
                        }

                        const currentData = scoreDoc.data();
                        const currentInventory = Array.isArray(currentData.inventory) ? [...currentData.inventory] : [];
                        const inventoryItem = currentInventory[itemIndex];
                        if (!inventoryItem || inventoryItem.id !== ownedItem.id || inventoryItem.name !== ownedItem.name) {
                            return { success: false, errorMessage: 'That item is no longer in the Satchel.' };
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
                        resolve(result || { success: false });
                        return { ok: false, message: result?.errorMessage || 'The magic fizzled out.' };
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
                    resolve(result);
                    return { ok: true, feedback: result.feedback || { icon: item.icon, title: `${item.name} is working!` } };
                } catch (error) {
                    console.error(error);
                    resolve({ success: false, error });
                    return { ok: false, message: 'The magic fizzled out! Try again in a moment.' };
                }
            }
        });
    });
}
