// /features/boons.js
import { db, doc, runTransaction, increment, serverTimestamp, collection, query, where, getDocs, deleteField } from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';
import { reconcileFamiliarLifecycle } from './familiars.js';
import { applyReasonAwardScoreTransaction, applyAwardOutwardSkillEffects, checkAndRecordQuestCompletion, showHeroLevelUpCelebration } from '../db/actions/stars.js';
import { checkBountyProgress } from '../db/actions/bounties.js';
import { updateGuildScores } from './guildScoring.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../utils/yearGold.js';
import {
    PEER_BOON_BASE_STARS,
    PEER_BOON_COST,
    PEER_BOON_DAILY_CAP,
    computePeerBoonSettlement,
    getPatronPathWeekKeyFromDateString
} from './heroClasses.js';
import { canUseFeature } from '../utils/subscription.js';
import { withSchoolYear } from '../utils/schoolYear.js';

export const TEACHER_BOON_PRESETS = [
    { key: 'leadership', label: 'Leadership', icon: '👑', accent: 'from-fuchsia-500 via-rose-500 to-orange-400' },
    { key: 'perseverance', label: 'Perseverance', icon: '🔥', accent: 'from-amber-400 via-orange-500 to-rose-500' },
    { key: 'kindness', label: 'Kindness', icon: '💖', accent: 'from-pink-400 via-rose-400 to-fuchsia-500' },
    { key: 'bravery', label: 'Bravery', icon: '🛡️', accent: 'from-sky-400 via-cyan-500 to-indigo-500' },
    { key: 'helping_others', label: 'Helping Others', icon: '🤝', accent: 'from-emerald-400 via-teal-500 to-cyan-500' },
    { key: 'remarkable_growth', label: 'Remarkable Growth', icon: '🌟', accent: 'from-violet-500 via-purple-500 to-fuchsia-500' }
];

export function getTeacherBoonPreset(presetKey) {
    return TEACHER_BOON_PRESETS.find((preset) => preset.key === presetKey) || null;
}

export function getTeacherBoonForMonth(classData, monthKey = utils.getLocalMonthKey()) {
    return classData?.teacherBoons?.[monthKey] || null;
}

/** Prefer school list, then the teacher’s class list (same fields, avoids stale slice edge cases). */
export function getClassDataById(classId) {
    if (!classId) return null;
    const schoolClasses = state.get('allSchoolClasses') || [];
    const teachersClasses = state.get('allTeachersClasses') || [];
    return schoolClasses.find((c) => c.id === classId) || teachersClasses.find((c) => c.id === classId) || null;
}

export function formatTeacherBoonReason(boon) {
    return String(boon?.reasonText || boon?.presetLabel || '').trim();
}

