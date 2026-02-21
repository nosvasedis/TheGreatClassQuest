
export function openEditStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('edit-student-id-input-full').value = studentId;
    document.getElementById('edit-student-name-input-full').value = student.name;
    
    // NEW: Use helper to populate dropdowns
    populateDateDropdowns('edit-student-birthday-month', 'edit-student-birthday-day', student.birthday);
    populateDateDropdowns('edit-student-nameday-month', 'edit-student-nameday-day', student.nameday);
    // Load Hero Class into dropdown
   // Load Hero Class and check if locked
    const classDropdown = document.getElementById('edit-student-hero-class');
    classDropdown.value = student.heroClass || "";
    
    if (student.isHeroClassLocked) {
        classDropdown.disabled = true;
        classDropdown.title = "This student has already used their one-time class change.";
    } else {
        classDropdown.disabled = false;
        classDropdown.title = "";
    }
    showAnimatedModal('edit-student-modal');
}

export async function openQuestAssignmentModal() {
    const classId = document.getElementById('adventure-log-class-select').value;
    if (!classId) return;

    const modal = document.getElementById('quest-assignment-modal');
    modal.dataset.editingId = '';
    document.getElementById('quest-assignment-confirm-btn').innerText = 'Save Assignment';

    document.getElementById('quest-assignment-class-id').value = classId;
    const previousAssignmentTextEl = document.getElementById('previous-assignment-text');
    const currentAssignmentTextarea = document.getElementById('quest-assignment-textarea');

    previousAssignmentTextEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    currentAssignmentTextarea.value = '';

    showAnimatedModal('quest-assignment-modal');

    try {
        const q = query(
            collection(db, `artifacts/great-class-quest/public/data/quest_assignments`),
            where("classId", "==", classId),
            where("createdBy.uid", "==", state.get('currentUserId')),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastAssignmentDoc = snapshot.docs[0];
            const lastAssignment = lastAssignmentDoc.data();

            // --- NEW: Test Badge Logic ---
            let testBadgeHtml = '';
            if (lastAssignment.testData) {
                const tDate = utils.parseFlexibleDate(lastAssignment.testData.date);
                const dateDisplay = tDate ? tDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date TBD';
                
                testBadgeHtml = `
                    <div class="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <div class="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-exclamation"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-red-800 text-sm uppercase tracking-wide">Test Scheduled</h4>
                            <p class="font-bold text-gray-800 text-lg leading-tight">${lastAssignment.testData.title}</p>
                            <p class="text-red-600 text-sm mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dateDisplay}</p>
                            ${lastAssignment.testData.curriculum ? `<p class="text-gray-500 text-xs mt-1">Topic: ${lastAssignment.testData.curriculum}</p>` : ''}
                        </div>
                    </div>`;
            }
            
            // --- SMART FORMATTER START ---
            const formatAssignmentText = (text) => {
                const lines = text.split('\n');
                let html = '';
                
                // Check if any line starts with a number pattern to decide if we use List Mode
                const hasList = lines.some(l => l.trim().match(/^(\d+)[\.\)]\s+/));
                
                if (!hasList) {
                    // Standard Text Mode (preserve line breaks)
                    return `<p class="text-gray-800 italic whitespace-pre-wrap">${text}</p>`;
                }

                // List Mode
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    // Match "1. " or "1) "
                    const match = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
                    
                    if (match) {
                        const [_, num, content] = match;
                        // Styled Card for List Item
                        html += `
                            <div class="flex items-start gap-3 mb-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-transform hover:translate-x-1">
                                <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full mt-0.5 shadow-sm">${num}</span>
                                <span class="text-gray-800 text-sm leading-relaxed">${content}</span>
                            </div>`;
                    } else {
                        // Regular text (headers, notes)
                        html += `<p class="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2 mt-3 ml-1">${trimmed}</p>`;
                    }
                });
                return `<div class="space-y-1 mt-2">${html}</div>`;
            };
            
            const formattedContent = formatAssignmentText(lastAssignment.text);

           previousAssignmentTextEl.innerHTML = `
            <div class="w-full">
                ${testBadgeHtml} 
                ${formattedContent}
                </div>
                <div class="mt-3 flex justify-end">
                    <button id="edit-last-assignment-btn" class="text-xs text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full transition-colors border border-blue-100">
                        <i class="fas fa-pencil-alt mr-1"></i>Edit
                    </button>
                </div>
            `;
            // --- SMART FORMATTER END ---

            document.getElementById('edit-last-assignment-btn').onclick = () => {
                currentAssignmentTextarea.value = lastAssignment.text;
                modal.dataset.editingId = lastAssignmentDoc.id;
                document.getElementById('quest-assignment-confirm-btn').innerText = 'Update Assignment';
                currentAssignmentTextarea.focus();
            };
        } else {
            previousAssignmentTextEl.textContent = "No previous assignment was set for this class.";
        }

    } catch (error) {
        console.error("Error loading previous assignment:", error);
        previousAssignmentTextEl.textContent = "Could not load the previous assignment.";
    }
}

export function openMoveStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const currentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!currentClass) return;

    const modal = document.getElementById('move-student-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('move-student-name').innerText = student.name;
    document.getElementById('move-student-current-class').innerText = `${currentClass.logo} ${currentClass.name}`;

    const targetClassSelect = document.getElementById('move-student-target-class');
    const possibleClasses = state.get('allSchoolClasses').filter(c => c.questLevel === currentClass.questLevel && c.id !== currentClass.id);

    if (possibleClasses.length === 0) {
        targetClassSelect.innerHTML = `<option value="">No other classes in this league.</option>`;
        document.getElementById('move-student-confirm-btn').disabled = true;
    } else {
        targetClassSelect.innerHTML = possibleClasses.map(c => `<option value="${c.id}">${c.logo} ${c.name} (by ${c.createdBy.name})</option>`).join('');
        document.getElementById('move-student-confirm-btn').disabled = false;
    }
    
    showAnimatedModal('move-student-modal');

}

// --- SINGLE STARFALL (Used for individual entry edit or correction) ---
export function showStarfallModal(studentId, studentName, bonusAmount, trialType) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.remove('hidden');
    document.getElementById('starfall-batch-view').classList.add('hidden');

    document.getElementById('starfall-student-name').innerText = studentName;
    const confirmBtn = document.getElementById('starfall-confirm-btn');
    confirmBtn.innerText = `Yes, Bestow ${bonusAmount} Star! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleAwardBonusStar(studentId, bonusAmount, trialType); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}

// --- BATCH STARFALL (New Function) ---
export function showBatchStarfallModal(eligibleStudents) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.add('hidden');
    document.getElementById('starfall-batch-view').classList.remove('hidden');

    const listEl = document.getElementById('starfall-batch-list');
    listEl.innerHTML = eligibleStudents.map(s => `
        <div class="flex justify-between items-center p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">${s.name}</span>
            <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+${s.bonusAmount} ⭐</span>
        </div>
    `).join('');

    const confirmBtn = document.getElementById('starfall-confirm-btn');
    const totalStars = eligibleStudents.reduce((sum, s) => sum + s.bonusAmount, 0);
    confirmBtn.innerText = `Yes, Bestow Bonus Stars! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleBatchAwardBonus(eligibleStudents); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}
