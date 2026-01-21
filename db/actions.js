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
    orderBy,
    limit
} from '../firebase.js';
import { calculateHeroGold, canChangeHeroClass } from '../features/heroClasses.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { showStarfallModal, showBatchStarfallModal, showModal, hideModal } from '../ui/modals.js';
import { playSound, playHeroFanfare } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { classColorPalettes } from '../constants.js';
import { handleStoryWeaversClassSelect } from '../features/storyWeaver.js';
import * as modals from '../ui/modals.js';
import { getStartOfMonthString, getTodayDateString, parseDDMMYYYY, parseFlexibleDate, simpleHashCode, getAgeGroupForLeague, getLastLessonDate, compressImageBase64, getDDMMYYYY, debounce } from '../utils.js';
import * as utils from '../utils.js';

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
        document.getElementById('edit-class-modal').classList.add('hidden');
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

// --- SCORE, STAR, & LOG ACTIONS ---

export async function setStudentStarsForToday(studentId, starValue, reason = null) {
    const today = getTodayDateString();
    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    let finalStarValue = starValue;
    const activeEvent = state.get('allQuestEvents').find(e => e.date === today);
    if (activeEvent) {
        if (activeEvent.type === '2x Star Day' && starValue > 0) {
            finalStarValue *= 2;
        } else if (activeEvent.type === 'Reason Bonus Day' && activeEvent.details?.reason === reason && starValue > 0) {
            finalStarValue += 1;
        }
    }

    // Audio
    if (starValue > 0 && reason !== 'welcome_back' && reason !== 'story_weaver' && reason !== 'scholar_s_bonus') {
         if (starValue === 1) playSound('star1');
         else if (starValue === 2) playSound('star2');
         else playSound('star3');
    } else if (reason === 'marked_present') {
         playSound('confirm');
    }
    
    let studentClassId = null;
    let difference = 0;

    // HERO'S BOON LOGIC
    
    try {
        let isHeroBoonEligible = false;
        let heroBoonNote = "";
        const reigningHero = state.get('reigningHero');
        
        // If they are the hero, and this is a positive star award...
        if (reigningHero && reigningHero.id === studentId && starValue > 0) {
            // Check if they already have stars today (we only give the bonus once)
            const hasStarsAlready = state.get('todaysStars')[studentId]?.stars > 0;
            if (!hasStarsAlready) {
                isHeroBoonEligible = true;
                finalStarValue += 1; // Add the bonus star to the total
                heroBoonNote = "🛡️ Includes Hero's Boon (+1 Bonus Star)";
            }
        }
        
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
            
            if (difference === 0 && reason !== 'marked_present' && !todayDocRef) return;

            const studentDoc = await transaction.get(studentRef);
            if (!studentDoc.exists()) throw new Error("Student not found!");
            const studentData = studentDoc.data();
            studentClassId = studentData.classId;

            const scoreDoc = await transaction.get(scoreRef);
            
            if (!scoreDoc.exists()) {
                // Create new score doc
                transaction.set(scoreRef, {
                    totalStars: difference > 0 ? difference : 0,
                    monthlyStars: difference > 0 ? difference : 0,
                    gold: difference > 0 ? difference : 0,
                    inventory: [],
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name }
                });
            } else {
                // Update existing score doc
                const currentData = scoreDoc.data();
                
                // POWER UP: Scroll of the Gilded Star (Triple Gold)
                let multiplier = 1;
                if (difference > 0 && currentData.hasGildedEffect) {
                    multiplier = 3;
                    transaction.update(scoreRef, { hasGildedEffect: false }); // Consume it
                    // NOTE: We can't show a toast from inside a transaction easily, but the gold update will be visible
                }

                // POWER UP: Elixir of Luck (20% chance for +1 Star)
                // We check if luckDate matches TODAY and if we haven't already applied a luck bonus this transaction
                if (currentData.luckDate === today && difference > 0 && !isHeroBoonEligible) {
                    // Simple deterministic check based on time to avoid random in transaction re-runs? 
                    // No, simpler: Just do it. If transaction retries, it might re-roll, which is acceptable.
                    if (Math.random() < 0.20) {
                        finalStarValue += 1; // Add actual star
                        difference += 1; // Update diff
                        // We consume the date so it doesn't trigger again today
                        transaction.update(scoreRef, { luckDate: null });
                    } else {
                        // Consumed without luck (User tried and failed)
                        transaction.update(scoreRef, { luckDate: null });
                    }
                }

                const safeCurrentGold = (typeof currentData.gold === 'number') ? currentData.gold : (currentData.totalStars || 0);
                
                // Calculate Gold with Hero Class AND Gilded Multiplier
                const goldChange = calculateHeroGold(studentData, reason, difference) * multiplier;
                
                if (difference !== 0) {
                    const updates = {
                        totalStars: increment(difference),
                        monthlyStars: increment(difference),
                        gold: safeCurrentGold + goldChange
                    };
                    transaction.update(scoreRef, updates);
                }
            }

            // --- Daily Record Logic (Runs for everyone) ---
            if (todayDocRef) {
                if (finalStarValue === 0 && reason !== 'marked_present') {
                    transaction.delete(todayDocRef);
                } else {
                    transaction.update(todayDocRef, { stars: finalStarValue, reason: reason });
                }
            } else {
                if (finalStarValue > 0 || reason === 'marked_present') {
                    const newTodayDocRef = doc(collection(db, `${publicDataPath}/today_stars`));
                    transaction.set(newTodayDocRef, {
                        studentId, stars: finalStarValue, date: today, reason: reason,
                        teacherId: state.get('currentUserId'), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    });
                }
            }

            // FIX: Find the SPECIFIC log for "standard" daily stars, ignore bonuses
            const allTodaysLogs = state.get('allAwardLogs').filter(l => l.studentId === studentId && l.date === today);
            const dailyPerformanceLog = allTodaysLogs.find(l => !['welcome_back', 'scholar_s_bonus', 'story_weaver'].includes(l.reason));
            
            if (finalStarValue === 0) {
                if (dailyPerformanceLog) transaction.delete(doc(db, `${publicDataPath}/award_log`, dailyPerformanceLog.id));
            } else if (finalStarValue > 0) {
                const logData = {
                    studentId, 
                    classId: studentData.classId, 
                    teacherId: state.get('currentUserId'),
                    stars: finalStarValue, 
                    reason: reason || "excellence", 
                    note: heroBoonNote || "", 
                    date: today, 
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                };

                if (dailyPerformanceLog) {
                     transaction.update(doc(db, `${publicDataPath}/award_log`, dailyPerformanceLog.id), { 
                         stars: finalStarValue, 
                         reason: reason || dailyPerformanceLog.reason
                     });
                } else {
                     transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);
                }
            }
         });

        if (isHeroBoonEligible) {
            const student = state.get('allStudents').find(s => s.id === studentId);
            const firstName = student ? student.name.split(' ')[0] : "Hero";

            // Delayed visual for dramatic effect
            setTimeout(() => {
                import('../ui/effects.js').then(m => {
                    m.showPraiseToast(`${firstName} activated their Hero's Boon! +1 Star added to the coffers!`, '🛡️');
                });
                playSound('magic_chime');
            }, 800);
        }

        // --- Side Effects (After Transaction) ---
        if (studentClassId && difference > 0) {
            debouncedCheckAndRecordQuestCompletion(studentClassId);
            checkBountyProgress(studentClassId, difference);
        }

    } catch (error) {
        console.error('Star update transaction failed:', error);
        showToast('Error saving stars! Please try again.', 'error');
    }
}