export async function handleBestowBoon(senderId, receiverId) {
    if (senderId === receiverId) {
        showToast("An adventurer cannot bestow a boon on themselves!", "error");
        return;
    }

    const sender = state.get('allStudents').find(s => s.id === senderId);
    const receiver = state.get('allStudents').find(s => s.id === receiverId);

    // Enforce 4-per-class-per-day peer boon limit before entering the transaction
    const todayStr = utils.getTodayDateString();
    const logsQuery = query(
        collection(db, 'artifacts/great-class-quest/public/data/award_log'),
        where('classId', '==', receiver.classId),
        where('date', '==', todayStr),
        where('reason', '==', 'peer_boon')
    );
    const existingSnap = await getDocs(logsQuery);
    if (existingSnap.size >= PEER_BOON_DAILY_CAP) {
        showToast('Daily boon limit reached — max 4 per class per day!', 'error');
        return;
    }

    try {
        let receiverStarDelta = PEER_BOON_BASE_STARS;
        let patronLevelUpInfo = null;
        let patronGiftResult = { applies: false, giverGoldBonus: 0, extraStarsForReceiver: 0, pathCredit: 0, skillEventCredit: 0, newReasonStars: 0, newHeroLevel: 0, leveledUp: false };
        const giftWeekKey = getPatronPathWeekKeyFromDateString(todayStr);

        await runTransaction(db, async (transaction) => {
            const senderScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", senderId);
            const receiverScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", receiverId);

            const senderDoc = await transaction.get(senderScoreRef);
            const senderData = senderDoc.data() || {};
            const currentGold = getLiveYearGold(senderData, getLiveYearGoldContextFromState(state));
            const freeBoonUses = Number(senderData.peerBoonFreeUses) || 0;
            const monthKey = utils.getLocalMonthKey();
            const isMonthFree = senderData.peerBoonFreeMonthKey === monthKey;

            const settlement = computePeerBoonSettlement({
                senderId,
                receiverId,
                dailyCount: existingSnap.size,
                currentGold,
                freeBoonUses,
                isMonthFree,
                lastPeerBoonRecipientId: senderData.lastPeerBoonRecipientId,
                senderStudent: sender,
                senderScoreData: senderData,
                heroProgressionEnabled: canUseFeature('heroProgression'),
                weekKey: giftWeekKey || undefined
            });
            if (!settlement.ok) throw settlement.error;

            const senderUpdate = { lastPeerBoonRecipientId: receiverId };
            if (settlement.usesFreeUse) {
                if (freeBoonUses <= 1) {
                    senderUpdate.peerBoonFreeUses = deleteField();
                } else {
                    senderUpdate.peerBoonFreeUses = freeBoonUses - 1;
                }
            } else if (!settlement.isMonthFree) {
                senderUpdate.gold = settlement.goldAfterSpend;
            }

            const patronGift = settlement.patronGift;
            receiverStarDelta = settlement.receiverStarDelta;
            patronGiftResult = patronGift;

            if (patronGift.applies) {
                senderUpdate.gold = settlement.giverGoldAfter;
                if (patronGift.pathCredit > 0) {
                    senderUpdate['starsByReason.peer_boon'] = patronGift.newReasonStars;
                    senderUpdate.heroLevel = patronGift.newHeroLevel;
                    if (patronGift.pathWeekKey) {
                        senderUpdate.lastPatronPathCreditWeekKey = patronGift.pathWeekKey;
                    }
                    if (patronGift.leveledUp) {
                        senderUpdate.pendingSkillChoice = true;
                        patronLevelUpInfo = {
                            studentId: senderId,
                            studentName: sender.name,
                            newHeroLevel: patronGift.newHeroLevel,
                            heroClass: sender.heroClass
                        };
                    }
                }
            }

            transaction.update(senderScoreRef, senderUpdate);

            transaction.update(receiverScoreRef, {
                totalStars: increment(receiverStarDelta),
                monthlyStars: increment(receiverStarDelta)
            });

            const logRef = doc(collection(db, "artifacts/great-class-quest/public/data/award_log"));
            transaction.set(logRef, withSchoolYear({
                studentId: receiverId,
                giverId: senderId,
                classId: receiver.classId,
                teacherId: state.get('currentUserId'),
                stars: PEER_BOON_BASE_STARS,
                appliedStarCredit: receiverStarDelta,
                reason: "peer_boon",
                note: `Hero's Boon from ${sender.name}!`,
                date: todayStr,
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            }, state.getActiveSchoolYearKey()));
        });

        // Update local state immediately on success
        const allScores = state.get('allStudentScores');
        const senderIdx = allScores.findIndex(s => s.id === senderId);
        if (senderIdx !== -1) {
            allScores[senderIdx].lastPeerBoonRecipientId = receiverId;
            const oldGold = getLiveYearGold(allScores[senderIdx], getLiveYearGoldContextFromState(state));
            const freeBoonUses = Number(allScores[senderIdx].peerBoonFreeUses) || 0;
            const monthKey = utils.getLocalMonthKey();
            const isMonthFree = allScores[senderIdx].peerBoonFreeMonthKey === monthKey;

            if (!isMonthFree && freeBoonUses > 0) {
                if (freeBoonUses <= 1) {
                    delete allScores[senderIdx].peerBoonFreeUses;
                } else {
                    allScores[senderIdx].peerBoonFreeUses = freeBoonUses - 1;
                }
            } else if (!isMonthFree) {
                allScores[senderIdx].gold = Math.max(0, oldGold - PEER_BOON_COST);
            }
            if (patronGiftResult.applies) {
                const goldNow = getLiveYearGold(allScores[senderIdx], getLiveYearGoldContextFromState(state));
                allScores[senderIdx].gold = Math.max(0, goldNow + patronGiftResult.giverGoldBonus);
                if (patronGiftResult.pathCredit > 0) {
                    allScores[senderIdx].starsByReason = {
                        ...(allScores[senderIdx].starsByReason || {}),
                        peer_boon: patronGiftResult.newReasonStars
                    };
                    allScores[senderIdx].heroLevel = patronGiftResult.newHeroLevel;
                    if (patronGiftResult.pathWeekKey) {
                        allScores[senderIdx].lastPatronPathCreditWeekKey = patronGiftResult.pathWeekKey;
                    }
                    if (patronGiftResult.leveledUp) {
                        allScores[senderIdx].pendingSkillChoice = true;
                    }
                }
            }
        }
        const receiverIdx = allScores.findIndex(s => s.id === receiverId);
        if (receiverIdx !== -1) {
            allScores[receiverIdx].totalStars = (allScores[receiverIdx].totalStars || 0) + receiverStarDelta;
            allScores[receiverIdx].monthlyStars = (allScores[receiverIdx].monthlyStars || 0) + receiverStarDelta;
        }
        state.setAllStudentScores(allScores);

        reconcileFamiliarLifecycle(receiverId, { announce: true, source: 'peer-boon' }).catch((e) => console.warn('Peer boon familiar reconciliation failed:', e));
        updateGuildScores(receiverId, receiverStarDelta, 'peer_boon');
        if (patronGiftResult.applies) {
            applyAwardOutwardSkillEffects(senderId, sender.classId, 'peer_boon', patronGiftResult.skillEventCredit, { giftReceiverId: receiverId }).catch((e) => console.warn('Patron outward skill effect failed:', e));
        }
        if (patronLevelUpInfo) {
            showHeroLevelUpCelebration(patronLevelUpInfo);
        }
        playSound('magic_chime');
        showToast(`${receiver.name} received a Hero's Boon!`, 'success');
    } catch (error) {
        showToast(typeof error === 'string' ? error : "The magic failed!", "error");
    }
}

