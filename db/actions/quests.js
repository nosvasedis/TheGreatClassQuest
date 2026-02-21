
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

    import('../audio.js').then(m => m.playWritingLoop());

    const nowObj = new Date(); 
    const league = classData.questLevel;
    const ageGroup = getAgeGroupForLeague(league); 

    // --- PERSONALIZATION DATA GATHERING ---
    const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === today);
    const totalStars = todaysAwards.reduce((sum, award) => sum + award.stars, 0);
    
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

    // --- HERO SELECTION (FAIR & RANDOM) ---
    // 1. Get all students in this class
    const classStudents = state.get('allStudents').filter(s => s.classId === classId);
    
    // [FIX]: Filter out students who are ABSENT today so they cannot be picked
    const presentStudents = classStudents.filter(s => !absentStudentIds.includes(s.id));

    // 2. Get names of everyone who has EVER been a hero in this class
    const pastHeroNames = state.get('allAdventureLogs')
        .filter(l => l.classId === classId && l.hero)
        .map(l => l.hero);

    // 3. Find students who have NEVER been hero from the PRESENT list
    let candidates = presentStudents.filter(s => !pastHeroNames.includes(s.name));

    // 4. If everyone present has been a hero, reset pool (allow everyone present again)
    // But exclude the person who was hero *yesterday* to prevent back-to-back
    if (candidates.length === 0 && presentStudents.length > 0) {
        const lastHeroName = state.get('allAdventureLogs')
            .filter(l => l.classId === classId)
            .sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))[0]?.hero;
            
        candidates = presentStudents.filter(s => s.name !== lastHeroName);
        // Safety: If the only student present was the hero yesterday, allow them anyway
        if (candidates.length === 0) candidates = presentStudents;
    }

    // 5. Pick a RANDOM winner from the candidates
    let heroStudentObj = null;
    if (candidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        heroStudentObj = candidates[randomIndex];
    }
    
    const heroOfTheDayCandidate = heroStudentObj ? heroStudentObj.name : "The Class Team";
    
    // --- MASK OF THE PROTAGONIST CHECK ---
    // (Only checks students who are actually present)
    const scores = state.get('allStudentScores');
    const protagonist = presentStudents.find(s => 
        scores.find(sc => sc.id === s.id)?.pendingHeroStatus === true
    );

    let heroOfTheDay;
    if (protagonist) {
        heroOfTheDay = protagonist.name;
        // Consume the status
        const scoreRef = doc(db, "artifacts/great-class-quest/public/data/student_scores", protagonist.id);
        updateDoc(scoreRef, { pendingHeroStatus: false });
    } else {
        heroOfTheDay = heroOfTheDayCandidate;
    }

   // --- CONTEXT GATHERING ---
    
    // 1. Story Weaver
    const currentStory = state.get('currentStoryData')?.[classId];
    const isStoryActive = todaysAwards.some(l => l.reason === 'story_weaver') || (currentStory?.updatedAt?.toDate().toDateString() === nowObj.toDateString());
    const storyContext = isStoryActive ? `The class continued their Story Weavers saga using the word '${currentStory?.currentWord || "mystery"}'.` : "";

    // 2. Assignments & Tests [FIX: Explicit wording for Next Lesson]
    const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId);
    assignments.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    const latestAssignment = assignments[0];
    
    let assignmentContext = "";
    if (latestAssignment) {
        // Check if there is a TEST today
        if (latestAssignment.testData && utils.datesMatch(latestAssignment.testData.date, today)) {
            assignmentContext = `IMPORTANT EVENT TODAY: The class took a TEST titled "${latestAssignment.testData.title}".`;
        } 
        // Or if assignment was created TODAY
        else if (utils.datesMatch(utils.getDDMMYYYY(latestAssignment.createdAt.toDate()), today)) {
            assignmentContext = `HOMEWORK ASSIGNED FOR NEXT LESSON: "${latestAssignment.text}".`;
        }
    }

    // 3. Power-Ups Used
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
    6. If Homework is listed, mention it clearly as the quest for next time.
    
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
        
        import('../audio.js').then(m => m.stopWritingLoop());
        showToast("The adventure has been chronicled!", 'success');

        if (heroOfTheDay !== "the whole team") {
            const heroStudent = state.get('allStudents').find(s => s.name === heroOfTheDay && s.classId === classId);
            if (heroStudent) {
                document.getElementById('hero-celebration-name').innerText = heroStudent.name;
                document.getElementById('hero-celebration-reason').innerText = "The Class Hero!"; 
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
