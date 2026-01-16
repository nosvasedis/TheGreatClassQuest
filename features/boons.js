// /features/boons.js
import { db, doc, runTransaction, increment, serverTimestamp, collection } from '../firebase.js';
import * as state from '../state.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as utils from '../utils.js';

export async function handleBestowBoon(senderId, receiverId) {
    if (senderId === receiverId) {
        showToast("An adventurer cannot bestow a boon on themselves!", "error");
        return;
    }

    const sender = state.get('allStudents').find(s => s.id === senderId);
    const receiver = state.get('allStudents').find(s => s.id === receiverId);
    
    const confirmMsg = `Spend 15 Gold from ${sender.name} to bestow a Hero's Boon on ${receiver.name}? (+0.5 Stars)`;
    if (!confirm(confirmMsg)) return;

    try {
        await runTransaction(db, async (transaction) => {
            const senderScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", senderId);
            const receiverScoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", receiverId);

            const senderDoc = await transaction.get(senderScoreRef);
            const currentGold = (senderDoc.data()?.gold !== undefined) ? senderDoc.data().gold : (senderDoc.data()?.totalStars || 0);

            if (currentGold < 15) throw "Not enough Gold!";

            transaction.update(senderScoreRef, { gold: increment(-15) });
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

        playSound('magic_chime');
        showToast(`${receiver.name} received a Hero's Boon!`, 'success');
    } catch (error) {
        showToast(typeof error === 'string' ? error : "The magic failed!", "error");
    }
}
