// /db/actions.js — facade: re-exports from modular actions; keeps two legacy functions not yet in modules.
import {
    db,
    doc,
    collection,
    writeBatch,
    serverTimestamp,
    increment
} from '../firebase.js';
import * as state from '../state.js';
import { showToast, showPraiseToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi } from '../api.js';
import { getTodayDateString } from '../utils.js';

export * from './actions/index.js';

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

    const { getDocs, query, collection: firestoreCollection, where } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db: firestoreDb } = await import('../firebase.js');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const publicDataPath = "artifacts/great-class-quest/public/data";

    const q = query(
        firestoreCollection(firestoreDb, `${publicDataPath}/award_log`),
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
