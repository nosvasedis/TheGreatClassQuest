// /db/actions/quests.js — quest assignments, adventure log, star manager
import {
    db,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    runTransaction,
    writeBatch,
    serverTimestamp,
    increment,
    orderBy,
    limit
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import * as utils from '../../utils.js';
import { getTodayDateString, getAgeGroupForLeague, compressImageBase64 } from '../../utils.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../../api.js';

// --- REVAMPED: QUEST ASSIGNMENT (SINGLE ENTRY) ---

export async function handleSaveQuestAssignment() {
    const classId = document.getElementById('quest-assignment-class-id').value;
    const rawText = document.getElementById('quest-assignment-textarea').value.trim();

    // New Fields from Form
    const formTestDate = document.getElementById('quest-test-date').value;
    const formTestTitle = document.getElementById('quest-test-title').value;
    const formCurriculum = document.getElementById('quest-test-curriculum').value;

    if (!rawText) {
        showToast("Please write an assignment before saving.", "info");
        return;
    }
    const text = rawText;

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
            today.setHours(0, 0, 0, 0);
            const oldTestDate = new Date(existingTest.date);
            oldTestDate.setHours(0, 0, 0, 0);

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
        import('../../ui/modals.js').then(m => m.hideModal('quest-assignment-modal'));

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

    const { canUseFeature } = await import('../../utils/subscription.js');
    const hasEliteAI = canUseFeature('eliteAI');
    const hasAdventureLog = canUseFeature('adventureLog');

    if (!hasAdventureLog) {
        const { showUpgradePrompt } = await import('../../utils/upgradePrompt.js');
        const { getUpgradeMessage } = await import('../../config/tiers/features.js');
        showUpgradePrompt({ feature: 'Adventure Log', tier: 'Pro', message: getUpgradeMessage('Pro', 'adventureLog') });
        return;
    }

    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const today = getTodayDateString();
    const classStudents = state.get('allStudents').filter(s => s.classId === classId);
    const todaysStars = state.get('todaysStars') || {};
    const hasAwardedStarsToday = classStudents.some(s => (Number(todaysStars[s.id]?.stars) || 0) > 0);
    if (!hasAwardedStarsToday) {
        showToast("Award stars to this class first, then log today's adventure.", "info");
        return;
    }
    const existingLog = state.get('allAdventureLogs').find(log => log.classId === classId && log.date === today);
    if (existingLog) {
        showToast("Today's adventure is already recorded!", 'info');
        return;
    }

    if (hasEliteAI) {
        // Elite: Use AI generation (current implementation)
        await handleAILogAdventure(classId, classData);
    } else {
        // Pro: Use manual entry
        await handleManualLogAdventure(classId, classData);
    }
}

function buildAdventureLogKeywords(text) {
    return String(text || '')
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\p{L}\p{N}_-]/gu, ''))
        .filter(word => word.length > 3)
        .slice(0, 6);
}

function syncHeroLine(text, heroName) {
    const storyText = String(text || '').trim();
    const normalizedHeroName = String(heroName || 'The Class Team').trim() || 'The Class Team';
    const heroLine = `Hero of the Day: ${normalizedHeroName}.`;
    const heroLinePattern = /(^|\n{1,2})Hero of the Day:\s*[^\n]+/im;

    if (!storyText) return heroLine;
    if (heroLinePattern.test(storyText)) {
        return storyText.replace(heroLinePattern, (match, prefix = '') => `${prefix}${heroLine}`);
    }
    return `${storyText}\n\n${heroLine}`;
}

async function saveAdventureLogWithHeroWin(logPayload, heroStudentId = null) {
    const publicDataPath = 'artifacts/great-class-quest/public/data';
    const logRef = doc(collection(db, `${publicDataPath}/adventure_logs`));

    await runTransaction(db, async (transaction) => {
        let scoreRef = null;
        let scoreDoc = null;

        if (heroStudentId) {
            scoreRef = doc(db, `${publicDataPath}/student_scores`, heroStudentId);
            scoreDoc = await transaction.get(scoreRef);
        }

        transaction.set(logRef, logPayload);

        if (heroStudentId && scoreRef) {
            if (scoreDoc?.exists()) {
                transaction.update(scoreRef, { heroOfDayWins: increment(1) });
            } else {
                transaction.set(scoreRef, { heroOfDayWins: 1 }, { merge: true });
            }
        }
    });

    return logRef.id;
}

