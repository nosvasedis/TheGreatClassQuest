// /features/boons.js
import { db, doc, runTransaction, increment, serverTimestamp, collection, deleteField } from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';
import { reconcileFamiliarLifecycle } from './familiars.js';
import { applyReasonAwardScoreTransaction, checkAndRecordQuestCompletion, showHeroLevelUpCelebration } from '../db/actions/stars.js';
import { checkBountyProgress } from '../db/actions/bounties.js';
import { updateGuildScores } from './guildScoring.js';

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

    try {
        await runTransaction(db, async (transaction) => {
            const senderScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", senderId);
            const receiverScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", receiverId);

            const senderDoc = await transaction.get(senderScoreRef);
            const senderData = senderDoc.data() || {};
            const currentGold = (senderData.gold !== undefined) ? senderData.gold : (senderData.totalStars || 0);
            const freeBoonUses = Number(senderData.peerBoonFreeUses) || 0;
            const monthKey = utils.getLocalMonthKey();
            const isMonthFree = senderData.peerBoonFreeMonthKey === monthKey;

            if (!isMonthFree && freeBoonUses > 0) {
                if (freeBoonUses <= 1) {
                    transaction.update(senderScoreRef, { peerBoonFreeUses: deleteField() });
                } else {
                    transaction.update(senderScoreRef, { peerBoonFreeUses: freeBoonUses - 1 });
                }
            } else if (!isMonthFree) {
                if (currentGold < 15) throw "Not enough Gold!";
                transaction.update(senderScoreRef, { gold: increment(-15) });
            }
            transaction.update(receiverScoreRef, {
                totalStars: increment(0.5),
                monthlyStars: increment(0.5)
            });

            const logRef = doc(collection(db, "artifacts/great-class-quest/public/data/award_log"));
            transaction.set(logRef, {
                studentId: receiverId,
                classId: receiver.classId,
                teacherId: state.get('currentUserId'),
                stars: 0.5,
                reason: "peer_boon",
                note: `Hero's Boon from ${sender.name}!`,
                date: utils.getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });
        });

        reconcileFamiliarLifecycle(receiverId, { announce: true, source: 'peer-boon' }).catch((e) => console.warn('Peer boon familiar reconciliation failed:', e));
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
    if (!utils.isTeacherBoonWindow()) throw new Error('Teacher Boon is only available during the last 3 days of the month.');

    const preset = getTeacherBoonPreset(presetKey);
    if (!preset && !trimmedCustomReason) throw new Error('Choose a reason for the Teacher Boon.');

    const reasonText = trimmedCustomReason || preset.label;
    const storedPresetKey = preset?.key || 'custom';
    const storedPresetLabel = preset?.label || 'Custom Reason';
    const today = utils.getTodayDateString();
    const monthKey = utils.getLocalMonthKey();
    const publicDataPath = 'artifacts/great-class-quest/public/data';
    let levelUpInfo = null;

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

        const logRef = doc(collection(db, `${publicDataPath}/award_log`));
        transaction.set(logRef, {
            studentId,
            classId,
            teacherId: state.get('currentUserId'),
            stars: numericStars,
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
        });
    });

    if (levelUpInfo) {
        showHeroLevelUpCelebration(levelUpInfo);
    }

    checkBountyProgress(classId, numericStars);
    updateGuildScores(studentId, numericStars);
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
