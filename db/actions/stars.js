// /db/actions/stars.js — scores, stars, award log, purge
import {
    db,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    writeBatch,
    serverTimestamp,
    increment,
    orderBy,
    limit
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast, showPraiseToast } from '../../ui/effects.js';
import { showStarfallModal, showBatchStarfallModal, showModal, hideModal } from '../../ui/modals.js';
import { playSound, playHeroFanfare } from '../../audio.js';
import { getTodayDateString, getStartOfMonthString, debounce, parseDDMMYYYY } from '../../utils.js';
import { checkBountyProgress } from './bounties.js';
import { calculateHeroGold, canChangeHeroClass } from '../../features/heroClasses.js';

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
                import('../../ui/effects.js').then(m => {
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

const debouncedCheckAndRecordQuestCompletion = debounce(checkAndRecordQuestCompletion, 4000);

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
