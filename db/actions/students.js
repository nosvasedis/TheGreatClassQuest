// /db/actions/students.js — student CRUD, move, teacher name, nameday
import {
    db,
    doc,
    collection,
    runTransaction,
    serverTimestamp,
    getDocs,
    query,
    where,
    updateDoc,
    getDoc,
    setDoc
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { getStartOfMonthString } from '../../utils.js';

// --- STUDENT & USER ACTIONS ---

export async function handleAddStudent() {
    const input = document.getElementById('student-name');
    const name = input.value.trim();
    const classId = document.getElementById('manage-class-id').value;
    if (!name || !classId) {
        showToast('Please enter a student name.', 'error');
        return;
    }
    const btn = document.querySelector('#add-student-form button[type="submit"]');
    try {
        input.disabled = true;
        btn.disabled = true;
        btn.innerHTML = 'Adding...';
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const newStudentRef = doc(collection(db, `${publicDataPath}/students`));
            const studentData = { name, classId, createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, createdAt: serverTimestamp() };
            transaction.set(newStudentRef, studentData);
            const newScoreRef = doc(db, `${publicDataPath}/student_scores`, newStudentRef.id);
            transaction.set(newScoreRef, {
                totalStars: 0,
                monthlyStars: 0,
                gold: 0,
                inventory: [],
                starsByReason: {},
                heroLevel: 0,
                heroSkills: [],
                pendingSkillChoice: false,
                lastMonthlyResetDate: getStartOfMonthString(),
                createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name }
            });
        });
        input.value = '';
    } catch (error) {
        console.error("Error adding student: ", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Student';
    }
}

