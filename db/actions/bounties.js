// /db/actions/bounties.js — quest bounties
import { db, doc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp, increment } from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { playSound, playHeroFanfare } from '../../audio.js';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { normalizeAudience, bountyStarsFromAward } from '../../features/bountyAudience.mjs';

function readPosterAudience() {
    try {
        return normalizeAudience(JSON.parse(document.getElementById('bounty-audience')?.value || 'null'));
    } catch {
        return normalizeAudience(null);
    }
}

// --- QUEST BOUNTIES ---

export async function handleCreateBounty() {
    const classId = document.getElementById('bounty-class-id').value;
    const title = document.getElementById('bounty-title').value.trim();
    const type = document.getElementById('bounty-type').value; // 'standard' or 'timer'

    let target = 0;
    let reward = "";
    let deadline = null;

    if (type === 'standard') {
        target = parseInt(document.getElementById('bounty-target').value);
        reward = document.getElementById('bounty-reward').value.trim();
        if (!target || !reward) { showToast('Please set stars and reward.', 'error'); return; }
        // Default expiry for star bounty (2 hours) just to keep DB clean
        deadline = new Date();
        deadline.setHours(deadline.getHours() + 2);
    } else {
        // TIMER MODE
        const durationInput = document.getElementById('bounty-timer-minutes').value;
        const endTimeInput = document.getElementById('bounty-timer-end').value;
        
        if (endTimeInput) {
            const [h, m] = endTimeInput.split(':').map(Number);
            deadline = new Date();
            deadline.setHours(h, m, 0, 0);
            if (deadline < new Date()) deadline.setDate(deadline.getDate() + 1); // Next day if time passed
        } else if (durationInput) {
            deadline = new Date();
            deadline.setMinutes(deadline.getMinutes() + parseInt(durationInput));
        } else {
            showToast('Please set a duration or end time.', 'error');
            return;
        }
        reward = "Timer Complete"; // Placeholder, not used visually for timers
    }

    if (!title) { showToast('Please enter a title.', 'error'); return; }
    const audience = readPosterAudience();

    const btn = document.getElementById('bounty-submit-btn');
    const idleLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="bp-submit__seal" aria-hidden="true"><i class="fas fa-circle-notch fa-spin"></i></span><span class="bp-submit__label">${type === 'timer' ? 'Turning the hourglass…' : 'Pinning…'}</span>`;

    try {
        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_bounties"), withSchoolYear({
            classId,
            title,
            target: type === 'standard' ? target : 0,
            reward,
            type,
            audience,
            currentProgress: 0,
            deadline: deadline.toISOString(),
            status: 'active',
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        }, state.getActiveSchoolYearKey()));
        
        showToast(type === 'timer' ? 'Timer Started!' : 'Bounty Posted!', 'success');
        import('../../ui/modals.js').then(m => m.hideModal('create-bounty-modal'));
    } catch (e) {
        console.error(e);
        showToast('Error starting quest', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = idleLabel;
    }
}

export async function handleDeleteBounty(bountyId) {
    try {
        await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/quest_bounties", bountyId));
        showToast('Bounty removed.', 'info');
    } catch (e) {
        showToast('Error deleting bounty', 'error');
    }
}

export async function handleClaimBounty(bountyId, classId, rewardText) {
    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/quest_bounties", bountyId), {
            status: 'completed',
            claimedAt: serverTimestamp() // <--- This adds the "Time of Victory"
        });
    } catch (e) {
        console.error(e);
        showToast('Could not claim this bounty. Please try again.', 'error');
        return false;
    }

    playHeroFanfare();
    import('../../ui/effects.js').then(m => m.showPraiseToast(`BOUNTY CLAIMED: ${rewardText}`, '🎁'));
    return true;
}

// Progress when stars are awarded. `studentIds` are the heroes who earned the stars
// (shared equally); group bounties (one guild, chosen heroes) only count their own members.
export async function checkBountyProgress(classId, starsAdded, studentIds = null) {
    const total = Number(starsAdded) || 0;
    if (!total) return;
    const bounties = (state.get('allQuestBounties') || []).filter(b => b.classId === classId && b.status === 'active');
    if (!bounties.length) return;
    const ids = (Array.isArray(studentIds) ? studentIds : studentIds ? [studentIds] : []).map(String);
    const studentsById = new Map((state.get('allStudents') || []).filter(s => ids.includes(String(s.id))).map(s => [String(s.id), s]));

    // Check local expiry
    const now = new Date();

    await Promise.all(bounties.map(async (b) => {
        if (new Date(b.deadline) < now) return; // Expired
        const added = bountyStarsFromAward(b, total, ids, studentsById);
        if (!added) return;

        const previousProgress = Number(b.currentProgress) || 0;
        const newProgress = previousProgress + added;
        const bountyRef = doc(db, "artifacts/great-class-quest/public/data/quest_bounties", b.id);

        try {
            // increment() keeps concurrent awards from overwriting each other's
            // progress (the cached value may be stale).
            await updateDoc(bountyRef, { currentProgress: increment(added) });
        } catch (error) {
            console.warn(`Bounty progress update failed for ${b.id}:`, error);
            return;
        }

        // TASK 3 FIX: Only show toast for Standard bounties, not Timers
        if (b.type !== 'timer' && previousProgress < b.target && newProgress >= b.target) {
            showToast(`Bounty "${b.title}" goal reached! Ready to claim!`, 'success');
            playSound('magic_chime');
        }
    }));
}
