// /db/actions.js
import { 
    db, 
    auth,
    updateProfile,
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    writeBatch, 
    serverTimestamp, 
    increment,
    getDoc,
    setDoc,
    orderBy
} from '../firebase.js';

import * as state from '../state.js';
import { getStartOfMonthString, getTodayDateString, parseDDMMYYYY, simpleHashCode, getAgeGroupForLeague, getLastLessonDate, compressImageBase64, getDDMMYYYY, debounce } from '../utils.js'; // Added debounce
import { showToast, showPraiseToast } from '../ui/effects.js';
import { showStarfallModal, showModal, hideModal } from '../ui/modals.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { classColorPalettes } from '../constants.js';
import { handleStoryWeaversClassSelect } from '../features/storyWeaver.js';

// --- DEBOUNCED QUEST COMPLETION CHECK ---
const debouncedCheckAndRecordQuestCompletion = debounce(checkAndRecordQuestCompletion, 4000);

// --- CLASS ACTIONS ---

export async function handleAddClass() {
    const form = document.getElementById('add-class-form');
    const name = document.getElementById('class-name').value;
    const level = document.getElementById('class-level').value;
    if (!name || !level) {
        showToast('Please fill in both Class Name and Quest Level.', 'error');
        return;
    }
    const logo = document.getElementById('class-logo').value;
    const timeStart = document.getElementById('class-time-start').value;
    const timeEnd = document.getElementById('class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="schedule-day"]:checked')).map(cb => cb.value);
    const randomColor = classColorPalettes[simpleHashCode(name) % classColorPalettes.length];
    
    try {
        await addDoc(collection(db, "artifacts/great-class-quest/public/data/classes"), {
            name,
            questLevel: level,
            logo,
            scheduleDays,
            timeStart,
            timeEnd,
            color: randomColor,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        showToast('Class created successfully!', 'success');
        form.reset();
        document.getElementById('logo-picker-btn').innerText = '📚';
        document.getElementById('class-logo').value = '📚';
        document.getElementById('class-name-suggestions').innerHTML = '';
    } catch (error) {
        console.error("Error adding class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

export async function deleteClass(classId) {
    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        const studentsQuery = query(collection(db, `${publicDataPath}/students`), where("classId", "==", classId));
        const studentSnapshot = await getDocs(studentsQuery);
        const studentIdsInClass = studentSnapshot.docs.map(d => d.id);
        const batch = writeBatch(db);
        
        studentSnapshot.forEach(doc => batch.delete(doc.ref));
        studentIdsInClass.forEach(studentId => batch.delete(doc(db, `${publicDataPath}/student_scores`, studentId)));
        
        if (studentIdsInClass.length > 0) {
            const todayStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "in", studentIdsInClass));
            const todayStarsSnapshot = await getDocs(todayStarsQuery);
            todayStarsSnapshot.forEach(doc => batch.delete(doc.ref));
            
            const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`), where("studentId", "in", studentIdsInClass));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
        }
        
        batch.delete(doc(db, `${publicDataPath}/classes`, classId));
        batch.delete(doc(db, `${publicDataPath}/story_data`, classId));
        
        const historySnapshot = await getDocs(collection(db, `${publicDataPath}/story_data/${classId}/story_history`));
        historySnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        showToast('Class and all associated data deleted.', 'success');
    } catch (error) {
        console.error("Error deleting class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

export async function handleEditClass() {
    const classId = document.getElementById('edit-class-id').value;
    const name = document.getElementById('edit-class-name').value;
    const level = document.getElementById('edit-class-level').value;
    if (!name || !level) {
        showToast('Please fill in all fields.', 'error');
        return;
    }
    const logo = document.getElementById('edit-class-logo').value;
    const timeStart = document.getElementById('edit-class-time-start').value;
    const timeEnd = document.getElementById('edit-class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="edit-schedule-day"]:checked')).map(cb => cb.value);
    
    try {
        const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
        await updateDoc(classRef, { name, questLevel: level, logo, timeStart, timeEnd, scheduleDays });
        showToast('Class updated successfully!', 'success');
        document.getElementById('edit-class-modal').classList.add('hidden'); // Simplified hideModal
    } catch (error) {
        console.error("Error updating class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

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
            transaction.set(newScoreRef, { totalStars: 0, monthlyStars: 0, lastMonthlyResetDate: getStartOfMonthString(), createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name } });
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

export async function handleEditStudentName() {
    const studentId = document.getElementById('edit-student-id-input').value;
    const newName = document.getElementById('edit-student-name-input').value.trim();
    
    if (!newName) {
        showToast('Name cannot be empty.', 'error');
        return;
    }
    
    try {
        const studentRef = doc(db, "artifacts/great-class-quest/public/data/students", studentId);
        await updateDoc(studentRef, { name: newName });
        showToast('Student name updated successfully!', 'success');
    } catch (error) {
        console.error("Error updating student name: ", error);
        showToast(`Failed to update name: ${error.message}`, 'error');
    } finally {
        document.getElementById('edit-student-name-modal').classList.add('hidden');
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
        document.getElementById('teacher-greeting').innerText = `Welcome, ${newName}!`;
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

// --- SCORE, STAR, & LOG ACTIONS ---

export async function setStudentStarsForToday(studentId, starValue, reason = null) {
    const today = getTodayDateString();
    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    let finalStarValue = starValue;
    const activeEvent = state.get('allQuestEvents').find(e => e.date === today);
    if (activeEvent) {
        if (activeEvent.type === '2x Star Day') {
            finalStarValue *= 2;
        } else if (activeEvent.type === 'Reason Bonus Day' && activeEvent.details?.reason === reason) {
            finalStarValue += 1;
        }
    }

    if (starValue > 0 && reason !== 'welcome_back' && reason !== 'story_weaver' && reason !== 'scholar_s_bonus') {
         if (starValue === 1) playSound('star1');
         else if (starValue === 2) playSound('star2');
         else playSound('star3');
    }
    
    let studentClassId = null;
    let difference = 0;

    try {
        await runTransaction(db, async (transaction) => {
            const studentRef = doc(db, `${publicDataPath}/students`, studentId);
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

            const todayStarsQuery = query(
                collection(db, `${publicDataPath}/today_stars`),
                where("studentId", "==", studentId),
                where("teacherId", "==", state.get('currentUserId')),
                where("date", "==", today)
            );
            const todayStarsSnapshot = await getDocs(todayStarsQuery);
            
            let todayDocRef = null;
            let oldStars = 0;
            if (!todayStarsSnapshot.empty) {
                const todayDoc = todayStarsSnapshot.docs[0];
                todayDocRef = todayDoc.ref;
                oldStars = todayDoc.data().stars || 0;
            }
            
            difference = finalStarValue - oldStars;
            if (difference === 0 && finalStarValue > 0) {
                const logId = state.get('todaysAwardLogs')[studentId];
                if (logId) {
                    const logRef = doc(db, `${publicDataPath}/award_log`, logId);
                    transaction.update(logRef, { reason });
                }
                return;
            }
            
            if (difference === 0) return;

            const studentDoc = await transaction.get(studentRef);
            if (!studentDoc.exists()) throw new Error("Student not found!");
            const studentData = studentDoc.data();
            studentClassId = studentData.classId;

            const scoreDoc = await transaction.get(scoreRef);
            
            if (!scoreDoc.exists()) {
                transaction.set(scoreRef, {
                    totalStars: difference > 0 ? difference : 0,
                    monthlyStars: difference > 0 ? difference : 0,
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name }
                });
            } else {
                transaction.update(scoreRef, {
                    totalStars: increment(difference),
                    monthlyStars: increment(difference)
                });
            }

            if (todayDocRef) {
                if (finalStarValue === 0) {
                    transaction.delete(todayDocRef);
                } else {
                    transaction.update(todayDocRef, { stars: finalStarValue, reason: reason });
                }
            } else if (finalStarValue > 0) {
                const newTodayDocRef = doc(collection(db, `${publicDataPath}/today_stars`));
                transaction.set(newTodayDocRef, {
                    studentId, stars: finalStarValue, date: today, reason: reason,
                    teacherId: state.get('currentUserId'), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                });
            }

            const logId = state.get('todaysAwardLogs')[studentId];
            if (finalStarValue === 0) {
                if (logId) transaction.delete(doc(db, `${publicDataPath}/award_log`, logId));
            } else if (finalStarValue > 0) {
                const logData = {
                    studentId, classId: studentData.classId, teacherId: state.get('currentUserId'),
                    stars: finalStarValue, reason, date: today, createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                };
                if (logId) {
                     transaction.update(doc(db, `${publicDataPath}/award_log`, logId), { stars: finalStarValue, reason });
                } else {
                     transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);
                }
            }
        });

        if (studentClassId && difference > 0) {
            debouncedCheckAndRecordQuestCompletion(studentClassId);
        }

    } catch (error) {
        console.error('Star update transaction failed:', error);
        showToast('Error saving stars! Please try again.', 'error');
    }
}

export async function checkAndRecordQuestCompletion(classId) {
    const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
    const classDoc = await getDoc(classRef); // Use getDoc for a single document
    if (!classDoc.exists() || classDoc.data().questCompletedAt) {
        return;
    }

    const GOAL_PER_STUDENT = { DIAMOND: 18 };
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    if (studentCount === 0) return;

    const diamondGoal = Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND);
    
    const studentIds = studentsInClass.map(s => s.id);
    if (studentIds.length === 0) return; // No students, no scores
    
    // Querying scores for all students in the class
    let currentMonthlyStars = 0;
    const allScores = state.get('allStudentScores');
    for (const id of studentIds) {
        const scoreData = allScores.find(s => s.id === id);
        if (scoreData) {
            currentMonthlyStars += scoreData.monthlyStars || 0;
        }
    }

    if (currentMonthlyStars >= diamondGoal) {
        console.log(`Class ${classDoc.data().name} has completed the quest! Recording timestamp.`);
        await updateDoc(classRef, {
            questCompletedAt: serverTimestamp()
        });
    }
}


export async function checkAndResetMonthlyStars(studentId, currentMonthStart) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    try {
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) return;
            const scoreData = scoreDoc.data();
            
            if (scoreData.lastMonthlyResetDate !== currentMonthStart) {
                const lastMonthScore = scoreData.monthlyStars || 0;
                const lastMonthDateString = scoreData.lastMonthlyResetDate; 
                const yearMonthKey = lastMonthDateString.substring(0, 7); 
                const historyRef = doc(db, `${publicDataPath}/student_scores/${studentId}/monthly_history/${yearMonthKey}`);
                
                if (lastMonthScore > 0) {
                    transaction.set(historyRef, { stars: lastMonthScore, month: yearMonthKey });
                }
                
                transaction.update(scoreRef, { 
                    monthlyStars: 0, 
                    lastMonthlyResetDate: currentMonthStart 
                });
            }
        });
    } catch (error) { 
        console.error(`Failed monthly reset & archive for ${studentId}:`, error); 
    }
}

export async function handleDeleteAwardLog(logId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    try {
        await runTransaction(db, async (transaction) => {
            const logRef = doc(db, `${publicDataPath}/award_log`, logId);
            
            const logDoc = await transaction.get(logRef);
            if (!logDoc.exists()) {
                console.log("Log already deleted.");
                return; 
            }
            const logData = logDoc.data();
            const actualStars = logData.stars;
            const studentId = logData.studentId;

            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreDoc = await transaction.get(scoreRef);
            if (scoreDoc.exists()) {
                // Check if the log date is in the current month
                const logDate = parseDDMMYYYY(logData.date);
                const today = new Date();
                const isCurrentMonth = logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear();
                
                const updates = { totalStars: increment(-actualStars) };
                if (isCurrentMonth) {
                    updates.monthlyStars = increment(-actualStars);
                }
                transaction.update(scoreRef, updates);
            }

            transaction.delete(logRef);

            if (logData.date === getTodayDateString()) {
                const todayStarsQuery = query(
                    collection(db, `${publicDataPath}/today_stars`), 
                    where("studentId", "==", studentId), 
                    where("teacherId", "==", state.get('currentUserId'))
                );
                const todayStarsSnapshot = await getDocs(todayStarsQuery);
                todayStarsSnapshot.forEach(doc => transaction.delete(doc.ref));
            }
        });

        showToast('Log entry deleted successfully!', 'success');
        
        const logElement = document.getElementById(`log-entry-${logId}`);
        if (logElement) {
            logElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            logElement.style.opacity = '0';
            logElement.style.transform = 'scale(0.9)';
            setTimeout(() => {
                logElement.remove();
                const contentEl = document.getElementById('logbook-modal-content');
                if (contentEl && contentEl.querySelectorAll('[id^="log-entry-"]').length === 0) {
                     const container = contentEl.querySelector('.mb-4.bg-white'); // Check if parent container is empty
                     if(container && container.querySelectorAll('[id^="log-entry-"]').length === 0) {
                         container.remove(); // Remove the whole class box if empty
                     }
                     // Check if *all* class boxes are gone
                     if (contentEl.querySelectorAll('.mb-4.bg-white').length === 0) {
                         hideModal('logbook-modal');
                     }
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error deleting award log:', error);
        showToast(`Failed to delete log entry: ${error.message}`, 'error');
    }
}

export async function handleSaveAwardNote() {
    const logId = document.getElementById('award-note-log-id-input').value;
    const newNote = document.getElementById('award-note-textarea').value;
    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/award_log", logId), { note: newNote });
        showToast('Note saved!', 'success');
        document.getElementById('award-note-modal').classList.add('hidden');
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast('Failed to save note.', 'error');
    }
}

// --- ATTENDANCE ACTIONS ---

export async function handleMarkAbsent(studentId, classId, isAbsent) {
    const lastLessonDate = getLastLessonDate(classId, state.get('allSchoolClasses'));
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const attendanceCollectionRef = collection(db, `${publicDataPath}/attendance`);

    try {
        const q = query(
            attendanceCollectionRef,
            where("studentId", "==", studentId),
            where("date", "==", lastLessonDate)
        );
        const snapshot = await getDocs(q);

        if (isAbsent) {
            if (snapshot.empty) {
                await addDoc(attendanceCollectionRef, {
                    studentId,
                    classId,
                    date: lastLessonDate,
                    markedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
                    createdAt: serverTimestamp()
                });
            }
        } else {
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        
        const student = state.get('allStudents').find(s => s.id === studentId);
        showToast(`${student.name} marked as ${isAbsent ? 'absent' : 'present'}.`, 'success');

    } catch (error) {
        console.error("Error updating attendance:", error);
        showToast("Failed to update attendance record.", "error");
    }
}

// --- CALENDAR & EVENT ACTIONS ---

export async function handleAddQuestEvent() {
    const date = document.getElementById('quest-event-date').value;
    const type = document.getElementById('quest-event-type').value;
    if (!type) {
        showToast('Please select an event type.', 'error');
        return;
    }

    let details = {};
    const title = document.getElementById('quest-event-type').options[document.getElementById('quest-event-type').selectedIndex].text;
    details.title = title;

    try {
        switch(type) {
            case 'Vocabulary Vault':
            case 'Grammar Guardians':
                details.goalTarget = parseInt(document.getElementById('quest-goal-target').value);
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.goalTarget) || isNaN(details.completionBonus) || details.goalTarget <= 0 || details.completionBonus <= 0) {
                    throw new Error("Please enter valid numbers for the goal and bonus.");
                }
                break;
            case 'The Unbroken Chain':
            case 'The Scribe\'s Sketch':
            case 'Five-Sentence Saga':
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.completionBonus) || details.completionBonus <= 0) {
                    throw new Error("Please enter a valid bonus amount.");
                }
                break;
            case 'Reason Bonus Day':
                const reason = document.getElementById('quest-event-reason').value;
                details.reason = reason;
                details.title = `${reason.charAt(0).toUpperCase() + reason.slice(1)} Bonus Day`;
                break;
            case '2x Star Day':
                break;
            default:
                throw new Error("Invalid event type selected.");
        }

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_events"), {
            date, type, details,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        showToast('Quest Event added to calendar!', 'success');
        document.getElementById('day-planner-modal').classList.add('hidden');
    } catch (error) {
        console.error("Error adding quest event:", error);
        showToast(error.message || 'Failed to save event.', 'error');
    }
}

export async function handleDeleteQuestEvent(eventId) {
    try {
        await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/quest_events", eventId));
        showToast('Event deleted!', 'success');
    } catch (error) {
        console.error("Error deleting event:", error);
        showToast('Could not delete event.', 'error');
    }
}

export async function handleCancelLesson(dateString, classId) {
    const override = state.get('allScheduleOverrides').find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'one-time') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { 
                date: dateString, 
                classId, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }
        showToast("Lesson cancelled for this day.", "success");
    } catch (e) { showToast("Error updating schedule.", "error"); }
}

export async function handleAddOneTimeLesson(dateString) {
    const classId = document.getElementById('add-onetime-lesson-select').value;
    if (!classId) return;
    const override = state.get('allScheduleOverrides').find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'cancelled') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { 
                date: dateString, 
                classId, 
                type: 'one-time', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }
        showToast("One-time lesson added.", "success");
    } catch (e) { showToast("Error updating schedule.", "error"); }

}

export async function awardStoryWeaverBonusStarToClass(classId) {
    playSound('star2');
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    if (studentsInClass.length === 0) {
        showToast("No students in class to award bonus stars to.", "info");
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const publicDataPath = "artifacts/great-class-quest/public/data";

        studentsInClass.forEach(student => {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, student.id);
            batch.update(scoreRef, {
                monthlyStars: increment(0.5),
                totalStars: increment(0.5)
            });

            const logRef = doc(collection(db, `${publicDataPath}/award_log`));
            batch.set(logRef, {
                studentId: student.id,
                classId: classId,
                teacherId: state.get('currentUserId'),
                stars: 0.5,
                reason: "story_weaver",
                // FIX 1: Use the consistent date format function
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });
        });

        await batch.commit();
        showToast("Story Weaver bonus stars awarded!", "success");

        const word = state.get('currentStoryData')[classId]?.currentWord || "a new idea";
        const systemPrompt = "You are the 'Quest Master's Assistant'. A class just successfully added to their story. Write a very short, single-sentence, celebratory message for the whole class. Do not use markdown.";
        const userPrompt = `The new part of their story involves the word "${word}". Write the celebratory message.`;
        callGeminiApi(systemPrompt, userPrompt).then(comment => showPraiseToast(comment, '✒️')).catch(console.error);

    } catch (error) {
        console.error("Error awarding bonus stars:", error);
        showToast("Failed to award bonus stars.", "error");
    }
}

export async function deleteAdventureLog(logId) {
    showModal('Delete Log Entry?', 'Are you sure you want to permanently delete this entry from the Adventure Log?', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId));
            showToast('Log entry deleted.', 'success');
        } catch (error) {
            console.error("Error deleting log entry:", error);
            showToast('Could not delete the log entry.', 'error');
        }
    });
}

export async function handleEndStory() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    const currentStoryData = state.get('currentStoryData');

    if (!classData || !currentStoryData[classId]) {
        showToast("There is no active story to end.", "info");
        return;
    }

    showModal('Finish this Storybook?', 'This will mark the story as complete and move it to the archive. You will start with a blank page. Are you sure?', async () => {
        const endBtn = document.getElementById('story-weavers-end-btn');
        endBtn.disabled = true;
        endBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/story_data`, classId);
            const historyCollectionRef = collection(db, `${storyDocRef.path}/story_history`);
            const historySnapshot = await getDocs(query(historyCollectionRef, orderBy("createdAt", "asc")));

            if (historySnapshot.empty) {
                showToast("Cannot end an empty story.", "error");
                return;
            }

            const storyChapters = historySnapshot.docs.map(d => d.data());
            const storyTitle = await callGeminiApi(
                "You are an AI that creates short, creative book titles. Based on the story, create a title that is 2-5 words long. Provide only the title, no extra text or quotation marks.",
                `The story is: ${storyChapters.map(c => c.sentence).join(' ')}`
            );

            const batch = writeBatch(db);
            const newArchiveDocRef = doc(collection(db, `${publicDataPath}/completed_stories`));
            
            batch.set(newArchiveDocRef, {
                title: storyTitle,
                classId: classId,
                className: classData.name,
                classLogo: classData.logo,
                completedAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });

            storyChapters.forEach((chapter, index) => {
                const chapterDocRef = doc(collection(db, `${newArchiveDocRef.path}/chapters`));
                batch.set(chapterDocRef, { ...chapter, chapterNumber: index + 1 });
            });
            
            historySnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);

            await batch.commit();
            
            handleStoryWeaversClassSelect(); // This will reset the UI.
            showToast(`Storybook "${storyTitle}" has been archived!`, "success");

        } catch (error) {
            console.error("Error ending story:", error);
            showToast("Failed to archive the story. Please try again.", "error");
        } finally {
            endBtn.disabled = false;
            endBtn.innerHTML = `The End`;
        }
    }, "Yes, Finish It!");
}