function getPresentStudentsForClass(classId) {
    const attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === getTodayDateString());
    const absentStudentIds = new Set(attendanceRecords.map(r => r.studentId));
    return state.get('allStudents').filter(s => s.classId === classId && !absentStudentIds.has(s.id));
}

async function showHeroOfTheDayReveal(heroStudentId, reasonText = 'The Class Hero!') {
    if (!heroStudentId) return;

    const heroStudent = state.get('allStudents').find(s => s.id === heroStudentId);
    if (!heroStudent) return;

    state.setReigningHero(heroStudent);
    import('../../features/home.js').then(m => m.renderHomeTab()).catch(() => {});

    document.getElementById('hero-celebration-name').innerText = heroStudent.name;
    document.getElementById('hero-celebration-reason').innerText = reasonText;
    const avatarEl = document.getElementById('hero-celebration-avatar');
    avatarEl.innerHTML = heroStudent.avatar
        ? `<img src="${heroStudent.avatar}" class="w-full h-full object-cover rounded-full">`
        : `<span class="text-7xl font-bold text-indigo-50">${heroStudent.name.charAt(0)}</span>`;

    const [{ showAnimatedModal }, audio] = await Promise.all([
        import('../../ui/modals.js'),
        import('../../audio.js')
    ]);
    showAnimatedModal('hero-celebration-modal');
    audio.playHeroFanfare();
}

