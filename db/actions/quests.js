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

    import('../../audio.js').then(m => m.playWritingLoop());

    const nowObj = new Date();
    const league = classData.questLevel;
    const ageGroup = getAgeGroupForLeague(league);
    const ageTier = _getAgeTierFromLeague(league);

    const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === today);
    const totalStars = todaysAwards.reduce((sum, award) => sum + (Number(award.stars) || 0), 0);
    const uniqueReasons = [...new Set(todaysAwards.map(a => a.reason).filter(r => r && r !== 'marked_present'))];
    const reasonLabels = uniqueReasons.map(r => r.replace(/_/g, ' '));
    const topReasonsStr = reasonLabels.length > 0 ? reasonLabels.join(', ') : 'general excellence';

    const attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === today);
    const absentStudentIds = new Set(attendanceRecords.map(r => r.studentId));
    const classStudents = state.get('allStudents').filter(s => s.classId === classId);
    const presentStudents = classStudents.filter(s => !absentStudentIds.has(s.id));
    const absentNames = classStudents.filter(s => absentStudentIds.has(s.id)).map(s => s.name.split(' ')[0]).join(', ');
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
    if (latestAssignment?.testData && utils.datesMatch(latestAssignment.testData.date, today)) {
        assignmentContext = `Today the class took the test "${latestAssignment.testData.title}".`;
    } else if (latestAssignment?.createdAt?.toDate && utils.datesMatch(utils.getDDMMYYYY(latestAssignment.createdAt.toDate()), today)) {
        assignmentContext = `Next lesson quest assignment: "${latestAssignment.text}".`;
    }

    const pathfinderLog = todaysAwards.find(l => l.reason === 'pathfinder_bonus');
    const powerUpContext = pathfinderLog ? "A Pathfinder's Map was used today." : '';

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
        const rawResponse = await callGeminiApi(systemPrompt, userPrompt);
        const diary = _parseDiaryJson(rawResponse, {
            defaultTitle: `${classData.name} Chronicle`,
            defaultEntry: rawResponse,
            fallbackKeywords: reasonLabels
        });

        await new Promise(r => setTimeout(r, 120));
        const imagePrompt = `Whimsical storybook illustration for classroom diary. Title: "${diary.title}". Scene: ${diary.entry}. Hero focus: ${heroOfTheDay}. Watercolor, magical, uplifting, no text.`;
        const imageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressed = await compressImageBase64(imageBase64);

        const { uploadImageToStorage } = await import('../../utils.js');
        const imageUrl = await uploadImageToStorage(compressed, `adventure_logs/${state.get('currentUserId')}/${Date.now()}.jpg`);

        await addDoc(collection(db, 'artifacts/great-class-quest/public/data/adventure_logs'), {
            classId,
            date: today,
            title: diary.title,
            text: diary.entry,
            highlights: diary.highlights,
            keywords: diary.keywords,
            hero: heroOfTheDay,
            heroStudentId: heroStudentId || null,
            ageTier,
            imageUrl,
            topReason: reasonLabels[0] || 'excellence',
            totalStars,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });

        import('../../audio.js').then(m => m.stopWritingLoop());
        showToast('The adventure has been chronicled!', 'success');

        if (heroStudentId) {
            const heroStudent = state.get('allStudents').find(s => s.id === heroStudentId);
            if (heroStudent) {
                document.getElementById('hero-celebration-name').innerText = heroStudent.name;
                document.getElementById('hero-celebration-reason').innerText = 'The Class Hero!';
                const avatarEl = document.getElementById('hero-celebration-avatar');
                avatarEl.innerHTML = heroStudent.avatar
                    ? `<img src="${heroStudent.avatar}" class="w-full h-full object-cover rounded-full">`
                    : `<span class="text-7xl font-bold text-indigo-50">${heroStudent.name.charAt(0)}</span>`;
                import('../../ui/modals.js').then(m => m.showAnimatedModal('hero-celebration-modal'));
                import('../../audio.js').then(m => m.playHeroFanfare());
            }
        }
    } catch (error) {
        import('../../audio.js').then(m => m.stopWritingLoop());
        console.error(error);
        showToast('The Chronicler failed to write. Check connection.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
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
    const protagonist = presentStudents.find(s => (allScores.find(sc => sc.id === s.id)?.pendingHeroStatus === true));

    let chosenId = null;
    const rotation = classData?.heroRotation || {};
    let cycleHeroIds = Array.isArray(rotation.cycleHeroIds) ? rotation.cycleHeroIds.filter(id => presentSet.has(id)) : [];
    const lastHeroId = rotation.lastHeroId || null;

    if (protagonist) {
        chosenId = protagonist.id;
        const protagonistScoreRef = doc(db, 'artifacts/great-class-quest/public/data/student_scores', protagonist.id);
        await updateDoc(protagonistScoreRef, { pendingHeroStatus: false });
    } else {
        let unused = presentIds.filter(id => !cycleHeroIds.includes(id));
        if (unused.length === 0) {
            cycleHeroIds = [];
            unused = [...presentIds];
        }
        let candidates = unused;
        if (lastHeroId && candidates.length > 1) {
            const filtered = candidates.filter(id => id !== lastHeroId);
            candidates = filtered.length ? filtered : candidates;
        }
        chosenId = candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (!cycleHeroIds.includes(chosenId)) cycleHeroIds.push(chosenId);
    const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);
    await updateDoc(classRef, {
        heroRotation: {
            cycleHeroIds,
            lastHeroId: chosenId,
            updatedAt: serverTimestamp()
        }
    });

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
        document.getElementById('override-total-stars').value = scoreData.totalStars|| 0;

    } else {
        logFormElements.forEach(el => el.disabled = true);
        overrideFormElements.forEach(el => { el.disabled = true; if(el.tagName === 'INPUT') el.value = 0; });
    }
}