export async function handleDeleteCompletedStory(storyId) {
    const story = state.get('allCompletedStories').find(s => s.id === storyId);
    if (!story) return;

    showModal('Delete This Storybook?', `Are you sure you want to permanently delete "${story.title}"? This cannot be undone.`, async () => {
        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/completed_stories`, storyId);
            const chaptersSnapshot = await getDocs(collection(db, `${storyDocRef.path}/chapters`));

            const batch = writeBatch(db);
            chaptersSnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);
            await batch.commit();

            hideModal('storybook-viewer-modal');
            showToast('Storybook deleted.', 'success');
        } catch (error) {
            showToast('Failed to delete storybook.', 'error');
        }
    }, 'Delete Forever');
}

export function handleDeleteTrial(trialId) {
    showModal('Delete Trial Record?', 'Are you sure you want to permanently delete this score? This cannot be undone.', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/written_scores", trialId));
            showToast('Trial record deleted.', 'success');
        } catch (error) {
            console.error("Error deleting trial record:", error);
            showToast('Could not delete the record.', 'error');
        }
    });
}

// This function is now internal to db/actions.js
async function checkAndTriggerStarfall(studentId, newScoreData) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!studentClass) return;

    const classLevel = studentClass.questLevel;
    const isJunior = classLevel === 'Junior A' || classLevel === 'Junior B';
    let bonusTriggered = false;
    let bonusAmount = 0;

    const currentMonthKey = newScoreData.date.substring(0, 7);

    if (newScoreData.type === 'test') {
        const threshold = isJunior ? 37 : 85;
        if (newScoreData.scoreNumeric >= threshold) {
            bonusTriggered = true;
            bonusAmount = 1;
        }
    } else if (newScoreData.type === 'dictation') {
        const studentScoresThisMonth = state.get('allWrittenScores').filter(s => 
            s.studentId === studentId && 
            s.type === 'dictation' &&
            s.date.startsWith(currentMonthKey)
        );

        if (isJunior) {
            const excellentCount = studentScoresThisMonth.filter(s => s.scoreQualitative === 'Great!!!').length;
            if (excellentCount > 2) {
                bonusTriggered = true;
                bonusAmount = 0.5;
            }
        } else {
            const highScores = studentScoresThisMonth.filter(s => (s.scoreNumeric / s.maxScore) * 100 > 85);
            if (highScores.length > 2) {
                bonusTriggered = true;
                bonusAmount = 0.5;
            }
        }

        if (bonusTriggered) {
            const bonusLogsThisMonth = state.get('allAwardLogs').filter(log => 
                log.studentId === studentId && 
                log.reason === 'scholar_s_bonus' && 
                log.date.startsWith(currentMonthKey) &&
                log.note && log.note.includes('dictation')
            ).length;

            if (bonusLogsThisMonth >= 2) {
                bonusTriggered = false;
            }
        }
    }

    if (bonusTriggered) {
        setTimeout(() => showStarfallModal(student.id, student.name, bonusAmount, newScoreData.type), 500);
    }
}

// This function IS exported so the modal can call it
export async function handleAwardBonusStar(studentId, bonusAmount, trialType) {
    playSound('star3');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));

            transaction.update(scoreRef, {
                totalStars: increment(bonusAmount),
                monthlyStars: increment(bonusAmount)
            });

            const logData = {
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: bonusAmount,
                reason: "scholar_s_bonus",
                note: `Awarded for exceptional performance on a ${trialType}.`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            transaction.set(newLogRef, logData);
        });
        showToast(`✨ A ${bonusAmount}-Star Bonus has been bestowed upon ${student.name}! ✨`, 'success');
    } catch (error) {
        console.error("Scholar's Bonus transaction failed:", error);
        showToast('Could not award the bonus star. Please try again.', 'error');
    }
}

export async function handleLogTrial() {
    const classId = document.getElementById('log-trial-class-id').value;
    const studentId = document.getElementById('log-trial-student-select').value;
    const date = document.getElementById('log-trial-date').value;
    const type = document.getElementById('log-trial-type').value;
    const notes = document.getElementById('log-trial-notes').value.trim();
    const editingId = document.getElementById('log-trial-form').dataset.editingId;

    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

    let scoreData = {
        studentId, classId, date: parseDDMMYYYY(date).toISOString().split('T')[0], type, notes,
        teacherId: state.get('currentUserId'),
        title: null,
        scoreNumeric: null,
        scoreQualitative: null,
        maxScore: null
    };

    if (isJunior && type === 'dictation') {
        const scoreEl = document.getElementById('log-trial-score-qualitative');
        if (!scoreEl || !scoreEl.value) { showToast('Please select a score.', 'error'); return; }
        scoreData.scoreQualitative = scoreEl.value;
    } else {
        const titleEl = document.getElementById('log-trial-title');
        if (!titleEl || !titleEl.value.trim()) { showToast('Please enter a title for the test.', 'error'); return; }
        scoreData.title = titleEl.value.trim();

        const maxScore = (isJunior && type === 'test') ? 40 : 100;
        const scoreEl = document.getElementById('log-trial-score-numeric');
        if (!scoreEl || scoreEl.value === '') { showToast('Please enter a score.', 'error'); return; }
        const score = parseInt(scoreEl.value, 10);
        if (isNaN(score) || score < 0 || score > maxScore) { showToast(`Please enter a valid score between 0 and ${maxScore}.`, 'error'); return; }
        scoreData.scoreNumeric = score;
        scoreData.maxScore = maxScore;
    }

    try {
        const btn = document.querySelector('#log-trial-form button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

        if (editingId) {
            const docRef = doc(db, `artifacts/great-class-quest/public/data/written_scores`, editingId);
            await updateDoc(docRef, scoreData);
            showToast("Trial results updated successfully!", "success");
        } else {
            scoreData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, `artifacts/great-class-quest/public/data/written_scores`), scoreData);
            showToast("Trial results recorded successfully!", "success");
            checkAndTriggerStarfall(studentId, {id: docRef.id, ...scoreData});
        }
        
        hideModal('log-trial-modal');

    } catch (error) {
        console.error("Error logging/updating trial:", error);
        showToast("Failed to save the score.", "error");
    } finally {
        const btn = document.querySelector('#log-trial-form button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Record Treasure';
        }
    }
}

export async function saveAdventureLogNote() {
    const logId = document.getElementById('note-log-id-input').value;
    const newNote = document.getElementById('note-textarea').value;
    const log = state.get('allAdventureLogs').find(l => l.id === logId);

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId), {
            note: newNote,
            noteBy: state.get('currentTeacherName')
        });
        showToast('Note saved!', 'success');
        hideModal('note-modal'); // This now works because we imported hideModal
        if (log && newNote.trim() !== '' && newNote !== log.note) {
            triggerNoteToast(log.text, newNote); // This will call the helper function below
        }
    } catch (error) {
        console.error("Error saving note:", error);
        showToast('Failed to save note.', 'error');
    }
}

// This is an internal helper function, so it doesn't need "export"
async function triggerNoteToast(logText, noteText) {
    const systemPrompt = "You are the 'Quest Master's Assistant', a whimsical character in a classroom game. Your job is to read the teacher's note about a day's adventure and provide a short, encouraging, one-sentence comment. Do NOT use markdown. Be positive and brief.";
    const userPrompt = `The AI's log said: "${logText}". The teacher added this note: "${noteText}". What is your one-sentence comment?`;
    try {
        const comment = await callGeminiApi(systemPrompt, userPrompt);
        showPraiseToast(comment, '📝'); // This now works because we imported showPraiseToast
    } catch (error) {
        console.error("Note Toast AI error:", error);
    }
}

export async function saveAwardNote() {
    const logId = document.getElementById('award-note-log-id-input').value;
    const newNote = document.getElementById('award-note-textarea').value;

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/award_log", logId), {
            note: newNote,
        });
        showToast('Note saved!', 'success');
        hideModal('award-note-modal'); // This works because we imported hideModal
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast('Failed to save note.', 'error');
    }
}