export async function checkAndRecordQuestCompletion(classId) {
    const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
    const classDoc = await getDoc(classRef); 
    if (!classDoc.exists()) return;
    
    const currentDifficulty = classDoc.data().difficultyLevel || 0;

    // 1. Check if already completed this month to prevent duplicates
    if (classDoc.data().questCompletedAt && currentDifficulty > 0) {
        const completedDate = classDoc.data().questCompletedAt.toDate();
        const now = new Date();
        if (completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear()) {
            return;
        }
    }

    // 2. Calculate Goals (Same logic as UI)
    const GOAL_PER_STUDENT_BASE = 18;
    const goalPerStudent = GOAL_PER_STUDENT_BASE + (currentDifficulty * 1.5);
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    if (studentCount === 0) return;

    const currentMonth = new Date().getMonth(); 
    let monthModifier = 1.0;
    if (currentMonth === 11 || currentMonth === 3) monthModifier = 0.85; 
    if (currentMonth === 0 || currentMonth === 4) monthModifier = 0.90; 

    const diamondGoal = Math.round(studentCount * goalPerStudent * monthModifier);
    
    // 3. Calculate Current Stars
    const allScores = state.get('allStudentScores');
    let currentMonthlyStars = 0;
    for (const s of studentsInClass) {
        const scoreData = allScores.find(score => score.id === s.id);
        if (scoreData) currentMonthlyStars += (scoreData.monthlyStars || 0);
    }

    // 4. Check for Victory & SAVE HISTORY
    if (currentMonthlyStars >= diamondGoal) {
        console.log(`Class ${classDoc.data().name} has completed the quest!`);

        const batch = writeBatch(db);

        // A. Update the Class (Level Up)
        batch.update(classRef, {
            questCompletedAt: serverTimestamp(),
            difficultyLevel: increment(1) 
        });

        // B. Create Persistent History Record
        const historyRef = doc(collection(db, "artifacts/great-class-quest/public/data/quest_history"));
        batch.set(historyRef, {
            classId: classId,
            className: classDoc.data().name,
            levelReached: currentDifficulty + 1, // They just finished currentDifficulty to reach +1
            goalTarget: diamondGoal,
            starsEarned: currentMonthlyStars,
            completedAt: serverTimestamp(),
            monthKey: new Date().toISOString().slice(0, 7), // "2026-01"
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        });

        await batch.commit();
        showToast(`Quest Complete! History recorded.`, 'success');
        playSound('magic_chime');
    }
}