export async function awardTeacherBoon({ classId, studentId, stars, presetKey, customReason = '' }) {
    const numericStars = Number(stars);
    const trimmedCustomReason = String(customReason || '').trim();
    if (!classId || !studentId) throw new Error('Choose a class and student first.');
    if (numericStars !== 2) throw new Error('Teacher Boon always awards 2 stars.');
    if (!utils.isTeacherBoonWindow()) {
        throw new Error('Teacher Boon is only available during the last week of the month.');
    }

    const preset = getTeacherBoonPreset(presetKey);
    if (!preset && !trimmedCustomReason) throw new Error('Choose a reason for the Teacher Boon.');

    const reasonText = trimmedCustomReason || preset.label;
    const storedPresetKey = preset?.key || 'custom';
    const storedPresetLabel = preset?.label || 'Custom Reason';
    const today = utils.getTodayDateString();
    const monthKey = utils.getLocalMonthKey();
    const publicDataPath = 'artifacts/great-class-quest/public/data';
    let levelUpInfo = null;
    let appliedGuildStars = numericStars;

    await runTransaction(db, async (transaction) => {
        const classRef = doc(db, `${publicDataPath}/classes`, classId);
        const studentRef = doc(db, `${publicDataPath}/students`, studentId);
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

        const [classDoc, studentDoc, scoreDoc] = await Promise.all([
            transaction.get(classRef),
            transaction.get(studentRef),
            transaction.get(scoreRef)
        ]);

        if (!classDoc.exists()) throw new Error('Selected class not found.');
        if (!studentDoc.exists()) throw new Error('Selected student not found.');

        const classData = classDoc.data();
        const studentData = studentDoc.data();
        if (studentData.classId !== classId) throw new Error('That student is not in the selected class.');
        if (getTeacherBoonForMonth(classData, monthKey)) throw new Error('This class has already received its Teacher Boon for this month.');

        const awardedBy = { uid: state.get('currentUserId'), name: state.get('currentTeacherName') };
        const teacherBoon = {
            studentId,
            stars: numericStars,
            presetKey: storedPresetKey,
            presetLabel: storedPresetLabel,
            reasonText,
            awardedAt: serverTimestamp(),
            awardedBy
        };

        transaction.update(classRef, {
            [`teacherBoons.${monthKey}`]: teacherBoon
        });

        const scoreData = scoreDoc.exists() ? scoreDoc.data() : null;
        const transactionResult = applyReasonAwardScoreTransaction(transaction, {
            scoreRef,
            studentId,
            studentData,
            scoreData,
            reason: 'teacher_boon',
            awardedStars: numericStars
        });
        levelUpInfo = transactionResult.levelUpInfo;
        appliedGuildStars = transactionResult.totalStarsDelta || numericStars;

        const logRef = doc(collection(db, `${publicDataPath}/award_log`));
        transaction.set(logRef, withSchoolYear({
            studentId,
            classId,
            teacherId: state.get('currentUserId'),
            stars: numericStars,
            appliedStarCredit: transactionResult.totalStarsDelta,
            reason: 'teacher_boon',
            note: reasonText,
            date: today,
            createdAt: serverTimestamp(),
            createdBy: awardedBy,
            teacherBoon: {
                monthKey,
                presetKey: storedPresetKey,
                presetLabel: storedPresetLabel,
                reasonText
            }
        }, state.getActiveSchoolYearKey()));
    });

    if (levelUpInfo) {
        showHeroLevelUpCelebration(levelUpInfo);
    }

    checkBountyProgress(classId, numericStars);
    updateGuildScores(studentId, appliedGuildStars, 'teacher_boon');
    reconcileFamiliarLifecycle(studentId, { announce: true, source: 'teacher-boon' }).catch((error) => {
        console.warn('Teacher boon familiar reconciliation failed:', error);
    });
    await checkAndRecordQuestCompletion(classId);

    playSound('star3');
    showPraiseToast(`Teacher Boon bestowed! ${numericStars} star${numericStars === 1 ? '' : 's'} added.`, '✨');

    return {
        monthKey,
        studentId,
        stars: numericStars,
        presetKey: storedPresetKey,
        presetLabel: storedPresetLabel,
        reasonText,
        awardedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    };
}