export async function handleAddStarsManually() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const date = document.getElementById('star-manager-date').value; // This is YYYY-MM-DD
    const starsToAdd = parseFloat(document.getElementById('star-manager-stars-to-add').value);
    const reason = document.getElementById('star-manager-reason').value;

    if (!studentId || !date || !starsToAdd || starsToAdd <= 0 || !reason) {
        showToast('Please fill out all fields correctly.', 'error');
        return;
    }

    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) {
        showToast('Selected student not found.', 'error');
        return;
    }

    const btn = document.getElementById('star-manager-add-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Adding...';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw new Error("Student score record not found. Cannot add stars.");

            // --- FIX IS HERE ---
            // 'date' is "YYYY-MM-DD". We must convert it to "DD-MM-YYYY"
            const logDateObject = parseDDMMYYYY(date);
            const dateForDb = getDDMMYYYY(logDateObject);
            
            const logData = {
                studentId, classId: student.classId, teacherId: state.get('currentUserId'),
                stars: starsToAdd, reason, date: dateForDb, createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            // --- END FIX ---

            transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);

            const logDate = new Date(date); // YYYY-MM-DD string is parsable by new Date()
            const today = new Date();
            const isCurrentMonth = logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear();

            const updates = { totalStars: increment(starsToAdd) };
            if (isCurrentMonth) {
                updates.monthlyStars = increment(starsToAdd);
            }
            transaction.update(scoreRef, updates);
        });
        showToast(`${starsToAdd} star(s) for ${reason} added to ${student.name}'s log for ${date}.`, 'success');
    } catch (error) {
        console.error("Error adding stars manually: ", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Add Stars to Log';
    }
}