async function handleAILogAdventure(classId, classData) {
    const btn = document.getElementById('log-adventure-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Writing History...`;

    import('../../audio.js').then(m => m.playWritingLoop());

    const nowObj = new Date();
    const league = classData.questLevel;
    const ageGroup = getAgeGroupForLeague(league);
    const ageTier = _getAgeTierFromLeague(league);

    const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === getTodayDateString());
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const classPathfinderBonus = Number(classData.teamQuestBonuses?.[monthKey]) || 0;
    const pathfinderUsedToday = classData.lastPathfinderDate === getTodayDateString();
    const todaysPathfinderBonus = pathfinderUsedToday ? Math.max(10, classPathfinderBonus > 0 ? 10 : 0) : 0;
    const totalStars = todaysAwards.reduce((sum, award) => sum + (Number(award.stars) || 0), 0) + todaysPathfinderBonus;
    const uniqueReasons = [...new Set(todaysAwards.map(a => a.reason).filter(r => r && r !== 'marked_present'))];
    const reasonLabels = uniqueReasons.map(r => r.replace(/_/g, ' '));
    const topReasonsStr = reasonLabels.length > 0 ? reasonLabels.join(', ') : 'general excellence';

    const attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === getTodayDateString());
    const absentStudentIds = new Set(attendanceRecords.map(r => r.studentId));
    const classStudentsForAttendance = state.get('allStudents').filter(s => s.classId === classId);
    const presentStudents = classStudentsForAttendance.filter(s => !absentStudentIds.has(s.id));
    const absentNames = classStudentsForAttendance.filter(s => absentStudentIds.has(s.id)).map(s => s.name.split(' ')[0]).join(', ');
    const attendanceText = absentNames ? `We missed our friends: ${absentNames}.` : 'The entire party was present!';

    const heroSelection = await _selectHeroOfTheDay(classId, classData, presentStudents);
    const heroOfTheDay = heroSelection.heroName;
    const heroStudentId = heroSelection.heroStudentId;

    const currentStory = state.get('currentStoryData')?.[classId];
    const isStoryActive = todaysAwards.some(l => l.reason === 'story_weaver') || (currentStory?.updatedAt?.toDate?.().toDateString() === nowObj.toDateString());
    const storyContext = isStoryActive ? `Story Weavers continued with the word "${currentStory?.currentWord || 'mystery'}".` : '';

    const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId)
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const latestAssignment = assignments[0];
    let assignmentContext = '';
    if (latestAssignment?.testData && utils.datesMatch(latestAssignment.testData.date, getTodayDateString())) {
        assignmentContext = `Today the class took the test "${latestAssignment.testData.title}".`;
    } else if (latestAssignment?.createdAt?.toDate && utils.datesMatch(utils.getDDMMYYYY(latestAssignment.createdAt.toDate()), getTodayDateString())) {
        assignmentContext = `Next lesson quest assignment: "${latestAssignment.text}".`;
    }

    const powerUpContext = pathfinderUsedToday ? "A Pathfinder's Map was used today." : '';

    const systemPrompt = `You are The Chronicler, writing a class diary.
Return ONLY valid JSON:
{
  "title": "short title",
  "entry": "5-7 lines as one paragraph with sentence breaks.",
  "highlights": ["short highlight", "short highlight", "short highlight"],
  "keywords": ["keyword", "keyword", "keyword"]
}
Rules:
- Audience age group: ${ageGroup}
- Tone by tier:
  - junior: vivid, simple words, warm encouragement.
  - mid: energetic and reflective.
  - senior: richer language, still classroom-safe and encouraging.
- Mention Hero of the Day naturally.
- Include attendance, skills shown, and important class events when provided.
- No markdown. No extra keys.`;

    const userPrompt = `Tier: ${ageTier}
Class: ${classData.name}
Stars earned today: ${totalStars}
Skills shown: ${topReasonsStr}
Hero of the day: ${heroOfTheDay}
Attendance: ${attendanceText}
Story context: ${storyContext || 'none'}
Assignment/Test context: ${assignmentContext || 'none'}
Power-up context: ${powerUpContext || 'none'}`;

    try {
        let rawResponse = '';
        try {
            rawResponse = await callGeminiApi(systemPrompt, userPrompt);
        } catch (error) {
            console.error('Chronicler text generation failed:', error);
            showToast('The Chronicler could not write today\'s chronicle.', 'error');
            return;
        }

        const diary = _parseDiaryJson(rawResponse, {
            defaultTitle: `${classData.name} Chronicle`,
            defaultEntry: rawResponse,
            fallbackKeywords: reasonLabels
        });

        let imageUrl = null;
        let imageFailed = false;
        try {
            await new Promise(r => setTimeout(r, 120));
            const imagePrompt = `Whimsical storybook illustration for classroom diary. Title: "${diary.title}". Scene: ${diary.entry}. Hero focus: ${heroOfTheDay}. Watercolor, magical, uplifting, no text.`;
            const imageBase64 = await callCloudflareAiImageApi(imagePrompt);
            const compressed = await compressImageBase64(imageBase64);

            const { uploadImageToStorage } = await import('../../utils.js');
            imageUrl = await uploadImageToStorage(compressed, `adventure_logs/${state.get('currentUserId')}/${Date.now()}.jpg`);
        } catch (error) {
            imageFailed = true;
            console.error('Chronicler artwork generation/upload failed:', error);
        }

        try {
            await saveAdventureLogWithHeroWin({
                classId,
                date: getTodayDateString(),
                title: diary.title,
                text: diary.entry,
                highlights: diary.highlights,
                keywords: diary.keywords,
                hero: heroOfTheDay,
                heroStudentId: heroStudentId || null,
                entryMode: 'ai',
                ageTier,
                imageUrl,
                topReason: reasonLabels[0] || 'excellence',
                totalStars,
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
                createdAt: serverTimestamp()
            }, heroStudentId);
        } catch (error) {
            console.error('Chronicler save failed:', error);
            showToast('The Chronicler wrote the entry, but saving it failed.', 'error');
            return;
        }

        showToast(
            imageFailed
                ? 'The chronicle was saved without artwork because the image step failed.'
                : 'The adventure has been chronicled!',
            imageFailed ? 'info' : 'success'
        );

        await showHeroOfTheDayReveal(heroStudentId, 'The Class Hero!');
    } finally {
        import('../../audio.js').then(m => m.stopWritingLoop());
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
    }
}