export async function handleDeleteAwardLog(logId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    try {
        await runTransaction(db, async (transaction) => {
            const logRef = doc(db, `${publicDataPath}/award_log`, logId);
            
            const logDoc = await transaction.get(logRef);
            if (!logDoc.exists()) {
                return; 
            }
            const logData = logDoc.data();
            const actualStars = logData.stars;
            const studentId = logData.studentId;

            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreDoc = await transaction.get(scoreRef);
            if (scoreDoc.exists()) {
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
                     const container = contentEl.querySelector('.mb-4.bg-white'); 
                     if(container && container.querySelectorAll('[id^="log-entry-"]').length === 0) {
                         container.remove(); 
                     }
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

export async function handleAddStarsManually() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const date = document.getElementById('star-manager-date').value; 
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

            const logDateObject = parseDDMMYYYY(date);
            const dateForDb = getDDMMYYYY(logDateObject);
            
            const logData = {
                studentId, classId: student.classId, teacherId: state.get('currentUserId'),
                stars: starsToAdd, reason, date: dateForDb, createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };

            transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);

            const logDate = new Date(date);
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

// --- REVAMPED: QUEST ASSIGNMENT (SINGLE ENTRY) ---

export async function handleSaveQuestAssignment() {
    const classId = document.getElementById('quest-assignment-class-id').value;
    const text = document.getElementById('quest-assignment-textarea').value.trim();
    
    // New Fields from Form
    const formTestDate = document.getElementById('quest-test-date').value;
    const formTestTitle = document.getElementById('quest-test-title').value;
    const formCurriculum = document.getElementById('quest-test-curriculum').value;

    if (!text) {
        showToast("Please write an assignment before saving.", "info");
        return;
    }

    const btn = document.getElementById('quest-assignment-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        
        // 1. Fetch the EXISTING assignment to see if there is a future test we need to keep
        const q = query(
            collection(db, `${publicDataPath}/quest_assignments`),
            where("classId", "==", classId),
            where("createdBy.uid", "==", state.get('currentUserId')),
            orderBy("createdAt", "desc"), // Get latest first
            limit(1)
        );
        const snapshot = await getDocs(q);
        
        let testDataToSave = null;
        let existingTest = null;

        // Extract existing test if available
        if (!snapshot.empty) {
            existingTest = snapshot.docs[0].data().testData;
        }

        // LOGIC: Determine which Test Data to use
        if (formTestDate && formTestTitle) {
            // A. User entered a NEW test in the form -> Use it
            testDataToSave = { date: formTestDate, title: formTestTitle, curriculum: formCurriculum || '' };
        } else if (existingTest) {
            // B. User left form blank, but there was an OLD test. Check if it's still in the future.
            const today = new Date();
            today.setHours(0,0,0,0);
            const oldTestDate = new Date(existingTest.date);
            oldTestDate.setHours(0,0,0,0);

            // Keep it if it is Today or in the Future
            if (oldTestDate >= today) {
                testDataToSave = existingTest;
                console.log("Preserving existing upcoming test:", existingTest.title);
            }
        }

        const batch = writeBatch(db);
        
        // Clean up old assignments to keep DB tidy (optional, but good for cleanliness)
        snapshot.forEach(doc => batch.delete(doc.ref));
        
        const newDocRef = doc(collection(db, `${publicDataPath}/quest_assignments`));
        batch.set(newDocRef, {
            classId,
            text,
            testData: testDataToSave, // Saves either the new one OR the preserved old one
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        });

        await batch.commit();
        showToast("Quest assignment updated!", "success");
        import('../ui/modals.js').then(m => m.hideModal('quest-assignment-modal'));

    } catch (error) {
        console.error("Error updating quest assignment:", error);
        showToast("Failed to save assignment.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Assignment';
    }
}

export async function handleLogAdventure() {
    const classId = state.get('currentLogFilter').classId;
    if (!classId) return;

    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const today = getTodayDateString();
    const existingLog = state.get('allAdventureLogs').find(log => log.classId === classId && log.date === today);
    if (existingLog) {
        showToast("Today's adventure is already recorded!", 'info');
        return;
    }

    const btn = document.getElementById('log-adventure-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Writing History...`;

    // --- CHANGED: Use Writing Sound instead of Drumroll ---
    import('../audio.js').then(m => m.playWritingLoop());

    const nowObj = new Date(); 
    const league = classData.questLevel;
    const ageGroup = getAgeGroupForLeague(league); 

    // --- PERSONALIZATION DATA GATHERING ---
    const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === today);
    const totalStars = todaysAwards.reduce((sum, award) => sum + award.stars, 0);
    
    // Get unique reasons (e.g., "Teamwork, Creativity") instead of just one
    const uniqueReasons = [...new Set(todaysAwards.map(a => a.reason).filter(r => r && r !== 'marked_present'))];
    const topReasonsStr = uniqueReasons.length > 0 ? uniqueReasons.map(r => r.replace(/_/g, ' ')).join(', ') : "general excellence";

    // Get Attendance / Absences
    const attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === today);
    const absentStudentIds = attendanceRecords.map(r => r.studentId);
    const absentNames = state.get('allStudents')
        .filter(s => absentStudentIds.includes(s.id))
        .map(s => s.name.split(' ')[0])
        .join(', ');
    const attendanceText = absentNames ? `We missed our friends: ${absentNames}.` : "The entire party was present!";

    // Hero Selection
    const studentStars = todaysAwards.reduce((acc, award) => { acc[award.studentId] = (acc[award.studentId] || 0) + award.stars; return acc; }, {});
    const eligibleCandidates = Object.keys(studentStars).map(id => {
        const student = state.get('allStudents').find(s => s.id === id);
        if (!student) return null;
        const lastHeroLog = [...state.get('allAdventureLogs')].filter(l => l.classId === classId && l.hero === student.name).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))[0];
        return { name: student.name, stars: studentStars[id], lastHeroDate: lastHeroLog?.createdAt?.toMillis() || 0 };
    }).filter(Boolean).sort((a, b) => a.lastHeroDate - b.lastHeroDate || b.stars - a.stars);
    
    // --- MASK OF THE PROTAGONIST CHECK ---
    const scores = state.get('allStudentScores');
    const protagonist = state.get('allStudents').find(s => 
        s.classId === classId && 
        scores.find(sc => sc.id === s.id)?.pendingHeroStatus === true
    );

    let heroOfTheDay;
    if (protagonist) {
        heroOfTheDay = protagonist.name;
        // Consume the status
        const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", protagonist.id);
        updateDoc(scoreRef, { pendingHeroStatus: false });
    } else {
        heroOfTheDay = eligibleCandidates.length > 0 ? eligibleCandidates[0].name : "the whole team";
    }

   // --- CONTEXT GATHERING ---
    
    // 1. Story Weaver
    const currentStory = state.get('currentStoryData')?.[classId];
    const isStoryActive = todaysAwards.some(l => l.reason === 'story_weaver') || (currentStory?.updatedAt?.toDate().toDateString() === nowObj.toDateString());
    const storyContext = isStoryActive ? `The class continued their Story Weavers saga using the word '${currentStory?.currentWord || "mystery"}'.` : "";

    // 2. Assignments & Tests (NEW)
    const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId);
    // Sort by creation to get latest
    assignments.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    const latestAssignment = assignments[0];
    
    let assignmentContext = "";
    if (latestAssignment) {
        // Check if there is a TEST today
        if (latestAssignment.testData && utils.datesMatch(latestAssignment.testData.date, today)) {
            assignmentContext = `IMPORTANT: Today the class took a TEST titled "${latestAssignment.testData.title}".`;
        } 
        // Or if assignment was created TODAY
        else if (utils.datesMatch(utils.getDDMMYYYY(latestAssignment.createdAt.toDate()), today)) {
            assignmentContext = `New Quest Assignment given: "${latestAssignment.text}".`;
        }
    }

    // 3. Power-Ups Used (NEW)
    // Check logs for specific power-up usage reasons today
    const pathfinderLog = todaysAwards.find(l => l.reason === 'pathfinder_bonus');
    const powerUpContext = pathfinderLog ? `A Pathfinder's Map was used to discover a shortcut!` : "";

    // --- PROMPT ENGINEERING ---
    const textSystemPrompt = `You are 'The Chronicler', writing a class diary entry.
    TARGET AUDIENCE AGE: ${ageGroup}.
    
    INSTRUCTIONS:
    1. Write exactly 5-6 lines.
    2. Tone: Epic, magical, encouraging, tailored to the age group.
    3. Include specific details from the Context provided below (Homework, Tests, Story words) IF they exist.
    4. Mention the Hero of the Day.
    5. Mention specific skills shown (Creativity, Teamwork, etc).
    
    Do not use markdown. Do not use hashtags.`;

    const textUserPrompt = `
    Class Name: ${classData.name}.
    Stars Earned: ${totalStars}.
    Skills Shown: ${topReasonsStr}.
    Hero of the Day: ${heroOfTheDay}.
    Attendance: ${attendanceText}.
    
    CONTEXT EVENTS (Include these if present):
    ${storyContext}
    ${assignmentContext}
    ${powerUpContext}
    
    Write the diary entry.`;

    try {
        const text = await callGeminiApi(textSystemPrompt, textUserPrompt);
        
        // --- SPEED FIX: Reduced wait times for faster loading ---
        await new Promise(r => setTimeout(r, 100)); 

        const imagePrompt = `Whimsical children's storybook illustration of: ${text}. Watercolor style, vibrant, magical atmosphere.`;
        const imageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressed = await compressImageBase64(imageBase64);
        
        const { uploadImageToStorage } = await import('../utils.js');
        const imageUrl = await uploadImageToStorage(compressed, `adventure_logs/${state.get('currentUserId')}/${Date.now()}.jpg`);

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/adventure_logs"), {
            classId, date: today, text, imageUrl, hero: heroOfTheDay, topReason: topReasonsStr.split(',')[0] || 'excellence', totalStars,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        
        // --- STOP WRITING LOOP ---
        import('../audio.js').then(m => m.stopWritingLoop());
        showToast("The adventure has been chronicled!", 'success');

        if (heroOfTheDay !== "the whole team") {
            const heroStudent = state.get('allStudents').find(s => s.name === heroOfTheDay && s.classId === classId);
            if (heroStudent) {
                document.getElementById('hero-celebration-name').innerText = heroStudent.name;
                document.getElementById('hero-celebration-reason').innerText = `For outstanding ${topReasonsStr.split(',')[0] || 'effort'}`;
                const avatarEl = document.getElementById('hero-celebration-avatar');
                avatarEl.innerHTML = heroStudent.avatar ? `<img src="${heroStudent.avatar}" class="w-full h-full object-cover rounded-full">` : `<span class="text-7xl font-bold text-indigo-50">${heroStudent.name.charAt(0)}</span>`;
                import('../ui/modals.js').then(m => m.showAnimatedModal('hero-celebration-modal'));
                import('../audio.js').then(m => m.playHeroFanfare());
            }
        }
    } catch (error) {
        import('../audio.js').then(m => m.stopWritingLoop());
        console.error(error);
        showToast("The Chronicler failed to write. Check connection.", 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
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
            const noteRef = doc(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`, noteId);
            await updateDoc(noteRef, noteData);
            showToast("Note updated successfully!", "success");
        } else {
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
            
            handleStoryWeaversClassSelect();
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

// === MODIFIED SECTION: Starfall Logic & Bulk Saving ===

export async function handleAwardBonusStar(studentId, bonusAmount, trialType) {
    playSound('star3');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreDoc = await transaction.get(scoreRef);
            
            let finalBonus = bonusAmount;

            if (scoreDoc.exists()) {
                const currentScoreData = scoreDoc.data();
                // --- STARFALL CATALYST CHECK ---
                if (currentScoreData.starfallCatalystActive) {
                    finalBonus *= 2;
                    transaction.update(scoreRef, { starfallCatalystActive: false });
                }
            }

            transaction.update(scoreRef, {
                totalStars: increment(finalBonus),
                monthlyStars: increment(finalBonus)
            });

            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
            const logData = {
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: finalBonus,
                reason: "scholar_s_bonus",
                note: `Awarded for exceptional performance on a ${trialType}.`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            transaction.set(newLogRef, logData);
        });
        showToast(`✨ A Bonus has been bestowed upon ${student.name}! ✨`, 'success');
    } catch (error) {
        console.error("Scholar's Bonus transaction failed:", error);
        showToast('Could not award the bonus star. Please try again.', 'error');
    }
}

export async function handleBatchAwardBonus(students) {
    playSound('star3');
    const batch = writeBatch(db);
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const today = getTodayDateString();

    students.forEach(({studentId, bonusAmount, trialType}) => {
        const student = state.get('allStudents').find(s => s.id === studentId);
        if (!student) return;

        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        batch.update(scoreRef, {
            totalStars: increment(bonusAmount),
            monthlyStars: increment(bonusAmount)
        });

        const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
        const logData = {
            studentId,
            classId: student.classId,
            teacherId: state.get('currentUserId'),
            stars: bonusAmount,
            reason: "scholar_s_bonus",
            note: `Awarded for exceptional performance on a ${trialType}.`,
            date: today,
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };
        batch.set(newLogRef, logData);
    });

    try {
        await batch.commit();
        showToast(`✨ ${students.length} Scholars received their bonus stars! ✨`, 'success');
    } catch (error) {
        console.error("Batch Scholar's Bonus failed:", error);
        showToast('Could not award bonuses. Please try again.', 'error');
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
        hideModal('note-modal'); 
        if (log && newNote.trim() !== '' && newNote !== log.note) {
            triggerNoteToast(log.text, newNote); 
        }
    } catch (error) {
        console.error("Error saving note:", error);
        showToast('Failed to save note.', 'error');
    }
}

async function triggerNoteToast(logText, noteText) {
    const systemPrompt = "You are the 'Quest Master's Assistant', a whimsical character in a classroom game. Your job is to read the teacher's note about a day's adventure and provide a short, encouraging, one-sentence comment. Do NOT use markdown. Be positive and brief.";
    const userPrompt = `The AI's log said: "${logText}". The teacher added this note: "${noteText}". What is your one-sentence comment?`;
    try {
        const comment = await callGeminiApi(systemPrompt, userPrompt);
        showPraiseToast(comment, '📝'); 
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
        hideModal('award-note-modal');
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast('Failed to save note.', 'error');
    }
}

export async function handleMarkAbsent(studentId, classId, isAbsent) {
    const today = getTodayDateString();
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const attendanceCollectionRef = collection(db, `${publicDataPath}/attendance`);

    try {
        const q = query(
            attendanceCollectionRef,
            where("studentId", "==", studentId),
            where("date", "==", today)
        );
        const snapshot = await getDocs(q);

        if (isAbsent) {
            // Mark Absent Logic:
            // 1. Create attendance record if not exists
            // 2. Remove ANY stars awarded today (today_stars)
            // 3. Remove logs for today (award_log)
            // 4. Decrement student_scores
            
            if (!snapshot.empty) return; // Already marked absent
            
            await runTransaction(db, async (transaction) => {
                // 1. Create Attendance Record
                const newAttendanceRef = doc(attendanceCollectionRef);
                transaction.set(newAttendanceRef, {
                    studentId,
                    classId,
                    date: today,
                    markedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
                    createdAt: serverTimestamp()
                });

                // 2. Find & Delete 'today_stars'
                const todayStarsQ = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "==", studentId), where("date", "==", today));
                const todayStarsSnap = await getDocs(todayStarsQ);
                
                let starsToRemove = 0;
                
                todayStarsSnap.forEach(doc => {
                    const data = doc.data();
                    starsToRemove += (data.stars || 0);
                    transaction.delete(doc.ref);
                });

                // 3. Find & Delete 'award_log' for today
                // Note: award_log stores date as DD-MM-YYYY string too
                const logsQ = query(collection(db, `${publicDataPath}/award_log`), where("studentId", "==", studentId), where("date", "==", today));
                const logsSnap = await getDocs(logsQ);
                
                logsSnap.forEach(doc => {
                    // Double check stars just in case today_stars was out of sync, but we rely on today_stars for total sum usually
                    // Actually, award_log is the historical record. We should delete them.
                    // We already summed stars from today_stars which tracks the *current* visual count.
                    transaction.delete(doc.ref);
                });

                // 4. Decrement Scores if stars were removed
                if (starsToRemove > 0) {
                    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                    const scoreDoc = await transaction.get(scoreRef);
                    if (scoreDoc.exists()) {
                        transaction.update(scoreRef, {
                            totalStars: increment(-starsToRemove),
                            monthlyStars: increment(-starsToRemove)
                        });
                    }
                }
            });
            
            showToast(`Marked absent. Removed stars for today.`, 'info');

        } else {
            // Mark Present (Undo) Logic: Just delete attendance record
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            showToast(`Marked present.`, 'success');
        }

    } catch (error) {
        console.error("Error updating attendance:", error);
        showToast("Failed to update attendance record.", "error");
    }
}

export async function handleAddQuestEvent() {
    const date = document.getElementById('quest-event-date').value;
    const type = document.getElementById('quest-event-type').value;
    
    if (!date) {
        showToast('System Error: Date is missing. Please close and reopen the planner.', 'error');
        return;
    }
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

        const btn = document.querySelector('#quest-event-form button[type="submit"]');
        btn.disabled = true; btn.innerText = "Adding...";

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_events"), {
            date, type, details,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        
        showToast('Quest Event added to calendar!', 'success');
        import('../ui/modals.js').then(m => m.hideModal('day-planner-modal'));
        
    } catch (error) {
        console.error("Error adding quest event:", error);
        showToast(error.message || 'Failed to save event.', 'error');
    } finally {
        const btn = document.querySelector('#quest-event-form button[type="submit"]');
        if(btn) { btn.disabled = false; btn.innerText = "Add Event"; }
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

export async function handleAddHolidayRange() {
    const name = document.getElementById('holiday-name').value;
    const type = document.getElementById('holiday-type').value;
    const start = document.getElementById('holiday-start').value;
    const end = document.getElementById('holiday-end').value;

    if (!name || !start || !end) {
        showToast("Please fill in all fields.", "error");
        return;
    }
    if (start > end) {
        showToast("Start date must be before end date.", "error");
        return;
    }

    const btn = document.getElementById('add-holiday-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const settingsRef = doc(db, `${publicDataPath}/school_settings`, 'holidays');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(settingsRef);
            let ranges = [];
            if (docSnap.exists()) {
                ranges = docSnap.data().ranges || [];
            }
            
            // Add new range
            ranges.push({ id: Date.now().toString(), name, type, start, end });
            
            // Sort by date
            ranges.sort((a, b) => a.start.localeCompare(b.start));
            
            transaction.set(settingsRef, { ranges });
        });
        
        showToast("Holiday range added!", "success");
        document.getElementById('holiday-name').value = '';
        document.getElementById('holiday-start').value = '';
        document.getElementById('holiday-end').value = '';
    } catch (e) {
        console.error(e);
        showToast("Error saving holiday.", "error");
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Add Range';
    }
}

export async function handleDeleteHolidayRange(rangeId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const settingsRef = doc(db, `${publicDataPath}/school_settings`, 'holidays');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(settingsRef);
            if (!docSnap.exists()) return;
            
            let ranges = docSnap.data().ranges || [];
            ranges = ranges.filter(r => r.id !== rangeId);
            
            transaction.update(settingsRef, { ranges });
        });
        showToast("Holiday removed.", "success");
    } catch (e) {
        showToast("Error deleting holiday.", "error");
    }
}