export async function handleSetStudentScores() {
    const studentId = document.getElementById('star-manager-student-select').value;
    if (!studentId) return;

    const todayStarsVal = parseFloat(document.getElementById('override-today-stars').value);
    const monthlyStarsVal = parseFloat(document.getElementById('override-monthly-stars').value);
    const totalStarsVal = parseFloat(document.getElementById('override-total-stars').value);

    if (isNaN(todayStarsVal) || isNaN(monthlyStarsVal) || isNaN(totalStarsVal)) {
        showToast('Please enter valid numbers for all scores.', 'error');
        return;
    }

    const btn = document.getElementById('star-manager-override-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Setting...';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const todayDocId = state.get('todaysStars')[studentId]?.docId;
            const todayDocRef = todayDocId ? doc(db, `${publicDataPath}/today_stars`, todayDocId) : null;

            transaction.update(scoreRef, {
                monthlyStars: monthlyStarsVal,
                totalStars: totalStarsVal
            });

            if (todayStarsVal > 0) {
                const todayData = {
                    studentId, stars: todayStarsVal, date: getTodayDateString(),
                    teacherId: state.get('currentUserId'), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                };
                if (todayDocRef) {
                    transaction.update(todayDocRef, { stars: todayStarsVal });
                } else {
                    transaction.set(doc(collection(db, `${publicDataPath}/today_stars`)), todayData);
                }
            } else {
                if (todayDocRef) {
                    transaction.delete(todayDocRef);
                }
            }
        });
        const student = state.get('allStudents').find(s => s.id === studentId);
        showToast(`Scores for ${student.name} have been updated.`, 'success');

    } catch (error) {
        console.error("Error overriding scores: ", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wrench mr-2"></i> Set Student Scores';
    }
}