async function handleManualLogAdventure(classId, classData) {
    // Show manual entry modal
    const { showModal } = await import('../../ui/modals.js');
    
    const modalContent = `
        <div class="p-6">
            <h3 class="font-title text-2xl text-teal-700 mb-4 text-center">Write Today's Adventure</h3>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Title for today's entry:</label>
                <input type="text" id="manual-log-title" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., A Day of Discovery">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Today's adventure story:</label>
                <textarea id="manual-log-text" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Write about today's lesson, achievements, and memorable moments..."></textarea>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Highlights (optional, comma-separated):</label>
                <input type="text" id="manual-log-highlights" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g., Great participation, Creative answers, Team work">
                <p class="text-xs text-teal-700 mt-2">When you save, the app will crown today's Hero of the Day and add them to the chronicle automatically.</p>
            </div>
            <div class="flex gap-3">
                <button type="button" id="save-manual-log-btn" class="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-title py-2 rounded-lg bubbly-button">
                    <i class="fas fa-save mr-2"></i> Save Entry
                </button>
                <button type="button" id="cancel-manual-log-btn" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-title py-2 rounded-lg bubbly-button">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    showModal('Manual Adventure Log Entry', modalContent, () => {}, '', true);
    
    // Add event listeners
    document.getElementById('save-manual-log-btn').addEventListener('click', async () => await saveManualLogEntry(classId, classData));
    document.getElementById('cancel-manual-log-btn').addEventListener('click', () => {
        import('../../ui/modals.js').then(m => m.hideModal());
    });
}

async function saveManualLogEntry(classId, classData) {
    const title = document.getElementById('manual-log-title').value.trim();
    const text = document.getElementById('manual-log-text').value.trim();
    const highlightsText = document.getElementById('manual-log-highlights').value.trim();
    
    if (!title || !text) {
        showToast('Please fill in both title and story.', 'error');
        return;
    }
    
    const logBtn = document.getElementById('log-adventure-btn');
    const saveBtn = document.getElementById('save-manual-log-btn');
    logBtn.disabled = true;
    logBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-crown mr-2"></i> Crowning Hero...`;

    try {
        const highlights = highlightsText ? highlightsText.split(',').map(h => h.trim()).filter(h => h) : [];
        const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === getTodayDateString());
        const presentStudents = getPresentStudentsForClass(classId);
        const heroSelection = await _selectHeroOfTheDay(classId, classData, presentStudents);
        const storyText = syncHeroLine(text, heroSelection.heroName);
        const keywords = buildAdventureLogKeywords(storyText);
        
        await saveAdventureLogWithHeroWin({
            classId,
            date: getTodayDateString(),
            title: title.slice(0, 90),
            text: storyText,
            highlights: highlights.slice(0, 4),
            keywords,
            hero: heroSelection.heroName,
            heroStudentId: heroSelection.heroStudentId || null,
            entryMode: 'manual',
            ageTier: _getAgeTierFromLeague(classData.questLevel),
            imageUrl: null,
            topReason: highlights[0] || 'excellence',
            totalStars: todaysAwards.reduce((sum, award) => sum + (Number(award.stars) || 0), 0),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        }, heroSelection.heroStudentId);
        
        const { hideModal } = await import('../../ui/modals.js');
        hideModal();
        showToast('Your adventure has been recorded!', 'success');

        await showHeroOfTheDayReveal(heroSelection.heroStudentId, 'Crowned in today\'s chronicle!');
    } catch (error) {
        console.error("Error saving manual log:", error);
        showToast('Failed to save your entry. Please try again.', 'error');
    } finally {
        logBtn.disabled = false;
        logBtn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-save mr-2"></i> Save Entry`;
        }
    }
}

function _getAgeTierFromLeague(league) {
    const normalized = String(league || '').toLowerCase();
    if (normalized.includes('junior')) return 'junior';
    if (normalized === 'a' || normalized === 'b') return 'mid';
    return 'senior';
}