export async function handleRemoveAttendanceColumn(classId, dateString, isGlobal = false) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    try {
        const batch = writeBatch(db);
        
        // 1. Determine which classes to affect
        let classesToCancel = [];
        if (isGlobal) {
            // Find ALL classes that usually have a lesson on this day of the week
            const dayOfWeek = new Date(dateString.split('-').reverse().join('-')).getDay().toString();
            classesToCancel = state.get('allSchoolClasses').filter(c => c.scheduleDays && c.scheduleDays.includes(dayOfWeek));
        } else {
            // Just the selected class
            classesToCancel = [{ id: classId }];
        }

        // 2. Create Overrides for all affected classes
        for (const cls of classesToCancel) {
            const overrideRef = doc(collection(db, `${publicDataPath}/schedule_overrides`));
            batch.set(overrideRef, { 
                date: dateString, 
                classId: cls.id, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }

        // 3. Delete Attendance Records for all affected classes on this day
        const classIds = classesToCancel.map(c => c.id);
        // Note: Firestore 'in' query is limited to 10, so we loop queries to be safe or just simple loop
        for (const cid of classIds) {
            const q = query(
                collection(db, `${publicDataPath}/attendance`), 
                where("classId", "==", cid), 
                where("date", "==", dateString)
            );
            const snap = await getDocs(q);
            snap.forEach(doc => batch.delete(doc.ref));
        }

        await batch.commit();

        const msg = isGlobal ? `School Holiday set for ${dateString}.` : `Class cancelled for ${dateString}.`;
        showToast(msg, "success");
        
        // Refresh the view
        const { renderAttendanceChronicle } = await import('../ui/modals.js');
        await renderAttendanceChronicle(classId);

    } catch (error) {
        console.error("Error removing attendance column:", error);
        showToast("Failed to remove date.", "error");
    }
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

export async function ensureHistoryLoaded() {
    if (state.get('hasLoadedCalendarHistory')) return;

    const loader = document.getElementById('calendar-loader');
    if (loader) loader.classList.remove('hidden');

    const { getDocs, query, collection, where, orderBy } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('../firebase.js'); 

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const publicDataPath = "artifacts/great-class-quest/public/data";

    const q = query(
        collection(db, `${publicDataPath}/award_log`),
        where('createdAt', '>=', thirtyDaysAgo)
    );

    try {
        const snapshot = await getDocs(q);
        const historyLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const currentLogs = state.get('allAwardLogs');
        const logMap = new Map();
        
        historyLogs.forEach(log => logMap.set(log.id, log));
        currentLogs.forEach(log => logMap.set(log.id, log));
        
        const mergedLogs = Array.from(logMap.values());
        
        state.setAllAwardLogs(mergedLogs);
        state.setHasLoadedCalendarHistory(true); 
        console.log(`History loaded. Total logs available: ${mergedLogs.length}`);
        
    } catch (e) {
        console.error("Error loading history:", e);
    } finally {
        if (loader) loader.classList.add('hidden');
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

// --- THE ECONOMY (SHOP & INVENTORY) ---

export async function handleGenerateShopStock() {
    // 1. Determine Context (League)
    let league = state.get('globalSelectedLeague');
    
    // Fallback: If no league selected, try to infer from class ID
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        if (classId) {
            const cls = state.get('allSchoolClasses').find(c => c.id === classId);
            if (cls) league = cls.questLevel;
        }
    }

    if (!league) {
        showToast("Please select a Class or League first!", "error");
        return;
    }

    const btn = document.getElementById('generate-shop-btn');
    const loader = document.getElementById('shop-loader');
    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    const monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    btn.disabled = true;
    loader.classList.remove('hidden');
    container.innerHTML = ''; 
    emptyState.classList.add('hidden');

    try {
        // --- STEP 0: CLEAR OLD STOCK ---
        const publicDataPath = "artifacts/great-class-quest/public/data";
        
        const q = query(
            collection(db, `${publicDataPath}/shop_items`),
            where("league", "==", league),
            where("monthKey", "==", monthKey),
            where("teacherId", "==", state.get('currentUserId'))
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // --- STEP 1: PREPARE PROMPT ---
        const now = new Date();
        const currentMonth = now.getMonth(); 
        const currentYear = now.getFullYear();
        const ageCategory = getAgeGroupForLeague(league); 
        const isJunior = ageCategory === '7-8' || ageCategory === '8-9' || league.includes('Junior');

        // Smart Season Context
        let seasonContext = "";
        if (currentMonth === 11) seasonContext = "Winter, Christmas, Festive, Snow, Holidays, Gifts";
        else if (currentMonth === 3 && currentYear === 2026) seasonContext = "Spring, Orthodox Easter, Red Eggs, Candles";
        else if (currentMonth === 0 || currentMonth === 1) seasonContext = "Winter, Ice, Frost";
        else if (currentMonth >= 2 && currentMonth <= 4) seasonContext = "Spring, Flowers, Nature";
        else if (currentMonth >= 5 && currentMonth <= 7) seasonContext = "Summer, Beach, Sun";
        else if (currentMonth >= 8 && currentMonth <= 10) seasonContext = "Autumn, Halloween";

        // Style Context - FORCING ICONS/STICKERS
        let styleContext = "";
        let itemContext = "";
        let languageInstruction = "";
        
        if (isJunior) {
            // Junior: Force "Sticker" style to ensure isolation
            styleContext = "a die-cut vector sticker, thick white outline, flat color, simple shapes, cartoon style, white background";
            itemContext = "magical toys, cute pets, colorful candies, fun hats";
            languageInstruction = "Use simple English (7-9yo). Max 8 words.";
        } else {
            // Senior: Force "Game Icon" style to ensure single object
            styleContext = "a fantasy rpg inventory icon, 3d render, centered, neutral background, high detail";
            itemContext = "ancient artifacts, scrolls, potions, enchanted gear";
            languageInstruction = "Use exciting English (10-13yo). Max 10 words.";
        }

        const systemPrompt = `You are a creative RPG item generator for a school app. 
        Target Audience: ${league} students (approx age ${ageCategory}).
        Theme: ${seasonContext}.
        
        Requirements:
        1. Generate 15 UNIQUE handheld objects.
        2. PRICE TIERS (CRITICAL):
           - 5 "Common" items: 10-18 Gold (Easy to get in 1 month).
           - 5 "Rare" items: 35-50 Gold (Requires saving for 2-3 months).
           - 5 "Legendary" items: 80-120 Gold (Long-term "End of Term" trophies).
        3. DESCRIPTIONS: ${languageInstruction}
        4. Output Format: A valid JSON array of objects: [{"name": "string", "desc": "string", "price": number}].
        Do NOT use markdown.`;
        
        const jsonString = await callGeminiApi(systemPrompt, "Generate the JSON list now.");
        const cleanJson = jsonString.replace(/```json|```/g, '').trim();
        let itemsData = [];
        try {
            itemsData = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse failed, retrying...");
            const fixedJson = await callGeminiApi("Fix this JSON:", cleanJson);
            itemsData = JSON.parse(fixedJson.replace(/```json|```/g, '').trim());
        }

        // --- STEP 2: GENERATE IMAGES & SAVE ---
        const { uploadImageToStorage } = await import('../utils.js');
        
        const chunkSize = 3;
        for (let i = 0; i < itemsData.length; i += chunkSize) {
            const chunk = itemsData.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (item) => {
                try {
                    // FIX: Prompt Engineering for Isolation
                    // 1. Put the Name FIRST.
                    // 2. Wrap Name in ((brackets)) to emphasize it.
                    // 3. Explicitly state "single isolated object".
                    const positivePrompt = `(single isolated object) of ((${item.name})), ${item.desc}. ${styleContext}. centered, full shot, high quality.`;
                    
                    // FIX: Aggressive Anti-Texture Negative Prompt
                    const negativePrompt = "pattern, texture, wallpaper, seamless, repeating, tiling, grid, background, scenery, landscape, text, watermark, blurry, noise, cropped, multiple objects, pile, heap";
                    
                    const base64 = await callCloudflareAiImageApi(positivePrompt, negativePrompt);
                    const compressed = await compressImageBase64(base64, 256, 256);
                    const path = `shop_items/${state.get('currentUserId')}/${monthKey}_${simpleHashCode(item.name)}_${Date.now()}.jpg`;
                    const url = await uploadImageToStorage(compressed, path);

                    const docRef = doc(collection(db, `${publicDataPath}/shop_items`));
                    await setDoc(docRef, {
                        name: item.name,
                        description: item.desc,
                        price: item.price,
                        image: url,
                        league: league, 
                        monthKey: monthKey,
                        teacherId: state.get('currentUserId'),
                        createdAt: serverTimestamp(),
                        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    });
                } catch (err) {
                    console.error("Item gen failed:", item.name, err);
                }
            }));
        }

        showToast(`${itemsData.length} new seasonal treasures arrived for ${league}!`, 'success');
        import('../ui/core.js').then(m => m.renderShopUI());

    } catch (error) {
        console.error("Shop generation failed:", error);
        showToast('The Merchant got lost. Try again.', 'error');
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
}

export async function handleBulkSaveTrial() {
    const modal = document.getElementById('bulk-trial-modal');
    const classId = modal.dataset.classId;
    const type = modal.dataset.type;
    const isJunior = modal.dataset.isJunior === 'true';
    
    const date = document.getElementById('bulk-trial-date').value;
    const title = document.getElementById('bulk-trial-name').value.trim();

    if (!date) {
        showToast('Please select a date.', 'error');
        return;
    }

    if (type === 'test' && !title) {
        showToast('Please enter a title for the test.', 'error');
        return;
    }

    const rows = document.querySelectorAll('.bulk-log-item');
    if (rows.length === 0) return;

    const btn = document.getElementById('bulk-trial-save-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    const batch = writeBatch(db);
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoresCollection = collection(db, `${publicDataPath}/written_scores`);
    
    let operationsCount = 0;
    const potentialStarfallStudents = [];
    const savedScoresData = []; // Collection for personal best check

    try {
        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const trialId = row.dataset.trialId; 
            const isAbsent = row.querySelector('.toggle-absent-btn').classList.contains('is-absent');
            const input = row.querySelector('.bulk-grade-input');
            const val = input.value;

            if (isAbsent) {
                if (trialId) {
                    batch.delete(doc(scoresCollection, trialId));
                    operationsCount++;
                }
                return;
            }

            if (!val) return;

            const maxScore = (isJunior && type === 'test') ? 40 : 100;
            
            let scoreData = {
                studentId,
                classId,
                date,
                type,
                title: type === 'test' ? title : null,
                teacherId: state.get('currentUserId'),
                notes: null,
                scoreNumeric: null,
                scoreQualitative: null,
                maxScore: maxScore
            };

            if (isJunior && type === 'dictation') {
                scoreData.scoreQualitative = val;
            } else {
                scoreData.scoreNumeric = parseInt(val, 10);
            }

            savedScoresData.push({ ...scoreData, id: trialId || 'new' }); 

            // Logic for Starfall Eligibility Check
            let bonusAmount = 0;
            let isEligible = false;

            if (type === 'test') {
                const threshold = isJunior ? 38 : 96; 
                if (scoreData.scoreNumeric >= threshold) {
                    bonusAmount = 1;
                    isEligible = true;
                }
            } else if (type === 'dictation') {
                let isHighDictation = false;
                if (isJunior) {
                    if (val === 'Great!!!') isHighDictation = true;
                } else {
                    if ((scoreData.scoreNumeric / maxScore) * 100 > 85) isHighDictation = true;
                }

                if (isHighDictation) {
                    potentialStarfallStudents.push({ studentId, type: 'dictation', bonusAmount: 0.5 });
                }
            }

            if (isEligible && type === 'test') {
                potentialStarfallStudents.push({ studentId, scoreData, type, bonusAmount });
            }

            if (trialId) {
                batch.update(doc(scoresCollection, trialId), scoreData);
            } else {
                const newRef = doc(scoresCollection);
                scoreData.createdAt = serverTimestamp();
                batch.set(newRef, scoreData);
            }
            operationsCount++;
        });

        if (operationsCount > 0) {
            await batch.commit();
            showToast('All grades saved successfully!', 'success');
            
            // Dynamic import to avoid circular dependency issues
            import('../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));

            // --- PERSONAL BEST CHECK ---
            savedScoresData.forEach(savedScore => {
                if (savedScore.type === 'test' && savedScore.scoreNumeric !== null) {
                    const studentId = savedScore.studentId;
                    const student = state.get('allStudents').find(s => s.id === studentId);
                    const newScorePercent = (savedScore.scoreNumeric / savedScore.maxScore) * 100;

                    const previousScores = state.get('allWrittenScores')
                        .filter(s => s.studentId === studentId && s.type === 'test' && s.id !== savedScore.id);

                    const maxPreviousScore = previousScores.length > 0 
                        ? Math.max(...previousScores.map(s => (s.scoreNumeric / s.maxScore) * 100))
                        : 0;

                    if (newScorePercent > maxPreviousScore && maxPreviousScore > 0) {
                        setTimeout(() => { 
                            showPraiseToast(`${student.name} just set a new Personal Best on their test!`, '🏆');
                        }, 700);
                    }
                }
            });

            // --- PROCESS STARFALL FOR BATCH ---
            const finalEligibleStudents = [];
            
            // Test Bonuses
            const testWinners = potentialStarfallStudents.filter(p => p.type === 'test');
            testWinners.forEach(w => {
                const s = state.get('allStudents').find(st => st.id === w.studentId);
                if(s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: w.bonusAmount, trialType: 'test' });
            });

            // Dictation Bonuses
            const dictationCandidates = potentialStarfallStudents.filter(p => p.type === 'dictation');
            if (dictationCandidates.length > 0) {
                const currentMonthKey = date.substring(0, 7); 
                
                dictationCandidates.forEach(cand => {
                    const studentScoresThisMonth = state.get('allWrittenScores').filter(s => 
                        s.studentId === cand.studentId && 
                        s.type === 'dictation' &&
                        s.date.startsWith(currentMonthKey)
                    );
                    
                    let highCount = 1; // Current one counts
                    
                    if (isJunior) {
                        highCount += studentScoresThisMonth.filter(s => s.scoreQualitative === 'Great!!!').length;
                    } else {
                        highCount += studentScoresThisMonth.filter(s => (s.scoreNumeric / s.maxScore) * 100 > 85).length;
                    }

                    if (highCount >= 3) {
                        const bonusLogsThisMonth = state.get('allAwardLogs').filter(log => 
                            log.studentId === cand.studentId && 
                            log.reason === 'scholar_s_bonus' && 
                            log.date.startsWith(currentMonthKey) &&
                            log.note && log.note.includes('dictation')
                        ).length;

                        if (bonusLogsThisMonth < 2) { 
                            const s = state.get('allStudents').find(st => st.id === cand.studentId);
                            if(s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: 0.5, trialType: 'dictation' });
                        }
                    }
                });
            }

            if (finalEligibleStudents.length > 0) {
                setTimeout(() => {
                    import('../ui/modals.js').then(m => m.showBatchStarfallModal(finalEligibleStudents));
                }, 500);
            }

        } else {
            showToast('No changes to save.', 'info');
            import('../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));
        }

    } catch (error) {
        console.error("Bulk save error:", error);
        showToast("Failed to save scores. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save mr-2"></i> Save All`;
    }
}

export async function handleBuyItem(studentId, itemId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    // 1. Determine if it's Legendary or Seasonal
    const isLegendary = itemId.startsWith('leg_');
    let item;

    if (isLegendary) {
        const { LEGENDARY_ARTIFACTS } = await import('../features/powerUps.js');
        item = LEGENDARY_ARTIFACTS.find(i => i.id === itemId);
    } else {
        item = state.get('currentShopItems').find(i => i.id === itemId);
    }

    if (!item) return;

    // --- NEW: Hero of the Day Discount Logic ---
    let finalPrice = item.price;
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;
    
    // Discount applies ONLY to Seasonal items (not Legendary)
    if (isHero && !isLegendary) {
        finalPrice = Math.floor(item.price * 0.75); // 25% Discount
    }

    // 2. UI Pre-check and Optimistic Update preparation
    const buyBtn = document.querySelector(`.shop-buy-btn[data-id="${itemId}"]`);
    
    // 3. DB Transaction
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    
    try {
        let newGoldBalance = 0;

        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw "Student data missing";

            // If it's seasonal, we MUST verify it still exists in the database
            if (!isLegendary) {
                const itemRef = doc(db, `${publicDataPath}/shop_items`, itemId);
                const itemDoc = await transaction.get(itemRef);
                if (!itemDoc.exists()) throw "Item already sold!";
                transaction.delete(itemRef);
            }

            const data = scoreDoc.data();
            const currentDbGold = data.gold !== undefined ? data.gold : (data.totalStars || 0);
            const currentInventory = data.inventory || [];

            if (currentDbGold < finalPrice) throw "Not enough gold!";
            
            newGoldBalance = currentDbGold - finalPrice; // Calculate for UI

            transaction.update(scoreRef, {
                gold: increment(-finalPrice), 
                inventory: [...currentInventory, {
                    id: item.id,
                    name: item.name,
                    image: item.image || null,
                    description: item.description,
                    acquiredAt: new Date().toISOString()
                }]
            });
        });
        
        // --- SUCCESS: Update UI Immediately ---
        playSound('cash');
        
        // 1. Update Gold Display Instantly
        const goldDisplay = document.getElementById('shop-student-gold');
        if (goldDisplay) {
            goldDisplay.innerText = `${newGoldBalance} 🪙`;
            // Add a flash effect
            goldDisplay.style.color = '#ef4444'; // Red momentarily
            setTimeout(() => goldDisplay.style.color = '', 500);
        }

        // 2. Remove item card if seasonal
        if (!isLegendary && buyBtn) {
            const card = buyBtn.closest('.shop-item-card');
            if(card) {
                card.style.transition = 'all 0.5s';
                card.style.transform = 'scale(0)';
                setTimeout(() => card.remove(), 500);
            }
        }

        // 3. Show Proper Popup (Modal)
        showModal(
            'Purchase Successful!', 
            `${student.name} bought "${item.name}" for ${finalPrice} Gold.\n\nRemaining Balance: ${newGoldBalance} Gold.`, 
            () => {}, // No action needed on confirm
            'Awesome!'
        );

        // --- FIX: Update Local State Immediately ---
        const allScores = state.get('allStudentScores');
        const studentIndex = allScores.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            // Update the local state object directly so the UI render sees the new gold
            allScores[studentIndex].gold = newGoldBalance;
            // Also push the new item to inventory so the button says "Owned" immediately
            if (!allScores[studentIndex].inventory) allScores[studentIndex].inventory = [];
            
            allScores[studentIndex].inventory.push({
                id: item.id,
                name: item.name,
                image: item.image || null,
                description: item.description,
                acquiredAt: new Date().toISOString()
            });
            state.setAllStudentScores(allScores);
        }
       
        // 4. Refresh buttons logic (disable items they can no longer afford)
        import('../ui/core.js').then(m => m.updateShopStudentDisplay(studentId));

    } catch (error) {
        console.error(error);
        showToast(typeof error === 'string' ? error : "Transaction failed.", "error");
        import('../ui/core.js').then(m => m.renderShopUI());
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
                
                // FIX: Ensure gold persists (do not set to 0, read current value or default)
                const currentGold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);

                transaction.update(scoreRef, { 
                    monthlyStars: 0, 
                    lastMonthlyResetDate: currentMonthStart,
                    gold: currentGold // Explicitly write it back to save it
                });
            }
        });
    } catch (error) { 
        console.error(`Failed monthly reset & archive for ${studentId}:`, error); 
    }
}

export async function handleManualGoldUpdate() {
    const studentId = document.getElementById('economy-student-select').value;
    const newGold = parseInt(document.getElementById('economy-gold-input').value);

    if (!studentId || isNaN(newGold)) {
        showToast('Please select a student and enter a valid amount.', 'error');
        return;
    }

    const btn = document.getElementById('save-gold-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        
        await updateDoc(scoreRef, {
            gold: newGold
        });

        showToast('Coin balance updated successfully!', 'success');
        
        // Update the visual pill if visible
        const goldDisplay = document.getElementById(`student-gold-display-${studentId}`);
        if(goldDisplay) goldDisplay.innerText = newGold;

    } catch (error) {
        console.error("Error updating gold:", error);
        showToast("Failed to update gold.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Update Balance';
    }
}

export async function handleSpecialOccasionBonus(studentId, type) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    
    const bonus = type === 'birthday' ? 2.5 : 1.5;
    const reason = type === 'birthday' ? 'Birthday Bonus' : 'Nameday Bonus';
    const icon = type === 'birthday' ? '🎂' : '🎈';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));

            // Add to totals WITHOUT affecting daily cap (only total/monthly)
            transaction.update(scoreRef, {
                totalStars: increment(bonus),
                monthlyStars: increment(bonus),
                gold: increment(bonus) // They get gold too!
            });

            // Log it
            const logData = {
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: bonus,
                reason: 'scholar_s_bonus', // Use scholar bonus type to prevent standard stats skew
                note: `${icon} ${reason} Celebration!`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            transaction.set(newLogRef, logData);
        });
        
        showToast(`${student.name} received +${bonus} Stars for their special day!`, 'success');
        import('../ui/modals.js').then(m => m.hideModal('celebration-bonus-modal'));
        playSound('magic_chime');

    } catch (error) {
        console.error("Bonus Error:", error);
        showToast("Error applying bonus.", "error");

        
    }
}

// --- GENDER RESOLVER (Quota Saver - Rule Safe) ---

export async function resolveMissingGenders() {
    const currentUserId = state.get('currentUserId'); // Get your ID
    const allStudents = state.get('allStudents');
    
    // 1. Find students WITHOUT gender AND created by YOU
    // This prevents the batch from failing due to Firebase "isOwner" rules
    const unclassified = allStudents.filter(s => 
        !s.gender && 
        s.createdBy && 
        s.createdBy.uid === currentUserId
    );

    if (unclassified.length === 0) return; 

    console.log(`Resolving genders for ${unclassified.length} of your students...`);

    // 2. Prepare the list for the AI (ID + Name)
    const listToAnalyze = unclassified.map(s => ({ id: s.id, name: s.name.split(' ')[0] }));

    // 3. Ask AI (ONE single call for everyone)
    const systemPrompt = "You are a name classifier. You will receive a list of student names. Classify them as 'boy' or 'girl' based on Greek and International naming conventions. If ambiguous, guess based on common probability. Return strictly valid JSON: { 'student_id': 'boy'|'girl', ... }.";
    const userPrompt = `Classify these students: ${JSON.stringify(listToAnalyze)}`;

    try {
        const jsonStr = await callGeminiApi(systemPrompt, userPrompt);
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        const resultMap = JSON.parse(cleanJson);

        // 4. Batch Save to Firebase
        const batch = writeBatch(db);
        let count = 0;

        Object.entries(resultMap).forEach(([id, gender]) => {
            if (listToAnalyze.find(s => s.id === id)) {
                const docRef = doc(db, "artifacts/great-class-quest/public/data/students", id);
                batch.update(docRef, { gender: gender.toLowerCase() });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Gender resolved and saved for ${count} students.`);
        }

    } catch (e) {
        console.error("Gender resolution failed (Quota saved, will try next time):", e);
    }
}