export function handlePurgeStudentStars() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    showModal('Purge All Score Data?', `Are you sure you want to delete ALL star score data for ${student.name}? This will reset their scores to zero but will NOT delete their award logs. This cannot be undone.`, async () => {
        const btn = document.getElementById('star-manager-purge-btn');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Purging...';
        try {
            await runTransaction(db, async (transaction) => {
                const scoreRef = doc(db, `artifacts/great-class-quest/public/data/student_scores`, studentId);
                const todayDocId = state.get('todaysStars')[studentId]?.docId;

                if ((await transaction.get(scoreRef)).exists()) {
                    transaction.update(scoreRef, { monthlyStars: 0, totalStars: 0, lastMonthlyResetDate: getStartOfMonthString() });
                }
                if (todayDocId) {
                    transaction.delete(doc(db, `artifacts/great-class-quest/public/data/today_stars`, todayDocId));
                }
            });
            showToast('All star scores purged for student!', 'success');
        } catch (error) { 
            console.error("Error purging stars: ", error); 
            showToast(`Error: ${error.message}`, 'error'); 
        }
        finally { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Purge All Score Data for Student'; 
        }
    });
}

export async function handlePurgeAwardLogs() {
    const btn = document.getElementById('purge-logs-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Purging...';
    try {
        const logsToPurge = state.get('allAwardLogs').filter(log => log.teacherId === state.get('currentUserId'));
        if (logsToPurge.length === 0) { showToast('You have no logs to purge!', 'info'); return; }
        const batch = writeBatch(db);
        logsToPurge.forEach(log => batch.delete(doc(db, `artifacts/great-class-quest/public/data/award_log`, log.id)));
        await batch.commit();
        showToast('All your award logs have been purged! Student scores are not affected.', 'success');
    } catch (error) { console.error("Error purging award logs: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Purge All My Award Logs'; }
}

export async function handleEraseTodaysStars() {
    const btn = document.getElementById('erase-today-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Erasing...';
    try {
        const studentIdsToReset = Object.keys(state.get('todaysStars'));
        if (studentIdsToReset.length === 0) { showToast('You have not awarded any stars today!', 'info'); return; }
        const resetPromises = studentIdsToReset.map(id => setStudentStarsForToday(id, 0, null));
        await Promise.all(resetPromises);
        showToast('All stars awarded by you today have been erased!', 'success');
    } catch (error) { console.error("Error erasing today's stars: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-undo mr-2"></i> Erase Today\'s Stars'; }
}

export async function handleLogAdventure() {
    const classId = state.get('currentLogFilter').classId;
    if (!classId) return;

    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const today = getTodayDateString();
    
    const existingLog = state.get('allAdventureLogs').find(log => log.classId === classId && log.date === today);
    if (existingLog) {
        showToast("Today's adventure has already been chronicled for this class!", 'info');
        return;
    }

    const btn = document.getElementById('log-adventure-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Writing History...`;

    // --- FIX #3: GATHER MORE DATA ---
    const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === today);
    const totalStars = todaysAwards.reduce((sum, award) => sum + award.stars, 0);
    const todaysScores = state.get('allWrittenScores').filter(s => s.classId === classId && s.date === today);

    if (todaysAwards.length === 0 && todaysScores.length === 0) {
        showToast("No stars or scores were recorded for this class today. Nothing to log!", 'info');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
        return;
    }
    
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const todaysAbsences = state.get('allAttendanceRecords').filter(r => r.date === today && r.classId === classId);
    const absentStudentNames = todaysAbsences.map(absence => state.get('allStudents').find(s => s.id === absence.studentId)?.name).filter(Boolean);
    const attendanceSummary = absentStudentNames.length > 0 ? `${absentStudentNames.join(', ')} were absent.` : `Everyone was present.`;

    const reasonCounts = todaysAwards.reduce((acc, award) => {
        if (award.reason) acc[award.reason] = (acc[award.reason] || 0) + 1;
        return acc;
    }, {});
    const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0][0] : "great work";

    const studentStars = todaysAwards.reduce((acc, award) => {
        acc[award.studentId] = (acc[award.studentId] || 0) + award.stars;
        return acc;
    }, {});
    const topStudentId = Object.keys(studentStars).length > 0 ? Object.entries(studentStars).sort((a,b) => b[1] - a[1])[0][0] : null;
    const heroOfTheDay = topStudentId ? state.get('allStudents').find(s => s.id === topStudentId)?.name : "the whole team";
    const ageCategory = getAgeGroupForLeague(classData.questLevel);
    const notesString = todaysAwards.filter(log => log.note).map(log => `(Note for a ${log.reason} award: "${log.note}")`).join(' ');
    
    const academicSummary = todaysScores.map(s => {
        const studentName = state.get('allStudents').find(stu => stu.id === s.studentId)?.name || 'a student';
        const score = s.scoreQualitative || `${s.scoreNumeric}/${s.maxScore}`;
        const note = s.notes ? ` (Note: ${s.notes})` : '';
        return `${studentName} scored ${score} on a ${s.type}${note}.`;
    }).join(' ');
    // --- END DATA GATHERING ---

    try {
        let textSystemPrompt = "";
        // --- FIX #3: UPDATE SYSTEM PROMPT ---
        if (ageCategory === 'junior') { 
            textSystemPrompt = "You are 'The Chronicler,' an AI historian for a fun classroom game. Write a short, exciting diary entry (2-3 sentences) about a class's adventure for the day. Use a storytelling tone with VERY simple words and short sentences suitable for young beginner English learners (ages 7-9). Do NOT use markdown. Incorporate all provided data (stars, scores, attendance, notes) into a cohesive, positive narrative.";
        } else { 
            textSystemPrompt = "You are 'The Chronicler,' an AI historian for a fun classroom game. Write a short, exciting diary entry (2-3 sentences) about a class's adventure for the day. Use a storytelling tone with engaging but still relatively simple English for non-native speakers. Do NOT use markdown. Incorporate all provided data (stars, scores, attendance, notes) into a cohesive, positive narrative.";
        }
        
        // --- FIX #3: UPDATE USER PROMPT ---
        const textUserPrompt = `Write a diary entry for the class '${classData.name}'. Today's data:
- Stars: ${totalStars} stars awarded. Their strongest skill was '${topReason}'. The Hero of the Day was ${heroOfTheDay}.
- Academics: ${academicSummary || 'No trials today.'}
- Attendance: ${attendanceSummary}.
- Teacher's star notes: ${notesString || 'None'}.
Combine these points into a short, engaging story.`;
        const text = await callGeminiApi(textSystemPrompt, textUserPrompt);

        const keywordSystemPrompt = "Analyze the provided text. Extract 2-3 single-word, visually descriptive, abstract nouns or concepts that capture the feeling of the text (e.g., harmony, energy, focus, joy). Output them as a comma-separated list. For example: 'Keywords: unity, discovery, celebration'.";
        const keywordResponse = await callGeminiApi(keywordSystemPrompt, `Text: ${text}`);
        const keywords = keywordResponse.replace('Keywords:', '').split(',').map(kw => kw.trim().toLowerCase());

        const imagePromptSystemPrompt = "You are an expert AI art prompt engineer. Your task is to convert a story and keywords into a short, effective, simplified English prompt for an image generator, under 75 tokens. The style MUST be: 'whimsical children's storybook illustration, watercolor and ink, simple characters, vibrant and cheerful colors, symbolic'. The prompt must be a single, structured paragraph. Focus on the feeling and key symbols, not a literal scene. Conclude with '(Token count: X)'.";
        const imagePromptUserPrompt = `Refactor the following into a high-quality, short image prompt. Story: "${text}". Keywords: ${keywords.join(', ')}.`;
        const imagePrompt = await callGeminiApi(imagePromptSystemPrompt, imagePromptUserPrompt);

        const imageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressedImageBase64 = await compressImageBase64(imageBase64);

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/adventure_logs"), {
            classId, date: today, text, keywords, imageBase64: compressedImageBase64,
            hero: heroOfTheDay, topReason, totalStars,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        showToast("Today's adventure has been chronicled!", 'success');
    } catch (error) {
        console.error("Adventure Log generation error:", error);
        showToast("The Chronicler seems to have lost their ink. Please try again.", 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
    }
}

export async function handleSaveQuestAssignment() {
    const modal = document.getElementById('quest-assignment-modal');
    const editingId = modal.dataset.editingId;
    const classId = document.getElementById('quest-assignment-class-id').value;
    const text = document.getElementById('quest-assignment-textarea').value.trim();

    if (!text) {
        showToast("Please write an assignment before saving.", "info");
        return;
    }

    const btn = document.getElementById('quest-assignment-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        if (editingId) {
            const docRef = doc(db, "artifacts/great-class-quest/public/data/quest_assignments", editingId);
            await updateDoc(docRef, {
                text: text,
                updatedAt: serverTimestamp()
            });
            showToast("Quest assignment updated!", "success");
        } else {
            await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_assignments"), {
                classId,
                text,
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });
            showToast("Quest assignment saved for next lesson!", "success");
        }
        hideModal('quest-assignment-modal');
    } catch (error) {
        console.error("Error saving/updating quest assignment:", error);
        showToast("Failed to save assignment.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Assignment';
    }
}

export function handleStarManagerStudentSelect() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const logFormElements = [
        document.getElementById('star-manager-date'),
        document.getElementById('star-manager-stars-to-add'),
        document.getElementById('star-manager-reason'),
        document.getElementById('star-manager-add-btn'),
        document.getElementById('star-manager-purge-btn')
    ];
    const overrideFormElements = [
        document.getElementById('override-today-stars'),
        document.getElementById('override-monthly-stars'),
        document.getElementById('override-total-stars'),
        document.getElementById('star-manager-override-btn')
    ];
    
    if (studentId) {
        logFormElements.forEach(el => el.disabled = false);
        overrideFormElements.forEach(el => el.disabled = false);
        document.getElementById('star-manager-date').value = new Date().toISOString().split('T')[0];

        const scoreData = state.get('allStudentScores').find(s => s.id === studentId) || {};
        const todayData = state.get('todaysStars')[studentId] || {};
        
        document.getElementById('override-today-stars').value = todayData.stars || 0;
        document.getElementById('override-monthly-stars').value = scoreData.monthlyStars || 0;
        document.getElementById('override-total-stars').value = scoreData.totalStars|| 0;

    } else {
        logFormElements.forEach(el => el.disabled = true);
        overrideFormElements.forEach(el => { el.disabled = true; if(el.tagName === 'INPUT') el.value = 0; });
    }
}

// --- HERO'S CHRONICLE ACTIONS ---

export async function addOrUpdateHeroChronicleNote(studentId, noteText, category, noteId = null) {
    if (!studentId || !noteText || !category) {
        showToast("Missing required note information.", "error");
        return;
    }
    
    const noteData = {
        studentId,
        teacherId: state.get('currentUserId'),
        noteText,
        category,
        updatedAt: serverTimestamp()
    };

    try {
        if (noteId) {
            // Update existing note
            const noteRef = doc(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`, noteId);
            await updateDoc(noteRef, noteData);
            showToast("Note updated successfully!", "success");
        } else {
            // Add new note
            noteData.createdAt = serverTimestamp();
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`), noteData);
            showToast("Note added to Hero's Chronicle!", "success");
        }
    } catch (error) {
        console.error("Error saving Hero's Chronicle note:", error);
        showToast("Failed to save note.", "error");
    }
}

export async function deleteHeroChronicleNote(noteId) {
    try {
        await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`, noteId));
        showToast("Note deleted.", "success");
    } catch (error) {
        console.error("Error deleting Hero's Chronicle note:", error);
        showToast("Failed to delete note.", "error");
    }
}