function _parseDiaryJson(raw, { defaultTitle, defaultEntry, fallbackKeywords = [] }) {
    const safeEntry = String(defaultEntry || '').replace(/```/g, '').trim();
    const result = {
        title: defaultTitle,
        entry: safeEntry || 'Today was a bright step forward on our class quest.',
        highlights: [],
        keywords: fallbackKeywords.slice(0, 4).map(k => String(k).toLowerCase().replace(/\s+/g, '_'))
    };

    try {
        const cleaned = String(raw || '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return result;
        const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        if (typeof parsed.title === 'string' && parsed.title.trim()) result.title = parsed.title.trim().slice(0, 90);
        if (typeof parsed.entry === 'string' && parsed.entry.trim()) result.entry = parsed.entry.trim();
        if (Array.isArray(parsed.highlights)) {
            result.highlights = parsed.highlights.map(h => String(h).trim()).filter(Boolean).slice(0, 4);
        }
        if (Array.isArray(parsed.keywords)) {
            result.keywords = parsed.keywords.map(k => String(k).toLowerCase().trim().replace(/\s+/g, '_')).filter(Boolean).slice(0, 6);
        }
    } catch (_) {
        // Keep safe fallback.
    }
    return result;
}

async function _selectHeroOfTheDay(classId, classData, presentStudents) {
    if (!presentStudents.length) return { heroName: 'The Class Team', heroStudentId: null };

    const presentIds = presentStudents.map(s => s.id);
    const presentSet = new Set(presentIds);
    const allScores = state.get('allStudentScores');

    // Check for a student with pendingHeroStatus (teacher-designated special hero)
    const protagonist = presentStudents.find(s => (allScores.find(sc => sc.id === s.id)?.pendingHeroStatus === true));

    let chosenId = null;
    const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);

    // --- READ FRESH from Firestore to avoid stale heroRotation in allTeachersClasses state ---
    const classDoc = await getDoc(classRef);
    const freshRotation = classDoc.exists() ? (classDoc.data().heroRotation || {}) : {};

    // Filter cycleHeroIds to only include students currently present
    let cycleHeroIds = Array.isArray(freshRotation.cycleHeroIds)
        ? freshRotation.cycleHeroIds.filter(id => presentSet.has(id))
        : [];
    const lastHeroId = freshRotation.lastHeroId || null;

    if (protagonist) {
        chosenId = protagonist.id;
        const protagonistScoreRef = doc(db, 'artifacts/great-class-quest/public/data/student_scores', protagonist.id);
        await updateDoc(protagonistScoreRef, { pendingHeroStatus: false });
    } else {
        // Find students NOT yet used in this rotation cycle
        let unused = presentIds.filter(id => !cycleHeroIds.includes(id));

        // All present students have had a turn — reset cycle
        if (unused.length === 0) {
            cycleHeroIds = [];
            unused = [...presentIds];
        }

        // Always exclude the previous hero to prevent back-to-back repeats
        let candidates = unused;
        if (lastHeroId && candidates.length > 1) {
            const filtered = candidates.filter(id => id !== lastHeroId);
            candidates = filtered.length ? filtered : candidates;
        }

        chosenId = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Record this student as used in the current cycle
    if (!cycleHeroIds.includes(chosenId)) cycleHeroIds.push(chosenId);

    const newRotation = {
        cycleHeroIds,
        lastHeroId: chosenId,
        cycleSize: presentIds.length,
        updatedAt: serverTimestamp()
    };

    // Persist updated rotation to Firestore
    await updateDoc(classRef, { heroRotation: newRotation });

    // Update local state so within the same session it reflects the new rotation immediately
    const allTeachersClasses = state.get('allTeachersClasses');
    const classIndex = allTeachersClasses.findIndex(c => c.id === classId);
    if (classIndex !== -1) {
        allTeachersClasses[classIndex] = {
            ...allTeachersClasses[classIndex],
            heroRotation: { cycleHeroIds, lastHeroId: chosenId, cycleSize: presentIds.length }
        };
        state.setAllTeachersClasses(allTeachersClasses);
    }

    const student = presentStudents.find(s => s.id === chosenId) || state.get('allStudents').find(s => s.id === chosenId);
    return { heroName: student?.name || 'The Class Team', heroStudentId: student?.id || null };
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
        document.getElementById('override-total-stars').value = scoreData.totalStars || 0;

    } else {
        logFormElements.forEach(el => el.disabled = true);
        overrideFormElements.forEach(el => { el.disabled = true; if (el.tagName === 'INPUT') el.value = 0; });
    }
}