export async function deleteStudent(studentId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    try {
        await runTransaction(db, async (transaction) => {
            transaction.delete(doc(db, `${publicDataPath}/students`, studentId));
            transaction.delete(doc(db, `${publicDataPath}/student_scores`, studentId));
            if (state.get('todaysStars')[studentId]) {
                transaction.delete(doc(db, `${publicDataPath}/today_stars`, state.get('todaysStars')[studentId].docId));
            }
        });
    } catch (error) {
        console.error("Error deleting student: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

export async function handleSaveStudentDetails() {
    const studentId = document.getElementById('edit-student-id-input-full').value;
    const newName = document.getElementById('edit-student-name-input-full').value.trim();
    const newHeroClass = document.getElementById('edit-student-hero-class').value;
    const student = state.get('allStudents').find(s => s.id === studentId);

    // Check if the class change is allowed
    if (!canChangeHeroClass(student, newHeroClass)) {
        showToast('This student has already changed their class once and is now locked!', 'error');
        return;
    }
    
    // NEW: Read from dropdowns and format
    const bMonth = document.getElementById('edit-student-birthday-month').value;
    const bDay = document.getElementById('edit-student-birthday-day').value;
    const birthday = (bMonth && bDay) ? `0000-${String(bMonth).padStart(2, '0')}-${String(bDay).padStart(2, '0')}` : null;

    const nMonth = document.getElementById('edit-student-nameday-month').value;
    const nDay = document.getElementById('edit-student-nameday-day').value;
    const nameday = (nMonth && nDay) ? `0000-${String(nMonth).padStart(2, '0')}-${String(nDay).padStart(2, '0')}` : null;

    if (!newName) {
        showToast('Name cannot be empty.', 'error');
        return;
    }

    const btn = document.getElementById('edit-student-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

    try {
        const studentRef = doc(db, "artifacts/great-class-quest/public/data/students", studentId);
        // Determine if we should lock the class now
        // Lock it if they already had a class and are now changing it to something else
        const isNowLocked = (student.heroClass && newHeroClass !== "" && student.heroClass !== newHeroClass) || student.isHeroClassLocked;

        await updateDoc(studentRef, {
            name: newName,
            birthday: birthday,
            nameday: nameday,
            heroClass: newHeroClass,
            isHeroClassLocked: isNowLocked || false
        });
        showToast('Student details updated!', 'success');
        modals.hideModal('edit-student-modal');
    } catch (error) {
        console.error("Error updating student details: ", error);
        showToast(`Failed to update: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save';
    }
}

export async function handleLookupNameday() {
    const studentName = document.getElementById('edit-student-name-input-full').value.trim();
    if (!studentName) {
        showToast('Please enter a name first.', 'info');
        return;
    }

    const btn = document.getElementById('lookup-nameday-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const systemPrompt = "You are an expert on Greek Orthodox namedays (Εορτολόγιο). You will be given a Greek name. Your task is to find the corresponding nameday. If there are multiple dates, provide the most common one. Your response MUST be ONLY the date in YYYY-MM-DD format. Do not include the current year, just use a placeholder year like 2024. For example, for 'Giorgos', you should return '2024-04-23'. For 'Maria' on August 15th, return '2024-08-15'. If the name is not in the Greek Orthodox calendar, return 'Not found'.";
    const userPrompt = `What is the nameday for the name: "${studentName}"?`;

    try {
        const result = await callGeminiApi(systemPrompt, userPrompt);
        if (result && result.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [_year, month, day] = result.split('-').map(Number);
            document.getElementById('edit-student-nameday-month').value = month;
            document.getElementById('edit-student-nameday-day').value = day;
            showToast(`Suggested nameday for ${studentName} found!`, 'success');
        } else {
            showToast(`Could not automatically find a nameday for "${studentName}".`, 'info');
        }
    } catch (error) {
        console.error("Nameday lookup failed:", error);
        showToast("AI lookup failed. Please enter the date manually.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i>';
    }
}

export async function handleMoveStudent() {
    const studentId = document.getElementById('move-student-modal').dataset.studentId;
    const newClassId = document.getElementById('move-student-target-class').value;
    if (!studentId || !newClassId) {
        showToast("Please select a target class.", "error");
        return;
    }
    const newClassData = state.get('allSchoolClasses').find(c => c.id === newClassId);
    if (!newClassData) {
        showToast("Target class data not found.", "error");
        return;
    }
    
    const btn = document.getElementById('move-student-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Moving...`;

    try {
        const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
        await updateDoc(studentRef, { 
            classId: newClassId,
            createdBy: {
                uid: newClassData.createdBy.uid,
                name: newClassData.createdBy.name
            }
        });
        showToast("Student moved and ownership transferred successfully!", "success");
        document.getElementById('move-student-modal').classList.add('hidden');
    } catch (error) {
        console.error("Error moving student:", error);
        showToast("Failed to move student. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Confirm Move`;
    }
}

export async function handleSaveTeacherName() {
    const input = document.getElementById('teacher-name-input');
    const newName = input.value.trim();
    if (!newName) { showToast('Name cannot be empty.', 'error'); return; }
    if (newName === state.get('currentTeacherName')) { showToast('Name is already set to this!', 'info'); return; }
    
    const btn = document.getElementById('save-teacher-name-btn');
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    
    try {
        await updateProfile(auth.currentUser, { displayName: newName });
        await updateTeacherNameInClasses(newName);
        await updateTeacherNameInStudents(newName);
        state.set('currentTeacherName', newName);
        showToast('Name updated successfully!', 'success');
    } catch (error) { 
        console.error("Error updating name: ", error); 
        showToast(`Error: ${error.message}`, 'error'); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Name'; 
    }
}

async function updateTeacherNameInClasses(newName) {
    const q = query(collection(db, `artifacts/great-class-quest/public/data/classes`), where("createdBy.uid", "==", state.get('currentUserId')));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.update(doc.ref, { "createdBy.name": newName }));
    await batch.commit();
}

async function updateTeacherNameInStudents(newName) {
    const q = query(collection(db, `artifacts/great-class-quest/public/data/students`), where("createdBy.uid", "==", state.get('currentUserId')));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.update(doc.ref, { "createdBy.name": newName }));
    await batch.commit();
}
