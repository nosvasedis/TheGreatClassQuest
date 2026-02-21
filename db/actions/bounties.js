    }
}

// --- QUEST BOUNTIES ---

export async function handleCreateBounty() {
    const classId = document.getElementById('bounty-class-id').value;
    const title = document.getElementById('bounty-title').value;
    const type = document.getElementById('bounty-type').value; // 'standard' or 'timer'

    let target = 0;
    let reward = "";
    let deadline = null;

    if (type === 'standard') {
        target = parseInt(document.getElementById('bounty-target').value);
        reward = document.getElementById('bounty-reward').value;
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

    const btn = document.getElementById('bounty-submit-btn');
    btn.disabled = true; btn.innerHTML = 'Starting...';

    try {
        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_bounties"), {
            classId,
            title,
            target: type === 'standard' ? target : 0,
            reward,
            type, 
            currentProgress: 0,
            deadline: deadline.toISOString(),
            status: 'active',
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        
        showToast(type === 'timer' ? 'Timer Started!' : 'Bounty Posted!', 'success');
        import('../ui/modals.js').then(m => m.hideModal('create-bounty-modal'));
    } catch (e) {
        console.error(e);
        showToast('Error starting quest', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = type === 'timer' ? 'Start Timer' : 'Start Quest';
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
    playHeroFanfare(); 
    
    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/quest_bounties", bountyId), {
            status: 'completed',
            claimedAt: serverTimestamp() // <--- This adds the "Time of Victory"
        });
    } catch(e) { console.error(e); }

    import('../ui/effects.js').then(m => m.showPraiseToast(`BOUNTY CLAIMED: ${rewardText}`, '🎁'));
}

// Helper to update progress when stars are awarded
// We need to hook this into `setStudentStarsForToday`
export async function checkBountyProgress(classId, starsAdded) {
    const bounties = state.get('allQuestBounties').filter(b => b.classId === classId && b.status === 'active');
    
    // Check local expiry
    const now = new Date();
    
    bounties.forEach(async (b) => {
        if (new Date(b.deadline) < now) return; // Expired

        const newProgress = (b.currentProgress || 0) + starsAdded;
        
        // Update DB
        const bountyRef = doc(db, "artifacts/great-class-quest/public/data/quest_bounties", b.id);
        
        if (newProgress >= b.target) {
            await updateDoc(bountyRef, { currentProgress: newProgress });
            
            // TASK 3 FIX: Only show toast for Standard bounties, not Timers
            if (b.type !== 'timer') {
                showToast(`Bounty "${b.title}" goal reached! Ready to claim!`, 'success');
                playSound('magic_chime');
            }
        } else {
            await updateDoc(bountyRef, { currentProgress: newProgress });
        }
    });
}
